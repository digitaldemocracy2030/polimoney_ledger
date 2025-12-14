import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { getElections, type Election } from "../lib/hub-client.ts";
import ElectionSelector from "../islands/ElectionSelector.tsx";

interface ElectionsPageData {
  elections: Election[];
  error?: string;
}

export const handler: Handlers<ElectionsPageData> = {
  async GET(_req, ctx) {
    try {
      const elections = await getElections();
      return ctx.render({ elections });
    } catch (error) {
      console.error("Failed to fetch elections:", error);
      return ctx.render({
        elections: [],
        error:
          error instanceof Error
            ? error.message
            : "選挙一覧の取得に失敗しました",
      });
    }
  },
};

export default function ElectionsPage({ data }: PageProps<ElectionsPageData>) {
  const { elections, error } = data;

  return (
    <>
      <Head>
        <title>選挙一覧 - Polimoney Ledger</title>
      </Head>
      <div class="min-h-screen bg-base-200">
        {/* ナビゲーションバー */}
        <div class="navbar bg-base-100 shadow-lg">
          <div class="navbar-start">
            <a href="/" class="btn btn-ghost">
              ← 戻る
            </a>
          </div>
          <div class="navbar-center">
            <span class="text-xl font-bold">🗳️ 選挙一覧</span>
          </div>
          <div class="navbar-end" />
        </div>

        {/* メインコンテンツ */}
        <main class="container mx-auto px-4 py-8">
          {error && (
            <div role="alert" class="alert alert-error mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}
          <ElectionSelector initialElections={elections} />
        </main>
      </div>
    </>
  );
}
