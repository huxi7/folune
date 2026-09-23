/**
 * [INPUT]: 依赖 React Context、index.html 的 pre-paint 根状态、浏览器 localStorage 与 prefers-color-scheme 媒体查询
 * [OUTPUT]: 对外提供 system/light/dark 用户偏好、解析后的 light/dark 主题、ThemeProvider、useTheme 及主题类型守卫
 * [POS]: app/src/shared/theme 的全局主题状态入口，统一解析并同步 html.dark，被 AccountSettingsPanel、Markdown 编辑器与产品工作区消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<Theme, "system">;

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  theme: Theme;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "folune-theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function isTheme(value: string): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

function readStoredValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 主题仍然可以在当前会话工作；持久化不可用时保持静默降级。
  }
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function getInitialTheme(): Theme {
  const storedTheme = readStoredValue(THEME_STORAGE_KEY);

  if (storedTheme && isTheme(storedTheme)) {
    return storedTheme;
  }

  return "system";
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme),
  );

  useLayoutEffect(() => {
    persistValue(THEME_STORAGE_KEY, theme);

    const systemTheme = window.matchMedia(SYSTEM_THEME_QUERY);
    const syncResolvedTheme = () => {
      const nextResolvedTheme =
        theme === "system"
          ? systemTheme.matches
            ? "dark"
            : "light"
          : theme;

      applyTheme(nextResolvedTheme);
      setResolvedTheme(nextResolvedTheme);
    };

    syncResolvedTheme();

    if (theme !== "system") {
      return;
    }

    systemTheme.addEventListener("change", syncResolvedTheme);

    return () => {
      systemTheme.removeEventListener("change", syncResolvedTheme);
    };
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    const nextResolvedTheme = resolveTheme(nextTheme);

    applyTheme(nextResolvedTheme);
    setResolvedTheme(nextResolvedTheme);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ resolvedTheme, setTheme, theme, toggleTheme }),
    [resolvedTheme, setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme 必须在 ThemeProvider 内使用。");
  }

  return context;
}
