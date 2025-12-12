# polimoney_ledger (AGENT PROPOSAL - DB Centric Accounts)

Polimoney へインポート可能な json と、政治資金収支報告書もしくは選挙運動費用収支報告書をエクスポートできる会計ソフトを目指します。

## 内容が古い場合があります

最新の情報に更新したいと思っていますが、特に外部サービスの内容はアップデートにより古くなりがちです。

気付いた場合はぜひコントリビュートしてください！

[コントリビュートガイド](./CONTRIBUTING.md)

## セットアップ方法

開発する場合はこちら（作成中）をごらんください。以下はノンエンジニア向けのガイドです。

### 準備

このプロダクトはオープンソースとして簡単に（GUI で）セットアップできるよう Supabase というサービスの使用を想定しています。

入力した収支等、Polimoney Ledger のデータは、基本的に Supabase に保存されます。

[Supabase の公式サイト](https://supabase.com/)より、Supabase に登録できます。

通常は無料プランで問題なくご使用いただけると思いますが、場合によっては有料となる場合があります。

**※有料となっても弊団体は一切責任を負えません。**

[参照: Supabase の料金プラン](https://supabase.com/pricing)

### Step 1: Supabase プロジェクトの作成

(内容は変更なし)

### Step 2: 認証メールを「コード形式」に変更する (UI 操作)

(内容は変更なし)

### Step 3: データベースを初期化する (SQL 実行)

アプリケーションが必要とするテーブルや関数を、以下の SQL で一度に作成します。

1. プロジェクトのダッシュボードで、左側のメニューから**SQL Editor**をクリックします。
2. 「**+**」ボタンを押し**Create a new snippet**をクリックします。
3. 以下の`-- ここから下を全てコピー --`から`-- ここまで --`までの SQL コードを**全てコピー**し、画面右側のエディタ画面に**貼り付け**ます。
4. 緑色の「**RUN**」ボタンをクリックします。「Success. No rows returned」と表示されれば成功です。

```sql
-- ここから下を全てコピー --
-- このスクリプトは何度実行しても安全です --

-- UUID拡張機能を有効化
create extension if not exists "uuid-ossp";

-- 1. テーブル作成
create table if not exists sub_accounts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id) not null,
  ledger_type text not null,
  parent_account_code text not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists political_organizations (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id) not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists politicians (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id) not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists elections (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id) not null,
  politician_id uuid references politicians(id) not null,
  election_name text not null,
  election_date date not null,
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id) not null,
  contact_type text not null,
  name text not null,
  address text,
  occupation text,
  is_name_private boolean default false,
  is_address_private boolean default false,
  is_occupation_private boolean default false,
  privacy_reason_type text,
  privacy_reason_other text,
  created_at timestamptz default now()
);

create table if not exists journals (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references political_organizations(id),
  election_id uuid references elections(id),
  journal_date date not null,
  description text not null,
  status text not null,
  submitted_by_user_id uuid references auth.users(id) not null,
  approved_by_user_id uuid references auth.users(id),
  contact_id uuid references contacts(id), -- v3.12: NULL許容（振替の場合は関係者不要）
  classification text,
  non_monetary_basis text,
  notes text,
  amount_political_grant integer default 0,
  amount_political_fund integer default 0,
  amount_public_subsidy integer default 0, -- v3.11: 公費負担額
  is_receipt_hard_to_collect boolean default false,
  receipt_hard_to_collect_reason text,
  created_at timestamptz default now()
);

create table if not exists journal_entries (
  id uuid primary key default uuid_generate_v4(),
  journal_id uuid references journals(id) on delete cascade not null,
  account_code text not null,
  sub_account_id uuid references sub_accounts(id),
  debit_amount integer default 0,
  credit_amount integer default 0
);

create table if not exists ledger_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  organization_id uuid references political_organizations(id),
  election_id uuid references elections(id),
  role text not null,
  invited_by_user_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

create table if not exists ownership_transfers (
  id uuid primary key default uuid_generate_v4(),
  from_user_id uuid references auth.users(id) not null,
  to_user_id uuid references auth.users(id) not null,
  status text not null check (status in ('pending', 'completed', 'declined')),
  requested_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ★★★ 新規追加 ★★★
-- 2. 勘定科目マスターテーブルの作成
create table if not exists account_master (
  code text primary key,
  name text not null,
  type text not null, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  report_category text not null,
  available_ledger_types text[] not null -- array of 'political_organization', 'election'
);

-- ★★★ v3.11対応 ★★★
-- 3. 勘定科目マスターへの初期データ投入
-- (何度実行しても安全なように ON CONFLICT DO NOTHING を使用)
-- SPECIFICATION.md v3.11 準拠

-- 資産科目
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('ASSET_CASH', '現金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_BANK', '普通預金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_SAVINGS', '定期預金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_PREPAID', '前払金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_DEPOSIT', '敷金・保証金', 'asset', '資産', '{"political_organization", "election"}')
ON CONFLICT (code) DO NOTHING;

-- 負債科目
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('LIAB_LOAN', '借入金', 'liability', '負債', '{"political_organization", "election"}'),
('LIAB_ACCOUNTS_PAYABLE', '未払金', 'liability', '負債', '{"political_organization", "election"}')
ON CONFLICT (code) DO NOTHING;

-- 純資産科目
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('EQUITY_CAPITAL', '元入金', 'equity', '純資産', '{"political_organization", "election"}'),
('EQUITY_CARRYOVER', '前年繰越額', 'equity', '純資産', '{"political_organization", "election"}')
ON CONFLICT (code) DO NOTHING;

-- 収入科目（政治団体用）
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('REV_MEMBERSHIP_FEE', '党費・会費', 'revenue', '党費・会費', '{"political_organization"}'),
('REV_DONATION_INDIVIDUAL', '個人からの寄附', 'revenue', '寄附', '{"political_organization"}'),
('REV_DONATION_CORPORATE', '法人その他の団体からの寄附', 'revenue', '寄附', '{"political_organization"}'),
('REV_DONATION_POLITICAL', '政治団体からの寄附', 'revenue', '寄附', '{"political_organization"}'),
('REV_ANONYMOUS', '政党匿名寄附', 'revenue', '寄附', '{"political_organization"}'),
('REV_MAGAZINE', '機関紙誌の発行事業収入', 'revenue', '事業収入', '{"political_organization"}'),
('REV_PARTY_EVENT', '政治資金パーティー収入', 'revenue', '事業収入', '{"political_organization"}'),
('REV_OTHER_BUSINESS', 'その他の事業収入', 'revenue', '事業収入', '{"political_organization"}'),
('REV_GRANT_HQ', '本部・支部からの交付金', 'revenue', '交付金', '{"political_organization"}'),
('REV_INTEREST', '利子収入', 'revenue', 'その他の収入', '{"political_organization"}'),
('REV_MISC', 'その他の収入', 'revenue', 'その他の収入', '{"political_organization"}')
ON CONFLICT (code) DO NOTHING;

-- 収入科目（選挙運動用）
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('REV_SELF_FINANCING', '自己資金', 'revenue', 'その他の収入', '{"election"}'),
('REV_LOAN_ELEC', '借入金', 'revenue', 'その他の収入', '{"election"}'),
('REV_DONATION_INDIVIDUAL_ELEC', '個人からの寄附', 'revenue', '寄附', '{"election"}'),
('REV_DONATION_POLITICAL_ELEC', '政治団体からの寄附', 'revenue', '寄附', '{"election"}'),
('REV_MISC_ELEC', 'その他の収入', 'revenue', 'その他の収入', '{"election"}')
ON CONFLICT (code) DO NOTHING;

-- 公費負担（参考記録用）
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('SUBSIDY_PUBLIC', '公費負担', 'subsidy', '公費負担', '{"election"}')
ON CONFLICT (code) DO NOTHING;

-- 支出科目（政治団体用：経常経費）
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('EXP_PERSONNEL', '人件費', 'expense', '経常経費', '{"political_organization"}'),
('EXP_UTILITIES', '光熱水費', 'expense', '経常経費', '{"political_organization"}'),
('EXP_SUPPLIES', '備品・消耗品費', 'expense', '経常経費', '{"political_organization"}'),
('EXP_OFFICE', '事務所費', 'expense', '経常経費', '{"political_organization"}')
ON CONFLICT (code) DO NOTHING;

-- 支出科目（政治団体用：政治活動費）
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('EXP_ORGANIZATION', '組織活動費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_ELECTION', '選挙関係費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_MAGAZINE', '機関紙誌の発行事業費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_PUBLICITY', '宣伝事業費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_PARTY_EVENT', '政治資金パーティー開催事業費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_OTHER_BUSINESS', 'その他の事業費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_RESEARCH', '調査研究費', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_DONATION', '寄附・交付金', 'expense', '政治活動費', '{"political_organization"}'),
('EXP_MISC', 'その他の経費', 'expense', '政治活動費', '{"political_organization"}')
ON CONFLICT (code) DO NOTHING;

-- 支出科目（選挙運動用：公職選挙法10費目）
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('EXP_PERSONNEL_ELEC', '人件費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_BUILDING_ELEC', '家屋費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_COMMUNICATION_ELEC', '通信費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_TRANSPORT_ELEC', '交通費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_PRINTING_ELEC', '印刷費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_ADVERTISING_ELEC', '広告費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_STATIONERY_ELEC', '文具費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_FOOD_ELEC', '食料費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_LODGING_ELEC', '休泊費', 'expense', '選挙運動費用', '{"election"}'),
('EXP_MISC_ELEC', '雑費', 'expense', '選挙運動費用', '{"election"}')
ON CONFLICT (code) DO NOTHING;

-- 4. パフォーマンス向上のためのインデックス作成 (変更なし)
CREATE INDEX IF NOT EXISTS idx_journals_organization_id ON public.journals (organization_id);
CREATE INDEX IF NOT EXISTS idx_journals_election_id ON public.journals (election_id);
CREATE INDEX IF NOT EXISTS idx_journals_journal_date ON public.journals (journal_date);

-- 5. 行レベルセキュリティ(RLS)の有効化 (account_master を追加)
alter table account_master enable row level security;
-- ... (他のテーブルのRLS有効化は変更なし) ...

-- 6. RLSポリシー (account_master を追加)
-- account_masterは公開情報なので、認証済みユーザーなら誰でも読み取り可能
drop policy if exists "Allow read access to all authenticated users" on account_master;
create policy "Allow read access to all authenticated users" on account_master for select using (auth.role() = 'authenticated');
-- ... (他のテーブルのRLSポリシーは変更なし) ...

-- 7. データベース関数の作成
-- ... (既存の関数は変更なし) ...
-- ★★★ 新規追加 ★★★
-- 前期繰越残高を計算する関数
CREATE OR REPLACE FUNCTION calculate_carry_over(p_ledger_id UUID, p_ledger_type TEXT, p_target_year INT)
RETURNS integer AS $$
DECLARE
    total integer;
BEGIN
    SELECT COALESCE(SUM(
        CASE
            WHEN am.type = 'asset' THEN (je.debit_amount - je.credit_amount)
            WHEN am.type = 'liability' THEN -(je.debit_amount - je.credit_amount)
            ELSE 0
        END
    ), 0)::integer
    INTO total
    FROM public.journals j
    JOIN public.journal_entries je ON j.id = je.journal_id
    JOIN public.account_master am ON je.account_code = am.code
    WHERE
        (CASE
            WHEN p_ledger_type = 'political_organization' THEN j.organization_id = p_ledger_id
            ELSE j.election_id = p_ledger_id
        END)
        AND j.journal_date < make_date(p_target_year, 1, 1);

    RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ここまで --
```

... (以降のセクションは変更なし) ...
