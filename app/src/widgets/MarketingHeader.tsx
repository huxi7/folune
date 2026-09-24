/**
 * [INPUT]: 依赖共享 Button/GlowButton、BlueprintFrame/Divider、BrandMark 与 MarketingLink/原生过渡能力判据；公开导航共用营销动效
 * [OUTPUT]: 对外提供品牌、六项内容导航与下载/打开双动作；下载在左用 Secondary，打开在右用品牌蓝流光 GlowButton，更多进入独立动态分区
 * [POS]: widgets 的共享营销导航，首页、登录页与公开内容页持续复用；打开导航到 /login，认证生命周期由页面持有，下载目标待接入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useNavigate } from "react-router-dom";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { supportsMarketingTransition } from "./LandingMotion/useMarketingMotion";

import { BrandMark, Button, GlowButton } from "../shared/design-system/components";

import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const navItems = [
  { href: "/#features", label: "核心功能" },
  { href: "/blog", label: "博客" },
  { href: "/#guides", label: "使用指南" },
  { href: null, label: "价格" },
  { href: "/#resources", label: "关于" },
  { href: "/updates", label: "更多" },
];

export function MarketingHeader() {
  const navigate = useNavigate();

  return (
    <header className="marketing-header">
      <BlueprintFrame fullBleed>
      <div className="ds-container marketing-nav">
        <Link
          aria-label="返回首页"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          to="/"
        >
          <BrandMark className="marketing-brand" />
        </Link>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            item.href ? <Link
              className="marketing-nav-link"
              to={item.href}
              key={item.href}
            >
              {item.label}
            </Link> : <button className="marketing-nav-link" type="button" key={item.label}>{item.label}</button>
          ))}
        </nav>
        <div className="marketing-nav-actions">
          {/* ---- 双动作按主次顺序固定排列：下载为次，打开 Folune 为主 ---- */}
          <Button variant="secondary">下载</Button>
          <GlowButton
            onClick={() => navigate("/login", { viewTransition: supportsMarketingTransition() })}
          >
            打开
          </GlowButton>
        </div>
      </div>
      </BlueprintFrame>
      <BlueprintDivider flush fullBleed />
    </header>
  );
}
