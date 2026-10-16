/**
 * [INPUT]: 依赖 applyVisualContext、HTML 首绘脚本、node:vm 与 Bun test
 * [OUTPUT]: 验证工作区/独立 Design System 的首绘与运行期一致，往返恢复主题、存储失效隔离 APP、Demo 独立启用新视觉
 * [POS]: theme 的场景回归门禁；保护路由切换及根级 Portal 继承边界，不把业务路由挂载到测试中
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { applyThemeAppearance, applyVisualContext } from "./visualContext";

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!bootstrap) throw new Error("缺少首绘主题脚本");

function rootFixture() {
  const classes = new Set<string>();
  return {
    dataset: {} as Record<string, string>,
    classList: {
      toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
      remove: (name: string) => classes.delete(name),
      contains: (name: string) => classes.has(name),
    },
  };
}

describe("APP 文档根视觉作用域", () => {
  const paths = [
    { pathname: "/app", app: true },
    { pathname: "/app/", app: true },
    { pathname: "/app/notes/123", app: true },
    { pathname: "/design-system", app: true },
    { pathname: "/design-system/", app: true },
    { pathname: "/", app: false },
    { pathname: "/login", app: false },
    { pathname: "/blog/a", app: false },
    { pathname: "/updates", app: false },
    { pathname: "/application", app: false },
    { pathname: "/design-system-preview", app: false },
  ];
  for (const { pathname, app } of paths) {
    test(`${pathname} 首绘与运行期保持一致`, () => {
      const initial = rootFixture();
      runInNewContext(bootstrap!, {
        document: { documentElement: initial },
        window: { location: { pathname }, localStorage: { getItem: () => "dark" }, matchMedia: () => ({ matches: false }) },
      });
      const runtime = rootFixture();
      runtime.dataset.resolvedTheme = "dark";
      applyVisualContext(pathname, runtime as unknown as HTMLElement);
      expect(runtime.classList.contains("dark")).toBe(initial.classList.contains("dark"));
      expect(runtime.classList.contains("dark")).toBe(app);
      expect(runtime.dataset.visualContext).toBe(initial.dataset.visualContext);
      expect(runtime.dataset.visualContext).toBe(app ? "app" : "marketing");
    });
  }

  test("Design System 首绘遵循主题偏好，Portal 共用文档根场景", () => {
    for (const { storedTheme, prefersDark, dark } of [
      { storedTheme: "light", prefersDark: true, dark: false },
      { storedTheme: "dark", prefersDark: false, dark: true },
      { storedTheme: "system", prefersDark: true, dark: true },
      { storedTheme: "system", prefersDark: false, dark: false },
    ]) {
      const root = rootFixture();
      runInNewContext(bootstrap!, {
        document: { documentElement: root },
        window: {
          location: { pathname: "/design-system" },
          localStorage: { getItem: () => storedTheme },
          matchMedia: () => ({ matches: prefersDark }),
        },
      });
      expect(root.dataset.visualContext).toBe("app");
      expect(root.dataset.resolvedTheme).toBe(dark ? "dark" : "light");
      expect(root.classList.contains("dark")).toBe(dark);
      applyVisualContext("/design-system", root as unknown as HTMLElement);
      expect(root.classList.contains("dark")).toBe(dark);
    }
  });

  test("路由往返切换根标记，不改变主题偏好解析结果", () => {
    const root = rootFixture();
    root.dataset.resolvedTheme = "dark";
    for (const pathname of ["/app/notes/a", "/blog", "/design-system", "/app", "/login"]) {
      applyVisualContext(pathname, root as unknown as HTMLElement);
      const app = pathname.startsWith("/app") || pathname === "/design-system";
      expect(root.dataset.visualContext).toBe(app ? "app" : "marketing");
      expect(root.classList.contains("dark")).toBe(app);
      expect(root.dataset.resolvedTheme).toBe("dark");
    }
  });

  test("存储被禁用时 APP 首绘仍有视觉作用域", () => {
    const root = rootFixture();
    runInNewContext(bootstrap!, {
      document: { documentElement: root },
      window: { location: { pathname: "/app" }, localStorage: { getItem: () => { throw new Error("denied"); } } },
    });
    expect(root.dataset.visualContext).toBe("app");
    expect(root.classList.contains("dark")).toBe(false);
  });

  test("Demo 自己启用 APP 作用域，不依赖父文档主题", () => {
    const demo = readFileSync(new URL("../../../demo.html", import.meta.url), "utf8");
    expect(demo).toMatch(/<html[^>]+data-visual-context="app"/);
    expect(demo).toContain("connect-src 'none'");
    const styles = [...demo.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]);
    expect(styles).toEqual(["/src/index.css", "/node_modules/@xyflow/react/dist/style.css", "/src/styles/landing-demo.css"]);
    expect(demo.indexOf('/src/index.css')).toBeLessThan(demo.indexOf('<script type="module"'));
  });
});

test("系统切暗不影响营销页面，返回 APP 仍恢复暗色", () => {
  const root = rootFixture();
  applyVisualContext("/login", root as unknown as HTMLElement);
  root.dataset.resolvedTheme = "dark";
  applyThemeAppearance(root as unknown as HTMLElement);
  expect(root.classList.contains("dark")).toBe(false);
  applyVisualContext("/app", root as unknown as HTMLElement);
  expect(root.classList.contains("dark")).toBe(true);
  root.dataset.resolvedTheme = "light";
  applyThemeAppearance(root as unknown as HTMLElement);
  expect(root.classList.contains("dark")).toBe(false);
});
