/**
 * [INPUT]: 依赖 Bun test 与 canvasPresentation 的 Canvas V2 纯投影函数
 * [OUTPUT]: 覆盖节点取名、memo 固定纵向尺寸与 native 持久几何不被改写、视口容错与跨设备恢复判据、快照漂移/墓碑、含人工或 AI 来源的边投影、坐标操作与路由身份
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
  canvasNodesBounds,
  canvasPositionOperation,
  canvasViewportShowsNodes,
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
  text_scale: overrides.text_scale ?? null,
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
  test("memo 固定 280x360 纵向卡片，native 恢复自己的尺寸与文字", () => {
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
      text_scale: 1.5,
      width: 320,
    }));

    expect(memoFlow.style).toMatchObject({
      height: CANVAS_MEMO_HEIGHT,
      width: CANVAS_MEMO_WIDTH,
    });
    expect(textFlow.style).toMatchObject({ height: 160, width: 320 });
    expect(textFlow.data.body).toBe("写在画布上");
    expect(textFlow.data).toMatchObject({
      textHeight: 160,
      textScale: 1.5,
      textWidth: 320,
    });
    expect(memoFlow.type).toBe("canvasNode");
  });

  // 卡片改版只允许作用于 memo_ref。native 空间文字的宽高与 text_scale 是
  // 用户已经持久化的数据（真实库里跨度 23x35 到 810x186），投影层一旦对它
  // 施加统一 min/max 或默认值，就会静默改写用户内容，因此在此显式锁死。
  test("native 空间文字的持久几何绝不被卡片常量改写", () => {
    for (const geometry of [
      { height: 35, text_scale: 1, width: 23 },
      { height: 186, text_scale: 0.5, width: 810 },
      { height: 41, text_scale: 8, width: 120 },
    ]) {
      const flow = toCanvasFlowNode(node({
        height: geometry.height,
        kind: "native",
        target: null,
        target_node_id: null,
        text: "空间文字",
        text_scale: geometry.text_scale,
        width: geometry.width,
      }));

      expect(flow.style).toEqual({
        height: geometry.height,
        width: geometry.width,
      });
      expect(flow.data).toMatchObject({
        textHeight: geometry.height,
        textScale: geometry.text_scale,
        textWidth: geometry.width,
      });
      expect(flow.style?.height).not.toBe(CANVAS_MEMO_HEIGHT);
      expect(flow.style?.width).not.toBe(CANVAS_MEMO_WIDTH);
    }
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
      data: {
        createdBy: "ai",
        rationale: "同一命题的另一种表述",
      },
      source: "card-0",
      target: "card-1",
      type: "cord",
    });
  });
});

describe("恢复用户视口的可用性判据", () => {
  const flow = toCanvasFlow(detail([
    node({ x: 0, y: 0 }),
    node({ id: "card-2", x: 600, y: 400 }),
  ]));
  const bounds = canvasNodesBounds(flow.nodes);

  test("包围盒来自本层写入的固定尺寸", () => {
    expect(bounds).toEqual({
      height: 400 + CANVAS_MEMO_HEIGHT,
      width: 600 + CANVAS_MEMO_WIDTH,
      x: 0,
      y: 0,
    });
  });

  test("同一视口在宽屏可用，换到窄屏后整幅图落在屏幕外", () => {
    // 1440 宽屏上把图缩到 0.29 并右移 880：宽屏看得见
    const viewport = { x: 880, y: 380, zoom: 0.29 };
    expect(canvasViewportShowsNodes(bounds, viewport, {
      height: 900,
      width: 1440,
    })).toBe(true);
    // 同一个视口搬到 390 宽的手机上：左边界 880 已经超出 390
    expect(canvasViewportShowsNodes(bounds, viewport, {
      height: 844,
      width: 390,
    })).toBe(false);
  });

  test("空画布与尺寸未知时不阻止恢复", () => {
    expect(canvasNodesBounds([])).toBeNull();
    expect(canvasViewportShowsNodes(null, CANVAS_DEFAULT_VIEWPORT, {
      height: 900,
      width: 1440,
    })).toBe(true);
    expect(canvasViewportShowsNodes(bounds, CANVAS_DEFAULT_VIEWPORT, {
      height: 0,
      width: 0,
    })).toBe(true);
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
