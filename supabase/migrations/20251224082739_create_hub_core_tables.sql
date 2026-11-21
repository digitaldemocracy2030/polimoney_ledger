-- ============================================
-- Hub DB コアテーブル作成
-- ============================================

-- 市区町村マスタ（総務省 全国地方公共団体コード）
CREATE TABLE IF NOT EXISTS municipalities (
    code VARCHAR(6) PRIMARY KEY,
    prefecture_name VARCHAR(10) NOT NULL,
    city_name VARCHAR(50),
    prefecture_name_kana VARCHAR(20),
    city_name_kana VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙区マスタ
CREATE TABLE IF NOT EXISTS districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL,
    prefecture_codes VARCHAR(50),
    municipality_code VARCHAR(6) REFERENCES municipalities(code),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 政治家マスタ
CREATE TABLE IF NOT EXISTS politicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_kana VARCHAR(255),
    party TEXT,
    official_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 政治団体マスタ
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    politician_id UUID REFERENCES politicians(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙マスタ（Hub用）
CREATE TABLE IF NOT EXISTS hub_elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    district_id UUID REFERENCES districts(id),
    election_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- マスタ更新日時
CREATE TABLE IF NOT EXISTS master_metadata (
    table_name VARCHAR(50) PRIMARY KEY,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 勘定科目マスタ
CREATE TABLE IF NOT EXISTS account_codes (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_kana VARCHAR(100),
    type VARCHAR(20) NOT NULL,
    report_category VARCHAR(50) NOT NULL,
    ledger_type VARCHAR(20) NOT NULL DEFAULT 'both',
    is_public_subsidy_eligible BOOLEAN DEFAULT FALSE,
    display_order INT NOT NULL,
    polimoney_category VARCHAR(50),
    parent_code VARCHAR(50) REFERENCES account_codes(code),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙タイプマスタ
CREATE TABLE IF NOT EXISTS election_types (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    display_order INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 公開用台帳
CREATE TABLE IF NOT EXISTS public_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id),
    organization_id UUID REFERENCES organizations(id),
    election_id UUID REFERENCES hub_elections(id),
    fiscal_year INT NOT NULL,
    total_income INT DEFAULT 0,
    total_expense INT DEFAULT 0,
    journal_count INT DEFAULT 0,
    ledger_source_id UUID NOT NULL UNIQUE,
    is_test BOOLEAN DEFAULT FALSE,
    last_updated_at TIMESTAMPTZ NOT NULL,
    first_synced_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 公開用仕訳
CREATE TABLE IF NOT EXISTS public_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL REFERENCES public_ledgers(id),
    journal_source_id UUID NOT NULL UNIQUE,
    date DATE,
    description TEXT,
    amount INT NOT NULL,
    contact_name TEXT,
    contact_type VARCHAR(20),
    account_code VARCHAR(50),
    classification VARCHAR(20),
    non_monetary_basis TEXT,
    note TEXT,
    public_expense_amount INT,
    content_hash VARCHAR(64) NOT NULL,
    is_test BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_districts_type ON districts(type);
CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians(name);
CREATE INDEX IF NOT EXISTS idx_public_ledgers_politician ON public_ledgers(politician_id);
CREATE INDEX IF NOT EXISTS idx_public_ledgers_fiscal_year ON public_ledgers(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_public_journals_ledger ON public_journals(ledger_id);
CREATE INDEX IF NOT EXISTS idx_public_journals_date ON public_journals(date);

-- 初期メタデータ
INSERT INTO master_metadata (table_name, last_updated_at)
VALUES 
    ('municipalities', NOW()),
    ('districts', NOW()),
    ('hub_elections', NOW()),
    ('politicians', NOW()),
    ('organizations', NOW()),
    ('account_codes', NOW()),
    ('election_types', NOW())
ON CONFLICT (table_name) DO NOTHING;;
