/**
 * /v1/dashboard API
 *
 * GET /dashboard - ダッシュボード表示用データ
 *   - pendingTransfers: 自分宛て（to_user_id = 自分）の承認待ちオーナー譲渡
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import { getServiceClient } from "../lib/supabase.ts";

export const dashboardRouter = new Hono<AppEnv>();

/** ownership_transfers の行（譲渡は台帳単位） */
interface TransferRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  requested_at: string;
  ledger_id: string | null;
}

interface LedgerTargetRow {
  id: string;
  organization_id: string | null;
  election_id: string | null;
  political_organizations: One<{ id: string; name: string }>;
  elections: One<{ id: string; election_name: string }>;
}

type One<T> = T | T[] | null;
function one<T>(v: One<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

interface PendingTransfer {
  id: string;
  from_user_id: string;
  organization_id: string | null;
  election_id: string | null;
  requested_at: string;
  political_organizations: { id: string; name: string } | null;
  elections: { id: string; election_name: string } | null;
}

// GET /dashboard
dashboardRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");

  try {
    // 自分宛ての承認待ち譲渡（RLS: to_user_id = auth.uid() の行は SELECT 可）
    const { data: transfers, error } = await supabase
      .from("ownership_transfers")
      .select("id, from_user_id, to_user_id, status, requested_at, ledger_id")
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch pending transfers:", error);
      return c.json({ error: "ダッシュボードの取得に失敗しました" }, 500);
    }

    const rows = (transfers ?? []) as TransferRow[];
    const pendingTransfers = await resolveTransferTargets(rows, userId);

    return c.json({ pendingTransfers });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

/**
 * 譲渡対象の台帳名（政治団体名 / 選挙名）を解決する。
 *
 * 譲渡先ユーザーはまだ台帳のオーナーでもメンバーでもないため、RLS では
 * ledgers / political_organizations / elections を読めない。
 * 認可: 上でユーザークライアント（RLS）経由で取得し、かつ to_user_id = 自分 の
 * 行だけに絞り込んだ ledger_id に限り、service client で名称を読む。
 */
async function resolveTransferTargets(
  rows: TransferRow[],
  userId: string,
): Promise<PendingTransfer[]> {
  const authorized = rows.filter((r) => r.to_user_id === userId);
  const ledgerIds = [
    ...new Set(
      authorized.map((r) => r.ledger_id).filter((id): id is string => !!id),
    ),
  ];

  const ledgerMap = new Map<string, LedgerTargetRow>();
  if (ledgerIds.length > 0) {
    const { data: ledgers, error: ledgerError } = await getServiceClient()
      .from("ledgers")
      .select(`
        id, organization_id, election_id,
        political_organizations ( id, name ),
        elections ( id, election_name )
      `)
      .in("id", ledgerIds);
    if (ledgerError) throw ledgerError;
    for (const l of (ledgers ?? []) as unknown as LedgerTargetRow[]) {
      ledgerMap.set(l.id, l);
    }
  }

  return authorized.map((r) => {
    const ledger = r.ledger_id ? ledgerMap.get(r.ledger_id) : undefined;
    return {
      id: r.id,
      from_user_id: r.from_user_id,
      organization_id: ledger?.organization_id ?? null,
      election_id: ledger?.election_id ?? null,
      requested_at: r.requested_at,
      political_organizations: one(ledger?.political_organizations ?? null),
      elections: one(ledger?.elections ?? null),
    };
  });
}
