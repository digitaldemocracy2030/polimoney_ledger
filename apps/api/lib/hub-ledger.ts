/**
 * Hub 同期用の台帳情報
 *
 * Hub の POST /api/v1/sync/ledger は、台帳種別ごとに Hub 側の中間テーブル ID を必須とする:
 * - political_fund: politician_organization_id（Hub の politician_organizations.id）
 * - election_fund:  politician_election_id（Hub の politician_elections.id）
 *
 * Ledger はこれらを ledgers.hub_politician_organization_id / hub_politician_election_id に保持する。
 * ただし現状の Hub API には中間テーブル ID を取得するエンドポイントが無いため、
 * 台帳作成時には設定できない（null のまま）。未設定の台帳は同期せず、
 * HubLinkMissingError で理由を明示する（undefined のまま Hub に送らない）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerType } from "./authz.ts";
import type { SyncLedgerInput } from "./hub-client.ts";

/** Hub 同期に使う ledgers の列 */
export interface HubLedgerRecord {
  id: string;
  owner_user_id: string;
  ledger_type: LedgerType;
  hub_ledger_id: string | null;
  hub_politician_organization_id: string | null;
  hub_politician_election_id: string | null;
}

export const HUB_LEDGER_COLUMNS =
  "id, owner_user_id, ledger_type, hub_ledger_id, hub_politician_organization_id, hub_politician_election_id";

/** 台帳に Hub の中間テーブル ID が設定されておらず同期できない */
export class HubLinkMissingError extends Error {
  constructor(public readonly ledgerId: string, column: string) {
    super(
      `台帳 ${ledgerId} は Polimoney Hub との紐付け（${column}）が未設定のため同期できません。管理者にお問い合わせください`,
    );
    this.name = "HubLinkMissingError";
  }
}

/**
 * 台帳を取得する（権限確認済みの ID のみ渡すこと。service client を想定）
 */
export async function getHubLedgerRecords(
  svc: SupabaseClient,
  ledgerIds: string[],
): Promise<HubLedgerRecord[]> {
  if (ledgerIds.length === 0) return [];
  const { data, error } = await svc
    .from("ledgers")
    .select(HUB_LEDGER_COLUMNS)
    .in("id", ledgerIds);
  if (error) {
    throw new Error(`Failed to fetch ledgers: ${error.message}`);
  }
  return (data ?? []) as HubLedgerRecord[];
}

/**
 * 台帳種別に応じた Hub の中間テーブル ID を返す。未設定なら HubLinkMissingError を throw する。
 */
export function hubLedgerLink(
  ledger: HubLedgerRecord,
): Pick<
  SyncLedgerInput,
  "politician_organization_id" | "politician_election_id"
> {
  if (ledger.ledger_type === "political_fund") {
    if (!ledger.hub_politician_organization_id) {
      throw new HubLinkMissingError(
        ledger.id,
        "hub_politician_organization_id",
      );
    }
    return {
      politician_organization_id: ledger.hub_politician_organization_id,
    };
  }
  if (!ledger.hub_politician_election_id) {
    throw new HubLinkMissingError(ledger.id, "hub_politician_election_id");
  }
  return { politician_election_id: ledger.hub_politician_election_id };
}
