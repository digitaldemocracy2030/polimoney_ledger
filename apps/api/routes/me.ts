/**
 * /v1/me API（ログイン中ユーザーの情報）
 *
 * Web はユーザーの状態（審査状況・規約同意・政治家認証・所属台帳とロール）を
 * すべてここから取得する。user_metadata や Supabase を直接読まない。
 *
 * - GET  /v1/me            ユーザー情報 + プロフィール + 所属台帳
 * - POST /v1/me/onboarding 利用規約・プライバシーポリシーへの同意を記録
 */

import { Hono } from "hono";
import type { User } from "@supabase/supabase-js";
import {
  type AppRole,
  roleFromString,
} from "@polimoney-ledger/shared/permissions.ts";
import type { AppEnv } from "../lib/types.ts";
import type { LedgerType } from "../lib/authz.ts";
import { getServiceClient } from "../lib/supabase.ts";
import { httpError } from "../lib/errors.ts";

export const meRouter = new Hono<AppEnv>();

interface ProfileRow {
  id: string;
  hub_politician_id: string | null;
  avatar_url: string | null;
  tos_accepted_at: string | null;
  privacy_policy_accepted_at: string | null;
  verified_email_domain: string | null;
  updated_at: string | null;
}

const PROFILE_COLUMNS =
  "id, hub_politician_id, avatar_url, tos_accepted_at, privacy_policy_accepted_at, verified_email_domain, updated_at";

/** 所属台帳（GET /v1/me の ledgers 要素） */
export interface MyLedger {
  ledgerId: string;
  ledgerType: LedgerType;
  role: AppRole;
  isOwner: boolean;
  /** 政治団体台帳の場合の Ledger 内政治団体 */
  organization: {
    id: string;
    name: string;
    hubOrganizationId: string | null;
  } | null;
  /** 選挙台帳の場合の Ledger 内選挙 */
  election: {
    id: string;
    name: string;
    date: string | null;
    hubElectionId: string | null;
  } | null;
}

/** GET /v1/me のレスポンス */
export interface MeResponse {
  id: string;
  email: string;
  fullName: string | null;
  displayName: string;
  registrationStatus: string | null;
  hubPoliticianId: string | null;
  avatarUrl: string | null;
  tosAcceptedAt: string | null;
  privacyPolicyAcceptedAt: string | null;
  verifiedEmailDomain: string | null;
  /** 利用規約・プライバシーポリシーのいずれかが未同意なら true */
  needsOnboarding: boolean;
  ledgers: MyLedger[];
}

type One<T> = T | T[] | null;
function one<T>(v: One<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

interface LedgerJoinRow {
  id: string;
  owner_user_id: string;
  ledger_type: LedgerType;
  created_at: string | null;
  politician_organizations: One<{
    organization_id: string;
    political_organizations: One<{
      id: string;
      name: string;
      hub_organization_id: string | null;
    }>;
  }>;
  politician_elections: One<{
    election_id: string;
    elections: One<{
      id: string;
      election_name: string;
      election_date: string | null;
      hub_election_id: string | null;
    }>;
  }>;
}

const LEDGER_JOIN_COLUMNS = `
  id, owner_user_id, ledger_type, created_at,
  politician_organizations (
    organization_id,
    political_organizations ( id, name, hub_organization_id )
  ),
  politician_elections (
    election_id,
    elections ( id, election_name, election_date, hub_election_id )
  )
`;

function toMyLedger(
  row: LedgerJoinRow,
  role: AppRole,
  isOwner: boolean,
): MyLedger {
  const org = one(
    one(row.politician_organizations)?.political_organizations ??
      null,
  );
  const elec = one(one(row.politician_elections)?.elections ?? null);
  return {
    ledgerId: row.id,
    ledgerType: row.ledger_type,
    role,
    isOwner,
    organization: org
      ? {
        id: org.id,
        name: org.name,
        hubOrganizationId: org.hub_organization_id,
      }
      : null,
    election: elec
      ? {
        id: elec.id,
        name: elec.election_name,
        date: elec.election_date,
        hubElectionId: elec.hub_election_id,
      }
      : null,
  };
}

/**
 * ユーザーが所有・所属する台帳を取得する。
 *
 * 読み取り対象はリクエストしたユーザー本人の所有（owner_user_id = userId）と
 * 本人のメンバーシップ（ledger_members.user_id = userId）に限定している。
 * ledgers / ledger_members / political_organizations / elections の RLS は
 * オーナー限定またはポリシー無しで、メンバーとして所属する台帳を
 * ユーザークライアントでは読めないため、service client で本人分だけを読む。
 */
async function fetchMyLedgers(userId: string): Promise<MyLedger[]> {
  const svc = getServiceClient();

  const [ownedRes, memberRes] = await Promise.all([
    svc
      .from("ledgers")
      .select(LEDGER_JOIN_COLUMNS)
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true }),
    svc
      .from("ledger_members")
      .select("ledger_id, role")
      .eq("user_id", userId),
  ]);
  if (ownedRes.error) throw ownedRes.error;
  if (memberRes.error) throw memberRes.error;

  const owned = (ownedRes.data ?? []) as unknown as LedgerJoinRow[];
  const result: MyLedger[] = owned.map((row) => toMyLedger(row, "admin", true));
  const ownedIds = new Set(owned.map((row) => row.id));

  const memberships = (memberRes.data ?? []) as {
    ledger_id: string;
    role: string;
  }[];
  const memberOnly = memberships.filter((m) => !ownedIds.has(m.ledger_id));
  if (memberOnly.length === 0) return result;

  const { data: memberLedgers, error } = await svc
    .from("ledgers")
    .select(LEDGER_JOIN_COLUMNS)
    .in("id", memberOnly.map((m) => m.ledger_id))
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const row of (memberLedgers ?? []) as unknown as LedgerJoinRow[]) {
    const m = memberOnly.find((mm) => mm.ledger_id === row.id);
    if (!m) continue;
    result.push(toMyLedger(row, roleFromString(m.role), false));
  }
  return result;
}

function metadataString(user: User, key: string): string | null {
  const v = user.user_metadata?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function appMetadataString(user: User, key: string): string | null {
  const v = user.app_metadata?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function buildMe(
  user: User,
  profile: ProfileRow | null,
  ledgers: MyLedger[],
): MeResponse {
  const fullName = metadataString(user, "full_name");
  const tosAcceptedAt = profile?.tos_accepted_at ?? null;
  const privacyPolicyAcceptedAt = profile?.privacy_policy_accepted_at ?? null;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName,
    displayName: metadataString(user, "display_name") ?? fullName ?? "",
    // 審査状態はユーザーが書き換えられない app_metadata に置く
    registrationStatus: appMetadataString(user, "registration_status"),
    hubPoliticianId: profile?.hub_politician_id ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    tosAcceptedAt,
    privacyPolicyAcceptedAt,
    verifiedEmailDomain: profile?.verified_email_domain ?? null,
    needsOnboarding: !tosAcceptedAt || !privacyPolicyAcceptedAt,
    ledgers,
  };
}

// GET /v1/me - ログイン中ユーザーの情報
meRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const user = c.get("user");
  const supabase = c.get("supabase");

  const [profileRes, ledgers] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle(),
    fetchMyLedgers(userId),
  ]);

  if (profileRes.error) {
    console.error("Failed to fetch profile:", profileRes.error);
    throw httpError(500, "ユーザー情報の取得に失敗しました");
  }

  return c.json(
    buildMe(user, (profileRes.data as ProfileRow | null) ?? null, ledgers),
  );
});

// POST /v1/me/onboarding - 利用規約・プライバシーポリシーへの同意を記録
// 登録（signUp）時点ではセッションが無いため、初回ログイン後に Web から呼ぶ。
meRouter.post("/onboarding", async (c) => {
  const userId = c.get("userId");
  const user = c.get("user");
  const supabase = c.get("supabase");

  let body: { tosAccepted?: unknown; privacyPolicyAccepted?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw httpError(400, "リクエストの形式が正しくありません");
  }

  if (body.tosAccepted !== true) {
    throw httpError(400, "利用規約への同意が必要です");
  }
  if (body.privacyPolicyAccepted !== true) {
    throw httpError(400, "プライバシーポリシーへの同意が必要です");
  }

  const now = new Date().toISOString();
  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        tos_accepted_at: now,
        privacy_policy_accepted_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    )
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    console.error("Failed to record onboarding:", error);
    throw httpError(500, "同意の記録に失敗しました");
  }

  const ledgers = await fetchMyLedgers(userId);
  return c.json(buildMe(user, profile as ProfileRow, ledgers));
});
