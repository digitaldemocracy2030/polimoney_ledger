/**
 * プロフィール API
 *
 * GET /profile                    - プロフィール取得（Auth の表示名）
 * PUT /profile                    - 表示名の更新
 * GET /profile/politician         - 認証済み政治家の情報（Hub）
 * PUT /profile/politician         - 認証済み政治家の情報を更新（Hub）
 * GET /profile/organization       - 管理している政治団体の一覧（Hub）
 * GET /profile/organization/:id   - 管理している政治団体の詳細（Hub）
 *
 * 政治家・政治団体のマスタは Hub が唯一の情報源なので、Ledger の DB は使わない。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import {
  getManagedOrganizations,
  getOrganization,
  getVerifiedPoliticianByUserId,
  HubApiError,
  type Organization,
  updatePolitician,
  type UpdatePoliticianInput,
} from "../lib/hub-client.ts";
import { getDisplayName, updateOwnAuthUser } from "../lib/auth-user.ts";

export const profileRouter = new Hono<AppEnv>();

/** PUT /profile/politician で受け付けるフィールド */
const POLITICIAN_FIELDS = [
  "name",
  "name_kana",
  "official_url",
  "party",
  "photo_url",
  "sns_x",
  "sns_instagram",
  "sns_facebook",
  "sns_tiktok",
] as const satisfies readonly (keyof UpdatePoliticianInput)[];

// GET /profile - プロフィール取得
profileRouter.get("/", (c) => {
  const user = c.get("user");
  return c.json({
    data: {
      id: user.id,
      email: user.email ?? "",
      display_name: getDisplayName(user),
    },
  });
});

// PUT /profile - 表示名の更新（Supabase Auth の user_metadata）
profileRouter.put("/", async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as
      | { display_name?: unknown }
      | null;
    const displayName = typeof body?.display_name === "string"
      ? body.display_name.trim()
      : "";

    if (!displayName) {
      return c.json({ error: "表示名は必須です" }, 400);
    }

    // Supabase Auth Dashboard で "Display name" として表示されるのは full_name。
    // 旧データとの互換のため display_name も同じ値にそろえる。
    const result = await updateOwnAuthUser(c.get("accessToken"), {
      data: { full_name: displayName, display_name: displayName },
    });

    if (!result.ok) {
      console.error(
        "Failed to update profile:",
        result.status,
        result.message,
      );
      return c.json({ error: "プロフィールの更新に失敗しました" }, 500);
    }

    const updatedDisplayName = getDisplayName(result.user);
    return c.json({
      success: true,
      displayName: updatedDisplayName,
      data: {
        id: result.user.id,
        email: result.user.email ?? "",
        display_name: updatedDisplayName,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// GET /profile/politician - 認証済み政治家の情報（未認証なら null）
profileRouter.get("/politician", async (c) => {
  try {
    const politician = await getVerifiedPoliticianByUserId(c.get("userId"));
    return c.json({ politician });
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error fetching politician profile:", error);
    return c.json({ error: "政治家プロフィールの取得に失敗しました" }, 500);
  }
});

// PUT /profile/politician - 認証済み政治家の情報を更新
profileRouter.put("/politician", async (c) => {
  const userId = c.get("userId");

  try {
    // 本人に紐づく認証済み政治家のみ更新できる
    const politician = await getVerifiedPoliticianByUserId(userId);
    if (!politician) {
      return c.json({ error: "認証済みの政治家が見つかりません" }, 404);
    }

    const body = await c.req.json().catch(() => null) as
      | Record<string, unknown>
      | null;
    if (!body || typeof body !== "object") {
      return c.json({ error: "リクエストの形式が正しくありません" }, 400);
    }

    // 受け付けるフィールドだけを取り出す（空文字は null として扱う）
    const input: UpdatePoliticianInput = {};
    for (const field of POLITICIAN_FIELDS) {
      if (!(field in body)) continue;
      const value = body[field];
      if (value === null || value === undefined) {
        if (field !== "name") input[field] = null;
        continue;
      }
      if (typeof value !== "string") {
        return c.json({ error: "リクエストの形式が正しくありません" }, 400);
      }
      const trimmed = value.trim();
      if (field === "name") {
        input.name = trimmed;
      } else {
        input[field] = trimmed === "" ? null : trimmed;
      }
    }

    // バリデーション
    if (!input.name) {
      return c.json({ error: "氏名は必須です" }, 400);
    }

    // Hub の政治家情報を更新
    const updated = await updatePolitician(politician.id, input, { userId });

    return c.json({ success: true, data: updated });
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error updating politician profile:", error);
    return c.json({ error: "政治家プロフィールの更新に失敗しました" }, 500);
  }
});

// GET /profile/organization - 管理している政治団体の一覧
profileRouter.get("/organization", async (c) => {
  try {
    const managedOrganizations = await getManagedOrganizations(
      c.get("userId"),
    );
    return c.json({ managedOrganizations });
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error fetching managed organizations:", error);
    return c.json({ error: "政治団体一覧の取得に失敗しました" }, 500);
  }
});

// GET /profile/organization/:id - 管理している政治団体の詳細
profileRouter.get("/organization/:id", async (c) => {
  const userId = c.get("userId");
  const organizationId = c.req.param("id");

  try {
    // 管理権限があるかチェック（Hub の organization_managers）
    const managedOrgs = await getManagedOrganizations(userId);
    const managedOrg = managedOrgs.find((org) => org.id === organizationId);
    const isManager = !!managedOrg;
    const verifiedDomain = managedOrg?.manager_verified_domain || null;

    // 管理者の場合のみ政治団体情報を返す
    let organization: Organization | null = null;
    if (isManager) {
      try {
        organization = await getOrganization(organizationId, { userId });
      } catch (error) {
        console.error("Failed to fetch organization from Hub:", error);
        organization = null;
      }
    }

    return c.json({ organization, isManager, verifiedDomain });
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error fetching organization profile:", error);
    return c.json({ error: "政治団体情報の取得に失敗しました" }, 500);
  }
});
