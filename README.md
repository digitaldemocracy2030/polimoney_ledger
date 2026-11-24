# polimoney_ledger

Polimoney へインポート可能な json
と、政治資金収支報告書もしくは選挙運動費用収支報告書をエクスポートできる会計ソフトを目指します。

## 構成

| ディレクトリ      | 内容                                                      |
| ----------------- | --------------------------------------------------------- |
| `apps/web`        | Web フロントエンド（Next.js + Mantine）                   |
| `apps/api`        | Ledger API（Hono on Deno、`/v1` 配下）                    |
| `packages/shared` | Web と API で共有する型・権限定義・勘定科目               |

DB・認証・ストレージは Supabase、政治家・政治団体・選挙のマスタは
Polimoney Hub（`polimoney_hub` リポジトリ）が管理します。

## セットアップ

前提: Node.js 22 / npm、Deno 2、ローカルで起動した Polimoney Hub（ポート 3722）

```bash
npm install
cp apps/api/.env.example apps/api/.env          # Supabase / Hub の値を設定
cp apps/web/.env.example apps/web/.env.local    # NEXT_PUBLIC_* を設定

npm run dev:api   # Ledger API  http://localhost:3723
npm run dev:web   # Web         http://localhost:3721
```

DB の準備（スキーマ・RLS マイグレーション・テストデータ）を含む詳細は
[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) を参照してください。

## 内容が古い場合があります

最新の情報に更新したいと思っていますが、特に外部サービスの内容はアップデートにより古くなりがちです。

気付いた場合はぜひコントリビュートしてください！

[コントリビュートガイド](./CONTRIBUTING.md)
