/**
 * [INPUT]: 读取 DS motionTokenStyles、index.css、button.css、sidebar-button.css 与 workspace.css 的 Control radius、Button 共享别名、Composer 圆形例外与统一 press
 * [OUTPUT]: 检查所有生产圆角与曲线配对及菜单 Compact 分档；锁定 16px Control、显式 12px inner、Button 不建立私有半径、实体 Button 使用极轻纵向同色面光且没有 1px 全周内环、Ghost 无实体阴影、Press 收回外影、Composer 继续显式使用 round，以及四处命令控件共读同一份 press 缩放并在 Reduced Motion 下归 1、创建 split 的 hover 与 press 只认外壳那两半而不认展开的菜单项
 * [POS]: app/src/styles 的设计系统静态契约测试；在浏览器视觉验收之外阻止 Radius 与 press 两条公理被局部覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { motionTokenStyles } from "../shared/design-system/motion";
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
  test("Control 整档为 16px，inner 冻结为显式 12px", () => {
    expect(indexCss).toContain("--radius-control: 1rem;");
    expect(indexCss).toContain("--radius-inner-control: 0.75rem;");
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

describe("Button material 公理", () => {
  test("实体 Button 只使用极轻纵向同色面光, 不再画 1px 全周内环", () => {
    expect(buttonCss).toContain("background: linear-gradient(180deg, var(--button-face-top-rest), var(--button-face-bottom-rest));");
    expect(buttonCss).toContain("background: linear-gradient(180deg, var(--button-face-top-hover), var(--button-face-bottom-hover));");
    expect(buttonCss).toContain("background: linear-gradient(180deg, var(--button-face-top-active), var(--button-face-bottom-active));");
    expect(buttonCss).toContain("background: linear-gradient(180deg, var(--processing-surface-top), var(--processing-surface-bottom));");
    expect(buttonCss).not.toContain("linear-gradient(135deg");
    expect(buttonCss).not.toMatch(/inset 0 0 0 1px/);
    expect(buttonCss).not.toContain("filter: saturate(");
  });

  test("Hover 放宽中性外影, Press 只保留内压感, Ghost 始终无影", () => {
    expect(buttonCss).toContain("0 6px 14px -8px var(--button-shadow-neutral-hover)");
    expect(buttonCss).toContain("inset 0 2px 4px var(--button-press-depth)");
    expect(declarationsFor(buttonCss, ".ds-button-ghost")).toContain("--button-state-shadow: none");
    const pressedShadow = /--button-shadow-pressed:\s*([^;]+);/.exec(buttonCss)?.[1] ?? "";
    expect(pressedShadow).not.toMatch(/\n\s*0\s/);
  });

  test("按压只收紧中心, split 外壳继续消费同一面光且不保留零位移 transform", () => {
    expect(workspaceCss).not.toContain("transform: translateY(0)");
    expect(workspaceCss).toContain("background: linear-gradient(180deg, var(--button-primary-face-top-rest), var(--button-primary-face-bottom-rest));");
  });
});

describe("press 公理", () => {
  test("按下只有一个数值: 比例在 index.css，时长由 DS 单一源生成", () => {
    expect(indexCss).toContain("--press-scale: 0.98;");
    expect(motionTokenStyles).toContain("--motion-press:90ms;");
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

  test("split 整个外壳一起反馈, 但菜单项的 hover/active 都不算落在这颗 split 上", () => {
    /*
     * 两条都必须点名外壳那两半。宽 `button` 会把展开的菜单项算成这颗 split 的一部分:
     * active 那份让点「Canvas」时整颗按钮连菜单一起收紧, hover 那份让指向菜单项时亮起
     * 上面那颗新建 —— 反馈都跑到了指针根本不在的控件上。
     */
    for (const state of ["hover", "active"]) {
      expect(workspaceCss)
        .toContain(`.sidebar-create-split:has(.sidebar-create-main:${state}:not(:disabled)),`);
      expect(workspaceCss)
        .toContain(`.sidebar-create-split:has(.sidebar-create-more:${state}:not(:disabled))`);
      expect(workspaceCss).not.toContain(`.sidebar-create-split:has(button:${state}:not(:disabled))`);
    }
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


describe("平滑圆角完整性", () => {
  test("生产圆角必须与曲线同处声明，不得私算半径", () => {
    const styles = ["workspace", "design-system", "ai-message", "user-menu", "knowledge-canvas", "codemirror", "auth", "toast", "segmented-control", "button", "sidebar-button", "note-paper", "motion"];
    for (const name of styles) {
      const css = readFileSync(join(import.meta.dir, `${name}.css`), "utf8");
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim();
        const body = match[2]!;
        const radius = /border-radius:\s*([^;]+);/.exec(body)?.[1];
        if (!radius || radius === "0" || selector === ".ds-brand-tab") continue;
        expect(radius, `${name}: ${selector}`).not.toContain("calc(");
        expect(radius, `${name}: ${selector}`).toMatch(/^(inherit|50%|(?:var\(--(?:radius-[a-z-]+|button-radius|ds-radius-[a-z-]+)\)|0)(?: (?:var\(--(?:radius-[a-z-]+|button-radius|ds-radius-[a-z-]+)\)|0))*)$/);
        const curve = radius === "inherit" ? "inherit" : radius === "50%" || radius === "var(--radius-pill)" ? "round" : "var(--corner-shape-smooth)";
        expect(body, `${name}: ${selector}`).toContain(`corner-shape: ${curve};`);
      }
    }
  });
  test("固定笔记与菜单 hover 使用 Compact，外壳使用 Menu", () => {
    for (const selector of [".agent-composer-sources > span", ".agent-composer-sources button", ".note-more-menu-item", ".memo-context-menu button", ".agent-permission-menu > button"]) {
      expect(declarationsFor(workspaceCss, selector)).toContain("border-radius: var(--radius-compact)");
    }
    const menuCss = readFileSync(join(import.meta.dir, "design-system.css"), "utf8");
    expect(declarationsFor(menuCss, ".note-more-menu")).toContain("border-radius: var(--radius-menu)");
  });
});

describe("滚动条对比度", () => {
  test("只调整中性 thumb 颜色，保留既定 alpha，不引入第二套颜色轴", () => {
    expect(indexCss).toContain("--scrollbar-thumb: rgb(96 96 96 / 11%);");
    expect(indexCss).toContain("--scrollbar-thumb: rgb(190 190 190 / 13%);");
    expect(indexCss).not.toContain("--scrollbar-thumb: rgb(0 0 0 / 11%);");
    expect(indexCss).not.toContain("--scrollbar-thumb: rgb(255 255 255 / 13%);");
  });
});
