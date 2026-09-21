/**
 * [INPUT]: 依赖 Router Outlet/ScrollRestoration 与现有营销 Header/Footer
 * [OUTPUT]: 对外提供首页、博客/动态目录与阅读页持续挂载的公开布局及原生历史滚动恢复
 * [POS]: pages 的营销路由壳；认证 query 由同一顶栏拥有，内容路由只替换 Outlet，不进入工作区生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { MarketingHeader } from "../widgets/MarketingHeader";
import { LandingFooter } from "../widgets/LandingFooter";

export function MarketingLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [pathname]);
  return <div className="ds-page landing-blueprint landing-reference" lang="zh-CN">
    <a className="landing-skip-link" href="#main-content">跳至正文</a>
    <MarketingHeader />
    <Outlet />
    <LandingFooter />
    <ScrollRestoration />
  </div>;
}
