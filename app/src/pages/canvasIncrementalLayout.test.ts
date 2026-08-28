/**
 * [INPUT]: 依赖 Bun test、Canvas V2 节点 fixture 与 canvasIncrementalLayout 纯几何
 * [OUTPUT]: 覆盖稳定排序、旧节点不移动、32px 碰撞安全区、分支方向继承与视口中心最近空位
 * [POS]: pages 的 Canvas 增量空间生长回归门禁；人工加入与 AI 扩展不得重新排布既有知识
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { CanvasNode } from "../shared/api/canvas";
import {
  layoutCanvasCandidates,
  nearestCanvasPlacement,
} from "./canvasIncrementalLayout";

const memoNode = (
  id: string,
  x: number,
  y: number,
  discoveredFromId: string | null = null,
): CanvasNode => ({
  created_by: "user",
  discovered_from_id: discoveredFromId,
  height: null,
  id,
  kind: "memo_ref",
  snapshot_excerpt: null,
  snapshot_revision: 1,
  snapshot_title: id,
  target: null,
  target_node_id: id,
  text: null,
  text_scale: null,
  width: null,
  x,
  y,
});
describe("layoutCanvasCandidates", () => {
  test("候选按置信度和 ID 稳定排序，原节点对象与坐标完全不变", () => {
    const nodes = [
      memoNode("source", 0, 0),
      memoNode("occupied", 320, 0),
    ];
    const before = structuredClone(nodes);
    const first = layoutCanvasCandidates(nodes, "source", [
      { confidence: 0.8, memoId: "b" },
      { confidence: 0.9, memoId: "c" },
      { confidence: 0.9, memoId: "a" },
    ]);
    const second = layoutCanvasCandidates(nodes, "source", [
      { confidence: 0.9, memoId: "a" },
      { confidence: 0.8, memoId: "b" },
      { confidence: 0.9, memoId: "c" },
    ]);

    expect(first.map((item) => item.memoId)).toEqual(["a", "c", "b"]);
    expect(second).toEqual(first);
    expect(nodes).toEqual(before);
  });

  test("已有分支向右生长时继续沿外向方向，且本轮节点不互相重叠", () => {
    const nodes = [
      memoNode("parent", -400, 0),
      memoNode("source", 0, 0, "parent"),
    ];
    const positions = layoutCanvasCandidates(nodes, "source", [
      { confidence: 1, memoId: "next-1" },
      { confidence: 0.8, memoId: "next-2" },
    ]);

    expect(positions[0]!.x).toBeGreaterThan(0);
    expect(positions[0]).not.toEqual(positions[1]);
  });
});

describe("nearestCanvasPlacement", () => {
  test("视口中心被占用时找最近无碰撞落点，不移动旧节点", () => {
    const nodes = [memoNode("center", -140, -90)];
    const before = structuredClone(nodes);
    const position = nearestCanvasPlacement(nodes, { x: 0, y: 0 });

    expect(position).not.toEqual({ x: -140, y: -90 });
    expect(nodes).toEqual(before);
  });
});
