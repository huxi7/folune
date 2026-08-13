/**
 * [INPUT]: 依赖 Zustand 与浏览器 localStorage，兼容旧 AgentPanel 单开关偏好
 * [OUTPUT]: 对外提供按用户 hydrate 的 WorkspaceChromeState，以及文件库/AI 独立 open/close/toggle 命令
 * [POS]: shared/store 的工作台外壳唯一 UI 状态源；只保存左右工具可见性，不复制树、编辑器或会话数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

export type WorkspaceChromeState = {
  libraryOpen: boolean;
  assistantOpen: boolean;
  hydratedUserId: string | null;
};

type WorkspaceChromeStore = WorkspaceChromeState & {
  closeAssistant(): void;
  closeLibrary(): void;
  hydrate(userId: string): void;
  openAssistant(): void;
  openLibrary(): void;
  toggleAssistant(): void;
  toggleLibrary(): void;
};

type StoredWorkspaceChrome = Pick<
  WorkspaceChromeState,
  "assistantOpen" | "libraryOpen"
> & {
  version: 1;
};

const WORKSPACE_CHROME_KEY_PREFIX = "supernote:workspace-chrome:v1:";
const LEGACY_AGENT_PANEL_KEY_PREFIX = "supernote:agent-panel-open:";

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

const persist = (state: WorkspaceChromeState): void => {
  if (state.hydratedUserId === null) {
    return;
  }

  const snapshot: StoredWorkspaceChrome = {
    assistantOpen: state.assistantOpen,
    libraryOpen: state.libraryOpen,
    version: 1,
  };
  window.localStorage.setItem(
    workspaceChromeStorageKey(state.hydratedUserId),
    JSON.stringify(snapshot),
  );
};

const updateVisibility = (
  set: (
    partial: WorkspaceChromeStore | Partial<WorkspaceChromeStore> | (
      (state: WorkspaceChromeStore) => WorkspaceChromeStore | Partial<WorkspaceChromeStore>
    ),
  ) => void,
  update: (state: WorkspaceChromeStore) => Partial<WorkspaceChromeStore>,
) => set((state) => {
  const nextState = { ...state, ...update(state) };
  persist(nextState);
  return nextState;
});

const isOverlayViewport = (): boolean => window.innerWidth < 1400;

export const useWorkspaceChromeStore = create<WorkspaceChromeStore>((set) => ({
  assistantOpen: false,
  hydratedUserId: null,
  libraryOpen: false,
  closeAssistant: () => updateVisibility(set, () => ({ assistantOpen: false })),
  closeLibrary: () => updateVisibility(set, () => ({ libraryOpen: false })),
  hydrate: (userId) => set(() => {
    const preference = migrateWorkspaceChrome(
      window.localStorage.getItem(workspaceChromeStorageKey(userId)),
      window.localStorage.getItem(`${LEGACY_AGENT_PANEL_KEY_PREFIX}${userId}`),
    );
    const nextState = { ...preference, hydratedUserId: userId };
    persist(nextState);
    return nextState;
  }),
  openAssistant: () => updateVisibility(set, () => ({
    assistantOpen: true,
    ...(isOverlayViewport() ? { libraryOpen: false } : {}),
  })),
  openLibrary: () => updateVisibility(set, () => ({
    ...(isOverlayViewport() ? { assistantOpen: false } : {}),
    libraryOpen: true,
  })),
  toggleAssistant: () => updateVisibility(set, (state) => ({
    assistantOpen: !state.assistantOpen,
    ...(!state.assistantOpen && isOverlayViewport() ? { libraryOpen: false } : {}),
  })),
  toggleLibrary: () => updateVisibility(set, (state) => ({
    ...(!state.libraryOpen && isOverlayViewport() ? { assistantOpen: false } : {}),
    libraryOpen: !state.libraryOpen,
  })),
}));
