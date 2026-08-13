/**
 * [INPUT]: 依赖 authenticatedAgentFetch、chat /v1/organize raw Run 与 shared/api/ai mapper
 * [OUTPUT]: 对外提供 organizeMemo，一次发送 memo/thread/idempotency 并校验错误信封
 * [POS]: AgentPanel 的 Chat organize HTTP 边界；仅调用模型编排端点，确认/apply/undo 仍走 shared/api/ai Business API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mapAiRunDto, type AiRun, type AiRunDto } from "../../shared/api/ai";
import { ChatRequestError } from "./chatFetch";
import { authenticatedAgentFetch, getOrganizeApiUrl } from "./chatTransport";

type OrganizeMemoInput = {
  memoId: string;
  threadId: string | null;
  idempotencyKey: string;
};

type ErrorPayload = { error?: { code?: unknown; message?: unknown } };

export const organizeMemo = async (
  input: OrganizeMemoInput,
): Promise<AiRun> => {
  const response = await authenticatedAgentFetch(getOrganizeApiUrl(), {
    body: JSON.stringify({
      memo_id: input.memoId,
      thread_id: input.threadId,
      idempotency_key: input.idempotencyKey,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    throw new ChatRequestError(
      typeof payload?.error?.code === "string"
        ? payload.error.code
        : `HTTP_${response.status}`,
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "AI 整理失败。",
    );
  }
  return mapAiRunDto(await response.json() as AiRunDto);
};
