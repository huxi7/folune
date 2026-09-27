/**
 * [INPUT]: 依赖可选 Electron preload；普通浏览器不提供此对象
 * [OUTPUT]: 声明桌面能力类型与保存退出注册表
 * [POS]: Web 与桌面边界，业务只注册保存函数，无法调用通用 Node/IPC
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type DesktopUpdate = { kind: "available" | "ready"; version: string };
export type DesktopBridge = {
  prepareOAuth(): Promise<string>;
  openOAuth(url: string): Promise<void>;
  getUpdate(): Promise<DesktopUpdate | null>;
  downloadUpdate(): Promise<void>;
  restartUpdate(): Promise<void>;
  onUpdate(listener: (update: DesktopUpdate) => void): () => void;
  onPrepareClose(listener: (id: string) => void): () => void;
  finishClose(id: string, saved: boolean): Promise<void>;
};
declare global { interface Window { foluneDesktop?: DesktopBridge } }
const guards = new Set<() => Promise<void>>();
export function registerDesktopSaveGuard(guard: () => Promise<void>) {
  guards.add(guard);
  return () => { guards.delete(guard); };
}
export async function prepareDesktopClose() {
  for (const guard of guards) await guard();
}
