/**
 * [INPUT]: 仅依赖 Electron sandbox preload 的 contextBridge/ipcRenderer
 * [OUTPUT]: 暴露具体 OAuth、更新与退出握手方法，不暴露通用 IPC 或 Node
 * [POS]: 主进程与共用 Web App 的最小能力桥；事件移除器保证 React 生命周期不重复监听
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, listener) => {
  const handler = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
contextBridge.exposeInMainWorld('foluneDesktop', {
  prepareOAuth: () => ipcRenderer.invoke('oauth:prepare'),
  openOAuth: (url) => ipcRenderer.invoke('oauth:open', url),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  restartUpdate: () => ipcRenderer.invoke('update:restart'),
  onUpdate: (listener) => subscribe('update:state', listener),
  onPrepareClose: (listener) => subscribe('app:prepare-close', listener),
  finishClose: (id, saved) => ipcRenderer.invoke('app:finish-close', id, saved),
});
