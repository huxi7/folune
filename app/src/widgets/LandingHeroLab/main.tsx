/**
 * [INPUT]: 依赖 React、生产 DS 字体/样式与 motion token、HeroLab
 * [OUTPUT]: 对外提供只在 hero-lab.html 装配的首屏比较页
 * [POS]: LandingHeroLab 独立入口；不导入生产 Router、Auth、主题持久化或业务 Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { motionTokenStyles } from "../../shared/design-system/motion";
import { HeroLab } from "./HeroLab";
import "../../index.css";
import "./hero-lab.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><style>{motionTokenStyles}</style><HeroLab /></StrictMode>,
);
