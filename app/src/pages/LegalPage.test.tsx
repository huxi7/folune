/**
 * [INPUT]: 依赖 happy-dom、真实 Router/AuthForm/LegalPage/BlogPage 与 Testing Library
 * [OUTPUT]: 验证匿名直达、协议导航与元信息、共享阅读回归、目录去除返回首页和动态空集合；侧纹按入场时可见区间展开，完成后只在路径变化时重播，不请求认证或业务数据
 * [POS]: pages 的公开协议路由集成门禁，保护共享模板提取后博客身份和独立法律 URL 的边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "http://localhost:10000/" });
Object.assign(globalThis, {
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  HTMLInputElement: browserWindow.HTMLInputElement,
  Node: browserWindow.Node,
  IntersectionObserver: browserWindow.IntersectionObserver,
  window: browserWindow,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
});
document.head.innerHTML = '<title>Folune</title><meta name="description" content="记录">';

const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { createMemoryRouter, RouterProvider } = await import("react-router-dom");
const { AuthForm } = await import("../widgets/AuthForm");
const { LegalPage } = await import("./LegalPage");
const { BlogPage } = await import("./BlogPage");
const { LandingFooter } = await import("../widgets/LandingFooter");

afterEach(cleanup);

function renderRoute(path: string) {
  const router = createMemoryRouter([
    { path: "/", element: <LandingFooter /> },
    { path: "/login", element: <AuthForm onAuthenticated={() => undefined} /> },
    { path: "/terms", element: <LegalPage document="terms" /> },
    { path: "/privacy", element: <LegalPage document="privacy" /> },
    { path: "/blog", element: <BlogPage /> },
    { path: "/updates", element: <BlogPage section="updates" /> },
    { path: "/blog/:slug", element: <BlogPage /> },
  ], { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}

describe("公开法律页面", () => {
  test.each(["/blog", "/updates", "/blog/write-first-organize-later", "/privacy"])("%s 仅花纹局部外框进入动画容器，内容和普通分隔线不受影响", (path) => {
    const view = renderRoute(path);
    const animated = view.container.querySelectorAll(".blog-side-frame[data-animated]");
    expect(animated.length).toBe(1);
    expect(animated[0]!.querySelectorAll(".blog-side-frame-top").length).toBe(2);
    expect(animated[0]!.querySelectorAll(".blueprint-rail-edge-start,.blueprint-rail-edge-end").length).toBe(2);
    expect(animated[0]!.querySelector(".blueprint-rail-start,.blueprint-rail-end,.blueprint-divider,h1,p")).toBeNull();
    expect(animated[0]!.parentElement?.querySelector(":scope > .landing-rail-texture")).toBeTruthy();
    const gap = view.container.querySelector('.landing-chapter-gap[data-edge="end"]');
    if (path === "/blog" || path === "/updates") {
      expect(view.queryByRole("link", { name: "返回首页" })).toBeNull();
      expect(view.queryByRole("button", { name: "返回首页" })).toBeNull();
      if (path === "/updates") {
        expect(view.getByRole("heading", { level: 1 }).textContent).toBe("最新动态");
        expect(view.container.querySelectorAll("article").length).toBe(0);
        expect(view.queryByText("新的动态，正在酝酿。")).toBeNull();
      }
    } else {
      expect(gap!.querySelector(".blueprint-divider[data-full-bleed],.blueprint-pin")).toBeNull();
      expect(gap!.querySelector(".blueprint-divider-line")).toBeTruthy();
    }
  });

  test("目录与正文共用花纹入场，query 和锚点保留终态，路径切换重新播放", async () => {
    const view = renderRoute("/blog");
    const texture = view.container.querySelector<HTMLElement>(".landing-rail-texture")!;
    expect(texture.dataset.reveal).toBe("revealing");
    const pattern = texture.querySelector('[data-side="start"] .landing-rail-texture-pattern')!;
    const end = document.createEvent("Event");
    end.initEvent("animationend", true, false);
    Object.defineProperty(end, "animationName", { value: "landing-rail-reveal" });
    fireEvent(pattern, end);
    expect(texture.dataset.reveal).toBe("complete");

    await act(async () => { await view.router.navigate("/blog?source=test#main-content"); });
    expect(view.container.querySelector(".landing-rail-texture")).toBe(texture);
    expect(texture.dataset.reveal).toBe("complete");

    await act(async () => { await view.router.navigate("/blog/write-first-organize-later"); });
    const articleTexture = view.container.querySelector<HTMLElement>(".landing-rail-texture")!;
    expect(articleTexture).not.toBe(texture);
    expect(articleTexture.dataset.reveal).toBe("revealing");
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe("先记下来，让想法有处可去");

    await act(async () => { await view.router.navigate("/privacy"); });
    expect(view.container.querySelector<HTMLElement>(".landing-rail-texture")!.dataset.reveal).toBe("revealing");
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe("隐私政策");
  });

  test.each([
    { path: "/updates", top: 100, height: 240 },
    { path: "/blog", top: 100, height: 2600 },
    { path: "/blog", top: 100, height: 5200 },
    { path: "/blog", top: -900, height: 2600 },
  ])("$path 高度 $height、起点 $top：只在动画真正开始时确定可见展开区间", ({ path, top, height }) => {
    const view = renderRoute(path);
    const texture = view.container.querySelector<HTMLElement>(".landing-rail-texture")!;
    Object.defineProperty(texture, "getBoundingClientRect", { value: () => ({ top, height }) });
    expect(texture.style.getPropertyValue("--blog-pattern-end")).toBe("");

    const start = document.createEvent("Event");
    start.initEvent("animationstart", true, false);
    Object.defineProperty(start, "animationName", { value: "blog-index-pattern-reveal" });
    fireEvent(texture.querySelector('[data-side="end"] .landing-rail-texture-pattern')!, start);
    expect(texture.style.getPropertyValue("--blog-pattern-end")).toBe("");
    fireEvent(texture.querySelector('[data-side="start"] .landing-rail-texture-pattern')!, start);

    // 增加屏外文章不会加速当前视口；返回长页的中段也只展开当前可见部分。
    expect(texture.style.getPropertyValue("--blog-pattern-start")).toBe(`${Math.max(0, -top)}px`);
    expect(texture.style.getPropertyValue("--blog-pattern-end")).toBe(`${Math.min(height, window.innerHeight - top)}px`);
  });

  test.each(["terms", "privacy"] as const)("匿名直达 /%s，显示真实联系入口和独立元信息", async (kind) => {
    const view = renderRoute(`/${kind}`);
    const title = kind === "terms" ? "服务条款" : "隐私政策";
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe(title);
    expect(view.getByRole("link", { name: "oxygen777@2925.com" }).getAttribute("href"))
      .toBe("mailto:oxygen777@2925.com");
    expect(view.container.querySelectorAll(".blog-reading section").length).toBeGreaterThan(14);
    expect(view.container.querySelector(".blog-reading")!.textContent!.length).toBeGreaterThan(4000);
    expect(document.title).toBe(`${title} · Folune`);
    expect(view.queryByText("FOLUNE JOURNAL")).toBeNull();
    expect(view.queryByText("查看全部文章")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "← 返回" }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/"));
    expect(document.title).toBe("Folune");
  });

  test("登录页进入条款，再切换隐私政策，返回仍落在登录页", async () => {
    const view = renderRoute("/login");
    expect(view.getByRole("link", { name: "服务条款" }).getAttribute("href")).toBe("/terms");
    expect(view.getByRole("link", { name: "隐私政策" }).getAttribute("href")).toBe("/privacy");
    fireEvent.click(view.getByRole("link", { name: "服务条款" }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/terms"));
    const navigation = view.getByRole("navigation", { name: "法律文档导航" });
    fireEvent.click(navigation.querySelector('a[href="/privacy"]')!);
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/privacy"));
    expect(document.title).toBe("隐私政策 · Folune");
    fireEvent.click(view.getByRole("button", { name: "← 返回" }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/login"));
    expect(view.getByRole("button", { name: "使用 Google 账号继续" })).toBeTruthy();
  });

  test("首页页脚暴露真实法律链接，博客目录不混入法律文档", async () => {
    const footer = renderRoute("/");
    expect(footer.getByRole("link", { name: "隐私政策" }).getAttribute("href")).toBe("/privacy");
    expect(footer.getByRole("link", { name: "服务条款" }).getAttribute("href")).toBe("/terms");
    cleanup();
    const blog = renderRoute("/blog");
    expect(blog.getByRole("heading", { level: 1 }).textContent).toBe("Folune 博客");
    expect(blog.queryByRole("link", { name: "隐私政策" })).toBeNull();
    expect(blog.queryByRole("link", { name: "服务条款" })).toBeNull();
  });

  test("正文中的协议互链保留刚才阅读的文档作为返回目标", async () => {
    const view = renderRoute("/terms");
    fireEvent.click(view.container.querySelector('.blog-reading a[href="/privacy"]')!);
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/privacy"));
    fireEvent.click(view.getByRole("button", { name: "← 返回" }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/terms"));
  });

  test("既有博客文章继续使用作者、导读、段落及原目录返回", async () => {
    const view = renderRoute("/blog/write-first-organize-later");
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe("先记下来，让想法有处可去");
    expect(view.getByText("huxi")).toBeTruthy();
    expect(view.container.querySelectorAll(".blog-reading section").length).toBe(4);
    expect(view.getByRole("link", { name: "FOLUNE JOURNAL" }).getAttribute("href")).toBe("/blog");
    fireEvent.click(view.getByRole("button", { name: "← 返回" }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe("/blog"));
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe("Folune 博客");
  });
});
