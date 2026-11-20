import { api } from '@/src/api';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getUserId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const apiPath = url.pathname.replace(/^\/api/, '') || '/';
  const honoUrl = new URL(apiPath + url.search, url.origin);

  const honoReq = new Request(honoUrl.toString(), {
    method: req.method,
    headers: new Headers(req.headers),
    body: req.body,
  });

  const userId = await getUserId();
  if (userId) {
    honoReq.headers.set('X-User-Id', userId);
  }

  return api.fetch(honoReq);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
