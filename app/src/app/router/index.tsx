/**
 * [INPUT]: 依赖 React lazy/Suspense、react-router-dom loader/redirect、共享 Skeleton/延迟策略、Supabase Auth token 读取与后端 Profile API
 * [OUTPUT]: 对外提供 /、OAuth 回调、受保护 /app 与 /app/notes/:noteId 路由，以及直达工作区时以唯一 Paper 为中心的延迟 Skeleton
 * [POS]: app/src/app/router 的路由装配文件；loader 只建立身份，首屏 Profile 等待由 Paper 壳承接，左右工具偏好在 Dashboard 获得用户后恢复
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";

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

const AppDashboard = lazy(() =>
  import("../../pages/AppDashboard").then((module) => ({
    default: module.AppDashboard,
  })),
);

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
  const skeletonVisible = useDelayedSkeleton(true);

  return (
    <main
      aria-label="正在载入 SuperNote 工作区"
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

async function requireWorkspace() {
  const [
    { getProfile },
    { isUnauthorizedApiError },
    { getAuthenticatedAccessToken },
  ] = await Promise.all([
    import("../../shared/api/profile"),
    import("../../shared/api/client"),
    import("../../shared/supabase/auth"),
  ]);

  try {
    const accessToken = await getAuthenticatedAccessToken();

    if (accessToken === null) {
      throw redirect("/?auth=login");
    }

    const profile = await getProfile(accessToken);

    return { accessToken, profile };
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
    element: <LandingPage />,
  },
  {
    path: "/auth/callback",
    element: (
      <RouteSuspense>
        <AuthCallbackPage />
      </RouteSuspense>
    ),
  },
  {
    path: "/app",
    element: (
      <RouteSuspense fallback={<WorkspaceRouteFallback />}>
        <AppDashboard />
      </RouteSuspense>
    ),
    hydrateFallbackElement: <WorkspaceRouteFallback />,
    loader: requireWorkspace,
    children: [
      { index: true, element: <WorkspaceRouteLeaf /> },
      { path: "notes/:noteId", element: <WorkspaceRouteLeaf /> },
    ],
  },
]);
