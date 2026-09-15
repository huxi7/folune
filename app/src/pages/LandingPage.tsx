/**
 * [INPUT]: 依赖 BlueprintFrame 与 Landing 内容组合，外层布局由 MarketingLayout 持有
 * [OUTPUT]: 对外提供 1120px 主轨、Hero 下大幅编辑器与连续分区阅读节奏的 LandingPage
 * [POS]: pages 的公开首页正文；中文语言与顶栏由 MarketingLayout 声明，复用 DS 字体回退与按钮，原布局由页面局部样式承载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { LandingHero } from "../widgets/LandingHero";
import { LandingSections } from "../widgets/LandingSections";
import { BlueprintFrame } from "../widgets/BlueprintFrame";

export function LandingPage() {
  return (
    <BlueprintFrame className="landing-spine" fullBleed>
      <main id="main-content">
        <LandingHero />
        <LandingSections />
      </main>
    </BlueprintFrame>
  );
}
