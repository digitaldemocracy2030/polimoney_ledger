/**
 * Supabase クライアント（Ledger API 用）
 *
 * - createUserClient: リクエストごとにユーザーの JWT を付けたクライアント（RLS が効く）
 * - getServiceClient: service_role クライアント（RLS をバイパス）
 *
 * ⚠️ getServiceClient は特権処理（auth.admin 呼び出し、他ユーザーにまたがる操作、
 *    Hub 同期の記録、RLS で表現できない Storage 操作など）でのみ使うこと。
 *    使う前に必ず lib/authz.ts のヘルパーで権限を確認する。
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================
// 環境変数
// ============================================

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return requireEnv("SUPABASE_PUBLISHABLE_KEY");
}

// ============================================
// クライアント
// ============================================

let _serviceClient: SupabaseClient | null = null;

/**
 * サービスクライアント（service_role key, 遅延初期化）
 * RLS をバイパスする。lib/authz.ts で権限確認をした後にのみ使用すること。
 */
export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      getSupabaseUrl(),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _serviceClient;
}

/**
 * ユーザーの JWT 付きクライアントを作成する（RLS がそのユーザーとして適用される）
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
