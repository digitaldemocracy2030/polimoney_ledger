# Polimoney Ledger - アーキテクチャ設計

## 1. システム概要

> ⚠️ **重要**: Ledger と Hub は **別々の Supabase プロジェクト**
> を使用しています。
>
> | プロジェクト                    | 用途                                         |
> | ------------------------------- | -------------------------------------------- |
> | **🅰️ Supabase A (Ledger 専用)** | 政治家のプライベートデータ、認証、領収書保存 |
> | **🅱️ Supabase B (Hub 専用)**    | 共通識別子、公開データ、管理者認証           |

```
┌──────────────────────────────────┐   ┌──────────────────┐
│ Web: apps/web                    │   │ ネイティブアプリ │ ← 将来
│ Next.js (App Router) + Mantine   │   └────────┬─────────┘
│  proxy.ts       画面の振り分け   │            │
│  lib/api-client.ts  apiFetch()   │            │
└───────┬──────────────────┬───────┘            │
        │ ① 認証のみ       │ ② Authorization: Bearer <JWT>
        │ (@supabase/ssr)  ▼                    ▼
        │       ┌─────────────────────────────────────────┐
        │       │ Ledger API: apps/api (Hono on Deno)     │
        │       │  /v1/journals, /v1/contacts, ...        │
        │       │  - requireAuth: JWT を検証 → userId     │
        │       │  - ユーザーの JWT 付きクライアント(RLS) │
        │       │  - service_role は authz 確認後の       │
        │       │    特権処理のみ                         │
        │       └───────┬─────────────────────┬───────────┘
        ▼               ▼ supabase-js         ▼ X-API-Key
┌───────────────────────────────┐   ┌───────────────────────────┐
│ 🅰️ Supabase A (Ledger 専用)   │   │ Polimoney Hub (API)       │
│  PostgreSQL                   │   │  - 共通識別子取得         │
│   ledgers / ledger_members    │   │  - 公開データ同期         │
│   journals / journal_entries  │   │  → 🅱️ Supabase B          │
│   contacts / sub_accounts     │   └─────────────┬─────────────┘
│   political_organizations     │                 │
│   elections / media_assets    │                 ▼
│  Auth（ユーザー認証）         │   ┌───────────────────────────┐
│  Storage（領収書・証明書類）  │   │ Polimoney (可視化)        │
└───────────────────────────────┘   └───────────────────────────┘
```

> 旧構成（Fresh + Supabase Edge Functions + Realtime）から移行済み。現在 Realtime は使用していない。
> API 分離の経緯と残作業は [implementation_plan.md](./implementation_plan.md) を参照。

---

## 2. 技術スタック

### 2.1. フロントエンド（apps/web）

| 項目           | 選択                        | 備考                                                                                 |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| フレームワーク | **Next.js 16 (App Router)** | React 19。ページは主にクライアントコンポーネント。Next.js の API ルートは持たない    |
| UI             | **Mantine 9**               | `@mantine/core`, `dates`, `form`, `notifications`、アイコンは `@tabler/icons-react` |
| 認証           | `@supabase/ssr`             | 認証（ログイン・登録・ログアウト・トークン更新・パスワード再設定）のみ               |
| ホスティング   | **Deno Deploy**             | `ledger-web` として単独でデプロイ（未実施）                                          |

### 2.2. バックエンド API（apps/api）

| 項目           | 選択                     | 備考                                                  |
| -------------- | ------------------------ | ----------------------------------------------------- |
| ランタイム     | **Deno 2**               | `main.ts` で `Deno.serve(app.fetch)`                  |
| フレームワーク | **Hono**                 | `app.ts` に `/v1` 配下のルーターをマウント            |
| 依存           | `deno.json` の `imports` | `npm:hono`, `npm:@supabase/supabase-js`, `npm:fflate` |
| ホスティング   | **Deno Deploy**          | `ledger-api` として単独でデプロイ（未実施）           |

> **Supabase Edge Functions は使用していない。** Ledger のサーバー処理はすべて `apps/api` の Hono で動く。
> Hub（polimoney_hub）は別リポジトリ・別デプロイの Deno + Hono アプリで、Ledger API から HTTP（`X-API-Key`）で呼び出す。

### 2.3. 共有パッケージ（packages/shared）

フレームワークに依存しない TypeScript。Web は `@polimoney-ledger/shared/<file>.ts`（npm workspaces）、
API は同じ指定子を `deno.json` の `imports` で `../../packages/shared/src/` に対応付けて使う。
パッケージ内のファイル同士は `.ts` 拡張子付きで import する。

| ファイル           | 内容                                          |
| ------------------ | --------------------------------------------- |
| `types.ts`         | ドメインの型定義                              |
| `permissions.ts`   | ロールと権限（SPECIFICATION.md 2.11）         |
| `account-codes.ts` | 勘定科目コード（正は Hub の `account_codes`） |
| `hub-types.ts`     | Hub API の型                                  |
| `receipts.ts`      | 領収書アップロードの共通定義                  |

### 2.4. データベース

| 項目       | 選択                      | 理由                             |
| ---------- | ------------------------- | -------------------------------- |
| DB         | **PostgreSQL (Supabase)** | RLS、トランザクション、JSON 対応 |
| 認証       | Supabase Auth             | RLS との統合                     |
| ストレージ | Supabase Storage          | 領収証画像・証明書類の保存       |

### 2.5. インフラ

| 項目                   | 選択                        | 理由                                     |
| ---------------------- | --------------------------- | ---------------------------------------- |
| Web / API              | **Deno Deploy**（2 アプリ） | Hub と同じ構成。無料枠で運用できる見込み |
| DB / 認証 / ストレージ | **Supabase Cloud** (初期)   | 運用負荷最小化                           |
| 将来的移行先           | Azure + Supabase Self-Host  | データ主権、コスト最適化                 |

---

## 3. 開発環境

### 3.1. ディレクトリ構成

```
polimoney_ledger/
├── package.json             # npm workspaces（apps/web, packages/shared）と各種スクリプト
├── apps/
│   ├── web/                 # Next.js（フロントエンドのみ）
│   │   ├── app/             # App Router（(auth), (public), 各画面）
│   │   ├── components/      # UI コンポーネント（ドメイン別）
│   │   ├── lib/
│   │   │   ├── api-client.ts    # apiFetch / apiJson（Ledger API 呼び出し）
│   │   │   └── supabase/        # 認証用ブラウザクライアント・認証ヘルパー
│   │   └── proxy.ts         # 画面の振り分け（未ログイン・審査待ち）
│   └── api/                 # Ledger API（Hono on Deno）
│       ├── deno.json        # imports / tasks（dev, start, check）
│       ├── main.ts          # Deno.serve
│       ├── app.ts           # CORS・認証・/v1 ルーターのマウント・エラーハンドラー
│       ├── routes/          # ドメイン別ルーター
│       └── lib/             # auth, authz, supabase, hub-client, sync-transform 等
├── packages/
│   └── shared/src/          # 共有 TS（型・権限・勘定科目）
├── db/                      # マイグレーション SQL、シードスクリプト (Deno)
├── supabase/                # seed.sql
├── legacy/flutter/          # Flutter 版（レガシー）
└── docs/
```

### 3.2. 開発ツール

| ツール     | 用途                                                             |
| ---------- | ---------------------------------------------------------------- |
| Node.js 22 | Web の実行（`package.json` の volta 設定）                       |
| npm        | npm workspaces（`apps/web`, `packages/shared`）・スクリプト実行  |
| Deno 2     | API の実行・型チェック（`deno task dev` / `check`）、シード投入 |
| TypeScript | Web の型チェック（`npm run check:web`）                          |

### 3.3. ローカル開発フロー

```bash
# 1. 依存インストール
npm install

# 2. 環境変数
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Hub（polimoney_hub, :3722）を起動しておく

# 4. 起動
npm run dev:api   # http://localhost:3723
npm run dev:web   # http://localhost:3721
```

DB の準備・シード投入を含む詳細は [DEVELOPMENT.md](./DEVELOPMENT.md) を参照。

### 3.4. 環境変数

| アプリ | ファイル              | 変数                                                                                                                                                                                                                                                         |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| web    | `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`（既定 `http://localhost:3723`）                                                                                                                                    |
| api    | `apps/api/.env`       | `PORT`（既定 3723）, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`, `HUB_API_URL_PROD`, `HUB_API_URL_DEV`, `HUB_API_KEY_PROD`, `HUB_API_KEY_DEV`, `CORS_ALLOWED_ORIGINS`（カンマ区切り、既定 `http://localhost:3721`） |

service_role キーと Hub API キーは **api だけ**が持つ。`NEXT_PUBLIC_*` はブラウザに公開されるため秘密の値を入れない。

---

## 4. セキュリティ設計

### 4.1. 認証・認可

認証は **Supabase Auth**（Ledger 専用の Supabase A）を使う。認証（ID・トークンの発行と更新）だけは
クライアントが Supabase Auth を直接使い、それ以外はすべて Ledger API を通す。

```
┌──────────────────────────────────────────────────────────────────────┐
│ 認証フロー（メールアドレス + パスワード）                            │
├──────────────────────────────────────────────────────────────────────┤
│ 1. 登録: (auth)/register で supabase.auth.signUp()                   │
│ 2. 確認メールのリンク（/auth/callback）でメールアドレスを確認        │
│ 3. ログイン: (auth)/login で signInWithPassword()                    │
│    セッションは @supabase/ssr の createBrowserClient で Cookie に保存 │
│ 4. GET /v1/me でユーザー状態を取得し、未同意なら /onboarding         │
│    （POST /v1/me/onboarding で規約・プライバシーポリシー同意を記録） │
│ 5. proxy.ts が Cookie のセッションで画面を振り分ける                 │
│    - 未ログイン → /login?redirect=...                                │
│    - app_metadata.registration_status = 'pending_review'             │
│      → /pending-review                                               │
│ 6. データは apiFetch('/v1/...') で取得し、                           │
│    Authorization: Bearer <access_token> を付ける                     │
│ 7. API の requireAuth が supabase.auth.getUser(token) で検証         │
│    - 失敗 → 401 { error }（Web は /login へ遷移）                    │
│    - 成功 → c.var に userId / user / accessToken / supabase を設定   │
└──────────────────────────────────────────────────────────────────────┘
```

| 箇所                                | 使うクライアント / 環境変数                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Web（ログイン・登録・ログアウト等） | `@supabase/ssr` の `createBrowserClient`（`apps/web/lib/supabase/client.ts`）、`NEXT_PUBLIC_SUPABASE_*`           |
| Web の proxy（旧 middleware）       | `@supabase/ssr` の `createServerClient`、`NEXT_PUBLIC_SUPABASE_*`                                                 |
| Web → API                           | `apps/web/lib/api-client.ts`（`NEXT_PUBLIC_API_URL` + Bearer トークン）                                           |
| API の通常のデータアクセス          | `c.get("supabase")`: リクエストごとに `SUPABASE_PUBLISHABLE_KEY` + ユーザーの JWT で作るクライアント（RLS 適用） |
| API の特権処理                      | `getServiceClient()`（`SUPABASE_SERVICE_ROLE_KEY`、RLS をバイパス）                                               |

**認可のルール（apps/api）:**

- 原則として `c.get("supabase")` を使い、RLS をそのユーザーとして効かせる。
- `getServiceClient()` は次の特権処理に限る: auth.admin の呼び出し、他ユーザーにまたがる操作
  （メンバー招待、オーナー譲渡）、Hub 同期、RLS で表せない Storage 操作（他メンバーの証憑の署名付き URL など）、
  台帳の構造の作成（Hub で認証済みであることを確認した後）。
- service_role を使う前に必ず `apps/api/lib/authz.ts` のヘルパー（`requireLedgerRole`,
  `requireLedgerPermission`, `requireLedgerOwner`, `requireJournalAccess`, `requireSelf` 等）で権限を確認する。
- 審査状態は `app_metadata.registration_status` で表す（ユーザー自身は書き換えられない）。
- Web は `supabase.from(...)` や `user_metadata` を使わない。ユーザー状態は `GET /v1/me` から得る。
- CORS は `CORS_ALLOWED_ORIGINS` のオリジンのみ許可する（`Authorization`, `Content-Type` ヘッダーを許可し、
  ダウンロードのファイル名用に `Content-Disposition` を公開）。

### 4.2. Row Level Security (RLS)

API がユーザーの JWT で DB にアクセスするため、RLS が主なアクセス制御になる。
ポリシーとヘルパー関数は `supabase/migrations/20261121100000_api_user_scoped_rls.sql` で定義する。

- 閲覧はオーナーとメンバー全員。書き込みはロールの権限で絞る（仕訳の起票 = `submitJournal`、即時登録 = `registerJournal`、
  承認 = `approveJournal`、メンバー管理 = `manageMembers`、年度締め = `editLedgerSettings`）。
- `political_organizations` / `elections` / `ledgers` はユーザーが書き込めない（`hub_*` ID のなりすまし防止）。
  API が Hub で認証済み政治家・団体管理者であることを確認した後に service client で作成する。
- `profiles.hub_politician_id` / `verified_email_domain` はユーザーが書き込めない（列単位の GRANT）。
- `journals` は台帳・起票者の変更と、承認者（`approved_by_user_id`）のなりすましをトリガーで禁止する。
- `media_assets.storage_path` は `{自分のユーザー ID}/{journal_id}/...` に限る。

- 台帳のオーナーは `ledgers.owner_user_id`（暗黙の admin）、招待メンバーは `ledger_members(user_id, ledger_id, role)`。
- ロールと権限の対応は `packages/shared/src/permissions.ts` と SQL 関数 `public.role_has_permission` の両方に持つ
  （片方を変えたらもう片方も変える）。
- API 側でも `lib/authz.ts` で台帳ロールを明示的に確認する（RLS と二重の防御）。

### 4.3. データ保護

| 層       | 対策                        |
| -------- | --------------------------- |
| 通信     | HTTPS (TLS 1.3)             |
| 保存     | PostgreSQL 暗号化 (At-rest) |
| アクセス | RLS + JWT 検証              |
| 監査     | 変更ログの自動記録          |

---

## 5. API 設計

### 5.1. エンドポイント一覧

すべて `/v1` 配下。実装は `apps/api/routes/<名前>.ts`。`GET /v1/health` 以外は `Authorization: Bearer <JWT>` が必須。
エラーは JSON `{ error: string }`（日本語）で返す。

| プレフィックス                                 | 主な操作                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/health`                                      | `GET`（認証不要）                                                                                                                                                |
| `/me`                                          | `GET` ユーザー情報・プロフィール・所属台帳、`POST /onboarding` 規約同意の記録                                                                                    |
| `/dashboard`                                   | `GET` ダッシュボード用データ（自分宛ての承認待ちオーナー譲渡）                                                                                                   |
| `/pending-review`                              | `GET` 登録審査中ページ用の情報                                                                                                                                   |
| `/profile`                                     | `GET`/`PUT` 表示名、`GET`/`PUT /politician`、`GET /organization`、`GET /organization/:id`（Hub）                                                                 |
| `/account-master`                              | `GET` 勘定科目マスタ（Hub の `account_codes`）                                                                                                                   |
| `/journals`                                    | 仕訳の一覧・作成・取得・更新・削除、`POST /:id/approve`、`GET /:id/receipts`                                                                                     |
| `/receipts`                                    | `POST` 領収書アップロード、`DELETE ?id=` 削除                                                                                                                    |
| `/upload`                                      | `POST /`、`POST /image` ファイルアップロード                                                                                                                     |
| `/contacts`                                    | 関係者 CRUD（`?ledger_id=` で台帳の関係者）                                                                                                                      |
| `/sub-accounts`                                | 補助科目 CRUD                                                                                                                                                    |
| `/organizations`                               | 政治団体台帳の一覧・作成、`/:id/ledger`・`/:id/members`・`/:id/assets`・`/:id/settings`、団体管理者認証 `/manager-verify`（`/:id/send-code`・`/verify-code`・`/verify-dns`） |
| `/managed-organizations`                       | `GET` Hub で団体管理者として認証済みの政治団体                                                                                                                   |
| `/hub-organizations`                           | `GET`/`PUT /:id` Hub の政治団体情報                                                                                                                              |
| `/elections`                                   | 選挙台帳の一覧・作成、`GET /new-data`、`/:id/ledger`・`/:id/members`・`/:id/assets`                                                                              |
| `/politicians`                                 | 政治家認証 `/verify`（`/:id/send-code`・`/verify-code`・`/verify-dns`）                                                                                          |
| `/members`                                     | 台帳メンバーの一覧（`?ledger_id=`）・招待・ロール変更・削除                                                                                                      |
| `/ownership-transfers`                         | 台帳オーナー譲渡の一覧・作成・取得・キャンセル、`POST /:id/accept`・`/:id/decline`                                                                               |
| `/election-requests`, `/organization-requests` | `POST` Hub への登録リクエスト                                                                                                                                    |
| `/closures`                                    | 年度締め（`GET /check`, `POST /execute`, `/archive`, `/reopen`, `GET`/`POST /unlock-request`）                                                                   |
| `/sync`                                        | `POST` Hub への公開データ同期                                                                                                                                    |
| `/export`                                      | `GET` 本人データの JSON エクスポート（データポータビリティ）                                                                                                     |
| `/export-csv`, `/export-report`                | `GET` CSV・収支報告書エクスポート                                                                                                                                |

---

## 6. Polimoney 連携

### 6.1. 共通識別子の管理方針（重要）【v2 更新】

> ⚠️ **Hub は共通識別子の唯一の情報源 (Single Source of Truth) です。**
>
> Ledger は政治家・政治団体・選挙の **マスタデータ** を保存しません。
> Hub API から取得し、`hub_politician_id`、`hub_organization_id`、`hub_election_id` で参照します。

**詳細:** `docs/IDENTITY_DESIGN.md` を参照

| 識別子         | 形式 | 保存先                 | Ledger での扱い                                      |
| -------------- | ---- | ---------------------- | ---------------------------------------------------- |
| 選挙マスタ     | UUID | 🅱️ Hub (Supabase B)    | `elections.hub_election_id` で参照                   |
| 政治団体マスタ | UUID | 🅱️ Hub (Supabase B)    | `political_organizations.hub_organization_id` で参照 |
| 政治家マスタ   | UUID | 🅱️ Hub (Supabase B)    | `profiles.hub_politician_id` で参照                  |
| 選挙台帳       | UUID | 🅰️ Ledger (Supabase A) | `elections.id` で管理                                |
| 政治団体台帳   | UUID | 🅰️ Ledger (Supabase A) | `political_organizations.id` で管理                  |
| ユーザー ID    | UUID | 🅰️ Ledger (Supabase A) | `auth.uid()` で管理                                  |

> **注意:** Ledger に `politicians` テーブルは存在しません（Hub で一元管理）。

### 6.2. 連携アーキテクチャ【v2 更新】

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🅱️ Hub (Supabase B)                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 共通識別子（Single Source of Truth）                          │ │
│  │ - politicians, organizations, elections                       │ │
│  │ - public_ledgers, public_journals (公開データ)                │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ アカウント認証【v2 追加】                                     │ │
│  │ - politician_verifications（政治家認証申請）                  │ │
│  │ - organization_manager_verifications（団体管理者認証申請）    │ │
│  │ - organization_managers（団体管理者マッピング）               │ │
│  │ - impersonation_reports（なりすまし通報）                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    Hub API (認証: X-API-Key)
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│ Ledger        │         │ Polimoney     │         │ 将来の消費者  │
│ (ID参照のみ)  │         │ (可視化)      │         │               │
└───────┬───────┘         └───────────────┘         └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                    🅰️ Ledger (Supabase A)                         │
│  - journals に election_id, organization_id を Ledger内IDで参照  │
│  - elections: hub_politician_id, hub_election_id で Hub 参照     │
│  - political_organizations: hub_organization_id で Hub 参照      │
│  - profiles: hub_politician_id で認証済み政治家を紐付け          │
│  - politicians テーブルは存在しない（Hub で一元管理）            │
└───────────────────────────────────────────────────────────────────┘
```

### 6.3. Hub の役割

| 機能           | 説明                                             |
| -------------- | ------------------------------------------------ |
| 共通識別子管理 | politicians, organizations, elections を一元管理 |
| 公開データ保存 | Ledger から同期された公開用仕訳データを保存      |
| 匿名化         | `is_name_private` 等に基づきデータを変換         |
| API 提供       | Ledger / Polimoney / 将来の消費者へ API 提供     |

### 6.4. 認証方式

| 通信              | 認証方式                       |
| ----------------- | ------------------------------ |
| ユーザー → Ledger | JWT (🅰️ Supabase A Auth)       |
| Ledger → Hub      | API Key (`X-API-Key` ヘッダー) |
| 管理者 → Hub      | JWT (🅱️ Supabase B Auth)       |
| Polimoney → Hub   | API Key (`X-API-Key` ヘッダー) |

### 6.5. Hub がダウンした場合

**Hub がダウン = Polimoney 3 プロダクト全体がダウン**

これは許容される設計判断です。理由：

- Hub は Deno Deploy + Supabase で高可用性
- 共通識別子の二重管理による不整合リスクを避ける
- 同期ロジックの複雑さを避ける

---

## 7. ストレージ戦略

### 7.1. 年度締め機能（政治団体台帳）

政治団体台帳は 1 台帳で複数年度のデータを管理（年度フィルタ方式）。
各年度は個別に「締め処理」が可能。

**ステータス遷移:**

```
open（編集可能）
    │
    │ ユーザーが「年度締め」（手動）
    │ または 年度終了から 3年経過（自動）
    ▼
closed（読み取り専用）
    │
    │ 締めから 1年経過（自動）
    ▼
locked（完全ロック）
    │ - 領収書画像: Ledger DB → Hub DB に移行
    │ - Ledger Storage から削除
    │
    │ 修正が必要な場合
    ▼
temporary_unlock（一時解除、7日間）
    │
    │ 修正完了 or 期限切れ
    ▼
locked（再ロック）
```

**年度締めのトリガー:**

| 方式 | タイミング              | 説明                 |
| ---- | ----------------------- | -------------------- |
| 手動 | 随時                    | ダッシュボードで促す |
| 自動 | 年度終了から **3 年後** | 法定保存期間に基づく |

### 7.2. データ保存場所

| 期間   | 仕訳データ                          | 領収書画像           | 編集    |
| ------ | ----------------------------------- | -------------------- | ------- |
| open   | Ledger DB                           | Ledger Storage       | ✅ 可   |
| closed | Ledger DB                           | Ledger Storage       | ❌ 不可 |
| locked | Ledger DB（非公開）+ Hub DB（公開） | **Hub Storage のみ** | ❌ 不可 |

**非公開データの扱い:**

- 非公開情報（`is_name_private` 等）は **Ledger DB に残す**
- Hub DB には匿名化済みの公開データのみ保存
- Hub Admin は非公開データにアクセス不可

### 7.3. ロック解除リクエスト

ロックされたデータの修正が必要な場合:

```
1. ユーザーが Ledger から「修正依頼」を送信
   - 対象: 台帳 + 年度（または選挙台帳）
   - 理由: 修正が必要な理由を記載

2. Hub Admin が確認・承認
   - 形式的なチェックのみ
   - 「承認」クリックで一時解除

3. 一時解除（7日間）
   - ユーザーが修正を実施
   - 修正完了後「再締め」をクリック
   - または 7日経過で自動再ロック
```

**管理者の作業は最小限:**

| 作業             | 担当         | 工数 |
| ---------------- | ------------ | ---- |
| 修正理由の確認   | Admin        | 1 分 |
| 「承認」クリック | Admin        | 5 秒 |
| 実際の修正作業   | **ユーザー** | -    |
| 再ロック         | **自動**     | -    |

### 7.4. データモデル

```sql
-- 年度締めステータス
CREATE TABLE ledger_year_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id),
    fiscal_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    -- open / closed / locked / temporary_unlock
    closed_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    storage_migrated_at TIMESTAMPTZ,
    UNIQUE(ledger_id, fiscal_year)
);

-- ロック解除リクエスト
CREATE TABLE unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID REFERENCES ledgers(id),
    election_id UUID REFERENCES elections(id),
    fiscal_year INTEGER,
    reason TEXT NOT NULL,
    requested_by_user_id UUID NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    -- pending / approved / rejected / completed / expired
    reviewed_by_admin_id UUID,
    reviewed_at TIMESTAMPTZ,
    unlocked_at TIMESTAMPTZ,
    unlock_expires_at TIMESTAMPTZ,
    relocked_at TIMESTAMPTZ,
    CHECK (ledger_id IS NOT NULL OR election_id IS NOT NULL)
);
```

---

## 8. 正確性・整合性の担保

### 7.1. 複式簿記のバリデーション

```typescript
// 借方合計 = 貸方合計 のチェック
function validateJournal(entries: JournalEntry[]): boolean {
  const debitSum = entries.reduce((sum, e) => sum + e.debit_amount, 0);
  const creditSum = entries.reduce((sum, e) => sum + e.credit_amount, 0);
  return debitSum === creditSum;
}
```

### 7.2. トランザクション

```sql
BEGIN;
  INSERT INTO journals (...) VALUES (...) RETURNING id;
  INSERT INTO journal_entries (...) VALUES (...);
  INSERT INTO journal_entries (...) VALUES (...);
COMMIT;
```

### 7.3. 楽観的ロック

```sql
UPDATE journals
SET description = '...', updated_at = now()
WHERE id = $1 AND updated_at = $2;  -- 競合検知
```

---

## 9. 今後の検討事項

- [ ] Azure への移行（Supabase Self-Host）
- [ ] CI/CD パイプライン（GitHub Actions）
- [ ] E2E テスト（Playwright）
- [ ] パフォーマンスモニタリング（Sentry）
- [ ] バックアップ戦略

---

## 更新履歴

- 初版作成
- ストレージ戦略セクションを追加
- 年度締め・ロック機構を追加
- Next.js (apps/web) と Ledger API (apps/api, Hono on Deno, /v1) の分離構成に更新
