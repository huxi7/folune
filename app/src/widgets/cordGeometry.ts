/**
 * [INPUT]: 无外部依赖的纯几何计算，不访问 DOM、React 或 Motion
 * [OUTPUT]: 对外提供 CordPoint/CordBox/CordCurve 类型、cordAnchor 边缘锚点、cordCurve 三次贝塞尔与中点切分、cordBow 距离自适应弯度；radial 模式的弯度按 sin(2θ) 反对称分布，轴向对齐即直线、对角线最弯且随角度 360° 连续
 * [POS]: app/src/widgets 的 Cord Signature 连线几何内核；Cord.tsx 只负责渲染与动效，一切坐标与路径字符串在此确定，因此可脱离浏览器单测
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type CordPoint = { x: number; y: number };

export type CordBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type CordSide = "bottom" | "left" | "right" | "top";

export type CordCurve = {
  /** 完整曲线的 SVG path data */
  d: string;
  from: CordPoint;
  /** 以中点切分出的两段子曲线，均以中点为起点，供「光从中间淌向两端」使用 */
  halves: [string, string];
  mid: CordPoint;
  to: CordPoint;
};

export type CordCurveOptions = {
  /** 弯度上限（像素）。距离越远越接近该上限 */
  bow?: number;
  /** 达到最大弯度所需的距离 */
  bowSpan?: number;
  /**
   * 控制点方向：horizontal 走左右出入（侧边栏语境）；
   * radial 沿弦法向反对称起拱（画布语境），轴向对齐退化成直线，对角线成 S
   */
  mode?: "horizontal" | "radial";
};

const DEFAULT_BOW = 48;
const DEFAULT_BOW_SPAN = 420;

const midpoint = (a: CordPoint, b: CordPoint): CordPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const format = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

const cubic = (
  p0: CordPoint,
  p1: CordPoint,
  p2: CordPoint,
  p3: CordPoint,
): string =>
  `M${format(p0.x)},${format(p0.y)} C${format(p1.x)},${format(p1.y)} ${format(p2.x)},${format(p2.y)} ${format(p3.x)},${format(p3.y)}`;

/**
 * 距离自适应弯度：近则接近直线，远则起拱，并在 bowSpan 之后收敛到上限。
 * 这是 perfect-arrows 的 bow/stretch 思路，但只保留产品需要的一维。
 */
export const cordBow = (
  distance: number,
  bow: number = DEFAULT_BOW,
  bowSpan: number = DEFAULT_BOW_SPAN,
): number => {
  if (bowSpan <= 0) {
    return bow;
  }
  const ratio = Math.min(1, Math.max(0, distance / bowSpan));
  return bow * ratio;
};

/** 取 box 面向 toward 的那条边的中点；用于让线从卡片边缘而不是中心出发 */
export const cordAnchor = (box: CordBox, toward: CordPoint): CordPoint => {
  const center = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  // 归一化到单位方块后比较，等价于判断射线先穿出竖边还是横边
  const horizontalDominant = halfHeight === 0
    || (halfWidth !== 0 && Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight);

  if (horizontalDominant) {
    const scale = halfWidth / Math.abs(dx);
    return { x: center.x + dx * (dx === 0 ? 0 : scale), y: center.y + dy * scale };
  }

  const scale = halfHeight / Math.abs(dy);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
};

export const cordSide = (box: CordBox, toward: CordPoint): CordSide => {
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  const horizontalDominant = halfHeight === 0
    || (halfWidth !== 0 && Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight);

  if (horizontalDominant) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
};

/**
 * 生成从 from 到 to 的三次贝塞尔，并用 De Casteljau 在 t=0.5 精确切分成两段。
 * 两段都以中点为起点，因此对它们施加同一个向外的 dash 动画即得到「光从中间淌向两端」。
 */
export const cordCurve = (
  from: CordPoint,
  to: CordPoint,
  options: CordCurveOptions = {},
): CordCurve => {
  const { bow = DEFAULT_BOW, bowSpan = DEFAULT_BOW_SPAN, mode = "horizontal" } = options;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const amount = cordBow(distance, bow, bowSpan);

  let c1: CordPoint;
  let c2: CordPoint;

  if (mode === "horizontal") {
    const offset = Math.max(amount, Math.abs(dx) / 2);
    const direction = dx >= 0 ? 1 : -1;
    c1 = { x: from.x + offset * direction, y: from.y };
    c2 = { x: to.x - offset * direction, y: to.y };
  } else {
    /*
     * radial: 控制点沿弦推进 d/3, 再向弦的法向做「反对称」偏移——起点推一侧、
     * 终点推另一侧, 于是曲线穿过弦一次, 成为有两个弯的 S 而不是单向的弓。
     *
     * 偏移量用 sway = bow · sin(2θ)。展开后 sin(2θ) = 2·dx·dy / L², 不需要三角
     * 函数, 而且这正是产品要的那条曲率律:
     *   - 水平或垂直对齐(dx=0 或 dy=0) → sway=0, 两个控制点落在弦上, 就是直线;
     *   - 四条 45° 对角线 → |sin(2θ)|=1, 弯度最大;
     *   - 其余角度按 sin 连续过渡, 越过每条轴时经由 0 换向。
     * 它是 dx/dy 的连续函数(无分段、无扇区、无 Position 枚举), 因此把一张卡片
     * 绕另一张转满 360° 得到的是连续变形, 不会出现每 90° 跳一次的切换感。
     */
    const length = distance === 0 ? 1 : distance;
    const sway = amount * ((2 * dx * dy) / (length * length));
    // 弦的法向(顺时针 90°): 让曲线先沿卡片边缘方向离开, 再拐向对面
    const nx = dy / length;
    const ny = -dx / length;
    c1 = {
      x: from.x + dx / 3 + nx * sway,
      y: from.y + dy / 3 + ny * sway,
    };
    c2 = {
      x: to.x - dx / 3 - nx * sway,
      y: to.y - dy / 3 - ny * sway,
    };
  }

  const p01 = midpoint(from, c1);
  const p12 = midpoint(c1, c2);
  const p23 = midpoint(c2, to);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const mid = midpoint(p012, p123);

  return {
    d: cubic(from, c1, c2, to),
    from,
    halves: [
      // 中点 → 起点（第一段反向，使两段同为「由中心向外」）
      cubic(mid, p012, p01, from),
      // 中点 → 终点
      cubic(mid, p123, p23, to),
    ],
    mid,
    to,
  };
};

/** 由两个矩形直接求曲线：各自取面向对方的边缘锚点 */
export const cordCurveBetween = (
  fromBox: CordBox,
  toBox: CordBox,
  options: CordCurveOptions = {},
): CordCurve => {
  const fromCenter = {
    x: fromBox.x + fromBox.width / 2,
    y: fromBox.y + fromBox.height / 2,
  };
  const toCenter = {
    x: toBox.x + toBox.width / 2,
    y: toBox.y + toBox.height / 2,
  };
  return cordCurve(
    cordAnchor(fromBox, toCenter),
    cordAnchor(toBox, fromCenter),
    options,
  );
};
