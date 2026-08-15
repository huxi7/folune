# Color Lab v1

> Captured 2026-08-15 CST from the isolated local `/color-lab` route. No authentication, production request or external write is involved.

## Candidate reduction

- Current Blue `#405F96`: reference only; clear blue, but generic digital-tool feeling.
- 02 Slate Blue `#48647C`: quietest and most neutral, but weaker identity.
- 04 Classic Ink `#344E68`: strongest dried-ink character, heavier on solid controls.
- 05 Soft Ink `#395875`: best balance of ink character, clarity and long-term Primary usability; current recommendation.

The deeper 03 option was removed because it overweights the interface. The sixth option was removed because it is too close to 05 without a clearer role.

## Comparison contract

- Every candidate renders the same static Library, Paper and AI structure.
- Current warm neutral Light and Dark Canvas/Paper systems remain identical.
- Processing/Saving keeps one shared neutralized blue-gray surface; it is a state, not a second Primary.
- The route exists only under `import.meta.env.DEV`; `/`, `/app`, authentication and business state remain untouched.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
