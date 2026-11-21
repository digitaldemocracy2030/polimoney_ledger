/**
 * Hub 同期 API
 *
 * POST /sync?type=election|organization&ledger_id=...&force=true
 *
 * - ledger_id 指定時: その台帳を同期する（editLedgerSettings 権限が必要）
 * - 未指定時: 呼び出したユーザーが editLedgerSettings 権限を持つ全台帳を同期する
 *   （type を指定するとその種別の台帳に絞る）
 *
 * 台帳・仕訳の読み取りは Hub 同期の処理として service client で行う。
 * 使う前に必ず authz ヘルパーで対象台帳への権限を確認する。
 *
 * is_test と Hub API キーの選択は、呼び出したユーザーではなく台帳ごとのオーナーで決める
 * （承認時の自動同期 journals.ts syncApprovedJournal と同じ）。
 */

import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AppPermission,
  hasPermission,
} from "@polimoney-ledger/shared/permissions.ts";
import type { AppEnv } from "../lib/types.ts";
import { getServiceClient } from "../lib/supabase.ts";
import {
  getLedgerRole,
  type LedgerType,
  requireLedgerPermission,
} from "../lib/authz.ts";
import {
  isTestUser,
  recordChangeLog,
  type SyncContactInput,
  syncContacts,
  type SyncJournalInput,
  syncJournals,
  syncLedger,
  type SyncLedgerInput,
} from "../lib/hub-client.ts";
import {
  isFullyPublicContact,
  type LedgerContact,
  type LedgerJournal,
  type LedgerJournalEntry,
  shouldSync,
  transformJournalForSync,
} from "../lib/sync-transform.ts";

export const syncRouter = new Hono<AppEnv>();

/** Hub への同期に必要な権限（台帳設定の編集権限 = admin / accountant） */
const SYNC_PERMISSION: AppPermission = "editLedgerSettings";

/** クエリの type → ledgers.ledger_type */
const LEDGER_TYPE_BY_PARAM: Record<string, LedgerType> = {
  election: "election_fund",
  organization: "political_fund",
};

/** 正規化後の ledgers テーブル（Hub 側の中間テーブル ID を含む） */
interface LedgerRecord {
  id: string;
  owner_user_id: string;
  ledger_type: LedgerType;
  hub_ledger_id: string | null;
  hub_politician_organization_id: string | null;
  hub_politician_election_id: string | null;
}

interface JournalWithEntries extends LedgerJournal {
  journal_entries: LedgerJournalEntry[];
  contacts: LedgerContact | null;
}

/** PostgREST の埋め込み（to-one）は配列で返る場合もあるので 1 件に正規化する */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * 呼び出したユーザーが同期権限を持つ台帳 ID の一覧を返す
 * （オーナーの台帳 + メンバーとして所属する台帳のうち、権限を満たすもの）
 */
async function listSyncableLedgerIds(
  c: Parameters<typeof getLedgerRole>[0],
  ledgerType: LedgerType | null,
): Promise<string[]> {
  const userId = c.get("userId");
  const candidates = new Set<string>();

  // オーナーの台帳（ledgers の RLS: owner_user_id = auth.uid() で読める）
  let ownedQuery = c.get("supabase")
    .from("ledgers")
    .select("id")
    .eq("owner_user_id", userId);
  if (ledgerType) ownedQuery = ownedQuery.eq("ledger_type", ledgerType);
  const { data: owned, error: ownedError } = await ownedQuery;
  if (ownedError) throw ownedError;
  for (const row of owned ?? []) candidates.add(row.id as string);

  // 所属している台帳（本人の ledger_members 行のみ読む。
  // ledger_members にはユーザー向けの RLS ポリシーが無いため service client で読む）
  const { data: memberships, error: memberError } = await getServiceClient()
    .from("ledger_members")
    .select("ledger_id")
    .eq("user_id", userId);
  if (memberError) throw memberError;
  for (const row of memberships ?? []) candidates.add(row.ledger_id as string);

  // 各台帳について authz ヘルパーで権限を確認する
  const allowed: string[] = [];
  for (const id of candidates) {
    const access = await getLedgerRole(c, { ledgerId: id });
    if (!access || !hasPermission(access.role, SYNC_PERMISSION)) continue;
    if (ledgerType && access.ledgerType !== ledgerType) continue;
    allowed.push(id);
  }
  return allowed;
}

/** 台帳を Hub の中間テーブル ID 付きで取得する（権限確認済みの ID のみ渡すこと） */
async function getLedgerRecords(
  svc: SupabaseClient,
  ledgerIds: string[],
): Promise<LedgerRecord[]> {
  const { data, error } = await svc
    .from("ledgers")
    .select(
      `
      id,
      owner_user_id,
      ledger_type,
      hub_ledger_id,
      politician_organizations ( hub_politician_organization_id ),
      politician_elections ( hub_politician_election_id )
    `,
    )
    .in("id", ledgerIds);

  if (error) {
    throw new Error(`Failed to fetch ledgers: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const po = firstOf(
      row.politician_organizations as
        | { hub_politician_organization_id: string | null }
        | { hub_politician_organization_id: string | null }[]
        | null,
    );
    const pe = firstOf(
      row.politician_elections as
        | { hub_politician_election_id: string | null }
        | { hub_politician_election_id: string | null }[]
        | null,
    );
    return {
      id: row.id as string,
      owner_user_id: row.owner_user_id as string,
      ledger_type: row.ledger_type as LedgerType,
      hub_ledger_id: (row.hub_ledger_id as string | null) ?? null,
      hub_politician_organization_id: po?.hub_politician_organization_id ??
        null,
      hub_politician_election_id: pe?.hub_politician_election_id ?? null,
    };
  });
}

/** 台帳の承認済み仕訳を明細・関係者付きで取得する（権限確認済みの台帳のみ） */
async function getApprovedJournals(
  svc: SupabaseClient,
  ledger: LedgerRecord,
): Promise<JournalWithEntries[]> {
  const { data, error } = await svc
    .from("journals")
    .select(
      `
      *,
      journal_entries (*),
      contacts (*)
    `,
    )
    .eq("status", "approved")
    .eq("ledger_id", ledger.id);

  if (error) {
    console.error("[Sync] Failed to fetch journals:", error);
    throw new Error(`Failed to fetch journals: ${error.message}`);
  }

  return (data ?? []) as JournalWithEntries[];
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
 * journals から関係者（contacts）を集め、Hub に同期する
 *
 * contact_source_id（Ledger の contacts.id、UUID）をユニークキーとして同期する。
 * 同姓同名でも UUID で確実に区別される。
 *
 * @returns Ledger の contact_id → Hub の public_contacts.id のマッピング
 */
async function syncContactsForJournals(
  journals: JournalWithEntries[],
  hubLedgerId: string,
  hubUserId: string,
): Promise<Map<string, string>> {
  // Ledger の contact_id → Hub の public_contacts.id
  const contactIdMap = new Map<string, string>();

  // 同期対象の contact を集める（重複は除外）
  const contactsToSync = new Map<string, SyncContactInput>();

  for (const journal of journals) {
    const contact = journal.contacts;
    if (!contact || !contact.id) continue;
    if (contactsToSync.has(contact.id)) continue;

    if (isFullyPublicContact(contact)) {
      // 全フィールド公開の場合はそのまま同期
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
      // 一部非公開の場合は、非公開フィールドを除いて非公開フラグ付きで同期
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
      { userId: hubUserId },
    );

    // マッピングを構築
    for (const result of syncResult.data) {
      contactIdMap.set(result.contact_source_id, result.hub_contact_id);
    }

    console.log(
      `[Sync] Contacts synced: ${syncResult.data.length} (map size: ${contactIdMap.size})`,
    );
  } catch (error) {
    console.error("[Sync] Failed to sync contacts (non-fatal):", error);
  }

  return contactIdMap;
}

// POST /sync - Hub に同期
syncRouter.post("/", async (c) => {
  const typeParam = c.req.query("type");
  const ledgerIdParam = c.req.query("ledger_id") || null;
  const force = c.req.query("force") === "true";

  let ledgerType: LedgerType | null = null;
  if (typeParam) {
    ledgerType = LEDGER_TYPE_BY_PARAM[typeParam] ?? null;
    if (!ledgerType) {
      return c.json(
        { error: "type は election または organization を指定してください" },
        400,
      );
    }
  }

  // 権限確認（不足時は authz ヘルパーが 403/404 を throw する）
  let ledgerIds: string[];
  if (ledgerIdParam) {
    await requireLedgerPermission(
      c,
      { ledgerId: ledgerIdParam },
      SYNC_PERMISSION,
    );
    ledgerIds = [ledgerIdParam];
  } else {
    ledgerIds = await listSyncableLedgerIds(c, ledgerType);
  }

  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    ledgers_synced: 0,
    contacts_synced: 0,
  };

  if (ledgerIds.length === 0) {
    return c.json(result);
  }

  try {
    // ここで使う ledgerIds はすべて上で権限確認済み
    const svc = getServiceClient();
    const ledgers = await getLedgerRecords(svc, ledgerIds);

    for (const ledger of ledgers) {
      try {
        // is_test と Hub API キーは台帳オーナーで決める
        const hubUserId = ledger.owner_user_id;
        const isTest = isTestUser(hubUserId);
        if (isTest) {
          console.log(`[Sync] Ledger ${ledger.id} is a test ledger`);
        }

        const journals = await getApprovedJournals(svc, ledger);

        if (journals.length === 0) {
          console.log(`[Sync] No approved journals for ledger ${ledger.id}`);
          continue;
        }

        const totals = calculateLedgerTotals(journals);

        // 1. 台帳を同期
        const ledgerInput: SyncLedgerInput = {
          ledger_source_id: ledger.id,
          ledger_type: ledger.ledger_type,
          politician_organization_id: ledger.hub_politician_organization_id ||
            undefined,
          politician_election_id: ledger.hub_politician_election_id ||
            undefined,
          fiscal_year: new Date().getFullYear(),
          is_test: isTest,
          ...totals,
        };

        const ledgerResult = await syncLedger(ledgerInput, {
          userId: hubUserId,
        });

        // Hub の public_ledgers.id を取得
        const hubLedgerId = (ledgerResult.data?.id as string | undefined) ||
          ledger.hub_ledger_id || ledger.id;

        // Hub の public_ledgers.id を台帳に記録する（Hub 同期の記録。権限確認済み）
        const returnedHubLedgerId = ledgerResult.data?.id as
          | string
          | undefined;
        if (
          returnedHubLedgerId && returnedHubLedgerId !== ledger.hub_ledger_id
        ) {
          const { error: hubIdError } = await svc
            .from("ledgers")
            .update({ hub_ledger_id: returnedHubLedgerId })
            .eq("id", ledger.id);
          if (hubIdError) {
            console.warn(
              `[Sync] Failed to save hub_ledger_id for ${ledger.id}:`,
              hubIdError,
            );
          }
        }

        // 2. contacts を先に同期（UUID でユニークに識別）
        const contactIdMap = await syncContactsForJournals(
          journals,
          hubLedgerId,
          hubUserId,
        );
        result.contacts_synced += contactIdMap.size;

        // 3. journals を同期（contact_id には Hub の public_contacts.id を使う）
        const syncInputs: SyncJournalInput[] = [];

        for (const journal of journals) {
          if (!shouldSync(journal)) {
            result.skipped++;
            continue;
          }

          // Ledger の contact_id → Hub の public_contacts.id
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

        let created = 0;
        let updated = 0;
        if (syncInputs.length > 0) {
          const syncResult = await syncJournals(syncInputs, {
            userId: hubUserId,
          });
          created = syncResult.created;
          updated = syncResult.updated;
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
              created,
              updated,
            },
          },
          { userId: hubUserId },
        );

        console.log(
          `[Sync] Ledger ${ledger.id}: ${syncInputs.length} journals, ${contactIdMap.size} contacts synced`,
        );
      } catch (ledgerError) {
        console.error(
          `[Sync] Error processing ledger ${ledger.id}:`,
          ledgerError,
        );
        result.errors++;
      }
    }

    return c.json(result);
  } catch (error) {
    console.error("[Sync] Error:", error);
    return c.json({ error: "Hub との同期に失敗しました" }, 500);
  }
});
