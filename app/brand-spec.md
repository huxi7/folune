# SuperNote Brand Spec

> SuperNote identity record. Soft Ink was selected as the production Primary on 2026-08-15 after the `/color-lab` blue-primary final round.

## Product identity

SuperNote is a quiet editorial instrument that lets users write first and allows AI-assisted structure to appear after the thought is safe. The stable visual world is warm Canvas, one clear Paper, near-ink text and a single restrained action color.

## Protected assets

- Brand asset: `src/shared/design-system/components/BrandMark.tsx`
- Product evidence: `docs/design-system/paper-first-v1-1/*.png`
- Typography: Avenir Next for interface, Iowan Old Style/Palatino/Noto Serif SC/Songti SC for editorial Paper, SF Mono family for system labels
- Spatial system: 4px baseline; 32px compact navigation / 36px standard command and form / 48px header ladder
- Type system: Interface `14/18px` for 36px commands, `14/20px` for 36px fields, compact tree navigation and sidebar utilities `12/16px` inside 32px rows, `15/27px` for Paper body, `18px` for section headings, `24–30px` for Paper titles, and `32–56px` only for editorial/display titles
- Material: Paper is the only obvious depth; panels stay flat and Buttons use only a restrained tactile mist shadow

## Selected system — Soft Ink

- Light Primary `#395875`, Hover `#304D67`, Active `#284158`, Soft `#EAF0F4`
- Dark Primary `#91ABC4`, Hover `#A0B8CE`, Active `#7B95AE`, Soft `#29343F`
- Meaning: dried-ink character with enough clarity for a durable digital Primary
- Contrast: Light Primary with near-white foreground `7.10:1`; Dark Primary with dark foreground `6.38:1`

## Processing / Saving

- Light Background `#DDE6ED`, Border `#C1CED9`, Foreground `#425E76`, Shimmer `#FFFFFF`
- Dark Background `#2B3945`, Border `#435362`, Foreground `#B4C6D5`, Shimmer `#EEF5FB`
- Saving is the processing state of a Primary action, not a Secondary variant or a second brand color.
- The processing surface is intentionally less saturated than Primary so an unavailable in-flight command cannot look clickable.

## Interaction color semantics

- Ordinary pointer and keyboard-row hover uses one neutral `interactive-hover` surface shared by the memo tree, User Menu, Select and transient workspace menus.
- Soft Ink blue is reserved for Primary actions, selected/current states, focus indication and explicit organizing or drag feedback; merely pointing at a menu row must not turn its surface or label blue.
- Danger menu actions retain destructive text on the same neutral hover surface instead of introducing a red or blue fill.

## Radius system

- Compact `8px`: dense tree rows, small navigation targets
- Control `10px`: Button, Input, Select, SidebarButton
- Paper / Menu `12px`: editorial Paper, code surfaces, popovers
- Panel `16px`: workspace panels, cards, composite inputs
- Dialog `20px`: modal decision surfaces
- Nested surfaces follow concentricity: inner radius equals outer radius minus the inset gap.
- True circles and pills are reserved for avatars, status dots and tags; Panel Toggle uses the shared 10px compact radius, never pill geometry.

## Workspace panel controls

- A closed Library or AI surface is represented by one fixed Ghost icon at the corresponding canvas edge: no resting background, border, shadow, visible label or width expansion. Expanded Panels own their close command inside the Header instead of reusing an overlaid EdgeDock.
- The Library Header keeps the compact BrandMark on the left and its close control at the far right; search and a 32px Primary NotePencil new-memo action share the next row.
- The AI Header is one quiet 48px row: a 16px history menu, one truncated conversation title, a 16px MessageCirclePlus new-conversation action and a matched PanelRightClose trailing command. The closed Canvas state uses the paired PanelRightOpen glyph; it never shows a ChatCircleDots substitute. It never shows a ThinkingMark, product subtitle or permission pill; the empty conversation body remains blank until a future evidence-backed welcome surface is designed.
- AI permission remains available as a 32px/16px Ghost shield in the Composer footer, with its readable mode exposed through tooltip, accessible name and the upward menu rather than permanent Header text.
- AI organize is a 32px icon-only Secondary command: its surface distinguishes the capability without competing with the Primary new-memo anchor.
- Search activation replaces the existing search slot with an input and icon-only close action. It never adds a second command row or visible Cancel label.
- Panel entry/exit uses restrained x/opacity Tween motion. Controls do not fly across the panel through shared layout identity, and panel contents are never compressed with scaleX.

## Iconography

- Product icons use the shared `Lucide React` registry in `src/shared/design-system/icons.tsx`, not direct third-party imports in business files.
- The default contract is a 24×24 viewBox, 2px stroke, round caps/joins, `currentColor`, and 14/16/20/24px rendered sizes. Filled variants are not used to create a second visual language; selection and status use color/surface semantics.
- BrandMark, ThinkingMark, Archive Cord and Google branding remain explicit local/signature exceptions rather than general-purpose icon families.
- `border-radius` is the cross-browser baseline; supported browsers progressively receive the same squircle curve without changing component dimensions.

## Button material

- Solid surfaces only; no static background gradients.
- A restrained vertical face light, one crisp `1px` inset ring, a thin inner halo and zero-offset short soft outer mist provide a light tactile quality; the highlight must wrap evenly rather than read as a top-only shine.
- Hover stays in place, press moves down only `1px`, and pressed shadow contracts.
- Saving uses the same radius, a low-frequency narrow shimmer swept on a subtle diagonal, and the specimen label stays simply `Saving` without trailing dots.

## Historical reference — Current Blue

- Light Primary `#405F96`, Hover `#365786`, Active `#304B75`, Soft `#EDF0F5`
- Dark Primary `#8BA4CF`, Hover `#9AB0D4`, Active `#7892BC`, Soft `#2A3340`
- Role: rejected baseline; its blue presence is clear but reads more like a general digital tool

## Finalist 02 — Slate Blue

- Light Primary `#48647C`, Hover `#3D566B`, Active `#33485A`, Soft `#EDF1F3`
- Dark Primary `#97ACBE`, Hover `#A6B9C8`, Active `#8198AB`, Soft `#2B333A`
- Meaning: the quietest option; recedes behind content but has the weakest brand memory

## Finalist 04 — Classic Ink

- Light Primary `#344E68`, Hover `#2B4258`, Active `#233649`, Soft `#E9EEF2`
- Dark Primary `#8EA8C0`, Hover `#9EB5C9`, Active `#7891A8`, Soft `#28323B`
- Meaning: closest to dried fountain-pen ink; strongest writing character, slightly heavy on solid controls

## Comparison contract

- All candidates must render the same DOM, content, spacing, type, radius, shadow and motion.
- Current warm neutral Light and Dark Canvas/Paper systems remain identical between candidates.
- Danger and durable semantic colors remain independent from Primary.
- The demo never writes production theme state or changes `/`, `/app`, authentication, memo or AI behavior.
- Primary, Primary Soft, focus, selection and user message are the comparison axes.
- Processing/Saving keeps one shared neutralized blue-gray surface across all historical candidates because it is a state, not a second Primary.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
