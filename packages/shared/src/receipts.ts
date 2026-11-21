/**
 * 証憑（領収書）アップロードの制約
 *
 * POST /v1/receipts（API）と仕訳フォーム（web）の両方で使う。
 */

/** ファイルサイズ上限（5MB） */
export const RECEIPT_MAX_SIZE = 5 * 1024 * 1024;

/** 許可する MIME タイプと保存時の拡張子 */
export const RECEIPT_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
