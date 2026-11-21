/**
 * /v1/receipts API（領収書・証憑）
 *
 * POST   /receipts         領収書を Storage（receipts バケット）にアップロードし media_assets に記録
 * DELETE /receipts?id=...  領収書を削除（アップロードした本人のみ）
 *
 * データアクセスはすべてユーザースコープのクライアント（RLS 適用）で行う。
 * - storage.objects(receipts): 先頭フォルダ = auth.uid() のみ INSERT/SELECT/DELETE 可
 * - media_assets: uploaded_by_user_id = auth.uid() の行を操作可
 * 台帳の権限チェックは authz ヘルパー（requireJournalAccess）で行う。
 */

import { Hono } from "hono";
import type { AppEnv } from "../lib/types.ts";
import {
  RECEIPT_MAX_SIZE,
  RECEIPT_MIME_EXTENSIONS,
} from "@polimoney-ledger/shared/receipts.ts";
import { requireJournalAccess } from "../lib/authz.ts";
import { httpError } from "../lib/errors.ts";
import { assertYearOpen } from "../lib/year-closure.ts";

export const receiptsRouter = new Hono<AppEnv>();

const STORAGE_BUCKET = "receipts";
/** 署名付き URL の有効期限（秒） */
const SIGNED_URL_EXPIRES_IN = 3600;

interface MediaAssetRow {
  id: string;
  journal_id: string | null;
  uploaded_by_user_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  created_at: string;
}

// POST /receipts - 領収書アップロード（multipart/form-data: file, journal_id）
receiptsRouter.post("/", async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    throw httpError(400, "フォームデータの形式が不正です");
  }

  const file = formData.get("file");
  const journalId = formData.get("journal_id");

  if (!(file instanceof File)) {
    throw httpError(400, "ファイルが選択されていません");
  }
  if (typeof journalId !== "string" || !journalId) {
    throw httpError(400, "仕訳IDが指定されていません");
  }
  if (file.size > RECEIPT_MAX_SIZE) {
    throw httpError(400, "ファイルサイズは5MB以下にしてください");
  }
  const ext = Object.hasOwn(RECEIPT_MIME_EXTENSIONS, file.type)
    ? RECEIPT_MIME_EXTENSIONS[file.type]
    : undefined;
  if (!ext) {
    throw httpError(
      400,
      "許可されていないファイル形式です。画像またはPDFをアップロードしてください",
    );
  }

  // 仕訳の台帳に対して起票権限があることを確認
  const access = await requireJournalAccess(c, journalId, "submitJournal");
  // 締め済みの年度の仕訳には証憑を追加できない
  await assertYearOpen(access.ledgerId, access.journal.journal_date);

  const userId = c.get("userId");
  const supabase = c.get("supabase");

  // パス: {user_id}/{journal_id}/{timestamp}-{uuid}.{ext}
  // （receipts バケットの RLS は先頭フォルダ = auth.uid() を要求する）
  const storagePath =
    `${userId}/${journalId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw httpError(500, "ファイルのアップロードに失敗しました");
  }

  const { data: mediaAsset, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      journal_id: journalId,
      uploaded_by_user_id: userId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();

  if (insertError || !mediaAsset) {
    console.error("media_assets insert error:", insertError);
    // アップロード済みのファイルを削除してロールバック
    const { error: rollbackError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);
    if (rollbackError) {
      console.error("Storage rollback error:", rollbackError);
    }
    throw httpError(500, "領収書の登録に失敗しました");
  }

  const asset = mediaAsset as MediaAssetRow;

  const { data: signed, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);
  if (signError) {
    console.error("Signed URL error:", signError);
  }

  return c.json(
    {
      id: asset.id,
      file_name: asset.file_name,
      mime_type: asset.mime_type,
      file_size: asset.file_size,
      url: signed?.signedUrl ?? null,
      created_at: asset.created_at,
    },
    201,
  );
});

// DELETE /receipts?id={media_asset_id} - 領収書削除（アップロードした本人のみ）
receiptsRouter.delete("/", async (c) => {
  const id = c.req.query("id");
  if (!id) {
    throw httpError(400, "IDが指定されていません");
  }

  const userId = c.get("userId");
  const supabase = c.get("supabase");

  const { data, error: fetchError } = await supabase
    .from("media_assets")
    .select("id, journal_id, uploaded_by_user_id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    console.error("media_assets fetch error:", fetchError);
    throw httpError(500, "領収書の取得に失敗しました");
  }
  if (!data) {
    throw httpError(404, "ファイルが見つかりません");
  }

  const asset = data as Pick<
    MediaAssetRow,
    "id" | "journal_id" | "uploaded_by_user_id" | "storage_path"
  >;

  if (asset.uploaded_by_user_id !== userId) {
    throw httpError(403, "削除権限がありません");
  }

  // 現在も仕訳の台帳に起票権限があることを確認（台帳から外れたメンバーは削除不可）
  if (asset.journal_id) {
    const access = await requireJournalAccess(
      c,
      asset.journal_id,
      "submitJournal",
    );
    // 締め済みの年度の仕訳からは証憑を削除できない
    await assertYearOpen(access.ledgerId, access.journal.journal_date);
  }

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([asset.storage_path]);
  if (storageError) {
    // Storage の削除に失敗しても DB のレコードは削除する
    console.error("Storage delete error:", storageError);
  }

  const { error: deleteError } = await supabase
    .from("media_assets")
    .delete()
    .eq("id", asset.id);
  if (deleteError) {
    console.error("media_assets delete error:", deleteError);
    throw httpError(500, "領収書の削除に失敗しました");
  }

  return c.json({ success: true });
});
