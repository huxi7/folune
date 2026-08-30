/**
 * [INPUT]: 依赖 motion/react、工作台统一 Motion、ArchivePort 与稳定 paperIdentity/编辑器内容
 * [OUTPUT]: 对外提供 816px Paper Surface、无退出等待的即时内容切换与左侧 Archive Port
 * [POS]: app/src/widgets 的 Paper First Signature 纸面层；只拥有纸的视觉边界，NotesWorkspace 编辑会话仍由 Dashboard 以 memoClientKey 保持稳定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "motion/react";
import type { ReactNode } from "react";

import {
  fadeTransition,
  workspaceLayoutTransition,
} from "../pages/workspaceMotion";
import { ArchivePort } from "./ArchiveCord";

type PaperSurfaceProps = {
  archiveActive: boolean;
  archiveDrawKey: string;
  archiveSourceId: string;
  archiveTargetNodeId: string | null;
  children: ReactNode;
  organizing: boolean;
  paperIdentity: string;
  reducedMotion: boolean;
};

export function PaperSurface({
  archiveActive,
  archiveDrawKey,
  archiveSourceId,
  archiveTargetNodeId,
  children,
  organizing,
  paperIdentity,
  reducedMotion,
}: PaperSurfaceProps) {
  return (
    <motion.section
      className="app-main-panel paper-surface"
      data-organizing={organizing}
      layout="position"
      transition={workspaceLayoutTransition}
    >
      <ArchivePort
        active={archiveActive}
        drawKey={archiveDrawKey}
        reducedMotion={reducedMotion}
        sourceId={archiveSourceId}
        targetNodeId={archiveTargetNodeId}
      />
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="paper-content-transition"
        initial={{ opacity: reducedMotion ? 1 : 0.82, y: reducedMotion ? 0 : 2 }}
        key={paperIdentity}
        transition={reducedMotion ? { duration: 0.01 } : fadeTransition}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
