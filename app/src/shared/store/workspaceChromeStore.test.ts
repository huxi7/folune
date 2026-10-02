/**
 * [INPUT]: 依赖 Bun test 与 workspaceChromeStore 的纯解析/迁移边界
 * [OUTPUT]: 覆盖偏好隔离/迁移与助手跨场景尺寸、主动关闭、返回恢复、持久化降级
 * [POS]: shared/store 的 Paper First 外壳状态回归测试，不访问 DOM、网络或真实 localStorage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

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

  test("笔记展开进入画布收短，回来恢复笔记尺寸；同场景重渲染不覆盖主动放大", () => {
    state().openAssistant();
    state().enterAssistantScene("canvas-a");
    expect(state().assistantOpen).toBe(true);
    expect(state().assistantSize).toBe("compact");
    state().setAssistantSize("expanded");
    state().enterAssistantScene("canvas-a");
    expect(state().assistantSize).toBe("expanded");
    state().enterAssistantScene(null);
    expect(state().assistantSize).toBe("expanded");
    state().enterAssistantScene("canvas-a");
    expect(state().assistantSize).toBe("compact");
  });
  test("主动关闭跨场景保持胶囊，画布点击重新打开默认短窗", () => {
    state().openAssistant();
    state().enterAssistantScene("canvas-a");
    state().setAssistantSize("expanded");
    state().closeAssistant();
    state().enterAssistantScene(null);
    expect(state().assistantOpen).toBe(false);
    state().enterAssistantScene("canvas-a");
    state().openAssistant();
    expect(state().assistantSize).toBe("compact");
  });
  test("明确原文返回可恢复全高；画布尺寸不污染笔记偏好，账号切换隔离", () => {
    state().setAssistantSize("compact");
    state().openAssistant();
    state().enterAssistantScene("canvas-a");
    state().setAssistantSize("expanded");
    state().enterAssistantScene(null);
    expect(state().assistantSize).toBe("compact");
    state().enterAssistantScene("canvas-a", "expanded");
    expect(state().assistantSize).toBe("expanded");
    state().hydrate("user-b");
    expect(state().assistantOpen).toBe(false);
    expect(state().paperAssistantSize).toBe("expanded");
    state().hydrate("user-a");
    expect(state().assistantOpen).toBe(true);
    expect(state().paperAssistantSize).toBe("compact");
  });
  test("窄屏与文件库沿用互斥，持久化失败不阻止内存开合", () => {
    Object.assign(window, { innerWidth: 800 });
    state().openLibrary();
    state().openAssistant();
    expect(state().libraryOpen).toBe(false);
    state().openLibrary();
    expect(state().assistantOpen).toBe(false);
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("blocked"); } });
    state().openAssistant();
    expect(state().assistantOpen).toBe(true);
  });
  test("自定义窗口收起/全高还原与刷新都保留，普通画布进入不照抄笔记高度", () => {
    const frame = { height: 610, right: 40, bottom: 32 };
    state().setAssistantFrame(frame);
    state().openAssistant();
    state().setAssistantSize("expanded");
    state().setAssistantSize("compact");
    expect(state().assistantFrame).toEqual(frame);
    state().closeAssistant();
    state().openAssistant();
    expect(state().assistantFrame).toEqual(frame);
    state().enterAssistantScene("canvas-a");
    expect(state().assistantFrame).toBeNull();
    state().setAssistantFrame({ height: 500, right: 16, bottom: 16 });
    state().enterAssistantScene(null);
    expect(state().assistantFrame).toEqual(frame);
    state().hydrate("user-a");
    expect(state().assistantFrame).toEqual(frame);
  });
});
