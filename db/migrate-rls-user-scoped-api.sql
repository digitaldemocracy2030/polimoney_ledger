-- ============================================
-- Polimoney Ledger: ユーザー権限 API 向け RLS マイグレーション
-- ============================================
--
-- 背景:
--   Ledger API（apps/api）は service_role ではなく、リクエストしたユーザーの JWT 付き
--   クライアント（c.get("supabase")）で DB にアクセスする。従来のポリシーはオーナー
--   （owner_user_id）限定で、journals / journal_entries / ledger_members にはポリシーが
--   無かったため、台帳メンバーの操作がすべて RLS で拒否されていた。
--
-- メンバーシップモデル（docs/schema-normalized.sql）:
--   - ledgers.owner_user_id がオーナー（暗黙の admin）
--   - ledger_members(user_id, ledger_id, role) が招待メンバー
--   - 政治団体台帳: ledgers.politician_organization_id -> politician_organizations -> political_organizations
--   - 選挙台帳:     ledgers.politician_election_id     -> politician_elections     -> elections
--
-- ロールと権限は packages/shared/src/permissions.ts と同じ定義を SQL 側にも持つ
-- （public.role_has_permission）。片方を変えたらもう片方も変えること。
--
-- 適用順（新規環境）:
--   1. docs/schema-normalized.sql
--   2. db/migrate-add-storage.sql（バケット作成）
--   3. このファイル
--   4. supabase/seed.sql または db/seed-supabase.ts（テストデータ）
--
-- 冪等: 何度実行してもよい。対象テーブルの既存ポリシーはすべて削除して作り直す
-- （ライブ DB に手で足したポリシーが残って権限が広がるのを防ぐため）。
-- ============================================

BEGIN;

-- ============================================
-- 1. API が前提とする列・インデックス
-- ============================================

-- 選挙台帳の Hub 政治家 ID（SPECIFICATION 2.6。POST/GET /elections が使う）
ALTER TABLE public.elections ADD COLUMN IF NOT EXISTS hub_politician_id UUID;

-- 資産取得仕訳（GET /elections/:id/assets・/organizations/:id/assets が使う）
ALTER TABLE public.journals
    ADD COLUMN IF NOT EXISTS is_asset_acquisition BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS asset_type TEXT;

-- 承認日時（POST /journals の即時登録・POST /journals/:id/approve が設定する）
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 譲渡対象の台帳（/ownership-transfers・/dashboard が使う）
ALTER TABLE public.ownership_transfers
    ADD COLUMN IF NOT EXISTS ledger_id UUID REFERENCES public.ledgers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_ledger_status
    ON public.ownership_transfers(ledger_id, status);

-- 台帳メンバーは 1 台帳につき 1 ユーザー 1 行（ロール判定を一意にするため）
-- 既存の重複は最も古い行を残して削除する
DELETE FROM public.ledger_members a
USING public.ledger_members b
WHERE a.ledger_id = b.ledger_id
  AND a.user_id = b.user_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ledger_members_ledger_user_unique'
    ) THEN
        ALTER TABLE public.ledger_members
            ADD CONSTRAINT ledger_members_ledger_user_unique UNIQUE (ledger_id, user_id);
    END IF;
END $$;

-- ポリシーとヘルパー関数の検索用
CREATE INDEX IF NOT EXISTS idx_ledgers_owner ON public.ledgers(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_politician_organization
    ON public.ledgers(politician_organization_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_politician_election
    ON public.ledgers(politician_election_id);
CREATE INDEX IF NOT EXISTS idx_ledger_members_user_ledger
    ON public.ledger_members(user_id, ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledger_members_ledger ON public.ledger_members(ledger_id);
CREATE INDEX IF NOT EXISTS idx_journals_ledger_date ON public.journals(ledger_id, journal_date);
CREATE INDEX IF NOT EXISTS idx_journals_contact ON public.journals(contact_id);
CREATE INDEX IF NOT EXISTS idx_journals_submitted_by ON public.journals(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_journal ON public.journal_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ledger ON public.contacts(ledger_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_owner ON public.sub_accounts(owner_user_id);

-- ============================================
-- 2. ヘルパー関数
-- ============================================
-- ポリシーから他テーブル（RLS 付き）を直接参照すると、ポリシーの連鎖・再帰が起きる。
-- SECURITY DEFINER の関数に閉じ込め、常に auth.uid() 本人についてだけ答える。
-- 注意: STABLE 関数は呼び出し元の文の開始時点のスナップショットを見るため、
-- 同じ文で INSERT した行は見えない。INSERT ... RETURNING で評価される SELECT ポリシーには
-- 行自身の列で判定できる条件（owner_user_id = auth.uid() など）を必ず並べること。

-- ロールが権限を持つか（packages/shared/src/permissions.ts の rolePermissions と同じ）
CREATE OR REPLACE FUNCTION public.role_has_permission(p_role TEXT, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        CASE p_permission
            WHEN 'viewLedger' THEN
                p_role IN ('admin', 'accountant', 'approver', 'submitter', 'viewer')
            WHEN 'submitJournal' THEN
                p_role IN ('admin', 'accountant', 'approver', 'submitter')
            WHEN 'manageContacts' THEN
                p_role IN ('admin', 'accountant', 'approver', 'submitter')
            WHEN 'approveJournal' THEN
                p_role IN ('admin', 'accountant', 'approver')
            WHEN 'registerJournal' THEN
                p_role IN ('admin', 'accountant')
            WHEN 'editLedgerSettings' THEN
                p_role IN ('admin', 'accountant')
            WHEN 'manageMembers' THEN
                p_role = 'admin'
            ELSE FALSE
        END,
        FALSE
    );
$$;

-- 呼び出したユーザーの台帳ロール（オーナーは 'admin'、メンバーは ledger_members.role、
-- どちらでもなければ NULL）。未知のロール文字列は roleFromString と同じく 'viewer' 扱い。
CREATE OR REPLACE FUNCTION public.ledger_role(p_ledger_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL OR p_ledger_id IS NULL THEN NULL
        WHEN EXISTS (
            SELECT 1 FROM public.ledgers l
            WHERE l.id = p_ledger_id AND l.owner_user_id = auth.uid()
        ) THEN 'admin'
        ELSE (
            SELECT CASE
                WHEN m.role IN ('admin', 'accountant', 'approver', 'submitter', 'viewer')
                    THEN m.role
                ELSE 'viewer'
            END
            FROM public.ledger_members m
            WHERE m.ledger_id = p_ledger_id AND m.user_id = auth.uid()
            ORDER BY CASE m.role
                WHEN 'admin' THEN 1
                WHEN 'accountant' THEN 2
                WHEN 'approver' THEN 3
                WHEN 'submitter' THEN 4
                ELSE 5
            END
            LIMIT 1
        )
    END;
$$;

-- 台帳のオーナーまたはメンバーか
CREATE OR REPLACE FUNCTION public.is_ledger_member(p_ledger_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND p_ledger_id IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.ledgers l
            WHERE l.id = p_ledger_id AND l.owner_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.ledger_members m
            WHERE m.ledger_id = p_ledger_id AND m.user_id = auth.uid()
        )
    );
$$;

-- 台帳に対して権限を持つか
CREATE OR REPLACE FUNCTION public.has_ledger_permission(p_ledger_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.role_has_permission(public.ledger_role(p_ledger_id), p_permission);
$$;

-- 仕訳の台帳 ID（journals の RLS を経由せずに引く）
CREATE OR REPLACE FUNCTION public.journal_ledger_id(p_journal_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT j.ledger_id FROM public.journals j WHERE j.id = p_journal_id;
$$;

-- 仕訳の年度が書き込み可能か（未締め or 一時解除中）。SPECIFICATION 7.3
CREATE OR REPLACE FUNCTION public.is_fiscal_year_writable(p_ledger_id UUID, p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.ledger_year_closures c
        WHERE c.ledger_id = p_ledger_id
          AND c.fiscal_year = EXTRACT(YEAR FROM p_date)::INTEGER
          AND c.status IN ('closed', 'locked')
    );
$$;

-- 既存の仕訳（とその明細）を変更・削除できるか（apps/api/routes/journals.ts の assertCanModify と同じ）
-- - 承認済み: registerJournal
-- - 下書き:   approveJournal、または起票者本人（submitJournal）
-- いずれも年度が締め済みでないこと
CREATE OR REPLACE FUNCTION public.can_modify_journal(p_journal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.journals j
        WHERE j.id = p_journal_id
          AND public.is_fiscal_year_writable(j.ledger_id, j.journal_date)
          AND (
              public.has_ledger_permission(j.ledger_id, 'registerJournal')
              OR (
                  j.status = 'draft'
                  AND public.has_ledger_permission(j.ledger_id, 'approveJournal')
              )
              OR (
                  j.status = 'draft'
                  AND j.submitted_by_user_id = auth.uid()
                  AND public.has_ledger_permission(j.ledger_id, 'submitJournal')
              )
          )
    );
$$;

-- 関係者が、自分が所属する台帳の仕訳から参照されているか（仕訳への contacts 埋め込み用）
CREATE OR REPLACE FUNCTION public.is_contact_used_in_my_ledgers(p_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.journals j
        WHERE j.contact_id = p_contact_id
          AND public.is_ledger_member(j.ledger_id)
    );
$$;

-- 仕訳の関係者として台帳で使えるか（apps/api/lib/authz.ts の assertContactUsableInLedger と同じ）
-- - 台帳に紐付いた関係者
-- - 台帳オーナーが作成した、台帳に紐付いていない関係者
-- - その台帳の仕訳で既に使われている関係者（オーナー譲渡前の旧オーナーの関係者など）
-- 他の台帳の関係者を仕訳に紐付けて、is_contact_used_in_my_ledgers 経由で読み出すのを防ぐ。
CREATE OR REPLACE FUNCTION public.is_contact_usable_in_ledger(p_contact_id UUID, p_ledger_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p_contact_id IS NULL OR EXISTS (
        SELECT 1
        FROM public.contacts ct
        JOIN public.ledgers l ON l.id = p_ledger_id
        WHERE ct.id = p_contact_id
          AND (
              ct.ledger_id = l.id
              OR (ct.ledger_id IS NULL AND ct.owner_user_id = l.owner_user_id)
          )
    ) OR EXISTS (
        SELECT 1 FROM public.journals j
        WHERE j.contact_id = p_contact_id AND j.ledger_id = p_ledger_id
    );
$$;

-- 補助科目が、自分が所属する台帳の仕訳明細から参照されているか
-- （オーナー譲渡後も、旧オーナーの補助科目名を台帳メンバーが読めるようにする）
CREATE OR REPLACE FUNCTION public.is_sub_account_used_in_my_ledgers(p_sub_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.journal_entries je
        JOIN public.journals j ON j.id = je.journal_id
        WHERE je.sub_account_id = p_sub_account_id
          AND public.is_ledger_member(j.ledger_id)
    );
$$;

-- 仕訳明細の補助科目として台帳で使えるか（apps/api/lib/authz.ts の assertSubAccountsUsableInLedger と同じ）
-- - 台帳オーナーの補助科目
-- - その台帳の仕訳明細で既に使われている補助科目（オーナー譲渡前の旧オーナーの補助科目など）
CREATE OR REPLACE FUNCTION public.is_sub_account_usable_in_ledger(p_sub_account_id UUID, p_ledger_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p_sub_account_id IS NULL OR EXISTS (
        SELECT 1
        FROM public.sub_accounts sa
        JOIN public.ledgers l ON l.id = p_ledger_id
        WHERE sa.id = p_sub_account_id AND sa.owner_user_id = l.owner_user_id
    ) OR EXISTS (
        SELECT 1
        FROM public.journal_entries je
        JOIN public.journals j ON j.id = je.journal_id
        WHERE je.sub_account_id = p_sub_account_id AND j.ledger_id = p_ledger_id
    );
$$;

-- 指定ユーザーがオーナーの台帳に、自分が所属しているか
-- （sub_accounts は台帳単位ではなく「オーナー + 台帳タイプ」単位のため）
CREATE OR REPLACE FUNCTION public.is_member_of_ledger_owned_by(p_owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL AND (
        p_owner_user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.ledgers l
            JOIN public.ledger_members m ON m.ledger_id = l.id
            WHERE l.owner_user_id = p_owner_user_id
              AND m.user_id = auth.uid()
        )
    );
$$;

-- 政治家 ↔ 政治団体の紐付けを、それを使う台帳のメンバーとして閲覧できるか
CREATE OR REPLACE FUNCTION public.can_view_politician_organization(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.ledgers l
        WHERE l.politician_organization_id = p_id
          AND public.is_ledger_member(l.id)
    );
$$;

-- 政治家 ↔ 選挙の紐付けを、それを使う台帳のメンバーとして閲覧できるか
CREATE OR REPLACE FUNCTION public.can_view_politician_election(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.ledgers l
        WHERE l.politician_election_id = p_id
          AND public.is_ledger_member(l.id)
    );
$$;

-- 政治団体を、その台帳のメンバーとして閲覧できるか
CREATE OR REPLACE FUNCTION public.can_view_political_organization(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.politician_organizations po
        JOIN public.ledgers l ON l.politician_organization_id = po.id
        WHERE po.organization_id = p_organization_id
          AND public.is_ledger_member(l.id)
    );
$$;

-- 選挙を、その台帳のメンバーとして閲覧できるか
CREATE OR REPLACE FUNCTION public.can_view_election(p_election_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.politician_elections pe
        JOIN public.ledgers l ON l.politician_election_id = pe.id
        WHERE pe.election_id = p_election_id
          AND public.is_ledger_member(l.id)
    );
$$;

-- ヘルパーは authenticated からのみ使う（ポリシーの評価にも EXECUTE 権限が必要）
DO $$
DECLARE
    fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'public.role_has_permission(text, text)',
        'public.ledger_role(uuid)',
        'public.is_ledger_member(uuid)',
        'public.has_ledger_permission(uuid, text)',
        'public.journal_ledger_id(uuid)',
        'public.is_fiscal_year_writable(uuid, date)',
        'public.can_modify_journal(uuid)',
        'public.is_contact_used_in_my_ledgers(uuid)',
        'public.is_contact_usable_in_ledger(uuid, uuid)',
        'public.is_sub_account_used_in_my_ledgers(uuid)',
        'public.is_sub_account_usable_in_ledger(uuid, uuid)',
        'public.is_member_of_ledger_owned_by(uuid)',
        'public.can_view_politician_organization(uuid)',
        'public.can_view_politician_election(uuid)',
        'public.can_view_political_organization(uuid)',
        'public.can_view_election(uuid)'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END LOOP;
END $$;

-- メールアドレスから auth.users.id を引く（メンバー招待用）。
-- 他人のメールアドレスの存在確認になるため service_role 専用（API が manageMembers を確認してから呼ぶ）
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO service_role;

-- ============================================
-- 3. 不変列ガード
-- ============================================
-- UPDATE の WITH CHECK は変更前の行を参照できないため、変更前後の比較が必要な制約は
-- トリガーで行う。

-- 仕訳:
--   - 台帳の付け替え・起票者の書き換えは禁止（service_role にも適用。API はこれらを変更しない）
--   - ユーザー（authenticated）による承認者の記録の改ざんを禁止する
--     - 承認済みのまま approved_by_user_id / approved_at を変えることはできない
--     - 下書き -> 承認 のときの approved_by_user_id は自分でなければならない
CREATE OR REPLACE FUNCTION public.journals_guard_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.ledger_id IS DISTINCT FROM OLD.ledger_id THEN
        RAISE EXCEPTION '仕訳の台帳は変更できません';
    END IF;
    IF NEW.submitted_by_user_id IS DISTINCT FROM OLD.submitted_by_user_id THEN
        RAISE EXCEPTION '仕訳の起票者は変更できません';
    END IF;
    IF current_user = 'authenticated' THEN
        IF OLD.status = 'approved' AND NEW.status = 'approved' AND (
            NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
            OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        ) THEN
            RAISE EXCEPTION '承認済み仕訳の承認者は変更できません';
        END IF;
        IF NEW.status = 'approved'
            AND OLD.status IS DISTINCT FROM 'approved'
            AND NEW.approved_by_user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION '承認者は自分自身でなければなりません';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journals_guard_immutable_columns ON public.journals;
CREATE TRIGGER journals_guard_immutable_columns
    BEFORE UPDATE ON public.journals
    FOR EACH ROW EXECUTE FUNCTION public.journals_guard_immutable_columns();

-- 関係者: 台帳の付け替え（特に NULL 化して台帳の権限チェックから外すこと）と作成者の書き換えを禁止する
CREATE OR REPLACE FUNCTION public.contacts_guard_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.ledger_id IS DISTINCT FROM OLD.ledger_id THEN
        RAISE EXCEPTION '関係者の台帳は変更できません';
    END IF;
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
        RAISE EXCEPTION '関係者の作成者は変更できません';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_guard_immutable_columns ON public.contacts;
CREATE TRIGGER contacts_guard_immutable_columns
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.contacts_guard_immutable_columns();

-- ============================================
-- 4. RLS 有効化・権限付与・既存ポリシーの削除
-- ============================================

DO $$
DECLARE
    t TEXT;
    pol RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles',
        'political_organizations',
        'politicians',
        'elections',
        'politician_organizations',
        'politician_elections',
        'ledgers',
        'ledger_members',
        'sub_accounts',
        'contacts',
        'journals',
        'journal_entries',
        'media_assets',
        'ownership_transfers',
        'transaction_drafts',
        'ledger_year_closures'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
            t
        );
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- 台帳の構造（政治家・政治団体・選挙・その紐付け・台帳）はユーザーが直接書き込めない。
-- hub_organization_id / hub_politician_id / hub_election_id / hub_politician_organization_id /
-- hub_politician_election_id / hub_ledger_id は Hub 上の実在の政治家・政治団体の名義で
-- 公開データを同期するための ID なので、ユーザーが任意の値を入れられると他人の名義で
-- 偽の収支を公開できてしまう。
-- 作成は API が Hub で認証済み政治家・団体管理者であることを確認した後に service client で行い、
-- オーナー譲渡・Hub 同期の記録も API が authz 確認後に service client で行う。
REVOKE INSERT, UPDATE, DELETE ON
    public.politicians,
    public.political_organizations,
    public.elections,
    public.politician_organizations,
    public.politician_elections,
    public.ledgers
FROM anon, authenticated;

-- profiles: hub_politician_id / verified_email_domain は Hub の承認結果（service_role のみが書く）。
-- ユーザーが書けるのは利用規約・プライバシーポリシーの同意日時などに限る。
-- （PostgREST の upsert は ON CONFLICT DO UPDATE で id も SET するため UPDATE (id) も付ける。
--   id は RLS で auth.uid() に固定される）
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, avatar_url, tos_accepted_at, privacy_policy_accepted_at, updated_at)
    ON public.profiles TO authenticated;
GRANT UPDATE (id, avatar_url, tos_accepted_at, privacy_policy_accepted_at, updated_at)
    ON public.profiles TO authenticated;

-- media_assets は登録・削除のみ（storage_path を書き換えられないよう UPDATE は付けない）
REVOKE UPDATE ON public.media_assets FROM anon, authenticated;

-- 旧バージョンで台帳作成のチェックに使っていた関数（ユーザーの直接作成をやめたため不要）
DROP FUNCTION IF EXISTS public.owns_politician_organization(UUID);
DROP FUNCTION IF EXISTS public.owns_politician_election(UUID);

-- ============================================
-- 5. テーブルごとのポリシー
-- ============================================
-- 方針: ARCHITECTURE.md 4.2 と同じく ledger_members を介したアクセス制御。
--   閲覧（SELECT）  : 台帳のオーナー / メンバー全員（viewer 含む）
--   仕訳の起票      : submitJournal（submitter 以上）。下書きのみ
--   仕訳の即時登録  : registerJournal（admin / accountant）
--   仕訳の承認      : approveJournal（approver 以上）。自分の起票は registerJournal のみ
--   メンバー管理    : manageMembers（admin = オーナーまたは admin メンバー）
--   年度締め        : editLedgerSettings（admin / accountant）
--   台帳の作成      : ユーザーは不可。API が Hub で認証済み政治家・団体管理者であることを
--                     確認した後に service client で作成する（hub_* 列の偽装を防ぐ）
-- ポリシーに無い操作は拒否。service_role は RLS を通らない（API は authz 確認後のみ使う）。

-- --------------------------------------------
-- profiles: 本人の行のみ（書き込める列は 4 節の列単位 GRANT で制限）
-- --------------------------------------------
CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_insert_own ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- --------------------------------------------
-- 台帳の構造（politicians / political_organizations / elections /
-- politician_organizations / politician_elections / ledgers）: ユーザーは閲覧のみ。
-- 作成・オーナー譲渡・Hub 同期の記録は API が authz 確認後に service client で行う
-- （4 節で INSERT / UPDATE / DELETE 権限を REVOKE 済み）。
-- --------------------------------------------

-- politicians: Ledger 内の政治家（台帳作成時の紐付け用）。オーナーのみ閲覧
CREATE POLICY politicians_select_owner ON public.politicians
    FOR SELECT TO authenticated
    USING (owner_user_id = (SELECT auth.uid()));

-- political_organizations: オーナーと台帳メンバーが閲覧
CREATE POLICY political_organizations_select ON public.political_organizations
    FOR SELECT TO authenticated
    USING (
        owner_user_id = (SELECT auth.uid())
        OR public.can_view_political_organization(id)
    );

-- elections: オーナーと台帳メンバーが閲覧
CREATE POLICY elections_select ON public.elections
    FOR SELECT TO authenticated
    USING (
        owner_user_id = (SELECT auth.uid())
        OR public.can_view_election(id)
    );

-- politician_organizations: 自分の政治家の紐付けと、台帳メンバーが閲覧
CREATE POLICY politician_organizations_select ON public.politician_organizations
    FOR SELECT TO authenticated
    USING (
        politician_id IN (
            SELECT p.id FROM public.politicians p
            WHERE p.owner_user_id = (SELECT auth.uid())
        )
        OR public.can_view_politician_organization(id)
    );

-- politician_elections: 同上
CREATE POLICY politician_elections_select ON public.politician_elections
    FOR SELECT TO authenticated
    USING (
        politician_id IN (
            SELECT p.id FROM public.politicians p
            WHERE p.owner_user_id = (SELECT auth.uid())
        )
        OR public.can_view_politician_election(id)
    );

-- ledgers: オーナーとメンバーが閲覧
CREATE POLICY ledgers_select_members ON public.ledgers
    FOR SELECT TO authenticated
    USING (
        owner_user_id = (SELECT auth.uid())
        OR public.is_ledger_member(id)
    );

-- --------------------------------------------
-- ledger_members: 自分の行と、同じ台帳のメンバーを閲覧。manageMembers で招待・変更・削除
-- オーナー本人のメンバー行は変更・削除できない。
-- （招待は auth.admin を使うため、現状の API は service client で書き込む）
-- --------------------------------------------
CREATE POLICY ledger_members_select ON public.ledger_members
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR public.is_ledger_member(ledger_id)
    );

CREATE POLICY ledger_members_insert_manager ON public.ledger_members
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_ledger_permission(ledger_id, 'manageMembers')
        AND role IN ('admin', 'accountant', 'approver', 'submitter', 'viewer')
        AND invited_by_user_id = (SELECT auth.uid())
    );

CREATE POLICY ledger_members_update_manager ON public.ledger_members
    FOR UPDATE TO authenticated
    USING (
        public.has_ledger_permission(ledger_id, 'manageMembers')
        AND user_id IS DISTINCT FROM (
            SELECT l.owner_user_id FROM public.ledgers l WHERE l.id = ledger_id
        )
    )
    WITH CHECK (
        public.has_ledger_permission(ledger_id, 'manageMembers')
        AND role IN ('admin', 'accountant', 'approver', 'submitter', 'viewer')
        AND user_id IS DISTINCT FROM (
            SELECT l.owner_user_id FROM public.ledgers l WHERE l.id = ledger_id
        )
    );

CREATE POLICY ledger_members_delete_manager ON public.ledger_members
    FOR DELETE TO authenticated
    USING (
        public.has_ledger_permission(ledger_id, 'manageMembers')
        AND user_id IS DISTINCT FROM (
            SELECT l.owner_user_id FROM public.ledgers l WHERE l.id = ledger_id
        )
    );

-- --------------------------------------------
-- sub_accounts: オーナーは CRUD。オーナーの台帳のメンバーは閲覧
-- （補助科目は台帳単位ではなく「オーナー + 台帳タイプ」単位）
-- 仕訳明細から参照されている補助科目は、その台帳のメンバーが閲覧（オーナー譲渡後の旧オーナーの補助科目）
-- --------------------------------------------
CREATE POLICY sub_accounts_select ON public.sub_accounts
    FOR SELECT TO authenticated
    USING (
        owner_user_id = (SELECT auth.uid())
        OR public.is_member_of_ledger_owned_by(owner_user_id)
        OR public.is_sub_account_used_in_my_ledgers(id)
    );

CREATE POLICY sub_accounts_insert_owner ON public.sub_accounts
    FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY sub_accounts_update_owner ON public.sub_accounts
    FOR UPDATE TO authenticated
    USING (owner_user_id = (SELECT auth.uid()))
    WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY sub_accounts_delete_owner ON public.sub_accounts
    FOR DELETE TO authenticated
    USING (owner_user_id = (SELECT auth.uid()));

-- --------------------------------------------
-- contacts:
--   台帳に紐づかない関係者: 作成者（owner_user_id）が CRUD
--   台帳に紐づく関係者:     台帳メンバーが閲覧、manageContacts で編集・削除
--                           （作成者でも台帳の権限が無ければ編集・削除できない）
--   仕訳から参照されている関係者は、その台帳のメンバーが閲覧（仕訳への埋め込み用）。
--   ledger_id / owner_user_id の変更は contacts_guard_immutable_columns トリガーで禁止。
-- --------------------------------------------
CREATE POLICY contacts_select ON public.contacts
    FOR SELECT TO authenticated
    USING (
        owner_user_id = (SELECT auth.uid())
        OR (ledger_id IS NOT NULL AND public.is_ledger_member(ledger_id))
        OR public.is_contact_used_in_my_ledgers(id)
    );

CREATE POLICY contacts_insert ON public.contacts
    FOR INSERT TO authenticated
    WITH CHECK (
        owner_user_id = (SELECT auth.uid())
        AND (
            ledger_id IS NULL
            OR public.has_ledger_permission(ledger_id, 'manageContacts')
        )
    );

CREATE POLICY contacts_update ON public.contacts
    FOR UPDATE TO authenticated
    USING (
        (ledger_id IS NULL AND owner_user_id = (SELECT auth.uid()))
        OR (
            ledger_id IS NOT NULL
            AND public.has_ledger_permission(ledger_id, 'manageContacts')
        )
    )
    WITH CHECK (
        (ledger_id IS NULL AND owner_user_id = (SELECT auth.uid()))
        OR (
            ledger_id IS NOT NULL
            AND public.has_ledger_permission(ledger_id, 'manageContacts')
        )
    );

CREATE POLICY contacts_delete ON public.contacts
    FOR DELETE TO authenticated
    USING (
        (ledger_id IS NULL AND owner_user_id = (SELECT auth.uid()))
        OR (
            ledger_id IS NOT NULL
            AND public.has_ledger_permission(ledger_id, 'manageContacts')
        )
    );

-- --------------------------------------------
-- journals
-- --------------------------------------------

-- 閲覧: 台帳のオーナー / メンバー全員（ARCHITECTURE.md 4.2）
CREATE POLICY journals_select_members ON public.journals
    FOR SELECT TO authenticated
    USING (public.is_ledger_member(ledger_id));

-- 作成: 起票者は本人。下書きは submitJournal、承認済み（即時登録）は registerJournal
-- 関係者はその台帳で使えるもののみ（is_contact_usable_in_ledger）
CREATE POLICY journals_insert ON public.journals
    FOR INSERT TO authenticated
    WITH CHECK (
        submitted_by_user_id = (SELECT auth.uid())
        AND public.is_fiscal_year_writable(ledger_id, journal_date)
        AND public.is_contact_usable_in_ledger(contact_id, ledger_id)
        AND (
            (
                status = 'draft'
                AND approved_by_user_id IS NULL
                AND public.has_ledger_permission(ledger_id, 'submitJournal')
            )
            OR (
                status = 'approved'
                AND approved_by_user_id = (SELECT auth.uid())
                AND public.has_ledger_permission(ledger_id, 'registerJournal')
            )
        )
    );

-- 更新: 変更前の行が変更可能（can_modify_journal と同じ条件）で、変更後の行が次のいずれか
--   - registerJournal（承認済みのまま編集・即時承認を含む）
--   - 下書きのまま: approveJournal、または起票者本人（submitJournal）
--   - 承認: approveJournal で approved_by_user_id = 自分。自分の起票は registerJournal のみ（上）
-- 承認者の記録（approved_by_user_id / approved_at）の改ざんは journals_guard_immutable_columns で禁止。
-- 関係者はその台帳で使えるもののみ（is_contact_usable_in_ledger）
CREATE POLICY journals_update ON public.journals
    FOR UPDATE TO authenticated
    USING (
        public.is_fiscal_year_writable(ledger_id, journal_date)
        AND (
            public.has_ledger_permission(ledger_id, 'registerJournal')
            OR (
                status = 'draft'
                AND public.has_ledger_permission(ledger_id, 'approveJournal')
            )
            OR (
                status = 'draft'
                AND submitted_by_user_id = (SELECT auth.uid())
                AND public.has_ledger_permission(ledger_id, 'submitJournal')
            )
        )
    )
    WITH CHECK (
        public.is_fiscal_year_writable(ledger_id, journal_date)
        AND public.is_contact_usable_in_ledger(contact_id, ledger_id)
        AND (
            (
                public.has_ledger_permission(ledger_id, 'registerJournal')
                AND (
                    (status = 'draft' AND approved_by_user_id IS NULL)
                    OR (status = 'approved' AND approved_by_user_id IS NOT NULL)
                )
            )
            OR (
                status = 'draft'
                AND approved_by_user_id IS NULL
                AND (
                    public.has_ledger_permission(ledger_id, 'approveJournal')
                    OR (
                        submitted_by_user_id = (SELECT auth.uid())
                        AND public.has_ledger_permission(ledger_id, 'submitJournal')
                    )
                )
            )
            OR (
                status = 'approved'
                AND approved_by_user_id = (SELECT auth.uid())
                AND submitted_by_user_id <> (SELECT auth.uid())
                AND public.has_ledger_permission(ledger_id, 'approveJournal')
            )
        )
    );

-- 削除（下書きの却下を含む）: 更新と同じ条件
CREATE POLICY journals_delete ON public.journals
    FOR DELETE TO authenticated
    USING (
        public.is_fiscal_year_writable(ledger_id, journal_date)
        AND (
            public.has_ledger_permission(ledger_id, 'registerJournal')
            OR (
                status = 'draft'
                AND public.has_ledger_permission(ledger_id, 'approveJournal')
            )
            OR (
                status = 'draft'
                AND submitted_by_user_id = (SELECT auth.uid())
                AND public.has_ledger_permission(ledger_id, 'submitJournal')
            )
        )
    );

-- --------------------------------------------
-- journal_entries: 閲覧は親仕訳の台帳メンバー、書き込みは親仕訳を変更できるユーザー
-- 補助科目はその台帳で使えるもののみ（is_sub_account_usable_in_ledger）
-- --------------------------------------------
CREATE POLICY journal_entries_select_members ON public.journal_entries
    FOR SELECT TO authenticated
    USING (public.is_ledger_member(public.journal_ledger_id(journal_id)));

CREATE POLICY journal_entries_insert ON public.journal_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        public.can_modify_journal(journal_id)
        AND public.is_sub_account_usable_in_ledger(
            sub_account_id,
            public.journal_ledger_id(journal_id)
        )
    );

CREATE POLICY journal_entries_update ON public.journal_entries
    FOR UPDATE TO authenticated
    USING (public.can_modify_journal(journal_id))
    WITH CHECK (
        public.can_modify_journal(journal_id)
        AND public.is_sub_account_usable_in_ledger(
            sub_account_id,
            public.journal_ledger_id(journal_id)
        )
    );

CREATE POLICY journal_entries_delete ON public.journal_entries
    FOR DELETE TO authenticated
    USING (public.can_modify_journal(journal_id));

-- --------------------------------------------
-- media_assets（証憑）: 閲覧は台帳メンバー、登録・削除はアップロード本人（submitJournal）
-- 仕訳削除時の CASCADE は RLS を通らない。
-- storage_path は `{uploaded_by_user_id}/{journal_id}/...` に限る（API は service client で
-- このパスの署名付き URL 発行・削除を行うため、他人の証憑のパスを登録させない）。
-- UPDATE 権限は付けない（4 節）。
-- --------------------------------------------
CREATE POLICY media_assets_select ON public.media_assets
    FOR SELECT TO authenticated
    USING (
        uploaded_by_user_id = (SELECT auth.uid())
        OR public.is_ledger_member(public.journal_ledger_id(journal_id))
    );

CREATE POLICY media_assets_insert_uploader ON public.media_assets
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by_user_id = (SELECT auth.uid())
        AND split_part(storage_path, '/', 1) = (SELECT auth.uid())::text
        AND split_part(storage_path, '/', 2) = journal_id::text
        AND split_part(storage_path, '/', 3) <> ''
        AND strpos(storage_path, '..') = 0
        AND public.has_ledger_permission(
            public.journal_ledger_id(journal_id),
            'submitJournal'
        )
    );

CREATE POLICY media_assets_delete_uploader ON public.media_assets
    FOR DELETE TO authenticated
    USING (
        uploaded_by_user_id = (SELECT auth.uid())
        AND public.has_ledger_permission(
            public.journal_ledger_id(journal_id),
            'submitJournal'
        )
    );

-- --------------------------------------------
-- ownership_transfers: 当事者は閲覧、譲渡先は保留中の申請を拒否（declined）できる
-- 作成・キャンセル・承認は API が authz 確認後に service client で行う。
-- --------------------------------------------
CREATE POLICY ownership_transfers_select_parties ON public.ownership_transfers
    FOR SELECT TO authenticated
    USING (
        from_user_id = (SELECT auth.uid())
        OR to_user_id = (SELECT auth.uid())
    );

CREATE POLICY ownership_transfers_decline_recipient ON public.ownership_transfers
    FOR UPDATE TO authenticated
    USING (to_user_id = (SELECT auth.uid()) AND status = 'pending')
    WITH CHECK (to_user_id = (SELECT auth.uid()) AND status = 'declined');

-- --------------------------------------------
-- transaction_drafts: 作成者のみ（現状 API では未使用）
-- --------------------------------------------
CREATE POLICY transaction_drafts_all_owner ON public.transaction_drafts
    FOR ALL TO authenticated
    USING (owner_user_id = (SELECT auth.uid()))
    WITH CHECK (
        owner_user_id = (SELECT auth.uid())
        AND (ledger_id IS NULL OR public.is_ledger_member(ledger_id))
    );

-- --------------------------------------------
-- ledger_year_closures（年度締め）
--   閲覧: 台帳メンバー全員
--   締め（INSERT / upsert）: editLedgerSettings。status = closed のみ
--   更新: open / closed / temporary_unlock -> closed / locked のみ（締め・アーカイブ・再ロック）
--   削除（締め解除）: closed のみ
--   locked からの解除（temporary_unlock）は Hub Admin 承認後に service_role で行う
-- --------------------------------------------
CREATE POLICY ledger_year_closures_select_members ON public.ledger_year_closures
    FOR SELECT TO authenticated
    USING (public.is_ledger_member(ledger_id));

CREATE POLICY ledger_year_closures_insert ON public.ledger_year_closures
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_ledger_permission(ledger_id, 'editLedgerSettings')
        AND status = 'closed'
    );

CREATE POLICY ledger_year_closures_update ON public.ledger_year_closures
    FOR UPDATE TO authenticated
    USING (
        public.has_ledger_permission(ledger_id, 'editLedgerSettings')
        AND status IN ('open', 'closed', 'temporary_unlock')
    )
    WITH CHECK (
        public.has_ledger_permission(ledger_id, 'editLedgerSettings')
        AND status IN ('closed', 'locked')
    );

CREATE POLICY ledger_year_closures_delete ON public.ledger_year_closures
    FOR DELETE TO authenticated
    USING (
        public.has_ledger_permission(ledger_id, 'editLedgerSettings')
        AND status = 'closed'
    );

-- ============================================
-- 6. Storage
-- ============================================
-- API がユーザーの JWT で Storage を操作する箇所:
--   - receipts:               POST /receipts（upload / createSignedUrl / ロールバックの remove）、
--                             DELETE /receipts（remove）
--   - verification-documents: POST /upload（upload / createSignedUrl）
--   - public-images:          POST /upload/image（upload。getPublicUrl はポリシー不要）
-- いずれもパスの先頭フォルダ = 自分のユーザー ID。
-- 他メンバーの証憑の署名付き URL 発行・削除は API が authz 確認後に service client で行う。

-- 公開画像バケット（政治家写真・ロゴ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'public-images',
    'public-images',
    true,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- migrate-add-storage.sql のユーザー向けポリシーを冪等に作り直す
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own verification documents" ON storage.objects;
DROP POLICY IF EXISTS receipts_insert_own_folder ON storage.objects;
DROP POLICY IF EXISTS receipts_select_own_folder ON storage.objects;
DROP POLICY IF EXISTS receipts_delete_own_folder ON storage.objects;
DROP POLICY IF EXISTS verification_documents_insert_own_folder ON storage.objects;
DROP POLICY IF EXISTS verification_documents_select_own_folder ON storage.objects;
DROP POLICY IF EXISTS public_images_insert_own_folder ON storage.objects;

CREATE POLICY receipts_insert_own_folder ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY receipts_select_own_folder ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY receipts_delete_own_folder ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'receipts'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY verification_documents_insert_own_folder ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'verification-documents'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY verification_documents_select_own_folder ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'verification-documents'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY public_images_insert_own_folder ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'public-images'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

COMMIT;
