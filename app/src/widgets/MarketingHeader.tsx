/**
 * [INPUT]: 依赖共享 Button、BlueprintFrame/Divider、BrandMark 与 Figma 原始功能符号与既有 query 驱动认证弹窗
 * [OUTPUT]: 对外提供中文导航、共享 DS 行动按钮、56px 导航及底边交点、公开锚点与按需加载的 AuthDialog
 * [POS]: widgets 的首页导航；认证成功仍经现有路由进入工作区，不改变登录协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence } from "motion/react";
import { lazy, Suspense } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { BrandMark, Button } from "../shared/design-system/components";

import { referenceAssets as assets } from "./landingReferenceData";
import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const AuthDialog = lazy(() =>
  import("./AuthDialog").then((module) => ({
    default: module.AuthDialog,
  })),
);

const navItems = [
  { href: "#features", label: "功能", dropdown: true },
  { href: "#resources", label: "关于", dropdown: true },
  { href: "#extensions", label: "扩展参考" },
  { href: "https://zed.dev/docs", label: "参考文档" },
  { href: "https://zed.dev/pricing", label: "参考定价" },
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
            <BrandMark className="marketing-brand" />
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
            <span className="marketing-edition" aria-label="搜索快捷键示意：Command Shift P">
              <img src={assets["19-4560/imgFrame3"]} alt="" width="12" height="12" />
              <kbd><img src={assets["19-4560/imgFrame4"]} alt="Command" width="10" height="10" /><img src={assets["19-4560/imgFrame5"]} alt="Shift" width="14" height="14" />P</kbd>
            </span>
            <Button
              className="marketing-login-button"
              onClick={() => handleAuthDialogOpenChange(true)}
              variant="ghost"
            >
              登录
            </Button>
            <Button variant="secondary" disabled title="桌面版即将推出" aria-label="下载，桌面版即将推出">下载</Button>
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
