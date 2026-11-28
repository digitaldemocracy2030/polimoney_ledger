/**
 * 政治団体 API
 *
 * - GET  /organizations                    自分の政治団体台帳一覧（オーナー + メンバー）
 * - POST /organizations                    政治団体台帳の作成（Hub で認証済みの団体管理者のみ）
 * - GET  /organizations/manager-verify     団体管理者認証画面の初期データ
 * - POST /organizations/manager-verify     団体管理者認証の申請（以下 send-code / verify-code / verify-dns）
 * - GET  /organizations/:id/ledger         仕訳一覧などの台帳データ（?year=）
 * - GET  /organizations/:id/members        メンバー一覧
 * - GET  /organizations/:id/assets         資産一覧
 * - GET  /organizations/:id/settings       台帳設定画面のデータ
 *
 * :id は Ledger の political_organizations.id（Hub 上の団体情報の更新は PUT /hub-organizations/:id）。
 *
 * 政治団体台帳 = ledgers(ledger_type = 'political_fund', organization_id -> political_organizations.id)。
 * 政治団体のマスタは Hub が持ち、Ledger の political_organizations は hub_organization_id だけを持つ。
 * 台帳の構造（政治団体・台帳）はユーザーが直接書き込めないため、
 * 作成は Hub で認証済みの団体管理者であることを確認した後に service client で行う。
 */

import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission } from "@polimoney-ledger/shared/permissions.ts";
import type { AppEnv } from "../lib/types.ts";
import { httpError } from "../lib/errors.ts";
import { requireLedgerPermission } from "../lib/authz.ts";
import { getServiceClient } from "../lib/supabase.ts";
import {
  createOrganizationManagerVerification,
  getManagedOrganizations,
  getOrganizationManagerVerificationsByUser,
  getOrganizations,
  type PoliticalFundReportInfo,
  resolvePoliticianOrganization,
  sendOrganizationManagerVerificationCode,
  verifyOrganizationManagerDns,
  verifyOrganizationManagerEmail,
} from "../lib/hub-client.ts";
import {
  deleteRowsQuietly,
  fetchAccountCodes,
  fetchLedgerAssets,
  fetchLedgerContacts,
  fetchLedgerJournals,
  fetchLedgerMembers,
  fetchLedgerSubAccounts,
} from "../lib/ledger-data.ts";
import { hubLinkErrorResponse } from "../lib/hub-ledger.ts";
import {
  applyHubUnlock,
  type ClosureUnlockState,
} from "../lib/year-closure.ts";

export const organizationsRouter = new Hono<AppEnv>();

// ============================================
// 内部ヘルパー
// ============================================

interface OrganizationListItem {
  id: string;
  name: string;
  created_at: string;
}

/** 政治団体行を取得する（見つからなければ 404） */
async function getOrganizationOr404<T>(
  supabase: SupabaseClient,
  organizationId: string,
  columns: string,
): Promise<T> {
  const { data, error } = await supabase
    .from("political_organizations")
    .select(columns)
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw httpError(404, "政治団体が見つかりません");
  }
  return data as T;
}

// ============================================
// ルート（静的パスを /:id より先に登録する）
// ============================================

// GET /organizations - 政治団体台帳一覧（自分がオーナー、またはメンバーの台帳）
// ledgers の RLS（オーナーまたはメンバー）で見える政治団体台帳から政治団体を取り出す
organizationsRouter.get("/", async (c) => {
  const { data, error } = await c.get("supabase")
    .from("ledgers")
    .select("political_organizations ( id, name, created_at )")
    .eq("ledger_type", "political_fund");
  if (error) {
    console.error("Failed to fetch organization ledgers:", error);
    return c.json({ error: "政治団体台帳の取得に失敗しました" }, 500);
  }

  const organizations = new Map<string, OrganizationListItem>();
  for (
    const ledger of (data ?? []) as unknown as Array<{
      political_organizations:
        | OrganizationListItem
        | OrganizationListItem[]
        | null;
    }>
  ) {
    const o = Array.isArray(ledger.political_organizations)
      ? ledger.political_organizations[0]
      : ledger.political_organizations;
    if (o && !organizations.has(o.id)) organizations.set(o.id, o);
  }

  const list = [...organizations.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return c.json({ organizations: list });
});

// POST /organizations - 政治団体台帳の作成
// 政治団体 -> 台帳 の順に作成する（オーナーの admin メンバー登録は DB トリガー trg_ledger_auto_member）。
// Hub 同期に使う 政治家×政治団体 の紐付け（団体の代表者との紐付け）を Hub から取得し、
// ledgers.hub_politician_organization_id に保存する。紐付けが無い団体は台帳を作成できない。
organizationsRouter.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    name?: string;
    hub_organization_id?: string;
  }>().catch(() => null);
  if (!body) {
    return c.json({ error: "リクエストの形式が正しくありません" }, 400);
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json({ error: "政治団体名は必須です" }, 400);
  }
  if (!body.hub_organization_id) {
    return c.json({ error: "政治団体の選択は必須です" }, 400);
  }

  // Hub で認証済みの団体管理者のみ作成できる
  let managed;
  try {
    managed = await getManagedOrganizations(userId);
  } catch (error) {
    console.error("Failed to fetch managed organizations:", error);
    return c.json(
      {
        error:
          "団体管理者の認証状態を確認できませんでした。時間をおいて再度お試しください",
      },
      503,
    );
  }
  const hubOrganization = managed.find((o) =>
    o.id === body.hub_organization_id
  );
  if (!hubOrganization) {
    return c.json(
      { error: "認証済みの管理者である政治団体のみ台帳を作成できます" },
      403,
    );
  }

  // Hub 同期に使う紐付け（代表者との politician_organizations）を取得する
  let hubLink;
  try {
    hubLink = await resolvePoliticianOrganization({
      ledgerUserId: userId,
      organizationId: hubOrganization.id,
    });
  } catch (error) {
    return hubLinkErrorResponse(c, error, "政治団体");
  }

  // 上で Hub の管理者認証を確認したうえで service client で作成する
  // （hub_organization_id は Hub で確認した値のみ）
  const svc = getServiceClient();
  let organizationId: string | null = null;
  let ledgerId: string | null = null;

  try {
    const { data: organization, error: orgError } = await svc
      .from("political_organizations")
      .insert({
        owner_user_id: userId,
        name,
        hub_organization_id: hubOrganization.id,
      })
      .select("id")
      .single();
    if (orgError) throw orgError;
    organizationId = organization.id as string;

    const { data: ledger, error: ledgerError } = await svc
      .from("ledgers")
      .insert({
        owner_user_id: userId,
        ledger_type: "political_fund",
        organization_id: organizationId,
        hub_politician_organization_id: hubLink.id,
      })
      .select("id")
      .single();
    if (ledgerError) throw ledgerError;
    ledgerId = ledger.id as string;

    return c.json({ success: true, organization_id: organizationId }, 201);
  } catch (error) {
    console.error("Failed to create organization ledger:", error);
    await deleteRowsQuietly(svc, [
      { table: "ledger_members", column: "ledger_id", id: ledgerId },
      { table: "ledgers", id: ledgerId },
      { table: "political_organizations", id: organizationId },
    ]);
    return c.json({ error: "政治団体台帳の作成に失敗しました" }, 500);
  }
});

// GET /organizations/manager-verify - 団体管理者認証画面の初期データ
organizationsRouter.get("/manager-verify", async (c) => {
  const userId = c.get("userId");

  const [
    managedOrganizations,
    organizationManagerVerifications,
    hubOrganizations,
  ] = await Promise.all([
    getManagedOrganizations(userId).catch((error) => {
      console.error("Failed to fetch managed organizations:", error);
      return [];
    }),
    getOrganizationManagerVerificationsByUser(userId).catch((error) => {
      console.error("Failed to fetch manager verifications:", error);
      return [];
    }),
    getOrganizations({ userId }).catch((error) => {
      console.error("Failed to fetch organizations from Hub:", error);
      return [];
    }),
  ]);

  return c.json({
    userId,
    userEmail: c.get("user").email ?? "",
    managedOrganizations,
    organizationManagerVerifications,
    hubOrganizations,
  });
});

// POST /organizations/manager-verify - 団体管理者認証の申請
organizationsRouter.post("/manager-verify", async (c) => {
  const userId = c.get("userId");

  try {
    const body = await c.req.json<{
      organization_id?: string;
      organization_name: string;
      organization_type?: string;
      official_email: string;
      role_in_organization?: string;
      request_type?: "new" | "domain_change";
      previous_domain?: string;
      political_fund_report_info: PoliticalFundReportInfo;
    }>();

    const result = await createOrganizationManagerVerification({
      ledger_user_id: userId,
      ledger_user_email: c.get("user").email ?? "",
      organization_id: body.organization_id,
      organization_name: body.organization_name,
      organization_type: body.organization_type,
      official_email: body.official_email,
      role_in_organization: body.role_in_organization,
      request_type: body.request_type,
      previous_domain: body.previous_domain,
      political_fund_report_info: body.political_fund_report_info,
    });

    return c.json({ data: result }, 201);
  } catch (error) {
    console.error("Error creating organization manager verification:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "申請に失敗しました" },
      500,
    );
  }
});

// POST /organizations/manager-verify/:id/send-code - 認証コード送信
organizationsRouter.post("/manager-verify/:id/send-code", async (c) => {
  const userId = c.get("userId");
  const verificationId = c.req.param("id");

  try {
    const result = await sendOrganizationManagerVerificationCode(
      verificationId,
      { userId },
    );
    return c.json(result);
  } catch (error) {
    console.error("Error sending verification code:", error);
    return c.json(
      {
        error: error instanceof Error
          ? error.message
          : "コード送信に失敗しました",
      },
      500,
    );
  }
});

// POST /organizations/manager-verify/:id/verify-code - 認証コード確認
organizationsRouter.post("/manager-verify/:id/verify-code", async (c) => {
  const userId = c.get("userId");
  const verificationId = c.req.param("id");

  try {
    const body = await c.req.json<{ code: string }>();

    if (!body.code) {
      return c.json({ error: "認証コードは必須です" }, 400);
    }

    const result = await verifyOrganizationManagerEmail(
      verificationId,
      body.code,
      { userId },
    );
    return c.json(result);
  } catch (error) {
    console.error("Error verifying code:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "認証に失敗しました" },
      500,
    );
  }
});

// POST /organizations/manager-verify/:id/verify-dns - DNS TXT 認証確認
organizationsRouter.post("/manager-verify/:id/verify-dns", async (c) => {
  const userId = c.get("userId");
  const verificationId = c.req.param("id");

  try {
    const result = await verifyOrganizationManagerDns(verificationId, {
      userId,
    });
    return c.json(result);
  } catch (error) {
    console.error("Error verifying DNS TXT:", error);
    return c.json(
      {
        error: error instanceof Error
          ? error.message
          : "DNS TXT認証に失敗しました",
      },
      500,
    );
  }
});

// GET /organizations/:id/ledger?year= - 政治団体台帳のデータ
organizationsRouter.get("/:id/ledger", async (c) => {
  const organizationId = c.req.param("id");
  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "viewLedger",
  );
  const supabase = c.get("supabase");

  const thisYear = new Date().getFullYear();
  const yearParam = c.req.query("year");
  const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : NaN;
  const selectedYear = Number.isFinite(parsedYear) ? parsedYear : thisYear;

  const organization = await getOrganizationOr404<{ id: string; name: string }>(
    supabase,
    organizationId,
    "id, name",
  );

  try {
    const [
      journals,
      contacts,
      subAccounts,
      accountCodes,
      closuresResult,
      journalDatesResult,
    ] = await Promise.all([
      fetchLedgerJournals(supabase, access.ledgerId, selectedYear),
      fetchLedgerContacts(supabase, access.ledgerId, access.ownerUserId),
      fetchLedgerSubAccounts(supabase, access, "political_organization"),
      fetchAccountCodes("organization", c.get("userId")),
      supabase
        .from("ledger_year_closures")
        .select(
          "fiscal_year, status, closed_at, unlock_request_id, unlock_expires_at",
        )
        .eq("ledger_id", access.ledgerId),
      supabase
        .from("journals")
        .select("journal_date")
        .eq("ledger_id", access.ledgerId),
    ]);
    if (closuresResult.error) throw closuresResult.error;
    if (journalDatesResult.error) throw journalDatesResult.error;

    // 年度リスト: 今年から過去 5 年 + 仕訳が存在する年度（降順）
    const years = new Set<number>(
      Array.from({ length: 5 }, (_, i) => thisYear - i),
    );
    for (
      const j of (journalDatesResult.data ?? []) as Array<
        { journal_date: string | null }
      >
    ) {
      if (j.journal_date) {
        years.add(Number.parseInt(j.journal_date.slice(0, 4), 10));
      }
    }

    // アーカイブ済み・一時解除中の年度は、Hub のロック解除の承認・期限切れを反映してから返す
    const closureStatuses = await Promise.all(
      (
        (closuresResult.data ?? []) as Array<
          ClosureUnlockState & { closed_at: string | null }
        >
      ).map(async (row) => ({
        fiscal_year: row.fiscal_year,
        status: await applyHubUnlock(access.ledgerId, access.ownerUserId, row),
        closed_at: row.closed_at ?? undefined,
      })),
    );

    return c.json({
      organization,
      journals,
      accountCodes,
      contacts,
      subAccounts,
      years: [...years].sort((a, b) => b - a),
      currentYear: selectedYear,
      closureStatuses,
      ledgerId: access.ledgerId,
      // 画面の操作可否（仕訳の即時登録など）を決めるためのロール
      myRole: access.role,
    });
  } catch (error) {
    console.error("Failed to fetch organization ledger:", error);
    return c.json({ error: "台帳データの取得に失敗しました" }, 500);
  }
});

// GET /organizations/:id/members - 政治団体台帳のメンバー一覧
organizationsRouter.get("/:id/members", async (c) => {
  const organizationId = c.req.param("id");
  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "viewLedger",
  );

  const organization = await getOrganizationOr404<{ name: string }>(
    c.get("supabase"),
    organizationId,
    "name",
  );

  try {
    const members = await fetchLedgerMembers(c, access);
    return c.json({
      organization,
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

// GET /organizations/:id/assets - 政治団体台帳の資産一覧
organizationsRouter.get("/:id/assets", async (c) => {
  const organizationId = c.req.param("id");
  const access = await requireLedgerPermission(
    c,
    { organizationId },
    "viewLedger",
  );
  const supabase = c.get("supabase");

  const organization = await getOrganizationOr404<{ name: string }>(
    supabase,
    organizationId,
    "name",
  );

  try {
    const assets = await fetchLedgerAssets(supabase, access.ledgerId);
    return c.json({ organization, assets });
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return c.json({ error: "資産一覧の取得に失敗しました" }, 500);
  }
});

// GET /organizations/:id/settings - 台帳設定画面のデータ
organizationsRouter.get("/:id/settings", async (c) => {
  const organizationId = c.req.param("id");
  await requireLedgerPermission(
    c,
    { organizationId },
    "editLedgerSettings",
  );

  const organization = await getOrganizationOr404<{
    id: string;
    name: string;
    hub_organization_id: string | null;
  }>(c.get("supabase"), organizationId, "id, name, hub_organization_id");

  // Hub 上の団体情報は、自分が認証済み管理者である場合のみ返す（編集フォーム用）。
  // Hub に接続できなくても Ledger 側の設定は表示できるよう、失敗時は null にする
  let hubOrganization = null;
  if (organization.hub_organization_id) {
    const managed = await getManagedOrganizations(c.get("userId")).catch(
      (error) => {
        console.error("Failed to fetch managed organizations:", error);
        return [];
      },
    );
    const found = managed.find((o) =>
      o.id === organization.hub_organization_id
    );
    if (found) {
      hubOrganization = {
        id: found.id,
        name: found.name,
        type: found.type,
        official_url: found.official_url,
        registration_authority: found.registration_authority,
        established_date: found.established_date,
        office_address: found.office_address,
        representative_name: found.representative_name,
        accountant_name: found.accountant_name,
        contact_email: found.contact_email,
        description: found.description,
        sns_x: found.sns_x,
        sns_instagram: found.sns_instagram,
        sns_facebook: found.sns_facebook,
        sns_tiktok: found.sns_tiktok,
        manager_verified_at: found.manager_verified_at,
        manager_verified_domain: found.manager_verified_domain,
      };
    }
  }

  return c.json({ organization, hubOrganization });
});
