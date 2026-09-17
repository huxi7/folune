# LandingHeroLab/
> L2 | 父级: ../CLAUDE.md

独立首屏 Shader 选型 Demo，只包含 Header、居中 Hero 与三栏价值条。正式 Landing 正由另一位 Agent 修改，本模块禁止反向修改正式页面、共享组件/样式、路由与构建入口；入口仍为 hero-lab.html。

成员清单
REVIEW.md: 六套真实背景的选型、参数取舍、当前排序与运行验收；C 为综合首选，A 为纸墨取向备选
LibraryArtwork.tsx: React Bits Waves/Aceternity Beams 的局部装配，使用官方组件代码并统一播放/状态反馈
ReactBitsWaves.tsx: 官方 Waves 的 Canvas/Perlin/线场实现，保留算法并适配暂停、确定种子、DPR、ResizeObserver 和严格类型
AceternityBeams.tsx: 官方 Background Beams 原始路径和 Motion 渐变运动，改为蓝灰色、稀疏密度、确定时序、实例 ID 与暂停控制
THIRD_PARTY.md: 实际引入源码的来源、改动边界与原始许可证
main.tsx: 独立 React/DS 样式入口，固定浅色且不读取持久化偏好
HeroLab.tsx: 四种 Paper Shader 与两种组件库背景的六套完整居中首屏切换，提供暂停和 Shader 加载/失败/系统减少动态效果反馈；hash 只选择本地候选
HeroArtwork.tsx: 直接装配已安装的 Paper Shaders GrainGradient、Warp、GodRays 和 Dithering，蓝灰/纸色色场由局部参数定义；WebGL2 探测、画布创建与上下文丢失反馈避免把静态备用底色当成正常动态
useAmbientMotion.ts: 系统减少动态效果、用户暂停、离屏和后台共同决定传给 Shader 的 speed，不创建逐帧 React 状态
hero-lab.css: 六套候选共用居中排版，画布扩展至外轨并通过中央纸色遮罩保护阅读；无自绘替代背景或侧排标题；E/F 使用官方组件的 Canvas/SVG 动画

用户纠正后的选型：直接使用真实 Shader 组件，不以借鉴组件思路后自绘 SVG/CSS 替代要求。A 为 GrainGradient wave（speed 0.8），B 为 Warp edge（speed 1.2）；C 为 GodRays（speed .85），D 为 Dithering ripple（speed .65）；E 为 React Bits Waves，F 为 Aceternity Beams。单次只挂载一个候选，渲染上限 140 万像素。复用项目已经安装的 @paper-design/shaders-react 0.0.80，不更改依赖。

官方组件文档：
- https://shaders.paper.design/grain-gradient ：wave 形态、noise/softness/intensity 与 speed/frame。
- https://shaders.paper.design/warp ：edge 形态、distortion/swirl/iterations、颜色与 speed/frame。
- 以本地 0.0.80 类型与组件源码为准；Context7 返回的 GrainGradient shape/参数与本地不同，未采用。

2026-09-18 运行验收：两套均实际显示一个 WebGL2 canvas；1.5 秒内 GrainGradient 时间推进约 1200ms、Warp 约 1800ms，匹配各自 0.8/1.2 的 speed。1440px 下标题中心为 x=720；390px 两套 scrollWidth 均为 390。暂停后 Warp 时间在两次读取间完全一致且 speed=0；系统减少动态效果也为 speed=0 并显示原因，检查后已恢复默认播放。模块 oxlint、APP 类型检查、只针对 hero-lab.html 的临时独立构建通过，正式构建输出未触碰。旧 Hook 改造期间热更新曾报钩子数量错误，最终完整重新加载后正常运行；历史日志不冒充最终加载错误。

旧 app/docs/landing-refactor/hero-lab-research.md 记录的三套 SVG/CSS 方案已被用户否决，不再代表当前 Demo；该文件与上层目录地图本轮不改，以避免碰到另一位 Agent 的正式 Landing 工作。当前实现和验收以此局部文档为准。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
