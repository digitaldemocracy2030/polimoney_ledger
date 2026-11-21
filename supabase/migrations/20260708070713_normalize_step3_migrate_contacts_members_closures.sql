-- Step 3: contacts に ledger_id カラム追加 & データ移行

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES ledgers(id);

-- 選挙台帳の関係者を紐付け
UPDATE contacts c SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'election_fund'
      AND l.election_id = c.election_id
      AND l.owner_user_id = c.owner_user_id
    LIMIT 1
)
WHERE c.election_id IS NOT NULL AND c.ledger_id IS NULL;

-- 政治団体台帳の関係者を紐付け
UPDATE contacts c SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'political_fund'
      AND l.organization_id = c.organization_id
      AND l.owner_user_id = c.owner_user_id
    LIMIT 1
)
WHERE c.organization_id IS NOT NULL AND c.ledger_id IS NULL;

-- ledger_members に ledger_id カラム追加
ALTER TABLE ledger_members ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES ledgers(id);

UPDATE ledger_members lm SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'election_fund'
      AND l.election_id = lm.election_id
    LIMIT 1
)
WHERE lm.election_id IS NOT NULL AND lm.ledger_id IS NULL;

UPDATE ledger_members lm SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'political_fund'
      AND l.organization_id = lm.organization_id
    LIMIT 1
)
WHERE lm.organization_id IS NOT NULL AND lm.ledger_id IS NULL;

-- ledger_year_closures に ledger_id カラム追加
ALTER TABLE ledger_year_closures ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES ledgers(id);

UPDATE ledger_year_closures lyc SET ledger_id = (
    SELECT l.id FROM ledgers l
    WHERE l.ledger_type = 'political_fund'
      AND l.organization_id = lyc.organization_id
    LIMIT 1
)
WHERE lyc.organization_id IS NOT NULL AND lyc.ledger_id IS NULL;;
