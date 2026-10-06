/**
 * [INPUT]: 依赖 Bun test、真实 Canvas 路由与可控 Business API/Workflow 替身
 * [OUTPUT]: 锁定无模型短路不记账、实际判断等待记账，以及复核失败仍记录已执行模型用量
 * [POS]: Canvas 路由计费边界回归，不访问网络、模型或数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, expect, spyOn, test } from "bun:test";

import { businessApi } from "../lib/business-api";
import { canvasExpandRoute } from "./canvas-expand";

const SOURCE_MEMO_ID = "33333333-3333-4333-8333-333333333333";
const CANDIDATE_ID = "55555555-5555-4555-8555-555555555555";
const restores: Array<() => void> = [];
afterEach(() => { restores.splice(0).reverse().forEach((restore) => restore()); });

function fixture({ current = false, candidates = true, empty = false, invalid = false } = {}) {
  const fetch = spyOn(globalThis, "fetch").mockImplementation((async () => {
    throw new Error("Unexpected network access in Canvas route regression");
  }) as unknown as typeof globalThis.fetch);
  const usage = spyOn(businessApi, "getUsageStatus").mockResolvedValue({
    usage_date: "2026-10-06", total_tokens: 0, daily_limit: 100_000,
    remaining: 100_000, exceeded: false,
  });
  const getContext = spyOn(businessApi, "getCanvasExpansionContext").mockResolvedValue({
    canvas_version: 8, corpus_version: 21,
    source: {
      canvas_node_id: "22222222-2222-4222-8222-222222222222",
      memo_id: SOURCE_MEMO_ID, title: "来源", excerpt: "摘要", revision: 4,
    },
    checkpoint: current ? {
      completion_status: "complete", source_revision: 4, corpus_version: 21,
      request_id: "66666666-6666-4666-8666-666666666666",
      completed_at: "2026-10-06T00:00:00.000Z",
    } : null,
    neighbor_memo_ids: [],
  });
  const getMemo = spyOn(businessApi, "getMemo").mockImplementation(async (id) => ({
    id, title: "笔记", revision: 4,
    memo: { content_mdx: empty && id === CANDIDATE_ID ? "" : "可信正文" },
  }) as Awaited<ReturnType<typeof businessApi.getMemo>>);
  const search = spyOn(businessApi, "searchRelatedMemos").mockResolvedValue(candidates ? [{
    node_id: CANDIDATE_ID, title: "候选", excerpt: "可信正文", revision: 4,
    rank: 1, matched_channels: ["semantic"],
  }] : []);
  const record = spyOn(businessApi, "recordUsage").mockResolvedValue({
    usage_date: "2026-10-06", total_tokens: 18_000, daily_limit: 100_000,
    remaining: 82_000, exceeded: false,
  });
  for (const mock of [fetch, usage, getContext, getMemo, search, record]) {
    restores.push(() => mock.mockRestore());
  }
  let judges = 0;
  const handler = "handler" in canvasExpandRoute ? canvasExpandRoute.handler : undefined;
  if (!handler) throw new Error("Canvas route handler is required");
  return {
    getMemo, record, judges: () => judges,
    run: async () => await handler({
      req: {
        json: async () => ({
          canvas_id: "11111111-1111-4111-8111-111111111111",
          source_canvas_node_id: "22222222-2222-4222-8222-222222222222", limit: 5,
        }),
        header: () => "Bearer test-token",
      },
      get: () => ({
        getWorkflow: () => ({
          createRun: async () => ({
            start: async () => {
              judges++;
              return {
                status: "success",
                result: {
                  dropped: { excerpt_not_found: invalid ? 1 : 0, judge_failed: 0, judged_irrelevant: 1 },
                  related: [],
                },
              };
            },
          }),
        }),
      }),
      json: (body: unknown, status: number = 200) => Response.json(body, { status }),
    } as unknown as Parameters<typeof handler>[0], async () => undefined) as Response,
  };
}

test("Canvas 完整 checkpoint 短路不调用模型、不读取正文、不扣积分", async () => {
  const f = fixture({ current: true });
  const response = await f.run();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "up_to_date" });
  expect(f.getMemo).not.toHaveBeenCalled();
  expect(f.judges()).toBe(0);
  expect(f.record).not.toHaveBeenCalled();
});

test("Canvas 无召回候选或候选正文为空时不扣积分", async () => {
  for (const options of [{ candidates: false }, { empty: true }]) {
    const f = fixture(options);
    const response = await f.run();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "candidates", candidates: [] });
    expect(f.judges()).toBe(0);
    expect(f.record).not.toHaveBeenCalled();
    restores.splice(0).reverse().forEach((restore) => restore());
  }
});

test("Canvas 实际判断后才记一次用量，复核不完整也保留已消耗用量", async () => {
  for (const invalid of [false, true]) {
    const f = fixture({ invalid });
    const response = await f.run();
    expect(response.status).toBe(invalid ? 502 : 200);
    expect(f.judges()).toBe(1);
    expect(f.record).toHaveBeenCalledTimes(1);
    expect(f.record).toHaveBeenCalledWith(18_000, "test-token");
    restores.splice(0).reverse().forEach((restore) => restore());
  }
});
