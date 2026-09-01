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
- Control `12px`: Button, Input, Select, SidebarButton
- Paper / Menu `12px`: editorial Paper, code surfaces, popovers
- Panel `16px`: workspace panels, cards, composite inputs
- Dialog `20px`: modal decision surfaces
- True circles and pills are reserved for avatars, status dots, tags and the AI Composer's singular 32px send/stop action; Panel Toggle and other icon commands use the shared Control radius, never pill geometry.

### Control moved 10px to 12px (2026-09-01)

> Approved decision, implementation pending. `--radius-control` still ships `0.625rem` until the corresponding change lands; this section states the target, not the current build.

- The whole Control step moves together; Button never gets a private radius token. Button and Input sit on the same row — the Library header places the search Input beside the new-memo Button — and a 2px difference between adjacent controls reads as "something is off" without being nameable. That unnameable wrongness is exactly the complaint this step answers.
- Control and Paper/Menu now hold the same 12px on purpose. Roundness is relative: 12px on a 36px control reads generous, 12px on an 816px Paper reads nearly square, so one value cannot be confused across those two scales. If Paper later needs more curve, raise the whole Paper step — do not reopen a Button exception.
- SuperNote compared the existing 10px Control, a 12px squircle and full capsule geometry, then selected 12px for the 32/36px Control family. In this product's dense desktop layout, 12px supplies the intended softness without making controls read as swollen pills; this is a frozen SuperNote decision, not a universal law for every 36px control.

### corner-shape is not a softener

- `corner-shape: squircle` is `superellipse(2)` — a convex curve **between** `round` (`superellipse(1)`) and `square` (`superellipse(infinity)`). At an identical `border-radius` a squircle therefore reads *squarer* than the default arc, and larger superellipse values approach a right angle.
- The squircle earns its keep at larger radii, where continuous curvature becomes legible; at small radii it only spends the radius. So when a surface still reads too square after this step, the next move is the radius step, never a higher superellipse.
- Nested concentricity: inner radius starts from outer radius minus the full inset gap, padding and border both, but that subtraction is only a candidate under `corner-shape`, not the final truth. Implementation must optically calibrate the real Button/Input/Select nests in Light and Dark, then freeze the accepted result as explicit inner-radius tokens and Design System specimens; visual judgment selects the number once, it does not remain an unwritten runtime rule.

### Rejected: capsule buttons (2026-09-01)

Moving the 36px Button family to `999px` was evaluated and rejected. The Composer's 32px send/stop action is a signature precisely because nothing else in the product uses pill geometry; turning every button into a capsule would erase that uniqueness in exchange for softness that 12px already delivers. The product stays with a controlled rounded rectangle.

## Workspace panel controls

- A closed Library or AI surface is represented by one fixed Ghost icon at the corresponding canvas edge: no resting background, border, shadow, visible label or width expansion. Expanded Panels own their close command inside the Header instead of reusing an overlaid EdgeDock.
- The Library Header keeps the compact BrandMark on the left and its close control at the far right. Search and a 32px Primary split create action share the next row; the target split is approximately 80px wide (`48px + 32px`), its main region carries only the label `新建` and creates a memo, and its menu lists only `Canvas` and `文件夹`. The removed NotePencil glyph must not return as decoration. (Approved 2026-09-01, implementation pending.)
- The AI Header is one quiet 48px row: a 16px history menu, one truncated conversation title, a 16px MessageCirclePlus new-conversation action and a matched PanelRightClose trailing command. The closed Canvas state uses the paired PanelRightOpen glyph; it never shows a ChatCircleDots substitute. It never shows a ThinkingMark, product subtitle or permission pill; the empty conversation body remains blank until a future evidence-backed welcome surface is designed.
- AI permission remains available as a 32px/16px Ghost shield in the Composer footer, with its readable mode exposed through tooltip, accessible name and the upward menu rather than permanent Header text.
- The Composer's right-side send/stop action is a 32px geometric circle using the Primary Button material; it explicitly uses `corner-shape: round` instead of inheriting the global Button squircle, and both states keep identical geometry so streaming never shifts the footer silhouette.
- Paper's AI organize command is the single Primary on the Paper toolbar and carries a text label; its hierarchy, placement and state behaviour are frozen in [PAPER_CONSTITUTION.md](../PAPER_CONSTITUTION.md). It may not share the icon-only Secondary treatment used by view switches. (Approved 2026-09-01, implementation pending — it currently ships as a 32px icon-only Secondary, which this clause supersedes.)
- The Library search trigger only opens the single global Command Palette. The `[搜索] [新建 │⌄]` row remains mounted, keeps its geometry and never transforms into a local input, hides the create control or jumps layout while search is open. File-library code must not introduce a second search owner or local result tree.
- Panel entry/exit uses restrained x/opacity Tween motion. Controls do not fly across the panel through shared layout identity, and panel contents are never compressed with scaleX.

## Paper toolbar

> Approved decision, implementation pending. The shipping toolbar is still a non-sticky row inside the Paper with a resident path on the left; this section states the target.

- The Paper toolbar is sticky **inside** the Paper, not a floating layer above it. At rest it carries no bottom rule, no background and no shadow: the controls simply sit in the Paper's top padding and read as part of the sheet.
- Once the body title scrolls out of view the bar condenses — Paper-surface background, one very light hairline, and the note title fading in on the left, the same large-title-to-inline-title move Apple uses. It is driven by `animation-timeline: scroll()`, so nothing runs per frame in JS.
- Commands sit right, never on the Paper's centre axis. The left side is identity ("where you are"), the sides are capability ("what you can do") — a centred command bar belongs to tools that act on every line of the body, which none of these do.
- No resident folder path. The archive location is stated by the archive-status element on the right, which has cause, timing and interaction; a resident path has none of the three.
- Hover uses the shared neutral `interactive-hover` surface. The blurred Soft Ink underline marks **current state only** (reading/editing) and is never applied to a command.

## Paper geometry

> Approved decision, implementation pending. The shipping main Paper still derives its minimum height from the viewport; this section states the target.

- Main writing Paper: fixed **7:9** opening at desktop widths, up to approximately `816×1049px`; content may extend the sheet downward without creating an inner paper scroller.
- Canvas memo card: the same **7:9** projection, retaining the `280×360` baseline.
- Canvas reader overlay: ISO 216 **1:√2**, because its height-constrained modal geometry is different from the width-constrained writing sheet.
- Narrow screens abandon the fixed opening and use the available viewport. Paper proportion never outranks operability.

## Canvas controls

> Approved decision, implementation pending. The shipping control strip still mixes add and viewport actions in one container.

- Bottom controls use two separate surfaces with whitespace between them: a stable Tonal `加入笔记` action (`FilePlus` + label), and one Ghost viewport group for fit, `ZoomOut`, `ZoomIn` and help. The add action never changes material after the first node or according to node count.
- The card's single connect handle uses a grip glyph, rides the lower-right card corner and replaces the former `关联` icon. It appears with the metadata actions on hover/focus/selection, disappears when dragging starts, and is a grab handle rather than the persisted edge endpoint.
- The braided elastic cord exists only while the connection gesture is active. Releasing destroys it and lets the existing static `CanvasCordEdge` appear through its current draw receipt without geometry rebound, width normalization or visual inheritance from the temporary cord.

## Iconography

- Product icons use the shared `Lucide React` registry in `src/shared/design-system/icons.tsx`, not direct third-party imports in business files.
- The default contract is a 24×24 viewBox, 2px stroke, round caps/joins, `currentColor`, and 14/16/20/24px rendered sizes. Filled variants are not used to create a second visual language; selection and status use color/surface semantics.
- **One glyph, one product meaning.** As of 2026-09-01 `Plus` was standing in for three unrelated commands (add a memo to a Canvas, zoom in, relate this card) and `WandSparkles` for two opposed AI verbs (organize, which collapses a note into the tree, and expand, which grows new nodes from it). Zoom takes `ZoomIn`/`ZoomOut`, adding takes `FilePlus`, the connect handle takes a grip glyph, and the two AI verbs must not share a mark — organize is a collecting motion, expand is a spreading one. A glyph reused across meanings is a defect, not a shorthand.
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
