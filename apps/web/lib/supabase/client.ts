/**
 * ブラウザ用 Supabase クライアント
 *
 * Web アプリで Supabase を使うのは認証（ログイン・登録・ログアウト・トークン更新・
 * パスワード再設定）だけ。データの読み書きはすべて Ledger API（lib/api-client.ts）を使う。
 * セッションは @supabase/ssr により Cookie に保存され、proxy.ts からも読める。
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が設定されていません',
      );
    }
    _client = createBrowserClient(url, key);
  }
  return _client;
}
