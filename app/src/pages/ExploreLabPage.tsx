/**
 * [INPUT]: 依赖 widgets/PaperRetreat 与 useExploreStage/ExploreStage 生产组件、pages/explorePresentation 的 exploreStageItems/shouldRenderExploreStars、AgentPanel/exploreClient 的 exploreMemo、styles/explore-lab.css
 * [OUTPUT]: 对外提供仅 DEV 的 ExploreLabPage，用生产 DOM 骨架与生产探索浮层配确定性假候选或真实接口结果
 * [POS]: app/src/pages 的探索态视觉实验台，沿用 ColorLabPage 的无鉴权 DEV 页范式。它刻意不自建任何布局或卡片: 纸用生产 class、退后用 PaperRetreat、排布用同一求解器、浮层就是 ExploreStage，因此这里看到的观感等于线上观感。真数据开关复用生产 exploreClient（实时取 token），不另立第二个 HTTP 边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  exploreStageItems,
  shouldRenderExploreStars,
} from "./explorePresentation";
import type {
  ExplorationCandidate,
  ExplorationDropped,
  ExplorationPhase,
} from "../shared/store/explorationStore";
import { exploreMemo } from "../widgets/AgentPanel/exploreClient";
import { ExploreStage, type WorkspaceExploration } from "../widgets/ExploreStage";
import { PaperRetreat } from "../widgets/PaperRetreat";
import { useExploreStage } from "../widgets/useExploreStage";

/** 文案刻意写成真实笔记的样子，以便同时预览真实产品观感 */
const SOURCE = [
  {
    excerpt: "熵增者，妄作之果也。妄作则凶，守静则吉。系统之道，在于不争。",
    reason: "同一命题的另一种表述：都把复杂度失控归因于「多做」",
    title: "系统之道与熵",
  },
  {
    excerpt: "为假想需求增加复杂度，是最容易被自己原谅的那种错误。",
    reason: "与你正在写的「过度设计」直接互补，给出了判据",
    title: "过度设计的代价",
  },
  {
    excerpt: "十人同作，其代码若一人所书。此非束缚，乃大自由也。",
    reason: "同一文件夹、同期写就；把「范式即约束」推到了正面",
    title: "范式与自由",
  },
  {
    excerpt: "少则得，多则惑。一系统若有七种错误处理、五套日志方案，则道已失矣。",
    reason: "共同标签「简化」，且引用了同一段原文",
    title: "少则得",
  },
  {
    excerpt: "简化是最高形式的复杂。代码写给人看，顺便让机器运行。",
    reason: "主题邻近，但论证方向不同，可作为对照",
    title: "写给人看",
  },
  {
    excerpt: "损之又损，以至于无为。删掉一个功能比加一个功能需要更多的确信。",
    reason: "时间邻近，同一思考批次",
    title: "损之又损",
  },
] as const;

const PRESETS = {
  observed: [0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  tight: [0.95, 0.94, 0.93, 0.92, 0.91, 0.9],
  wide: [0.95, 0.78, 0.6, 0.42, 0.25, 0.12],
} as const;

type PresetKey = keyof typeof PRESETS;

const PRESET_LABELS: readonly { label: string; value: PresetKey }[] = [
  { label: "实测 .95~.75", value: "observed" },
  { label: "紧密 .95~.91", value: "tight" },
  { label: "分散 .95~.25", value: "wide" },
];

const mockCandidates = (
  count: number,
  preset: PresetKey,
): ExplorationCandidate[] =>
  SOURCE.slice(0, count).map((item, index) => ({
    confidence: PRESETS[preset][index] ?? 0.5,
    excerpt: item.excerpt,
    matched_channels: ["keyword", "structure"],
    node_id: `lab-${index}`,
    reason: item.reason,
    revision: 3,
    title: item.title,
  }));

const MOCK_DROPPED: ExplorationDropped = {
  excerpt_not_found: 1,
  judge_failed: 0,
  judged_irrelevant: 4,
};

function Slider({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="explore-lab-slider">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function Choice<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  return (
    <div className="explore-lab-choice">
      <span>{label}</span>
      <div role="group">
        {options.map((option) => (
          <button
            data-active={option.value === value}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExploreLabPage() {
  const retreatRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(5);
  const [preset, setPreset] = useState<PresetKey>("observed");
  const [pending, setPending] = useState(false);
  const [staticList, setStaticList] = useState(false);
  const [dark, setDark] = useState(false);
  const [replay, setReplay] = useState(0);
  const [real, setReal] = useState<
    { candidates: ExplorationCandidate[]; dropped: ExplorationDropped } | null
  >(null);
  const [memoId, setMemoId] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilled, setDrilled] = useState<string | null>(null);

  // dark token 定义在 :root.dark，故实验室的暗色开关必须切真实根 class；卸载时复原
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    return () => {
      root.classList.toggle("dark", had);
    };
  }, [dark]);

  const candidates = useMemo(
    () => real?.candidates ?? mockCandidates(count, preset),
    [count, preset, real],
  );
  const items = useMemo(
    () => exploreStageItems(candidates, pending),
    [candidates, pending],
  );
  const plan = useExploreStage({ items, mounted: true, paperRef: retreatRef });
  const stars = !staticList
    && shouldRenderExploreStars({ plan, reducedMotion: false });
  const phase: ExplorationPhase = pending
    ? "pending"
    : candidates.length === 0 ? "empty" : "ready";

  const exploration: WorkspaceExploration = {
    active: true,
    candidates,
    dismiss: () => setDrilled("（消散）"),
    dropped: real?.dropped ?? MOCK_DROPPED,
    drill: (nodeId) => setDrilled(nodeId),
    exploring: pending,
    items,
    mounted: true,
    phase,
    save: async (offsets) => setDrilled(`保存 ${offsets.length} 条`),
    savedCanvasId: null,
  };

  const callReal = async () => {
    setRequesting(true);
    setError(null);
    try {
      const result = await exploreMemo({ memoId: memoId.trim() });
      setReal({ candidates: result.related, dropped: result.dropped });
      setPending(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "未知错误");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <main className="explore-lab">
      <div
        className="app-workspace"
        data-assistant-open={false}
        data-exploring={true}
        data-library-open={false}
        data-overlay-panels={false}
      >
        <div className="paper-stage-scroll">
          <div className="paper-stage-layout">
            <PaperRetreat
              exploring
              plan={plan}
              ref={retreatRef}
              retreated={stars}
            >
              <section className="app-main-panel paper-surface">
                <main className="notes-workspace">
                  <article className="note-editor-canvas" data-document-view="reading">
                    <h1 className="note-editor-title">过度设计与熵</h1>
                    <div className="note-reading-surface">
                      <p>
                        为学日益，为道日损。系统的复杂度失控，多数时候不是因为少做了什么，
                        而是因为在还不确定需要的时候就先做了。
                      </p>
                      <p>一系统若有七种错误处理、五套日志方案，则道已失矣。</p>
                      <p>这句话我以前应该写过类似的——但我记不起在哪。</p>
                    </div>
                  </article>
                </main>
              </section>
            </PaperRetreat>
          </div>
        </div>
      </div>

      <ExploreStage
        exploration={exploration}
        key={replay}
        plan={plan}
        stars={stars}
      />

      <aside className="explore-lab-controls">
        <header>
          <strong>Explore Lab</strong>
          <span>DEV · 无鉴权 · 生产组件</span>
        </header>

        <Slider
          label="候选数"
          max={SOURCE.length}
          min={0}
          onChange={(next) => {
            setReal(null);
            setCount(next);
          }}
          value={real === null ? count : real.candidates.length}
        />
        <Choice
          label="置信度分布"
          onChange={(next) => {
            setReal(null);
            setPreset(next);
          }}
          options={PRESET_LABELS}
          value={preset}
        />

        <div className="explore-lab-toggles">
          <button data-active={pending} onClick={() => setPending(!pending)} type="button">等待中</button>
          <button data-active={staticList} onClick={() => setStaticList(!staticList)} type="button">静态清单</button>
          <button data-active={dark} onClick={() => setDark(!dark)} type="button">暗色</button>
          <button onClick={() => setReplay((value) => value + 1)} type="button">重播出场</button>
        </div>

        <div className="explore-lab-readout">
          {plan === null ? <span>正在量纸…</span> : (
            <>
              <span>
                纸缩放 <b>{Math.round(plan.paper.scale * 100)}%</b>
                {" · "}卡片 <b>{plan.card.width}×{plan.card.height}</b>
                {plan.viable ? "" : " · 排不开"}
              </span>
              {plan.slots.map((slot) => (
                <span key={slot.id}>
                  {slot.side === "left" ? "左" : "右"} · 距中心 <b>{Math.round(slot.distance)}</b>
                </span>
              ))}
            </>
          )}
          {drilled === null ? null : <span>下钻 <b>{drilled}</b></span>}
        </div>

        <div className="explore-lab-real">
          <label htmlFor="explore-lab-memo">真数据（需先在 /app 登录过）</label>
          <input
            id="explore-lab-memo"
            onChange={(event) => setMemoId(event.target.value)}
            placeholder="memo_id (UUID)"
            value={memoId}
          />
          <button
            disabled={requesting || memoId.trim().length === 0}
            onClick={() => void callReal()}
            type="button"
          >
            {requesting ? "调用中…" : "调 /v1/explore"}
          </button>
          {error === null ? null : <p className="explore-lab-error">{error}</p>}
          {real === null ? null : (
            <p>
              真实返回 {real.candidates.length} 条 · 丢弃{" "}
              {real.dropped.judged_irrelevant + real.dropped.excerpt_not_found
                + real.dropped.judge_failed}
            </p>
          )}
        </div>

        <p className="explore-lab-note">
          距离承载相关度: 越相关越靠近纸。求解器会为了拉开这段距离而压缩纸的缩放，
          因此改候选数或置信度分布时纸会跟着变——那是同一个权衡在起作用。
        </p>
      </aside>
    </main>
  );
}
