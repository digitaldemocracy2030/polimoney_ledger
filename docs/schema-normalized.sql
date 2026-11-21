-- Polimoney Ledger - 正規化後スキーマ（v5）
-- 中間テーブル導入 + ledgers テーブル追加

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- プロフィール（Auth 補助情報）
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    hub_politician_id UUID,              -- Hub 側の politicians.id
    avatar_url TEXT,
    tos_accepted_at TIMESTAMPTZ,
    privacy_policy_accepted_at TIMESTAMPTZ,
    verified_email_domain TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- マスタ系
-- ============================================

-- 政治団体
CREATE TABLE IF NOT EXISTS political_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    hub_organization_id UUID,            -- Hub 側の organizations.id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 政治家
CREATE TABLE IF NOT EXISTS politicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 選挙（politician_id を削除 → politician_elections 中間テーブルに移行）
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    -- politician_id 削除: politician_elections 中間テーブルに移行
    election_name TEXT NOT NULL,
    election_date DATE NOT NULL,
    hub_politician_id UUID,              -- Hub 側の politicians.id（SPECIFICATION 2.6）
    hub_election_id UUID,                -- Hub 側の elections.id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 中間テーブル（新規 — Hub と同じ構造）
-- ============================================

-- 政治家 ↔ 政治団体（多対多）
CREATE TABLE IF NOT EXISTS politician_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    politician_id UUID NOT NULL REFERENCES politicians(id),
    organization_id UUID NOT NULL REFERENCES political_organizations(id),
    hub_politician_organization_id UUID, -- Hub 側の politician_organizations.id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (politician_id, organization_id)
);

-- 政治家 ↔ 選挙（多対多）
CREATE TABLE IF NOT EXISTS politician_elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    politician_id UUID NOT NULL REFERENCES politicians(id),
    election_id UUID NOT NULL REFERENCES elections(id),
    hub_politician_election_id UUID,     -- Hub 側の politician_elections.id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (politician_id, election_id)
);

-- ============================================
-- 台帳（新規 — Hub の public_ledgers に対応）
-- ============================================

CREATE TABLE IF NOT EXISTS ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    ledger_type TEXT NOT NULL,           -- 'political_fund' | 'election_fund'
    politician_organization_id UUID REFERENCES politician_organizations(id),
    politician_election_id UUID REFERENCES politician_elections(id),
    hub_ledger_id UUID,                  -- Hub 側の public_ledgers.id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_ledger_type CHECK (
        (ledger_type = 'political_fund' AND politician_organization_id IS NOT NULL AND politician_election_id IS NULL)
        OR
        (ledger_type = 'election_fund' AND politician_election_id IS NOT NULL AND politician_organization_id IS NULL)
    )
);

-- ============================================
-- 補助科目
-- ============================================

CREATE TABLE IF NOT EXISTS sub_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    ledger_type TEXT NOT NULL,
    parent_account_code TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 関係者（台帳に紐付け）
-- ============================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    ledger_id UUID REFERENCES ledgers(id),           -- 台帳への紐付け
    contact_type TEXT NOT NULL,                       -- 'person', 'corporation', 'political_organization'
    name TEXT NOT NULL,
    address TEXT,
    occupation TEXT,
    hub_organization_id UUID,                        -- Hub の政治団体ID（political_organization タイプの場合）
    -- プライバシー設定
    is_name_private BOOLEAN NOT NULL DEFAULT FALSE,
    is_address_private BOOLEAN NOT NULL DEFAULT FALSE,
    is_occupation_private BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_reason_type TEXT,                        -- 'personal_info', 'other'
    privacy_reason_other TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 仕訳（台帳に紐付け）
-- ============================================

CREATE TABLE IF NOT EXISTS journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID REFERENCES ledgers(id) NOT NULL,  -- organization_id/election_id を廃止
    journal_date DATE NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,                             -- 'draft', 'approved'
    submitted_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
    approved_by_user_id UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,                         -- 承認日時（status='approved' になった時刻）
    contact_id UUID REFERENCES contacts(id),
    classification TEXT,                             -- 'pre-campaign', 'campaign'
    non_monetary_basis TEXT,
    notes TEXT,
    amount_political_grant INTEGER DEFAULT 0,
    amount_political_fund INTEGER DEFAULT 0,
    amount_public_subsidy INTEGER DEFAULT 0,
    is_receipt_hard_to_collect BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_hard_to_collect_reason TEXT,
    is_asset_acquisition BOOLEAN NOT NULL DEFAULT FALSE, -- 資産取得仕訳（資産一覧に表示）
    asset_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 仕訳明細
-- ============================================

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE NOT NULL,
    account_code TEXT NOT NULL,
    sub_account_id UUID REFERENCES sub_accounts(id),
    debit_amount INTEGER NOT NULL DEFAULT 0,
    credit_amount INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- メディア（領収証・証憑添付）
-- ============================================

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES auth.users(id),
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_journal ON media_assets(journal_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user ON media_assets(uploaded_by_user_id);

-- ============================================
-- 台帳メンバー（台帳に紐付け）
-- ============================================

CREATE TABLE IF NOT EXISTS ledger_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    ledger_id UUID REFERENCES ledgers(id) NOT NULL,  -- organization_id/election_id を廃止
    role TEXT NOT NULL,                               -- 'admin', 'accountant', 'approver', 'submitter', 'viewer'
    invited_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ledger_members_ledger_user_unique UNIQUE (ledger_id, user_id)
);

-- ============================================
-- オーナーシップ移行
-- ============================================

CREATE TABLE IF NOT EXISTS ownership_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES auth.users(id) NOT NULL,
    to_user_id UUID REFERENCES auth.users(id) NOT NULL,
    ledger_id UUID REFERENCES ledgers(id) ON DELETE CASCADE, -- 譲渡対象の台帳
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'declined')),
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 取引下書き（台帳に紐付け）
-- ============================================

CREATE TABLE IF NOT EXISTS transaction_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    ledger_id UUID REFERENCES ledgers(id),           -- organization_id/election_id を廃止
    transaction_date DATE NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    counterparty TEXT,
    source_type TEXT NOT NULL,
    source_account_name TEXT,
    source_transaction_id TEXT,
    source_raw_data JSONB,
    suggested_account_code TEXT,
    suggested_contact_id UUID REFERENCES contacts(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'converted', 'ignored')),
    converted_journal_id UUID REFERENCES journals(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_user_id, source_type, source_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_drafts_owner ON transaction_drafts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON transaction_drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_date ON transaction_drafts(transaction_date);

-- ============================================
-- 年度締めステータス（台帳に紐付け）
-- ============================================

CREATE TABLE IF NOT EXISTS ledger_year_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE, -- organization_id を廃止
    fiscal_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'closed', 'locked', 'temporary_unlock')),
    closed_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    storage_migrated_at TIMESTAMPTZ,
    temporary_unlock_at TIMESTAMPTZ,
    temporary_unlock_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ledger_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_year_closures_ledger ON ledger_year_closures(ledger_id);
CREATE INDEX IF NOT EXISTS idx_year_closures_status ON ledger_year_closures(status);
CREATE INDEX IF NOT EXISTS idx_year_closures_fiscal_year ON ledger_year_closures(fiscal_year);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE political_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE politician_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE politician_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_year_closures ENABLE ROW LEVEL SECURITY;

-- RLS ポリシーとヘルパー関数は db/migrate-rls-user-scoped-api.sql で定義する
-- （ledger_members ベースのメンバーシップ。このファイルの適用後に実行すること）。
-- ポリシーが無い状態ではユーザーの JWT からは全テーブルが読み書きできない。
