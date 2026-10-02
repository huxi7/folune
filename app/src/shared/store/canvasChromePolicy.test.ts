/**
 * [INPUT]: 依赖 Bun test 与 canvasChromePolicy 的纯策略
 * [OUTPUT]: 锁定文件库四种进入意图、窄屏钳制和不再接管助手的边界
 * [POS]: shared/store 的 Canvas 文件库进入门禁；助手跨场景矩阵由 workspaceChromeStore 测试承担
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { clampCanvasChrome, resolveCanvasEntryChrome } from "./canvasChromePolicy";

const OPEN = { libraryOpen: true };
const CLOSED = { libraryOpen: false };
const entry = (overrides: Partial<Parameters<typeof resolveCanvasEntryChrome>[0]>) => resolveCanvasEntryChrome({ inherited: null, intent: "direct", snapshot: null, viewportWidth: 1440, ...overrides });

describe("Canvas 文件库进入策略", () => {
  test("笔记与文件树进入继承导航时状态，历史快照不抢回旧布局", () => {
    for (const intent of ["memo_default", "tree"] as const) {
      expect(entry({ intent, inherited: OPEN, snapshot: CLOSED })).toEqual(OPEN);
      expect(entry({ intent, inherited: CLOSED, snapshot: OPEN })).toEqual(CLOSED);
    }
  });
  test("新建关闭文件库，直接链接恢复本画布快照", () => {
    expect(entry({ intent: "standalone", inherited: OPEN, snapshot: OPEN })).toEqual(CLOSED);
    expect(entry({ intent: "direct", snapshot: OPEN })).toEqual(OPEN);
    expect(entry({ intent: "direct" })).toEqual(CLOSED);
  });
  test("窄屏进入关闭文件库，桌面不因助手尺寸挤压文件库", () => {
    expect(clampCanvasChrome(OPEN, 1199)).toEqual(CLOSED);
    expect(clampCanvasChrome(OPEN, 1200)).toEqual(OPEN);
    expect(clampCanvasChrome(OPEN, 1399)).toEqual(OPEN);
  });
});
