# Quiet Editorial / Paper First V1.1 acceptance

> Captured 2026-08-14 CST from the local Vite app. The authenticated workspace uses a deterministic, isolated Playwright fixture (`Linus`, `产品设计`, `给复杂系统留一张安静的纸`); all Profile, memo tree, AI thread and organize responses are fulfilled in-browser. No production request or external write is involved.

## Evidence set

- Four matching App pairs: `before-*` and `after-*` at 1440×900, 1280×800, 1024×768 and 390×844.
- Persistent organize result: `archive-cord-1440x900.png` shows the Paper Archive Port, real folder Target Port, stable near-black curve, target highlight and persistent receipt.
- Theme/motion: `dark-reduced-390x844.png` proves the same neutral axis in Dark and complete static information under reduced motion.
- Design System: `design-system-before-full.png`, `design-system-after-full.png` and `design-system-after-dark-full.png` compare the old matrix with the five-layer Foundations/Primitives/Navigation & Overlays/Editorial/AI & Organize production matrix.

## Interaction acceptance

- Edge Dock and Panel Header use the same left/right `layoutId`; the Canvas Dock unmounts while its Panel is open, so controls never overlap.
- Paper/editor/menu/Panel interactions are excluded from canvas dismissal; Canvas whitespace, overlay backdrop and Escape close tools.
- 1440px allows both reserved tools; 1280px reserves one side; 1024px and 390px use mutually exclusive overlay Panels.
- Opening/closing a Panel keeps the same CodeMirror DOM node, title value and editor selection; route/store/autosave protocols are unchanged.
- Archive Cord appears only for `succeeded`/`undone`, persists across Library close/reopen, recalculates on resize/Panel resize/tree scroll or mutation, and is absent in small-screen overlay mode.
- Closing the receipt, switching memo, starting a new organize or a non-success status clears the success presentation; undo rebuilds the target from the restored memo path.

## Quality gates

Final command results are recorded in the delivery response. Required gates: `bun run typecheck`, `bun test`, `bun run build`, `git diff --check`, plus the repository-wide 800-line file ceiling.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
