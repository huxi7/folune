/**
 * [INPUT]: 依赖 authenticatedAgentFetch 与 chat /v1/canvas-expand 的只读候选协议
 * [OUTPUT]: 对外提供 expandCanvas；浏览器只发送 canvas_id/source_canvas_node_id/limit，并校验 up_to_date/candidates 响应
 * [POS]: AgentPanel 的 Canvas AI HTTP 边界；Chat 只返回可信候选，不写数据库，最终提交仍由 CanvasSaveCoordinator 排队
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ChatRequestError } from "./chatFetch";
import {
  authenticatedAgentFetch,
  getCanvasExpandApiUrl,
} from "./chatTransport";

export type CanvasExpansionCandidate = {
  memo_id: string;
  revision: number;
  title: string;
  excerpt: string | null;
  reason: string;
  confidence: number;
};

export type CanvasExpansionResult =
  | {
      status: "up_to_date";
      request_id: string;
      source_revision: number;
      corpus_version: number;
    }
  | {
      status: "candidates";
      request_id: string;
      source_revision: number;
      corpus_version: number;
      completion_status: "complete" | "incomplete_due_to_capacity";
      candidates: CanvasExpansionCandidate[];
    };

type ErrorPayload = { error?: { code?: unknown; message?: unknown } };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isRevision = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;
const isCorpusVersion = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

const isCandidate = (value: unknown): value is CanvasExpansionCandidate =>
  isRecord(value)
  && typeof value.memo_id === "string"
  && UUID_PATTERN.test(value.memo_id)
  && isRevision(value.revision)
  && typeof value.title === "string"
  && typeof value.excerpt === "string"
  && typeof value.reason === "string"
  && typeof value.confidence === "number"
  && Number.isFinite(value.confidence)
  && value.confidence >= 0
  && value.confidence <= 1;

export const parseCanvasExpansionResponse = (
  value: unknown,
): CanvasExpansionResult => {
  if (
    !isRecord(value)
    || typeof value.request_id !== "string"
    || !UUID_PATTERN.test(value.request_id)
    || !isRevision(value.source_revision)
    || !isCorpusVersion(value.corpus_version)
  ) {
    throw new ChatRequestError(
      "CANVAS_EXPANSION_RESPONSE_INVALID",
      "Canvas AI 返回了无效结果。",
    );
  }

  if (value.status === "up_to_date") {
    return value as CanvasExpansionResult;
  }
  if (
    value.status === "candidates"
    && (
      value.completion_status === "complete"
      || value.completion_status === "incomplete_due_to_capacity"
    )
    && Array.isArray(value.candidates)
    && value.candidates.length <= 5
    && value.candidates.every(isCandidate)
  ) {
    return value as CanvasExpansionResult;
  }
  throw new ChatRequestError(
    "CANVAS_EXPANSION_RESPONSE_INVALID",
    "Canvas AI 返回了无效结果。",
  );
};

export const expandCanvas = async (input: {
  canvasId: string;
  sourceCanvasNodeId: string;
  limit?: number;
}): Promise<CanvasExpansionResult> => {
  const response = await authenticatedAgentFetch(getCanvasExpandApiUrl(), {
    body: JSON.stringify({
      canvas_id: input.canvasId,
      source_canvas_node_id: input.sourceCanvasNodeId,
      limit: input.limit ?? 5,
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
        : "Canvas AI 拓展失败。",
    );
  }

  return parseCanvasExpansionResponse(await response.json().catch(() => null));
};
