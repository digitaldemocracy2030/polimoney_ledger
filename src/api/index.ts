/**
 * Ledger API (Hono)
 *
 * Fresh からルーティングされた API リクエストを処理
 */

import { Hono } from 'hono';
import { contactsRouter } from './routes/contacts';
import { journalsRouter } from './routes/journals';
import { electionsRouter } from './routes/elections';
import { organizationsRouter } from './routes/organizations';
import { politiciansRouter } from './routes/politicians';
import { membersRouter } from './routes/members';
import { subAccountsRouter } from './routes/sub-accounts';
import { profileRouter } from './routes/profile';
import { syncRouter } from './routes/sync';
import { uploadRouter } from './routes/upload';
import { ownershipTransfersRouter } from './routes/ownership-transfers';
import { electionRequestsRouter } from './routes/election-requests';
import { organizationRequestsRouter } from './routes/organization-requests';
import { accountRouter } from './routes/account';
import { hubOrganizationsRouter } from './routes/hub-organizations';
import { exportCsvRouter } from './routes/export-csv';
import { exportReportRouter } from './routes/export-report';
import { closuresRouter } from './routes/closures';
import { authRouter } from './routes/auth';

// Hono アプリを作成
export const api = new Hono<{
  Variables: {
    userId: string;
  };
}>();

// 認証ミドルウェア: Fresh から渡された userId を設定
api.use("*", async (c, next) => {
  const userId = c.req.header("X-User-Id");
  if (userId) {
    c.set("userId", userId);
  }
  await next();
});

// ルーターをマウント
api.route("/contacts", contactsRouter);
api.route("/journals", journalsRouter);
api.route("/elections", electionsRouter);
api.route("/organizations", organizationsRouter);
api.route("/politicians", politiciansRouter);
api.route("/members", membersRouter);
api.route("/sub-accounts", subAccountsRouter);
api.route("/profile", profileRouter);
api.route("/sync", syncRouter);
api.route("/upload", uploadRouter);
api.route("/uploads", uploadRouter); // 互換性のため
api.route("/ownership-transfers", ownershipTransfersRouter);
api.route("/election-requests", electionRequestsRouter);
api.route("/organization-requests", organizationRequestsRouter);
api.route("/account", accountRouter);
api.route("/hub-organizations", hubOrganizationsRouter);
api.route("/export-csv", exportCsvRouter);
api.route("/export-report", exportReportRouter);
api.route("/closures", closuresRouter);
api.route("/auth", authRouter);

// 404 ハンドラー
api.notFound((c) => {
  return c.json({ error: "API endpoint not found" }, 404);
});

// エラーハンドラー
api.onError((err, c) => {
  console.error("[API Error]", err);
  return c.json({ error: "Internal server error" }, 500);
});
