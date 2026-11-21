# 開発環境セットアップ

## 構成

| ディレクトリ      | 内容                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/web`        | Next.js（フロントエンドのみ）。Supabase は認証だけに使う               |
| `apps/api`        | Ledger API（Hono / Deno）。データの読み書きはすべてここを通す          |
| `packages/shared` | Web と API で共有する型・権限定義・勘定科目（フレームワーク非依存の TS） |

- Web は `apps/web/lib/api-client.ts` の `apiFetch('/v1/...')` で API を呼び、
  Supabase のアクセストークンを `Authorization: Bearer` で付ける
- API は JWT を検証し、そのユーザーの JWT 付きクライアント（RLS 適用）で DB にアクセスする。
  service_role は権限確認（`apps/api/lib/authz.ts`）を済ませた特権処理でのみ使う

## 前提条件

- Node.js 22 系（`package.json` の `volta` 設定を参照）と npm
- Deno 2 系（API の起動・テストデータの投入）
- Polimoney Hub（`polimoney_hub` リポジトリ）をローカルで起動できること

`.devcontainer/` を使う場合は Node.js 22 と Deno が入ったコンテナが作られ、
作成後に `npm install` が実行されます（ポート 3721 / 3723 を転送）。

## セットアップ

```bash
npm install                                     # npm workspaces（apps/web, packages/shared）
cp apps/api/.env.example apps/api/.env          # Supabase / Hub の値を設定
cp apps/web/.env.example apps/web/.env.local    # NEXT_PUBLIC_* を設定
```

API の依存（`npm:hono` など）は `apps/api/deno.json` の `imports` で管理し、初回起動時に Deno が取得します。

### 環境変数

| ファイル              | 主な変数                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/.env`       | `PORT`（3723）, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`, `HUB_API_URL_PROD` / `_DEV`, `HUB_API_KEY_PROD` / `_DEV`, `CORS_ALLOWED_ORIGINS` |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`（`http://localhost:3723`）                                               |

- `apps/api/.env` は `deno task dev`（`--env-file=.env`）が読み込みます。
- service_role キーと Hub API キーは API だけに設定し、Web には置かないでください。
- `APP_ENV=production` で Hub の URL / キーが `*_PROD` に切り替わります。
- `HUB_API_KEY_PROD` / `HUB_API_KEY_DEV` は、Hub 側の `LEDGER_SYNC_API_KEY_PROD` / `LEDGER_SYNC_API_KEY_DEV`（`backend/.env`）と同じ値にします。

テストユーザー（`00000000-0000-0000-0000-000000000001`）は常に
`HUB_API_KEY_DEV` で Hub に接続します。詳細は [TEST_DATA.md](./TEST_DATA.md)
を参照してください。

### データベース

スキーマは `supabase/migrations/` で管理します（Supabase CLI）。リポジトリに完全なスキーマ SQL は置きません。
本番の現状は `supabase db dump --linked` で確認してください（古いマイグレーションと本番が一部食い違っているため、
新しいマイグレーションは本番のスキーマに対する差分として書きます）。

- API 用の RLS・ヘルパー関数・Storage バケット: `supabase/migrations/20261121100000_api_user_scoped_rls.sql`
- 適用: `supabase db push`（本番に適用する前に、`BEGIN; <SQL>; ROLLBACK;` のファイルを
  `supabase db query --linked -f <file>` で流して確認する）
- テストデータ: `db/seed-supabase.ts --all`（または `--user` の後に `supabase/seed.sql`）。**本番では実行しない。**

API はユーザーの JWT（RLS 適用）で DB を読むため、上記マイグレーションを適用していない DB では
ほとんどの API が権限エラーになります。

**データモデルの要点（v6）:**

- 台帳: `ledgers(ledger_type = 'political_fund' | 'election_fund')`。`organization_id` → `political_organizations`、
  `election_id` → `elections`。メンバーは `ledger_members(ledger_id, user_id)`（一意）。
- 関係者: `contacts` を `ledger_contacts(ledger_id, contact_id)` で台帳に紐付ける。
- Ledger に政治家のテーブルは無い。政治家・政治団体・選挙のマスタは Hub が持ち、Ledger は `hub_*` の ID だけを持つ。
- Hub 同期に必要な `ledgers.hub_politician_organization_id` / `hub_politician_election_id` は、
  Hub API に取得手段が無いため現状 null。未設定の台帳の同期は理由付きのエラーになる。

### 認証の設定

- Supabase Auth の Redirect URLs に `<Web のオリジン>/auth/callback` を登録する
  （メール確認・パスワード再設定のリンク先）
- 登録審査中の状態は `app_metadata.registration_status = 'pending_review'` で表す
  （ユーザー自身は書き換えられない。service_role で設定する）

## サービスの起動

Ledger は Hub API に依存しているため、**Hub を先に起動**してください。
Web と API は別プロセスなので、ターミナルを 2 つ使います。

```bash
npm run dev:api   # Ledger API（http://localhost:3723）= cd apps/api && deno task dev
npm run dev:web   # Web（http://localhost:3721）
```

起動確認: `curl http://localhost:3723/v1/health` → `{"status":"ok"}`

## よく使うコマンド

| コマンド            | 説明                                     |
| ------------------- | ---------------------------------------- |
| `npm run dev:web`   | Web 開発サーバー（ポート 3721）          |
| `npm run dev:api`   | API 開発サーバー（ポート 3723、watch）   |
| `npm run build:web` | Web の本番ビルド（`output: 'standalone'`） |
| `npm run start:web` | Web の本番起動（ポート 3721）            |
| `npm run check`     | API の `deno check` と Web の `tsc`      |
| `npm run check:api` | API の型チェックのみ（`deno task check`） |
| `npm run check:web` | Web の型チェックのみ（`tsc --noEmit`）   |
| `deno lint`         | API の lint（`apps/api` で実行）         |

`apps/api/deno.json` のタスク:

| タスク            | 説明                                              |
| ----------------- | ------------------------------------------------- |
| `deno task dev`   | `.env` を読み込み、watch モードで起動             |
| `deno task start` | 起動（環境変数はプロセスの環境から読む。本番用）  |
| `deno task check` | `deno check main.ts`                              |

## テストユーザーとダミーデータ

```bash
# テストユーザーとダミーデータを投入（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を使用）
# スクリプトはカレントディレクトリの .env を読むので、apps/api から実行すると apps/api/.env が使われる
cd apps/api
deno run --allow-net --allow-env --allow-read ../../db/seed-supabase.ts --all

# --user: テストユーザーのみ / --data: ダミーデータのみ
```

テストユーザーも DB 上は普通のユーザーです（RLS をバイパスしません）。
シードはテストユーザーを台帳のオーナーにし、`ledger_members` にも admin として登録します。

## ポート一覧

| サービス   | ポート |
| ---------- | ------ |
| Ledger Web | 3721   |
| Hub API    | 3722   |
| Ledger API | 3723   |

## 構成図

```
┌──────────────────────┐  Bearer JWT  ┌──────────────────────┐  X-API-Key  ┌─────────────┐
│ Ledger Web (Next.js) │ ───────────→ │ Ledger API (Hono)    │ ──────────→ │     Hub     │
│        :3721         │              │        :3723         │             │    :3722    │
└──────────┬───────────┘              └──────────┬───────────┘             └──────┬──────┘
           │ 認証のみ                            │ RLS（ユーザーの JWT）           │
           └──────────────┬──────────────────────┘                          ┌──────┴──────┐
                  ┌───────┴─────────┐                                       │ Supabase B  │
                  │ Supabase A      │                                       │ (Hub 専用)  │
                  │ (Ledger 専用)   │                                       └─────────────┘
                  └─────────────────┘
```

## トラブルシューティング

### Hub に接続できない

1. Hub が起動しているか確認: `curl http://localhost:3722/health`
2. `apps/api/.env` の `HUB_API_URL_DEV` / `HUB_API_KEY_DEV`（本番は `*_PROD`）を確認
3. Hub に接続できない場合、API は `502 { error: "Polimoney Hub との通信に失敗しました" }` を返す

### API が 401 を返す

- Web の `NEXT_PUBLIC_SUPABASE_URL` と API の `SUPABASE_URL` が同じプロジェクトか確認
- API の `CORS_ALLOWED_ORIGINS` に Web のオリジンが含まれているか確認

## 技術スタック

- **Web**: Next.js 16 (App Router) / React 19 / Mantine 9 / @supabase/ssr
- **API**: Hono on Deno（Deno Deploy にデプロイ）
- **DB / 認証 / ストレージ**: Supabase
