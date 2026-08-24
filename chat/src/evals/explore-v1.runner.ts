/**
 * [INPUT]: 依赖 explore-v1 的场景与指标、运行中的 api(10001)/chat(10002)、环境变量 EVAL_ACCESS_TOKEN 与可选 EVAL_API_URL/EVAL_CHAT_URL
 * [OUTPUT]: 以 `bun run src/evals/explore-v1.runner.ts` 打印三路对比表；只读，不写任何数据
 * [POS]: evals 里唯一联网的一环，与静态门禁分开: 前者证明判据立得住，此处才回答「混合检索与 Agent 阅读各值多少」。刻意不进测试套件——它依赖真实语料、真实模型与一次真人登录拿到的 token
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  exploreEvalCases,
  scoreExploreByChannel,
  type ExploreChannel,
  type ExploreEvalOutcome,
  type ExploreEvalReturned,
} from "./explore-v1";

const accessToken = process.env["EVAL_ACCESS_TOKEN"];
const apiUrl = process.env["EVAL_API_URL"] ?? "http://localhost:10001";
const chatUrl = process.env["EVAL_CHAT_URL"] ?? "http://localhost:10002";

if (accessToken === undefined || accessToken.length === 0) {
  console.error("需要 EVAL_ACCESS_TOKEN（在浏览器登录后从 Supabase session 取）。");
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

type TreeNode = {
  children?: TreeNode[];
  id: string;
  node_type: string;
  title: string;
};

const flatten = (nodes: readonly TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { headers: authHeaders, ...init });

  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }

  return (await response.json() as { data: T }).data;
};

const tree = await request<TreeNode[]>(`${apiUrl}/memo-tree`);
const byTitle = new Map(
  flatten(tree)
    .filter((node) => node.node_type === "memo")
    .map((node) => [node.title, node.id]),
);
const titleById = new Map([...byTitle].map(([title, id]) => [id, title]));

/** 三个通道分别问同一个问题: 含这个词 / 像这段话 / 像且读懂了 */
const runChannel = async (
  channel: ExploreChannel,
  selection: string,
  sourceId: string,
): Promise<ExploreEvalReturned[]> => {
  if (channel === "keyword") {
    const hits = await request<{ hits: { node_id: string }[] }>(
      `${apiUrl}/memo-search?q=${encodeURIComponent(selection)}`,
    );

    return hits.hits
      .filter((hit) => hit.node_id !== sourceId)
      .slice(0, 5)
      .map((hit) => ({
        excerptVerified: false,
        hasReason: false,
        title: titleById.get(hit.node_id) ?? hit.node_id,
      }));
  }

  if (channel === "hybrid") {
    const related = await request<{ hits: { node_id: string }[] }>(
      `${apiUrl}/memo-search/related`,
      {
        body: JSON.stringify({
          exclude_node_ids: [sourceId],
          limit: 5,
          query_text: selection,
          source_node_id: sourceId,
        }),
        method: "POST",
      },
    );

    return related.hits.map((hit) => ({
      excerptVerified: false,
      hasReason: false,
      title: titleById.get(hit.node_id) ?? hit.node_id,
    }));
  }

  const response = await fetch(`${chatUrl}/v1/explore`, {
    body: JSON.stringify({ memo_id: sourceId, selection }),
    headers: authHeaders,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`${response.status} /v1/explore`);
  }

  const payload = await response.json() as {
    related: { excerpt: string; node_id: string; reason: string }[];
  };

  return payload.related.map((item) => ({
    // 引文能出站就意味着已通过后端逐字复核，那是 /v1/explore 的硬门槛
    excerptVerified: item.excerpt.length > 0,
    hasReason: item.reason.trim().length > 0,
    title: titleById.get(item.node_id) ?? item.node_id,
  }));
};

const channels: ExploreChannel[] = ["keyword", "hybrid", "hybrid_judged"];
const outcomes: ExploreEvalOutcome[] = [];
let skipped = 0;

for (const item of exploreEvalCases) {
  const sourceId = byTitle.get(item.source);

  if (sourceId === undefined) {
    skipped += 1;
    console.warn(`跳过 ${item.id}: 语料里找不到「${item.source}」`);
    continue;
  }

  for (const channel of channels) {
    try {
      outcomes.push({
        caseId: item.id,
        channel,
        returned: await runChannel(channel, item.selection, sourceId),
      });
    } catch (error) {
      console.warn(`${item.id}/${channel} 失败: ${String(error)}`);
    }
  }
  console.log(`✓ ${item.id}`);
}

const table = scoreExploreByChannel(outcomes);
console.log(`\n场景 ${exploreEvalCases.length - skipped} 条 · 跳过 ${skipped}`);
console.table(Object.fromEntries(
  channels.map((channel) => [channel, table[channel]]),
));
