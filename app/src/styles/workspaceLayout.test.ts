/**
 * [INPUT]: 读取 workspace.css 与 knowledge-canvas.css 的工作区布局与选择反馈契约
 * [OUTPUT]: 锁定左右 Panel 开合不创建侧边轨道、Paper/Canvas 始终占据唯一全屏 Stage，以及两个选择框的不对称（外层框选框带极淡底，内层成组框只留线）
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

/*
 * 两个框的不对称是一条产品判断, 不是随手写的值: 外层框选框罩空地, 极淡一层底让
 * "里面"一眼成一整块; 内层成组框罩的是卡片和文字, 有底就等于给内容蒙纱。这条测
 * 试因此两头都锁: 谁把外层的底删了、或者谁顺手把内层的底加回来, 都会红。
 */
describe("Canvas 选择反馈", () => {
  // 定义这组 token 的那一个块; 用声明内容认它, 免得被后面每一条 .knowledge-canvas 后代规则干扰
  const root = declarationsFor(canvasCss, ".knowledge-canvas")
    .filter((declarations) => declarations.includes("--canvas-selection-line:"))
    .join("\n");
  const groupBox = declarationsFor(canvasCss, ".react-flow__nodesselection").join("\n");

  test("外层框选框有极淡底色，且底色来自品牌墨蓝而不是第三方默认蓝", () => {
    expect(root).toContain("--canvas-marquee-fill: color-mix(in srgb, var(--primary)");
    expect(root).toContain("--xy-selection-background-color: var(--canvas-marquee-fill)");
  });

  test("内层成组外接框只留线：同一个变量在它那一层改回透明", () => {
    expect(groupBox).toContain("--xy-selection-background-color: transparent");
    expect(declarationsFor(canvasCss, ".canvas-selection-bounds-rect").join("\n"))
      .not.toContain("background");
  });

  test("三条线共读同一个变量，因此两个框不可能走形", () => {
    expect(root).toContain("--xy-selection-border: var(--canvas-selection-line)");
    expect(declarationsFor(canvasCss, ".canvas-selection-bounds-rect").join("\n"))
      .toContain("border: var(--canvas-selection-line)");
  });
});
