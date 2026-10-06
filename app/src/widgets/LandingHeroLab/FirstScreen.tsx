/**
 * [INPUT]: 依赖生产品牌/按钮/导轨/素材/样式，Lab 参数与动画状态，可选 LandingEditor
 * [OUTPUT]: 对外提供与正式页同排版同文案的完整首屏和可选 APP 衔接；公告指向首页核心功能
 * [POS]: 独立展示装配；导航仅打开公开入口，不挂载 Router/Auth 或更改共享组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, useEffect, useRef } from "react";
import type { CSSProperties, Ref } from "react";
import { BrandMark } from "../../shared/design-system/components/BrandMark";
import { Button } from "../../shared/design-system/components/Button";
import { BlueprintFrame } from "../BlueprintFrame";
import { BlueprintDivider } from "../BlueprintDivider";
import { referenceAssets as assets } from "../landingReferenceData";
import { HeroArtwork } from "./HeroArtwork";
import type { ArtworkHandle, ShaderStatus } from "./HeroArtwork";
import type { Snapshot } from "./presets";
import { useAmbientMotion } from "./useAmbientMotion";

const LandingEditor = lazy(() => import("../LandingEditor").then(module => ({ default: module.LandingEditor })));
const navItems = [
  { href: "/#features", label: "功能", dropdown: true }, { href: "/blog", label: "博客" },
  { href: "/#resources", label: "关于", dropdown: true }, { href: "/#use-cases", label: "使用场景" },
  { href: "https://zed.dev/docs", label: "参考文档" }, { href: "https://zed.dev/pricing", label: "参考定价" },
  { href: "https://zed.dev/delta", label: "Delta", icon: "19-4560/imgFrame2" },
];
const values = [
  { title: "专注记录", text: "先把想法写下来，不必想好标题，也不必急着选文件夹。" },
  { title: "有序归档", text: "让 AI 按内容整理笔记；归档去向看得见，不合适可以撤销。" },
  { title: "连接想法", text: "把相关笔记放进画布，连一连、补几句，让思路继续展开。" },
];
function OpenButton({ primary = false }: { primary?: boolean }) {
  return <Button variant={primary ? "primary" : "ghost"} onClick={() => window.open("/?auth=login", "_blank", "noopener,noreferrer")}>打开</Button>;
}
function DownloadButton() {
  return <Button variant="secondary" disabled title="桌面版即将推出" aria-label="下载，桌面版即将推出">下载</Button>;
}
function LabHeader() {
  return <header className="marketing-header"><BlueprintFrame fullBleed>
    <div className="ds-container marketing-nav">
      <a href="/" target="_blank" rel="noreferrer" aria-label="返回首页"><BrandMark className="marketing-brand" /></a>
      <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">{navItems.map(item => <a className="marketing-nav-link" href={item.href} key={item.href} target="_blank" rel="noreferrer">
        {item.icon && <img src={assets[item.icon]} alt="" width="14" height="14" />}{item.label}
        {item.dropdown && <img src={assets["19-4560/imgFrame1"]} alt="" width="14" height="14" />}
      </a>)}</nav>
      <div className="flex items-center gap-2">
        <span className="marketing-edition" aria-label="搜索快捷键示意：Command Shift P">
          <img src={assets["19-4560/imgFrame3"]} alt="" width="12" height="12" />
          <kbd><img src={assets["19-4560/imgFrame4"]} alt="Command" width="10" height="10" /><img src={assets["19-4560/imgFrame5"]} alt="Shift" width="14" height="14" />P</kbd>
        </span><OpenButton /><DownloadButton />
      </div>
    </div>
  </BlueprintFrame><BlueprintDivider flush fullBleed /></header>;
}

export function FirstScreen({ snapshot, paused, showApp, onStatus, artworkRef, onHeight, onRunning }: {
  snapshot: Snapshot; paused: boolean; showApp: boolean; onStatus: (status: ShaderStatus) => void;
  artworkRef: Ref<ArtworkHandle>; onHeight: (height: number) => void; onRunning: (running: boolean) => void;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const { ref, running } = useAmbientMotion(paused);
  useEffect(() => { onRunning(running); }, [running, onRunning]);
  useEffect(() => {
    const root = screen.current;
    if (!root) return;
    const measure = () => {
      const around = [".marketing-header", ".landing-announcement", ".landing-value-strip"].reduce((total, selector) => total + (root.querySelector(selector)?.getBoundingClientRect().height ?? 0), 64);
      root.style.setProperty("--lab-surrounding-height", `${around}px`);
      onHeight(Math.round(root.querySelector(".grain-lab-hero")?.getBoundingClientRect().height ?? 0));
    };
    const observer = new ResizeObserver(measure);
    for (const selector of [".marketing-header", ".landing-announcement", ".landing-value-strip", ".grain-lab-hero"]) {
      const node = root.querySelector(selector);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [onHeight]);
  const style = { "--lab-requested-height": `${snapshot.height}svh` } as CSSProperties;
  return <div ref={screen} className="landing-blueprint grain-lab-screen" style={style} data-immersive={snapshot.height >= 76}>
    <LabHeader />
    <BlueprintFrame fullBleed><main>
      <div className="landing-announcement"><span>认识 Folune：</span><a href="/#features" target="_blank" rel="noreferrer">让记录自然发生，让想法有序生长 <span>→</span></a><BlueprintDivider flush fullBleed /></div>
      <section ref={ref} className="landing-hero grain-lab-hero" aria-labelledby="grain-lab-title">
        <HeroArtwork ref={artworkRef} snapshot={snapshot} running={running} onStatus={onStatus} />
        <div className="landing-hero-copy"><h1 id="grain-lab-title">随手记下，自然有序。</h1><p>在 Folune，专注记录当下的想法。<br />让 AI 帮你整理、连接，再次发现。</p></div>
        <div className="grain-lab-actions"><div className="landing-actions"><OpenButton primary /><DownloadButton /></div><p className="landing-action-note">打开即可使用网页版 · 桌面版即将推出</p></div>
      </section>
      <BlueprintDivider flush fullBleed />
      <div className="landing-value-strip grain-lab-values">{values.map(item => <div key={item.title}><h2>{item.title}</h2><p>{item.text}</p></div>)}</div>
      <BlueprintDivider flush fullBleed />
      {showApp && <section className="landing-editor-section" aria-label="Folune APP 衔接预览"><Suspense fallback={<div className="grain-lab-app-loading">正在载入现有 APP 展示…</div>}><LandingEditor /></Suspense></section>}
    </main></BlueprintFrame>
  </div>;
}
