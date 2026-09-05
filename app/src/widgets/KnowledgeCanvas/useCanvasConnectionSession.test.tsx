/**
 * [INPUT]: 依赖 happy-dom、Testing Library renderHook、真实连接会话 Hook、Canvas API/intent 类型与可观测回调
 * [OUTPUT]: 锁定合法拖拽只签发一次 receipt/upsert_edge，重复回调与自连/重复/墓碑零写入，点击无效目标会收束会话
 * [POS]: KnowledgeCanvas 的连接生命周期回归门禁；使用真实 Hook 但以函数替身隔离 WAL/网络实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

import type { CanvasDetail, CanvasNode } from "../../shared/api/canvas";
import type { CanvasIntent } from "../../shared/store/canvasDocument";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  window: browserWindow,
});

const { act, cleanup, renderHook, waitFor } = await import("@testing-library/react/pure");
const {
  commitCanvasConnection,
  useCanvasConnectionSession,
} = await import("./useCanvasConnectionSession");

const node = (id: string, overrides: Partial<CanvasNode> = {}): CanvasNode => ({
  created_by: "user",
  discovered_from_id: null,
  height: null,
  id,
  kind: "memo_ref",
  snapshot_excerpt: null,
  snapshot_revision: 1,
  snapshot_title: id,
  target: {
    deleted_at: null,
    excerpt: null,
    node_id: `memo-${id}`,
    revision: 1,
    title: id,
  },
  target_node_id: `memo-${id}`,
  text: null,
  text_scale: null,
  width: null,
  x: 0,
  y: 0,
  ...overrides,
});

const baseDetail = {
  edges: [],
  nodes: [node("source"), node("target")],
} as unknown as CanvasDetail;

afterEach(cleanup);

describe("commitCanvasConnection", () => {
  test("合法连接只签发一次 receipt 与一次 upsert_edge", async () => {
    const intents: CanvasIntent[] = [];
    const receipts: unknown[] = [];
    const selected: string[][] = [];
    const result = await commitCanvasConnection({
      detail: baseDetail,
      enqueue: async (intent) => { intents.push(intent); },
      issueMotionReceipt: (receipt) => receipts.push(receipt),
      selectOnly: (ids) => selected.push([...ids]),
      sourceId: "source",
      targetId: "target",
    });
    expect(result.valid).toBe(true);
    expect(receipts).toHaveLength(1);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.operation).toMatchObject({
      source_id: "source",
      target_id: "target",
      type: "upsert_edge",
    });
    expect(selected).toEqual([["source"]]);
  });

  test("自连、重复 pair 与墓碑目标零写入", async () => {
    const enqueue = mock(async (_intent: CanvasIntent) => undefined);
    const issueMotionReceipt = mock(() => undefined);
    const selectOnly = mock(() => undefined);
    const duplicate = {
      ...baseDetail,
      edges: [{
        created_by: "user" as const,
        id: "edge-1",
        rationale: null,
        source_id: "source",
        target_id: "target",
      }],
    };
    const tombstone = {
      ...baseDetail,
      nodes: [node("source"), node("target", { target: null, target_node_id: null })],
    };
    for (const [detail, targetId] of [
      [baseDetail, "source"],
      [duplicate, "target"],
      [tombstone, "target"],
    ] as const) {
      await commitCanvasConnection({
        detail,
        enqueue,
        issueMotionReceipt,
        selectOnly,
        sourceId: "source",
        targetId,
      });
    }
    expect(enqueue).not.toHaveBeenCalled();
    expect(issueMotionReceipt).not.toHaveBeenCalled();
    expect(selectOnly).not.toHaveBeenCalled();
  });
});

describe("useCanvasConnectionSession", () => {
  test("React Flow 重复 onConnect 回调仍只提交一次", async () => {
    const enqueue = mock(async (_intent: CanvasIntent) => undefined);
    const startConnection = mock(() => undefined);
    const hook = renderHook(() => useCanvasConnectionSession({
      connectionSourceId: "source",
      detail: baseDetail,
      enqueue,
      issueMotionReceipt: () => undefined,
      selectOnly: () => undefined,
      startConnection,
    }));
    act(() => {
      hook.result.current.onConnect({
        source: "source",
        sourceHandle: "connection-source",
        target: "target",
        targetHandle: "connection-target",
      });
      hook.result.current.onConnect({
        source: "source",
        sourceHandle: "connection-source",
        target: "target",
        targetHandle: "connection-target",
      });
    });
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
  });

  test("点击自连会收束 click-armed 且零写入", () => {
    const enqueue = mock(async (_intent: CanvasIntent) => undefined);
    const startConnection = mock(() => undefined);
    const hook = renderHook(() => useCanvasConnectionSession({
      connectionSourceId: "source",
      detail: baseDetail,
      enqueue,
      issueMotionReceipt: () => undefined,
      selectOnly: () => undefined,
      startConnection,
    }));
    act(() => hook.result.current.onNodeClick("source"));
    expect(startConnection).toHaveBeenCalledWith(null);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
