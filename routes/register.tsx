import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

interface RegisterData {
  error?: string;
  success?: boolean;
  email?: string;
}

export const handler: Handlers<RegisterData> = {
  GET(_req, ctx) {
    return ctx.render({});
  },

  async POST(req, ctx) {
    const form = await req.formData();
    const email = form.get("email")?.toString() || "";
    const password = form.get("password")?.toString() || "";
    const confirmPassword = form.get("confirmPassword")?.toString() || "";
    const fullName = form.get("fullName")?.toString() || "";

    if (!email || !password || !fullName) {
      return ctx.render({ error: "すべての項目を入力してください" });
    }

    if (password !== confirmPassword) {
      return ctx.render({ error: "パスワードが一致しません" });
    }

    if (password.length < 8) {
      return ctx.render({ error: "パスワードは8文字以上で入力してください" });
    }

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return ctx.render({ error: "Supabase が設定されていません" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return ctx.render({ error: error.message });
    }

    return ctx.render({ success: true, email });
  },
};

export default function RegisterPage({ data }: PageProps<RegisterData>) {
  if (data?.success) {
    return (
      <>
        <Head>
          <title>登録完了 - Polimoney Ledger</title>
          <link href="/static/styles.css" rel="stylesheet" />
        </Head>
        <div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
          <div class="card w-full max-w-md bg-base-100 shadow-xl">
            <div class="card-body text-center">
              <div class="text-5xl mb-4">✉️</div>
              <h1 class="text-2xl font-bold">確認メールを送信しました</h1>
              <p class="text-base-content/60 mt-2">
                <strong>{data.email}</strong> 宛に確認メールを送信しました。
                メール内のリンクをクリックして、登録を完了してください。
              </p>
              <div class="mt-6">
                <a href="/login" class="btn btn-primary">
                  ログインページへ
                </a>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>新規登録 - Polimoney Ledger</title>
        <link href="/static/styles.css" rel="stylesheet" />
      </Head>
      <div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div class="card w-full max-w-md bg-base-100 shadow-xl">
          <div class="card-body">
            <div class="text-center mb-6">
              <span class="text-5xl">📒</span>
              <h1 class="text-2xl font-bold mt-2">Polimoney Ledger</h1>
              <p class="text-base-content/60 mt-1">新規アカウント登録</p>
            </div>

            {data?.error && (
              <div class="alert alert-error mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{data.error}</span>
              </div>
            )}

            <form method="POST" class="space-y-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">お名前</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="山田 太郎"
                  class="input input-bordered w-full"
                  required
                />
              </div>

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
                  <span class="label-text">パスワード（8文字以上）</span>
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="パスワード"
                  class="input input-bordered w-full"
                  minLength={8}
                  required
                />
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">パスワード（確認）</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="パスワード（確認）"
                  class="input input-bordered w-full"
                  minLength={8}
                  required
                />
              </div>

              <button type="submit" class="btn btn-primary w-full">
                登録する
              </button>
            </form>

            <div class="divider">または</div>

            <div class="text-center">
              <p class="text-sm text-base-content/60">
                すでにアカウントをお持ちの場合は
              </p>
              <a href="/login" class="link link-primary">
                ログイン
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
