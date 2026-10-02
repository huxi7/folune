/**
 * [INPUT]: 依赖视口宽度与 Canvas 文件库状态，不依赖 React、Store 或 DOM
 * [OUTPUT]: 对外提供文件库进入意图、断点与纯解析策略；笔记/文件树继承文件库、新建关闭、直达恢复快照
 * [POS]: shared/store 的 Canvas 文件库进入策略；助手已由 workspaceChromeStore 跨空间持有，本策略不裁决助手可见性或尺寸
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** <1200px 文件库使用遮罩抽屉，进入画布时先呈现完整背景。 */
export const CANVAS_PANEL_BREAKPOINT = 1200;
/** <1400px 两个浮层同时打开会遮住大部分有效背景，因此二者互斥 */
export const CANVAS_DUAL_PANEL_BREAKPOINT = 1400;

export type CanvasChromeState = {
  libraryOpen: boolean;
};

export type CanvasEntryIntent =
  /** 直接链接或刷新：没有导航语境，恢复这张画布自己的最近状态 */
  | "direct"
  /** 从笔记进入它的默认 Canvas：只切中央内容，继承当前文件库状态 */
  | "memo_default"
  /** 新建独立 Canvas：一张全新的空画布，不继承任何现状也没有快照可恢复 */
  | "standalone"
  /** 从文件树切换到已有 Canvas：普通对象切换，不打断用户已有布局 */
  | "tree";

const CLOSED: CanvasChromeState = { libraryOpen: false };

export const clampCanvasChrome = (
  chrome: CanvasChromeState,
  viewportWidth: number,
): CanvasChromeState => {
  if (viewportWidth < CANVAS_PANEL_BREAKPOINT) {
    return CLOSED;
  }
  return chrome;
};

export const resolveCanvasEntryChrome = (input: {
  intent: CanvasEntryIntent;
  /** tree 切换时“保持现状”的那个现状，在导航发生的那一刻捕获而不是事后猜测 */
  inherited: CanvasChromeState | null;
  /** 这张画布自己的最近状态，只服务 direct 进入 */
  snapshot: CanvasChromeState | null;
  viewportWidth: number;
}): CanvasChromeState => {
  // 笔记切到画布只替换内容，文件库状态继承；独立新建仍由自己的进入策略决定。
  const base: CanvasChromeState = (input.intent === "tree" || input.intent === "memo_default")
    ? input.inherited ?? CLOSED
    : input.intent === "direct"
      ? input.snapshot ?? CLOSED
      : CLOSED;

  return clampCanvasChrome(base, input.viewportWidth);
};
