# APP 展示区背景与轮廓

2026-09-17。范围仅为 Landing 的 APP 展示区；功能区五张图的直角虚线不变。

## 候选与取舍

| 方案 | 视觉与可调性 | 成本与适配判断 |
| --- | --- | --- |
| [React Bits Dot Grid](https://reactbits.dev/backgrounds/dot-grid) / [Dot Field](https://reactbits.dev/backgrounds/dot-field) | 点阵贴近目标；颜色、密度、波幅可调。Dot Grid 侧重鼠标冲击，Dot Field 带指针鼓起与光晕 | 当前官方 Dot Grid 源码依赖 GSAP / InertiaPlugin；Dot Field 使用 Canvas 2D、无额外库，但需改造默认指针行为、基于帧数的计时与停帧策略 |
| [Magic UI Ripple](https://magicui.design/docs/components/ripple) | 克制的同心圆脉动，尺寸和透明度易调 | CSS 圆环方案轻量，但视觉偏圆环，缺少所需的点阵流动场 |
| [Aceternity Background Ripple Effect](https://ui.aceternity.com/components/background-ripple-effect) | 方格点击涟漪，行列、单元尺寸和颜色可调 | 每格 DOM；要实现无人操作时缓慢流动需新增驱动，不适合仅露出窄边的后景 |
| [Paper Shaders Dithering](https://shaders.paper.design/dithering) | 原生点阵化 warp / wave / ripple；两色、颗粒、尺度和速度均可调 | 单 canvas / WebGL2，核心无运行时依赖；提供像素上限、离屏和后台暂停。最终采用 |

选型依据：实际查看 zed.dev 的 APP 展示区，背景宿主使用 `data-paper-shader`，当时透明度为 12%；运行实例的 Dithering 为 warp、4x4、颗粒 1、速度 1。它提供了合适的成熟实现，但 Folune 采用自己的品牌色与更慢的速度。官方源码与已安装的 0.0.80 一并核对，避免直接照抄 Context7 中不同版本的参数名称。

## 实现边界

- `ShowcaseBackdrop` 用动态 import 单独加载 `@paper-design/shaders-react@0.0.80`，接近展示区 120px 时才启动；iframe 不依赖 shader，不改变 Demo 的 CSP、数据或交互。
- 颜色读取展示区继承的 `--primary`（当前为 #395875）；透明底、10% 图层透明度、4x4 点阵、颗粒 1.5、尺度 0.65、速度 0.16。Warp 没有独立振幅参数，这里通过低对比、较慢流速与有限露出范围控制视觉强度，不声称修改了不存在的波幅参数。
- CSS 点阵仅作为加载中、无 WebGL2 或减少动态效果时的后备，canvas 存在时取消备用纹理，避免两套点阵叠加。
- `minPixelRatio=1`，`maxPixelCount=900000`；实测画布 1144×787≈90 万像素，整数取整略超目标。库负责离屏和后台停帧；减少动态效果直接不挂载 shader。
- 展示区外半径为 `--radius-panel + 内缩`，APP 外壳为 `--radius-panel`，两者共读 `--corner-shape-smooth`。桌面为 32px / 16px，手机为 24px / 16px。内部 Paper、Panel 已使用相同平滑曲线，无需改共享生产样式。不支持 `corner-shape` 的浏览器保留常规圆角回退。
- 外壳承担 1px 边框和裁剪，iframe 内容高度相应扣除上下边框；桌面总展示框仍为 738px，手机仍为 650px。

## 运行验收

- 类型检查、oxlint、生产构建与 `git diff --check` 通过；构建有既存 Mastra 的 Node `module` 浏览器兼容提示，与本次 shader 无关。
- Shader 动态分包为 29.29KB，gzip 9.15KB；仅新增 Paper 的 React 封装与核心两个包，没有 Three.js / GSAP。
- Ego 页面计算样式确认外框 `superellipse(2)`，功能区五张图半径仍均为 0；离屏 `currentSpeed=0`，减少动态效果时背景 canvas 数量为 0。
- Ego 截图接口超时，改在 Codex 可见浏览器实际查看 1440×1000 的 Paper 与 Canvas 画面，并确认两种视图切换；背景在 APP 后方四周露出，未染色文字或遮挡操作。
- 390×844 实际截图检查平滑轮廓、背景和 iframe 裁剪；页面 scrollWidth=390，无横向溢出。
- 可见桌面页 2 秒采样 241 帧，帧间隔中位数 8.3ms、P95 9.3ms；shader 时间推进约 321ms，与 0.16 倍速一致。此为当前机器与浏览器的短时样本，不代表所有设备的 GPU 性能；Ego 隐藏表面的 1fps 节流样本不用于判断页面流畅度。
- 可见页未发现控制台 error / warn。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
