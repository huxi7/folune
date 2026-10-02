/**
 * [INPUT]: 依赖 motion/react、仅文件库 EdgeDock/PaperSurface、稳定 paperIdentity/纸面过渡身份；左右工具与 fixed 归档 Overlay 由外部持久宿主承载
 * [OUTPUT]: 对外提供 Paper First 共享 Workspace Chrome、遮罩布局的消费与 Escape 收束，并只保留文件库的开关语义
 * [POS]: widgets 的写作工作台空间壳；Canvas 已成为独立持久 Workspace，旧临时探索舞台不再进入生产壳。响应式判据不在此处再算一遍——它由 Dashboard 的 useOverlayPanels 持有并下传，壳只消费；同一个断点算两遍就会出现两个都自称正确的布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  SidebarSimpleIcon,
} from "../shared/design-system/icons";
import {
  fadeTransition,
  reducedFadeTransition,
  workspaceLayoutTransition,
} from "../pages/workspaceMotion";
import { EdgeDock } from "./EdgeDock";
import { PaperSurface } from "./PaperSurface";

type PaperWorkspaceShellProps = {
  assistantOpen: boolean;
  /** 单 Panel 已无法并列：抽屉 + 遮罩。判据由 Dashboard 唯一持有 */
  compactViewport: boolean;
  libraryOpen: boolean;
  onCloseAssistant: () => void;
  onCloseLibrary: () => void;
  onToggleLibrary: () => void;
  organizing: boolean;
  /** 覆盖式布局（compact，或双开且宽度不足）。同样只由 Dashboard 计算 */
  overlayPanels: boolean;
  paper: ReactNode;
  paperIdentity: string;
  paperTransitionIdentity?: string | null;
  style: CSSProperties;
};

export function PaperWorkspaceShell({
  assistantOpen,
  compactViewport,
  libraryOpen,
  onCloseAssistant,
  onCloseLibrary,
  onToggleLibrary,
  organizing,
  overlayPanels,
  paper,
  paperIdentity,
  paperTransitionIdentity = null,
  style,
}: PaperWorkspaceShellProps) {
  const reduceMotion = useReducedMotion();
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const paperIdentityRef = useRef(paperIdentity);
  const anyPanelOpen = libraryOpen || assistantOpen;

  // 窄到放不下并列的两块面板时，右侧 AI 让位：这是对已下传判据的反应，不是第二次测量
  useEffect(() => {
    if (compactViewport && libraryOpen && assistantOpen) onCloseAssistant();
  }, [assistantOpen, compactViewport, libraryOpen, onCloseAssistant]);

  useEffect(() => {
    if (paperIdentityRef.current === paperIdentity) return;
    paperIdentityRef.current = paperIdentity;
    paperScrollRef.current?.scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: 0,
    });
  }, [paperIdentity, reduceMotion]);

  useEffect(() => {
    if (!anyPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && (
        active.isContentEditable
        || active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
      )) {
        return;
      }
      event.preventDefault();
      if (assistantOpen) onCloseAssistant();
      else onCloseLibrary();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anyPanelOpen, assistantOpen, onCloseAssistant, onCloseLibrary]);

  const closeOverlay = () => {
    if (assistantOpen) onCloseAssistant();
    if (libraryOpen) onCloseLibrary();
  };

  const handleStagePointerDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!anyPanelOpen || !(event.target instanceof Element)) return;
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
    if (libraryOpen) onCloseLibrary();
  };

  return (
      <div
        className="app-workspace"
        data-assistant-open={assistantOpen}
        data-library-open={libraryOpen}
        data-overlay-panels={overlayPanels}
        onMouseDown={handleStagePointerDown}
        ref={workspaceRef}
        style={style}
      >
        <AnimatePresence initial={false}>
          {!libraryOpen ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="workspace-stage-control workspace-library-control"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={reduceMotion ? reducedFadeTransition : fadeTransition}
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

        <div className="paper-stage-scroll" ref={paperScrollRef}>
          <motion.div
            className="paper-stage-layout"
            layout="position"
            transition={workspaceLayoutTransition}
          >
            <PaperSurface
              organizing={organizing}
              paperIdentity={paperIdentity}
              reducedMotion={Boolean(reduceMotion)}
              paperTransitionIdentity={paperTransitionIdentity}
            >
              {paper}
            </PaperSurface>
          </motion.div>
        </div>


        <AnimatePresence initial={false}>
          {overlayPanels && libraryOpen ? (
            <motion.button
              animate={{ opacity: 1 }}
              aria-label="关闭浮动工具"
              className="workspace-panel-backdrop"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={closeOverlay}
              transition={reduceMotion ? reducedFadeTransition : fadeTransition}
              type="button"
            />
          ) : null}
        </AnimatePresence>
      </div>
  );
}
