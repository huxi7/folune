/**
 * [INPUT]: 依赖 Bun test、AI SDK UIMessage part 与 deriveAgentMessagePresentation
 * [OUTPUT]: 验证过程文本/工具真实顺序、最终正文边界及纯文本回复零过程区
 * [POS]: AgentPanel 回复分区的纯函数回归测试，防止工具再次被抽离到底部或正文被错误折叠
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { deriveAgentMessagePresentation } from "./messagePresentation";

function assistant(parts: UIMessage["parts"]): UIMessage {
  return { id: "assistant-1", parts, role: "assistant" };
}

describe("deriveAgentMessagePresentation", () => {
  test("按原始顺序保留工具前过程，并把工具后的正文留在折叠区之外", () => {
    const message = assistant([
      { text: "我先看看现有内容。", type: "text" },
      {
        input: {},
        output: { nodes: [], total: 0 },
        state: "output-available",
        toolCallId: "tool-1",
        toolName: "read_tree",
        type: "dynamic-tool",
      },
      { text: "接着读取目标备忘录。", type: "text" },
      {
        input: { node_id: "private-id" },
        output: { title: "产品想法" },
        state: "output-available",
        toolCallId: "tool-2",
        toolName: "read_memo",
        type: "dynamic-tool",
      },
      { text: "已经整理好，下面是最终结果。", type: "text" },
    ]);

    const presentation = deriveAgentMessagePresentation(message);

    expect(presentation.processParts.map((part) => part.type)).toEqual([
      "text",
      "dynamic-tool",
      "text",
      "dynamic-tool",
    ]);
    expect(presentation.finalText).toBe("已经整理好，下面是最终结果。");
  });

  test("reasoning 始终属于处理过程，普通正文保持为最终回复", () => {
    const presentation = deriveAgentMessagePresentation(assistant([
      { text: "先归纳主题。", type: "reasoning" },
      { text: "这是整理后的正文。", type: "text" },
    ]));

    expect(presentation.processParts).toEqual([
      { text: "先归纳主题。", type: "reasoning" },
    ]);
    expect(presentation.finalText).toBe("这是整理后的正文。");
  });

  test("无 reasoning 和工具的普通回复不产生处理过程", () => {
    const presentation = deriveAgentMessagePresentation(assistant([
      { text: "直接回答。", type: "text" },
    ]));

    expect(presentation.processParts).toEqual([]);
    expect(presentation.finalText).toBe("直接回答。");
  });
});
