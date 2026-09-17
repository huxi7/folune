/**
 * [INPUT]: 依赖 React、生产 BrandMark/Button、BlueprintFrame/Divider 与本模块纯装饰和动态生命周期
 * [OUTPUT]: 对外提供三套完整首屏候选、当前基线、方案切换与暂停控件
 * [POS]: LandingHeroLab 的单一页面装配；生产首屏没有反向依赖，链接仅指向既有公开页面，演示不装配账号状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { BrandMark } from "../../shared/design-system/components/BrandMark";
import { Button } from "../../shared/design-system/components/Button";
import { BlueprintFrame } from "../BlueprintFrame";
import { BlueprintDivider } from "../BlueprintDivider";
import { ContourArtwork, DaylightArtwork, MarginNotes, PaperArtwork } from "./HeroArtwork";
import { useAmbientMotion } from "./useAmbientMotion";

const concepts = [
  { id: "paper", code: "A", name: "纸间有序", note: "微动纸页 / 归档细线 / 纸边刻度" },
  { id: "contour", code: "B", name: "思绪成形", note: "缓慢流线 / 中央留白 / 坐标导轨" },
  { id: "daylight", code: "C", name: "纸上天光", note: "侧向书写 / 柔光纸面 / 笔记之间" },
  { id: "baseline", code: "↩", name: "原 Hero", note: "原 Hero 与三栏价值条 / 导航沿用候选布局" },
] as const;
type Concept = typeof concepts[number]["id"];

function readConcept(): Concept {
  return concepts.find(item => item.id === window.location.hash.slice(1))?.id ?? "paper";
}

const values = [
  { title: "专注记录", description: "先把想法写下来，不必想好标题，也不必急着选文件夹。", label: "WRITE", icon: "M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8 M8 16h6" },
  { title: "有序归档", description: "让 AI 按内容整理笔记；归档去向看得见，不合适可以撤销。", label: "ORGANIZE", icon: "M3 7h7l2 2h9v11H3z M3 7V4h6l2 3 M8 14l3 3 5-5" },
  { title: "连接想法", description: "把相关笔记放进画布，连一连、补几句，让思路继续展开。", label: "CONNECT", icon: "M3 4h6v7H3z M15 14h6v7h-6z M9 7h5v11h1" },
];
const oldValues = [
  ["专注记录", "像在纸上写字一样自然，让灵感先落下来，不必急着分类。"],
  ["智能整理", "与 AI 一起梳理内容，让零散记录逐渐沉淀为有序的知识。"],
  ["连接想法", "在笔记与画布之间自由切换，看见内容之间的新联系。"],
];

function OpenButton({ primary = false }: { primary?: boolean }) {
  return <Button variant={primary ? "primary" : "ghost"} onClick={() => window.open("/?auth=login", "_blank", "noopener,noreferrer")}>打开</Button>;
}

function LabHeader() {
  return <header className="marketing-header hero-lab-header"><BlueprintFrame fullBleed>
    <div className="ds-container marketing-nav">
      <a href="/" target="_blank" rel="noreferrer" aria-label="Folune 首页"><BrandMark className="marketing-brand" /></a>
      <nav aria-label="主导航">
        <a className="marketing-nav-link" href="/#features" target="_blank" rel="noreferrer">功能</a>
        <a className="marketing-nav-link" href="/blog" target="_blank" rel="noreferrer">博客</a>
        <a className="marketing-nav-link" href="/#resources" target="_blank" rel="noreferrer">创作者的信</a>
      </nav>
      <div className="hero-lab-header-actions"><OpenButton /><Button variant="secondary" disabled title="桌面版即将推出">下载</Button></div>
    </div>
  </BlueprintFrame><BlueprintDivider flush fullBleed /></header>;
}

function FirstScreen({ concept, paused }: { concept: Concept; paused: boolean }) {
  const { ref, running } = useAmbientMotion(paused);
  const baseline = concept === "baseline";
  return <div className={`landing-blueprint landing-reference hero-lab-screen hero-lab-${concept}`}>
    <LabHeader />
    <BlueprintFrame fullBleed>
      <main>
        <div className="landing-announcement hero-lab-announcement"><span>认识 Folune</span><a href="/blog/write-first-organize-later" target="_blank" rel="noreferrer">{baseline ? "让记录自然发生，让想法有序生长" : "从随手记录，到有序积累"}<span>→</span></a><BlueprintDivider flush fullBleed /></div>
        <section ref={ref} className={baseline ? "landing-hero" : "hero-lab-hero"} aria-labelledby="hero-lab-title" data-running={running}>
          {baseline ? <div className="landing-hero-pattern" aria-hidden="true" /> : <>
            <MarginNotes kind={concept} />
            {concept === "paper" ? <PaperArtwork /> : concept === "contour" ? <ContourArtwork /> : <DaylightArtwork />}
          </>}
          <div className={baseline ? "landing-hero-copy" : "hero-lab-copy"}>
            {!baseline && <p className="hero-lab-eyebrow">给想法，一个落脚的地方</p>}
            <h1 id="hero-lab-title">随手记下，{!baseline && <br className="hero-lab-title-break" />}自然有序。</h1>
            <p className="hero-lab-description">{baseline ? <>在 Folune，专注记录当下的想法。<br />让 AI 帮你整理、连接，再次发现。</> : <>先留下此刻的想法，再让 AI 帮你整理。<br />散落的笔记，也能连成下一次思考。</>}</p>
            {!baseline && <Actions />}
          </div>
          {baseline && <Actions />}
        </section>
        <BlueprintDivider flush fullBleed />
        <div className={`landing-value-strip ${baseline ? "" : "hero-lab-values"}`}>
          {baseline ? oldValues.map(([title, description]) => <div key={title}><h2>{title}</h2><p>{description}</p></div>) : values.map((value, index) => <div key={value.title}>
            <div className="hero-lab-value-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d={value.icon} /></svg><span>0{index + 1} / {value.label}</span></div>
            <h2>{value.title}</h2><p>{value.description}</p>
          </div>)}
        </div>
        <BlueprintDivider flush fullBleed />
      </main>
    </BlueprintFrame>
  </div>;
}

function Actions() {
  return <div className="hero-lab-actions"><div className="landing-actions"><OpenButton primary /><Button variant="secondary" disabled title="桌面版即将推出" aria-label="下载，桌面版即将推出">下载</Button></div><p className="landing-action-note">网页版现已可用 · 桌面版即将推出</p></div>;
}

export function HeroLab() {
  const [concept, setConcept] = useState<Concept>(readConcept);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const sync = () => setConcept(readConcept());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const current = concepts.find(item => item.id === concept)!;

  return <div className="hero-lab">
    <div className="hero-lab-controls" aria-label="首屏方案比较">
      <span className="hero-lab-control-label">FOLUNE <span>首屏研究</span></span>
      <div className="hero-lab-tabs" role="group" aria-label="选择首屏方案">{concepts.map(item => <button type="button" key={item.id} aria-pressed={item.id === concept} onClick={() => { setConcept(item.id); window.history.replaceState(null, "", `#${item.id}`); }}><span>{item.code}</span>{item.name}</button>)}</div>
      <button className="hero-lab-pause" type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "播放动态" : "暂停动态"}</button>
    </div>
    <FirstScreen key={concept} concept={concept} paused={paused} />
    <div className="hero-lab-caption" aria-live="polite"><span>{current.code} / {current.name}</span><span>{current.note}</span><a href="/" target="_blank" rel="noreferrer">查看正式页面 ↗</a></div>
  </div>;
}
