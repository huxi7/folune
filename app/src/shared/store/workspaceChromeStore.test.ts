/**
 * [INPUT]: 依赖 Bun test、workspaceChromeStore 状态命令与 assistantGeometry 纯几何
 * [OUTPUT]: 覆盖完整默认几何、胶囊重开、旧尺寸偏好淘汰、场景切换与文件库互斥；重复打开不重置临时尺寸
 * [POS]: shared/store 的 Paper First 外壳状态回归测试，不访问 DOM、网络或真实 localStorage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolveAssistantGeometry } from "../../widgets/assistantGeometry";

import {
  migrateWorkspaceChrome,
  parseWorkspaceChrome,
  workspaceChromeStorageKey,
  useWorkspaceChromeStore,
} from "./workspaceChromeStore";

describe("WorkspaceChromeState", () => {
  test("偏好 key 按用户隔离", () => {
    expect(workspaceChromeStorageKey("user-a")).not.toBe(
      workspaceChromeStorageKey("user-b"),
    );
  });

  test("新用户首次进入默认关闭左右工具", () => {
    expect(migrateWorkspaceChrome(null, null)).toEqual({
      assistantOpen: false,
      libraryOpen: false,
    });
  });

  test("恢复版本化双开关快照", () => {
    expect(parseWorkspaceChrome(JSON.stringify({
      assistantOpen: true,
      libraryOpen: true,
      version: 1,
    }))).toEqual({ assistantOpen: true, libraryOpen: true });
  });

  test("损坏快照回退默认值，旧 AI 开关只迁移助手", () => {
    expect(migrateWorkspaceChrome("not-json", "true")).toEqual({
      assistantOpen: true,
      libraryOpen: false,
    });
    expect(migrateWorkspaceChrome("not-json", "false")).toEqual({
      assistantOpen: false,
      libraryOpen: false,
    });
  });
});

describe("跨空间助手状态", () => {
  const storage = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
      innerWidth: 1440,
      localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    } });
    useWorkspaceChromeStore.getState().hydrate("user-a");
  });
  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const state = () => useWorkspaceChromeStore.getState();

  const geometry = () => resolveAssistantGeometry({
    viewportWidth: 1440, viewportHeight: 900, panelWidth: 360,
    size: state().assistantSize, frame: state().assistantFrame,
  });
  const customFrame = { width: 600, height: 650, right: 40, bottom: 32 };

  test("拖动后两种大小切换都恢复完整默认几何", () => {
    state().openAssistant();
    state().setAssistantFrame(customFrame);
    expect(state().assistantSize).toBe("expanded");
    expect(geometry()).toMatchObject(customFrame);
    state().setAssistantSize("compact");
    expect(geometry()).toMatchObject({ width: 360, height: 520, right: 16, bottom: 16 });
    state().setAssistantFrame(customFrame);
    expect(state().assistantSize).toBe("compact");
    state().setAssistantSize("expanded");
    expect(geometry()).toMatchObject({ width: 360, height: 868, right: 16, bottom: 16 });
  });
  test("笔记胶囊重开默认全高，画布胶囊重开默认短窗", () => {
    for (const canvasId of [null, "canvas-a"]) {
      state().enterAssistantScene(canvasId);
      state().openAssistant();
      state().setAssistantSize(canvasId === null ? "compact" : "expanded");
      state().setAssistantFrame(customFrame);
      state().closeAssistant();
      expect(state().assistantFrame).toBeNull();
      state().openAssistant();
      expect(geometry()).toMatchObject({ width: 360, height: canvasId === null ? 868 : 520, right: 16, bottom: 16 });
      state().setAssistantFrame(customFrame);
      state().toggleAssistant();
      expect(state().assistantOpen).toBe(false);
      state().toggleAssistant();
      expect(geometry()).toMatchObject({ width: 360, height: canvasId === null ? 868 : 520, right: 16, bottom: 16 });
    }
  });
  test("重复打开和同场景渲染保留临时尺寸，切换场景采用默认且不自动打开", () => {
    state().openAssistant();
    state().setAssistantFrame(customFrame);
    state().openAssistant();
    state().enterAssistantScene(null);
    expect(state().assistantFrame).toEqual(customFrame);
    state().enterAssistantScene("canvas-a");
    expect(state().assistantSize).toBe("compact");
    expect(state().assistantFrame).toBeNull();
    state().setAssistantSize("expanded");
    state().setAssistantFrame(customFrame);
    state().enterAssistantScene("canvas-a");
    expect(state().assistantFrame).toEqual(customFrame);
    expect(state().assistantSize).toBe("expanded");
    state().enterAssistantScene(null);
    expect(state().assistantSize).toBe("expanded");
    expect(state().assistantFrame).toBeNull();
    state().closeAssistant();
    state().enterAssistantScene("canvas-b");
    expect(state().assistantOpen).toBe(false);
  });
  test("旧尺寸偏好被忽略，刷新与账号切换只恢复开关", () => {
    storage.set(workspaceChromeStorageKey("user-a"), JSON.stringify({
      version: 1, libraryOpen: false, assistantOpen: true,
      paperAssistantSize: "compact", paperAssistantFrame: customFrame,
    }));
    state().hydrate("user-a");
    expect(geometry()).toMatchObject({ width: 360, height: 868, right: 16, bottom: 16 });
    state().setAssistantSize("compact");
    state().setAssistantFrame(customFrame);
    state().hydrate("user-a");
    expect(state().assistantSize).toBe("expanded");
    expect(state().assistantFrame).toBeNull();
    expect(JSON.parse(storage.get(workspaceChromeStorageKey("user-a"))!)).toEqual({
      version: 1, libraryOpen: false, assistantOpen: true,
    });
    state().hydrate("user-b");
    expect(state().assistantOpen).toBe(false);
    state().hydrate("user-a");
    expect(state().assistantOpen).toBe(true);
    expect(state().assistantFrame).toBeNull();
  });
  test("窄屏文件库挤掉助手等同收起，重开恢复默认窗口", () => {
    Object.assign(window, { innerWidth: 800 });
    for (const openLibrary of [() => state().openLibrary(), () => state().toggleLibrary()]) {
      state().openAssistant();
      state().setAssistantSize("compact");
      state().setAssistantFrame(customFrame);
      openLibrary();
      expect(state().assistantOpen).toBe(false);
      expect(state().assistantFrame).toBeNull();
      state().openAssistant();
      expect(state().libraryOpen).toBe(false);
      expect(state().assistantSize).toBe("expanded");
      expect(state().assistantFrame).toBeNull();
    }
  });
  test("持久化不可用仍能打开、调整和恢复默认", () => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("blocked"); } });
    state().openAssistant();
    state().setAssistantFrame(customFrame);
    state().closeAssistant();
    state().openAssistant();
    expect(state().assistantOpen).toBe(true);
    expect(state().assistantFrame).toBeNull();
  });
});
