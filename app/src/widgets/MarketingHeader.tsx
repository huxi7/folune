/**
 * [INPUT]: 依赖共享 Button、BlueprintFrame/Divider、BrandMark 与 MarketingLink/原生过渡能力判据；公开导航共用营销动效
 * [OUTPUT]: 对外提供品牌、六项内容导航与打开/下载双动作；价格与下载保留正常可点击外观，更多进入独立动态分区
 * [POS]: widgets 的共享营销导航，首页、登录页与公开内容页持续复用；打开只导航到 /login，认证生命周期由页面持有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useNavigate } from "react-router-dom";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { supportsMarketingTransition } from "./LandingMotion/useMarketingMotion";

import { BrandMark, Button } from "../shared/design-system/components";

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
          <Button
            className="marketing-login-button"
            onClick={() => navigate("/login", { viewTransition: supportsMarketingTransition() })}
            variant="secondary"
          >
            打开
          </Button>
          {/* ---- 下载地址后续接入；预留动作保持正常外观，不跳转或触发占位提示 ---- */}
          <Button variant="primary">下载</Button>
        </div>
      </div>
      </BlueprintFrame>
      <BlueprintDivider flush fullBleed />
    </header>
  );
}
