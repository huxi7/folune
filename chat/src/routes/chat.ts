/**
 * [INPUT]: 依赖 authMiddleware、Mastra 请求上下文、无 execute 客户端工具契约、@mastra/ai-sdk 流桥与 AI SDK SSE Response
 * [OUTPUT]: 对外提供受 Supabase JWT 保护的 POST /v1/chat 注册路由
 * [POS]: routes 层 Agent HTTP 边界，校验含浏览器工具 part 的 UIMessage 请求并锁定服务端 userId、步数与输出预算
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  handleChatStream,
  type ChatStreamHandlerParams,
} from "@mastra/ai-sdk";
import { registerApiRoute } from "@mastra/core/server";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { z } from "zod";

import { env } from "@/config/env";
import { celebrationTool } from "@/mastra/tools/celebration";
import { memoClientTools } from "@/mastra/tools/memo";
import { authMiddleware } from "@/middleware/auth";

const clientTools = {
  celebration: celebrationTool,
  ...memoClientTools,
};

const uiMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["system", "user", "assistant"]),
    parts: z
      .array(
        z
          .object({
            type: z.string().min(1),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

const chatParamsSchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  resumeData: z.record(z.string(), z.unknown()).optional(),
});

type ChatParams = ChatStreamHandlerParams<UIMessage>;

export const chatRoute = registerApiRoute("/v1/chat", {
  method: "POST",
  // 跳过 Mastra 内置认证，由本路由的 Supabase JWT 中间件建立身份信任。
  requiresAuth: false,
  middleware: [authMiddleware],
  handler: async (context) => {
    const body = await context.req.json().catch(() => null);
    const parsed = chatParamsSchema.safeParse(body);

    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "INVALID_CHAT_REQUEST",
            message: "Request body must contain at least one valid UI message",
          },
        },
        400,
      );
    }

    const params = parsed.data as unknown as ChatParams;
    const requestContext = context.get("requestContext");
    const stream = await handleChatStream<UIMessage>({
      mastra: context.get("mastra"),
      agentId: "memo-agent",
      version: "v6",
      params: {
        ...params,
        clientTools,
        requestContext,
        maxSteps: env.MAX_STEPS,
        modelSettings: {
          maxOutputTokens: env.MAX_OUTPUT_TOKENS,
        },
      },
    });

    return createUIMessageStreamResponse({ stream });
  },
});
