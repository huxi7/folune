/**
 * [INPUT]: 仅依赖 memo/AI 的类型契约
 * [OUTPUT]: 对外提供确定性笔记、文件树、归档落点标签、带真实工具调用的对话脚本与模拟回复step 列表
 * [POS]: Landing Demo 的唯一内容源；不导入运行时业务代码，整理只改变父目录，内容主线为「散步 → 注意力 → 写作」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { MemoDetailNode, MemoTreeNode } from "../../shared/api/memo";
import type { SuperNoteUIMessage } from "../../shared/api/ai";

const DATE = "2026-09-15T08:00:00.000Z";
export const INITIAL_MEMO = "demo-walk";
const base = (id: string, title: string, parent: string | null, kind: "folder" | "memo" | "canvas"): MemoTreeNode => ({
  id, title, parent_id: parent, node_type: kind, user_id: "demo-linjian", sort_order: id,
  icon: null, color: null, metadata: {}, revision: 1, deleted_at: null, deleted_root_id: null,
  created_at: DATE, updated_at: DATE, children: [], memo: null,
});
const note = (id: string, title: string, parent: string | null, content: string): MemoDetailNode => ({
  ...base(id, title, parent, "memo"), children: [], memo: {
    node_id: id, user_id: "demo-linjian", content_mdx: content, excerpt: content,
    word_count: content.length, metadata: {}, created_at: DATE, updated_at: DATE,
  },
});
export const createNotes = (): Record<string, MemoDetailNode> => Object.fromEntries([
  note(INITIAL_MEMO, "把周末留给一条小路", null, "周六不排景点，只沿河边走，走到哪儿算哪儿。\n\n带：一本小册子、一支笔、水、薄外套。\n\n想留意三件事：\n- 桥洞里的回声，走近和走远有什么不同\n- 树影落在水面上，风停的那几秒是什么样\n- 那些平时赶路会错过的小店，门口都摆了什么\n\n回来只写记得最清楚的三段。先感受，再记录。"),
  note("demo-attention", "散步时，注意力回来了", "demo-observation", "走路时不听播客，前十分钟很无聊，手总想去摸手机。\n\n过了十分钟，路边的东西开始有名字：哪家在炸鱼，哪棵树上有鸟，谁家的收音机在放戏。\n\n我原来以为注意力是需要训练的，要练专注、练心流。那天发现它更像是被让出来的——不是加一件事，是撤掉一件事。手机在口袋里，就够了。\n\n下次出门前留一个问题，回来只记一句答案。看看一个月后会不会攒出什么。"),
  note("demo-writing", "写作不必从开头开始", "demo-reading", "读到一个说法：写不下去，往往不是没话可说，是坚持按顺序说。\n\n## 试一次\n1. 先写最想写的那一段，不管它排第几\n2. 回头找它的开头，常常就是它的起因\n3. 删掉解释过多的一句——那句通常是你在替读者不放心\n\n一篇短文能留下一个清楚的感受，就够了。"),
  note("demo-letter", "九月通讯 · 慢一点也没关系", "demo-newsletter", "## 这一期\n想写「记录不是为了保存信息，而是为了看清当下」。\n\n## 素材\n- [x] 河边那条路（用《把周末留给一条小路》里的三段）\n- [ ] 注意力那篇的核心：注意力是被让出来的\n- [ ] 结尾引一句读者来信\n\n## 排期\n初稿 9/18，改两遍，9/21 周日傍晚发。"),
  note("demo-coffee", "手冲咖啡的小调整", "demo-life", "研磨调粗一格，水温降到 90°C，尾段的苦味就没了。\n15 克豆，225 克水，闷蒸 30 秒。\n\n下次只改一个变量：第二段注水慢一点。"),
  note("demo-subway", "地铁上记下的一句话", "demo-life", "「我们不是在保存记忆，是在给自己留一些可以回看的路标。」\n\n旁边的人打电话时说的，不知道他从哪看来的。"),
].map(n => [n.id, n]));

export function demoTree(notes: Record<string, MemoDetailNode>): MemoTreeNode[] {
  const folders = [base("demo-life", "日常与灵感", null, "folder"),
    base("demo-observation", "散步与观察", "demo-life", "folder"),
    base("demo-reading", "阅读摘记", null, "folder"),
    base("demo-projects", "正在做的事", null, "folder"),
    base("demo-newsletter", "每月通讯", "demo-projects", "folder")];
  const canvas = base("demo-canvas", "从散步到写作", "demo-projects", "canvas");
  const all: MemoTreeNode[] = [...Object.values(notes).map(n => ({ ...n, children: [] })), ...folders, canvas];
  const byId = new Map(all.map(n => [n.id, n]));
  const roots: MemoTreeNode[] = [];
  for (const n of all) {
    if (n.parent_id) byId.get(n.parent_id)?.children.push(n);
    else roots.push(n);
  }
  return roots;
}

/** 未归档笔记的落点；整理的唯一去处，`organizeNote` 与归档标签共读同一个值。 */
export const UNFILED_TARGET = "demo-observation";
/** 目录 id → 归档线上显示的人话落点。 */
export const ARCHIVE_LABEL: Record<string, string> = {
  "demo-life": "日常与灵感", "demo-observation": "日常与灵感 / 散步与观察",
  "demo-reading": "阅读摘记", "demo-newsletter": "正在做的事 / 每月通讯",
  "demo-projects": "正在做的事",
};
export function organizeNote(notes: Record<string, MemoDetailNode>, id: string) {
  const n = notes[id];
  if (!n) return notes;
  const parent = n.parent_id ?? UNFILED_TARGET;
  return { ...notes, [id]: { ...n, parent_id: parent } };
}

/* ── 对话脚本 ──────────────────────────────────────────────────────────
 * Demo 只说生产真实存在的四工具（read_tree/read_memo/edit_memo/edit_node）
 * 的一个子集：读取用 read_*，移动用 edit_node 的 move。写操作必须在用户
 * 发送之后发生并真的改树，因此历史对话一律只读——芯片说「移动了」而文件
 * 树没动，是可以当场验证的谎。 */
export type DemoStep =
  | { kind: "read_tree" }
  | { kind: "read_memo"; title: string }
  | { kind: "move_memo"; title: string }
  | { kind: "say"; text: string };

/** 写工具的 commandId 生成规则；`materializeSteps` 与调用方共读，保证两端指同一条命令。 */
export const stepCommandId = (turnId: string, index: number) => `demo-cmd-${turnId}-${index}`;

/** 把脚本物化成 AI SDK 的有序 parts；`pendingIndex` 让那一步停在执行中，供芯片流光。 */
export function materializeSteps(steps: readonly DemoStep[], turnId: string, pendingIndex = -1): SuperNoteUIMessage["parts"] {
  return steps.map((step, index) => {
    if (step.kind === "say") return { type: "text", text: step.text };
    const toolCallId = `${turnId}-${index}`;
    const pending = index === pendingIndex;
    if (step.kind === "read_tree") {
      const input = {};
      return pending
        ? { type: "dynamic-tool", toolName: "read_tree", toolCallId, state: "input-available", input }
        : { type: "dynamic-tool", toolName: "read_tree", toolCallId, state: "output-available", input, output: {} };
    }
    if (step.kind === "read_memo") {
      const input = {};
      return pending
        ? { type: "dynamic-tool", toolName: "read_memo", toolCallId, state: "input-available", input }
        : { type: "dynamic-tool", toolName: "read_memo", toolCallId, state: "output-available", input, output: { title: step.title } };
    }
    const input = { op: "move", title: step.title };
    return pending
      ? { type: "dynamic-tool", toolName: "edit_node", toolCallId, state: "input-available", input }
      : { type: "dynamic-tool", toolName: "edit_node", toolCallId, state: "output-available", input, output: { id: stepCommandId(turnId, index), status: "succeeded" } };
  });
}

export const message = (id: string, role: "user" | "assistant", text: string): SuperNoteUIMessage => ({ id, role, parts: [{ type: "text", text }] });
const script = (id: string, steps: readonly DemoStep[]): SuperNoteUIMessage => ({ id, role: "assistant", parts: materializeSteps(steps, id) });

/** 预置历史：只读工具，且每条结论都能在正文里逐句核对。 */
export const createMessages = () => [
  message("demo-u1", "user", "最近记的东西有点散，你能看出它们在说什么吗？"),
  script("demo-a1", [
    { kind: "read_tree" },
    { kind: "say", text: "六篇里有一条清楚的线：**散步 → 注意力 → 写作**。\n\n前面两篇在说怎么看见，后面几篇在说怎么把看见的减到能写出来。" },
  ]),
  message("demo-u2", "user", "那条线是怎么连起来的？"),
  script("demo-a2", [
    { kind: "read_memo", title: "散步时，注意力回来了" },
    { kind: "read_memo", title: "写作不必从开头开始" },
    { kind: "say", text: "《散步时，注意力回来了》里你写「不是加一件事，是撤掉一件事」；《写作不必从开头开始》里你写「删掉解释过多的一句」。\n\n两篇说的是同一件事——**减法**。中间那篇周末计划是入口：先去看，再看清楚。" },
  ]),
  message("demo-u3", "user", "我想把它写成九月通讯。"),
  script("demo-a3", [
    { kind: "read_memo", title: "九月通讯 · 慢一点也没关系" },
    { kind: "read_memo", title: "把周末留给一条小路" },
    { kind: "say", text: "《九月通讯》的素材清单里已经留了两个空位，都还没填。\n\n缺的那一段正好在《把周末留给一条小路》里——你写下的那三段观察，可以直接放进去。" },
  ]),
];

const partnerOf = (title: string) => title === "散步时，注意力回来了" ? "写作不必从开头开始" : "散步时，注意力回来了";

/**
 * 用户发送后的模拟回合。`filedAt` 是当前笔记的归档落点标签，未归档为 null。
 * 只有真的能改树时才产出 move_memo，且调用方会据 commandId 撤销。
 */
export function demoTurn(input: string, title: string, filedAt: string | null): DemoStep[] {
  if (/整理|归档|收一下|收进|移动|分类/.test(input)) {
    return filedAt
      ? [{ kind: "read_tree" }, { kind: "say", text: `「${title}」已经在「${filedAt}」里了，原文一字未改。\n\n要换个位置的话，告诉我你想放到哪个文件夹。` }]
      : [
        { kind: "read_tree" },
        { kind: "read_memo", title },
        { kind: "move_memo", title },
        { kind: "say", text: `已把「${title}」收进「${ARCHIVE_LABEL[UNFILED_TARGET]}」，原文一字未改。\n\n文件树里那一行刚刚换了位置，回复末尾的「撤销」可以把它放回原处。` },
      ];
  }
  if (/画布|canvas|联系|关联/i.test(input)) {
    return [
      { kind: "read_memo", title },
      { kind: "read_memo", title: partnerOf(title) },
      { kind: "say", text: `这些记录可以连成一条线：**散步观察 → 留意感受 → 写成短文**。\n\n点纸张上方的 Canvas 图标，就能把这几篇放在一起看；卡片可以展开阅读，再回到原文。` },
    ];
  }
  if (/总结|摘要|提炼/.test(input)) {
    return [
      { kind: "read_memo", title },
      { kind: "say", text: `可以把「${title}」的记录方法提炼成三步：\n\n1. 留下一个具体场景。\n2. 记住当时最清楚的感受。\n3. 找到下一次可以尝试的小行动。\n\n先不急着写完整，留下一句也很好。` },
    ];
  }
  return [
    { kind: "read_tree" },
    { kind: "say", text: `收到。围绕「${title}」，我会先保留你的表达，再帮你找到它与其他记录的联系。\n\n这里展示的是一轮预设示例回复。你可以试着说「帮我整理这篇」或「这几篇有什么联系」，看想法如何从一页纸变成一组关联。` },
  ];
}

/** 固定示例的缩略文案只显示文字；正文仍由生产 Markdown 渲染器解释。 */
export const demoExcerpt = (content: string) => content
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^[-*]\s+(?:\[[ x]\]\s*)?/gm, "")
  .replace(/\*\*([^*]+)\*\*/g, "$1");
