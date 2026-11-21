/**
 * /v1/export API（データポータビリティ）
 *
 * GET /export - 認証ユーザー本人のデータを JSON ファイルとしてダウンロードさせる。
 *
 * データアクセスはすべてユーザーの JWT 付きクライアント（c.get("supabase")）で行い、
 * RLS の範囲内で本人が所有・起票したデータのみを返す。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";

export const exportRouter = new Hono<AppEnv>();

interface ExportData {
  exported_at: string;
  version: string;
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
  ledgers: unknown[];
  political_organizations: unknown[];
  elections: unknown[];
  contacts: unknown[];
  sub_accounts: unknown[];
  /** journal_entries / media_assets を埋め込んだ仕訳 */
  journals: unknown[];
}

// GET /export - 本人データの一括エクスポート
exportRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const user = c.get("user");
  const supabase = c.get("supabase");

  try {
    const [
      ledgersResult,
      orgsResult,
      electionsResult,
      contactsResult,
      subAccountsResult,
    ] = await Promise.all([
      supabase.from("ledgers").select("*").eq("owner_user_id", userId),
      supabase
        .from("political_organizations")
        .select("*")
        .eq("owner_user_id", userId),
      supabase.from("elections").select("*").eq("owner_user_id", userId),
      supabase.from("contacts").select("*").eq("owner_user_id", userId),
      supabase.from("sub_accounts").select("*").eq("owner_user_id", userId),
    ]);

    const firstError = ledgersResult.error ?? orgsResult.error ??
      electionsResult.error ?? contactsResult.error ??
      subAccountsResult.error;
    if (firstError) {
      console.error("Export query error:", firstError);
      return c.json({ error: "エクスポートに失敗しました" }, 500);
    }

    // 仕訳: 本人が所有する台帳の仕訳 + 本人が起票した仕訳
    const ownedLedgerIds = (ledgersResult.data ?? []).map(
      (l: { id: string }) => l.id,
    );
    const journalFilter = ownedLedgerIds.length > 0
      ? `submitted_by_user_id.eq.${userId},ledger_id.in.(${
        ownedLedgerIds.join(",")
      })`
      : `submitted_by_user_id.eq.${userId}`;

    const journalsResult = await supabase
      .from("journals")
      .select("*, journal_entries(*), media_assets(*)")
      .or(journalFilter)
      .order("journal_date", { ascending: true });

    if (journalsResult.error) {
      console.error("Export journals error:", journalsResult.error);
      return c.json({ error: "エクスポートに失敗しました" }, 500);
    }

    const metadata = user.user_metadata ?? {};
    const exportData: ExportData = {
      exported_at: new Date().toISOString(),
      version: "1.0.0",
      user: {
        id: userId,
        email: user.email ?? null,
        full_name: typeof metadata.full_name === "string"
          ? metadata.full_name
          : null,
      },
      ledgers: ledgersResult.data ?? [],
      political_organizations: orgsResult.data ?? [],
      elections: electionsResult.data ?? [],
      contacts: contactsResult.data ?? [],
      sub_accounts: subAccountsResult.data ?? [],
      journals: journalsResult.data ?? [],
    };

    const date = new Date().toISOString().split("T")[0];
    const filename = `polimoney-ledger-export-${date}.json`;

    return c.body(JSON.stringify(exportData, null, 2), 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  } catch (error) {
    console.error("Export error:", error);
    return c.json({ error: "エクスポートに失敗しました" }, 500);
  }
});
