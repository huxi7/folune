# LandingHeroLab/
> L2 | 父级: ../CLAUDE.md

独立颗粒首屏实验页，由 hero-lab.html 开发入口加载。四版共用正式 Header、公告、Hero 居中文案/按钮与已定稿三栏；局部只改变 Hero 高度和背景。正式 Landing、共享样式、组件接口、认证与构建未修改。可选 LandingEditor 原样装配，用来观察 APP 衔接。

成员清单
HeroLab.tsx: 页面装配与浮动切换条，面板默认收起，系统减少动态/离屏/暂停/加载失败分别反馈
FirstScreen.tsx: 复用 BrandMark/Button/Blueprint 的首屏投影；文案和导航可见结构按正式代码同步，ResizeObserver 量取 Header/公告/三栏预算，APP 展示按需加载
Controls.tsx: 中文参数面板、同高度对照、配置交换与原 A/B/D 参照；只显示当前算法确实支持的参数，02 不提供颗粒尺寸假旋钮
presets.ts: 四版作者默认值、参数范围、配置版本/校验与本地存储键；原参照名称与候选身份同源
useLabState.ts: 逐方案参数银行、共享高度、连续时间采样、固定帧对照和配置导入导出；localStorage 仅写 folune-hero-grain-lab-v1，不接业务数据
HeroArtwork.tsx: Paper GrainGradient/Dithering/Warp 与局部 ShaderMount 装配；参数不重建 canvas，种子固定，单候选 140 万像素上限；检查 program 链接状态并处理 context lost/restored
inkShader.ts: 局部 WebGL2 颗粒算法，连续场驱动着墨，确定种子的微粒按连续坐标缓移，邻格合成避免跨格切断；CSS 尺寸独立于图案尺度，01 有柔软墨面，04 使用更明显的疏密变化
useAmbientMotion.ts: 系统减少动态、暂停、离屏和后台共同控制 speed，逐帧时间由 Paper 库持有
hero-lab.css: 仅 Lab 的 Hero 尺度、连续侧轨后景、阅读留白、面板/浮条；不覆盖生产标题/副标题/三栏字号，颗粒不是 CSS 动画替代
main.tsx: 独立 React/DS 入口，固定浅色，不装配 Router/Auth/业务 Store
REVIEW.md: 当前四版实现、默认参数、操作说明与未运行验收的证据边界；历史六版结论在末尾明确归档
THIRD_PARTY.md: Paper 使用边界与历史 React Bits/Aceternity 源码的许可记录
LibraryArtwork.tsx: 已淘汰 E/F 历史装配，当前入口不导入，仅保留追溯
ReactBitsWaves.tsx: 已淘汰 E 的历史官方 Canvas/Perlin 适配，当前入口不加载
AceternityBeams.tsx: 已淘汰 F 的历史官方 Motion 路径适配，当前入口不加载

设计决定：01 散墨流变优先探索 B 的不规则形变 + 颗粒着墨；02 纸墨呼吸延续 A；03 游移网点使用 Dithering warp 去掉同心圆；04 疏点薄雾以稀疏点群缓移、连续改变浓淡。Warp 没有颗粒参数，因此 01/04 使用 Paper 的渲染底座与自写局部 GLSL，而不是噪点覆盖光滑表面。库源码未改。

2026-09-19 动态可辨性修正：用户反馈 01/04 看起来静止。代码中这两版只有固定颗粒的弱浓淡变化，u_time 又乘 .16；修正为以原 12s 相位为锚、后续时间系数 .72（原来的 4.5 倍），材质坐标加入约 1px/s 的默认连续平移，04 增大疏密变化区间。speed 与用户已存参数保留，暂停/减少动态仍经原边界停时间；02/03 未改。未运行浏览器或测试，不能据此声称实际运动已验收。

相位：每次切换前读取 getCurrentFrame，暂停后调参不推进时间；对照使用固定快照时间，统一高度，只有一个 Hero 活跃画布。导出包括版本/方案/参数/种子/时间/高度，导入先校验再定格。原 A/B/D 只保持原效果参数，不复制旧 Lab 的不同排版。E/F 不再出现在新版 UI。

执行与验收：2026-09-19 本轮代码已写入，Vite 既有进程仍监听 10000。遵循用户要求未运行测试、构建或浏览器验收；运行反馈属于页面自身功能，不能作为 Agent 已实际观看动态的证据。默认参数是设计起点，未声明为实看定稿。正式页先前的副标题/三栏修改未覆盖。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

2026-09-19 保存节点：用户往返比较后恢复 01/04 增强版并要求提交，当前保存该版本及完整四版 Lab。此决定仅保留探索结果，未授权把任一背景接入正式 Landing；未增加测试或 Agent 浏览器验收。
