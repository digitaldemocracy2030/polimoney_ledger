import { Handlers } from "$fresh/server.ts";
import { createOrganizationManagerVerification } from "../../../lib/hub-client.ts";

export const handler: Handlers = {
  /**
   * 政治団体管理者認証申請を作成
   */
  async POST(req, ctx) {
    const userId = ctx.state.userId as string;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await req.json();

      const verification = await createOrganizationManagerVerification({
        ledger_user_id: userId,
        organization_id: body.organization_id,
        organization_name: body.organization_name,
        official_email: body.official_email,
        role_in_organization: body.role_in_organization,
      });

      return new Response(
        JSON.stringify({ success: true, data: verification }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error creating organization manager verification:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "申請の作成に失敗しました",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
