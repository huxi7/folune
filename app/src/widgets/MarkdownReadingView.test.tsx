/**
 * [INPUT]: 依赖 Bun test、react-dom/server 与 MarkdownReadingView 的软换行及安全渲染边界
 * [OUTPUT]: 覆盖备忘录单换行、GFM 展示，以及 HTML/脚本/危险链接不会进入输出
 * [POS]: app/src/widgets 的 Markdown 阅读回归测试；验证阅读排版与禁止执行型内容两条边界同时成立
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownReadingView } from "./MarkdownReadingView";
import { markdownExportFilename } from "./MarkdownViewMenu";

describe("Markdown reading and file boundaries", () => {
  test("preserves every single newline in note reading mode", () => {
    const html = renderToStaticMarkup(
      <MarkdownReadingView
        content={"第一行\n第二行\n第三行\n\n新段落"}
        preserveSoftBreaks
      />,
    );

    expect(html.match(/<br\/>/g)).toHaveLength(2);
    expect(html).toContain("第一行<br/>\n第二行<br/>\n第三行");
    expect(html).toContain("</p>\n<p>新段落</p>");
  });

  test("renders GFM without executing raw HTML or unsafe links", () => {
    const html = renderToStaticMarkup(
      <MarkdownReadingView
        content={`# 标题

~~删除线~~

> 引用

- [x] 完成

| A | B |
|---|---|
| 1 | 2 |

\`\`\`js
alert("文本，不执行")
\`\`\`

<script>alert("危险")</script>

<img src=x onerror="alert(1)">

[危险链接](javascript:alert(1))`}
        preserveSoftBreaks
      />,
    );

    expect(html).toContain("<table>");
    expect(html).toContain("<del>删除线</del>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("alert(&quot;文本，不执行&quot;)");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  test("uses the current title only as a safe md filename", () => {
    expect(markdownExportFilename("  路线/计划:*  ")).toBe("路线-计划--.md");
    expect(markdownExportFilename("   ")).toBe("未命名备忘录.md");
  });
});
