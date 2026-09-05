/**
 * [INPUT]: 依赖 Bun test 与 elasticCordGeometry/elasticCordMetrics/elasticCordEnvelope 纯几何
 * [OUTPUT]: 锁定三股严格自抓手出发、终点在任意相位都绕珠而不收成一点、W 与 M 交替的谐波波形、圈数恒定如弹簧、距离增加时收敛有下限、极端输入有限及静态相位稳定
 * [POS]: KnowledgeCanvas 瞬态连接绳的数学回归门禁；不挂载 React，不测正式 CanvasCordEdge
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  ELASTIC_CORD_PARAMETERS,
  elasticCordEnvelope,
  elasticCordGeometry,
  elasticCordMetrics,
} from "./elasticCordGeometry";

// 抓手的落点由 React Flow 的 handleBounds 给出, 几何层只当它是一个点
const grip = { x: 372, y: 428 };

describe("elasticCordGeometry", () => {
  const lastPoint = (path: string): { x: number; y: number } => {
    const [x, y] = (path.split(" ").at(-1) ?? "").slice(1).split(",").map(Number);
    return { x: x ?? Number.NaN, y: y ?? Number.NaN };
  };

  test("三股严格从同一个抓手出发", () => {
    const geometry = elasticCordGeometry({ from: grip, pointer: { x: 680, y: 420 } });
    const starts = geometry.strands.map((path) => path.split(" ")[0]);
    expect(new Set(starts).size).toBe(1);
    expect(starts[0]).toBe(`M${grip.x},${grip.y}`);
  });

  const tailShape = (distance: number, phase: number): { reach: number; spread: number } => {
    const geometry = elasticCordGeometry({
      from: { x: 0, y: 0 },
      phase,
      pointer: { x: distance, y: 0 },
    });
    const ends = geometry.strands.map(lastPoint);
    return {
      reach: Math.max(...ends.map((end) =>
        Math.hypot(end.x - geometry.to.x, end.y - geometry.to.y))),
      spread: Math.max(...ends.map((end, index) =>
        Math.max(...ends.slice(index + 1).map((other) =>
          Math.hypot(end.x - other.x, end.y - other.y)), 0))),
    };
  };

  test("终点绕珠而不收成一点: 任意相位都散开, 且都贴着珠子", () => {
    /*
     * 「三线戏珠」是线围着珠子转, 不是线从珠子里发射出来。散开必须与相位无关:
     * 波与股距两项都带相位, 圈数取整数时尾端又恰好回到起始相位, 于是它们在相位 0 上
     * 正好反向抵消 —— 那正是 Reduced Motion 固定停在的那一档。所以扇开单独由 tailFan
     * 给出; 这条测试同时钉住相位 0 与整段相位扫掠, 抵消一旦回来立刻红。
     */
    const phases = Array.from({ length: 401 }, (_, index) => index * 0.1);
    for (const distance of [80, 308, 1_200]) {
      const bound = ELASTIC_CORD_PARAMETERS.tailFan
        + ELASTIC_CORD_PARAMETERS.tailSpread
          * (elasticCordMetrics(distance).amplitude + ELASTIC_CORD_PARAMETERS.maxStrandGap)
        + 1;
      // 相位 0: Reduced Motion 永远停在这里, 它必须是最稳的一档而不是最坏的一档
      expect(tailShape(distance, 0).spread).toBeGreaterThan(4);
      for (const phase of phases) {
        const { reach, spread } = tailShape(distance, phase);
        expect(spread).toBeGreaterThan(1.4);
        // 贴着珠子: 扇开加上包络残余就是全部偏离, 再留一点浮点余量
        expect(reach).toBeLessThan(bound);
      }
    }
  });

  test("波形是 W 与 M 交替: 一个周期里有四个极值, 中间那两个落在中线", () => {
    /*
     * 纯正弦一个周期只有一峰一谷。基频叠加等幅三次谐波后, 一个周期是
     * 「峰-中线-峰」接「谷-中线-谷」—— 也就是 M 紧跟 W, 而两个中间转角恰好为 0。
     * 这里直接对 sin θ + h·sin 3θ 求极值, 因为它就是这条曲线区别于正弦的全部。
     */
    const h = ELASTIC_CORD_PARAMETERS.harmonic;
    const wave = (t: number): number => Math.sin(t) + h * Math.sin(3 * t);
    const samples = 3_600;
    const extrema: number[] = [];
    for (let index = 1; index < samples; index += 1) {
      const previous = wave(((index - 1) / samples) * Math.PI * 2);
      const current = wave((index / samples) * Math.PI * 2);
      const next = wave(((index + 1) / samples) * Math.PI * 2);
      if ((current > previous && current >= next) || (current < previous && current <= next)) {
        extrema.push(current);
      }
    }
    expect(h).toBe(1);
    expect(extrema).toHaveLength(6);
    const peak = Math.max(...extrema.map(Math.abs));
    const shape = extrema.map((value) => Math.round((value / peak) * 100) / 100);
    // 峰、中线、峰、谷、中线、谷
    expect(shape).toEqual([1, 0, 1, -1, 0, -1]);
  });

  test("圈数恒定如弹簧: 拉长只是把同样这几圈抻开, 不是多长几圈", () => {
    /*
     * 极值个数只由 waves 决定, 与距离无关 —— 弹簧的圈数不随拉伸改变。
     * 反过来按固定波长长圈数是麻绳: 越拉越松、越拉越弯, 与手上越拉越紧相反;
     * 而且给圈数设上下限就会在某个距离上从"多长几圈"切到"波长变长", 同一次
     * 拖拽出现两种行为, 观感割裂。拉远仍有波浪靠 minAmplitude 有下限。
     */
    const countExtrema = (distance: number): number => {
      const geometry = elasticCordGeometry({
        from: { x: 0, y: 0 },
        phase: 0,
        pointer: { x: distance, y: 0 },
      });
      const offsets = (geometry.strands[0].split(" "))
        .map((token) => Number(token.slice(1).split(",")[1]));
      let count = 0;
      for (let index = 1; index < offsets.length - 1; index += 1) {
        const [previous, current, next] = [offsets[index - 1]!, offsets[index]!, offsets[index + 1]!];
        if ((current > previous && current >= next) || (current < previous && current <= next)) count += 1;
      }
      return count;
    };
    const counts = [180, 420, 900, 1_800].map(countExtrema);
    expect(new Set(counts).size).toBe(1);
    // 3 圈 × 每圈 6 个极值(sin θ + sin 3θ), 端点包络不额外造极值
    expect(ELASTIC_CORD_PARAMETERS.waves).toBe(3);
    expect(counts[0]).toBeGreaterThanOrEqual(3 * 6 - 2);
  });

  test("圈的位置不随相位改变: 波不沿着绳往前跑, 动的只有三股互绕", () => {
    /*
     * 拖拽本来就已经在动了。若波再沿着绳跑, 每个内点都要把整个 ±振幅扫一遍(旧实现
     * 中段来回 24px), 那份摆动跟指针抢同一条视觉通道, 读作线跟不上手。所以时间只进到
     * 「三股互绕」这一项: 圈钉在绳上, 三股彼此滑动。判据是绳中段的摆幅必须落在股距
     * 这个量级里, 而不是振幅那个量级。
     */
    const distance = 340;
    const at = (phase: number, progress: number): number[] => elasticCordGeometry({
      from: { x: 0, y: 0 },
      phase,
      pointer: { x: distance, y: 0 },
    }).strands.map((path) =>
      Number((path.split(" ")[Math.round(progress * ELASTIC_CORD_PARAMETERS.samples)] ?? "")
        .slice(1).split(",")[1]));
    const { amplitude, strandGap } = elasticCordMetrics(distance);
    for (const progress of [0.25, 0.5, 0.75]) {
      const samples = Array.from({ length: 200 }, (_, index) => at(index * 0.1, progress));
      for (let strand = 0; strand < 3; strand += 1) {
        const values = samples.map((row) => row[strand]!);
        const swing = Math.max(...values) - Math.min(...values);
        // 摆幅由互绕这一项独占: 上界就是 2×股距, 波再也不贡献一分
        expect(swing).toBeLessThanOrEqual(2 * strandGap + 0.05);
        // 仍然在动: 完全不动就不是缠绕了
        expect(swing).toBeGreaterThan(strandGap);
        // 波在跑的旧实现同一点来回 24px, 那是整个 ±振幅
        expect(swing).toBeLessThan(2 * amplitude - 4);
      }
    }
    expect(amplitude).toBeGreaterThan(0);
  });

  test("起点只由抓手决定: 指针绕着走一圈, 三股始终贴着抓手", () => {
    /*
     * 起点不再是同一个点(那一头不收束了), 但它必须始终由抓手决定: 绕行一圈, 三股离
     * 抓手的距离恒定有界, 且那个界只由振幅与股距给出。旧实现对来源卡片求边界锚点,
     * 起点会随指针沿着卡片边缘滑动几十像素 —— 那正是"线不是从我按住的地方出来的"。
     */
    let worst = 0;
    for (let degree = 0; degree < 360; degree += 15) {
      const radian = (degree * Math.PI) / 180;
      const geometry = elasticCordGeometry({
        from: grip,
        pointer: {
          x: grip.x + Math.cos(radian) * 240,
          y: grip.y + Math.sin(radian) * 240,
        },
      });
      for (const start of geometry.strands.map(firstPoint)) {
        worst = Math.max(worst, Math.hypot(start.x - grip.x, start.y - grip.y));
      }
    }
    const { amplitude, strandGap } = elasticCordMetrics(240);
    expect(worst).toBeLessThanOrEqual(
      amplitude / (1 + ELASTIC_CORD_PARAMETERS.harmonic) + strandGap,
    );
    // 卡片边到抓手中心约 16px: 断口必须留在卡片底下
    expect(worst).toBeLessThan(16);
  });

  test("拉远时振幅、股距与线宽单调收敛, 但都收不到零", () => {
    const distances = [0, 80, 160, 320, 560, 2_000];
    const metrics = distances.map(elasticCordMetrics);
    for (let index = 1; index < metrics.length; index += 1) {
      expect(metrics[index]!.amplitude).toBeLessThanOrEqual(metrics[index - 1]!.amplitude);
      expect(metrics[index]!.strandGap).toBeLessThanOrEqual(metrics[index - 1]!.strandGap);
      expect(metrics[index]!.width).toBeLessThanOrEqual(metrics[index - 1]!.width);
    }
    // 拉到再远也必须留着看得见的波浪: 收成直线就不像绳子了
    expect(metrics.at(-1)!.amplitude)
      .toBeCloseTo(ELASTIC_CORD_PARAMETERS.minAmplitude, 6);
    expect(ELASTIC_CORD_PARAMETERS.minAmplitude).toBeGreaterThanOrEqual(3);
  });

  test("零距离与极远距离不产 NaN，静态相位重复计算逐字稳定", () => {
    const zero = elasticCordGeometry({
      from: { x: 240, y: 260 },
      pointer: { x: 240, y: 260 },
    });
    const far = elasticCordGeometry({
      from: grip,
      pointer: { x: 1_000_000, y: -1_000_000 },
    });
    const broken = elasticCordGeometry({
      from: { x: Number.NaN, y: 12 },
      pointer: { x: Number.POSITIVE_INFINITY, y: 40 },
    });
    expect(zero.strands.join(" ")).not.toContain("NaN");
    expect(far.strands.join(" ")).not.toContain("NaN");
    expect(broken.strands.join(" ")).not.toContain("NaN");
    expect(elasticCordGeometry({ from: grip, phase: 0, pointer: far.to }).strands)
      .toEqual(elasticCordGeometry({ from: grip, phase: 0, pointer: far.to }).strands);
  });
});
