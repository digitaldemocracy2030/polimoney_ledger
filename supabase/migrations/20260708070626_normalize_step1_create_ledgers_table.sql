-- Ledger 正規化 Step 1: ledgers テーブル作成
-- Ledger には politicians テーブルがないため、
-- Hub の ID を直接参照する設計にする

CREATE TABLE IF NOT EXISTS ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    ledger_type TEXT NOT NULL,  -- 'political_fund' | 'election_fund'
    -- 政治資金台帳の場合: 政治団体への参照
    organization_id UUID REFERENCES political_organizations(id),
    -- 選挙台帳の場合: 選挙への参照
    election_id UUID REFERENCES elections(id),
    -- Hub 側の ID
    hub_ledger_id UUID,
    hub_politician_organization_id UUID,  -- Hub の politician_organizations.id
    hub_politician_election_id UUID,      -- Hub の politician_elections.id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_ledger_type CHECK (
        (ledger_type = 'political_fund' AND organization_id IS NOT NULL AND election_id IS NULL)
        OR
        (ledger_type = 'election_fund' AND election_id IS NOT NULL AND organization_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_ledgers_owner ON ledgers(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_type ON ledgers(ledger_type);
CREATE INDEX IF NOT EXISTS idx_ledgers_org ON ledgers(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_election ON ledgers(election_id);

-- RLS
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own ledgers" ON ledgers;
CREATE POLICY "Users can CRUD their own ledgers" ON ledgers
    FOR ALL USING (auth.uid() = owner_user_id);;
