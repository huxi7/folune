/**
 * [INPUT]: 依赖 React state、React Router navigate、Canvas 默认入口/detail API、一次性 bootstrap、memoTreeStore merge、canvasChromeStore/workspaceChromeStore 与 Toast
 * [OUTPUT]: 对外提供 useMemoCanvasEntry，在草稿 required flush 后准备完整 detail，并以 to-canvas 方向进入或返回 Canvas；新鲜离场快照命中时不重复等待网络
 * [POS]: pages 的 memo→Canvas 路由协调器；等待期间保留原 Paper，detail 在路由首帧直接成为目标卡片并交给 Coordinator 一次消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { getCanvas, getOrCreateMemoCanvas } from "../shared/api/canvas";
import type { MemoTreeNode } from "../shared/api/memo";
import type { ToastInput } from "../shared/design-system/components";
import { useCanvasChromeStore } from "../shared/store/canvasChromeStore";
import {
  peekCanvasEntryBootstrap,
  storeCanvasEntryBootstrap,
} from "./canvasEntryBootstrap";
import { navigateWithPaperTransition } from "./viewTransition";

type UseMemoCanvasEntryInput = {
  accessToken: string;
  mergeServerNode: (node: MemoTreeNode) => void;
  navigate: NavigateFunction;
  prepare: () => Promise<void>;
  toast: (input: ToastInput) => void;
  userId: string;
};

export function useMemoCanvasEntry({
  accessToken,
  mergeServerNode,
  navigate,
  prepare,
  toast,
  userId,
}: UseMemoCanvasEntryInput) {
  const [enteringCanvas, setEnteringCanvas] = useState(false);
  const rememberEntry = useCanvasChromeStore((state) => state.rememberEntry);

  const enterCanvas = async (memoId: string | null) => {
    if (memoId === null || enteringCanvas) return;
    setEnteringCanvas(true);
    try {
      await prepare();
      const entry = await getOrCreateMemoCanvas(accessToken, memoId);
      const detail = await getCanvas(accessToken, entry.canvas.node_id);
      mergeServerNode(entry.node);
      storeCanvasEntryBootstrap({
        canvasId: entry.canvas.node_id,
        detail,
        sourceMemoId: memoId,
        userId,
      });
      // 只切换中央内容，左右工具继承导航时的可见状态。
      rememberEntry({ canvasId: entry.canvas.node_id, intent: "memo_default", inherited: useWorkspaceChromeStore.getState() });
      await navigateWithPaperTransition(
        navigate,
        `/app/notes/${encodeURIComponent(entry.canvas.node_id)}`,
        "to-canvas",
      );
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

  /*
   * 返回画布走的是同一条纸张通道, 不是一次普通跳转: 离开的这篇笔记在目标画布上就是
   * 那张源卡片, 因此用 memoId 作 identity 让写作区的纸飞回卡片位, 与进入时完全对称。
   */
  const returnCanvas = async (canvasId: string, memoId: string | null) => {
    await prepare();
    /*
     * 返回也必须先把 detail 取回来再走。否则画布要等路由挂载后自己再请求一次, 那段
     * 时间里卡片还不在 DOM 里, 视图过渡拿不到落点的那张纸, 就只剩整页交叉淡换。预取之后
     * 卡片第一帧就在, 浏览器才认得出「这是同一张纸」。取不到也照样返回, 只是没有形变。
     */
    if (
      memoId !== null
      && peekCanvasEntryBootstrap(canvasId, userId) === null
    ) {
      try {
        const detail = await getCanvas(accessToken, canvasId);
        storeCanvasEntryBootstrap({
          canvasId,
          detail,
          sourceMemoId: memoId,
          userId,
        });
      } catch {
        // 预取失败不阻断返回, 只是这一趟画布要自己再请求一次
      }
    }
    await navigateWithPaperTransition(
      navigate,
      `/app/notes/${encodeURIComponent(canvasId)}`,
      "to-canvas",
    );
  };

  return { enteringCanvas, enterCanvas, returnCanvas };
}
