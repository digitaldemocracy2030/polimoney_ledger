/**
 * Hub 蜷梧悄 API
 */

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import {
  isTestUser,
  recordChangeLog,
  syncContacts,
  type SyncContactInput,
  type SyncJournalInput,
  syncJournals,
  syncLedger,
  type SyncLedgerInput,
} from '@/lib/hub-client';
import {
  type LedgerContact,
  type LedgerJournal,
  type LedgerJournalEntry,
  isFullyPublicContact,
  shouldSync,
  transformJournalForSync,
} from '@/lib/sync-transform';

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const syncRouter = new Hono<{
  Variables: {
    userId: string;
  };
}>();

/** 豁｣隕丞喧蠕後・ ledgers 繝・・繝悶Ν */
interface LedgerRecord {
  id: string;
  ledger_type: "political_fund" | "election_fund";
  organization_id: string | null;
  election_id: string | null;
  hub_ledger_id: string | null;
  hub_politician_organization_id: string | null;
  hub_politician_election_id: string | null;
}

interface JournalWithEntries extends LedgerJournal {
  journal_entries: LedgerJournalEntry[];
  contacts: LedgerContact | null;
}

async function getApprovedJournals(
  supabase: ReturnType<typeof getSupabase>,
  ledger: LedgerRecord
): Promise<JournalWithEntries[]> {
  const query = supabase
    .from("journals")
    .select(
      `
      *,
      journal_entries (*),
      contacts (*)
    `
    )
    .eq("status", "approved")
    .eq("ledger_id", ledger.id);

  const { data, error } = await query;

  if (error) {
    console.error("[Sync] Failed to fetch journals:", error);
    throw new Error(`Failed to fetch journals: ${error.message}`);
  }

  return data || [];
}

function calculateLedgerTotals(journals: JournalWithEntries[]): {
  total_income: number;
  total_expense: number;
  journal_count: number;
} {
  let total_income = 0;
  let total_expense = 0;

  for (const journal of journals) {
    for (const entry of journal.journal_entries) {
      if (entry.account_code.startsWith("REV_")) {
        total_income += entry.credit_amount;
      } else if (entry.account_code.startsWith("EXP_")) {
        total_expense += entry.debit_amount;
      }
    }
  }

  return {
    total_income,
    total_expense,
    journal_count: journals.length,
  };
}

/**
 * journals 縺九ｉ蜈ｬ髢句庄閭ｽ縺ｪ contacts 繧貞庶髮・＠縲？ub 縺ｫ蜷梧悄縺吶ｋ
 *
 * contact_source_id・・edger contacts.id 窶・UUID・峨ｒ繝ｦ繝九・繧ｯ繧ｭ繝ｼ縺ｨ縺励※蜷梧悄縲・
 * 蜷悟ｧ灘酔蜷阪〒繧・UUID 縺ｧ遒ｺ螳溘↓蛹ｺ蛻･縺輔ｌ繧九・
 *
 * @returns Ledger contact_id 竊・Hub public_contacts.id 縺ｮ繝槭ャ繝斐Φ繧ｰ
 */
async function syncContactsForJournals(
  journals: JournalWithEntries[],
  hubLedgerId: string,
  userId: string | undefined,
): Promise<Map<string, string>> {
  // Ledger contact_id 竊・Hub public_contacts.id
  const contactIdMap = new Map<string, string>();

  // 蜈ｨ蜈ｬ髢九・ contact 繧貞庶髮・ｼ磯㍾隍・賜髯､・・
  const contactsToSync = new Map<string, SyncContactInput>();

  for (const journal of journals) {
    const contact = journal.contacts;
    if (!contact || !contact.id) continue;
    if (contactsToSync.has(contact.id)) continue;

    // 蜈ｨ繝輔ぅ繝ｼ繝ｫ繝牙・髢九・蝣ｴ蜷医・縺ｿ Hub 縺ｫ蜷梧悄
    if (isFullyPublicContact(contact)) {
      contactsToSync.set(contact.id, {
        contact_source_id: contact.id,
        ledger_id: hubLedgerId,
        contact_type: contact.contact_type,
        name: contact.name,
        address: contact.address ?? null,
        occupation: contact.occupation ?? null,
        is_name_private: false,
        is_address_private: false,
        is_occupation_private: false,
      });
    } else {
      // 荳驛ｨ髱槫・髢九・蝣ｴ蜷医ｂ髱槫・髢九ヵ繝ｩ繧ｰ莉倥″縺ｧ蜷梧悄
      contactsToSync.set(contact.id, {
        contact_source_id: contact.id,
        ledger_id: hubLedgerId,
        contact_type: contact.contact_type,
        name: contact.is_name_private ? null : contact.name,
        address: contact.is_address_private ? null : (contact.address ?? null),
        occupation: contact.is_occupation_private
          ? null
          : (contact.occupation ?? null),
        is_name_private: contact.is_name_private,
        is_address_private: contact.is_address_private,
        is_occupation_private: contact.is_occupation_private,
      });
    }
  }

  if (contactsToSync.size === 0) {
    return contactIdMap;
  }

  try {
    const syncResult = await syncContacts(
      Array.from(contactsToSync.values()),
      { userId },
    );

    // 繝槭ャ繝斐Φ繧ｰ繧呈ｧ狗ｯ・
    for (const result of syncResult.data) {
      contactIdMap.set(result.contact_source_id, result.hub_contact_id);
    }

    console.log(
      `[Sync] Contacts synced: ${syncResult.data.length} (map size: ${contactIdMap.size})`
    );
  } catch (error) {
    console.error("[Sync] Failed to sync contacts (non-fatal):", error);
  }

  return contactIdMap;
}

// POST /sync - Hub 縺ｫ蜷梧悄
syncRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const url = new URL(c.req.url);
  const ledgerType = url.searchParams.get("type") as
    | "election"
    | "organization"
    | null;
  const ledgerId = url.searchParams.get("ledger_id");
  const force = url.searchParams.get("force") === "true";

  if (!ledgerType && !ledgerId) {
    return c.json({ error: "type or ledger_id is required" }, 400);
  }

  const isTest = isTestUser(userId);

  if (isTest) {
    console.log("[Sync] Running in test mode (TEST_USER_ID)");
  }

  try {
    const supabase = getSupabase();

    let ledgersQuery = supabase.from("ledgers").select("*");

    if (ledgerId) {
      ledgersQuery = ledgersQuery.eq("id", ledgerId);
    } else if (ledgerType === "election") {
      ledgersQuery = ledgersQuery.eq("ledger_type", "election_fund");
    } else if (ledgerType === "organization") {
      ledgersQuery = ledgersQuery.eq("ledger_type", "political_fund");
    }

    const { data: ledgers, error: ledgersError } = await ledgersQuery;

    if (ledgersError) {
      throw new Error(`Failed to fetch ledgers: ${ledgersError.message}`);
    }

    if (!ledgers || ledgers.length === 0) {
      return c.json({ error: "No ledgers found" }, 404);
    }

    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      ledgers_synced: 0,
      contacts_synced: 0,
    };

    for (const ledger of ledgers) {
      try {
        const ledgerRecord: LedgerRecord = {
          id: ledger.id,
          ledger_type: ledger.ledger_type,
          organization_id: ledger.organization_id,
          election_id: ledger.election_id,
          hub_ledger_id: ledger.hub_ledger_id,
          hub_politician_organization_id:
            ledger.hub_politician_organization_id,
          hub_politician_election_id: ledger.hub_politician_election_id,
        };

        const journals = await getApprovedJournals(supabase, ledgerRecord);

        if (journals.length === 0) {
          console.log(`[Sync] No approved journals for ledger ${ledger.id}`);
          continue;
        }

        const totals = calculateLedgerTotals(journals);

        // 1. 蜿ｰ蟶ｳ繧貞酔譛・
        const ledgerInput: SyncLedgerInput = {
          ledger_source_id: ledger.id,
          ledger_type: ledgerRecord.ledger_type,
          politician_organization_id:
            ledgerRecord.hub_politician_organization_id || undefined,
          politician_election_id:
            ledgerRecord.hub_politician_election_id || undefined,
          fiscal_year: new Date().getFullYear(),
          is_test: isTest,
          ...totals,
        };

        const ledgerResult = await syncLedger(ledgerInput, {
          userId: userId || undefined,
        });

        // Hub 縺ｮ public_ledgers.id 繧貞叙蠕・
        const hubLedgerId =
          ledgerResult.data?.id || ledger.hub_ledger_id || ledger.id;

        // 2. contacts 繧貞・縺ｫ蜷梧悄・・UID 縺ｧ繝ｦ繝九・繧ｯ隴伜挨・・
        const contactIdMap = await syncContactsForJournals(
          journals,
          hubLedgerId,
          userId || undefined,
        );
        result.contacts_synced += contactIdMap.size;

        // 3. journals 繧貞酔譛滂ｼ・ontact_id 縺ｯ Hub 縺ｮ public_contacts.id 繧剃ｽｿ逕ｨ・・
        const syncInputs: SyncJournalInput[] = [];

        for (const journal of journals) {
          if (!shouldSync(journal)) {
            result.skipped++;
            continue;
          }

          // Ledger 縺ｮ contact_id 竊・Hub 縺ｮ public_contacts.id 縺ｫ繝槭ャ繝斐Φ繧ｰ
          const hubContactId = journal.contact_id
            ? contactIdMap.get(journal.contact_id) || null
            : null;

          const transformed = await transformJournalForSync({
            journal,
            entries: journal.journal_entries,
            contact: journal.contacts,
            ledgerSourceId: ledger.id,
            hubContactId,
          });

          syncInputs.push({
            ...transformed,
            is_test: isTest,
          });
        }

        if (syncInputs.length > 0) {
          const syncResult = await syncJournals(syncInputs, {
            userId: userId || undefined,
          });
          result.created += syncResult.created;
          result.updated += syncResult.updated;
          result.skipped += syncResult.skipped;
          result.errors += syncResult.errors;
        }

        result.ledgers_synced++;

        await recordChangeLog(
          {
            ledger_source_id: ledger.id,
            change_summary: force ? "強制再同期" : "同期",
            change_details: {
              journal_count: syncInputs.length,
              contacts_synced: contactIdMap.size,
              created: result.created,
              updated: result.updated,
            },
          },
          { userId: userId || undefined }
        );

        console.log(
          `[Sync] Ledger ${ledger.id}: ${syncInputs.length} journals, ${contactIdMap.size} contacts synced`
        );
      } catch (ledgerError) {
        console.error(
          `[Sync] Error processing ledger ${ledger.id}:`,
          ledgerError
        );
        result.errors++;
      }
    }

    return c.json(result);
  } catch (error) {
    console.error("[Sync] Error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      500
    );
  }
});
