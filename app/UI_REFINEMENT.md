# SuperNote UI Refinement

> UI-only work log | Scope: `app/` | Data/Auth/API contracts are frozen.

## North Star

Keep V1 Classic Blueprint as the only visual baseline: a clear, restrained note-tool interface with cool blue-gray surfaces, compact controls, short shadows and one consistent semantic token source.

## Guardrails

- UI and interaction presentation only; do not change auth, memo, subscription, API, or AI data contracts.
- Keep `app/src/index.css` as the only color-value source; responsibility-specific CSS modules may only consume semantic tokens.
- Keep the visual token axis limited to light/dark; `system` may resolve the device preference but must not create a third token set, preset selector, version storage key or alternate visual system.
- Keep the Design System as a simple card matrix of production families: the existing controls, the shared Skeleton primitive, plus UserMessageBubble, AssistantMessage, ThinkingIndicator and ToolCallBubble; gallery cards may frame previews, but AssistantMessage itself must remain completely unframed.
- Do not invent outline, Textarea, Badge, Token Override, theme generator or runtime contrast tools.
- Respect reduced motion, keyboard navigation, focus visibility, mobile widths and long text.

## Progress

- [x] Audit visual hierarchy, spacing, typography, card usage, interaction states and responsive risks.
- [x] Refine global tokens, motion, focus, scrollbars, selection and component states.
- [x] Recompose Landing, product workspaces, Sidebar and Agent Panel around the V1 token system.
- [x] Add Button loading, PasswordInput, SidebarButton and Toast as reusable V1 primitives.
- [x] Restore the Design System to a minimal card matrix with real component previews.
- [x] Remove all alternate visual preset state, version switching and alternate token/style branches.
- [x] Synchronize GEB documentation and pass TypeScript/build/static quality checks.
- [x] Extract the complete AI message family, connect it to AgentPanel and archive every state in the Design System.
- [x] Centralize Skeleton visuals and timing, apply exact first-load placeholders to the App route/memo regions, and preserve cached content during background Profile refresh.

## Decisions

- Prefer unframed sections and thin separators in product pages; the development-only Design System uses only simple reference cards.
- Reserve Card for repeated objects, dialogs and genuinely framed tools.
- Keep shadows short and local; depth must never become glow.
- Reserve restrained depth for Button command affordance: a weak physical edge, valid neutral contact/short cast shadow and top inset highlight; keep every static background a clean solid color, forbid tinted bottom lowlights, keep hover fixed in place, and limit press travel to 1px while the shadow contracts.
- Treat SidebarButton as navigation behavior over the same Button material system: active and prominent states reuse Secondary Button tokens, while APP and account navigation share the default Button height.
- Use one smooth-corner curve for surfaced controls; Button, SidebarButton, SegmentedControl, UserButton, Select actions and sidebar tool buttons must not invent local corner geometry.
- Keep Secondary Button free of a strong outline; its shape comes from a pure card-colored surface, a weak neutral edge, a top highlight and short cast shadow, never from a tinted gradient or dark frame.
- Refresh Profile once when AccountDialog opens, keep the cached 4:3 settings surface interactive, and merge server refreshes per untouched field; do not replace already revealed account content with a repeated Skeleton, and never let section switches trigger duplicate requests.
- Group the settings sidebar by real information architecture: the current General group contains only Account and Appearance, with no duplicate sidebar title or placeholder groups.
- Present Theme and its system/light/dark choices on one line through the shared SegmentedControl; keep its track flat and never hide three stable choices behind Select.
- Keep account editing quiet: debounce username/bio saves by 800ms, acknowledge completion through Toast, and do not reserve a footer for a primary Save button.
- Keep tree navigation and rename intent separate: a row click only navigates or toggles once, while rename requires the context menu or focused-node F2 shortcut; double-click never enters edit mode.
- Keep page titles compact and interface-first; no marketing-scale typography inside the product shell.
- Keep the product shell as three always-visible, independently rounded Panels over one quiet desktop surface; panel widths remain resizable, but sidebar/Agent collapse and close states are deliberately absent.
- Present the selected memo as a centered floating paper surface inside the main Panel so content stays visually primary while navigation and Agent remain quieter tools.
- Keep the public Landing light and untextured; dark mode remains an explicit App preference only.
- Use display typography only for editorial headlines; product controls remain compact sans-serif or mono where a token/path is shown.
- Treat loading as an orthogonal interaction state, not a new color variant; keep semantic tokens centralized in `index.css`.
- Use the shared low-contrast Skeleton only for first-load regions with no stale content: delay it 180ms, keep a shown placeholder stable for at least 360ms, run one 3.6s wide shimmer per group, preserve final dimensions, reveal with opacity only, and disable decorative motion under reduced motion.
- Treat normal and privacy entry as one Input family; PasswordInput is a reusable composition, not a gallery-only mockup.
- Treat one AI turn as four separate responsibilities: Primary-themed user content, unframed assistant text, framed tool activity and a Formation ThinkingIndicator. `submitted`/pre-token streaming, active tools and StreamingText are mutually exclusive; no three-dot loader, stream cursor or timer-invented tool copy remains.
- Do not add a generic status pill or badge family; use Button loading for in-flight actions, Toast for operation results, and contextual text or structure for durable information.
- Treat CodeMirror as a third-party cascade boundary; its adapter consumes only the same light/dark V1 tokens.
- Treat memo editing as one quiet canvas: an independent plain-text title sits directly above the Store-controlled Markdown body, with no card, field chrome, divider, metadata strip or in-canvas save action.
- Keep root memo creation in the sidebar header as the shared Primary Button with a dedicated note-writing icon; place Design System and Trash outside the file tree as matching full-width navigation rows without an extra group label.
- Treat folder expansion as a per-user device preference: restore a versioned localStorage snapshot only after the memo tree is ready, preserve an explicitly all-collapsed tree, auto-open new folders and discard deleted folder ids without adding backend schema.
- Keep memo saving invisible and session-scoped: update editor/Store immediately, flush by character/idle/max-wait thresholds and lifecycle boundaries, retry quietly, and only surface the final failure while preserving the local draft byte-for-byte.
- Treat Markdown and WYSIWYG display as separate protocols: MarkdownEditor alone inflates database blank lines into editor-only zero-width paragraphs and deflates them before onChange; pages, Store, API and database never see the compatibility marker or HTML placeholders.
- Keep memo-tree drag feedback visually minimal but identity-aware: folders show their pure icon plus a single truncated name, memos show only their pure icon, both remain fully unframed with a faint blurred underglow, the source stays at 40% opacity, and relative placement uses an 8px leading dot with a 2px line while folder-inside remains a background state.

## Deferred Confirmation

- Whether the final brand voice should remain bilingual (`AI filing`, `Pricing`) or become fully Chinese.
- Whether the Landing product preview should later use real account data screenshots instead of deterministic mock state.

## Log

- 2026-08-06: Simplified the Design System to the V1 card matrix, removed the version selector and alternate preset state, deleted alternate token/style branches, and kept only the light/dark theme axis.
- 2026-08-07: Removed the generic status-pill component, its gallery card and all product usages; simplified memo saving to Button loading plus Toast feedback.
- 2026-08-07: Rebuilt Button as a restrained tactile system with centralized radius/material tokens, coordinated inner/outer depth, 1px press feedback and a low-frequency loading shimmer for Save actions.
- 2026-08-07: Removed SidebarButton's compact/oversized height branches and independent no-shadow selected style; APP, account settings and Design System now share the default Button height and Secondary Button material, while the Primary preview remains text-only.
- 2026-08-08: Refined the command palette to a cleaner modern blue, removed the visible Secondary outline, unified surfaced action controls on one smooth-corner curve and strengthened the loading shimmer with a narrow soft highlight and slower cadence.
- 2026-08-08: Fixed the memo tree indentation being overridden by SidebarButton's higher-specificity default padding, then added token-driven parent guides, child connectors, stronger folder contrast and current-branch emphasis so nested folders no longer read as one flat list.
- 2026-08-08: Added a real AccountDialog loading boundary: each open refreshes Profile once, renders a full sidebar/header/form/footer Skeleton under one global shimmer, ignores closed-dialog responses and falls back to the cached Profile with Toast feedback on failure.
- 2026-08-08: Removed the over-expressive memo-tree guides and branch emphasis; hierarchy now relies only on a restrained 16px depth step, while folder/memo rows use a denser 30px height and tighter label spacing.
- 2026-08-08: Reframed AccountDialog as a grouped settings surface: removed the redundant left title row, kept Account and Appearance under General, routed UserMenu Settings directly to Appearance, and replaced the theme Select with a system-aware three-option radio control that keeps CodeMirror on the resolved light/dark theme.
- 2026-08-08: Flattened Account details onto subtle dividers and removed the dedicated Save footer; username and bio now save silently 800ms after typing stops, remain editable during requests, and report completion through the global Toast.
- 2026-08-08: Collapsed Appearance theme selection into one line and removed its inset/raised two-layer surface; the three choices now reuse the shared Ghost and Secondary Button variants directly.
- 2026-08-08: Promoted the theme switch into a real shared SegmentedControl with controlled state, radio semantics and arrow-key navigation; replaced the now-unused Select card in the production component gallery.
- 2026-08-08: Removed memo-tree drag expansion entirely; transparent hit areas now sit over fixed boundaries without entering layout, so dragging preserves every 30px row and only the active target receives a 1px insertion line or in-place folder highlight.
- 2026-08-08: Removed inherited SidebarButton lift from folder/memo rows; tree items now keep transform none and no elevation shadow through hover, press and selection, while retaining only flat color feedback.
- 2026-08-08: Rebuilt Button material around clean solid variant colors, removed the tinted bottom lowlight and every static Button background gradient, then strengthened neutral contact/cast shadows for restrained thickness; raised AccountDialog Skeleton base/highlight contrast and accelerated its global shimmer so loading remains unmistakable in light and dark themes.
- 2026-08-08: Removed the redundant Caret from every folder row; Folder and FolderOpen now carry the complete collapsed/expanded signal through one fixed 16px icon slot shared with files, restoring exact same-depth title alignment.
- 2026-08-08: Removed double-click rename from memo-tree rows, ignored the repeated click of a rapid double-click, and moved rename to explicit context-menu or focused-node F2 commands with a visible shortcut hint.
- 2026-08-08: Rebuilt the product shell as three fixed smooth-corner Panels over a token-driven desktop surface, restored the memo as a floating paper surface, and removed the complete sidebar/Agent collapse chain including toggles, open state, Escape dismissal, mobile backdrop and collapsed-tree rendering branches while retaining resizable widths.
- 2026-08-08: Moved root memo creation into the sidebar header, then normalized Design System and Trash into two label-free, full-width bottom navigation rows outside the file tree.
- 2026-08-08: Replaced the framed memo form with one Obsidian-style canvas: a large plaintext title edits the independent title field, CodeMirror edits only content_mdx, and an 850ms/blur field-differential save removes metadata, dividers, redundant API writes and the in-canvas Save button.
- 2026-08-08: Persisted folder expanded ids as a versioned, per-user localStorage preference hydrated only after GET /memo-tree succeeds; refresh now preserves collapse state, while new folders open automatically and deleted ids are pruned without database or API changes.
- 2026-08-08: Replaced the single 850ms memo debounce with a per-memo autosave session: 32 changed characters, 1500ms idle or 8000ms max wait trigger one combined title/content PATCH, 400/800/1600ms retries absorb weak networks, and blur/switch/hidden/page exit flush without success noise or stale-response overwrites.
- 2026-08-08: Added a single MarkdownEditor storage/display adapter: clean content_mdx is inflated only for blank-line rendering, every zero-width marker is deflated before Store/autosave, and round-trip tests now cover long blank runs, indentation, trailing/multiple spaces, emphasis and CRLF without HTML hacks.
- 2026-08-09: Replaced the browser-generated full SidebarButton drag ghost with the existing folder/memo icon slot as a centered transparent drag image, removing the white rectangular backing without introducing a second preview component or changing drop/FLIP behavior.
- 2026-08-09: Refined memo-tree drag semantics by giving folders a compact icon-and-name native preview while keeping memos icon-only, dimming the source row to 40%, and upgrading before/after/root-end placement to a 2px line with an 8px leading terminal without changing optimistic moves or FLIP.
- 2026-08-09: Superseded the split drag-preview treatment with one minimal SVG-only preview for folders and memos, removed every capsule/square/name surface, added only a faint blurred halo, and promoted header memo creation to the shared Primary Button with a dedicated note-writing icon.
- 2026-08-09: Corrected the over-simplified folder ghost: folders again carry their truncated name beside the icon, while memos remain icon-only; both stay transparent and unframed with only a faint blurred underglow.
- 2026-08-08: Extracted the initial AI message family into the shared Design System and established separate user, assistant, tool and activity responsibilities; the following Motion pass supersedes its temporary activity visuals.
- 2026-08-08: Promoted Nodes / Formation into the production 1840ms Thinking Motion, added low-frequency neutral ThinkingStatusText, derived mutually exclusive Thinking/Tool/Streaming activity from real AI SDK status plus UIMessage parts, deleted the three-dot loader and StreamCursor, removed the tool spinner, and archived replayable text/tool flows in the Design System.
- 2026-08-09: Removed the oversized ThinkingMark research and AI Activity showcase surfaces after Formation was selected; the unchanged production mark and motion now live in one standard Design System card at 14/16/20px, matching every other component tile.
- 2026-08-09: Removed the global hover lift from Button, SidebarButton, Select and UserButton; hover/open states now stay at rest position and depth while retaining color or border feedback, with only the deliberate 1px press response preserved.
- 2026-08-09: Rebuilt Button after in-app browser inspection exposed the previous shadow composition as computed-value invalid; global tokens now own only theme-stable physical material while each variant resolves color at the component scope, keeping Landing light and App light/dark independent. Primary/Secondary/Danger combine a fine edge, neutral contact/short cast shadow and top highlight, active contracts to a 1px press, Ghost stays flat, loading/disabled/reduced-motion states remain orthogonal, and the Design System card shows every variant plus square/loading/disabled coverage.
- 2026-08-09: Superseded the repeated high-contrast AccountDialog placeholder with one shared low-contrast Skeleton system: `/app` Profile admission uses an exact three-Panel fallback, memo-tree/sidebar and paper reveal independently after an anti-flash delay, cached Profile remains visible during refresh with per-field merging, and light/dark/reduced-motion plus zero layout shift were verified in a real browser.
- 2026-08-09: Corrected the red-background cleanup boundary: restored the original solid destructive material for Danger Button as the only permitted red-filled component, removed residual destructive fills from menus/errors/toasts, and gave every non-Danger loading Button a distinct cool gray-blue surface plus a polished 3.4s low-frequency shimmer that remains directly visible in the Design System Button card.
- 2026-08-09: Fixed the remaining pale-red surfaces shown in the current Design System and product UI: sampled the visible `#fbf4f6`/`#f7f2f3` drift back to low-chroma OKLCH interpolation, replaced ToolCallBubble/Card/Input/SidebarButton/SegmentedControl surfaces with deterministic white or neutral tokens, fixed Skeleton at `#edf0f4`, moved all app CSS color mixing to sRGB, and kept Danger as the only solid red-filled component.
- 2026-08-09: Removed the false button affordance from the selected Design System and Trash utility rows: both now keep a transparent, borderless, shadowless, motionless surface and communicate the current workspace only through the primary foreground color plus `aria-current`.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
