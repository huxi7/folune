/**
 * [INPUT]: 依赖 React、生产 Design System/Lucide 图标边界、真实 MarkdownEditor/MarkdownReadingView 与 PaperSurface/EdgeDock/ArchiveCord/Cord Signature Components
 * [OUTPUT]: 对外提供 Color/Type/Iconography Foundations、Primitives、完整 Editorial 与 AI & Organize 的生产同源状态样板
 * [POS]: app/src/widgets/DesignSystemWorkspace 的预览层；所有样板只读取生产 Token/API，不建立展示专用视觉系统
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ICON_SIZES,
  ArrowUpIcon,
  DesktopIcon,
  FileTextIcon,
  GearSixIcon,
  MoonStarsIcon,
  NotePencilIcon,
  ShieldCheckIcon,
  SidebarSimpleIcon,
  SunIcon,
  TreeStructureIcon,
} from "../../shared/design-system/icons";
import { memo, useEffect, useState } from "react";

import {
  AssistantMessage,
  BrandMark,
  Button,
  Card,
  Dialog,
  Input,
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
  useToast,
  type SegmentedControlOption,
} from "../../shared/design-system/components";
import { MentionMenu, type MentionResult } from "../AgentPanel/MentionMenu";
import {
  ArchiveCordStage,
  ArchivePort,
  ArchiveTargetPort,
} from "../ArchiveCord";
import { Cord, CordLayer } from "../Cord";
import { EdgeDock } from "../EdgeDock";
import { MarkdownEditor } from "../MarkdownEditor";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { PaperSurface } from "../PaperSurface";
import { useTheme } from "../../shared/theme/ThemeProvider";
import type { DesignSystemSampleId } from "./componentCatalog";
import {
  iconographyCatalog,
  type IconographyGroup,
} from "./iconCatalog";

type ComponentPreviewProps = {
  sampleId: DesignSystemSampleId;
};

type PreviewTheme = "system" | "light" | "dark";

const segmentedControlPreviewOptions: SegmentedControlOption<PreviewTheme>[] = [
  { icon: DesktopIcon, label: "系统", value: "system" },
  { icon: SunIcon, label: "白天", value: "light" },
  { icon: MoonStarsIcon, label: "黑夜", value: "dark" },
];

const spatialSteps = [
  { step: "1", token: "space-1", value: "4px" },
  { step: "2", token: "space-2", value: "8px" },
  { step: "3", token: "space-3", value: "12px" },
  { step: "4", token: "space-4", value: "16px" },
  { step: "6", token: "space-6", value: "24px" },
  { step: "8", token: "space-8", value: "32px" },
] as const;

const typographyRoles = [
  { key: "display", role: "展示 Display", token: "--type-display", size: "32–56px", leading: "1.05", weight: "500", family: "Editorial", usage: "Landing / Design System 主标题", sample: "思想先被写下" },
  { key: "title", role: "标题 Title", token: "--type-title", size: "24–30px", leading: "1.2", weight: "500", family: "Editorial", usage: "Paper 标题 / 页面标题", sample: "让内容成为主角" },
  { key: "heading", role: "章节 Heading", token: "--type-heading", size: "18px", leading: "1.45", weight: "650", family: "Interface", usage: "分组标题 / 结构层级", sample: "第三章 · 结构与检索" },
  { key: "body", role: "正文 Body", token: "--type-body", size: "15px", leading: "27px", weight: "450", family: "Interface", usage: "编辑器 / 说明文字", sample: "界面退后，让笔记与智能自然浮现。" },
  { key: "ui", role: "操作 UI", token: "--type-ui", size: "14px", leading: "18px", weight: "650", family: "Interface", usage: "Button / Sidebar / Menu", sample: "保存 · 文件库 · 整理" },
  { key: "label", role: "标签 Label", token: "--type-label", size: "12px", leading: "16px", weight: "650", family: "Interface", usage: "字段名 / 小组标题 / 高密度树节点", sample: "产品规划 · 用户访谈" },
  { key: "caption", role: "辅助 Caption", token: "--type-caption", size: "11px", leading: "16px", weight: "560", family: "Interface", usage: "时间 / 状态 / 辅助说明", sample: "最后保存于 14:32" },
  { key: "mono", role: "系统 Mono", token: "--type-mono", size: "11px", leading: "16px", weight: "500", family: "Mono", usage: "Token / 路径 / 技术标识", sample: "--primary · memo_2026_08" },
] as const;

const iconographyGroups: readonly IconographyGroup[] = [
  "Navigation",
  "Content",
  "Actions",
  "Status",
  "AI & Communication",
  "Account & System",
];

function ColorPreview() {
  return (
    <div className="ds-color-system-preview">
      <div className="ds-color-system-note">
        <strong>Soft Ink · 柔和墨蓝</strong>
        <span>Light #395875 · Dark #91ABC4 · Saving 使用同色相的低饱和 Processing 状态</span>
      </div>
      <div className="ds-color-preview">
        {[
          ["Stage", "workspace-stage"],
          ["Paper", "paper-surface"],
          ["Ink", "foreground"],
          ["Muted", "muted-foreground"],
          ["Hairline", "border"],
          ["Primary", "primary"],
          ["Hover", "primary-hover"],
          ["Pressed", "primary-active"],
          ["Primary Soft", "accent"],
          ["Saving", "processing-surface"],
          ["Focus", "ring"],
          ["Danger", "destructive"],
        ].map(([label, token]) => (
          <span data-color={token} key={token}>
            <i />
            <small>{label}</small>
            <code>--{token}</code>
          </span>
        ))}
      </div>
    </div>
  );
}

function TypographyPreview() {
  return (
    <div className="ds-type-system-preview">
      <section aria-label="字体家族" className="ds-type-family-grid">
        <article className="ds-type-family" data-family="interface">
          <div><strong>Interface / 界面</strong><code>--font-sans</code></div>
          <p>SuperNote 文件库</p>
          <small>Avenir Next × PingFang SC · Noto Sans SC fallback</small>
        </article>
        <article className="ds-type-family" data-family="editorial">
          <div><strong>Editorial / 阅读</strong><code>--font-serif</code></div>
          <p>让内容成为主角</p>
          <small>Iowan Old Style × Songti SC · Noto Serif SC fallback</small>
        </article>
        <article className="ds-type-family" data-family="mono">
          <div><strong>Mono / 系统</strong><code>--font-mono</code></div>
          <p>memo_2026_08</p>
          <small>SF Mono × Cascadia Code · Menlo fallback</small>
        </article>
      </section>

      <section aria-label="字号与行高角色" className="ds-type-scale">
        <div className="ds-type-scale-header" role="row">
          <span>角色 / Token</span><span>中文样本</span><span>字号 / 行高</span><span>字重</span><span>职责</span>
        </div>
        {typographyRoles.map((item) => (
          <div className="ds-type-scale-row" data-type-role={item.key} key={item.key} role="row">
            <div><strong>{item.role}</strong><code>{item.token}</code></div>
            <p>{item.sample}</p>
            <code>{item.size} / {item.leading}</code>
            <code>{item.weight}</code>
            <small>{item.family} · {item.usage}</small>
          </div>
        ))}
      </section>

      <section aria-label="控件字体配对" className="ds-type-control-pairing">
        <article>
          <div className="ds-type-pairing-heading"><strong>Button</strong><code>36px · 14/18</code></div>
          <div className="ds-type-pairing-demo"><Button variant="primary">保存</Button><small>横向 14px · 图文 6px</small></div>
        </article>
        <article>
          <div className="ds-type-pairing-heading"><strong>Input</strong><code>36px · 14/20</code></div>
          <div className="ds-type-pairing-demo"><Input aria-label="输入示例" placeholder="输入标题" /><small>文字比 Button 更松</small></div>
        </article>
        <article>
          <div className="ds-type-pairing-heading"><strong>Paper Body</strong><code>15px · 27px</code></div>
          <div className="ds-type-pairing-demo"><p data-type="body">正文保持清楚、自然。</p><small>阅读优先，不追求紧凑</small></div>
        </article>
      </section>
    </div>
  );
}

function IconographyPreview() {
  return (
    <div className="ds-iconography-preview">
      <header className="ds-iconography-intro">
        <div>
          <strong>Lucide React</strong>
          <span>Rounded outline language</span>
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
      <p className="ds-iconography-rule">
        默认使用描边图标；Primary、选中态与状态色只改变 currentColor，不切换另一套填充图形。BrandMark、ThinkingMark 与 Archive Cord 属于 SuperNote Signature，不纳入通用图标库。
      </p>
      <div className="ds-iconography-groups">
        {iconographyGroups.map((group) => (
          <section className="ds-iconography-group" key={group}>
            <h4>{group}</h4>
            <div className="ds-iconography-grid">
              {iconographyCatalog.filter((item) => item.group === group).map((item) => {
                const IconComponent = item.icon;

                return (
                  <div className="ds-iconography-item" key={item.exportName}>
                    <span aria-hidden="true"><IconComponent size={16} /></span>
                    <div>
                      <strong>{item.label}</strong>
                      <code>{item.exportName}</code>
                      <small>{item.usage}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function RadiusElevationMotionPreview() {
  return (
    <div className="ds-foundation-material-preview">
      <div className="ds-radius-preview">
        <span data-radius="compact"><strong>8</strong><small>Compact</small></span>
        <span data-radius="control"><strong>10</strong><small>Control</small></span>
        <span data-radius="paper"><strong>12</strong><small>Paper · Menu</small></span>
        <span data-radius="panel"><strong>16</strong><small>Panel</small></span>
        <span data-radius="dialog"><strong>20</strong><small>Dialog</small></span>
      </div>
      <div className="ds-elevation-preview">
        <span data-elevation="paper">Paper</span>
        <span data-elevation="panel">Panel</span>
        <span data-elevation="popover">Popover</span>
      </div>
      <div className="ds-motion-preview">
        {([["Fast", "160"], ["Normal", "260"], ["Spatial", "320"], ["Quiet", "600"]] as const).map(([label, value]) => (
          <span key={label}><i data-motion={label.toLowerCase()} /><small>{label} · {value}ms</small></span>
        ))}
      </div>
    </div>
  );
}

function SpatialRhythmPreview() {
  return (
    <div className="ds-spatial-rhythm-preview">
      <section aria-label="4px 空间标尺" className="ds-space-scale">
        <div className="ds-spatial-section-heading">
          <p>Spacing scale</p>
          <span>4px baseline</span>
        </div>
        <ul>
          {spatialSteps.map(({ step, token, value }) => (
            <li data-space={step} key={token}>
              <code>{token}</code>
              <span aria-hidden="true" className="ds-space-measure">
                <i />
              </span>
              <small>{value}</small>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="界面尺寸阶梯" className="ds-size-system">
        <div className="ds-spatial-section-heading">
          <p>Interface sizes</p>
          <span>32 / 40 / 48</span>
        </div>
        <div aria-label="48px Panel Header 内含 32px 控件和 16px 图标" className="ds-panel-header-specimen" role="img">
          <div className="ds-panel-header-specimen-copy">
            <strong>Panel Header</strong>
            <span>48px · 12px inline</span>
          </div>
          <span className="ds-panel-header-specimen-control">
            <NotePencilIcon aria-hidden="true" size={16} />
          </span>
        </div>
        <div className="ds-control-size-row">
          <span data-control-size="compact"><i />Tree row <code>32</code></span>
          <span data-control-size="button"><i />Button <code>36</code></span>
          <span data-control-size="default"><i />Input <code>36</code></span>
          <span data-control-size="header"><i />Header <code>48</code></span>
        </div>
        <p className="ds-spatial-rule">文件树、SidebarButton 与 Header 命令保持 32px compact 节奏；标准 Button 使用 36px 与 14/18px 文字，树节点使用 32px 与 12/16px 文字，统一来自同一条 4px 尺寸阶梯。</p>
      </section>
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
        {mentionStart !== null ? <MentionMenu activeIndex={0} onSelect={selectMention} results={results} /> : null}
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
        ariaLabel="选择归档策略"
        defaultValue="reuse"
        options={[
          { label: "优先复用已有目录", value: "reuse" },
          { label: "必要时创建新目录", value: "create" },
        ]}
      />
    </div>
  );
}

function PaperSurfacePreview() {
  return (
    <div className="ds-paper-surface-preview">
      <PaperSurface
        archiveActive={false}
        archiveDrawKey="design-system-paper"
        archiveSourceId="design-system-paper"
        archiveTargetNodeId={null}
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
      <EdgeDock icon={<ThinkingMark aria-hidden="true" size={16} />} label="AI" onClick={() => undefined} side="right" />
    </div>
  );
}

function ArchiveCordPreview() {
  return (
    <ArchiveCordStage active refreshKey="design-system-archive-cord">
      <div className="ds-archive-cord-preview">
        <div className="ds-archive-cord-paper">
          <ArchivePort active drawKey="design-system" reducedMotion={false} sourceId="design-system-cord" targetNodeId="design-system-target" />
          <strong>Paper</strong>
        </div>
        <div className="ds-archive-cord-target">
          <span>Product thinking</span>
          <ArchiveTargetPort active nodeId="design-system-target" />
        </div>
      </div>
    </ArchiveCordStage>
  );
}

function CordPreview() {
  const paper = { height: 96, width: 132, x: 24, y: 52 };
  const near = { height: 44, width: 132, x: 292, y: 18 };
  const far = { height: 44, width: 132, x: 292, y: 130 };

  return (
    <div className="ds-cord-preview">
      <CordLayer>
        <Cord draw from={paper} mode="radial" to={near} tone="explore" variant="dashed" />
        <Cord draw from={paper} mode="radial" to={far} tone="relation" variant="solid" />
      </CordLayer>
      <div className="ds-cord-preview-paper" style={{ height: paper.height, left: paper.x, top: paper.y, width: paper.width }}>
        <strong>Paper</strong>
      </div>
      <div className="ds-cord-preview-card" style={{ height: near.height, left: near.x, top: near.y, width: near.width }}>
        虚线 · AI 临时推荐
      </div>
      <div className="ds-cord-preview-card" style={{ height: far.height, left: far.x, top: far.y, width: far.width }}>
        实线 · 已确认关联
      </div>
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
    case "Color": return <ColorPreview />;
    case "Typography": return <TypographyPreview />;
    case "Iconography": return <IconographyPreview />;
    case "SpatialRhythm": return <SpatialRhythmPreview />;
    case "RadiusElevationMotion": return <RadiusElevationMotionPreview />;
    case "Button": return <ButtonPreview />;
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
    case "Card": return <CardPreview />;
    case "Dialog": return <DialogPreview />;
    case "Toast": return <ToastPreview />;
    case "BrandMark": return <BrandMarkPreview />;
    case "UserMenu": return <UserMenuPreview />;
    case "PaperSurface": return <PaperSurfacePreview />;
    case "Markdown": return <MarkdownPreview />;
    case "Reading": return <ReadingPreview />;
    case "Quote": return <QuotePreview />;
    case "Code": return <CodePreview />;
    case "EdgeDock": return <EdgeDockPreview />;
    case "ArchiveCord": return <ArchiveCordPreview />;
    case "Cord": return <CordPreview />;
  }
});
