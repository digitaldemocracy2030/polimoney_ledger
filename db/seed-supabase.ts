/**
 * Ledger Supabase にテストユーザーとダミーデータを投入するスクリプト
 *
 * 使い方:
 * 1. .env に SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY を設定
 * 2. deno run --allow-net --allow-env --allow-read db/seed-supabase.ts [options]
 *
 * オプション:
 *   --all     テストユーザーとダミーデータを投入（デフォルト）
 *   --user    テストユーザーのみ作成
 *   --data    ダミーデータのみ投入（テストユーザーが既に存在する前提）
 *
 * 前提:
 *   docs/schema-normalized.sql と db/migrate-rls-user-scoped-api.sql が適用済みであること。
 *
 * 注意:
 *   - このスクリプトは service_role キーを使用します（DB の初期投入のため RLS を通らない）
 *   - 投入するデータは supabase/seed.sql と同じです
 *   - API はユーザーの JWT（RLS 適用）で DB を読むため、テストユーザーを台帳のオーナーにし、
 *     ledger_members にも admin として登録します（API の台帳作成と同じ形）
 *   - 既存の行（migrate-normalize.sql が作った台帳など）は自然キーで見つけて再利用します
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  console.error("   Set these in .env or environment variables");
  Deno.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

// ============================================
// 固定のテストユーザー ID
// ============================================

// テスト用ユーザー（開発用ダミーデータの所有者）
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
const TEST_USER_EMAIL = "test-dev@polimoney.local";
const TEST_USER_PASSWORD = "test-dev-password-12345";

// ============================================
// ダミーデータ: プロフィール（認証済み政治家）
// ============================================

const testProfile = {
  id: TEST_USER_ID,
  hub_politician_id: "11111111-1111-1111-1111-111111111111",
  verified_email_domain: "test-taro.example.jp",
};

// ============================================
// ダミーデータ: 政治家（Ledger 内。台帳の紐付け用）
// ============================================

const testPoliticians = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    owner_user_id: TEST_USER_ID,
    name: "山田 太郎",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    owner_user_id: TEST_USER_ID,
    name: "佐藤 花子",
  },
];

// ============================================
// ダミーデータ: 政治団体
// ============================================

const testOrganizations = [
  {
    id: "aaaa1111-1111-1111-1111-111111111111",
    owner_user_id: TEST_USER_ID,
    name: "山田太郎後援会",
    hub_organization_id: "aaaa1111-1111-1111-1111-111111111111",
  },
  {
    id: "aaaa1111-2222-2222-2222-222222222222",
    owner_user_id: TEST_USER_ID,
    name: "山田太郎を応援する会",
    hub_organization_id: "aaaa1111-2222-2222-2222-222222222222",
  },
];

// ============================================
// ダミーデータ: 選挙
// ============================================

const testElections = [
  {
    id: "eeee1111-1111-1111-1111-111111111111",
    owner_user_id: TEST_USER_ID,
    hub_politician_id: "11111111-1111-1111-1111-111111111111",
    election_name: "2024年 第50回衆議院議員総選挙（テスト）",
    election_date: "2024-10-27",
  },
  {
    id: "eeee2222-2222-2222-2222-222222222222",
    owner_user_id: TEST_USER_ID,
    hub_politician_id: "22222222-2222-2222-2222-222222222222",
    election_name: "令和7年東京都知事選挙（テスト）",
    election_date: "2025-07-06",
  },
];

// ============================================
// ダミーデータ: 台帳（キーは下の関係者・仕訳から参照する）
// ============================================

type LedgerKey = "org_taro" | "org_taro_fund" | "elec_taro" | "elec_hanako";

interface LedgerSeed {
  key: LedgerKey;
  label: string;
  /** 新規作成時の台帳 ID */
  ledgerId: string;
  /** 新規作成時の中間テーブル行 ID */
  linkId: string;
  politicianId: string;
  ledgerType: "political_fund" | "election_fund";
  /** political_fund なら政治団体 ID、election_fund なら選挙 ID */
  targetId: string;
}

const testLedgers: LedgerSeed[] = [
  {
    key: "org_taro",
    label: "山田太郎後援会",
    ledgerId: "1ed01111-1111-1111-1111-111111111111",
    linkId: "a0001111-1111-1111-1111-111111111111",
    politicianId: "11111111-1111-1111-1111-111111111111",
    ledgerType: "political_fund",
    targetId: "aaaa1111-1111-1111-1111-111111111111",
  },
  {
    key: "org_taro_fund",
    label: "山田太郎を応援する会",
    ledgerId: "1ed02222-2222-2222-2222-222222222222",
    linkId: "a0002222-2222-2222-2222-222222222222",
    politicianId: "11111111-1111-1111-1111-111111111111",
    ledgerType: "political_fund",
    targetId: "aaaa1111-2222-2222-2222-222222222222",
  },
  {
    key: "elec_taro",
    label: "2024年 第50回衆議院議員総選挙（テスト）",
    ledgerId: "1ed03333-3333-3333-3333-333333333333",
    linkId: "e0001111-1111-1111-1111-111111111111",
    politicianId: "11111111-1111-1111-1111-111111111111",
    ledgerType: "election_fund",
    targetId: "eeee1111-1111-1111-1111-111111111111",
  },
  {
    key: "elec_hanako",
    label: "令和7年東京都知事選挙（テスト）",
    ledgerId: "1ed04444-4444-4444-4444-444444444444",
    linkId: "e0002222-2222-2222-2222-222222222222",
    politicianId: "22222222-2222-2222-2222-222222222222",
    ledgerType: "election_fund",
    targetId: "eeee2222-2222-2222-2222-222222222222",
  },
];

// ============================================
// ダミーデータ: 関係者（取引先）
// ============================================

const testContacts: Array<{
  id: string;
  ledger: LedgerKey;
  contact_type: "person" | "corporation";
  name: string;
  address: string;
  occupation: string | null;
}> = [
  // 選挙台帳（山田太郎）用
  {
    id: "cccc1111-1111-1111-1111-111111111111",
    ledger: "elec_taro",
    contact_type: "person",
    name: "山田 一郎",
    address: "東京都渋谷区〇〇1-2-3",
    occupation: "会社員",
  },
  {
    id: "cccc2222-2222-2222-2222-222222222222",
    ledger: "elec_taro",
    contact_type: "corporation",
    name: "株式会社テスト印刷",
    address: "東京都新宿区△△4-5-6",
    occupation: null,
  },
  {
    id: "cccc3333-3333-3333-3333-333333333333",
    ledger: "elec_taro",
    contact_type: "corporation",
    name: "〇〇不動産",
    address: "東京都千代田区××7-8-9",
    occupation: null,
  },
  // 政治団体台帳（山田太郎後援会）用
  {
    id: "cccc4444-4444-4444-4444-444444444444",
    ledger: "org_taro",
    contact_type: "person",
    name: "山田 一郎",
    address: "東京都渋谷区〇〇1-2-3",
    occupation: "会社員",
  },
  {
    id: "cccc5555-5555-5555-5555-555555555555",
    ledger: "org_taro",
    contact_type: "corporation",
    name: "株式会社テスト印刷",
    address: "東京都新宿区△△4-5-6",
    occupation: null,
  },
];

// ============================================
// ダミーデータ: 仕訳
// ============================================

const testJournals: Array<{
  id: string;
  ledger: LedgerKey;
  journal_date: string;
  description: string;
  contact_id: string;
  classification: string | null;
  notes: string | null;
}> = [
  // 選挙台帳: 山田太郎の選挙
  {
    id: "dddd1111-1111-1111-1111-111111111111",
    ledger: "elec_taro",
    journal_date: "2024-10-01",
    description: "選挙ポスター印刷",
    contact_id: "cccc2222-2222-2222-2222-222222222222",
    classification: "campaign",
    notes: "A1サイズ 500枚",
  },
  {
    id: "dddd1111-2222-2222-2222-222222222222",
    ledger: "elec_taro",
    journal_date: "2024-10-05",
    description: "個人寄附",
    contact_id: "cccc1111-1111-1111-1111-111111111111",
    classification: "pre-campaign",
    notes: null,
  },
  {
    id: "dddd1111-3333-3333-3333-333333333333",
    ledger: "elec_taro",
    journal_date: "2024-10-15",
    description: "選挙事務所借り上げ",
    contact_id: "cccc3333-3333-3333-3333-333333333333",
    classification: "campaign",
    notes: "10/1~10/31",
  },
  // 政治団体台帳: 山田太郎後援会
  {
    id: "dddd2222-1111-1111-1111-111111111111",
    ledger: "org_taro",
    journal_date: "2024-04-15",
    description: "会費収入",
    contact_id: "cccc4444-4444-4444-4444-444444444444",
    classification: null,
    notes: "年会費",
  },
  {
    id: "dddd2222-2222-2222-2222-222222222222",
    ledger: "org_taro",
    journal_date: "2024-05-01",
    description: "事務用品購入",
    contact_id: "cccc5555-5555-5555-5555-555555555555",
    classification: null,
    notes: "コピー用紙、文房具",
  },
];

// ============================================
// ダミーデータ: 仕訳明細
// ============================================

const testJournalEntries = [
  // ポスター印刷（支出）
  {
    id: "ff001111-1111-1111-1111-111111111111",
    journal_id: "dddd1111-1111-1111-1111-111111111111",
    account_code: "EXP_PRINTING_ELEC",
    debit_amount: 150000,
    credit_amount: 0,
  },
  {
    id: "ff001111-1111-1111-2222-222222222222",
    journal_id: "dddd1111-1111-1111-1111-111111111111",
    account_code: "ASSET_CASH",
    debit_amount: 0,
    credit_amount: 150000,
  },
  // 個人寄附（収入）
  {
    id: "ff001111-2222-2222-1111-111111111111",
    journal_id: "dddd1111-2222-2222-2222-222222222222",
    account_code: "ASSET_CASH",
    debit_amount: 50000,
    credit_amount: 0,
  },
  {
    id: "ff001111-2222-2222-2222-222222222222",
    journal_id: "dddd1111-2222-2222-2222-222222222222",
    account_code: "REV_DONATION_INDIVIDUAL_ELEC",
    debit_amount: 0,
    credit_amount: 50000,
  },
  // 事務所借り上げ（支出）
  {
    id: "ff001111-3333-3333-1111-111111111111",
    journal_id: "dddd1111-3333-3333-3333-333333333333",
    account_code: "EXP_BUILDING_ELEC",
    debit_amount: 80000,
    credit_amount: 0,
  },
  {
    id: "ff001111-3333-3333-2222-222222222222",
    journal_id: "dddd1111-3333-3333-3333-333333333333",
    account_code: "ASSET_CASH",
    debit_amount: 0,
    credit_amount: 80000,
  },
  // 会費収入
  {
    id: "ff002222-1111-1111-1111-111111111111",
    journal_id: "dddd2222-1111-1111-1111-111111111111",
    account_code: "ASSET_CASH",
    debit_amount: 10000,
    credit_amount: 0,
  },
  {
    id: "ff002222-1111-1111-2222-222222222222",
    journal_id: "dddd2222-1111-1111-1111-111111111111",
    account_code: "REV_MEMBERSHIP_FEE",
    debit_amount: 0,
    credit_amount: 10000,
  },
  // 事務用品購入
  {
    id: "ff002222-2222-2222-1111-111111111111",
    journal_id: "dddd2222-2222-2222-2222-222222222222",
    account_code: "EXP_SUPPLIES",
    debit_amount: 5000,
    credit_amount: 0,
  },
  {
    id: "ff002222-2222-2222-2222-222222222222",
    journal_id: "dddd2222-2222-2222-2222-222222222222",
    account_code: "ASSET_CASH",
    debit_amount: 0,
    credit_amount: 5000,
  },
];

// ============================================
// シード関数
// ============================================

/** エラーなら例外にする（シードは途中で止める） */
function check(error: { message: string } | null, label: string): void {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

async function createTestUser(): Promise<boolean> {
  console.log("\n📝 テストユーザーを作成中...");

  // 既存ユーザーをチェック
  const { data: existingUser } = await supabase.auth.admin.getUserById(
    TEST_USER_ID,
  );

  if (existingUser?.user) {
    console.log(`  ✓ テストユーザーは既に存在します: ${TEST_USER_EMAIL}`);
    return true;
  }

  // 新規作成
  const { data, error } = await supabase.auth.admin.createUser({
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "テスト開発ユーザー",
      is_test_user: true,
    },
  });

  if (error) {
    console.error(`  ❌ テストユーザー作成失敗:`, error.message);
    return false;
  }

  console.log(`  ✓ テストユーザー作成完了: ${data.user?.email}`);
  return true;
}

async function seedProfile() {
  console.log("\n📝 プロフィールを投入中...");
  const now = new Date().toISOString();
  const { data: existing, error: findError } = await supabase
    .from("profiles")
    .select("tos_accepted_at, privacy_policy_accepted_at")
    .eq("id", TEST_USER_ID)
    .maybeSingle();
  check(findError, "profiles");

  const { error } = await supabase.from("profiles").upsert({
    ...testProfile,
    tos_accepted_at: existing?.tos_accepted_at ?? now,
    privacy_policy_accepted_at: existing?.privacy_policy_accepted_at ?? now,
    updated_at: now,
  }, { onConflict: "id" });
  check(error, "profiles");
  console.log(`  ✓ ${TEST_USER_ID}`);
}

async function seedPoliticians() {
  console.log("\n📝 政治家データを投入中...");
  for (const politician of testPoliticians) {
    const { error } = await supabase.from("politicians").upsert(politician, {
      onConflict: "id",
    });
    check(error, `politicians ${politician.name}`);
    console.log(`  ✓ ${politician.name}`);
  }
}

async function seedOrganizations() {
  console.log("\n📝 政治団体データを投入中...");
  for (const org of testOrganizations) {
    const { error } = await supabase
      .from("political_organizations")
      .upsert(org, { onConflict: "id" });
    check(error, `political_organizations ${org.name}`);
    console.log(`  ✓ ${org.name}`);
  }
}

async function seedElections() {
  console.log("\n📝 選挙データを投入中...");
  for (const election of testElections) {
    const { error } = await supabase
      .from("elections")
      .upsert(election, { onConflict: "id" });
    check(error, `elections ${election.election_name}`);
    console.log(`  ✓ ${election.election_name}`);
  }
}

/** 中間テーブル行を自然キー（政治家 + 政治団体/選挙）で探し、無ければ作成する */
async function ensureLink(seed: LedgerSeed): Promise<string> {
  const link = seed.ledgerType === "political_fund"
    ? { table: "politician_organizations", column: "organization_id" }
    : { table: "politician_elections", column: "election_id" };

  const { data: existing, error: findError } = await supabase
    .from(link.table)
    .select("id")
    .eq("politician_id", seed.politicianId)
    .eq(link.column, seed.targetId)
    .maybeSingle();
  check(findError, link.table);
  if (existing) return existing.id as string;

  const { error } = await supabase.from(link.table).insert({
    id: seed.linkId,
    politician_id: seed.politicianId,
    [link.column]: seed.targetId,
  });
  check(error, link.table);
  return seed.linkId;
}

/** 台帳を中間テーブル行で探し、無ければ作成する。オーナーはテストユーザーにそろえる */
async function ensureLedger(seed: LedgerSeed, linkId: string): Promise<string> {
  const linkColumn = seed.ledgerType === "political_fund"
    ? "politician_organization_id"
    : "politician_election_id";

  const { data: existing, error: findError } = await supabase
    .from("ledgers")
    .select("id")
    .eq(linkColumn, linkId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  check(findError, "ledgers");

  if (existing) {
    const { error } = await supabase
      .from("ledgers")
      .update({ owner_user_id: TEST_USER_ID })
      .eq("id", existing.id);
    check(error, "ledgers");
    return existing.id as string;
  }

  const { error } = await supabase.from("ledgers").insert({
    id: seed.ledgerId,
    owner_user_id: TEST_USER_ID,
    ledger_type: seed.ledgerType,
    [linkColumn]: linkId,
  });
  check(error, "ledgers");
  return seed.ledgerId;
}

/** オーナー自身を admin として ledger_members に登録する */
async function ensureOwnerMembership(ledgerId: string): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("ledger_members")
    .select("id")
    .eq("ledger_id", ledgerId)
    .eq("user_id", TEST_USER_ID);
  check(findError, "ledger_members");

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("ledger_members")
      .update({ role: "admin" })
      .in("id", existing.map((m: { id: string }) => m.id));
    check(error, "ledger_members");
    return;
  }

  const { error } = await supabase.from("ledger_members").insert({
    user_id: TEST_USER_ID,
    ledger_id: ledgerId,
    role: "admin",
    invited_by_user_id: TEST_USER_ID,
  });
  check(error, "ledger_members");
}

async function seedLedgers(): Promise<Record<LedgerKey, string>> {
  console.log("\n📝 台帳データを投入中...");
  const ledgerIds = {} as Record<LedgerKey, string>;
  for (const seed of testLedgers) {
    const linkId = await ensureLink(seed);
    const ledgerId = await ensureLedger(seed, linkId);
    await ensureOwnerMembership(ledgerId);
    ledgerIds[seed.key] = ledgerId;
    console.log(`  ✓ ${seed.label} (${ledgerId})`);
  }
  return ledgerIds;
}

async function seedContacts(ledgerIds: Record<LedgerKey, string>) {
  console.log("\n📝 関係者データを投入中...");
  for (const { ledger, ...contact } of testContacts) {
    const { error } = await supabase.from("contacts").upsert({
      ...contact,
      owner_user_id: TEST_USER_ID,
      ledger_id: ledgerIds[ledger],
      is_name_private: false,
      is_address_private: false,
      is_occupation_private: false,
    }, { onConflict: "id" });
    check(error, `contacts ${contact.name}`);
    console.log(`  ✓ ${contact.name}`);
  }
}

async function seedJournals(ledgerIds: Record<LedgerKey, string>) {
  console.log("\n📝 仕訳データを投入中...");
  for (const { ledger, ...journal } of testJournals) {
    // 既存の仕訳は台帳・起票者を変更できない（journals_guard_immutable_columns）ので作成のみ
    const { error } = await supabase.from("journals").upsert({
      ...journal,
      ledger_id: ledgerIds[ledger],
      status: "approved",
      submitted_by_user_id: TEST_USER_ID,
      approved_by_user_id: TEST_USER_ID,
    }, { onConflict: "id", ignoreDuplicates: true });
    check(error, `journals ${journal.description}`);
    console.log(`  ✓ ${journal.description}`);
  }
}

async function seedJournalEntries() {
  console.log("\n📝 仕訳明細データを投入中...");
  for (const entry of testJournalEntries) {
    const { error } = await supabase
      .from("journal_entries")
      .upsert(entry, { onConflict: "id" });
    check(error, `journal_entries ${entry.account_code}`);
    console.log(
      `  ✓ ${entry.account_code} (${
        entry.debit_amount || entry.credit_amount
      }円)`,
    );
  }
}

async function seedData() {
  await seedProfile();
  await seedPoliticians();
  await seedOrganizations();
  await seedElections();
  const ledgerIds = await seedLedgers();
  await seedContacts(ledgerIds);
  await seedJournals(ledgerIds);
  await seedJournalEntries();
}

async function seedAll() {
  console.log("🌱 Ledger テストデータのシード開始...\n");
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);

  // 1. テストユーザー作成
  const userCreated = await createTestUser();
  if (!userCreated) {
    console.error("\n❌ テストユーザー作成に失敗しました。処理を中断します。");
    Deno.exit(1);
  }

  // 2. マスター・台帳・トランザクションデータ
  await seedData();

  console.log("\n✅ シード完了！");
  console.log("\n📋 テストユーザー情報:");
  console.log(`   Email: ${TEST_USER_EMAIL}`);
  console.log(`   Password: ${TEST_USER_PASSWORD}`);
  console.log(`   User ID: ${TEST_USER_ID}`);
}

async function seedUserOnly() {
  console.log("🌱 テストユーザーのみ作成...\n");
  await createTestUser();
  console.log("\n✅ 完了！");
}

async function seedDataOnly() {
  console.log("🌱 ダミーデータのみ投入（テストユーザー既存前提）...\n");
  await seedData();
  console.log("\n✅ 完了！");
}

// ============================================
// メイン処理
// ============================================

const args = Deno.args;
const option = args[0] || "--all";

try {
  switch (option) {
    case "--user":
      await seedUserOnly();
      break;
    case "--data":
      await seedDataOnly();
      break;
    case "--all":
    default:
      await seedAll();
      break;
  }
} catch (error) {
  console.error(
    "\n❌ シードに失敗しました:",
    error instanceof Error ? error.message : error,
  );
  Deno.exit(1);
}
