/**
 * [INPUT]: 依赖视口宽度与 Canvas 左右面板的布尔状态，不依赖 React、Store 或 DOM
 * [OUTPUT]: 对外提供 Canvas 面板断点常量、CanvasChromeState/CanvasEntryIntent 类型、clampCanvasChrome 与 resolveCanvasEntryChrome 纯策略；新建双收起、从笔记进入继承工具状态，只有文件树切换继承现状、直接链接恢复快照
 * [POS]: shared/store 的 Canvas 侧栏进入策略；只回答“刚进入这张画布的那一刻左右面板各自应该是什么”，进入之后的开关一律以用户操作为准，且永不读写 Paper 的用户级偏好
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** <1200px 两个面板都是带遮罩的覆盖抽屉，进入画布时先呈现完整背景 */
export const CANVAS_PANEL_BREAKPOINT = 1200;
/** <1400px 两个浮层同时打开会遮住大部分有效背景，因此二者互斥 */
export const CANVAS_DUAL_PANEL_BREAKPOINT = 1400;

export type CanvasChromeState = {
  assistantOpen: boolean;
  libraryOpen: boolean;
};

export type CanvasEntryIntent =
  /** 直接链接或刷新：没有导航语境，恢复这张画布自己的最近状态 */
  | "direct"
  /** 从笔记进入它的默认 Canvas：只切中央内容，继承当前工具状态 */
  | "memo_default"
  /** 新建独立 Canvas：一张全新的空画布，不继承任何现状也没有快照可恢复 */
  | "standalone"
  /** 从文件树切换到已有 Canvas：普通对象切换，不打断用户已有布局 */
  | "tree";

const CLOSED: CanvasChromeState = { assistantOpen: false, libraryOpen: false };

export const clampCanvasChrome = (
  chrome: CanvasChromeState,
  viewportWidth: number,
): CanvasChromeState => {
  if (viewportWidth < CANVAS_PANEL_BREAKPOINT) {
    return CLOSED;
  }
  if (
    chrome.libraryOpen
    && chrome.assistantOpen
    && viewportWidth < CANVAS_DUAL_PANEL_BREAKPOINT
  ) {
    return { assistantOpen: false, libraryOpen: true };
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
  // 笔记切到画布只替换内容，工具状态继承；独立新建仍由自己的进入策略决定。
  const base: CanvasChromeState = (input.intent === "tree" || input.intent === "memo_default")
    ? input.inherited ?? CLOSED
    : input.intent === "direct"
      ? input.snapshot ?? CLOSED
      : CLOSED;

  return clampCanvasChrome(base, input.viewportWidth);
};
