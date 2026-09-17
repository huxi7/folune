# Folune 首屏视觉研究

2026-09-17。范围只含 Header → Hero → 三栏价值条。入口为开发服务器的 `/hero-lab.html`，正式 Landing、其 CSS、路由、构建入口和依赖清单不修改。

## 结论与查看方式

首选 **A 纸间有序**，B 是更抽象、流动感更明显的备选。C 更接近编辑式产品海报，但与紧随其后的真实 APP 展示重复，手机高度代价也更大。

- `/hero-lab.html#paper`：A，纸间有序。
- `/hero-lab.html#contour`：B，思绪成形。
- `/hero-lab.html#daylight`：C，纸上天光。
- `/hero-lab.html#baseline`：原 Hero 与原价值条。Header 沿用候选布局，因此该档明确命名为“原 Hero”，完整正式首页通过独立链接查看。

一次只挂载一个首屏。切换位于产品画面之外，不自动轮播；提供暂停动态，地址 hash 支持直达。打开按钮在新页打开正式认证入口；下载按真实状态保持待发布。Demo 不装配 Auth、业务 Store 或真实数据，不包含 APP 预览区。

## 调研方法与证据边界

通过 Exa 做了 7 组搜索：广泛发现、React Bits、Aceternity、替代库、Animate UI、Aceternity 仓库核验、React Spring 补充。共返回 49 条结果，首六组 43 条去重为 42 个 URL；其中通用 GitHub 首页、推广榜单及未证实的性能营销语不用于结论。另用 Exa 批量阅读官方组件页，并用 GitHub API 核验仓库数据，用 Context7 核对 Motion 的减少动态效果与视口观察接口。

搜索结果数量不是完整阅读篇数，也不是 49 个独立背书。社区榜单只用来发现候选；最终取舍依据官方文档、源码、当前 GitHub 活跃度和项目运行效果。GitHub 星数与 push 日期为当日快照，push 不等于发布或维护质量，星数也不等于可用性。

## 候选库比较

| 库 | GitHub 当日热度 / 最近 push | 实际阅读 | 对 Folune 的判断 |
| --- | --- | --- | --- |
| [React Bits](https://github.com/DavidHDev/react-bits) | 47,458 stars；2026-09-16；未归档 | [Waves](https://reactbits.dev/backgrounds/waves)、[Threads](https://reactbits.dev/backgrounds/threads)、[Dither](https://reactbits.dev/backgrounds/dither)；Threads 当前 TS 源码 | 视觉素材丰富，四种代码/样式变体，可改源码。Waves 的线条密度、振幅与速度适合抽取；Threads 需 OGL/WebGL，Dither 需 Three/Fiber/postprocessing，不能把整个库叫“零依赖轻量”。采用流线思路，未引入组件运行时。 |
| [Aceternity UI](https://ui.aceternity.com/) | 无可与其他库等价比较的完整官方公开仓库指标；作者名下 ui.aceternity 为 53 stars、最后 push 2024-01-27，不能冒充当前整站维护指标 | [Background Lines](https://ui.aceternity.com/components/background-lines)、[Background Beams](https://ui.aceternity.com/components/background-beams)、[背景指南](https://ui.aceternity.com/background)、官方 registry 中 Background Lines 完整源码 | SVG 路径结构可定制，但公开 props 很薄，视觉改造要改内部代码。源码包含彩色路径、双重路径复制与随机 delay；改成少量单色原创曲线与确定时间线。官方网站的用户背书属官方展示，未当作独立验证。 |
| [Magic UI](https://github.com/magicuidesign/magicui) | 22,315 stars；2026-09-13；未归档 | [Ripple](https://magicui.design/docs/components/ripple)、[Dot Pattern](https://magicui.design/docs/components/dot-pattern)，两者 registry 源码；[Animated Beam 时序讨论](https://github.com/magicuidesign/magicui/pull/895) | 文档、安装和源码清楚，易改。Dot Pattern 当前实现逐点创建 motion.circle 并随机时序；本页静态纹理用 CSS 平铺即可。Ripple 的默认同心圆不适合纸张品牌，采用其分层与低频节奏思路而非圆环样式。 |
| [Motion](https://github.com/motiondivision/motion) | 33,624 stars；2026-09-16；未归档 | [性能指南](https://motion.dev/docs/react-performance)、[可访问性](https://motion.dev/docs/react-accessibility)、[useInView](https://motion.dev/docs/react-use-in-view)；Context7 对照 | 维护、文档、组合能力最稳。项目已有 12.43 系列，复用 useInView，不引入另一套引擎；系统动态偏好复用项目现有 useMotionPreference。循环由 CSS 承载，避免每帧 React 状态。 |
| [Animate UI](https://github.com/imskyleen/animate-ui) | 4,303 stars；API 的 Animate-UI URL 重定向至 imskyleen；最近 push 2025-12-31；未归档 | [介绍](https://animate-ui.com/docs)、[Hexagon](https://animate-ui.com/docs/components/backgrounds/hexagon)、[Bubble](https://animate-ui.com/docs/components/backgrounds/bubble) | 可复制源码，React/Tailwind/Motion 组合成熟。当前维护活跃度弱于前三个 GitHub 候选；Bubble 的玩具感与六边形的科技感均不贴合品牌，不采用。 |
| [React Spring](https://github.com/pmndrs/react-spring) | 29,148 stars；2026-09-15；未归档 | [useSpring](https://www.react-spring.dev/docs/components/use-spring)、[配置](https://www.react-spring.dev/docs/advanced/config)、[减少动态效果源码](https://github.com/pmndrs/react-spring/blob/main/docs/app/routes/docs.utilities.use-reduced-motion.mdx) | 成熟、可控，pause/loop/immediate 完整，适合物理交互；本页不需要弹簧手势，引入会与已有 Motion 重复，不采用。 |
| [Paper Shaders](https://github.com/paper-design/shaders) | 3,455 stars；2026-09-17；未归档 | [Dithering](https://shaders.paper.design/dithering) 文档，当前项目 ShowcaseBackdrop 与其使用参数 | 印刷点阵最贴合已有 APP 展示后景，项目已有 0.0.80；保留在后续产品区。本次首屏用 SVG/CSS，避免上下两段都持续 shader 绘制，也避免视觉重复。 |

Broad search 中的 [21st 替代库整理](https://21st.dev/blog/react-bits-alternatives)、[DEV 社区比较](https://dev.to/hiteshbhardwaj/5-best-animated-component-libraries-for-react-and-nextjs-in-2026-1382) 与 [Codearia 实践文章](https://academy.codearia.com/en/articles/react-bits-animated-components) 仅用于补足候选与 WebGL 失败模式，不采纳未经核验的包体积、性能或用户规模数字。

Exa 一次 registry 批量读取出现传输错误，官方组件文档的成功结果已保留；源码改用官方 registry / GitHub raw 只读核对。Threads 官方页面提取不到 props，实际核对 TS 源码的 color/amplitude/distance/enableMouseInteraction 与 OGL import。没有复制外部组件源码，因此没有新增第三方代码许可证负担；未来直接复制应重新检查对应组件的实际许可证，不能用 GitHub 的 Other 代替判断。

## 三套完整设计

### A · 纸间有序

居中主文案放在两层极淡纸面前；两张外围散页与归档曲线构成“先记录，后有序”的隐喻。两侧主轨保持生产坐标，轨间增加低对比点阵、短刻度与纵向边注。纸张 16–20 秒小幅位移/角度变化，归档线 15 秒移动一段淡墨，侧轨只做不消失的低频透明度变化。

第一轮外围散页被主轨裁切，已改为桌面完整进入 Hero、≤1200px 隐去；文字始终静止。Hero 从首版 520px 收至 480px；三栏实际约 144px。主标题 48px、墨蓝和宋体保持；没有磁吸、逐字入场或彩色闪烁。

推荐理由：三套中与 Paper/Archive Cord 的产品身份最直接，中央标题权重明确，背景细节可以长期观看；纸面是提示而非第二个 APP 截图。下一段仍沿同一 1120px 主轨接入生产展示。代价是它的动态比 B 更轻，不能靠截图充分表达。

### B · 思绪成形

相同居中文案、按钮、480px 高度与价值条；两组原创贝塞尔等高线缓慢错向移动，中心遮罩留空，线条不穿正文。轨间纹理换成浅斜线，与纸面印刷感相呼应。36 条 SVG path 只有两组整体 transform 动画，不逐点计算波场；周期 20/24 秒。

优点：背景的连续生命感最容易感知，抽象且干净，维护成本低。代价：含义更偏普适的“思绪/流动”，专属于 Folune 的辨识度弱于 A；细线交汇处比 A 更吸引眼睛，与下方点阵需控制强度。

### C · 纸上天光

左侧两行标题，右侧一页散步笔记与相关纸条，长周期单色光带穿过纸面。沿用同一导轨与三栏价值条；文案静止，只有纸层、相关页与光线运动。Hero 桌面 520px，手机上下排列后 760px。

优点：人文与书写语义最强，纸页有明确内容。代价：右侧插画成为第二个阅读对象；与紧接的 APP Paper 重复，手机纵向空间成本最高，因此列为探索方案而非首选。

## 文案审核

主标题“随手记下，自然有序。”保留。原副文案“整理、连接，再次发现”和“沉淀为有序的知识”略抽象，改为“先留下此刻的想法，再让 AI 帮你整理。散落的笔记，也能连成下一次思考。”

价值条保持三步，但具体化为：

1. 专注记录：先把想法写下来，不必想好标题，也不必急着选文件夹。
2. 有序归档：让 AI 按内容整理笔记；归档去向看得见，不合适可以撤销。
3. 连接想法：把相关笔记放进画布，连一连、补几句，让思路继续展开。

依据当前根 CLAUDE.md 的显式 AI/文件树边界、Paper/Canvas 的真实工作流、LandingDemo 归档与撤销链路。没有宣称后台自动监视、全自动知识生成、团队协作或尚未上线的桌面客户端。Header 删除仅存在于参考稿中的 Zed/Delta/参考定价入口，改为功能、博客、创作者的信；仅在候选中生效。

## 性能、隔离与维护

- 没有新增 npm 依赖。全部画面无 Canvas/WebGL；复用已有 Motion 视口检测、共享动态偏好、BrandMark、Button 和 BlueprintFrame/Divider。
- 动画不触发布局，主要为 transform/opacity；少量 SVG stroke-dashoffset 仍可能绘制，不能声称所有动画零绘制成本。
- 文案/按钮不参与无限动画；无鼠标追逐、定时 React setState、常驻逐帧 JS 布局读取。CSS 持有时间线；暂停和后台/离屏通过动画状态冻结，减少动态效果移除装饰动画。
- 首屏比较页源码与 CSS 只被 hero-lab.html 引用；正式 vite.config.ts 未改。生产构建仍只有 index.html、demo.html，没有首屏候选资源入口。
- 单独以 Vite 临时配置构建 Demo 到 `/tmp/folune-hero-lab-build`，JS 208.09KB / gzip 66.13KB，CSS 287.01KB / gzip 49.13KB。这个数字包含 React 与整个现有 DS/global CSS，不是背景特效的增量成本。复用生产 CSS 使 Demo 真实，但正式集成应只选中一套，不搬实验台。

## 实际验收

- 当前正式首页源码与实际浏览器基线均已读取；Ego 的页面结构提取成功，截图接口超时，后续视觉验收改用 Codex 可见浏览器，没有把截图失败当成页面失败。
- 1440px 桌面依次查看三套，检查标题层级、散页裁切、主轨与价值条对齐；A/B 缩短后复查。390×844 查看 A/B/C，页面 scrollWidth=390；C 纵向更长已作为明确缺点保留。
- A 可见桌面两秒采样 241 帧，帧间隔中位数 8.3ms、P95 8.5ms；两帧 transform 确认纸面实际在动。B 约 1.2 秒采样 145 帧，P95 8.9ms。仅代表当前机器的短时结果，不等于低端设备、耗电量或所有浏览器性能保证。
- 点击暂停后装饰动画全部进入 paused；模拟 prefers-reduced-motion 后装饰动画为 0，标题 opacity=1。检查完恢复系统媒体模拟与正常播放。
- 本次候选页面控制台没有 error/warn。类型检查、模块 oxlint、正式生产构建及 Demo 独立构建通过。正式构建有已有 Mastra 的 Node module 浏览器兼容提示，未归因于本次首屏。
- 正式后续 APP 区未装配到 Demo，因此衔接判断依据当前正式页、共享轨宽与候选高度，不冒充全页集成验收。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
