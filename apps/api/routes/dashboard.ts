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

/** ownership_transfers の行（ledger_id は台帳単位の譲渡用に追加される列） */
interface TransferRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  requested_at: string;
  ledger_id?: string | null;
}

interface LedgerLinkRow {
  id: string;
  politician_organization_id: string | null;
  politician_election_id: string | null;
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
      .select("*")
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

  const ledgerMap = new Map<string, LedgerLinkRow>();
  const orgByLink = new Map<string, string>();
  const electionByLink = new Map<string, string>();
  const orgMap = new Map<string, { id: string; name: string }>();
  const electionMap = new Map<string, { id: string; election_name: string }>();

  if (ledgerIds.length > 0) {
    const svc = getServiceClient();

    const { data: ledgers, error: ledgerError } = await svc
      .from("ledgers")
      .select("id, politician_organization_id, politician_election_id")
      .in("id", ledgerIds);
    if (ledgerError) throw ledgerError;
    for (const l of (ledgers ?? []) as LedgerLinkRow[]) ledgerMap.set(l.id, l);

    const poIds = [...ledgerMap.values()]
      .map((l) => l.politician_organization_id)
      .filter((id): id is string => !!id);
    const peIds = [...ledgerMap.values()]
      .map((l) => l.politician_election_id)
      .filter((id): id is string => !!id);

    if (poIds.length > 0) {
      const { data, error } = await svc
        .from("politician_organizations")
        .select("id, organization_id")
        .in("id", poIds);
      if (error) throw error;
      for (
        const row of (data ?? []) as { id: string; organization_id: string }[]
      ) {
        orgByLink.set(row.id, row.organization_id);
      }

      const orgIds = [...new Set(orgByLink.values())];
      if (orgIds.length > 0) {
        const { data: orgs, error: orgError } = await svc
          .from("political_organizations")
          .select("id, name")
          .in("id", orgIds);
        if (orgError) throw orgError;
        for (const o of (orgs ?? []) as { id: string; name: string }[]) {
          orgMap.set(o.id, o);
        }
      }
    }

    if (peIds.length > 0) {
      const { data, error } = await svc
        .from("politician_elections")
        .select("id, election_id")
        .in("id", peIds);
      if (error) throw error;
      for (const row of (data ?? []) as { id: string; election_id: string }[]) {
        electionByLink.set(row.id, row.election_id);
      }

      const electionIds = [...new Set(electionByLink.values())];
      if (electionIds.length > 0) {
        const { data: elections, error: electionError } = await svc
          .from("elections")
          .select("id, election_name")
          .in("id", electionIds);
        if (electionError) throw electionError;
        for (
          const e of (elections ?? []) as {
            id: string;
            election_name: string;
          }[]
        ) {
          electionMap.set(e.id, e);
        }
      }
    }
  }

  return authorized.map((r) => {
    const ledger = r.ledger_id ? ledgerMap.get(r.ledger_id) : undefined;
    const organizationId = ledger?.politician_organization_id
      ? orgByLink.get(ledger.politician_organization_id) ?? null
      : null;
    const electionId = ledger?.politician_election_id
      ? electionByLink.get(ledger.politician_election_id) ?? null
      : null;

    return {
      id: r.id,
      from_user_id: r.from_user_id,
      organization_id: organizationId,
      election_id: electionId,
      requested_at: r.requested_at,
      political_organizations: organizationId
        ? orgMap.get(organizationId) ?? null
        : null,
      elections: electionId ? electionMap.get(electionId) ?? null : null,
    };
  });
}
