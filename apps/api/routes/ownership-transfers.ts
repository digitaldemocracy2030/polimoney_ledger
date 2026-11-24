/**
 * オーナー譲渡 API（ownership_transfers）
 *
 * GET    /ownership-transfers             - 自分が関係する譲渡申請一覧
 * POST   /ownership-transfers             - 譲渡申請を作成（台帳オーナーのみ）
 * GET    /ownership-transfers/:id         - 譲渡申請の詳細
 * DELETE /ownership-transfers/:id         - 譲渡申請をキャンセル（申請者のみ、pending のみ）
 * POST   /ownership-transfers/:id/accept  - 譲渡を承認（譲渡先のみ、pending のみ）
 * POST   /ownership-transfers/:id/decline - 譲渡を拒否（譲渡先のみ、pending のみ）
 *
 * 読み取りと拒否はユーザークライアント（RLS: from_user_id / to_user_id = auth.uid()）。
 * 作成・キャンセル・承認は他ユーザーの台帳やメンバー行を書き換えるため、
 * 本人確認・権限確認の後に service client を使う。
 */

import { type Context, Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import { getServiceClient } from "../lib/supabase.ts";
import { requireLedgerOwner } from "../lib/authz.ts";
import { httpError } from "../lib/errors.ts";

export const ownershipTransfersRouter = new Hono<AppEnv>();

interface TransferRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  ledger_id: string | null;
  status: "pending" | "completed" | "declined";
  requested_at: string;
  updated_at: string;
}

const TRANSFER_COLUMNS =
  "id, from_user_id, to_user_id, ledger_id, status, requested_at, updated_at";

/**
 * 自分が関係する譲渡申請を取得する（RLS で from/to = 自分 の行のみ見える）。
 * 見つからなければ 404 を throw する。
 */
async function getVisibleTransfer(
  c: Context<AppEnv>,
  id: string,
): Promise<TransferRow> {
  const userId = c.get("userId");
  const { data, error } = await c.get("supabase")
    .from("ownership_transfers")
    .select(TRANSFER_COLUMNS)
    .eq("id", id)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw httpError(404, "譲渡申請が見つかりません");
  }
  return data as TransferRow;
}

// GET /ownership-transfers - 譲渡申請一覧（自分が申請者または譲渡先）
ownershipTransfersRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const supabase = c.get("supabase");

  try {
    const { data, error } = await supabase
      .from("ownership_transfers")
      .select(TRANSFER_COLUMNS)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch transfers:", error);
      return c.json({ error: "譲渡申請の取得に失敗しました" }, 500);
    }

    return c.json({ data: data ?? [] });
  } catch (error) {
    console.error("Error fetching transfers:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// POST /ownership-transfers - 譲渡申請を作成
ownershipTransfersRouter.post("/", async (c) => {
  const userId = c.get("userId");

  let body: { to_user_id?: unknown; ledger_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  const toUserId = typeof body.to_user_id === "string"
    ? body.to_user_id.trim()
    : "";
  const ledgerId = typeof body.ledger_id === "string" ? body.ledger_id : "";

  if (!toUserId) {
    return c.json({ error: "譲渡先のユーザーを選択してください" }, 400);
  }
  if (!ledgerId) {
    return c.json({ error: "ledger_id は必須です" }, 400);
  }
  if (toUserId === userId) {
    return c.json({ error: "自分自身には譲渡できません" }, 400);
  }

  // 認可: 台帳のオーナーであること
  const access = await requireLedgerOwner(c, { ledgerId });

  try {
    const svc = getServiceClient();

    // 譲渡先は台帳のメンバーであること
    const { data: member, error: memberError } = await svc
      .from("ledger_members")
      .select("id")
      .eq("ledger_id", access.ledgerId)
      .eq("user_id", toUserId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) {
      return c.json(
        { error: "譲渡先はこの台帳のメンバーである必要があります" },
        400,
      );
    }

    // 同じ台帳に保留中の申請が無いこと
    const { data: pending, error: pendingError } = await svc
      .from("ownership_transfers")
      .select("id")
      .eq("ledger_id", access.ledgerId)
      .eq("status", "pending")
      .limit(1);
    if (pendingError) throw pendingError;
    if (pending && pending.length > 0) {
      return c.json(
        { error: "この台帳には既に保留中の譲渡申請があります" },
        409,
      );
    }

    // ownership_transfers には INSERT ポリシーが無いため service client で作成
    const { data, error } = await svc
      .from("ownership_transfers")
      .insert({
        from_user_id: userId,
        to_user_id: toUserId,
        ledger_id: access.ledgerId,
        status: "pending",
      })
      .select("id, status, requested_at")
      .single();

    if (error || !data) {
      console.error("Failed to create transfer:", error);
      return c.json({ error: "譲渡申請の作成に失敗しました" }, 500);
    }

    return c.json(
      {
        data,
        message:
          "譲渡申請を作成しました。譲渡先が承認するとオーナーが変更されます",
      },
      201,
    );
  } catch (error) {
    console.error("Error creating transfer:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// GET /ownership-transfers/:id - 譲渡申請の詳細
ownershipTransfersRouter.get("/:id", async (c) => {
  const transfer = await getVisibleTransfer(c, c.req.param("id"));
  return c.json({ data: transfer });
});

// DELETE /ownership-transfers/:id - 譲渡申請をキャンセル
ownershipTransfersRouter.delete("/:id", async (c) => {
  const transfer = await getVisibleTransfer(c, c.req.param("id"));

  // 認可: 申請者本人のみ
  if (transfer.from_user_id !== c.get("userId")) {
    return c.json({ error: "申請者のみキャンセルできます" }, 403);
  }
  if (transfer.status !== "pending") {
    return c.json({ error: "保留中の申請のみキャンセルできます" }, 400);
  }

  try {
    // ownership_transfers には DELETE ポリシーが無いため service client で削除
    const { error } = await getServiceClient()
      .from("ownership_transfers")
      .delete()
      .eq("id", transfer.id)
      .eq("from_user_id", transfer.from_user_id)
      .eq("status", "pending");

    if (error) {
      console.error("Failed to cancel transfer:", error);
      return c.json({ error: "譲渡申請のキャンセルに失敗しました" }, 500);
    }

    return c.json({ message: "譲渡申請をキャンセルしました" });
  } catch (error) {
    console.error("Error cancelling transfer:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// POST /ownership-transfers/:id/accept - 譲渡を承認
ownershipTransfersRouter.post("/:id/accept", async (c) => {
  const userId = c.get("userId");
  const transfer = await getVisibleTransfer(c, c.req.param("id"));

  // 認可: 譲渡先本人のみ
  if (transfer.to_user_id !== userId) {
    return c.json({ error: "譲渡先のユーザーのみ承認できます" }, 403);
  }
  if (transfer.status !== "pending") {
    return c.json({ error: "保留中の申請のみ承認できます" }, 400);
  }
  if (!transfer.ledger_id) {
    return c.json({ error: "譲渡対象の台帳が見つかりません" }, 404);
  }

  const svc = getServiceClient();
  const now = new Date().toISOString();

  try {
    // 台帳のオーナーが申請時から変わっていないこと
    const { data: ledger, error: ledgerError } = await svc
      .from("ledgers")
      .select("id, owner_user_id, organization_id, election_id")
      .eq("id", transfer.ledger_id)
      .maybeSingle();
    if (ledgerError) throw ledgerError;
    if (!ledger) {
      return c.json({ error: "譲渡対象の台帳が見つかりません" }, 404);
    }
    if (ledger.owner_user_id !== transfer.from_user_id) {
      return c.json(
        { error: "台帳のオーナーが変更されているため、この申請は無効です" },
        409,
      );
    }

    // 1. 申請を確定（pending の場合のみ。同時承認の二重実行を防ぐ）
    const { data: claimed, error: claimError } = await svc
      .from("ownership_transfers")
      .update({ status: "completed", updated_at: now })
      .eq("id", transfer.id)
      .eq("status", "pending")
      .select("id");
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) {
      return c.json({ error: "保留中の申請のみ承認できます" }, 409);
    }

    // 2. 台帳のオーナーを変更
    const { error: ownerError } = await svc
      .from("ledgers")
      .update({ owner_user_id: userId })
      .eq("id", ledger.id)
      .eq("owner_user_id", transfer.from_user_id);
    if (ownerError) {
      console.error("Failed to update ledger owner:", ownerError);
      // 申請を保留中に戻す
      await svc
        .from("ownership_transfers")
        .update({ status: "pending", updated_at: now })
        .eq("id", transfer.id);
      return c.json({ error: "オーナー変更に失敗しました" }, 500);
    }

    // 3. 台帳に紐づく政治団体 / 選挙のオーナーも変更（旧オーナー所有の場合のみ）
    await transferLinkedOwners(
      ledger.organization_id,
      ledger.election_id,
      transfer.from_user_id,
      userId,
    );

    // 4. 新オーナー・旧オーナーとも admin メンバーにする
    //    （台帳作成時のトリガーと同じく、オーナーも ledger_members に admin で載せる。
    //     UNIQUE(ledger_id, user_id) により 1 ユーザー 1 行）
    const { error: memberError } = await svc.from("ledger_members").upsert(
      [
        {
          user_id: userId,
          ledger_id: ledger.id,
          role: "admin",
          invited_by_user_id: transfer.from_user_id,
        },
        {
          user_id: transfer.from_user_id,
          ledger_id: ledger.id,
          role: "admin",
          invited_by_user_id: userId,
        },
      ],
      { onConflict: "ledger_id,user_id" },
    );
    if (memberError) {
      console.error("Failed to update owner memberships:", memberError);
    }

    return c.json({
      data: { id: transfer.id, ledger_id: ledger.id, new_owner_id: userId },
      message: "オーナー譲渡が完了しました",
    });
  } catch (error) {
    console.error("Error accepting transfer:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

// POST /ownership-transfers/:id/decline - 譲渡を拒否
ownershipTransfersRouter.post("/:id/decline", async (c) => {
  const userId = c.get("userId");
  const transfer = await getVisibleTransfer(c, c.req.param("id"));

  // 認可: 譲渡先本人のみ（RLS の UPDATE ポリシーも to_user_id = auth.uid()）
  if (transfer.to_user_id !== userId) {
    return c.json({ error: "譲渡先のユーザーのみ拒否できます" }, 403);
  }
  if (transfer.status !== "pending") {
    return c.json({ error: "保留中の申請のみ拒否できます" }, 400);
  }

  try {
    const { data, error } = await c.get("supabase")
      .from("ownership_transfers")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", transfer.id)
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .select(TRANSFER_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("Failed to decline transfer:", error);
      return c.json({ error: "譲渡申請の拒否に失敗しました" }, 500);
    }
    if (!data) {
      return c.json({ error: "保留中の申請のみ拒否できます" }, 409);
    }

    return c.json({ data, message: "譲渡申請を拒否しました" });
  } catch (error) {
    console.error("Error declining transfer:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
});

/**
 * 台帳に紐づく政治団体 / 選挙（ledgers.organization_id / election_id）の owner_user_id を
 * 新オーナーに変更する（旧オーナー所有の場合のみ）。
 * 認可: 呼び出し側で譲渡申請の承認（to_user_id = 自分、pending）を確認済みであること。
 * 失敗しても台帳の譲渡自体は完了しているため、ログのみ残す。
 */
async function transferLinkedOwners(
  organizationId: string | null,
  electionId: string | null,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const svc = getServiceClient();
  const targets = [
    { table: "political_organizations", id: organizationId },
    { table: "elections", id: electionId },
  ];
  for (const target of targets) {
    if (!target.id) continue;
    const { error } = await svc
      .from(target.table)
      .update({ owner_user_id: toUserId })
      .eq("id", target.id)
      .eq("owner_user_id", fromUserId);
    if (error) {
      console.error(`Failed to update ${target.table} owner:`, error);
    }
  }
}
