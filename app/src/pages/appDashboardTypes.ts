/**
 * [INPUT]: 依赖 Profile、AccountSection 与 React Router loader/页面视图状态契约
 * [OUTPUT]: 对外提供 WorkspaceLoaderData、AccountDialogState、MemoDialogState、ViewTitleDraft 与 TreeStatus
 * [POS]: app/src/pages 的 Dashboard 私有类型边界；只描述页面状态形状，不承载运行时逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Profile } from "../shared/api/profile";
import type { MemoTreeNode } from "../shared/api/memo";
import type { AccountSection } from "../widgets/AccountDialog";

export type WorkspaceLoaderData = {
  accessToken: string;
  memoTree: MemoTreeNode[];
  profile: Profile;
};

export type AccountDialogState = AccountSection | null;

export type MemoDialogState = {
  parentId: string | null;
} | null;

export type ViewTitleDraft = {
  memoId: string;
  title: string;
} | null;

export type TreeStatus = "error" | "loading" | "ready";
