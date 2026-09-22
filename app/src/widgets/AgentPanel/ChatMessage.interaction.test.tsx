/**
 * [INPUT]: 依赖 happy-dom、Testing Library、AI SDK 消息 parts 与生产 ChatMessage/活动判定
 * [OUTPUT]: 验证思考到正文的自动收起、手动回看、工具续写重开及历史默认折叠
 * [POS]: AgentPanel 消息交互回归门禁，以真实组件重渲染覆盖同一回复的流式阶段切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { ChatStatus } from "ai";
import type { SuperNoteUIMessage } from "../../shared/api/ai";

const browserWindow = new Window();
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
});

const { cleanup, fireEvent, render } = await import("@testing-library/react");
const { ChatMessage } = await import("./ChatMessage");
const { deriveAssistantActivity } = await import("./activityState");

afterEach(cleanup);

const reasoning = { type: "reasoning", text: "先比较两种方案。", state: "streaming" } as const;
const finishedReasoning = { ...reasoning, state: "done" } as const;
const answer = { type: "text", text: "建议先做原型。", state: "streaming" } as const;
const tool = {
  type: "dynamic-tool",
  toolName: "read_tree",
  toolCallId: "tool-1",
  input: {},
  state: "input-available",
} as const;

function turn(parts: SuperNoteUIMessage["parts"], status: ChatStatus = "streaming") {
  const message: SuperNoteUIMessage = { id: "assistant-1", role: "assistant", parts };
  return <ChatMessage
    activity={deriveAssistantActivity(status, message)}
    message={message}
    onUndo={async () => undefined}
  />;
}

function expectExpanded(container: HTMLElement, expanded: boolean) {
  expect(container.querySelector(".agent-process-disclosure")?.getAttribute("data-expanded"))
    .toBe(String(expanded));
  expect(container.querySelector(".agent-process-disclosure [data-collapse]")?.getAttribute("aria-hidden"))
    .toBe(String(!expanded));
}

test("思考持续展开，首段正文到达即收起，不等待整条回复完成", () => {
  const view = render(turn([reasoning]));
  expectExpanded(view.container, true);
  expect(view.getByRole("status").textContent).toContain("正在思考");

  view.rerender(turn([{ ...reasoning, text: `${reasoning.text}再确认实现成本。` }]));
  expectExpanded(view.container, true);

  view.rerender(turn([finishedReasoning, answer]));
  expectExpanded(view.container, false);
  expect(view.getByRole("button", { name: "思考过程" }).getAttribute("aria-expanded")).toBe("false");
  expect(view.queryByRole("status")).toBeNull();
  expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe(answer.text);
});

test("正文输出中可以回看过程，后续分块与流结束不覆盖手动选择", () => {
  const view = render(turn([finishedReasoning, answer]));
  fireEvent.click(view.getByRole("button", { name: "思考过程" }));
  expectExpanded(view.container, true);

  const longerAnswer = { ...answer, text: `${answer.text}然后收集反馈。` };
  view.rerender(turn([finishedReasoning, longerAnswer]));
  expectExpanded(view.container, true);
  view.rerender(turn([finishedReasoning, { ...longerAnswer, state: "done" }], "ready"));
  expectExpanded(view.container, true);

  fireEvent.click(view.getByRole("button", { name: "思考过程" }));
  expectExpanded(view.container, false);
});

test("后续工具与思考重新展开，续写正文再次自动收起", () => {
  const view = render(turn([finishedReasoning, answer]));
  fireEvent.click(view.getByRole("button", { name: "思考过程" }));

  view.rerender(turn([finishedReasoning, answer, tool]));
  expectExpanded(view.container, true);
  expect(view.getByRole("status").textContent).toContain("正在处理");

  const completedTool = { ...tool, state: "output-available", output: { nodes: [], total: 0 } } as const;
  view.rerender(turn([finishedReasoning, answer, completedTool, reasoning]));
  expectExpanded(view.container, true);
  expect(view.getByRole("status").textContent).toContain("正在思考");

  view.rerender(turn([finishedReasoning, answer, completedTool, finishedReasoning, answer]));
  expectExpanded(view.container, false);
});

test("历史回复默认折叠，只有思考的中止或失败也会收起且保留回看", () => {
  const view = render(turn([finishedReasoning, answer], "ready"));
  expectExpanded(view.container, false);

  for (const status of ["ready", "error"] as const) {
    view.rerender(turn([reasoning]));
    expectExpanded(view.container, true);
    view.rerender(turn([finishedReasoning], status));
    expectExpanded(view.container, false);
    fireEvent.click(view.getByRole("button", { name: "思考过程" }));
    expectExpanded(view.container, true);
    expect(view.container.querySelector(".agent-process-text")?.textContent).toBe(reasoning.text);
  }
});
