/**
 * [INPUT]: 依赖 happy-dom、Testing Library、AI SDK 消息 parts 与生产 ChatMessage/活动判定
 * [OUTPUT]: 验证工具间隙持续展开、正文一次收起、后续活动不重开、手动回看、新消息隔离与整轮结束才显示撤销
 * [POS]: AgentPanel 消息交互回归门禁，以真实组件重渲染覆盖同一回复的流式阶段切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { ChatStatus } from "ai";
import type { FoluneUIMessage } from "../../shared/api/ai";

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

function turn(parts: FoluneUIMessage["parts"], status: ChatStatus = "streaming", continuing = false) {
  const message: FoluneUIMessage = { id: "assistant-1", role: "assistant", parts };
  return <ChatMessage
    activity={deriveAssistantActivity(status, message, continuing)}
    message={message}
    onUndo={async () => undefined}
  />;
}

test("多轮工具的 ready 间隙保持同一展开过程区，仅最终正文到达时收起", () => {
  const view = render(turn([reasoning]));
  const disclosure = view.container.querySelector(".agent-process-disclosure");
  const completedTool = { ...tool, state: "output-available", output: {} } as const;
  const secondTool = { ...tool, toolCallId: "tool-2" };
  const firstStep = [{ type: "step-start" }, finishedReasoning, tool] as FoluneUIMessage["parts"];
  const secondStep = [
    ...firstStep.slice(0, -1), completedTool, { type: "step-start" }, reasoning, secondTool,
  ] as FoluneUIMessage["parts"];

  for (const parts of [firstStep, secondStep]) {
    for (const status of ["streaming", "ready", "submitted", "streaming"] as const) {
      view.rerender(turn(parts, status, true));
      expectExpanded(view.container, true);
      expect(view.container.querySelector(".agent-process-disclosure")).toBe(disclosure);
      expect(view.container.querySelector(".ds-streaming-text")).toBeNull();
    }
  }
  const completed = [
    ...secondStep.slice(0, -1), { ...completedTool, toolCallId: "tool-2" },
    { type: "step-start" }, finishedReasoning,
  ] as FoluneUIMessage["parts"];
  view.rerender(turn(completed, "streaming", true));
  expectExpanded(view.container, true);
  view.rerender(turn([...completed, answer]));
  expectExpanded(view.container, false);
  expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe(answer.text);
});

test("等待审批与执行期间保持展开，停止或失败后可以回看", () => {
  const approval = { ...tool, state: "approval-requested", approval: { id: "approval-1" } } as const;
  const view = render(turn([reasoning, approval], "ready", true));
  expectExpanded(view.container, true);
  view.rerender(turn([finishedReasoning, {
    ...approval, state: "approval-responded", approval: { id: "approval-1", approved: true },
  }], "ready", true));
  expectExpanded(view.container, true);
  for (const status of ["ready", "error"] as const) {
    view.rerender(turn([finishedReasoning, tool], status));
    expectExpanded(view.container, false);
    fireEvent.click(view.getByRole("button", { name: "思考过程" }));
    expectExpanded(view.container, true);
    fireEvent.click(view.getByRole("button", { name: "思考过程" }));
  }
});

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

test("正文开始后迟到的工具/思考不再自动展开，手动回看保持自主", () => {
  const view = render(turn([reasoning]));
  view.rerender(turn([finishedReasoning, answer]));
  expectExpanded(view.container, false);
  view.rerender(turn([finishedReasoning, answer, tool]));
  expectExpanded(view.container, false);
  expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe(answer.text);
  expect(view.getByRole("button", { name: "正在处理" })).not.toBeNull();

  const completedTool = { ...tool, state: "output-available", output: {} } as const;
  view.rerender(turn([finishedReasoning, answer, completedTool, reasoning]));
  expectExpanded(view.container, false);
  expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe(answer.text);
  fireEvent.click(view.getByRole("button", { name: "正在思考" }));
  expectExpanded(view.container, true);
  view.rerender(turn([finishedReasoning, answer, completedTool, finishedReasoning, answer]));
  expectExpanded(view.container, true);
});

test("新消息拥有独立展开状态，不继承上一条的折叠或撤销状态", () => {
  const view = render(turn([finishedReasoning, answer]));
  expectExpanded(view.container, false);
  view.rerender(<ChatMessage activity="thinking" message={{ id: "assistant-2", role: "assistant", parts: [reasoning] }} onUndo={async () => undefined} />);
  expectExpanded(view.container, true);
});

test("直接回复后才出现的过程区也不能自动展开或撤回已显示文字", () => {
  const view = render(turn([answer]));
  expect(view.container.querySelector(".agent-process-disclosure")).toBeNull();
  view.rerender(turn([answer, tool]));
  expectExpanded(view.container, false);
  expect(view.container.querySelector(".ds-streaming-text")?.textContent).toBe(answer.text);
});

test("历史回复默认折叠，只有思考的中止或失败也会收起且保留回看", () => {
  const view = render(turn([finishedReasoning, answer], "ready"));
  expectExpanded(view.container, false);

  for (const status of ["ready", "error"] as const) {
    view.unmount();
    const activeView = render(turn([reasoning]));
    expectExpanded(activeView.container, true);
    activeView.rerender(turn([finishedReasoning], status));
    expectExpanded(activeView.container, false);
    fireEvent.click(activeView.getByRole("button", { name: "思考过程" }));
    expectExpanded(activeView.container, true);
    expect(activeView.container.querySelector(".agent-process-text")?.textContent).toBe(reasoning.text);
    activeView.unmount();
  }
});

test("成功工具的整轮撤销只在续写与正文全部结束后出现", () => {
  const success = { ...tool, toolName: "edit_node", state: "output-available" as const,
    output: { id: "command-1", status: "succeeded", operation: "trash_node" } };
  const view = render(turn([finishedReasoning, success], "ready", true));
  expect(view.queryByRole("button", { name: "撤销" })).toBeNull();
  view.rerender(turn([finishedReasoning, success, { type: "step-start" }, answer]));
  expect(view.queryByRole("button", { name: "撤销" })).toBeNull();
  view.rerender(turn([finishedReasoning, success, { type: "step-start" }, { ...answer, state: "done" }], "ready"));
  expect(view.getByRole("button", { name: "撤销" })).toBeTruthy();
});
