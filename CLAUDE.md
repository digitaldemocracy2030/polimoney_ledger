# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 前提

- Fresh (Deno) → Next.js + Mantine に移行し、さらに API を独立した Hono アプリに分離した（ブランチ `migration/fresh-to-nextjs`、計画と進捗は `docs/implementation_plan.md`）。**サービス開始前**なので後方互換のための仕組みは残さない。
- `docs/SPECIFICATION.md` 3 章の画面レイアウト記述は Flutter 版当時の用語（AppBar, ListTile 等）のまま。要件として読み、実装箇所は各節の「ファイル」を見ること。`docs/SPECIFICATION_AGENT.md` は古い写し。
- `legacy/flutter/` は旧 Flutter 版（触らない）。

## コマンド

```bash
npm install          # npm workspaces（apps/web, packages/shared）
npm run dev:api      # Ledger API  http://localhost:3723（deno task dev, apps/api/.env を読む）
npm run dev:web      # Web         http://localhost:3721（apps/web/.env.local を読む）
npm run check        # API の deno check + Web の tsc --noEmit（テストは未整備）
npm run build:web
```

- 環境変数の雛形: `apps/api/.env.example` → `apps/api/.env`、`apps/web/.env.example` → `apps/web/.env.local`。
- Hub（別リポジトリ `polimoney_hub`, ポート 3722）を先に起動しておく。
- DB: スキーマは `supabase/migrations/`（Supabase CLI。リポジトリ内に完全なスキーマ SQL は置かない。現状の確認は `supabase db dump --linked`）。テストデータは `db/seed-supabase.ts` / `supabase/seed.sql`（本番では実行しない）。詳細は `docs/DEVELOPMENT.md`。

## アーキテクチャ

| ディレクトリ      | 役割                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (App Router) + Mantine 9。フロントエンドのみ。Next.js の API ルートは無い |
| `apps/api`        | Hono on Deno（Deno Deploy 想定）。`main.ts` → `app.ts`、`routes/*.ts`、`lib/*.ts`      |
| `packages/shared` | Web と API で共有する TS（`types.ts`, `permissions.ts`, `account-codes.ts`, `hub-types.ts`, `receipts.ts`） |

### Web（apps/web）

- Supabase は**認証にだけ**使う（`lib/supabase/client.ts` の `@supabase/ssr` `createBrowserClient`、セッションは Cookie）。`supabase.from(...)` や `user_metadata` を Web で使わない。ユーザー状態は `GET /v1/me`。
- データはすべて `lib/api-client.ts` の `apiFetch('/v1/...')` / `apiJson` 経由。`NEXT_PUBLIC_API_URL` を前に付け、`Authorization: Bearer <access_token>` を付ける。401 なら `/login` へ。
- `proxy.ts`（Next.js 16 で middleware から改名。Node.js ランタイム）は画面の振り分けだけ（未ログイン → `/login?redirect=...`、`app_metadata.registration_status === 'pending_review'` → `/pending-review`）。
- shared は `@polimoney-ledger/shared/<file>.ts` で import。`@/*` は `apps/web` 基準。

### API（apps/api）

- 全ルートは `/v1` 配下。`GET /v1/health` 以外は `lib/auth.ts` の `requireAuth`（Bearer JWT を `supabase.auth.getUser` で検証）。`c.get("userId" | "user" | "accessToken" | "supabase")`。ルーターは `new Hono<AppEnv>()`（`lib/types.ts`）。
- **DB アクセスは `c.get("supabase")`（ユーザーの JWT 付き、RLS 適用）が原則。** `getServiceClient()`（service_role）は auth.admin、他ユーザーにまたがる操作（招待・オーナー譲渡）、Hub 同期、RLS で表せない Storage 操作だけに使い、**必ず先に `lib/authz.ts`（`requireLedgerRole` / `requireLedgerPermission` / `requireJournalAccess` 等）で権限を確認する**。
- エラーは JSON `{ error: string }`（日本語）。`lib/errors.ts` の `httpError` を throw すれば `app.ts` の `onError` がそのまま返す。Hub 失敗は 502。
- 権限の定義は `packages/shared/src/permissions.ts` と SQL 側 `public.role_has_permission`（`supabase/migrations/20261121100000_api_user_scoped_rls.sql`）の 2 か所。片方を変えたらもう片方も変える。
- 環境変数は `Deno.env.get`。shared は deno.json の imports で `@polimoney-ledger/shared/` を相対パスに対応付け。shared 内の import は `.ts` 拡張子付き。

### Supabase と Hub

- **Ledger DB (Supabase A)**: 台帳（`ledgers` + `ledger_members`）・仕訳（`journals` / `journal_entries`, 複式簿記）・関係者（`contacts` + `ledger_contacts`）・補助科目・証憑 Storage。
  - 台帳 → 政治団体 / 選挙 は `ledgers.organization_id` / `election_id`（`ledger_type` は `political_fund` / `election_fund`）。
  - Ledger に `politicians` / `politician_organizations` / `politician_elections` テーブルは無い。政治家・政治団体・選挙のマスタは Hub が持ち、Ledger は `hub_*` の ID だけを保持する（Hub とは `apps/api/lib/hub-client.ts` 経由のみ）。
  - オーナーの admin メンバー行は DB トリガー `trg_ledger_auto_member` が作る（API で重ねて作らない）。
- **Polimoney Hub (別サービス, Supabase B)**: 政治家・政治団体・選挙・勘定科目マスタの唯一の情報源。Ledger は `hub_*_id` で参照するだけ。`apps/api/lib/hub-client.ts`（`X-API-Key`）。公開データ同期は `routes/sync.ts` + `lib/sync-transform.ts`（匿名化）。
- **テストユーザー** `00000000-0000-0000-0000-000000000001` は DB 上は普通のユーザー（RLS をバイパスしない）。`isTestUser()` は Hub 用キー（`HUB_API_KEY_DEV`）の選択と同期時の `is_test` にだけ使う（同期では台帳オーナーで判定）。`docs/TEST_DATA.md`。

## 規約

- ドキュメント・コミットメッセージは日本語。コミットは `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` 等のプレフィックス + 要約、空行、箇条書きの詳細。
- 法令・報告書様式は `docs/REFERENCE.md`。
