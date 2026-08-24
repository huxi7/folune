/**
 * [INPUT]: 依赖 bun:test 与 widgets/radialLayout 的纯布局导出
 * [OUTPUT]: 对外提供「越相关越近」「候选让开中心矩形」「确定性无随机」「绕开竖直楔形」「同侧防重叠」五组不变量断言
 * [POS]: app/src/widgets 的探索态排布回归测试，不启动 DOM 或 Motion；布局语义在此定型，渲染层只消费坐标
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { radialLayout, type RadialItem } from "./radialLayout";

const CENTER = { height: 640, width: 816 };
const OPTIONS = { centerSize: CENTER, maxRadius: 360, minRadius: 96 };

const items = (...relevances: number[]): RadialItem[] =>
  relevances.map((relevance, index) => ({ id: `n${index}`, relevance }));

const degrees = (radians: number): number => (radians * 180) / Math.PI;

describe("radialLayout", () => {
  test("空输入返回空数组", () => {
    expect(radialLayout([], OPTIONS)).toEqual([]);
  });

  test("越相关排得越近——半径随相关度单调下降", () => {
    const placed = radialLayout(items(1, 0.75, 0.5, 0.25), { ...OPTIONS, verticalAvoidance: 34 });
    const byId = new Map(placed.map((p) => [p.id, p]));

    // n0 最相关，n3 最不相关
    expect(byId.get("n0")!.radius).toBeLessThan(byId.get("n3")!.radius);
    expect(byId.get("n0")!.relevance).toBe(1);
  });

  test("相关度 1 贴近下限、0 推到上限", () => {
    const [near] = radialLayout(items(1), OPTIONS);
    const [far] = radialLayout(items(0), OPTIONS);
    expect(near!.radius).toBe(96);
    expect(far!.radius).toBe(360);
  });

  test("相关度越界被夹紧，不产生负半径或超限", () => {
    const placed = radialLayout(items(5, -3), OPTIONS);
    for (const item of placed) {
      expect(item.radius).toBeGreaterThanOrEqual(96);
      expect(item.radius).toBeLessThanOrEqual(360 * 4);
      expect(Number.isFinite(item.x)).toBe(true);
      expect(Number.isFinite(item.y)).toBe(true);
    }
  });

  test("候选一律落在中心矩形之外", () => {
    const placed = radialLayout(items(1, 0.9, 0.8, 0.7, 0.6, 0.5), OPTIONS);
    for (const item of placed) {
      const outsideHorizontally = Math.abs(item.x) >= CENTER.width / 2;
      const outsideVertically = Math.abs(item.y) >= CENTER.height / 2;
      expect(outsideHorizontally || outsideVertically).toBe(true);
    }
  });

  test("左右交替分侧，最相关的先占右侧", () => {
    const placed = radialLayout(items(1, 0.9, 0.8, 0.7, 0.6), OPTIONS);
    expect(placed.map((p) => p.side)).toEqual(["right", "left", "right", "left", "right"]);
    expect(placed[0]!.x).toBeGreaterThan(0);
    expect(placed[1]!.x).toBeLessThan(0);
  });

  test("绕开正上/正下的竖直楔形", () => {
    const avoidance = 34;
    const placed = radialLayout(items(1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3), {
      ...OPTIONS,
      verticalAvoidance: avoidance,
    });
    for (const item of placed) {
      // 归一化到 [-180,180]，再看与 ±90（正下/正上）的角距
      let deg = degrees(item.angle) % 360;
      if (deg > 180) deg -= 360;
      if (deg < -180) deg += 360;
      const toDown = Math.abs(Math.abs(deg) - 90);
      expect(toDown).toBeGreaterThanOrEqual(avoidance - 1e-6);
    }
  });

  test("单个候选落在该侧弧段正中，而不是贴边", () => {
    const [only] = radialLayout(items(0.5), OPTIONS);
    expect(degrees(only!.angle)).toBeCloseTo(0, 6);
    expect(only!.side).toBe("right");
  });

  test("确定性：同一输入永远同一输出", () => {
    const input = items(0.8, 0.4, 0.9, 0.1);
    expect(radialLayout(input, OPTIONS)).toEqual(radialLayout(input, OPTIONS));
  });

  test("输入顺序不影响结果——按相关度降序、同分按 id 稳定排序", () => {
    const a: RadialItem[] = [
      { id: "alpha", relevance: 0.5 },
      { id: "beta", relevance: 0.9 },
      { id: "gamma", relevance: 0.5 },
    ];
    const b: RadialItem[] = [a[2]!, a[0]!, a[1]!];
    expect(radialLayout(b, OPTIONS)).toEqual(radialLayout(a, OPTIONS));
    // 同分时 alpha 先于 gamma
    const ids = radialLayout(a, OPTIONS).map((p) => p.id);
    expect(ids).toEqual(["beta", "alpha", "gamma"]);
  });

  test("同侧候选拥挤时向外推离，弦长不小于卡片高度", () => {
    const cardSize = { height: 132, width: 260 };
    const placed = radialLayout(items(1, 1, 1, 1, 1, 1, 1, 1), { ...OPTIONS, cardSize });
    const right = placed.filter((p) => p.side === "right");
    expect(right.length).toBeGreaterThan(1);

    for (let i = 1; i < right.length; i += 1) {
      const previous = right[i - 1]!;
      const current = right[i]!;
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      expect(distance).toBeGreaterThanOrEqual(cardSize.height);
    }
  });

  test("拥挤外推不会把最相关的候选推得比最不相关的更远", () => {
    const placed = radialLayout(items(1, 0.95, 0.9, 0.1), OPTIONS);
    const byId = new Map(placed.map((p) => [p.id, p]));
    expect(byId.get("n0")!.radius).toBeLessThanOrEqual(byId.get("n3")!.radius);
  });
});
