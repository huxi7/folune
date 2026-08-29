/**
 * [INPUT]: 依赖 bun:test 与 widgets/cordGeometry 的纯几何导出
 * [OUTPUT]: 对外提供 cordBow/cordAnchor/cordSide/cordCurve/cordCurveBetween 的回归断言，含以独立三次贝塞尔求值反证 De Casteljau 中点切分，以及绕行 360° 证明 radial 弯度连续、轴向归零、对角成 S
 * [POS]: app/src/widgets 的 Cord 几何回归测试，不启动 DOM、SVG 或 Motion；连线的正确性在此定型，渲染层只消费其结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  cordAnchor,
  cordBow,
  cordCurve,
  cordCurveBetween,
  cordSide,
  type CordPoint,
} from "./cordGeometry";

const parseCubic = (d: string): CordPoint[] => {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (numbers === null || numbers.length !== 8) {
    throw new Error(`unexpected cubic path: ${d}`);
  }
  const values = numbers.map(Number);
  return [
    { x: values[0]!, y: values[1]! },
    { x: values[2]!, y: values[3]! },
    { x: values[4]!, y: values[5]! },
    { x: values[6]!, y: values[7]! },
  ];
};

/** 独立实现的三次贝塞尔求值，用于反证切分点确实落在原曲线上 */
const evaluateCubic = (points: CordPoint[], t: number): CordPoint => {
  const [p0, p1, p2, p3] = points as [CordPoint, CordPoint, CordPoint, CordPoint];
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
  };
};

describe("cordBow", () => {
  test("零距离不起拱，超过 span 收敛到上限", () => {
    expect(cordBow(0, 48, 420)).toBe(0);
    expect(cordBow(420, 48, 420)).toBe(48);
    expect(cordBow(10_000, 48, 420)).toBe(48);
  });

  test("区间内随距离线性增长", () => {
    expect(cordBow(210, 48, 420)).toBeCloseTo(24, 6);
  });

  test("span 为 0 时直接给上限，不产生除零", () => {
    expect(cordBow(100, 48, 0)).toBe(48);
  });
});

describe("cordAnchor / cordSide", () => {
  const box = { height: 40, width: 100, x: 0, y: 0 };

  test("正右方目标落在右边中点", () => {
    expect(cordAnchor(box, { x: 500, y: 20 })).toEqual({ x: 100, y: 20 });
    expect(cordSide(box, { x: 500, y: 20 })).toBe("right");
  });

  test("正左方目标落在左边中点", () => {
    expect(cordAnchor(box, { x: -500, y: 20 })).toEqual({ x: 0, y: 20 });
    expect(cordSide(box, { x: -500, y: 20 })).toBe("left");
  });

  test("正下方目标落在下边中点", () => {
    expect(cordAnchor(box, { x: 50, y: 500 })).toEqual({ x: 50, y: 40 });
    expect(cordSide(box, { x: 50, y: 500 })).toBe("bottom");
  });

  test("正上方目标落在上边中点", () => {
    expect(cordAnchor(box, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
    expect(cordSide(box, { x: 50, y: -500 })).toBe("top");
  });

  test("锚点始终落在矩形边界上", () => {
    for (const toward of [
      { x: 400, y: -300 },
      { x: -400, y: 300 },
      { x: 51, y: 21 },
      { x: 1000, y: 19 },
    ]) {
      const anchor = cordAnchor(box, toward);
      const onVerticalEdge = anchor.x === box.x || anchor.x === box.x + box.width;
      const onHorizontalEdge = anchor.y === box.y || anchor.y === box.y + box.height;
      expect(onVerticalEdge || onHorizontalEdge).toBe(true);
    }
  });

  test("目标与中心重合时退化为中心，不产生 NaN", () => {
    const anchor = cordAnchor(box, { x: 50, y: 20 });
    expect(anchor).toEqual({ x: 50, y: 20 });
    expect(Number.isNaN(anchor.x)).toBe(false);
  });
});

describe("cordCurve", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 300, y: 120 };

  test("起点与终点原样保留在 path 两端", () => {
    const curve = cordCurve(from, to);
    const points = parseCubic(curve.d);
    expect(points[0]).toEqual(from);
    expect(points[3]).toEqual(to);
  });

  // 注意: 反证只能经由 path 字符串取回控制点，而 path 被刻意收敛到两位小数，
  // 因此容差取 2 位——它校验的是 De Casteljau 的正确性，不是序列化精度。
  test("中点确实落在曲线 t=0.5 处（反证 De Casteljau）", () => {
    for (const mode of ["horizontal", "radial"] as const) {
      const curve = cordCurve(from, to, { mode });
      const evaluated = evaluateCubic(parseCubic(curve.d), 0.5);
      expect(curve.mid.x).toBeCloseTo(evaluated.x, 2);
      expect(curve.mid.y).toBeCloseTo(evaluated.y, 2);
    }
  });

  test("两段子曲线都以中点为起点，并分别收在两个端点", () => {
    const curve = cordCurve(from, to);
    const first = parseCubic(curve.halves[0]);
    const second = parseCubic(curve.halves[1]);

    expect(first[0]!.x).toBeCloseTo(curve.mid.x, 6);
    expect(first[0]!.y).toBeCloseTo(curve.mid.y, 6);
    expect(second[0]!.x).toBeCloseTo(curve.mid.x, 6);
    expect(second[0]!.y).toBeCloseTo(curve.mid.y, 6);

    expect(first[3]).toEqual(from);
    expect(second[3]).toEqual(to);
  });

  test("子曲线是原曲线的真子段：其 t=0.5 仍落在原曲线上", () => {
    const curve = cordCurve(from, to, { mode: "radial" });
    const full = parseCubic(curve.d);
    // halves[1] 覆盖原曲线 t∈[0.5,1]，其 t=0.5 对应原曲线 t=0.75
    const onHalf = evaluateCubic(parseCubic(curve.halves[1]), 0.5);
    const onFull = evaluateCubic(full, 0.75);
    expect(onHalf.x).toBeCloseTo(onFull.x, 2);
    expect(onHalf.y).toBeCloseTo(onFull.y, 2);
  });

  test("重合端点不产生 NaN", () => {
    const curve = cordCurve({ x: 10, y: 10 }, { x: 10, y: 10 }, { mode: "radial" });
    expect(curve.d).not.toContain("NaN");
    expect(curve.halves[0]).not.toContain("NaN");
    expect(curve.halves[1]).not.toContain("NaN");
  });

  test("path 数值被收敛到两位小数，避免无意义的长字符串", () => {
    const curve = cordCurve({ x: 0, y: 0 }, { x: 1 / 3, y: 2 / 3 });
    expect(curve.d).not.toMatch(/\.\d{3}/);
  });
});

describe("cordCurveBetween", () => {
  test("两端各取面向对方的边缘锚点，而不是中心", () => {
    const left = { height: 40, width: 100, x: 0, y: 0 };
    const right = { height: 40, width: 100, x: 400, y: 0 };
    const curve = cordCurveBetween(left, right);

    expect(curve.from).toEqual({ x: 100, y: 20 });
    expect(curve.to).toEqual({ x: 400, y: 20 });
  });

  test("竖向排布时改用上下边缘", () => {
    const top = { height: 40, width: 100, x: 0, y: 0 };
    const bottom = { height: 40, width: 100, x: 0, y: 400 };
    const curve = cordCurveBetween(top, bottom, { mode: "radial" });

    expect(curve.from).toEqual({ x: 50, y: 40 });
    expect(curve.to).toEqual({ x: 50, y: 400 });
  });
});

/*
 * 弯度的形状描述子: 曲线相对自身弦的「有符号法向偏移」采样。
 * 它对整体旋转和平移不变, 因此可以把「形状怎么变」从「卡片转到哪」里剥出来,
 * 用来证明绕行 360° 时形状本身连续, 而不是被旋转掩盖过去。
 */
const DEVIATION_SAMPLES = [0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85];

const deviationProfile = (d: string): number[] => {
  const points = parseCubic(d);
  const start = points[0]!;
  const end = points[3]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  return DEVIATION_SAMPLES.map((t) => {
    const point = evaluateCubic(points, t);
    return (point.x - start.x) * nx + (point.y - start.y) * ny;
  });
};

const cardAt = (x: number, y: number) => ({ height: 360, width: 280, x, y });

/** 以 source 卡片中心为圆心, 让 target 卡片绕行一周 */
const orbit = (degrees: number) => {
  const radius = 620;
  const radians = (degrees * Math.PI) / 180;
  return cordCurveBetween(
    cardAt(0, 0),
    cardAt(
      Math.cos(radians) * radius - 140 + 140,
      Math.sin(radians) * radius - 180 + 180,
    ),
    { mode: "radial" },
  );
};

describe("radial 弯度律", () => {
  test("水平或垂直对齐时退化成直线：控制点落在弦上", () => {
    for (const target of [
      cardAt(700, 0),
      cardAt(-700, 0),
      cardAt(0, 700),
      cardAt(0, -700),
    ]) {
      const curve = cordCurveBetween(cardAt(0, 0), target, { mode: "radial" });
      for (const deviation of deviationProfile(curve.d)) {
        expect(Math.abs(deviation)).toBeLessThan(0.05);
      }
    }
  });

  test("对角线上是两个弯的 S：曲线在弦两侧各鼓一次", () => {
    const curve = cordCurveBetween(cardAt(0, 0), cardAt(600, 600), {
      mode: "radial",
    });
    const profile = deviationProfile(curve.d);
    expect(Math.max(...profile)).toBeGreaterThan(3);
    expect(Math.min(...profile)).toBeLessThan(-3);
  });

  /*
   * 注意: 弯度是 sin(2θ) 与 cordBow(锚点距离) 的乘积, 而卡片对角相邻时两条边缘
   * 反而更近, bow 随之变小。所以「越靠近 45° 越弯」只在离开轴向的那一段成立,
   * 45° 与 22.5° 的绝对弯度接近——这里断言真实设计, 不断言更强的东西。
   */
  test("离开轴向即起弯，对角方向明显比近轴向更弯", () => {
    const peak = (degrees: number) =>
      Math.max(...deviationProfile(orbit(degrees).d).map(Math.abs));

    expect(peak(0)).toBeLessThan(0.05);
    expect(peak(2)).toBeGreaterThan(peak(0));
    expect(peak(10)).toBeGreaterThan(peak(2));
    expect(peak(45)).toBeGreaterThan(peak(10));
  });

  test("绕行 360°：每 1° 形状变化都有界，没有任何一步跳变", () => {
    let previous = deviationProfile(orbit(0).d);
    let worst = 0;
    for (let degrees = 1; degrees <= 360; degrees += 1) {
      const current = deviationProfile(orbit(degrees).d);
      for (const [index, value] of current.entries()) {
        worst = Math.max(worst, Math.abs(value - (previous[index] ?? 0)));
      }
      previous = current;
    }
    // 解析上限为 bow·2·Δθ ≈ 48 × 2 × 0.0175 ≈ 1.7px；扇区切换会在这里爆成几十 px
    expect(worst).toBeLessThan(2);
  });

  test("绕行 360°：弯向恰好换四次，即只在四条轴上取直", () => {
    let firstSign = 0;
    let previousSign = 0;
    let flips = 0;
    for (let degrees = 0; degrees < 360; degrees += 1) {
      const middle = deviationProfile(orbit(degrees).d)[1] ?? 0;
      const sign = Math.abs(middle) < 0.05 ? 0 : Math.sign(middle);
      if (sign === 0) continue;
      if (firstSign === 0) firstSign = sign;
      if (previousSign !== 0 && sign !== previousSign) flips += 1;
      previousSign = sign;
    }
    // 绕行是闭环: 最后一段回到起点那一段也算一次换向
    if (previousSign !== firstSign) flips += 1;
    expect(flips).toBe(4);
  });
});
