/**
 * Hub 同期用の台帳情報
 *
 * Hub の POST /api/v1/sync/ledger は、台帳種別ごとに Hub 側の紐付けの ID を必須とする:
 * - political_fund: politician_organization_id（Hub の politician_organizations.id。団体の代表者との紐付け）
 * - election_fund:  politician_election_id（Hub の politician_elections.id）
 *
 * Ledger はこれらを ledgers.hub_politician_organization_id / hub_politician_election_id に保持する。
 * 台帳作成時に Hub から取得して保存する（routes/organizations.ts / elections.ts）。
 * 未設定の台帳（作成時に Hub に無かった選挙・以前に作成した台帳）は、同期時に Hub から取得して保存する。
 * 取得できない場合は HubLinkMissingError で理由を明示する（undefined のまま Hub に送らない）。
 */

import type { Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerType } from "./authz.ts";
import {
  HubApiError,
  resolvePoliticianElection,
  resolvePoliticianOrganization,
  type SyncLedgerInput,
} from "./hub-client.ts";

/** Hub 同期に使う ledgers の列 */
export interface HubLedgerRecord {
  id: string;
  owner_user_id: string;
  ledger_type: LedgerType;
  organization_id: string | null;
  election_id: string | null;
  hub_ledger_id: string | null;
  hub_politician_organization_id: string | null;
  hub_politician_election_id: string | null;
}

export const HUB_LEDGER_COLUMNS =
  "id, owner_user_id, ledger_type, organization_id, election_id, hub_ledger_id, hub_politician_organization_id, hub_politician_election_id";

/** 台帳に Hub の紐付けが無く同期できない */
export class HubLinkMissingError extends Error {
  constructor(public readonly ledgerId: string, reason: string) {
    super(
      `台帳 ${ledgerId} は Polimoney Hub と紐付けられないため同期できません: ${reason}`,
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

/** Hub の紐付け取得の失敗を、利用者向けの理由にする */
function hubLinkFailureReason(error: unknown): string {
  if (
    error instanceof HubApiError && error.status >= 400 && error.status < 500
  ) {
    return error.message;
  }
  return "Polimoney Hub に接続できませんでした。時間をおいて再度お試しください";
}

async function saveLink(
  svc: SupabaseClient,
  ledgerId: string,
  values: Record<string, string>,
) {
  const { error } = await svc.from("ledgers").update(values).eq(
    "id",
    ledgerId,
  );
  if (error) {
    // 保存に失敗しても今回の同期は続けられる（次回また Hub から取得する）
    console.error(
      `[Hub] Failed to save Hub link for ledger ${ledgerId}:`,
      error,
    );
  }
}

/**
 * 台帳の Hub の紐付けが未設定なら Hub から取得して保存する（更新後の ledger を返す）。
 * 権限確認済みの台帳だけを渡すこと（service client で更新する）。
 */
async function ensureHubLedgerLink(
  svc: SupabaseClient,
  ledger: HubLedgerRecord,
): Promise<HubLedgerRecord> {
  if (ledger.ledger_type === "political_fund") {
    if (ledger.hub_politician_organization_id) return ledger;
    const { data: org } = await svc
      .from("political_organizations")
      .select("hub_organization_id")
      .eq("id", ledger.organization_id ?? "")
      .maybeSingle();
    if (!org?.hub_organization_id) {
      throw new HubLinkMissingError(
        ledger.id,
        "政治団体が Polimoney Hub の団体と紐付いていません",
      );
    }
    let link;
    try {
      link = await resolvePoliticianOrganization({
        ledgerUserId: ledger.owner_user_id,
        organizationId: org.hub_organization_id,
      });
    } catch (error) {
      throw new HubLinkMissingError(ledger.id, hubLinkFailureReason(error));
    }
    await saveLink(svc, ledger.id, {
      hub_politician_organization_id: link.id,
    });
    return { ...ledger, hub_politician_organization_id: link.id };
  }

  if (ledger.hub_politician_election_id) return ledger;
  const { data: election } = await svc
    .from("elections")
    .select("hub_politician_id, hub_election_id")
    .eq("id", ledger.election_id ?? "")
    .maybeSingle();
  if (!election?.hub_election_id || !election.hub_politician_id) {
    throw new HubLinkMissingError(
      ledger.id,
      "選挙が Polimoney Hub に登録されていません（選挙の登録申請が承認されるまで同期できません）",
    );
  }
  let link;
  try {
    link = await resolvePoliticianElection({
      ledgerUserId: ledger.owner_user_id,
      politicianId: election.hub_politician_id,
      electionId: election.hub_election_id,
    });
  } catch (error) {
    throw new HubLinkMissingError(ledger.id, hubLinkFailureReason(error));
  }
  await saveLink(svc, ledger.id, { hub_politician_election_id: link.id });
  return { ...ledger, hub_politician_election_id: link.id };
}

/**
 * 台帳種別に応じた Hub の紐付けの ID を返す（未設定なら Hub から取得して保存する）。
 * 取得できなければ HubLinkMissingError を throw する。
 */
export async function hubLedgerLink(
  svc: SupabaseClient,
  ledger: HubLedgerRecord,
): Promise<
  Pick<SyncLedgerInput, "politician_organization_id" | "politician_election_id">
> {
  const linked = await ensureHubLedgerLink(svc, ledger);
  if (linked.ledger_type === "political_fund") {
    return {
      politician_organization_id: linked.hub_politician_organization_id!,
    };
  }
  return { politician_election_id: linked.hub_politician_election_id! };
}

/**
 * 台帳作成時に Hub の紐付けを取得できなかった場合のレスポンス
 * @param target 「政治団体」「選挙」
 */
export function hubLinkErrorResponse(
  c: Context,
  error: unknown,
  target: string,
) {
  if (error instanceof HubApiError) {
    if (error.status === 403) {
      return c.json(
        {
          error:
            `この${target}の台帳を作成する権限が Polimoney Hub で確認できませんでした`,
        },
        403,
      );
    }
    if (error.status === 404) {
      return c.json(
        { error: `選択した${target}が Polimoney Hub に見つかりません` },
        404,
      );
    }
    if (error.status === 409) {
      return c.json({ error: error.message }, 409);
    }
  }
  console.error(`Failed to resolve Hub link (${target}):`, error);
  return c.json(
    {
      error:
        "Polimoney Hub に接続できませんでした。時間をおいて再度お試しください",
    },
    503,
  );
}
