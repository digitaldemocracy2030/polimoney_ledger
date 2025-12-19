/**
 * 政治家検証 API
 *
 * GET /api/politicians/:id - Hub から政治家情報を取得して検証
 */

import { Handlers } from "$fresh/server.ts";
import { getPolitician } from "../../../lib/hub-client.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const userId = ctx.state.userId as string;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const politicianId = ctx.params.id;

    if (!politicianId) {
      return new Response(JSON.stringify({ error: "政治家IDが必要です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const politician = await getPolitician(politicianId);

      return new Response(
        JSON.stringify({
          data: {
            id: politician.id,
            name: politician.name,
            name_kana: politician.name_kana,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Failed to fetch politician:", error);
      return new Response(
        JSON.stringify({
          error:
            "指定された政治家IDが見つかりません。Hubに登録されている政治家IDを入力してください。",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
