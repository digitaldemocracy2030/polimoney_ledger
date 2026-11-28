/**
 * /v1/managed-organizations API
 *
 * ログインユーザーが Hub 上で「団体管理者」として認証済みの政治団体一覧を返す。
 * Hub の organization_managers を参照するため、Ledger DB へのアクセスは行わない。
 * userId は requireAuth で検証済みの JWT から取得するため、他人の一覧は取得できない。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import { getManagedOrganizations, HubApiError } from "../lib/hub-client.ts";

export const managedOrganizationsRouter = new Hono<AppEnv>();

// GET /v1/managed-organizations
managedOrganizationsRouter.get("/", async (c) => {
  const userId = c.get("userId");

  try {
    const managed = await getManagedOrganizations(userId);

    // Hub のフィールド名 (manager_verified_at / manager_verified_domain) を
    // フロントエンドの期待する verified_at / verified_domain に変換する
    const organizations = managed.map((org) => ({
      id: org.id,
      name: org.name,
      type: org.type,
      verified_at: org.manager_verified_at,
      verified_domain: org.manager_verified_domain,
    }));

    return c.json({ organizations });
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Failed to fetch managed organizations:", error);
    return c.json({ error: "管理している政治団体の取得に失敗しました" }, 500);
  }
});
