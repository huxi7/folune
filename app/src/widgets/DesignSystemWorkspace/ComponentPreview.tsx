/**
 * [INPUT]: 依赖 React memo/useEffect/useState、Phosphor 图标、通用组件、Skeleton、ThinkingMark 与互斥 AI 消息组件家族
 * [OUTPUT]: 对外提供含不重复 Button variants/loading/disabled 真实状态在内的通用组件、单光带结构 Skeleton、既定 Active Formation ThinkingMark 真实尺寸及用户/AI/Thinking/极简 Tool 状态组件交互示例 ComponentPreview
 * [POS]: app/src/widgets/DesignSystemWorkspace 的卡片预览层，只展示真实 API 而不堆叠规范说明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  DesktopIcon,
  FileTextIcon,
  GearSixIcon,
  MoonStarsIcon,
  NotePencilIcon,
  SunIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";
import { memo, useEffect, useState } from "react";

import {
  AssistantMessage,
  BrandMark,
  Button,
  Card,
  Dialog,
  Input,
  PasswordInput,
  SegmentedControl,
  SidebarButton,
  Skeleton,
  SkeletonGroup,
  ThinkingIndicator,
  ThinkingMark,
  ToolCallBubble,
  UserMenu,
  UserMessageBubble,
  useToast,
  type SegmentedControlOption,
} from "../../shared/design-system/components";
import type { DesignSystemSampleId } from "./componentCatalog";

type ComponentPreviewProps = {
  sampleId: DesignSystemSampleId;
};

type PreviewTheme = "system" | "light" | "dark";

const segmentedControlPreviewOptions: SegmentedControlOption<PreviewTheme>[] = [
  { icon: DesktopIcon, label: "系统", value: "system" },
  { icon: SunIcon, label: "白天", value: "light" },
  { icon: MoonStarsIcon, label: "黑夜", value: "dark" },
];

function ButtonPreview() {
  return (
    <div className="ds-button-preview">
      <div aria-label="Button variants" className="ds-button-preview-row">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div aria-label="Button states" className="ds-button-preview-row">
        <Button loading variant="primary">Saving</Button>
        <Button disabled variant="secondary">Disabled</Button>
      </div>
      <p>Hover · Press · Tab focus</p>
    </div>
  );
}

function SkeletonPreview() {
  return (
    <SkeletonGroup
      className="ds-skeleton-preview"
      label="Skeleton 视觉预览"
    >
      <Skeleton className="ds-skeleton-preview-avatar" shape="circle" />
      <div>
        <Skeleton className="ds-skeleton-preview-title" shape="text" />
        <Skeleton className="ds-skeleton-preview-line" shape="text" />
        <Skeleton className="ds-skeleton-preview-line ds-skeleton-preview-line-short" shape="text" />
      </div>
    </SkeletonGroup>
  );
}

function UserMessageBubblePreview() {
  return (
    <div className="ds-user-message-preview">
      <UserMessageBubble>
        <p>帮我把今天的产品想法整理成三个行动项。</p>
      </UserMessageBubble>
    </div>
  );
}

function AssistantMessagePreview() {
  const [run, setRun] = useState(0);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    setStreaming(true);
    const timer = window.setTimeout(() => setStreaming(false), 1_900);
    return () => window.clearTimeout(timer);
  }, [run]);

  return (
    <div className="ds-ai-message-preview">
      <AssistantMessage
        content="当然。先确认目标，再拆分优先级，最后为每一步补上明确的完成标准。"
        key={run}
        streaming={streaming}
      />
      <Button onClick={() => setRun((value) => value + 1)} variant="ghost">
        重播逐字动效
      </Button>
    </div>
  );
}

function ThinkingIndicatorPreview() {
  return (
    <div className="ds-thinking-preview">
      <p>等待首个正文 token 时的唯一主要活动态</p>
      <ThinkingIndicator label="ThinkingIndicator 动效预览" />
    </div>
  );
}

function ThinkingMarkPreview() {
  return (
    <div
      aria-label="Active Formation ThinkingMark 14、16、20px"
      className="ds-thinking-mark-preview"
      role="img"
    >
      <p>Active · Formation</p>
      <div>
        {[14, 16, 20].map((size) => (
          <span key={size}>
            <ThinkingMark active aria-hidden="true" size={size} />
            <code>{size}px</code>
          </span>
        ))}
      </div>
    </div>
  );
}

function ToolCallBubblePreview() {
  return (
    <div className="ds-tool-call-preview">
      <ToolCallBubble
        icon={TreeStructureIcon}
        name="编辑文件树"
        state="input-available"
      />
      <ToolCallBubble
        icon={NotePencilIcon}
        name="编辑备忘录"
        state="output-available"
      />
    </div>
  );
}

function SidebarButtonPreview() {
  const [activeItem, setActiveItem] = useState<"notes" | "settings">("notes");

  return (
    <div className="ds-sidebar-button-preview">
      <SidebarButton
        active={activeItem === "notes"}
        label="全部备忘录"
        leading={<FileTextIcon size={16} />}
        onClick={() => setActiveItem("notes")}
        trailing="24"
      />
      <SidebarButton
        active={activeItem === "settings"}
        label="设置"
        leading={<GearSixIcon size={16} />}
        onClick={() => setActiveItem("settings")}
      />
    </div>
  );
}

function SegmentedControlPreview() {
  const [theme, setTheme] = useState<PreviewTheme>("system");

  return (
    <SegmentedControl
      ariaLabel="预览界面主题"
      onValueChange={setTheme}
      options={segmentedControlPreviewOptions}
      value={theme}
    />
  );
}

function InputPreview() {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <div className="ds-preview-form">
      <label>
        <span>Email</span>
        <Input defaultValue="linus@supernote.dev" />
      </label>
      <label>
        <span>Password</span>
        <PasswordInput
          defaultValue="supernote"
          onVisibilityChange={setPasswordVisible}
          visibilityLabel="Design System 密码"
          visible={passwordVisible}
        />
      </label>
    </div>
  );
}

function CardPreview() {
  return (
    <Card className="ds-preview-card" tone="accent">
      <p>Routing result</p>
      <span>工作 / 产品 / Pricing</span>
    </Card>
  );
}

function DialogPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="ds-dialog-preview-copy">
      <Button onClick={() => setDialogOpen(true)} variant="primary">Open Dialog</Button>
      <Dialog
        description="使用真实 Dialog API 验证焦点、关闭与主题继承。"
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title="Design System Dialog"
      >
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Dialog 只承载需要用户集中处理的决定。
        </p>
      </Dialog>
    </div>
  );
}

function ToastPreview() {
  const { toast } = useToast();

  return (
    <div className="ds-preview-actions">
      <Button onClick={() => toast({ title: "普通信息", variant: "info" })}>Info</Button>
      <Button onClick={() => toast({ title: "保存成功", variant: "success" })}>Success</Button>
      <Button onClick={() => toast({ title: "请检查输入", variant: "warning" })}>Warning</Button>
      <Button onClick={() => toast({ title: "保存失败", variant: "error" })}>Error</Button>
    </div>
  );
}

function BrandMarkPreview() {
  return (
    <div className="ds-brand-preview">
      <BrandMark />
      <BrandMark iconOnly />
    </div>
  );
}

function UserMenuPreview() {
  return (
    <div className="ds-user-menu-preview">
      <UserMenu
        email="linus@supernote.dev"
        name="Linus"
        onOpenProfile={() => undefined}
        onOpenSettings={() => undefined}
        onOpenSubscription={() => undefined}
        onSignOut={async () => undefined}
      />
    </div>
  );
}

export const ComponentPreview = memo(function ComponentPreview({
  sampleId,
}: ComponentPreviewProps) {
  switch (sampleId) {
    case "Button": return <ButtonPreview />;
    case "Skeleton": return <SkeletonPreview />;
    case "UserMessageBubble": return <UserMessageBubblePreview />;
    case "AssistantMessage": return <AssistantMessagePreview />;
    case "ThinkingMark": return <ThinkingMarkPreview />;
    case "ThinkingIndicator": return <ThinkingIndicatorPreview />;
    case "ToolCallBubble": return <ToolCallBubblePreview />;
    case "SidebarButton": return <SidebarButtonPreview />;
    case "SegmentedControl": return <SegmentedControlPreview />;
    case "Input": return <InputPreview />;
    case "Card": return <CardPreview />;
    case "Dialog": return <DialogPreview />;
    case "Toast": return <ToastPreview />;
    case "BrandMark": return <BrandMarkPreview />;
    case "UserMenu": return <UserMenuPreview />;
  }
});
