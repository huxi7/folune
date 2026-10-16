/**
 * [INPUT]: 依赖正式 HeroBackdrop、LoginBackdrop、ShowcaseBackdrop、LandingRailTexture 与营销纸纹
 * [OUTPUT]: 提供 MaterialSpecimens 与 hasMaterialSamples，按材质名称展示背景与三类导轨纹样
 * [POS]: DesignSystemWorkspace 的材质陈列；宿主只约束尺寸，共享组件独占效果配方
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useRef, type ReactNode } from "react";
import { useInView } from "motion/react";
import { HeroBackdrop } from "../LandingMotion/HeroBackdrop";
import { LoginBackdrop } from "../LandingMotion/LoginBackdrop";
import { ShowcaseBackdrop } from "../LandingMotion/ShowcaseBackdrop";
import { matchesReference } from "./search";
import { LandingRailTexture } from "../LandingRailTexture";
import "../../styles/landing-material.css";
import "../../styles/design-system-assets.css";

function Material({ name, className = "", children }: {
  name: string;
  className?: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLElement>(null);
  const nearViewport = useInView(host, { margin: "120px", once: true });
  return <figure className="ds-material-card" ref={host}>
    <div className={`ds-material-stage landing-blueprint ${className}`} aria-label={`${name}材质预览`}>
      {nearViewport ? children : null}
    </div>
    <figcaption><h4>{name}</h4></figcaption>
  </figure>;
}

const materialSearch = {
  hero: "hero 首页 颗粒波面",
  login: "login 登录 散墨 auth",
  showcase: "产品 展示 点阵",
  paper: "营销 纸纹 grain paper",
  rails: "章节 导轨 纹样 斜纹 曲线 网格 rail Truchet",
};

function matchesMaterial(text: string, query: string) {
  return matchesReference(`材质 背景 material texture ${text}`, query);
}

export function hasMaterialSamples(query: string) {
  return Object.values(materialSearch).some(text => matchesMaterial(text, query));
}

export function MaterialSpecimens({ query = "" }: { query?: string }) {
  const matches = (text: string) => matchesMaterial(text, query);
  return <div className="ds-material-library">
    <div className="ds-material-grid">
      {matches(materialSearch.hero) && <Material name="颗粒波面" className="landing-hero ds-material-hero"><HeroBackdrop /></Material>}
      {matches(materialSearch.login) && <Material name="登录散墨" className="auth-page ds-material-login"><LoginBackdrop /></Material>}
      {matches(materialSearch.showcase) && <Material name="流动点阵" className="ds-material-showcase"><ShowcaseBackdrop /></Material>}
      {matches(materialSearch.paper) && <Material name="纸纹" className="landing-reference ds-material-paper"><span className="ds-material-paper-label">把想法，写下来。</span></Material>}
      {matches(materialSearch.rails) && <Material name="导轨纹样" className="ds-material-rails">
        {(["paper", "weave", "index"] as const).map(variant => <div className="ds-material-rail" key={variant}>
          <LandingRailTexture reveal="after-frame" variant={variant} /><small>{variant === "paper" ? "斜纹" : variant === "weave" ? "Truchet" : "网格"}</small>
        </div>)}
      </Material>}
    </div>
  </div>;
}
