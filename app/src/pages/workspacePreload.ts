/**
 * [INPUT]: 依赖浏览器在线状态、页面可见性与可选 Network Information
 * [OUTPUT]: 对外提供 shouldPreloadWorkspace 与 canPreloadWorkspace，判断是否允许非必要预取
 * [POS]: pages 的推测性加载策略；正文邻居读取与 Canvas 代码预热共用，不限制用户主动打开内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

type Connection = { effectiveType?: string; saveData?: boolean };

export const shouldPreloadWorkspace = (input: {
  online: boolean;
  visible: boolean;
  connection?: Connection;
}): boolean => input.online && input.visible && !input.connection?.saveData
  && !/^(slow-2g|2g|3g)$/.test(input.connection?.effectiveType ?? "");

export const canPreloadWorkspace = (): boolean => shouldPreloadWorkspace({
  online: navigator.onLine !== false,
  visible: document.visibilityState !== "hidden",
  connection: (navigator as Navigator & { connection?: Connection }).connection,
});
