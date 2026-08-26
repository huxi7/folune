/**
 * [INPUT]: 依赖 Bun test 与可注入的 runCanvasExpansion 编排内核
 * [OUTPUT]: 覆盖完整 checkpoint 零正文/零模型、容量未完成继续、仅排除直接邻居、已有 Canvas memo 候选可补边及失败不产完成结果
 * [POS]: lib 层 Canvas AI 增量协议回归测试，不访问网络、模型或数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { expect, test } from "bun:test";

import { BusinessApiError } from "./business-api";
import {
  runCanvasExpansion,
  type CanvasExpansionDependencies,
} from "./canvas-expand-service";

const CANVAS_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_NODE_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_MEMO_ID = "33333333-3333-4333-8333-333333333333";
const NEIGHBOR_MEMO_ID = "44444444-4444-4444-8444-444444444444";
const EXISTING_NON_NEIGHBOR_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "66666666-6666-4666-8666-666666666666";

const context = (completion: "complete" | "incomplete_due_to_capacity") => ({
  canvas_version: 8,
  corpus_version: 21,
  source: {
    canvas_node_id: SOURCE_NODE_ID,
    memo_id: SOURCE_MEMO_ID,
    title: "来源",
    excerpt: "摘要",
    revision: 4,
  },
  checkpoint: {
    completed_at: "2026-08-26T00:00:00.000Z",
    completion_status: completion,
    corpus_version: 21,
    request_id: REQUEST_ID,
    source_revision: 4,
  },
  neighbor_memo_ids: [NEIGHBOR_MEMO_ID],
});

const memo = (id: string, revision = 4) => ({
  id,
  memo: { content_mdx: id === SOURCE_MEMO_ID ? "可信来源正文" : "候选原文逐字摘录" },
  revision,
  title: id === SOURCE_MEMO_ID ? "来源" : "已有非邻居",
});

const createDependencies = (
  overrides: Partial<CanvasExpansionDependencies> = {},
): CanvasExpansionDependencies => ({
  getContext: async () => context("complete"),
  getMemo: async (memoId) => memo(memoId),
  judge: async (input) => ({
    dropped: { excerpt_not_found: 0, judge_failed: 0, judged_irrelevant: 0 },
    related: [{
      confidence: 0.91,
      excerpt: "候选原文逐字摘录",
      matched_channels: ["semantic"],
      node_id: input.candidates[0]!.node_id,
      reason: "直接延伸来源观点",
      revision: input.candidates[0]!.revision,
      title: input.candidates[0]!.title,
    }],
  }),
  randomUUID: () => REQUEST_ID,
  search: async () => [{
    excerpt: "候选原文逐字摘录",
    matched_channels: ["semantic"],
    node_id: EXISTING_NON_NEIGHBOR_ID,
    rank: 1,
    revision: 7,
    title: "已有非邻居",
  }],
  ...overrides,
});

const input = {
  canvas_id: CANVAS_ID,
  limit: 5,
  source_canvas_node_id: SOURCE_NODE_ID,
};

test("完整且未变化的 checkpoint 不读取正文、不召回、不调用模型", async () => {
  let bodyReads = 0;
  let searches = 0;
  let judges = 0;
  const result = await runCanvasExpansion(createDependencies({
    getMemo: async () => { bodyReads += 1; return memo(SOURCE_MEMO_ID); },
    judge: async () => { judges += 1; throw new Error("不应调用"); },
    search: async () => { searches += 1; return []; },
  }), input);

  expect(result.status).toBe("up_to_date");
  expect({ bodyReads, judges, searches }).toEqual({ bodyReads: 0, judges: 0, searches: 0 });
});

test("容量未完成的 checkpoint 继续，只排除直接邻居且允许已有非邻居补边", async () => {
  let excludedNodeIds: string[] = [];
  const result = await runCanvasExpansion(createDependencies({
    getContext: async () => context("incomplete_due_to_capacity"),
    getMemo: async (memoId) => memo(memoId, memoId === SOURCE_MEMO_ID ? 4 : 7),
    search: async (next) => {
      excludedNodeIds = next.exclude_node_ids;
      return [{
        excerpt: "候选原文逐字摘录",
        matched_channels: ["semantic"],
        node_id: EXISTING_NON_NEIGHBOR_ID,
        rank: 1,
        revision: 7,
        title: "已有非邻居",
      }];
    },
  }), input);

  expect(excludedNodeIds).toEqual([NEIGHBOR_MEMO_ID]);
  expect(result.status).toBe("candidates");
  if (result.status === "candidates") {
    expect(result.candidates[0]?.memo_id).toBe(EXISTING_NON_NEIGHBOR_ID);
  }
});

test("零候选是完整检查，可由前端提交零操作 checkpoint", async () => {
  const result = await runCanvasExpansion(createDependencies({
    getContext: async () => ({ ...context("complete"), corpus_version: 22 }),
    search: async () => [],
  }), input);
  expect(result).toMatchObject({
    candidates: [],
    completion_status: "complete",
    corpus_version: 22,
    status: "candidates",
  });
});

test("模型或引文校验不完整时失败，不伪造 complete checkpoint", async () => {
  expect(runCanvasExpansion(createDependencies({
    getContext: async () => context("incomplete_due_to_capacity"),
    getMemo: async (memoId) => memo(memoId, memoId === SOURCE_MEMO_ID ? 4 : 7),
    judge: async () => ({
      dropped: { excerpt_not_found: 0, judge_failed: 1, judged_irrelevant: 0 },
      related: [],
    }),
  }), input)).rejects.toMatchObject({ code: "CANVAS_EXPANSION_INCOMPLETE" });
});

test("可信 context 与随后读取的 source revision 不一致时中止", async () => {
  expect(runCanvasExpansion(createDependencies({
    getContext: async () => context("incomplete_due_to_capacity"),
    getMemo: async (memoId) => memo(memoId, 5),
  }), input)).rejects.toBeInstanceOf(BusinessApiError);
});
