/**
 * Hub 政治団体情報取得 API
 *
 * - GET /hub-organizations/:id  Hub の政治団体の公開情報を取得する
 *   （関係者登録時に Hub の政治団体 ID から名称・住所等を補完するために使用）
 * - PUT /hub-organizations/:id  Hub 上の政治団体情報を更新する（Hub で認証済みの団体管理者のみ）
 *
 * :id は Hub の政治団体 ID。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import {
  getManagedOrganizations,
  getOrganization,
  isHubNotFound,
  updateOrganization,
  type UpdateOrganizationInput,
} from "../lib/hub-client.ts";

export const hubOrganizationsRouter = new Hono<AppEnv>();

/** PUT で更新できる Hub の政治団体フィールド */
const UPDATABLE_HUB_ORGANIZATION_FIELDS = [
  "name",
  "type",
  "official_url",
  "registration_authority",
  "established_date",
  "office_address",
  "representative_name",
  "accountant_name",
  "contact_email",
  "description",
  "sns_x",
  "sns_instagram",
  "sns_facebook",
  "sns_tiktok",
  "logo_url",
] as const satisfies readonly (keyof UpdateOrganizationInput)[];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /hub-organizations/:id - Hub から政治団体情報を取得
hubOrganizationsRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  // UUID 形式チェック
  if (!UUID_REGEX.test(id)) {
    return c.json({ error: "無効な政治団体IDです" }, 400);
  }

  try {
    // テストユーザーの場合は hub-client 側で DEV キーが使われる
    const org = await getOrganization(id, { userId });
    if (!org) {
      return c.json({ error: "政治団体が見つかりません" }, 404);
    }

    // 必要な情報のみ返す
    return c.json({
      data: {
        id: org.id,
        name: org.name,
        type: org.type,
        office_address: org.office_address ?? null,
        official_url: org.official_url ?? null,
        representative_name: org.representative_name ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching organization from Hub:", error);
    if (isHubNotFound(error)) {
      return c.json({ error: "政治団体が見つかりません" }, 404);
    }
    return c.json({ error: "政治団体情報の取得に失敗しました" }, 502);
  }
});

// PUT /hub-organizations/:id - Hub 上の政治団体情報を更新
hubOrganizationsRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const hubOrganizationId = c.req.param("id");

  if (!UUID_REGEX.test(hubOrganizationId)) {
    return c.json({ error: "無効な政治団体IDです" }, 400);
  }

  // Hub で認証済みの団体管理者のみ更新できる
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
  if (!managed.some((o) => o.id === hubOrganizationId)) {
    return c.json({ error: "この政治団体を編集する権限がありません" }, 403);
  }

  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "リクエストの形式が正しくありません" }, 400);
  }

  const input: Record<string, unknown> = {};
  for (const field of UPDATABLE_HUB_ORGANIZATION_FIELDS) {
    if (field in body) input[field] = body[field];
  }
  if (typeof input.name === "string" && !input.name.trim()) {
    return c.json({ error: "政治団体名は必須です" }, 400);
  }

  try {
    const data = await updateOrganization(
      hubOrganizationId,
      input as UpdateOrganizationInput,
      { userId },
    );
    return c.json({ data });
  } catch (error) {
    console.error("Failed to update organization on Hub:", error);
    return c.json({ error: "政治団体の更新に失敗しました" }, 502);
  }
});
