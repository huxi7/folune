/**
 * [INPUT]: 依赖 Router Link 与标准链接属性
 * [OUTPUT]: 提供公开营销导航入口，保留历史、state、新标签与锚点语义
 * [POS]: 营销链接边界；路由立即切换，内容入场由 MarketingLayout 统一拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link, type LinkProps } from "react-router-dom";

export function MarketingLink(props: Omit<LinkProps, "viewTransition">) {
  return <Link {...props} />;
}
