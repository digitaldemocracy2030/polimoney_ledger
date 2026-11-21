/**
 * 認可ヘルパー（台帳ごとのロール・権限チェック）
 *
 * メンバーシップモデル（docs/schema-normalized.sql）:
 * - ledgers.owner_user_id が台帳のオーナー（暗黙の admin）
 * - ledger_members(user_id, ledger_id, role) が招待メンバー
 * - 政治団体台帳: ledgers.politician_organization_id -> politician_organizations.organization_id
 * - 選挙台帳:     ledgers.politician_election_id     -> politician_elections.election_id
 *
 * RLS に左右されずに所有・所属を判定するため、ここでは service client で読む。
 * service client を使うルートは、必ず先にこれらのヘルパーで権限を確認すること。
 */

import type { Context } from "hono";
import {
  type AppPermission,
  type AppRole,
  hasPermission,
  roleFromString,
} from "@polimoney-ledger/shared/permissions.ts";
import { getServiceClient } from "./supabase.ts";
import { httpError } from "./errors.ts";
import type { AppEnv } from "./types.ts";

export type LedgerType = "political_fund" | "election_fund";

/** 台帳の指定方法（台帳 ID / Ledger 内の政治団体 ID / Ledger 内の選挙 ID） */
export type LedgerTarget =
  | { ledgerId: string }
  | { organizationId: string }
  | { electionId: string };

export interface LedgerRow {
  id: string;
  owner_user_id: string;
  ledger_type: LedgerType;
}

/** ユーザーから見た台帳へのアクセス情報 */
export interface LedgerAccess {
  ledgerId: string;
  ledgerType: LedgerType;
  ownerUserId: string;
  /** オーナーなら "admin"、メンバーなら ledger_members.role */
  role: AppRole;
  isOwner: boolean;
}

/** 仕訳の台帳判定に使う最小限の列 */
export interface JournalRef {
  id: string;
  ledger_id: string;
  submitted_by_user_id: string;
  status: string;
  journal_date: string;
}

const LEDGER_COLUMNS = "id, owner_user_id, ledger_type";

/**
 * 指定に一致する台帳の候補を取得する（作成日時の昇順）
 */
export async function findLedgers(target: LedgerTarget): Promise<LedgerRow[]> {
  const svc = getServiceClient();

  if ("ledgerId" in target) {
    const { data, error } = await svc
      .from("ledgers")
      .select(LEDGER_COLUMNS)
      .eq("id", target.ledgerId);
    if (error) throw error;
    return (data ?? []) as LedgerRow[];
  }

  const link = "organizationId" in target
    ? {
      table: "politician_organizations",
      column: "organization_id",
      ledgerColumn: "politician_organization_id",
      id: target.organizationId,
    }
    : {
      table: "politician_elections",
      column: "election_id",
      ledgerColumn: "politician_election_id",
      id: target.electionId,
    };

  const { data: links, error: linkError } = await svc
    .from(link.table)
    .select("id")
    .eq(link.column, link.id);
  if (linkError) throw linkError;
  const linkIds = (links ?? []).map((l: { id: string }) => l.id);
  if (linkIds.length === 0) return [];

  const { data, error } = await svc
    .from("ledgers")
    .select(LEDGER_COLUMNS)
    .in(link.ledgerColumn, linkIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LedgerRow[];
}

/**
 * ユーザーの台帳アクセス情報を取得する。オーナーでもメンバーでもなければ null。
 * 候補が複数ある場合（同じ政治団体に複数の台帳）は、ユーザーがアクセスできる最初の台帳を返す。
 */
export async function getLedgerAccess(
  userId: string,
  target: LedgerTarget,
): Promise<LedgerAccess | null> {
  const ledgers = await findLedgers(target);
  if (ledgers.length === 0) return null;

  const owned = ledgers.find((l) => l.owner_user_id === userId);
  if (owned) {
    return {
      ledgerId: owned.id,
      ledgerType: owned.ledger_type,
      ownerUserId: owned.owner_user_id,
      role: "admin",
      isOwner: true,
    };
  }

  const { data: memberships, error } = await getServiceClient()
    .from("ledger_members")
    .select("ledger_id, role")
    .eq("user_id", userId)
    .in("ledger_id", ledgers.map((l) => l.id));
  if (error) throw error;

  for (const ledger of ledgers) {
    const m = (memberships ?? []).find(
      (row: { ledger_id: string }) => row.ledger_id === ledger.id,
    );
    if (m) {
      return {
        ledgerId: ledger.id,
        ledgerType: ledger.ledger_type,
        ownerUserId: ledger.owner_user_id,
        role: roleFromString(m.role),
        isOwner: false,
      };
    }
  }
  return null;
}

/** c.var.userId を使って台帳アクセス情報を取得する（アクセス不可なら null） */
export function getLedgerRole(
  c: Context<AppEnv>,
  target: LedgerTarget,
): Promise<LedgerAccess | null> {
  return getLedgerAccess(c.get("userId"), target);
}

/**
 * 台帳にアクセスでき、かつ allowedRoles のいずれかであることを要求する。
 * allowedRoles を省略するとロールを問わない（オーナーかメンバーであればよい）。
 * 台帳が無い/アクセス不可なら 404、ロール不足なら 403 を throw する。
 */
export async function requireLedgerRole(
  c: Context<AppEnv>,
  target: LedgerTarget,
  allowedRoles?: readonly AppRole[],
): Promise<LedgerAccess> {
  const access = await getLedgerRole(c, target);
  if (!access) {
    throw httpError(404, "台帳が見つからないか、アクセス権限がありません");
  }
  if (allowedRoles && !allowedRoles.includes(access.role)) {
    throw httpError(403, "この操作を行う権限がありません");
  }
  return access;
}

/**
 * 台帳に対して permission（shared/permissions.ts）を持つことを要求する。
 * 台帳が無い/アクセス不可なら 404、権限不足なら 403 を throw する。
 */
export async function requireLedgerPermission(
  c: Context<AppEnv>,
  target: LedgerTarget,
  permission: AppPermission,
): Promise<LedgerAccess> {
  const access = await requireLedgerRole(c, target);
  if (!hasPermission(access.role, permission)) {
    throw httpError(403, "この操作を行う権限がありません");
  }
  return access;
}

/** 台帳のオーナーであることを要求する（オーナー以外は 403） */
export async function requireLedgerOwner(
  c: Context<AppEnv>,
  target: LedgerTarget,
): Promise<LedgerAccess> {
  const access = await requireLedgerRole(c, target);
  if (!access.isOwner) {
    throw httpError(403, "台帳のオーナーのみ実行できます");
  }
  return access;
}

/**
 * 仕訳が属する台帳へのアクセスを要求する（仕訳が無ければ 404）。
 * permission を渡すとその権限も要求する。
 */
export async function requireJournalAccess(
  c: Context<AppEnv>,
  journalId: string,
  permission?: AppPermission,
): Promise<LedgerAccess & { journal: JournalRef }> {
  const { data: journal, error } = await getServiceClient()
    .from("journals")
    .select("id, ledger_id, submitted_by_user_id, status, journal_date")
    .eq("id", journalId)
    .maybeSingle();
  if (error) throw error;
  // 仕訳が無い場合とアクセス権が無い場合を同じ 404 にする（仕訳 ID の存在を推測させない）
  const notFound = () =>
    httpError(404, "仕訳が見つからないか、アクセス権限がありません");
  if (!journal) {
    throw notFound();
  }
  const access = await getLedgerRole(c, {
    ledgerId: (journal as JournalRef).ledger_id,
  });
  if (!access) {
    throw notFound();
  }
  if (permission && !hasPermission(access.role, permission)) {
    throw httpError(403, "この操作を行う権限がありません");
  }
  return { ...access, journal: journal as JournalRef };
}

/**
 * 仕訳の関係者として、その台帳で使える関係者であることを要求する（違えば 400）。
 * DB 側の public.is_contact_usable_in_ledger と同じ条件:
 * - 台帳に紐付いた関係者
 * - 台帳オーナーが作成した、台帳に紐付いていない関係者
 * - その台帳の仕訳で既に使われている関係者（オーナー譲渡前の旧オーナーの関係者など）
 * オーナーの関係者はメンバーから RLS で読めないため service client で判定する。
 */
export async function assertContactUsableInLedger(
  access: LedgerAccess,
  contactId: string | null | undefined,
): Promise<void> {
  if (!contactId) return;
  const svc = getServiceClient();
  const invalid = () =>
    httpError(400, "この台帳で使用できない関係者が指定されています");

  const { data: contact, error } = await svc
    .from("contacts")
    .select("id, ledger_id, owner_user_id")
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw error;
  if (!contact) throw invalid();
  if (contact.ledger_id === access.ledgerId) return;
  if (!contact.ledger_id && contact.owner_user_id === access.ownerUserId) {
    return;
  }

  const { count, error: usedError } = await svc
    .from("journals")
    .select("id", { count: "exact", head: true })
    .eq("ledger_id", access.ledgerId)
    .eq("contact_id", contactId);
  if (usedError) throw usedError;
  if (!count) throw invalid();
}

/**
 * 仕訳明細の補助科目として、その台帳で使える補助科目であることを要求する（違えば 400）。
 * DB 側の public.is_sub_account_usable_in_ledger と同じ条件:
 * - 台帳オーナーの補助科目
 * - その台帳の仕訳明細で既に使われている補助科目（オーナー譲渡前の旧オーナーの補助科目など）
 */
export async function assertSubAccountsUsableInLedger(
  access: LedgerAccess,
  subAccountIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = [...new Set(subAccountIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  const svc = getServiceClient();
  const invalid = () =>
    httpError(400, "この台帳で使用できない補助科目が指定されています");

  const { data: owned, error } = await svc
    .from("sub_accounts")
    .select("id")
    .in("id", ids)
    .eq("owner_user_id", access.ownerUserId);
  if (error) throw error;
  const ok = new Set((owned ?? []).map((row: { id: string }) => row.id));
  const rest = ids.filter((id) => !ok.has(id));
  if (rest.length === 0) return;

  const { data: used, error: usedError } = await svc
    .from("journal_entries")
    .select("sub_account_id, journals!inner ( ledger_id )")
    .in("sub_account_id", rest)
    .eq("journals.ledger_id", access.ledgerId);
  if (usedError) throw usedError;
  for (const row of (used ?? []) as Array<{ sub_account_id: string }>) {
    ok.add(row.sub_account_id);
  }
  if (rest.some((id) => !ok.has(id))) throw invalid();
}

/**
 * 証憑（media_assets）の storage_path が、アップロードした本人・仕訳のフォルダ
 * （`{uploaded_by_user_id}/{journal_id}/...`）にあるか。
 * service client で署名付き URL の発行・ダウンロード・削除をする前に必ず確認する
 * （他人の証憑のパスを登録した行を使って、他の台帳のファイルを操作させないため）。
 */
export function isReceiptPathOfAsset(asset: {
  storage_path: string | null;
  uploaded_by_user_id: string | null;
  journal_id: string | null;
}): boolean {
  const { storage_path: path, uploaded_by_user_id: uploader, journal_id } =
    asset;
  if (!path || !uploader || !journal_id) return false;
  if (path.includes("..")) return false;
  const prefix = `${uploader}/${journal_id}/`;
  return path.startsWith(prefix) && path.length > prefix.length;
}

/** 対象ユーザーがリクエストしたユーザー本人であることを要求する（違えば 403） */
export function requireSelf(c: Context<AppEnv>, userId: string): void {
  if (c.get("userId") !== userId) {
    throw httpError(403, "この操作を行う権限がありません");
  }
}
