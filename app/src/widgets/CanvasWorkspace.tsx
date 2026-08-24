/**
 * [INPUT]: 依赖 react lazy/Suspense、KnowledgeCanvas、shared/design-system 的 ArrowLeftIcon 与既有 Quiet Editorial token
 * [OUTPUT]: 对外提供脱离 Paper/左右 Panel 的全屏 CanvasWorkspace，并保留返回笔记与画布标题入口
 * [POS]: app/src/widgets 的已保存画布空间壳；它与 PaperWorkspaceShell 是两种互斥工作语境，负责给 React Flow 确定的视口尺寸，数据读取与画布交互仍归 KnowledgeCanvas
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { lazy, Suspense } from "react";

import { ArrowLeftIcon } from "../shared/design-system/icons";

const KnowledgeCanvas = lazy(() =>
  import("./KnowledgeCanvas").then((module) => ({
    default: module.KnowledgeCanvas,
  })),
);

type CanvasWorkspaceProps = {
  accessToken: string;
  canvasId: string;
  onExit: () => void;
  onSelectMemo: (nodeId: string) => void;
  title: string;
};

export function CanvasWorkspace({
  accessToken,
  canvasId,
  onExit,
  onSelectMemo,
  title,
}: CanvasWorkspaceProps) {
  return (
    <main
      aria-label={`知识画布：${title}`}
      className="canvas-workspace"
    >
      <div className="canvas-workspace-nav">
        <button
          aria-label="返回笔记"
          className="canvas-workspace-back"
          onClick={onExit}
          type="button"
        >
          <ArrowLeftIcon size={16} />
        </button>
        <div className="canvas-workspace-heading">
          <span>知识画布</span>
          <strong title={title}>{title}</strong>
        </div>
      </div>

      <Suspense
        fallback={(
          <div className="canvas-workspace-loading" role="status">
            正在展开画布…
          </div>
        )}
      >
        <KnowledgeCanvas
          accessToken={accessToken}
          canvasId={canvasId}
          onSelectMemo={onSelectMemo}
        />
      </Suspense>
    </main>
  );
}
