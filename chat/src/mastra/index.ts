/**
 * [INPUT]: 依赖 memoAgent、独立 approvalAgent、exploreAgent、chat/organize/explore/canvas-expand 路由、请求日志、启动 Banner 与 config/env
 * [OUTPUT]: 对外提供装配 Agents/Workflows、对话/整理/召回/Canvas 增量路由、健康探针与全局日志的 Mastra 服务实例
 * [POS]: chat 服务组合根，只负责注册能力与 HTTP 策略，不承载 Agent、鉴权或路由细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Mastra } from "@mastra/core/mastra";

import { env } from "@/config/env";
import { printStartupBanner } from "@/lib/banner";
import { approvalAgent } from "@/mastra/agents/approval-agent";
import { exploreAgent } from "@/mastra/agents/explore-agent";
import { memoAgent } from "@/mastra/agents/memo-agent";
import { organizePlannerAgent } from "@/mastra/agents/organize-planner-agent";
import { exploreNotesWorkflow } from "@/mastra/workflows/explore-notes";
import { organizeMemoWorkflow } from "@/mastra/workflows/organize-memo";
import { requestLogger } from "@/middleware/request-logger";
import { chatRoute } from "@/routes/chat";
import { canvasExpandRoute } from "@/routes/canvas-expand";
import { exploreRoute } from "@/routes/explore";
import { organizeRoute } from "@/routes/organize";

printStartupBanner(env, ["GET /health", "POST /v1/chat", "POST /v1/organize", "POST /v1/explore", "POST /v1/canvas-expand"]);

export const mastra = new Mastra({
  agents: {
    "approval-agent": approvalAgent,
    "explore-agent": exploreAgent,
    "memo-agent": memoAgent,
    "organize-planner-agent": organizePlannerAgent,
  },
  workflows: {
    "explore-notes-workflow": exploreNotesWorkflow,
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
    apiRoutes: [chatRoute, organizeRoute, exploreRoute, canvasExpandRoute],
  },
});
