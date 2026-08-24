/**
 * [INPUT]: 依赖 motion/react、EdgeDock/PaperSurface/PaperRetreat/ArchiveCord/ExploreStage 组件、useExploreStage 量尺、useDismissable、左右工具插槽、稳定 paperIdentity 与整理结果定位信息
 * [OUTPUT]: 对外提供四层 Paper First 舞台、探索态（两侧让开 + 活纸退后 + 径向候选）、全尺寸 Escape/Stage 空白关闭、响应式遮罩、无弹跳 Panel 位移与持久归档连线
 * [POS]: app/src/widgets 的工作台空间壳；只协调可见空间和动作解释，Panel 开关不跨位置变形，编辑器、文件树、Run 与 AI 会话仍由各自稳定组件拥有。探索态在此只做三件空间上的事: 让 Panel 平移出画面但保持挂载（草稿不能因为一次探索而销毁）、给活纸套一层可缩放包裹、把量好的几何交给 ExploreStage
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  AssistantPanelOpenIcon,
  SidebarSimpleIcon,
} from "../shared/design-system/icons";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import { shouldRenderExploreStars } from "../pages/explorePresentation";
import {
  fadeTransition,
  panelEnterTransition,
  panelExitTransition,
  workspaceLayoutTransition,
} from "../pages/workspaceMotion";
import { useDismissable } from "../shared/design-system/useDismissable";
import { ArchiveCordStage } from "./ArchiveCord";
import { ExploreStage, type WorkspaceExploration } from "./ExploreStage";
import { PaperRetreat } from "./PaperRetreat";
import { useExploreStage } from "./useExploreStage";
import { EdgeDock } from "./EdgeDock";
import { PaperSurface } from "./PaperSurface";
import {
  resolveArchiveTargetNodeId,
  shouldShowArchiveCord,
  type WorkspaceOrganizePresentation,
} from "./archiveCordPolicy";

type PaperWorkspaceShellProps = {
  assistant: ReactNode;
  assistantOpen: boolean;
  exploration: WorkspaceExploration;
  library: ReactNode;
  libraryOpen: boolean;
  onCloseAssistant: () => void;
  onCloseLibrary: () => void;
  onToggleAssistant: () => void;
  onToggleLibrary: () => void;
  organizing: boolean;
  paper: ReactNode;
  paperIdentity: string;
  presentation: WorkspaceOrganizePresentation | null;
  style: CSSProperties;
};

const PANEL_BREAKPOINT = 1200;
const DUAL_PANEL_SAFE_BREAKPOINT = 1400;

export function PaperWorkspaceShell({
  assistant,
  assistantOpen,
  exploration,
  library,
  libraryOpen,
  onCloseAssistant,
  onCloseLibrary,
  onToggleAssistant,
  onToggleLibrary,
  organizing,
  paper,
  paperIdentity,
  presentation,
  style,
}: PaperWorkspaceShellProps) {
  const reduceMotion = useReducedMotion();
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const retreatRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const paperIdentityRef = useRef(paperIdentity);
  const explorePlan = useExploreStage({
    items: exploration.items,
    mounted: exploration.mounted,
    paperRef: retreatRef,
  });
  const exploreStars = shouldRenderExploreStars({
    plan: explorePlan,
    reducedMotion: Boolean(reduceMotion),
  });
  const shouldOverlayPanels = () => window.innerWidth < PANEL_BREAKPOINT || (
    libraryOpen && assistantOpen && window.innerWidth < DUAL_PANEL_SAFE_BREAKPOINT
  );
  const [overlayPanels, setOverlayPanels] = useState(shouldOverlayPanels);
  const anyPanelOpen = libraryOpen || assistantOpen;

  useEffect(() => {
    const handleResize = () => {
      setOverlayPanels(shouldOverlayPanels());
      if (
        window.innerWidth < PANEL_BREAKPOINT &&
        libraryOpen &&
        assistantOpen
      ) {
        onCloseAssistant();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [assistantOpen, libraryOpen, onCloseAssistant]);

  // 探索态期间纸是冻结的: 不滚动，几何才守得住量好的那一次。
  // 下钻换了笔记但滚动位置还留在上一篇，因此把归零推迟到退场之后再补。
  useEffect(() => {
    if (exploration.mounted || paperIdentityRef.current === paperIdentity) {
      return;
    }
    paperIdentityRef.current = paperIdentity;
    paperScrollRef.current?.scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: 0,
    });
  }, [exploration.mounted, paperIdentity, reduceMotion]);

  // Escape 走统一消散协议并 preventDefault，壳层守卫据此让行——
  // 否则一次 Escape 会同时收起探索态和 Panel，而 Panel 是条件渲染，误关等于草稿销毁。
  // shellRef 取整个工作台: 探索态里「点外部」没有意义（浮层铺满视口），
  // 点空白由舞台自己解释，这里只要 Escape 那一半。
  useDismissable({
    onDismiss: exploration.dismiss,
    open: exploration.mounted,
    shellRef: workspaceRef,
  });

  useEffect(() => {
    if (!anyPanelOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      // ---- Escape 层级仲裁 ----
      // 壳层是 Escape 的最后一级接收者, 内层 (弹窗/菜单/@候选/原地重命名/
      // 搜索框) 一旦已经消费掉这次 Escape, 壳层必须让行。
      // preventDefault 只阻止浏览器默认行为, 不阻止事件继续冒泡到 window,
      // 所以这里必须显式检查 defaultPrevented —— 否则一次 Escape 被两层
      // 同时消费, Panel 是条件渲染 (卸载), 误关等于草稿销毁。
      if (event.defaultPrevented) {
        return;
      }

      // 焦点在可编辑元素内时, Escape 属于该编辑上下文, 不是关闭 Panel 的信号。
      const active = document.activeElement;
      if (active instanceof HTMLElement && (
        active.isContentEditable ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      )) {
        return;
      }

      event.preventDefault();
      if (assistantOpen) {
        onCloseAssistant();
      } else {
        onCloseLibrary();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anyPanelOpen, assistantOpen, onCloseAssistant, onCloseLibrary]);

  const closeOverlay = () => {
    if (assistantOpen) {
      onCloseAssistant();
    }
    if (libraryOpen) {
      onCloseLibrary();
    }
  };

  const handleStagePointerDown = (event: MouseEvent<HTMLDivElement>) => {
    // 探索态里两侧 Panel 已经平移出画面，此时的点击属于舞台，不得改写用户的开关偏好
    if (exploration.mounted || !anyPanelOpen || !(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest([
      ".paper-surface",
      ".workspace-floating-panel",
      ".workspace-stage-control",
      ".memo-context-menu",
      ".ds-dialog-panel",
      ".ds-toast",
    ].join(",")) !== null) {
      return;
    }

    closeOverlay();
  };

  const archiveTargetNodeId = resolveArchiveTargetNodeId(presentation);
  const archiveCordVisible = shouldShowArchiveCord({
    libraryOpen,
    overlayPanels,
    presentation,
  });
  const archiveRefreshKey = [
    presentation?.runId ?? "none",
    presentation?.status ?? "none",
    archiveTargetNodeId ?? "none",
    libraryOpen ? "library" : "closed",
  ].join(":");

  return (
    <ArchiveCordStage
      active={archiveCordVisible}
      refreshKey={archiveRefreshKey}
    >
      <div
        className="app-workspace"
        data-assistant-open={assistantOpen}
        data-exploring={exploration.mounted}
        data-library-open={libraryOpen}
        data-overlay-panels={overlayPanels}
        onMouseDown={handleStagePointerDown}
        ref={workspaceRef}
        style={style}
      >
        <AnimatePresence initial={false}>
          {!libraryOpen && !exploration.mounted ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="workspace-stage-control workspace-library-control"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="workspace-library-trigger"
              transition={fadeTransition}
            >
              <EdgeDock
                icon={<SidebarSimpleIcon size={16} />}
                label="文件库"
                onClick={onToggleLibrary}
                side="left"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!assistantOpen && !exploration.mounted ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="workspace-stage-control workspace-assistant-control"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key="workspace-assistant-trigger"
              transition={fadeTransition}
            >
              <EdgeDock
                icon={<AssistantPanelOpenIcon size={16} />}
                label="AI"
                onClick={onToggleAssistant}
                side="right"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {libraryOpen ? (
            <motion.div
              animate={{
                opacity: exploration.mounted ? 0 : 1,
                transition: reduceMotion ? fadeTransition : panelEnterTransition,
                x: exploration.mounted && !reduceMotion ? "-116%" : 0,
              }}
              className="app-sidebar-shell workspace-floating-panel"
              exit={{
                opacity: 0,
                transition: reduceMotion ? fadeTransition : panelExitTransition,
                x: reduceMotion ? 0 : -12,
              }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : -12 }}
              inert={exploration.mounted}
              key="workspace-library"
            >
              <div className="workspace-panel-content workspace-panel-content-library">
                {library}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="paper-stage-scroll" ref={paperScrollRef}>
          <motion.div
            className="paper-stage-layout"
            layout="position"
            transition={workspaceLayoutTransition}
          >
            <PaperRetreat
              exploring={exploration.mounted}
              plan={explorePlan}
              ref={retreatRef}
              retreated={exploreStars && exploration.active}
            >
              <PaperSurface
                archiveActive={archiveCordVisible}
                archiveDrawKey={`${presentation?.runId ?? "none"}-${presentation?.status ?? "none"}`}
                archiveSourceId="workspace"
                archiveTargetNodeId={archiveTargetNodeId}
                organizing={organizing}
                paperIdentity={paperIdentity}
                reducedMotion={Boolean(reduceMotion)}
              >
                {paper}
              </PaperSurface>
            </PaperRetreat>
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          {assistantOpen ? (
            <motion.div
              animate={{
                opacity: exploration.mounted ? 0 : 1,
                transition: reduceMotion ? fadeTransition : panelEnterTransition,
                x: exploration.mounted && !reduceMotion ? "116%" : 0,
              }}
              className="app-agent-shell workspace-floating-panel"
              exit={{
                opacity: 0,
                transition: reduceMotion ? fadeTransition : panelExitTransition,
                x: reduceMotion ? 0 : 12,
              }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }}
              inert={exploration.mounted}
              key="workspace-assistant"
            >
              <div className="workspace-panel-content workspace-panel-content-assistant">
                {assistant}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {exploration.mounted ? (
          <ExploreStage exploration={exploration} plan={explorePlan} stars={exploreStars} />
        ) : null}

        <AnimatePresence initial={false}>
          {overlayPanels && anyPanelOpen && !exploration.mounted ? (
            <motion.button
              animate={{ opacity: 1 }}
              aria-label="关闭浮动工具"
              className="workspace-panel-backdrop"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={closeOverlay}
              transition={fadeTransition}
              type="button"
            />
          ) : null}
        </AnimatePresence>
      </div>
    </ArchiveCordStage>
  );
}
