/**
 * ページのルーティングだけを行う proxy（Next.js 16 で middleware から改名。Node.js ランタイムで動く）
 *
 * - 未ログイン → /login?redirect=...
 *
 * データの取得・認可は Ledger API 側で行う。ここではセッション Cookie の確認
 * （必要ならトークン更新して Cookie を書き戻す）だけを行う。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS_EXACT = ['/welcome', '/privacy', '/terms', '/logout'];
const PUBLIC_PATHS_PREFIX = [
  '/login',
  '/register',
  '/auth/callback',
  '/forgot-password',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS_EXACT.includes(pathname)) return true;
  return PUBLIC_PATHS_PREFIX.some((p) => pathname.startsWith(p));
}

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

/** 更新されたセッション Cookie をリダイレクトのレスポンスにも引き継ぐ */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
    return redirectWithCookies(loginUrl, response);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
