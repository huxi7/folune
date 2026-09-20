/**
 * [INPUT]: 卡片本地宽高、设计系统曲率与单调递增时间
 * [OUTPUT]: 对外提供撕纸边轮廓采样、单向波形与闭合 SVG path
 * [POS]: CanvasManipulationBorder 的纯几何；两路从右下同点出发、在左上同点收拢，只移动边缘纹理，不移动卡片
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const BORDER_FLOW_SPEED = 32;
const SAMPLE_STEP = 2;
const END_FADE = 24;
type Point = { x: number; y: number };
type Sample = Point & { distance: number; nx: number; ny: number; envelope: number };
type Branch = Sample[];

const noise = (position: number) => {
  const index = Math.floor(position);
  const fraction = position - index;
  const smooth = fraction * fraction * (3 - 2 * fraction);
  const hash = (value: number) => {
    const raw = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return (raw - Math.floor(raw)) * 2 - 1;
  };
  return hash(index) * (1 - smooth) + hash(index + 1) * smooth;
};

export function borderTravelWave(distance: number, seconds: number) {
  // d - vt 的同一段纹理只向 d 增大的方向走；不变频、不反向、不重置相位。
  const travel = distance - seconds * BORDER_FLOW_SPEED;
  return noise(travel / 38) * 1.65 + noise(travel / 15 + 19) * 0.55
    + noise(travel / 6 + 47) * 0.2;
}

export function createBorderBranches(width: number, height: number, radius: number, squircle: boolean): Branch[] {
  const r = Math.min(radius, width / 2, height / 2);
  const power = squircle ? 0.5 : 1;
  const corner = (cx: number, cy: number, angle: number): Point => ({
    x: cx + r * Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** power,
    y: cy + r * Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** power,
  });
  const makeBranch = (upper: boolean): Branch => {
    const points: Point[] = [];
    const append = (point: Point) => {
      const previous = points.at(-1);
      if (previous) {
        const count = Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / SAMPLE_STEP);
        for (let i = 1; i < count; i++) points.push({
          x: previous.x + (point.x - previous.x) * i / count,
          y: previous.y + (point.y - previous.y) * i / count,
        });
      }
      points.push(point);
    };
    const arc = (cx: number, cy: number, from: number, to: number) => {
      for (let step = 0; step <= 24; step++) append(corner(cx, cy, from + (to - from) * step / 24));
    };
    if (upper) {
      arc(width - r, height - r, Math.PI / 4, 0);
      arc(width - r, r, 0, -Math.PI / 2);
      arc(r, r, -Math.PI / 2, -Math.PI * 3 / 4);
    } else {
      arc(width - r, height - r, Math.PI / 4, Math.PI / 2);
      arc(r, height - r, Math.PI / 2, Math.PI);
      arc(r, r, Math.PI, Math.PI * 5 / 4);
    }
    let distance = 0;
    const samples = points.map((point, index) => {
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
      const direction = upper ? 1 : -1;
      return { ...point, distance, nx: -(next.y - previous.y) / length * direction,
        ny: (next.x - previous.x) / length * direction, envelope: 0 };
    });
    return samples.map((sample) => {
      const fade = Math.min(1, sample.distance / END_FADE, (distance - sample.distance) / END_FADE);
      return { ...sample, envelope: fade * fade * (3 - 2 * fade) };
    });
  };
  return [makeBranch(true), makeBranch(false)];
}

export function manipulationBorderPath(branches: Branch[], seconds: number): string {
  const displaced = branches.map((branch) => branch.map((point) => {
    const offset = borderTravelWave(point.distance, seconds) * point.envelope;
    return `${(point.x + point.nx * offset).toFixed(2)},${(point.y + point.ny * offset).toFixed(2)}`;
  }));
  return `M${displaced[0]!.join(" L")} L${displaced[1]!.reverse().join(" L")} Z`;
}
