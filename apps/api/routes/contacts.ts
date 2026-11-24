/**
 * 関係者 API
 *
 * 関係者マスタは作成者（contacts.owner_user_id）単位で管理し、
 * ledger_contacts(ledger_id, contact_id) で台帳に紐付ける（1 つの関係者を複数の台帳に紐付けられる）。
 * - GET /contacts             : 自分が作成した関係者
 * - GET /contacts?ledger_id=  : 台帳に紐付いた関係者（viewLedger が必要）
 * - POST /contacts（ledger_id 付き）: 作成して台帳に紐付ける（manageContacts が必要）
 * - PUT / DELETE /contacts/:id: 作成者のみ
 * データアクセスはすべてユーザークライアント（RLS 適用）経由。
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../lib/types.ts";
import { requireLedgerPermission } from "../lib/authz.ts";

export const contactsRouter = new Hono<AppEnv>();

type ContactType = "person" | "corporation" | "political_organization";
type PrivacyReasonType = "personal_info" | "other";

interface ContactRequest {
  /** 台帳に紐付ける場合の台帳 ID（作成時のみ） */
  ledger_id?: string | null;
  contact_type?: ContactType;
  name?: string;
  address?: string | null;
  occupation?: string | null;
  hub_organization_id?: string | null;
  is_name_private?: boolean;
  is_address_private?: boolean;
  is_occupation_private?: boolean;
  privacy_reason_type?: PrivacyReasonType | null;
  privacy_reason_other?: string | null;
}

const CONTACT_COLUMNS =
  "id, contact_type, name, address, occupation, hub_organization_id, is_name_private, is_address_private, is_occupation_private, privacy_reason_type, privacy_reason_other, created_at";

const VALID_CONTACT_TYPES: ContactType[] = [
  "person",
  "corporation",
  "political_organization",
];
const VALID_PRIVACY_REASON_TYPES: PrivacyReasonType[] = [
  "personal_info",
  "other",
];

/**
 * 入力を検証し、DB に書き込む列を組み立てる。不正なら日本語のエラーメッセージを返す。
 */
function buildContactFields(
  body: ContactRequest,
  contactType: ContactType,
): { fields: Record<string, unknown> } | { error: string } {
  const name = body.name?.trim();
  if (!name) {
    return { error: "name は必須です" };
  }

  if (contactType === "political_organization" && !body.hub_organization_id) {
    return { error: "政治団体タイプの場合、政治団体IDは必須です" };
  }

  const isNamePrivate = body.is_name_private === true;
  const isAddressPrivate = body.is_address_private === true;
  // 職業は個人のみ
  const isOccupationPrivate = contactType === "person" &&
    body.is_occupation_private === true;
  const anyPrivate = isNamePrivate || isAddressPrivate || isOccupationPrivate;

  let privacyReasonType: PrivacyReasonType | null = null;
  let privacyReasonOther: string | null = null;
  if (anyPrivate) {
    if (
      !body.privacy_reason_type ||
      !VALID_PRIVACY_REASON_TYPES.includes(body.privacy_reason_type)
    ) {
      return { error: "非公開設定がある場合は非公開理由を選択してください" };
    }
    privacyReasonType = body.privacy_reason_type;
    if (privacyReasonType === "other") {
      privacyReasonOther = body.privacy_reason_other?.trim() || null;
      if (!privacyReasonOther) {
        return { error: "非公開理由（その他）を入力してください" };
      }
    }
  }

  return {
    fields: {
      contact_type: contactType,
      name,
      address: body.address?.trim() || null,
      occupation: contactType === "person"
        ? body.occupation?.trim() || null
        : null,
      hub_organization_id: contactType === "political_organization"
        ? body.hub_organization_id
        : null,
      is_name_private: isNamePrivate,
      is_address_private: isAddressPrivate,
      is_occupation_private: isOccupationPrivate,
      privacy_reason_type: privacyReasonType,
      privacy_reason_other: privacyReasonOther,
    },
  };
}

// GET /contacts - 関係者一覧
contactsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");
  const ledgerId = c.req.query("ledger_id");

  // 台帳の関係者を取得する場合は閲覧権限を確認（不足時は 403/404 を throw）
  if (ledgerId) {
    await requireLedgerPermission(c, { ledgerId }, "viewLedger");
  }

  try {
    const { data, error } = ledgerId
      ? await supabase
        .from("contacts")
        .select(`${CONTACT_COLUMNS}, ledger_contacts!inner ( ledger_id )`)
        .eq("ledger_contacts.ledger_id", ledgerId)
        .order("name")
      : await supabase
        .from("contacts")
        .select(CONTACT_COLUMNS)
        .eq("owner_user_id", userId)
        .order("name");

    if (error) {
      console.error("Failed to fetch contacts:", error);
      return c.json({ error: "関係者の取得に失敗しました" }, 500);
    }

    // 紐付け確認用の埋め込みは返さない
    const contacts = ((data ?? []) as Array<Record<string, unknown>>).map(
      ({ ledger_contacts: _links, ...contact }) => contact,
    );
    return c.json({ data: contacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// POST /contacts - 関係者作成
contactsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");

  try {
    const body: ContactRequest = await c.req.json();

    if (
      !body.contact_type || !VALID_CONTACT_TYPES.includes(body.contact_type)
    ) {
      return c.json(
        {
          error:
            "contact_type は 'person'、'corporation'、または 'political_organization' である必要があります",
        },
        400,
      );
    }

    const built = buildContactFields(body, body.contact_type);
    if ("error" in built) {
      return c.json({ error: built.error }, 400);
    }

    // 台帳に紐付ける場合は manageContacts が必要
    let ledgerId: string | null = null;
    if (body.ledger_id) {
      const access = await requireLedgerPermission(
        c,
        { ledgerId: body.ledger_id },
        "manageContacts",
      );
      ledgerId = access.ledgerId;
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({ owner_user_id: userId, ...built.fields })
      .select(CONTACT_COLUMNS)
      .single();

    if (error || !data) {
      console.error("Failed to create contact:", error);
      return c.json({ error: "関係者の登録に失敗しました" }, 500);
    }

    if (ledgerId) {
      // RLS: manageContacts かつ自分が作成した関係者のみ紐付けられる
      const { error: linkError } = await supabase
        .from("ledger_contacts")
        .insert({ ledger_id: ledgerId, contact_id: data.id });
      if (linkError) {
        console.error("Failed to link contact to ledger:", linkError);
        await supabase.from("contacts").delete().eq("id", data.id);
        return c.json({ error: "関係者の登録に失敗しました" }, 500);
      }
    }

    return c.json({ data }, 201);
  } catch (error) {
    // authz ヘルパーの 403/404 はそのまま返す
    if (error instanceof HTTPException) throw error;
    console.error("Error creating contact:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// GET /contacts/:id - 関係者詳細
contactsRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  try {
    const { data, error } = await supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch contact:", error);
      return c.json({ error: "関係者の取得に失敗しました" }, 500);
    }
    if (!data) {
      return c.json({ error: "関係者が見つかりません" }, 404);
    }

    return c.json({ data });
  } catch (error) {
    console.error("Error fetching contact:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// PUT /contacts/:id - 関係者更新
contactsRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  try {
    const body: ContactRequest = await c.req.json();

    const { data: existing, error: fetchError } = await supabase
      .from("contacts")
      .select("id, contact_type, hub_organization_id")
      .eq("id", id)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to fetch contact:", fetchError);
      return c.json({ error: "関係者の更新に失敗しました" }, 500);
    }
    if (!existing) {
      return c.json({ error: "関係者が見つかりません" }, 404);
    }

    if (
      body.contact_type !== undefined &&
      !VALID_CONTACT_TYPES.includes(body.contact_type)
    ) {
      return c.json(
        {
          error:
            "contact_type は 'person'、'corporation'、または 'political_organization' である必要があります",
        },
        400,
      );
    }
    const contactType = body.contact_type ??
      (existing.contact_type as ContactType);

    const built = buildContactFields(
      {
        ...body,
        hub_organization_id: body.hub_organization_id ??
          existing.hub_organization_id,
      },
      contactType,
    );
    if ("error" in built) {
      return c.json({ error: built.error }, 400);
    }

    const { data, error } = await supabase
      .from("contacts")
      .update(built.fields)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(CONTACT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("Failed to update contact:", error);
      return c.json({ error: "関係者の更新に失敗しました" }, 500);
    }
    if (!data) {
      return c.json({ error: "関係者が見つかりません" }, 404);
    }

    return c.json({ data });
  } catch (error) {
    console.error("Error updating contact:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// DELETE /contacts/:id - 関係者削除
contactsRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");
  const id = c.req.param("id");

  try {
    const { data, error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select("id");

    if (error) {
      console.error("Failed to delete contact:", error);
      // 仕訳から参照されている場合（外部キー違反）
      if (error.code === "23503") {
        return c.json(
          { error: "この関係者は仕訳で使用されているため削除できません" },
          409,
        );
      }
      return c.json({ error: "関係者の削除に失敗しました" }, 500);
    }
    if (!data || data.length === 0) {
      return c.json({ error: "関係者が見つかりません" }, 404);
    }

    return c.json({ message: "削除しました" });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});
