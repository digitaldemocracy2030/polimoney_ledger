/**
 * API エラーのヘルパー
 *
 * レスポンス形式は常に JSON { error: string }（ユーザー向けの日本語メッセージ）。
 * ハンドラーやヘルパーから throw すると app.ts の onError でそのまま返る。
 */

import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** JSON { error } を返す HTTPException を作る（throw して使う） */
export function httpError(
  status: ContentfulStatusCode,
  message: string,
): HTTPException {
  return new HTTPException(status, {
    message,
    res: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json; charset=UTF-8" },
    }),
  });
}
