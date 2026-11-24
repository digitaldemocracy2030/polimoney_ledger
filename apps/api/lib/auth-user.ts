/**
 * 本人の Supabase Auth ユーザー情報のヘルパー
 *
 * - getDisplayName: user_metadata から表示名を取り出す
 * - updateOwnAuthUser: 本人のアクセストークンで GoTrue の PUT /auth/v1/user を呼ぶ
 */

import type { User } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./supabase.ts";

/** Supabase Auth の user_metadata から表示名を取り出す */
export function getDisplayName(user: User): string {
  const meta = user.user_metadata ?? {};
  return (meta.display_name as string | undefined) ||
    (meta.full_name as string | undefined) || "";
}

/** GoTrue の PUT /auth/v1/user に渡す属性 */
interface UpdateOwnUserAttributes {
  email?: string;
  data?: Record<string, unknown>;
}

/** updateOwnAuthUser の結果 */
type UpdateOwnUserResult =
  | { ok: true; user: User }
  | { ok: false; status: number; message: string };

/**
 * リクエストしたユーザー本人の Auth 情報を、本人のアクセストークンで更新する。
 *
 * supabase-js の auth.updateUser はクライアント内のセッションが必要なため、
 * サーバー側では GoTrue の REST API（PUT /auth/v1/user）を直接呼ぶ。
 * 本人のトークンで呼ぶので service_role は使わない。
 * メールアドレス変更は Supabase の設定に従い確認メールが送信される。
 */
export async function updateOwnAuthUser(
  accessToken: string,
  attributes: UpdateOwnUserAttributes,
): Promise<UpdateOwnUserResult> {
  const res = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: getSupabasePublishableKey(),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(attributes),
  });

  const json = await res.json().catch(() => null) as
    | (User & { msg?: string; message?: string; error_description?: string })
    | null;

  if (!res.ok || !json) {
    const message = json?.msg || json?.message || json?.error_description ||
      `HTTP ${res.status}`;
    return { ok: false, status: res.status, message };
  }
  return { ok: true, user: json };
}
