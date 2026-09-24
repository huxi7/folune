/**
 * [INPUT]: 依赖 Bun test、AI SDK UIMessage 结构与 deriveAssistantActivity
 * [OUTPUT]: 覆盖整轮续写/工具间隙、空分块、当前 step 与首段正文的互斥活动回归
 * [POS]: AgentPanel 活动语义的纯函数测试，防止 Thinking 与 Streaming/ToolCall 再次叠加
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { deriveAssistantActivity, hasAssistantContinuation } from "./activityState";

function assistant(parts: UIMessage["parts"]): UIMessage {
  return { id: "assistant-1", parts, role: "assistant" };
}

describe("deriveAssistantActivity", () => {
  test("工具完成、待审批和已批准继续本轮，拒绝与最终正文不继续", () => {
    const tool = {
      type: "dynamic-tool", toolName: "read_tree", toolCallId: "read-1", input: {},
    } as const;
    for (const part of [
      { ...tool, state: "input-available" },
      { ...tool, state: "approval-requested", approval: { id: "approval-1" } },
      { ...tool, state: "approval-responded", approval: { id: "approval-1", approved: true } },
      { ...tool, state: "output-available", output: {} },
      { ...tool, state: "output-error", errorText: "读取失败" },
    ] as const) {
      expect(hasAssistantContinuation(assistant([{ type: "step-start" }, part]))).toBe(true);
    }
    for (const part of [
      { ...tool, state: "input-streaming" },
      { ...tool, state: "approval-responded", approval: { id: "approval-1", approved: false } },
      { ...tool, state: "output-denied", approval: { id: "approval-1", approved: false } },
    ] as const) {
      expect(hasAssistantContinuation(assistant([{ type: "step-start" }, part]))).toBe(false);
    }
    expect(hasAssistantContinuation(assistant([
      { ...tool, state: "output-available", output: {} },
      { type: "step-start" }, { type: "text", text: "完成" },
    ]))).toBe(false);
  });
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

  test("流已 ready 但客户端工具和续写仍在进行时，过程不能收起", () => {
    const tool = {
      type: "dynamic-tool", toolName: "read_tree", toolCallId: "read-1",
      state: "input-available", input: {},
    } as const;
    expect(deriveAssistantActivity("ready", assistant([tool]), true)).toBe("tool");
    expect(deriveAssistantActivity("ready", assistant([
      tool, { type: "text", text: "读取完成后继续。" },
    ]), true)).toBe("tool");
    expect(deriveAssistantActivity("ready", assistant([
      { ...tool, state: "output-available", output: {} },
    ]), true)).toBe("thinking");
    expect(deriveAssistantActivity("error", assistant([tool]), true)).toBe("none");
    expect(deriveAssistantActivity("ready", assistant([tool]))).toBe("none");
  });

  test("同一步有工具时，工具后过渡文字也不能冒充最终正文", () => {
    const parts: UIMessage["parts"] = [
      { type: "step-start" },
      { type: "dynamic-tool", toolName: "read_tree", toolCallId: "read-1", state: "output-available", input: {}, output: {} },
      { type: "text", text: "继续读取。", state: "streaming" },
    ];
    expect(deriveAssistantActivity("streaming", assistant(parts))).toBe("thinking");
    expect(deriveAssistantActivity("streaming", assistant([
      ...parts, { type: "step-start" }, { type: "text", text: "最终结果。", state: "streaming" },
    ]))).toBe("streaming");
  });

  test("空白 text-start 和迟到的空 reasoning 不打断正文阶段", () => {
    expect(deriveAssistantActivity("streaming", assistant([
      { type: "reasoning", text: "思考完成", state: "done" },
      { type: "text", text: "  \n", state: "streaming" },
    ]))).toBe("thinking");
    expect(deriveAssistantActivity("streaming", assistant([
      { type: "text", text: "正文", state: "streaming" },
      { type: "reasoning", text: "", state: "done" },
    ]))).toBe("streaming");
  });
});
