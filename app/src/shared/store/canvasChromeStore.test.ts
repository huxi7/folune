/**
 * [INPUT]: 依赖 Bun test、内存 localStorage 替身与 canvasChromeStore
 * [OUTPUT]: 覆盖进入意图一次性生效、解析结果幂等（StrictMode 双渲染同答案）、每画布快照按用户持久化与损坏快照容错
 * [POS]: shared/store 的 Canvas 侧栏状态所有者回归测试；只验证状态所有权与持久化，矩阵语义归 canvasChromePolicy.test
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { beforeEach, describe, expect, test } from "bun:test";

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  },
});

const { canvasChromeStorageKey, parseCanvasChrome, useCanvasChromeStore } =
  await import("./canvasChromeStore");

beforeEach(() => {
  store.clear();
  useCanvasChromeStore.getState().reset();
});

describe("canvasChromeStore", () => {
  test("快照 key 按用户隔离", () => {
    expect(canvasChromeStorageKey("user-a"))
      .not.toBe(canvasChromeStorageKey("user-b"));
  });

  test("进入意图只生效一次，解析结果对重复调用幂等", () => {
    const state = () => useCanvasChromeStore.getState();
    state().hydrate("user-1");
    state().rememberEntry({ canvasId: "canvas-1", intent: "standalone" });

    const first = state().entryChrome("canvas-1", 1440);
    const second = state().entryChrome("canvas-1", 1440);

    expect(first).toEqual({ assistantOpen: false, libraryOpen: true });
    // StrictMode 会把初始化跑两遍：第二次不得退化成 direct
    expect(second).toEqual(first);
    expect(state().pendingEntry).toBeNull();
  });

  test("切到另一张画布重新解析，不复用上一张的答案", () => {
    const state = () => useCanvasChromeStore.getState();
    state().hydrate("user-1");
    state().rememberEntry({ canvasId: "canvas-1", intent: "standalone" });
    expect(state().entryChrome("canvas-1", 1440).libraryOpen).toBe(true);

    expect(state().entryChrome("canvas-2", 1440)).toEqual({
      assistantOpen: false,
      libraryOpen: false,
    });
  });

  test("每画布最近状态持久化，刷新后 direct 进入恢复它", () => {
    const state = () => useCanvasChromeStore.getState();
    state().hydrate("user-1");
    state().remember("canvas-1", { assistantOpen: true, libraryOpen: false });
    state().remember("canvas-2", { assistantOpen: false, libraryOpen: true });

    const persisted = store.get(canvasChromeStorageKey("user-1")) ?? null;
    expect(parseCanvasChrome(persisted)?.snapshots["canvas-1"]).toEqual({
      assistantOpen: true,
      libraryOpen: false,
    });

    // 模拟刷新：重置内存后重新 hydrate
    useCanvasChromeStore.getState().reset();
    state().hydrate("user-1");
    expect(state().entryChrome("canvas-1", 1440)).toEqual({
      assistantOpen: true,
      libraryOpen: false,
    });
    useCanvasChromeStore.getState().reset();
    state().hydrate("user-1");
    expect(state().entryChrome("canvas-2", 1440)).toEqual({
      assistantOpen: false,
      libraryOpen: true,
    });
  });

  test("另一个用户读不到上一个用户的快照", () => {
    const state = () => useCanvasChromeStore.getState();
    state().hydrate("user-1");
    state().remember("canvas-1", { assistantOpen: true, libraryOpen: true });
    state().hydrate("user-2");

    expect(state().snapshots).toEqual({});
    expect(state().entryChrome("canvas-1", 1440)).toEqual({
      assistantOpen: false,
      libraryOpen: false,
    });
  });

  test("损坏或旧版本快照当作没有记录", () => {
    expect(parseCanvasChrome(null)).toBeNull();
    expect(parseCanvasChrome("not-json")).toBeNull();
    expect(parseCanvasChrome(JSON.stringify({ snapshots: {}, version: 0 })))
      .toBeNull();
    expect(parseCanvasChrome(JSON.stringify({
      order: ["canvas-1", "ghost"],
      snapshots: { "canvas-1": { assistantOpen: true, libraryOpen: false } },
      version: 1,
    }))).toEqual({
      order: ["canvas-1"],
      snapshots: { "canvas-1": { assistantOpen: true, libraryOpen: false } },
    });
  });
});
