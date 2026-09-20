/**
 * [INPUT]: Bun test 与 electricBorderFlow 的上游周长坐标映射
 * [OUTPUT]: 验证指定角点、两路传播方向、纹理不反向、轮廓闭合及位移软上限
 * [POS]: ElectricBorder 方向修正门禁，不替代浏览器观感验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from 'bun:test';
import { electricBorderFlow, limitElectricBorderOffset } from './electricBorderFlow';

const width = 280;
const height = 360;
const radius = 16;
const horizontal = width - 2 * radius;
const vertical = height - 2 * radius;
const arc = Math.PI * radius / 2;
const perimeter = 2 * (horizontal + vertical) + 4 * arc;
const source = (horizontal + vertical + 1.5 * arc) / perimeter;
const target = 1 - arc / 2 / perimeter;
const sample = (progress: number, time = 0) => electricBorderFlow(progress, width, height, radius, time);

test('细碎毛边原样保留，所有方向的大位移都被限制在 2px 内且不翻向', () => {
  expect(limitElectricBorderOffset(0.6, 0.8, 2)).toEqual({ x: 0.6, y: 0.8 });
  for (const angle of [0, 0.4, 1.2, 2.7, 4, 5.9]) {
    let previous = 0;
    for (const magnitude of [0.5, 1, 1.01, 1.5, 2, 4, 10, 100]) {
      const x = Math.cos(angle) * magnitude;
      const y = Math.sin(angle) * magnitude;
      const offset = limitElectricBorderOffset(x, y, 2);
      const bounded = Math.hypot(offset.x, offset.y);
      expect(bounded).toBeLessThanOrEqual(2 + Number.EPSILON * 2);
      expect(bounded).toBeGreaterThanOrEqual(previous);
      expect(offset.x * y - offset.y * x).toBeCloseTo(0, 10);
      expect(offset.x * x + offset.y * y).toBeGreaterThan(0);
      previous = bounded;
    }
  }
});

test('限幅接点没有硬折线，禁用上限时保留上游位移', () => {
  const epsilon = 0.001;
  const before = limitElectricBorderOffset(1 - epsilon, 0, 2).x;
  const after = limitElectricBorderOffset(1 + epsilon, 0, 2).x;
  expect((1 - before) / epsilon).toBeCloseTo((after - 1) / epsilon, 5);
  expect(limitElectricBorderOffset(3, -4, Infinity)).toEqual({ x: 3, y: -4 });
  expect(limitElectricBorderOffset(3, -4, 0)).toEqual({ x: 0, y: 0 });
});

test('起点严格位于右下角，左上角收束且两端归零', () => {
  expect(sample(source).position).toBeCloseTo(0, 10);
  expect(sample(target).position).toBeCloseTo(8, 10);
  expect(sample(source).envelope).toBeCloseTo(0, 10);
  expect(sample(target).envelope).toBeCloseTo(0, 10);
});

test('从右下向左右两路走，噪声坐标都单调增加并同步', () => {
  let previous = -1;
  for (let step = 0; step <= 20; step++) {
    const clockwise = sample(source + step / 40);
    const counterclockwise = sample(source - step / 40);
    expect(clockwise.position).toBeGreaterThan(previous);
    expect(clockwise.position).toBeCloseTo(counterclockwise.position, 10);
    previous = clockwise.position;
  }
});

test('空间采样坐标只向前推进，不往返，闭合接缝同值', () => {
  for (const time of [0, 0.4, 6, 100]) {
    const delta = 0.2;
    const distanceStep = delta * 0.3 / 8 / 2;
    expect(sample(source + 0.2 + distanceStep, time + delta).position)
      .toBeCloseTo(sample(source + 0.2, time).position, 10);
    expect(sample(source - 0.2 - distanceStep, time + delta).position)
      .toBeCloseTo(sample(source - 0.2, time).position, 10);
    expect(sample(0, time).position).toBeCloseTo(sample(1, time).position, 10);
    expect(sample(0, time).envelope).toBeCloseTo(sample(1, time).envelope, 10);
  }
});
