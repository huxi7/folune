/**
 * [INPUT]: 依赖 Router Link/目标解析、系统动态偏好与营销原生过渡能力判据
 * [OUTPUT]: 对外提供保留标准链接语义、仅在路径或锚点变化时启用原生过渡的 MarketingLink
 * [POS]: 公开营销内容的导航入口；历史/state/新标签仍交给 Router，认证和细节 query 不触发页面动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link, useLocation, useResolvedPath, type LinkProps } from "react-router-dom";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { supportsMarketingTransition } from "./useMarketingMotion";

export function MarketingLink(props: Omit<LinkProps, "viewTransition">) {
  const current = useLocation();
  const target = useResolvedPath(props.to, { relative: props.relative });
  const reduced = useMotionPreference();
  const changesContent = current.pathname !== target.pathname || current.hash !== target.hash;
  return <Link {...props} viewTransition={changesContent && !reduced && supportsMarketingTransition()} />;
}
