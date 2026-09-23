/**
 * [INPUT]: 依赖生产 PaperSurface/ArchiveStatus/AppSidebar/WorkspacePanelLayer/PanelResizeHandle/ArchiveCordOverlay、真实 organizePresentation 路径重算、useOverlayPanels 判据、共享主题状态与生产 workspace.css
 * [OUTPUT]: 对外提供仅开发态 `/archive-cord-lab` 归档线验收 fixture，以确定性假树覆盖 fresh/restore、逐层折叠展开、tree 滚动、文件库开关、裁切层外的 Panel resize 与窄屏/Light/Dark/Reduced Motion
 * [POS]: app/src/pages 的归档线真实交互验收台；只用假 ID 与假内容，不读写 API、数据库、真实用户正文或真实 AI run，也不复制任何展示专用线与展示专用 CSS
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useMemo, useState } from "react";

import "../styles/archive-cord-lab.css";

import type { AiRun } from "../shared/api/ai";
import type { MemoContentSummary, MemoNode, MemoTreeNode } from "../shared/api/memo";
import type { Profile } from "../shared/api/profile";
import { useTheme } from "../shared/theme/ThemeProvider";
import { AppSidebar } from "../widgets/AppSidebar";
import { ArchiveCordOverlay } from "../widgets/ArchiveCord";
import { ArchiveStatus } from "../widgets/ArchiveStatus";
import { PanelResizeHandle } from "../widgets/PanelResizeHandle";
import { PaperSurface } from "../widgets/PaperSurface";
import { WorkspacePanelLayer } from "../widgets/WorkspacePanelLayer";
import {
  buildWorkspaceOrganizePresentation,
  type OrganizePresentationRun,
} from "./organizePresentation";
import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useOverlayPanels,
  type WorkspaceStyle,
} from "./workspaceLayout";

const LAB_USER_ID = "archive-cord-lab";
const TARGET_MEMO_ID = "lab-target-memo";
const TIMESTAMP = "2026-09-03T00:00:00.000Z";

/*
 * 生产 AppSidebar 会按用户持久化展开偏好, 而验收结论必须可重跑: 上一轮收到哪一层
 * 不该决定下一轮从哪里开始。每次进入验收台先清掉这个 fixture 专属的键 —— 它属于
 * 假用户, 不碰任何真实用户的偏好, 也不碰任何用户正文。
 */
const resetLabExpansion = (): true => {
  try {
    window.localStorage.removeItem(`folune:memo-tree-expanded:${LAB_USER_ID}`);
  } catch {
    // 隐私模式下不可写；确定性让位于可用性，其余验收不受影响
  }
  return true;
};

const profile: Profile = {
  avatarUrl: null,
  bio: null,
  email: "lab@folune.local",
  id: LAB_USER_ID,
  username: "Archive Cord Lab",
};

const summary = (nodeId: string): MemoContentSummary => ({
  created_at: TIMESTAMP,
  excerpt: null,
  metadata: {},
  node_id: nodeId,
  updated_at: TIMESTAMP,
  user_id: LAB_USER_ID,
  word_count: 0,
});

const node = (
  id: string,
  title: string,
  nodeType: "folder" | "memo",
  parentId: string | null,
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  children,
  color: null,
  created_at: TIMESTAMP,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: nodeType === "memo" ? summary(id) : null,
  metadata: {},
  node_type: nodeType,
  parent_id: parentId,
  revision: 1,
  sort_order: id,
  title,
  updated_at: TIMESTAMP,
  user_id: LAB_USER_ID,
});

const filler = (prefix: string, count: number): MemoTreeNode[] =>
  Array.from({ length: count }, (_, index) =>
    node(`${prefix}-${index}`, `${prefix} 备忘 ${index + 1}`, "memo", null));

/*
 * 三层嵌套让「最内层收起 / 外层收起 / 逐级展开」三种代表都能被走到；
 * 上下各一段填充让代表能真的滚出 tree viewport 的上、下两条安全边缘。
 */
const labTree: MemoTreeNode[] = [
  ...filler("上方", 10),
  node("lab-outer", "产品思考", "folder", null, [
    node("lab-inner", "形制收口", "folder", "lab-outer", [
      node("lab-deeper", "归档线", "folder", "lab-inner", [
        node(TARGET_MEMO_ID, "真相不降级", "memo", "lab-deeper"),
        node("lab-sibling", "表现可以降级", "memo", "lab-deeper"),
      ]),
    ]),
  ]),
  ...filler("下方", 18),
];

const resultMemo: MemoNode = {
  color: null,
  created_at: TIMESTAMP,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id: TARGET_MEMO_ID,
  metadata: {},
  node_type: "memo",
  parent_id: "lab-deeper",
  revision: 2,
  sort_order: TARGET_MEMO_ID,
  title: "真相不降级",
  updated_at: TIMESTAMP,
  user_id: LAB_USER_ID,
};

const labRun = (runId: string, status: "succeeded" | "undone"): AiRun => ({
  applied_at: TIMESTAMP,
  created_at: TIMESTAMP,
  error_code: null,
  id: runId,
  idempotency_key: runId,
  memo_id: TARGET_MEMO_ID,
  plan: null,
  result: {
    created_folder: null,
    memo: resultMemo,
    result_revision: 2,
    // 快照路径故意写错：真实落点必须由当前树重算，而不是抄这一行
    target_path: "过期快照 / 不该出现",
    ...(status === "undone"
      ? {
        undo: {
          folder_retained: true,
          memo: resultMemo,
          removed_folder_id: null,
        },
      }
      : {}),
  },
  source_revision: 1,
  status,
  thread_id: null,
  undone_at: status === "undone" ? TIMESTAMP : null,
  updated_at: TIMESTAMP,
  user_id: LAB_USER_ID,
});

export function ArchiveCordLabPage() {
  // 必须早于 AppSidebar 的 hooks 水合：父组件 render body 先于子组件执行
  useState(resetLabExpansion);
  const { resolvedTheme, setTheme } = useTheme();
  const [presentationRun, setPresentationRun] =
    useState<OrganizePresentationRun | null>(null);
  const [runSeq, setRunSeq] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [reveal, setReveal] = useState<{ nodeId: string; seq: number } | null>(null);
  const viewport = useOverlayPanels(false, libraryOpen);

  // 走生产构造器：路径重算、memo 匹配与 origin 透传都用真实那一条
  const presentation = buildWorkspaceOrganizePresentation({
    memoTree: labTree,
    presentation: presentationRun,
    selectedMemoId: TARGET_MEMO_ID,
  });

  const workspaceStyle: WorkspaceStyle = useMemo(() => ({
    "--workspace-agent-track": "0px",
    "--workspace-sidebar-track": `${sidebarWidth}px`,
  }), [sidebarWidth]);

  const locateArchive = () => {
    if (presentation === null) return;
    setLibraryOpen(true);
    setReveal((current) => ({
      nodeId: presentation.memoId,
      seq: (current?.seq ?? 0) + 1,
    }));
  };

  const emitFresh = (status: "succeeded" | "undone") => {
    const nextSeq = runSeq + 1;
    setRunSeq(nextSeq);
    setPresentationRun({ origin: "fresh", run: labRun(`lab-run-${nextSeq}`, status) });
    setLibraryOpen(true);
  };

  /*
   * 「模拟刷新恢复」刻意保持 runId 不变、只把 origin 换成 restored，并且不 openLibrary
   * ——这正是刷新后 useMemoOrganize 会做的事。它必须以 settled 回来，不许重播 fresh。
   */
  const emitRestored = () => {
    const runId = runSeq === 0 ? "lab-run-1" : `lab-run-${runSeq}`;
    if (runSeq === 0) setRunSeq(1);
    setPresentationRun({ origin: "restored", run: labRun(runId, "succeeded") });
  };

  const noop = () => undefined;
  const asyncNoop = async () => undefined;

  return (
    <div
      className="app-workspace"
      data-assistant-open="false"
      data-library-open={libraryOpen}
      data-overlay-panels={viewport.overlayPanels}
      style={workspaceStyle}
    >
      {/*
        * 纸必须是生产那张纸: .app-main-panel 是 grid-template-areas: "paper", 7:9 比例基线与
        * .paper-content-transition 叠在同一格里。少了 PaperSurface 这层包裹, 顶栏就会被自动
        * 放到基线下面那一行去 —— source 的 y 直接掉出视口, 验的就不是线上那条线了。
        */}
      <div className="paper-stage-scroll">
        <div className="paper-stage-layout">
          <PaperSurface
            organizing={false}
            paperIdentity="archive-cord-lab"
            reducedMotion={false}
          >
            <header className="app-main-toolbar">
              <div className="app-main-toolbar-leading">
                <ArchiveStatus onLocate={locateArchive} presentation={presentation} />
                <span className="app-main-toolbar-title" data-toolbar-title="true">
                  真相不降级
                </span>
              </div>
            </header>
            <div className="app-main-content">
              <div className="archive-cord-lab-body">
                <p>归档线验收 fixture。假 ID、假内容，不触碰 API、数据库与真实用户正文。</p>
                <ol>
                  <li>「新整理成功」应只播放一次自绘，随后降为持久 hairline。</li>
                  <li>逐层收起 归档线 / 形制收口 / 产品思考，终点应连续收回到当前最近的可见祖先。</li>
                  <li>快速滚动文件树，端点应连续贴边，不出现阈值跳变、不画箭头。</li>
                  <li>关闭再打开文件库、点「模拟刷新恢复」，线应以 settled 回来而不重播。</li>
                  <li>拖 Panel 手柄与缩窄窗口，两端应逐帧同步；窄屏只剩代表行的安静反馈。</li>
                </ol>
              </div>
            </div>
          </PaperSurface>
        </div>
      </div>

      <WorkspacePanelLayer
        open={libraryOpen}
        style={workspaceStyle}
        resizeHandle={
          <PanelResizeHandle
            ariaLabel="调整文件侧边栏宽度"
            direction={1}
            max={SIDEBAR_MAX_WIDTH}
            min={SIDEBAR_MIN_WIDTH}
            onReset={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
            onResize={setSidebarWidth}
            side="right"
            size={sidebarWidth}
          />
        }
      >
        <AppSidebar
          activeView="note"
          archiveTarget={presentation === null ? null : {
            memoId: presentation.memoId,
            origin: presentation.origin,
            runId: presentation.runId,
          }}
          memoTree={labTree}
          mutating={false}
          onClose={() => setLibraryOpen(false)}
          onCreateCanvas={noop}
          onCreateMemo={noop}
          onMoveNode={async () => false}
          onOpenDesignSystem={noop}
          onOpenProfile={noop}
          onOpenSearch={noop}
          onOpenSettings={noop}
          onOpenSubscription={noop}
          onPrefetchMemo={noop}
          onRenameNode={asyncNoop}
          onRequestCreateFolder={noop}
          onSelectMemo={noop}
          onSelectView={noop}
          onSignOut={asyncNoop}
          onSoftDeleteNode={asyncNoop}
          profile={profile}
          reveal={reveal}
          revealContent={false}
          selectedMemoId={TARGET_MEMO_ID}
          skeletonVisible={false}
          treeStatus="ready"
        />
      </WorkspacePanelLayer>

      <ArchiveCordOverlay
        libraryOpen={libraryOpen}
        onLocate={locateArchive}
        overlayPanels={viewport.overlayPanels}
        presentation={presentation}
      />

      <div className="archive-cord-lab-bar">
        <button data-lab="fresh" onClick={() => emitFresh("succeeded")} type="button">
          新整理成功
        </button>
        <button data-lab="undone" onClick={() => emitFresh("undone")} type="button">
          撤销结果
        </button>
        <button data-lab="restore" onClick={emitRestored} type="button">
          模拟刷新恢复
        </button>
        <button data-lab="clear" onClick={() => setPresentationRun(null)} type="button">
          清除
        </button>
        <button
          data-lab="library"
          onClick={() => setLibraryOpen((open) => !open)}
          type="button"
        >
          {libraryOpen ? "关闭文件库" : "打开文件库"}
        </button>
        <button
          data-lab="theme"
          onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
          type="button"
        >
          {resolvedTheme === "light" ? "暗色" : "浅色"}
        </button>
        <span data-lab="readout">
          {presentation === null
            ? "无 presentation"
            : `${presentation.origin} · ${presentation.status} · 归档于 ${presentation.path}`}
        </span>
      </div>
    </div>
  );
}
