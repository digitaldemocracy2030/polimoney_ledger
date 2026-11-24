/**
 * /v1/account-master API
 *
 * 勘定科目マスタは Hub（account_codes）で一元管理されている。
 * Ledger の旧 account_master テーブルは廃止済みのため、Hub API から取得して返す。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import { type AccountCode, getAccountCodes } from "../lib/hub-client.ts";

export const accountMasterRouter = new Hono<AppEnv>();

/** Web 側で使う台帳タイプ */
type LedgerTypeKey = "political_organization" | "election";

/** Hub の ledger_type ('organization' | 'election' | 'both') を Ledger の台帳タイプ配列に変換 */
function toAvailableLedgerTypes(hubLedgerType: string): LedgerTypeKey[] {
  switch (hubLedgerType) {
    case "organization":
      return ["political_organization"];
    case "election":
      return ["election"];
    case "both":
      return ["political_organization", "election"];
    default:
      return [];
  }
}

// GET /account-master - 勘定科目マスタ一覧
accountMasterRouter.get("/", async (c) => {
  try {
    const codes: AccountCode[] = await getAccountCodes({
      userId: c.get("userId"),
    });

    const data = [...codes]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((code) => ({
        code: code.code,
        name: code.name,
        type: code.type,
        report_category: code.report_category,
        available_ledger_types: toAvailableLedgerTypes(code.ledger_type),
      }));

    return c.json({ data });
  } catch (error) {
    console.error("[account-master] Hub API error:", error);
    return c.json({ error: "勘定科目マスタの取得に失敗しました" }, 502);
  }
});
