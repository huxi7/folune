/**
 * [INPUT]: 依赖 React 本地状态、React Router 返回入口、共享 Lucide 图标、共享 BrandMark/Button/Input/SegmentedControl/SidebarButton/UserMessageBubble 与本页隔离样式
 * [OUTPUT]: 对外提供仅开发态可达的 /color-lab 蓝色终选页，以同一 Paper First 界面切换现有蓝参照与灰蓝/标准墨蓝/柔和墨蓝、Light/Dark
 * [POS]: app/src/pages 的视觉决策实验页；只比较 scoped 蓝色 Primary token，不接入鉴权、业务数据或生产主题状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  FileTextIcon,
  FolderIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  NotePencilIcon,
  SunIcon,
} from "../shared/design-system/icons";
import { useState } from "react";
import { Link } from "react-router-dom";

import "../styles/color-lab.css";

import {
  BrandMark,
  Button,
  Input,
  SegmentedControl,
  SidebarButton,
  UserMessageBubble,
} from "../shared/design-system/components";

type PaletteName = "classic" | "current" | "slate" | "soft";
type ThemeName = "dark" | "light";

const themeOptions = [
  { icon: SunIcon, label: "浅色", value: "light" },
  { icon: MoonIcon, label: "暗色", value: "dark" },
] as const;

const paletteCopy: Record<PaletteName, {
  code: string;
  description: string;
  hex: string;
  name: string;
  verdict: string;
}> = {
  current: {
    code: "01 / CURRENT BLUE",
    description: "蓝感最明确，但更像通用数字工具，仅作当前基准。",
    hex: "#405F96",
    name: "现有蓝",
    verdict: "参照",
  },
  slate: {
    code: "02 / SLATE BLUE",
    description: "最灰、最安静，能很好地退到内容后面，但品牌记忆稍弱。",
    hex: "#48647C",
    name: "灰蓝",
    verdict: "最克制",
  },
  classic: {
    code: "04 / CLASSIC INK",
    description: "最像墨水干在纸上的颜色，书写感最强，但实心按钮会略重。",
    hex: "#344E68",
    name: "标准墨蓝",
    verdict: "最像墨",
  },
  soft: {
    code: "05 / SOFT INK",
    description: "墨感、可读性与数字界面活力最平衡，适合长期作为 Primary。",
    hex: "#395875",
    name: "柔和墨蓝",
    verdict: "首选",
  },
};

const paletteOrder: PaletteName[] = ["current", "slate", "classic", "soft"];

function PaletteSwatches() {
  return (
    <div aria-label="本方案关键色彩角色" className="color-lab-swatches">
      <span><i data-swatch="canvas" />Canvas</span>
      <span><i data-swatch="paper" />Paper</span>
      <span><i data-swatch="ink" />Ink</span>
      <span><i data-swatch="primary" />Primary</span>
      <span><i data-swatch="soft" />Soft</span>
      <span><i data-swatch="loading" />Saving</span>
    </div>
  );
}

function PaletteSelector({
  palette,
  onSelect,
}: {
  onSelect: (nextPalette: PaletteName) => void;
  palette: PaletteName;
}) {
  return (
    <section aria-label="蓝色候选" className="color-lab-candidates">
      <div className="color-lab-candidates-heading">
        <div>
          <p>FINALISTS / 02 · 04 · 05</p>
          <h2>先把六种蓝收束成三种</h2>
        </div>
        <span>现有蓝只保留作参照，不再参与推荐。</span>
      </div>
      <div className="color-lab-candidate-grid">
        {paletteOrder.map((candidate) => {
          const copy = paletteCopy[candidate];
          const selected = candidate === palette;

          return (
            <button
              aria-pressed={selected}
              className="color-lab-candidate"
              data-palette={candidate}
              key={candidate}
              onClick={() => onSelect(candidate)}
              type="button"
            >
              <span className="color-lab-candidate-swatch" />
              <span className="color-lab-candidate-copy">
                <span>{copy.code}</span>
                <strong>{copy.name}</strong>
                <small>{copy.hex}</small>
              </span>
              <span className="color-lab-candidate-verdict">{copy.verdict}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PreviewSidebar() {
  return (
    <aside className="color-lab-sidebar">
      <header className="color-lab-sidebar-header">
        <BrandMark />
        <Button aria-label="新建备忘录" icon={NotePencilIcon} size="square" variant="primary" />
      </header>
      <div className="color-lab-sidebar-search">
        <MagnifyingGlassIcon aria-hidden="true" size={14} />
        <span>搜索</span>
      </div>
      <div className="color-lab-tree">
        <p>备忘录</p>
        <SidebarButton
          label="产品设计"
          leading={<FolderIcon size={15} />}
          trailing={<span>2</span>}
        />
        <SidebarButton
          active
          className="color-lab-tree-child"
          label="给复杂系统留一张安静的纸"
          leading={<FileTextIcon size={15} />}
        />
        <SidebarButton
          className="color-lab-tree-child"
          label="自动归档的边界"
          leading={<FileTextIcon size={15} />}
        />
        <SidebarButton
          label="灵感"
          leading={<FolderIcon size={15} />}
          trailing={<span>4</span>}
        />
      </div>
      <footer className="color-lab-sidebar-footer">
        <span className="color-lab-avatar">L</span>
        <span><strong>Linus</strong><small>个人工作区</small></span>
      </footer>
    </aside>
  );
}

function PreviewPaper() {
  return (
    <section aria-label="备忘录纸张预览" className="color-lab-canvas">
      <div className="color-lab-canvas-toolbar">
        <span>根目录 / 产品设计</span>
        <div>
          <Button icon={MagicWandIcon} variant="secondary">整理</Button>
          <Button loading variant="primary">保存中</Button>
        </div>
      </div>
      <article className="color-lab-paper">
        <p className="color-lab-paper-kicker">SUPERNOTE / PRODUCT NOTE</p>
        <h2>给复杂系统留一张安静的纸</h2>
        <p className="color-lab-lead">复杂工具不应该把复杂度倾倒给人。</p>
        <blockquote>一张纸、一条线、两个在需要时才出现的工具。</blockquote>
        <h3>设计原则</h3>
        <ul>
          <li><CheckIcon aria-hidden="true" size={15} />Paper 始终是主角</li>
          <li><CheckIcon aria-hidden="true" size={15} />颜色只解释动作与当前状态</li>
          <li><CheckIcon aria-hidden="true" size={15} />AI 在后台整理，不打断书写</li>
        </ul>
        <p>
          先让内容安全落在纸上，再让结构从上下文中自然出现。
          <a href="#color-lab-comparison" onClick={(event) => event.preventDefault()}>查看归档原则</a>
        </p>
      </article>
    </section>
  );
}

function PreviewAgent() {
  return (
    <aside className="color-lab-agent">
      <header>
        <span className="color-lab-agent-mark"><ChatCircleDotsIcon size={16} /></span>
        <span><strong>备忘录助手</strong><small>当前笔记</small></span>
      </header>
      <div className="color-lab-agent-thread">
        <p className="color-lab-assistant-copy">
          我会保留正文，只根据主题把它归入现有的“产品设计”。
        </p>
        <UserMessageBubble className="color-lab-user-message">
          保留原文，帮我整理。
        </UserMessageBubble>
        <div className="color-lab-tool-state">
          <MagicWandIcon aria-hidden="true" size={14} />
          <span>正在分析归档位置</span>
        </div>
      </div>
      <div className="color-lab-composer">
        <Input aria-label="输入消息" placeholder="输入消息，@ 引用笔记…" />
        <Button aria-label="发送消息" icon={ArrowUpIcon} size="square" variant="primary" />
      </div>
    </aside>
  );
}

function ColorSystemPreview({
  palette,
  theme,
}: {
  palette: PaletteName;
  theme: ThemeName;
}) {
  const copy = paletteCopy[palette];

  return (
    <article
      aria-label={`${copy.name}${theme === "dark" ? "暗色" : "浅色"}预览`}
      className="color-lab-system"
      data-palette={palette}
      data-theme={theme}
    >
      <header className="color-lab-system-header">
        <div>
          <p>{copy.code}</p>
          <h2>{copy.name}</h2>
        </div>
        <p>{copy.description}<br /><strong>{copy.hex}</strong></p>
      </header>
      <PaletteSwatches />
      <div className="color-lab-app-frame">
        <PreviewSidebar />
        <PreviewPaper />
        <PreviewAgent />
      </div>
    </article>
  );
}

export function ColorLabPage() {
  const [theme, setTheme] = useState<ThemeName>("light");
  const [palette, setPalette] = useState<PaletteName>("soft");

  return (
    <main className="color-lab-page" id="color-lab-comparison">
      <header className="color-lab-page-header">
        <div className="color-lab-page-intro">
          <Link aria-label="返回首页" className="color-lab-back" to="/">
            <ArrowLeftIcon size={16} />
          </Link>
          <div>
            <p>SUPERNOTE / COLOR STUDY 02</p>
            <h1>六种蓝，收束到三种</h1>
            <span>现有蓝只作为对照；真正要选的是 02 灰蓝、04 标准墨蓝、05 柔和墨蓝。</span>
          </div>
        </div>
        <div className="color-lab-controls">
          <SegmentedControl
            ariaLabel="选择明暗主题"
            onValueChange={setTheme}
            options={themeOptions}
            value={theme}
          />
        </div>
      </header>
      <PaletteSelector onSelect={setPalette} palette={palette} />
      <section className="color-lab-comparison" data-view="single">
        <ColorSystemPreview palette={palette} theme={theme} />
      </section>
      <footer className="color-lab-page-footer">
        <span>判断标准</span>
        <p>先看 Paper 是否仍然是主角，再看蓝色是否像墨水自然长出来，而不是像组件库贴上去。</p>
      </footer>
    </main>
  );
}
