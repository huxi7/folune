/**
 * [INPUT]: 依赖 Bun test、react-dom/server、共享 NotePaper 原语与唯一 note-paper.css 样式源
 * [OUTPUT]: 锁定 thumbnail/reader 共用同一纸面骨架、摘录与空正文占位、thumbnail 连续文字 mask + 无填色模糊层、一个身份同时命名纸壳与正文，以及 reader 的 Dialog autofocus 契约
 * [POS]: app/src/widgets 的纸张原语回归门禁；纸张视觉只有一处实现，并阻止 thumbnail 再退化成不透明横向毛玻璃色带
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { NotePaper } from "./NotePaper";

const classNames = (html: string): string[] =>
  [...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1] ?? "");

describe("NotePaper", () => {
  test("thumbnail 由文字 mask 渐隐，模糊层不填纸色横带", async () => {
    const css = await Bun.file(new URL("../styles/note-paper.css", import.meta.url)).text();

    expect(css).toContain("--thumbnail-fade-depth: 4rem");
    expect(css).toContain("rgb(0 0 0 / 72%) calc(100% - 2.15rem)");
    expect(css).toContain("background: transparent");
    expect(css).not.toContain("color-mix(in srgb, var(--paper-surface) 94%, transparent)");
  });

  test("两个 variant 共用同一纸面骨架，只有 data-variant 不同", () => {
    const thumbnail = renderToStaticMarkup(
      <NotePaper excerpt="少则得，多则惑。" title="少则得" variant="thumbnail" />,
    );
    const reader = renderToStaticMarkup(
      <NotePaper excerpt="少则得，多则惑。" title="少则得" variant="reader" />,
    );

    expect(classNames(thumbnail)).toEqual(classNames(reader));
    expect(thumbnail).toContain('data-variant="thumbnail"');
    expect(reader).toContain('data-variant="reader"');
  });

  test("空摘录退回占位段落，纸张仍然是一张纸", () => {
    const blank = renderToStaticMarkup(
      <NotePaper excerpt="   " title="未命名" variant="thumbnail" />,
    );

    expect(blank).toContain('class="note-paper-placeholder">这页还没有正文');
    expect(blank).toContain("note-paper-body");
  });

  test("children 覆盖摘录，overlay 留在纸内且不进入正文流", () => {
    const html = renderToStaticMarkup(
      <NotePaper
        excerpt="不该出现的摘录"
        overlay={<button type="button">展开</button>}
        title="标题"
        variant="reader"
      >
        <p>真实正文</p>
      </NotePaper>,
    );

    expect(html).toContain("真实正文");
    expect(html).not.toContain("不该出现的摘录");
    expect(html.indexOf("note-paper-body")).toBeLessThan(html.indexOf("<button"));
  });

  /*
   * 纸壳与纸内正文必须是两个名字。壳被拉伸看不出来(命名后代已被提出它的截图, 那张图里
   * 没有字), 字被拉伸就是"字在膨胀" —— 两端同时膨胀再叠起来正是"突然弹出来"的来源。
   * 这条规矩住在 NotePaper 而不是每个调用方: 漏一处就是一次字被拉伸的过渡。
   */
  test("一个身份同时命名纸壳与纸内正文, 不给身份就一个名字都不留", () => {
    const named = renderToStaticMarkup(
      <NotePaper
        excerpt="少则得"
        title="少则得"
        transitionIdentity="8ac0-42"
        variant="reader"
      />,
    );
    expect(named).toContain("view-transition-name:paper-8ac0-42");
    expect(named).toContain("view-transition-name:paper-body-8ac0-42");
    const plain = renderToStaticMarkup(
      <NotePaper excerpt="少则得" title="少则得" variant="reader" />,
    );
    expect(plain).not.toContain("view-transition-name");
  });

  test("autoFocus 只在需要时声明 Dialog 的初始焦点契约", () => {
    const plain = renderToStaticMarkup(
      <NotePaper title="标题" variant="reader" />,
    );
    const focused = renderToStaticMarkup(
      <NotePaper autoFocus title="标题" variant="reader" />,
    );

    expect(plain).not.toContain("data-dialog-autofocus");
    expect(focused).toContain("data-dialog-autofocus");
    expect(focused).toContain('tabindex="-1"');
  });
});
