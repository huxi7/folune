/**
 * [INPUT]: 依赖整理后的 WorkspaceOrganizePresentation、locale 双语界面文案与文件库定位回调
 * [OUTPUT]: 对外提供安静的归档落点状态元素，显示 `归档于〈末级目录〉`、暴露稳定 source 标记并支持点击定位
 * [POS]: Paper Toolbar 左侧身份段的持久事实展示层；它是归档线的语义起点，因此不另造端口、圆点或 Badge 身体，也不拥有归档线、不读取文件树、不改变整理状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { WorkspaceOrganizePresentation } from "./archiveCordPolicy";
import { useLocale } from "../shared/locale";

type ArchiveStatusProps = {
  onLocate: () => void;
  presentation: WorkspaceOrganizePresentation | null;
};

const lastPathSegment = (path: string): string => {
  const segments = path.split("/").map((segment) => segment.trim()).filter(Boolean);
  return segments.at(-1) ?? path;
};

export function ArchiveStatus({ onLocate, presentation }: ArchiveStatusProps) {
  const { t } = useLocale();
  if (presentation === null) return null;
  /*
   * 纸上只留末级落点。常驻整条路径正是产品卖点的反面 —— 用户不该为了知道
   * 笔记在哪而重新面对文件树；完整路径进 tooltip 与可访问名，需要时才展开。
   */
  const label = lastPathSegment(presentation.path);
  const fullName = t(`归档于 ${presentation.path}`, `Filed in ${presentation.path}`);
  return (
    <button
      aria-label={fullName}
      className="archive-status"
      data-archive-source="true"
      onClick={onLocate}
      title={fullName}
      type="button"
    >
      {t(`归档于${label}`, `Filed in ${label}`)}
    </button>
  );
}
