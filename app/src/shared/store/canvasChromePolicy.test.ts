/**
 * [INPUT]: 依赖 Bun test 与 canvasChromePolicy 的纯策略
 * [OUTPUT]: 逐行锁定 Canvas 侧栏状态矩阵：memo 默认与新建独立都双收起、文件树切换保持现状、直接链接恢复该画布快照，以及 <1200 覆盖式与 <1400 互斥两条断点钳制
 * [POS]: shared/store 的 Canvas 侧栏进入门禁；只验证策略，不触碰 Store、localStorage 或 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  clampCanvasChrome,
  resolveCanvasEntryChrome,
  type CanvasChromeState,
} from "./canvasChromePolicy";

const OPEN_BOTH: CanvasChromeState = { assistantOpen: true, libraryOpen: true };
const CLOSED: CanvasChromeState = { assistantOpen: false, libraryOpen: false };
const LIBRARY_ONLY: CanvasChromeState = { assistantOpen: false, libraryOpen: true };
const ASSISTANT_ONLY: CanvasChromeState = { assistantOpen: true, libraryOpen: false };

const entry = (
  overrides: Partial<Parameters<typeof resolveCanvasEntryChrome>[0]>,
): CanvasChromeState => resolveCanvasEntryChrome({
  inherited: null,
  intent: "direct",
  snapshot: null,
  viewportWidth: 1440,
  ...overrides,
});

describe("Canvas 侧栏状态矩阵", () => {
  test("从笔记进入默认 Canvas：两侧都收起，先给完整画布", () => {
    expect(entry({ intent: "memo_default" })).toEqual(CLOSED);
    // 即便这张画布上次是双开，从笔记进入也不继承
    expect(entry({
      intent: "memo_default",
      snapshot: OPEN_BOTH,
    })).toEqual(CLOSED);
  });

  test("新建独立 Canvas：同样双收起，先看到完整画布", () => {
    expect(entry({ intent: "standalone" })).toEqual(CLOSED);
    // 新画布不继承任何现状，也不去恢复别处的快照
    expect(entry({ intent: "standalone", snapshot: ASSISTANT_ONLY }))
      .toEqual(CLOSED);
    expect(entry({ inherited: OPEN_BOTH, intent: "standalone" })).toEqual(CLOSED);
  });

  test("从文件树切换已有 Canvas：桌面端逐字保持现状", () => {
    expect(entry({ inherited: LIBRARY_ONLY, intent: "tree" }))
      .toEqual(LIBRARY_ONLY);
    expect(entry({ inherited: ASSISTANT_ONLY, intent: "tree" }))
      .toEqual(ASSISTANT_ONLY);
    expect(entry({ inherited: OPEN_BOTH, intent: "tree" })).toEqual(OPEN_BOTH);
    // 没有可继承的现状时不猜测，退回双收起
    expect(entry({ intent: "tree" })).toEqual(CLOSED);
  });

  test("直接链接/刷新：恢复该画布最近状态，无记录则收起", () => {
    expect(entry({ intent: "direct", snapshot: ASSISTANT_ONLY }))
      .toEqual(ASSISTANT_ONLY);
    expect(entry({ intent: "direct", snapshot: null })).toEqual(CLOSED);
  });

  test("小视口切换：<1200 进入时先呈现完整背景", () => {
    for (const intent of ["direct", "memo_default", "standalone", "tree"] as const) {
      expect(entry({
        inherited: OPEN_BOTH,
        intent,
        snapshot: OPEN_BOTH,
        viewportWidth: 1199,
      })).toEqual(CLOSED);
    }
  });

  test("1200–1399 避免双浮层遮住大部分背景，只保留文件库", () => {
    expect(entry({
      inherited: OPEN_BOTH,
      intent: "tree",
      viewportWidth: 1399,
    })).toEqual(LIBRARY_ONLY);
    expect(entry({
      inherited: OPEN_BOTH,
      intent: "tree",
      viewportWidth: 1400,
    })).toEqual(OPEN_BOTH);
  });

  test("左右面板是两个独立布尔值，钳制不会把它们绑成一个", () => {
    expect(clampCanvasChrome(ASSISTANT_ONLY, 1200)).toEqual(ASSISTANT_ONLY);
    expect(clampCanvasChrome(LIBRARY_ONLY, 1200)).toEqual(LIBRARY_ONLY);
  });
});
