/**
 * [INPUT]: 依赖独立HTML预载的生产样式、React/Motion/Toast、生产UserMenu和历史PreviousUserMenu，以及生产侧栏/品牌原语
 * [OUTPUT]: 提供默认展开的菜单对比场景；同源消息调整两版侧栏宽度并回报实际宽高，不读取账户或持久化数据
 * [POS]: MenuComparison的隔离入口，只被menu-demo-frame.html加载；两版共用同一布局和演示数据，差异仅来自菜单实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { BrandMark } from "../../shared/design-system/components/BrandMark";
import { SidebarButton } from "../../shared/design-system/components/SidebarButton";
import { ToastProvider } from "../../shared/design-system/components/Toast";
import { UserMenu } from "../../shared/design-system/components/UserMenu";
import { FolderIcon, TrashIcon, MagnifyingGlassIcon } from "../../shared/design-system/icons";
import { motionTokenStyles } from "../../shared/design-system/motion";
import { PreviousUserMenu } from "./PreviousUserMenu";

const version = window.location.hash === "#previous" ? "previous" : "current";
const Menu = version === "previous" ? PreviousUserMenu : UserMenu;
const noop = () => {};

function ComparisonFrame() {
  const [width, setWidth] = useState(264);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [locale, setLocale] = useState<"zh-CN" | "en">("zh-CN");
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type === "menu-demo-width" && Number.isFinite(event.data.width)) {
        setWidth(Math.max(208, Math.min(360, event.data.width)));
      }
      if (event.data?.type === "menu-demo-open") sceneRef.current?.querySelector<HTMLButtonElement>('.ds-user-button[aria-expanded="false"]')?.click();
    };
    window.addEventListener("message", receive);
    const frame = requestAnimationFrame(() => sceneRef.current?.querySelector<HTMLButtonElement>(".ds-user-button")?.click());
    return () => { cancelAnimationFrame(frame); window.removeEventListener("message", receive); };
  }, []);

  useEffect(() => {
    // 历史菜单只监听视口变化；共同发出resize，保证宽度调整对两版具有同等效力。
    window.dispatchEvent(new Event("resize"));
  }, [width]);

  useEffect(() => {
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="用户菜单"], [role="menu"][aria-label="User menu"]');
        if (!menu) return;
        window.parent.postMessage({ type: "menu-demo-measure", version, width: menu.offsetWidth, height: menu.offsetHeight }, window.location.origin);
      });
    };
    const observer = new MutationObserver(report);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", report);
    report();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", report); };
  }, []);

  return <div className="app-workspace" ref={sceneRef}>
    <div className="menu-demo-paper"><h1>今天的想法</h1><p>把零散的想法，慢慢整理成自己的记录。</p></div>
    <aside className="workspace-floating-panel workspace-persistent-panel" style={{ width, top: 16, bottom: 16, left: 16 }} aria-label="示例文件库">
      <div className="app-sidebar">
        <header className="app-sidebar-header"><div className="menu-demo-brand"><BrandMark /></div><SidebarButton leading={<MagnifyingGlassIcon size={16} />} label="搜索备忘录" /></header>
        <div className="menu-demo-tree"><SidebarButton leading={<FolderIcon size={16} />} label="我的记录" /><SidebarButton leading={<FolderIcon size={16} />} label="工作与想法" /><SidebarButton leading={<FolderIcon size={16} />} label="阅读摘录" /></div>
        <footer className="app-sidebar-footer">
          <nav className="sidebar-utility-list"><SidebarButton className="sidebar-utility-button" leading={<TrashIcon size={16} />} label="回收站" /></nav>
          <Menu name="admin" email="demo@example.test" planName="Free" remainingCredits={9.6}
            locale={locale} onLocaleChange={setLocale} theme={theme} onThemeChange={setTheme}
            onOpenProfile={noop} onOpenSettings={noop} onOpenSubscription={noop}
            onOpenCredits={noop} onOpenBilling={noop} onOpenUsage={noop} onSignOut={async () => {}} />
        </footer>
      </div>
    </aside>
  </div>;
}

createRoot(document.getElementById("root")!).render(<MotionConfig reducedMotion="user"><style>{motionTokenStyles}</style><ToastProvider><ComparisonFrame /></ToastProvider></MotionConfig>);
