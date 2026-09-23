/**
 * [INPUT]: happy-dom、真实 ElectricBorder 与记录 Canvas 绘制点的替身
 * [OUTPUT]: 验证沿传播方向追踪同一段纹理时仍发生形变，暂停时停止帧循环，以及多卡共享计算、外观隔离和首卡释放接管
 * [POS]: ElectricBorder 时间演化回归门禁；剔除平移后比较真实绘制位移，防止定向模式再次冻结噪声时间
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const browser = new Window({ url: 'http://localhost:10010' });
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let strokes = 0;
let copies = 0;
let points: Array<{ x: number; y: number }> = [];
const context = {
  scale() {}, setTransform() {}, clearRect() {}, closePath() {}, stroke() { strokes++; },
  drawImage() { copies++; },
  beginPath() { points = []; },
  moveTo(x: number, y: number) { points.push({ x, y }); },
  lineTo(x: number, y: number) { points.push({ x, y }); },
};
Object.defineProperty(browser.HTMLCanvasElement.prototype, 'getContext', { value: () => context });
Object.defineProperty(browser.HTMLElement.prototype, 'offsetWidth', { get: () => 280 });
Object.defineProperty(browser.HTMLElement.prototype, 'offsetHeight', { get: () => 360 });
const globals = {
  window: browser, document: browser.document,
  HTMLElement: browser.HTMLElement, Element: browser.Element,
  requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame: (id: number) => { frames.delete(id); },
  ResizeObserver: class { observe() {} disconnect() {} },
  IntersectionObserver: undefined,
};
let descriptors: Record<string, PropertyDescriptor | undefined>;
beforeEach(() => {
  descriptors = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  frames.clear();
  strokes = 0;
  copies = 0;
});
const { render, cleanup, act } = await import('@testing-library/react/pure');
const { default: ElectricBorder } = await import('./ElectricBorder');
afterEach(() => {
  cleanup();
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const nextFrame = (timestamp: number) => {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(timestamp)));
  return points.map((point) => ({ ...point }));
};

test('定向波纹在移动中持续变化，扣除传播距离后也不是同一张冻结纹理', () => {
  const baseline = render(<ElectricBorder chaos={0} borderRadius={16} paused flow="bottom-right-to-top-left" />);
  const base = points.map((point) => ({ ...point }));
  baseline.unmount();

  const originalNow = performance.now.bind(performance);
  const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => 1000 });
  try {
    render(<ElectricBorder speed={1} chaos={0.03} maxDisplacement={2} borderRadius={16} flow="bottom-right-to-top-left" />);
    const first = points.map((point) => ({ ...point }));
    const sampleCount = first.length - 1;
    const shift = 5;
    // 绕圆周前进 shift 个采样点，正好抵消方向映射中的 -time * 0.3。
    const deltaSeconds = shift / sampleCount * 16 / 0.3;
    const later = nextFrame(1000 + deltaSeconds * 1000);
    const differences = [0.65, 0.7, 0.75, 0.8].map((fraction) => {
      const i = Math.floor(sampleCount * fraction);
      const a = first[i]!;
      const b = later[i + shift]!;
      return Math.hypot(
        (b.x - base[i + shift]!.x) - (a.x - base[i]!.x),
        (b.y - base[i + shift]!.y) - (a.y - base[i]!.y),
      );
    });
    expect(differences.filter((difference) => difference > 0.05).length).toBeGreaterThanOrEqual(3);
  } finally {
    if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor);
    else Object.defineProperty(performance, 'now', { configurable: true, value: originalNow });
  }
});

test('暂停保留可见轮廓但不安排动画帧', () => {
  render(<ElectricBorder chaos={0.03} paused flow="bottom-right-to-top-left" />);
  expect(points.length).toBeGreaterThan(100);
  expect(frames.size).toBe(0);
});


test('50 张同规格卡片每帧只计算一份噪声，释放首张后仍连续绘制，全部释放取消 rAF', () => {
  const views = Array.from({ length: 50 }, () => render(
    <ElectricBorder chaos={0.04} maxDisplacement={2} thickness={2.75} flow="bottom-right-to-top-left" />,
  ));
  expect(frames.size).toBe(1);
  expect(strokes).toBe(1);
  expect(copies).toBe(49);
  const canvas = views[0]!.container.querySelector('canvas')!;
  expect(canvas.style.width).toBe('290px');
  expect(canvas.style.height).toBe('370px');
  nextFrame(performance.now() + 16);
  expect(strokes).toBe(2);
  expect(copies).toBe(98);
  views[0]!.unmount();
  nextFrame(performance.now() + 32);
  expect(strokes).toBe(3);
  expect(copies).toBe(146);
  views.slice(1).forEach((view) => view.unmount());
  expect(frames.size).toBe(0);
});

test('不同外观和暂停状态各自隔离，共用一个调度帧', () => {
  render(<ElectricBorder color="red" />);
  render(<ElectricBorder color="blue" />);
  render(<ElectricBorder color="red" paused />);
  expect(strokes).toBe(3);
  expect(frames.size).toBe(1);
  nextFrame(performance.now() + 16);
  expect(strokes).toBe(5);
});


test('页面隐藏停止全部帧，恢复后重建共享帧且卸载清理', () => {
  render(<ElectricBorder />);
  render(<ElectricBorder />);
  Object.defineProperty(browser.document, 'hidden', { configurable: true, value: true });
  act(() => browser.document.dispatchEvent(new browser.Event('visibilitychange')));
  expect(frames.size).toBe(0);
  Object.defineProperty(browser.document, 'hidden', { configurable: true, value: false });
  act(() => browser.document.dispatchEvent(new browser.Event('visibilitychange')));
  expect(frames.size).toBe(1);
  Reflect.deleteProperty(browser.document, 'hidden');
});
