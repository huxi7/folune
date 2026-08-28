/**
 * [INPUT]: 依赖 Canvas V2 空白入口、memoTreeStore 服务端节点合并、React Router 导航、canvasChromeStore 进入意图与全局 Toast
 * [OUTPUT]: 对外提供带重复提交门禁的独立 Canvas 创建命令
 * [POS]: AppDashboard 的跨域创建编排 Hook；服务器事务成功后才把同一 Canvas 身份并入树并切换路由
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { createStandaloneCanvas } from "../shared/api/canvas";
import type { ToastInput } from "../shared/design-system/components";
import { useCanvasChromeStore } from "../shared/store/canvasChromeStore";
import type { useMemoTreeStore } from "../shared/store/memoTreeStore";

type UseStandaloneCanvasCreationInput = {
  accessToken: string;
  mergeServerNode: ReturnType<typeof useMemoTreeStore.getState>["mergeServerNode"];
  navigate: NavigateFunction;
  toast: (input: ToastInput) => void;
};

export function useStandaloneCanvasCreation({
  accessToken,
  mergeServerNode,
  navigate,
  toast,
}: UseStandaloneCanvasCreationInput) {
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const rememberEntry = useCanvasChromeStore((state) => state.rememberEntry);
  const createCanvas = useCallback(async (parentId: string | null) => {
    if (creatingCanvas) return;
    setCreatingCanvas(true);
    try {
      const result = await createStandaloneCanvas(accessToken, {
        parent_id: parentId,
        title: "未命名 Canvas",
      });
      mergeServerNode(result.node);
      // 新对象需要文件树定位与即时命名反馈, 因此只展开文件库
      rememberEntry({ canvasId: result.node.id, intent: "standalone" });
      navigate(`/app/notes/${encodeURIComponent(result.node.id)}`);
      toast({ title: "Canvas 已创建", variant: "success" });
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "Canvas 创建失败",
        variant: "error",
      });
    } finally {
      setCreatingCanvas(false);
    }
  }, [accessToken, creatingCanvas, mergeServerNode, navigate, rememberEntry, toast]);

  return { createCanvas, creatingCanvas };
}
