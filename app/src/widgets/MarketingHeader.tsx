/**
 * [INPUT]: 依赖 React lazy/Suspense 与 AnimatePresence 的完整退出、本地 Button/BrandMark、React Router URL 状态与按需加载的 AuthDialog
 * [OUTPUT]: 对外提供仅显示 SuperNote 主名称、无装饰位移的 Blueprint 顶部导航与只在打开时下载认证逻辑的登录入口
 * [POS]: app/src/widgets 的营销导航内容组件，被 LandingPage 放入顶边贴视口、全宽背景且主轨/外轨相连的粘性 Header RailLayer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence } from "motion/react";
import { lazy, Suspense } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { BrandMark, Button } from "../shared/design-system/components";

const AuthDialog = lazy(() =>
  import("./AuthDialog").then((module) => ({
    default: module.AuthDialog,
  })),
);

const navItems = [
  { href: "#product", label: "产品" },
  { href: "#workflow", label: "工作方式" },
  { href: "#pricing", label: "定价" },
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
        <div className="ds-container marketing-nav">
          <Link
            aria-label="返回 SuperNote 首页"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
            to="/"
          >
            <BrandMark />
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
            <span className="marketing-edition">2026 / BETA</span>
            <Button
              className="marketing-login-button"
              onClick={() => handleAuthDialogOpenChange(true)}
              variant="primary"
            >
              登录
            </Button>
          </div>
        </div>
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
