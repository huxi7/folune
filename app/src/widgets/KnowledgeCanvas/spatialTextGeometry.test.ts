/**
 * [INPUT]: 依赖 spatialTextGeometry 的纯几何函数
 * [OUTPUT]: 覆盖自由文字边界、四角等比缩放与缩放上限的确定性回归测试
 * [POS]: KnowledgeCanvas 的空间文字几何单测；锁定字体/行高与选择边界共享同一持久 scale 的数学不变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  CANVAS_TEXT_MAX_SCALE,
  CANVAS_TEXT_MIN_SCALE,
  normalizeTextGeometry,
  resizedTextScale,
  scaleTextGeometry,
  textBaseGeometry,
} from "./spatialTextGeometry";

describe("空间文字几何", () => {
  test("等比缩放同步改变内容边界且保持基准尺寸", () => {
    const scaled = scaleTextGeometry({ height: 72, width: 240 }, 1.75);

    expect(scaled).toMatchObject({ height: 126, scale: 1.75, width: 420 });
    expect(textBaseGeometry(scaled)).toEqual({ height: 72, width: 240 });
  });

  test("角点拖动从持久宽度推导同一个字体缩放比例", () => {
    expect(resizedTextScale(240, 1.25, 360)).toBe(1.875);
  });

  test("对象缩放可越过旧四倍上限且不改变内容基准尺寸", () => {
    const scaled = scaleTextGeometry({ height: 31, width: 135 }, 6);

    expect(scaled).toEqual({ height: 186, scale: 6, width: 810 });
    expect(textBaseGeometry(scaled)).toEqual({ height: 31, width: 135 });
  });

  test("异常值和越界缩放被收口到协议范围", () => {
    expect(normalizeTextGeometry({ height: 0, scale: 0, width: 0 }))
      .toMatchObject({ height: 24, scale: CANVAS_TEXT_MIN_SCALE, width: 20 });
    expect(normalizeTextGeometry({
      height: Number.POSITIVE_INFINITY,
      scale: 10,
      width: Number.NaN,
    })).toMatchObject({ scale: CANVAS_TEXT_MAX_SCALE });
  });
});
