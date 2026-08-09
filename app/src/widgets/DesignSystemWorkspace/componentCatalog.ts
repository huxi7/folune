/**
 * [INPUT]: 不依赖运行时状态，只登记现有共享界面、Skeleton、ThinkingMark 与 AI 消息组件的名称、职责和展示顺序
 * [OUTPUT]: 对外提供 designSystemSamples、DesignSystemSample 与 DesignSystemSampleId
 * [POS]: app/src/widgets/DesignSystemWorkspace 的精简陈列目录，被 ComponentTile 与 ComponentPreview 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type DesignSystemSampleId =
  | "Button"
  | "Skeleton"
  | "UserMessageBubble"
  | "AssistantMessage"
  | "ThinkingMark"
  | "ThinkingIndicator"
  | "ToolCallBubble"
  | "SidebarButton"
  | "SegmentedControl"
  | "Input"
  | "Card"
  | "Dialog"
  | "Toast"
  | "BrandMark"
  | "UserMenu";

export type DesignSystemSample = {
  id: DesignSystemSampleId;
  name: string;
  summary: string;
};

export const designSystemSamples: DesignSystemSample[] = [
  {
    id: "Button",
    name: "Button",
    summary: "Primary、Secondary、Ghost 与实心红色 Danger 表达命令层级；Saving 使用独立状态面与低频 Shimmer。",
  },
  {
    id: "Skeleton",
    name: "Skeleton",
    summary: "只在首次无内容时模拟真实结构，以单一宽光带和延迟显示避免闪屏。",
  },
  {
    id: "UserMessageBubble",
    name: "UserMessageBubble",
    summary: "以 Primary Button 同源主题表面承载用户消息，统一发送动作与对话视觉。",
  },
  {
    id: "AssistantMessage",
    name: "AssistantMessage",
    summary: "无卡片容器的 AI 正文；首 token 后由正文增长独立表达 streaming，不叠加 activity。",
  },
  {
    id: "ThinkingMark",
    name: "ThinkingMark",
    summary: "SuperNote AI 的既定 Formation 符号；以 14、16、20px 真实尺寸展示正式聚合动效。",
  },
  {
    id: "ThinkingIndicator",
    name: "ThinkingIndicator",
    summary: "Animated ThinkingMark 与低频真实状态文字，只在等待正文 token 时存在。",
  },
  {
    id: "ToolCallBubble",
    name: "ToolCallBubble",
    summary: "把工具名称、调用状态与可检查载荷从 AI 正文中分离出来。",
  },
  {
    id: "SidebarButton",
    name: "SidebarButton",
    summary: "承载侧栏导航，以统一高度、平滑圆角和次要按钮材质表达选中状态。",
  },
  {
    id: "SegmentedControl",
    name: "SegmentedControl",
    summary: "在少量稳定选项之间完成紧凑、直接的互斥切换。",
  },
  {
    id: "Input",
    name: "Input",
    summary: "承载文本与密码输入，提供一致的聚焦、禁用和校验入口。",
  },
  {
    id: "Card",
    name: "Card",
    summary: "仅在内容需要与主画布明确分层时使用。",
  },
  {
    id: "Dialog",
    name: "Dialog",
    summary: "暂停当前任务，让用户集中处理一个明确操作。",
  },
  {
    id: "Toast",
    name: "Toast",
    summary: "在操作完成后提供短暂、非阻塞的全局反馈。",
  },
  {
    id: "BrandMark",
    name: "BrandMark",
    summary: "只保留品牌图标与“图标 + SuperNote”两种锁定形式。",
  },
  {
    id: "UserMenu",
    name: "UserMenu",
    summary: "集中承载账户信息与资料、订阅、设置和退出入口。",
  },
];
