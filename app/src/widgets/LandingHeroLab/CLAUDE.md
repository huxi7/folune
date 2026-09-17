# LandingHeroLab/
> L2 | 父级: ../CLAUDE.md

首屏视觉研究的独立入口。只呈现 Header、Hero 和三栏价值条；沿用 Folune 品牌母图、生产字体/按钮与 Blueprint 骨架，不导入正式 MarketingHeader 的认证链路或 LandingHero 的 APP 展示。所有候选仅由 hero-lab.html 在开发期装配，不进入正式路由与构建。

成员清单
main.tsx: 独立 React/DS 样式入口，固定浅色且不读取持久化偏好
HeroLab.tsx: 三套候选与当前基线切换；同位呈现完整首屏，暂停只作用于本页，地址 hash 可直接定位方案
HeroArtwork.tsx: 原创纸页、流线、纸光三种视觉素材，复用 SVG/CSS 的可控低频动态；无第三方复制源码与图形引擎
useAmbientMotion.ts: 装饰层生命周期边界，系统减少动态效果、用户暂停、离屏与后台共同决定是否运行
hero-lab.css: 仅 hero-lab 页面加载的完整候选版式、导轨边注与动态；同一主轨连接三栏价值条，中央文字不参与循环动画

实现取舍：组件库提供图形和动效模式参考，实际几何属于 Folune；Motion 仅复用既有视口观察，CSS 持有循环时间线。每次只挂载一个候选，不引入 WebGL、Canvas、GSAP 或第二套状态管理。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
