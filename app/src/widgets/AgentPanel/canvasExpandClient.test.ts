/**
 * [INPUT]: 依赖 Bun test 与 canvasExpandClient 的纯响应解析边界
 * [OUTPUT]: 覆盖 up_to_date/候选成功，以及越界 confidence、超量候选和畸形身份拒绝
 * [POS]: AgentPanel Canvas AI 客户端契约门禁；Chat 响应未经校验不得进入 Canvas intent
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { parseCanvasExpansionResponse } from "./canvasExpandClient";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const MEMO_ID = "22222222-2222-4222-8222-222222222222";

const candidate = {
  confidence: 0.82,
  excerpt: "逐字证据",
  memo_id: MEMO_ID,
  reason: "直接相关",
  revision: 2,
  title: "候选笔记",
};

describe("Canvas expansion response", () => {
  test("只接受完整的 up_to_date 与候选协议", () => {
    expect(parseCanvasExpansionResponse({
      corpus_version: 4,
      request_id: REQUEST_ID,
      source_revision: 3,
      status: "up_to_date",
    }).status).toBe("up_to_date");
    expect(parseCanvasExpansionResponse({
      candidates: [candidate],
      completion_status: "complete",
      corpus_version: 4,
      request_id: REQUEST_ID,
      source_revision: 3,
      status: "candidates",
    })).toMatchObject({ candidates: [candidate], status: "candidates" });
  });

  test("越界 confidence、超量候选和畸形身份一律拒绝", () => {
    const base = {
      candidates: [candidate],
      completion_status: "complete",
      corpus_version: 4,
      request_id: REQUEST_ID,
      source_revision: 3,
      status: "candidates",
    };
    expect(() => parseCanvasExpansionResponse({
      ...base,
      candidates: [{ ...candidate, confidence: 82 }],
    })).toThrow("Canvas AI 返回了无效结果");
    expect(() => parseCanvasExpansionResponse({
      ...base,
      candidates: Array.from({ length: 6 }, () => candidate),
    })).toThrow("Canvas AI 返回了无效结果");
    expect(() => parseCanvasExpansionResponse({
      ...base,
      request_id: "not-a-uuid",
    })).toThrow("Canvas AI 返回了无效结果");
  });
});
