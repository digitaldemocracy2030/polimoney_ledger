/**
 * Ledger API の Hono 型定義
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

/** 全ルーターで使う Hono の Env 型（new Hono<AppEnv>()） */
export type AppEnv = {
  Variables: {
    /** 認証済みユーザーの ID（auth.users.id） */
    userId: string;
    /** 認証済みユーザー（Supabase Auth） */
    user: User;
    /** リクエストの Bearer トークン（Supabase のアクセストークン） */
    accessToken: string;
    /** ユーザーの JWT 付きクライアント（RLS が効く） */
    supabase: SupabaseClient;
  };
};
