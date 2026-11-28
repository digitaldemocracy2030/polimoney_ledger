-- 年度のロック解除（Hub の管理者が承認）を Ledger の年度締めに反映するための列
--
-- - unlock_request_id: 反映した Hub のロック解除の申請 ID。同じ承認を二度反映しない
--   （期限内に利用者が再ロックした年度が、同じ承認で再び解除されないようにする）
-- - unlock_expires_at: 解除の期限。過ぎたら API が locked に戻す
--
-- locked -> temporary_unlock と、期限切れでの temporary_unlock -> locked は API が service_role で行う。
-- 利用者の権限で許す遷移は 20261128110000 のトリガーで限る。
ALTER TABLE public.ledger_year_closures
    ADD COLUMN IF NOT EXISTS unlock_request_id uuid,
    ADD COLUMN IF NOT EXISTS unlock_expires_at timestamptz;
