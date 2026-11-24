/**
 * 政治団体登録リクエスト API
 *
 * 政治団体マスタは Hub で一元管理されるため、リクエストは Ledger DB ではなく
 * Hub API (POST /api/v1/organization-requests) に転送する。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import {
  createOrganizationRequest,
  getVerifiedPoliticianByUserId,
} from "../lib/hub-client.ts";
import { createEvidenceReviewUrl } from "../lib/verification-documents.ts";

export const organizationRequestsRouter = new Hono<AppEnv>();

/** 文字列なら trim し、空なら undefined を返す */
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// POST /organization-requests - 政治団体登録リクエストを Hub に送信
organizationRequestsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const user = c.get("user");

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "リクエストの形式が正しくありません" }, 400);
  }

  const name = optionalString(body.name);
  const type = optionalString(body.type);
  const evidenceType = optionalString(body.evidence_type);
  // 証明書類は POST /upload が返した Storage のパスで受け取る
  // （URL は期限切れになるため、恒久的な参照にはしない）
  const evidenceFilePath = optionalString(body.evidence_file_path);

  if (!name || !type) {
    return c.json({ error: "政治団体名と団体種別は必須です" }, 400);
  }
  if (!evidenceType || !evidenceFilePath) {
    return c.json({ error: "証明書類のアップロードが必要です" }, 400);
  }

  // 本人のフォルダにある証明書類について、Hub の審査用 URL を発行する（不正なら 400）
  const evidenceFileUrl = await createEvidenceReviewUrl(
    c.get("supabase"),
    userId,
    evidenceFilePath,
  );

  try {
    // 申請者が Hub で認証済みの政治家なら、その Hub 政治家 ID を添える
    const politician = await getVerifiedPoliticianByUserId(userId).catch(
      (error) => {
        console.error("Failed to fetch verified politician:", error);
        return null;
      },
    );

    const data = await createOrganizationRequest({
      name,
      type,
      registration_authority: optionalString(body.registration_authority),
      requested_by_politician_id: politician?.id ?? undefined,
      requested_by_email: optionalString(body.requested_by_email) ??
        user.email ?? undefined,
      evidence_type: evidenceType,
      evidence_file_url: evidenceFileUrl,
      evidence_file_path: evidenceFilePath,
      evidence_file_name: optionalString(body.evidence_file_name),
      notes: optionalString(body.notes),
    }, { userId });

    return c.json({ data }, 201);
  } catch (error) {
    console.error("Error creating organization request on Hub:", error);
    return c.json(
      { error: "政治団体登録リクエストの送信に失敗しました" },
      502,
    );
  }
});
