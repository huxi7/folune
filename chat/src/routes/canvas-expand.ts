/**
 * [INPUT]: 依赖 authMiddleware、Business API 可信 Canvas context/正文/召回、runCanvasExpansion 与既有 explore-notes Workflow
 * [OUTPUT]: 对外提供 POST /v1/canvas-expand；返回 up_to_date 或已逐字复核候选，不写 Canvas 或任何业务表
 * [POS]: routes 层 Canvas AI 入口；浏览器只交 Canvas/node 定位，正文与版本均由 Business API 重取；仅实际执行判断时等待估算用量记账，checkpoint/零候选短路不扣积分
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";

import { businessApi, BusinessApiError } from "@/lib/business-api";
import { runCanvasExpansion } from "@/lib/canvas-expand-service";
import { authMiddleware } from "@/middleware/auth";

const requestSchema = z.object({
  canvas_id: z.uuid(),
  source_canvas_node_id: z.uuid(),
  limit: z.number().int().min(1).max(5).default(5),
}).strict();

const accessTokenFrom = (authorization: string | undefined): string | null =>
  authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

export const canvasExpandRoute = registerApiRoute("/v1/canvas-expand", {
  method: "POST",
  requiresAuth: false,
  middleware: [authMiddleware],
  handler: async (context) => {
    const parsed = requestSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return context.json({
        error: {
          code: "INVALID_CANVAS_EXPAND_REQUEST",
          message: "canvas_id and source_canvas_node_id must be valid UUIDs",
        },
      }, 400);
    }
    const accessToken = accessTokenFrom(context.req.header("Authorization"));
    if (accessToken === null) {
      return context.json(
        { error: { code: "UNAUTHORIZED", message: "Missing bearer token" } },
        401,
      );
    }

    try {
      const usage = await businessApi.getUsageStatus(accessToken);
      if (usage.exceeded) {
        return context.json(
          { error: { code: "AI_DAILY_LIMIT_EXCEEDED", message: "今日 AI 使用额度已用完，明天再来。" } },
          429,
        );
      }
      const result = await runCanvasExpansion({
        getContext: async (canvasId, sourceNodeId) =>
          await businessApi.getCanvasExpansionContext(
            canvasId,
            sourceNodeId,
            accessToken,
          ),
        getMemo: async (memoId) => await businessApi.getMemo(memoId, accessToken),
        judge: async (input, channels) => {
          const workflow = context.get("mastra")
            .getWorkflow("explore-notes-workflow");
          const run = await workflow.createRun();
          const outcome = await run.start({
            inputData: { ...input, matched_channels: channels },
          });
          if (outcome.status !== "success") {
            throw new Error(`Canvas expansion ended with ${outcome.status}`);
          }
          // 记账属于模型执行边界；checkpoint 或零候选短路不产生用量，后续复核失败仍记录真实执行。
          await businessApi.recordUsage(
            (parsed.data.limit + 1) * 3000,
            accessToken,
          );
          return outcome.result;
        },
        randomUUID: () => crypto.randomUUID(),
        search: async (input) =>
          await businessApi.searchRelatedMemos(input, accessToken),
      }, parsed.data);
      return context.json(result);
    } catch (error) {
      const status = error instanceof BusinessApiError
        && [400, 401, 403, 404, 409, 422].includes(error.status)
        ? error.status as 400 | 401 | 403 | 404 | 409 | 422
        : 502;
      return context.json({
        error: {
          code: error instanceof BusinessApiError
            ? error.code
            : "CANVAS_EXPANSION_FAILED",
          message: status === 502
            ? "Canvas expansion failed"
            : error instanceof Error ? error.message : "Canvas expansion failed",
        },
      }, status);
    }
  },
});
