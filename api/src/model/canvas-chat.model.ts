/**
 * [INPUT]: 依赖画布身份、节点引用与消息冻结协议
 * [OUTPUT]: 提供只读画布问答的范围、快照与证据契约
 * [POS]: API 纯领域契约；正文只按需读取，图快照保留发送时的关系与版本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type CanvasChatScope = {
  canvas_id: string;
  mode: "all" | "selected";
  memo_ids: string[];
  version: number;
};
export type CanvasChatSnapshot = CanvasChatScope & {
  title: string;
  nodes: Array<{
    id: string;
    memo_id: string | null;
    title: string;
    revision: number | null;
    text: string | null;
    excerpt: string | null;
  }>;
  edges: Array<{
    id: string;
    source_id: string;
    target_id: string;
    rationale: string | null;
    created_by: "user" | "ai";
  }>;
};
export type CanvasCitation = {
  kind: "memo" | "text" | "edge";
  source_id: string;
  canvas_id: string;
  canvas_node_id: string | null;
  title: string;
  revision: number;
  quote: string;
  claim: string;
};
