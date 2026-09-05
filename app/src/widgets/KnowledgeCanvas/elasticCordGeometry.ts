/**
 * [INPUT]: 依赖 widgets/cordGeometry 的 CordPoint 类型，只接收抓手落点、实时指针与形态相位
 * [OUTPUT]: 对外提供集中参数、elasticCordMetrics/elasticCordEnvelope 与三股自抓手出发、终点绕珠散开的 elasticCordGeometry 纯几何；波形是 sin θ + sin 3θ（W 与 M 交替、中间转角落在中线），圈数恒定如弹簧、三股各自速度、尾端扇开与相位无关
 * [POS]: KnowledgeCanvas 瞬态连接绳的唯一几何真相；两端都是被抓住的那两个点（抓手与指针），不推导卡片边界、不改变正式边
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CordPoint } from "../cordGeometry";

/*
 * 波形不是正弦, 是「基频 + 等幅三次谐波」: sin θ + h·sin 3θ。
 *
 * 纯正弦一个周期只有一个峰一个谷, 读起来太规整。加上三次谐波后, 一个周期变成
 * 「峰-中线-峰」再接「谷-中线-谷」, 也就是一个 M 紧跟一个 W 无限接下去 —— 而 W 与 M
 * 正中央那个转角恰好落在中线上(h = 1 时正好为 0), 这是它区别于正弦的那一眼。
 * h 只调那个中间转角的深浅: h=1/3 停在 2/3 高处(方波前两项), h=1 正好压到中线,
 * h>1 会穿过中线。
 *
 * 三股各自的相位跑得快慢不同(strandSpeeds), 因此它们的相对位置一直在变, 读作三根
 * 线真的在互相缠绕; 三股同速时只会得到三条永远平行的波。速度与透明度同序: 越淡的
 * 跑得越快(淡的那几股在 knowledge-canvas.css 里), 于是深的那股读作绳身, 淡的读作
 * 绕在外面的丝。
 */
export const ELASTIC_CORD_PARAMETERS = {
  farDistance: 1_040,
  harmonic: 1,
  maxAmplitude: 10,
  /* 股距是三股之间的法向间隔: 太小三股就叠成一根粗线, 缠绕只剩密集交叉点, 读作细密紧绷 */
  maxStrandGap: 5.4,
  maxWidth: 2.4,
  minAmplitude: 4.2,
  minStrandGap: 2.8,
  minWidth: 1.5,
  nearDistance: 80,
  phaseSpeed: 0.0015,
  samples: 144,
  strands: 3,
  strandSpeeds: [1, 1.42, 2.05],
  /*
   * 尾端扇开, 与相位无关。「三线戏珠」是三股绕着珠子转, 不是从珠子里射出来 —— 而前面
   * 两项(波与股距)都带相位: 在某些相位上它们正好反向抵消, 三股就在珠子处并成一条。
   * 圈数取整数时尾端恰好回到起始相位, 这个抵消就成了固定现象(相位为 0 的 Reduced Motion
   * 是最坏那一档)。所以"绕珠"不能靠那两项的残余碰运气, 单独给一项常量扇开。
   * 常量而不随距离缩: 珠子本身是恒定小圆, 它不缩, 绕它的那点扇开也不该缩。
   */
  tailFan: 3.4,
  tailSpread: 0.34,
  /*
   * 圈数恒定 —— 这根是弹簧, 不是麻绳。弹簧的圈数不随拉伸改变: 拉长只是把同样这几圈
   * 抻开抻平, 于是"卷着"和"被拉直"是同一根东西的两个状态, 这正是这条线要表达的张力。
   * 反过来把波长钉死(拉长就多长几个周期)是麻绳的模型: 越拉越松、越拉越弯, 与手上
   * 越拉越紧的感觉相反; 而且一旦给周期数设上下限, 就会在某个距离上从"多长几圈"切换
   * 成"波长变长", 同一次拖拽里出现两种行为, 读起来是割裂的。
   * 拉远仍看得见波浪, 靠的是 minAmplitude 有下限, 不是靠多长几圈。
   */
  waves: 3,
} as const;

/*
 * 端点包络。起点严格归零(抓手那一头本来就压在卡片底下), 终点刻意留下 tailSpread 的
 * 残余: 三股因此不收成一个点, 而是在珠子四周散开绕过去 —— 「三线戏珠」是线绕着珠子转,
 * 不是线从珠子里发射出来。珠子自带一圈画布色描边, 于是它压在三股之上而不被穿过。
 *
 * 中段最肥是刻意的: 两端被抓手与指针拉住, 中间松 —— 这就是"绳"而不是"箍紧的线"。
 * 2026-09-02 试过把收束改成尾端 14px 的绝对收口(全长等幅), 所有者实看后选择保留这一版。
 */
export const elasticCordEnvelope = (progress: number): number =>
  Math.sin(Math.PI * progress)
    + ELASTIC_CORD_PARAMETERS.tailSpread * progress * progress;

export type ElasticCordMetrics = {
  amplitude: number;
  strandGap: number;
  tension: number;
  width: number;
};

export type ElasticCordGeometry = ElasticCordMetrics & {
  distance: number;
  from: CordPoint;
  strands: readonly [string, string, string];
  to: CordPoint;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;
const format = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

export function elasticCordMetrics(distance: number): ElasticCordMetrics {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const tension = clamp01(
    (safeDistance - ELASTIC_CORD_PARAMETERS.nearDistance)
      / (ELASTIC_CORD_PARAMETERS.farDistance - ELASTIC_CORD_PARAMETERS.nearDistance),
  );
  return {
    amplitude: lerp(
      ELASTIC_CORD_PARAMETERS.maxAmplitude,
      ELASTIC_CORD_PARAMETERS.minAmplitude,
      tension,
    ),
    strandGap: lerp(
      ELASTIC_CORD_PARAMETERS.maxStrandGap,
      ELASTIC_CORD_PARAMETERS.minStrandGap,
      tension,
    ),
    tension,
    width: lerp(
      ELASTIC_CORD_PARAMETERS.maxWidth,
      ELASTIC_CORD_PARAMETERS.minWidth,
      tension,
    ),
  };
}

/** sin θ + h·sin 3θ —— W 与 M 交替、中间转角落在中线的那条波 */
const waveform = (theta: number): number =>
  Math.sin(theta) + ELASTIC_CORD_PARAMETERS.harmonic * Math.sin(3 * theta);

const strandPath = (
  from: CordPoint,
  to: CordPoint,
  amplitude: number,
  strandGap: number,
  phase: number,
  strandIndex: number,
): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const normal = length === 0 ? { x: 0, y: 0 } : { x: -dy / length, y: dx / length };
  // 每股自己的时间: 快慢不同, 三股的相对位置才会一直变
  const strandPhase = phase * (ELASTIC_CORD_PARAMETERS.strandSpeeds[strandIndex] ?? 1)
    + ((strandIndex - 1) * Math.PI * 2) / 3;
  // 谐波把峰值抬到约 1.54, 除掉它, amplitude 仍然是"最远偏离多少像素"
  const peak = 1 + ELASTIC_CORD_PARAMETERS.harmonic;
  const commands: string[] = [];
  for (let index = 0; index <= ELASTIC_CORD_PARAMETERS.samples; index += 1) {
    const progress = index / ELASTIC_CORD_PARAMETERS.samples;
    const envelope = elasticCordEnvelope(progress);
    const wave = waveform(
      progress * Math.PI * 2 * ELASTIC_CORD_PARAMETERS.waves + strandPhase,
    ) / peak;
    const braid = (strandIndex - 1) * strandGap
      * Math.cos(progress * Math.PI * 2 + strandPhase);
    // 扇开在包络之外: progress² 让它只在尾端出现, 起点仍严格落在抓手那一个点上
    const offset = envelope * (wave * amplitude + braid)
      + (strandIndex - 1) * ELASTIC_CORD_PARAMETERS.tailFan * progress * progress;
    const x = from.x + dx * progress + normal.x * offset;
    const y = from.y + dy * progress + normal.y * offset;
    commands.push(`${index === 0 ? "M" : "L"}${format(x)},${format(y)}`);
  }
  return commands.join(" ");
};

/*
 * 两端都是手势本身: from 是用户真正按住的那个抓手, to 是他此刻的指针。
 * 这里刻意不再对来源卡片求边界锚点 —— 那是「已成立的关系属于整张卡片」的算法, 属于
 * CanvasCordEdge; 手势进行中，绳子必须从被抓住的那一点出来，否则按下的瞬间线就跳到
 * 卡片边缘中点, 恰好否认了刚刚发生的那次抓取。
 */
export function elasticCordGeometry({
  from: grip,
  phase = 0,
  pointer,
}: {
  from: CordPoint;
  phase?: number;
  pointer: CordPoint;
}): ElasticCordGeometry {
  const from = {
    x: Number.isFinite(grip.x) ? grip.x : 0,
    y: Number.isFinite(grip.y) ? grip.y : 0,
  };
  const to = {
    x: Number.isFinite(pointer.x) ? pointer.x : from.x,
    y: Number.isFinite(pointer.y) ? pointer.y : from.y,
  };
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const metrics = elasticCordMetrics(distance);
  return {
    ...metrics,
    distance,
    from,
    strands: [0, 1, 2].map((strandIndex) => strandPath(
      from,
      to,
      metrics.amplitude,
      metrics.strandGap,
      Number.isFinite(phase) ? phase : 0,
      strandIndex,
    )) as unknown as readonly [string, string, string],
    to,
  };
}
