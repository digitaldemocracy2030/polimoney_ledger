/**
 * 証明書類（政治団体登録リクエスト等の証拠書類）
 *
 * 証明書類は非公開バケット（evidence-files）の `{user_id}/...` に保存する。
 * 証拠の参照は Storage のパス（evidence_file_path）で持ち、閲覧用の署名付き URL は
 * Hub に送る時点で発行する（URL だけを恒久的な参照にしない）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { httpError } from "./errors.ts";

/** 証明書類用の非公開バケット（Storage RLS: 先頭フォルダ = 自分のユーザー ID） */
export const VERIFICATION_DOCUMENTS_BUCKET = "evidence-files";

/**
 * Hub の審査用に発行する署名付き URL の有効期限（秒）。
 * 審査が長引いた場合や後日の再確認でも閲覧できるよう 1 年とする。
 * Hub には evidence_file_path も送るため、期限切れ後も Ledger 側でパスから再発行できる。
 */
export const EVIDENCE_REVIEW_URL_EXPIRES_IN = 60 * 60 * 24 * 365;

/**
 * 証明書類のパスが、リクエストしたユーザー本人のフォルダにあることを確認する（違えば 400）
 */
export function assertOwnDocumentPath(userId: string, path: string): void {
  const prefix = `${userId}/`;
  if (
    !path.startsWith(prefix) || path.length === prefix.length ||
    path.includes("..")
  ) {
    throw httpError(400, "証明書類の指定が正しくありません");
  }
}

/**
 * 本人の証明書類について、Hub の審査用の署名付き URL を発行する。
 * ユーザーの JWT 付きクライアントで発行するため、Storage RLS（先頭フォルダ = 自分）により
 * 他人のファイルや存在しないファイルは発行できない（400）。
 */
export async function createEvidenceReviewUrl(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<string> {
  assertOwnDocumentPath(userId, path);
  const { data, error } = await supabase.storage
    .from(VERIFICATION_DOCUMENTS_BUCKET)
    .createSignedUrl(path, EVIDENCE_REVIEW_URL_EXPIRES_IN);
  if (error || !data?.signedUrl) {
    console.error("Failed to create evidence review URL:", error);
    throw httpError(
      400,
      "証明書類が見つかりません。再度アップロードしてください",
    );
  }
  return data.signedUrl;
}
