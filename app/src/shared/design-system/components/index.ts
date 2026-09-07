/**
 * [INPUT]: 依赖本目录原生 Input/MentionInput、通用界面组件、Skeleton 加载原语、ThinkingMark 与 Assistant/User/Tool/Thinking/Streaming AI 消息组件家族
 * [OUTPUT]: 对外统一导出当前用户端实际使用的本地 design system、原生表单件、统一 Skeleton/延迟策略、AI 品牌/活动组件、全局 Toast 能力及公开类型
 * [POS]: app/src/shared/design-system/components 的出口文件，被 pages 与 widgets 通过单一入口消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export { AssistantMessage } from "./AssistantMessage";
export { BrandMark } from "./BrandMark";
export { Button } from "./Button";
export { Card } from "./Card";
export { Dialog } from "./Dialog";
export { Input } from "./Input";
export { MentionInput } from "./MentionInput";
export { PasswordInput } from "./PasswordInput";
export { Select } from "./Select";
export { SegmentedControl } from "./SegmentedControl";
export { SidebarButton } from "./SidebarButton";
export { Skeleton, SkeletonGroup, useDelayedSkeleton } from "./Skeleton";
export { StreamingText } from "./StreamingText";
export { ThinkingIndicator } from "./ThinkingIndicator";
export { ThinkingMark } from "./ThinkingMark";
export { DEFAULT_THINKING_STATUSES, ThinkingStatusText } from "./ThinkingStatusText";
export { ToolCallBubble } from "./ToolCallBubble";
export { ToastProvider, useToast } from "./Toast";
export { UserAvatar, UserButton } from "./UserButton";
export { UserMenu } from "./UserMenu";
export { UserMessageBubble } from "./UserMessageBubble";
export type { ButtonSize, ButtonVariant } from "./Button";
export type { CardTone } from "./Card";
export type { DialogAlign, DialogDensity, DialogHeaderMode, DialogSurface, DialogWidth } from "./Dialog";
export type { PasswordInputProps } from "./PasswordInput";
export type { MentionInputProps, MentionInputSegment, MentionInputToken } from "./MentionInput";
export type {
  SelectOption,
  SelectPlacement,
  SelectTriggerRenderProps,
} from "./Select";
export type { SegmentedControlOption } from "./SegmentedControl";
export type { SidebarButtonSize, SidebarButtonTone } from "./SidebarButton";
export type { SkeletonShape } from "./Skeleton";
export type { StreamingTextRenderState } from "./StreamingText";
export type { ToastInput, ToastVariant } from "./Toast";
export type { ThinkingMarkProps, ThinkingMarkVariant } from "./ThinkingMark";
export type { ThinkingIndicatorProps } from "./ThinkingIndicator";
export type { ThinkingStatusTextProps } from "./ThinkingStatusText";
export type { ToolCallDetail, ToolCallState } from "./ToolCallBubble";

export { PresenceSurface, MotionSurface } from "./PresenceSurface";
export { PersistentView } from "./PersistentView";
export { Collapse } from "./Collapse";
