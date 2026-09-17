# 六版首屏比较 · 2026-09-18

范围只在 LandingHeroLab；正式 Landing 正由另一位 Agent 修改。六版共用 Header → 居中 Hero → 三栏价值条。A/B 保留上一轮参数，C/D 新增真实 Shader，E/F 使用组件库官方源码并改参数与生命周期。

## 最终选择

**综合首选 C「窗间天光」，其次 A「纸墨流动」。** C 把动态表现成真实环境里的光，正文保持安定，蓝灰光影与纸色融为一体。它与后续 APP 点阵后景属于不同层次，不会连续两段重复同一种粒子纹理。桌面与手机均有明确动态，并且不要求额外图形引擎。这里是视觉选型判断，尚未与正式 APP 区整页集成。

如果优先强调“纸墨”品牌触感，选 A；如果希望最贴近当前细线/导轨结构，选 E。F 是克制的轻量备选，D 是视觉辨识最强但最需要控制注意力的一版。

| 方案 | 真正使用的组件 | 风格与参数取舍 | 主要代价 | 排序 |
| --- | --- | --- | --- | --- |
| A 纸墨流动 | Paper GrainGradient | 维持上一版 wave / 0.8 倍速，细颗粒与大色场 | 部分时刻颗粒会穿过副文案区域，但中央遮罩压低对比 | 2 |
| B 墨色流光 | Paper Warp | 维持上一版 edge / 1.2 倍速，蓝灰柔和绸面 | 视觉更通用，纸张身份弱于 A，质感比较接近数字材质 | 5 |
| C 窗间天光 | Paper GodRays | 光源移到左上方视口外，关闭中心光球和 bloom，低密度蓝灰光束，speed 0.85 | 全域动态，需要保持当前中央遮罩与低饱和度 | 1 |
| D 墨点潮汐 | Paper Dithering | ripple、4x4、size 1.2、偏下中心与 0.65 倍速；墨色由初稿深蓝退为 #a5bac5 | 印刷涟漪存在感强，与后续 APP 点阵质感接近，长看更显眼 | 6 |
| E 纸纹行云 | React Bits Waves | 真实 Perlin/Canvas 线场，22px 线距、26/14 波幅、速度 .022/.012；取消指针扰动，像活动的纸纹 | 持续 Canvas 2D/CPU 点运算，不能因无 WebGL 就声称没有成本 | 3 |
| F 思路留痕 | Aceternity Background Beams | 官方路径保留，活动路径减半、单色墨迹、7–10s 确定节奏；手机 slice 取景保留线条存在感 | SVG 渐变属性由 Motion 驱动，不是全部交给合成器；暂停恢复会重新开始该段时间线 | 4 |

## 直接组件来源

- [GodRays](https://shaders.paper.design/god-rays)：阅读颜色、光源 offset、bloom、density、spotty、center glow 与 speed 文档；使用项目已有 0.0.80。
- [Dithering](https://shaders.paper.design/dithering)：阅读 ripple/type/size/scale/speed 文档，实际参数对照已安装包。
- [React Bits Waves](https://reactbits.dev/backgrounds/waves)：Exa 阅读 props；直接获取 [官方 TS 组件](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Backgrounds/Waves/Waves.tsx) 并保留原 Noise、movePoints、drawLines。新增可暂停的连续时间、确定种子、ResizeObserver、DPR 上限与严格类型修正，移除装饰光标。是实际引入组件源码，不是重画近似效果。
- [Aceternity Background Beams](https://ui.aceternity.com/components/background-beams)：Exa 阅读文档并获取官方 registry 完整源码。原 paths 与每条路径沿渐变运动保留；调整色彩、路径密度、时序、实例唯一 ID 与暂停。取代原 cn 工具为本地类名，无需引入新依赖。
- 版权、许可、复制来源与改动边界见 THIRD_PARTY.md。

## 验收与限制

- 1440×900 与 390×844 实际逐版查看新增 C/D/E/F。六版标题始终居中，C 的桌面标题中心为 x=720；手机六个切换键两行排列。
- C 1.2 秒内 shader 时间从约 12098 → 13118，speed .85；D 1 秒从约 12228 → 12878，speed .65。均非静态画布。
- E 读取两次真实 Canvas 像素得到不同摘要，暂停后摘要一致。F 的线性渐变 x1 在 1.2 秒内由 4.59% → 21.73%；暂停后两次均为 19.84%。系统减少动态效果使 running=false 并明确提示原因，恢复后正常播放。
- C 的本机 1.5 秒可见视口采样 181 帧、P95 8.7ms。只代表当前机器短样本，不代表低端设备或耗电量。
- 类型检查与本模块 oxlint 通过；Demo 以临时配置独立构建到 /tmp/folune-six-concepts-build，不覆盖正式 dist。六版一起构建 JS 411.59KB / gzip 141.52KB，CSS 279.47KB / gzip 47.42KB，包含 React、Motion、Paper Shader 与全部生产 CSS。它是比较页总成本，不能当作选中一版后的正式首屏增量。
- 一次只挂载一个候选。运行态与后台/离屏/减少动态效果共用统一暂停边界。没有更改 package.json、锁文件或正式入口。
- F 初次组装中 activePaths 作用域错误与背景类名撞到外壳两处问题已修复并实际复查；保留真实错误边界，不能把前期失败截图当作最终页面。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
