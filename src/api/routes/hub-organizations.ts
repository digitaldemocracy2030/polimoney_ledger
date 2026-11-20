/**
 * Hub謾ｿ豐ｻ蝗｣菴捺ュ蝣ｱ蜿門ｾ・API
 * Hub API繧堤ｵ檎罰縺励※謾ｿ豐ｻ蝗｣菴捺ュ蝣ｱ繧貞叙蠕励☆繧九・繝ｭ繧ｭ繧ｷ繧ｨ繝ｳ繝峨・繧､繝ｳ繝・
 */

import { Hono } from "hono";

const HUB_API_URL = process.env.HUB_API_URL_PROD || 
                    process.env.HUB_API_URL_DEV || 
                    process.env.HUB_API_URL || 
                    "http://localhost:8787";

export const hubOrganizationsRouter = new Hono<{
  Variables: {
    userId: string;
  };
}>();

interface HubOrganization {
  id: string;
  name: string;
  type: string;
  politician_id: string | null;
  is_active: boolean;
  official_url?: string | null;
  registration_authority?: string | null;
  established_date?: string | null;
  office_address?: string | null;
  representative_name?: string | null;
  accountant_name?: string | null;
  contact_email?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

// GET /hub-organizations/:id - Hub DB縺九ｉ謾ｿ豐ｻ蝗｣菴捺ュ蝣ｱ繧貞叙蠕・
hubOrganizationsRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  // UUID蠖｢蠑上メ繧ｧ繝・け
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return c.json({ error: "無効な政治団体IDです" }, 400);
  }

  try {
    const response = await fetch(`${HUB_API_URL}/organizations/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: "政治団体が見つかりません" }, 404);
      }
      return c.json({ error: "Hub APIからの取得に失敗しました" }, 500);
    }

    const result = await response.json();
    const org: HubOrganization = result.data;

    // 蠢・ｦ√↑諠・ｱ縺ｮ縺ｿ霑斐☆
    return c.json({
      data: {
        id: org.id,
        name: org.name,
        type: org.type,
        office_address: org.office_address || null,
        official_url: org.official_url || null,
        representative_name: org.representative_name || null,
      },
    });
  } catch (error) {
    console.error("Error fetching organization from Hub:", error);
    return c.json({ error: "政治団体情報の取得に失敗しました" }, 500);
  }
});

// GET /hub-organizations/search - Hub DB縺ｧ謾ｿ豐ｻ蝗｣菴薙ｒ讀懃ｴ｢・亥ｰ・擂縺ｮ諡｡蠑ｵ逕ｨ・・
hubOrganizationsRouter.get("/search", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const query = c.req.query("q");
  if (!query || query.length < 2) {
    return c.json({ error: "検索クエリは2文字以上必要です" }, 400);
  }

  try {
    // TODO: Hub API縺ｫ讀懃ｴ｢繧ｨ繝ｳ繝峨・繧､繝ｳ繝医ｒ霑ｽ蜉蠕後↓螳溯｣・
    return c.json({ 
      data: [],
      message: "検索機能は現在準備中です"
    });
  } catch (error) {
    console.error("Error searching organizations from Hub:", error);
    return c.json({ error: "検索に失敗しました" }, 500);
  }
});
