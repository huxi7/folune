/**
 * [INPUT]: 依赖 bun:test、CanvasCordEdge 的 canvasFloatingCurve 与 React Flow 同构节点几何
 * [OUTPUT]: 锁定关系端点随目标节点跨象限移动而切换到对应卡片边界、轴向对齐取直而对角起 S，并覆盖测量缺失时的 Handle 坐标兜底
 * [POS]: KnowledgeCanvas 的浮动关系几何回归门禁；不启动 DOM，直接证明边组件消费的是节点中心射线而非固定左右 Handle
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { canvasEdgeReasonPoint, canvasFloatingCurve } from "./CanvasCordEdge";

const nodeAt = (x: number, y: number) => ({
  height: 360,
  internals: { positionAbsolute: { x, y } },
  measured: { height: 360, width: 280 },
  width: 280,
});

/** memo_ref 才有可见表面, 因此才带圆角; native 空间文字保持尖角 bbox */
const cardAt = (x: number, y: number) => ({ ...nodeAt(x, y), data: { kind: "memo_ref" } });

const fallback = {
  sourceX: 10,
  sourceY: 20,
  targetX: 30,
  targetY: 40,
};

const controlPointsOf = (d: string) => {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (numbers.length !== 8) throw new Error(`unexpected cubic path: ${d}`);
  const start = { x: numbers[0]!, y: numbers[1]! };
  const end = { x: numbers[6]!, y: numbers[7]! };
  const nx = -(end.y - start.y);
  const ny = end.x - start.x;
  const length = Math.hypot(nx, ny) || 1;
  /* 两个控制点相对弦的有符号法向偏移: 同号是单向弓, 异号才是两个弯的 S */
  return [
    ((numbers[2]! - start.x) * nx + (numbers[3]! - start.y) * ny) / length,
    ((numbers[4]! - start.x) * nx + (numbers[5]! - start.y) * ny) / length,
  ];
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

  test("轴向对齐时是直线，对角方向是两个弯的 S", () => {
    const source = nodeAt(0, 0);
    const aligned = canvasFloatingCurve(source, nodeAt(700, 0), fallback);
    const diagonal = canvasFloatingCurve(source, nodeAt(600, 600), fallback);

    for (const offset of controlPointsOf(aligned.d)) {
      expect(Math.abs(offset)).toBeLessThan(0.05);
    }

    const [head, tail] = controlPointsOf(diagonal.d) as [number, number];
    expect(Math.abs(head)).toBeGreaterThan(3);
    expect(Math.sign(head)).not.toBe(Math.sign(tail));
  });

  test("卡片朝对角方向的端点收进圆角，不再落在被削掉的尖角上", () => {
    // 正对着右下角的方向: 位移与半宽半高同比(140:180), 尖角矩形恰好命中角点
    const diagonal = { x: 560, y: 720 };
    const sharp = canvasFloatingCurve(nodeAt(0, 0), nodeAt(diagonal.x, diagonal.y), fallback);
    const rounded = canvasFloatingCurve(cardAt(0, 0), cardAt(diagonal.x, diagonal.y), fallback);

    // 尖角矩形把端点放在角点上; 圆角把它拉回弧上, 于是不会露在可见轮廓之外
    expect(sharp.from).toEqual({ x: 280, y: 360 });
    expect(rounded.from.x).toBeLessThan(280);
    expect(rounded.from.y).toBeLessThan(360);
    expect(Math.hypot(rounded.from.x - 264, rounded.from.y - 344)).toBeCloseTo(16, 6);
  });
});

describe("canvasEdgeReasonPoint", () => {
  test("解释入口固定在正式中心 Handle 的中点，不跟随边界端点收缩", () => {
    expect(canvasEdgeReasonPoint(140, 180, 640, 360)).toEqual({ x: 390, y: 270 });
  });
});
