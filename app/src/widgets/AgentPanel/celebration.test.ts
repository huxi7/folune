/**
 * [INPUT]: 依赖 celebration 的纯次数规划与三源构图函数
 * [OUTPUT]: 验证底边窄锥对称构图、高密度单次礼花、十次无停顿点射、明示次数保留与超大次数性能上限
 * [POS]: AgentPanel 浏览器工具的纯逻辑回归测试，不启动 DOM、Canvas 或计时器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from "bun:test";

import {
  createCelebrationBursts,
  createCelebrationPlan,
} from "./celebration";

describe("celebration planning", () => {
  it("keeps the center fixed and mirrors both edge bursts", () => {
    const [left, center, right] = createCelebrationBursts(180);

    expect(center.origin.x).toBe(0.5);
    expect(center.origin.y).toBe(1.04);
    expect(left.origin.x + right.origin.x).toBe(1);
    expect(left.origin.y).toBe(right.origin.y);
    expect(left.origin.y).toBe(1.04);
    expect(left.angle + right.angle).toBe(180);
    expect(left.drift).toBe(-right.drift);
    expect(left.spread).toBeLessThan(center.spread);
    expect(left.spread).toBe(38);
    expect(center.spread).toBe(52);
    expect(center.startVelocity).toBeGreaterThan(left.startVelocity);
    expect(left.startVelocity).toBe(62);
    expect(center.startVelocity).toBe(68);
    expect(left.particleCount).toBe(right.particleCount);
    expect(
      left.particleCount + center.particleCount + right.particleCount,
    ).toBe(180);
  });

  it("gives a single celebration enough particles to cover the viewport", () => {
    expect(createCelebrationPlan(1)).toEqual({
      particlesPerWave: 180,
      renderedWaves: 1,
      requestedCount: 1,
      waveGapMs: 0,
    });
  });

  it("plans ten requested celebrations as one continuous rapid cadence", () => {
    expect(createCelebrationPlan(10)).toEqual({
      particlesPerWave: 72,
      renderedWaves: 10,
      requestedCount: 10,
      waveGapMs: 32,
    });
  });

  it("preserves large requested counts while bounding browser work", () => {
    const plan = createCelebrationPlan(1_000);

    expect(plan.particlesPerWave).toBe(22);
    expect(plan.renderedWaves).toBe(32);
    expect(plan.requestedCount).toBe(1_000);
    expect(plan.waveGapMs * (plan.renderedWaves - 1)).toBeCloseTo(400);
  });

  it("falls back to one celebration for invalid protocol input", () => {
    expect(createCelebrationPlan(0).requestedCount).toBe(1);
    expect(createCelebrationPlan("10").requestedCount).toBe(1);
  });
});
