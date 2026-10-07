/**
 * [INPUT]: 依赖真实只读工具、受控正文与 AI SDK 消息流
 * [OUTPUT]: 验证范围、分段、版本、引文复核、消息落库及越权工具拒绝
 * [POS]: Canvas 问答证据链回归，不访问外部模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import type { UIMessage, UIMessageChunk } from "ai";
import {
  createCanvasChatSession,
  withCanvasEvidence,
  canvasModelMessages,
  CanvasPromptContext,
} from "./canvas-chat-session";
import type { CanvasChatSnapshot } from "./canvas-chat-contracts";
import { createChatResponseStream } from "../routes/chat-stream";
const memo = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  canvas = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  node = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const snapshot: CanvasChatSnapshot = {
  canvas_id: canvas,
  title: "研究",
  version: 4,
  mode: "selected",
  memo_ids: [memo],
  nodes: [
    {
      id: node,
      memo_id: memo,
      revision: 2,
      title: "原文",
      excerpt: "短摘要",
      text: null,
    },
  ],
  edges: [],
};
function fixture(revision = 2, text = "准确的原文依据。") {
  return createCanvasChatSession(snapshot, async () => ({
    title: "原文",
    revision,
    memo: { content_mdx: text },
  }));
}
async function run(tool: unknown, input: unknown): Promise<any> {
  return (
    tool as { execute(input: unknown, context: unknown): Promise<unknown> }
  ).execute(input, {});
}
test("工具只有读取与引用，拒绝范围外笔记和变化版本", async () => {
  const s = fixture();
  expect(Object.keys(s.tools)).toEqual([
    "list_sources",
    "read_relations",
    "read_text",
    "read_source",
    "cite_sources",
  ]);
  await expect(
    run(s.tools.read_source, { memo_id: node, offset: 0 }),
  ).rejects.toThrow("范围");
  await expect(
    run(fixture(3).tools.read_source, { memo_id: memo, offset: 0 }),
  ).rejects.toThrow("版本");
  expect(JSON.stringify(new CanvasPromptContext({ text: "私密正文" }))).toBe(
    "{}",
  );
});
test("只接受实际已读片段的逐字引文，不把读过等同引用", async () => {
  const s = fixture();
  const cite = {
    citations: [
      { kind: "memo", source_id: memo, quote: "准确的原文", claim: "有依据" },
    ],
  };
  await expect(run(s.tools.cite_sources, cite)).rejects.toThrow("已读");
  await run(s.tools.read_source, { memo_id: memo, offset: 0 });
  expect(s.citations()).toEqual([]);
  await expect(
    run(s.tools.cite_sources, {
      citations: [{ ...cite.citations[0], quote: "改写的原文" }],
    }),
  ).rejects.toThrow();
  await run(s.tools.cite_sources, cite);
  expect(s.citations()[0]).toMatchObject({
    revision: 2,
    canvas_node_id: node,
    quote: "准确的原文",
  });
});
test("长文分段读取，不能引用尚未读取的尾段", async () => {
  const s = fixture(2, "前".repeat(13000) + "尾段证据");
  expect(
    (await run(s.tools.read_source, { memo_id: memo, offset: 0 })).next_offset,
  ).toBe(12000);
  const cite = {
    citations: [
      { kind: "memo", source_id: memo, quote: "尾段证据", claim: "尾部" },
    ],
  };
  await expect(run(s.tools.cite_sources, cite)).rejects.toThrow();
  await run(s.tools.read_source, { memo_id: memo, offset: 12000 });
  await run(s.tools.cite_sources, cite);
  expect(s.citations()).toHaveLength(1);
});
test("证据通过真实 AI SDK 流进入回复 parts 并持久化", async () => {
  const s = fixture();
  await run(s.tools.read_source, { memo_id: memo, offset: 0 });
  await run(s.tools.cite_sources, {
    citations: [
      { kind: "memo", source_id: memo, quote: "原文依据", claim: "判断" },
    ],
  });
  const chunks: UIMessageChunk[] = [
    { type: "text-start", id: "a" },
    { type: "text-delta", id: "a", delta: "回答" },
    { type: "text-end", id: "a" },
    { type: "finish", finishReason: "stop" },
  ];
  let saved: UIMessage | undefined;
  const stream = createChatResponseStream({
    messages: [],
    messageId: "a",
    signal: new AbortController().signal,
    createStream: async () =>
      withCanvasEvidence(
        new ReadableStream({
          start(c) {
            chunks.forEach((x) => c.enqueue(x));
            c.close();
          },
        }),
        s,
        snapshot,
      ),
    approveTool: async () => null,
    persist: async (m) => {
      saved = m;
    },
    onPersistenceError: () => {},
  });
  for await (const _ of stream) {
  }
  expect(
    saved?.parts.find((p) => p.type === "data-canvas-evidence"),
  ).toMatchObject({ data: { citations: [{ quote: "原文依据" }] } });
});
test("写工具不能穿过只读流，旧工具正文不进入新范围", async () => {
  const s = fixture();
  const stream = withCanvasEvidence(
    new ReadableStream<UIMessageChunk>({
      start(c) {
        c.enqueue({
          type: "tool-input-available",
          toolCallId: "write",
          toolName: "edit_memo",
          input: {},
        });
        c.close();
      },
    }),
    s,
    snapshot,
  );
  await expect(stream.getReader().read()).rejects.toThrow("拒绝");
  const messages = canvasModelMessages([
    {
      id: "a",
      role: "assistant",
      parts: [
        { type: "text", text: "旧回答" },
        {
          type: "dynamic-tool",
          toolName: "edit_memo",
          toolCallId: "w",
          state: "output-available",
          input: {},
          output: { secret: "旧正文" },
        },
      ],
    },
  ]);
  expect(JSON.stringify(messages)).not.toContain("旧正文");
});

test("漏登记时只补正文出现的逐字引句，不把全部已读资料当引用", async () => {
  const s = fixture();
  await run(s.tools.read_source, { memo_id: memo, offset: 0 });
  expect(s.citations("没有使用原文的一句回答")).toEqual([]);
  expect(s.citations("原文说：准确的原文依据。")[0]?.quote).toBe(
    "准确的原文依据。",
  );
});
