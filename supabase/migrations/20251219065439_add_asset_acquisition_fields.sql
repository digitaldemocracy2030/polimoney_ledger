-- 仕訳テーブルに資産取得関連のカラムを追加
ALTER TABLE journals 
ADD COLUMN IF NOT EXISTS is_asset_acquisition boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS asset_type text;

-- asset_type のチェック制約を追加（土地、建物、動産、有価証券、施設利用権、敷金）
ALTER TABLE journals 
ADD CONSTRAINT journals_asset_type_check 
CHECK (asset_type IS NULL OR asset_type IN ('land', 'building', 'vehicle', 'securities', 'facility_rights', 'deposit'));;
