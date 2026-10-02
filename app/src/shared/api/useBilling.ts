/**
 * [INPUT]: 依赖 React 账户级 Context、统一 billing HTTP 边界及浏览器可见性事件
 * [OUTPUT]: 对外提供 BillingProvider/useBilling，将套餐、真实用量、刷新和错误收口为同一个内存快照
 * [POS]: shared/api 的订阅读取生命周期；挂载在 Dashboard 的用户边界，退出即销毁，不把跨账户数据放进全局缓存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getBillingCatalog, getBillingOverview, type BillingCatalog, type BillingOverview } from "./subscription";

type BillingState = {
  catalog: BillingCatalog | null;
  overview: BillingOverview | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};
const initialState: BillingState = { catalog: null, overview: null, loading: true, refreshing: false, error: null };
const BillingContext = createContext<BillingState & { refresh: () => Promise<void> }>({ ...initialState, refresh: async () => {} });
const REFRESH_AFTER_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;

export function BillingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const inFlight = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadedAt = useRef(0);
  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setState(current => ({ ...current, loading: current.overview === null, refreshing: current.overview !== null, error: null }));
    const pending = Promise.all([getBillingCatalog(controller.signal), getBillingOverview(controller.signal)])
      .then(([catalog, overview]) => {
        if (abortRef.current !== controller) return;
        loadedAt.current = Date.now();
        setState({ catalog, overview, loading: false, refreshing: false, error: null });
      })
      .catch(() => {
        if (abortRef.current === controller) setState(current => ({ ...current, loading: false, refreshing: false, error: "暂时无法读取订阅信息，请稍后重试。" }));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (inFlight.current === pending) inFlight.current = null;
      });
    inFlight.current = pending;
    return pending;
  }, []);

  useEffect(() => {
    void refresh();
    const refreshVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > REFRESH_AFTER_MS) void refresh();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      const controller = abortRef.current;
      abortRef.current = null;
      inFlight.current = null;
      controller?.abort();
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh]);
  return createElement(BillingContext.Provider, { value: { ...state, refresh } }, children);
}

export const useBilling = () => useContext(BillingContext);
