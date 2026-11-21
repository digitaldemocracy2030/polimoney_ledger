/**
 * 台帳メンバー API（ledger_members）
 *
 * GET    /members?ledger_id=  - メンバー一覧（台帳にアクセスできるユーザー）
 * POST   /members             - メンバー招待（manageMembers）
 * PUT    /members/:id         - ロール変更（manageMembers）
 * DELETE /members/:id         - メンバー削除（manageMembers、オーナーは削除不可）
 *
 * ledger_members には他ユーザーの行や auth.admin の操作が含まれるため、
 * 必ず lib/authz.ts で台帳の権限を確認してから service client を使う。
 */

import { type Context, Hono } from "hono";
import { createClient, type User } from "@supabase/supabase-js";
import {
  type AppRole,
  getAssignableRoles,
} from "@polimoney-ledger/shared/permissions.ts";
import type { AppEnv } from "../lib/types.ts";
import {
  getServiceClient,
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "../lib/supabase.ts";
import {
  type LedgerAccess,
  requireLedgerPermission,
  requireLedgerRole,
} from "../lib/authz.ts";
import { httpError } from "../lib/errors.ts";

export const membersRouter = new Hono<AppEnv>();

interface LedgerMemberRow {
  id: string;
  user_id: string;
  ledger_id: string;
  role: string;
  invited_by_user_id: string | null;
  created_at: string;
}

interface LedgerMemberResponse extends LedgerMemberRow {
  email?: string;
  display_name?: string;
}

const MEMBER_COLUMNS =
  "id, user_id, ledger_id, role, invited_by_user_id, created_at";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 招待者のロールで割り当て可能なロールかを確認する */
function isAssignableRole(
  access: LedgerAccess,
  role: unknown,
): role is AppRole {
  return typeof role === "string" &&
    getAssignableRoles(access.role).includes(role as AppRole);
}

/** auth.users から表示用のメールアドレス・氏名を取り出す */
function toUserInfo(user: User | null | undefined): {
  email?: string;
  display_name?: string;
} {
  if (!user) return {};
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = meta.full_name ?? meta.display_name ?? meta.name;
  return {
    email: user.email,
    display_name: typeof name === "string" && name ? name : undefined,
  };
}

/**
 * メンバー行にメール・表示名を付与する。
 * 認可: 呼び出し側で対象台帳へのアクセスを確認済みであること。
 */
async function withUserInfo(
  rows: LedgerMemberRow[],
): Promise<LedgerMemberResponse[]> {
  const svc = getServiceClient();
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const users = new Map<string, User>();

  await Promise.all(userIds.map(async (id) => {
    const { data, error } = await svc.auth.admin.getUserById(id);
    if (error) {
      console.error("Failed to fetch member user:", error);
      return;
    }
    if (data.user) users.set(id, data.user);
  }));

  return rows.map((r) => ({ ...r, ...toUserInfo(users.get(r.user_id)) }));
}

/**
 * メールアドレスで auth.users を検索する
 * （service_role 専用の RPC public.find_user_id_by_email + auth.admin.getUserById）
 */
async function findUserByEmail(email: string): Promise<User | null> {
  const svc = getServiceClient();
  const { data: userId, error } = await svc.rpc("find_user_id_by_email", {
    p_email: email,
  });
  if (error) throw error;
  if (typeof userId !== "string" || !userId) return null;
  const { data, error: userError } = await svc.auth.admin.getUserById(userId);
  if (userError) throw userError;
  return data.user ?? null;
}

/**
 * OTP（6 桁コード）付きのログインメールを送る。
 * 公開エンドポイントのため publishable キーの使い捨てクライアントで呼ぶ。
 */
async function sendOtpEmail(email: string): Promise<boolean> {
  const client = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
  return true;
}

/**
 * メンバー行を取得し、その台帳に対する権限を確認する。
 * 認可前の存在確認のため service client で読み、権限が無ければ 404/403 を throw する。
 */
async function requireMemberWithPermission(
  c: Context<AppEnv>,
  memberId: string,
): Promise<{ member: LedgerMemberRow; access: LedgerAccess }> {
  const { data, error } = await getServiceClient()
    .from("ledger_members")
    .select(MEMBER_COLUMNS)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw httpError(404, "メンバーが見つかりません");
  }
  const member = data as LedgerMemberRow;
  const access = await requireLedgerPermission(
    c,
    { ledgerId: member.ledger_id },
    "manageMembers",
  );
  return { member, access };
}

// GET /members?ledger_id= - メンバー一覧
membersRouter.get("/", async (c) => {
  const ledgerId = c.req.query("ledger_id");
  if (!ledgerId) {
    return c.json({ error: "ledger_id は必須です" }, 400);
  }

  // 認可: 台帳のオーナーまたはメンバーであること
  await requireLedgerRole(c, { ledgerId });

  try {
    const { data, error } = await getServiceClient()
      .from("ledger_members")
      .select(MEMBER_COLUMNS)
      .eq("ledger_id", ledgerId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch members:", error);
      return c.json({ error: "メンバーの取得に失敗しました" }, 500);
    }

    const members = await withUserInfo((data ?? []) as LedgerMemberRow[]);
    return c.json({ data: members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// POST /members - メンバー招待（SPECIFICATION 3.7 _inviteMember）
membersRouter.post("/", async (c) => {
  const userId = c.get("userId");

  let body: { email?: unknown; role?: unknown; ledger_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const ledgerId = typeof body.ledger_id === "string" ? body.ledger_id : "";

  if (!ledgerId) {
    return c.json({ error: "ledger_id は必須です" }, 400);
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return c.json({ error: "有効なメールアドレスを入力してください" }, 400);
  }

  // 認可: 台帳に対する manageMembers 権限
  const access = await requireLedgerPermission(
    c,
    { ledgerId },
    "manageMembers",
  );

  if (!isAssignableRole(access, body.role)) {
    return c.json({ error: "指定された役割は割り当てできません" }, 400);
  }
  const role = body.role;

  try {
    const svc = getServiceClient();

    // a. 既存ユーザーを検索、b. 存在しなければアカウントを作成する
    let invitee = await findUserByEmail(email);
    if (!invitee) {
      const { data, error } = await svc.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (error || !data.user) {
        console.error("Failed to create invited user:", error);
        return c.json({ error: "招待ユーザーの作成に失敗しました" }, 500);
      }
      invitee = data.user;
    }

    if (invitee.id === access.ownerUserId) {
      return c.json(
        { error: "台帳のオーナーはメンバーとして招待できません" },
        400,
      );
    }

    const { data: existing, error: existingError } = await svc
      .from("ledger_members")
      .select("id")
      .eq("ledger_id", access.ledgerId)
      .eq("user_id", invitee.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return c.json({ error: "このユーザーは既にメンバーです" }, 409);
    }

    // c. ledger_members に登録
    const { data: inserted, error: insertError } = await svc
      .from("ledger_members")
      .insert({
        user_id: invitee.id,
        ledger_id: access.ledgerId,
        role,
        invited_by_user_id: userId,
      })
      .select(MEMBER_COLUMNS)
      .single();

    if (insertError || !inserted) {
      console.error("Failed to insert ledger member:", insertError);
      return c.json({ error: "メンバーの追加に失敗しました" }, 500);
    }

    // d. OTP（数字コード）付きのメールを送信
    const otpSent = await sendOtpEmail(email);

    const data: LedgerMemberResponse = {
      ...(inserted as LedgerMemberRow),
      ...toUserInfo(invitee),
    };

    return c.json(
      {
        data,
        message: otpSent
          ? "招待を送信しました"
          : "メンバーを追加しましたが、招待メールの送信に失敗しました。しばらくしてから再度ログインを案内してください",
      },
      201,
    );
  } catch (error) {
    console.error("Error inviting member:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// PUT /members/:id - ロール変更
membersRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const memberId = c.req.param("id");

  let body: { role?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  // 認可: メンバーが属する台帳に対する manageMembers 権限
  const { member, access } = await requireMemberWithPermission(c, memberId);

  if (!isAssignableRole(access, body.role)) {
    return c.json({ error: "指定された役割は割り当てできません" }, 400);
  }
  if (member.user_id === access.ownerUserId) {
    return c.json({ error: "オーナーの役割は変更できません" }, 400);
  }
  if (member.user_id === userId) {
    return c.json({ error: "自分自身の役割は変更できません" }, 400);
  }

  try {
    const { data, error } = await getServiceClient()
      .from("ledger_members")
      .update({ role: body.role })
      .eq("id", member.id)
      .select(MEMBER_COLUMNS)
      .single();

    if (error || !data) {
      console.error("Failed to update member role:", error);
      return c.json({ error: "役割の更新に失敗しました" }, 500);
    }

    return c.json({ data });
  } catch (error) {
    console.error("Error updating member:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// DELETE /members/:id - メンバー削除
membersRouter.delete("/:id", async (c) => {
  const memberId = c.req.param("id");

  // 認可: メンバーが属する台帳に対する manageMembers 権限
  const { member, access } = await requireMemberWithPermission(c, memberId);

  if (member.user_id === access.ownerUserId) {
    return c.json({ error: "オーナーは削除できません" }, 400);
  }

  try {
    const { error } = await getServiceClient()
      .from("ledger_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      console.error("Failed to delete member:", error);
      return c.json({ error: "メンバーの削除に失敗しました" }, 500);
    }

    return c.json({ message: "削除しました" });
  } catch (error) {
    console.error("Error deleting member:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});
