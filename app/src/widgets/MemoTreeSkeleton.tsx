/**
 * [INPUT]: 依赖 Design System 的 Skeleton/SkeletonGroup、locale 加载文案与文件树真实行结构
 * [OUTPUT]: 对外提供延迟显隐的 MemoTreeSkeleton，五行占位保留目录缩进与文件/文件夹图标槽位
 * [POS]: app/src/widgets 的文件库加载占位层，只复刻目录行骨架，不拥有请求状态或业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Skeleton,
  SkeletonGroup,
} from "../shared/design-system/components";
import { useLocale } from "../shared/locale";

export function MemoTreeSkeleton({ visible }: { visible: boolean }) {
  const { t } = useLocale();
  return (
    <SkeletonGroup
      className="sidebar-tree-skeleton"
      label={t("正在加载备忘录文件树", "Loading your notes library")}
      visible={visible}
    >
      <div className="sidebar-tree-skeleton-row">
        <Skeleton className="sidebar-tree-skeleton-icon" data-kind="folder" />
        <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-wide" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
        <Skeleton className="sidebar-tree-skeleton-icon" data-kind="memo" />
        <Skeleton className="sidebar-tree-skeleton-label" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
        <Skeleton className="sidebar-tree-skeleton-icon" data-kind="memo" />
        <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-short" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row">
        <Skeleton className="sidebar-tree-skeleton-icon" data-kind="folder" />
        <Skeleton className="sidebar-tree-skeleton-label" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
        <Skeleton className="sidebar-tree-skeleton-icon" data-kind="memo" />
        <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-wide" shape="text" />
      </div>
    </SkeletonGroup>
  );
}
