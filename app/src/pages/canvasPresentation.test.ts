/**
 * [INPUT]: 依赖 Bun test 与 canvasPresentation 的纯投影函数
 * [OUTPUT]: 覆盖卡片取名、视口容错/恢复来源、引用/摘录两类卡片的可晋升与锚点漂移判定、坐标回写过滤
 * [POS]: app/src/pages 的画布投影回归测试；这里锁定的是「画布视图凭什么知道一张卡能不能晋升、引文是否已过期」，判断只允许住在纯函数里
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  CANVAS_DEFAULT_VIEWPORT,
  canvasCardTitle,
  canvasLayoutFromNodes,
  resolveCanvasNodeId,
  shouldRestoreCanvasViewport,
  toCanvasFlow,
  toCanvasViewport,
} from "./canvasPresentation";
import type { CanvasCard, CanvasDetail } from "../shared/api/canvas";

const card = (overrides: Partial<CanvasCard> = {}): CanvasCard => ({
  anchor: {},
  anchored_rev: 3,
  created_by: "ai",
  id: "card-1",
  kind: "memo_ref",
  position_x: 10,
  position_y: -20,
  target: {
    deleted_at: null,
    excerpt: "少则得，多则惑。",
    node_id: "memo-1",
    revision: 3,
    title: "少则得",
  },
  target_node_id: "memo-1",
  text: null,
  ...overrides,
});

const detail = (cards: CanvasCard[], viewport: unknown = {}): CanvasDetail => ({
  canvas: {
    created_at: "",
    metadata: {},
    node_id: "canvas-1",
    origin_node_id: "memo-0",
    origin_revision: 2,
    updated_at: "",
    user_id: "user-1",
    viewport: viewport as Record<string, unknown>,
  },
  cards,
  edges: [{
    created_by: "ai",
    id: "edge-1",
    rationale: "同一命题的另一种表述",
    source_id: "card-0",
    target_id: "card-1",
  }],
  node: {} as CanvasDetail["node"],
});

describe("canvasCardTitle", () => {
  test("引用卡片用目标标题，目标成墓碑则如实说已删除", () => {
    expect(canvasCardTitle(card())).toBe("少则得");
    expect(canvasCardTitle(card({ target: null, target_node_id: null })))
      .toBe("已删除的笔记");
  });

  test("摘录/原生卡片取首行并剥掉 Markdown 标题记号，空白退到默认名", () => {
    expect(canvasCardTitle(card({
      kind: "native",
      target: null,
      target_node_id: null,
      text: "## 一句要留下的话\n下一行",
    }))).toBe("一句要留下的话");
    expect(canvasCardTitle(card({
      kind: "native",
      target: null,
      target_node_id: null,
      text: "\n\n   \n真正的首行",
    }))).toBe("真正的首行");
    expect(canvasCardTitle(card({
      kind: "native",
      target: null,
      target_node_id: null,
      text: "   ",
    }))).toBe("摘录");
  });
});

describe("toCanvasViewport", () => {
  test("缺字段、非数字、NaN 一律退回默认视口", () => {
    expect(toCanvasViewport({})).toEqual(CANVAS_DEFAULT_VIEWPORT);
    expect(toCanvasViewport(null)).toEqual(CANVAS_DEFAULT_VIEWPORT);
    expect(toCanvasViewport({ x: 1, y: 2, zoom: "1" })).toEqual(CANVAS_DEFAULT_VIEWPORT);
    expect(toCanvasViewport({ x: Number.NaN, y: 0, zoom: 1 }))
      .toEqual(CANVAS_DEFAULT_VIEWPORT);
  });

  test("合法视口原样透传，缩放钳在 0.2~2", () => {
    expect(toCanvasViewport({ x: -40, y: 12, zoom: 1.25 }))
      .toEqual({ x: -40, y: 12, zoom: 1.25 });
    expect(toCanvasViewport({ x: 0, y: 0, zoom: 9 }).zoom).toBe(2);
    expect(toCanvasViewport({ x: 0, y: 0, zoom: 0.01 }).zoom).toBe(0.2);
  });
});

describe("shouldRestoreCanvasViewport", () => {
  test("只有用户明确移动过的合法视口才恢复", () => {
    expect(shouldRestoreCanvasViewport({
      user_moved: true,
      x: 120,
      y: -40,
      zoom: 0.8,
    })).toBe(true);
    expect(shouldRestoreCanvasViewport({ x: 120, y: -40, zoom: 0.8 })).toBe(false);
    expect(shouldRestoreCanvasViewport({ user_moved: true, x: 120 })).toBe(false);
  });
});

describe("toCanvasFlow", () => {
  test("引用卡片不可晋升，摘录卡片可晋升", () => {
    const flow = toCanvasFlow(detail([
      card(),
      card({ id: "card-2", kind: "excerpt", text: "损之又损" }),
    ]));

    expect(flow.nodes[0]!.data.promotable).toBe(false);
    expect(flow.nodes[1]!.data.promotable).toBe(true);
    expect(flow.nodes[0]!.type).toBe("canvasCard");
  });

  test("引用卡片的正文取目标摘要，摘录卡片取自己的文字——画布永不持有 content_mdx", () => {
    const flow = toCanvasFlow(detail([
      card(),
      card({ id: "card-2", kind: "native", target: null, target_node_id: null, text: "写在画布上" }),
    ]));

    expect(flow.nodes[0]!.data.body).toBe("少则得，多则惑。");
    expect(flow.nodes[1]!.data.body).toBe("写在画布上");
  });

  test("目标 revision 走在锚点之后即判为漂移，回收站与墓碑各自成立", () => {
    const flow = toCanvasFlow(detail([
      card({ target: { ...card().target!, revision: 9 } }),
      card({ id: "card-2", target: { ...card().target!, deleted_at: "2026-08-24T00:00:00Z" } }),
      card({ id: "card-3", target: null, target_node_id: null }),
    ]));

    expect(flow.nodes[0]!.data.drifted).toBe(true);
    expect(flow.nodes[1]!.data.targetDeleted).toBe(true);
    expect(flow.nodes[1]!.data.drifted).toBe(false);
    expect(flow.nodes[2]!.data.tombstone).toBe(true);
  });

  test("边带人话理由并使用共享 Cord 边类型，位置原样来自服务端坐标", () => {
    const flow = toCanvasFlow(detail([card()], { x: 5, y: 6, zoom: 1 }));

    expect(flow.edges[0]).toMatchObject({
      source: "card-0",
      target: "card-1",
      type: "cord",
    });
    expect(flow.edges[0]!.data).toEqual({ rationale: "同一命题的另一种表述" });
    expect(flow.nodes[0]!.position).toEqual({ x: 10, y: -20 });
    expect(flow.viewport).toEqual({ x: 5, y: 6, zoom: 1 });
  });
});

describe("canvasLayoutFromNodes", () => {
  test("只回写有限坐标并收敛到两位小数，测量中的 NaN 不落库", () => {
    expect(canvasLayoutFromNodes([
      { id: "a", position: { x: 12.3456, y: -7.891 } },
      { id: "b", position: { x: Number.NaN, y: 0 } },
    ])).toEqual([{ id: "a", x: 12.35, y: -7.89 }]);
  });
});

describe("resolveCanvasNodeId", () => {
  test("只有 canvas 节点才把纸内视图交给画布，笔记与文件夹一律不动", () => {
    expect(resolveCanvasNodeId({ id: "n1", node_type: "canvas" })).toBe("n1");
    expect(resolveCanvasNodeId({ id: "n1", node_type: "memo" })).toBeNull();
    expect(resolveCanvasNodeId({ id: "n1", node_type: "folder" })).toBeNull();
    expect(resolveCanvasNodeId(null)).toBeNull();
  });
});
