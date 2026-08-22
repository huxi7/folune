/**
 * [INPUT]: 依赖 Bun test、React 静态渲染与 ThinkingStatusText/SkeletonGroup/AssistantMessage
 * [OUTPUT]: 验证动态状态只暴露一个读屏播报源、隐藏 Skeleton 不宣告忙碌、助手正文不伪造具名区域
 * [POS]: design-system 的基础无障碍语义回归测试，防止视觉动画重复播报或无交互内容进入地标导航
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AssistantMessage } from "./AssistantMessage";
import { SkeletonGroup } from "./Skeleton";
import { ThinkingStatusText } from "./ThinkingStatusText";

describe("design-system accessibility semantics", () => {
  test("thinking visual copy is hidden and only one status is announced", () => {
    const html = renderToStaticMarkup(
      <ThinkingStatusText messages={["正在思考…", "正在组织回答…"]} />,
    );

    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('aria-live="polite"');
  });

  test("hidden skeleton does not keep the container busy or announce loading", () => {
    const html = renderToStaticMarkup(
      <SkeletonGroup visible={false}><span>占位</span></SkeletonGroup>,
    );

    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain('role="status"');
  });

  test("assistant copy remains ordinary content instead of a named landmark", () => {
    const html = renderToStaticMarkup(<AssistantMessage content="回答" />);

    expect(html).toStartWith('<div class="ds-assistant-message">');
    expect(html).not.toContain('aria-label="助手回复"');
    expect(html).not.toContain("<section");
  });
});
