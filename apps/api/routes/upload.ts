/**
 * アップロード API
 *
 * どちらもユーザーの JWT 付きクライアント（Storage RLS 適用）でアップロードする。
 * パスの先頭フォルダは必ず自分のユーザー ID（storage.foldername(name)[1] = auth.uid()）。
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../lib/types.ts";
import { httpError } from "../lib/errors.ts";
import { VERIFICATION_DOCUMENTS_BUCKET } from "../lib/verification-documents.ts";

export const uploadRouter = new Hono<AppEnv>();

/** 政治家写真・ロゴなど公開画像用のバケット（public） */
const PUBLIC_IMAGES_BUCKET = "public-images";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
/**
 * アップロード直後のプレビュー用署名付き URL の有効期限（1 時間）。
 * 証拠の参照には path を使う（Hub 用の URL は POST /organization-requests が発行する）。
 */
const DOCUMENT_PREVIEW_URL_EXPIRES_IN = 60 * 60;

const DOCUMENT_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const IMAGE_TYPES = [
  "politician_photo",
  "party_logo",
  "organization_logo",
] as const;
type ImageType = typeof IMAGE_TYPES[number];

async function readFormData(c: Context<AppEnv>): Promise<FormData> {
  try {
    return await c.req.formData();
  } catch {
    throw httpError(400, "リクエストの形式が正しくありません");
  }
}

function getFile(formData: FormData, missingMessage: string): File {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw httpError(400, missingMessage);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw httpError(400, "ファイルサイズは 5MB 以下にしてください");
  }
  return file;
}

// POST /upload - 証明書類のアップロード（非公開）
// path が証拠の参照（POST /organization-requests の evidence_file_path に渡す）。url はプレビュー用
uploadRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const formData = await readFormData(c);
  const file = getFile(formData, "ファイルが必要です");

  const ext = Object.hasOwn(DOCUMENT_MIME_TYPES, file.type)
    ? DOCUMENT_MIME_TYPES[file.type]
    : undefined;
  if (!ext) {
    throw httpError(
      400,
      "JPEG / PNG / GIF / PDF ファイルのみアップロードできます",
    );
  }

  const supabase = c.get("supabase");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(VERIFICATION_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) {
    console.error("Failed to upload file:", error);
    throw httpError(500, "ファイルのアップロードに失敗しました");
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(VERIFICATION_DOCUMENTS_BUCKET)
    .createSignedUrl(path, DOCUMENT_PREVIEW_URL_EXPIRES_IN);
  if (signError || !signed) {
    console.error("Failed to create signed URL:", signError);
    throw httpError(500, "ファイルのアップロードに失敗しました");
  }

  return c.json({ url: signed.signedUrl, path }, 201);
});

// POST /upload/image - 公開画像のアップロード（政治家写真・ロゴ）
uploadRouter.post("/image", async (c) => {
  const userId = c.get("userId");
  const formData = await readFormData(c);
  const file = getFile(formData, "画像ファイルが必要です");

  const ext = Object.hasOwn(IMAGE_MIME_TYPES, file.type)
    ? IMAGE_MIME_TYPES[file.type]
    : undefined;
  if (!ext) {
    throw httpError(400, "画像ファイルのみアップロードできます");
  }

  const type = formData.get("type");
  if (typeof type !== "string" || !IMAGE_TYPES.includes(type as ImageType)) {
    throw httpError(400, "画像の種類が正しくありません");
  }
  const entityId = formData.get("entity_id");
  if (typeof entityId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(entityId)) {
    throw httpError(400, "対象 ID が正しくありません");
  }

  const supabase = c.get("supabase");
  const path = `${userId}/${type}/${entityId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(PUBLIC_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) {
    console.error("Failed to upload image:", error);
    throw httpError(500, "画像のアップロードに失敗しました");
  }

  const { data: publicUrl } = supabase.storage
    .from(PUBLIC_IMAGES_BUCKET)
    .getPublicUrl(path);

  return c.json({ data: { path, url: publicUrl.publicUrl } }, 201);
});
