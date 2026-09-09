/**
 * [INPUT]: 依赖 ai-message.css 的历史消息布局规则
 * [OUTPUT]: 锁定长 Chat 历史只对非末条消息启用原生 content-visibility，流式末条保持完整测量
 * [POS]: styles 的 Chat 性能契约，防止后续样式重构让长会话重新承担全量布局成本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const aiMessageCss = readFileSync(join(import.meta.dir, "ai-message.css"), "utf8");

describe("Chat history layout performance", () => {
  test("only historical turns use content visibility and the live tail stays measurable", () => {
    expect(aiMessageCss).toContain(
      ".agent-message-list > .agent-chat-turn:not(:last-child)",
    );
    expect(aiMessageCss).toContain("content-visibility: auto;");
    expect(aiMessageCss).toContain("contain-intrinsic-block-size: 6rem;");
    expect(aiMessageCss).not.toContain(".agent-message-list > .agent-chat-turn {");
  });
});
