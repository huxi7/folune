/**
 * [INPUT]: 依赖 motion/react、纸面名字、工作台统一 Motion、ArchivePort 与稳定 paperIdentity/编辑器内容；路由纸面过渡期间由 CSS 接管内层入场
 * [OUTPUT]: 对外提供纸壳与纸内正文各自命名的 816px Paper Surface、常规即时内容切换与不叠加路由动画的左侧 Archive Port
 * [POS]: app/src/widgets 的 Paper First Signature 纸面层；只拥有纸的视觉边界，NotesWorkspace 编辑会话仍由 Dashboard 以 memoClientKey 保持稳定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "motion/react";
import type { ReactNode } from "react";

import {
  fadeTransition,
  workspaceLayoutTransition,
} from "../pages/workspaceMotion";
import {
  paperBodyViewTransitionName,
  paperViewTransitionName,
} from "../pages/viewTransition";
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
  paperTransitionIdentity?: string | null;
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
  paperTransitionIdentity = null,
}: PaperSurfaceProps) {
  return (
    <motion.section
      className="app-main-panel paper-surface"
      data-organizing={organizing}
      layout="position"
      /*
       * 与 Canvas 卡片、Preview 共用同一个纸面名字: 三处永不同时存在, 因此浏览器把它们
       * 认成同一张纸, 笔记↔画布、预览↔写作区的放大缩小都由它自己完成。
       */
      style={paperTransitionIdentity === null
        ? undefined
        : { viewTransitionName: paperViewTransitionName(paperTransitionIdentity) }}
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
        /*
         * 正文与纸壳分开命名: 纸壳被拉伸看不出来, 字被拉伸就是"字在膨胀"。分开之后
         * 正文按原始尺寸淡换, 由纸壳的取景框裁切, 纸长大只是露出更多正文。
         */
        style={paperTransitionIdentity === null
          ? undefined
          : {
            viewTransitionName: paperBodyViewTransitionName(
              paperTransitionIdentity,
            ),
          }}
        transition={reducedMotion ? { duration: 0.01 } : fadeTransition}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
