/**
 * [INPUT]: 依赖 React、生产 BrandMark/Button、BlueprintFrame/Divider 与 Paper Shaders 背景和动态生命周期
 * [OUTPUT]: 对外提供六套居中文案的 Shader/组件库首屏、方案切换与运行反馈
 * [POS]: LandingHeroLab 的单一页面装配；生产首屏没有反向依赖，链接仅指向既有公开页面，演示不装配账号状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { BrandMark } from "../../shared/design-system/components/BrandMark";
import { Button } from "../../shared/design-system/components/Button";
import { BlueprintFrame } from "../BlueprintFrame";
import { BlueprintDivider } from "../BlueprintDivider";
import { LibraryArtwork } from "./LibraryArtwork";
import { HeroArtwork, type ShaderStatus } from "./HeroArtwork";
import { useAmbientMotion } from "./useAmbientMotion";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";

const concepts = [
  { id: "grain", code: "A", name: "纸墨流动", note: "Paper Shaders · GrainGradient · 颗粒色场" },
  { id: "silk", code: "B", name: "墨色流光", note: "Paper Shaders · Warp · 流动绸面" },
  { id: "rays", code: "C", name: "窗间天光", note: "Paper Shaders · GodRays · 斜向光影" },
  { id: "dither", code: "D", name: "墨点潮汐", note: "Paper Shaders · Dithering · 印刷波纹" },
  { id: "waves", code: "E", name: "纸纹行云", note: "React Bits · Waves · 连续线场" },
  { id: "beams", code: "F", name: "思路留痕", note: "Aceternity UI · Background Beams · 流动墨迹" },
] as const;
type Concept = typeof concepts[number]["id"];

function readConcept(): Concept {
  return concepts.find(item => item.id === window.location.hash.slice(1))?.id ?? "grain";
}

const values = [
  { title: "专注记录", description: "先把想法写下来，不必想好标题，也不必急着选文件夹。" },
  { title: "有序归档", description: "让 AI 按内容整理笔记；归档去向看得见，不合适可以撤销。" },
  { title: "连接想法", description: "把相关笔记放进画布，连一连、补几句，让思路继续展开。" },
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

function FirstScreen({ concept, paused, onStatus }: { concept: Concept; paused: boolean; onStatus: (status: ShaderStatus) => void }) {
  const { ref, running } = useAmbientMotion(paused);
  return <div className={`landing-blueprint hero-lab-screen hero-lab-${concept}`}>
    <LabHeader />
    <BlueprintFrame fullBleed>
      <main>
        <div className="landing-announcement hero-lab-announcement"><span>认识 Folune</span><a href="/blog/write-first-organize-later" target="_blank" rel="noreferrer">从随手记录，到有序积累<span>→</span></a><BlueprintDivider flush fullBleed /></div>
        <section ref={ref} className="hero-lab-hero" aria-labelledby="hero-lab-title" data-running={running}>
          {concept === "waves" || concept === "beams" ? <LibraryArtwork concept={concept} running={running} onStatus={onStatus} /> : <HeroArtwork concept={concept} running={running} onStatus={onStatus} />}
          <div className="hero-lab-margin-ticks" aria-hidden="true" />
          <div className="hero-lab-copy">
            <h1 id="hero-lab-title">随手记下，<br className="hero-lab-title-break" />自然有序。</h1>
            <p className="hero-lab-description">先留下此刻的想法，再让 AI 帮你整理。<br />散落的笔记，也能连成下一次思考。</p>
            <Actions />
          </div>
        </section>
        <BlueprintDivider flush fullBleed />
        <div className="landing-value-strip hero-lab-values">
          {values.map(value => <div key={value.title}>
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
  const [shaderStatus, setShaderStatus] = useState<ShaderStatus>("loading");
  const reduced = useMotionPreference();
  useEffect(() => {
    const sync = () => { setShaderStatus("loading"); setConcept(readConcept()); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const current = concepts.find(item => item.id === concept)!;

  return <div className="hero-lab">
    <div className="hero-lab-controls" aria-label="首屏方案比较">
      <span className="hero-lab-control-label">FOLUNE <span>首屏研究</span></span>
      <div className="hero-lab-tabs" role="group" aria-label="选择首屏方案">{concepts.map(item => <button type="button" key={item.id} aria-pressed={item.id === concept} onClick={() => { if (item.id === concept) return; setShaderStatus("loading"); setConcept(item.id); window.history.replaceState(null, "", `#${item.id}`); }}><span>{item.code}</span>{item.name}</button>)}</div>
      <button className="hero-lab-pause" type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "播放动态" : "暂停动态"}</button>
    </div>
    <FirstScreen key={concept} concept={concept} paused={paused} onStatus={setShaderStatus} />
    <div className="hero-lab-caption" aria-live="polite"><span>{current.code} / {current.name}</span><span>{current.note}</span><span role="status" data-status={shaderStatus}>{shaderStatus === "unavailable" ? "背景未能启动" : shaderStatus === "loading" ? "正在加载背景…" : reduced ? "系统减少动态效果已开启" : paused ? "已暂停" : concept === "waves" ? "Canvas 2D · 动态预览" : concept === "beams" ? "Motion SVG · 动态预览" : "WebGL2 · 动态预览"}</span><a href="/" target="_blank" rel="noreferrer">查看正式页面 ↗</a></div>
  </div>;
}
