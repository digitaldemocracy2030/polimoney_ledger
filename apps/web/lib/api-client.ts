/**
 * Ledger API クライアント
 *
 * - パスは '/v1/...' の形で渡す（例: apiFetch('/v1/contacts')）
 * - NEXT_PUBLIC_API_URL を前に付け、ブラウザの Supabase セッションのアクセストークンを
 *   `Authorization: Bearer <token>` として付ける
 * - body が FormData のときは Content-Type を付けない（ブラウザが boundary 付きで設定する）
 * - getSession() は期限切れ間近のアクセストークンを自動で更新するので、毎回呼び出し直前に取得する
 * - 401 が返った場合はセッション切れとみなしてログイン画面へ遷移する
 */

import { getSupabaseBrowserClient } from './supabase/client';

/**
 * 既定の API の URL。本番のビルド（next build）では本番の API、next dev ではローカルの API。
 * 別の環境を作るときは NEXT_PUBLIC_API_URL で上書きする（ビルド時に埋め込まれる）
 */
const DEFAULT_API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://ledger-api.polimoney.dd2030.org'
    : 'http://localhost:3723';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(
    /\/+$/,
    '',
  );
}

/** Ledger API を呼ぶ（fetch と同じく Response を返す） */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body != null && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    redirectToLogin();
  }
  return res;
}

/** 認証画面にいる間は 401 でも遷移しない（ログイン直後の確認などでループしないように） */
const AUTH_PATH_PREFIXES = [
  '/login',
  '/register',
  '/logout',
  '/auth',
  '/forgot-password',
];

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (AUTH_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return;
  const redirect = encodeURIComponent(`${pathname}${search}`);
  window.location.href = `/login?redirect=${redirect}`;
}

/** API のエラー（レスポンスの { error } を message に持つ） */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Ledger API を呼んで JSON を返す。2xx 以外は ApiError を throw する。
 */
export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `リクエストに失敗しました (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}
