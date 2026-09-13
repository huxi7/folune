/**
 * [INPUT]: 依赖共享 Button、BlueprintDivider、参考原始素材与 LandingEditor
 * [OUTPUT]: 对外提供参考公告、居中 Hero、三列能力条与紧随其后的编辑器展示
 * [POS]: widgets 的首页首屏；文案与图像在第一阶段保持参考状态供截图校准
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Button } from "../shared/design-system/components";
import { BlueprintDivider } from "./BlueprintDivider";
import { LandingEditor } from "./LandingEditor";
import { referenceAssets as assets } from "./landingReferenceData";

export function LandingActions() {
  return <div className="landing-actions">
    <Button variant="primary" onClick={() => { window.location.href = "https://zed.dev/download"; }}>
      <img alt="" src={assets["hero/imgFrame3"]} width="14" height="14" />Download now<kbd>D</kbd>
    </Button>
    <Button variant="secondary" onClick={() => { window.location.href = "https://github.com/zed-industries/zed"; }}>
      <img alt="" src={assets["hero/imgFrame4"]} width="14" height="14" />Clone source<kbd>C</kbd>
    </Button>
  </div>;
}

export function LandingHero() {
  return <>
    <div className="landing-announcement"><span>Introducing:</span> <a href="https://zed.dev/delta">Delta, a multiplayer environment for coding with agents <span>→</span></a></div>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-pattern" aria-hidden="true" />
      <div className="landing-hero-copy"><h1 id="landing-title">Your last next editor</h1><p>Zed is a minimal code editor crafted for speed and collaboration with humans and AI.</p></div>
      <div><LandingActions /><p className="landing-action-note">Available for macOS, Linux, and Windows</p></div>
    </section>
    <BlueprintDivider flush fullBleed />
    <div className="landing-value-strip">
      <div><h2>Fast</h2><p>Written from scratch in Rust to efficiently leverage multiple CPU cores and your GPU.</p></div>
      <div><h2>Agentic</h2><p>Run agents in parallel to smoothly edit files, navigate code, and run tools at native speed.</p></div>
      <div><h2>Collaborative</h2><p>Chat with teammates, code together, and share your screen and project.</p></div>
    </div>
    <section className="landing-editor-section" aria-label="Zed editor preview"><LandingEditor /></section>
    <BlueprintDivider fullBleed />
  </>;
}
