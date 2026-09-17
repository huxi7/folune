/**
 * [INPUT]: 依赖 Bun test、AI SDK 工具 part 守卫、转译后导入图与 Demo 模型
 * [OUTPUT]: 验证确定性、整理保真、历史只读、工具名不越界与传递运行时依赖隔离
 * [POS]: Demo 隔离门禁，防止复用组件意外接回生产会话，也防止历史里出现没真正发生过的写操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { deriveAgentMessagePresentation } from "../AgentPanel/messagePresentation";
import {
  ARCHIVE_LABEL, createMessages, createNotes, demoExcerpt, demoTurn, demoTree,
  INITIAL_MEMO, materializeSteps, organizeNote, stepCommandId, UNFILED_TARGET,
  type DemoStep,
} from "./model";

/** 生产 chat 只暴露这四个胖笔记工具加一个庆祝动作；Demo 不得凭空发明第五个。 */
const PRODUCTION_TOOLS = new Set(["celebration", "edit_memo", "edit_node", "read_memo", "read_tree"]);
/** 读取工具是对历史唯一诚实的选择——那时什么都没被改过。 */
const READ_ONLY_TOOLS = new Set(["read_memo", "read_tree"]);

const partsOf = (steps: readonly DemoStep[]) => materializeSteps(steps, "turn");
const toolNamesOf = (parts: UIMessage["parts"]) => parts.filter(isToolUIPart).map(getToolName);
const FOLDER_IDS = new Set(["demo-life", "demo-observation", "demo-reading", "demo-projects", "demo-newsletter"]);

test("重置产生独立且确定的可读数据，树不丢节点", () => {
  const a = createNotes(), b = createNotes();
  expect(a).toEqual(b);
  expect(a[INITIAL_MEMO]).not.toBe(b[INITIAL_MEMO]);
  expect(Object.values(a).every(n => n.memo.content_mdx.length > 40)).toBe(true);
  expect(createMessages()).toHaveLength(6);
  const visited: string[] = [];
  const walk = (nodes: ReturnType<typeof demoTree>) => nodes.forEach(n => { visited.push(n.id); walk(n.children); });
  walk(demoTree(a));
  expect(new Set(visited).size).toBe(visited.length);
  expect(Object.keys(a).every(id => visited.includes(id))).toBe(true);
  // 只有一篇留在根目录，工具条的「整理笔记」才有唯一且明确的对象。
  expect(Object.values(a).filter(n => n.parent_id === null).map(n => n.id)).toEqual([INITIAL_MEMO]);
});
test("历史对话一律只读，不谎报没真正发生过的写操作", () => {
  const history = createMessages();
  const names = history.flatMap(m => toolNamesOf(m.parts));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every(name => READ_ONLY_TOOLS.has(name))).toBe(true);
  // 每条助手结论都带着过程，且都以最终正文收尾——否则芯片会孤零零挂在消息末尾。
  for (const message of history.filter(m => m.role === "assistant")) {
    const last = message.parts.at(-1);
    expect(last?.type).toBe("text");
  }
});
test("脚本用到的工具名都落在生产白名单内", () => {
  const title = "散步时，注意力回来了";
  const replies = [
    demoTurn("这篇一直堆在根目录，帮我收一下", title, null),
    demoTurn("帮我整理这篇", title, ARCHIVE_LABEL[UNFILED_TARGET]!),
    demoTurn("这几篇有什么联系", title, null),
    demoTurn("帮我总结一下", title, null),
    demoTurn("随便说点什么", title, null),
  ];
  const names = [
    ...createMessages().flatMap(m => toolNamesOf(m.parts)),
    ...replies.flatMap(steps => toolNamesOf(partsOf(steps))),
  ];
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) expect(PRODUCTION_TOOLS.has(name)).toBe(true);
});
test("归档意图真的产出写工具，且 commandId 两端口径一致", () => {
  const title = "把周末留给一条小路";
  const steps = demoTurn("这篇一直堆在根目录，帮我收一下", title, null);
  const parts = materializeSteps(steps, "d1");
  const write = parts.filter(isToolUIPart).find(part => getToolName(part) === "edit_node");
  expect(write).toBeDefined();
  const index = steps.findIndex(step => step.kind === "move_memo");
  expect(index).toBeGreaterThan(-1);
  // DemoAssistant 据同一个函数取 commandId 交给归档，两端必须指同一条命令。
  expect((write as { output?: { id?: string } }).output?.id).toBe(stepCommandId("d1", index));
  // 已经归档的笔记不再产出写工具，否则芯片会说一次不会发生的移动。
  expect(toolNamesOf(partsOf(demoTurn("帮我整理这篇", title, ARCHIVE_LABEL[UNFILED_TARGET]!)))).toEqual(["read_tree"]);
});
test("整理保留原文且幂等，模拟回复诚实说明边界", () => {
  const initial = createNotes(), organized = organizeNote(initial, INITIAL_MEMO);
  expect(organized[INITIAL_MEMO]!.parent_id).toBe(UNFILED_TARGET);
  expect(FOLDER_IDS.has(UNFILED_TARGET)).toBe(true);
  expect(organized[INITIAL_MEMO]!.memo).toEqual(initial[INITIAL_MEMO]!.memo);
  expect(initial[INITIAL_MEMO]!.parent_id).toBeNull();
  expect(organizeNote(organized, INITIAL_MEMO)).toEqual(organized);
  expect(demoTurn("这几篇有什么联系", "散步", null).at(-1)).toMatchObject({ text: expect.stringContaining("Canvas") });
  expect(demoTurn("任意问题", "散步", null).at(-1)).toMatchObject({ text: expect.stringContaining("预设示例回复") });
});
test("Demo 消息喂进生产分区器后，工具进过程区、正文留在过程区之外", () => {
  for (const message of createMessages().filter(m => m.role === "assistant")) {
    const presentation = deriveAgentMessagePresentation(message);
    expect(presentation.processParts.every(part => isToolUIPart(part))).toBe(true);
    expect(presentation.finalText.length).toBeGreaterThan(0);
    // 只读工具不带命令，历史回复因此不会长出「撤销」按钮。
    expect(presentation.undoCommands).toEqual([]);
  }
  const write = demoTurn("帮我整理一下", "把周末留给一条小路", null);
  const settled = deriveAgentMessagePresentation({ id: "a", role: "assistant", parts: materializeSteps(write, "d9") });
  expect(settled.undoCommands.map(command => command.id)).toEqual([stepCommandId("d9", write.findIndex(step => step.kind === "move_memo"))]);
});
test("缩略文案只剥标记，不改写正文", () => {
  expect(demoExcerpt("## 标题\n- [x] 一条\n**重点**")).toBe("标题\n一条\n重点");
});
test("入口传递依赖不触达业务 API、Auth、Store 或持久化", () => {
  const visited = new Set<string>();
  const check = (path: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    const transpiler = new Bun.Transpiler({ loader: extname(path).endsWith("x") ? "tsx" : "ts" });
    const js = transpiler.transformSync(readFileSync(path, "utf8"));
    expect(path).not.toMatch(/\/shared\/(api|supabase)\//);
    if (path.includes("/shared/store/")) expect(path.endsWith("/memoTree.ts")).toBe(true);
    expect(js).not.toMatch(/\b(localStorage|sessionStorage|indexedDB)\b/);
    for (const item of transpiler.scanImports(js)) {
      if (!item.path.startsWith(".")) { expect(item.path).not.toMatch(/supabase|mastra|@ai-sdk\/react/); continue; }
      const base = resolve(dirname(path), item.path);
      const next = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(p => existsSync(p) && /\.[jt]sx?$/.test(p));
      if (next) check(next);
    }
  };
  check(resolve(import.meta.dir, "main.tsx"));
  expect(visited.size).toBeGreaterThan(30);
});
