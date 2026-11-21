-- 新しい RLS ポリシーを作成（ledger_id ベース）

-- ledger_year_closures: ledger_id 経由で所有者チェック
CREATE POLICY "Users can manage closures for their ledgers" ON ledger_year_closures
    FOR ALL USING (
        ledger_id IN (SELECT id FROM ledgers WHERE owner_user_id = auth.uid())
    );

-- ledger_members: ledger_id 経由でアクセスチェック
CREATE POLICY "Users can view their ledger members" ON ledger_members
    FOR SELECT USING (
        ledger_id IN (SELECT id FROM ledgers WHERE owner_user_id = auth.uid())
        OR user_id = auth.uid()
    );

CREATE POLICY "Admins can manage ledger members" ON ledger_members
    FOR ALL USING (
        ledger_id IN (SELECT id FROM ledgers WHERE owner_user_id = auth.uid())
    );

-- elections: owner_user_id でチェック
CREATE POLICY "Users can CRUD their own elections" ON elections
    FOR ALL USING (auth.uid() = owner_user_id);;
