/**
 * [INPUT]: 读取 workspace.css 与 knowledge-canvas.css 的工作区布局契约
 * [OUTPUT]: 锁定左右 Panel 开合不创建侧边轨道，Paper/Canvas 始终占据唯一全屏 Stage
 * [POS]: styles 的浮层 Sidebar 回归测试；防止视觉上独立的 Panel 再次通过父网格挤压背景
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceCss = readFileSync(join(import.meta.dir, "workspace.css"), "utf8");
const canvasCss = readFileSync(join(import.meta.dir, "knowledge-canvas.css"), "utf8");

function rulesFor(css: string, selectorFragment: string) {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap((match) => {
    const selector = match[1] ?? "";
    const declarations = match[2] ?? "";
    return selector.includes(selectorFragment) ? [{ declarations, selector }] : [];
  });
}

function declarationsFor(css: string, selectorFragment: string) {
  return rulesFor(css, selectorFragment).map((rule) => rule.declarations);
}

describe("Workspace 浮层 Sidebar 布局", () => {
  test("Panel 开合只改变浮层本身，不改变父级 Stage 轨道", () => {
    const openStateTracks = rulesFor(workspaceCss, ".app-workspace").filter((rule) =>
      rule.selector.includes("[data-")
      && rule.declarations.includes("grid-template-columns"),
    );

    expect(workspaceCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(openStateTracks).toEqual([]);
  });

  test("Paper 与 Canvas 始终落在唯一全屏 Stage", () => {
    expect(declarationsFor(workspaceCss, ".paper-stage-scroll").join("\n"))
      .toContain("grid-column: 1");
    expect(declarationsFor(canvasCss, ".canvas-stage").join("\n"))
      .toContain("grid-column: 1");
  });
});
