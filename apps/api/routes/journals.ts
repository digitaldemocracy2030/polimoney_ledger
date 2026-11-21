/**
 * 仕訳 API
 *
 * データアクセスはユーザーの JWT 付きクライアント（c.get("supabase")、RLS 適用）を使う。
 * 台帳ロールの確認は lib/authz.ts で明示的に行う（RLS と二重の防御）。
 * service client は以下の特権処理でのみ使う（いずれも authz 確認の後）:
 * - 年度締め状態の確認（台帳メンバー全員に対して判定するため）
 * - 他メンバーがアップロードした証憑の署名付き URL 発行・削除（Storage RLS は本人フォルダのみ）
 * - 承認時の Hub 同期に必要な台帳情報の取得
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "../lib/types.ts";
import { httpError } from "../lib/errors.ts";
import { getServiceClient } from "../lib/supabase.ts";
import { assertYearOpen } from "../lib/year-closure.ts";
import {
  assertContactUsableInLedger,
  assertSubAccountsUsableInLedger,
  isReceiptPathOfAsset,
  type LedgerAccess,
  requireJournalAccess,
  requireLedgerPermission,
} from "../lib/authz.ts";
import {
  canSelfApprove,
  hasPermission,
} from "@polimoney-ledger/shared/permissions.ts";
import {
  isTestUser,
  type SyncContactInput,
  syncContacts,
  type SyncJournalInput,
  syncJournals,
  syncLedger,
  type SyncLedgerInput,
} from "../lib/hub-client.ts";
import {
  type LedgerContact,
  type LedgerJournal,
  type LedgerJournalEntry,
  shouldSync,
  transformJournalForSync,
} from "../lib/sync-transform.ts";

export const journalsRouter = new Hono<AppEnv>();

/** 証憑ファイルの Storage バケット */
const RECEIPTS_BUCKET = "receipts";
/** 証憑の署名付き URL の有効期限（秒） */
const RECEIPT_URL_EXPIRES_IN = 60 * 60;

interface JournalEntryInput {
  account_code: string;
  sub_account_id?: string | null;
  debit_amount: number;
  credit_amount: number;
}

interface CreateJournalRequest {
  ledger_id: string;
  journal_date: string | null;
  description: string;
  contact_id?: string | null;
  classification?: string | null;
  non_monetary_basis?: string | null;
  notes?: string | null;
  amount_political_grant?: number;
  amount_political_fund?: number;
  amount_public_subsidy?: number;
  is_receipt_hard_to_collect?: boolean;
  receipt_hard_to_collect_reason?: string | null;
  /** 資産取得仕訳（資産一覧に表示する） */
  is_asset_acquisition?: boolean;
  asset_type?: string | null;
  status?: "draft" | "approved";
  entries: JournalEntryInput[];
}

type UpdateJournalRequest = Partial<
  Omit<CreateJournalRequest, "ledger_id" | "status">
>;

// ============================================
// ヘルパー
// ============================================

async function readJsonBody<T>(c: Context<AppEnv>): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    throw httpError(400, "リクエストの形式が正しくありません");
  }
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 仕訳明細のバリデーション（不正なら 400 を throw） */
function validateEntries(entries: unknown): JournalEntryInput[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw httpError(400, "仕訳明細は必須です");
  }
  for (const e of entries as JournalEntryInput[]) {
    if (!e || typeof e.account_code !== "string" || !e.account_code) {
      throw httpError(400, "勘定科目を選択してください");
    }
    if (
      !isNonNegativeInt(e.debit_amount) || !isNonNegativeInt(e.credit_amount)
    ) {
      throw httpError(400, "金額は 0 以上の整数で入力してください");
    }
  }
  const list = entries as JournalEntryInput[];
  const totalDebit = list.reduce((sum, e) => sum + e.debit_amount, 0);
  const totalCredit = list.reduce((sum, e) => sum + e.credit_amount, 0);
  if (totalDebit !== totalCredit) {
    throw httpError(400, "借方と貸方の合計が一致しません");
  }
  if (totalDebit === 0) {
    throw httpError(400, "金額を入力してください");
  }
  return list;
}

function toEntryRows(journalId: string, entries: JournalEntryInput[]) {
  return entries.map((entry) => ({
    journal_id: journalId,
    account_code: entry.account_code,
    sub_account_id: entry.sub_account_id || null,
    debit_amount: entry.debit_amount,
    credit_amount: entry.credit_amount,
  }));
}

/**
 * 既存の仕訳を変更・削除できるか確認する
 * - 承認済み: registerJournal 権限（即時登録できるロール）が必要
 * - 下書き: 起票者本人（submitJournal）または approveJournal 権限を持つロール
 */
function assertCanModify(
  access: LedgerAccess & {
    journal: { submitted_by_user_id: string; status: string };
  },
  userId: string,
) {
  const { journal, role } = access;
  if (journal.status === "approved") {
    if (!hasPermission(role, "registerJournal")) {
      throw httpError(403, "承認済みの仕訳を変更する権限がありません");
    }
    return;
  }
  const isSubmitter = journal.submitted_by_user_id === userId &&
    hasPermission(role, "submitJournal");
  if (!isSubmitter && !hasPermission(role, "approveJournal")) {
    throw httpError(403, "この仕訳を変更する権限がありません");
  }
}

/** 仕訳の journal_date を取得する（年度締め確認用） */
async function getJournalDate(
  supabase: SupabaseClient,
  journalId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("journals")
    .select("journal_date")
    .eq("id", journalId)
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch journal:", error);
    throw httpError(500, "仕訳の取得に失敗しました");
  }
  if (!data) {
    throw httpError(404, "仕訳が見つかりません");
  }
  return data.journal_date as string;
}

/** PostgREST の埋め込み結果（単一 or 配列）から 1 件を取り出す */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ============================================
// GET /journals - 自分が起票した仕訳一覧
// ============================================

journalsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const filter = c.req.query("filter");
  if (filter && filter !== "draft" && filter !== "approved") {
    throw httpError(
      400,
      "filter には draft または approved を指定してください",
    );
  }

  let query = c.get("supabase")
    .from("journals")
    .select(
      `
      id, journal_date, description, status, ledger_id, contact_id, created_at,
      journal_entries ( id, account_code, debit_amount, credit_amount ),
      contacts ( name )
    `,
    )
    .eq("submitted_by_user_id", userId)
    .order("journal_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter) {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch journals:", error);
    throw httpError(500, "仕訳一覧の取得に失敗しました");
  }

  return c.json({ journals: data ?? [] });
});

// ============================================
// POST /journals - 仕訳作成
// ============================================

journalsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await readJsonBody<CreateJournalRequest>(c);

  if (!body.ledger_id) {
    throw httpError(400, "台帳を指定してください");
  }
  if (!isValidDate(body.journal_date)) {
    throw httpError(400, "発生日は必須です");
  }
  if (!body.description?.trim()) {
    throw httpError(400, "摘要は必須です");
  }
  const entries = validateEntries(body.entries);
  if (body.is_receipt_hard_to_collect && !body.receipt_hard_to_collect_reason) {
    throw httpError(400, "領収証を徴し難い理由を入力してください");
  }
  if (body.is_asset_acquisition && !body.asset_type) {
    throw httpError(400, "資産種別を選択してください");
  }

  const status = body.status ?? "approved";
  if (status !== "draft" && status !== "approved") {
    throw httpError(400, "ステータスが正しくありません");
  }

  // 起票には submitJournal、即時登録（承認済み）には registerJournal が必要
  const access = await requireLedgerPermission(
    c,
    { ledgerId: body.ledger_id },
    status === "approved" ? "registerJournal" : "submitJournal",
  );
  await assertYearOpen(access.ledgerId, body.journal_date);
  // 関係者・補助科目はその台帳で使えるもののみ（他の台帳の関係者を読み出させない）
  await assertContactUsableInLedger(access, body.contact_id);
  await assertSubAccountsUsableInLedger(
    access,
    entries.map((e) => e.sub_account_id),
  );

  const supabase = c.get("supabase");

  const { data: journal, error: journalError } = await supabase
    .from("journals")
    .insert({
      ledger_id: access.ledgerId,
      journal_date: body.journal_date,
      description: body.description.trim(),
      contact_id: body.contact_id || null,
      classification: body.classification || null,
      non_monetary_basis: body.non_monetary_basis || null,
      notes: body.notes || null,
      amount_political_grant: body.amount_political_grant || 0,
      amount_political_fund: body.amount_political_fund || 0,
      amount_public_subsidy: body.amount_public_subsidy || 0,
      is_receipt_hard_to_collect: body.is_receipt_hard_to_collect || false,
      receipt_hard_to_collect_reason: body.receipt_hard_to_collect_reason ||
        null,
      is_asset_acquisition: !!body.is_asset_acquisition,
      asset_type: body.is_asset_acquisition ? body.asset_type : null,
      status,
      submitted_by_user_id: userId,
      approved_by_user_id: status === "approved" ? userId : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (journalError || !journal) {
    console.error("Failed to create journal:", journalError);
    throw httpError(500, "仕訳の作成に失敗しました");
  }

  const { error: entriesError } = await supabase
    .from("journal_entries")
    .insert(toEntryRows(journal.id, entries));

  if (entriesError) {
    console.error("Failed to create journal entries:", entriesError);
    // 仕訳を削除（ロールバック）
    await supabase.from("journals").delete().eq("id", journal.id);
    throw httpError(500, "仕訳明細の作成に失敗しました");
  }

  return c.json({ success: true, data: { id: journal.id } }, 201);
});

// ============================================
// GET /journals/:id - 仕訳詳細
// ============================================

journalsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  await requireJournalAccess(c, id, "viewLedger");

  const { data, error } = await c.get("supabase")
    .from("journals")
    .select(
      `
      id, journal_date, description, status, ledger_id, contact_id,
      classification, non_monetary_basis, notes, amount_public_subsidy,
      is_receipt_hard_to_collect, receipt_hard_to_collect_reason,
      is_asset_acquisition, asset_type, approved_at, created_at,
      journal_entries ( id, account_code, sub_account_id, debit_amount, credit_amount ),
      contacts ( name, contact_type, address ),
      ledgers (
        politician_organizations ( political_organizations ( name ) ),
        politician_elections ( elections ( election_name ) )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch journal:", error);
    throw httpError(500, "仕訳の取得に失敗しました");
  }
  if (!data) {
    throw httpError(404, "仕訳が見つかりません");
  }

  // 台帳名（政治団体名 / 選挙名）を平坦化して返す
  const { ledgers, ...rest } = data as Record<string, unknown> & {
    ledgers: unknown;
  };
  // deno-lint-ignore no-explicit-any
  const ledger = one(ledgers as any) as
    | {
      politician_organizations: unknown;
      politician_elections: unknown;
    }
    | null;
  // deno-lint-ignore no-explicit-any
  const po = one(ledger?.politician_organizations as any) as
    | { political_organizations: unknown }
    | null;
  // deno-lint-ignore no-explicit-any
  const pe = one(ledger?.politician_elections as any) as
    | { elections: unknown }
    | null;

  return c.json({
    journal: {
      ...rest,
      contacts: one(rest.contacts as Record<string, unknown> | null),
      // deno-lint-ignore no-explicit-any
      political_organizations: one(po?.political_organizations as any) ?? null,
      // deno-lint-ignore no-explicit-any
      elections: one(pe?.elections as any) ?? null,
    },
  });
});

// ============================================
// PUT /journals/:id - 仕訳更新
// ============================================

journalsRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const access = await requireJournalAccess(c, id);
  assertCanModify(access, userId);

  const body = await readJsonBody<UpdateJournalRequest>(c);
  const supabase = c.get("supabase");

  // 変更前・変更後どちらの年度も締め済みでないこと
  await assertYearOpen(access.ledgerId, await getJournalDate(supabase, id));

  const update: Record<string, unknown> = {};
  if (body.journal_date !== undefined) {
    if (!isValidDate(body.journal_date)) {
      throw httpError(400, "発生日は必須です");
    }
    await assertYearOpen(access.ledgerId, body.journal_date);
    update.journal_date = body.journal_date;
  }
  if (body.description !== undefined) {
    if (!body.description?.trim()) {
      throw httpError(400, "摘要は必須です");
    }
    update.description = body.description.trim();
  }
  if (body.contact_id !== undefined) {
    await assertContactUsableInLedger(access, body.contact_id);
    update.contact_id = body.contact_id || null;
  }
  if (body.classification !== undefined) {
    update.classification = body.classification || null;
  }
  if (body.non_monetary_basis !== undefined) {
    update.non_monetary_basis = body.non_monetary_basis || null;
  }
  if (body.notes !== undefined) update.notes = body.notes || null;
  if (body.amount_political_grant !== undefined) {
    update.amount_political_grant = body.amount_political_grant || 0;
  }
  if (body.amount_political_fund !== undefined) {
    update.amount_political_fund = body.amount_political_fund || 0;
  }
  if (body.amount_public_subsidy !== undefined) {
    update.amount_public_subsidy = body.amount_public_subsidy || 0;
  }
  if (body.is_receipt_hard_to_collect !== undefined) {
    update.is_receipt_hard_to_collect = !!body.is_receipt_hard_to_collect;
  }
  if (body.receipt_hard_to_collect_reason !== undefined) {
    update.receipt_hard_to_collect_reason =
      body.receipt_hard_to_collect_reason || null;
  }
  if (
    update.is_receipt_hard_to_collect === true &&
    !update.receipt_hard_to_collect_reason
  ) {
    throw httpError(400, "領収証を徴し難い理由を入力してください");
  }
  if (body.is_asset_acquisition !== undefined) {
    update.is_asset_acquisition = !!body.is_asset_acquisition;
    if (update.is_asset_acquisition && !body.asset_type) {
      throw httpError(400, "資産種別を選択してください");
    }
    update.asset_type = update.is_asset_acquisition ? body.asset_type : null;
  }

  const entries = body.entries !== undefined
    ? validateEntries(body.entries)
    : null;
  if (entries) {
    await assertSubAccountsUsableInLedger(
      access,
      entries.map((e) => e.sub_account_id),
    );
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from("journals")
      .update(update)
      .eq("id", id);
    if (error) {
      console.error("Failed to update journal:", error);
      throw httpError(500, "仕訳の更新に失敗しました");
    }
  }

  if (entries) {
    // 新しい明細を先に登録してから古い明細を削除する
    // （RLS の is_sub_account_usable_in_ledger は「台帳で既に使われている補助科目」も許可するため、
    //   先に消すとオーナー譲渡前の補助科目を使う明細を登録し直せなくなる）
    const { data: oldEntries, error: oldError } = await supabase
      .from("journal_entries")
      .select("id")
      .eq("journal_id", id);
    if (oldError) {
      console.error("Failed to fetch journal entries:", oldError);
      throw httpError(500, "仕訳明細の更新に失敗しました");
    }
    const { error: insertError } = await supabase
      .from("journal_entries")
      .insert(toEntryRows(id, entries));
    if (insertError) {
      console.error("Failed to insert journal entries:", insertError);
      throw httpError(500, "仕訳明細の更新に失敗しました");
    }
    const oldIds = (oldEntries ?? []).map((e: { id: string }) => e.id);
    if (oldIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("journal_entries")
        .delete()
        .in("id", oldIds);
      if (deleteError) {
        console.error("Failed to delete journal entries:", deleteError);
        throw httpError(500, "仕訳明細の更新に失敗しました");
      }
    }
  }

  const { data, error } = await supabase
    .from("journals")
    .select("*, journal_entries (*), contacts (*)")
    .eq("id", id)
    .single();
  if (error) {
    console.error("Failed to fetch journal:", error);
    throw httpError(500, "仕訳の取得に失敗しました");
  }

  // 承認済みの仕訳を変更した場合は Hub に再同期する（best-effort）
  if (data.status === "approved") {
    try {
      await syncApprovedJournal(
        access,
        data as LedgerJournal,
        data.journal_entries ?? [],
        one(data.contacts),
      );
    } catch (syncError) {
      console.error("[Update] Hub sync failed (non-fatal):", syncError);
    }
  }

  return c.json({ data });
});

// ============================================
// DELETE /journals/:id - 仕訳削除（下書きの却下を含む）
// ============================================

journalsRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const access = await requireJournalAccess(c, id);
  assertCanModify(access, userId);

  const supabase = c.get("supabase");
  await assertYearOpen(access.ledgerId, await getJournalDate(supabase, id));

  // 証憑ファイルのパスを控えておく（media_assets は CASCADE で消える）
  const { data: assets } = await supabase
    .from("media_assets")
    .select("storage_path, uploaded_by_user_id, journal_id")
    .eq("journal_id", id);

  // journal_entries / media_assets は ON DELETE CASCADE
  const { error } = await supabase.from("journals").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete journal:", error);
    throw httpError(500, "仕訳の削除に失敗しました");
  }

  // 他メンバーのフォルダにあるファイルも消すため service client を使う（authz 確認済み）。
  // この仕訳のフォルダにあるファイルだけを対象にする（他の仕訳・台帳のファイルは消さない）
  const paths = (assets ?? [])
    .filter((a: {
      storage_path: string;
      uploaded_by_user_id: string | null;
      journal_id: string | null;
    }) => isReceiptPathOfAsset(a))
    .map((a: { storage_path: string }) => a.storage_path);
  if (paths.length > 0) {
    const { error: storageError } = await getServiceClient().storage
      .from(RECEIPTS_BUCKET)
      .remove(paths);
    if (storageError) {
      console.warn("Failed to remove receipt files (non-fatal):", storageError);
    }
  }

  return c.json({ message: "削除しました" });
});

// ============================================
// POST /journals/:id/approve - 仕訳承認
// ============================================

journalsRouter.post("/:id/approve", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const access = await requireJournalAccess(c, id, "approveJournal");

  if (access.journal.status === "approved") {
    throw httpError(409, "この仕訳は既に承認されています");
  }
  // 自分が起票した仕訳は、即時登録権限（セルフ承認）を持つロールのみ承認できる
  if (
    access.journal.submitted_by_user_id === userId &&
    !canSelfApprove(access.role)
  ) {
    throw httpError(403, "ご自身が起票した取引は承認できません");
  }

  const supabase = c.get("supabase");

  // 仕訳とその関連データを取得（Hub 同期に必要）
  const { data: journalFull, error: fetchError } = await supabase
    .from("journals")
    .select("*, journal_entries (*), contacts (*)")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    console.error("Failed to fetch journal:", fetchError);
    throw httpError(500, "仕訳の取得に失敗しました");
  }
  if (!journalFull) {
    throw httpError(404, "仕訳が見つかりません");
  }
  await assertYearOpen(access.ledgerId, journalFull.journal_date);

  const { data, error } = await supabase
    .from("journals")
    .update({
      status: "approved",
      approved_by_user_id: userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) {
    console.error("Failed to approve journal:", error);
    throw httpError(500, "仕訳の承認に失敗しました");
  }
  if (!data) {
    throw httpError(409, "この仕訳は既に承認されています");
  }

  // Hub への自動同期（best-effort: 失敗しても承認は成功）
  try {
    await syncApprovedJournal(
      access,
      {
        ...(journalFull as LedgerJournal),
        status: "approved",
      },
      journalFull.journal_entries ?? [],
      one(journalFull.contacts),
    );
  } catch (syncError) {
    console.error("[Approve] Hub sync failed (non-fatal):", syncError);
  }

  return c.json({ data });
});

/**
 * 承認済み仕訳を Hub に同期する。
 * 台帳の Hub 中間テーブル ID はメンバーが RLS で読めないため、
 * authz 確認済み（approveJournal）の前提で service client から取得する。
 * is_test と Hub API キーの選択は台帳オーナーがテストユーザーかどうかで決める。
 */
async function syncApprovedJournal(
  access: LedgerAccess,
  journal: LedgerJournal,
  entries: LedgerJournalEntry[],
  contact: (LedgerContact & Record<string, unknown>) | null,
) {
  if (!shouldSync(journal)) return;

  const { data: ledger, error } = await getServiceClient()
    .from("ledgers")
    .select(
      `
      id, ledger_type,
      politician_organizations ( hub_politician_organization_id ),
      politician_elections ( hub_politician_election_id )
    `,
    )
    .eq("id", access.ledgerId)
    .maybeSingle();
  if (error) throw error;
  if (!ledger) {
    console.warn(
      `[Approve] No ledger found for journal ${journal.id}, skipping Hub sync`,
    );
    return;
  }

  const hubUserId = access.ownerUserId;
  const isTest = isTestUser(hubUserId);
  const po = one(
    ledger.politician_organizations as
      | { hub_politician_organization_id: string | null }
      | { hub_politician_organization_id: string | null }[]
      | null,
  );
  const pe = one(
    ledger.politician_elections as
      | { hub_politician_election_id: string | null }
      | { hub_politician_election_id: string | null }[]
      | null,
  );

  // 台帳の集計を更新
  const ledgerInput: SyncLedgerInput = {
    ledger_source_id: ledger.id,
    ledger_type: ledger.ledger_type,
    politician_organization_id: po?.hub_politician_organization_id ||
      undefined,
    politician_election_id: pe?.hub_politician_election_id || undefined,
    fiscal_year: Number(journal.journal_date.slice(0, 4)),
    is_test: isTest,
    total_income: 0, // 集計は Hub 側で再計算される想定
    total_expense: 0,
    journal_count: 1,
  };
  const ledgerResult = await syncLedger(ledgerInput, { userId: hubUserId });

  // 関係者を先に同期（UUID でユニーク識別）
  let hubContactId: string | null = null;
  if (contact?.id) {
    const contactInput: SyncContactInput = {
      contact_source_id: contact.id,
      ledger_id: (ledgerResult.data?.id as string | undefined) || ledger.id,
      contact_type: contact.contact_type,
      name: contact.is_name_private ? null : contact.name,
      address: contact.is_address_private ? null : (contact.address ?? null),
      occupation: contact.is_occupation_private
        ? null
        : (contact.occupation ?? null),
      is_name_private: contact.is_name_private,
      is_address_private: contact.is_address_private,
      is_occupation_private: contact.is_occupation_private,
    };
    try {
      const contactResult = await syncContacts([contactInput], {
        userId: hubUserId,
      });
      if (contactResult.data.length > 0) {
        hubContactId = contactResult.data[0].hub_contact_id;
      }
    } catch (contactErr) {
      console.warn("[Approve] Contact sync failed (non-fatal):", contactErr);
    }
  }

  // 単一仕訳を同期（Hub の contact_id を使用）
  const transformed = await transformJournalForSync({
    journal,
    entries,
    contact,
    ledgerSourceId: ledger.id,
    hubContactId,
  });
  const syncInput: SyncJournalInput = { ...transformed, is_test: isTest };
  await syncJournals([syncInput], { userId: hubUserId });

  console.log(`[Approve] Journal ${journal.id} synced to Hub`);
}

// ============================================
// GET /journals/:id/receipts - 証憑一覧（署名付き URL 付き）
// ============================================

journalsRouter.get("/:id/receipts", async (c) => {
  const id = c.req.param("id");
  await requireJournalAccess(c, id, "viewLedger");

  const { data: assets, error } = await c.get("supabase")
    .from("media_assets")
    .select(
      "id, journal_id, uploaded_by_user_id, file_name, mime_type, file_size, storage_path, created_at",
    )
    .eq("journal_id", id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to fetch receipts:", error);
    throw httpError(500, "証憑の取得に失敗しました");
  }

  const rows = (assets ?? []) as {
    id: string;
    journal_id: string | null;
    uploaded_by_user_id: string | null;
    file_name: string;
    mime_type: string;
    file_size: number | null;
    storage_path: string;
    created_at: string;
  }[];

  // 他メンバーがアップロードしたファイルも閲覧できるよう、
  // authz 確認済み（viewLedger）の前提で service client から署名付き URL を発行する。
  // この仕訳のフォルダにあるファイルだけを対象にする（他の仕訳・台帳のファイルは署名しない）
  const signablePaths = rows
    .filter((r) => isReceiptPathOfAsset(r))
    .map((r) => r.storage_path);
  const urlByPath = new Map<string, string>();
  if (signablePaths.length > 0) {
    const { data: signed, error: signError } = await getServiceClient().storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrls(signablePaths, RECEIPT_URL_EXPIRES_IN);
    if (signError) {
      console.warn("Failed to create signed URLs:", signError);
    }
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      file_size: r.file_size,
      url: urlByPath.get(r.storage_path) ?? null,
      created_at: r.created_at,
    })),
  });
});
