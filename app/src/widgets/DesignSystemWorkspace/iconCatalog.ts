/**
 * [INPUT]: 依赖 shared/design-system/icons 的生产语义图标与 Icon 类型
 * [OUTPUT]: 对外提供一组经过筛选的生产图标示例，并覆盖六类冻结语义出口
 * [POS]: app/src/widgets/DesignSystemWorkspace 的轻量图标展示清单；完整图标导出仍由 shared/design-system/icons.tsx 维护
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  AddNoteIcon,
  ConnectionHandleIcon,
  ExpandFromNoteIcon,
  FileTextIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  OrganizeNoteIcon,
  ZoomInIcon,
  ZoomOutIcon,
  type Icon,
} from "../../shared/design-system/icons";

export type IconographyGroup = "Core production";

type IconographyEntry = {
  exportName: string;
  group: IconographyGroup;
  icon: Icon;
  label: string;
  usage: string;
};

/** 只展示能帮助理解命名规则的代表项，完整别名仍由生产图标边界维护。 */
export const iconographyCatalog: readonly IconographyEntry[] = [
  { exportName: "MagnifyingGlassIcon", group: "Core production", icon: MagnifyingGlassIcon, label: "搜索", usage: "全局搜索入口" },
  { exportName: "FileTextIcon", group: "Core production", icon: FileTextIcon, label: "备忘录", usage: "文件树与正文身份" },
  { exportName: "GearSixIcon", group: "Core production", icon: GearSixIcon, label: "设置", usage: "账户与应用设置" },
  { exportName: "AddNoteIcon", group: "Core production", icon: AddNoteIcon, label: "加入笔记", usage: "将已有备忘录加入 Canvas" },
  { exportName: "ZoomOutIcon", group: "Core production", icon: ZoomOutIcon, label: "缩小", usage: "Canvas 视口缩小" },
  { exportName: "ZoomInIcon", group: "Core production", icon: ZoomInIcon, label: "放大", usage: "Canvas 视口放大" },
  { exportName: "ConnectionHandleIcon", group: "Core production", icon: ConnectionHandleIcon, label: "连接抓手", usage: "从 Canvas 卡片直接拉出关系" },
  { exportName: "OrganizeNoteIcon", group: "Core production", icon: OrganizeNoteIcon, label: "AI 整理", usage: "将当前备忘录收拢到文件树" },
  { exportName: "ExpandFromNoteIcon", group: "Core production", icon: ExpandFromNoteIcon, label: "AI 拓展", usage: "从当前笔记向外发现关系" },
] as const;
