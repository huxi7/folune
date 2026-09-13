/**
 * [INPUT]: 依赖共享 Button、BlueprintFrame/Divider、Figma 原始品牌素材与既有 query 驱动认证弹窗
 * [OUTPUT]: 对外提供 56px 导航及底边交点，与正文同轴的主轨/外轨、公开锚点与按需加载的 AuthDialog
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
  { href: "#features", label: "Product⌄" },
  { href: "#resources", label: "Resources⌄" },
  { href: "#extensions", label: "Extensions" },
  { href: "https://zed.dev/docs", label: "Docs" },
  { href: "https://zed.dev/pricing", label: "Pricing" },
  { href: "https://zed.dev/delta", label: "♧ Delta" },
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
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="marketing-edition">◦ ◦ ◦　◧　▧　↗</span>
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
