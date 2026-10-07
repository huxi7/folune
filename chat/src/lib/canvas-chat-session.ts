/**
 * [INPUT]: 依赖可信 Canvas 快照、按 ID 读取正文与 Mastra 工具工厂
 * [OUTPUT]: 提供本轮只读图分页、正文分段与逐字复核引用
 * [POS]: Chat 的请求期证据台账；不共享用户数据，不持有写工具
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { UIMessage, UIMessageChunk } from "ai";
import type {
  CanvasChatSnapshot,
  CanvasCitation,
} from "./canvas-chat-contracts";

const PAGE_SIZE = 30;
const BODY_CHUNK = 12_000;
const MAX_READ_CHARACTERS = 120_000;
type MemoBody = {
  title: string;
  revision: number;
  memo: { content_mdx: string };
};
type ReadSource = {
  citation: Omit<CanvasCitation, "quote" | "claim">;
  text: string;
};

export function createCanvasChatSession(
  snapshot: CanvasChatSnapshot,
  getMemo: (id: string) => Promise<MemoBody>,
  extraMemos: Array<{ memo_id: string; title: string; revision: number }> = [],
) {
  const read = new Map<string, ReadSource[]>();
  const cited: CanvasCitation[] = [];
  let consumed = 0;
  const memos = new Map<
    string,
    { title: string; revision: number; canvas_node_id: string | null }
  >(
    snapshot.nodes.flatMap((n) =>
      n.memo_id && n.revision
        ? [
            [
              n.memo_id,
              { title: n.title, revision: n.revision, canvas_node_id: n.id },
            ] as const,
          ]
        : [],
    ),
  );
  for (const memo of extraMemos)
    if (!memos.has(memo.memo_id))
      memos.set(memo.memo_id, { ...memo, canvas_node_id: null });
  const remember = (source: ReadSource) => {
    const key = `${source.citation.kind}:${source.citation.source_id}`;
    read.set(key, [...(read.get(key) ?? []), source]);
  };
  const base = (
    kind: CanvasCitation["kind"],
    id: string,
    title: string,
    revision: number,
    node: string | null,
  ): ReadSource["citation"] => ({
    kind,
    source_id: id,
    title,
    revision,
    canvas_node_id: node,
    canvas_id: snapshot.canvas_id,
  });
  const list = ({
    offset = 0,
    query = "",
  }: {
    offset?: number;
    query?: string;
  }) => {
    const candidates = snapshot.nodes.filter(
      (n) =>
        !query ||
        `${n.title}\n${n.excerpt ?? ""}\n${n.text ?? ""}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    );
    const nodes = candidates
      .slice(offset, offset + PAGE_SIZE)
      .map((n) => ({
        ...n,
        text: n.text?.slice(0, 2000) ?? null,
        excerpt: n.excerpt?.slice(0, 500) ?? null,
      }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = snapshot.edges
      .filter((e) => nodeIds.has(e.source_id) || nodeIds.has(e.target_id))
      .slice(0, PAGE_SIZE);
    for (const node of nodes)
      if (!node.memo_id && node.text)
        remember({
          citation: base(
            "text",
            node.id,
            node.title,
            snapshot.version,
            node.id,
          ),
          text: node.text,
        });
    for (const edge of edges)
      if (edge.rationale)
        remember({
          citation: base(
            "edge",
            edge.id,
            `${snapshot.nodes.find((n) => n.id === edge.source_id)?.title ?? ""} ↔ ${snapshot.nodes.find((n) => n.id === edge.target_id)?.title ?? ""}`,
            snapshot.version,
            edge.source_id,
          ),
          text: edge.rationale,
        });
    return {
      nodes,
      edges,
      total: candidates.length,
      next_offset:
        offset + nodes.length < candidates.length
          ? offset + nodes.length
          : null,
      relations_partial: true,
    };
  };
  const initial = list({});
  const tools = {
    list_sources: createTool({
      id: "list_sources",
      description:
        "分页读取本轮范围内的笔记目录、自由文字和关系。query 只搜索标题/摘录/自由文字，不能据此认定正文无内容。",
      inputSchema: z.object({
        offset: z.number().int().nonnegative().default(0),
        query: z.string().max(300).default(""),
      }),
      execute: async (input) => list(input),
    }),
    read_relations: createTool({
      id: "read_relations",
      description: "分页读取本轮已有关系；无理由的边不能推断因果。",
      inputSchema: z.object({
        offset: z.number().int().nonnegative().default(0),
      }),
      execute: async ({ offset }) => {
        const edges = snapshot.edges.slice(offset, offset + PAGE_SIZE);
        for (const e of edges)
          if (e.rationale)
            remember({
              citation: base(
                "edge",
                e.id,
                "画布关系",
                snapshot.version,
                e.source_id,
              ),
              text: e.rationale,
            });
        return {
          edges,
          total: snapshot.edges.length,
          next_offset:
            offset + edges.length < snapshot.edges.length
              ? offset + edges.length
              : null,
        };
      },
    }),
    read_text: createTool({
      id: "read_text",
      description: "分段读取本轮范围内的画布自由文字。",
      inputSchema: z.object({
        node_id: z.uuid(),
        offset: z.number().int().nonnegative().default(0),
      }),
      execute: async ({ node_id, offset }) => {
        const node = snapshot.nodes.find((n) => n.id === node_id && !n.memo_id);
        if (!node || node.text === null)
          throw new Error("文字不在本轮范围内。");
        const text = node.text.slice(offset, offset + BODY_CHUNK);
        remember({
          citation: base(
            "text",
            node.id,
            node.title,
            snapshot.version,
            node.id,
          ),
          text,
        });
        return {
          node_id,
          text,
          next_offset:
            offset + text.length < node.text.length
              ? offset + text.length
              : null,
        };
      },
    }),
    read_source: createTool({
      id: "read_source",
      description:
        "按 memo_id 读取本轮范围内真实正文，每次最多 12000 字符；有 next_offset 时继续分段读取。",
      inputSchema: z.object({
        memo_id: z.uuid(),
        offset: z.number().int().nonnegative().default(0),
      }),
      execute: async ({ memo_id, offset }) => {
        const expected = memos.get(memo_id);
        if (!expected) throw new Error("笔记不在本轮问答范围内。");
        if (consumed >= MAX_READ_CHARACTERS)
          throw new Error("本轮阅读预算已用完，请说明覆盖范围并分轮继续。");
        const memo = await getMemo(memo_id);
        if (memo.revision !== expected.revision)
          throw new Error("原文版本已变化，请重新发送问题。");
        if (consumed >= MAX_READ_CHARACTERS)
          throw new Error("本轮阅读预算已用完，请分轮继续。");
        const text = memo.memo.content_mdx.slice(
          offset,
          offset + Math.min(BODY_CHUNK, MAX_READ_CHARACTERS - consumed),
        );
        consumed += text.length;
        remember({
          citation: base(
            "memo",
            memo_id,
            expected.title,
            expected.revision,
            expected.canvas_node_id,
          ),
          text,
        });
        return {
          memo_id,
          title: expected.title,
          revision: expected.revision,
          text,
          next_offset:
            offset + text.length < memo.memo.content_mdx.length
              ? offset + text.length
              : null,
        };
      },
    }),
    cite_sources: createTool({
      id: "cite_sources",
      description:
        "输出最终回答前登记实际引用的证据。quote 必须逐字来自本轮已读取片段；claim 简述回答中受其支持的判断。不登记未使用的资料。",
      inputSchema: z.object({
        citations: z
          .array(
            z.object({
              kind: z.enum(["memo", "text", "edge"]),
              source_id: z.uuid(),
              quote: z.string().min(1).max(1200),
              claim: z.string().min(1).max(300),
            }),
          )
          .max(30),
      }),
      execute: async ({ citations }) => {
        const accepted: CanvasCitation[] = [];
        for (const input of citations) {
          const source = read
            .get(`${input.kind}:${input.source_id}`)
            ?.find((s) => s.text.includes(input.quote));
          if (!source)
            throw new Error("引用不存在于本轮已读原文，请先读取并逐字引用。");
          accepted.push({
            ...source.citation,
            quote: input.quote,
            claim: input.claim,
          });
        }
        cited.splice(0, cited.length, ...accepted);
        return { verified: accepted.length };
      },
    }),
  };
  return {
    tools,
    initial,
    extraMemos,
    citations: (answer = "") => {
      const result = [...cited];
      // 供应商思考模式不支持 required；只为正文中真实出现的逐字引句补证据。
      const quotes = [
        ...answer.matchAll(/[「“"]([^」”"\n]{8,1200})[」”"]/gu),
      ].map((m) => m[1]!);
      for (const sources of read.values())
        for (const source of sources) {
          if (
            result.some(
              (c) =>
                c.kind === source.citation.kind &&
                c.source_id === source.citation.source_id,
            )
          )
            continue;
          const whole = source.text.trim();
          const quote =
            whole.length >= 8 && whole.length <= 1200 && answer.includes(whole)
              ? whole
              : quotes.find((q) => source.text.includes(q));
          if (quote)
            result.push({
              ...source.citation,
              quote,
              claim: "回答中的原文引句",
            });
        }
      return result.slice(0, 30);
    },
    readIds: () => [...read.keys()],
  };
}

/** 不把上一轮工具正文冒充当前范围资料；历史只保留对话文本。 */
export function canvasModelMessages(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((m) => ({ ...m, parts: m.parts.filter((p) => p.type === "text") }))
    .filter((m) => m.parts.length > 0);
}

export function withCanvasEvidence(
  stream: ReadableStream<UIMessageChunk>,
  session: ReturnType<typeof createCanvasChatSession>,
  snapshot: CanvasChatSnapshot,
) {
  const allowed = new Set(Object.keys(session.tools));
  let answer = "";
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type === "text-delta") answer += chunk.delta;
        if (
          chunk.type === "tool-input-available" &&
          !allowed.has(chunk.toolName.split(/[.:/]/u).at(-1)!)
        )
          throw new Error("画布问答拒绝执行范围外工具。");
        if (
          chunk.type === "finish" ||
          chunk.type === "abort" ||
          chunk.type === "tool-output-available"
        )
          controller.enqueue({
            type: "data-canvas-evidence",
            id: "canvas-evidence",
            data: {
              canvas_id: snapshot.canvas_id,
              version: snapshot.version,
              read_sources: session.readIds(),
              citations: session.citations(answer),
            },
          });
        controller.enqueue(chunk);
      },
    }),
  );
}

/** 请求期提示词不进入 trace 的 JSON 序列化。 */
export class CanvasPromptContext {
  #value: string;
  constructor(value: unknown) {
    this.#value = JSON.stringify(value);
  }
  read() {
    return this.#value;
  }
  toJSON() {
    return {};
  }
}
