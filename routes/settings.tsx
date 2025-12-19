import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { Layout } from "../components/Layout.tsx";
import { getServiceClient, getSupabaseClient } from "../lib/supabase.ts";
import ReSyncButton from "../islands/ReSyncButton.tsx";
import ProfileEditor from "../islands/ProfileEditor.tsx";
import VerificationSection from "../islands/VerificationSection.tsx";
import {
  getVerifiedPoliticianByUserId,
  getManagedOrganizations,
  getPoliticianVerificationsByUser,
  getOrganizationManagerVerificationsByUser,
  getOrganizations,
  type Politician,
  type ManagedOrganization,
  type PoliticianVerification,
  type OrganizationManagerVerification,
  type Organization,
} from "../lib/hub-client.ts";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

interface PageData {
  email: string;
  displayName: string;
  userId: string;
  // 認証情報
  verifiedPolitician: Politician | null;
  managedOrganizations: ManagedOrganization[];
  politicianVerifications: PoliticianVerification[];
  organizationManagerVerifications: OrganizationManagerVerification[];
  // 選択用
  hubOrganizations: Organization[];
}

export const handler: Handlers<PageData> = {
  async GET(req, ctx) {
    const userId = ctx.state.userId as string;
    if (!userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login?redirect=/settings" },
      });
    }

    const supabase =
      userId === TEST_USER_ID ? getServiceClient() : getSupabaseClient(req);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Supabase Auth では display_name または full_name で保存される場合がある
    const displayName =
      user?.user_metadata?.display_name || user?.user_metadata?.full_name || "";

    // Hub から認証情報を取得（並列）
    const [
      verifiedPolitician,
      managedOrganizations,
      politicianVerifications,
      organizationManagerVerifications,
      hubOrganizations,
    ] = await Promise.all([
      getVerifiedPoliticianByUserId(userId).catch(() => null),
      getManagedOrganizations(userId).catch(() => []),
      getPoliticianVerificationsByUser(userId).catch(() => []),
      getOrganizationManagerVerificationsByUser(userId).catch(() => []),
      getOrganizations().catch(() => []),
    ]);

    return ctx.render({
      email: user?.email || "",
      displayName,
      userId,
      verifiedPolitician,
      managedOrganizations,
      politicianVerifications,
      organizationManagerVerifications,
      hubOrganizations,
    });
  },
};

export default function Settings({ data }: PageProps<PageData>) {
  const {
    email,
    displayName,
    userId,
    verifiedPolitician,
    managedOrganizations,
    politicianVerifications,
    organizationManagerVerifications,
    hubOrganizations,
  } = data;

  return (
    <>
      <Head>
        <title>設定 - Polimoney Ledger</title>
      </Head>
      <Layout currentPath="/settings" title="設定">
        <div class="max-w-3xl">
          {/* プロフィールセクション */}
          <section class="mb-8">
            <ProfileEditor initialDisplayName={displayName} email={email} />
          </section>

          {/* 認証セクション */}
          <section class="mb-8">
            <VerificationSection
              userId={userId}
              verifiedPolitician={verifiedPolitician}
              managedOrganizations={managedOrganizations}
              politicianVerifications={politicianVerifications}
              organizationManagerVerifications={
                organizationManagerVerifications
              }
              hubOrganizations={hubOrganizations}
            />
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
