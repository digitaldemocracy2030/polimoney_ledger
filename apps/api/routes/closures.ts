/**
 * 年度締め API（SPECIFICATION.md 7 章）
 *
 * 台帳は Ledger 内の政治団体 ID（political_organizations.id）から解決する。
 * - 締め前チェック / ロック解除状態の確認: viewLedger
 * - 締め / アーカイブ / 締め解除 / ロック解除リクエスト: editLedgerSettings
 * データアクセスはユーザーの JWT 付きクライアント（RLS 適用）。
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "../lib/types.ts";
import { httpError } from "../lib/errors.ts";
import { type LedgerAccess, requireLedgerPermission } from "../lib/authz.ts";
import {
  checkUnlockStatus,
  createUnlockRequest,
  HubApiError,
} from "../lib/hub-client.ts";

interface CheckResult {
  canClose: boolean;
  issues: Issue[];
  summary: {
    totalJournals: number;
    draftCount: number;
    missingReceiptCount: number;
    imbalanceCount: number;
  };
}

interface Issue {
  type: "error" | "warning";
  category: "draft" | "receipt" | "imbalance";
  message: string;
  journalId?: string;
  journalDate?: string;
  description?: string;
}

interface YearRequest {
  organizationId: string;
  year: number;
}

interface UnlockRequestBody extends YearRequest {
  reason: string;
}

interface ClosureRow {
  id: string;
  status: "open" | "closed" | "locked" | "temporary_unlock";
}

export const closuresRouter = new Hono<AppEnv>();

// ============================================
// ヘルパー
// ============================================

function parseYear(value: unknown): number {
  const year = typeof value === "string" ? Number(value) : value;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 1900) {
    throw httpError(400, "年度が正しくありません");
  }
  return year;
}

/** JSON ボディから organizationId と year を取り出す */
async function readYearRequest<T extends YearRequest>(
  c: Context<AppEnv>,
): Promise<T & { year: number }> {
  let body: T;
  try {
    body = await c.req.json<T>();
  } catch {
    throw httpError(400, "リクエストの形式が正しくありません");
  }
  if (!body?.organizationId) {
    throw httpError(400, "政治団体を指定してください");
  }
  return { ...body, year: parseYear(body.year) };
}

async function getClosure(
  supabase: SupabaseClient,
  ledgerId: string,
  year: number,
): Promise<ClosureRow | null> {
  const { data, error } = await supabase
    .from("ledger_year_closures")
    .select("id, status")
    .eq("ledger_id", ledgerId)
    .eq("fiscal_year", year)
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch year closure:", error);
    throw httpError(500, "年度締め状態の取得に失敗しました");
  }
  return data as ClosureRow | null;
}

const STATUS_LABELS: Record<ClosureRow["status"], string> = {
  open: "未締め",
  closed: "締め済み",
  locked: "アーカイブ済み",
  temporary_unlock: "一時解除中",
};

/** 締め前チェック（未承認仕訳・証憑未添付・貸借不一致） */
async function runCheck(
  supabase: SupabaseClient,
  ledgerId: string,
  year: number,
): Promise<CheckResult> {
  const { data: journals, error } = await supabase
    .from("journals")
    .select(
      `
      id, journal_date, description, status, is_receipt_hard_to_collect,
      journal_entries ( id, debit_amount, credit_amount ),
      media_assets ( id )
    `,
    )
    .eq("ledger_id", ledgerId)
    .gte("journal_date", `${year}-01-01`)
    .lte("journal_date", `${year}-12-31`)
    .order("journal_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch journals:", error);
    throw httpError(500, "仕訳の取得に失敗しました");
  }

  const issues: Issue[] = [];
  let draftCount = 0;
  let missingReceiptCount = 0;
  let imbalanceCount = 0;

  for (const journal of journals ?? []) {
    const base = {
      journalId: journal.id as string,
      journalDate: journal.journal_date as string,
      description: journal.description as string,
    };

    if (journal.status === "draft") {
      draftCount++;
      issues.push({
        type: "error",
        category: "draft",
        message: `未承認の仕訳があります: ${journal.description}`,
        ...base,
      });
    }

    // 領収証を徴し難い仕訳は証憑未添付の警告対象外
    const hasReceipt = (journal.media_assets?.length ?? 0) > 0;
    if (!hasReceipt && !journal.is_receipt_hard_to_collect) {
      missingReceiptCount++;
      issues.push({
        type: "warning",
        category: "receipt",
        message: `領収証が未添付です: ${journal.description}`,
        ...base,
      });
    }

    const entries = (journal.journal_entries ?? []) as {
      debit_amount: number;
      credit_amount: number;
    }[];
    const totalDebit = entries.reduce(
      (sum, e) => sum + (e.debit_amount || 0),
      0,
    );
    const totalCredit = entries.reduce(
      (sum, e) => sum + (e.credit_amount || 0),
      0,
    );
    if (totalDebit !== totalCredit) {
      imbalanceCount++;
      issues.push({
        type: "error",
        category: "imbalance",
        message:
          `借方・貸方が一致しません: ${journal.description} (借方: ${totalDebit}, 貸方: ${totalCredit})`,
        ...base,
      });
    }
  }

  return {
    canClose: !issues.some((issue) => issue.type === "error"),
    issues,
    summary: {
      totalJournals: journals?.length ?? 0,
      draftCount,
      missingReceiptCount,
      imbalanceCount,
    },
  };
}

function hubLedgerType(access: LedgerAccess): "election" | "organization" {
  return access.ledgerType === "election_fund" ? "election" : "organization";
}

// ============================================
// GET /closures/check?org_id=&year= - 締め前チェック
// ============================================

closuresRouter.get("/check", async (c) => {
  const organizationId = c.req.query("org_id");
  if (!organizationId) {
    throw httpError(400, "政治団体を指定してください");
  }
  const year = parseYear(c.req.query("year"));

  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "viewLedger",
  );
  const result = await runCheck(c.get("supabase"), access.ledgerId, year);
  return c.json(result);
});

// ============================================
// POST /closures/execute - 年度締め
// ============================================

closuresRouter.post("/execute", async (c) => {
  const { organizationId, year } = await readYearRequest<YearRequest>(c);
  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "editLedgerSettings",
  );
  const supabase = c.get("supabase");

  const existing = await getClosure(supabase, access.ledgerId, year);
  if (existing && existing.status !== "open") {
    throw httpError(
      409,
      `${year}年度は既に${STATUS_LABELS[existing.status]}です`,
    );
  }

  // 必須項目（未承認・貸借不一致）にエラーがあれば締められない
  const check = await runCheck(supabase, access.ledgerId, year);
  if (!check.canClose) {
    throw httpError(
      400,
      "未承認の仕訳または貸借が一致しない仕訳があるため、年度締めを実行できません",
    );
  }

  const now = new Date().toISOString();
  const { data: closure, error } = await supabase
    .from("ledger_year_closures")
    .upsert(
      {
        ledger_id: access.ledgerId,
        fiscal_year: year,
        status: "closed",
        closed_at: now,
        updated_at: now,
      },
      { onConflict: "ledger_id,fiscal_year" },
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to close year:", error);
    throw httpError(500, "年度締めに失敗しました");
  }

  return c.json({
    success: true,
    message: `${year}年度を締めました`,
    closure,
  });
});

// ============================================
// POST /closures/archive - アーカイブ（closed → locked）
// ============================================

closuresRouter.post("/archive", async (c) => {
  const { organizationId, year } = await readYearRequest<YearRequest>(c);
  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "editLedgerSettings",
  );
  const supabase = c.get("supabase");

  const existing = await getClosure(supabase, access.ledgerId, year);
  if (!existing || existing.status !== "closed") {
    throw httpError(
      409,
      `アーカイブできるのは締め済みの年度のみです（現在: ${
        STATUS_LABELS[existing?.status ?? "open"]
      }）`,
    );
  }

  const now = new Date().toISOString();
  const { data: closure, error } = await supabase
    .from("ledger_year_closures")
    .update({ status: "locked", locked_at: now, updated_at: now })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to archive year:", error);
    throw httpError(500, "アーカイブに失敗しました");
  }

  return c.json({
    success: true,
    message: `${year}年度をアーカイブしました`,
    closure,
  });
});

// ============================================
// POST /closures/reopen - 締め解除（closed → open）
// ============================================

closuresRouter.post("/reopen", async (c) => {
  const { organizationId, year } = await readYearRequest<YearRequest>(c);
  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "editLedgerSettings",
  );
  const supabase = c.get("supabase");

  const existing = await getClosure(supabase, access.ledgerId, year);
  if (!existing || existing.status !== "closed") {
    throw httpError(
      409,
      `締め解除できるのは締め済みの年度のみです（現在: ${
        STATUS_LABELS[existing?.status ?? "open"]
      }）`,
    );
  }

  const { error } = await supabase
    .from("ledger_year_closures")
    .delete()
    .eq("id", existing.id);

  if (error) {
    console.error("Failed to reopen year:", error);
    throw httpError(500, "締め解除に失敗しました");
  }

  return c.json({
    success: true,
    message: `${year}年度の締めを解除しました`,
  });
});

// ============================================
// POST /closures/unlock-request - ロック解除リクエスト（Hub に送信）
// ============================================

closuresRouter.post("/unlock-request", async (c) => {
  const userId = c.get("userId");
  const { organizationId, year, reason } = await readYearRequest<
    UnlockRequestBody
  >(c);

  if (typeof reason !== "string" || reason.trim().length < 10) {
    throw httpError(400, "理由は10文字以上で入力してください");
  }

  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "editLedgerSettings",
  );

  const existing = await getClosure(c.get("supabase"), access.ledgerId, year);
  if (!existing || existing.status !== "locked") {
    throw httpError(
      409,
      "ロック解除を申請できるのはアーカイブ済みの年度のみです",
    );
  }

  try {
    const unlockRequest = await createUnlockRequest(
      {
        ledger_id: access.ledgerId,
        ledger_type: hubLedgerType(access),
        fiscal_year: year,
        requested_by_user_id: userId,
        requested_by_email: c.get("user").email ?? "",
        reason: reason.trim(),
      },
      { userId: access.ownerUserId },
    );

    return c.json({
      success: true,
      message: "ロック解除リクエストを送信しました",
      request: unlockRequest,
    });
  } catch (error) {
    // Hub のエラー（申請中の重複の 409 など）は app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error creating unlock request:", error);
    throw httpError(502, "ロック解除リクエストの送信に失敗しました");
  }
});

// ============================================
// GET /closures/unlock-request?org_id=[&year=] - ロック解除状態の確認
// ============================================

closuresRouter.get("/unlock-request", async (c) => {
  const organizationId = c.req.query("org_id");
  if (!organizationId) {
    throw httpError(400, "政治団体を指定してください");
  }
  const yearParam = c.req.query("year");
  const fiscalYear = yearParam ? parseYear(yearParam) : undefined;

  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "viewLedger",
  );

  try {
    const result = await checkUnlockStatus(access.ledgerId, {
      fiscalYear,
      userId: access.ownerUserId,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error checking unlock status:", error);
    throw httpError(502, "ロック解除状態の確認に失敗しました");
  }
});
