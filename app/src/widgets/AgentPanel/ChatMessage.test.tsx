/**
 * [INPUT]: 依赖 Bun test、React 静态渲染、AI SDK UIMessage 与 ChatMessage
 * [OUTPUT]: 验证单一过程区、Composer 紧凑审批条、自动执行轻量撤销、最终正文独立、冻结来源不污染对话及普通回复无空过程入口
 * [POS]: AgentPanel 回复与审批 DOM 契约测试，连接 part 分区、非模态裁决、纯净消息展示、工具人话展示与回复动作槽位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { FoluneUIMessage } from "../../shared/api/ai";

import { ApprovalCard } from "./ApprovalCard";
import { ChatMessage, LiveAssistantTurn } from "./ChatMessage";

function assistant(parts: FoluneUIMessage["parts"]): FoluneUIMessage {
  return { id: "assistant-1", parts, role: "assistant" };
}

function user(text: string): FoluneUIMessage {
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
      <ChatMessage activity="none" message={user("你好")} onUndo={async () => undefined} />,
    );
    const assistantHtml = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        onUndo={async () => undefined}
        message={assistant([{ text: "你好。", type: "text" }])}
      />,
    );

    expect(userHtml).not.toContain("agent-message-author");
    expect(userHtml).not.toContain(">你<");
    expect(assistantHtml).not.toContain("ds-assistant-message-author");
    expect(assistantHtml).not.toContain(">备忘录助手<");
  });

  test("冻结来源保留在消息 metadata，但用户与 AI 对话都不展示引用笔记", () => {
    const sources = {
      primary: { memo_id: "memo-1", title: "产品规划", revision: 7 },
      references: [{ memo_id: "memo-2", title: "用户访谈", revision: 3 }],
    };
    const userHtml = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        message={{ ...user("对比一下"), metadata: { context_snapshot: sources } }}
        onUndo={async () => undefined}
      />,
    );
    const assistantHtml = renderToStaticMarkup(
      <ChatMessage
        activity="none"
        message={assistant([{ text: "结论。", type: "text" }])}
        onUndo={async () => undefined}
      />,
    );

    expect(userHtml).toContain("对比一下");
    expect(userHtml).not.toContain("产品规划");
    expect(userHtml).not.toContain("用户访谈");
    expect(userHtml).not.toContain("agent-message-context");
    expect(assistantHtml).toContain("结论。");
    expect(assistantHtml).not.toContain("来源");
    expect(assistantHtml).not.toContain("agent-assistant-sources");
  });

  test("审批不进入消息或模态层，Composer 使用紧凑确认条且同轮只显示一个整轮撤销", () => {
    const approvalPart = {
      approval: { id: "approval-1" },
      input: { expected_revision: 1, node_id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13", op: "delete" },
      state: "approval-requested" as const,
      toolCallId: "tool-approval",
      toolName: "edit_node",
      type: "dynamic-tool" as const,
    };
    const messageHtml = renderToStaticMarkup(
      <ChatMessage activity="none" message={assistant([approvalPart])} onUndo={async () => undefined} />,
    );
    expect(messageHtml).not.toContain('role="dialog"');
    expect(messageHtml).not.toContain('aria-label="操作确认"');

    const approvalHtml = renderToStaticMarkup(
      <ApprovalCard onApproval={() => undefined} part={approvalPart} />,
    );
    expect(approvalHtml).toContain('role="group"');
    expect(approvalHtml).toContain('aria-label="操作确认"');
    expect(approvalHtml).toContain("移入回收站");
    expect(approvalHtml).toContain("取消");
    expect(approvalHtml).toContain("移到回收站");
    expect(approvalHtml).not.toContain('role="dialog"');

    const command = {
      id: "command-1",
      operation: "edit_memo" as const,
      status: "succeeded" as const,
    };
    const successHtml = renderToStaticMarkup(
      <ChatMessage activity="none" message={assistant([
        { ...approvalPart, approval: { approved: true, id: "approval-1" }, output: command, state: "output-available" },
        { ...approvalPart, approval: { approved: true, id: "approval-2" }, output: { ...command, id: "command-2" }, state: "output-available", toolCallId: "tool-approval-2" },
      ])} onUndo={async () => undefined} />,
    );
    expect(successHtml).not.toContain('role="dialog"');
    expect(successHtml).toContain('aria-label="回复操作"');
    expect(successHtml.match(/>撤销</g)).toHaveLength(1);
  });
});
