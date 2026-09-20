# Folune Brand Spec

> Folune identity record. Soft Ink was selected as the production Primary on 2026-08-15 after the `/color-lab` blue-primary final round.

## Product identity

Folune is a quiet editorial instrument that lets users write first and allows AI-assisted structure to appear after the thought is safe. The stable visual world is warm Canvas, one clear Paper, near-ink text and a single restrained action color.

## Protected assets

- Display name: `Folune`. Internal repository/package identifiers, storage keys, API names and domains remain unchanged. Footer is the sole wordmark exception: native outlined Folune text, no PNG or companion icon.
- Brand asset: `src/shared/design-system/components/BrandMark.tsx` is the single production entry for `public/brand/supernote-tight.png`. Preserve `public/brand/supernote.png` (1254×1254 RGBA, original user-supplied bytes) unchanged. The approved derivative removes only alpha=0 outer rows/columns at x=234, y=202, width=791, height=851; retained RGBA pixels are unchanged. Both themes preserve the proportions, texture, colors and embedded shadow: no tint, filters, added backgrounds or shadows. Favicons remain direct 32px/192px master resizes.
- Selected lockup (updated 2026-09-22): option ③ keeps the Source Serif 4 Medium 24pt fixed SVG (viewBox 301.7×75). The layout slot remains icon:wordmark = 5:4, while the fixed outline is optically compressed to 94% of its original vertical geometry inside that slot; this preserves width and centering while reducing visible ink height to 75.2% of the icon. At the APP baseline this resolves to a 22px visible icon, a 17.6px wordmark slot, about 16.54px of visible letterform and a 7px gap. `--brand-size` means visible icon height; wordmark slot and gap derive from that one value, while the default 1.375rem still follows Demo's existing 87.5% root font size. No runtime font download or comparison-lab import; the OFL license ships in public/brand.
- Marketing header refinement (updated 2026-09-22): `.marketing-brand` sets only a 20px visible icon height and the 88% landing-ink wordmark color. Its resulting 16px wordmark slot (about 15.04px visible letterform) and 6.36px gap come from the same shared ratio as APP/Demo instead of a second Landing-specific geometry.
- Standalone marks: the letter seal retains its previous 70.58px visible height and ink position; the final CTA retains its 108.58px visible height in the existing 160px slot. These values convert old master-canvas dimensions by 851/1254, avoiding accidental enlargement after removing transparent padding.
- Product evidence: re-captured from the running app when a judgement needs it; no screenshot set is kept, and the DEV `/design-system` route is the one place the whole system is on screen at once
- Typography: Avenir Next for interface, Iowan Old Style/Palatino/Noto Serif SC/Songti SC for editorial Paper, SF Mono family for system labels
- Spatial system: 4px baseline; 32px compact navigation / 36px standard command and form / 48px header ladder
- Type system: Interface `14/18px` for 36px commands, `14/20px` for 36px fields, compact tree navigation and sidebar utilities `12/16px` inside 32px rows, `15/27px` for Paper body, `18px` for section headings, `24–30px` for Paper titles, and `32–56px` only for editorial/display titles
- Material: Paper is the only obvious depth; panels stay flat and Buttons use only a restrained tactile mist shadow

## Selected system — Soft Ink

Landing 中文化（2026-09-14）：保留参考布局、暖灰背景、纹理和导轨；英文标题/正文/代码继续使用 IBM Plex Serif / iA Writer Quattro S / Lilex，中文分别回退 `--font-serif` 与 `--font-sans`，不额外下载字体。实际中文字体取决于设备，macOS 优先 Songti SC / PingFang SC。Landing Button 直接继承生产 DS 的 16px 平滑圆角、微弱面光和按压反馈；主按钮与 Footer 共用 `--primary`，首页继续固定浅色，因此使用 #395875。Footer Folune 字形、8% 描边与 4px/16% 细斜纹维持原层序。品牌 PNG 不作任何变换。

- Light Primary `#395875`, Hover `#304D67`, Active `#284158`, Soft `#EAF0F4`
- Dark Primary `#91ABC4`, Hover `#A0B8CE`, Active `#7B95AE`, Soft `#29343F`
- Meaning: dried-ink character with enough clarity for a durable digital Primary
- Contrast: Light Primary with near-white foreground `7.10:1`; Dark Primary with dark foreground `6.38:1`

### Landing 侧轨（2026-09-21 用户修正）

只在评价、指南、首页博客延伸墨蓝结构：每侧固定七条、端部与内部空隙等分的细纵线、每侧三组横向回环编织、完整小方格加密点阵。纹样上下铺满，取消纵向净空与渐隐，左右两端各 16% 范围渐隐。纸缘在轨间八等分点放置七条内线；主横纹以 36 源单位行距排列，大、小弧振幅为 18/14.25，小弧比大弧低约 20.8%，相邻弧最窄留缝 3.75 单位；大弧保持上一版的 18，仅小弧从 15.75 收至 14.25。次层仍为纵向振幅 32 的横向长幅摆线，相邻行翻转。纵向周期为横向的 15/16，SVG 高度为 72，行基线同步收紧。20px 网格/10px 点距保持；主线 17%、回环次曲线 8.5%、网格 9%、点 26%。正文和其他区块留白不变。已收紧至窄缝并拉开大小差异；本次构建与 git diff --check 通过，此前页面参数与小样检查不覆盖此次修正，完整页面视觉仍未验，Safari 与原生 125% 缩放未验，工程与截图证据边界见 `docs/landing-refactor/side-rails-plan.md` 第 12 节。

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

- Compact `8px`: dense tree rows, menu hover rows, pinned-note chips and small navigation targets
- Control `16px`: Button, Input, Select, SidebarButton, user message and tool-call bubbles
- Paper / Menu `12px`: editorial Paper, code surfaces, popovers
- Panel `16px`: workspace panels, cards, composite inputs
- Dialog `20px`: modal decision surfaces
- True circles and pills are reserved for avatars, status dots and the AI Composer's singular 32px send/stop action; Panel Toggle and other icon commands use the shared Control radius, never pill geometry.

### Control softened together (2026-09-07)

- Control is now 16px, with an explicit 12px inner-control radius. This supersedes the earlier 12px/9px decision and applies to the entire control family, including AI message and tool-call bubbles.
- Keep the shared squircle and 32/36px heights; do not introduce per-button radii or capsule geometry. Paper/Menu, Panel and Dialog retain their separate surface roles.

### Curve ownership (2026-09-07)

- Every non-circular App surface declares `corner-shape: var(--corner-shape-smooth)` beside its radius. Nested clipping shells inherit both properties; do not maintain a separate selector list that can omit surfaces.
- Menu shells use Menu 12px; hover rows and pinned-note chips use Compact 8px, never Control 16px. No local radius arithmetic or new curve is allowed.
- Ordinary commands, including Canvas preview and Toast dismissal, use Control/Compact. Geometric avatars, status dots, resize handles, spinners and Composer send/stop retain explicit round geometry. Brand artwork retains its signature exception.
- Unsupported browsers keep the radius fallback without JavaScript emulation.

### corner-shape is not a softener

- `corner-shape: squircle` is `superellipse(2)` — a convex curve **between** `round` (`superellipse(1)`) and `square` (`superellipse(infinity)`). At an identical `border-radius` a squircle therefore reads *squarer* than the default arc, and larger superellipse values approach a right angle.
- The squircle earns its keep at larger radii, where continuous curvature becomes legible; at small radii it only spends the radius. So when a surface still reads too square after this step, the next move is the radius step, never a higher superellipse.
- Nested concentricity: inner radius starts from outer radius minus the full inset gap, padding and border both, but that subtraction is only a candidate under `corner-shape`, not the final truth. The 2026-09-01 implementation compared Button/Input/Select/composite nests in Light and Dark at 100% and 125%, then froze `--radius-inner-control` as an explicit `9px` (superseded by 12px on 2026-09-07); visual judgment selected the number once, it is not an unwritten runtime rule.

### Rejected: capsule buttons (2026-09-01)

Moving the 36px Button family to `999px` was evaluated and rejected. The Composer's 32px send/stop action is a signature precisely because nothing else in the product uses pill geometry; turning every button into a capsule would erase that uniqueness in exchange for softness that the shared Control step delivers. The product stays with a controlled rounded rectangle.

## Workspace panel controls

- A closed Library or AI surface is represented by one fixed Ghost icon at the corresponding canvas edge: no resting background, border, shadow, visible label or width expansion. Expanded Panels own their close command inside the Header instead of reusing an overlaid EdgeDock.
- The Library Header keeps the compact BrandMark on the left and its close control at the far right. Search and a 32px Primary split create action share the next row; the split is approximately 80px wide (`48px + 32px`), its main region carries only the label `新建` and creates a memo, and its menu lists only `Canvas` and `文件夹`. The removed NotePencil glyph must not return as decoration.
- The AI Header is one quiet 48px row: a 16px history menu, one truncated conversation title, a 16px MessageCirclePlus new-conversation action and a matched PanelRightClose trailing command. The closed Canvas state uses the paired PanelRightOpen glyph; it never shows a ChatCircleDots substitute. It never shows a ThinkingMark, product subtitle or permission pill; the empty conversation body remains blank until a future evidence-backed welcome surface is designed.
- AI permission remains available as a 32px/16px Ghost shield in the Composer footer, with its readable mode exposed through tooltip, accessible name and the upward menu rather than permanent Header text.
- The Composer's right-side send/stop action is a 32px geometric circle using the Primary Button material; it explicitly uses `corner-shape: round` instead of inheriting the global Button squircle, and both states keep identical geometry so streaming never shifts the footer silhouette.
- Paper's AI organize command is the single core action on the Paper toolbar and carries a text label, but it is **not** a Filled Primary — see `Paper toolbar` below. Its hierarchy, placement and state behaviour are frozen in [PAPER_CONSTITUTION.md](../PAPER_CONSTITUTION.md). The Library's create split keeps the Filled Primary material: it is the creation anchor of a separate Panel context, and "one high-emphasis Primary per screen" is counted per view/context, not per application.
- The Library search trigger only opens the single global Command Palette. The `[搜索] [新建 │⌄]` row remains mounted, keeps its geometry and never transforms into a local input, hides the create control or jumps layout while search is open. File-library code must not introduce a second search owner or local result tree.
- Panel entry/exit uses restrained x/opacity Tween motion. Controls do not fly across the panel through shared layout identity, and panel contents are never compressed with scaleX.

## Paper toolbar

- The Paper toolbar is sticky **inside** the Paper, not a floating layer above it. It **never** carries a bottom rule, a background of its own or a shadow — at rest or condensed: the controls simply sit in the Paper's top padding and read as part of the sheet.
- The toolbar belongs to the Paper, so it uses the Paper's surface and the Paper's colour. There is no such thing as "the toolbar's background": what condensation spreads is the sheet itself, drawn from the same one `--paper-surface` token. The moment a second surface appears, the toolbar has become a floating layer, which §7 of the constitution forbids.
- Sticky top is `--workspace-panel-inset` (16px desktop), never `0`. The bar shares one horizontal rail with the left/right Panel headers; pinning it to the browser edge takes it off the sheet.
- Trailing command order is frozen as `整理` → `Canvas` → `阅读/编辑` → `更多`; organize is separated from the icon cluster by `8px`, while adjacent controls inside the cluster use `4px`. Hierarchy comes from the organize label/32px hit geometry, the 32px icon controls, current-state feedback and More's right-aligned menu — not from a divider. `更多` is always last because its menu drops right-aligned into the sheet.
- Once the body title scrolls out of view the bar condenses. Scroll `24→80px` drives exactly one animated value — `--toolbar-condense-progress`, a registered `<number>` — and every other quantity is multiplied out from it where it is consumed: the opaque `paper-surface` sheet is anchored to the bar's **bottom** and grows upward to `--toolbar-condense-cover` (`--panel-header-height + --workspace-panel-inset`, 64px desktop), and the soft lower edge starts at that constant bottom line and grows to `--toolbar-edge-max` 16px. **No hairline is drawn — not at any progress.** A rule under the commands makes the eye read everything from the window's top edge down to it as one 64px object, which is exactly the toolbar becoming a thing that widens as you scroll; the boundary is stated by the soft edge alone. Scroll `36→80px` fades the note title in with no spatial displacement.
- `24 / 80` are constrained, not chosen. The sheet must cover the strip above the sticky rail before body text can reach it, and text reaches the bar's bottom at `1px sheet border + the body column's top padding` — as little as 33px on the ≤767px layout where that padding drops to `2rem`. So the range must start no later than that and be no longer than the sheet's travel. Changing `.note-editor-canvas` top padding re-opens this arithmetic; see PAPER_CONSTITUTION.md §4.3. Scrolling back to the top melts along the same path. Driven by `animation-timeline: scroll(nearest block)` with explicit `linear` and `animation-duration: auto` (progress-based timelines ignore a time duration), so nothing runs per frame in JS; browsers without scroll timelines get one sentinel plus `IntersectionObserver` transitioning the same single progress.
- The soft lower edge carries the only blur in the bar. Its `backdrop-filter` radius is `--toolbar-edge-blur` 6px times the same progress, so at rest it is `blur(0)` on a zero-height band — there is no resident frosted strip. Inside the band the paper gradient answers "how much is covered" and the mask answers "how far the blur reaches"; the mask outlasts the paper veil, so body text goes soft before the sheet eats it. Both gradients use relative stops, so their shape grows with the 16px rather than being stretched across a fixed length. The paper gradient must be fully opaque at `0%` so the band meets the sheet with no seam — anything less ghosts a line of text right where the sheet is supposed to end.
- The condensed **surface** is the whole sheet, not glass: no `backdrop-filter`, no shadow, no per-button floating material. A translucent bar would let body text read through the commands. Blur exists only in the soft lower edge described above, and only as a function of scroll progress.
- Above the bar there is only sheet. The strip between the sticky rail and the top of the scroll viewport becomes sheet interior as soon as the page scrolls, and a half-line of body text clipped there is the loudest possible version of "the body went behind the bar". Bottom anchoring is what makes this hold — and because the cover is the same sheet in the same colour, covering that strip states nothing new: it does not become a top edge.
- Commands sit right, never on the Paper's centre axis. The left side is identity ("where you are"), the sides are capability ("what you can do") — a centred command bar belongs to tools that act on every line of the body, which none of these do.
- No resident folder path. The archive location is stated by the archive-status element in the left identity group, which has cause, timing and interaction; a resident path has none of the three. Its visible copy is `归档于〈末级目录〉`; the complete path belongs to tooltip and accessible name.
- Hover uses the shared neutral `interactive-hover` surface — the three ghost icon commands override the Button ghost default `--muted` to reach it, so the icons and the archive-status element next to them cannot answer "what happens when I point at this" two different ways. Press is the shared `--press-scale` / `--motion-press` in-place tightening on every control including archive-status. Organize is the single exception and only on hover, where `primary-soft` expresses Quiet Accent hierarchy rather than neutral feedback.
- The blurred Soft Ink underline marks **current state only** (reading/editing) and is never applied to a command.

### Quiet Accent — the organize action's material (2026-09-02)

The organize command keeps its `32px` hit geometry (see the 2026-09-04 refinement below — the toolbar owns that height, not the control), `16px` semantic glyph, existing `14/18px` Button typography and `12px` Control curvature. Only its material level changes, and it consumes existing `primary` / `primary-soft` / Processing tokens on `.note-organize-button` rather than introducing a global Button variant or a raw color.

| State | Spec |
| --- | --- |
| Rest | Background, border and outer shadow all transparent; icon + `整理` always present; foreground is the existing Soft Ink `primary` |
| Hover | Faint `primary-soft` surface, foreground moves to `primary-hover`; no stroke, no displacement, no outer shadow |
| Focus | Global focus ring retained — color alone never carries focus |
| Active | `scale(--press-scale)` with a slightly deeper soft surface, 90ms; no `translateY`, no rebound |
| Loading | The shared Processing surface, spinner and `aria-busy`; it may condense into a solid **while the task runs**, because there the solid expresses state |
| Success / Failure | Returns to Rest; the archive-status element, archive cord or a Toast states the result — the button is not a result display |
| Reduced Motion | Scale removed; color, surface and focus feedback stay |

Hiding here means hiding the container's body only. Icon, label, hit area and shortcut are never hidden, and nothing is hidden in response to typing, focus or pointer idle.

### Paper toolbar spacing refinement (updated 2026-09-22)

The Paper command row uses an 8px gap between the text-labeled organize action and the compact icon cluster. Canvas, reading/editing and More remain one cluster with 4px gaps between adjacent controls. All four command hit areas, including organize, share the 32px compact height, as does the archive-status element on the left — and that height is declared once for the toolbar rather than on each control, so a control added later is aligned by construction. The three square commands add only the second dimension, which puts container, hit area and the 16px glyph on one centre. The organize label keeps its existing typography and Quiet Accent material, with a static 0.0625rem downward optical adjustment on its own text span; icon and spinner centers stay on the toolbar axis.

## Archive Cord signature

- Archive Cord is a spatial explanation of one durable fact — where AI placed the current memo — not a notification, progress indicator or decorative flourish.
- The semantic source is the quiet archive-status text in Paper's left identity group. It has no standalone port, permanent status dot, badge body or ornamental terminal.
- The canonical target is always the memo. Rendering resolves the nearest representation currently available in the tree: the memo row when its ancestry is expanded, otherwise the nearest visible ancestor folder, and only then the top/bottom edge of the tree viewport when that representative is off-screen.
- A visible row is anchored on its Paper-facing edge, never its centre. A viewport-edge projection communicates direction through the curve's tangent and restrained fade/taper; it does not add an arrow, centre marker, text label or floating hint.
- Fresh success draws once with one extremely light flow, then settles into a persistent low-contrast hairline. Restoring the page, reopening Library, resizing, scrolling or changing the visible representative does not replay fresh motion.
- Hovering the archive status, the current representative row or the transparent path hit area raises one shared emphasis state. The row never receives a permanent saturated fill; settled context uses only a restrained hairline/ink change, and narrow overlay layouts retain that same quiet row emphasis without drawing a cross-layer cord.
- Geometry follows scrolling, Panel motion and tree FLIP every frame while those surfaces move, but the cord itself never oscillates, springs, overshoots or lags. Its life comes from continuous spatial truth, not autonomous animation.
- Reduced Motion skips fresh draw/flow and representative interpolation, presenting the correct settled endpoint immediately.

## Paper geometry

- Main writing Paper: fixed **7:9** opening, **height first** at desktop sizes. `paperHeight = viewportHeight - 2 × --workspace-panel-inset`, `paperWidth = paperHeight × 7 / 9`; there is no width cap. Content may extend the sheet downward without creating an inner paper scroller.
- Paper and the Panels are not a row of sibling containers — they are **three layers**: Stage background, the Paper resting on it, and the Panels floating on top of the Paper. A floating layer's edges say nothing about the edges of the sheet beneath it, so the Paper does not take its top padding or its top boundary from the Panels.
- **At its minimum opening the sheet is geometrically congruent with the Panels**: its top and bottom edges land on the same inset rail (16px desktop), so an empty or short note produces no stage scrolling at all.
- **Past that minimum page height the sheet leaves the Panels' height behind and only grows downward.** The single `paper-stage-scroll` still owns the scrolling; the sheet never gains an inner scroller.
- **The sheet's top is never given an artificial boundary.** While scrolling it keeps extending above the window — that is one continuous sheet leaving the frame, not a sheet ending on a line. Nothing may be introduced above the toolbar to mark a new top edge: no rule, no colour band, no stage gap, no second surface. See PAPER_CONSTITUTION.md §4.2.

  | Viewport | Panel/Paper height | Paper width |
  | --- | ---: | ---: |
  | 1280×720 | 688px | 535px |
  | 1440×900 | 868px | 675px |
  | 1920×1080 | 1048px | 815px |

  Borders may shift these by ±1px.
- Compact fallback: when `paperWidth + 2 × inline safe area > viewport width`, available width wins and exact bottom alignment is abandoned — the sheet is never cropped horizontally. The fallback is triggered by real viewport/container geometry, not by a breakpoint number.
- Body column width stays independently controlled, so a wider sheet never lengthens the measure.
- Canvas memo card: the same **7:9** projection, retaining the `280×360` baseline.
- Canvas reader overlay: ISO 216 **1:√2**, because its height-constrained modal geometry is different from the width-constrained writing sheet.
- Narrow screens abandon the fixed opening and use the available viewport. Paper proportion never outranks operability.

## Canvas controls

- Bottom controls use two separate neutral surfaces with whitespace between them: one icon-only `加入笔记` content action using the semantic `FilePlus` glyph, and one viewport group for fit, `ZoomOut`, `ZoomIn` and help. Both groups share the same Ghost control material; separation expresses the semantic boundary without a persistent accent fill. The add action keeps an explicit accessible name/tooltip and never changes material according to node count.
- The card's single connect handle uses a grip glyph, sits in the last slot of the metadata row — equidistant from the two content actions, since the corner-riding bump broke the sheet's outline — and replaces the former `关联` icon. It appears with the metadata actions on hover/focus/selection, disappears when dragging starts, and is a grab handle rather than the persisted edge endpoint.
- The braided elastic cord is a spring, not a hemp rope: its coil count is constant, so pulling only stretches the same coils flat and `coiled` versus `pulled straight` are two states of one object. A fixed wavelength that grows the coil count reads as slack instead of tension, and clamping the count switches behaviour mid-drag. Distant cords stay visibly wavy through the amplitude floor. Its tail fan around the drop bead is a phase-independent constant, because the wave and strand-gap terms cancel at the frozen Reduced Motion phase.
- The braided elastic cord exists only while the connection gesture is active. Releasing destroys it and lets the existing static `CanvasCordEdge` appear through its current draw receipt without geometry rebound, width normalization or visual inheritance from the temporary cord.

## Do not invent

Two families are deliberately absent, and their absence is load-bearing:

- **No generic status pill or badge family.** In-flight actions use Button loading, operation results use Toast, and durable information uses contextual text or structure. A badge family looks harmless and then becomes the place every unresolved hierarchy question gets dumped.
- **No outline variant, Textarea primitive, Token Override layer, theme generator or runtime contrast tool.** Each of these turns a decided system back into a configurable one.

One axis is deliberately singular:

- **The token axis is light/dark only.** `system` may resolve the device preference, but it must never produce a third token set, a preset selector, a version storage key or an alternate visual system. Semantic values stay centralized in `src/index.css`; responsibility-specific CSS modules consume tokens and never hold raw color.
- Loading is an orthogonal interaction state, not a new color variant.

## Iconography

- Product icons use the shared `Lucide React` registry in `src/shared/design-system/icons.tsx`, not direct third-party imports in business files.
- The default contract is a 24×24 viewBox, 2px stroke, round caps/joins, `currentColor`, and 14/16/20/24px rendered sizes. Filled variants are not used to create a second visual language; selection and status use color/surface semantics.
- **One glyph, one product meaning.** As of 2026-09-01 `Plus` was standing in for three unrelated commands (add a memo to a Canvas, zoom in, relate this card) and `WandSparkles` for two opposed AI verbs (organize, which collapses a note into the tree, and expand, which grows new nodes from it). Zoom takes `ZoomIn`/`ZoomOut`, adding takes `FilePlus`, the connect handle takes a grip glyph, and the two AI verbs must not share a mark — organize is a collecting motion, expand is a spreading one. A glyph reused across meanings is a defect, not a shorthand.
- BrandMark, ThinkingMark, Archive Cord and Google branding remain explicit local/signature exceptions rather than general-purpose icon families.
- `border-radius` is the cross-browser baseline; supported browsers progressively receive the same squircle curve without changing component dimensions.

## Button material

- Filled faces use only an extremely shallow `180deg` lightness shift inside the same semantic color. The material must read as a solid button first, never as a gradient, glass, metal, plastic or glossy strip.
- Primary, Secondary and Danger do not draw a crisp full-perimeter inset ring. A broad, low-opacity top inset may support the face, but it must not resolve as an outline.
- Rest uses a short neutral gray-black grounding shadow. Hover remains in place while the neutral shadow becomes slightly softer and wider. Press removes the outer shadow and keeps only a shallow inset compression.
- Primary and Danger may add one very weak, downward-biased same-color ambient layer behind the neutral shadow; it is auxiliary separation, never blue/red glow. Secondary stays neutral and Ghost carries no solid-button shadow.
- Press tightens in place with `transform: scale(var(--press-scale))` (`0.98`, 90ms, center origin). No `translateY` drop, bounce or overshoot curve. Split controls scale as one shell, loading and disabled never scale, and Reduced Motion keeps the active color, border and shadow compression without the scale.
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

## Motion System

The motion language is part of the Design System. `src/shared/design-system/motion.ts` is the single source for shared durations, easing and springs and generates the CSS declarations consumed by controls. Full A/B decisions, component recipes and verification evidence live in [MOTION_SYSTEM.md](MOTION_SYSTEM.md). Menus use anchored 160/130ms presence, modals retain the 10px/0.985 reveal, Panels use an 8px non-bouncing 220/170ms transition, and tree disclosure shares the 210ms FLIP timeline. Reduced Motion removes spatial changes and keeps at most 90ms opacity feedback. Paper/Canvas geometry retains its dedicated browser View Transition contract.

## Neutral loading and settings (2026-09-07)

- Secondary uses a restrained, visible 1px neutral border in rest and hover; tool calls consume the same material. Result icons contain their own circular outline, with no additional status box.
- Skeleton base/highlight are achromatic: Light #ebebeb/#f6f6f6, Dark #363636/#454545. Loading placeholders never borrow brand blue. Canvas entry keeps only its clean Stage and accessible busy state, with no pretend paper card.
- Dark settings scope neutral charcoal surfaces (#1c1c1c main, #262626 sidebar), gray borders and neutral navigation states to the account dialog. Brand actions and keyboard focus retain their semantic color.
- Assistant undo uses Undo2 and the short label 撤销, with the shared 12px/16px Label typography.

2026-09-07 Menu consistency: All App popup menus (approval, More, create, context, mentions, Select and user menu) share one material rule in design-system.css: opaque Popover, semantic border/foreground, Menu radius, 4px inset and shadow-sm. Approval selection uses a check mark; only hover and keyboard focus paint the neutral row surface.

2026-09-07 Scrollbar refinement: Scrollbars use a transparent track and a quiet neutral-gray thumb (Light rgb(96 96 96) at 11% alpha, Dark rgb(190 190 190) at 13% alpha). Keep native thin scrollbars and system forced-colors behavior. Library and conversation scrollports reach the Panel edge; their 12px content padding stays inside the scrollport, so overlay thumbs never cover text. Other text/list scrollports reserve a stable native gutter without adding another painted track.

## Canvas manipulation and selection (2026-09-20)

- Static selection and marquee selection retain the quiet thin Soft Ink outline. Animated edges mean the pointer is holding an object, not that an object remains selected. Pressing a draggable card starts feedback immediately; release, cancellation, Escape and window blur remove it immediately without an exit animation. Buttons, handles, modifier selection and Space panning do not start it.
- Holding a selected card or the existing group box applies the same feedback to the movable cards in that group. React Flow retains sole ownership of selection, dragging and geometry.
- When a selection frame hugs exactly one memo card, both the native React Flow frame and its temporary replacement use the card's Panel radius and smooth corner shape. Multi-object range boxes and native text remain rectangular; the marquee gesture rectangle is unchanged.
- The manipulation contour uses a 2.5px Soft Ink stroke at 92% opacity, with a 3px near glow at 20% and an 8px diffuse glow at 14%. It replaces the regular outer line at the same footprint; no inset second frame, dilation, lift or scale. Both themes consume `--primary`; text and paper stay unchanged.
- The effect now uses the React Bits ElectricBorder component's original ten-octave 2D noise and native parameter semantics directly: `speed={0.7}`, `chaos={0.03}` (upstream defaults: 1 and 0.12). The custom traveling-wave implementation and its conversion parameters are removed. The original noise is sampled with a directional coordinate mapping: waves originate at the bottom-right corner, travel up the right/top and across the bottom/left edges, and converge at the top-left. Endpoints taper; the texture translates continuously without reversing. The added `flow` option belongs to this integration, not the upstream API.
- Integration changes are limited to local layout measurements for React Flow zoom, 2.5px line width, semantic color, smooth card corners, animation suspension, and directional noise-coordinate mapping. The upstream neon glow layers are hidden; only the animated outline and two soft, same-color edge glows following the actual animated contour are shown.
- Reduced Motion retains a static manipulation contour only while held. Offscreen/background painting stops, and forced-colors uses a system outline. No gesture or animation state enters Canvas persistence.
