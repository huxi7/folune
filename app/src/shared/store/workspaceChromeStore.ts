/**
 * [INPUT]: 依赖 Zustand 与浏览器 localStorage，兼容旧 AgentPanel 单开关偏好
 * [OUTPUT]: 对外提供按用户 hydrate 的文件库偏好与跨空间助手可见性、笔记尺寸/自定义浮窗偏好和当前场景尺寸命令
 * [POS]: shared/store 的工作台外壳 UI 状态源；助手跨空间连续，画布全高只在当次场景或明确原文返回时恢复；不复制树、编辑器或会话数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

export type AssistantSize = "compact" | "expanded";
/** 宽度由工作台原有共享偏好持有；此处只保存自由浮窗的高度与边缘位置。 */
export type AssistantFrame = { height: number; right: number; bottom: number };

export type WorkspaceChromeState = {
  libraryOpen: boolean;
  assistantOpen: boolean;
  hydratedUserId: string | null;
  assistantSize: AssistantSize;
  paperAssistantSize: AssistantSize;
  assistantCanvasId: string | null;
  assistantFrame: AssistantFrame | null;
  paperAssistantFrame: AssistantFrame | null;
};

type WorkspaceChromeStore = WorkspaceChromeState & {
  closeAssistant(): void;
  closeLibrary(): void;
  hydrate(userId: string): void;
  openAssistant(): void;
  openLibrary(): void;
  toggleAssistant(): void;
  toggleLibrary(): void;
  enterAssistantScene(canvasId: string | null, restoredSize?: AssistantSize, restoredFrame?: AssistantFrame | null): void;
  setAssistantSize(size: AssistantSize): void;
  setAssistantFrame(frame: AssistantFrame): void;
};

type StoredWorkspaceChrome = Pick<
  WorkspaceChromeState,
  "assistantOpen" | "libraryOpen"
> & {
  version: 1;
  paperAssistantSize?: AssistantSize;
  paperAssistantFrame?: AssistantFrame | null;
};

const WORKSPACE_CHROME_KEY_PREFIX = "folune:workspace-chrome:v1:";
const LEGACY_AGENT_PANEL_KEY_PREFIX = "folune:agent-panel-open:";

export const workspaceChromeStorageKey = (userId: string): string =>
  `${WORKSPACE_CHROME_KEY_PREFIX}${userId}`;

const parseAssistantFrame = (value: unknown): AssistantFrame | null => {
  if (value === null || typeof value !== "object") return null;
  const frame = value as Partial<AssistantFrame>;
  return [frame.height, frame.right, frame.bottom].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
    && Number(frame.height) > 0
    ? { height: frame.height!, right: frame.right!, bottom: frame.bottom! } : null;
};

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
    paperAssistantSize: state.paperAssistantSize,
    paperAssistantFrame: state.paperAssistantFrame,
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
  paperAssistantSize: "expanded",
  assistantCanvasId: null,
  assistantFrame: null,
  paperAssistantFrame: null,
  closeAssistant: () => updateVisibility(set, () => ({ assistantOpen: false })),
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
    let paperAssistantSize: AssistantSize = "expanded";
    let paperAssistantFrame: AssistantFrame | null = null;
    try {
      const stored = JSON.parse(storedPreference ?? "null");
      if (stored?.version === 1 && stored.paperAssistantSize === "compact") paperAssistantSize = "compact";
      if (stored?.version === 1) paperAssistantFrame = parseAssistantFrame(stored.paperAssistantFrame);
    } catch { /* 损坏偏好沿用笔记全高。 */ }
    const nextState = { ...resolved, hydratedUserId: userId, paperAssistantSize, assistantSize: paperAssistantSize, assistantCanvasId: null, paperAssistantFrame, assistantFrame: paperAssistantFrame };

    set(() => nextState);
    persist(nextState);
  },
  openAssistant: () => updateVisibility(set, (state) => ({
    assistantOpen: true,
    assistantSize: state.assistantCanvasId === null ? state.paperAssistantSize : "compact",
    ...(isOverlayViewport() ? { libraryOpen: false } : {}),
  })),
  openLibrary: () => updateVisibility(set, () => ({
    ...(isOverlayViewport() ? { assistantOpen: false } : {}),
    libraryOpen: true,
  })),
  toggleAssistant: () => updateVisibility(set, (state) => ({
    assistantOpen: !state.assistantOpen,
    assistantSize: state.assistantCanvasId === null ? state.paperAssistantSize : "compact",
    ...(!state.assistantOpen && isOverlayViewport() ? { libraryOpen: false } : {}),
  })),
  toggleLibrary: () => updateVisibility(set, (state) => ({
    ...(!state.libraryOpen && isOverlayViewport() ? { assistantOpen: false } : {}),
    libraryOpen: !state.libraryOpen,
  })),
  enterAssistantScene: (canvasId, restoredSize, restoredFrame) => set((state) =>
    state.assistantCanvasId === canvasId ? state : {
      assistantCanvasId: canvasId,
      assistantSize: canvasId === null ? state.paperAssistantSize : restoredSize ?? "compact",
      assistantFrame: canvasId === null ? state.paperAssistantFrame : restoredFrame ?? null,
    }),
  setAssistantSize: (size) => updateVisibility(set, (state) => ({
    assistantSize: size,
    ...(state.assistantCanvasId === null ? { paperAssistantSize: size } : {}),
  })),
  setAssistantFrame: (frame) => updateVisibility(set, (state) => ({
    assistantSize: "compact",
    assistantFrame: frame,
    ...(state.assistantCanvasId === null ? { paperAssistantSize: "compact", paperAssistantFrame: frame } : {}),
  })),
}));
