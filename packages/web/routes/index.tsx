import { Head } from "$fresh/runtime.ts";

export default function Home() {
  return (
    <>
      <Head>
        <title>Polimoney Ledger - ダッシュボード</title>
      </Head>
      <div class="min-h-screen bg-base-200">
        {/* ナビゲーションバー */}
        <div class="navbar bg-base-100 shadow-lg">
          <div class="navbar-start">
            <span class="text-xl font-bold px-4">Polimoney Ledger</span>
          </div>
        </div>

        {/* メインコンテンツ */}
        <main class="container mx-auto px-4 py-8">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 選挙一覧カード */}
            <a
              href="/elections"
              class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div class="card-body">
                <div class="flex items-center gap-4">
                  <span class="text-4xl" role="img" aria-label="選挙">
                    🗳️
                  </span>
                  <div>
                    <h2 class="card-title">選挙一覧</h2>
                    <p class="text-base-content/70">
                      選挙を選択または登録リクエスト
                    </p>
                  </div>
                </div>
              </div>
            </a>

            {/* 政治団体一覧カード */}
            <a
              href="/organizations"
              class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div class="card-body">
                <div class="flex items-center gap-4">
                  <span class="text-4xl" role="img" aria-label="政治団体">
                    🏛️
                  </span>
                  <div>
                    <h2 class="card-title">政治団体一覧</h2>
                    <p class="text-base-content/70">
                      政治団体を選択または登録リクエスト
                    </p>
                  </div>
                </div>
              </div>
            </a>

          </div>
        </main>
      </div>
    </>
  );
}
