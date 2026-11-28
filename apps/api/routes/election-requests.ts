/**
 * 選挙登録リクエスト API
 *
 * 選挙マスタは Hub で一元管理されるため、リクエストは Ledger DB ではなく
 * Hub API (POST /api/v1/election-requests) に転送する。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import {
  createElectionRequest,
  getVerifiedPoliticianByUserId,
  HubApiError,
} from "../lib/hub-client.ts";

export const electionRequestsRouter = new Hono<AppEnv>();

/** 文字列なら trim し、空なら undefined を返す */
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

// POST /election-requests - 選挙登録リクエストを Hub に送信
electionRequestsRouter.post("/", async (c) => {
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
  const areaDescription = optionalString(body.area_description);
  const electionDate = optionalString(body.election_date);

  if (!name || !type || !areaDescription || !electionDate) {
    return c.json(
      { error: "選挙名、選挙種別、選挙区、投開票日は必須です" },
      400,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(electionDate)) {
    return c.json({ error: "投開票日の形式が正しくありません" }, 400);
  }

  try {
    // 申請者が Hub で認証済みの政治家なら、その Hub 政治家 ID を添える
    const politician = await getVerifiedPoliticianByUserId(userId).catch(
      (error) => {
        console.error("Failed to fetch verified politician:", error);
        return null;
      },
    );

    const data = await createElectionRequest({
      ledger_user_id: userId,
      name,
      type,
      area_description: areaDescription,
      election_date: electionDate,
      requested_by_politician_id: politician?.id ?? undefined,
      requested_by_email: optionalString(body.requested_by_email) ??
        user.email ?? undefined,
      evidence_url: optionalString(body.evidence_url),
      notes: optionalString(body.notes),
    }, { userId });

    return c.json({ data }, 201);
  } catch (error) {
    // Hub のエラー（申請中の重複の 409 など）は app.ts の onError で状態コードを引き継いで返す
    if (error instanceof HubApiError) throw error;
    console.error("Error creating election request on Hub:", error);
    return c.json({ error: "選挙登録リクエストの送信に失敗しました" }, 502);
  }
});
