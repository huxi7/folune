# app/src/widgets/
> L2 | 父级: ../../CLAUDE.md

成员清单
updatePosts.ts: 独立动态内容源，复用 BlogPost 类型并由 /updates 的共用列表/阅读页消费；初始为空，后续只需填充文章，不混入首页或博客集合
LandingRailTexture.tsx: 首页三处侧纹与 RailVariant 类型；paper/weave 由 Motion inView 在进入视口 96px 后一次触发 1450ms 向下显现，index 由 useScroll 在区块顶部从视口 90% 走到 25% 时单向推进遮罩，避免末章滚动速度吞掉显现过程。模块 Set 按纹样记录当前文档已触发项，向上回滚不倒放、路由往返不重播、刷新重置；章节外框内各装配一次，纸缘/编织/格点连续覆盖上下空轨和正文
LandingConnections.tsx: 左侧叙述方法与实践，右侧两张相邻 NotePaper 标出支持关系的原句；短线随纸面布局连接，静态公开材料不装配业务会话
LandingGuides.tsx: 六篇方法指南的紧凑三列两行目录，共读分类、标题与摘要，序号列于右上；上下空轨和交织侧纹交由 LandingSections 的章节外框装配，guides 为入口，保留 use-cases/extensions 锚点，返回复用博客协议
guidePosts.ts: 六篇完整记录方法文章，独立于首页三篇精选，以 BlogPost 类型加入同一公开目录
GuideIllustration.tsx: 六种纸张/段落/路径静态 SVG 线稿，由指南卡片与目录封面共同消费，useId 隔离渐隐定义
LandingHeroLab/: 独立首屏研究，主候选恢复为 01A/02A，否决 B 版仅保留旧收藏兼容；可调材质/高度，多组命名收藏及备份，复用生产排版与可选 APP 衔接，只由 hero-lab.html 加载
landingBlogData.ts: 三篇首页精选、四篇细节与六篇方法指南的公开集合；首页精选独立导出，细节内容从 landingDetailData 汇入；整理与画布指南使用功能截图中的写作研究示例和可选章节实景图，稳定 slug/摘要/章节供首页、功能入口、目录与正文共读；同组继续阅读限制三篇，署名复用 huxi 头像
BlogCover.tsx: 原创细网格 SVG 封面，散页、递归枝条与笔记关系三种构图对应记录/归档/Canvas；useId 隔离多实例图案引用，另为六篇指南复用 GuideIllustration，原三种封面保持；无动画和外部图片请求
LandingBlog.tsx: 首页固定三篇精选博客卡片；上下空轨和格点侧纹交由 LandingSections 的章节外框装配，整卡单一 Router Link，链接携带来路供阅读页返回并恢复滚动，查看博客进入 /blog；纹样不扩散到目录或文章页
LandingEditor.tsx: 保留原导轨和 738px 展示框，平滑圆角外壳统一裁剪受限 demo.html iframe；ShowcaseBackdrop 独立置于后景，不传递真实账号状态
LandingDemo/: 无业务会话的内存产品演示，复用 Paper/Toolbar/树/生产工具芯片/Canvas 视图；AI 面板按脚本逐步揭示真实工具调用，唯一的写操作与工具条共用同一归档入口并可真撤销；无底部额外工具栏
landingReferenceData.ts: Figma 素材路径、英文代码分段与中文扩展卡片说明，不读取远程数据
useTreeReorder.ts: AppSidebar 结构重排 FLIP Hook，手势前捕获位置、完成/取消归还租约；ResizeObserver 只刷新快照，文件夹展开不会再触发行位移动画
TreeDisclosure.tsx: 文件树与 DS Collapse 的薄适配，声明可打断、成对释放的归档运动租约，让 Overlay 跟随真实高度几何；不读取业务数据
.gitkeep: 保留业务组合组件层空目录
CLAUDE.md: 记录业务组合组件层职责与文档协议
MarketingHeader.tsx: 首页/博客/动态共享的 56px 品牌、内容导航和双动作顶栏；核心功能、博客、使用指南、价格、关于、更多构成六项导航，更多直接进入 /updates，价格与下载正常可点但暂不执行动作；打开用 Secondary 复用唯一认证弹窗，下载用 Primary，query 保留博客来路和阅读位置；手机以第二行横向导航保留全部入口
MarketingAnnouncement.tsx: 紧贴粘性导航下方、约为 Header 2/3 高且随页面滚走的无关闭公告栏，在背景全宽、1088px 主轨与正文对齐且宽屏带视口外轨的 BlueprintFrame 中居中呈现标签、正文与 2px 箭头反馈；hover 不填充蓝色背景
BlueprintFrame.tsx: Landing 纵向导轨容器；导航、1120px 正文与页脚共用主轨/外轨坐标，fullBleed 增加可选外轨，颜色由当前区块局部覆盖
BlueprintDivider.tsx: Landing 横向导轨；14px 分隔带上下两条边分别共置横线与菱形，flush 提供零高度边界，compact 保留 7px 内部分隔带而不添加参考中没有的节点
AuthDialog.tsx: 复用 BrandMark 紧边界图的登录/注册统一认证 Dialog，复用共享内凹 Input/PasswordInput 承载邮箱、双密码与显隐控制，并提供协议提示、六格 OTP 自动校验与 Google OAuth 入口
LandingHero.tsx: 中文公告、60svh 居中 Hero、三列价值条与真实 UI 互动插槽；装配选定 02A HeroBackdrop，并量取 Header/公告/三栏高度为矮屏保留 64px 产品露出；三栏沿用用户定稿「专注记录 / 有序归档 / 连接想法」，LandingActions 与顶栏统一为 Secondary「打开」与 Primary「下载」预留动作，auth query 交给 MarketingHeader 唯一认证弹窗；边界复用通栏 BlueprintDivider
LandingFeatureDetails.tsx: 第 11 区块的四项垂直居中展开说明、对应实景图与底部紧凑四格摘要；标题区和展开正文保留文章入口，底部只含标题和说明；固定展示区内以同源 CSS 时间轴协调行高、标题与正文，正文常驻并在收起时 inert，选中项只保持展开、不显示收起图标，图片不附重复图注；detail query 保留选中项，切换清除已消费的定位锚点，替换历史并保留其他查询/滚动，博客沿 fromBlog 协议返回
landingDetailData.ts: 归档线、引用选择、同一份原文、Markdown 导出四项细节与完整指南；实景图与文章数据同源，BlogPost 仅类型依赖，不建立运行时反向导入
LandingSections.tsx: 保留五项真实功能与文章入口、评价和信件；私有 LandingChapter 成对包围评价、产品功能组、指南和精选博客，共八条空轨；其中三种侧纹各在章节外框装配一次，连续贯穿空轨与正文，内侧横线仅画在主轨内；产品功能→关联展示→功能细节维持一章，相邻章节共用斜纹边界，其余区块独立持有展示与交互
LandingFooter.tsx: 共用 DS 墨蓝的品牌区与产品/资源/关于/连接四组导航；16 项预留入口（产品 2、资源 8、关于 3、连接 3）以 aria-disabled link 语义展示且不跳转，打开网页版保留博客来路并复用本地认证；品牌与入口置顶、作者与版权置底；保留 Folune 淡描边与细纹层序，不放 PNG，BlueprintFrame 延续导轨
LandingMotion/: Landing 克制反馈模块，HeroBackdrop 承载已选 02A 颗粒首屏，ShowcaseBackdrop 为 APP 与功能细节提供点阵后景，CountUp 处理数字变化；一次性 reveal 由共享动效原语承载
NotebookPreview.tsx: 确定性首屏产品预览，DS 统一缩放淡入与显式卡片 lift 分处不同元素，阴影由 CSS 持有，内部布局不参与独立动画
AppSidebar.tsx: 右键菜单通过 Portal 锚定视口，避免 Panel transform 改写 fixed 坐标；文件库内容与展开偏好的唯一所有者，负责创建/搜索、树/重命名/拖放意图、底部导航和唯一有效归档代表；重排交给 useTreeReorder，结构键按不可变树引用复用以跳过标题/摘要更新时的整树 FLIP 判据，子级尺寸交给 TreeDisclosure，业务事务仍由 Dashboard 持有
WorkspacePanelLayer.tsx: 跨 Paper/Canvas 常驻左右工具宿主，8px/220ms 入、8px/170ms 出，不缩放内容或改变 Stage；关闭即 inert，开合运动租约成对归还，保留文件树/AI 会话实例与滚动位置
SidebarCreateMenu.tsx: 48/32 split 创建入口，保持双区几何与两项命令；PresenceSurface 统一入退场，关闭即 inert，键盘循环、Escape 与触发器焦点归还保留
SidebarCreateMenu.test.tsx: 侧栏创建入口 DOM/键盘回归测试，锁定文字主动作、菜单恰好两项、方向键循环、Home/End 与 Escape 焦点合同
AppMainToolbar.tsx: Paper 内 sticky 48px 文档命令条；左侧是身份三段——真实 Canvas 返回、归档落点、滚动后淡入的 memo 标题（落点排在标题之前，标题静止时透明但仍占位，因此落点的横坐标恒定），右侧命令区按扫描顺序排 Quiet Accent「整理」（文字独立向下光学校正 0.0625rem）→ 无标签 32px Ghost「进入 Canvas」→ 阅读切换 → 弹层型「更多」，间距 8/4 且只用留白分组，静止顶栏不画竖线。顺序不是审美：核心动作必须是这一簇第一个被扫到的东西，而「更多」的菜单右对齐垂下，簇尾是它唯一不会把菜单悬在同侧控件头上的位置。整理的层级由 32px、文字与 Soft Ink 色调表达，不由填色表达——顶栏里一个 Filled Primary 都没有，那颗留给文件库的「新建」；Canvas 是导航（名词）故一个无标签图标说得完，与阅读切换同一重量。两者共用同一个无填色底座只是实现复用，不构成同一材质层级。顶栏 sticky 在 `--workspace-panel-inset` 上而不是 y=0；顶栏属于纸而不是浮在纸上的一层，全程与 Paper 共用同一表面同一颜色，**不画底边线**——那条线会把「窗口上边 → 线」整段圈成一个随滚动变宽的物体，而宽窄是物体才有的属性；凝结与下缘 Soft Edge 是同一个 CSS 进度的两个读数，首选交给滚动本身，只有不支持 scroll timeline 的浏览器才挂一个哨兵做一次软切，本组件因此不含任何滚动监听、阈值数字，也不知道软边有多高。顶栏 control 的 32px 高度与中性 hover/press 反馈同样只在 workspace.css 声明一次，不由这里逐个控件申报——整理仍显式用 `size="default"` 加文字，它与图标簇的区别是文字与色调，不是高度。归档状态住左侧不只是语义（它回答"你在哪"而不是"你能做什么"），更因为它是归档线的起点：放在纸的右上角那条线必须横穿整张纸才够得到左边的文件树。进入默认 Canvas 前由页面层完成 required flush，Toolbar 不直接发业务请求
ArchiveStatus.tsx: 整理成功/撤销后的安静落点元素；可见文案是「归档于〈末级目录〉」，完整路径只进 accessible name/title，稳定 data-archive-source 供归档线取 source 锚点，点击只委托文件库定位。它是 contextual text button 而不是 Badge：静止无填充/描边/外影，也不带状态圆点——给一条线找出发点而在纸边摆一颗常驻圆珠，等于给一个不存在的对象造了个身体
ArchiveStatus.test.tsx: 归档状态元素结构与 Rest 材质回归测试，锁定末级显示、根目录人话标签、完整路径可访问名、无圆点/无描边身体与无 presentation 时完全不占位
AppMainToolbar.test.ts: Toolbar 结构/scroll timeline 静态回归测试，锁定明确 props、整理排在命令区最左且是带图标与文字的 Quiet Accent（不是 Filled Primary、静止无背景/外影、hover 只用现有 primary-soft、界面文案不写「AI 整理」）、Canvas 是自闭合无文字的 32px square（两者不再同形）、弹层型「更多」排在簇尾且菜单 right: 0、右侧分组只用 8/4 留白、顶栏无标签图标只有一份 32px 几何、归档状态在左侧身份段且排在标题之前、命令不带任何选中下划线、顶栏 overflow: visible 而身份段用 clip，以及 sticky top 等于 Panel inset、凝结区间只有一份数值、被注册被动画的量只有 `--toolbar-condense-progress` 一个（旧的两个几何变量必须查无此名）、实底/软边高度/模糊半径都在消费点乘同一个进度且显式 linear 与 `animation-duration: auto`、顶栏三条规则里 `border-bottom`/`box-shadow` 一个都不许出现且实底只允许 `--paper-surface` 一种背景、软边 16px 与模糊 6px 只在纸上各出现一次、纸色顶端是满纸色而纸色与遮罩都收在 100%（因此既无鬼影也无残留层）、软边块里一个裸像素都没有、fallback 软切也只切那一个进度且哨兵高度不在 JS 里重写
MemoTreeBranch.tsx: 递归树行与拖放/重命名渲染器，子级用 TreeDisclosure 连续开合，行本身保持固定高度/原位反馈；归档代表仍只由父 AppSidebar 解析
MemoTreeBranch.test.tsx: 归档代表集成门禁，锁定全展开命中 memo、折叠后标记转到最近的可见祖先、多层折叠只标最外层那个、逐级展开连续回到 memo、树上标记永远至多一个、memo 缺失与树未 ready 时一个都不落，以及旧的 folder/memo 双高亮与零尺寸 marker 确已消失
MemoTreeSkeleton.tsx: 文件库首次加载的真实行结构占位组件，只组合共享 Skeleton 并由调用方控制延迟显隐
MemoNodeDialog.tsx: 文件树命名弹窗，以设计系统 Dialog/Input/Button 承载新建文件夹，负责非空校验、同级重名即时提示与提交拦截、提交锁与 API 错误展示（服务端 MEMO_TITLE_CONFLICT 也说人话），不使用浏览器 prompt 或直接访问 API
memoLibrary.ts: 后端轻量文件树的纯视图模型工具，提供路径/搜索、树内稀疏移动计划，以及仅 memo 可生成和解析的 `application/x-supernote-memo` Canvas 拖拽协议
memoLibrary.test.ts: Bun 视图模型测试，覆盖嵌套查找、搜索/路径、稀疏移动、防环与跨视图拖拽载荷校验
useMemoTreeExpansion.ts: 文件树展开偏好的设备级持久化边界；水合只由用户存储身份/ready 驱动，folderIds 用序列化语义键独立对账，避免数组身份或树刷新重置用户展开状态
useMemoTreeExpansion.test.ts: 覆盖展开快照缺失与明确全折叠的区分、损坏/旧版本容错，以及删除清理和新 folder 自动展开规则
useMemoSearch.ts: Command Palette 与 @菜单共用的正文关键词命中 hook，180ms 防抖、切换中止旧请求，只把仍存在于 active tree 的命中 ID 与 idle/loading/ready/error 状态交给调用方；网络 effect 只依赖查询/身份，tree 变化仅通过一次 ID 索引过滤既有命中，不因保存或改名重新搜索。
escapeLayering.test.ts: Escape 层级仲裁静态门禁；冒泡链只有 document 恒先于 window 两档可用，因此锁定内层弹层挂 document + preventDefault、两个壳层守卫留在 window 并让行，画布内容层同样留在 window 以免与 Dialog 抢同一档
PanelResizeHandle.tsx: 左右浮动 Panel 拖拽手柄，支持 Pointer 拖拽、方向键调整、双击复位与 separator ARIA；拖拽期间声明全局 resizing 状态，禁止布局/面板动画干扰 1:1 跟手；文件库手柄随持久宿主保留
ArchiveCord.tsx: 归档线稳定导出边界；只导出 fixed Overlay。目标标记已回归真实 tree row 的 data-archive-representative，这里不再制造零尺寸中转对象——一个不存在的组件不该继续冒充对象
ArchiveCordOverlay.tsx: 唯一归档几何调度器，消费树上唯一非 inert 代表；滚动/树高度/FLIP/Panel 期间按租约读真实矩形，保持代表迁移时间轴与 settled/fresh 语义，不把几何写进 React state
ArchiveCordOverlay.test.tsx: Overlay 结构与视觉语法回归测试，锁定 fixed 全屏、三条 path、无中心圆点/方向箭头、首帧一律 settled、关闭与窄屏只隐藏渲染（opacity 而非 display）、旧 marker/organize 连线层/目录高亮死样式确已删除，以及 Reduced Motion 不自绘不流光
ArchiveCordOverlay.lifecycle.test.ts: 架构门禁；直接驱动租约总线证明可重入、多余归还不卡死、退订即静默，并以剥掉注释的源码证明几何只进 SVG 属性、单帧至多一个 rAF、Overlay 不遍历树、结尾靠租约而非 transitionend、时间轴与树行同源且无 spring/timer
archiveCordMotion.ts: 归档线运动租约总线；tree FLIP 与 Panel Tween 在此声明「我正在动」，唯一的几何调度器据此决定要不要逐帧重读布局。按来源计数所以同源可重入、异源互不干扰，全部归零才停——静止页面因此没有常驻测量循环，不动就不读布局
archiveCordGeometry.ts: Archive Cord 纯几何；两端都取面向对方的竖边中点（不取行中心，那会让线钻进目标行里还得再画一颗圆点解释端点在哪），y 由一个 clamp 把「可见 → 贴边 → 离屏」连续走完，projection 只是给视觉降调用的读数。不存在两套会在边界互换的几何，也不产出中心圆点或方向箭头
archiveCordGeometry.test.ts: 覆盖 Paper-facing 边缘锚点与左右自动换边、越界连续贴边、逐像素滚动的单帧位移有界（阈值切换会在某一帧跳几百像素）、无 clip 即不钳制、极短/重合/离屏/反转 clip 都无 NaN，以及端点插值可重入且不过冲
archiveCordPolicy.ts: Archive Cord 语义边界；canonical 目标永远是 memo，候选链由 memoLibrary 的唯一祖先遍历给出，代表按根→父找第一个收起的祖先（先解结构再由几何解视口，倒过来就会把「文件夹收起」误判成「目标丢失」），missing 与 pending 明确分开，并在 overlay/窄屏禁止跨层连线
archiveCordPolicy.test.ts: 覆盖 canonical memo 恒定、候选链、逐层折叠与逐级展开的代表迁移、根级 memo、memo 缺失与树未就绪的区分，以及文件库/窄屏门禁
cordGeometry.ts: Cord 连线几何内核；提供边缘锚点（CordBox 声明 radius 即按圆角矩形求交：射线落在四角那一段时改与该角的圆相交，与平直边在切点处同解，因此绕卡片一圈连续滑动）、距离自适应弯度、三次贝塞尔与 De Casteljau 中点切分，两段子曲线同以中点为起点以支撑「光自中间淌向两端」。radial 模式的弯度是 bow·sin(2θ) 的反对称法向偏移（展开即 2·dx·dy/L²，无三角函数、无扇区分支）：水平/垂直对齐时归零成直线，四条 45° 对角线最弯且是两个弯的 S，绕行 360° 只有连续变形
cordGeometry.test.ts: 以独立三次贝塞尔求值反证中点切分，并覆盖四向边缘锚点、圆角锚点确实落在弧上且绕行 360° 每度位移有界（夹到边中段那种做法会在角上跳 ~68px）、重合端点不产 NaN 与两位小数收敛；另以「相对自身弦的有符号法向偏移」为形状描述子绕行 360°，逐度证明弯度无跳变（1° 内形变 < 2px）且恰好在四条轴上取直
Cord.tsx: 共享连线 Signature 渲染层；粗细沿路径恒定是 SVG 硬限制，两头收细由沿线透明度渐变承担，虚线/实线表达关系状态，CordLayer 可声明 viewBox 让固定几何在响应式样板中与卡片共用同一坐标系；路径动画仍统一下沉 CSS，reduced-motion 直接静态
EdgeDock.tsx: 文件库/AI 共用的 Stage 关闭态 Ghost 图标入口，桌面 32px、窄屏 44px，静止无背景/描边/文字且不使用共享 layoutId；Panel 关闭入口由各自 Header 内部拥有
PaperSurface.tsx: 正文身份变化只重播局部动效，不卸载内容子树； Paper First 签名表面，纸壳/正文各自命名而不拉伸字；内层容器不再按辅助视图重挂载，NotesWorkspace 自己用 memoClientKey 隔离编辑会话，7:9 几何和归档 source 边界不变
CanvasStageLoading.tsx: 统一 Canvas 首屏加载覆盖层；延迟状态由调用方提供，只保留干净 Stage 与可访问 busy 状态，不渲染虚构笔记卡片
CanvasStageLoading.test.tsx: 锁定隐藏时卸载、显示时保留加载语义且没有纸面 Skeleton
CanvasWorkspace.tsx: Canvas 空间壳、标题/边缘工具和窄屏互斥 Panel，左右 Panel 均由 Dashboard 常驻宿主持有；Canvas 会话和节点几何不受面板开合影响
CanvasWorkspace.test.tsx: Canvas 会话壳回归测试，锁定中央 Canvas、共享 Panel、Paper 互斥关系，以及伪返回按钮/Canvas 文字标识/厚重标题卡片确已消失
KnowledgeCanvas/: Canvas V2 交互内容根，以受控 React Flow 承载持久视口、memo/native 节点、右下抓手的拖/点等效连接与纯 UI 临时编织绳、带撤销回执/来源确认的移除、拖拽/缩放、Picker、Preview、显式 AI expansion、WAL 恢复与保存状态
DesignSystemWorkspace/: 开发态 Quiet Editorial Design System 工作区，按 Foundations/Primitives/Navigation & Overlays/Editorial/AI & Organize 五层直接陈列生产 Token、Lucide 精选图标示例、Markdown/Reading/Quote/Code 与四种 Signature Components；组件状态由真实预览交互表达，不再铺设重复状态轨；通过 lazy import 只在 import.meta.env.DEV 下暴露
NotePaper.tsx: 共享纸面原语，以 thumbnail/reader/showcase 三个 variant 承载缩略纸、阅读浮纸与营销自然高度纸面。transitionIdentity 一个入参同时命名纸壳与纸内正文（paper-/paper-body-），规矩因此住在纸里而不是每个调用方——漏一处就是一次字被当图片拉伸的过渡；不再交出真实 DOM，几何归浏览器，没人再测量这张纸。纸张曲率、纸边、墨色与 thumbnail 渐隐仍只实现一次，reader 纸面静止且正文在纸内滚动
NotePaper.test.tsx: 纸面骨架与视觉契约回归测试，锁定两个 variant 的 DOM 同构、thumbnail 五段透明度且模糊层不填纸色、空摘录占位、children 覆盖摘录与 overlay 不进入正文流，以及一个 transitionIdentity 必须同时命名纸壳与正文、不给身份则一个名字都不留
MarkdownEditor.tsx: Markdown 存储协议与 CodeMirror 显示协议之间的唯一 adapter；handle 只暴露 focus 与只读 readSelection（剥掉零宽标记后返回选中文字，不触碰选区/撤销/自动保存），GFM language 常驻，live/source 只通过 Compartment 重配显示扩展以共享 EditorState/选区/撤销历史，零宽空行标记和纯文本粘贴继续保证 content_mdx 无损往返
MarkdownEditor.test.ts: 以 content_mdx 恒等 round-trip 验证普通文本、2/5+ 连续空行、首尾/连续空格、强调段、空白行与 CRLF，约束零宽标记、HTML 空标签和 nbsp 永不离开 adapter
MarkdownLivePreview.ts: CodeMirror 6 原生 Live Preview 引擎，以 syntaxTree/visibleRanges 只扫描可见 block；活动标题保留弱化且无下划线的源码标记，非活动标题隐藏标记和分隔空白，活动/多选区与不安全语法回退完整源码，隐藏范围同步提供 atomicRanges，IME 合成期只映射旧装饰并在结束后刷新
MarkdownReadingView.tsx: react-markdown + remark-gfm + 可选 remark-breaks + rehype-sanitize 的共享只读正文边界；备忘录阅读态保留单换行，AI 消息维持标准 CommonMark，并以模块级稳定渲染器 + Context 只装饰最后可见块；历史块和最后块的稳定前缀保留原生文本节点，末尾最多五个动画 span，固定 skipHtml 并禁止原始 HTML、JSX/JavaScript 执行
MarkdownReadingView.test.tsx: 阅读换行、安全、常数尾部动画节点与文件边界测试；正则按真实 HTML 属性匹配，不保留无意义的 quote 转义
MarkdownViewMenu.tsx: 可选关闭文件操作能力，供嵌入展示保留按钮形制； 编辑/阅读与 Markdown 文件操作入口；More 菜单共用 PresenceSurface，保留原文复制/导出和键盘行为，不修改保存协议
markdownViewTypes.ts: DocumentView editing/reading 与 EditingMode live/source 的共享状态协议，阅读状态不占用编辑模式槽位
NotesWorkspace.tsx: 单篇笔记编辑会话边界，保持 memoClientKey 与原 autosave 协议；编辑/阅读共享定位框并用 PersistentView 淡换，CodeMirror 不重挂载，旧视图不再撑高或接收焦点
PaperWorkspaceShell.tsx: Paper 空间壳与边缘工具/窄屏遮罩，左右 Panel 由外层持久宿主负责，开合不改变纸面几何
useMemoAutosave.ts: 单 memo 本地草稿状态机；递归 required flush 使用具名 callback，session 只以 memoId 建立/销毁，逐键输入不写全局 Store，晚到初值由独立门禁接纳
useMemoAutosave.test.ts: 覆盖迟到服务端正文接纳门禁、插入/删除/等长替换字符计数、三次有界指数退避，以及驱动真实 Hook 证明标题冲突只挂起 title 而正文照常落库
WorkspaceAuxViews.tsx: 纸内辅助视图挂载点；订阅、回收站、Design System 住在 Paper 内部且彼此互斥。已保存画布属于独立空间语境，明确由 CanvasWorkspace 承载，不得重新并入此分支
WorkspaceCommandPalette.tsx: 全局对象命令面板，始终保留 Dialog 宿主以完成关闭动画；搜索/键盘/Canvas 连续加入沿原状态机，关闭后的内容立即退出交互 关闭时不扫描全树生成不可见结果。
WorkspaceCommandPalette.test.tsx: 键盘状态机门禁，使用最小 Bun test 依赖覆盖开合、焦点、方向键/Enter/Tab/Esc、IME、Canvas 连续加入、正文补入稳定与提示条状态 验证树变化过滤正文命中但不重发相同查询。
commandResults.ts: 全局搜索唯一排序纯函数；六档命中顺序与同档内确定性 tie-break，两种画布都独立成行且画布行携带来源笔记标题，同档同名时按「本体先于派生物」让笔记恒排在它的画布之前
commandResults.test.ts: 排序契约门禁，锁定六档顺序、两种画布都独立成行、同名时笔记先于画布、画布行的血缘、文件夹可导航与空查询最近项
TrashWorkspace.tsx: /app 回收站控制器，读取真实顶层删除根并编排重试、恢复、永久删除和当前用户原子清空，结果统一进入根级 Toast
TrashWorkspaceView.tsx: 回收站纯视图，稳定 presence 宿主承接最后一项退出；条目只做 opacity 与 layout=position，退出即 inert，列表/空态和确认 Dialog 不持有网络状态
TrashWorkspace.test.tsx: 回收站纯视图回归测试，覆盖状态页、Folder 根不展开、永久删除/清空确认文案与防重复提交
AccountDialog.tsx: 共享账户/外观 4:3 模态，后台刷新继续保留资料；栏目用 PersistentView 淡换且保留表单实例，Profile 保存协议不变
AccountProfilePanel.tsx: AccountDialog 的账户资料栏；后台 Profile 刷新只以 bio/username 字段合并草稿，头像/email 等无关身份变化不重跑文字合并；停止输入 800ms 后串行 PATCH，头像即时上传并经 Toast 回执
AccountSettingsPanel.tsx: AccountDialog 的外观栏，在“主题”同一行消费 Design System SegmentedControl 提供系统/白天/黑夜偏好；system 实时跟随设备并仍只解析到同一套 light/dark token
SubscriptionWorkspace.tsx: /app 订阅入口工作区，以纯白画布、三档可选方案、权益清单与选中回执展示 5/20/100 美金订阅
AgentPanel/: Paper 与 Canvas 共用的右侧思考空间；AI SDK useChat 承载对话/工具/审批/撤销，organize client 服务 Paper，Canvas expansion client 只取可信候选并把最终 intent 交还统一 Canvas 保存协调器

职责: 业务组合组件层，承载 Landing、Paper/Canvas 两个一级 Workspace、共享文件库与 AI 思考空间、认证、账户和业务视图；Canvas 组件只产生 intent，可靠写入归 Store/Coordinator，正文归 memoDocumentStore；业务组件禁止裸写 fetch 或直连 Supabase 业务数据，AgentPanel transport/client 只在请求期读取 Auth token 访问 chat。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

2026-09-04 Toolbar refinement: 命令区改为「整理」与 32px 图标簇的 8px 分组；Canvas、阅读/编辑、更多在簇内以 4px 相邻间距排列，整理按钮自身收至 32px，凝结态通过顶栏下缘软边消隐正文。

2026-09-04 滚动交界收口投影：凝结不再有两个几何变量。被动画的只有 `--toolbar-condense-progress` 一个 `<number>`，实底高度、软边高度、`backdrop-filter` 模糊半径与遮罩强度都在消费点乘它算出来，于是软边只能从实底当前下边界长出来、只能随凝结一起变浓、进度 0 时连一层模糊都不存在——真空、断层与固定模糊带都不是靠调参数避免的，而是没有地方可以发生。软边上限由 20px 收到 16px，模糊 6px；顶栏 control 的 32px 高度与中性 hover/press 反馈各只声明一次。实底同时改为锚在顶栏下沿**向上**长满「顶栏 + 一条 inset」，凝结区间由 40–96 收到 24–80：sticky 停在内缩线上，顶栏上方那条 inset 一滚就成了纸的内部，而正文抵达顶栏下沿只需 `1px 纸边 + 正文上边距`（窄屏 33px），原先 96px 的终点根本来不及，于是顶栏上方长期漏着半行被视口顶边切断的正文——那是「正文穿过 Toolbar」最刺眼的一半，且它不在下缘，所以修下缘永远碰不到它。

2026-09-04 顶栏底边线删除：`::before` 去掉 `border-bottom`，凝结铺开的只是同一个 `--paper-surface`。Paper 与 Panel 是三层而不是并列（Stage → Paper → 压在 Paper 上的 Panel），所以 Paper 不参照 Panel 的顶部边界；纸在滚动中继续往窗口上方延伸，顶栏上方本来就是纸，而那条线一存在，眼睛就把「窗口上边 → 线」读成一个 64px 的物体，顶栏于是随滚动"变宽变笨"。边界交给下缘软边独自表达，软边参数（16px / 6px）与单一进度一个字不动。

本次侧栏生命周期约束：Paper/Canvas 只承载中央内容与工具开关，左右工具由 Dashboard 的 WorkspacePanelLayer 持续挂载；从笔记进入默认画布继承当前工具开关，动画不得重建 AgentPanel。
