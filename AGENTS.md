# AI エージェントへの指示書

このファイルは、AI
アシスタントがこのプロジェクトで作業する上での、中心的なコンテキストを定義します。

## 担当エージェント

- **人間開発者:** プロジェクトリード
- **AI アシスタント:** ペアプログラマー

---

## 1. アーキテクチャ設計書 (ARCHITECTURE)

システム全体のアーキテクチャと技術スタックに関する唯一の信頼できる情報源です。

**技術スタック:**

- フロントエンド: Next.js (App Router) + Mantine（`apps/web`）
- バックエンド: Ledger API = 独立した Hono アプリ on Deno（`apps/api`、全ルート `/v1` 配下）
- 共有コード: `packages/shared`（型・権限・勘定科目）
- データベース: PostgreSQL (Supabase)。API はユーザーの JWT 付きクライアントで RLS を効かせる
- 認証: Supabase Auth（Web は認証だけ Supabase を直接使い、API は `Authorization: Bearer <JWT>` で呼ぶ）
- ホスティング: Deno Deploy（web と api の 2 アプリ）+ Supabase Cloud（DB・Auth・Storage）
- Supabase Edge Functions は使用しない

@./docs/ARCHITECTURE.md

---

## 2. 設計方針書 (DESIGN_DOC)

高レベルの設計方針を定義します。

@./docs/DESIGN_DOC.md

---

## 3. 機能仕様書 (SPECIFICATION)

実装すべき機能の具体的なデータモデルや画面仕様を定義します。

> ⚠️ **注意**: 画面仕様のレイアウト記述は Flutter 版当時のものです。現行の実装箇所は
> 各節の「ファイル」（`apps/web/app/` / `apps/web/components/`）を参照してください。

@./docs/SPECIFICATION.md

---

## 4. リファレンスドキュメント (REFERENCE)

政治資金規正法、収支報告書の記載例、Polimoney との連携に必要な情報源です。

### 参照タイミング

以下のタイミングで `docs/REFERENCE.md` を参照してください：

- **勘定科目・補助科目の追加・変更時** - 収支報告書の項目分類を確認
- **仕訳登録フォームの設計時** - 領収書等の要件、明細記載基準を確認
- **Polimoney 連携機能の実装時** - city_code 等の形式を確認
- **DB スキーマや仕様の変更時** - 法令上の要件との整合性を確認

### リファレンス資料

@./docs/REFERENCE.md

### 自動生成されたコンテキスト

`docs/reference/` フォルダ内の PDF・Excel
ファイルの内容は、以下のコマンドで統合ファイルに変換できます：

```bash
python make_docs_context_v2.py
```

生成されたファイル: `agent_reference_context.md`

**注意:** REFERENCE.md
のリンク先を直接読めない場合は、上記コマンドを実行してから
`agent_reference_context.md` を参照してください。

---

## 5. テストアカウントとテストデータ (TEST_DATA)

開発・テスト用のダミーデータの仕様を定義します。

### 重要なポイント

- **テストユーザー ID:** `00000000-0000-0000-0000-000000000001`
- **テストデータは本番 Hub に保存** - `is_test = true` フラグで識別
- **公開 API からは除外** - `is_test = false` のデータのみ返却

### 参照タイミング

以下のタイミングで `docs/TEST_DATA.md` を参照してください：

- **テストアカウントでの動作確認時** - テストデータの構成を確認
- **Hub API 連携の実装時** - テストデータフラグの扱いを確認
- **同期機能（sync API）の修正時** - `is_test` フラグの設定を確認

@./docs/TEST_DATA.md

---

## 6. 開発環境とツール (Environment & Tooling)

- **IDE:** VS Code / Cursor (推奨)
- **Configuration:** `.vscode/` ディレクトリ内の設定ファイルに従ってください。
- **Node.js:** 22 系（`package.json` の volta 設定）。npm workspaces（`apps/web`, `packages/shared`）。
- **Deno:** 2 系（`apps/api` とシードスクリプト）。

### 開発サーバー

```bash
npm install
npm run dev:api   # Ledger API  http://localhost:3723（apps/api/.env）
npm run dev:web   # Web         http://localhost:3721（apps/web/.env.local）
npm run check     # API の deno check + Web の tsc --noEmit
```

Hub（`polimoney_hub`）はポート 3722 で先に起動しておきます。

詳細は `docs/DEVELOPMENT.md` を参照してください。

### Flutter 版 (Legacy)

Flutter 版のコードは `legacy/flutter/` にあります。 詳細は
`legacy/flutter/README.md` を参照してください。

---

## 7. レガシーコードについて

`legacy/flutter/` ディレクトリには Flutter 版のコードが保存されています。
新規機能開発は Next.js で行いますが、Flutter 版の保守作業が必要な場合は
そのディレクトリ内で作業してください。
