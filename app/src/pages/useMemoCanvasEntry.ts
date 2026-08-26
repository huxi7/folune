/**
 * [INPUT]: 依赖 React state、React Router navigate、Canvas 默认入口 API、memoTreeStore merge 与 Toast
 * [OUTPUT]: 对外提供 useMemoCanvasEntry，在 memo 草稿 required flush 后幂等进入唯一默认 Canvas
 * [POS]: pages 的 memo→Canvas 路由协调器；创建/复用结果只局部并入目录，绝不刷新整树或触发 AI
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { getOrCreateMemoCanvas } from "../shared/api/canvas";
import type { MemoTreeNode } from "../shared/api/memo";
import type { ToastInput } from "../shared/design-system/components";

type UseMemoCanvasEntryInput = {
  accessToken: string;
  mergeServerNode: (node: MemoTreeNode) => void;
  navigate: NavigateFunction;
  prepare: () => Promise<void>;
  toast: (input: ToastInput) => void;
};

export function useMemoCanvasEntry({
  accessToken,
  mergeServerNode,
  navigate,
  prepare,
  toast,
}: UseMemoCanvasEntryInput) {
  const [enteringCanvas, setEnteringCanvas] = useState(false);

  const enterCanvas = async (memoId: string | null) => {
    if (memoId === null || enteringCanvas) return;
    setEnteringCanvas(true);
    try {
      await prepare();
      const entry = await getOrCreateMemoCanvas(accessToken, memoId);
      mergeServerNode(entry.node);
      navigate(`/app/notes/${encodeURIComponent(entry.canvas.node_id)}`);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "Canvas 打开失败",
        variant: "error",
      });
    } finally {
      setEnteringCanvas(false);
    }
  };

  return { enteringCanvas, enterCanvas };
}
