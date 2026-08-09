/**
 * [INPUT]: 依赖 app 的 Hono fetch handler、config/env 的已校验配置、lib/banner 的启动输出能力
 * [OUTPUT]: 启动监听 env.PORT 且全局请求体上限为 6MiB 的 Bun HTTP 服务
 * [POS]: api 进程入口，只编排启动顺序并在 multipart 解析前阻断超大请求体
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { app } from "./app.ts";
import { env } from "./config/env.ts";
import {
  printBanner,
  printReady,
  printRuntimeInfo,
} from "./lib/banner.ts";

printBanner(env.SYSTEM_NAME);
printRuntimeInfo(env);

const MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024;

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
  maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
});

printReady(server.url, ["/health", "/profile", "/profile/avatar"]);
