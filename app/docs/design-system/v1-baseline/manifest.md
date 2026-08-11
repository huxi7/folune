# v1.0 Classic Blueprint semantic snapshot

> 2026-08-11：原 2026-08-06 视觉截图已作废并移除。它们不能代表当前 UI，也不得再用于视觉审查；需要视觉证据时必须从当前运行版本重新采集。

- Baseline commit: `bc796c3`
- Captured: 2026-08-06 CST
- Runtime: Vite 8.1.4 development server at `127.0.0.1:10000`
- Build baseline: `TMPDIR=/private/tmp bunx tsc --noEmit` and `TMPDIR=/private/tmp bun run build` passed before theme changes.
- Data: 只使用确定性的仓库 fixture；认证页面曾使用临时 DEV-only loader fixture，并已在当次检查后移除。原截图现已全部作废，不保留哈希或视觉结论。

## Token snapshots

- `tokens-app-light.json`: v1 root light semantic, radius, shadow, and motion values.
- `tokens-app-dark.json`: v1 root dark values captured with a temporary `.dark` class probe, removed immediately after capture.
- `tokens-landing.json`: scoped Blueprint light values and representative Button/Card/Input/Dialog derived styles.

## Evidence boundary

Token snapshots 只描述当时的 computed 语义变量，不证明当前组件布局、内容、交互或视觉状态。当前 UI 的任何结论都必须来自当前源码与当前运行页面。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
