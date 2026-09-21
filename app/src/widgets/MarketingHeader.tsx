/**
 * [INPUT]: 依赖共享 Button、BlueprintFrame/Divider、BrandMark、Router 站内导航与既有 query 驱动认证弹窗
 * [OUTPUT]: 对外提供 56px 营销顶栏、功能/指南/博客/关于四个真实站内入口与「打开网页版」认证动作
 * [POS]: widgets 的共享营销导航；认证成功仍经现有路由进入工作区，不改变登录协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence } from "motion/react";
import { lazy, Suspense } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { BrandMark, Button } from "../shared/design-system/components";

import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const AuthDialog = lazy(() =>
  import("./AuthDialog").then((module) => ({
    default: module.AuthDialog,
  })),
);

const navItems = [
  { href: "/#features", label: "功能" },
  { href: "/#guides", label: "指南" },
  { href: "/blog", label: "博客" },
  { href: "/#resources", label: "关于" },
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
          <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
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
          <div className="flex items-center gap-2">
            <Button
              className="marketing-login-button"
              onClick={() => handleAuthDialogOpenChange(true)}
              variant="secondary"
            >
              打开网页版
            </Button>
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
