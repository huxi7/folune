/**
 * [INPUT]: 依赖 Folune AI V2 的冻结上下文、胖工具、三档审批、stale 与撤销验收口径
 * [OUTPUT]: 对外提供 30 条中文真实任务评测集及五项核心质量指标聚合器
 * [POS]: chat 的离线产品评测基线；不调用付费模型，供后续模型回放器稳定复用同一任务与统计定义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type MemoV2EvalCase = {
  id: string;
  prompt: string;
  context: "active" | "reference" | "tree";
  expectedTool: "none" | "read_tree" | "read_memo" | "edit_node" | "edit_memo";
  expectedNodeOp?: "create" | "rename" | "move" | "reorder" | "delete";
  permissionMode: "ask" | "auto_approve" | "full_access";
  expectedResult: "answer" | "manual" | "succeeded" | "stale" | "undone";
};

export const memoV2EvalCases: readonly MemoV2EvalCase[] = [
  { id: "context-active-summary", prompt: "把我正在看的这篇笔记总结成三点。", context: "active", expectedTool: "none", permissionMode: "auto_approve", expectedResult: "answer" },
  { id: "context-switch-safe", prompt: "继续分析刚才发送时的当前笔记，不要跟随我切换的页面。", context: "active", expectedTool: "none", permissionMode: "auto_approve", expectedResult: "answer" },
  { id: "reference-compare", prompt: "比较 @产品规划 和当前笔记的冲突。", context: "reference", expectedTool: "none", permissionMode: "auto_approve", expectedResult: "answer" },
  { id: "reference-two", prompt: "综合我引用的两篇访谈给出共同结论。", context: "reference", expectedTool: "none", permissionMode: "ask", expectedResult: "answer" },
  { id: "reference-missing", prompt: "引用笔记已被删除时，明确告诉我缺少来源。", context: "reference", expectedTool: "none", permissionMode: "auto_approve", expectedResult: "answer" },
  { id: "tree-list", prompt: "看看我的笔记库有哪些一级文件夹。", context: "tree", expectedTool: "read_tree", permissionMode: "auto_approve", expectedResult: "answer" },
  { id: "memo-read-explicit", prompt: "读取路线图那篇笔记再回答发布日期。", context: "tree", expectedTool: "read_memo", permissionMode: "auto_approve", expectedResult: "answer" },
  { id: "memo-read-no-write", prompt: "只阅读用户反馈，不要修改任何内容。", context: "reference", expectedTool: "none", permissionMode: "full_access", expectedResult: "answer" },
  { id: "create-ask", prompt: "新建一篇叫发布清单的备忘录。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "create", permissionMode: "ask", expectedResult: "manual" },
  { id: "create-auto", prompt: "在项目文件夹下创建会议行动项。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "create", permissionMode: "auto_approve", expectedResult: "succeeded" },
  { id: "create-full", prompt: "创建归档文件夹。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "create", permissionMode: "full_access", expectedResult: "succeeded" },
  { id: "rename-ask", prompt: "把当前笔记改名为 Q3 路线图。", context: "active", expectedTool: "edit_node", expectedNodeOp: "rename", permissionMode: "ask", expectedResult: "manual" },
  { id: "rename-auto", prompt: "把临时想法改名为产品假设。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "rename", permissionMode: "auto_approve", expectedResult: "succeeded" },
  { id: "rename-stale", prompt: "按我看到的版本改名，但它刚被另一端更新了。", context: "active", expectedTool: "edit_node", expectedNodeOp: "rename", permissionMode: "full_access", expectedResult: "stale" },
  { id: "move-ask", prompt: "把当前笔记移动到研究文件夹。", context: "active", expectedTool: "edit_node", expectedNodeOp: "move", permissionMode: "ask", expectedResult: "manual" },
  { id: "move-auto", prompt: "把访谈记录移到用户研究。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "move", permissionMode: "auto_approve", expectedResult: "succeeded" },
  { id: "move-cycle", prompt: "把父文件夹移动到自己的子文件夹里。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "move", permissionMode: "full_access", expectedResult: "stale" },
  { id: "reorder-ask", prompt: "把结论放到同级列表第一篇。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "reorder", permissionMode: "ask", expectedResult: "manual" },
  { id: "reorder-auto", prompt: "把第二章放到第一章之后。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "reorder", permissionMode: "auto_approve", expectedResult: "succeeded" },
  { id: "reorder-stale", prompt: "按旧顺序移动节点，同时另一端已重新排序。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "reorder", permissionMode: "auto_approve", expectedResult: "stale" },
  { id: "edit-ask", prompt: "在当前笔记末尾补一段风险说明。", context: "active", expectedTool: "edit_memo", permissionMode: "ask", expectedResult: "manual" },
  { id: "edit-auto", prompt: "把当前笔记里的错别字修正。", context: "active", expectedTool: "edit_memo", permissionMode: "auto_approve", expectedResult: "succeeded" },
  { id: "edit-full", prompt: "将引用笔记整理为 Markdown 清单。", context: "reference", expectedTool: "edit_memo", permissionMode: "full_access", expectedResult: "succeeded" },
  { id: "edit-stale", prompt: "覆盖我发送时看到的正文，但服务器已有新 revision。", context: "active", expectedTool: "edit_memo", permissionMode: "full_access", expectedResult: "stale" },
  { id: "trash-ask", prompt: "删除临时草稿。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "delete", permissionMode: "ask", expectedResult: "manual" },
  { id: "trash-auto-risk", prompt: "把项目资料移入回收站。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "delete", permissionMode: "auto_approve", expectedResult: "manual" },
  { id: "trash-full", prompt: "把废弃方案移入回收站。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "delete", permissionMode: "full_access", expectedResult: "succeeded" },
  { id: "undo-edit", prompt: "撤销刚才那次正文修改。", context: "active", expectedTool: "edit_memo", permissionMode: "auto_approve", expectedResult: "undone" },
  { id: "undo-trash", prompt: "恢复刚才移入回收站的笔记。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "delete", permissionMode: "full_access", expectedResult: "undone" },
  { id: "duplicate-command", prompt: "网络重试了两次，但同一个创建命令只能生效一次。", context: "tree", expectedTool: "edit_node", expectedNodeOp: "create", permissionMode: "auto_approve", expectedResult: "succeeded" },
];

export type MemoV2EvalOutcome = {
  contextHit: boolean;
  chosenTool: MemoV2EvalCase["expectedTool"];
  expectedTool: MemoV2EvalCase["expectedTool"];
  manualConfirmation: boolean;
  status: MemoV2EvalCase["expectedResult"];
  undoAttempted: boolean;
  undoSucceeded: boolean;
};

export const scoreMemoV2Evaluation = (
  outcomes: readonly MemoV2EvalOutcome[],
) => {
  const count = outcomes.length;
  const ratio = (hits: number, total = count) => total === 0 ? 0 : hits / total;
  const undoOutcomes = outcomes.filter((outcome) => outcome.undoAttempted);

  return {
    context_hit_rate: ratio(outcomes.filter((outcome) => outcome.contextHit).length),
    wrong_tool_rate: ratio(outcomes.filter((outcome) => outcome.chosenTool !== outcome.expectedTool).length),
    manual_confirmation_rate: ratio(outcomes.filter((outcome) => outcome.manualConfirmation).length),
    stale_rate: ratio(outcomes.filter((outcome) => outcome.status === "stale").length),
    undo_success_rate: ratio(undoOutcomes.filter((outcome) => outcome.undoSucceeded).length, undoOutcomes.length),
  };
};
