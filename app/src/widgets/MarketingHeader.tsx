/**
 * [INPUT]: 依赖共享 Button、BlueprintFrame/Divider、BrandMark、MarketingLink 站内过渡与既有 query 驱动认证弹窗
 * [OUTPUT]: 对外提供品牌、六项内容导航与打开/下载双动作；价格与下载保留正常可点击外观，更多进入独立动态分区
 * [POS]: widgets 的共享营销导航；认证成功仍经现有路由进入工作区，不改变登录协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence } from "motion/react";
import { lazy, Suspense } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";

import { BrandMark, Button } from "../shared/design-system/components";

import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const AuthDialog = lazy(() =>
  import("./AuthDialog").then((module) => ({
    default: module.AuthDialog,
  })),
);

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
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const authDialogOpen = searchParams.get("auth") === "login";

  function handleAuthDialogOpenChange(open: boolean) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (open) {
      nextSearchParams.set("auth", "login");
    } else {
      nextSearchParams.delete("auth");
    }

    setSearchParams(nextSearchParams, { replace: true, preventScrollReset: true, state });
  }

  function handleAuthenticated() {
    handleAuthDialogOpenChange(false);
    navigate("/app", { replace: true });
  }

  return (
    <>
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
              onClick={() => handleAuthDialogOpenChange(true)}
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
      <AnimatePresence>
      {authDialogOpen ? (
        <Suspense key="auth" fallback={null}>
          <AuthDialog
            onAuthenticated={handleAuthenticated}
            onOpenChange={handleAuthDialogOpenChange}
            open={authDialogOpen}
          />
        </Suspense>
      ) : null}
      </AnimatePresence>
    </>
  );
}
