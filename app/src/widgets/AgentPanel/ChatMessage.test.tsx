/**
 * [INPUT]: 依赖 Bun test、React 静态渲染、AI SDK UIMessage 与 ChatMessage
 * [OUTPUT]: 验证处理过程真实顺序、折叠边界、最终正文独立及普通回复无空过程入口
 * [POS]: AgentPanel 完整回复 DOM 契约测试，连接 part 分区、工具人话展示与 AssistantMessage 槽位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SuperNoteUIMessage } from "../../shared/api/ai";

import { ChatMessage, LiveAssistantTurn } from "./ChatMessage";

function assistant(parts: SuperNoteUIMessage["parts"]): SuperNoteUIMessage {
  return { id: "assistant-1", parts, role: "assistant" };
}

function user(text: string): SuperNoteUIMessage {
  return {
    id: "user-1",
    parts: [{ text, type: "text" }],
    role: "user",
  };
}

describe("ChatMessage", () => {
  test("过程文字与工具按真实顺序出现，最终正文位于折叠过程之后", () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        onApproval={() => undefined}
        onUndo={async () => undefined}
        message={assistant([
          { text: "先查看现有内容。", type: "text" },
          {
            input: {},
            output: { nodes: [], total: 0 },
            state: "output-available",
            toolCallId: "tool-1",
            toolName: "read_tree",
            type: "dynamic-tool",
          },
          { text: "再读取目标备忘录。", type: "text" },
          {
            input: { node_id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13" },
            output: { title: "产品想法" },
            state: "output-available",
            toolCallId: "tool-2",
            toolName: "read_memo",
            type: "dynamic-tool",
          },
          { text: "这是最终整理结果。", type: "text" },
        ])}
      />,
    );

    const firstProcess = html.indexOf("先查看现有内容。");
    const firstTool = html.indexOf("查看现有内容");
    const secondProcess = html.indexOf("再读取目标备忘录。");
    const secondTool = html.indexOf("查看「产品想法」");
    const toggle = html.indexOf("思考过程");
    const finalText = html.indexOf("这是最终整理结果。");

    expect(toggle).toBeGreaterThan(-1);
    expect(toggle).toBeLessThan(firstProcess);
    expect(firstProcess).toBeLessThan(firstTool);
    expect(firstTool).toBeLessThan(secondProcess);
    expect(secondProcess).toBeLessThan(secondTool);
    expect(secondTool).toBeLessThan(finalText);
    expect(html).not.toContain("173b31e2");
    expect(html).not.toContain("ds-assistant-message-author");
  });

  test("普通无工具回复只显示正文，不出现处理过程入口", () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        onApproval={() => undefined}
        onUndo={async () => undefined}
        message={assistant([{ text: "直接回复。", type: "text" }])}
      />,
    );

    expect(html).toContain("直接回复。");
    expect(html).not.toContain("agent-process-disclosure");
    expect(html).not.toContain("处理过程");
  });

  test("请求期和空 SSE assistant 占位复用同一等待结构", () => {
    const submittedHtml = renderToStaticMarkup(
      <LiveAssistantTurn activity="thinking" />,
    );
    const emptyAssistantHtml = renderToStaticMarkup(
      <LiveAssistantTurn
        activity="thinking"
        message={assistant([])}
      />,
    );

    expect(submittedHtml).toBe(emptyAssistantHtml);
    expect(submittedHtml).toContain("ds-thinking-indicator");
    expect(submittedHtml).not.toContain("agent-process-disclosure");
  });

  test("用户与助手回复都不重复显示身份标题", () => {
    const userHtml = renderToStaticMarkup(
      <ChatMessage activity="none" message={user("你好")} onApproval={() => undefined} onUndo={async () => undefined} />,
    );
    const assistantHtml = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        onApproval={() => undefined}
        onUndo={async () => undefined}
        message={assistant([{ text: "你好。", type: "text" }])}
      />,
    );

    expect(userHtml).not.toContain("agent-message-author");
    expect(userHtml).not.toContain(">你<");
    expect(assistantHtml).not.toContain("ds-assistant-message-author");
    expect(assistantHtml).not.toContain(">备忘录助手<");
  });

  test("用户轮次与 AI 回复都显示冻结来源和 revision", () => {
    const sources = {
      primary: { memo_id: "memo-1", title: "产品规划", revision: 7 },
      references: [{ memo_id: "memo-2", title: "用户访谈", revision: 3 }],
    };
    const userHtml = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        message={{ ...user("对比一下"), metadata: { context_snapshot: sources } }}
        onApproval={() => undefined}
        onUndo={async () => undefined}
      />,
    );
    const assistantHtml = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        message={assistant([{ text: "结论。", type: "text" }])}
        onApproval={() => undefined}
        onUndo={async () => undefined}
        sources={sources}
      />,
    );

    expect(userHtml).toContain("产品规划");
    expect(userHtml).toContain("用户访谈");
    expect(userHtml).toContain("v7");
    expect(assistantHtml).toContain("来源");
    expect(assistantHtml).toContain("@用户访谈");
    expect(assistantHtml).toContain("v3");
    expect(assistantHtml).not.toContain("memo-2");
  });
});
