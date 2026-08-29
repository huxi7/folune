/**
 * [INPUT]: 依赖 Bun test、react-dom/server 与 MarkdownReadingView 的软换行、安全渲染及词级装饰边界
 * [OUTPUT]: 覆盖备忘录单换行、GFM、安全过滤，以及无冗余正则转义的常数尾部动画与结束态结构
 * [POS]: app/src/widgets 的 Markdown 阅读回归测试；同时锁定阅读安全、Agent 直出表现与结束无抖动边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StreamingText } from "../shared/design-system/components";
import { MarkdownReadingView } from "./MarkdownReadingView";
import { markdownExportFilename } from "./MarkdownViewMenu";

describe("Markdown reading and file boundaries", () => {
  test("renders every arrived SSE unit without a frontend reveal queue", () => {
    const content = Array.from(
      { length: 1_000 },
      (_, index) => `词${index}，`,
    ).join("");
    const html = renderToStaticMarkup(
      <StreamingText
        renderText={(arrivedText) => <p>{arrivedText}</p>}
        streaming
        text={content}
      />,
    );

    expect(html).toContain("词0，");
    expect(html).toContain("词999，");
  });

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

  test("decorates only the resolving tail while preserving Markdown", () => {
    const html = renderToStaticMarkup(
      <MarkdownReadingView
        content="先确认 **目标**"
        streamingText={{
          resolvingWordStyles: [
            { animationDelay: "-20ms" },
            { animationDelay: "-75ms" },
          ],
        }}
      />,
    );

    expect(html).toContain("<p>先<span class=\"ds-streaming-text-token\" data-resolving=\"true\" style=\"animation-delay:-75ms\">确认 </span>");
    expect(html).toContain("data-resolving=\"true\" style=\"animation-delay:-20ms\">目标</span>");
    expect(html.match(/ds-streaming-text-token/g)).toHaveLength(2);
    expect(html.match(/data-resolving="true"/g)).toHaveLength(2);
  });

  test("keeps old paragraphs native and decorates only the final block tail", () => {
    const html = renderToStaticMarkup(
      <MarkdownReadingView
        content={"第一段已经稳定。\n\n第二段刚刚出现。"}
        streamingText={{
          resolvingWordStyles: [
            { animationDelay: "-15ms" },
            { animationDelay: "-70ms" },
            { animationDelay: "-125ms" },
            { animationDelay: "-180ms" },
            { animationDelay: "-235ms" },
          ],
        }}
      />,
    );

    expect(html).toContain("<p>第一段已经稳定。</p>");
    expect(html.match(/data-resolving="true"/g)?.length).toBeLessThanOrEqual(5);
    expect(html).toContain("data-resolving=\"true\" style=\"animation-delay:-15ms\">出现。</span>");
  });

  test("keeps the resolving tail when streamed Markdown ends in code", () => {
    const html = renderToStaticMarkup(
      <MarkdownReadingView
        content={"```ts\nconst ready = true;\n```"}
        streamingText={{
          resolvingWordStyles: [{ animationDelay: "-20ms" }],
        }}
      />,
    );

    expect(html).toContain("<pre><code class=\"language-ts\"");
    expect(html.match(/ds-streaming-text-token/g)?.length).toBeGreaterThan(1);
  });

  test("returns settled Markdown to native text without animation nodes", () => {
    const html = renderToStaticMarkup(
      <MarkdownReadingView
        content="结束后不重排。"
        streamingText={{
          resolvingWordStyles: [],
        }}
      />,
    );

    expect(html).not.toContain("ds-streaming-text-token");
    expect(html).not.toContain("data-resolving");
  });

  test("uses the current title only as a safe md filename", () => {
    expect(markdownExportFilename("  路线/计划:*  ")).toBe("路线-计划--.md");
    expect(markdownExportFilename("   ")).toBe("未命名备忘录.md");
  });
});
