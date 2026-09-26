/**
 * [INPUT]: 依赖 React Router 已提交位置、navigate、Memo Store 的稳定身份与当前节点、浏览器帧调度
 * [OUTPUT]: 对外提供即时文件树选择、每帧至多一次的最新正文导航、创建身份对账与取消入口
 * [POS]: Dashboard 的选择意图边界；树高亮先响应点击，正文路由保持可中断，不强制同步挂载编辑器；网络回包只能修正当前意图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType, type NavigateFunction, type NavigateOptions } from "react-router-dom";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";

type Selection = {
  nodeId: string | null;
  originKey: string;
  options: NavigateOptions;
  dispatched: boolean;
};
const pathFor = (id: string | null) => id === null ? "/app" : `/app/notes/${encodeURIComponent(id)}`;
const sameNode = (left: string | null, right: string | null) => {
  const { getMemoClientKey } = useMemoTreeStore.getState();
  return left === null || right === null ? left === right : getMemoClientKey(left) === getMemoClientKey(right);
};

export function useMemoSelection(routeMemoId: string | null, navigate: NavigateFunction) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const routeRef = useRef({ nodeId: routeMemoId, key: location.key });
  const pendingRef = useRef<Selection | null>(null);
  const frameRef = useRef<number | null>(null);
  const dispatchedPathsRef = useRef(new Set<string>());
  const [pending, setPending] = useState<Selection | null>(null);

  const cancelSelection = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingRef.current = null;
    dispatchedPathsRef.current.clear();
    setPending(null);
  }, []);

  useLayoutEffect(() => {
    routeRef.current = { nodeId: routeMemoId, key: location.key };
    const intent = pendingRef.current;
    if (intent === null || location.key === intent.originKey) return;
    // 最新目标到达才交还路由；旧过渡提交不能夺走新高亮，外部导航则取消待执行选择。
    const resolvedId = intent.nodeId === null ? null : useMemoTreeStore.getState().resolveMemoId(intent.nodeId);
    if (navigationType === "POP" || location.pathname === pathFor(resolvedId)
      || !dispatchedPathsRef.current.has(location.pathname)) cancelSelection();
  }, [routeMemoId, location.key, location.pathname, navigationType, cancelSelection]);

  const selectMemo = useCallback((nodeId: string | null, options: NavigateOptions = {}) => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    const intent: Selection = { nodeId, options, originKey: routeRef.current.key, dispatched: false };
    pendingRef.current = intent;
    setPending(intent);
    // 不设点击节流：每次创建都立即进入树，只有同一帧内的正文导航合并到最新目标。
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingRef.current !== intent) return;
      const store = useMemoTreeStore.getState();
      const resolvedId = intent.nodeId === null ? null : store.resolveMemoId(intent.nodeId);
      if (resolvedId !== null && findNode(store.nodes, resolvedId) === null) {
        cancelSelection();
        return;
      }
      intent.dispatched = true;
      const path = pathFor(resolvedId);
      dispatchedPathsRef.current.add(path);
      void navigate(path, intent.options);
    });
  }, [navigate, cancelSelection]);

  const reconcileSelection = useCallback((optimisticId: string, replacementId: string | null) => {
    const intent = pendingRef.current;
    const selectedId = intent === null ? routeRef.current.nodeId : intent.nodeId;
    if (!sameNode(selectedId, optimisticId)) return false;
    // 尚未导航的新建保留 push 语义；已打开的临时地址只原位 replace。
    selectMemo(replacementId, intent !== null && !intent.dispatched ? intent.options : { replace: true });
    return true;
  }, [selectMemo]);

  useLayoutEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  return { selectedMemoId: pending === null ? routeMemoId : pending.nodeId, selectMemo, reconcileSelection, cancelSelection };
}
