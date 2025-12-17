# polimoney_ledger

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

1. [Supabase の公式サイト](https://supabase.com/)にアクセスし、アカウントを作成してログインします。
2. 「New Project」ボタンを押し、組織（Organization）を選択します。
3. プロジェクト名（例: `polimoney-ledger`）を決め、データベースのパスワードを**安全な場所に**保存します。
4. リージョン（サーバーの場所）を選択し、「Create new project」をクリックします。プロジェクトの準備が完了するまで数分待ちます。

### Step 2: 認証メールを「コード形式」に変更する (UI 操作)

ユーザー登録時に、確認用の 6 桁の数字コードがメールで送られるように、メールのテンプレートを修正します。

1. プロジェクトのダッシュボードで、左側のメニューから**Authentication（南京錠のアイコン）**をクリックします。
2. 左側の認証設定メニューから「**Emails**」をクリックします。
3. リストの中から「**Confirm sign up**」タブを見つけ、クリックしてエディタを開きます。
4. **件名（Subject）**と**本文（Body）**を、以下のように書き換えてください。（コピー＆ペーストを推奨します）

   - **件名 (Subject):**

     ```text
     Polimoney Ledger: 本人確認を完了してください
     ```

   - **本文 (Message):**

     ```html
     <h2>本人確認を完了してください</h2>
     <p>あなたの本人確認コードは次の通りです。</p>
     <h1>{{ .Token }}</h1>
     <p>このコードをアプリケーションの画面で入力してください。</p>
     ```

5. 右下の「**Save changes**」ボタンを押して保存します。

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
  amount_public_subsidy integer default 0,  -- 【v3.11追加】公費負担額
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


-- 2. 勘定科目マスターテーブルの作成
create table if not exists account_master (
  code text primary key,
  name text not null,
  type text not null, -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'subsidy'
  report_category text not null,
  available_ledger_types text[] not null, -- array of 'political_organization', 'election'
  is_public_subsidy_eligible boolean default false -- 公費負担対象かどうか（選挙運動費用）
);

-- 3. カラム追加（既存テーブルへの対応、IF NOT EXISTSで新規・既存どちらでも安全）
ALTER TABLE journals ADD COLUMN IF NOT EXISTS amount_public_subsidy integer DEFAULT 0;
ALTER TABLE account_master ADD COLUMN IF NOT EXISTS is_public_subsidy_eligible boolean DEFAULT false;

-- 4. 勘定科目マスターへの初期データ投入 【v3.11 全面更新】
-- 政治資金規正法・公職選挙法に基づく全科目
-- (何度実行しても安全なように ON CONFLICT DO NOTHING を使用)

-- === 資産科目 ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('ASSET_CASH', '現金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_BANK', '普通預金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_SAVINGS', '定期預金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_PREPAID', '前払金', 'asset', '資産', '{"political_organization", "election"}'),
('ASSET_DEPOSIT', '敷金・保証金', 'asset', '資産', '{"political_organization", "election"}')
ON CONFLICT (code) DO NOTHING;

-- === 負債科目 ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('LIAB_LOAN', '借入金', 'liability', '負債', '{"political_organization", "election"}'),
('LIAB_ACCOUNTS_PAYABLE', '未払金', 'liability', '負債', '{"political_organization", "election"}')
ON CONFLICT (code) DO NOTHING;

-- === 純資産科目 ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('EQUITY_CAPITAL', '元入金', 'equity', '純資産', '{"political_organization", "election"}'),
('EQUITY_CARRYOVER', '前年繰越額', 'equity', '純資産', '{"political_organization", "election"}')
ON CONFLICT (code) DO NOTHING;

-- === 収入科目（政治団体用） ===
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

-- === 収入科目（選挙運動用） ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('REV_SELF_FINANCING', '自己資金', 'revenue', 'その他の収入', '{"election"}'),
('REV_LOAN_ELEC', '借入金', 'revenue', 'その他の収入', '{"election"}'),
('REV_DONATION_INDIVIDUAL_ELEC', '個人からの寄附', 'revenue', '寄附', '{"election"}'),
('REV_DONATION_POLITICAL_ELEC', '政治団体からの寄附', 'revenue', '寄附', '{"election"}'),
('REV_MISC_ELEC', 'その他の収入', 'revenue', 'その他の収入', '{"election"}')
ON CONFLICT (code) DO NOTHING;

-- === 支出科目（経常経費 - 政治団体用） ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('EXP_PERSONNEL', '人件費', 'expense', '経常経費', '{"political_organization"}'),
('EXP_UTILITIES', '光熱水費', 'expense', '経常経費', '{"political_organization"}'),
('EXP_SUPPLIES', '備品・消耗品費', 'expense', '経常経費', '{"political_organization"}'),
('EXP_OFFICE', '事務所費', 'expense', '経常経費', '{"political_organization"}')
ON CONFLICT (code) DO NOTHING;

-- === 支出科目（政治活動費 - 政治団体用） ===
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

-- === 支出科目（選挙運動費用 - 公職選挙法10費目） ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types, is_public_subsidy_eligible) VALUES
('EXP_PERSONNEL_ELEC', '人件費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_BUILDING_ELEC', '家屋費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_COMMUNICATION_ELEC', '通信費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_TRANSPORT_ELEC', '交通費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_PRINTING_ELEC', '印刷費', 'expense', '選挙運動費用', '{"election"}', true),
('EXP_ADVERTISING_ELEC', '広告費', 'expense', '選挙運動費用', '{"election"}', true),
('EXP_STATIONERY_ELEC', '文具費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_FOOD_ELEC', '食料費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_LODGING_ELEC', '休泊費', 'expense', '選挙運動費用', '{"election"}', false),
('EXP_MISC_ELEC', '雑費', 'expense', '選挙運動費用', '{"election"}', false)
ON CONFLICT (code) DO NOTHING;

-- === 公費負担（参考記録用） ===
INSERT INTO public.account_master (code, name, type, report_category, available_ledger_types) VALUES
('SUBSIDY_PUBLIC', '公費負担', 'subsidy', '公費負担', '{"election"}')
ON CONFLICT (code) DO NOTHING;

-- 5. パフォーマンス向上のためのインデックス作成
CREATE INDEX IF NOT EXISTS idx_journals_organization_id ON public.journals (organization_id);
CREATE INDEX IF NOT EXISTS idx_journals_election_id ON public.journals (election_id);
CREATE INDEX IF NOT EXISTS idx_journals_journal_date ON public.journals (journal_date);

-- 6. 行レベルセキュリティ(RLS)の有効化
alter table account_master enable row level security;
alter table political_organizations enable row level security;
alter table politicians enable row level security;
alter table elections enable row level security;
alter table contacts enable row level security;
alter table journals enable row level security;
alter table journal_entries enable row level security;
alter table ledger_members enable row level security;
alter table ownership_transfers enable row level security;

-- 7. RLSポリシー
-- account_masterは公開情報なので、認証済みユーザーなら誰でも読み取り可能
drop policy if exists "Allow read access to all authenticated users" on account_master;
create policy "Allow read access to all authenticated users" on account_master for select using (auth.role() = 'authenticated');


drop policy if exists "Users can CRUD their own organizations" on political_organizations;
create policy "Users can CRUD their own organizations" on political_organizations for all using (auth.uid() = owner_user_id);

drop policy if exists "Users can CRUD their own politicians" on politicians;
create policy "Users can CRUD their own politicians" on politicians for all using (auth.uid() = owner_user_id);

drop policy if exists "Users can CRUD their own elections" on elections;
create policy "Users can CRUD their own elections" on elections for all using (auth.uid() = owner_user_id);

drop policy if exists "Users can CRUD their own contacts" on contacts;
create policy "Users can CRUD their own contacts" on contacts for all using (auth.uid() = owner_user_id);

drop policy if exists "Allow individual read access" on ownership_transfers;
create policy "Allow individual read access" on ownership_transfers for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Allow individual update access" on ownership_transfers;
create policy "Allow individual update access" on ownership_transfers for update using (auth.uid() = to_user_id);

-- 8. データベース関数の作成
-- ユーザー数取得関数
create or replace function get_user_count()
returns integer language sql security definer as $$
  select count(*)::integer from auth.users;
$$;

-- ユーザー関連の政治団体を取得する関数
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS SETOF political_organizations AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.political_organizations WHERE owner_user_id = p_user_id
    UNION
    SELECT org.*
    FROM public.ledger_members mem
    JOIN public.political_organizations org ON mem.organization_id = org.id
    WHERE mem.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザー関連の選挙を取得する関数
CREATE OR REPLACE FUNCTION get_user_elections(p_user_id UUID)
RETURNS SETOF elections AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.elections WHERE owner_user_id = p_user_id
    UNION
    SELECT elec.*
    FROM public.ledger_members mem
    JOIN public.elections elec ON mem.election_id = elec.id
    WHERE mem.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 年度で仕訳を効率的に取得する関数
-- まず、古い定義の関数が存在する場合に備えて、安全に削除します。
 DROP FUNCTION IF EXISTS get_journals_by_year(uuid, text, integer);

 -- 新しい戻り値の形で関数を再作成します。
CREATE OR REPLACE FUNCTION get_journals_by_year(p_ledger_id UUID, p_ledger_type TEXT, p_year INT)
RETURNS TABLE (
    id uuid,
    organization_id uuid,
    election_id uuid,
    journal_date date,
    description text,
    status text,
    submitted_by_user_id uuid,
    approved_by_user_id uuid,
    contact_id uuid,
    classification text,
    non_monetary_basis text,
    notes text,
    amount_political_grant integer,
    amount_political_fund integer,
    is_receipt_hard_to_collect boolean,
    receipt_hard_to_collect_reason text,
    created_at timestamptz,
    total_amount integer -- dynamically calculated total
) AS $$
DECLARE
    start_date date;
    end_date date;
BEGIN
    start_date := make_date(p_year, 1, 1);
    end_date := make_date(p_year, 12, 31);

    IF p_ledger_type = 'political_organization' THEN
        RETURN QUERY
        SELECT
            j.*,
            (SELECT SUM(je.debit_amount) FROM public.journal_entries je WHERE je.journal_id = j.id) :: integer AS total_amount
        FROM
            public.journals j
        WHERE
            j.organization_id = p_ledger_id AND j.journal_date BETWEEN start_date AND end_date
        ORDER BY
            j.journal_date DESC;
    ELSE
        RETURN QUERY
        SELECT
            j.*,
            (SELECT SUM(je.debit_amount) FROM public.journal_entries je WHERE je.journal_id = j.id) :: integer AS total_amount
        FROM
            public.journals j
        WHERE
            j.election_id = p_ledger_id AND j.journal_date BETWEEN start_date AND end_date
        ORDER BY
            j.journal_date DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

### Step 4: アプリケーションの設定

最後に、作成した Supabase プロジェクトの情報をアプリケーションに設定します。

1. **接続情報の取得:**

   - Supabase のダッシュボードで、左側のメニュー下部にある**設定（歯車アイコン）**をクリックし、「**API**」を選択します。
   - `Project URL` と `anon` `public` と書かれた**API Key** の 2 つの情報をコピーします。

2. **アプリケーションの起動と設定:**

   - `polimoney_ledger`のアプリケーションを起動します。
   - 最初に表示される「Supabase 設定」画面で、先ほどコピーした`プロジェクトURL`と`Anonキー`をそれぞれ入力し、「保存して続行」ボタンを押します。

3. **マスターアカウントの作成:**
   - マスターアカウントの作成画面が表示されます。画面の指示に従って、マスターアカウントを作成してください。

---

## 開発者向け情報

### 🚧 アーキテクチャ移行について

このプロジェクトは **Flutter 版から Fresh (Deno) 版への移行を計画中**です。

| バージョン | 状態 | 場所 |
|-----------|------|------|
| **Flutter 版 (Legacy)** | 動作可能・保守モード | `legacy/flutter/` |
| **Fresh (Deno) 版** | 開発予定 | `packages/web/` (未作成) |

新規開発は Fresh (Deno) 版で行う予定です。詳細は以下を参照してください：

- **アーキテクチャ設計**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **機能仕様書**: [docs/SPECIFICATION.md](./docs/SPECIFICATION.md)

### Flutter 版 (Legacy) の開発

Flutter 版を使用する場合は、`legacy/flutter/` ディレクトリを参照してください。

```bash
cd legacy/flutter
flutter pub get
flutter run
```

詳細: [legacy/flutter/README.md](./legacy/flutter/README.md)

### Fresh (Deno) 版の開発（予定）

```bash
# Supabase ローカル起動
supabase start

# フロントエンド起動
cd packages/web && deno task start
```

詳細: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
