/**
 * [INPUT]: 依赖 Zustand 与浏览器 localStorage，兼容旧 AgentPanel 单开关偏好
 * [OUTPUT]: 对外提供文件库/助手开关偏好、场景默认尺寸与当前展开期间的临时宽高/位置；大小切换和重开恢复默认几何
 * [POS]: shared/store 的工作台外壳 UI 状态源；助手跨空间连续，笔记默认全高、画布默认短窗；尺寸不写入持久偏好；不复制树、编辑器或会话数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

export type AssistantSize = "compact" | "expanded";
/** 临时浮窗完整几何只活在当前展开期间。 */
export type AssistantFrame = { width: number; height: number; right: number; bottom: number };

export const defaultAssistantSize = (canvasId: string | null): AssistantSize =>
  canvasId === null ? "expanded" : "compact";

const defaultAssistantGeometry = (canvasId: string | null) => ({
  assistantSize: defaultAssistantSize(canvasId),
  assistantFrame: null,
});

export type WorkspaceChromeState = {
  libraryOpen: boolean;
  assistantOpen: boolean;
  hydratedUserId: string | null;
  assistantSize: AssistantSize;
  assistantCanvasId: string | null;
  assistantFrame: AssistantFrame | null;
};

type WorkspaceChromeStore = WorkspaceChromeState & {
  closeAssistant(): void;
  closeLibrary(): void;
  hydrate(userId: string): void;
  openAssistant(): void;
  openLibrary(): void;
  toggleAssistant(): void;
  toggleLibrary(): void;
  enterAssistantScene(canvasId: string | null): void;
  setAssistantSize(size: AssistantSize): void;
  setAssistantFrame(frame: AssistantFrame): void;
};

type StoredWorkspaceChrome = Pick<
  WorkspaceChromeState,
  "assistantOpen" | "libraryOpen"
> & {
  version: 1;
};

const WORKSPACE_CHROME_KEY_PREFIX = "folune:workspace-chrome:v1:";
const LEGACY_AGENT_PANEL_KEY_PREFIX = "folune:agent-panel-open:";

export const workspaceChromeStorageKey = (userId: string): string =>
  `${WORKSPACE_CHROME_KEY_PREFIX}${userId}`;

export function parseWorkspaceChrome(
  stored: string | null,
): Pick<WorkspaceChromeState, "assistantOpen" | "libraryOpen"> | null {
  if (stored === null) {
    return null;
  }

  try {
    const snapshot = JSON.parse(stored) as Partial<StoredWorkspaceChrome>;
    return snapshot.version === 1 &&
      typeof snapshot.libraryOpen === "boolean" &&
      typeof snapshot.assistantOpen === "boolean"
      ? {
          assistantOpen: snapshot.assistantOpen,
          libraryOpen: snapshot.libraryOpen,
        }
      : null;
  } catch {
    return null;
  }
}

export function migrateWorkspaceChrome(
  stored: string | null,
  legacyAssistantOpen: string | null,
): Pick<WorkspaceChromeState, "assistantOpen" | "libraryOpen"> {
  return parseWorkspaceChrome(stored) ?? {
    assistantOpen: legacyAssistantOpen === "true",
    libraryOpen: false,
  };
}

// ---- localStorage 访问器降级 ----
// 访问器本身会抛 (SecurityError: 阻止全部站点数据 / QuotaExceededError: 配额满),
// 不只是里面的 JSON 会坏。范式取自 shared/theme/ThemeProvider.ts。
const readStoredValue = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const persist = (state: WorkspaceChromeState): void => {
  if (state.hydratedUserId === null) {
    return;
  }

  const snapshot: StoredWorkspaceChrome = {
    assistantOpen: state.assistantOpen,
    libraryOpen: state.libraryOpen,
    version: 1,
  };

  try {
    window.localStorage.setItem(
      workspaceChromeStorageKey(state.hydratedUserId),
      JSON.stringify(snapshot),
    );
  } catch {
    // 面板开关仍然可以在当前会话工作；持久化不可用时保持静默降级。
  }
};

const updateVisibility = (
  set: (
    partial: WorkspaceChromeStore | Partial<WorkspaceChromeStore> | (
      (state: WorkspaceChromeStore) => WorkspaceChromeStore | Partial<WorkspaceChromeStore>
    ),
  ) => void,
  update: (state: WorkspaceChromeStore) => Partial<WorkspaceChromeStore>,
) => {
  // persist 必须在 set() 之外: 放在 reducer 内且位于 return 之前时,
  // 一次写入异常会让开关连内存里都不翻转 (看起来彻底点不动)。
  let snapshot: WorkspaceChromeStore | null = null;

  set((state) => {
    const nextState = { ...state, ...update(state) };
    snapshot = nextState;
    return nextState;
  });

  if (snapshot !== null) {
    persist(snapshot);
  }
};

const isOverlayViewport = (): boolean => window.innerWidth < 1400;

export const useWorkspaceChromeStore = create<WorkspaceChromeStore>((set) => ({
  assistantOpen: false,
  hydratedUserId: null,
  libraryOpen: false,
  assistantSize: "expanded",
  assistantCanvasId: null,
  assistantFrame: null,
  closeAssistant: () => updateVisibility(set, (state) => ({ assistantOpen: false, ...defaultAssistantGeometry(state.assistantCanvasId) })),
  closeLibrary: () => updateVisibility(set, () => ({ libraryOpen: false })),
  hydrate: (userId) => {
    const storedPreference = readStoredValue(workspaceChromeStorageKey(userId));
    const preference = migrateWorkspaceChrome(
      storedPreference,
      readStoredValue(`${LEGACY_AGENT_PANEL_KEY_PREFIX}${userId}`),
    );
    // 恢复快照同样受窄屏互斥约束: <1400px 时两个 Panel 不得同开,
    // 否则窄屏刷新会绕过 openLibrary/openAssistant 的互斥规则。
    const resolved = preference.assistantOpen && preference.libraryOpen && isOverlayViewport()
      ? { assistantOpen: preference.assistantOpen, libraryOpen: false }
      : preference;
    // 旧快照的尺寸字段停止读取；刷新只恢复开关和场景默认窗口。
    const nextState = { ...resolved, hydratedUserId: userId, assistantCanvasId: null, ...defaultAssistantGeometry(null) };

    set(() => nextState);
    persist(nextState);
  },
  openAssistant: () => updateVisibility(set, (state) => ({
    assistantOpen: true,
    ...(!state.assistantOpen ? defaultAssistantGeometry(state.assistantCanvasId) : {}),
    ...(isOverlayViewport() ? { libraryOpen: false } : {}),
  })),
  openLibrary: () => updateVisibility(set, (state) => ({
    ...(isOverlayViewport() ? { assistantOpen: false, ...defaultAssistantGeometry(state.assistantCanvasId) } : {}),
    libraryOpen: true,
  })),
  toggleAssistant: () => updateVisibility(set, (state) => ({
    assistantOpen: !state.assistantOpen,
    ...defaultAssistantGeometry(state.assistantCanvasId),
    ...(!state.assistantOpen && isOverlayViewport() ? { libraryOpen: false } : {}),
  })),
  toggleLibrary: () => updateVisibility(set, (state) => ({
    ...(!state.libraryOpen && isOverlayViewport() ? { assistantOpen: false, ...defaultAssistantGeometry(state.assistantCanvasId) } : {}),
    libraryOpen: !state.libraryOpen,
  })),
  enterAssistantScene: (canvasId) => set((state) =>
    state.assistantCanvasId === canvasId ? state : {
      assistantCanvasId: canvasId,
      ...defaultAssistantGeometry(canvasId),
    }),
  setAssistantSize: (size) => set({ assistantSize: size, assistantFrame: null }),
  // 拖动不改变大小按钮的目标模式；只覆盖当前窗口几何。
  setAssistantFrame: (frame) => set({ assistantFrame: frame }),
}));
