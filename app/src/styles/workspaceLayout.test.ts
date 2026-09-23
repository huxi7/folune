/**
 * [INPUT]: 读取 workspace.css 与 knowledge-canvas.css 的工作区布局与场景中性色选择反馈契约
 * [OUTPUT]: 锁定左右 Panel 开合不创建侧边轨道、Canvas 对侧 Dock 可越过窄屏 backdrop 直接切换互斥 Panel、跨路由文件库使用固定持久宿主、Paper/Canvas 始终占据唯一全屏 Stage、容器<归档线<弹层的层序，以及两个选择框的不对称（外层框选框带极淡底，内层成组框只留线）
 * [POS]: styles 的浮层 Sidebar 回归测试；防止视觉上独立的 Panel 再次通过父网格挤压背景或被路由壳重新挂载
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

/** 精确选择器: 层序断言必须钉在那一条规则上, 不能被派生选择器的声明混进来 */
function ruleFor(css: string, selector: string): string {
  // 选择器前面常有注释块, 而注释与选择器之间没有 { } 分界, 因此先整体剥注释
  return rulesFor(css.replaceAll(/\/\*[\s\S]*?\*\//g, ""), selector)
    .filter((rule) => rule.selector.trim() === selector)
    .map((rule) => rule.declarations)
    .join("\n");
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

  test("跨路由文件库宿主固定在更高层且不依赖内容壳定位", () => {
    const persistentPanel = declarationsFor(workspaceCss, ".workspace-persistent-panel")
      .join("\n");
    expect(persistentPanel).toContain("--workspace-panel-inset: 1rem");
    expect(persistentPanel).toContain("position: fixed");
    expect(persistentPanel).toContain("z-index: 80");
  });

  test("层序是容器 < 归档线 < 弹层: 线跨两个容器, 因此必须高过它们", () => {
    const zOf = (selector: string): number => {
      const match = /z-index:\s*(\d+)/.exec(ruleFor(workspaceCss, selector));
      return match === null ? Number.NaN : Number(match[1]);
    };
    const cord = zOf(".archive-cord-overlay");
    expect(cord).toBeGreaterThan(0);
    // 归档线的两端分别住在 Paper 与文件库里, 被任一容器盖住就等于没画
    expect(cord).toBeGreaterThan(zOf(".workspace-persistent-panel"));
    expect(cord).toBeGreaterThan(zOf(".workspace-floating-panel"));
    expect(cord).toBeGreaterThan(zOf(".workspace-stage-control"));
    // 弹层仍在最上: 菜单永远压得住线
    expect(cord).toBeLessThan(zOf(".sidebar-create-menu"));
    expect(cord).toBeLessThan(zOf(".note-more-menu"));
  });

  test("侧栏三段显式排序: header/footer 的弹层压得住中间那棵树", () => {
    /*
     * 三段各带一条 fill: both 的 opacity 动画, 因此都是 z-index: auto 的层叠上下文,
     * 顺序若交给 DOM, 树会把 header 里的新建菜单整块吞掉(看起来像菜单透明)。
     */
    const header = ruleFor(workspaceCss, ".app-sidebar-header");
    const tree = ruleFor(workspaceCss, ".app-sidebar-tree");
    const footer = ruleFor(workspaceCss, ".app-sidebar-footer");
    for (const declarations of [header, tree, footer]) {
      expect(declarations).toContain("position: relative");
    }
    expect(header).toContain("z-index: 2");
    expect(footer).toContain("z-index: 2");
    expect(tree).toContain("z-index: 1");
  });

  test("Canvas 窄屏 backdrop 不吞掉对侧 Dock，标题仍留在遮罩下", () => {
    const chrome = declarationsFor(canvasCss, ".canvas-chrome").join("\n");
    const dockSlot = declarationsFor(canvasCss, ".canvas-chrome-slot").join("\n");
    const title = declarationsFor(canvasCss, ".canvas-title").join("\n");

    expect(chrome).toContain("z-index: auto");
    expect(dockSlot).toContain("z-index: 70");
    expect(title).toContain("z-index: 12");
    expect(declarationsFor(workspaceCss, ".workspace-panel-backdrop").join("\n"))
      .toContain("z-index: 50");
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

  test("外层框选框有极淡底色，优先使用场景交互色并保留旧场景回退", () => {
    expect(root).toContain("--canvas-marquee-fill: color-mix(in srgb, var(--canvas-interaction-ink, var(--primary))");
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
