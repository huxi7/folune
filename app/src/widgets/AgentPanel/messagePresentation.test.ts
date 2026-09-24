/**
 * [INPUT]: 依赖 Bun test、AI SDK UIMessage part 与 deriveAgentMessagePresentation
 * [OUTPUT]: 验证过程文本/工具真实顺序、重复 toolCall 去重、回复末尾撤销提取、最终正文边界及纯文本回复零过程区
 * [POS]: AgentPanel 回复分区的纯函数回归测试，防止工具再次被抽离到底部或正文被错误折叠
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { isToolUIPart, type UIMessage } from "ai";

import {
  coalesceAssistantMessages,
  deriveAgentMessagePresentation,
  reverseCommandsForUndo,
} from "./messagePresentation";

function assistant(parts: UIMessage["parts"]): UIMessage {
  return { id: "assistant-1", parts, role: "assistant" };
}

describe("deriveAgentMessagePresentation", () => {
  test("把旧数据中连续 assistant 分片合成一个回复", () => {
    const result = coalesceAssistantMessages([
      { id: "user-1", parts: [{ text: "开始", type: "text" }], role: "user" },
      assistant([{ text: "第一段过程", type: "reasoning" }]),
      { ...assistant([{ text: "最终回复", type: "text" }]), id: "assistant-2" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[1]?.parts).toEqual([
      { text: "第一段过程", type: "reasoning" },
      { text: "最终回复", type: "text" },
    ]);
  });

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
    expect(presentation.undoCommands).toEqual([]);
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
    expect(presentation.undoCommands).toEqual([]);
  });

  test("工具所在步骤的过渡文字留在过程，只有新步骤正文独立展示", () => {
    const parts: UIMessage["parts"] = [
      { type: "step-start" },
      { type: "text", text: "先读取。" },
      { type: "dynamic-tool", toolName: "read_tree", toolCallId: "read-1", state: "output-available", input: {}, output: {} },
      { type: "text", text: "读取后继续分析。" },
    ];
    expect(deriveAgentMessagePresentation(assistant(parts)).finalText).toBe("");
    const result = deriveAgentMessagePresentation(assistant([
      ...parts, { type: "step-start" }, { type: "reasoning", text: "分析完成。" },
      { type: "text", text: "最终结果。" },
    ]));
    expect(result.finalText).toBe("最终结果。");
    expect(result.processParts.filter((part) => part.type === "text").map((part) => part.text))
      .toEqual(["先读取。", "读取后继续分析。"]);
  });

  test("新的 reasoning 或 step 开始后，上一段文字不残留在正文", () => {
    for (const boundary of [
      { type: "step-start" },
      { type: "reasoning", text: "继续核实。" },
    ] as const) {
      const result = deriveAgentMessagePresentation(assistant([
        { type: "text", text: "中间说明。" }, boundary,
      ]));
      expect(result.finalText).toBe("");
      expect(result.processParts[0]).toEqual({ type: "text", text: "中间说明。" });
    }
  });

  test("活动工具期间旧协议尾部文字也不与过程区争抢正文", () => {
    const result = deriveAgentMessagePresentation(assistant([
      { type: "dynamic-tool", toolName: "read_tree", toolCallId: "read-1", state: "input-available", input: {} },
      { type: "text", text: "等待读取。" },
    ]), true);
    expect(result.finalText).toBe("");
    expect(result.processParts).toHaveLength(2);
  });

  test("同一 toolCall 只展示一次，成功命令只进入回复末尾撤销区", () => {
    const command = {
      id: "command-1",
      operation: "edit_memo",
      status: "succeeded",
    };
    const presentation = deriveAgentMessagePresentation(assistant([
      { input: {}, output: command, state: "output-available", toolCallId: "tool-1", toolName: "edit_memo", type: "dynamic-tool" },
      { type: "step-start" },
      { input: {}, output: command, state: "output-available", toolCallId: "tool-1", toolName: "edit_memo", type: "dynamic-tool" },
    ]));

    expect(presentation.processParts.filter((part) => isToolUIPart(part))).toHaveLength(1);
    expect(presentation.undoCommands.map((item) => item.id)).toEqual(["command-1"]);
  });

  test("整轮撤销保留一个入口并按执行的反向顺序处理全部命令", () => {
    const commands = [
      { id: "create", operation: "create", status: "succeeded" },
      { id: "rename", operation: "rename", status: "succeeded" },
      { id: "edit", operation: "edit_memo", status: "succeeded" },
    ] as const;

    expect(reverseCommandsForUndo(commands).map((command) => command.id)).toEqual([
      "edit",
      "rename",
      "create",
    ]);
    expect(commands.map((command) => command.id)).toEqual(["create", "rename", "edit"]);
  });
});
