/**
 * [INPUT]: 依赖 Bun test 与 workspaceChromeStore 的纯解析/迁移边界
 * [OUTPUT]: 覆盖工作台偏好按用户隔离、首次双关闭、合法恢复、损坏容错及旧 AI 开关迁移
 * [POS]: shared/store 的 Paper First 外壳状态回归测试，不访问 DOM、网络或真实 localStorage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  migrateWorkspaceChrome,
  parseWorkspaceChrome,
  workspaceChromeStorageKey,
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
