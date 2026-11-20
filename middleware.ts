import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS_EXACT = ['/welcome', '/privacy', '/terms'];
const PUBLIC_PATHS_PREFIX = ['/login', '/register', '/pending-review'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS_EXACT.includes(pathname)) return true;
  return PUBLIC_PATHS_PREFIX.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();
  if (pathname.startsWith('/api')) return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
    );
  }

  // 審査待ちチェック
  const registrationStatus = user.user_metadata?.registration_status;
  if (registrationStatus === 'pending_review' && !pathname.startsWith('/pending-review')) {
    return NextResponse.redirect(new URL('/pending-review', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
