# Motion Audit

> L1 | 父级: ../CLAUDE.md

## 结论

SuperNote 已经有三条应保留的复杂动效通道：Paper/Canvas 的浏览器 View Transition、Canvas 节点/关系的因果动效、文件树与归档线共用的 FLIP 时间轴。本轮不覆盖它们，只统一周边交互的物理基线与进入/退出节奏。

## 审计矩阵

| 区域 | 现状 | 处理 |
| --- | --- | --- |
| 全局 Motion | `MotionConfig reducedMotion="user"` 已存在，但 JS spring 语义不完整 | 增加 `interactive/snappy/gentle/smooth/expressive` 与两条 easing 基线 |
| Paper ↔ Canvas | 浏览器 View Transition 已承担空间连续性，曲线和纸内正文规则完整 | 保留，只不让子组件重复入场 |
| Canvas 节点/绳线 | 有 receipt、rAF、Reduced Motion 和独立路径绘制 | 保留，仅以全局 token 作为后续扩展入口 |
| Panel / Stage Dock | 有入场淡入，但 Panel 位移使用散落的 Tween | Panel enter/exit 改用 `gentle`/`snappy`，opacity 仍用 easing |
| 文件树展开 | folder 图标切换有状态，子树直接硬切 | 子树用 `snappy` 的高度/透明度连续展开收起 |
| 新建菜单 | 打开有 CSS 入场，关闭卸载导致硬切 | 使用可打断的 `AnimatePresence`，菜单保持轻微空间回收 |
| Select / More / User Menu | 有统一 CSS 入场，退出依赖卸载 | 保持现有 focus/overlay 契约；后续若需退场，复用同一 `snappy` token |
| Trash 列表 | ready/empty/loading 状态直接替换，项目增删无连续反馈 | 列表项使用 `layout`、轻量 enter/exit；不做整页飞入 |
| Loading / Skeleton | 已有延迟显示与最短可见时长，避免快请求闪屏 | 保留，不叠加装饰性动画 |
| Toast / AI streaming | 已有队列、滑动、token 级反馈和 Reduced Motion | 保留，避免与全局 spring 混用 |
| Landing | 一次性 reveal / count-up 已有并且克制 | 保留，不增加循环装饰 |

## 验收重点

- 连续展开/收起文件夹时，动画可被下一次操作接管，不出现子树跳回。
- 新建菜单快速开关时，退出与下一次进入不堆叠、不改变 split 控件几何。
- 回收站恢复/永久删除时，剩余条目只做位置重排，不整页重播。
- Reduced Motion 下保留内容、焦点和可操作性，只取消空间位移与路径绘制。
- Canvas、Paper、归档线与 WAL/API 边界不因动效改造发生耦合。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
