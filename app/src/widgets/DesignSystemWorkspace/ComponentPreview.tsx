/**
 * [INPUT]: 依赖生产 Design System、FoundationSpecimens、TypographyPreview、MotionSpecimen 与 Paper/Canvas/AI Signature Components
 * [OUTPUT]: 真实组件、Tooltip/键帽、独立 Motion、Editorial、倒计时撤销与 AI 状态样板；表单提供可见名称
 * [POS]: app/src/widgets/DesignSystemWorkspace 的预览层；所有样板只读取生产 Token/API，不建立展示专用视觉系统
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/* oxlint-disable jsx-a11y/label-has-associated-control -- 预览中的 label 包裹本地 Input/PasswordInput，插件无法穿透自定义组件识别原生控件 */
import { TypographyPreview } from "./TypographyPreview";
import { MotionSpecimen } from "./MotionSpecimen";
import {
  ICON_SIZES,
  ArrowUpIcon,
  FileTextIcon,
  GearSixIcon,
  NotePencilIcon,
  ShieldCheckIcon,
  SidebarSimpleIcon,
  TreeStructureIcon,
} from "../../shared/design-system/icons";
import { memo, useEffect, useState } from "react";

import {
  AssistantMessage,
  BrandMark,
  Button,
  Dialog,
  GlowButton,
  Input,
  KeyboardShortcut,
  MentionInput,
  PasswordInput,
  SegmentedControl,
  Select,
  SidebarButton,
  Skeleton,
  SkeletonGroup,
  ThinkingIndicator,
  ThinkingMark,
  ToolCallBubble,
  UserMenu,
  UserMessageBubble,
  WarmTooltip,
  WarmTooltipGroup,
  useToast,
  type SegmentedControlOption,
} from "../../shared/design-system/components";
import { MentionMenu, type MentionResult } from "../AgentPanel/MentionMenu";
import { ArchiveCordOverlay } from "../ArchiveCord";
import { EdgeDock } from "../EdgeDock";
import { MarkdownEditor } from "../MarkdownEditor";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { PaperSurface } from "../PaperSurface";
import { useTheme } from "../../shared/theme/ThemeProvider";
import type { DesignSystemSampleId } from "./componentCatalog";
import { iconographyCatalog } from "./iconCatalog";
import { ColorPreview, ShapeMaterialPreview, SpatialRhythmPreview } from "./FoundationSpecimens";

type ComponentPreviewProps = {
  sampleId: DesignSystemSampleId;
};

type PreviewTheme = "system" | "light" | "dark";

const segmentedControlPreviewOptions: SegmentedControlOption<PreviewTheme>[] = [
  { label: "系统", value: "system" },
  { label: "白天", value: "light" },
  { label: "黑暗", value: "dark" },
];

function IconographyPreview() {
  return (
    <div className="ds-iconography-preview" data-icon-count={iconographyCatalog.length}>
      <header className="ds-iconography-intro">
        <div>
          <strong>Lucide React</strong>
        </div>
        <p>24×24 Grid · 2px Stroke · Round cap/join · currentColor</p>
      </header>
      <div aria-label="图标尺寸阶梯" className="ds-icon-size-scale">
        {ICON_SIZES.map((size) => (
          <span key={size}>
            <NotePencilIcon aria-hidden="true" size={size} />
            <code>{size}px</code>
          </span>
        ))}
      </div>
      <div className="ds-iconography-grid" aria-label="生产图标示例">
        {iconographyCatalog.map((item) => {
          const IconComponent = item.icon;

          return (
            <div className="ds-iconography-item" key={item.exportName}>
              <span aria-hidden="true"><IconComponent size={16} /></span>
              <div>
                <strong>{item.label}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function GlowButtonPreview() {
  return (
    <div className="ds-button-preview">
      <div aria-label="Glow CTA" className="ds-button-preview-row">
        <GlowButton>登录</GlowButton>
        <GlowButton icon={ArrowUpIcon}>立即开始</GlowButton>
      </div>
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

const assistantPreviewChunks = [
  "当然。",
  "先确认",
  "目标，",
  "再拆分",
  "优先级。\n\n",
  "然后",
  "为每一步",
  "补上",
  "明确的",
  "完成标准，",
  "旧段落",
  "保持稳定。",
] as const;

function AssistantMessagePreview() {
  const [run, setRun] = useState(0);
  const [content, setContent] = useState<string>(assistantPreviewChunks[0]);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    setContent(assistantPreviewChunks[0]);
    setStreaming(true);
    const timers = assistantPreviewChunks.slice(1).map((_, index) => (
      window.setTimeout(() => {
        setContent(assistantPreviewChunks.slice(0, index + 2).join(""));
      }, (index + 1) * 110)
    ));
    const settleTimer = window.setTimeout(
      () => setStreaming(false),
      assistantPreviewChunks.length * 110,
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(settleTimer);
    };
  }, [run]);

  const replay = () => {
    setStreaming(true);
    setRun((value) => value + 1);
  };

  return (
    <div className="ds-ai-message-preview">
      <UserMessageBubble>
        <p>帮我把今天的产品想法整理成三个行动项。</p>
      </UserMessageBubble>
      <AssistantMessage
        content={content}
        key={run}
        renderContent={(content, streamingText) => (
          <MarkdownReadingView
            content={content}
            streamingText={streamingText}
          />
        )}
        streaming={streaming}
      />
      <Button onClick={replay} variant="ghost">
        重播流式动效
      </Button>
    </div>
  );
}

const composerPreviewMemos: MentionResult[] = [
  { id: "memo-product", path: "工作 / 产品", revision: 4, title: "产品规划" },
  { id: "memo-interview", path: "工作 / 研究", revision: 7, title: "用户访谈" },
  { id: "memo-review", path: "工作 / 产品", revision: 2, title: "产品复盘" },
  { id: "memo-reading", path: "阅读", revision: 3, title: "影响力第三章" },
];

function ComposerPreview() {
  const [value, setValue] = useState("参考 ");
  const [mention, setMention] = useState<MentionResult | null>(null);
  const match = value.match(/(?:^|\s)@([^\s@]*)$/u);
  const query = match?.[1] ?? "";
  const mentionStart = match === null
    ? null
    : value.lastIndexOf("@", value.length - query.length - 1);
  const results = composerPreviewMemos.filter((memo) => mention?.id !== memo.id
    && (query.length === 0 || memo.title.includes(query)));

  const selectMention = (memo: MentionResult) => {
    if (mentionStart === null) return;
    setMention(memo);
    setValue(`${value.slice(0, mentionStart)}@${memo.title} `);
  };

  return (
    <div className="ds-composer-preview">
      <form className="agent-composer" onSubmit={(event) => event.preventDefault()}>
        <MentionMenu open={mentionStart !== null} activeIndex={0} onSelect={selectMention} results={results} />
        <MentionInput
          aria-label="Prompt Composer 示例"
          className="agent-chat-input"
          mentions={mention === null ? [] : [{ id: mention.id, label: mention.title }]}
          onValueChange={(nextValue) => {
            setValue(nextValue);
            if (mention !== null && !nextValue.includes(`@${mention.title}`)) setMention(null);
          }}
          placeholder="输入消息，@ 引用笔记…"
          value={value}
        />
        <div className="agent-composer-footer">
          <Button aria-label="权限管理" className="agent-composer-action" icon={ShieldCheckIcon} size="square" variant="ghost" />
          <Button aria-label="发送消息" className="agent-composer-action" icon={ArrowUpIcon} size="square" variant="primary" />
        </div>
      </form>
    </div>
  );
}

function MarkdownPreview() {
  const { resolvedTheme } = useTheme();
  const [value, setValue] = useState("## Working principle\n\nWrite first. Let structure appear later.");

  return (
    <div className="ds-markdown-editor-preview">
      <MarkdownEditor
        editingMode="live"
        onBlur={() => undefined}
        onChange={setValue}
        theme={resolvedTheme}
        value={value}
      />
    </div>
  );
}

function ReadingPreview() {
  return (
    <div className="ds-editorial-reading-preview note-reading-surface">
      <MarkdownReadingView content={"## Durable notes\n\n结构可以晚一点出现，重要的是先让想法安全落在纸上。"} />
    </div>
  );
}

function QuotePreview() {
  return (
    <div className="ds-editorial-reading-preview">
      <MarkdownReadingView content={"> A quiet tool protects thought before it organizes it."} />
    </div>
  );
}

function CodePreview() {
  return (
    <div className="ds-editorial-reading-preview">
      <MarkdownReadingView content={'Use `content_mdx` as the source of truth.\n\n```ts\nconst archive = "durable";\n```'} />
    </div>
  );
}

function ThinkingIndicatorPreview() {
  return (
    <div className="ds-thinking-preview">
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
        state="running"
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
      size="compact"
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
        <Input defaultValue="linus@folune.dev" />
      </label>
      <label>
        <span>Password</span>
        <PasswordInput
          defaultValue="folune"
          onVisibilityChange={setPasswordVisible}
          visibilityLabel="Design System 密码"
          visible={passwordVisible}
        />
      </label>
      <label>
        <span>Error</span>
        <Input aria-invalid="true" defaultValue="invalid@" />
      </label>
      <label>
        <span>Disabled</span>
        <Input disabled value="Unavailable" readOnly />
      </label>
    </div>
  );
}

function SelectPreview() {
  return (
    <div className="ds-select-preview">
      <Select
        ariaLabel="界面语言"
        defaultValue="zh-CN"
        options={[
          { label: "简体中文", value: "zh-CN" },
          { label: "English", value: "en" },
        ]}
      />
    </div>
  );
}

function PaperSurfacePreview() {
  return (
    <div className="ds-paper-surface-preview">
      <PaperSurface
        organizing={false}
        paperIdentity="design-system-paper"
        reducedMotion={false}
      >
        <header><span>Product / Principles</span><small>Folio 01</small></header>
        <article><h4>Write first.</h4><p>Structure can appear after the idea is safe.</p></article>
      </PaperSurface>
    </div>
  );
}

function EdgeDockPreview() {
  return (
    <div className="ds-edge-dock-preview">
      <EdgeDock icon={<SidebarSimpleIcon size={16} />} label="文件库" onClick={() => undefined} side="left" />
    </div>
  );
}

function ArchiveCordPreview() {
  /*
   * 样板消费的就是生产 Overlay 与生产标记: source 是 data-archive-source, 终点是树上
   * 那个唯一的 data-archive-representative。样板不复制第二条展示专用线, 因此指向样板
   * 目标时提亮的是真实的那套 emphasis 规则。origin 用 restored, 于是它稳定停在 settled,
   * 不会每次切到这一页都重播一次「刚刚发生」。
   */
  return (
    <div className="ds-archive-cord-preview" data-archive-cord-scope="design-system">
      <div className="ds-archive-cord-paper" data-archive-source="true"><strong>归档于 Product thinking</strong></div>
      <div
        className="ds-archive-cord-target"
        data-archive-representative="memo"
        data-memo-tree-row-id="design-system-target"
      >
        <span>Product thinking</span>
      </div>
      <ArchiveCordOverlay
        libraryOpen
        overlayPanels={false}
        presentation={{ memoId: "design-system-target", origin: "restored", path: "Product / Product thinking", runId: "design-system", status: "succeeded" }}
        scopeSelector='[data-archive-cord-scope="design-system"]'
      />
    </div>
  );
}

function DialogPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="ds-dialog-preview-copy">
      <Button onClick={() => setDialogOpen(true)} variant="primary">打开对话框</Button>
      <Dialog
        description="按 Escape 或点击外部关闭。"
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title="对话框"
      >
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          在这里完成需要专注的操作。
        </p>
      </Dialog>
    </div>
  );
}

function ToastPreview() {
  const { dismissToast, toast } = useToast();

  return (
    <div className="ds-preview-actions">
      <Button onClick={() => toast({ title: "普通信息", variant: "info" })}>Info</Button>
      <Button onClick={() => toast({ title: "保存成功", variant: "success" })}>Success</Button>
      <Button onClick={() => toast({ title: "请检查输入", variant: "warning" })}>Warning</Button>
      <Button onClick={() => toast({ title: "保存失败", variant: "error" })}>Error</Button>
      <Button onClick={() => {
        const id = toast({
          title: "已从画布移除",
          action: { label: "撤销", onClick: () => dismissToast(id) },
        });
      }}>撤销倒计时</Button>
    </div>
  );
}

function TooltipPreview() {
  const [warm, setWarm] = useState(false);
  return (
    <div className="ds-tooltip-preview">
      <WarmTooltipGroup onWarmChange={setWarm}>
        <div className="ds-preview-actions">
          <WarmTooltip asChild content="打开文件库">
            <Button icon={SidebarSimpleIcon}>文件库</Button>
          </WarmTooltip>
          <WarmTooltip asChild content="整理当前笔记，让内容自然归入文件树。" side="bottom">
            <Button icon={NotePencilIcon} variant="ghost">整理笔记</Button>
          </WarmTooltip>
        </div>
      </WarmTooltipGroup>
      <p data-text-role="caption">{warm ? "移到相邻按钮，提示连续出现。" : "悬停或 Tab 查看，Escape 收起。"}</p>
    </div>
  );
}

const shortcutOptions = [
  { label: "组合键", value: "command" },
  { label: "确认", value: "confirm" },
  { label: "导航", value: "navigation" },
] as const;
const shortcutExamples = {
  command: [["mod", "K"], ["mod", "E"]],
  confirm: [["Enter"], ["Escape"]],
  navigation: [["Space"], ["Backspace"], ["Escape"]],
} as const;

function KeyboardShortcutPreview() {
  const [example, setExample] = useState<keyof typeof shortcutExamples>("command");
  return (
    <div className="ds-shortcut-preview">
      <SegmentedControl ariaLabel="快捷键样本" onValueChange={setExample} options={shortcutOptions} value={example} />
      <div className="ds-preview-actions">
        {shortcutExamples[example].map(keys => <KeyboardShortcut keys={keys} key={keys.join("+")} />)}
      </div>
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
        email="linus@folune.dev"
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
    case "Color": return <ColorPreview />;
    case "Typography": return <TypographyPreview />;
    case "Iconography": return <IconographyPreview />;
    case "SpatialRhythm": return <SpatialRhythmPreview />;
    case "RadiusElevationMotion": return <ShapeMaterialPreview />;
    case "Motion": return <MotionSpecimen />;
    case "Button": return <ButtonPreview />;
    case "GlowButton": return <GlowButtonPreview />;
    case "Skeleton": return <SkeletonPreview />;
    case "Composer": return <ComposerPreview />;
    case "Messages": return <AssistantMessagePreview />;
    case "ThinkingMark": return <ThinkingMarkPreview />;
    case "ThinkingIndicator": return <ThinkingIndicatorPreview />;
    case "ToolCallBubble": return <ToolCallBubblePreview />;
    case "SidebarButton": return <SidebarButtonPreview />;
    case "SegmentedControl": return <SegmentedControlPreview />;
    case "Input": return <InputPreview />;
    case "Select": return <SelectPreview />;
    case "Dialog": return <DialogPreview />;
    case "Toast": return <ToastPreview />;
    case "Tooltip": return <TooltipPreview />;
    case "KeyboardShortcut": return <KeyboardShortcutPreview />;
    case "BrandMark": return <BrandMarkPreview />;
    case "UserMenu": return <UserMenuPreview />;
    case "PaperSurface": return <PaperSurfacePreview />;
    case "Markdown": return <MarkdownPreview />;
    case "Reading": return <ReadingPreview />;
    case "Quote": return <QuotePreview />;
    case "Code": return <CodePreview />;
    case "EdgeDock": return <EdgeDockPreview />;
    case "ArchiveCord": return <ArchiveCordPreview />;
  }
});
