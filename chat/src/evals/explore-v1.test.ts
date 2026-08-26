/**
 * [INPUT]: 依赖 Bun test、36 条探索金标准场景、语料标题清单与指标聚合器
 * [OUTPUT]: 验证场景数与唯一性、目标标题指向真实语料、A/B 分类特征、三路对比表与七项指标算法
 * [POS]: evals 的静态数据完整性门；在联网对比前保证当前 Explore v1 场景与指标聚合行为稳定可复核
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  exploreCorpusTitles,
  exploreEvalCases,
  scoreExploreByChannel,
  scoreExploreEvaluation,
  type ExploreEvalCase,
} from "./explore-v1";

/** 标题里所有长度为 2 的连续片段；中文里两个字已经足够构成一个可检索的词面单位 */
const bigrams = (text: string): string[] => {
  const compact = text.replace(/[\s、。，「」（）]/gu, "");
  return Array.from(
    { length: Math.max(0, compact.length - 1) },
    (_, index) => compact.slice(index, index + 2),
  );
};

const sharedBigrams = (item: ExploreEvalCase): string[] =>
  item.expected.flatMap((title) =>
    bigrams(title).filter((gram) => item.selection.includes(gram)));

describe("Explore V1 金标准", () => {
  test("固定为 36 条不重复场景，B 类占多数——判据必须是 B 类", () => {
    expect(exploreEvalCases).toHaveLength(36);
    expect(new Set(exploreEvalCases.map((item) => item.id)).size).toBe(36);

    const semantic = exploreEvalCases.filter((item) => item.kind === "semantic");
    expect(semantic.length).toBeGreaterThan(exploreEvalCases.length / 2);
    expect(new Set(exploreEvalCases.map((item) => item.kind)))
      .toEqual(new Set(["literal", "semantic"]));
  });

  test("语料是 60 篇，且每个 source/expected/forbidden 都指向真实存在的标题", () => {
    expect(exploreCorpusTitles).toHaveLength(60);
    expect(new Set(exploreCorpusTitles).size).toBe(60);

    const known = new Set(exploreCorpusTitles);
    for (const item of exploreEvalCases) {
      expect(known.has(item.source)).toBe(true);
      for (const title of [...item.expected, ...(item.forbidden ?? [])]) {
        expect(known.has(title)).toBe(true);
      }
    }
  });

  test("每条场景都有非空选段与至少一个期望，且从不期望召回自己", () => {
    for (const item of exploreEvalCases) {
      expect(item.selection.length).toBeGreaterThan(6);
      expect(item.expected.length).toBeGreaterThan(0);
      expect(item.expected).not.toContain(item.source);
    }
  });

  test("B 类与目标标题零字面重合，A 类必须有重合——这是两类的机器判据", () => {
    for (const item of exploreEvalCases) {
      if (item.kind === "semantic") {
        expect(sharedBigrams(item)).toEqual([]);
      } else {
        expect(sharedBigrams(item).length).toBeGreaterThan(0);
      }
    }
  });

  test("诱饵场景存在，用来度量词面像但意思无关的噪声", () => {
    const withDecoy = exploreEvalCases.filter((item) =>
      (item.forbidden ?? []).length > 0);
    expect(withDecoy.length).toBeGreaterThan(0);
    for (const item of withDecoy) {
      for (const title of item.forbidden ?? []) {
        expect(item.expected).not.toContain(title);
      }
    }
  });
});

describe("Explore V1 指标", () => {
  const cases: ExploreEvalCase[] = [
    { expected: ["甲"], id: "a", kind: "literal", selection: "甲的说法", source: "源" },
    { expected: ["乙"], forbidden: ["丙"], id: "b", kind: "semantic", selection: "另一种说法", source: "源" },
  ];

  test("A/B 两类召回分开统计，诱饵与空结果各自成率", () => {
    expect(scoreExploreEvaluation([
      {
        caseId: "a",
        channel: "keyword",
        returned: [{ excerptVerified: true, hasReason: true, title: "甲" }],
      },
      { caseId: "b", channel: "keyword", returned: [] },
    ], cases)).toEqual({
      decoy_rate: 0,
      empty_rate: 0.5,
      excerpt_verified_rate: 1,
      literal_recall_rate: 1,
      reason_rate: 1,
      recall_rate: 0.5,
      semantic_recall_rate: 0,
    });
  });

  test("诱饵命中与缺理由如实计入", () => {
    expect(scoreExploreEvaluation([
      {
        caseId: "b",
        channel: "hybrid",
        returned: [
          { excerptVerified: false, hasReason: false, title: "丙" },
          { excerptVerified: true, hasReason: true, title: "乙" },
        ],
      },
    ], cases)).toMatchObject({
      decoy_rate: 1,
      excerpt_verified_rate: 0.5,
      reason_rate: 0.5,
      semantic_recall_rate: 1,
    });
  });

  test("三路对比表按通道切分，同一批场景并排出数", () => {
    const table = scoreExploreByChannel([
      { caseId: "b", channel: "keyword", returned: [] },
      {
        caseId: "b",
        channel: "hybrid_judged",
        returned: [{ excerptVerified: true, hasReason: true, title: "乙" }],
      },
    ], cases);

    expect(table.keyword.semantic_recall_rate).toBe(0);
    expect(table.hybrid_judged.semantic_recall_rate).toBe(1);
    expect(table.hybrid.semantic_recall_rate).toBe(0);
  });
});
