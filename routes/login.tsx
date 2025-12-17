import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

interface LoginData {
  error?: string;
  redirect?: string;
}

export const handler: Handlers<LoginData> = {
  GET(req, ctx) {
    const url = new URL(req.url);
    const redirect = url.searchParams.get("redirect") || "/";
    return ctx.render({ redirect });
  },

  async POST(req, ctx) {
    const form = await req.formData();
    const email = form.get("email")?.toString() || "";
    const password = form.get("password")?.toString() || "";
    const redirect = form.get("redirect")?.toString() || "/";

    if (!email || !password) {
      return ctx.render({ error: "メールアドレスとパスワードを入力してください", redirect });
    }

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return ctx.render({ error: "Supabase が設定されていません", redirect });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return ctx.render({ error: error.message, redirect });
    }

    if (!data.session) {
      return ctx.render({ error: "ログインに失敗しました", redirect });
    }

    // Cookie にトークンをセット
    const headers = new Headers();
    headers.set("Location", redirect);

    setCookie(headers, {
      name: "sb-access-token",
      value: data.session.access_token,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 3600, // 1時間
    });

    setCookie(headers, {
      name: "sb-refresh-token",
      value: data.session.refresh_token,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 604800, // 7日
    });

    return new Response(null, { status: 302, headers });
  },
};

export default function LoginPage({ data }: PageProps<LoginData>) {
  return (
    <>
      <Head>
        <title>ログイン - Polimoney Ledger</title>
        <link href="/static/styles.css" rel="stylesheet" />
      </Head>
      <div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div class="card w-full max-w-md bg-base-100 shadow-xl">
          <div class="card-body">
            <div class="text-center mb-6">
              <span class="text-5xl">📒</span>
              <h1 class="text-2xl font-bold mt-2">Polimoney Ledger</h1>
              <p class="text-base-content/60 mt-1">ログインしてください</p>
            </div>

            {data?.error && (
              <div class="alert alert-error mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{data.error}</span>
              </div>
            )}

            <form method="POST" class="space-y-4">
              <input type="hidden" name="redirect" value={data?.redirect || "/"} />

              <div class="form-control">
                <label class="label">
                  <span class="label-text">メールアドレス</span>
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="email@example.com"
                  class="input input-bordered w-full"
                  required
                />
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">パスワード</span>
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="パスワード"
                  class="input input-bordered w-full"
                  required
                />
              </div>

              <button type="submit" class="btn btn-primary w-full">
                ログイン
              </button>
            </form>

            <div class="divider">または</div>

            <div class="text-center">
              <p class="text-sm text-base-content/60">
                アカウントをお持ちでない場合は
              </p>
              <a href="/register" class="link link-primary">
                新規登録
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
