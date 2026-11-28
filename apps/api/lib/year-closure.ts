/**
 * 年度締め状態のヘルパー
 */

import { getServiceClient } from "./supabase.ts";
import { httpError } from "./errors.ts";
import { checkUnlockStatus } from "./hub-client.ts";

export type ClosureStatus = "open" | "closed" | "locked" | "temporary_unlock";

export interface ClosureUnlockState {
  fiscal_year: number;
  status: ClosureStatus;
  unlock_request_id: string | null;
  unlock_expires_at: string | null;
}

/**
 * Hub で承認されたロック解除を年度締めに反映し、反映後の状態を返す。
 *
 * - locked: Hub に問い合わせ、期限内の承認があり、まだ反映していない申請なら temporary_unlock にする
 *   （反映済みの申請は再び反映しない。期限内に再ロックした年度が同じ承認で解除されないようにする）
 * - temporary_unlock: 期限が過ぎていれば（期限が無ければ）locked に戻す（Hub には問い合わせない）
 *
 * locked -> temporary_unlock は利用者の権限では行えない（RLS とトリガー
 * 20261128110000）ので service_role で行う。期限切れの判定は DB の is_fiscal_year_writable でも行う。
 * 呼び出し側で台帳の閲覧権限を確認してから呼ぶこと。
 * Hub に接続できない場合は locked のまま扱う。
 */
export async function applyHubUnlock(
  ledgerId: string,
  ownerUserId: string,
  closure: ClosureUnlockState,
): Promise<ClosureStatus> {
  if (closure.status === "temporary_unlock") {
    const expiresAt = closure.unlock_expires_at
      ? Date.parse(closure.unlock_expires_at)
      : NaN;
    if (!Number.isNaN(expiresAt) && expiresAt > Date.now()) {
      return "temporary_unlock";
    }
    const updated = await updateClosureStatus(
      ledgerId,
      closure.fiscal_year,
      "temporary_unlock",
      { status: "locked" },
    );
    return updated ? "locked" : closure.status;
  }

  if (closure.status !== "locked") return closure.status;

  let unlock;
  try {
    unlock = await checkUnlockStatus(ledgerId, {
      fiscalYear: closure.fiscal_year,
      userId: ownerUserId,
    });
  } catch (error) {
    console.error("[year-closure] Hub unlock check failed:", error);
    return "locked";
  }
  const request = unlock.unlock_request;
  if (
    !unlock.is_unlocked || !request || !request.unlock_expires_at ||
    request.id === closure.unlock_request_id
  ) {
    return "locked";
  }
  const updated = await updateClosureStatus(
    ledgerId,
    closure.fiscal_year,
    "locked",
    {
      status: "temporary_unlock",
      unlock_request_id: request.id,
      unlock_expires_at: request.unlock_expires_at,
    },
  );
  return updated ? "temporary_unlock" : "locked";
}

/** 状態が expected のままなら更新する（同時の更新と競合したら false） */
async function updateClosureStatus(
  ledgerId: string,
  fiscalYear: number,
  expected: ClosureStatus,
  values: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await getServiceClient()
    .from("ledger_year_closures")
    .update(values)
    .eq("ledger_id", ledgerId)
    .eq("fiscal_year", fiscalYear)
    .eq("status", expected)
    .select("fiscal_year");
  if (error) {
    console.error("Failed to update year closure:", error);
    throw httpError(500, "年度締め状態の更新に失敗しました");
  }
  return (data ?? []).length > 0;
}

/**
 * 仕訳日の年度が締め済み（closed / locked）でないことを確認する。
 * アーカイブ済み（locked）でも、Hub でロック解除が承認されていれば一時解除にして通す。
 * 台帳メンバー全員に同じ判定をするため、authz 確認後に service client で読む。
 */
export async function assertYearOpen(ledgerId: string, journalDate: string) {
  const year = Number(journalDate.slice(0, 4));
  const svc = getServiceClient();
  const { data, error } = await svc
    .from("ledger_year_closures")
    .select("fiscal_year, status, unlock_request_id, unlock_expires_at")
    .eq("ledger_id", ledgerId)
    .eq("fiscal_year", year)
    .maybeSingle();
  if (error) {
    console.error("Failed to check year closure:", error);
    throw httpError(500, "年度締め状態の確認に失敗しました");
  }
  if (!data) return;

  let status = data.status as ClosureStatus;
  if (status === "locked" || status === "temporary_unlock") {
    const { data: ledger, error: ledgerError } = await svc
      .from("ledgers")
      .select("owner_user_id")
      .eq("id", ledgerId)
      .single();
    if (ledgerError) {
      console.error("Failed to fetch ledger owner:", ledgerError);
      throw httpError(500, "年度締め状態の確認に失敗しました");
    }
    status = await applyHubUnlock(
      ledgerId,
      ledger.owner_user_id as string,
      data as ClosureUnlockState,
    );
  }
  if (status !== "open" && status !== "temporary_unlock") {
    throw httpError(409, `${year}年度は締め済みのため変更できません`);
  }
}
