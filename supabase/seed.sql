-- =====================================================
-- Ledger ダミーデータ（正規化後スキーマ v5 / ユーザー権限 RLS 対応）
-- =====================================================
--
-- 前提:
-- - docs/schema-normalized.sql と db/migrate-rls-user-scoped-api.sql が適用済みであること
-- - テストユーザーが auth.users に存在すること（db/seed-supabase.ts --user で作成できる）
-- - postgres / service_role で実行すること（RLS を通らない）
--
-- テストユーザー ID: 00000000-0000-0000-0000-000000000001
--
-- RLS で見えるようにするため、すべての台帳（ledgers）をテストユーザーの所有とし、
-- オーナー自身を admin として ledger_members にも登録する（API の台帳作成と同じ形）。
-- 仕訳・関係者は ledger_id で台帳に紐付ける。
--
-- Hub 上の ID:
-- - 政治家ID: 11111111-1111-1111-1111-111111111111（山田太郎）
-- - 政治家ID: 22222222-2222-2222-2222-222222222222（佐藤花子）
-- （Hub 側の db/seed-supabase.ts / docs/TEST_DATA.md と同じ ID・名称）
-- - 団体ID: aaaa1111-1111-1111-1111-111111111111（山田太郎後援会）
-- - 団体ID: aaaa1111-2222-2222-2222-222222222222（山田太郎を応援する会）
--
-- 何度実行してもよい。既存の行（migrate-normalize.sql が作った台帳など）は自然キーで見つけて再利用する。
-- =====================================================

DO $$
DECLARE
    test_user CONSTANT UUID := '00000000-0000-0000-0000-000000000001';

    -- Ledger 内の政治家（台帳の紐付け用。Hub の政治家 ID と同じ値を使う）
    pol_taro CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
    pol_hanako CONSTANT UUID := '22222222-2222-2222-2222-222222222222';

    org_taro CONSTANT UUID := 'aaaa1111-1111-1111-1111-111111111111';
    org_taro_fund CONSTANT UUID := 'aaaa1111-2222-2222-2222-222222222222';
    elec_taro CONSTANT UUID := 'eeee1111-1111-1111-1111-111111111111';
    elec_hanako CONSTANT UUID := 'eeee2222-2222-2222-2222-222222222222';

    po_taro UUID;
    po_taro_fund UUID;
    pe_taro UUID;
    pe_hanako UUID;

    ledger_org_taro UUID;
    ledger_org_taro_fund UUID;
    ledger_elec_taro UUID;
    ledger_elec_hanako UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = test_user) THEN
        RAISE EXCEPTION 'テストユーザー % が auth.users にありません。先に db/seed-supabase.ts --user を実行してください', test_user;
    END IF;

    -- =================================================
    -- profiles（認証済み政治家）
    -- =================================================
    INSERT INTO public.profiles (id, hub_politician_id, tos_accepted_at, privacy_policy_accepted_at, verified_email_domain)
    VALUES (test_user, pol_taro, now(), now(), 'test-taro.example.jp')
    ON CONFLICT (id) DO UPDATE SET
        hub_politician_id = EXCLUDED.hub_politician_id,
        tos_accepted_at = COALESCE(public.profiles.tos_accepted_at, EXCLUDED.tos_accepted_at),
        privacy_policy_accepted_at = COALESCE(public.profiles.privacy_policy_accepted_at, EXCLUDED.privacy_policy_accepted_at),
        verified_email_domain = EXCLUDED.verified_email_domain;

    -- =================================================
    -- マスタ（政治家・政治団体・選挙）
    -- =================================================
    INSERT INTO public.politicians (id, owner_user_id, name)
    VALUES
        (pol_taro, test_user, '山田 太郎'),
        (pol_hanako, test_user, '佐藤 花子')
    ON CONFLICT (id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;

    INSERT INTO public.political_organizations (id, owner_user_id, name, hub_organization_id)
    VALUES
        (org_taro, test_user, '山田太郎後援会', org_taro),
        (org_taro_fund, test_user, '山田太郎を応援する会', org_taro_fund)
    ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        hub_organization_id = EXCLUDED.hub_organization_id;

    INSERT INTO public.elections (id, owner_user_id, hub_politician_id, election_name, election_date, hub_election_id)
    VALUES
        (elec_taro, test_user, pol_taro, '2024年 第50回衆議院議員総選挙（テスト）', '2024-10-27', NULL),
        (elec_hanako, test_user, pol_hanako, '令和7年東京都知事選挙（テスト）', '2025-07-06', NULL)
    ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        hub_politician_id = EXCLUDED.hub_politician_id;

    -- =================================================
    -- 中間テーブル（政治家 ↔ 政治団体 / 選挙）
    -- =================================================
    INSERT INTO public.politician_organizations (id, politician_id, organization_id)
    VALUES
        ('a0001111-1111-1111-1111-111111111111', pol_taro, org_taro),
        ('a0002222-2222-2222-2222-222222222222', pol_taro, org_taro_fund)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.politician_elections (id, politician_id, election_id)
    VALUES
        ('e0001111-1111-1111-1111-111111111111', pol_taro, elec_taro),
        ('e0002222-2222-2222-2222-222222222222', pol_hanako, elec_hanako)
    ON CONFLICT DO NOTHING;

    SELECT id INTO po_taro FROM public.politician_organizations
    WHERE politician_id = pol_taro AND organization_id = org_taro;
    SELECT id INTO po_taro_fund FROM public.politician_organizations
    WHERE politician_id = pol_taro AND organization_id = org_taro_fund;
    SELECT id INTO pe_taro FROM public.politician_elections
    WHERE politician_id = pol_taro AND election_id = elec_taro;
    SELECT id INTO pe_hanako FROM public.politician_elections
    WHERE politician_id = pol_hanako AND election_id = elec_hanako;

    -- =================================================
    -- 台帳（既にあれば再利用し、オーナーをテストユーザーにそろえる）
    -- =================================================
    SELECT id INTO ledger_org_taro FROM public.ledgers
    WHERE politician_organization_id = po_taro ORDER BY created_at LIMIT 1;
    IF ledger_org_taro IS NULL THEN
        ledger_org_taro := '1ed01111-1111-1111-1111-111111111111';
        INSERT INTO public.ledgers (id, owner_user_id, ledger_type, politician_organization_id)
        VALUES (ledger_org_taro, test_user, 'political_fund', po_taro);
    END IF;

    SELECT id INTO ledger_org_taro_fund FROM public.ledgers
    WHERE politician_organization_id = po_taro_fund ORDER BY created_at LIMIT 1;
    IF ledger_org_taro_fund IS NULL THEN
        ledger_org_taro_fund := '1ed02222-2222-2222-2222-222222222222';
        INSERT INTO public.ledgers (id, owner_user_id, ledger_type, politician_organization_id)
        VALUES (ledger_org_taro_fund, test_user, 'political_fund', po_taro_fund);
    END IF;

    SELECT id INTO ledger_elec_taro FROM public.ledgers
    WHERE politician_election_id = pe_taro ORDER BY created_at LIMIT 1;
    IF ledger_elec_taro IS NULL THEN
        ledger_elec_taro := '1ed03333-3333-3333-3333-333333333333';
        INSERT INTO public.ledgers (id, owner_user_id, ledger_type, politician_election_id)
        VALUES (ledger_elec_taro, test_user, 'election_fund', pe_taro);
    END IF;

    SELECT id INTO ledger_elec_hanako FROM public.ledgers
    WHERE politician_election_id = pe_hanako ORDER BY created_at LIMIT 1;
    IF ledger_elec_hanako IS NULL THEN
        ledger_elec_hanako := '1ed04444-4444-4444-4444-444444444444';
        INSERT INTO public.ledgers (id, owner_user_id, ledger_type, politician_election_id)
        VALUES (ledger_elec_hanako, test_user, 'election_fund', pe_hanako);
    END IF;

    UPDATE public.ledgers SET owner_user_id = test_user
    WHERE id IN (ledger_org_taro, ledger_org_taro_fund, ledger_elec_taro, ledger_elec_hanako);

    -- =================================================
    -- 台帳メンバー（オーナー自身を admin として登録）
    -- =================================================
    INSERT INTO public.ledger_members (user_id, ledger_id, role, invited_by_user_id)
    SELECT test_user, l.id, 'admin', test_user
    FROM unnest(ARRAY[ledger_org_taro, ledger_org_taro_fund, ledger_elec_taro, ledger_elec_hanako]) AS l(id)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.ledger_members m
        WHERE m.ledger_id = l.id AND m.user_id = test_user
    );

    UPDATE public.ledger_members SET role = 'admin'
    WHERE user_id = test_user
      AND ledger_id IN (ledger_org_taro, ledger_org_taro_fund, ledger_elec_taro, ledger_elec_hanako);

    -- =================================================
    -- contacts（台帳に紐付け）
    -- =================================================
    INSERT INTO public.contacts (id, owner_user_id, ledger_id, contact_type, name, address, occupation)
    VALUES
        -- 選挙台帳（山田太郎）用の関係者
        ('cccc1111-1111-1111-1111-111111111111', test_user, ledger_elec_taro, 'person', '山田 一郎', '東京都渋谷区〇〇1-2-3', '会社員'),
        ('cccc2222-2222-2222-2222-222222222222', test_user, ledger_elec_taro, 'corporation', '株式会社テスト印刷', '東京都新宿区△△4-5-6', NULL),
        ('cccc3333-3333-3333-3333-333333333333', test_user, ledger_elec_taro, 'corporation', '〇〇不動産', '東京都千代田区××7-8-9', NULL),
        -- 政治団体台帳（山田太郎後援会）用の関係者
        ('cccc4444-4444-4444-4444-444444444444', test_user, ledger_org_taro, 'person', '山田 一郎', '東京都渋谷区〇〇1-2-3', '会社員'),
        ('cccc5555-5555-5555-5555-555555555555', test_user, ledger_org_taro, 'corporation', '株式会社テスト印刷', '東京都新宿区△△4-5-6', NULL)
    ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        ledger_id = EXCLUDED.ledger_id;

    -- =================================================
    -- journals（仕訳）
    -- =================================================
    INSERT INTO public.journals (id, ledger_id, journal_date, description, status, submitted_by_user_id, approved_by_user_id, contact_id, classification, notes)
    VALUES
        -- 選挙台帳の仕訳
        ('dddd1111-1111-1111-1111-111111111111', ledger_elec_taro, '2024-10-01', '選挙ポスター印刷', 'approved', test_user, test_user, 'cccc2222-2222-2222-2222-222222222222', 'campaign', 'A1サイズ 500枚'),
        ('dddd1111-2222-2222-2222-222222222222', ledger_elec_taro, '2024-10-05', '個人寄附', 'approved', test_user, test_user, 'cccc1111-1111-1111-1111-111111111111', 'pre-campaign', NULL),
        ('dddd1111-3333-3333-3333-333333333333', ledger_elec_taro, '2024-10-15', '選挙事務所借り上げ', 'approved', test_user, test_user, 'cccc3333-3333-3333-3333-333333333333', 'campaign', '10/1~10/31'),
        -- 政治団体台帳の仕訳
        ('dddd2222-1111-1111-1111-111111111111', ledger_org_taro, '2024-04-15', '会費収入', 'approved', test_user, test_user, 'cccc4444-4444-4444-4444-444444444444', NULL, '年会費'),
        ('dddd2222-2222-2222-2222-222222222222', ledger_org_taro, '2024-05-01', '事務用品購入', 'approved', test_user, test_user, 'cccc5555-5555-5555-5555-555555555555', NULL, 'コピー用紙、文房具')
    ON CONFLICT (id) DO NOTHING;

    -- =================================================
    -- journal_entries（仕訳明細）
    -- =================================================
    INSERT INTO public.journal_entries (id, journal_id, account_code, debit_amount, credit_amount)
    VALUES
        -- 選挙ポスター印刷（支出）
        ('ff001111-1111-1111-1111-111111111111', 'dddd1111-1111-1111-1111-111111111111', 'EXP_PRINTING_ELEC', 150000, 0),
        ('ff001111-1111-1111-2222-222222222222', 'dddd1111-1111-1111-1111-111111111111', 'ASSET_CASH', 0, 150000),
        -- 個人寄附（収入）
        ('ff001111-2222-2222-1111-111111111111', 'dddd1111-2222-2222-2222-222222222222', 'ASSET_CASH', 50000, 0),
        ('ff001111-2222-2222-2222-222222222222', 'dddd1111-2222-2222-2222-222222222222', 'REV_DONATION_INDIVIDUAL_ELEC', 0, 50000),
        -- 選挙事務所借り上げ（支出）
        ('ff001111-3333-3333-1111-111111111111', 'dddd1111-3333-3333-3333-333333333333', 'EXP_BUILDING_ELEC', 80000, 0),
        ('ff001111-3333-3333-2222-222222222222', 'dddd1111-3333-3333-3333-333333333333', 'ASSET_CASH', 0, 80000),
        -- 会費収入
        ('ff002222-1111-1111-1111-111111111111', 'dddd2222-1111-1111-1111-111111111111', 'ASSET_CASH', 10000, 0),
        ('ff002222-1111-1111-2222-222222222222', 'dddd2222-1111-1111-1111-111111111111', 'REV_MEMBERSHIP_FEE', 0, 10000),
        -- 事務用品購入
        ('ff002222-2222-2222-1111-111111111111', 'dddd2222-2222-2222-2222-222222222222', 'EXP_SUPPLIES', 5000, 0),
        ('ff002222-2222-2222-2222-222222222222', 'dddd2222-2222-2222-2222-222222222222', 'ASSET_CASH', 0, 5000)
    ON CONFLICT (id) DO NOTHING;
END $$;
