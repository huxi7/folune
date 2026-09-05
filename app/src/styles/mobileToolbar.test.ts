/**
 * [INPUT]: 读取 workspace.css 窄屏 Toolbar 断点规则
 * [OUTPUT]: 锁定 479px 以下收紧内边距与命令间距，避免唯一带文字的 Quiet Accent 整理溢出 Paper
 * [POS]: Paper Toolbar 移动端几何回归门禁；不改变命令语义或桌面尺寸
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "workspace.css"), "utf8");

describe("移动端 Toolbar", () => {
  test("479px 以下不再使用 48px 左右内边距，并收紧文字按钮", () => {
    expect(css).toMatch(/@media \(max-width: 479px\)[\s\S]*?\.app-main-toolbar \{ padding-inline: var\(--space-3\); \}/);
    expect(css).toContain("width: 100%; min-width: 0; box-sizing: border-box;");
    expect(css).toContain(".paper-content-transition { view-transition-class: paper-body; display: flex; width: 100%; min-width: 0;");
    expect(css).toContain(".app-main-toolbar .note-view-actions { min-width: 0; gap: var(--space-2); }");
    expect(css).toContain(".app-main-toolbar .note-view-cluster { min-width: 0; gap: var(--space-1); }");
    expect(css).toContain(".app-main-toolbar .markdown-view-menu { min-width: 0; gap: var(--space-1); }");
    // Canvas 已收成无标签图标, 需要在窄屏收紧内边距的因此只剩整理一个
    expect(css).toContain(".app-main-toolbar .note-organize-button { padding-inline: var(--space-1); }");
    expect(css).not.toContain(".app-main-toolbar .note-explore-button,");
  });
});
