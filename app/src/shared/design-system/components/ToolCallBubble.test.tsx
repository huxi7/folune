/**
 * [INPUT]: 依赖 Bun 测试运行器、React 静态渲染、共享 Lucide 图标与 ToolCallBubble
 * [OUTPUT]: 验证工具执行态、完成态、可访问折叠详情及中断后停止 shimmer
 * [POS]: design-system AI 工具披露控件的最小 DOM 契约测试，禁止原始 JSON/调试面板进入消息
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from "bun:test";
import { NotePencilIcon, TreeStructureIcon } from "../icons";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolCallBubble } from "./ToolCallBubble";

describe("ToolCallBubble", () => {
  it("执行中保留轻量 shimmer，并提供人话详情入口", () => {
    const html = renderToStaticMarkup(
      <ToolCallBubble
        details={[{ label: "目标", value: "「产品想法」" }]}
        icon={TreeStructureIcon}
        name="更新「产品想法」"
        state="input-available"
      />,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("ds-button-loading");
    expect(html).toContain("更新「产品想法」");
    expect(html).toContain("目标");
    expect(html).not.toContain("ds-tool-call-caret");
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("<details");
  });

  it("完成后移除 shimmer、展示结果图标并保留轻量详情", () => {
    const html = renderToStaticMarkup(
      <ToolCallBubble
        details={[
          { label: "目标", value: "「订阅页说明」" },
          { label: "结果", value: "正文修改已保存。" },
        ]}
        icon={NotePencilIcon}
        name="更新「订阅页说明」"
        state="output-available"
      />,
    );

    expect(html).toContain('aria-busy="false"');
    expect(html).toContain("ds-tool-call-result");
    expect(html).toContain("正文修改已保存。");
    expect(html).not.toContain("ds-button-loading");
  });

  it("回复停止后未完成工具不再继续播放执行动画", () => {
    const html = renderToStaticMarkup(
      <ToolCallBubble
        icon={TreeStructureIcon}
        live={false}
        name="调整位置"
        state="input-available"
      />,
    );

    expect(html).toContain("未完成");
    expect(html).toContain("ds-tool-call-result");
    expect(html).not.toContain("ds-button-loading");
  });
});
