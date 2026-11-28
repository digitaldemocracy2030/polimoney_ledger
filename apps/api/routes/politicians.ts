/**
 * 政治家 API（政治家マスタは Hub で管理。ここでは Hub の政治家認証の窓口のみ）
 *
 * - GET  /politicians/verify                    政治家認証画面の初期データ
 * - POST /politicians/verify                    政治家認証の申請
 * - POST /politicians/verify/:id/send-code      認証コード送信
 * - POST /politicians/verify/:id/verify-code    認証コード確認
 * - POST /politicians/verify/:id/verify-dns     DNS TXT 認証確認
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import {
  type CandidateRegistrationInfo,
  createPoliticianVerification,
  getPoliticianVerificationsByUser,
  getVerifiedPoliticianByUserId,
  HubApiError,
  type PoliticalFundReportInfo,
  sendPoliticianVerificationCode,
  verifyPoliticianDns,
  verifyPoliticianEmail,
} from "../lib/hub-client.ts";

export const politiciansRouter = new Hono<AppEnv>();

// GET /politicians/verify - 政治家認証画面の初期データ
politiciansRouter.get("/verify", async (c) => {
  const userId = c.get("userId");

  const [verifiedPolitician, politicianVerifications] = await Promise.all([
    getVerifiedPoliticianByUserId(userId).catch((error) => {
      console.error("Failed to fetch verified politician:", error);
      return null;
    }),
    getPoliticianVerificationsByUser(userId).catch((error) => {
      console.error("Failed to fetch politician verifications:", error);
      return [];
    }),
  ]);

  return c.json({
    userId,
    userEmail: c.get("user").email ?? "",
    verifiedPolitician,
    politicianVerifications,
  });
});

// POST /politicians/verify - 政治家認証開始
politiciansRouter.post("/verify", async (c) => {
  const userId = c.get("userId");

  try {
    const userEmail = c.get("user").email ?? "";

    const body = await c.req.json<{
      name: string;
      official_email: string;
      official_url?: string;
      party?: string;
      request_type?: "new" | "domain_change";
      previous_domain?: string;
      candidate_registration_info?: CandidateRegistrationInfo;
      political_fund_report_info?: PoliticalFundReportInfo;
    }>();

    const result = await createPoliticianVerification({
      ledger_user_id: userId,
      ledger_user_email: userEmail,
      name: body.name,
      official_email: body.official_email,
      official_url: body.official_url,
      party: body.party,
      request_type: body.request_type,
      previous_domain: body.previous_domain,
      candidate_registration_info: body.candidate_registration_info,
      political_fund_report_info: body.political_fund_report_info,
    });

    return c.json({ data: result }, 201);
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error creating politician verification:", error);
    return c.json(
      {
        error: "申請に失敗しました",
      },
      500,
    );
  }
});

// POST /politicians/verify/:id/send-code - 認証コード送信
politiciansRouter.post("/verify/:id/send-code", async (c) => {
  const userId = c.get("userId");

  const verificationId = c.req.param("id");

  try {
    const result = await sendPoliticianVerificationCode(verificationId, {
      userId,
    });
    return c.json(result);
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error sending verification code:", error);
    return c.json(
      {
        error: "コード送信に失敗しました",
      },
      500,
    );
  }
});

// POST /politicians/verify/:id/verify-code - 認証コード確認
politiciansRouter.post("/verify/:id/verify-code", async (c) => {
  const userId = c.get("userId");

  const verificationId = c.req.param("id");

  try {
    const body = await c.req.json<{ code: string }>();

    if (!body.code) {
      return c.json({ error: "認証コードは必須です" }, 400);
    }

    const result = await verifyPoliticianEmail(verificationId, body.code, {
      userId,
    });
    return c.json(result);
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error verifying code:", error);
    return c.json(
      {
        error: "認証に失敗しました",
      },
      500,
    );
  }
});

// POST /politicians/verify/:id/verify-dns - DNS TXT認証確認
politiciansRouter.post("/verify/:id/verify-dns", async (c) => {
  const userId = c.get("userId");

  const verificationId = c.req.param("id");

  try {
    const result = await verifyPoliticianDns(verificationId, { userId });
    return c.json(result);
  } catch (error) {
    // Hub のエラーは app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error verifying DNS TXT:", error);
    return c.json(
      {
        error: "DNS TXT認証に失敗しました",
      },
      500,
    );
  }
});
