# app/src/shared/design-system/components/
> L2 | 父级: ../CLAUDE.md

成员清单
AccountSubscribeButton.tsx: 账户专用28px流光CTA，组合既有GlowButton/ShaderGlow，12px文案、24px曲率及独立白亮边缘参数归user-menu.css；不影响普通按钮或其他CTA
motionLifecycle.test.tsx: 验证父面板退出不连带折叠常驻详情； 真实 DOM 行为门禁，覆盖菜单快速反向开关、退出交互隔离、input 实例/光标保留、菜单/模态分层 Escape 与嵌套滚动锁；动画完成时间另由浏览器测量
Collapse.tsx: 常驻详情同样使用独立且不传播父退出的 presence 边界，防止 Panel 退出使内部高度归零； Tree/披露控件的高度生命周期原语，默认 210ms tree 或 160/130ms micro 同源曲线，透明度与高度使用相同进退方向、逐帧回调支持滚动对齐、可打断、退出立即 inert；keepMounted 保留工具详情状态，减少动态效果即时改变高度
PresenceSurface.tsx: 支持compact-menu仅调时长档；菜单固定向下8px/中心缩放、submenu固定横移-10px；侧栏使用原220/170ms外侧平移且不缩放；Menu/Popover/Panel共用无额外定位包装的生命周期基础件；关闭即 inert、完成后卸载，MotionSurface 支持外层 presence，定位和焦点策略留给语义组件
PersistentView.tsx: 保留实例的视图基础件；motion=from-left 选择从左侧进入的 24px 承接，fill 以四边定位维持 Panel 退出高度，默认仍为轻淡换；旧视图立即脱离布局并 inert、淡出完成 hidden，切回复用原实例和草稿，父容器提供相对定位
.gitkeep: 保留本地组件目录
CLAUDE.md: 记录本地组件目录职责与文档协议
Button.tsx: 本地 36px 标准命令组件，使用 14px/18px UI 字体、14px 横向留白与 6px 图文间距，封装 primary、弱边缘 secondary、ghost、实心红色 danger、square 与正交 loading 状态；以统一 16px smooth corner、极轻纵向同色面光和短中性落地阴影形成克制实体层级，不绘制清晰全周内环，hover 固定原位并放宽外影，按下原地收紧且撤回外影（共读 index.css 的 --press-scale，Reduced Motion 归 1），Ghost 始终无实体阴影；非 Danger loading 自动切换为独立蓝灰 Processing 状态面，继续联动原生 disabled/aria-busy，并以 spinner 配合带 16 度倾角的 3.2s 低频窄 shimmer
ShaderGlow.tsx: 唯一 WebGL2 光线步进原语；从宿主品牌 token 构建渐变，立即绘制非空初始相位并保留静态帧；ResizeObserver 独立负责布局尺寸，离屏/隐藏/减少动态共同控制唯一 RAF，恢复上下文重建资源，所有退出路径释放资源；GPU 不可用时由消费方底色托底
ShaderGlow.test.tsx: 使用可控 WebGL/Observer/RAF 验证 StrictMode 首帧、暂停续播、静态尺寸重绘、上下文恢复与失败清理；不替代真实 GPU 和视觉验收
GlowButton.tsx: 与 Button 平级、材质独立的强调型 CTA，仅用于登录/升级一类主动作；以「墨蓝底色对角渐变 + ShaderGlow 流光 + 玻璃高光」三层在同一 overflow 裁剪的 squircle 内叠加合成质感，复用全站 --press-scale 与 ds-button-spinner，视觉数值全部落在 styles/shader-glow.css，不侵入也不改动标准 Button 的四个变体
Skeleton.tsx: 统一低对比占位加载原语，提供 rect/text/circle 形状、单组宽光带 SkeletonGroup 与 180ms 延迟出现/360ms 最短可见时长的 useDelayedSkeleton；业务只按真实内容结构组合，不自建动画或计时器
SidebarButton.tsx: 本地 32px compact 侧栏导航原子组件，以 active、default/icon 等高尺寸、default/prominent 层级和 leading/label/trailing 槽位统一 APP 与账户模态框导航；与 36px Button 共享平滑圆角和材质语言但不强制等高，hover 固定原位，选中态和 prominent 态直接复用弱边缘的 Secondary Button 材质
SegmentedControl.tsx: 紧凑互斥选择，保留 radiogroup/radio、单一 Tab 入口和方向键；只有共享选中底片做 layout 迁移，文字固定原位，减少动态效果取消底片滑动
Input.tsx: 本地 36px 默认 Input 组件，使用 14px/20px 表单文字，封装 V1 语义边框、内凹背景、placeholder、focus 与原生 ref 能力
MentionInput.tsx: 原生 contenteditable 多行输入件，以受控纯文本和不可编辑 token 同构承载 AI Composer；普通正文使用 foreground，已选 @笔记使用 primary，原生粘贴只接收纯文本
MentionInput.test.ts: MentionInput 纯文本分段回归测试，锁定中文标题、最长标题优先和特殊字符标题的内联 token 边界
PasswordInput.tsx: Input 家族的隐私输入组合件，复用 Input 内凹表面，提供受控明文/掩码切换、显隐图标按钮、aria-label/aria-pressed 与原生 input 属性/ref
Card.tsx: 静态信息表面默认不动；显式 motion=lift 才启用 4px/1.012 的 hover 层级反馈，几何由 Motion、阴影由 CSS 单独拥有，减少动态效果取消空间变化
WarmTooltip.tsx: React Bits 上游共享浮层适配，首次等待 360ms、温热窗口 300ms、同组 220ms 无回弹滑动；12px 字号、160ms/0.98/1px 淡入，无倾斜/箭头/引线；悬停与键盘焦点可达，点击/Escape/失焦/卸载结束提示，减少动态取消空间变化
WarmTooltip.css: 提示定位层/表面分层与主题 token 接线，Portal 低于 Dialog，键帽独立由 KeyboardShortcut 提供
WarmTooltip.LICENSE.md: React Bits WarmTooltip 的原始版权与 MIT + Commons Clause 许可
KeyboardShortcut.tsx: 共享快捷键表现层，把组合键拆成真实键帽；Mac 使用 Command/Delete 符号，其他平台使用 Ctrl/Backspace，只呈现不绑定行为
KeyboardShortcut.css: 22px 紧凑键帽、浅边框与底部细阴影，提示和帮助面板共用浅暗色语义
Dialog.tsx: panel/bare共享85%页面底色的无模糊遮罩，几何与交互不因材质变化而分支； 全站唯一模态基础件，closeLabel 由消费方传入本地化文案而不依赖语言Provider；Portal 脱离祖先 transform、--layer-dialog 置于归档线/侧栏之上，独立 AnimatePresence 负责完整入退场；空嵌套 Dialog 不注册父退出以免悬挂，语义/焦点/滚动锁归 useModalLifecycle。默认150/150ms standard Tween、.9中心缩放，父层/遮罩/面板同拍进入，内部两层退出；复现Laper设置模态的透明度叠加，motion=none 将纸面与遮罩完全交给原生 View Transition，遮罩永不命名
AssistantMessage.tsx: AI 消息正文根，不绘制“助手”等可见身份标题，以零卡片表面依次组合可选过程槽、独立 StreamingText 最终正文与兼容 children 工具区；向纯文本/Markdown 渲染器透传统一词级动效状态，不拥有过程分区或折叠状态
StreamingText.tsx: 首个真实 text part 后把 SSE 目标文本在同次上游更新中完整直出，不设置逐词显示队列、全文时间轴、冗余 performance 时钟或 useLayoutEffect 状态；历史正文保持原生文本，只有尾部最多 5 个词使用常数动画节点
streamingTextSegments.ts: 语言无关的流式分词纯函数，以 Intl.Segmenter 同时支持英文单词和中文语义词组，并把标点、空白及 Markdown 标记完整归入相邻显示单元
streamingTextSegments.test.ts: 流式分词、直出时间轴与时间进度回归测试，锁定英文标点/空白归组、中文语义分组、Markdown 源文本字符保真、1000 单元不排队且只动画尾部 5 个，以及 DOM 重组后通过负 animation-delay 从当前模糊进度续播
ThinkingStatusText.tsx: ThinkingIndicator 的低频中性状态文字，以 2800ms 固定宽度交叉淡化轮换“思考/整理思路/组织回答”，不虚构搜索、文件或工具行为
ThinkingIndicator.tsx: Animated Formation ThinkingMark 与 ThinkingStatusText 的无卡片行内组合件，等待正文时 active，首 token 后 160ms 淡出，活动工具出现时由调用方立即卸载
ThinkingMark.tsx: Folune AI 品牌符号，默认使用圆角核心、五条不对称折线连接与五个非等径外围节点表达信息聚合；固定 24×24 viewBox/currentColor/独立 data-part，并以 1840ms 非顺时针错峰 Formation Motion 提供 active 态，同时归档 Radiation/Formation/Fold 三个静态候选
UserMessageBubble.tsx: 用户消息气泡，直接复用 Primary Button 的主题色、前景色、smooth corner 与均匀环绕柔影
ToolCallBubble.tsx: 可选纯props提供中英读屏状态与详情标签，不读取持久化locale；工具轻量披露控件，等待状态静止，仅真实 running 状态在固定状态位展示单个 SVG 描边圆弧（旋转与弧长伸缩使用独立时钟，不叠 CSS 边框）、成功圆勾或中性圆叉，取消和中断不继续转圈；详情点击后才挂载，避免批量任务创建大量隐藏 Motion 子树
ToolCallBubble.test.tsx: 工具披露最小 DOM 契约测试，锁定执行态转圈、固定结果槽、可访问详情入口、无 pre/details 调试面板及停止后未完成态静止
accessibilitySemantics.test.tsx: 基础无障碍语义回归测试，锁定 Thinking 单一播报源、隐藏 Skeleton 不宣告忙碌及 Assistant 正文不伪造具名地标
BrandMark.tsx: 紧边界 PNG 与已选③字标的唯一组合入口；--brand-size 只表示可见图高，共享样式以 5:4 布局比和 7/22 间距比例派生整组，默认 1.375rem 让 Demo 随根字号缩小；iconOnly 保留原独立图的可见体量，整组只播报一次 Folune
BrandWordmark.tsx: Source Serif 4 Medium 24pt 的固定 Folune 轮廓，资产内纵向光学收至 94% 并保持宽度/居中，只由 BrandMark 消费并继承 currentColor；不加载字体或复用 UI 字体，尺寸统一归 design-system.css，OFL 许可随 public/brand 分发
Toast.tsx: 全局瞬时反馈边界，Kumo 独占队列/焦点/滑动；贴近视口顶部居中并从上沿滑入，最多三条等宽可见，每次触发独立入栈并在悬停时展开；正文与动作簇分层，倒计时动作回执仅保留 24px 本地 Button 与整条底边进度，到期自动消失且不显示关闭按钮，常驻回执保留手动关闭，错误/警告即使带动作也保留状态图标；普通提示 2.6 秒、警告 5 秒、错误 6.5 秒、动作默认 6 秒；桌面更新可选稍后/更新双动作与 duration=0 常驻提示
useToastCountdown.ts: 动作回执唯一计时，Toast 整条底边的剩余长度与到期关闭同源，仅更新 transform、不触发 React 帧渲染；悬停/键盘展开/页面隐藏/失焦/非最前条时暂停，重新显示续走，Reduced Motion 按秒更新
Toast.test.tsx: 验证更新双动作/常驻无倒计时/稍后不触发安装，区分底层非模态 dialog 与真正模态弹窗； 真实 Provider 的重复入栈/三条上限/悬停展开收回/独立撤销与可控帧时钟门禁，验证暂停续走、隐藏保留与到期关闭
Select.tsx: combobox/listbox 选择器，键盘焦点保留在 trigger、option 不增加 Tab 停靠点；上/下浮层共用 PresenceSurface 的锚点入退场，选择与关闭语义仍在本组件
UserButton.tsx: 身份原子组件；UserAvatar 显示真实照片或前两个字符，UserButton 用姓名/方案名/单向展开箭头表达账户入口，排版由 user-menu.css 统一，不读持久化状态或发起业务请求
UserMenu.tsx: 底卡只呈现积分/订阅与账户身份两层；身份头整体hover，订阅复用28px流光；主菜单以身份按钮为锚点左移8px、间隔8px向上展开，固定256px且允许越过侧栏，仅窄视口缩宽；ResizeObserver跟随按钮和内容尺寸；1px贴边/36px行子菜单，子菜单末行中心对齐触发行中心，其余项向上排列、固定横移-10px且不缩放，定位避让视口；语言配国旗，当前项随props显示浅灰；Portal命中边界、悬停缓冲、键盘/触屏与刷新命令维持同源
UserMenu.test.tsx: 验证主菜单身份按钮锚点/左移8px/8px间距、侧栏缩放时固定256px/观察释放与窄屏避让；真实ThemeProvider验证三种主题当前项随点击更新、两种语言国旗、两种高度的1px子菜单避让、末行与触发行对齐及向上排列；保留刷新/悬停/键盘/触屏/外点/焦点回归，主题存储在测试后恢复
index.ts: 基础组件稳定出口，包含 WarmTooltip/KeyboardShortcut、PresenceSurface/MotionSurface、PersistentView、Collapse 与 CardMotion；业务界面组合生产原语，不建立第二套动画

职责: 本地组件目录；APP 文字按 app-typography.css 角色消费，Button/action、Input/Select/input、UserButton/navigation、Dialog/section；禁止组件新增局部数字字重，营销继续使用共享样式回退；首次无旧内容的稳定结构才使用统一 Skeleton，已有内容刷新必须优先保留内容，业务组件不得复制 shimmer；AI 最终正文永远不得拥有卡片表面，用户消息复用 Primary 主题，过程与正文的语义分区由业务层决定，ToolCallBubble 只消费已净化的人话详情；所有组件只消费 app/src/index.css 的静态语义 token 与 design-system/motion.ts 的统一动效与组件层 class，不得在组件中硬编码颜色值或引入第二套 UI 系统。ShaderGlow 是本层唯一获准持有 WebGL/GPU 表面的组件，其光色仍在运行期从 index.css 的 --primary token 解析派生而非硬编码，深浅主题随之重建纹理，故不构成第二套视觉系统；GlowButton 是唯一消费它的强调 CTA，材质与标准 Button 平级隔离。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

2026-09-07 视觉收口：ToolCallBubble 结果直接使用 CircleCheck/CircleAlert/CircleX 的自带圆形轮廓，不额外绘制容器边框。
