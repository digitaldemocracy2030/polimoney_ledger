import { Handlers } from "$fresh/server.ts";
import { createPoliticianVerification } from "../../../lib/hub-client.ts";

export const handler: Handlers = {
  /**
   * 政治家認証申請を作成
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

      const verification = await createPoliticianVerification({
        ledger_user_id: userId,
        name: body.name,
        official_email: body.official_email,
        official_url: body.official_url,
        party: body.party,
        politician_id: body.politician_id,
      });

      return new Response(
        JSON.stringify({ success: true, data: verification }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error creating politician verification:", error);
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
