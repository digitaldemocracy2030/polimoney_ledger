/**
 * 選挙 API
 *
 * - GET  /elections                 自分の選挙台帳一覧（オーナー + メンバー）
 * - GET  /elections/new-data        選挙台帳作成画面の初期データ
 * - POST /elections                 選挙台帳の作成（認証済み政治家のみ）
 * - GET  /elections/:id/ledger      仕訳一覧などの台帳データ
 * - GET  /elections/:id/members     メンバー一覧
 * - GET  /elections/:id/assets      資産一覧
 *
 * データ取得は原則 c.get("supabase")（RLS 適用）。service client は
 * lib/authz.ts で権限を確認した後の特権処理（auth.admin）と、
 * Hub で認証済み政治家本人であることを確認した後の台帳作成のみ
 * （台帳の構造はユーザーが直接書き込めない。supabase/migrations/20261121100000_api_user_scoped_rls.sql 6 節）。
 *
 * 選挙台帳 = ledgers(ledger_type = 'election_fund', election_id -> elections.id)。
 * 政治家・選挙のマスタは Hub が持ち、Ledger の elections は hub_politician_id / hub_election_id だけを持つ。
 *
 * 台帳まわりの共通処理は lib/ledger-data.ts にある。
 */

import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission } from "@polimoney-ledger/shared/permissions.ts";
import type { AppEnv } from "../lib/types.ts";
import { httpError } from "../lib/errors.ts";
import { requireLedgerPermission } from "../lib/authz.ts";
import {
  deleteRowsQuietly,
  fetchAccountCodes,
  fetchLedgerAssets,
  fetchLedgerContacts,
  fetchLedgerJournals,
  fetchLedgerMembers,
  fetchLedgerSubAccounts,
} from "../lib/ledger-data.ts";
import { getServiceClient } from "../lib/supabase.ts";
import {
  getElections,
  getVerifiedPoliticianByUserId,
  getVerifiedPoliticiansByUserId,
} from "../lib/hub-client.ts";

export const electionsRouter = new Hono<AppEnv>();

// ============================================
// 選挙用の内部ヘルパー
// ============================================

interface ElectionListItem {
  id: string;
  election_name: string;
  election_date: string;
  created_at: string;
  hub_politician_id: string | null;
}

const ELECTION_LIST_COLUMNS =
  "id, election_name, election_date, created_at, hub_politician_id";

/** 選挙行を取得する（見つからなければ 404） */
async function getElectionOr404<T>(
  supabase: SupabaseClient,
  electionId: string,
  columns: string,
): Promise<T> {
  const { data, error } = await supabase
    .from("elections")
    .select(columns)
    .eq("id", electionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw httpError(404, "選挙が見つかりません");
  }
  return data as T;
}

// ============================================
// ルート（静的パスを /:id より先に登録する）
// ============================================

// GET /elections - 選挙台帳一覧（自分がオーナー、またはメンバーの台帳）
// ledgers の RLS（オーナーまたはメンバー）で見える選挙台帳から選挙を取り出す
electionsRouter.get("/", async (c) => {
  const { data, error } = await c.get("supabase")
    .from("ledgers")
    .select(`elections ( ${ELECTION_LIST_COLUMNS} )`)
    .eq("ledger_type", "election_fund");
  if (error) {
    console.error("Failed to fetch election ledgers:", error);
    return c.json({ error: "選挙台帳の取得に失敗しました" }, 500);
  }

  const elections = new Map<string, ElectionListItem>();
  for (
    const ledger of (data ?? []) as unknown as Array<{
      elections: ElectionListItem | ElectionListItem[] | null;
    }>
  ) {
    const e = Array.isArray(ledger.elections)
      ? ledger.elections[0]
      : ledger.elections;
    if (e && !elections.has(e.id)) elections.set(e.id, e);
  }

  const list = [...elections.values()].sort((a, b) =>
    b.election_date.localeCompare(a.election_date)
  );
  return c.json({ elections: list });
});

// GET /elections/new-data - 選挙台帳作成画面の初期データ
electionsRouter.get("/new-data", async (c) => {
  const userId = c.get("userId");

  // 認証済み政治家かどうかは Hub（ledger_user_id と is_verified）で判定する
  let verifiedPolitician: {
    id: string;
    name: string;
    name_kana: string | null;
    party: string | null;
  } | null = null;

  try {
    const politician = await getVerifiedPoliticianByUserId(userId);
    if (politician) {
      verifiedPolitician = {
        id: politician.id,
        name: politician.name,
        name_kana: politician.name_kana || null,
        party: politician.party || null,
      };
    }
  } catch (error) {
    console.error("Failed to fetch verified politician from Hub:", error);
  }

  try {
    const elections = await getElections();
    const hubElections = elections.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      election_date: e.election_date,
    }));
    return c.json({
      hubElections,
      verifiedPolitician,
      canCreateElection: !!verifiedPolitician,
    });
  } catch (error) {
    console.error("Failed to fetch elections from Hub:", error);
    return c.json({ error: "選挙一覧の取得に失敗しました" }, 502);
  }
});

// POST /elections - 選挙台帳の作成
// 選挙 -> 台帳 の順に作成する（オーナーの admin メンバー登録は DB トリガー trg_ledger_auto_member）。
// Hub の politician_elections.id（ledgers.hub_politician_election_id）は Hub API に取得手段が無いため
// ここでは設定しない（null）。Hub 同期時に未設定ならエラーになる（lib/hub-ledger.ts）。
electionsRouter.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    hub_election_id?: string | null;
    election_name?: string;
    election_date?: string;
    hub_politician_id?: string;
  }>().catch(() => null);
  if (!body) {
    return c.json({ error: "リクエストの形式が正しくありません" }, 400);
  }

  const electionName = body.election_name?.trim();
  if (!electionName) {
    return c.json({ error: "選挙名は必須です" }, 400);
  }
  if (!body.election_date) {
    return c.json({ error: "選挙日は必須です" }, 400);
  }
  if (!body.hub_politician_id) {
    return c.json(
      { error: "政治家IDは必須です（認証済みの政治家IDが必要です）" },
      400,
    );
  }

  // 認証済み政治家本人のみ作成できる。
  // Hub で ledger_user_id = 自分 かつ is_verified の政治家であることを確認する
  // （Ledger の profiles.hub_politician_id は判定に使わない）
  let verifiedPoliticians;
  try {
    verifiedPoliticians = await getVerifiedPoliticiansByUserId(userId);
  } catch (error) {
    console.error("Failed to fetch verified politicians from Hub:", error);
    return c.json(
      {
        error:
          "政治家の認証状態を確認できませんでした。時間をおいて再度お試しください",
      },
      503,
    );
  }
  const politician = verifiedPoliticians.find((p) =>
    p.id === body.hub_politician_id
  );
  if (!politician) {
    return c.json(
      { error: "認証済みの政治家本人のみ選挙台帳を作成できます" },
      403,
    );
  }

  // 台帳の構造はユーザーが直接書き込めないため、上で Hub の認証を確認したうえで
  // service client で作成する（hub_politician_id は Hub で確認した値のみ）
  const svc = getServiceClient();
  let electionId: string | null = null;
  let ledgerId: string | null = null;

  try {
    const { data: election, error: electionError } = await svc
      .from("elections")
      .insert({
        owner_user_id: userId,
        hub_politician_id: politician.id,
        hub_election_id: body.hub_election_id || null,
        election_name: electionName,
        election_date: body.election_date,
      })
      .select("id")
      .single();
    if (electionError) throw electionError;
    electionId = election.id as string;

    const { data: ledger, error: ledgerError } = await svc
      .from("ledgers")
      .insert({
        owner_user_id: userId,
        ledger_type: "election_fund",
        election_id: electionId,
      })
      .select("id")
      .single();
    if (ledgerError) throw ledgerError;
    ledgerId = ledger.id as string;

    return c.json({ success: true, election_id: electionId }, 201);
  } catch (error) {
    console.error("Failed to create election ledger:", error);
    await deleteRowsQuietly(svc, [
      { table: "ledger_members", column: "ledger_id", id: ledgerId },
      { table: "ledgers", id: ledgerId },
      { table: "elections", id: electionId },
    ]);
    return c.json({ error: "選挙台帳の作成に失敗しました" }, 500);
  }
});

// GET /elections/:id/ledger - 選挙台帳のデータ
electionsRouter.get("/:id/ledger", async (c) => {
  const electionId = c.req.param("id");
  const access = await requireLedgerPermission(
    c,
    { electionId },
    "viewLedger",
  );
  const supabase = c.get("supabase");

  const election = await getElectionOr404<{
    id: string;
    election_name: string;
    election_date: string;
    hub_politician_id: string | null;
  }>(
    supabase,
    electionId,
    "id, election_name, election_date, hub_politician_id",
  );

  try {
    const [journals, contacts, subAccounts, accountCodes] = await Promise.all([
      fetchLedgerJournals(supabase, access.ledgerId),
      fetchLedgerContacts(supabase, access.ledgerId, access.ownerUserId),
      fetchLedgerSubAccounts(supabase, access, "election"),
      fetchAccountCodes("election", c.get("userId")),
    ]);

    return c.json({
      election,
      journals,
      accountCodes,
      contacts,
      subAccounts,
      ledgerId: access.ledgerId,
      // 画面の操作可否（仕訳の即時登録など）を決めるためのロール
      myRole: access.role,
    });
  } catch (error) {
    console.error("Failed to fetch election ledger:", error);
    return c.json({ error: "台帳データの取得に失敗しました" }, 500);
  }
});

// GET /elections/:id/members - 選挙台帳のメンバー一覧
electionsRouter.get("/:id/members", async (c) => {
  const electionId = c.req.param("id");
  const access = await requireLedgerPermission(
    c,
    { electionId },
    "viewLedger",
  );

  const election = await getElectionOr404<{ election_name: string }>(
    c.get("supabase"),
    electionId,
    "election_name",
  );

  try {
    const members = await fetchLedgerMembers(c, access);
    return c.json({
      election,
      members,
      isOwner: access.isOwner,
      canManageMembers: hasPermission(access.role, "manageMembers"),
      ledgerId: access.ledgerId,
    });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return c.json({ error: "メンバー一覧の取得に失敗しました" }, 500);
  }
});

// GET /elections/:id/assets - 選挙台帳の資産一覧
electionsRouter.get("/:id/assets", async (c) => {
  const electionId = c.req.param("id");
  const access = await requireLedgerPermission(
    c,
    { electionId },
    "viewLedger",
  );
  const supabase = c.get("supabase");

  const election = await getElectionOr404<{ election_name: string }>(
    supabase,
    electionId,
    "election_name",
  );

  try {
    const assets = await fetchLedgerAssets(supabase, access.ledgerId);
    return c.json({ election, assets });
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return c.json({ error: "資産一覧の取得に失敗しました" }, 500);
  }
});
