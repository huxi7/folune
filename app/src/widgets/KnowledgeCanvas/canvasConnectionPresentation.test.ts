/**
 * [INPUT]: 读取 knowledge-canvas.css 的连接抓手、whole-card target、目标反馈与临时绳样式契约
 * [OUTPUT]: 锁定静止 target 零命中、会话期才开放、抓手融入底栏且拖拽隐藏，以及两档目标反馈只改轮廓不改背景/布局
 * [POS]: KnowledgeCanvas 连接直接操纵的 CSS 回归门禁；补足组件 DOM 测试无法证明的层叠与命中边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "../../styles/knowledge-canvas.css"), "utf8");

const declarationsFor = (selectorFragment: string): string =>
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => (match[1] ?? "").includes(selectorFragment))
    .map((match) => match[2] ?? "")
    .join("\n");

describe("Canvas 连接命中与反馈", () => {
  test("whole-card target 静止时零命中，只在 connectionindicator 会话开放", () => {
    expect(declarationsFor(".canvas-card-whole-target"))
      .toContain("pointer-events: none");
    expect(declarationsFor(".canvas-card-whole-target.connectionindicator"))
      .toContain("pointer-events: all");
  });

  test("抓手是底栏行尾的流内格子，不凸出卡片，但仍压在整卡 target 之上", () => {
    const handle = declarationsFor(".canvas-card-connect-handle");
    // 凸出卡片轮廓的负偏移必须彻底消失, 否则卡片右下角又多一个小凸起
    expect(handle).not.toContain("-0.55rem");
    expect(handle).toContain("position: relative");
    expect(handle).toContain("z-index: 5");
    // 曾经给它额外留过一道 8px 想表达"不同族" —— 一个 vs 两个的间距差只会被读成没对齐
    expect(handle).not.toContain("margin-left");
    // z-index 只有在它是定位元素时才生效; whole-card target 是 4, 取消区依赖这个次序
    expect(declarationsFor(".canvas-card-whole-target")).toContain("z-index: 4");
    const dragging = declarationsFor(".canvas-card-connect-handle.connectingfrom");
    expect(dragging).toContain("opacity: 0");
    expect(dragging).toContain("pointer-events: none");
  });

  test("底栏靠右收口且三个入口等距: 行内与簇内共用同一个 gap 变量", () => {
    expect(declarationsFor(".canvas-card-status")).toContain("flex: 1");
    const meta = declarationsFor(".canvas-card-meta");
    expect(meta).toContain("--canvas-card-action-gap:");
    expect(meta).toContain("gap: var(--canvas-card-action-gap)");
    // 簇内不许再写第二个数字, 否则"等距"就只是碰巧
    expect(declarationsFor(".canvas-card-actions"))
      .toContain("gap: var(--canvas-card-action-gap)");
  });

  test("临时绳沉到卡片之下, 且必须写在未分层边界才压得过 React Flow 的 1001", () => {
    const cord = declarationsFor("svg.react-flow__connectionline");
    expect(cord).toContain("z-index: 0");
    /*
     * React Flow 的 style.css 不在 cascade layer 里, @layer components 内的同名规则压不过它。
     * 未分层的规则一律零缩进(layer 内的都带两格), 所以行首即选择器就是"它在未分层区"的判据。
     */
    expect(css).toMatch(/^\.knowledge-canvas svg\.react-flow__connectionline \{/m);
  });

  test("珠子小且实心, 描边整圈长在外面, 因此压得住绕过它的三股线", () => {
    const bead = declarationsFor(".canvas-elastic-drop-cursor");
    expect(bead).toContain("fill: currentColor");
    expect(bead).toContain("stroke: var(--workspace-stage)");
    // paint-order: stroke 让白边不吃掉实心部分; 少了它珠子会被自己的描边掏空
    expect(bead).toContain("paint-order: stroke");
  });

  test("三股透明度由深到淡单调, 与 strandSpeeds 同序", () => {
    const alpha = [0, 1, 2].map((index) => {
      const match = /opacity:\s*([\d.]+)/.exec(
        declarationsFor(`.canvas-elastic-connection-strand[data-strand="${index}"]`),
      );
      return match === null ? Number.NaN : Number(match[1]);
    });
    expect(alpha[0]).toBeGreaterThan(alpha[1]!);
    expect(alpha[1]).toBeGreaterThan(alpha[2]!);
  });

  test("两档目标反馈都只改变轮廓/外环，不改变背景或布局", () => {
    const target = declarationsFor('[data-connection-target="valid"]');
    expect(target).toContain("border-color:");
    expect(target).toContain("0 0 0 1px");
    expect(target).not.toContain("background:");
    expect(target).not.toContain("transform:");
    /*
     * 指针正下方那一张: 判据与提交同源(React Flow 自己写的 connectingto/valid)。
     * 两档的差别只能落在那条 1px 细边的对比度上 —— 宪法 10.3 只允许"1px 细边 + 极淡外环",
     * 因此外环仍是 1px, 不许靠加粗外环或上底色把这一档喊出来。
     */
    const hovered = declarationsFor(".canvas-card-whole-target.connectingto.valid");
    expect(hovered).toContain("var(--primary) 78%");
    expect(target).toContain("var(--primary) 46%");
    expect(hovered).toContain("0 0 0 1px");
    expect(hovered).not.toContain("0 0 0 2px");
    expect(hovered).not.toContain("transform:");
  });

  test("临时绳与 drop cursor 不接收指针，无效态只换语义色", () => {
    expect(declarationsFor(".canvas-elastic-connection-line"))
      .toContain("pointer-events: none");
    expect(declarationsFor('[data-status="invalid"]'))
      .toContain("color: var(--destructive)");
  });
});
