/**
 * [INPUT]: 依赖 Bun 测试运行器、React 静态渲染、Phosphor 工具图标与 ToolCallBubble
 * [OUTPUT]: 验证工具状态控件不渲染调用详情，并锁定执行态 shimmer 与完成态灰阶结果槽
 * [POS]: design-system AI 工具消息的最小 DOM 契约测试，防止调试载荷或宽版检查器重新进入前端消息
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from "bun:test";
import { NotePencilIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolCallBubble } from "./ToolCallBubble";

describe("ToolCallBubble", () => {
  it("执行中只展示工具身份并启用 shimmer", () => {
    const html = renderToStaticMarkup(
      <ToolCallBubble
        icon={TreeStructureIcon}
        name="编辑文件树"
        state="input-available"
      />,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("ds-button-loading");
    expect(html).toContain("编辑文件树");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<pre");
  });

  it("完成后移除 shimmer 并在右侧展示结果槽", () => {
    const html = renderToStaticMarkup(
      <ToolCallBubble
        icon={NotePencilIcon}
        name="编辑备忘录"
        state="output-available"
      />,
    );

    expect(html).toContain('aria-busy="false"');
    expect(html).toContain("ds-tool-call-result");
    expect(html).not.toContain("ds-button-loading");
  });
});
