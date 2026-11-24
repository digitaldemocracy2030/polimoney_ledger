-- 依存する RLS ポリシーを先に削除

-- ledger_year_closures
DROP POLICY IF EXISTS "Users can manage closures for their organizations" ON ledger_year_closures;

-- ledger_members (既存ポリシーが organization_id / election_id を使っている可能性)
DROP POLICY IF EXISTS "Users can view their election ledger members" ON ledger_members;
DROP POLICY IF EXISTS "Users can view their organization ledger members" ON ledger_members;
DROP POLICY IF EXISTS "Admins can manage election ledger members" ON ledger_members;
DROP POLICY IF EXISTS "Admins can manage organization ledger members" ON ledger_members;
DROP POLICY IF EXISTS "Allow individual read access" ON ledger_members;
DROP POLICY IF EXISTS "Allow individual insert access" ON ledger_members;
DROP POLICY IF EXISTS "Allow individual update access" ON ledger_members;
DROP POLICY IF EXISTS "Allow individual delete access" ON ledger_members;

-- journals (既存ポリシーが organization_id / election_id を使っている可能性)
DROP POLICY IF EXISTS "Users can manage their election journals" ON journals;
DROP POLICY IF EXISTS "Users can manage their organization journals" ON journals;

-- contacts (既存ポリシーが organization_id / election_id を使っている可能性)
DROP POLICY IF EXISTS "Users can manage their contacts" ON contacts;

-- elections (hub_politician_id を使っているポリシー)
DROP POLICY IF EXISTS "Users can CRUD their own elections" ON elections;;
