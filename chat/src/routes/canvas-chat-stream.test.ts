/**
 * [INPUT]: 依赖真实 Mastra/AI SDK 与受控模型
 * [OUTPUT]: 验证服务端读取、引用工具和多步正文在同一请求完成
 * [POS]: 画布问答集成门禁，模型替身只决定输出，不替换工具执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core";
import { handleChatStream } from "@mastra/ai-sdk";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { createCanvasChatSession } from "../lib/canvas-chat-session";
import type { CanvasChatSnapshot } from "../lib/canvas-chat-contracts";

test("真实 Mastra 动态工具完成读取、引用、正文，无客户端写工具", async () => {
  const memo = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    node = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const snapshot: CanvasChatSnapshot = {
    canvas_id: cid,
    mode: "all",
    memo_ids: [],
    version: 1,
    title: "画布",
    nodes: [
      {
        id: node,
        memo_id: memo,
        title: "原文",
        revision: 1,
        text: null,
        excerpt: null,
      },
    ],
    edges: [],
  };
  let calls = 0;
  const model = new MockLanguageModelV3({
    doStream: async (options) => {
      if (calls < 2)
        expect(options.tools?.map((t) => t.name).sort()).toEqual([
          "cite_sources",
          "list_sources",
          "read_relations",
          "read_source",
          "read_text",
        ]);
      const current = calls++;
      const parts =
        current === 0
          ? [
              {
                type: "tool-call",
                toolCallId: "read",
                toolName: "read_source",
                input: JSON.stringify({ memo_id: memo, offset: 0 }),
              },
            ]
          : current === 1
            ? [
                {
                  type: "tool-call",
                  toolCallId: "cite",
                  toolName: "cite_sources",
                  input: JSON.stringify({
                    citations: [
                      {
                        kind: "memo",
                        source_id: memo,
                        quote: "真实内容",
                        claim: "共同观点",
                      },
                    ],
                  }),
                },
              ]
            : [
                { type: "text-start", id: "a" },
                { type: "text-delta", id: "a", delta: "有原文支持的回答。" },
                { type: "text-end", id: "a" },
              ];
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            ...parts,
            {
              type: "finish",
              finishReason: {
                unified: current < 2 ? "tool-calls" : "stop",
                raw: null,
              },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 10, text: 10, reasoning: 0 },
              },
            },
          ] as any,
          chunkDelayInMs: null,
        }),
      };
    },
  });
  const session = createCanvasChatSession(snapshot, async () => ({
    title: "原文",
    revision: 1,
    memo: { content_mdx: "真实内容" },
  }));
  const agent = new Agent({
    id: "canvas-test",
    name: "Canvas test",
    instructions: "Use tools",
    model,
  });
  const mastra = new Mastra({
    agents: { "canvas-test": agent },
    logger: false,
  });
  const stream = await handleChatStream({
    mastra,
    agentId: "canvas-test",
    version: "v6",
    params: {
      messages: [
        { id: "u", role: "user", parts: [{ type: "text", text: "分析" }] },
      ],
      toolsets: { canvas: session.tools },
      maxSteps: 5,
    },
  });
  const parts = [];
  for await (const p of stream) parts.push(p);
  expect(calls).toBe(3);
  expect(
    parts.some((p) => p.type === "text-delta" && p.delta.includes("回答")),
  ).toBe(true);
  expect(session.citations()).toHaveLength(1);
  expect(parts.filter((p) => p.type === "tool-output-available")).toHaveLength(
    2,
  );
});
