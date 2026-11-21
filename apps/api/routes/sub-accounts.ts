/**
 * 補助科目 API
 *
 * 補助科目はユーザー単位（sub_accounts.owner_user_id = 自分）で管理する。
 * データアクセスはすべてユーザークライアント（RLS: auth.uid() = owner_user_id）経由。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";

export const subAccountsRouter = new Hono<AppEnv>();

type SubAccountLedgerType = "political_organization" | "election";

const VALID_LEDGER_TYPES: SubAccountLedgerType[] = [
  "political_organization",
  "election",
];

const SUB_ACCOUNT_COLUMNS =
  "id, ledger_type, parent_account_code, name, created_at";

interface CreateSubAccountRequest {
  ledger_type?: SubAccountLedgerType;
  parent_account_code?: string;
  name?: string;
}

interface UpdateSubAccountRequest {
  name?: string;
}

// GET /sub-accounts - 補助科目一覧
subAccountsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");

  try {
    const { data, error } = await supabase
      .from("sub_accounts")
      .select(SUB_ACCOUNT_COLUMNS)
      .eq("owner_user_id", userId)
      .order("name");

    if (error) {
      console.error("Failed to fetch sub-accounts:", error);
      return c.json({ error: "補助科目の取得に失敗しました" }, 500);
    }

    return c.json({ data: data ?? [] });
  } catch (error) {
    console.error("Error fetching sub-accounts:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// POST /sub-accounts - 補助科目作成
subAccountsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");

  try {
    const body: CreateSubAccountRequest = await c.req.json();

    const name = body.name?.trim();
    const parentAccountCode = body.parent_account_code?.trim();

    if (!name) {
      return c.json({ error: "補助科目名は必須です" }, 400);
    }
    if (!parentAccountCode) {
      return c.json({ error: "勘定科目を選択してください" }, 400);
    }
    if (!body.ledger_type || !VALID_LEDGER_TYPES.includes(body.ledger_type)) {
      return c.json(
        {
          error:
            "ledger_type は 'political_organization' または 'election' である必要があります",
        },
        400,
      );
    }

    const { data, error } = await supabase
      .from("sub_accounts")
      .insert({
        owner_user_id: userId,
        ledger_type: body.ledger_type,
        parent_account_code: parentAccountCode,
        name,
      })
      .select(SUB_ACCOUNT_COLUMNS)
      .single();

    if (error) {
      console.error("Failed to create sub-account:", error);
      return c.json({ error: "補助科目の作成に失敗しました" }, 500);
    }

    return c.json({ data }, 201);
  } catch (error) {
    console.error("Error creating sub-account:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// PUT /sub-accounts/:id - 補助科目更新（名称のみ変更可）
subAccountsRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  try {
    const body: UpdateSubAccountRequest = await c.req.json();

    const name = body.name?.trim();
    if (!name) {
      return c.json({ error: "補助科目名は必須です" }, 400);
    }

    const { data, error } = await supabase
      .from("sub_accounts")
      .update({ name })
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(SUB_ACCOUNT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("Failed to update sub-account:", error);
      return c.json({ error: "補助科目の更新に失敗しました" }, 500);
    }
    if (!data) {
      return c.json({ error: "補助科目が見つかりません" }, 404);
    }

    return c.json({ data });
  } catch (error) {
    console.error("Error updating sub-account:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// DELETE /sub-accounts/:id - 補助科目削除
subAccountsRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  try {
    const { data, error } = await supabase
      .from("sub_accounts")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select("id");

    if (error) {
      console.error("Failed to delete sub-account:", error);
      // 仕訳明細から参照されている場合（外部キー違反）
      if (error.code === "23503") {
        return c.json(
          { error: "この補助科目は仕訳で使用されているため削除できません" },
          409,
        );
      }
      return c.json({ error: "補助科目の削除に失敗しました" }, 500);
    }
    if (!data || data.length === 0) {
      return c.json({ error: "補助科目が見つかりません" }, 404);
    }

    return c.json({ message: "削除しました" });
  } catch (error) {
    console.error("Error deleting sub-account:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});
