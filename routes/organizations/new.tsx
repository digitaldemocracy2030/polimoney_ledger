import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { Layout } from "../../components/Layout.tsx";
import { getOrganizations, type Organization } from "../../lib/hub-client.ts";
import NewOrganizationForm from "../../islands/NewOrganizationForm.tsx";

interface NewOrganizationPageData {
  hubOrganizations: Organization[];
  error?: string;
}

export const handler: Handlers<NewOrganizationPageData> = {
  async GET(_req, ctx) {
    const userId = ctx.state.userId as string;

    if (!userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    try {
      // Hub から政治団体一覧を取得
      const hubOrganizations = await getOrganizations();
      return ctx.render({ hubOrganizations });
    } catch (error) {
      console.error("Failed to fetch organizations from Hub:", error);
      return ctx.render({
        hubOrganizations: [],
        error:
          error instanceof Error
            ? error.message
            : "政治団体一覧の取得に失敗しました",
      });
    }
  },
};

export default function NewOrganizationPage({
  data,
}: PageProps<NewOrganizationPageData>) {
  const { hubOrganizations, error } = data;

  return (
    <>
      <Head>
        <title>新しい政治団体台帳を作成 - Polimoney Ledger</title>
      </Head>
      <Layout currentPath="/organizations" title="新しい政治団体台帳を作成">
        {/* パンくずリスト */}
        <div class="text-sm breadcrumbs mb-6">
          <ul>
            <li>
              <a href="/organizations">政治団体台帳一覧</a>
            </li>
            <li>新規作成</li>
          </ul>
        </div>

        {error && (
          <div class="alert alert-warning mb-6">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-base-content/70 mb-4">
              登録されている政治団体から選択するか、新規に登録してください。
            </p>
            <NewOrganizationForm hubOrganizations={hubOrganizations} />
          </div>
        </div>
      </Layout>
    </>
  );
}
