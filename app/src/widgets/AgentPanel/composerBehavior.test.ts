/**
 * [INPUT]: 依赖 Bun test 与 composerBehavior 的纯交互判定
 * [OUTPUT]: 覆盖普通 Enter、换行、组合输入、修饰键与空白提交的回归测试
 * [POS]: AgentPanel Composer 的键盘契约测试，防止中文输入与多行编辑误发送
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  canSubmitComposer,
  type ComposerKeyState,
  isComposerSubmitKey,
} from "./composerBehavior";

function enter(overrides: Partial<ComposerKeyState> = {}): ComposerKeyState {
  return {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key: "Enter",
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("isComposerSubmitKey", () => {
  test("只有普通 Enter 触发发送", () => {
    expect(isComposerSubmitKey(enter())).toBe(true);
    expect(isComposerSubmitKey(enter({ key: "a" }))).toBe(false);
  });

  test("Shift + Enter 保留为换行", () => {
    expect(isComposerSubmitKey(enter({ shiftKey: true }))).toBe(false);
  });

  test("中文输入法组词与 Safari 229 键码不会误发送", () => {
    expect(isComposerSubmitKey(enter({ isComposing: true }))).toBe(false);
    expect(isComposerSubmitKey(enter({ keyCode: 229 }))).toBe(false);
  });

  test("Ctrl、Alt、Meta 修饰键组合保持原生行为", () => {
    expect(isComposerSubmitKey(enter({ ctrlKey: true }))).toBe(false);
    expect(isComposerSubmitKey(enter({ altKey: true }))).toBe(false);
    expect(isComposerSubmitKey(enter({ metaKey: true }))).toBe(false);
  });
});

describe("canSubmitComposer", () => {
  test("只允许空闲状态下提交非空白内容", () => {
    expect(canSubmitComposer("写一条备忘录", false)).toBe(true);
    expect(canSubmitComposer(" \n\t ", false)).toBe(false);
    expect(canSubmitComposer("下一条草稿", true)).toBe(false);
  });
});
