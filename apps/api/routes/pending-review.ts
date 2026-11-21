/**
 * /v1/pending-review API
 *
 * 登録審査中ページ用の情報を返す。
 * - registrationStatus: app_metadata.registration_status（pending_review 以外なら Web 側で /dashboard へ遷移）
 *   app_metadata はユーザー自身が書き換えられない（service_role でのみ設定する）
 * - status / rejectionReason: Hub の登録申請ステータス（取得失敗時は空文字）
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import { checkRegistrationRequest } from "../lib/hub-client.ts";

export const pendingReviewRouter = new Hono<AppEnv>();

async function fetchHubRegistrationStatus(
  userId: string,
  email: string,
): Promise<{ status: string; rejectionReason: string }> {
  const empty = { status: "", rejectionReason: "" };
  if (!email) return empty;
  try {
    const result = await checkRegistrationRequest(email, { userId });
    return {
      status: result?.status ?? "",
      rejectionReason: result?.rejection_reason ?? "",
    };
  } catch (error) {
    // Hub への接続エラーは無視（審査中表示にフォールバック）
    console.error("[pending-review] Hub registration check failed:", error);
    return empty;
  }
}

// GET /v1/pending-review
pendingReviewRouter.get("/", async (c) => {
  const user = c.get("user");
  const userId = c.get("userId");
  const email = user.email ?? "";
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";
  const registrationStatus =
    (user.app_metadata?.registration_status as string | undefined) ?? "";

  // 審査中でなければ Hub への問い合わせは不要（Web 側でダッシュボードへ遷移）
  if (registrationStatus !== "pending_review") {
    return c.json({
      registrationStatus,
      email,
      fullName,
      status: "",
      rejectionReason: "",
    });
  }

  const { status, rejectionReason } = await fetchHubRegistrationStatus(
    userId,
    email,
  );

  return c.json({
    registrationStatus,
    email,
    fullName,
    status,
    rejectionReason,
  });
});
