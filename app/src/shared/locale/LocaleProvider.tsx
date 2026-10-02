/**
 * [INPUT]: 依赖纯 LocaleContext/语言格式化、documentLocale 场景策略与浏览器 localStorage/storage 事件
 * [OUTPUT]: 对外提供 LocaleProvider，恢复、保存并跨窗口同步语言偏好，同时维护文档语言
 * [POS]: locale 的浏览器装配边界，只由正式入口与状态测试导入；展示组件与独立 Demo 不依赖持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LocaleContext, isLocale, localizedValues, type Locale } from "./index";
import { applyDocumentLocale } from "./documentLocale";

const LOCALE_STORAGE_KEY = "folune-locale";

function readLocale(): Locale {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale);
  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // 存储不可用时，语言仍在本次会话中正常切换。
    }
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.locale = locale;
    applyDocumentLocale();
  }, [locale]);

  useEffect(() => {
    const syncLocale = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY && event.key !== null) return;
      if (event.newValue === null) setLocaleState(DEFAULT_LOCALE);
      else if (isLocale(event.newValue)) setLocaleState(event.newValue);
    };
    window.addEventListener("storage", syncLocale);
    return () => window.removeEventListener("storage", syncLocale);
  }, []);

  const value = useMemo(() => ({ ...localizedValues(locale), setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
