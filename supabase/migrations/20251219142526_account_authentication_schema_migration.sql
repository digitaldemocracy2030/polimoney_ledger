-- =====================================================
-- アカウント認証フローへの一括移行マイグレーション
-- =====================================================

-- =====================================================
-- Step 1: 既存データの削除（FK依存順）
-- =====================================================

-- journal_entries（journalsに依存）
DELETE FROM journal_entries;

-- media_assets（journalsに依存）
DELETE FROM media_assets;

-- journals（elections, political_organizations, contactsに依存）
DELETE FROM journals;

-- ownership_transfers（elections, political_organizationsに依存）
DELETE FROM ownership_transfers;

-- ledger_members（elections, political_organizationsに依存）
DELETE FROM ledger_members;

-- ledger_year_closures（political_organizationsに依存）
DELETE FROM ledger_year_closures;

-- elections（politiciansに依存）
DELETE FROM elections;

-- political_organizations
DELETE FROM political_organizations;

-- politicians
DELETE FROM politicians;

-- contacts
DELETE FROM contacts;

-- sub_accounts
DELETE FROM sub_accounts;

-- =====================================================
-- Step 2: politiciansテーブルの削除
-- =====================================================

-- elections.politician_idのFK制約を削除
ALTER TABLE elections DROP CONSTRAINT IF EXISTS elections_politician_id_fkey;

-- politiciansテーブルを削除
DROP TABLE IF EXISTS politicians;

-- =====================================================
-- Step 3: electionsテーブルの変更
-- =====================================================

-- politician_idをhub_politician_idにリネーム（Hub上のIDを格納、FK制約なし）
ALTER TABLE elections RENAME COLUMN politician_id TO hub_politician_id;

-- hub_election_idを追加（Hub上の選挙マスタIDを格納）
ALTER TABLE elections ADD COLUMN IF NOT EXISTS hub_election_id uuid;

-- =====================================================
-- Step 4: political_organizationsテーブルの変更
-- =====================================================

-- hub_organization_idを追加（Hub上の政治団体IDを格納）
ALTER TABLE political_organizations ADD COLUMN IF NOT EXISTS hub_organization_id uuid;

-- =====================================================
-- Step 5: profilesテーブルの変更
-- =====================================================

-- hub_politician_id（Hub上で認証済みの政治家ID）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hub_politician_id uuid;

-- tos_accepted_at（利用規約同意日時）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;

-- privacy_policy_accepted_at（プライバシーポリシー同意日時）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz;

-- verified_email_domain（認証済みドメイン）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_email_domain text;

-- =====================================================
-- Step 6: contactsテーブルの変更
-- owner_user_idはオーナーではなく台帳に紐づけるように変更
-- =====================================================

-- organization_idを追加（政治団体台帳に紐づけ）
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES political_organizations(id);

-- election_idを追加（選挙台帳に紐づけ）
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS election_id uuid REFERENCES elections(id);

-- =====================================================
-- Step 7: コメント追加
-- =====================================================

COMMENT ON COLUMN elections.hub_politician_id IS 'Hub DBのpoliticians.idを参照（FK制約なし、API検証）';
COMMENT ON COLUMN elections.hub_election_id IS 'Hub DBのelections.idを参照（任意、選挙マスタとの紐付け）';
COMMENT ON COLUMN political_organizations.hub_organization_id IS 'Hub DBのorganizations.idを参照（FK制約なし、API検証）';
COMMENT ON COLUMN profiles.hub_politician_id IS 'Hub DBで認証済みの政治家ID（NULL=未認証）';
COMMENT ON COLUMN profiles.tos_accepted_at IS '利用規約への同意日時（NULL=未同意）';
COMMENT ON COLUMN profiles.privacy_policy_accepted_at IS 'プライバシーポリシーへの同意日時';
COMMENT ON COLUMN profiles.verified_email_domain IS '公式メール認証済みドメイン';
;
