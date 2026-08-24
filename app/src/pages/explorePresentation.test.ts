/**
 * [INPUT]: 依赖 Bun test 与 explorePresentation 的 exploreCloseness/planExploreStage 纯决策
 * [OUTPUT]: 覆盖置信度窄带拉开、半径严格由亲疏决定、卡片不出视口、等待期与结果期共享同一纸张缩放、窄窗口判为不可行
 * [POS]: app/src/pages 的探索态排布回归测试；它守的是产品命题本身——距离必须承载相关度，因此「防重叠篡改半径」在这里是失败而不是妥协
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  EXPLORE_PENDING_SLOTS,
  exploreCloseness,
  explorePendingItems,
  planExploreStage,
  shouldRenderExploreStars,
  type ExploreStageItem,
} from "./explorePresentation";

/** 一张典型 1440×900 桌面上的纸：816 宽、min-height calc(100vh - 5rem)、上方 2rem 舞台留白 */
const desktop = {
  paper: { height: 820, width: 816, x: 312, y: 32 },
  viewport: { height: 900, width: 1440 },
};

const itemsOf = (confidences: readonly number[]): ExploreStageItem[] =>
  exploreCloseness(confidences).map((closeness, index) => ({
    closeness,
    id: `c${index}`,
  }));

describe("exploreCloseness", () => {
  test("真实置信度挤在 0.75~0.95 时仍铺开六成以上量程，顺序不变", () => {
    const closeness = exploreCloseness([0.95, 0.9, 0.85, 0.8, 0.75]);
    expect(closeness[0]!).toBeCloseTo(0.9775, 4);
    expect(closeness[4]!).toBeCloseTo(0.3375, 4);
    for (let index = 1; index < closeness.length; index += 1) {
      expect(closeness[index]!).toBeLessThan(closeness[index - 1]!);
    }
    expect(closeness[0]! - closeness[4]!).toBeGreaterThan(0.6);
  });

  test("置信度并列时名次阶梯仍然分得开——模型很常给同一个数", () => {
    const closeness = exploreCloseness([0.9, 0.9, 0.9]);
    expect(closeness[0]!).toBeGreaterThan(closeness[1]!);
    expect(closeness[1]!).toBeGreaterThan(closeness[2]!);
  });

  test("整体弱的一组离得比整体强的一组更远，绝对值不被名次抹掉", () => {
    const strong = exploreCloseness([0.95, 0.9]);
    const weak = exploreCloseness([0.5, 0.45]);
    expect(strong[0]!).toBeGreaterThan(weak[0]!);
    expect(strong[1]!).toBeGreaterThan(weak[1]!);
  });

  test("名次按置信度而非入参顺序，且不越出 0~1", () => {
    const closeness = exploreCloseness([0.3, 0.9]);
    expect(closeness[1]!).toBeGreaterThan(closeness[0]!);
    for (const value of exploreCloseness([1, 0, 0.5])) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("planExploreStage", () => {
  test("桌面五条: 可行，且到舞台中心的距离严格随亲疏递增", () => {
    const plan = planExploreStage({
      items: itemsOf([0.95, 0.9, 0.85, 0.8, 0.75]),
      ...desktop,
    });

    expect(plan.viable).toBe(true);
    expect(plan.slots).toHaveLength(5);

    const radii = plan.slots.map((slot) => slot.distance);
    for (let index = 1; index < radii.length; index += 1) {
      expect(radii[index]!).toBeGreaterThan(radii[index - 1]!);
    }
    // slots 按亲疏降序，因此 order 0 必须是最相关也最近的那张
    expect(plan.slots[0]!.order).toBe(0);
    expect(radii[radii.length - 1]! - radii[0]!).toBeGreaterThanOrEqual(64);
  });

  test("全部卡片留在视口内，左右两侧都用上", () => {
    const plan = planExploreStage({
      items: itemsOf([0.95, 0.88, 0.8, 0.72, 0.6]),
      ...desktop,
    });

    for (const slot of plan.slots) {
      expect(slot.cordTo.x).toBeGreaterThanOrEqual(24);
      expect(slot.cordTo.y).toBeGreaterThanOrEqual(24);
      expect(slot.cordTo.x + plan.card.width)
        .toBeLessThanOrEqual(desktop.viewport.width - 24);
      expect(slot.cordTo.y + plan.card.height)
        .toBeLessThanOrEqual(desktop.viewport.height - 24);
    }
    expect(new Set(plan.slots.map((slot) => slot.side)))
      .toEqual(new Set(["left", "right"]));
  });

  test("卡片彼此不压、也不压退后的纸——排不开就该换缩放，而不是硬叠", () => {
    const plan = planExploreStage({
      items: itemsOf([0.95, 0.92, 0.9, 0.88, 0.86]),
      ...desktop,
    });
    expect(plan.viable).toBe(true);

    const boxes = plan.slots.map((slot) => slot.cordTo);
    const hits = (left: typeof boxes[number], right: typeof boxes[number]) =>
      left.x < right.x + right.width
        && right.x < left.x + left.width
        && left.y < right.y + right.height
        && right.y < left.y + left.height;

    boxes.forEach((box, index) => {
      for (const other of boxes.slice(index + 1)) {
        expect(hits(box, other)).toBe(false);
      }
      expect(hits(box, plan.slots[0]!.cordFrom)).toBe(false);
    });
  });

  test("纸张退后可读: 缩放不低于 0.52，横向平移把纸移到视口正中", () => {
    const plan = planExploreStage({
      items: itemsOf([0.9, 0.7, 0.5]),
      ...desktop,
    });

    expect(plan.paper.scale).toBeGreaterThanOrEqual(0.52);
    expect(plan.paper.scale).toBeLessThanOrEqual(0.78);
    // 纸中心 312+408=720 已在视口正中，故不需要平移
    expect(plan.paper.translateX).toBe(0);
    // 纵向靠 transform-origin 钉住当前视口中心所对的那一段正文
    expect(plan.paper.originY).toBe(900 / 2 - 32);
  });

  test("文件库打开导致纸偏左时，退后同时把纸移回视口正中", () => {
    const plan = planExploreStage({
      items: itemsOf([0.9, 0.7]),
      paper: { height: 820, width: 816, x: 480, y: 32 },
      viewport: desktop.viewport,
    });
    expect(plan.paper.translateX).toBe(720 - (480 + 408));
  });

  test("等待期骨架与结果期实卡共享同一纸张缩放——纸不得因结果条数再缩一次", () => {
    const pending = planExploreStage({
      items: explorePendingItems(EXPLORE_PENDING_SLOTS),
      ...desktop,
    });
    const ready = planExploreStage({
      items: itemsOf([0.95, 0.9, 0.85, 0.8, 0.75]),
      ...desktop,
    });

    expect(pending.paper).toEqual(ready.paper);
    expect(pending.hub.x).toBe(ready.hub.x);
    expect(pending.card.width).toBe(ready.card.width);
    expect(pending.slots).toHaveLength(EXPLORE_PENDING_SLOTS);
  });

  test("理由注文与卡片是同一个单元: 注文的位置和高度都进了避让预算", () => {
    const plan = planExploreStage({
      items: itemsOf([0.95, 0.9, 0.85, 0.8, 0.75]),
      ...desktop,
    });

    for (const slot of plan.slots) {
      const unitBottom = slot.cordTo.y + plan.card.height
        + plan.reason.gap + plan.reason.height;
      expect(unitBottom).toBeLessThanOrEqual(desktop.viewport.height - 24);
      expect(slot.cordTo.y).toBeGreaterThanOrEqual(24);
    }
  });

  test("窄窗口排不开时判为不可行，交给静态清单兜底而不是硬塞", () => {
    const plan = planExploreStage({
      items: itemsOf([0.9, 0.8, 0.7, 0.6, 0.5]),
      paper: { height: 700, width: 816, x: 12, y: 32 },
      viewport: { height: 700, width: 840 },
    });
    expect(plan.viable).toBe(false);
  });

  test("零候选不抛错，返回空槽位", () => {
    const plan = planExploreStage({ items: [], ...desktop });
    expect(plan.slots).toEqual([]);
  });
});

describe("shouldRenderExploreStars", () => {
  test("reduced-motion 与排不开都改走静态清单，量好之前不抢先渲染", () => {
    const plan = planExploreStage({ items: itemsOf([0.9, 0.7, 0.5]), ...desktop });
    expect(shouldRenderExploreStars({ plan, reducedMotion: false })).toBe(true);
    expect(shouldRenderExploreStars({ plan, reducedMotion: true })).toBe(false);
    expect(shouldRenderExploreStars({ plan: null, reducedMotion: false })).toBe(false);
    expect(shouldRenderExploreStars({
      plan: { ...plan, viable: false },
      reducedMotion: false,
    })).toBe(false);
  });
});
