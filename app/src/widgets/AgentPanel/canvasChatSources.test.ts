/**
 * [INPUT]: 依赖来源纯函数、传输契约与引用解析器
 * [OUTPUT]: 验证精确范围冻结、历史恢复与引用不随当前选择漂移
 * [POS]: AgentPanel 的消息来源回归，不连接用户数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import {
  freezeCanvasSource,
  restoreCanvasSource,
  canvasTurnIsReadOnly,
  canvasMentionResults,
} from "./canvasChatSources";
import { prepareMemoChatRequest } from "./chatTransport";
import { readCanvasCitations } from "./canvasEvidence";
import type { FoluneUIMessage } from "../../shared/api/ai";
import type { CanvasDetail } from "../../shared/api/canvas";
import type { MemoTreeNode } from "../../shared/api/memo";
const cid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  mid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  nid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const source = {
  id: cid,
  title: "研究图",
  mode: "selected" as const,
  memoIds: [mid],
};
const detail = {
  canvas: { node_id: cid, version: 8 },
  nodes: [{ id: nid, target_node_id: mid, target: { deleted_at: null } }],
} as CanvasDetail;
test("冻结复制列表，零来源/不存在来源拒绝，不回退整图", () => {
  const frozen = freezeCanvasSource(source, detail);
  source.memoIds.push(nid);
  expect(frozen.memo_ids).toEqual([mid]);
  source.memoIds.pop();
  expect(() =>
    freezeCanvasSource({ ...source, memoIds: [] }, detail),
  ).toThrow();
  expect(() =>
    freezeCanvasSource({ ...source, memoIds: [nid] }, detail),
  ).toThrow();
});
test("恢复的画布范围进入传输，后续页面状态无法改写本轮", () => {
  const canvas = {
    canvas_id: cid,
    mode: "selected" as const,
    memo_ids: [mid],
    version: 8,
    title: "研究图",
    nodes: [],
    edges: [],
  };
  const message: FoluneUIMessage = {
    id: "u",
    role: "user",
    parts: [{ type: "text", text: "问题" }],
    metadata: { context_snapshot: { primary: null, references: [], canvas } },
  };
  expect(restoreCanvasSource([message])).toEqual(source);
  expect(canvasTurnIsReadOnly([message])).toBe(true);
  const request = prepareMemoChatRequest({
    messages: [message, { id: "a", role: "assistant", parts: [] }],
    threadId: cid,
    trigger: "submit-message",
  });
  expect(request.body.canvas).toMatchObject({
    canvas_id: cid,
    memo_ids: [mid],
    version: 8,
  });
});
test("画布 @候选与普通 memo 候选分开，引用只来自当前回答证据", () => {
  const tree = [
    {
      id: cid,
      title: "研究图",
      node_type: "canvas",
      revision: 1,
      children: [],
    },
    { id: mid, title: "笔记", node_type: "memo", revision: 1, children: [] },
  ] as unknown as MemoTreeNode[];
  expect(canvasMentionResults(tree, "画布").map((n) => n.id)).toEqual([cid]);
  const cite = {
    kind: "memo" as const,
    source_id: mid,
    canvas_id: cid,
    canvas_node_id: nid,
    title: "笔记",
    revision: 1,
    quote: "原文",
    claim: "依据",
  };
  const message: FoluneUIMessage = {
    id: "a",
    role: "assistant",
    parts: [{ type: "data-canvas-evidence", data: { citations: [cite] } }],
  };
  expect(readCanvasCitations(message)).toEqual([cite]);
  expect(readCanvasCitations({ ...message, parts: [] })).toEqual([]);
});
