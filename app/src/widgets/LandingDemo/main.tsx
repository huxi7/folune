/**
 * [INPUT]: 依赖 demo.html 预载生产样式，React、Motion/Toast 与 DemoWorkspace
 * [OUTPUT]: 对外提供独立 Demo 页面；`?v=` 选择对比版本，缺省即线上一档
 * [POS]: iframe 入口；不挂载 Auth、Router 或持久化主题 Provider，版本开关只为对比页服务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { ToastProvider } from "../../shared/design-system/components/Toast";
import { motionTokenStyles } from "../../shared/design-system/motion";
import { DemoWorkspace, type DemoVariant } from "./DemoWorkspace";

// 版本只改 HTML 上的一个属性，具体差异全部住在 landing-demo.css，组件层不参与判断。
// 走 hash 而不是查询串：hash 根本不发到服务器，因此不会和 Vite 的 HTML 处理打交道。
const VARIANTS: readonly DemoVariant[] = ["uniform", "pinned", "original"];
const requested = window.location.hash.replace(/^#/, "");
const variant = VARIANTS.find(value => value === requested) ?? "uniform";
document.documentElement.dataset.demoVariant = variant;

createRoot(document.getElementById("root")!).render(<StrictMode><MotionConfig reducedMotion="user">
  <style>{motionTokenStyles}</style><ToastProvider><DemoWorkspace variant={variant} /></ToastProvider>
</MotionConfig></StrictMode>);
