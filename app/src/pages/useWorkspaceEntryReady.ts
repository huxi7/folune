/**
 * [INPUT]: 依赖首屏内容加载状态、React Router 导航状态与入口进度 Store
 * [OUTPUT]: 首屏提交并经过两帧后报告 content 节点；错误立即释放品牌层让既有错误反馈可见
 * [POS]: pages 的一次性首屏就绪桥梁；Paper 与 Canvas 共用，不参与业务请求或后续文件切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect } from "react";
import { useNavigation } from "react-router-dom";
import { useWorkspaceEntryStore } from "../shared/store/workspaceEntryStore";

export function useWorkspaceEntryReady(entryId: number, status: "loading" | "ready" | "error") {
  const navigation = useNavigation();
  useEffect(() => {
    const entry = useWorkspaceEntryStore.getState();
    if (entry.id !== entryId || entry.phase !== "loading") return;
    if (status === "error") {
      entry.dismiss(entryId);
      return;
    }
    if (status !== "ready" || navigation.state !== "idle") return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        useWorkspaceEntryStore.getState().finishStep(entryId, "content");
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [entryId, navigation.state, status]);
}
