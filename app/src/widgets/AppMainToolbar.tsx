/**
 * [INPUT]: 依赖 memo 标题/view 状态、可选文件操作能力、持久 Canvas 入口、整理 presentation、文件库定位回调、显式 AI 整理命令与浏览器 scroll timeline 能力
 * [OUTPUT]: 对外提供 sticky Paper Toolbar：左侧 Canvas 返回/归档落点/标题三段身份，右侧按扫描顺序排 Quiet Accent「整理」（独立文字槽做光学对齐）→ 32px 图标控制簇（Canvas、阅读切换、更多）
 * [POS]: app/src/widgets 的纸张内命令条纯视图；左身份右能力各占稳定槽位，核心动作排首、「更多」只能排在簇尾，归档状态兼作归档线起点故必须留在纸的左上角，全局文件库/AI 开关归工作区控制层。凝结与下缘软边是同一个 CSS 滚动进度的两个读数，首选交给滚动本身，只有不支持 scroll timeline 的浏览器才挂一个哨兵做一次软切；本组件因此不含阈值、不读 scrollTop，也不知道软边有多高
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState, type RefObject } from "react";

import {
  ArrowLeftIcon,
  CanvasIcon,
  OrganizeNoteIcon,
} from "../shared/design-system/icons";

import type { MemoDetailNode } from "../shared/api/memo";
import { Button } from "../shared/design-system/components";
import { MarkdownViewMenu } from "./MarkdownViewMenu";
import { ArchiveStatus } from "./ArchiveStatus";
import type { WorkspaceOrganizePresentation } from "./archiveCordPolicy";
import type { DocumentView, EditingMode } from "./markdownViewTypes";

type AppMainToolbarProps = {
  currentMemo: MemoDetailNode | null;
  fileActionsEnabled?: boolean;
  canvasReturnTitle?: string;
  currentMemoTitle: string;
  documentView: DocumentView;
  editingMode: EditingMode;
  enteringCanvas: boolean;
  onDocumentViewChange: (view: DocumentView) => void;
  onEditingModeChange: (mode: EditingMode) => void;
  onEnterCanvas: () => void;
  onReturnCanvas?: () => void;
  onOrganize: () => Promise<void>;
  onLocateArchive: () => void;
  organizePresentation: WorkspaceOrganizePresentation | null;
  organizing: boolean;
};

/*
 * 凝结的首选驱动是滚动本身(CSS scroll timeline)。这个常量只回答一个问题: 这个浏览器
 * 能不能那样做。能, 就连哨兵都不挂载 —— 让 Chrome 背一个永不使用的 DOM 节点, 是为了
 * 少数浏览器给多数浏览器记账。
 */
const supportsScrollTimeline = typeof CSS !== "undefined"
  && typeof CSS.supports === "function"
  && CSS.supports("animation-timeline", "scroll()");

/*
 * fallback 只做一次软切换, 不做连续测量: 哨兵的高度在 CSS 里由同一个 --toolbar-condense-to
 * 算出, 因此"什么时候算凝结"这件事在 JS 里没有第二个数值。
 */
function useCondensedFallback(): {
  condensed: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
} {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (supportsScrollTimeline || sentinel === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry !== undefined) setCondensed(!entry.isIntersecting);
      },
      { root: sentinel.closest(".paper-stage-scroll"), threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { condensed, sentinelRef };
}

export function AppMainToolbar(props: AppMainToolbarProps) {
  const { condensed, sentinelRef } = useCondensedFallback();
  return (
    <>
      {supportsScrollTimeline
        ? null
        : <div aria-hidden="true" className="app-main-toolbar-sentinel" ref={sentinelRef} />}
    <header className="app-main-toolbar" data-condensed={supportsScrollTimeline ? undefined : condensed}>
      {/*
        * 左侧只放身份: 来路、落点、标题。归档状态住在这里而不是命令簇里, 有两个理由 ——
        * 它回答「你在哪」而不是「你能做什么」; 而且它是归档线的起点, 放在纸的右上角会让
        * 那条线横穿整张纸才够得到左边的文件树。它排在标题之前, 于是位置不随标题淡入改变。
        */}
      <div className="app-main-toolbar-leading">
        {props.currentMemo !== null && props.onReturnCanvas !== undefined ? (
          <Button
            aria-label={`返回 ${props.canvasReturnTitle ?? "Canvas"}`}
            className="toolbar-return-canvas"
            icon={ArrowLeftIcon}
            onClick={props.onReturnCanvas}
            size="square"
            title={`返回「${props.canvasReturnTitle ?? "Canvas"}」`}
            variant="ghost"
          />
        ) : null}
        {props.currentMemo !== null ? (
          <ArchiveStatus onLocate={props.onLocateArchive} presentation={props.organizePresentation} />
        ) : null}
        <span className="app-main-toolbar-title" data-toolbar-title="true">{props.currentMemoTitle}</span>
      </div>
      {/*
        * 顺序不是审美, 是扫描顺序: 整理排在最左, 于是核心动作是这一簇里第一个被扫到的东西;
        * 换空间的 Canvas 紧随其后但不占最右; 「更多」永远在最右 —— 它的菜单右对齐垂下,
        * 放在别处只会悬在同侧控件头上。整理与图标簇用 8px 留白, 簇内用 4px 留白, 顶栏不画装饰性竖线。
        *
        * Canvas 是导航(名词), 无标签 32px 图标足够, 与阅读切换同一重量; 整理是命令(动词),
        * 32px + 文字 + Soft Ink 色调。两者共用同一个无填色底座只是实现复用: 整理的层级由
        * 尺寸、文字与色调表达, 不由填色表达 —— 一张安静白纸上的永久色块反而在跟文件库的
        * 「新建」抢主角, 那颗才是 Filled Primary 该待的地方。
        */}
      <div className="note-view-actions">
        {props.currentMemo !== null ? <>
          <Button aria-keyshortcuts="Meta+Enter Control+Enter" className="note-organize-button" icon={OrganizeNoteIcon} loading={props.organizing} onClick={() => void props.onOrganize()} size="default" title="整理（⌘/Ctrl + Enter）" variant="ghost"><span className="note-organize-label">整理</span></Button>
          <div className="note-view-cluster">
            <Button aria-keyshortcuts="Meta+E Control+E" aria-label="进入 Canvas" className="note-explore-button" icon={CanvasIcon} loading={props.enteringCanvas} onClick={props.onEnterCanvas} size="square" title="进入 Canvas（⌘/Ctrl + E）" variant="ghost" />
            <MarkdownViewMenu fileActionsEnabled={props.fileActionsEnabled} content={props.currentMemo.memo.content_mdx} documentView={props.documentView} editingMode={props.editingMode} onDocumentViewChange={props.onDocumentViewChange} onEditingModeChange={props.onEditingModeChange} title={props.currentMemoTitle} />
          </div>
        </> : null}
      </div>
    </header>
    </>
  );
}
