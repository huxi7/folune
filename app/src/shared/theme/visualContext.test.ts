/**
 * [INPUT]: 依赖 applyVisualContext、HTML 首绘脚本、node:vm 与 Bun test
 * [OUTPUT]: 验证首绘/运行期作用域一致、路由往返恢复营销样式、存储失效仍隔离 APP、Demo 独立启用新视觉
 * [POS]: theme 的场景回归门禁；保护路由切换及根级 Portal 继承边界，不把业务路由挂载到测试中
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { applyVisualContext } from "./visualContext";

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
  for (const pathname of ["/app", "/app/", "/app/notes/123", "/", "/login", "/blog/a", "/updates", "/application"]) {
    test(`${pathname} 首绘与运行期保持一致`, () => {
      const initial = rootFixture();
      runInNewContext(bootstrap!, {
        document: { documentElement: initial },
        window: { location: { pathname }, localStorage: { getItem: () => "dark" }, matchMedia: () => ({ matches: false }) },
      });
      const runtime = rootFixture();
      applyVisualContext(pathname, runtime as unknown as HTMLElement);
      expect(runtime.dataset.visualContext).toBe(initial.dataset.visualContext);
      expect(runtime.dataset.visualContext).toBe(/^\/app(?:\/|$)/.test(pathname) ? "app" : "marketing");
    });
  }

  test("路由往返切换根标记，不改变主题偏好解析结果", () => {
    const root = rootFixture();
    root.classList.toggle("dark", true);
    for (const pathname of ["/app/notes/a", "/blog", "/app", "/login"]) {
      applyVisualContext(pathname, root as unknown as HTMLElement);
      expect(root.dataset.visualContext).toBe(pathname.startsWith("/app") ? "app" : "marketing");
      expect(root.classList.contains("dark")).toBe(true);
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
  });
});
