-- Step 2: 既存の journals から台帳を生成

-- 政治団体台帳: organization_id が設定されている journals からユニークな台帳を作成
INSERT INTO ledgers (owner_user_id, ledger_type, organization_id)
SELECT DISTINCT j.submitted_by_user_id, 'political_fund', j.organization_id
FROM journals j
WHERE j.organization_id IS NOT NULL;

-- 選挙台帳: election_id が設定されている journals からユニークな台帳を作成
INSERT INTO ledgers (owner_user_id, ledger_type, election_id)
SELECT DISTINCT j.submitted_by_user_id, 'election_fund', j.election_id
FROM journals j
WHERE j.election_id IS NOT NULL;

-- journals に ledger_id カラム追加
ALTER TABLE journals ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES ledgers(id);

-- 政治団体台帳の仕訳を紐付け
UPDATE journals j SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'political_fund'
      AND l.organization_id = j.organization_id
      AND l.owner_user_id = j.submitted_by_user_id
    LIMIT 1
)
WHERE j.organization_id IS NOT NULL AND j.ledger_id IS NULL;

-- 選挙台帳の仕訳を紐付け
UPDATE journals j SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'election_fund'
      AND l.election_id = j.election_id
      AND l.owner_user_id = j.submitted_by_user_id
    LIMIT 1
)
WHERE j.election_id IS NOT NULL AND j.ledger_id IS NULL;;
