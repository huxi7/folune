/**
 * [INPUT]: 依赖 api/supabase/seed-dev-corpus.sql 那 60 篇中文语料的标题与正文（本文件只引用标题与逐字选段，不复制正文）
 * [OUTPUT]: 对外提供 exploreCorpusTitles、36 条探索金标准场景、三路通道类型与 scoreExploreEvaluation/scoreExploreByChannel 指标聚合器
 * [POS]: chat 的探索质量基线，与 memo-v2 并列而不改它。判据是 B 类: 两段话说的是同一件事却一个字都不重合——词面通道在这类场景上必然失手，因此只有 B 类的召回差距才能回答「混合检索和 Agent 阅读值不值得留」
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 语料里全部 60 篇的标题；场景引用的每一个标题都必须在此，否则金标准指向了不存在的笔记 */
export const exploreCorpusTitles: readonly string[] = [
  "熵与妄作", "复杂度失控的真实来源", "给复杂度做预算", "七种错误处理", "抽象的代价",
  "命名即契约", "边界比实现重要", "可逆性是一种资产", "不要为了对称牺牲正确", "删代码的确信度",
  "删功能比加功能更难", "冷启动的死穴", "开箱第一分钟", "用户不读说明书", "多一次决策就少一次使用",
  "差异点不能是标配", "响应速度就是聪明感", "一句话装得下才算定位", "可逆的动作用户才敢用", "订阅制要能说清贵在哪",
  "少即是多的出处", "道德经里的减法", "哥德尔、艾舍尔、巴赫", "人类简史的叙事观", "思考快与慢的实践含义",
  "禅与摩托车维修艺术", "设计心理学的门把手", "写给大家看的设计书", "如何阅读一本书", "被误放的一篇",
  "中文分词为何必要", "倒排索引是什么", "按意思找的必要性", "名次融合为何优于加权", "小语料不需要向量库",
  "SVG 描边的硬限制", "路径长度归一化的用处", "乐观更新的回滚难点", "行级权限的思路", "幂等键的作用",
  "多余的形容词", "说不清就是没想清", "结论先行", "一段只说一件事", "具体压倒抽象",
  "删掉开场的寒暄", "避免同时用两种称呼", "写给三个月后的自己", "长句不是复杂的必要代价", "标题应当是承诺",
  "想不起在哪写过", "整理欲是一种拖延", "记录的门槛决定记录量", "晚上的判断力", "散步能解决的问题类型",
  "工具会塑造想法", "把焦虑写下来", "不完美的启动", "别人的建议的正确用法", "今天的一句",
];

/**
 * literal = A 类: 选段与目标标题有字面重合，词面检索也该赢，测它只是自我安慰。
 * semantic = B 类: 选段与目标标题零字面重合，只有读懂意思才能召回——这才是判据。
 */
export type ExploreEvalKind = "literal" | "semantic";

export type ExploreEvalCase = {
  /** 必须被召回的笔记标题 */
  expected: readonly string[];
  /** 词面像但意思无关，出现即为噪声 */
  forbidden?: readonly string[];
  id: string;
  kind: ExploreEvalKind;
  /** 逐字取自 source 正文的选段，即用户按 ⌘E 时选中的那句话 */
  selection: string;
  source: string;
};

export const exploreEvalCases: readonly ExploreEvalCase[] = [
  // ---- A 类: 字面重合，两条通道都该赢 ----
  { id: "lit-entropy-complexity", kind: "literal", source: "熵与妄作", selection: "系统的复杂度失控，多数时候不是因为少做了什么", expected: ["复杂度失控的真实来源"] },
  { id: "lit-delete-code-feature", kind: "literal", source: "删代码的确信度", selection: "加一个功能只需要相信它有用，删一个功能需要相信它没用", expected: ["删功能比加功能更难"] },
  { id: "lit-reversible-action", kind: "literal", source: "可逆的动作用户才敢用", selection: "一个动作如果不可逆，用户第一次会试", expected: ["可逆性是一种资产"] },
  { id: "lit-tool-shapes-record", kind: "literal", source: "工具会塑造想法", selection: "用什么工具记录，会反过来改变记录的内容", expected: ["记录的门槛决定记录量"] },
  { id: "lit-segmentation-entropy", kind: "literal", source: "中文分词为何必要", selection: "把「熵增者妄作之果也」交给数据库自带的全文检索", expected: ["熵与妄作"] },
  { id: "lit-one-sentence", kind: "literal", source: "说不清就是没想清", selection: "写不出一句话的摘要", expected: ["一句话装得下才算定位"] },
  { id: "lit-complexity-budget", kind: "literal", source: "给复杂度做预算", selection: "像做财务预算一样给复杂度做预算", expected: ["复杂度失控的真实来源"] },
  { id: "lit-complexity-accrual", kind: "literal", source: "复杂度失控的真实来源", selection: "复杂度很少是一次性引入的", expected: ["给复杂度做预算"] },

  // ---- B 类: 零字面重合、同一意思，词面通道必然失手 ----
  // 诱饵刻意是同目录且共用「文件夹」这个词的另一篇: 词面像、意思无关，出现即噪声
  { id: "sem-forgot-where", kind: "semantic", source: "想不起在哪写过", selection: "明确感觉以前记过类似的，但翻遍文件夹找不到", expected: ["按意思找的必要性"], forbidden: ["整理欲是一种拖延"] },
  { id: "sem-search-by-meaning", kind: "semantic", source: "按意思找的必要性", selection: "两段话说的是同一件事，但一个字都不重合", expected: ["想不起在哪写过"] },
  { id: "sem-tao-subtraction", kind: "semantic", source: "道德经里的减法", selection: "前半句讲积累，后半句讲剥除。多数人只做前半句，于是越做越重", expected: ["删代码的确信度"] },
  { id: "sem-delete-conviction", kind: "semantic", source: "删代码的确信度", selection: "所以代码库只会长大。要让它变小，必须", expected: ["道德经里的减法"] },
  { id: "sem-seven-handlers", kind: "semantic", source: "七种错误处理", selection: "一个系统若有七种错误处理、五套日志方案，则道已失矣", expected: ["给复杂度做预算"] },
  { id: "sem-cold-start", kind: "semantic", source: "冷启动的死穴", selection: "功能价值随数据量超线性增长，而用户耐心在第一天就用完了", expected: ["记录的门槛决定记录量"] },
  { id: "sem-no-manual", kind: "semantic", source: "用户不读说明书", selection: "他只会试一次，试不出来就走", expected: ["设计心理学的门把手"] },
  { id: "sem-door-handle", kind: "semantic", source: "设计心理学的门把手", selection: "好的可供性让正确操作显而易见", expected: ["用户不读说明书"] },
  { id: "sem-adjectives", kind: "semantic", source: "多余的形容词", selection: "每一个可以删掉而意思不变的词，都在稀释剩下那些词的力量", expected: ["长句不是复杂的必要代价"] },
  { id: "sem-long-sentence", kind: "semantic", source: "长句不是复杂的必要代价", selection: "越复杂的想法越需要短句来承载", expected: ["说不清就是没想清"] },
  { id: "sem-conclusion-first", kind: "semantic", source: "结论先行", selection: "读者需要一个框子来放接下来的信息，否则每一句都得悬着", expected: ["标题应当是承诺"] },
  { id: "sem-title-promise", kind: "semantic", source: "标题应当是承诺", selection: "它告诉读者读完能得到什么", expected: ["结论先行"] },
  { id: "sem-tidy-procrastination", kind: "semantic", source: "整理欲是一种拖延", selection: "整理带来的秩序感是即时的，做正事的回报是延迟的", expected: ["不完美的启动"] },
  { id: "sem-naming-contract", kind: "semantic", source: "命名即契约", selection: "改名的成本不在于替换字符串，在于那些不会报错的地方", expected: ["避免同时用两种称呼"] },
  { id: "sem-two-names", kind: "semantic", source: "避免同时用两种称呼", selection: "同一个概念在一篇文里出现两个名字，读者要额外维护一张对照表", expected: ["命名即契约"] },
  { id: "sem-abstraction-cost", kind: "semantic", source: "抽象的代价", selection: "问题出现时，你要穿过这一层才能看到真相", expected: ["不要为了对称牺牲正确"] },
  { id: "sem-system-two-lazy", kind: "semantic", source: "思考快与慢的实践含义", selection: "系统二很懒，大部分时候它只是给系统一的结论背书", expected: ["晚上的判断力"] },
  { id: "sem-write-anxiety", kind: "semantic", source: "把焦虑写下来", selection: "焦虑在脑子里是一团，写在纸上通常是三条", expected: ["说不清就是没想清"] },
  { id: "sem-idempotency", kind: "semantic", source: "幂等键的作用", selection: "同一个操作被重复提交时，用一个客户端生成的键去去重", expected: ["乐观更新的回滚难点"] },
  { id: "sem-small-corpus", kind: "semantic", source: "小语料不需要向量库", selection: "几千条以内，暴力扫一遍算距离比建近邻索引更快", expected: ["名次融合为何优于加权"] },
  { id: "sem-concrete-beats", kind: "semantic", source: "具体压倒抽象", selection: "「性能很差」不如「打开一个页面要八秒」", expected: ["多余的形容词"] },
  { id: "sem-first-minute", kind: "semantic", source: "开箱第一分钟", selection: "不是看到功能列表，不是看到引导教程", expected: ["用户不读说明书"] },
  { id: "sem-one-point", kind: "semantic", source: "一段只说一件事", selection: "一段里塞两个论点，读者会记住其中一个", expected: ["结论先行"] },
  { id: "sem-quality-recognized", kind: "semantic", source: "禅与摩托车维修艺术", selection: "你看到一个东西做得对，会先有感觉，然后才找到理由", expected: ["别人的建议的正确用法"] },
  { id: "sem-walk-problem", kind: "semantic", source: "散步能解决的问题类型", selection: "卡住的问题分两类：缺信息的，和缺角度的", expected: ["别人的建议的正确用法"] },
  { id: "sem-decision-fatigue", kind: "semantic", source: "多一次决策就少一次使用", selection: "用户根本不知道该选哪个", expected: ["记录的门槛决定记录量"] },
  { id: "sem-response-speed", kind: "semantic", source: "响应速度就是聪明感", selection: "两秒的空白等待，会让最好的结果显得笨", expected: ["开箱第一分钟"] },
  { id: "sem-less-is-more", kind: "semantic", source: "少即是多的出处", selection: "减少构件数量，让每一根都承担明确的", expected: ["七种错误处理"], forbidden: ["写给大家看的设计书"] },
];

/** 三路对比的通道: 只词面 / 混合召回 / 混合召回再加 Agent 逐篇阅读 */
export type ExploreChannel = "hybrid" | "hybrid_judged" | "keyword";

export type ExploreEvalReturned = {
  /** 引文是否通过了后端的逐字复核 */
  excerptVerified: boolean;
  /** 是否给出了非空的判定理由 */
  hasReason: boolean;
  title: string;
};

export type ExploreEvalOutcome = {
  caseId: string;
  channel: ExploreChannel;
  returned: readonly ExploreEvalReturned[];
};

const ratio = (hits: number, total: number): number =>
  total === 0 ? 0 : hits / total;

/**
 * 指标只回答三个问题: 该找到的找到了吗（分 A/B 两类看）、找回来的是不是噪声、
 * 以及每一条是不是都带着可复核的理由与引文。没有 F1 之类的复合分数，
 * 因为决策只需要「B 类召回差多少」这一个数。
 */
export const scoreExploreEvaluation = (
  outcomes: readonly ExploreEvalOutcome[],
  cases: readonly ExploreEvalCase[] = exploreEvalCases,
) => {
  const caseById = new Map(cases.map((item) => [item.id, item]));
  let expectedTotal = 0;
  let expectedHit = 0;
  let semanticTotal = 0;
  let semanticHit = 0;
  let literalTotal = 0;
  let literalHit = 0;
  let decoyCases = 0;
  let decoyHitCases = 0;
  let returnedTotal = 0;
  let withReason = 0;
  let withVerifiedExcerpt = 0;
  let emptyCases = 0;

  for (const outcome of outcomes) {
    const item = caseById.get(outcome.caseId);

    if (item === undefined) {
      continue;
    }

    const titles = new Set(outcome.returned.map((entry) => entry.title));
    const hits = item.expected.filter((title) => titles.has(title)).length;

    expectedTotal += item.expected.length;
    expectedHit += hits;

    if (item.kind === "semantic") {
      semanticTotal += item.expected.length;
      semanticHit += hits;
    } else {
      literalTotal += item.expected.length;
      literalHit += hits;
    }

    if (item.forbidden !== undefined && item.forbidden.length > 0) {
      decoyCases += 1;
      if (item.forbidden.some((title) => titles.has(title))) {
        decoyHitCases += 1;
      }
    }

    if (outcome.returned.length === 0) {
      emptyCases += 1;
    }

    returnedTotal += outcome.returned.length;
    withReason += outcome.returned.filter((entry) => entry.hasReason).length;
    withVerifiedExcerpt += outcome.returned
      .filter((entry) => entry.excerptVerified).length;
  }

  return {
    decoy_rate: ratio(decoyHitCases, decoyCases),
    empty_rate: ratio(emptyCases, outcomes.length),
    excerpt_verified_rate: ratio(withVerifiedExcerpt, returnedTotal),
    literal_recall_rate: ratio(literalHit, literalTotal),
    reason_rate: ratio(withReason, returnedTotal),
    recall_rate: ratio(expectedHit, expectedTotal),
    semantic_recall_rate: ratio(semanticHit, semanticTotal),
  };
};

/** 三路对比表: 同一批场景在三个通道上各跑一次，只有并排看才知道该留谁 */
export const scoreExploreByChannel = (
  outcomes: readonly ExploreEvalOutcome[],
  cases: readonly ExploreEvalCase[] = exploreEvalCases,
): Record<ExploreChannel, ReturnType<typeof scoreExploreEvaluation>> => ({
  hybrid: scoreExploreEvaluation(
    outcomes.filter((outcome) => outcome.channel === "hybrid"),
    cases,
  ),
  hybrid_judged: scoreExploreEvaluation(
    outcomes.filter((outcome) => outcome.channel === "hybrid_judged"),
    cases,
  ),
  keyword: scoreExploreEvaluation(
    outcomes.filter((outcome) => outcome.channel === "keyword"),
    cases,
  ),
});
