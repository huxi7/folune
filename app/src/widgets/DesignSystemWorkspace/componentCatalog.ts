/**
 * [INPUT]: 不依赖运行时状态，只登记 Quiet Editorial 五层信息架构与生产同源组件/Signature Pattern 样板
 * [OUTPUT]: 对外提供 designSystemSections、designSystemSamples、DesignSystemSample/Id/Category
 * [POS]: app/src/widgets/DesignSystemWorkspace 的唯一陈列目录，被入口、ComponentTile 与 ComponentPreview 共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type DesignSystemSampleId =
  | "Color"
  | "Typography"
  | "Iconography"
  | "SpatialRhythm"
  | "RadiusElevationMotion"
  | "Button"
  | "Skeleton"
  | "SegmentedControl"
  | "Input"
  | "Select"
  | "Card"
  | "SidebarButton"
  | "Dialog"
  | "Toast"
  | "BrandMark"
  | "UserMenu"
  | "PaperSurface"
  | "Markdown"
  | "Reading"
  | "Quote"
  | "Code"
  | "Composer"
  | "Messages"
  | "ThinkingMark"
  | "ThinkingIndicator"
  | "ToolCallBubble"
  | "EdgeDock"
  | "ArchiveCord"
  | "Cord";

export type DesignSystemCategory =
  | "Foundations"
  | "Primitives"
  | "Navigation & Overlays"
  | "Editorial"
  | "AI & Organize";

export type DesignSystemSample = {
  category: DesignSystemCategory;
  id: DesignSystemSampleId;
  name: string;
  summary: string;
};

export const designSystemSections: DesignSystemCategory[] = [
  "Foundations",
  "Primitives",
  "Navigation & Overlays",
  "Editorial",
  "AI & Organize",
];

export const designSystemSamples: DesignSystemSample[] = [
  { category: "Foundations", id: "Color", name: "Color", summary: "Stage、Paper、Ink、Soft Ink Primary 交互轴、Saving Processing、Focus 与 Danger 的唯一语义颜色系统。" },
  { category: "Foundations", id: "Typography", name: "Typography", summary: "Interface、Editorial、Mono 三类字族与八级角色；36px Button 使用 14/18px，32px 文件树使用 12/16px 高密度文字。" },
  { category: "Foundations", id: "Iconography", name: "Iconography", summary: "Lucide React 圆角描边语言、14/16/20/24px 尺寸阶梯，以及少量真实生产例子和加入/缩放/连接/整理/拓展互不混用的语义出口。" },
  { category: "Foundations", id: "SpatialRhythm", name: "Spacing", summary: "4px 基线与 4/8/12/16/24/32/48/64/96 主节奏，32/36/48px 固定界面尺寸。" },
  { category: "Foundations", id: "RadiusElevationMotion", name: "Radius · Elevation · Motion", summary: "8/16/12/16/20px 配套曲率、16px Control 与冻结的 12px inner 同心样板，以及 160/260/320/600ms 时间层级。" },
  { category: "Primitives", id: "Button", name: "Button", summary: "Soft Ink Primary、Paper Secondary、Ghost 与唯一实心红色 Danger；极轻同色面光、中性落地影，press 原地收紧 scale(0.98)。" },
  { category: "Primitives", id: "Input", name: "Input", summary: "纯 Paper、Hairline 和清晰 focus ring；无 inset shadow。" },
  { category: "Primitives", id: "Select", name: "Select", summary: "键盘可达选择器，菜单使用 12px 曲率和克制浮层层级。" },
  { category: "Primitives", id: "SegmentedControl", name: "Segmented Control", summary: "平整轨道，选中项只依靠 Paper 与文字对比。" },
  { category: "Primitives", id: "Skeleton", name: "Skeleton", summary: "首次无内容时模拟真实结构，以单一宽光带和延迟显示避免闪屏。" },
  { category: "Primitives", id: "Card", name: "Card", summary: "只在分组和层级确有意义时使用；默认不依靠阴影制造容器。" },
  { category: "Navigation & Overlays", id: "SidebarButton", name: "Sidebar Button", summary: "active 只用轻中性底色、墨色文字与图标，不模拟悬浮按钮。" },
  { category: "Navigation & Overlays", id: "UserMenu", name: "User Menu", summary: "集中承载账户信息与资料、订阅、设置和退出入口。" },
  { category: "Navigation & Overlays", id: "Dialog", name: "Dialog", summary: "20px 曲率和明确层级，暂停当前任务处理一个决定。" },
  { category: "Navigation & Overlays", id: "Toast", name: "Toast", summary: "中性、轻量、无彩色状态容器与玻璃材质。" },
  { category: "Navigation & Overlays", id: "BrandMark", name: "Brand Mark", summary: "原始透明 PNG 母图，保留纸张纹理与阴影；深浅主题共用，仅等比缩放。" },
  { category: "Editorial", id: "PaperSurface", name: "Paper Surface", summary: "纯白 Paper、Folio Header、写作列与 Archive Port 组成工作台唯一视觉中心。" },
  { category: "Editorial", id: "Markdown", name: "Markdown", summary: "生产 CodeMirror Live Preview：编辑态保留原文协议，标题使用克制 Editorial 层级。" },
  { category: "Editorial", id: "Reading", name: "Reading", summary: "Paper 阅读正文以 Editorial 字体和自然留白建立连续阅读节奏。" },
  { category: "Editorial", id: "Quote", name: "Quote", summary: "引用以 Editorial 字体、Hairline 与 Muted 墨色表达，不另造 Card。" },
  { category: "Editorial", id: "Code", name: "Code", summary: "行内与块级代码只使用 Mono、Hairline 与中性 Surface。" },
  { category: "AI & Organize", id: "Composer", name: "Prompt Composer", summary: "原生多行输入以内联 Primary @笔记区分普通正文；候选使用可滚动 32px 紧凑文件行，底栏只保留权限与发送/停止。" },
  { category: "AI & Organize", id: "Messages", name: "Messages", summary: "用户气泡保留品牌关联，助手正文无 Card，过程状态弱于最终正文。" },
  { category: "AI & Organize", id: "ThinkingMark", name: "Thinking Mark", summary: "Folune AI 的 Formation 符号，以 14/16/20px 真实尺寸呈现。" },
  { category: "AI & Organize", id: "ThinkingIndicator", name: "Thinking", summary: "仅在等待正文 token 时存在的低频活动态。" },
  { category: "AI & Organize", id: "ToolCallBubble", name: "Tool", summary: "只用工具名称、灰阶结果与低频状态反馈，不暴露载荷。" },
  { category: "AI & Organize", id: "EdgeDock", name: "Panel Toggle", summary: "固定 Ghost 图标在 Stage 打开工具，并由 Panel Header 尾端的独立命令关闭。" },
  { category: "AI & Organize", id: "ArchiveCord", name: "Archive Cord", summary: "Paper 到文件树目标的持久近黑曲线；reduced-motion 直接静态呈现。" },
  { category: "AI & Organize", id: "Cord", name: "Cord", summary: "共享连线原语；粗细恒定，两头收细由沿线透明度渐变造成，虚线为 AI 临时推荐、实线为已确认关联。" },
];
