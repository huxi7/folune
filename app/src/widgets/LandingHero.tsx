/**
 * [INPUT]: 依赖共享 Button、BlueprintDivider、参考原始素材与 LandingEditor
 * [OUTPUT]: 对外提供渐变公告、居中 Hero、三列能力条与真实 UI 互动展示；公告及能力条边界复用通栏导轨和交点
 * [POS]: widgets 的中文首页首屏；共享行动区与顶栏共用同一个两字动词「打开」，与「下载」构成 2+2 等密度并列，经既有 auth query 打开唯一登录/注册弹窗，下载仅展示待发布状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Button } from "../shared/design-system/components";
import { useSearchParams } from "react-router-dom";
import { BlueprintDivider } from "./BlueprintDivider";
import { LandingEditor } from "./LandingEditor";

export function LandingActions() {
  const [, setSearchParams] = useSearchParams();
  return <div className="landing-actions">
    <Button variant="primary" onClick={() => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set("auth", "login"); return next; }, { replace: true, preventScrollReset: true })}>
      打开
    </Button>
    <Button variant="secondary" disabled title="桌面版即将推出" aria-label="下载，桌面版即将推出">
      下载
    </Button>
  </div>;
}

export function LandingHero() {
  return <>
    <div className="landing-announcement"><span>认识 Folune：</span> <a href="#workflow">让记录自然发生，让想法有序生长 <span>→</span></a><BlueprintDivider flush fullBleed /></div>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-pattern" aria-hidden="true" />
      <div className="landing-hero-copy"><h1 id="landing-title" tabIndex={-1}>随手记下，自然有序。</h1><p>在 Folune，专注记录当下的想法。<br />让 AI 帮你整理、连接，再次发现。</p></div>
      <div><LandingActions /><p className="landing-action-note">打开即可使用网页版 · 桌面版即将推出</p></div>
    </section>
    <BlueprintDivider flush fullBleed />
    <div className="landing-value-strip">
      <div><h2>专注记录</h2><p>像在纸上写字一样自然，让灵感先落下来，不必急着分类。</p></div>
      <div><h2>智能整理</h2><p>与 AI 一起梳理内容，让零散记录逐渐沉淀为有序的知识。</p></div>
      <div><h2>连接想法</h2><p>在笔记与画布之间自由切换，看见内容之间的新联系。</p></div>
    </div>
    <BlueprintDivider flush fullBleed />
    <section className="landing-editor-section" aria-label="Folune 互动体验"><LandingEditor /></section>
    <BlueprintDivider fullBleed />
  </>;
}
