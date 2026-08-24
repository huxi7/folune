/**
 * [INPUT]: 依赖 bun:test 与 lib/explore-contracts 的纯契约导出
 * [OUTPUT]: 锁定单篇判断解析、摘录逐字复核、判否/判断失败分类计数、按把握排序与 keep_limit 截断、空白与引号归一化容忍、投影跳过空正文
 * [POS]: lib 子域探索契约的守门人，不启动 Mastra、不调用模型、不访问网络；「模型声称的事实必须对着真实正文复核」这条约束在此定型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  collectExploreResults,
  parseExploreJudgementText,
  projectExploreInput,
  type ExploreCandidate,
  type ExploreJudgeCandidate,
  type ExploreJudgedCandidate,
} from "./explore-contracts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const candidateA: ExploreJudgeCandidate = {
  content_mdx: "少则得，多则惑。一个系统若有七种错误处理、五套日志方案，则道已失矣。",
  node_id: A,
  revision: 3,
  title: "七种错误处理",
};

const candidateB: ExploreJudgeCandidate = {
  content_mdx: "每加一层抽象，都在换取灵活性的同时增加一层遮蔽。",
  node_id: B,
  revision: 5,
  title: "抽象的代价",
};

const channels = new Map([[A, ["lexical_body"]], [B, ["structural"]]]);

const kept = (
  candidate: ExploreJudgeCandidate,
  excerpt: string,
  confidence = 0.8,
): ExploreJudgedCandidate => ({
  candidate,
  judgement: {
    confidence,
    excerpt,
    keep: true,
    reason: "同一命题的另一种表述",
  },
});

describe("parseExploreJudgementText", () => {
  test("剥掉 ```json 围栏后解析单篇判断", () => {
    const text = '```json\n{"keep":true,"reason":"r","excerpt":"e","confidence":0.5}\n```';
    expect(parseExploreJudgementText(text)).toEqual({
      confidence: 0.5,
      excerpt: "e",
      keep: true,
      reason: "r",
    });
  });

  test("判否只需要 keep 一个字段", () => {
    expect(parseExploreJudgementText('{"keep":false}')).toEqual({ keep: false });
  });

  test("判是缺字段或越界置信度被 schema 拒绝", () => {
    expect(() => parseExploreJudgementText('{"keep":true,"reason":"r"}')).toThrow();
    expect(() => parseExploreJudgementText(
      '{"keep":true,"reason":"r","excerpt":"e","confidence":3}',
    )).toThrow();
  });

  test("截断的输出被拒绝，不会被当成有效判断", () => {
    expect(() => parseExploreJudgementText('{"keep":true,"reason":"未写完')).toThrow();
  });
});

describe("collectExploreResults", () => {
  test("引文逐字存在于正文时保留，并带出召回通道与实际 revision", () => {
    const result = collectExploreResults(
      [kept(candidateA, "七种错误处理、五套日志方案")],
      channels,
      5,
    );

    expect(result.related).toEqual([{
      confidence: 0.8,
      excerpt: "七种错误处理、五套日志方案",
      matched_channels: ["lexical_body"],
      node_id: A,
      reason: "同一命题的另一种表述",
      revision: 3,
      title: "七种错误处理",
    }]);
    expect(result.dropped).toEqual({
      excerpt_not_found: 0,
      judge_failed: 0,
      judged_irrelevant: 0,
    });
  });

  test("编造的引文整条丢弃——这是防止用户点开发现没这句话", () => {
    const result = collectExploreResults(
      [kept(candidateA, "这句话根本不在正文里")],
      channels,
      5,
    );

    expect(result.related).toEqual([]);
    expect(result.dropped.excerpt_not_found).toBe(1);
  });

  test("只改动空白与引号的引文仍被接受", () => {
    const result = collectExploreResults(
      [kept(candidateA, "「七种错误处理、 五套日志方案」…")],
      channels,
      5,
    );

    expect(result.related).toHaveLength(1);
    expect(result.dropped.excerpt_not_found).toBe(0);
  });

  test("改写语义内容的引文仍被拒绝", () => {
    const result = collectExploreResults(
      [kept(candidateA, "七种错误处理和五套日志方案")],
      channels,
      5,
    );

    expect(result.related).toEqual([]);
    expect(result.dropped.excerpt_not_found).toBe(1);
  });

  test("判为不相关与判断失败分别计数，互不混淆", () => {
    const result = collectExploreResults(
      [
        { candidate: candidateA, judgement: { keep: false } },
        { candidate: candidateB, judgement: null },
      ],
      channels,
      5,
    );

    expect(result.related).toEqual([]);
    expect(result.dropped.judged_irrelevant).toBe(1);
    expect(result.dropped.judge_failed).toBe(1);
  });

  test("按把握排序而非按召回名次，且 keep_limit 截断", () => {
    const result = collectExploreResults(
      [
        kept(candidateA, "少则得", 0.4),
        kept(candidateB, "增加一层遮蔽", 0.9),
      ],
      channels,
      1,
    );

    expect(result.related.map((item) => item.node_id)).toEqual([B]);
  });

  test("同把握时保持召回名次的稳定顺序", () => {
    const result = collectExploreResults(
      [
        kept(candidateA, "少则得", 0.7),
        kept(candidateB, "增加一层遮蔽", 0.7),
      ],
      channels,
      5,
    );

    expect(result.related.map((item) => item.node_id)).toEqual([A, B]);
  });
});

describe("projectExploreInput", () => {
  const hits: ExploreCandidate[] = [
    {
      excerpt: null,
      matched_channels: ["lexical_body"],
      node_id: A,
      rank: 1,
      revision: 3,
      title: "七种错误处理",
    },
    {
      excerpt: null,
      matched_channels: ["structural"],
      node_id: B,
      rank: 2,
      revision: 5,
      title: "抽象的代价",
    },
  ];

  test("跳过正文为空或未取回的候选", () => {
    const input = projectExploreInput(
      "查询",
      "源标题",
      hits,
      new Map([[A, { content_mdx: "  ", revision: 3 }], [B, { content_mdx: "有内容", revision: 5 }]]),
      5,
    );

    expect(input?.candidates.map((item) => item.node_id)).toEqual([B]);
  });

  test("以实际取回的 revision 为准，而非召回时的快照", () => {
    const input = projectExploreInput(
      "查询",
      "源标题",
      hits,
      new Map([[A, { content_mdx: "正文", revision: 99 }]]),
      5,
    );

    expect(input?.candidates[0]?.revision).toBe(99);
  });

  test("全部候选都没有可用正文时返回 null", () => {
    expect(projectExploreInput("查询", "源标题", hits, new Map(), 5)).toBeNull();
  });
});
