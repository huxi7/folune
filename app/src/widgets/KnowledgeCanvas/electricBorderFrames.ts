/**
 * [INPUT]: 同尺寸/样式的 Canvas 画布、边框绘制函数与浏览器 rAF
 * [OUTPUT]: subscribeElectricBorderFrame，共享逐帧栅格结果并返回释放函数
 * [POS]: ElectricBorder 的手势期帧调度器；每个视觉规格只计算一次噪声，订阅归零即释放，不保存业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
type Surface = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  draw: (elapsed: number) => void;
};
type Group = { surfaces: Set<Surface>; started: number; animated: boolean };
const groups = new Map<string, Group>();
let frame: number | null = null;

function copy(source: Surface, target: Surface) {
  const { canvas, context } = target;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source.canvas, 0, 0);
}

function schedule() {
  if (frame === null && [...groups.values()].some((group) => group.animated)) {
    frame = requestAnimationFrame(tick);
  }
}

function tick(timestamp: number) {
  frame = null;
  for (const group of groups.values()) {
    if (!group.animated) continue;
    const [source, ...rest] = group.surfaces;
    if (!source) continue;
    source.draw(Math.max(0, timestamp - group.started));
    for (const target of rest) copy(source, target);
  }
  schedule();
}

export function subscribeElectricBorderFrame(key: string, surface: Surface, animated: boolean) {
  // 暂停与运动永不共享相位；其余身份由组件提供完整几何/颜色/波形规格。
  const identity = `${animated}:${key}`;
  let group = groups.get(identity);
  if (!group) {
    group = { surfaces: new Set(), started: performance.now(), animated };
    groups.set(identity, group);
    surface.draw(0);
  } else {
    const source = group.surfaces.values().next().value;
    if (source) copy(source, surface);
  }
  group.surfaces.add(surface);
  schedule();
  return () => {
    group.surfaces.delete(surface);
    if (group.surfaces.size === 0) groups.delete(identity);
    if (frame !== null && ![...groups.values()].some((entry) => entry.animated)) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}
