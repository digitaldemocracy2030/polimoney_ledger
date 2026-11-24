-- 旧カラム削除（リトライ）

-- journals から organization_id / election_id 削除
ALTER TABLE journals DROP COLUMN IF EXISTS organization_id;
ALTER TABLE journals DROP COLUMN IF EXISTS election_id;

-- contacts から organization_id / election_id 削除
ALTER TABLE contacts DROP COLUMN IF EXISTS organization_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS election_id;

-- elections から hub_politician_id 削除
ALTER TABLE elections DROP COLUMN IF EXISTS hub_politician_id;

-- ledger_members から organization_id / election_id 削除
ALTER TABLE ledger_members DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE ledger_members DROP COLUMN IF EXISTS election_id CASCADE;

-- ledger_year_closures から organization_id 削除
ALTER TABLE ledger_year_closures DROP COLUMN IF EXISTS organization_id CASCADE;;
