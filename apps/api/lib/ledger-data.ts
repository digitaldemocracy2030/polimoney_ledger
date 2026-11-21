/**
 * 台帳データの共通ヘルパー（選挙台帳・政治団体台帳の両方で使う）
 *
 * データ取得は原則ユーザーの JWT 付きクライアント（RLS 適用）。
 * service client を使う関数は、呼び出し側で lib/authz.ts による権限確認を済ませていること。
 */

import type { Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AppRole,
  roleFromString,
} from "@polimoney-ledger/shared/permissions.ts";
import type { AppEnv } from "./types.ts";
import { type LedgerAccess, requireLedgerOwner } from "./authz.ts";
import { getServiceClient } from "./supabase.ts";
import { type AccountCode, getAccountCodes } from "./hub-client.ts";

// ============================================
// 台帳共通ヘルパー（elections.ts / organizations.ts から使う）
// ============================================

/** 仕訳一覧で取得する列（contacts は多対一なのでオブジェクトか null） */
const JOURNAL_LIST_COLUMNS = `
  id,
  journal_date,
  description,
  status,
  contact_id,
  created_at,
  journal_entries (
    id,
    account_code,
    debit_amount,
    credit_amount
  ),
  contacts (
    name
  )
`;

/** 画面向けの勘定科目（Hub の report_category を category としても返す） */
export type LedgerAccountCode = AccountCode & { category: string };

/** Hub から勘定科目を取得する（失敗時は空配列） */
export async function fetchAccountCodes(
  ledgerType: "organization" | "election",
  userId: string,
): Promise<LedgerAccountCode[]> {
  try {
    const codes = await getAccountCodes({ ledgerType, userId });
    return codes.map((code) => ({ ...code, category: code.report_category }));
  } catch (error) {
    console.error("Failed to fetch account codes from Hub:", error);
    return [];
  }
}

/** 台帳の仕訳一覧を取得する（year を指定するとその年の 1/1〜12/31 に絞る） */
export async function fetchLedgerJournals(
  supabase: SupabaseClient,
  ledgerId: string,
  year?: number,
) {
  let query = supabase
    .from("journals")
    .select(JOURNAL_LIST_COLUMNS)
    .eq("ledger_id", ledgerId);
  if (year !== undefined) {
    query = query
      .gte("journal_date", `${year}-01-01`)
      .lte("journal_date", `${year}-12-31`);
  }
  const { data, error } = await query
    .order("journal_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * 台帳で使える関係者一覧を取得する
 * - 台帳に紐付いた関係者
 * - 台帳オーナーが作成した、台帳に紐付いていない関係者（関係者マスタ画面で作成したもの）
 *   ※ RLS により、オーナー以外のメンバーには前者と仕訳で使われているものだけが返る
 */
export async function fetchLedgerContacts(
  supabase: SupabaseClient,
  ledgerId: string,
  ownerUserId: string,
) {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, name, contact_type, address, occupation, hub_organization_id",
    )
    .or(
      `ledger_id.eq.${ledgerId},and(ledger_id.is.null,owner_user_id.eq.${ownerUserId})`,
    )
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/**
 * 台帳で使える補助科目一覧を取得する
 * - 台帳オーナーの補助科目（sub_accounts は台帳単位ではなく「オーナー + 台帳タイプ」単位）
 * - 台帳の仕訳明細で既に使われている補助科目（オーナー譲渡前の旧オーナーの補助科目など）
 */
export async function fetchLedgerSubAccounts(
  supabase: SupabaseClient,
  access: Pick<LedgerAccess, "ledgerId" | "ownerUserId">,
  subAccountLedgerType: "election" | "political_organization",
) {
  const { data, error } = await supabase
    .from("sub_accounts")
    .select("id, name, parent_account_code")
    .eq("owner_user_id", access.ownerUserId)
    .eq("ledger_type", subAccountLedgerType)
    .order("name");
  if (error) throw error;
  const subAccounts = (data ?? []) as Array<{
    id: string;
    name: string;
    parent_account_code: string;
  }>;

  const { data: used, error: usedError } = await supabase
    .from("journal_entries")
    .select("sub_account_id, journals!inner ( ledger_id )")
    .eq("journals.ledger_id", access.ledgerId)
    .not("sub_account_id", "is", null);
  if (usedError) throw usedError;
  const known = new Set(subAccounts.map((sa) => sa.id));
  const missingIds = [
    ...new Set(
      ((used ?? []) as Array<{ sub_account_id: string }>)
        .map((row) => row.sub_account_id)
        .filter((id) => !known.has(id)),
    ),
  ];
  if (missingIds.length === 0) return subAccounts;

  const { data: extra, error: extraError } = await supabase
    .from("sub_accounts")
    .select("id, name, parent_account_code")
    .in("id", missingIds);
  if (extraError) throw extraError;
  return [...subAccounts, ...((extra ?? []) as typeof subAccounts)].sort((
    a,
    b,
  ) => a.name.localeCompare(b.name, "ja"));
}

/** メンバー一覧の 1 行 */
export interface LedgerMemberView {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  invited_by_user_id: string | null;
  email?: string;
  display_name?: string;
}

/**
 * 台帳のメンバー一覧を取得し、メールアドレスと氏名を付ける。
 * 呼び出し前に requireLedgerPermission(viewLedger) で権限確認済みであること
 * （他ユーザーのメール・氏名は auth.admin でしか読めないため service client を使う）。
 */
export async function fetchLedgerMembers(
  c: Context<AppEnv>,
  access: LedgerAccess,
): Promise<LedgerMemberView[]> {
  const { data, error } = await c.get("supabase")
    .from("ledger_members")
    .select("id, user_id, role, created_at, invited_by_user_id")
    .eq("ledger_id", access.ledgerId)
    .order("created_at");
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    role: string;
    created_at: string;
    invited_by_user_id: string | null;
  }>;

  const svc = getServiceClient();
  return await Promise.all(rows.map(async (row) => {
    const member: LedgerMemberView = {
      ...row,
      role: roleFromString(row.role),
    };
    const { data: userData, error: userError } = await svc.auth.admin
      .getUserById(row.user_id);
    if (userError) {
      console.warn("Failed to fetch member user:", userError);
      return member;
    }
    const user = userData.user;
    if (user?.email) member.email = user.email;
    const fullName = user?.user_metadata?.full_name;
    if (typeof fullName === "string" && fullName) {
      member.display_name = fullName;
    }
    return member;
  }));
}

/** 資産一覧の 1 行 */
export interface LedgerAssetView {
  id: string;
  journal_date: string | null;
  description: string;
  asset_type: string | null;
  amount: number;
  contact_name: string | null;
}

/** 台帳の資産取得仕訳（承認済み）を取得する。amount は借方合計 */
export async function fetchLedgerAssets(
  supabase: SupabaseClient,
  ledgerId: string,
): Promise<LedgerAssetView[]> {
  const { data, error } = await supabase
    .from("journals")
    .select(`
      id,
      journal_date,
      description,
      asset_type,
      contacts (
        name
      ),
      journal_entries (
        debit_amount
      )
    `)
    .eq("ledger_id", ledgerId)
    .eq("is_asset_acquisition", true)
    .eq("status", "approved")
    .order("journal_date", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    journal_date: string | null;
    description: string;
    asset_type: string | null;
    contacts: { name: string } | null;
    journal_entries: Array<{ debit_amount: number | null }> | null;
  }>;

  return rows.map((j) => ({
    id: j.id,
    journal_date: j.journal_date,
    description: j.description,
    asset_type: j.asset_type,
    amount: (j.journal_entries ?? []).reduce(
      (sum, e) => sum + (e.debit_amount ?? 0),
      0,
    ),
    contact_name: j.contacts?.name ?? null,
  }));
}

/**
 * Ledger 内の politicians 行を探し、無ければ作成する（オーナー + 氏名で一致判定）。
 * 台帳（ledgers）は politician_organizations / politician_elections 経由で
 * 政治家に紐づくため、台帳作成時に必要になる。
 * politicians はユーザーが直接書き込めないため、呼び出し側で Hub の認証を確認したうえで
 * service client を渡すこと。
 */
export async function findOrCreatePolitician(
  supabase: SupabaseClient,
  ownerUserId: string,
  name: string,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("politicians")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("name", name)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data: created, error: insertError } = await supabase
    .from("politicians")
    .insert({ owner_user_id: ownerUserId, name })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id as string;
}

/**
 * 作成直後の台帳に、オーナー自身を admin メンバーとして登録する。
 * ledger_members はユーザーの JWT では書き込めないため、オーナー確認の後で service client を使う。
 */
export async function addOwnerMembership(
  c: Context<AppEnv>,
  ledgerId: string,
): Promise<void> {
  await requireLedgerOwner(c, { ledgerId });
  const userId = c.get("userId");
  const { error } = await getServiceClient()
    .from("ledger_members")
    .insert({
      user_id: userId,
      ledger_id: ledgerId,
      role: "admin",
      invited_by_user_id: userId,
    });
  if (error) throw error;
}

/**
 * 作成途中で失敗したときの後始末（ベストエフォート）。
 * 台帳の構造はユーザーが直接削除できないため、作成に使った service client を渡す。
 */
export async function deleteRowsQuietly(
  supabase: SupabaseClient,
  rows: Array<{ table: string; id: string | null }>,
): Promise<void> {
  for (const row of rows) {
    if (!row.id) continue;
    const { error } = await supabase.from(row.table).delete().eq("id", row.id);
    if (error) {
      console.error(`Failed to roll back ${row.table} ${row.id}:`, error);
    }
  }
}

/** 自分がメンバーとして所属している台帳 ID（オーナーの台帳も含む） */
export async function fetchMyMembershipLedgerIds(
  c: Context<AppEnv>,
): Promise<string[]> {
  const { data, error } = await c.get("supabase")
    .from("ledger_members")
    .select("ledger_id")
    .eq("user_id", c.get("userId"));
  if (error) throw error;
  return [
    ...new Set(
      (data ?? []).map((row: { ledger_id: string }) => row.ledger_id),
    ),
  ];
}
