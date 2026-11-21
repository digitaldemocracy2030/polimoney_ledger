/**
 * Ledger API エントリポイント（Deno / Deno Deploy）
 */

import { app } from "./app.ts";

const port = Number(Deno.env.get("PORT") ?? 3723);

Deno.serve({ port }, app.fetch);
