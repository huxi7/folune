# app/src/styles/
> L2 | 父级: ../../CLAUDE.md

章节空轨：LandingSections 的 LandingChapter 成对包围评价、产品功能组（核心功能、关联展示、功能细节）、指南和精选博客，共八条；landing.css 统一提供桌面 48px、767px 以下 28px 的独立高度。每章结构固定为斜纹带→上空轨→内容→下空轨→斜纹带，相邻章节共用一条 14px 斜纹带。评价/指南/博客的侧纹在章节外框各装配一次，从上空轨一直铺到底部空轨；靠正文的横线与节点仅落在主轨内，使两侧纹样连续。空轨中央保留页面底色，BlueprintFrame 竖轨持续贯穿；产品功能组沿用无侧纹空轨与全宽内边界。

侧导轨纹样：landing.css 为 LandingRailTexture 统一绘制每侧固定七条、端部与内部中心距一致的纸缘（轨间八等分）、每侧三组横向回环编织与 20px 网格/10px 点阵；墨蓝主层 17%、次层 8.5%，索引点/线分别 26%/9%。三处均以包含上下空轨的章节外框为定位边界，纹样只在两侧导轨间绘制，无纵向渐隐，横向两端各 16% 渐隐，轨间 48～80px 渐退。主横纹以 36 单位等距重复，振幅 18/14.25 的饱满弧与扁平弧交替，小弧比大弧低约 20.8%，相邻主弧最窄间隙为 3.75 单位；两种都比前版 21 单位更扁平，次层用纵向振幅 32 的长幅摆线沿横向回折成环，相邻行翻转，交叠产生纵向编织观感；不存在独立纵向曲线；SVG mask 以横向三等分宽度、纵向 15/16 周期铺开，SVG 高度为 72，行距从 43.2 收至 36，大弧保持上一版大小，non-scaling-stroke 保持 1px 线宽，纸缘及格点用 CSS；不改变正文几何。

侧纹显现：paper/weave/index 共用 Motion inView，章节进入视口 240px 后同步播放 1050ms 缓入缓出。pending 明确 visibility:hidden；revealing 直接动画化两侧绘制层的原生 mask-position（112%→0%），双倍高度遮罩的 50%→56% 渐变提供 12% 柔边，不再通过父层继承自定义属性驱动子层重绘。左侧动画结束提交共同 complete 并去掉遮罩；花纹浓度、尺度与横向渐隐保持。模块内存保证路由往返不重播、刷新重置；减少动态直接显示，1312px 以下隐藏不消耗播放机会。

展示背景边界：landing.css 为 APP 展示区和两处图文图片区共用直角底色与细点阵，背景铺满各自矩形且不可接收指针事件，图片在背景之上。APP iframe 外壳使用 DS 平滑圆角，Demo 内 Paper/Panel 继续复用已有平滑轮廓；功能区五张图的直角虚线规则独立。

功能细节左侧交互栏与博客目录/文章标题区的点阵浓度统一为 15% 墨蓝，保留各自粒径与 8px 间隔；交互栏仅当前展开项显示点阵，收起项保持原底色，背景随 data-active 切换，不增加元素或动画。

Hero 文字层级（2026-09-18）：主标题沿用品牌墨蓝，副标题单独以 55% landing-ink 混合 landing-bg 得到浅灰，参照用户提供的 Laper 主副标题对比；不改变文案、字号、布局或其他区块文字颜色。

Hero 背景定稿（2026-09-19）：正式页采用 02A GrainGradient wave，60svh 为优选最小高度；桌面按实际 Header/公告/三栏高度和 64px 产品露出预算收缩，范围 440–800px，手机使用 400–700px 的 60svh。画布扩展至外轨，浓淡 78%，中央纸色遮罩 65%，沿用 Lab 的中心位置、外围及下沿渐隐；旧 Hero SVG 背景退出装配，文字、按钮和导轨坐标不变。

营销顶栏：56px 高度内增强品牌字标与导航间距，右侧打开/下载使用 DS 32px compact 高度、12px 横向留白与等宽列，保留共享材质和 14px 文字；手机导航换成独立横向第二行，锚点避让相应增加。

登录公告骨架：LoginPage 的 auth-announcement-frame 复用 fullBleed BlueprintFrame，与首页保持相同主轨宽度和外轨坐标；auth.css 只防止该框架在单屏布局中被压缩，正文布局不依赖公告宽度。
登录背景：auth.css 在正文独立层叠上下文内承载 01A 散墨，32% 浓淡、上下边缘淡出；背景不占文档流且不截获指针，卡片与视频保持原布局。

成员清单
marketing-motion.css: 首页/博客/动态/登录共用 8px、360ms 正文浮现，32ms 错峰最多 128ms；原生路由快照中顶栏固定、导轨只淡换，可视正文独立入场，普通滚动用同一 CSS 曲线只播一次，减少动态立即显示，Paper 过渡不受影响
landing-demo.css: 独立 Demo 入口专用，限定视口与三栏等高、Paper/Canvas 互斥显示；不增加底部工具栏或新视觉皮肤
blog.css: 博客与动态分区共用的目录/阅读样式，目录统一整行文字列表及空集合状态，Hero 顶部空轨放返回首页，列表复用 landing-chapter-gap 成对留白空轨，weave 侧纹以列表为定位边界、不覆盖上下空轨，空轨靠列表一侧的横线以 fullBleed 贯穿左右外轨，hover/focus 为中性灰底与主题色标题；index.css 在 Landing 后同层加载的博客样式，首页三列卡片保持原样，阅读页保留点阵标题区与居中返回、导读框和窄栏阅读；正文实景图保留原比例并附简短图注，继承 Landing 字体/墨蓝，768px 以下单列，无卡片位移动画
motion.css: 通用 Motion 消费与验收布局层，Panel 内容窗口裁剪顶部浮现但不改变自身高度，保留式视图定位、通用浮层单一动画所有权、普通路由淡换及共享 Canvas/Select/User press；原 Paper 方向的几何节奏继续由 knowledge-canvas.css 拥有
.gitkeep: 保留产品样式目录
CLAUDE.md: 记录样式层职责与文档协议
global-base.css: 全局浏览器基础层，消费 index.css 语义 token，收口文档根、表单字体、选择色、滚动条、指针与 reduced-motion 兜底
landing.css: CTA 以 160px 暖白双层底座承载 132px 高紧边界纸标，外缘 40px 与内缩 6px 的内托 33px 圆角共用平滑曲率，内托以 5% 细边和低对比暖纸色过渡保留双层层次，标题以 clamp 在 32–48px 间响应式缩放、行高 1.25，收尾按钮复用顶栏 compact 高度与横向留白、取消共享动作的 112px 最小宽度，底座几何与品牌原图不变，仅作用于收尾品牌；营销顶栏 BrandMark 只把共享 5:4 图字组合缩至 20px 图高，字形沿用 Source Serif 4、字色为 88% Landing ink，不再维护独立字高与间距；关联以侧栏叙述、相邻双纸面与原句标记收紧阅读路径，局部字号覆盖只作用于 Landing；指南 240px 横向六格、18px 标题/13px 摘要，分类与编号分居顶栏两端，插画融入背景； Landing 原布局/背景与响应式排版；功能细节独立使用 5:7 展开/实景图结构，展示区桌面固定 456px、窄屏固定 420px 展开区加 320px 图片区，flex-grow 分配左栏剩余空间，收放不撑动外框；标题继承其他区块的黑色 h2；行高、标题尺寸与正文网格共用 DS tree 过渡，避免退出卸载导致收尾重排；选中项内容垂直居中；Header 说明 14px、展开标题/正文 18/12px、底部标题/说明 14/12px 均消费 DS token，次级文字用 muted-foreground；底部紧凑四格仅文字，窄屏上下展示、摘要双列；英文保留参考字体，中文回退 DS 宋体/黑体，按钮直接继承 DS 材质、16px 平滑曲率和按压状态，Footer 与主按钮共用 --primary 墨蓝；分别定义衬线标题、正文、代码及注释的字号/行高，信纸保留错位纸影、斜线框、品牌母图和白底，以每行约 38 汉字的正文列（540px @14px，落在 WCAG CJK 的 40 字上限内，与 Laper 参考稿同值）、分段留白与 32px 圆形头像承载创作者长信；评价采用六个深色字母机构标识与字标、两侧短评与中间方格纸长卡，窄屏长卡置顶；Footer 恢复参考基线 388.72px 最小栏高，采用品牌宽列与四组长短错落导航，链接间距 16px，品牌署名上下分置，窄屏品牌通栏、导航双列，Folune 使用 Avenir Next，8% 白色描边位于 4px 周期、16% 白色的细密斜纹下方；共轴导轨和首页纵向越界限制独立于排版 功能区标题随中文内容自然定高，图片卡片纵向 40px、横向 48px；五张图共用 1px 实线内框和外扩 6px 的虚线轮廓，轮廓不挤占图像或网格。
note-paper.css: 共享纸面视觉层，唯一实现 .note-paper 与 thumbnail/reader/showcase 三个 variant 的纸边、曲率、Editorial 标题与摘录收尾，并声明 .paper/.paper-body 两个视图过渡分类（壳可拉伸、正文不可，节奏见 knowledge-canvas.css）；thumbnail 用固定 16px 排版基准匹配画布的像素几何，标题/正文/内边距/渐隐范围只随画布缩放，不受嵌入页根字号二次缩小；thumbnail 让正文写到纸底后以五段文字透明度连续衰减，并叠加完全无填色的渐进背景失焦，禁止不透明覆盖层形成横向色带，reader 按 ISO 216 的 1:√2 立成 A4 开本（宽取 40rem/视口高/视口宽三者最紧者，高由比例导出），消费 --paper-float-shadow 的渐变柔影，纸面静止而正文在纸内滚动、页边固定为纸宽 8%；showcase 只自然展开正文，不加滚动或渐隐；Canvas 卡片与预览共用，禁止任何组件复制近似 Paper 样式
workspace.css: AI 历史与对话共享一条顶栏，列表无需重复标题留白； 账户/外观、订阅、Paper First Stage、48/32 侧栏创建 split、浮动 Panel 与树/命令/AI/Trash 布局。主 Paper 开本高度优先：`--paper-opening-height` 取两条 Panel 内缩线之间的可用高度，纸宽按 7:9 反算（无宽度上限，横向装不下时 `min()` 交给可用宽度），高度由同一 grid area 的无内容比例基线给出，真实正文与基线取最大值所以长文自然长纸；舞台上下留白必须正好等于 inset，否则空纸就会被第二套边距顶出视口而滚动；那块基线必须 `min-width: 0`，否则它把行高按 7/9 反算成自己的 min-content 宽度贡献，唯一那条列轨道随纸变长而变宽，正文与顶栏一起被推到纸的右侧之外。Toolbar 在 Paper 内 sticky 且 `top` 是 `--workspace-panel-inset` 而不是 0——它与左右 Panel 表头共用同一条横线，钉到浏览器顶边就爬出了纸面。静止透明；凝结区间由纸上的 `--toolbar-condense-from/to` 与 `--toolbar-title-from` 一处给出，被动画的量只有一个：注册为 `<number>` 的 `--toolbar-condense-progress`，原生 scroll timeline 以显式 `linear` 与 `animation-duration: auto`（进度型时间线忽略时间 duration，写毫秒数只会骗读代码的人）在 24–80px 把它从 0 推到 1，实底高度、hairline 浓度、软边高度、模糊半径与遮罩强度全部在消费点乘它算出来——「同一个 scroll progress 连续驱动」因此是结构事实，不是两条时间线恰好对齐；实底锚在顶栏**下沿**并向上长满 `--toolbar-condense-cover`（`--panel-header-height` + `--workspace-panel-inset`）——sticky 停在内缩线上，顶栏上方那条 inset 一滚就成了纸的内部，正文从中穿过并被滚动容器上边缘切断，所以凝结要盖的是顶栏加那条 inset；下沿锚定同时让另一件事变成结构事实：实底下边界恒等于顶栏下边界，于是软边的 `top` 是常量 `100%`（真空无处可生）。顶栏不画任何底边线，铺开的只是同一个 `--paper-surface`。软边从那条恒定边界长到最多 `--toolbar-edge-max` 16px，`::after` 里纸色梯度回答「被盖掉多少」、遮罩回答「模糊到哪儿为止」，遮罩比纸色多留一小段尾巴，于是正文先变软再被纸吃掉而不是走到某条线上突然消失；纸色不透明那一端必须留在软边最顶上与实底严丝合缝，低于 100% 就会在 hairline 底下透出一行鬼影；两条梯度都用相对百分比，因此形状跟着那 16px 一起生长，模糊半径 `--toolbar-edge-blur` 6px 同乘进度所以进度 0 就是 `blur(0)`——顶栏静止时连一层模糊都不存在，不存在固定模糊带；标题晚 12px 起步、只淡入不位移，回顶沿同一路径融回；没有 scroll timeline 的浏览器挂一个高度为 `96px - inset` 的哨兵做一次 `data-condensed` 软切，软切也只切那一个进度，JS 里没有第二个阈值。动作槽位固定；顶栏 control 的 32px 高度只声明一次且不住在任何一个控件身上（`.app-main-toolbar .ds-button, .app-main-toolbar .archive-status`），因此整理、三枚图标与归档落点没有一个再自报身高，往这条顶栏加控件天生就已对齐；四个无标签图标（返回来路、进入 Canvas、阅读切换、更多）另有唯一一条只补正方形另一维的 32px 几何，于是容器、hit area 与那个 16px 图标共用同一个中心，圆角由 `.ds-button` 基类给出而不各自重申；三枚中性图标显式把 hover/active 表面改成 `interactive-hover`/`border` 并让归档落点补上同一份 `--press-scale` 原地收紧——ghost 基类给的是 `--muted`、落点给的是 `interactive-hover`，两个控件就挨着，「指向一个控件会怎样」不许有两个答案；品牌软色只属于整理，中性命令一个 primary 都不沾，时长与缩放全部留在 `.ds-button` 基类与唯一那份 press token 里；右侧命令区整理与图标簇相隔 8px，簇内相邻命令使用 4px gap，由 `.note-view-actions` 与 `.markdown-view-menu` 两条 gap 表达，视图组不再自带 margin；整理独立文字槽向下光学校正 0.0625rem，图标与 spinner 保持共轴，APP 与 Demo 共用此规则；`.note-organize-button` 只覆盖 ghost 底座的前景/hover/active token 形成 Quiet Accent（静止那三项透明来自基类，因此这里一条都不重申，loading 实体来自 `.ds-button-loading`）；顶栏自身 `overflow: visible`（它要放得下垂下去的更多菜单，且 hidden 会让它成为 nearest 滚动容器、凝结时间线永远 inactive），需要裁剪的只有 `.app-main-toolbar-leading`，用 `clip` 而非 `hidden` 以免同样拦住标题淡入。层序在此显式声明：容器（浮动/常驻 Panel 60/80、Stage 角标 70）< Archive Cord fixed Overlay 84 < 弹层（85/90+），侧栏 header/footer 2 > 树 1 —— 三段各带 fill 常驻的 opacity 动画，都是 z-index: auto 的层叠上下文，交给 DOM 顺序就会让树吞掉新建菜单。Archive Cord 的全部视觉只在此定义且只有三条 path：settled 是接近 hairline 的 1px/0.42 实线（要能被正文压过去——随时抢眼的线是通知而不是上下文），fresh 靠 `pathLength=1` 归一化的自绘 + 一条极轻 flow 各播一次并以 `both` 停在 settled 终值（因此降档归 CSS fill state，不需要 timer，关系也不会因为时间流逝而消失），离屏只把线收细降调而绝不画箭头或中心圆点。emphasized 是一个跨三棵子树共享的状态，故用 `html:has()` 而不是 React state 表达：source、当前代表行与线本身任一被指向或聚焦，都提亮同一条线与同一行——靠状态同步只会多出一个可能与真实 hover 不一致的答案。代表行只拿一圈 Cord 同色的极淡 inset hairline（不用 Soft Ink 蓝底，那会与当前选中、拖放落点、搜索命中争语义；窄屏没有跨层线时它就是唯一的落点反馈），并用三条 selector 压过树行自己的 `box-shadow: none`。关闭与窄屏只降 opacity 而不 `display: none`——状态还在，重开即恢复。窄屏隐藏比例基线并按可用视口。纸壳/正文仍分属 .paper/.paper-body 视图过渡，Panel 开合不改变 Stage 几何
workspaceLayout.test.ts: 工作区浮层 Sidebar 的 CSS 契约测试，锁定 Panel 开合状态不再写入父级网格轨道、Paper/Canvas 始终占据唯一全屏 Stage、容器 < 归档线 < 弹层与侧栏三段的显式层序，并保证 Canvas 对侧 Dock 在窄屏 backdrop 上方直接切换互斥 Panel，而标题留在遮罩下
designSystemContracts.test.ts: 设计系统 Radius 与 press 静态契约测试，锁定 16px Control、显式 12px inner、Button 继续引用共享 token、AI Composer 32px send/stop 的 round 圆形例外，以及 .ds-button/SidebarButton/EdgeDock/Toolbar icon/创建 split 共读同一份 --press-scale 且 Reduced Motion 归 1；创建 split 的 hover 与 press 两条都必须点名 .sidebar-create-main/.sidebar-create-more，宽 `button` 会把展开的菜单项算成这颗 split 的一部分，让反馈落在指针根本不在的控件上
paperGeometry.test.ts: 主 Paper 几何契约测试，锁定桌面 7:9 重叠基线、基线以 min-width: 0 退出列定宽、编辑列无第二条 vh 公式、CodeMirror 交还纵向滚动、窄屏取消比例，并保护 reader 1:√2
mobileToolbar.test.ts: 窄屏 Paper Toolbar 几何契约，锁定 479px 以下内边距/间距收紧；顶栏只剩 Quiet Accent 整理还带文字，因此需要收紧内边距的也只剩它一个
ai-message.css: AgentPanel 与 Design System 共用的 AI 消息视觉层，承载 Primary 同源用户气泡、无卡片最终正文、最多五词常数节点错峰模糊拖尾、Formation ThinkingIndicator，以及带人话详情、灰阶结果符号和活动态 shimmer 的 Secondary 同源工具披露控件；流式正文不提供光标，非末条历史消息使用原生 content-visibility 降低长会话布局成本，末条保持完整测量，过程与正文之间只使用自然留白，不绘制固定分隔线
aiMessagePerformance.test.ts: 静态锁定 Chat 历史消息 content-visibility 只作用于非末条，防止流式末尾滚动测量回归
auth.css: 独立登录页的 384px 表单/96px 桌面栏距与完整 3:4 背景视频布局；01A 散墨在正文后层以 32% 浓淡和上下遮罩融入纸面，不截获交互；卡片以接触影/环境影/下投影构成轻实体表面，输入框 hover/focus 共用 3px 低透明度墨蓝光圈，眼睛只作灰黑变化；959px 以下保留单列表单
design-system.css: Quiet Editorial 基础组件视觉层、BrandMark 已选③紧边界图/固定 SVG 字标的 5:4 布局比、94% 字形纵向光学收缩与统一间距比例（22px 图高基准，Demo 跟随 rem）与 ThinkingMark Formation Motion；Dialog 提供 panel/bare 表面及 motion=none 模式，而 motion=none 连遮罩都不自带淡入——遮罩自己淡入会被视图过渡拍成「新状态里没有磨砂」，于是背后内容整段清清楚楚、过渡结束才一下盖上来，磨砂因此交给 root 那对截图去带，只有不支持视图过渡的浏览器才由 @supports 兜一次 140ms。也正因为遮罩属于 root 那张截图而不是自带过渡身份，磨砂玻璃在这里是完整可用的，不必为了截图退化成一块不透明色；Input/Select、Skeleton/Loading 与 reduced-motion 规则继续由本层统一
button.css: Button 专用视觉层；统一 36px 标准命令高度、14px/18px UI 文字、14px 横向留白、6px 图文间距、16px Control 曲率，以极轻 180deg 同色明度坡度、短中性落地阴影和不成环的宽淡面光恢复实体材质；hover 固定原位并放宽外影，press 共读 scale(var(--press-scale)) 且撤掉外影只留浅内压，Primary/Danger 仅有极弱同色环境层，Secondary 保持中性，Ghost 无实体阴影，Saving 继续使用 16 度倾斜窄光带
sidebar-button.css: SidebarButton 专用 32px compact 平面视觉层，APP/账户导航与 36px 标准 Button 共享 16px Control 曲率而不强制等高；hover 消费全局中性 interactive-hover，active 只使用轻中性表面和墨色并共读全局 press 收紧比例，hover/press/选中不抬升，侧栏底部 Design System/回收站以 12px/16px Label 文字和 primary 前景色表达当前位置
segmented-control.css: 分段选择的静态文字/轨道材质与独立选中底片，底片布局迁移由组件 Motion 独占，文字不位移或缩放
toast.css: Kumo Toast Parts 的顶部居中三条轻堆叠，条目随内容定宽且不超过 22rem，消费展开/滑动状态；中性不透明 Popover、12px 曲率与柔和阴影，行内倒计时/细边柔影 Secondary 撤销按钮、轻量图标和无底色关闭，裁剪只属于 Content 以保留条目间隙的悬停衔接，窄屏保留安全区；禁止玻璃、彩色容器与第二套按钮
user-menu.css: 账户菜单材质与中性 hover，入退场统一交给 PresenceSurface，不再保留 CSS keyframe 的第二动画通道
codemirror.css: 未分层的 CodeMirror 6 适配层；写作 Paper 覆盖 height/overflow 让编辑器按正文自然增长并把唯一纵向滚动交还 paper-stage-scroll，其他宿主仍使用 100% 高度。继续维护 light/dark、14px source/15px live、Editorial 标题/引用与 GFM 显示，pre-wrap 保真空白
cord.css: Cord Signature 表现层，按语境把 --cord-color 映射到既有 --archive-cord/--primary，承载 pathLength 归一化的出场自绘、虚实区分与自中点向两端流动的双层白光；外发光用更宽更淡的第二条描边而非 feGaussianBlur，reduced-motion 直接静态
knowledge-canvas.css: 静态选中与框选使用细蓝边；紧贴单张笔记的原生/补画选框共用 Panel 平滑圆角，多对象范围框与自由文字保留矩形；按住期 React Bits ElectricBorder 的 2.5px 纸边及 3px/8px 同色柔光临时替代外框、松手立即恢复，Reduced Motion 停相位、forced-colors 回退系统轮廓；关系说明以独立 translate 保持居中，标签层高于节点且不抬升关系线； Canvas 表现层，同时是全站纸面视图过渡节奏的唯一落点。Grip 是底栏元信息行最右端的流内格子（`position: relative` 只为继续压住 z-index 4 的 whole-card target，"拖到别人的抓手上等于取消"依赖这个次序），不再骑在卡片圆角外，拖拽即隐藏；whole-card target 静止零命中、连接会话才开放；目标反馈分两档且都只动那条 1px Soft Ink 细边——候选（primary 46%）说"这些都能接"，指针正下方那一张（primary 78%，判据取 React Flow 自己的 connectingto/valid）说"松手就是它"；三股临时绳沉到 `z-index: 0`（与已成立的关系线同一档、DOM 在其后所以仍压在它之上），因此拖线钻到卡片底下而不覆盖正文——这条必须写在未分层边界，React Flow 的 style.css 不在 cascade layer 里；三股透明度由深到淡 0.88/0.5/0.26，与几何层的 strandSpeeds 同序（越淡跑得越快）；末端珠子是实心 primary + 一圈画布色描边并靠 `paint-order: stroke` 把描边整圈留在外面，于是它压住从底下绕过的三股。临时绳/珠子都不拦指针，Reduced Motion 静止。底部 Panel 仍是透明定位壳，图标化内容动作与视口动作共用中性 Ghost surface、以 8px 留白表达分组并在窄屏让出保存状态。纸面规则只写一次，四个方向只在 html[data-paper-transition] 上声明 --paper-morph/--paper-world；正文零过冲、永不缩放、交接互补、世界先落定的既有五律不变，正式关系线仍由 CanvasCordEdge/cord.css 独立拥有
design-system-workspace.css: AI 历史与对话共享一条顶栏，列表无需重复标题留白； DEV Design System 五层生产矩阵与响应式样式；直接可视化 Foundations、16px Control 与 12px inner 同心样板、Lucide 精选生产图标与整理/拓展语义对比、真实主题切换、CodeMirror/Reading/Quote/Code 及 Paper Surface/Edge Dock/Archive Cord，所有演示只消费生产 Token；与 color-lab.css/archive-cord-lab.css 同一条隔离规则，不由 index.css 全局引入，只随 widgets/DesignSystemWorkspace/index.tsx 在 DEV 懒加载
archive-cord-lab.css: DEV `/archive-cord-lab` 验收台的隔离样式，只提供说明正文与坐在纸外的验收控制条；刻意不含任何归档线、代表行或 source 规则——那些必须由 workspace.css 提供，否则 fixture 验的就不是线上那条线
color-lab.css: DEV `/color-lab` 蓝色终选决策画布，以同构静态 Library/Paper/AI 工作区、候选选择与 Light/Dark 响应式控制消费 index.css 隔离的现有蓝/灰蓝/标准墨蓝/柔和墨蓝 token；不定义颜色值、不读取业务状态、不改生产主题

职责: UI 样式实现层；landing.css 隔离营销页，workspace.css 承载 Paper/Canvas 共用产品壳，note-paper.css 收口共享纸面，knowledge-canvas.css 隔离图交互，ai-message.css 让生产 Activity 跨 AgentPanel/Design System 同源，design-system-workspace.css、color-lab.css 与 archive-cord-lab.css 分别负责组件陈列、隔离配色决策与归档线真实交互验收，codemirror.css 跨越第三方级联边界；所有文件消费 app/src/index.css 的静态语义 token 与 DS motion.ts 注入的同源动效变量，颜色插值统一使用 sRGB。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

2026-09-09 Chat 会话切换：workspace.css 用现有 DS Skeleton 组合目标会话的消息区与 Composer 占位；历史页点击后先进入目标内容窗，加载态维持同一空间骨架，不新增第二套 shimmer、卡片材质或位移动画。

2026-09-04 Toolbar refinement: `.note-view-actions` 使用 12px 外间距，`.note-view-cluster` 与 `.markdown-view-menu` 使用 4px 簇内间距；顶栏 32px 高度由 `.app-main-toolbar .ds-button, .app-main-toolbar .archive-status` 一条规则统一给出，整理只保留 Quiet Accent 的前景/hover/active token。

2026-09-04 滚动交界收口：凝结的被动画量收敛为一个注册 `<number>` `--toolbar-condense-progress`，`.app-main-toolbar::before` 的实底高度、`.app-main-toolbar::after` 的 top/高度/`backdrop-filter` 模糊半径与遮罩强度都在消费点乘它算出来；软边上限由 20px 收到 `--toolbar-edge-max` 16px，模糊 `--toolbar-edge-blur` 6px；实底改为下沿锚定并新增 `--toolbar-condense-cover`，区间由 40–96/52–96 收到 24–80/36–80——正文抵达顶栏下沿只需 `1px 纸边 + 正文上边距`（窄屏 33px），96px 的终点来不及，顶栏上方因此长期漏出半行被切断的正文。软边的 top 现在是常量 `100%`，真空段没有可以存在的位置；进度 0 即 `blur(0)` 且高度 0，因此不存在常驻模糊带。

2026-09-04 顶栏底边线删除：`.app-main-toolbar::before` 不再有 `border-bottom`，铺开的只是同一个 `--paper-surface`。那条线不是装饰而是谎言——纸在滚动中继续往窗口上方延伸，顶栏上方本来就是纸，可一有线，眼睛就把「窗口上边 → 线」整段圈成一个物体，顶栏于是从 48px 读成一整条随滚动变宽的 chrome。边界改由下缘软边独自表达（它本来就在说同一句话），因此顶栏与 Paper 全程同表面同颜色，既没有独立背景也没有第二种表面。

2026-09-04 形制投影：主 Paper 阴影收敛为在 16px Stage inset 内自然衰减的短尾，避免滚动视口边界硬切。（同日更早那条「顶栏右侧相邻命令统一 8px gap」已被上文 12px/4px 两层分组取代，桌面顶栏不存在 8px 这一档；只有 ≤479px 断点为防溢出把整理与图标簇收到 8px。）

2026-09-07 视觉收口：设置暗色在模态内部映射中性黑灰；Skeleton 全局使用无彩灰阶；Canvas 加载不画纸；Secondary 提高细边框对比，工具结果直接用圆形轮廓图标。

2026-09-07 曲线规范：生产样式将 border-radius 与 corner-shape 同处声明，取消容易漏项的独立 supports 选择器清单；固定笔记、更多/右键/权限/@菜单及 hover 行全部覆盖。菜单外壳使用 Menu 12px、行与紧凑动作使用 Compact 8px；Canvas 预览与 Toast 关闭不再使用圆形命令，头像/状态点/发送停止等几何语义显式 round。designSystemContracts.test.ts 检查生产规则的 token 与曲线配对。

2026-09-07 Menu consistency: design-system.css 单独拥有审批/更多/新建/右键/@/Select/账户菜单的背景、边框、前景、曲率、4px 内边距与阴影；业务样式仅负责定位与内容。审批菜单当前项用勾选标记，hover/focus 才铺中性底色。

2026-09-07 Scrollbar refinement: global-base.css 消费 index.css 的淡中性 scrollbar-thumb、透明轨道与原生 thin，forced-colors 交还系统。workspace.css 的文件树/消息列表用 space-3 抵消父内缩并在滚动区内部保留内容留白，滚动条贴 Panel 边缘；历史/设置/结果列表/输入区统一稳定 gutter，避免文字与滚动条抢位置。

2026-09-07 滚动条颜色微调：在中间节点的原生 thin 与容器位置基础上，只降低 thumb 不透明度，浅色 14% → 11%、暗色 16% → 13%；颜色轴、宽度和位置不变。

2026-09-07 滚动条颜色再收淡：保持 alpha 11%/13% 不变，只把浅色 black 改成 rgb(96 96 96)、暗色 white 改成 rgb(190 190 190)，以中性灰降低对比度；宽度、位置和轨道不变。

本次侧栏生命周期约束：Paper/Canvas 只承载中央内容与工具开关，左右工具由 Dashboard 的 WorkspacePanelLayer 持续挂载；从笔记进入默认画布继承当前工具开关，动画不得重建 AgentPanel。
