# LandingDemo/
> L2 | 父级: ../CLAUDE.md

独立 HTML 入口只装配无 Auth、API、业务 Store、持久化的 UI；内存数据随刷新消失。iframe 给生产布局、Portal 与 View Transition 一个真实且独立的视口。展示品牌遵循 Folune。

成员清单
main.tsx: 独立脚本入口，生产 index.css → React Flow → Demo 布局由 demo.html 的 stylesheet 按顺序预载，脚本只注入 Motion 与 Toast，不挂载生产 Router/ThemeProvider
DemoWorkspace.tsx: Paper 与 Canvas 的状态装配，文件库与生产助手外壳持续挂载；笔记固定全高（尺寸/收起命令无操作）、画布固定胶囊（点击不展开）、不装配调整手柄；助手所有胶囊像素量按根字号/16同比投影，默认87.5%，在纸面截图前同步硬切目标形态；文件树直接切换笔记/画布并清除笔记来路，只有笔记工具条进入才记录返回对象并运行纸面过渡；归档是工具条与 AI 对话共用的唯一入口（`organize(memoId, commandId?)` 在树真正落定后兑现 Promise），命令台账 ref 只登记从对话发出的写操作，因此只有它能被撤销
DemoSidebar.tsx: 复用 MemoTreeBranch、SidebarCreateMenu 和用户身份组件；仅展开和选择在内存中完成；搜索禁用，新建保留正常点击反馈但不执行创建
DemoAssistant.tsx: 窗口放大/还原/收起命令静态，模拟消息功能保留；复用生产 Header、ChatMessage、MentionInput、deriveAssistantActivity 与输入/滚动规则；点击和回车直接共用发送动作，不依赖 iframe 禁止的原生表单提交；引用保留生产 @ 图标、标题与容器，14px 图标换算为 0.875rem 跟随演示根字号同比缩放，不增加置顶/移除管理。把对话脚本逐步物化成 AI SDK parts——工具先以 input-available 亮起流光、落定后翻成 output-available，写操作等文件树真正落定才打勾，最后才流式吐正文。发送时的 memoId 随脚本冻结，回复中途换笔记也不会写错对象
DemoCanvas.tsx: 受控React Flow静态关系示例；沿用原节点坐标与卡片间距，右侧胶囊不再预留整栏；取景读取左侧实际Panel边缘与完整Stage，生产卡片/Cord/纸面过渡保持；仅笔记工具条来路提供返回，不开放卡片操作
model.ts: 模拟移动结果携带 id/operation/status 以被生产消息层识别为可撤销命令；固定笔记/层级、`DemoStep` 对话脚本与物化器；内容主线为「散步 → 注意力 → 写作」，深浅搭配；所有 ID、时间和结果确定
model.test.ts: 数据一致性、整理保真、历史只读、工具名不越界、生产分区器契约及运行时导入边界门禁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

工具栏：整理与其余图标命令复用正式 AppMainToolbar 和 workspace.css，统一中性 Ghost 前景/hover/press 与 4px 间距；无需 Demo 特有的覆盖规则。

视觉场景：demo.html 首绘声明 data-visual-context=app，同步 APP 配色、对话/树字号与状态；保持独立浅色与既有 87.5% rem 缩放，不影响父级 Landing。

展示边界：无底部引导/重置栏；笔记文件库/助手与纸面共用顶部/底部内缩；画布助手是静态胶囊。Paper/Canvas 通过 hidden 互斥可见，面板保持实例。AI 会话最多保留 14 条消息，取消清理计时器。demo.html 的 CSP 禁止连接、外部图像和表单提交；source 导入门禁仅允许 store 目录中的纯 memoTree 算法。

展示尺度：三个数各管一件事，互不干扰。

① **字号档位**：普通 UI 的 rem 字号、间距与控件由 `landing-demo.css` 的根字号缩至 87.5%；这不代表整个 APP 几何等比缩小。Canvas 卡片宽高是固定画布像素，共享 `note-paper.css` 的 thumbnail 因此使用固定 16px 排版基准，标题 17px、正文 12px、内边距 16px 与渐隐范围只随 React Flow 一起缩放，避免文字比卡片多缩一次。reader 与 Paper、侧栏仍沿既有 rem 规则。调试用 pinned 档把 `--spacing` 固定为 4px，仅用于比较普通 UI 的控件密度。

② **边栏宽度**按视口百分比取，窄屏有下限、宽屏有上限：左 `clamp(180px, 20%, 260px)`、右 `clamp(240px, 26%, 340px)`，两者合计 46%，中间的纸因此稳定拿到约 50%——正在写的东西必须永远是最大的一块；左窄右宽不是审美，文件树里是短标题、AI 栏里是成句的话。面板是 `position: fixed`，所以百分比就是视口百分比。**原来的 220/288 是固定像素，占比会随窗口一路漂**（1088 时 20%/26%、1600 时 14%/18%），那才是它真正的问题：边栏不跟窗口一起长，窗口一大三栏就散架。调试用 original 档保留固定像素，只为让人看见改之前是什么样。

③ **栏间空隙**是 padding 的一部分（`padding = 轨道 + --demo-column-gap`），而面板自己从 `--workspace-panel-inset` 起算，所以肉眼看到的空隙 = 这个值 − inset（桌面 30 − 10.5 ≈ 20px）。纸宽 = `min(可用高度 × 7/9, 可用宽度)`，所以加大空隙挤窄的是纸——它是唯一在让步的那个。

对话诚实律：Demo 只说生产真实存在的四个胖笔记工具，不发明第五个。**历史对话一律只读**（read_tree/read_memo）——那几轮当时什么都没被改过，写芯片说「移动了」而文件树没动，是可以当场验证的谎。写只发生在用户发送之后，并且真的改树：工具条的「整理」与对话的 edit_node 走同一个 `organize`，AI 回复末尾的「撤销」也由同一份命令台账兑现，不是装饰按钮。

助手缩放与切换：胶囊从生产130×44按87.5%投影为113.75×38.5，轮廓/字号/图标/间距/柔影/模糊同源缩放，底边与右边跟随Demo的rem内缩。助手几何、透明度与阴影不做场景过渡；先同步目标形态再拍纸面旧截图，中央Paper/Canvas保留已有过渡。
