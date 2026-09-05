/**
 * [INPUT]: 依赖 Bun test 与 archiveCordGeometry 的纯锚点/曲线/插值
 * [OUTPUT]: 锁定 Paper-facing 边缘锚点、跨越 tree 安全边缘时的连续钳制、单帧位移有界、极端矩形无 NaN 与端点插值可重入
 * [POS]: Archive Cord 几何回归门禁；不启动 DOM、Observer、React 或 Motion
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  ARCHIVE_CORD_TREE_INSET,
  archiveCordAnchors,
  archiveCordGeometry,
  lerpArchiveAnchor,
} from "./archiveCordGeometry";

/** 文件库在左、Paper 在右：source 在 x≈775，代表行在 x∈[40,240] */
const sourceRect = { bottom: 220, left: 700, right: 850, top: 100 };
const treeRect = { bottom: 680, left: 24, right: 264, top: 40 };
const rowAt = (top: number) => ({ bottom: top + 32, left: 40, right: 240, top });

const anchorsAt = (top: number) => archiveCordAnchors({
  sourceRect,
  targetRect: rowAt(top),
  treeRect,
});

describe("archiveCord anchors", () => {
  test("两端都取面向对方的竖边中点，不取行中心", () => {
    const anchors = anchorsAt(468);
    // 代表行的右边缘（朝 Paper 那侧），不是 (left+right)/2 = 140
    expect(anchors?.targetAnchor).toEqual({ x: 240, y: 484 });
    // source 的左边缘（朝文件库那侧），不是 775
    expect(anchors?.sourceAnchor).toEqual({ x: 700, y: 160 });
    expect(anchors?.projection).toBe("anchored");
  });

  test("文件库在右时锚点自动换边，几何不写死左右", () => {
    const anchors = archiveCordAnchors({
      sourceRect: { bottom: 220, left: 200, right: 350, top: 100 },
      targetRect: { bottom: 500, left: 900, right: 1100, top: 468 },
      treeRect: { bottom: 680, left: 880, right: 1120, top: 40 },
    });
    expect(anchors?.targetAnchor.x).toBe(900);
    expect(anchors?.sourceAnchor.x).toBe(350);
  });

  test("越过安全边缘后连续贴边，并只由 projection 报出方向", () => {
    const safeTop = treeRect.top + ARCHIVE_CORD_TREE_INSET;
    const safeBottom = treeRect.bottom - ARCHIVE_CORD_TREE_INSET;
    expect(anchorsAt(-200)).toMatchObject({
      projection: "above",
      targetAnchor: { x: 240, y: safeTop },
    });
    expect(anchorsAt(900)).toMatchObject({
      projection: "below",
      targetAnchor: { x: 240, y: safeBottom },
    });
    // 贴边后 x 仍在同一条 Paper-facing rail 上：横向不随纵向滚动改变
    expect(anchorsAt(-200)?.targetAnchor.x).toBe(anchorsAt(468)?.targetAnchor.x);
  });

  test("可见 → 贴边 → 离屏是一个 clamp 的连续过程，逐像素滚动无跳变", () => {
    let previous = anchorsAt(-400)?.targetAnchor.y ?? 0;
    let maxStep = 0;
    // 每次「滚动」1px 行位置，端点位移必须有界（阈值切换会在某一帧跳几百像素）
    for (let top = -399; top <= 900; top += 1) {
      const current = anchorsAt(top)?.targetAnchor.y ?? 0;
      maxStep = Math.max(maxStep, Math.abs(current - previous));
      previous = current;
    }
    expect(maxStep).toBeLessThanOrEqual(1);
  });

  test("没有 tree clip 就没有可钳制的东西，端点直接咬住行", () => {
    expect(archiveCordAnchors({
      sourceRect,
      targetRect: rowAt(-200),
      treeRect: null,
    })).toMatchObject({ projection: "anchored", targetAnchor: { x: 240, y: -184 } });
  });

  test("非有限矩形不产出几何，绝不把 NaN 写进 path", () => {
    expect(archiveCordAnchors({
      sourceRect: { bottom: Number.NaN, left: 0, right: 0, top: 0 },
      targetRect: rowAt(100),
      treeRect,
    })).toBeNull();
  });
});

describe("archiveCordGeometry", () => {
  test("正常、极短、重合与离屏都给出有限曲线", () => {
    const cases = [
      { sourceRect, targetRect: rowAt(468), treeRect },
      { sourceRect, targetRect: rowAt(160), treeRect },
      { sourceRect, targetRect: sourceRect, treeRect },
      { sourceRect, targetRect: rowAt(-900), treeRect },
      { sourceRect, targetRect: rowAt(4000), treeRect },
      {
        sourceRect,
        targetRect: rowAt(468),
        // 极窄 clip：安全区反转，clamp 必须退化到中点而不是产生 NaN
        treeRect: { bottom: 410, left: 24, right: 264, top: 400 },
      },
    ];
    cases.forEach((input) => {
      const geometry = archiveCordGeometry(input);
      expect(geometry).not.toBeNull();
      expect(geometry?.curve.d).not.toContain("NaN");
      expect(geometry?.curve.d).not.toContain("Infinity");
      expect(Number.isFinite(geometry?.targetAnchor.y ?? Number.NaN)).toBe(true);
    });
  });
});

describe("lerpArchiveAnchor", () => {
  test("代表迁移在两端之间插值，且从当前点续算即可重入", () => {
    const from = { x: 240, y: 500 };
    const to = { x: 240, y: 300 };
    expect(lerpArchiveAnchor(from, to, 0)).toEqual(from);
    expect(lerpArchiveAnchor(from, to, 1)).toEqual(to);
    expect(lerpArchiveAnchor(from, to, 0.5)).toEqual({ x: 240, y: 400 });
    // 途中再次换代表：以当前插值点为新起点，不回到旧起点
    const midway = lerpArchiveAnchor(from, to, 0.5);
    expect(lerpArchiveAnchor(midway, { x: 240, y: 200 }, 0)).toEqual(midway);
    // 越界的进度被夹住，不产生过冲
    expect(lerpArchiveAnchor(from, to, -1)).toEqual(from);
    expect(lerpArchiveAnchor(from, to, 4)).toEqual(to);
  });
});
