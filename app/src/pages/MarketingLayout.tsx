/**
 * [INPUT]: 依赖 Router Outlet/ScrollRestoration、营销 Header/Footer 与 useMarketingMotion/marketing-motion.css
 * [OUTPUT]: 对外提供公开页面的固定顶栏、原生滚动恢复与路径/锚点过渡；可视正文轻浮现，登录页保持单屏并省去 Footer
 * [POS]: pages 的营销路由壳；认证是独立内容路由，顶栏和现有导航持续挂载，不进入工作区生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { MarketingHeader } from "../widgets/MarketingHeader";
import { LandingFooter } from "../widgets/LandingFooter";
import { useMarketingMotion } from "../widgets/LandingMotion/useMarketingMotion";

export function MarketingLayout() {
  const rootRef = useRef<HTMLDivElement>(null);
  const transitioning = useMarketingMotion(rootRef);
  const { pathname } = useLocation();
  const isLoginPage = pathname === "/login" || pathname === "/login/";
  useEffect(() => {
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [pathname]);
  return <div ref={rootRef} className={`ds-page landing-blueprint landing-reference${isLoginPage ? " marketing-auth-layout" : ""}`} lang="zh-CN" data-marketing-transition={transitioning || undefined}>
    <a className="landing-skip-link" href="#main-content">跳至正文</a>
    <MarketingHeader />
    <Outlet />
    {isLoginPage ? null : <LandingFooter />}
    <ScrollRestoration />
  </div>;
}
