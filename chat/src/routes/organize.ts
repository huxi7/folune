/**
 * [INPUT]: 依赖 authMiddleware、Business API Run 状态机、Mastra organize workflow、整理领域投影与服务端阈值
 * [OUTPUT]: 对外提供 POST /v1/organize，幂等规划并按风险进入确认态或通过 runId 原子应用
 * [POS]: routes 层整理编排边界，JWT 只局部转发；模型只给计划，数据库写入始终由 Business API 的受控 RPC 完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";

import { env } from "@/config/env";
import { businessApi, BusinessApiError, type AiRun } from "@/lib/business-api";
import { projectOrganizeInput } from "@/lib/organize-contracts";
import { estimateTokens } from "@/lib/token-estimate";
import { authMiddleware } from "@/middleware/auth";

const organizeRequestSchema = z.object({
  memo_id: z.uuid(),
  thread_id: z.uuid().nullable().optional(),
  idempotency_key: z.string().trim().min(1).max(200),
}).strict();

type OrganizeFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 502;

const readAccessToken = (authorization: string | undefined): string | null =>
  authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

const failureStatus = (error: unknown): OrganizeFailureStatus => {
  const status = error instanceof BusinessApiError ? error.status : 502;
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 422:
      return status;
    default:
      return 502;
  }
};

const errorCode = (error: unknown): string =>
  error instanceof BusinessApiError
    ? error.code
    : "ORGANIZE_WORKFLOW_FAILED";

const completedRun = (run: AiRun): boolean =>
  run.status !== "planning";

export const organizeRoute = registerApiRoute("/v1/organize", {
  method: "POST",
  requiresAuth: false,
  middleware: [authMiddleware],
  handler: async (context) => {
    const body = await context.req.json().catch(() => null);
    const parsed = organizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "INVALID_ORGANIZE_REQUEST",
            message: "Request body must contain memo_id and idempotency_key",
          },
        },
        400,
      );
    }

    const accessToken = readAccessToken(context.req.header("Authorization"));
    if (accessToken === null) {
      return context.json(
        { error: { code: "UNAUTHORIZED", message: "Missing bearer token" } },
        401,
      );
    }

    let run: AiRun | null = null;
    try {
      const usage = await businessApi.getUsageStatus(accessToken);
      if (usage.exceeded) {
        return context.json(
          { error: { code: "AI_DAILY_LIMIT_EXCEEDED", message: "今日 AI 使用额度已用完，明天再来。" } },
          429,
        );
      }
      run = await businessApi.createRun(
        {
          memo_id: parsed.data.memo_id,
          thread_id: parsed.data.thread_id ?? null,
          idempotency_key: parsed.data.idempotency_key,
        },
        accessToken,
      );
      if (completedRun(run)) {
        return context.json(run);
      }

      const [tree, detail] = await Promise.all([
        businessApi.getMemoTree(accessToken),
        businessApi.getMemo(parsed.data.memo_id, accessToken),
      ]);
      const plannerInput = projectOrganizeInput(
        parsed.data.memo_id,
        tree,
        detail,
        env.ORGANIZE_AUTO_APPLY_CONFIDENCE,
      );
      if (plannerInput === null) {
        throw new BusinessApiError(
          404,
          "MEMO_NOT_FOUND",
          "Memo was not found",
        );
      }
      if (plannerInput.memo.content_mdx.trim().length === 0) {
        throw new BusinessApiError(
          422,
          "MEMO_EMPTY",
          "Empty memo cannot be organized",
        );
      }

      const workflow = context.get("mastra").getWorkflow(
        "organize-memo-workflow",
      );
      const workflowRun = await workflow.createRun();
      const workflowResult = await workflowRun.start({ inputData: plannerInput });
      if (workflowResult.status !== "success") {
        throw new Error(`Organize workflow ended with ${workflowResult.status}`);
      }

      // 精确 usage 封装在 workflow 内取不到，按输入正文保守估算记账，使整理也计入额度。
      void businessApi.recordUsage(
        estimateTokens(plannerInput.memo.content_mdx),
        accessToken,
      ).catch(() => null);

      run = await businessApi.recordRunPlan(
        run.id,
        workflowResult.result.plan,
        workflowResult.result.requires_confirmation,
        accessToken,
      );
      if (workflowResult.result.requires_confirmation) {
        return context.json(run);
      }

      return context.json(await businessApi.applyRun(run.id, accessToken));
    } catch (error) {
      if (run?.status === "planning") {
        await businessApi.failRun(run.id, errorCode(error), accessToken).catch(() => null);
      }
      const status = failureStatus(error);
      return context.json(
        {
          error: {
            code: errorCode(error),
            message:
              status === 422
                ? "Empty memo cannot be organized"
                : status === 404
                  ? "Memo was not found"
                  : "Memo organization failed",
          },
        },
        status,
      );
    }
  },
});
