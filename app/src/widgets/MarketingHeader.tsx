/**
 * [INPUT]: 依赖共享 DesktopDownloadButton/GlowButton、语义图标、BlueprintFrame/Divider、BrandMark 与 MarketingLink/原生过渡能力判据
 * [OUTPUT]: 对外提供 48px 顶栏、六项内容导航与 70/48px 宽的 28px 下载/打开双动作；手机用原生折叠菜单保留单行顶栏
 * [POS]: widgets 的共享营销导航，首页、登录页与公开内容页持续复用；打开导航到 /login，认证生命周期由页面持有，下载复用 DesktopDownloadButton 的系统识别与原生链接
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useNavigate } from "react-router-dom";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { supportsMarketingTransition } from "./LandingMotion/useMarketingMotion";

import { BrandMark, GlowButton } from "../shared/design-system/components";
import { DesktopDownloadButton } from "./DesktopDownloadButton";
import { DownloadSimpleIcon, MenuIcon, XIcon } from "../shared/design-system/icons";

import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const navItems = [
  { href: "/#features", label: "核心功能" },
  { href: "/blog", label: "博客" },
  { href: "/#guides", label: "使用指南" },
  { href: "/pricing", label: "价格" },
  { href: "/#resources", label: "关于" },
  { href: "/updates", label: "更多" },
];

export function MarketingHeader() {
  const navigate = useNavigate();

  return (
    <header className="marketing-header" onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("a,button")) {
        event.currentTarget.querySelector("details")?.removeAttribute("open");
      }
    }} onKeyDown={(event) => {
      const menu = event.currentTarget.querySelector("details");
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }}>
      <BlueprintFrame fullBleed>
      <div className="ds-container marketing-nav">
        <Link
          aria-label="返回首页"
          className="marketing-brand-link rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          to="/"
        >
          <BrandMark className="marketing-brand" />
        </Link>
        <nav className="marketing-desktop-nav" aria-label="主导航">
          {navItems.map((item) => (
            <Link
              className="marketing-nav-link"
              to={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="marketing-nav-actions">
          {/* ---- 双动作按主次顺序固定排列：下载为次，打开 Folune 为主 ---- */}
          <DesktopDownloadButton icon={DownloadSimpleIcon} />
          <GlowButton
            onClick={() => navigate("/login", { viewTransition: supportsMarketingTransition() })}
          >
            打开
          </GlowButton>
          <details className="marketing-mobile-menu">
            <summary aria-label="切换导航菜单">
              <MenuIcon aria-hidden="true" className="marketing-menu-open" size={16} />
              <XIcon aria-hidden="true" className="marketing-menu-close" size={16} />
            </summary>
            <nav aria-label="手机主导航">
              {navItems.map((item) => (
                <Link key={item.href} className="marketing-nav-link" to={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
      </BlueprintFrame>
      <BlueprintDivider flush fullBleed />
    </header>
  );
}
