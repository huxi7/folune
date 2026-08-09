/**
 * [INPUT]: 依赖 React lazy/Suspense、全宽 Header/公告与 1088px 正文 BlueprintFrame/Divider 骨架、MarketingHeader/Announcement、LandingHero、LandingFooter 与按需加载的 LandingSections
 * [OUTPUT]: 对外提供顶边贴视口、带主轨和 1:5 动态外轨的全宽粘性 Header、约为 Header 2/3 高的全宽随页公告、无末端节点直达 Footer 的正文导轨、首屏优先、下半页延迟加载与全宽深蓝 Footer 的 Blueprint LandingPage 页面组件
 * [POS]: app/src/pages 的 / 路由页面，被 app/router 引用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense } from "react";

import { LandingHero } from "../widgets/LandingHero";
import { LandingFooter } from "../widgets/LandingFooter";
import { BlueprintDivider } from "../widgets/BlueprintDivider";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { MarketingAnnouncement } from "../widgets/MarketingAnnouncement";
import { MarketingHeader } from "../widgets/MarketingHeader";

const LandingSections = lazy(() =>
  import("../widgets/LandingSections").then((module) => ({
    default: module.LandingSections,
  })),
);

export function LandingPage() {
  return (
    <div className="ds-page landing-blueprint">
      <BlueprintFrame className="marketing-header-frame" fullBleed>
        <BlueprintDivider flush fullBleed />
        <MarketingHeader />
        <BlueprintDivider flush fullBleed />
      </BlueprintFrame>
      <BlueprintFrame className="marketing-announcement-frame" fullBleed>
        <BlueprintDivider flush fullBleed />
        <MarketingAnnouncement />
        <BlueprintDivider flush fullBleed />
      </BlueprintFrame>
      <BlueprintFrame className="landing-blueprint-spine">
        <BlueprintDivider flush />
        <main>
          <LandingHero />
          <BlueprintDivider />
          <Suspense fallback={<div className="landing-sections-fallback" />}>
            <LandingSections />
          </Suspense>
        </main>
      </BlueprintFrame>
      <LandingFooter />
    </div>
  );
}
