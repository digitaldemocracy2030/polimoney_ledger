# テストアカウントとテストデータの仕様

## 概要

Polimoney Ledger では、開発・テスト用のダミーデータを本番環境と同じ Hub
データベースに保存します。
テストデータは `is_test = true` フラグで識別され、公開 API からは除外されます。

---

## テストアカウント

### テストユーザー ID

```typescript
// apps/api/lib/hub-client.ts
export const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
```

この固定 UUID は Ledger 側の `db/seed-supabase.ts` で作成されるテストユーザーの ID
です。

### テストユーザーの特徴

1. **メールアドレス**: `test-dev@polimoney.local`
2. **パスワード**: `test-dev-password-12345`（開発環境のみ）
3. **認証済み政治家**: 山田 太郎 として認証済み
4. **管理団体**: 山田太郎後援会、山田太郎を応援する会

### Ledger DB での扱い（特別扱いしない）

テストユーザーは **Ledger DB 上は普通のユーザー**です。

- Ledger API はテストユーザーでも、他のユーザーと同じくリクエストの JWT 付きクライアント
  （`c.get("supabase")`、RLS 適用）で DB にアクセスします。service_role で RLS をバイパスすることはありません。
- テストデータが読めるのは、シード（`db/seed-supabase.ts`）がテストユーザーを台帳のオーナーにし、
  `ledger_members` にも admin として登録しているためです。
- `isTestUser()` を使うのは、Hub API キーの選択と同期時の `is_test` の設定の 2 か所だけです（下記）。

---

## データの流れ

### Hub へのデータ同期時

```
Ledger → Hub (syncJournals / syncLedger API)
```

同期時に Ledger は `is_test` フラグを自動設定します。判定は呼び出したユーザーではなく
**台帳のオーナー**で行います（`POST /v1/sync` と、仕訳承認時の自動同期の両方）。

```typescript
// apps/api/routes/sync.ts
// is_test と Hub API キーは台帳オーナーで決める
const hubUserId = ledger.owner_user_id;
const isTest = isTestUser(hubUserId);

const ledgerInput: SyncLedgerInput = {
  ledger_source_id: ledger.id,
  // ...
  is_test: isTest,
};
await syncLedger(ledgerInput, { userId: hubUserId }); // テスト台帳なら DEV キーで送る
```

### テストユーザー判定

```typescript
// apps/api/lib/hub-client.ts
export function isTestUser(userId: string | null | undefined): boolean {
  return userId === TEST_USER_ID;
}
```

---

## Hub 側のテストデータ

Hub データベースには以下のテストデータが投入されています：

### 政治家（is_test = true）

| ID                                     | 名前     | ledger_user_id                         |
| -------------------------------------- | -------- | -------------------------------------- |
| `11111111-1111-1111-1111-111111111111` | 山田太郎 | `00000000-0000-0000-0000-000000000001` |
| `22222222-2222-2222-2222-222222222222` | 佐藤花子 | `00000000-0000-0000-0000-000000000001` |

### 政治団体（is_test = true）

| ID                                     | 名前                 | 関連政治家 |
| -------------------------------------- | -------------------- | ---------- |
| `aaaa1111-1111-1111-1111-111111111111` | 山田太郎後援会       | 山田太郎   |
| `aaaa1111-2222-2222-2222-222222222222` | 山田太郎を応援する会 | 山田太郎   |
| `bbbb2222-1111-1111-1111-111111111111` | 佐藤花子後援会       | 佐藤花子   |

### 政治団体管理者（is_test = true）

| ID                                     | organization_id                        |
| -------------------------------------- | -------------------------------------- |
| `ffff1111-1111-1111-1111-111111111111` | `aaaa1111-1111-1111-1111-111111111111` |
| `ffff1111-2222-2222-2222-222222222222` | `aaaa1111-2222-2222-2222-222222222222` |

---

## 環境設定

### Ledger 側の環境変数

Hub の設定は Ledger API（`apps/api`）だけが持ちます（Web には置きません）。

```bash
# apps/api/.env またはホスティング環境（Deno Deploy）の環境変数

# 本番環境
APP_ENV=production
HUB_API_URL_PROD=https://polimoney-hub.dd2030-topics.deno.net
HUB_API_KEY_PROD=your-production-key

# 開発環境
APP_ENV=development
HUB_API_URL_DEV=http://localhost:3722
HUB_API_KEY_DEV=your-development-key
```

### 重要なポイント

1. **テストユーザーの場合は `HUB_API_KEY_DEV` を使用**

   - テストユーザー（`TEST_USER_ID`）の場合、常に DEV キーを使用
   - DEV キーで呼ぶと `is_test = true` のデータのみ返る
   - PROD キーで呼ぶと `is_test = false` のデータのみ返る

2. **Hub API キーの選択ロジック**

   ```typescript
   // apps/api/lib/hub-client.ts
   // テストユーザーの場合は DEV キーを使用（URL は APP_ENV で決まる同じ Hub）
   const useDevKey = isTestUser(userId);
   const apiUrl = HUB_API_URL; // APP_ENV=production なら HUB_API_URL_PROD
   const apiKey = useDevKey ? HUB_API_KEY_DEV : HUB_API_KEY;
   ```

3. **Hub 側のフィルタリング**
   - Hub は API キーを見て `isTestMode` を判定
   - `API_KEY_DEV` → `isTestMode = true` → `is_test = true` のデータを返す
   - `API_KEY_PROD` → `isTestMode = false` → `is_test = false` のデータを返す

---

## 公開 API でのフィルタリング

Hub の公開 API（`/api/public/*`）では、`is_test = false` のデータのみ返却されます。

```sql
-- Hub 側のクエリ例
SELECT * FROM politicians
WHERE is_verified = true
  AND is_test = false;
```

これにより、テストデータが一般公開されることはありません。

---

## トラブルシューティング

### テストアカウントでデータが表示されない

1. **Hub にテストデータが存在するか確認**

   - Hub 管理画面または Supabase Dashboard で確認
   - `is_test = true` のデータが存在するか

2. **`ledger_user_id` が正しいか確認**

   - テストユーザーの ID: `00000000-0000-0000-0000-000000000001`

3. **Hub API が正しいか確認**
   - 開発環境: `HUB_API_URL_DEV` が正しく設定されているか
   - 本番環境: `HUB_API_URL_PROD` が正しく設定されているか

### 本番環境にテストデータが混入した場合

1. Hub データベースで `is_test = true` のデータを確認
2. 必要に応じて削除（外部キー制約に注意）
3. 削除順序: `public_journals` → `public_ledgers` → `organizations` → `politicians`

---

## 参照

- [Hub DATABASE.md](../../polimoney_hub/docs/DATABASE.md) - Hub 側のテストデータ仕様
- [apps/api/lib/hub-client.ts](../apps/api/lib/hub-client.ts) - テストユーザー判定ロジック
- [db/seed-supabase.ts](../db/seed-supabase.ts) - テストユーザー作成スクリプト
