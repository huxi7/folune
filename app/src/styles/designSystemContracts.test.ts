/**
 * [INPUT]: 读取 index.css、button.css、sidebar-button.css 与 workspace.css 的 Control radius、Button 共享别名、Composer 圆形例外与统一 press
 * [OUTPUT]: 锁定 12px Control、显式 9px inner、Button 不建立私有半径、Composer 继续显式使用 round，以及四处命令控件共读同一份 press 缩放并在 Reduced Motion 下归 1
 * [POS]: app/src/styles 的设计系统静态契约测试；在浏览器视觉验收之外阻止 Radius 与 press 两条公理被局部覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const indexCss = readFileSync(join(import.meta.dir, "../index.css"), "utf8");
const buttonCss = readFileSync(join(import.meta.dir, "button.css"), "utf8");
const sidebarButtonCss = readFileSync(join(import.meta.dir, "sidebar-button.css"), "utf8");
const workspaceCss = readFileSync(join(import.meta.dir, "workspace.css"), "utf8");
const commandControlCss = [buttonCss, sidebarButtonCss, workspaceCss].join("\n");

function declarationsFor(css: string, selectorFragment: string) {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => (match[1] ?? "").includes(selectorFragment))
    .map((match) => match[2] ?? "")
    .join("\n");
}

describe("Control radius 公理", () => {
  test("Control 整档为 12px，inner 冻结为显式 9px", () => {
    expect(indexCss).toContain("--radius-control: 0.75rem;");
    expect(indexCss).toContain("--radius-inner-control: 0.5625rem;");
    expect(indexCss).not.toMatch(/--radius-inner-control:\s*calc\(/);
  });

  test("Button 只引用 Control token，不建立私有数值", () => {
    expect(indexCss).toContain("--button-radius: var(--radius-control);");
    expect(declarationsFor(buttonCss, ".ds-button"))
      .toContain("border-radius: var(--button-radius)");
  });

  test("Composer 发送与停止仍是唯一显式几何圆形", () => {
    const composerAction = declarationsFor(workspaceCss, ".agent-composer-action");
    expect(composerAction).toContain("border-radius: var(--radius-pill)");
    expect(composerAction).toContain("corner-shape: round");
  });
});

describe("press 公理", () => {
  test("按下只有一个数值: 比例与时长都住在 index.css", () => {
    expect(indexCss).toContain("--press-scale: 0.98;");
    expect(indexCss).toContain("--motion-press: 70ms;");
  });

  test("命令控件不再向下掉一格, 四处共读同一个收紧比例", () => {
    /*
     * translateY 在 32px 控件上读作"掉格", 而且每个组合控件各写一遍位移量与时长,
     * 「按下是什么感觉」就有四五个答案。这条断言不允许任何一处私藏第二个数值。
     */
    expect(commandControlCss).not.toContain("translateY(1px)");
    expect(commandControlCss).not.toContain("translateY(0.0625rem)");
    expect(commandControlCss).not.toMatch(/transition-duration:\s*\d+ms/);
    expect(commandControlCss).not.toMatch(/transform:\s*scale\(0\.\d+\)/);

    for (const rule of [
      /\.ds-button:not\(:disabled\):active \{[^}]*\}/,
      /\.ds-sidebar-button:active:not\(:disabled\) \{[^}]*\}/,
      /\.edge-dock:active \{[^}]*\}/,
      /\.toolbar-icon-button:active \{[^}]*\}/,
      /\.sidebar-create-split:has\(\.sidebar-create-more:active:not\(:disabled\)\) \{[^}]*\}/,
    ]) {
      const declarations = rule.exec(commandControlCss)?.[0] ?? "";
      expect(declarations).toContain("transform: scale(var(--press-scale))");
      expect(declarations).toContain("transition-duration: var(--motion-press)");
    }
  });

  test("split 整个外壳一起缩放, 但菜单项的 active 不算按下这颗 split", () => {
    expect(workspaceCss).toContain(".sidebar-create-split:has(.sidebar-create-main:active:not(:disabled)),");
    expect(workspaceCss).not.toContain(".sidebar-create-split:has(button:active:not(:disabled))");
  });

  test("hover 永远留在原地: 只有 active 那一条碰 transform", () => {
    const hover = /\.ds-button:not\(:disabled\):hover \{[^}]*\}/.exec(buttonCss)?.[0] ?? "";
    expect(hover).not.toContain("transform");
    expect(buttonCss).toContain("transform: scale(1);");
  });

  test("Reduced Motion 只取消缩放, 颜色与阴影压缩全部保留", () => {
    // 位置也是断言的一部分: 排在 :root 之前的 @media 会被后面的 0.98 覆盖掉
    const override = /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--press-scale: 1;/.exec(indexCss);
    expect(override).not.toBeNull();
    expect(indexCss.indexOf("--press-scale: 1;")).toBeGreaterThan(indexCss.indexOf("--press-scale: 0.98;"));
  });
});
