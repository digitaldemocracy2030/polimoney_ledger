# Ledger が必要とする Hub API と現状の対応表

調査日: 2026-11-21。最終更新: 2026-11-24（Hub #63, #65〜#68 を本番にデプロイ済み）

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

`/health` 以外はすべて Ledger 専用キー（`X-API-Key`）が必要（Hub #66）。一般公開用のキーの仕組みができるまでは、
以前は公開だった API も含めて Ledger 専用とする。Hub DB の公開読み取りの RLS も削除済み（2026-11-24）。

| パス | 用途 |
| --- | --- |
| `GET /health` | ヘルスチェック（キー不要） |
| `GET /api/v1/political-funds/{ledger_id}`, `/election-funds/{ledger_id}`, `/polimoney/...` | 公開データ（Polimoney 向け） |
| `GET /api/v1/master/account-codes[/{code}]` | 勘定科目 |
| `GET /api/v1/politicians?ledger_user_id=` | Ledger ユーザーに紐付いた政治家 |
| `GET /api/v1/organizations`, `/organizations/managed?ledger_user_id=`, `/organizations/{id}` | 政治団体 |
| `GET /api/v1/elections` | 選挙 |
| `POST /api/v1/politician-elections` | 政治家×選挙 の紐付けを取得（無ければ作成） |
| `POST /api/v1/politician-organizations/resolve` | 政治団体の代表者との紐付けを取得（作成しない） |
| `POST /api/v1/sync/contacts`, `/sync/journals`, `/sync/ledger`, `/sync/change-log`, `GET /sync/status` | Ledger → Hub 同期 |

DEV キーはテストデータ（`is_test = true`）、PROD キーは本番データだけを扱う。

## 対応表

凡例: ✅ ある / ❌ 無い / ⚠️ あるが問題あり。「Ledger の利用箇所」は `apps/api/routes/*.ts`。

### 1. 同期（公開データ）

| hub-client の関数 | Hub エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `syncContacts` | `POST /api/v1/sync/contacts` | ✅ | journals, sync |
| `syncJournals` | `POST /api/v1/sync/journals` | ✅ | journals, sync |
| `syncLedger` | `POST /api/v1/sync/ledger` | ✅ | journals, sync |
| `recordChangeLog` | `POST /api/v1/sync/change-log` | ✅ | sync |
| `getSyncStatus` | `GET /api/v1/sync/status` | ✅ | （未使用） |

- 送るデータの形（Pydantic モデル）は Ledger と一致している。
- ~~認証が無い~~ → Hub #63 で対応し、2026-11-24 に本番へデプロイ済み。
  `X-API-Key` が Hub の `LEDGER_SYNC_API_KEY_PROD` / `_DEV` に一致しないと 401、どちらも未設定なら 503。
  DEV キーで送った台帳・仕訳は常に `is_test=true` になり、本番データは上書きできない。
  関係者（`public_contacts`）と変更ログには `is_test` が無いため、この保護は掛かっていない。
- 新規の公開台帳・関係者の作成が常に 500 になる不具合（Hub #67）と、変更ログが常に 500 になる不具合（Hub #68）を修正済み。
- 2026-11-24 にテストユーザーの政治団体台帳で、台帳・関係者・仕訳・変更ログの同期が通ることを本番で確認。

### 2. 政治家・政治団体・選挙のマスタ

| hub-client の関数 | 旧エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `getPoliticiansByLedgerUserId` / `getVerifiedPolitician(s)ByUserId` | `GET /api/v1/politicians?ledger_user_id=` | ✅（Hub #66） | elections, election-requests, organization-requests, politicians, profile |
| `updatePolitician` | `PUT /api/v1/politicians/{id}` | ❌ | profile |
| `getOrganizations` | `GET /api/v1/organizations` | ✅（Hub #66） | organizations |
| `getOrganization` | `GET /api/v1/organizations/{id}` | ✅（Hub #66） | hub-organizations, profile |
| `updateOrganization` | `PUT /api/v1/organizations/{id}` | ❌ | hub-organizations |
| `getManagedOrganizations` | `GET /api/v1/organizations/managed?ledger_user_id=` | ✅（Hub #66） | hub-organizations, managed-organizations, organizations, profile |
| `getElections` | `GET /api/v1/elections` | ✅（Hub #66） | elections |
| `resolvePoliticianElection` | `POST /api/v1/politician-elections` | ✅（Hub #66） | elections（台帳作成）, lib/hub-ledger.ts（同期） |
| `resolvePoliticianOrganization` | `POST /api/v1/politician-organizations/resolve` | ✅（Hub #66） | organizations（台帳作成）, lib/hub-ledger.ts（同期） |

- 政治団体の台帳は、団体の**代表者**（`politician_organizations.role = 'representative'`）との紐付けを使う。
  代表者の紐付けが無い・複数ある団体は台帳を作成できない（409。Hub の管理者が設定する）。
- 選挙の台帳は、Hub の選挙を選んだときに 政治家×選挙 の紐付けを取得（無ければ作成）する。
  Hub に無い選挙の台帳は紐付け無しで作成し、同期時に「選挙が Hub に登録されていません」と返す。
- 紐付けが未設定の既存の台帳は、同期時に Hub から取得して保存する（`apps/api/lib/hub-ledger.ts`）。
- 政治家・政治団体の情報の**更新**（`PUT`）は未実装。

### 3. 本人確認（政治家認証・団体管理者認証）

| hub-client の関数 | 旧エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `createPoliticianVerification` | `POST /api/v1/politician-verifications` | ✅ Hub #69 | politicians |
| `getPoliticianVerificationsByUser` | `GET /api/v1/politician-verifications/user/{id}` | ✅ Hub #69 | politicians |
| `sendPoliticianVerificationCode` | `POST .../{id}/send-verification` | ✅ Hub #69 | politicians |
| `verifyPoliticianEmail` | `POST .../{id}/verify-email` | ✅ Hub #69 | politicians |
| `verifyPoliticianDns` | `POST .../{id}/verify-dns` | ✅ Hub #69 | politicians |
| `createOrganizationManagerVerification` 他 4 関数 | `/api/v1/organization-manager-verifications/...` | ✅ Hub #69 | organizations |

✅ = 本番デプロイ済み（2026-11-24）。Hub #69 の要点:

- 送信・確認の操作には申請者本人の `ledger_user_id` を body で送る（hub-client 対応済み）
- 確認コードのメール送信は Resend（Hub の `RESEND_API_KEY` / `MAIL_FROM`）。未設定の間、本番データの送信は 503
- DEV キー（テストユーザー）の申請はテストデータ。確認コードはメールで送らず応答の `code` で返る
- 審査は管理者 API（`/api/admin/*`、Hub の Supabase Auth + `admin_users`）。管理画面は Next.js 移行時に対応

### 4. 登録申請・ロック解除・勘定科目

| hub-client の関数 | 旧エンドポイント | 状態 | Ledger の利用箇所 |
| --- | --- | --- | --- |
| `createElectionRequest` | `POST /api/v1/election-requests` | ✅ Hub #72（2026-11-28 本番デプロイ） | election-requests |
| `createOrganizationRequest` | `POST /api/v1/organization-requests` | ✅ Hub #72（2026-11-28 本番デプロイ） | organization-requests |
| `createUnlockRequest` | `POST /api/v1/unlock-requests` | ✅ Hub #72（2026-11-28 本番デプロイ） | closures |
| `checkUnlockStatus` | `GET /api/v1/unlock-requests/check/{ledgerId}[?fiscal_year=]` | ✅ Hub #72（2026-11-28 本番デプロイ） | closures, organizations（年度の状態）, lib/year-closure.ts |
| `getAccountCodes` | `GET /api/v1/master/account-codes` | ✅（Hub #65） | account-master, ledger-data |
| `getAccountCode` | `GET /api/v1/master/account-codes/{code}` | ✅（Hub #65） | （未使用。sync-transform の同名関数は別物） |

未使用の関数（`getElection`, `getPolitician`, `createPolitician`）は Hub 側の実装対象外にしてよい。登録申請・ロック解除の一覧取得の関数（`get*Requests`, `getUnlockRequests`）は Ledger から削除した。

Hub #72 の要点（2026-11-28 本番デプロイ。Ledger 側は #93）:

- 選挙・政治団体の申請には申請者の `ledger_user_id` を送る。同じ申請者の同じ選挙・団体、同じ台帳・年度のロック解除は、審査中は 1 件まで（重複は 409）
- 審査は管理者 API（`/api/admin/{election-requests,organization-requests,unlock-requests}`）。選挙・団体の承認でマスタの行が作られる（既存の行への紐付けも可）
- ロック解除の承認には期限（既定 7 日）が付く。Ledger は年度の状態を読むとき（台帳画面・仕訳の書き込み）に Hub に問い合わせ、アーカイブ済みの年度を一時解除にし、期限が過ぎたらアーカイブ済みに戻す（`apps/api/lib/year-closure.ts`。反映した申請 ID を `ledger_year_closures.unlock_request_id` に記録し、同じ承認を二度反映しない）

## Hub の管理画面（`admin/`, Fresh）への影響

`admin/` も旧 Deno API を呼んでおり、FastAPI 版には無いため動かない:

- `/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/update-password`
- `/api/admin/users`（一覧・作成・更新・パスワードリセット）
- `/api/admin/politician-verifications`, `/api/admin/organization-manager-verifications`
- `/api/admin/election-requests`, `/api/admin/organization-requests`（承認・却下）
- `/api/v1/registration-requests/{id}`, `/api/v1/organizations`, `/api/v1/elections`

既定の接続先が `http://localhost:3722`（`lib/auth.ts`）と `http://localhost:8000`（各ルート）で食い違っていた件は、Hub #64 で 3722 に統一した。

## 影響のまとめ

| Ledger の機能 | 現状 |
| --- | --- |
| ログイン・台帳・仕訳・関係者・メンバー | 動く（Hub を使わない） |
| 仕訳フォームの勘定科目 | 動く（Hub #65 で 2026-11-24 にデプロイ。Ledger 専用キーが必要） |
| 政治家認証・団体管理者認証 | **動かない**（本人確認 API が無い。Hub 側で認証済みの政治家・管理者は使える） |
| 政治団体・選挙の台帳作成 | 動く（Hub #66。2026-11-24 に本番で確認） |
| 承認時・手動の Hub 同期 | 動く（Hub #66〜#68。2026-11-24 に本番で確認） |
| プロフィールでの政治家・団体情報の編集 | **動かない**（更新 API が無い） |
| 年度ロック解除申請 | **動かない** |

## 対応の優先順位（案）

1. ~~sync API に `X-API-Key` 認証を付ける~~（Hub #63、本番デプロイ済み）
2. ~~勘定科目 API~~（Hub #65、本番デプロイ済み。一般公開まではLedger 専用キーが必要）
3. ~~政治家・団体・選挙の取得 API と紐付けの API~~（Hub #66〜#68、本番デプロイ済み）
4. ~~本人確認 API（政治家・団体管理者）と審査 API~~（Hub #69、本番デプロイ済み。メール送信の Resend 設定と e2e は未実施）
5. **登録申請・ロック解除** — 管理画面の承認 API とセット
6. 管理画面を Next.js + Mantine に移行（Ledger と同じ構成）。その際、管理画面用 API（`/api/admin/*`）も FastAPI に用意する
