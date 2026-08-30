/**
 * [INPUT]: 依赖 Bun test 与 canvasPresentation 的 Canvas V2 纯投影函数
 * [OUTPUT]: 覆盖节点取名、memo 固定纵向尺寸与 native 持久几何不被改写、节点/边对象身份对账、视口容错与跨设备恢复判据、快照漂移/墓碑、可拓展判据、含人工或 AI 来源的边投影、成组外接框的出现时机与矩形、整组坐标回写与路由身份
 * [POS]: pages 的 Canvas V2 表现回归门禁；锁定服务端投影到 React Flow 的含义，不测试 React 或网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { CanvasDetail, CanvasNode } from "../shared/api/canvas";
import {
  CANVAS_DEFAULT_VIEWPORT,
  CANVAS_MEMO_HEIGHT,
  CANVAS_MEMO_WIDTH,
  canExpandFromNode,
  canvasGroupSelectionBounds,
  canvasNodeTitle,
  canvasNodesBounds,
  canvasPositionOperation,
  canvasPositionOperations,
  canvasViewportShowsNodes,
  reconcileCanvasFlowEdges,
  reconcileCanvasFlowNodes,
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

describe("Canvas Flow identity reconciliation", () => {
  test("只替换真实变化的节点，并保护拖动中的瞬时坐标", () => {
    const initial = toCanvasFlow(detail([
      node(),
      node({ id: "card-2", x: 500 }),
      node({ id: "card-3", x: 900 }),
    ])).nodes;
    const current = [
      initial[0]!,
      { ...initial[1]!, selected: true },
      {
        ...initial[2]!,
        dragging: true,
        position: { x: 1_200, y: 80 },
      },
    ];
    const projected = toCanvasFlow(detail([
      node({ target: { ...node().target!, title: "已更新" } }),
      node({ id: "card-2", x: 500 }),
      node({
        id: "card-3",
        target: { ...node().target!, node_id: "memo-3", title: "拖动时也更新" },
        target_node_id: "memo-3",
        x: 900,
      }),
    ])).nodes;

    const reconciled = reconcileCanvasFlowNodes(current, projected);

    expect(reconciled[0]).not.toBe(current[0]);
    expect(reconciled[0]?.data.title).toBe("已更新");
    expect(reconciled[1]).toBe(current[1]);
    expect(reconciled[1]?.selected).toBe(true);
    expect(reconciled[2]).not.toBe(current[2]);
    expect(reconciled[2]?.position.x).toBe(1_200);
    expect(reconciled[2]?.data.title).toBe("拖动时也更新");
  });

  test("选择一张卡片只替换相连的边，无关 Cord 保持对象身份", () => {
    const projected = [
      {
        data: { createdBy: "user" as const, rationale: null },
        id: "edge-a",
        source: "card-a",
        target: "card-b",
        type: "cord" as const,
      },
      {
        data: { createdBy: "ai" as const, rationale: "另一条关系" },
        id: "edge-b",
        source: "card-c",
        target: "card-d",
        type: "cord" as const,
      },
    ];
    const current = projected.map((edge) => ({
      ...edge,
      className: "canvas-edge-muted",
    }));

    const reconciled = reconcileCanvasFlowEdges(
      current,
      projected,
      ["card-a"],
    );

    expect(reconciled[0]).not.toBe(current[0]);
    expect(reconciled[0]?.className).toBe("canvas-edge-direct");
    expect(reconciled[1]).toBe(current[1]);
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

describe("Canvas group selection bounds", () => {
  const card = (
    id: string,
    x: number,
    y: number,
    selected: boolean,
  ) => ({
    ...toCanvasFlowNode(node({ id, x, y })),
    selected,
  });
  const two = [card("a", 0, 0, true), card("b", 420, 220, true)];

  test("多选静止时成框，矩形恰好是被选节点的并集", () => {
    expect(canvasGroupSelectionBounds(two, {
      marqueeActive: false,
      ownGroupBoxVisible: false,
    })).toEqual({
      height: 220 + CANVAS_MEMO_HEIGHT,
      width: 420 + CANVAS_MEMO_WIDTH,
      x: 0,
      y: 0,
    });
  });

  test("未选中的节点不参与外接框", () => {
    expect(canvasGroupSelectionBounds(
      [...two, card("c", -600, -600, false)],
      { marqueeActive: false, ownGroupBoxVisible: false },
    )).toMatchObject({ x: 0, y: 0 });
  });

  /*
   * 这两条互补的判据合起来才是"框全程可见": 框选途中第一张被框住就成框, 松手后
   * React Flow 接手同一个矩形; 反过来静止单选交给卡片自己的描边, 不套多余的框。
   */
  test("框选途中一张就成框，静止单选不成框", () => {
    const one = [two[0]!, { ...two[1]!, selected: false }];
    expect(canvasGroupSelectionBounds(one, {
      marqueeActive: true,
      ownGroupBoxVisible: false,
    })).toEqual({
      height: CANVAS_MEMO_HEIGHT,
      width: CANVAS_MEMO_WIDTH,
      x: 0,
      y: 0,
    });
    expect(canvasGroupSelectionBounds(one, {
      marqueeActive: false,
      ownGroupBoxVisible: false,
    })).toBeNull();
  });

  test("React Flow 自己画框时让位，同一时刻只有一个框", () => {
    expect(canvasGroupSelectionBounds(two, {
      marqueeActive: false,
      ownGroupBoxVisible: true,
    })).toBeNull();
    expect(canvasGroupSelectionBounds(two, {
      marqueeActive: true,
      ownGroupBoxVisible: true,
    })).toBeNull();
  });

  test("没有选中就没有框", () => {
    expect(canvasGroupSelectionBounds([], {
      marqueeActive: true,
      ownGroupBoxVisible: false,
    })).toBeNull();
  });
});

describe("Canvas gesture position write-back", () => {
  /*
   * 整组拖动的回写单位是手势: 少写一个节点, 乐观投影就把它弹回旧坐标, 用户看到
   * 的是组内相对位置在松手那一刻散掉。
   */
  test("一次手势移动的每个节点都回写，非有限坐标只丢自己", () => {
    expect(canvasPositionOperations([
      { id: "a", position: { x: 1.234, y: 2 } },
      { id: "b", position: { x: Number.POSITIVE_INFINITY, y: 2 } },
      { id: "c", position: { x: -3, y: 4.996 } },
    ])).toEqual([
      { node_id: "a", type: "update_node", x: 1.23, y: 2 },
      { node_id: "c", type: "update_node", x: -3, y: 5 },
    ]);
    expect(canvasPositionOperations([])).toEqual([]);
  });
});

describe("可拓展判据", () => {
  test("只有目标仍读得出正文的 memo_ref 能拓展", () => {
    // ⌘E 与卡片上的魔杖共用这一个判据, 因此它的边界只在这里定义一次
    expect(canExpandFromNode(node())).toBe(true);
    // 墓碑: 原笔记已永久删除, 只剩快照
    expect(canExpandFromNode(node({ target: null, target_node_id: null })))
      .toBe(false);
    // 回收站里的笔记读不出正文, 不能作为拓展来源
    expect(canExpandFromNode(node({
      target: {
        deleted_at: "2026-08-29T00:00:00.000Z",
        excerpt: null,
        node_id: "memo-1",
        revision: 3,
        title: "少则得",
      },
    }))).toBe(false);
    // 自由文字不是笔记, 永远不触发模型
    expect(canExpandFromNode(node({
      kind: "native",
      target: null,
      target_node_id: null,
      text: "一段想法",
    }))).toBe(false);
  });
});
