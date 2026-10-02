/**
 * [INPUT]: 依赖 React lazy/Suspense、react-router-dom loader/redirect、theme/visualContext 场景同步、真实入口进度 Store、Supabase Auth token 读取与后端 Profile API
 * [OUTPUT]: 桌面保留登录/OAuth/工作区及独立订阅地址；Web 另提供共享营销壳、/login、法律页、博客/动态、旧 auth query 重定向和 DEV 实验页；/app/subscription 与笔记共用父级守卫和 Dashboard，已提交路由同步视觉作用域
 * [POS]: app/src/app/router 的路由装配文件；静态身份、Profile 与轻量 tree loader 并行装配，Dashboard 直接消费 bootstrap；/app 首次进入统一由根级品牌过渡覆盖，内容就绪才揭幕；左右工具偏好在 Dashboard 获得用户后恢复
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, type ReactNode } from "react";
import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
} from "react-router-dom";

import { useWorkspaceEntryStore } from "../../shared/store/workspaceEntryStore";
import { applyVisualContext } from "../../shared/theme/visualContext";

const AuthCallbackPage = lazy(() =>
  import("../../pages/AuthCallbackPage").then((module) => ({
    default: module.AuthCallbackPage,
  })),
);

const desktop = import.meta.env.VITE_DESKTOP === "true" || Boolean(window.foluneDesktop);

const ColorLabPage = import.meta.env.DEV && !desktop
  ? lazy(() =>
    import("../../pages/ColorLabPage").then((module) => ({
      default: module.ColorLabPage,
    })),
  )
  : null;

/*
 * 归档线的验收台。它必须能被真实浏览器打开并真的用鼠标操作，否则「端点跟手」
 * 就只剩静态字符串测试在替它作证；同时它只带假数据, 因此不进生产包、不需要鉴权。
 */
const ArchiveCordLabPage = import.meta.env.DEV && !desktop
  ? lazy(() =>
    import("../../pages/ArchiveCordLabPage").then((module) => ({
      default: module.ArchiveCordLabPage,
    })),
  )
  : null;

const MotionLabPage = import.meta.env.DEV && !desktop
  ? lazy(() => import("../../pages/MotionLabPage").then((module) => ({ default: module.MotionLabPage })))
  : null;

function RouteSuspense({
  children,
  fallback = <RouteFallback />,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

function RouteFallback() {
  return <main className="min-h-screen bg-background" />;
}

function WorkspaceRouteLeaf() {
  return null;
}

async function requireWorkspace({ request }: LoaderFunctionArgs) {
  const entry = useWorkspaceEntryStore.getState();
  const entryId = entry.begin();
  const cancelEntry = () => entry.dismiss(entryId);
  request.signal.addEventListener("abort", cancelEntry, { once: true });
  if (request.signal.aborted) cancelEntry();

  try {
    const [
      { getProfile },
      { getMemoTree },
      { isUnauthorizedApiError },
      { getAuthenticatedAccessToken },
    ] = await Promise.all([
      import("../../shared/api/profile"),
      import("../../shared/api/memo"),
      import("../../shared/api/client"),
      import("../../shared/supabase/auth"),
    ]);

    try {
      const accessToken = await getAuthenticatedAccessToken();
      if (accessToken === null) throw redirect("/login");
      entry.finishStep(entryId, "session");

      const [profile, memoTree] = await Promise.all([
        getProfile(accessToken, request.signal).then((value) => {
          entry.finishStep(entryId, "profile");
          return value;
        }),
        getMemoTree(accessToken, request.signal).then((value) => {
          entry.finishStep(entryId, "tree");
          return value;
        }),
        // 与 Router lazy 共享 import 缓存；既保留并行，也覆盖热缓存再次进入。
        import("../../pages/AppDashboard").then(() => entry.finishStep(entryId, "module")),
      ]);
      return { accessToken, memoTree, profile, entryId };
    } catch (error) {
      if (isUnauthorizedApiError(error)) throw redirect("/login");
      throw error;
    }
  } catch (error) {
    cancelEntry();
    throw error;
  } finally {
    request.signal.removeEventListener("abort", cancelEntry);
  }
}

export const router = createBrowserRouter([
  ...(desktop ? [
    { path: "/", loader: () => redirect("/app") },
    { path: "/login", lazy: async () => ({ Component: (await import("../../pages/LoginPage")).LoginPage }) },
    { path: "*", loader: () => redirect("/app") },
  ] : [{
    path: "/",
    lazy: async () => ({ Component: (await import("../../pages/MarketingLayout")).MarketingLayout }),
    hydrateFallbackElement: <RouteFallback />,
    // ---- 已分享的旧认证地址仍进入同一登录页，不再挂载弹窗 ----
    loader: ({ request }: LoaderFunctionArgs) => new URL(request.url).searchParams.get("auth") === "login"
      ? redirect("/login")
      : null,
    children: [
      { index: true, lazy: async () => ({ Component: (await import("../../pages/LandingPage")).LandingPage }) },
      { path: "login", lazy: async () => ({ Component: (await import("../../pages/LoginPage")).LoginPage }) },
      { path: "terms", lazy: async () => {
        const { LegalPage } = await import("../../pages/LegalPage");
        return { element: <LegalPage document="terms" /> };
      } },
      { path: "privacy", lazy: async () => {
        const { LegalPage } = await import("../../pages/LegalPage");
        return { element: <LegalPage document="privacy" /> };
      } },
      { path: "blog", lazy: async () => ({ Component: (await import("../../pages/BlogPage")).BlogPage }) },
      { path: "blog/:slug", lazy: async () => ({ Component: (await import("../../pages/BlogPage")).BlogPage }) },
      { path: "updates", lazy: async () => { const { BlogPage } = await import("../../pages/BlogPage"); return { element: <BlogPage section="updates" /> }; } },
      { path: "updates/:slug", lazy: async () => { const { BlogPage } = await import("../../pages/BlogPage"); return { element: <BlogPage section="updates" /> }; } },
    ],
  }]),
  {
    path: "/auth/callback",
    element: (
      <RouteSuspense>
        <AuthCallbackPage />
      </RouteSuspense>
    ),
  },
  ...(MotionLabPage === null ? [] : [{
    path: "/motion-lab",
    element: <RouteSuspense><MotionLabPage /></RouteSuspense>,
  }]),
  ...(ColorLabPage === null
    ? []
    : [{
      path: "/color-lab",
      element: (
        <RouteSuspense>
          <ColorLabPage />
        </RouteSuspense>
      ),
    }]),
  ...(ArchiveCordLabPage === null
    ? []
    : [{
      path: "/archive-cord-lab",
      element: (
        <RouteSuspense>
          <ArchiveCordLabPage />
        </RouteSuspense>
      ),
    }]),
  {
    path: "/app",
    lazy: async () => ({ Component: (await import("../../pages/AppDashboard")).AppDashboard }),
    hydrateFallbackElement: <RouteFallback />,
    loader: requireWorkspace,
    shouldRevalidate: () => false,
    children: [
      { index: true, element: <WorkspaceRouteLeaf /> },
      { path: "subscription", element: <WorkspaceRouteLeaf /> },
      { path: "subscription/credits", element: <WorkspaceRouteLeaf /> },
      { path: "notes/:noteId", element: <WorkspaceRouteLeaf /> },
    ],
  },
]);

// ---- 只跟随已提交路由：loader 等待期间仍保留当前页面的视觉 ----
applyVisualContext(router.state.location.pathname);
// ---- loader 交接给页面后，离开工作区或路由报错同样释放入口层 ----
const unsubscribeEntry = router.subscribe((state) => {
  applyVisualContext(state.location.pathname);
  const destination = state.navigation.location?.pathname ?? state.location.pathname;
  if (state.errors || (destination !== "/app" && !destination.startsWith("/app/"))) {
    const entry = useWorkspaceEntryStore.getState();
    if (entry.phase !== "idle") entry.dismiss(entry.id);
  }
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribeEntry);
