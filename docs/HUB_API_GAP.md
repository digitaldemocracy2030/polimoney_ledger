# Ledger が必要とする Hub API と現状の対応表

調査日: 2026-11-21（Hub リポジトリ `polimoney_hub` の `main` = `upstream/main` 4ee86f1 時点）

## 前提

- Hub の API は `backend/`（Python / FastAPI）が正。旧 Deno + Hono 版（`src/`）は
  コミット 3005dfd（2026-07-08）で削除され、upstream にも残っていない。
- Hub DB（Supabase B, `gpevkinxnlqfhnecuetn`）には Ledger が必要とするテーブルが揃っている
  （`politicians`, `organizations`, `elections`, `politician_organizations`, `politician_elections`,
  `politician_verifications`, `organization_managers`, `organization_manager_verifications`,
  `election_requests`, `organization_requests`, `unlock_requests`, `account_codes`, `public_*`）。
  **足りないのは API だけ**（`registration_requests` テーブルのみ DB にも無い）。
- Ledger 側の呼び出しはすべて `apps/api/lib/hub-client.ts`。

## 現在の FastAPI のエンドポイント

| パス                                                  | 用途                         |
| ----------------------------------------------------- | ---------------------------- |
| `GET /health`                                         | ヘルスチェック               |
| `GET /api/v1/political-funds/{ledger_id}`             | 公開データ（政治資金）       |
| `GET /api/v1/election-funds/{ledger_id}`              | 公開データ（選挙運動費用）   |
| `GET /api/v1/polimoney/...`（5 本）                   | Polimoney 向け公開データ     |
| `POST /api/v1/sync/contacts`, `/sync/journals`, `/sync/ledger`, `/sync/change-log`, `GET /sync/status` | Ledger → Hub 同期 |

## 対応表

凡例: ✅ ある / ❌ 無い / ⚠️ あるが問題あり。「Ledger の利用箇所」は `apps/api/routes/*.ts`。

### 1. 同期（公開データ）

| hub-client の関数 | Hub エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `syncContacts` | `POST /api/v1/sync/contacts` | ⚠️ | journals, sync |
| `syncJournals` | `POST /api/v1/sync/journals` | ⚠️ | journals, sync |
| `syncLedger` | `POST /api/v1/sync/ledger` | ⚠️ | journals, sync |
| `recordChangeLog` | `POST /api/v1/sync/change-log` | ⚠️ | sync |
| `getSyncStatus` | `GET /api/v1/sync/status` | ✅ | （未使用） |

- 送るデータの形（Pydantic モデル）は Ledger と一致している。
- ~~認証が無い~~ → Hub のブランチ `feat/sync-api-key-auth` で対応済み（未マージ）。
  `X-API-Key` が Hub の `LEDGER_SYNC_API_KEY_PROD` / `_DEV` に一致しないと 401、どちらも未設定なら 503。
  DEV キーで送った台帳・仕訳は常に `is_test=true` になり、本番データは上書きできない。
  関係者（`public_contacts`）と変更ログには `is_test` が無いため、この保護は掛かっていない。
- ⚠️ `sync/ledger` は `politician_organization_id` / `politician_election_id` が必須だが、
  Ledger がこれを取得する API が無い（2 章）。

### 2. 政治家・政治団体・選挙のマスタ

| hub-client の関数 | 旧エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `getPoliticians` / `getVerifiedPolitician(s)ByUserId` | `GET /api/v1/politicians`（全件を取り、Ledger 側で `ledger_user_id` と `is_verified` で絞る） | ❌ | elections, election-requests, organization-requests, politicians, profile |
| `updatePolitician` | `PUT /api/v1/politicians/{id}` | ❌ | profile |
| `getOrganizations` | `GET /api/v1/organizations` | ❌ | organizations |
| `getOrganization` | `GET /api/v1/organizations/{id}` | ❌ | hub-organizations, profile |
| `updateOrganization` | `PUT /api/v1/organizations/{id}` | ❌ | hub-organizations |
| `getManagedOrganizations` | `GET /api/v1/organizations/managed?ledger_user_id=` | ❌ | hub-organizations, managed-organizations, organizations, profile |
| `getElections` | `GET /api/v1/elections` | ❌ | elections |
| （新規）政治家×団体 / 政治家×選挙 の ID 解決 | なし | ❌ | 台帳作成・sync |

- `polimoney` 配下に `GET /politicians` と `GET /elections` はあるが、公開データ用（公開台帳を持つ政治家だけを返し、`ledger_user_id` も含まない）で、
  Ledger の用途には使えない。
- 政治家の取得は全件取得になっているので、新 API では `ledger_user_id` で絞れるようにしたい。
- **新規に必要:** 「politician_id + organization_id → `politician_organizations.id`」
  「politician_id + election_id → `politician_elections.id`」を返す（無ければ作る）API。
  Ledger は台帳作成時に取得して `ledgers.hub_politician_organization_id` / `hub_politician_election_id` に保存する。

### 3. 本人確認（政治家認証・団体管理者認証）

| hub-client の関数 | 旧エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `createPoliticianVerification` | `POST /api/v1/politician-verifications` | ❌ | politicians |
| `getPoliticianVerificationsByUser` | `GET /api/v1/politician-verifications/user/{id}` | ❌ | politicians |
| `sendPoliticianVerificationCode` | `POST .../{id}/send-verification` | ❌ | politicians |
| `verifyPoliticianEmail` | `POST .../{id}/verify-email` | ❌ | politicians |
| `verifyPoliticianDns` | `POST .../{id}/verify-dns` | ❌ | politicians |
| `createOrganizationManagerVerification` 他 4 関数 | `/api/v1/organization-manager-verifications/...` | ❌ | organizations |

### 4. 登録申請・ロック解除・勘定科目

| hub-client の関数 | 旧エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `createElectionRequest` | `POST /api/v1/election-requests` | ❌ | election-requests |
| `createOrganizationRequest` | `POST /api/v1/organization-requests` | ❌ | organization-requests |
| `createUnlockRequest` | `POST /api/v1/unlock-requests` | ❌ | closures |
| `checkUnlockStatus` | `GET /api/v1/unlock-requests/check/{ledgerId}` | ❌ | closures |
| `checkRegistrationRequest` | `GET /api/v1/registration-requests/check/{email}` | ❌（DB にテーブルも無い） | pending-review |
| `getAccountCodes` | `GET /api/v1/master/account-codes` | ❌ | account-master, ledger-data |
| `getAccountCode` | `GET /api/v1/master/account-codes/{code}` | ❌ | sync-transform（同期） |

未使用の関数（`getElection`, `getPolitician`, `createPolitician`, `get*Requests`, `getUnlockRequests`）は Hub 側の実装対象外にしてよい。

## Hub の管理画面（`admin/`, Fresh）への影響

`admin/` も旧 Deno API を呼んでおり、FastAPI 版には無いため動かない:

- `/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/update-password`
- `/api/admin/users`（一覧・作成・更新・パスワードリセット）
- `/api/admin/politician-verifications`, `/api/admin/organization-manager-verifications`
- `/api/admin/election-requests`, `/api/admin/organization-requests`（承認・却下）
- `/api/v1/registration-requests/{id}`, `/api/v1/organizations`, `/api/v1/elections`

既定の接続先も `http://localhost:3722`（`lib/auth.ts`）と `http://localhost:8000`（各ルート）で食い違っている。

## 影響のまとめ

| Ledger の機能 | 現状 |
| --- | --- |
| ログイン・台帳・仕訳・関係者・メンバー | 動く（Hub を使わない） |
| 仕訳フォームの勘定科目 | **動かない**（account-codes が無い） |
| 政治家認証・団体管理者認証 | **動かない** |
| 政治団体・選挙の台帳作成 | **動かない**（認証済み政治家の確認ができない） |
| 承認時・手動の Hub 同期 | **動かない**（中間 ID が無い。あっても無認証の API に送ることになる） |
| 年度ロック解除申請 | **動かない** |
| 登録審査中の確認 | **動かない** |

## 対応の優先順位（案）

1. ~~sync API に `X-API-Key` 認証を付ける~~（Hub `feat/sync-api-key-auth` で対応、未マージ）
2. **勘定科目 API**（`/api/v1/master/account-codes`）— Ledger の仕訳入力に必須。読み取りだけで小さい
3. **政治家・団体・選挙の取得 API と中間 ID の解決 API** — 台帳作成と同期に必須
4. **本人確認 API**（政治家・団体管理者）— 管理画面の審査 API とセット
5. **登録申請・ロック解除・登録審査** — 管理画面の承認 API とセット
6. 管理画面を Next.js + Mantine に移行（Ledger と同じ構成）。その際、管理画面用 API（`/api/admin/*`）も FastAPI に用意する
