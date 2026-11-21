/**
 * 認証まわりの共通処理（ブラウザ専用）
 *
 * - ログアウト: supabase.auth.signOut() → /login
 * - オンボーディング: 利用規約・プライバシーポリシーへの同意を Ledger API に記録
 * - ログイン後の遷移先決定: GET /v1/me を見て、未同意なら /onboarding へ
 */

import { apiFetch, apiJson } from '../api-client';
import { getSupabaseBrowserClient } from './client';

/** GET /v1/me のうち、認証フローで使う項目 */
export interface MeSummary {
  id: string;
  email: string;
  registrationStatus: string | null;
  needsOnboarding: boolean;
}

/** ログアウトしてログイン画面へ遷移する */
export async function signOutAndRedirect(): Promise<void> {
  try {
    await getSupabaseBrowserClient().auth.signOut();
  } catch (e) {
    console.error('Sign out failed:', e);
  }
  window.location.href = '/login';
}

/** 利用規約・プライバシーポリシーへの同意を記録する（POST /v1/me/onboarding） */
export async function completeOnboarding(): Promise<void> {
  await apiJson('/v1/me/onboarding', {
    method: 'POST',
    body: JSON.stringify({ tosAccepted: true, privacyPolicyAccepted: true }),
  });
}

/**
 * 同一オリジン内の相対パスだけを遷移先として許可する（オープンリダイレクト対策）
 *
 * - '/' で始まり、2 文字目が '/' や '\' でないこと（'//evil.com' や '/\evil.com' を拒否）
 * - バックスラッシュ・空白・制御文字を含まないこと（ブラウザは '\' を '/' と同じに扱う）
 * - 念のため URL として解釈し、オリジンが変わらないことを確認する
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!value || !/^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(value)) {
    return fallback;
  }
  const base = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost';
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * セッション確立後の遷移先を決める。
 * 利用規約などに未同意なら /onboarding、審査待ちなら /pending-review、それ以外は redirectTo。
 */
export async function resolvePostLoginPath(redirectTo: string): Promise<string> {
  const res = await apiFetch('/v1/me');
  if (!res.ok) {
    throw new Error('ユーザー情報の取得に失敗しました');
  }
  const me = (await res.json()) as MeSummary;
  if (me.registrationStatus === 'pending_review') return '/pending-review';
  if (me.needsOnboarding) {
    return `/onboarding?redirect=${encodeURIComponent(redirectTo)}`;
  }
  return redirectTo;
}
