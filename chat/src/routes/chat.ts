/**
 * [INPUT]: 依赖 authMiddleware、Business API、冻结 memo context、独立审批协调器、四个客户端 memo 工具、Mastra 流桥与 AI SDK UI stream 生命周期
 * [OUTPUT]: 对外提供消息级上下文冻结、三档写审批、胖工具流转与完整 parts 持久化的 POST /v1/chat
 * [POS]: routes 层 AI Native V2 HTTP 协调边界；先完成审批，再让浏览器 Worker 规划，最终安全仍由 api command 决定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  handleChatStream,
  type ChatStreamHandlerParams,
} from "@mastra/ai-sdk";
import { registerApiRoute } from "@mastra/core/server";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { env } from "@/config/env";
import {
  evaluateWriteApproval,
  shouldRequireManualApproval,
} from "@/lib/approval-coordinator";
import { businessApi, BusinessApiError } from "@/lib/business-api";
import { MemoAgentContext } from "@/lib/memo-agent-context";
import { celebrationTool } from "@/mastra/tools/celebration";
import { memoClientTools, resolveMemoWriteToolName } from "@/mastra/tools/memo";
import { authMiddleware } from "@/middleware/auth";
import {
  attachCurrentContextSnapshot,
  markResponseStatus,
  persistWithOneRetry,
  responseStartChunk,
} from "@/routes/chat-persistence";
import { readFrozenTurnContext } from "@/routes/frozen-turn-context";

const clientTools = {
  celebration: celebrationTool,
  ...memoClientTools,
};

type ApprovalTarget = {
  target_title: string | null;
  target_type: "folder" | "memo" | null;
  parent_title: string | null;
  affected_node_count: number;
};

const describeApprovalTarget = (
  roots: readonly Awaited<ReturnType<typeof businessApi.getMemoTree>>[number][],
  args: Readonly<Record<string, unknown>>,
): ApprovalTarget => {
  const flat = roots.flatMap(function flatten(node): typeof roots[number][] {
    return [node, ...node.children.flatMap(flatten)];
  });
  const targetId = typeof args.node_id === "string" ? args.node_id : null;
  const parentId = typeof args.parent_id === "string" ? args.parent_id : null;
  const target = flat.find((node) => node.id === targetId) ?? null;
  const parent = flat.find((node) => node.id === parentId) ?? null;
  const count = (node: typeof roots[number] | null): number =>
    node === null ? 1 : 1 + node.children.reduce((total, child) => total + count(child), 0);
  return {
    target_title: target?.title ?? (typeof args.title === "string" ? args.title : null),
    target_type: target?.node_type ?? (args.node_type === "folder" || args.node_type === "memo" ? args.node_type : null),
    parent_title: parent?.title ?? (args.parent_id === null ? "根目录" : null),
    affected_node_count: args.op === "delete" ? count(target) : 1,
  };
};

const uiMessageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    parts: z
      .array(
        z
          .object({
            type: z.string().min(1),
          })
          .passthrough(),
      ),
  })
  .passthrough();

const chatParamsSchema = z.object({
  thread_id: z.uuid(),
  active_memo_id: z.uuid().nullable().optional().default(null),
  messages: z.array(uiMessageSchema).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  resumeData: z.record(z.string(), z.unknown()).optional(),
});

type ChatParams = ChatStreamHandlerParams<UIMessage>;

type BusinessApiFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 502;

const readAccessToken = (authorization: string | undefined): string | null =>
  authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

const normalizeFailureStatus = (status: number): BusinessApiFailureStatus => {
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

const businessApiFailure = (error: unknown) => {
  const upstreamStatus = error instanceof BusinessApiError ? error.status : 502;
  const status = normalizeFailureStatus(upstreamStatus);
  const code = error instanceof BusinessApiError ? error.code : "BUSINESS_API_ERROR";
  return {
    status,
    body: {
      error: {
        code,
        message:
          status === 404
            ? "AI thread was not found"
            : "AI persistence service is unavailable",
      },
    },
  };
};

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

    const accessToken = readAccessToken(
      context.req.header("Authorization"),
    );
    if (accessToken === null) {
      return context.json(
        { error: { code: "UNAUTHORIZED", message: "Missing bearer token" } },
        401,
      );
    }

    const { thread_id: threadId } = parsed.data;
    const frozenTurnContext = readFrozenTurnContext(
      parsed.data.messages,
      parsed.data.active_memo_id,
    );
    let resolvedContext;
    let permissionMode: "ask" | "auto_approve" | "full_access";
    let inputMessages: UIMessage[] = [];
    const assistantMessageId = `msg_${crypto.randomUUID()}`;

    try {
      const [, settings, contextResult] = await Promise.all([
        businessApi.getThread(threadId, accessToken),
        businessApi.getSettings(accessToken),
        businessApi.resolveContext(
          threadId,
          frozenTurnContext.active_memo_id,
          frozenTurnContext.reference_memo_ids,
          frozenTurnContext.revisions,
          accessToken,
        ),
      ]);
      permissionMode = settings.permission_mode;
      resolvedContext = contextResult;
      inputMessages = attachCurrentContextSnapshot(
        parsed.data.messages as UIMessage[],
        resolvedContext,
      );
      await businessApi.syncMessages(threadId, [
        ...inputMessages,
        {
          id: assistantMessageId,
          role: "assistant",
          parts: [],
          status: "in_progress",
        } as UIMessage,
      ], accessToken);
    } catch (error) {
      const failure = businessApiFailure(error);
      return context.json(failure.body, failure.status);
    }

    const params = {
      messages: inputMessages,
      trigger: parsed.data.trigger,
      resumeData: parsed.data.resumeData,
    } as unknown as ChatParams;
    const requestContext = context.get("requestContext");
    requestContext.set("memoAgentContext", new MemoAgentContext(resolvedContext));
    const lastUserMessage = [...inputMessages]
      .reverse()
      .find((message) => message.role === "user");
    const approvalTurn = {
      primaryTitle: resolvedContext.primary?.title ?? null,
      referenceTitles: resolvedContext.references.map((memo) => memo.title),
      userRequest: lastUserMessage?.parts
        .flatMap((part) => part.type === "text" ? [part.text] : [])
        .join("\n") ?? "",
    };
    let mastraStream;
    try {
      mastraStream = await handleChatStream<UIMessage>({
        mastra: context.get("mastra"),
        agentId: "memo-agent",
        version: "v6",
        sendStart: false,
        params: {
          ...params,
          clientTools,
          requireToolApproval: async ({ toolName, args }) => {
            const writeToolName = resolveMemoWriteToolName(toolName);
            if (writeToolName === null) return false;
            if (permissionMode === "ask") return true;
            if (permissionMode === "full_access") return false;

            let target: ApprovalTarget | null = null;
            try {
              target = describeApprovalTarget(
                await businessApi.getMemoTree(accessToken),
                args,
              );
            } catch {
              // 审批上下文缺失时由审批 Agent fail-closed 转人工，不影响 ask/full_access。
            }
            const decision = target === null
              ? undefined
              : await evaluateWriteApproval(writeToolName, args, {
                  ...approvalTurn,
                  target,
                });
            return shouldRequireManualApproval(permissionMode, decision);
          },
          requestContext,
          abortSignal: context.req.raw.signal,
          maxSteps: env.MAX_STEPS,
          modelSettings: {
            maxOutputTokens: env.MAX_OUTPUT_TOKENS,
          },
        },
      });
    } catch {
      await persistWithOneRetry(() =>
        businessApi.syncMessages(threadId, [
          ...inputMessages,
          {
            id: assistantMessageId,
            role: "assistant",
            parts: [],
            status: "error",
          } as UIMessage,
        ], accessToken),
      );
      return context.json(
        {
          error: {
            code: "AI_GENERATION_FAILED",
            message: "AI generation could not be started",
          },
        },
        502,
      );
    }

    const stream = createUIMessageStream<UIMessage>({
      originalMessages: inputMessages,
      generateId: () => assistantMessageId,
      execute: ({ writer }) => {
        writer.write(responseStartChunk(assistantMessageId));
        writer.merge(mastraStream);
      },
      onFinish: async ({ messages, responseMessage, isAborted }) => {
        await persistWithOneRetry(() =>
          businessApi.syncMessages(
            threadId,
            attachCurrentContextSnapshot(
              markResponseStatus(messages, responseMessage.id, isAborted),
              resolvedContext,
            ),
            accessToken,
          ),
        );
      },
      onError: () => "AI generation failed",
    });

    return createUIMessageStreamResponse({
      stream,
      consumeSseStream: ({ stream: sseStream }) =>
        sseStream.pipeTo(new WritableStream()),
    });
  },
});
