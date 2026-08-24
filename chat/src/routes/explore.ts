/**
 * [INPUT]: 依赖 authMiddleware、Business API 的混合召回与单篇正文读取、Mastra explore workflow 与 explore 领域契约
 * [OUTPUT]: 对外提供 POST /v1/explore，返回已复核引文的关联笔记与丢弃计数
 * [POS]: routes 层探索编排边界，与 organize 同构且全同步。它是只读的: 不创建 Run、不写任何数据库、不经审批链——AI 推荐是瞬时结果，落库只在用户确认后由 api 完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";

import { businessApi, BusinessApiError } from "@/lib/business-api";
import { projectExploreInput } from "@/lib/explore-contracts";
import { authMiddleware } from "@/middleware/auth";

/**
 * 选中文字与整篇是同一个接口的两种取值: 什么都没选就传整篇正文。
 * 查询文字走 body，因为它可能是一整段，且日志契约禁止 query string 落盘。
 */
const exploreRequestSchema = z.object({
  memo_id: z.uuid(),
  selection: z.string().trim().min(1).max(2000).nullable().optional(),
  exclude_node_ids: z.array(z.uuid()).max(50).optional(),
  limit: z.number().int().min(1).max(12).optional(),
}).strict();

/** 召回宽、判定窄: 多捞一些交给模型筛，最终只留少量 */
const RECALL_LIMIT = 12;
const DEFAULT_KEEP_LIMIT = 5;

type ExploreFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 502;

const readAccessToken = (authorization: string | undefined): string | null =>
  authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

const failureStatus = (error: unknown): ExploreFailureStatus => {
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
  error instanceof BusinessApiError ? error.code : "EXPLORE_WORKFLOW_FAILED";

export const exploreRoute = registerApiRoute("/v1/explore", {
  method: "POST",
  // 与 chat/organize 一致: 刻意绕过 Mastra 内置鉴权，改用 Supabase 中间件
  requiresAuth: false,
  middleware: [authMiddleware],
  handler: async (context) => {
    const body = await context.req.json().catch(() => null);
    const parsed = exploreRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "INVALID_EXPLORE_REQUEST",
            message: "Request body must contain memo_id",
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

    try {
      const source = await businessApi.getMemo(parsed.data.memo_id, accessToken);
      // 未选中文字时以整篇为查询，这是同一接口的默认取值
      const queryText = (parsed.data.selection ?? source.memo.content_mdx).trim();
      if (queryText.length === 0) {
        throw new BusinessApiError(
          422,
          "MEMO_EMPTY",
          "Empty memo cannot be explored",
        );
      }

      const candidates = await businessApi.searchRelatedMemos(
        {
          exclude_node_ids: parsed.data.exclude_node_ids ?? [],
          limit: RECALL_LIMIT,
          query_text: queryText.slice(0, 2000),
          source_node_id: parsed.data.memo_id,
        },
        accessToken,
      );

      if (candidates.length === 0) {
        return context.json({
          dropped: { excerpt_not_found: 0, judge_failed: 0, judged_irrelevant: 0 },
          related: [],
        });
      }

      // 正文按 ID 逐篇取回，绝不让候选列表携带正文——这条边界与 tree 的约定一致
      const bodies = new Map(
        (await Promise.all(candidates.map(async (candidate) => {
          const detail = await businessApi.getMemo(candidate.node_id, accessToken);
          return [
            candidate.node_id,
            { content_mdx: detail.memo.content_mdx, revision: detail.revision },
          ] as const;
        }))),
      );

      const judgeInput = projectExploreInput(
        queryText,
        source.title,
        candidates,
        bodies,
        parsed.data.limit ?? DEFAULT_KEEP_LIMIT,
      );
      if (judgeInput === null) {
        return context.json({
          dropped: { excerpt_not_found: 0, judge_failed: 0, judged_irrelevant: 0 },
          related: [],
        });
      }

      const workflow = context.get("mastra").getWorkflow("explore-notes-workflow");
      const workflowRun = await workflow.createRun();
      const workflowResult = await workflowRun.start({
        inputData: {
          ...judgeInput,
          matched_channels: Object.fromEntries(
            candidates.map((candidate) => [
              candidate.node_id,
              candidate.matched_channels,
            ]),
          ),
        },
      });
      if (workflowResult.status !== "success") {
        throw new Error(`Explore workflow ended with ${workflowResult.status}`);
      }

      return context.json(workflowResult.result);
    } catch (error) {
      const status = failureStatus(error);
      return context.json(
        {
          error: {
            code: errorCode(error),
            message:
              status === 422
                ? "Empty memo cannot be explored"
                : status === 404
                  ? "Memo was not found"
                  : "Memo exploration failed",
          },
        },
        status,
      );
    }
  },
});
