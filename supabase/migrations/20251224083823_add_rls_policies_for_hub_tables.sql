-- ============================================
-- Hub テーブルの RLS 設定
-- ============================================

-- RLS を有効化
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_journals ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー（全員許可）
CREATE POLICY "Allow public read" ON municipalities FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON districts FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON politicians FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON hub_elections FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON master_metadata FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON account_codes FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON election_types FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_ledgers FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public_journals FOR SELECT USING (true);

-- 書き込みポリシー（service_role のみ）
CREATE POLICY "Allow service write" ON municipalities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON districts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON politicians FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON organizations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON hub_elections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON master_metadata FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON account_codes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON election_types FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_ledgers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service write" ON public_journals FOR ALL USING (auth.role() = 'service_role');;
