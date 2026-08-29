/**
 * [INPUT]: 依赖 bun:test、CanvasCordEdge 的 canvasFloatingCurve 与 React Flow 同构节点几何
 * [OUTPUT]: 锁定关系端点随目标节点跨象限移动而切换到对应卡片边界，并覆盖测量缺失时的 Handle 坐标兜底
 * [POS]: KnowledgeCanvas 的浮动关系几何回归门禁；不启动 DOM，直接证明边组件消费的是节点中心射线而非固定左右 Handle
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { canvasFloatingCurve } from "./CanvasCordEdge";

const nodeAt = (x: number, y: number) => ({
  height: 360,
  internals: { positionAbsolute: { x, y } },
  measured: { height: 360, width: 280 },
  width: 280,
});

const fallback = {
  sourceX: 10,
  sourceY: 20,
  targetX: 30,
  targetY: 40,
};

describe("canvasFloatingCurve", () => {
  test("目标从右侧移到下方时，起终点从左右边自动切换到上下边", () => {
    const source = nodeAt(0, 0);
    const right = canvasFloatingCurve(source, nodeAt(500, 0), fallback);
    const below = canvasFloatingCurve(source, nodeAt(0, 600), fallback);

    expect(right.from).toEqual({ x: 280, y: 180 });
    expect(right.to).toEqual({ x: 500, y: 180 });
    expect(below.from).toEqual({ x: 140, y: 360 });
    expect(below.to).toEqual({ x: 140, y: 600 });
  });

  test("节点尚未测量时仅暂用 React Flow 坐标且不产生 NaN", () => {
    const curve = canvasFloatingCurve(undefined, undefined, fallback);

    expect(curve.from).toEqual({ x: 10, y: 20 });
    expect(curve.to).toEqual({ x: 30, y: 40 });
    expect(curve.d).not.toContain("NaN");
  });
});
