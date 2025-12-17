/**
 * 仕訳承認 API
 *
 * POST /api/journals/:id/approve
 *
 * 仕訳を承認し、自動的に Hub に同期する
 */

import { Handlers } from "$fresh/server.ts";
import { createClient } from "@supabase/supabase-js";
import {
  syncJournals,
  syncLedger,
  isTestUser,
  type SyncJournalInput,
  type SyncLedgerInput,
} from "../../../../lib/hub-client.ts";
import {
  transformJournalForSync,
  type LedgerJournal,
  type LedgerJournalEntry,
  type LedgerContact,
} from "../../../../lib/sync-transform.ts";

// Supabase クライアント
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

/**
 * リクエストの Cookie からユーザー ID を取得
 */
async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const cookies = req.headers.get("Cookie") || "";
  const accessTokenMatch = cookies.match(/sb-access-token=([^;]+)/);

  if (!accessTokenMatch) {
    return null;
  }

  try {
    const supabase = getSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessTokenMatch[1]);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch {
    return null;
  }
}

interface JournalWithRelations extends LedgerJournal {
  journal_entries: LedgerJournalEntry[];
  contacts: LedgerContact | null;
  ledger_id: string | null;
}

interface LedgerRecord {
  id: string;
  politician_id: string;
  election_id: string | null;
  organization_id: string | null;
  fiscal_year: number | null;
}

export const handler: Handlers = {
  /**
   * POST /api/journals/:id/approve
   *
   * 仕訳を承認し、Hub に自動同期する
   */
  async POST(req, ctx) {
    const journalId = ctx.params.id;

    if (!journalId) {
      return new Response(JSON.stringify({ error: "Journal ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ユーザー認証チェック
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isTest = isTestUser(userId);

    try {
      const supabase = getSupabase();

      // 1. 仕訳を取得（関連データ含む）
      const { data: journal, error: fetchError } = await supabase
        .from("journals")
        .select(
          `
          *,
          journal_entries (*),
          contacts (*)
        `
        )
        .eq("id", journalId)
        .single();

      if (fetchError || !journal) {
        return new Response(JSON.stringify({ error: "Journal not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const journalWithRelations = journal as JournalWithRelations;

      // 既に承認済みの場合はスキップ
      if (journalWithRelations.status === "approved") {
        return new Response(
          JSON.stringify({ message: "Already approved", synced: false }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 2. 仕訳のステータスを approved に更新
      const { error: updateError } = await supabase
        .from("journals")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq("id", journalId);

      if (updateError) {
        throw new Error(`Failed to approve journal: ${updateError.message}`);
      }

      // 3. 台帳情報を取得
      const ledgerId =
        journalWithRelations.ledger_id ||
        journalWithRelations.election_id ||
        journalWithRelations.organization_id;

      if (!ledgerId) {
        console.warn(
          "[Approve] Journal has no associated ledger, skipping sync"
        );
        return new Response(
          JSON.stringify({
            message: "Approved but not synced (no ledger)",
            synced: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 台帳を取得
      let ledger: LedgerRecord | null = null;

      // まず ledgers テーブルから検索
      const { data: ledgerData } = await supabase
        .from("ledgers")
        .select("*")
        .or(
          `id.eq.${ledgerId},election_id.eq.${journalWithRelations.election_id},organization_id.eq.${journalWithRelations.organization_id}`
        )
        .limit(1)
        .single();

      if (ledgerData) {
        ledger = ledgerData as LedgerRecord;
      }

      if (!ledger) {
        console.warn("[Approve] Ledger not found, skipping sync");
        return new Response(
          JSON.stringify({
            message: "Approved but not synced (ledger not found)",
            synced: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 4. Hub に同期
      console.log(`[Approve] Syncing journal ${journalId} to Hub...`);

      // 仕訳を変換
      const syncInput: SyncJournalInput = {
        ...(await transformJournalForSync({
          journal: { ...journalWithRelations, status: "approved" },
          entries: journalWithRelations.journal_entries,
          contact: journalWithRelations.contacts,
          ledgerSourceId: ledger.id,
        })),
        is_test: isTest,
      };

      // 台帳の集計を再計算
      const { data: allJournals } = await supabase
        .from("journals")
        .select("*, journal_entries (*)")
        .eq("status", "approved")
        .or(
          `election_id.eq.${ledger.election_id},organization_id.eq.${ledger.organization_id}`
        );

      let totalIncome = 0;
      let totalExpense = 0;

      for (const j of allJournals || []) {
        for (const entry of j.journal_entries || []) {
          if (entry.account_code?.startsWith("REV_")) {
            totalIncome += entry.credit_amount || 0;
          } else if (entry.account_code?.startsWith("EXP_")) {
            totalExpense += entry.debit_amount || 0;
          }
        }
      }

      // 台帳を Hub に同期
      const ledgerInput: SyncLedgerInput = {
        ledger_source_id: ledger.id,
        politician_id: ledger.politician_id,
        organization_id: ledger.organization_id || undefined,
        election_id: ledger.election_id || undefined,
        fiscal_year: ledger.fiscal_year || new Date().getFullYear(),
        total_income: totalIncome,
        total_expense: totalExpense,
        journal_count: (allJournals || []).length,
        is_test: isTest,
      };

      await syncLedger(ledgerInput);

      // 仕訳を Hub に送信
      const syncResult = await syncJournals([syncInput]);

      console.log(`[Approve] Sync result:`, syncResult);

      return new Response(
        JSON.stringify({
          message: "Approved and synced",
          synced: true,
          sync_result: syncResult,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[Approve] Error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to approve",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
