/**
 * [INPUT]: 依赖 Bun test、react-dom/server 与共享 NotePaper 原语
 * [OUTPUT]: 锁定 thumbnail/reader 共用同一纸面骨架、摘录与空正文占位、reader 承载任意正文并声明 Dialog autofocus 契约
 * [POS]: app/src/widgets 的纸张原语回归门禁；纸张视觉只有一处实现，两个 variant 的差异必须留在 CSS 而不是 DOM 结构
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { NotePaper } from "./NotePaper";

const classNames = (html: string): string[] =>
  [...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1] ?? "");

describe("NotePaper", () => {
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
