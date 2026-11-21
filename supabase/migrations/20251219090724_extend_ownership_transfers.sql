-- ownership_transfers テーブルに organization_id, election_id を追加
ALTER TABLE ownership_transfers
ADD COLUMN organization_id UUID REFERENCES political_organizations(id),
ADD COLUMN election_id UUID REFERENCES elections(id);

-- 排他制約を追加（政治団体または選挙のいずれか一方のみ）
ALTER TABLE ownership_transfers
ADD CONSTRAINT ownership_transfers_ledger_check
  CHECK (
    (organization_id IS NOT NULL AND election_id IS NULL) OR
    (organization_id IS NULL AND election_id IS NOT NULL)
  );

-- 既存の status チェック制約を削除して cancelled を追加
ALTER TABLE ownership_transfers
DROP CONSTRAINT IF EXISTS ownership_transfers_status_check;

ALTER TABLE ownership_transfers
ADD CONSTRAINT ownership_transfers_status_check
  CHECK (status IN ('pending', 'completed', 'declined', 'cancelled'));;
