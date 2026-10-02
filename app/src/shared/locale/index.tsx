/**
 * [INPUT]: 依赖 React Context 与 Intl 原生格式化能力，不依赖浏览器存储或文档状态
 * [OUTPUT]: 对外提供 Locale、LocaleContext、useLocale、默认语言及格式化/类型守卫；统一文案、日期和数字读取
 * [POS]: locale 的纯消费入口；正式 APP 读取 Provider 的偏好，独立 Demo 使用静态中文默认值，持久化归 LocaleProvider
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createContext, useContext } from "react";

export type Locale = "zh-CN" | "en";
export const DEFAULT_LOCALE: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en";
}

export function localizedValues(locale: Locale) {
  return {
    locale,
    t: (chinese: string, english: string) => locale === "en" ? english : chinese,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isFinite(date.getTime())) return "—";
      return new Intl.DateTimeFormat(locale, options ?? {
        year: "numeric", month: "long", day: "numeric",
      }).format(date);
    },
  };
}

type LocaleContextValue = ReturnType<typeof localizedValues> & {
  setLocale: (locale: Locale) => void;
};

export const LocaleContext = createContext<LocaleContextValue>({
  ...localizedValues(DEFAULT_LOCALE),
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}
