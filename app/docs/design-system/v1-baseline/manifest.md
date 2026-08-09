# v1.0 Classic Blueprint visual baseline

- Baseline commit: `bc796c3`
- Captured: 2026-08-06 CST
- Runtime: Vite 8.1.4 development server at `127.0.0.1:10000`
- Build baseline: `TMPDIR=/private/tmp bunx tsc --noEmit` and `TMPDIR=/private/tmp bun run build` passed before theme changes.
- Data: deterministic repository fixtures only; authenticated views used a temporary DEV-only visual loader fixture that was removed before final checks. No production data or auth contract was changed.

## Captures

| File | Route/state | Viewport | SHA-256 |
| --- | --- | --- | --- |
| `landing-1440.png` | `/`, v1 light canvas | 1440×900, full page | `5eebc6ea1fcdf9112e6ed7322c95e5ce2c1f90a1aac29a2d1c016968fdf5e144` |
| `landing-390.png` | `/`, v1 light canvas | 390×844, full page | `0faa9a68f7465761f2117ecaae93d1e548648a6851784ec634f166792a4e2766` |
| `auth-dialog-1440.png` | `/?auth=login`, dialog open with email field focused | 1440×900 | `9bce1e8973e91c5f3ba1586c06aa6810ac85ccb6889a7e1341032fb429db9a48` |
| `notes-workspace-1440.png` | `/app`, deterministic memo selected, v1 light | 1440×900 | `4ec9bbc54b554c4d961ad433556c9ba86139dc115b9ec9938e4fdb092aebf00b` |
| `notes-workspace-390.png` | `/app`, same memo, collapsed responsive shell, v1 light | 390×844 | `53b328236022a2008052b396dea0f3b34fcbdaa9a35e156fede5b9a3b81b0ab0` |
| `new-memo-codemirror-1440.png` | `/app`, New Memo / CodeMirror empty state, v1 light | 1440×900 | `d24ff4a0247f0faec694ed312e9d09d18ae06db8f30e8d0dc233949dcc64db64` |
| `profile-workspace-1440.png` | `/app`, deterministic account profile, v1 light | 1440×900 | `f41d81d9c9ffac054ec8387668186aec9eab2bcb914cfbea2e1f3cfc9faca8d5` |
| `design-system-1440.png` | `/app`, DEV Design System V1 card matrix in light mode | 1440×900 | `4271a9afc30400e88c223be5a27e63945869b867325fe86dd436685977f9b3a0` |

## Token snapshots

- `tokens-app-light.json`: v1 root light semantic, radius, shadow, and motion values.
- `tokens-app-dark.json`: v1 root dark values captured with a temporary `.dark` class probe, removed immediately after capture.
- `tokens-landing.json`: scoped Blueprint light values and representative Button/Card/Input/Dialog derived styles.

## Coverage note

The first public captures were taken signed out. Authenticated screenshots were then captured against the same static repository data through temporary DEV-only loader fixtures. The fixtures were removed before final TypeScript/build/browser checks, so the production authentication guard and its redirect contract remain unchanged. The V1 card matrix is the only Design System reference surface; V1 selectors and token snapshots stay frozen.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
