/**
 * [INPUT]: 依赖 Bun test 与 canvasPresentation 的 Canvas V2 纯投影函数
 * [OUTPUT]: 覆盖节点取名、固定/可变尺寸、视口容错、快照漂移/墓碑、边投影、坐标操作与路由身份
 * [POS]: pages 的 Canvas V2 表现回归门禁；锁定服务端投影到 React Flow 的含义，不测试 React 或网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { CanvasDetail, CanvasNode } from "../shared/api/canvas";
import {
  CANVAS_DEFAULT_VIEWPORT,
  CANVAS_MEMO_HEIGHT,
  CANVAS_MEMO_WIDTH,
  canvasNodeTitle,
  canvasPositionOperation,
  resolveCanvasNodeId,
  shouldRestoreCanvasViewport,
  toCanvasFlow,
  toCanvasFlowNode,
  toCanvasViewport,
} from "./canvasPresentation";

const node = (overrides: Partial<CanvasNode> = {}): CanvasNode => ({
  created_by: "ai",
  discovered_from_id: null,
  height: null,
  id: "card-1",
  kind: "memo_ref",
  snapshot_excerpt: "少则得，多则惑。",
  snapshot_revision: 3,
  snapshot_title: "少则得",
  target: {
    deleted_at: null,
    excerpt: "少则得，多则惑。",
    node_id: "memo-1",
    revision: 3,
    title: "少则得",
  },
  target_node_id: "memo-1",
  text: null,
  width: null,
  x: 10,
  y: -20,
  ...overrides,
});
const detail = (nodes: CanvasNode[], viewport: unknown = {}): CanvasDetail => ({
  canvas: {
    canvas_kind: "memo_default",
    created_at: "",
    metadata: {},
    node_id: "canvas-1",
    origin_node_id: "memo-1",
    origin_revision: 3,
    updated_at: "",
    user_id: "user-1",
    version: 4,
    viewport: viewport as Record<string, unknown>,
  },
  edges: [{
    created_by: "ai",
    id: "edge-1",
    rationale: "同一命题的另一种表述",
    source_id: "card-0",
    target_id: "card-1",
  }],
  node: {} as CanvasDetail["node"],
  nodes,
});

describe("canvasNodeTitle", () => {
  test("memo 优先真实标题、墓碑保留快照，自由文字取第一条有效行", () => {
    expect(canvasNodeTitle(node())).toBe("少则得");
    expect(canvasNodeTitle(node({ target: null, target_node_id: null }))).toBe("少则得");
    expect(canvasNodeTitle(node({
      kind: "native",
      snapshot_title: null,
      target: null,
      target_node_id: null,
      text: "\n## 一句要留下的话\n下一行",
    }))).toBe("一句要留下的话");
  });
});

describe("Canvas viewport", () => {
  test("畸形值退回默认，合法值钳制缩放并只恢复 user_moved", () => {
    expect(toCanvasViewport({ x: 1, y: 2, zoom: "1" })).toEqual(
      CANVAS_DEFAULT_VIEWPORT,
    );
    expect(toCanvasViewport({ x: 0, y: 0, zoom: 9 }).zoom).toBe(2);
    expect(shouldRestoreCanvasViewport({
      user_moved: true,
      x: 120,
      y: -40,
      zoom: 0.8,
    })).toBe(true);
    expect(shouldRestoreCanvasViewport({ x: 120, y: -40, zoom: 0.8 })).toBe(false);
  });
});

describe("toCanvasFlow", () => {
  test("memo 固定 280x180，native 恢复自己的尺寸与文字", () => {
    const memoFlow = toCanvasFlowNode(node());
    const textFlow = toCanvasFlowNode(node({
      height: 160,
      id: "text-1",
      kind: "native",
      snapshot_excerpt: null,
      snapshot_revision: null,
      snapshot_title: null,
      target: null,
      target_node_id: null,
      text: "写在画布上",
      width: 320,
    }));

    expect(memoFlow.style).toMatchObject({
      height: CANVAS_MEMO_HEIGHT,
      width: CANVAS_MEMO_WIDTH,
    });
    expect(textFlow.style).toMatchObject({ height: 160, width: 320 });
    expect(textFlow.data.body).toBe("写在画布上");
    expect(memoFlow.type).toBe("canvasNode");
  });

  test("revision 漂移、回收站和永久删除墓碑各自成立", () => {
    const flow = toCanvasFlow(detail([
      node({ target: { ...node().target!, revision: 9 } }),
      node({
        id: "card-2",
        target: { ...node().target!, deleted_at: "2026-08-24T00:00:00Z" },
      }),
      node({ id: "card-3", target: null, target_node_id: null }),
    ]));

    expect(flow.nodes[0]!.data.drifted).toBe(true);
    expect(flow.nodes[1]!.data.targetDeleted).toBe(true);
    expect(flow.nodes[2]!.data.tombstone).toBe(true);
    expect(flow.edges[0]).toMatchObject({
      source: "card-0",
      target: "card-1",
      type: "cord",
    });
  });
});

describe("Canvas route and persistence helpers", () => {
  test("只有 canvas tree node 进入 Canvas，同步坐标只接受有限值", () => {
    expect(resolveCanvasNodeId({ id: "n1", node_type: "canvas" })).toBe("n1");
    expect(resolveCanvasNodeId({ id: "n1", node_type: "memo" })).toBeNull();
    expect(canvasPositionOperation({
      id: "n1",
      position: { x: 12.3456, y: -7.891 },
    })).toEqual({
      node_id: "n1",
      type: "update_node",
      x: 12.35,
      y: -7.89,
    });
    expect(canvasPositionOperation({
      id: "n1",
      position: { x: Number.NaN, y: 0 },
    })).toBeNull();
  });
});
