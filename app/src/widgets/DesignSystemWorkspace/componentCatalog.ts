/**
 * [INPUT]: 登记设计规范、组件名称与检索词
 * [OUTPUT]: 导出 Design System 分区、样板目录与检索函数
 * [POS]: 设计系统的展示目录；样板与产品共用视觉原语
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { matchesReference } from "./search";

export type DesignSystemSampleId =
  | "Color" | "Typography" | "Iconography" | "SpatialRhythm" | "RadiusElevationMotion"
  | "Button" | "GlowButton" | "Skeleton" | "SegmentedControl" | "Input" | "Select"
  | "SidebarButton" | "Dialog" | "Toast" | "BrandMark" | "UserMenu" | "Tooltip" | "KeyboardShortcut"
  | "PaperSurface" | "Markdown" | "Reading" | "Quote" | "Code"
  | "Composer" | "Messages" | "ThinkingMark" | "ThinkingIndicator" | "ToolCallBubble"
  | "EdgeDock" | "ArchiveCord" | "Motion";

export type DesignSystemCategory =
  | "Brand" | "Foundations" | "Primitives" | "Navigation & Overlays"
  | "Editorial" | "AI & Organize" | "Materials & Motion" | "Assets";

export type DesignSystemSample = {
  category: DesignSystemCategory;
  id: DesignSystemSampleId;
  name: string;
  keywords: string;
};

export const designSystemSections = [
  { id: "brand", category: "Brand", title: "品牌" },
  { id: "foundations", category: "Foundations", title: "基础规范" },
  { id: "primitives", category: "Primitives", title: "基础组件" },
  { id: "navigation", category: "Navigation & Overlays", title: "导航与浮层" },
  { id: "editorial", category: "Editorial", title: "写作与阅读" },
  { id: "intelligence", category: "AI & Organize", title: "AI 与连接" },
  { id: "motion", category: "Materials & Motion", title: "材质与动效" },
  { id: "assets", category: "Assets", title: "资源库" },
] as const satisfies readonly { id: string; category: DesignSystemCategory; title: string }[];

export const designSystemSamples: DesignSystemSample[] = [
  { category: "Brand", id: "BrandMark", name: "品牌标识", keywords: "brand logo 标识 纸标 字标" },
  { category: "Foundations", id: "Color", name: "颜色", keywords: "color palette 色板 主色 背景" },
  { category: "Foundations", id: "Typography", name: "字体与排版", keywords: "typography font 字号 行高 字重" },
  { category: "Foundations", id: "Iconography", name: "图标", keywords: "icon lucide 描边 尺寸" },
  { category: "Foundations", id: "SpatialRhythm", name: "间距与尺寸", keywords: "spacing size 空间 控件" },
  { category: "Foundations", id: "RadiusElevationMotion", name: "圆角与层次", keywords: "shape radius elevation 阴影" },
  { category: "Primitives", id: "Button", name: "按钮", keywords: "button 主次 加载 禁用 焦点" },
  { category: "Primitives", id: "GlowButton", name: "流光按钮", keywords: "glow 登录 升级 强调" },
  { category: "Primitives", id: "Input", name: "输入框", keywords: "input password 表单 密码 错误 禁用" },
  { category: "Primitives", id: "Select", name: "选择器", keywords: "select 语言 菜单" },
  { category: "Primitives", id: "SegmentedControl", name: "分段选择", keywords: "segmented control 主题 切换" },
  { category: "Primitives", id: "Skeleton", name: "加载占位", keywords: "skeleton loading 骨架" },
  { category: "Navigation & Overlays", id: "SidebarButton", name: "侧栏条目", keywords: "sidebar 导航" },
  { category: "Navigation & Overlays", id: "UserMenu", name: "账户菜单", keywords: "user menu 设置 订阅 退出" },
  { category: "Navigation & Overlays", id: "Dialog", name: "对话框", keywords: "dialog modal 弹窗" },
  { category: "Navigation & Overlays", id: "Toast", name: "通知", keywords: "toast 反馈 撤销 倒计时" },
  { category: "Navigation & Overlays", id: "Tooltip", name: "提示", keywords: "tooltip 悬停 焦点" },
  { category: "Navigation & Overlays", id: "KeyboardShortcut", name: "快捷键", keywords: "keyboard shortcut 键盘 键帽" },
  { category: "Editorial", id: "PaperSurface", name: "纸面", keywords: "paper 写作" },
  { category: "Editorial", id: "Markdown", name: "编辑器", keywords: "markdown codemirror 写作" },
  { category: "Editorial", id: "Reading", name: "阅读", keywords: "reading 正文 标题" },
  { category: "Editorial", id: "Quote", name: "引用", keywords: "quote 阅读" },
  { category: "Editorial", id: "Code", name: "代码", keywords: "code 等宽 阅读" },
  { category: "AI & Organize", id: "Composer", name: "消息输入", keywords: "composer 笔记 引用 发送" },
  { category: "AI & Organize", id: "Messages", name: "对话", keywords: "message assistant 回复 流式" },
  { category: "AI & Organize", id: "ThinkingMark", name: "思考标记", keywords: "thinking mark formation" },
  { category: "AI & Organize", id: "ThinkingIndicator", name: "等待状态", keywords: "thinking indicator 加载" },
  { category: "AI & Organize", id: "ToolCallBubble", name: "工具活动", keywords: "tool activity 运行 完成" },
  { category: "AI & Organize", id: "EdgeDock", name: "文件库入口", keywords: "edge dock" },
  { category: "AI & Organize", id: "ArchiveCord", name: "归档线", keywords: "archive cord 连线" },
  { category: "Materials & Motion", id: "Motion", name: "交互动效", keywords: "motion animation 动画 时长 曲线 菜单 面板" },
];

export function matchesDesignSample(sample: DesignSystemSample, query: string) {
  return matchesReference(`${sample.name} ${sample.category} ${sample.keywords} ${sample.id}`, query);
}
