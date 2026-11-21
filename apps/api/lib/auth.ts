/**
 * 認証ミドルウェア
 *
 * `Authorization: Bearer <Supabase のアクセストークン>` を検証し、
 * c.var に userId / user / accessToken / supabase（ユーザーの JWT 付きクライアント）を設定する。
 */

import { createMiddleware } from "hono/factory";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "./types.ts";
import {
  createUserClient,
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "./supabase.ts";

let _authClient: SupabaseClient | null = null;

/** トークン検証用のクライアント（セッションを持たない） */
function getAuthClient(): SupabaseClient {
  if (!_authClient) {
    _authClient = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _authClient;
}

/** Authorization ヘッダーから Bearer トークンを取り出す */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 認証必須ミドルウェア
 * トークンが無い・無効な場合は 401 { error } を返す。
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  const { data, error } = await getAuthClient().auth.getUser(token);
  if (error || !data.user) {
    return c.json(
      { error: "認証の有効期限が切れたか、無効なトークンです" },
      401,
    );
  }

  c.set("userId", data.user.id);
  c.set("user", data.user);
  c.set("accessToken", token);
  c.set("supabase", createUserClient(token));

  await next();
});
