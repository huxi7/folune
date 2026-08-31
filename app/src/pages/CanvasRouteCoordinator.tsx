/**
 * [INPUT]: 依赖 React Router navigate（viewTransition）、canvasReturnStore、仅在本次挂载首帧解释的 CanvasEntryBootstrap、上层树重命名命令与 CanvasWorkspace；文件库由 Dashboard 持久宿主承载
 * [OUTPUT]: 对外提供 /app/notes/:id 的 Canvas 路由协调器，冻结单次入口 bootstrap、统一返回描述、会话 flush 暴露、恢复与画布重命名下传，并以明确 to-editor 方向启动画布→写作区过渡；不拥有跨路由文件库
 * [POS]: pages 的 Canvas 路由边界；AppDashboard 不再拥有 Canvas 内部 flush/视口/选择/Panel 细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useNavigate } from "react-router-dom";
import { useState, type CSSProperties, type ReactNode } from "react";

import { useCanvasReturnStore } from "../shared/store/canvasReturnStore";
import { CanvasWorkspace } from "../widgets/CanvasWorkspace";
import type { CanvasSessionControls } from "../widgets/KnowledgeCanvas/useCanvasSessionCoordinator";
import type { CanvasEntryBootstrap } from "./canvasEntryBootstrap";
import { navigateWithPaperTransition } from "./viewTransition";

type CanvasRouteCoordinatorProps = {
  accessToken: string;
  assistant: ReactNode;
  bootstrap?: CanvasEntryBootstrap | null;
  canvasId: string;
  onRename: (nodeId: string, title: string) => Promise<void>;
  onSessionReady?: (controls: CanvasSessionControls | null) => void;
  style: CSSProperties;
  title: string;
  userId: string;
};

export function CanvasRouteCoordinator({
  accessToken,
  assistant,
  bootstrap = null,
  canvasId,
  onRename,
  onSessionReady,
  style,
  title,
  userId,
}: CanvasRouteCoordinatorProps) {
  const navigate = useNavigate();
  /*
   * bootstrap 是「这一次进入 Canvas」的快照，不是活跃订阅。
   *
   * Coordinator 建立会话后会从一次性缓存消费它；随后 AppDashboard 的普通重渲染会再次
   * peek，得到 null。如果直接把这个变化继续下传，浏览器拍 View Transition 新帧之前目标
   * 卡片就会丢掉纸面身份，只剩 root 淡换。反过来，用户下一次从同一 Canvas 离开时会写入
   * 新 bootstrap；若旧 Canvas 立即接纳它，就会在 Preview 旁边重新挂一张同名落点纸，原生
   * View Transition 因重复 name 直接中止。
   *
   * 路由分支离开时本组件会卸载；下一次进入会得到新的初值，因此冻结只覆盖正确的一次挂载。
   */
  const [entryBootstrap] = useState(() => bootstrap);
  const descriptor = useCanvasReturnStore((state) => state.descriptor);
  const rememberReturn = useCanvasReturnStore((state) => state.set);
  const restore = descriptor?.canvasId === canvasId ? descriptor : null;

  return (
    <CanvasWorkspace
      accessToken={accessToken}
      assistant={assistant}
      bootstrap={entryBootstrap}
      canvasId={canvasId}
      /*
       * 画布 → 写作区: 离开的那张卡片(或那张预览纸)与写作区的纸共用同一个纸面名字,
       * 所以这一跳要走一次视图过渡。过渡必须由 navigate 自己起 —— 路由状态落地是异步的,
       * 在外面包一层只会拍到还没换的旧页面, 于是整段退化成硬切。
       */
      onNavigateMemo={(memoId, nextDescriptor) => {
        rememberReturn(nextDescriptor);
        void navigateWithPaperTransition(
          navigate,
          `/app/notes/${encodeURIComponent(memoId)}`,
          "to-editor",
        );
      }}
      onRename={(title) => onRename(canvasId, title)}
      onSessionReady={onSessionReady}
      restore={restore}
      style={style}
      title={title}
      userId={userId}
    />
  );
}
