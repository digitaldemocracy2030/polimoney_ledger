/**
 * Ledger API (Hono)
 *
 * - GET /v1/health は認証不要
 * - それ以外の /v1/* は `Authorization: Bearer <Supabase のアクセストークン>` が必須
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { HubApiError } from "./lib/hub-client.ts";
import type { AppEnv } from "./lib/types.ts";
import { requireAuth } from "./lib/auth.ts";
import { accountMasterRouter } from "./routes/account-master.ts";
import { closuresRouter } from "./routes/closures.ts";
import { contactsRouter } from "./routes/contacts.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { electionRequestsRouter } from "./routes/election-requests.ts";
import { electionsRouter } from "./routes/elections.ts";
import { exportRouter } from "./routes/export.ts";
import { exportCsvRouter } from "./routes/export-csv.ts";
import { exportReportRouter } from "./routes/export-report.ts";
import { hubOrganizationsRouter } from "./routes/hub-organizations.ts";
import { journalsRouter } from "./routes/journals.ts";
import { managedOrganizationsRouter } from "./routes/managed-organizations.ts";
import { meRouter } from "./routes/me.ts";
import { membersRouter } from "./routes/members.ts";
import { organizationRequestsRouter } from "./routes/organization-requests.ts";
import { organizationsRouter } from "./routes/organizations.ts";
import { ownershipTransfersRouter } from "./routes/ownership-transfers.ts";
import { pendingReviewRouter } from "./routes/pending-review.ts";
import { politiciansRouter } from "./routes/politicians.ts";
import { profileRouter } from "./routes/profile.ts";
import { receiptsRouter } from "./routes/receipts.ts";
import { subAccountsRouter } from "./routes/sub-accounts.ts";
import { syncRouter } from "./routes/sync.ts";
import { uploadRouter } from "./routes/upload.ts";

/**
 * CORS で許可するオリジン（カンマ区切り）。既定は本番の Web とローカルの Web。
 * CORS は認証ではない（API は Bearer トークンが無ければ何も返さない）ので、
 * 本番でもローカルのオリジンを許可してよい。別の環境を作るときは環境変数で上書きする。
 */
const DEFAULT_ALLOWED_ORIGINS =
  "https://ledger.polimoney.dd2030.org,http://localhost:3721";

const allowedOrigins = (
  Deno.env.get("CORS_ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS
)
  .split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

export const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // ファイルのダウンロード（CSV / ZIP / JSON）でファイル名を読むため
    exposeHeaders: ["Content-Disposition"],
    credentials: false,
    maxAge: 600,
  }),
);

// 認証不要
app.get("/v1/health", (c) => c.json({ status: "ok" }));

// ここから下は認証必須
app.use("/v1/*", requireAuth);

app.route("/v1/me", meRouter);
app.route("/v1/dashboard", dashboardRouter);
app.route("/v1/account-master", accountMasterRouter);
app.route("/v1/profile", profileRouter);
app.route("/v1/pending-review", pendingReviewRouter);
app.route("/v1/contacts", contactsRouter);
app.route("/v1/journals", journalsRouter);
app.route("/v1/receipts", receiptsRouter);
app.route("/v1/elections", electionsRouter);
app.route("/v1/organizations", organizationsRouter);
app.route("/v1/managed-organizations", managedOrganizationsRouter);
app.route("/v1/hub-organizations", hubOrganizationsRouter);
app.route("/v1/politicians", politiciansRouter);
app.route("/v1/members", membersRouter);
app.route("/v1/ownership-transfers", ownershipTransfersRouter);
app.route("/v1/sub-accounts", subAccountsRouter);
app.route("/v1/sync", syncRouter);
app.route("/v1/upload", uploadRouter);
app.route("/v1/election-requests", electionRequestsRouter);
app.route("/v1/organization-requests", organizationRequestsRouter);
app.route("/v1/export", exportRouter);
app.route("/v1/export-csv", exportCsvRouter);
app.route("/v1/export-report", exportReportRouter);
app.route("/v1/closures", closuresRouter);

// 404 ハンドラー
app.notFound((c) => {
  return c.json({ error: "API エンドポイントが見つかりません" }, 404);
});

// エラーハンドラー（lib/errors.ts の httpError は JSON { error } をそのまま返す）
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  if (err instanceof HubApiError) {
    console.error("[API Error] Hub:", err.status, err.message);
    return c.json({ error: "Polimoney Hub との通信に失敗しました" }, 502);
  }
  console.error("[API Error]", err);
  return c.json({ error: "サーバーエラーが発生しました" }, 500);
});
