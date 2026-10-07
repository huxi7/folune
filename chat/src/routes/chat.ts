/**
 * [INPUT]: 依赖 authMiddleware、Business API、冻结 memo context、独立审批协调器、客户端工具、Mastra 流桥与 chat-stream 的终态/静默超时协调
 * [OUTPUT]: 依据 API 快照注入只读服务端工具，验证引用并随消息流保存； 对外提供消息级上下文冻结、一次性 turn prepare、三档写审批、同轮 assistant 续写、胖工具流转、明确的模型余额错误与增量 parts 持久化的 POST /v1/chat
 * [POS]: routes 层 AI Native V2 HTTP 协调边界；审批/工具续跑复用同一回复 ID，先完成审批再让浏览器 Worker 规划，最终安全仍由 api command 决定 onUsage 返回可等待的记账 Promise，不脱离请求生命周期。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  handleChatStream,
  type ChatStreamHandlerParams,
} from "@mastra/ai-sdk";
import { registerApiRoute } from "@mastra/core/server";
import {
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { canvasChatScopeSchema } from "../lib/canvas-chat-contracts";
import { CanvasPromptContext, createCanvasChatSession, canvasModelMessages, withCanvasEvidence } from "../lib/canvas-chat-session";
import { batchModelMessages } from "./batch-model-messages";
import { modelErrorMessage } from "@/lib/model-error";
import { env } from "@/config/env";
import {
  evaluateWriteApproval,
  shouldRequireManualApproval,
} from "@/lib/approval-coordinator";
import { businessApi, BusinessApiError } from "@/lib/business-api";
import { MemoAgentContext } from "@/lib/memo-agent-context";
import { celebrationTool } from "@/mastra/tools/celebration";
import { createMemoClientTools, resolveMemoWriteToolName } from "@/mastra/tools/memo";
import { authMiddleware } from "@/middleware/auth";
import { createChatResponseStream } from "@/routes/chat-stream";
import {
  isAssistantContinuation,
  readFrozenTurnContext,
} from "@/routes/frozen-turn-context";

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
  if (Array.isArray(args.targets)) {
    const ids = new Set(args.targets.flatMap((target) => target && typeof target === "object" && "node_id" in target ? [target.node_id] : []));
    const targets = flat.filter((node) => ids.has(node.id));
    return {
      target_title: targets.map((node) => node.title).join("、"),
      target_type: targets.every((node) => node.node_type === "memo") ? "memo" : null,
      parent_title: typeof args.parent_id === "string" ? flat.find((node) => node.id === args.parent_id)?.title ?? null : "根目录",
      affected_node_count: targets.length,
    };
  }
  const targetId = typeof args.node_id === "string" ? args.node_id : null;
  const parentId = typeof args.parent_id === "string" ? args.parent_id : null;
  const target = flat.find((node) => node.id === targetId) ?? null;
  const parent = flat.find((node) => node.id === parentId) ?? null;
  const targetType = target?.node_type;
  const count = (node: typeof roots[number] | null): number =>
    node === null ? 1 : 1 + node.children.reduce((total, child) => total + count(child), 0);
  return {
    target_title: target?.title ?? (typeof args.title === "string" ? args.title : null),
    target_type: targetType === "folder" || targetType === "memo"
      ? targetType
      : args.node_type === "folder" || args.node_type === "memo"
        ? args.node_type
        : null,
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
  canvas: canvasChatScopeSchema.optional(),
  thread_id: z.uuid(),
  active_memo_id: z.uuid().nullable().optional().default(null),
  reference_memo_ids: z.array(z.uuid()).max(5).optional().default([]),
  expected_revisions: z.record(z.uuid(), z.number().int().positive())
    .optional()
    .default({}),
  messages: z.array(uiMessageSchema).min(1).optional(),
  message: uiMessageSchema.optional(),
  response_message_id: z.string().min(1).max(200).optional(),
  messageId: z.string().min(1).max(200).optional(),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  resumeData: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (value) => (value.messages === undefined) !== (value.message === undefined),
  { message: "Exactly one of messages or message is required" },
);

type ChatParams = ChatStreamHandlerParams<UIMessage>;

type BusinessApiFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 502 | 503 | 504;

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
    case 503:
    case 504:
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
            ? "这段对话已不存在，请新建对话。"
            : "暂时无法准备对话，请稍后重新发送。",
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

    // 每日额度门禁：超限直接 429，不进入模型调用（避免烧钱）。
    try {
      const usage = await businessApi.getUsageStatus(accessToken);
      if (usage.exceeded) {
        return context.json(
          {
            error: {
              code: "AI_DAILY_LIMIT_EXCEEDED",
              message: "今日 AI 使用额度已用完，明天再来。",
            },
          },
          429,
        );
      }
    } catch (error) {
      const failure = businessApiFailure(error);
      return context.json(failure.body, failure.status);
    }
    const requestMessages = parsed.data.messages ?? [parsed.data.message!];
    const assistantContinuation = parsed.data.trigger !== "regenerate-message"
      && isAssistantContinuation(requestMessages);
    let frozenTurnContext;
    try { frozenTurnContext = readFrozenTurnContext(
      requestMessages,
      parsed.data.active_memo_id,
      {
        canvas: parsed.data.canvas,
        active_memo_id: parsed.data.active_memo_id,
        reference_memo_ids: parsed.data.reference_memo_ids,
        revisions: parsed.data.expected_revisions,
      },
    );
    } catch {
      return context.json({ error: { code: "INVALID_CHAT_REQUEST", message: "画布来源格式无效，请重新选择。" } }, 400);
    }
    let resolvedContext;
    let permissionMode: "ask" | "auto_approve" | "full_access";
    let inputMessages: UIMessage[] = [];
    const lastRequestMessage = requestMessages.at(-1)!;
    const assistantMessageId = parsed.data.response_message_id
      ?? (lastRequestMessage.role === "assistant"
        ? lastRequestMessage.id
        : `msg_${lastRequestMessage.id}`);

    try {
      const prepared = await businessApi.prepareChatTurn({
        canvas: frozenTurnContext.canvas,
        activeMemoId: frozenTurnContext.active_memo_id,
        expectedRevisions: assistantContinuation ? {} : frozenTurnContext.revisions,
        message: parsed.data.message as UIMessage | undefined,
        messages: parsed.data.messages as UIMessage[] | undefined,
        referenceMemoIds: frozenTurnContext.reference_memo_ids,
        responseMessageId: assistantMessageId,
        threadId,
      }, accessToken);
      permissionMode = prepared.permission_mode;
      resolvedContext = prepared.context;
      inputMessages = prepared.messages as UIMessage[];
    } catch (error) {
      const failure = businessApiFailure(error);
      return context.json(failure.body, failure.status);
    }

    const canvas = resolvedContext.canvas;
    const canvasSession = canvas ? createCanvasChatSession(canvas, id => businessApi.getMemo(id, accessToken), resolvedContext.references) : null;
    const params = {
      messages: canvas ? canvasModelMessages(inputMessages) : batchModelMessages(inputMessages),
      trigger: parsed.data.trigger,
      resumeData: parsed.data.resumeData,
    } as unknown as ChatParams;
    const requestContext = context.get("requestContext");
    requestContext.set("memoAgentContext", new MemoAgentContext(resolvedContext));
    if (canvasSession && canvas) requestContext.set("canvasChatPrompt", new CanvasPromptContext({ title: canvas.title, mode: canvas.mode, total_nodes: canvas.nodes.length, total_edges: canvas.edges.length, ...canvasSession.initial, extra_memos: canvasSession.extraMemos }));
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
    let approvalTreePromise: ReturnType<typeof businessApi.getMemoTree> | null = null;
    const requireWriteApproval = async (
      writeToolName: "edit_node" | "edit_memo" | "edit_nodes",
      args: Readonly<Record<string, unknown>>,
    ): Promise<boolean> => {
      if (permissionMode === "ask") return true;
      if (permissionMode === "full_access") return false;

      let target: ApprovalTarget | null = null;
      try {
        approvalTreePromise ??= businessApi.getMemoTree(accessToken);
        target = describeApprovalTarget(
          await approvalTreePromise,
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
    };
    const clientTools = {
      celebration: celebrationTool,
      ...createMemoClientTools(),
    };
    const stream = createChatResponseStream({
      messages: inputMessages,
      messageId: assistantMessageId,
      signal: context.req.raw.signal,
      createStream: async (signal) => {
        const upstream = await handleChatStream<UIMessage>({
        mastra: context.get("mastra"),
        agentId: "memo-agent",
        version: "v6",
        sendStart: false,
        sendReasoning: true,
        onError: modelErrorMessage,
        messageMetadata: ({ part }) => {
          if (part.type !== "finish") return undefined;
          const usage = (part as { totalUsage?: { totalTokens?: number } }).totalUsage;
          return { folune_total_tokens: usage?.totalTokens ?? 0, ...(canvas ? { canvas_read_only: true } : {}) };
        },
        params: {
          ...params,
          ...(canvasSession ? { toolsets: { canvas: canvasSession.tools } } : { clientTools }),
          requestContext,
          abortSignal: signal,
          maxSteps: env.MAX_STEPS,
          modelSettings: {
            maxOutputTokens: env.MAX_OUTPUT_TOKENS,
          },
        },
        });
        return canvasSession && canvas ? withCanvasEvidence(upstream, canvasSession, canvas) : upstream;
      },
      approveTool: async (chunk) => {
        if (canvas) return null;
        const toolName = resolveMemoWriteToolName(chunk.toolName);
        if (toolName === null) return null;
        const input = chunk.input !== null && typeof chunk.input === "object" && !Array.isArray(chunk.input)
          ? chunk.input as Record<string, unknown>
          : {};
        return await requireWriteApproval(toolName as "edit_node" | "edit_memo" | "edit_nodes", input)
          ? { type: "tool-approval-request", approvalId: `folune::${chunk.toolCallId}`, toolCallId: chunk.toolCallId }
          : null;
      },
      persist: (message, status) => businessApi.syncMessage(threadId, message, status, accessToken),
      onUsage: async (totalTokens) => { await businessApi.recordUsage(totalTokens, accessToken); },
      onPersistenceError: () => context.get("mastra").getLogger().error(
        "Chat response persistence failed", { threadId, assistantMessageId },
      ),
      onGenerationError: (detail) => context.get("mastra").getLogger().warn(
        "Chat generation interrupted", { threadId, assistantMessageId, ...detail },
      ),
    });

    return createUIMessageStreamResponse({
      stream,
      consumeSseStream: ({ stream: sseStream }) =>
        sseStream.pipeTo(new WritableStream()),
    });
  },
});
