/**
 * [INPUT]: 依赖现有营销导航、BlueprintFrame/Divider 与 Landing 内容组合
 * [OUTPUT]: 对外提供 1120px 主轨、Hero 下大幅编辑器与连续分区阅读节奏的 LandingPage
 * [POS]: pages 的公开首页；页面局部样式隔离参考语言，不修改全局 Design System
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { LandingHero } from "../widgets/LandingHero";
import { LandingSections } from "../widgets/LandingSections";
import { LandingFooter } from "../widgets/LandingFooter";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { MarketingHeader } from "../widgets/MarketingHeader";

export function LandingPage() {
  return (
    <div className="ds-page landing-blueprint landing-reference">
      <a className="landing-skip-link" href="#product">Skip to content</a>
      <MarketingHeader />
      <BlueprintFrame className="landing-spine" fullBleed>
        <main id="product">
          <LandingHero />
          <LandingSections />
        </main>
      </BlueprintFrame>
      <LandingFooter />
    </div>
  );
}
