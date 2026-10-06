/**
 * [INPUT]: 依赖 MarketingLink 的锚点过渡、ArrowRightIcon、BlueprintDivider 与 Landing 公告栏样式，接收可选容器 ref 供 Hero 量取高度
 * [OUTPUT]: 对外提供通往首页工作流的 36px 整栏链接；主轨内采用 14% 品牌蓝渐变，文字单行截断，箭头与共轴节点独立定位
 * [POS]: widgets 的首页、登录、博客/动态目录与价格页共享公告；文案和形制只有一份，各页面沿自己的导轨装配，Hero 只读取高度
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Ref } from "react";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { BlueprintDivider } from "./BlueprintDivider";
import { ArrowRightIcon } from "../shared/design-system/icons";

export function MarketingAnnouncement({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div className="landing-announcement" ref={ref}>
      <Link className="landing-announcement-link" to="/#workflow">
        <span className="landing-announcement-label">认识 Folune：</span>
        <span className="landing-announcement-copy">让记录自然发生，让想法有序生长</span>
        <ArrowRightIcon aria-hidden="true" className="landing-announcement-arrow" />
      </Link>
      <BlueprintDivider flush fullBleed />
    </div>
  );
}
