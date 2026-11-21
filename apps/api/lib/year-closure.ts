/**
 * 年度締め状態のヘルパー
 */

import { getServiceClient } from "./supabase.ts";
import { httpError } from "./errors.ts";

/**
 * 仕訳日の年度が締め済み（closed / locked）でないことを確認する。
 * 台帳メンバー全員に同じ判定をするため、authz 確認後に service client で読む。
 */
export async function assertYearOpen(ledgerId: string, journalDate: string) {
  const year = Number(journalDate.slice(0, 4));
  const { data, error } = await getServiceClient()
    .from("ledger_year_closures")
    .select("status")
    .eq("ledger_id", ledgerId)
    .eq("fiscal_year", year)
    .maybeSingle();
  if (error) {
    console.error("Failed to check year closure:", error);
    throw httpError(500, "年度締め状態の確認に失敗しました");
  }
  if (data && data.status !== "open" && data.status !== "temporary_unlock") {
    throw httpError(409, `${year}年度は締め済みのため変更できません`);
  }
}
