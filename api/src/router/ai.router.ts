/**
 * [INPUT]: 依赖 Hono、router/request、AI zod schemas、auth 与 AI thread/context/run services、统一 ok helper
 * [OUTPUT]: 对外提供 /ai-threads（含首开 bootstrap、单会话 content 与消息定点 PATCH）、/ai-context（含 prepare-chat）、/ai-runs、/ai-settings、/ai-commands 的 JWT 保护资源 routers
 * [POS]: router 层 AI Native V2 HTTP 适配器，只做认证、param/body 校验和 service 下传；会话列表无状态 query，不调用模型或直接访问 Supabase
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import { Hono } from "hono";

import { ok } from "../common/response.ts";
import {
  aiCommandIdParamSchema,
  aiMessageIdParamSchema,
  aiRunIdParamSchema,
  aiThreadIdParamSchema,
  createAiCommandSchema,
  createAiRunSchema,
  createAiThreadSchema,
  failAiRunSchema,
  patchAiUserSettingsSchema,
  patchAiThreadSchema,
  recordAiRunPlanSchema,
  replaceAiThreadReferencesSchema,
  prepareAiChatSchema,
  resolveAiContextSchema,
  syncAiMessageSchema,
  syncAiMessagesSchema,
} from "../dto/ai.dto.ts";
import { aiCommandService, aiSettingsService } from "../service/ai-command.service.ts";
import { aiContextService } from "../service/ai-context.service.ts";
import { aiRunService } from "../service/ai-run.service.ts";
import { aiThreadService } from "../service/ai-thread.service.ts";
import { authService } from "../service/auth.service.ts";
import {
  parseJsonBody,
  parseRouteParams,
  readAccessToken,
} from "./request.ts";

const authenticate = async (c: Context) => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);
  return { accessToken, authUser };
};

export const aiThreadRouter = new Hono();
export const aiContextRouter = new Hono();
export const aiRunRouter = new Hono();
export const aiSettingsRouter = new Hono();
export const aiCommandRouter = new Hono();

const readPreferredThreadId = (c: Context): string | null => {
  const value = c.req.query("selected_id");
  return typeof value === "string" && /^[0-9a-f-]{36}$/iu.test(value)
    ? value
    : null;
};

aiSettingsRouter.get("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  return ok(c, await aiSettingsService.get(authUser, accessToken));
});

aiSettingsRouter.patch("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(c, patchAiUserSettingsSchema, "Invalid AI settings");
  return ok(c, await aiSettingsService.update(authUser, accessToken, input));
});

aiCommandRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(c, createAiCommandSchema, "Invalid AI command");
  return ok(c, await aiCommandService.create(authUser, accessToken, input));
});

aiCommandRouter.get("/:commandId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { commandId } = parseRouteParams(aiCommandIdParamSchema, c.req.param());
  return ok(c, await aiCommandService.get(authUser, accessToken, commandId));
});

aiCommandRouter.post("/:commandId/approve", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { commandId } = parseRouteParams(aiCommandIdParamSchema, c.req.param());
  return ok(c, await aiCommandService.approve(authUser, accessToken, commandId));
});

aiCommandRouter.post("/:commandId/reject", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { commandId } = parseRouteParams(aiCommandIdParamSchema, c.req.param());
  return ok(c, await aiCommandService.reject(authUser, accessToken, commandId));
});

aiCommandRouter.post("/:commandId/undo", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { commandId } = parseRouteParams(aiCommandIdParamSchema, c.req.param());
  return ok(c, await aiCommandService.undo(authUser, accessToken, commandId));
});

aiThreadRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(c, createAiThreadSchema, "Invalid AI thread data");
  return ok(c, await aiThreadService.createThread(authUser, accessToken, input));
});

aiThreadRouter.get("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  return ok(c, await aiThreadService.listThreads(authUser, accessToken));
});

// 面板首开需要列表、选中会话和消息；合并浏览器请求，旧资源路径仍保留。
aiThreadRouter.get("/bootstrap", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  return ok(
    c,
    await aiThreadService.bootstrap(
      authUser,
      accessToken,
      readPreferredThreadId(c),
    ),
  );
});

aiThreadRouter.get("/:threadId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  return ok(c, await aiThreadService.getThread(authUser, accessToken, threadId));
});

// 会话切换只走一次浏览器请求；thread、refs、messages 在 service 内并发读取。
aiThreadRouter.get("/:threadId/content", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  return ok(c, await aiThreadService.getThreadContent(authUser, accessToken, threadId));
});

aiThreadRouter.patch("/:threadId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  const input = await parseJsonBody(c, patchAiThreadSchema, "Invalid AI thread data");
  return ok(c, await aiThreadService.updateThread(authUser, accessToken, threadId, input));
});

aiThreadRouter.delete("/:threadId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  return ok(c, await aiThreadService.deleteThread(authUser, accessToken, threadId));
});

aiThreadRouter.get("/:threadId/messages", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  return ok(c, await aiThreadService.listMessages(authUser, accessToken, threadId));
});

// Chat 流结束与工具结果只更新当前 assistant，避免重新上传整段消息。
aiThreadRouter.patch("/:threadId/messages/:messageId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId, messageId } = parseRouteParams(
    aiMessageIdParamSchema,
    c.req.param(),
  );
  const message = await parseJsonBody(c, syncAiMessageSchema, "Invalid AI message");
  return ok(
    c,
    await aiThreadService.syncMessage(
      authUser,
      accessToken,
      threadId,
      messageId,
      message,
    ),
  );
});

aiThreadRouter.put("/:threadId/messages", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  const messages = await parseJsonBody(c, syncAiMessagesSchema, "Invalid AI messages");
  return ok(c, await aiThreadService.syncMessages(authUser, accessToken, threadId, messages));
});

aiThreadRouter.put("/:threadId/references", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { threadId } = parseRouteParams(aiThreadIdParamSchema, c.req.param());
  const { memo_ids } = await parseJsonBody(
    c,
    replaceAiThreadReferencesSchema,
    "Invalid AI references",
  );
  return ok(
    c,
    await aiThreadService.replaceReferences(authUser, accessToken, threadId, memo_ids),
  );
});

aiContextRouter.post("/resolve", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(c, resolveAiContextSchema, "Invalid AI context data");
  return ok(c, await aiContextService.resolve(authUser, accessToken, input));
});

aiContextRouter.post("/prepare-chat", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(c, prepareAiChatSchema, "Invalid Chat preparation data");
  return ok(c, await aiThreadService.prepareChatTurn(authUser, accessToken, input));
});

aiRunRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(c, createAiRunSchema, "Invalid AI run data");
  return ok(c, await aiRunService.create(authUser, accessToken, input));
});

aiRunRouter.get("/:runId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { runId } = parseRouteParams(aiRunIdParamSchema, c.req.param());
  return ok(c, await aiRunService.get(authUser, accessToken, runId));
});

aiRunRouter.patch("/:runId/plan", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { runId } = parseRouteParams(aiRunIdParamSchema, c.req.param());
  const input = await parseJsonBody(c, recordAiRunPlanSchema, "Invalid AI run plan");
  return ok(c, await aiRunService.recordPlan(authUser, accessToken, runId, input));
});

aiRunRouter.post("/:runId/apply", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { runId } = parseRouteParams(aiRunIdParamSchema, c.req.param());
  return ok(c, await aiRunService.apply(authUser, accessToken, runId));
});

aiRunRouter.post("/:runId/reject", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { runId } = parseRouteParams(aiRunIdParamSchema, c.req.param());
  return ok(c, await aiRunService.reject(authUser, accessToken, runId));
});

aiRunRouter.post("/:runId/undo", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { runId } = parseRouteParams(aiRunIdParamSchema, c.req.param());
  return ok(c, await aiRunService.undo(authUser, accessToken, runId));
});

aiRunRouter.post("/:runId/fail", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { runId } = parseRouteParams(aiRunIdParamSchema, c.req.param());
  const { error_code } = await parseJsonBody(c, failAiRunSchema, "Invalid AI run failure");
  return ok(c, await aiRunService.fail(authUser, accessToken, runId, error_code));
});
