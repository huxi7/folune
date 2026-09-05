/**
 * [INPUT]: 读取 index.css、workspace.css 主 Paper/舞台/编辑器与 note-paper.css reader 的几何契约
 * [OUTPUT]: 锁定桌面主 Paper 由 Panel 内缩线高度反推 7:9、无宽度上限、舞台上下留白等于 inset、比例基线不参与列定宽、窄屏取消比例，且 reader 继续保持 1:√2
 * [POS]: styles 的 Paper 开本静态回归门禁；只约束几何所有权，不触碰编辑会话或 Canvas 卡片
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceCss = readFileSync(join(import.meta.dir, "workspace.css"), "utf8");
const notePaperCss = readFileSync(join(import.meta.dir, "note-paper.css"), "utf8");
const indexCss = readFileSync(join(import.meta.dir, "../index.css"), "utf8");

const firstDeclarationsFor = (css: string, selectorFragment: string): string =>
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .find((match) => (match[1] ?? "").includes(selectorFragment))?.[2] ?? "";

describe("主 Paper 开本", () => {
  test("桌面主 Paper 高度优先: 纸高来自 Panel 内缩线, 纸宽由它按 7:9 反算", () => {
    const paper = firstDeclarationsFor(workspaceCss, ".app-main-panel.paper-surface");
    const baseline = firstDeclarationsFor(workspaceCss, ".app-main-panel.paper-surface::before");
    expect(paper).toContain("--paper-opening-height: calc(100vh - 2 * var(--workspace-panel-inset))");
    expect(paper).toContain("width: min(calc(var(--paper-opening-height) * 7 / 9), 100%)");
    expect(paper).toContain('grid-template-areas: "paper"');
    expect(paper).toContain("min-height: 0");
    // 高度由重叠基线给出, 因此长文仍能把同一条 grid track 撑长
    expect(baseline).toContain("aspect-ratio: 7 / 9");
    expect(baseline).toContain("grid-area: paper");
  });

  test("宽度上限已彻底移除: 连 token 都不再存在, 没有第二条几何真相可援引", () => {
    /*
     * 留着 816px cap 的代价是较高视口重新失去底边对齐 —— 两条互相冲突的几何真相
     * 同时生效。token 只要还在, 下一个人就会"顺手"把它加回 width 里。
     */
    expect(workspaceCss).not.toContain("--paper-max-width");
    expect(indexCss).not.toContain("--paper-max-width");
  });

  test("舞台上下留白正好等于 Panel 内缩线, 短文因此完全不滚", () => {
    // padding-top + paperHeight + padding-bottom 必须恰好等于视口高
    const layout = firstDeclarationsFor(workspaceCss, ".paper-stage-layout");
    expect(layout).toContain("padding: var(--workspace-panel-inset) clamp(0.75rem, 2vw, 2rem)");
    expect(layout).not.toContain("4rem");
  });

  test("比例基线只撑高度: min-width: 0 阻止它把行高按 7/9 反算成列宽", () => {
    /*
     * grid item 的 min-width 默认是 auto, 即内容最小尺寸。这块比例盒没有内容, 但有
     * aspect-ratio: 被行高(= 正文真实高度)传递出来的宽度贡献就是 高 × 7/9。于是纸越长,
     * 唯一那条列轨道越宽 —— 3416px 高的笔记会得到 2655px 的轨道, sticky 顶栏与正文
     * 一起被推到纸面的右侧之外。缺这一条就是那个 bug 本身。
     */
    const baseline = firstDeclarationsFor(workspaceCss, ".app-main-panel.paper-surface::before");
    expect(baseline).toContain("min-width: 0");
  });

  test("编辑列不再用第二条 vh 公式撑纸，正文列宽仍为 45rem", () => {
    const editor = firstDeclarationsFor(workspaceCss, ".note-editor-canvas");
    expect(editor).toContain("width: min(100%, 45rem)");
    expect(editor).toContain("min-height: 0");
    expect(editor).not.toContain("100vh");
  });

  test("窄屏显式取消比例: 宽度交回可用视口, 高度只剩一个下限", () => {
    expect(workspaceCss).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.app-main-panel\.paper-surface \{ width: 100%; min-height: var\(--paper-opening-height\)/);
    expect(workspaceCss).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.app-main-panel\.paper-surface::before \{ display: none/);
  });

  test("写作态 CodeMirror 交还纵向滚动，长文高度进入 Paper 布局", () => {
    const codeMirrorCss = readFileSync(join(import.meta.dir, "codemirror.css"), "utf8");
    const scroller = firstDeclarationsFor(
      codeMirrorCss,
      ".note-editor-canvas .supernote-md-editor .cm-scroller",
    );
    expect(scroller).toContain("overflow: visible");
    expect(scroller).toContain("min-height: 24rem");
  });

  test("NotePaper reader 的 1:√2 与内部滚动一个字不改", () => {
    const reader = firstDeclarationsFor(notePaperCss, '.note-paper[data-variant="reader"]');
    expect(reader).toContain("/ 1.4142");
    expect(reader).toContain("* 1.4142");
    expect(firstDeclarationsFor(notePaperCss, '.note-paper[data-variant="reader"] .note-paper-column'))
      .toContain("overflow-y: auto");
  });

  test("主 Paper 阴影在 Stage inset 内收束, 不把长尾撞上 viewport 裁剪线", () => {
    expect(indexCss).toContain("0.2rem 0.7rem 1rem -0.7rem");
    expect(indexCss).toContain("0 10px 18px -12px");
    expect(indexCss).not.toContain("0.7rem 2.8rem 5.5rem -3.6rem");
    expect(indexCss).not.toContain("0 36px 80px -42px");
  });
});
