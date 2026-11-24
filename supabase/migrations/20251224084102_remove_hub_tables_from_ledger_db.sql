-- Ledger DBから誤って作成したHub用テーブルを削除

-- 外部キー依存関係があるので順番に削除
DROP TABLE IF EXISTS public_journals CASCADE;
DROP TABLE IF EXISTS public_ledgers CASCADE;
DROP TABLE IF EXISTS hub_elections CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS politicians CASCADE;
DROP TABLE IF EXISTS districts CASCADE;
DROP TABLE IF EXISTS municipalities CASCADE;
DROP TABLE IF EXISTS account_codes CASCADE;
DROP TABLE IF EXISTS election_types CASCADE;
DROP TABLE IF EXISTS master_metadata CASCADE;;
