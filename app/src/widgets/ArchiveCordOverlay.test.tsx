/**
 * [INPUT]: 依赖 React 服务端渲染、ArchiveCordOverlay 与 workspace.css 的 fixed Overlay 视觉契约
 * [OUTPUT]: 锁定 Overlay 不包路由、只有 visible/flow/hit 三条 path、无中心圆点与方向箭头、fresh 与 settled 两档 phase、窄屏与关闭只隐藏渲染，以及命中区不阻塞其余操作
 * [POS]: Archive Cord Overlay 结构与视觉语法回归门禁；几何数值归 archiveCordGeometry.test，真实端点跟手归 Ego Lite fixture 验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ArchiveCordOverlay } from "./ArchiveCordOverlay";
import type { WorkspaceOrganizePresentation } from "./archiveCordPolicy";

const presentation: WorkspaceOrganizePresentation = {
  memoId: "memo-1",
  origin: "fresh",
  path: "系统设计 / 形制收口",
  runId: "run-1",
  status: "succeeded",
};
const css = readFileSync(join(import.meta.dir, "../styles/workspace.css"), "utf8");
const render = (props: Parameters<typeof ArchiveCordOverlay>[0]) =>
  renderToStaticMarkup(createElement(ArchiveCordOverlay, props));

describe("ArchiveCordOverlay", () => {
  test("fixed Overlay 独立挂载，只有三条 path，且不含中心圆点或方向箭头", () => {
    const html = render({ libraryOpen: true, overlayPanels: false, presentation });
    expect(html).toContain('class="archive-cord-overlay"');
    expect(html).toContain('class="archive-cord-overlay-path"');
    expect(html).toContain('class="archive-cord-overlay-flow"');
    expect(html).toContain('class="archive-cord-overlay-hit"');
    expect(html).not.toContain("ArchiveCordStage");
    // 曲线本身已经能表达方向与落点; 圆点与箭头是在重复解释空间
    expect(html).not.toContain("archive-cord-overlay-marker");
    expect(html).not.toContain("archive-cord-overlay-direction");
    expect(html).not.toContain("<circle");
  });

  test("Overlay 全屏固定且其余区域不拦操作，只有 path hit 开启 stroke 命中", () => {
    expect(css).toContain(".archive-cord-overlay { position: fixed");
    expect(css).toContain("inset: 0");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain(".archive-cord-overlay-hit { fill: none; stroke: transparent");
    expect(css).toContain("pointer-events: stroke");
  });

  test("关闭文件库与窄屏 overlay 只隐藏渲染，不改变语义状态", () => {
    expect(render({ libraryOpen: true, overlayPanels: true, presentation }))
      .toContain('data-visible="false"');
    expect(render({ libraryOpen: false, overlayPanels: false, presentation }))
      .toContain('data-visible="false"');
    expect(render({ libraryOpen: true, overlayPanels: false, presentation }))
      .toContain('data-visible="true"');
    // 隐藏是 opacity, 不是 display: none —— 状态还在, 重开即恢复
    expect(css).toContain('.archive-cord-overlay[data-visible="false"] { opacity: 0; }');
  });

  test("首帧一律是 settled；fresh 只由新的语义结果推动，且以 CSS fill 降档而非 timer", () => {
    // 服务端首帧还没有 drawKey：任何情况下都不许以「刚刚发生」入场
    expect(render({ libraryOpen: true, overlayPanels: false, presentation }))
      .toContain('data-phase="settled"');
    expect(render({
      libraryOpen: true,
      overlayPanels: false,
      presentation: { ...presentation, origin: "restored" },
    })).toContain('data-phase="settled"');
    expect(css).toContain('.archive-cord-overlay[data-phase="fresh"] .archive-cord-overlay-path { animation: archive-cord-draw 620ms var(--ease-standard) both; }');
    expect(css).toContain("@keyframes archive-cord-flow");
  });

  test("旧的目录优先高亮、零尺寸 marker 与 organize 连线层样式已彻底移除", () => {
    expect(css).not.toContain("archive-target-marker");
    expect(css).not.toContain("organize-connection-layer");
    expect(css).not.toContain("data-organize-target");
    expect(css).not.toContain("archive-cord-stage");
  });

  test("Reduced Motion 直接呈现终态：不自绘、不流光、不过渡", () => {
    expect(css).toContain('.archive-cord-overlay[data-phase="fresh"] .archive-cord-overlay-path,\n    .archive-cord-overlay[data-phase="fresh"] .archive-cord-overlay-flow { animation: none; }');
  });
});
