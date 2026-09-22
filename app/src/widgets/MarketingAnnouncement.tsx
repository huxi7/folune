/**
 * [INPUT]: 依赖 MarketingLink 的锚点过渡、BlueprintDivider 与 Landing 公告栏样式，接收可选容器 ref 供 Hero 量取高度
 * [OUTPUT]: 对外提供通往首页工作流的 37px 产品公告栏，沿用浅蓝渐变和共轴导轨
 * [POS]: widgets 的首页与登录页共享公告；文案和形制只有一份，Hero 只读取高度，不拥有另一套标记
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Ref } from "react";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { BlueprintDivider } from "./BlueprintDivider";

export function MarketingAnnouncement({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div className="landing-announcement" ref={ref}>
      <span>认识 Folune：</span>
      <Link to="/#workflow">让记录自然发生，让想法有序生长 <span>→</span></Link>
      <BlueprintDivider flush fullBleed />
    </div>
  );
}
