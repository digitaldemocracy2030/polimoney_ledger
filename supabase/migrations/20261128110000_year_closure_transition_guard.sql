-- 年度締めの状態の変更を、利用者の権限（authenticated）では決まった遷移だけに限る
--
-- 20261121100000 の UPDATE ポリシーは、変更前の状態（USING）と変更後の状態（WITH CHECK）を
-- 別々に見るだけなので、temporary_unlock -> closed が通り、closed は DELETE（締め解除）できる。
-- そのため、ロック解除の承認を一度受けると、PostgREST を直接呼んでアーカイブを恒久的に外せた。
-- RLS からは変更前と変更後の組み合わせが見えないので、トリガーで遷移を確かめる。
--
-- 利用者の権限で許す遷移（API の操作と同じ）:
--   open -> closed（年度締め）、closed -> locked（アーカイブ）、temporary_unlock -> locked（再ロック）
-- locked -> temporary_unlock と、期限切れでの temporary_unlock -> locked は API が service_role で行う。
-- unlock_request_id / unlock_expires_at は利用者の権限では変更できない。
--
-- あわせて、仕訳の書き込み可否（is_fiscal_year_writable）で一時解除の期限を見る。
-- 期限が過ぎた・期限の無い一時解除は書き込み不可（API が locked に戻す前でも）。

CREATE OR REPLACE FUNCTION public.enforce_year_closure_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- service_role（API の特権処理）・DB の管理者は対象外
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF NEW.unlock_request_id IS DISTINCT FROM OLD.unlock_request_id
       OR NEW.unlock_expires_at IS DISTINCT FROM OLD.unlock_expires_at THEN
        RAISE EXCEPTION 'ロック解除の記録は変更できません'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
           (OLD.status = 'open' AND NEW.status = 'closed')
           OR (OLD.status = 'closed' AND NEW.status = 'locked')
           OR (OLD.status = 'temporary_unlock' AND NEW.status = 'locked')
       ) THEN
        RAISE EXCEPTION '年度締めの状態を % から % には変更できません', OLD.status, NEW.status
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_year_closure_transition ON public.ledger_year_closures;
CREATE TRIGGER trg_year_closure_transition
    BEFORE UPDATE ON public.ledger_year_closures
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_year_closure_transition();

-- 新しい行は締め済み（closed）だけ（ポリシーと同じ）で、ロック解除の記録は持たない
CREATE OR REPLACE FUNCTION public.enforce_year_closure_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon')
       AND (NEW.unlock_request_id IS NOT NULL OR NEW.unlock_expires_at IS NOT NULL) THEN
        RAISE EXCEPTION 'ロック解除の記録は設定できません'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_year_closure_insert ON public.ledger_year_closures;
CREATE TRIGGER trg_year_closure_insert
    BEFORE INSERT ON public.ledger_year_closures
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_year_closure_insert();

-- 仕訳の年度が書き込み可能か（未締め、または期限内の一時解除中）。SPECIFICATION 7.3
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
          AND (
              c.status IN ('closed', 'locked')
              OR (
                  c.status = 'temporary_unlock'
                  AND (c.unlock_expires_at IS NULL OR c.unlock_expires_at <= now())
              )
          )
    );
$$;
