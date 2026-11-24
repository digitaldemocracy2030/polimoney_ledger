# polimoney_ledger 設計方針書

> ⚠️ **注意**: 詳細なアーキテクチャ設計は [ARCHITECTURE.md](./ARCHITECTURE.md)
> を参照してください。

## 1. バックエンド

- **Supabase** を使用する。
- DD2030 がホスティングする共有インスタンスを使用（詳細は
  [SERVICE_POLICY.md](./SERVICE_POLICY.md) 参照）。
- **利点:** データの一貫性、Polimoney との連携、ユーザビリティ向上。

## 2. フロントエンド

| 項目           | 選択                     | 理由                                                       |
| -------------- | ------------------------ | ---------------------------------------------------------- |
| フレームワーク | **Next.js (App Router)** | React 19。画面のみを担当し、データは Ledger API から取得   |
| UI             | **Mantine**              | フォーム・日付・通知などの部品が揃う                       |
| ホスティング   | **Deno Deploy**          | Web と API（Hono on Deno）をそれぞれ別アプリとしてデプロイ |

API は独立した Hono アプリ（`apps/api`、`/v1` 配下）で、Web 以外のクライアント（将来のネイティブアプリ等）からも
同じ API を使える。詳細は [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 3. 初回セットアップ

- **方針:** DD2030 ホスティングにより、ユーザーは Supabase セットアップ不要。
- **ユーザーフロー:** アカウント作成 → OTP 認証 → 利用開始

## 4. 権限管理

- **Row Level Security (RLS):** PostgreSQL の RLS で論理的にデータ分離。
- **役割ベース:** admin / accountant / approver / submitter / viewer の 5 段階。
- **詳細:** [SPECIFICATION.md](./SPECIFICATION.md) の 2.11 節参照。

## 5. ディレクトリ構成

```
polimoney_ledger/
├── apps/
│   ├── web/                    # Next.js（フロントエンドのみ。Supabase は認証だけに使う）
│   │   ├── app/                # App Router（ページ）
│   │   ├── components/         # UI コンポーネント（ドメイン別）
│   │   ├── lib/                # api-client.ts（Ledger API 呼び出し）、supabase/（認証）
│   │   └── middleware.ts       # 画面の振り分け（未ログイン・審査待ち）
│   └── api/                    # Ledger API（Hono on Deno、/v1 配下）
│       ├── main.ts / app.ts
│       ├── routes/             # ドメイン別ルーター
│       └── lib/                # 認証・認可、Supabase / Hub クライアント、同期変換
├── packages/
│   └── shared/                 # Web と API で共有する型・権限・勘定科目
├── db/                         # マイグレーション SQL、シードスクリプト
├── supabase/
│   └── seed.sql                # 開発用ダミーデータ
├── legacy/
│   └── flutter/                # Flutter版（レガシー）
└── docs/
```

## 6. レガシーコード

Flutter 版のコードは `legacy/flutter/` に保存されています。新規開発は Next.js
で行います（Fresh (Deno) 版からも移行済み）。
