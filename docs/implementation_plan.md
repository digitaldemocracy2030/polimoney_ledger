# 実装計画: バックエンド API の分離

最終更新: 2026-11-21

## 1. 目的

- フロントエンド（Next.js）とバックエンド API をはっきり分ける。
- 将来のネイティブアプリなど、Web 以外のクライアントからも同じ API を使えるようにする。
- 移行時に残った認証まわりの不具合（セッションが Cookie に入らない、`X-User-Id` ヘッダーの偽装、RLS が効かない等）をあわせて解消する。

## 0. 進捗（2026-11-21 時点）

| フェーズ | 内容                                 | 状況                                   |
| -------- | ------------------------------------ | -------------------------------------- |
| 0        | `X-User-Id` 偽装の緊急修正           | ✅ 完了（ブリッジごと削除）            |
| 1        | API を独立した Deno アプリにする     | ✅ 完了                                |
| 2        | 認証を JWT に統一する                | ✅ 完了                                |
| 3        | 足りない API を補う                  | ✅ 完了                                |
| 4        | フロントエンドを API クライアント方式に | ✅ 完了                             |
| 5        | ディレクトリ整理と共有パッケージ     | ✅ 完了                                |
| 6        | デプロイ（Deno Deploy に 2 アプリ）  | ❌ 未着手                              |
| 7        | ドキュメント                         | 🔶 構成の更新は完了。OpenAPI は未検討 |

`npm run check`（API の `deno check` と Web の `tsc --noEmit`）は通る。
本番環境・ブラウザでの一連の操作確認は、フェーズ 6 の残作業として未実施。

### 0.1. 残っている手作業

1. **DB マイグレーションの適用**: 対象の Supabase（Ledger 用 A）に `supabase/migrations/20261121100000_api_user_scoped_rls.sql` を適用する（`supabase db push`）。
   本番の v6 スキーマに対する差分。適用しないと API の大半が RLS で拒否される。
2. **環境変数の設定**: web と api に分けて設定する（3.2 節）。service_role キーと Hub API キーは api だけに置く。
   本番の Web（`https://ledger.polimoney.dd2030.org`）と API（`https://ledger-api.polimoney.dd2030.org`）の URL はコードの既定値なので、
   api の `CORS_ALLOWED_ORIGINS` と web の `NEXT_PUBLIC_API_URL` は設定しなくてよい。
   api の `HUB_API_URL_DEV` は本番の Hub（`https://api.polimoney.dd2030.org`）にする（テストユーザーも本番の Hub を使う）。
3. **Deno Deploy のアプリ作成**: `ledger-web`（`apps/web`）と `ledger-api`（`apps/api`、エントリ `main.ts`）の 2 つを作る。
4. **Supabase Auth のリダイレクト URL**: Site URL と Redirect URLs に本番 Web の `<オリジン>/auth/callback` を登録する
   （メール確認・パスワード再設定のリンク先）。
5. 本番で ログイン → 台帳一覧 → 仕訳登録 → 承認 → ログアウト の一連の操作を確認する。

## 2. 方針（決定事項）

| 項目           | 決定                                                                 |
| -------------- | -------------------------------------------------------------------- |
| API の置き場所 | **独立した Hono アプリを Deno Deploy にデプロイ**（Hub と同じ構成）  |
| フロントエンド | Next.js を Deno Deploy に別アプリとしてデプロイ                      |
| 認証           | Supabase Auth。クライアントは `Authorization: Bearer <JWT>` で API を呼ぶ |
| DB アクセス    | API がリクエストごとに **ユーザーの JWT 付き Supabase クライアント**を作り、RLS を効かせる |
| 特権処理       | Hub 連携・メンバー招待など必要な箇所だけ service_role を使う        |
| バージョン     | API のパスに `/v1` を付ける（ネイティブアプリの後方互換のため）     |

### 2.1. 認証の扱い（API でラップしない）

認証（ID・トークンの発行と更新）だけは API でラップせず、クライアントが Supabase Auth を直接使う。

| 扱うもの                                                       | 窓口                                       |
| -------------------------------------------------------------- | ------------------------------------------ |
| ログイン、登録、ログアウト、トークン更新、パスワード再設定     | Supabase Auth を直接（クライアント SDK）   |
| それ以外のすべて（ユーザー状態、データ、Hub 連携、招待など）   | Ledger API（`/v1/...`）                    |

- 理由: supabase-js や公式ネイティブ SDK のトークン自動更新・安全な保存・メールリンク処理をそのまま使える。RLS が Supabase の JWT を前提とするため、ラップしても Supabase を隠しきれない。パスワードが自前サーバーを通らない。
- クライアントでの Supabase の使い道は **認証だけ**。画面から `supabase.from(...)` などで DB を直接触らない。
- ユーザーの状態（審査状況、規約同意、政治家認証、所属台帳とロール）は `GET /v1/me` で API から取得する。クライアントが `user_metadata` を直接読まない。
- 登録時の業務処理（規約同意の記録、プロフィール作成など）は、`signUp` の後に API を呼んで行う。

### 2.2. 検討した他の案

| 案                                    | 採用しなかった理由                                                       |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Supabase Edge Functions               | CPU 時間・メモリ（256MB）の制限があり、報告書の生成など重い処理に不安がある。Supabase への依存が強まり、将来の Azure 移行で不利になる |
| クライアントから Supabase を直接操作 | ビジネスロジックが RLS とクライアントに散らばり、API の大半を書き直すことになる |

### 2.3. Deno Deploy 無料プランでの見込み

- 無料プランの枠: 月 100 万リクエスト、CPU 時間は月 10〜15 時間程度、1 組織 20 アプリまで（2026-11 時点の調査。正式な値は https://deno.com/deploy/pricing で確認すること）。
- 枠を超えると翌月までアプリが停止する。全ての枠を使うにはクレジットカード登録による認証が必要。
- web と api の 2 アプリに分けるため、1 回の画面表示で両方のリクエストが数えられる。会計担当者向けの業務アプリで利用者数は限られるので、当面は枠内に収まる見込み。
- Supabase 無料プランは一定期間アクセスがないとプロジェクトが一時停止するため、本番運用では注意する。

## 3. 目標構成

```
┌──────────────┐   ┌──────────────────┐
│ Web (Next.js)│   │ ネイティブアプリ │   ← 将来
└──────┬───────┘   └────────┬─────────┘
       │ ① Supabase Auth でログイン（supabase-js）
       │ ② Authorization: Bearer <JWT> で API を呼ぶ
       ▼                    ▼
┌──────────────────────────────────────────┐
│ Ledger API (Hono / Deno Deploy)          │
│  /v1/journals, /v1/contacts, ...         │
│  - JWT を検証して userId を決定          │
│  - ユーザーの JWT 付きクライアントで DB  │
│  - service_role は特権処理のみ           │
└──────┬───────────────────────┬───────────┘
       ▼                       ▼ X-API-Key
┌──────────────────┐   ┌──────────────────┐
│ Supabase A       │   │ Polimoney Hub    │
│ DB / Auth / 画像 │   │                  │
└──────────────────┘   └──────────────────┘
```

### 3.1. ディレクトリ構成（実装済み）

```
polimoney_ledger/
├── apps/
│   ├── web/        # Next.js（app/, components/, lib/, middleware.ts）
│   └── api/        # Hono（Deno）
│       ├── deno.json
│       ├── main.ts           # Deno.serve(app.fetch)
│       ├── app.ts            # Hono アプリ・ミドルウェア
│       ├── routes/
│       └── lib/
├── packages/
│   └── shared/     # 型定義、勘定科目コード、権限定義（web / api / 将来のアプリで共有）
├── db/
└── docs/
```

### 3.2. 環境変数（分離後）

| アプリ | 変数                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| web    | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`  |
| api    | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`, `HUB_API_URL_*`, `HUB_API_KEY_*`, `CORS_ALLOWED_ORIGINS` |

service_role キーと Hub API キーは **api だけ**が持つ。

## 4. フェーズ

### フェーズ 0: 緊急のセキュリティ修正 ✅

> 結果: `app/api/[...path]/route.ts` を含む `X-User-Id` の仕組み自体をフェーズ 2・4 で削除したため解消。

**問題**: `app/api/[...path]/route.ts` はクライアントのリクエストヘッダーをそのまま Hono に渡し、
ログインしている場合だけ `X-User-Id` を上書きする。未ログインのクライアントが `X-User-Id` を
自分で付けて送ると、その値がそのまま userId として使われる。テストユーザーの ID を指定すれば
service_role（RLS を通らない）で DB にアクセスできてしまう。

**対応**: 転送前に必ず `X-User-Id` を削除し、セッションから得た値だけを設定する。

- 確認: 未ログインで `curl -H "X-User-Id: 00000000-0000-0000-0000-000000000001" /api/contacts` が 401 になること。

### フェーズ 1: API を独立した Deno アプリにする ✅

1. `apps/api/` を作り、`src/api/` と `lib/` のサーバー側コード（`supabase.ts`, `hub-client.ts`, `sync-transform.ts`）を移す。
2. `deno.json` の `imports` に `hono`, `@supabase/supabase-js`, `fflate` を `npm:` で登録し、`@/` のパスエイリアスを置き換える。
3. `process.env` を `Deno.env.get` に置き換える。
4. `main.ts` で `Deno.serve` を使って起動する（ローカルのポートは 3723。Hub が 3722 を使うため）。
5. 全ルートを `/v1` 配下にマウントする。
6. `sync.ts` などに残る文字化けしたコメントを直す。

- 確認: `deno check`、`deno task dev` で起動し `/v1/health` が応答すること。

### フェーズ 2: 認証を JWT に統一する ✅

> 結果: `apps/api/lib/auth.ts` の `requireAuth` が `supabase.auth.getUser(token)` で検証する。
> テストユーザー向けの service_role 分岐はすべて削除し、service_role を使う箇所は `apps/api/lib/authz.ts` で権限を確認してから使う。
> RLS ポリシーは `supabase/migrations/20261121100000_api_user_scoped_rls.sql` にまとめた（適用は 0.1 節の手作業）。

1. Hono ミドルウェアで `Authorization: Bearer` の JWT を検証し、`c.set("userId")` と `c.set("supabase")` を設定する。
   - 検証は `supabase.auth.getClaims(token)`（JWT 署名鍵による検証）または `getUser(token)` を使う。
   - `supabase` は `createClient(url, publishableKey, { global: { headers: { Authorization } } })` で作り、RLS を効かせる。
2. `X-User-Id` ヘッダーの仕組みを廃止する。
3. ルートごとの `userId === TEST_USER_ID ? getServiceClient() : ...` の分岐（16 ファイル）を、`c.get("supabase")` に置き換える。
   - テストユーザーのデータもオーナーがテストユーザーなので RLS で読めるはず。service_role が必要な箇所だけ残す。
4. service_role を使う箇所（Hub 同期、メンバー招待、所有権移譲など）を一覧にし、それぞれで権限チェックをしているか確認する。
5. CORS を設定する（`CORS_ALLOWED_ORIGINS` の Web のオリジンだけ許可。ネイティブアプリは CORS の対象外）。

- 確認: 有効なトークンで 200、トークンなし・不正なトークンで 401、他人の台帳は RLS で見えないこと。

### フェーズ 3: 足りない API を補う ✅

> 結果: 下記に加えて `GET /v1/me`・`POST /v1/me/onboarding`・`GET /v1/export` を追加した。一覧は [ARCHITECTURE.md](./ARCHITECTURE.md) 5.1。

画面が呼んでいるのに存在しないエンドポイントを実装する。

- `GET /dashboard`, `GET /account-master`, `GET /managed-organizations`, `GET /pending-review`, `/receipts`
- `GET /organizations`, `GET /elections`（台帳一覧）
- `POST /members` を仕様どおりにする（`ledger_members` へ登録、ユーザー作成、招待メール送信）

### フェーズ 4: フロントエンドを API クライアント方式にする ✅

1. `lib/api-client.ts` を作る。`NEXT_PUBLIC_API_URL` を基準に、Supabase のセッションから取ったアクセストークンを付けて呼ぶ。
2. 画面の `fetch('/api/...')`（約 67 か所）を API クライアントに置き換える。
3. ログイン・登録画面を `@supabase/ssr` の `createBrowserClient` に変える（セッションを Cookie に保存し、`middleware.ts` の画面ガードと揃えるため）。
4. `app/api/[...path]/route.ts`、`/auth/callback` の独自 Cookie 処理、`components/auth/AuthCallback.tsx` を整理・削除する。
5. `middleware.ts` は画面の振り分け（未ログイン → `/login`、審査待ち → `/pending-review`）だけを担当する。データの権限判断は API に任せる。

- 確認: `npx tsc --noEmit`、`npm run build`、ブラウザでログイン → 台帳一覧 → 仕訳登録 → ログアウトの一連の操作。

### フェーズ 5: ディレクトリの整理と共有パッケージ ✅

1. Next.js を `apps/web/` に移す。
2. 型定義（`lib/types.ts`）、勘定科目コード（`src/constants/account-codes.ts`）、権限定義（`lib/permissions.ts`）を `packages/shared/` に移し、web と api の両方から使う。
3. 重複している `src/components/common/SubAccountManager.tsx` を削除する。
4. `.devcontainer/` を Node.js + Deno の構成に更新する。

### フェーズ 6: デプロイ ❌ 未着手

手順は 0.1 節を参照。

1. Deno Deploy に `ledger-web` と `ledger-api` の 2 アプリを作り、環境変数を分けて設定する。
2. Supabase Auth のリダイレクト URL に Web の URL を登録する。
3. 本番で一連の操作を確認する。

### フェーズ 7: ドキュメント 🔶

- ✅ `ARCHITECTURE.md`、`DEVELOPMENT.md`、`DESIGN_DOC.md`、`TEST_DATA.md`、`SPECIFICATION.md`（ファイルパス）、`AGENTS.md`、`CLAUDE.md`、`README.md` を分離後の構成に更新した。
- ❌ API 仕様を OpenAPI で公開することを検討する（`@hono/zod-openapi` を使えばネイティブアプリ向けの型を自動生成できる）。

## 5. リスクと未決事項

| 項目 | 内容 |
| ---- | ---- |
| RLS ポリシーの網羅性 | `supabase/migrations/20261121100000_api_user_scoped_rls.sql` で API が使うテーブルのポリシーを定義した。本番に対して BEGIN…ROLLBACK で適用・RLS の確認済み。適用後の API での動作確認は未実施 |
| Hub の中間テーブル ID | Hub 同期に必要な `politician_organization_id` / `politician_election_id` を Hub API から取得できない。`ledgers.hub_politician_*_id` は null のままで、同期は理由付きエラーになる。Hub 側にエンドポイントが必要 |
| `members` と `ledger_members` | ✅ 解決: `ledger_members` に統一した（`POST /v1/members` はユーザー作成・登録・OTP メール送信まで実装） |
| Deno Deploy の制限 | 報告書の生成など CPU を多く使う処理がリクエスト単位の制限に当たらないか、フェーズ 6 で確認する |
| SSR でのデータ取得 | 今は画面がほぼクライアント側でデータを取得している。将来 SSR で API を呼ぶ場合は、Cookie のセッションからトークンを取り出して渡す |
