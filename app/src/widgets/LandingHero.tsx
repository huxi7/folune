/**
 * [INPUT]: 依赖共享 Button、BlueprintDivider、HeroBackdrop 选定颗粒背景与 LandingEditor
 * [OUTPUT]: 对外提供渐变公告、60svh 居中 Hero、定稿三列价值条与真实 UI 展示；量取顶栏/公告/三栏为矮屏保留产品露出空间
 * [POS]: widgets 的中文首页首屏；02A 背景独立加载，打开复用认证、下载以主按钮预留，与顶栏保持相同动作层级，分区边界复用通栏导轨和交点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Button } from "../shared/design-system/components";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { BlueprintDivider } from "./BlueprintDivider";
import { LandingEditor } from "./LandingEditor";
import { HeroBackdrop } from "./LandingMotion/HeroBackdrop";

export function LandingActions() {
  const [, setSearchParams] = useSearchParams();
  return <div className="landing-actions">
    <Button variant="secondary" onClick={() => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set("auth", "login"); return next; }, { replace: true, preventScrollReset: true })}>
      打开
    </Button>
    <Button variant="primary">
      下载
    </Button>
  </div>;
}

export function LandingHero() {
  const heroRef = useRef<HTMLElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);
  const valuesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const header = hero.closest(".landing-blueprint")?.querySelector<HTMLElement>(".marketing-header");
    const surrounding = [header, announcementRef.current, valuesRef.current].filter((element): element is HTMLElement => Boolean(element));
    // ---- 与选定 Demo 同一高度预算：真实周边高度 + 64px 产品露出 ----
    const measure = () => {
      const reserved = surrounding.reduce((total, element) => total + element.getBoundingClientRect().height, 64);
      hero.style.setProperty("--landing-hero-surrounding-height", `${reserved}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    surrounding.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <>
    <div ref={announcementRef} className="landing-announcement"><span>认识 Folune：</span> <a href="#workflow">让记录自然发生，让想法有序生长 <span>→</span></a><BlueprintDivider flush fullBleed /></div>
    <section ref={heroRef} className="landing-hero" aria-labelledby="landing-title">
      <HeroBackdrop />
      <div className="landing-hero-copy"><h1 id="landing-title" tabIndex={-1}>随手记下，自然有序。</h1><p>在 Folune，专注记录当下的想法。<br />让 AI 帮你整理、连接，再次发现。</p></div>
      <div><LandingActions /><p className="landing-action-note">打开即可使用网页版 · 桌面版即将推出</p></div>
    </section>
    <BlueprintDivider flush fullBleed />
    <div ref={valuesRef} className="landing-value-strip">
      <div><h2>专注记录</h2><p>先把想法写下来，不必想好标题，也不必急着选文件夹。</p></div>
      <div><h2>有序归档</h2><p>让 AI 按内容整理笔记；归档去向看得见，不合适可以撤销。</p></div>
      <div><h2>连接想法</h2><p>把相关笔记放进画布，连一连、补几句，让思路继续展开。</p></div>
    </div>
    <BlueprintDivider flush fullBleed />
    <section className="landing-editor-section" aria-label="Folune 互动体验"><LandingEditor /></section>
    <BlueprintDivider fullBleed />
  </>;
}
