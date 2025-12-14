import { Head } from "$fresh/runtime.ts";
import ReSyncButton from "../islands/ReSyncButton.tsx";

export default function Settings() {
  return (
    <>
      <Head>
        <title>設定 - Polimoney Ledger</title>
      </Head>
      <div class="min-h-screen bg-base-200">
        {/* ナビゲーションバー */}
        <div class="navbar bg-base-100 shadow-lg">
          <div class="navbar-start">
            <a href="/" class="text-xl font-bold px-4 hover:opacity-80">
              Polimoney Ledger
            </a>
          </div>
          <div class="navbar-center">
            <span class="text-lg">設定</span>
          </div>
          <div class="navbar-end">
            <a href="/" class="btn btn-ghost btn-sm">
              ← 戻る
            </a>
          </div>
        </div>

        {/* メインコンテンツ */}
        <main class="container mx-auto px-4 py-8 max-w-3xl">
          {/* 通常設定セクション */}
          <section class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
              <h2 class="card-title">一般設定</h2>
              <p class="text-base-content/70">設定項目は今後追加予定です。</p>
            </div>
          </section>

          {/* 同期ステータス */}
          <section class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
              <h2 class="card-title">Hub 同期ステータス</h2>
              <div class="flex items-center gap-2 mt-2">
                <span class="badge badge-success">自動同期: 有効</span>
                <span class="text-sm text-base-content/70">
                  仕訳承認時に自動で Hub に同期されます
                </span>
              </div>
              {/* TODO: 最終同期日時を表示 */}
            </div>
          </section>

          {/* スペーサー */}
          <div class="py-8"></div>

          {/* Danger Zone */}
          <section>
            <ReSyncButton />
          </section>
        </main>
      </div>
    </>
  );
}
