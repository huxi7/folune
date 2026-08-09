/**
 * [INPUT]: 依赖 React lazy/Suspense、react-router-dom loader/redirect、共享 Skeleton/延迟策略、Supabase Auth token 读取与后端 Profile API
 * [OUTPUT]: 对外提供 /、OAuth 回调、受保护 /app 与 /app/notes/:noteId 路由，以及直达工作区时与最终三 Panel 同构的延迟 Page Skeleton
 * [POS]: app/src/app/router 的路由装配文件；loader 只建立身份，首屏 Profile 等待由轻量工作区壳承接，整树 Progressive Reveal 仍由 Dashboard 负责
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
      data-agent-open="true"
    >
      <div className="app-sidebar-shell">
        <SkeletonGroup
          className="app-sidebar workspace-route-skeleton-sidebar"
          label="正在加载文件导航"
          visible={skeletonVisible}
        >
          <div className="app-sidebar-heading">
            <Skeleton className="workspace-route-brand" shape="text" />
            <Skeleton className="workspace-route-command" />
          </div>
          <div className="app-sidebar-tree memo-tree-scroll-area">
            <Skeleton className="workspace-route-section-label" shape="text" />
            <div className="sidebar-tree-skeleton">
              <div className="sidebar-tree-skeleton-row">
                <Skeleton className="sidebar-tree-skeleton-icon" />
                <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-wide" shape="text" />
              </div>
              <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
                <Skeleton className="sidebar-tree-skeleton-icon" />
                <Skeleton className="sidebar-tree-skeleton-label" shape="text" />
              </div>
              <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
                <Skeleton className="sidebar-tree-skeleton-icon" />
                <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-short" shape="text" />
              </div>
              <div className="sidebar-tree-skeleton-row">
                <Skeleton className="sidebar-tree-skeleton-icon" />
                <Skeleton className="sidebar-tree-skeleton-label" shape="text" />
              </div>
            </div>
          </div>
          <div className="app-sidebar-footer">
            <Skeleton className="workspace-route-user" />
          </div>
        </SkeletonGroup>
      </div>

      <SkeletonGroup
        className="app-main-panel"
        label="正在加载备忘录工作区"
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

      <SkeletonGroup
        className="app-agent-shell workspace-route-skeleton-agent"
        label="正在加载助手面板"
        visible={skeletonVisible}
      >
        <div className="agent-panel">
          <div className="agent-panel-header">
            <Skeleton className="workspace-route-agent-mark" />
            <Skeleton className="workspace-route-agent-title" shape="text" />
          </div>
          <div className="agent-panel-body workspace-route-agent-body">
            <Skeleton className="workspace-route-agent-line" shape="text" />
            <Skeleton className="workspace-route-agent-line workspace-route-agent-line-short" shape="text" />
            <Skeleton className="workspace-route-agent-composer" />
          </div>
        </div>
      </SkeletonGroup>
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
