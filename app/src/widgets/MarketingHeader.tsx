/**
 * [INPUT]: 依赖共享 Button、BlueprintFrame/Divider、Figma 原始品牌素材与既有 query 驱动认证弹窗
 * [OUTPUT]: 对外提供原始导航文字/图标/快捷键、56px 导航及底边交点、公开锚点与按需加载的 AuthDialog
 * [POS]: widgets 的首页导航；认证成功仍经现有路由进入工作区，不改变登录协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence } from "motion/react";
import { lazy, Suspense } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../shared/design-system/components";

import { referenceAssets as assets } from "./landingReferenceData";
import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const AuthDialog = lazy(() =>
  import("./AuthDialog").then((module) => ({
    default: module.AuthDialog,
  })),
);

const navItems = [
  { href: "#features", label: "Product", dropdown: true },
  { href: "#resources", label: "Resources", dropdown: true },
  { href: "#extensions", label: "Extensions" },
  { href: "https://zed.dev/docs", label: "Docs" },
  { href: "https://zed.dev/pricing", label: "Pricing" },
  { href: "https://zed.dev/delta", label: "Delta", icon: "19-4560/imgFrame2" },
];

export function MarketingHeader() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authDialogOpen = searchParams.get("auth") === "login";

  function handleAuthDialogOpenChange(open: boolean) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (open) {
      nextSearchParams.set("auth", "login");
    } else {
      nextSearchParams.delete("auth");
    }

    setSearchParams(nextSearchParams, { replace: true });
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
            <img className="reference-brand" src={assets["19-4560/imgFrame"]} alt="Zed" width="67" height="24" />
          </Link>
          <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <a
                className="marketing-nav-link"
                href={item.href}
                key={item.href}
              >
                {item.icon ? <img src={assets[item.icon]} alt="" width="14" height="14" /> : null}
                {item.label}
                {item.dropdown ? <img src={assets["19-4560/imgFrame1"]} alt="" width="14" height="14" /> : null}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="marketing-edition" aria-label="Search shortcut: Command Shift P">
              <img src={assets["19-4560/imgFrame3"]} alt="" width="12" height="12" />
              <kbd><img src={assets["19-4560/imgFrame4"]} alt="Command" width="10" height="10" /><img src={assets["19-4560/imgFrame5"]} alt="Shift" width="14" height="14" />P</kbd>
            </span>
            <Button
              className="marketing-login-button"
              onClick={() => handleAuthDialogOpenChange(true)}
              variant="ghost"
            >
              Sign up <kbd>S</kbd>
            </Button>
            <Button variant="primary" onClick={() => { window.location.href = "https://zed.dev/download"; }}>Download <kbd>D</kbd></Button>
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
