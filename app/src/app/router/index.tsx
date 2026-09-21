/**
 * [INPUT]: 依赖 React lazy/Suspense、react-router-dom loader/redirect/useLocation、共享 Skeleton/延迟策略、Supabase Auth token 读取与后端 Profile API
 * [OUTPUT]: 对外提供共享营销壳的首页、/blog 与 /updates 目录和各自 :slug 阅读页、OAuth 回调、受保护 /app 与 /app/notes/:noteId 路由、仅开发态实验页，以及区分索引/详情深链的首屏等待面
 * [POS]: app/src/app/router 的路由装配文件；静态身份、Profile 与轻量 tree loader 并行装配，Dashboard 直接消费 bootstrap；/app 索引等待由 Paper 壳承接，详情深链先用中性全屏面；左右工具偏好在 Dashboard 获得用户后恢复
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, type ReactNode } from "react";
import {
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
  useLocation,
} from "react-router-dom";

import { MarketingLayout } from "../../pages/MarketingLayout";
import { BlogPage } from "../../pages/BlogPage";
import { LandingPage } from "../../pages/LandingPage";
import {
  Skeleton,
  SkeletonGroup,
  useDelayedSkeleton,
} from "../../shared/design-system/components";

const AuthCallbackPage = lazy(() =>
  import("../../pages/AuthCallbackPage").then((module) => ({
    default: module.AuthCallbackPage,
  })),
);

const ColorLabPage = import.meta.env.DEV
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
const ArchiveCordLabPage = import.meta.env.DEV
  ? lazy(() =>
    import("../../pages/ArchiveCordLabPage").then((module) => ({
      default: module.ArchiveCordLabPage,
    })),
  )
  : null;

const MotionLabPage = import.meta.env.DEV
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

function WorkspaceRouteFallback() {
  const { pathname } = useLocation();
  const skeletonVisible = useDelayedSkeleton(true);

  if (pathname.startsWith("/app/notes/")) {
    return (
      <main aria-label="正在打开内容" className="canvas-workspace">
        <div className="canvas-workspace-loading" role="status">
          正在打开内容…
        </div>
      </main>
    );
  }

  return (
    <main
      aria-label="正在载入 Folune 工作区"
      className="app-workspace workspace-route-skeleton"
      data-assistant-open="false"
      data-library-open="false"
    >
      <div className="paper-stage-scroll">
        <div className="paper-stage-layout">
          <SkeletonGroup
            className="app-main-panel paper-surface"
            label="正在加载备忘录纸张"
            visible={skeletonVisible}
          >
            <header className="app-main-toolbar">
              <Skeleton className="workspace-route-toolbar-title" shape="text" />
            </header>
            <div className="app-main-content">
              <div className="notes-workspace notes-workspace-loading">
                <div className="note-editor-canvas note-editor-skeleton">
                  <Skeleton className="note-skeleton-title" shape="text" />
                  <div className="note-skeleton-body">
                    <Skeleton className="note-skeleton-line note-skeleton-line-wide" shape="text" />
                    <Skeleton className="note-skeleton-line" shape="text" />
                    <Skeleton className="note-skeleton-line note-skeleton-line-short" shape="text" />
                    <Skeleton className="note-skeleton-line note-skeleton-line-wide" shape="text" />
                  </div>
                </div>
              </div>
            </div>
          </SkeletonGroup>
        </div>
      </div>
    </main>
  );
}

function WorkspaceRouteLeaf() {
  return null;
}

async function requireWorkspace({ request }: LoaderFunctionArgs) {
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

    if (accessToken === null) {
      throw redirect("/?auth=login");
    }

    const [profile, memoTree] = await Promise.all([
      getProfile(accessToken, request.signal),
      getMemoTree(accessToken, request.signal),
    ]);

    return { accessToken, memoTree, profile };
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      throw redirect("/?auth=login");
    }

    throw error;
  }
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MarketingLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "blog", element: <BlogPage /> },
      { path: "blog/:slug", element: <BlogPage /> },
      { path: "updates", element: <BlogPage section="updates" /> },
      { path: "updates/:slug", element: <BlogPage section="updates" /> },
    ],
  },
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
    hydrateFallbackElement: <WorkspaceRouteFallback />,
    loader: requireWorkspace,
    shouldRevalidate: () => false,
    children: [
      { index: true, element: <WorkspaceRouteLeaf /> },
      { path: "notes/:noteId", element: <WorkspaceRouteLeaf /> },
    ],
  },
]);
