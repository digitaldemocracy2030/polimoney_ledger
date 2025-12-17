import { Head } from "$fresh/runtime.ts";
import { Layout } from "../components/Layout.tsx";
import ReSyncButton from "../islands/ReSyncButton.tsx";

export default function Settings() {
  return (
    <>
      <Head>
        <title>設定 - Polimoney Ledger</title>
      </Head>
      <Layout currentPath="/settings" title="設定">
        <div class="max-w-3xl">
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

          {/* データエクスポート */}
          <section class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
              <h2 class="card-title">📦 データポータビリティ</h2>
              <p class="text-base-content/70 mb-4">
                あなたのすべてのデータを JSON 形式でダウンロードできます。
                政治団体、選挙、仕訳、連絡先などが含まれます。
              </p>
              <div class="card-actions">
                <a
                  href="/api/export"
                  class="btn btn-outline btn-primary"
                  download
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  データをエクスポート
                </a>
              </div>
            </div>
          </section>

          {/* スペーサー */}
          <div class="py-8"></div>

          {/* Danger Zone */}
          <section>
            <ReSyncButton />
          </section>
        </div>
      </Layout>
    </>
  );
}
