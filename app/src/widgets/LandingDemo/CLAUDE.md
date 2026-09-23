# LandingDemo/
> L2 | 父级: ../CLAUDE.md

独立 HTML 入口只装配无 Auth、API、业务 Store、持久化的 UI；内存数据随刷新消失。iframe 给生产布局、Portal 与 View Transition 一个真实且独立的视口。展示品牌遵循 Folune。

成员清单
main.tsx: 独立入口，注入生产样式、Motion 与 Toast，不挂载生产 Router/ThemeProvider
DemoWorkspace.tsx: Paper 与 Canvas 的状态装配，左右 Panel 持续挂载；文件树直接切换笔记/画布并清除笔记来路，只有笔记工具条进入才记录返回对象并运行纸面过渡；归档是工具条与 AI 对话共用的唯一入口（`organize(memoId, commandId?)` 在树真正落定后兑现 Promise），命令台账 ref 只登记从对话发出的写操作，因此只有它能被撤销
DemoSidebar.tsx: 复用 MemoTreeBranch、SidebarCreateMenu 和用户身份组件；仅展开和选择在内存中完成；搜索禁用，新建保留正常点击反馈但不执行创建
DemoAssistant.tsx: 复用生产 Header、ChatMessage、MentionInput、deriveAssistantActivity 与输入/滚动规则；点击和回车直接共用发送动作，不依赖 iframe 禁止的原生表单提交；引用保留生产 @ 图标、标题与容器，14px 图标换算为 0.875rem 跟随演示根字号同比缩放，不增加置顶/移除管理。把对话脚本逐步物化成 AI SDK parts——工具先以 input-available 亮起流光、落定后翻成 output-available，写操作等文件树真正落定才打勾，最后才流式吐正文。发送时的 memoId 随脚本冻结，回复中途换笔记也不会写错对象
DemoCanvas.tsx: 受控 React Flow，复用 CanvasCardView/Cord/纸面过渡；直接进入显示固定三卡关系图且无返回按钮，笔记工具条进入才用该笔记作源卡并提供返回；保持原有静态展示，不开放卡片点击、拖动、缩放或编辑图。取景只有两个数且必须一起读——`positions` 给出卡片之间的**空**，`VIEW_PADDING` 给出框与内容之间的空。间距小到 52px 时三张纸会连成一整块填满整帧，只加大留白又会把字缩到读不出来；当前约 90/106 的间距配 0.14。**取景不用 React Flow 的 `fitView`**：它把内容居中在整个画布上，而画布是全视口的、两侧面板浮在它上面，于是最右那张卡会正好顶到 AI 栏底下。这里自己算视口（`setViewport`），把"居中于什么"从整块画布换成两侧面板之间**真正看得见的那条带**，两端直接量面板元素——宽度规则住在 CSS，在这里再写一遍就是第二份真相。带的两端只依赖 stage 尺寸、不依赖面板开合，所以面板开合不重取景。**画布 stage 必须是全视口的**（见 landing-demo.css）：一旦按面板宽度给它加 margin，每收一次面板它就会变宽、ResizeObserver 随即重取景——卡片在用户收面板时自己变大，而 Canvas 宪法明令开合不得改变 React Flow 几何
model.ts: 固定笔记/层级、`DemoStep` 对话脚本与物化器；内容主线为「散步 → 注意力 → 写作」，深浅搭配；所有 ID、时间和结果确定
model.test.ts: 数据一致性、整理保真、历史只读、工具名不越界、生产分区器契约及运行时导入边界门禁

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

视觉场景：demo.html 首绘声明 data-visual-context=app，同步 APP 配色、对话/树字号与状态；保持独立浅色与既有 87.5% rem 缩放，不影响父级 Landing。

展示边界：无底部引导/重置栏；三栏共用顶部/底部内缩。Paper/Canvas 通过 hidden 互斥可见，面板保持实例。AI 会话最多保留 14 条消息，取消清理计时器。demo.html 的 CSP 禁止连接、外部图像和表单提交；source 导入门禁仅允许 store 目录中的纯 memoTree 算法。

展示尺度：三个数各管一件事，互不干扰。

① **字号档位**：普通 UI 的 rem 字号、间距与控件由 `landing-demo.css` 的根字号缩至 87.5%；这不代表整个 APP 几何等比缩小。Canvas 卡片宽高是固定画布像素，共享 `note-paper.css` 的 thumbnail 因此使用固定 16px 排版基准，标题 17px、正文 12px、内边距 16px 与渐隐范围只随 React Flow 一起缩放，避免文字比卡片多缩一次。reader 与 Paper、侧栏仍沿既有 rem 规则。调试用 pinned 档把 `--spacing` 固定为 4px，仅用于比较普通 UI 的控件密度。

② **边栏宽度**按视口百分比取，窄屏有下限、宽屏有上限：左 `clamp(180px, 20%, 260px)`、右 `clamp(240px, 26%, 340px)`，两者合计 46%，中间的纸因此稳定拿到约 50%——正在写的东西必须永远是最大的一块；左窄右宽不是审美，文件树里是短标题、AI 栏里是成句的话。面板是 `position: fixed`，所以百分比就是视口百分比。**原来的 220/288 是固定像素，占比会随窗口一路漂**（1088 时 20%/26%、1600 时 14%/18%），那才是它真正的问题：边栏不跟窗口一起长，窗口一大三栏就散架。调试用 original 档保留固定像素，只为让人看见改之前是什么样。

③ **栏间空隙**是 padding 的一部分（`padding = 轨道 + --demo-column-gap`），而面板自己从 `--workspace-panel-inset` 起算，所以肉眼看到的空隙 = 这个值 − inset（桌面 30 − 10.5 ≈ 20px）。纸宽 = `min(可用高度 × 7/9, 可用宽度)`，所以加大空隙挤窄的是纸——它是唯一在让步的那个。

对话诚实律：Demo 只说生产真实存在的四个胖笔记工具，不发明第五个。**历史对话一律只读**（read_tree/read_memo）——那几轮当时什么都没被改过，写芯片说「移动了」而文件树没动，是可以当场验证的谎。写只发生在用户发送之后，并且真的改树：工具条的「整理」与对话的 edit_node 走同一个 `organize`，AI 回复末尾的「撤销」也由同一份命令台账兑现，不是装饰按钮。
