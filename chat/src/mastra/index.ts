/**
 * [INPUT]: 依赖 memoAgent、独立 approvalAgent、chatRoute、请求日志、启动 Banner 与 config/env 的服务策略
 * [OUTPUT]: 对外提供装配 memo-agent/approval-agent、POST /v1/chat、健康探针与全局日志的 Mastra 服务实例
 * [POS]: chat 服务组合根，只负责注册能力与 HTTP 策略，不承载 Agent、鉴权或路由细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Mastra } from "@mastra/core/mastra";

import { env } from "@/config/env";
import { printStartupBanner } from "@/lib/banner";
import { approvalAgent } from "@/mastra/agents/approval-agent";
import { memoAgent } from "@/mastra/agents/memo-agent";
import { organizePlannerAgent } from "@/mastra/agents/organize-planner-agent";
import { organizeMemoWorkflow } from "@/mastra/workflows/organize-memo";
import { requestLogger } from "@/middleware/request-logger";
import { chatRoute } from "@/routes/chat";
import { organizeRoute } from "@/routes/organize";

printStartupBanner(env, ["GET /health", "POST /v1/chat", "POST /v1/organize"]);

export const mastra = new Mastra({
  agents: {
    "approval-agent": approvalAgent,
    "memo-agent": memoAgent,
    "organize-planner-agent": organizePlannerAgent,
  },
  workflows: {
    "organize-memo-workflow": organizeMemoWorkflow,
  },
  server: {
    host: "0.0.0.0",
    port: env.PORT,
    cors: {
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    },
    middleware: [
      {
        path: "/*",
        handler: requestLogger,
      },
    ],
    apiRoutes: [chatRoute, organizeRoute],
  },
});
