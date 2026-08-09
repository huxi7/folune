/**
 * [INPUT]: 依赖 Bun test、AI SDK UIMessage 结构与 deriveAssistantActivity
 * [OUTPUT]: 覆盖 submitted、首 token、工具调用、工具完成续写与 completed 的互斥状态回归
 * [POS]: AgentPanel 活动语义的纯函数测试，防止 Thinking 与 Streaming/ToolCall 再次叠加
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { deriveAssistantActivity } from "./activityState";

function assistant(parts: UIMessage["parts"]): UIMessage {
  return { id: "assistant-1", parts, role: "assistant" };
}

describe("deriveAssistantActivity", () => {
  test("submitted 与尚无 assistant part 时只显示 thinking", () => {
    expect(deriveAssistantActivity("submitted")).toBe("thinking");
    expect(deriveAssistantActivity("streaming")).toBe("thinking");
  });

  test("首个正文 token 到达后立即切换为 streaming", () => {
    expect(deriveAssistantActivity("streaming", assistant([
      { text: "先", type: "text" },
    ]))).toBe("streaming");
  });

  test("活动工具 part 独占 activity", () => {
    expect(deriveAssistantActivity("streaming", assistant([
      { text: "我来读取。", type: "text" },
      {
        input: { memoId: "memo-1" },
        state: "input-available",
        toolCallId: "tool-1",
        toolName: "readMemo",
        type: "dynamic-tool",
      },
    ]))).toBe("tool");
  });

  test("工具完成后等待下一段时重新进入 thinking", () => {
    expect(deriveAssistantActivity("streaming", assistant([
      {
        input: { memoId: "memo-1" },
        output: { title: "Roadmap" },
        state: "output-available",
        toolCallId: "tool-1",
        toolName: "readMemo",
        type: "dynamic-tool",
      },
    ]))).toBe("thinking");
  });

  test("工具结果后的新正文重新由 StreamingText 接管", () => {
    expect(deriveAssistantActivity("streaming", assistant([
      {
        input: { memoId: "memo-1" },
        output: { title: "Roadmap" },
        state: "output-available",
        toolCallId: "tool-1",
        toolName: "readMemo",
        type: "dynamic-tool",
      },
      { text: "已经整理完成。", type: "text" },
    ]))).toBe("streaming");
  });

  test("ready 与 error 均移除 activity", () => {
    const message = assistant([{ text: "完成", type: "text" }]);

    expect(deriveAssistantActivity("ready", message)).toBe("none");
    expect(deriveAssistantActivity("error", message)).toBe("none");
  });
});
