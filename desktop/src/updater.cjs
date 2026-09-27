/**
 * [INPUT]: 依赖 Electron autoUpdater/net/shell、固定 GitHub Release 与纯版本策略
 * [OUTPUT]: 提供无更新静默、Windows 原生后台下载、Mac 手动 DMG 更新的状态源
 * [POS]: 主进程更新边界；不实现自制安装器，重启交由宿主完成保存握手后执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { app, autoUpdater, net, shell } = require('electron');
const { RELEASE_REPO, RELEASE_BASE, isNewRelease } = require('./policy.cjs');
function createUpdater(publish) {
  let state = null;
  let checking = false;
  const setState = (next) => { state = next; publish(next); };
  if (process.platform === 'win32') {
    autoUpdater.on('update-downloaded', (_event, _notes, version) => {
      checking = false;
      setState({ kind: 'ready', version });
    });
    autoUpdater.on('update-not-available', () => { checking = false; });
    autoUpdater.on('error', () => { checking = false; });
  }
  async function check() {
    if (!app.isPackaged || checking || state?.kind === 'ready') return;
    checking = true;
    let nativeCheckStarted = false;
    try {
      const response = await net.fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return;
      const release = await response.json();
      if (release.draft || release.prerelease || !isNewRelease(release.tag_name, app.getVersion())) return;
      if (process.platform === 'darwin') {
        if (release.assets?.some((asset) => asset.name === 'folune-macos-arm64.dmg')) {
          setState({ kind: 'available', version: release.tag_name });
        }
      } else if (process.platform === 'win32') {
        if (!release.assets?.some((asset) => asset.name === 'RELEASES')) return;
        // 固定在同一版本目录，避免检查与下载之间 latest 切换导致包不匹配。
        autoUpdater.setFeedURL({ url: `https://github.com/${RELEASE_REPO}/releases/download/${encodeURIComponent(release.tag_name)}` });
        autoUpdater.checkForUpdates();
        nativeCheckStarted = true;
        return;
      }
    } catch {
      // 网络不可用/首次尚无 Release 不打扰写作，下次检查恢复。
    } finally { if (!nativeCheckStarted) checking = false; }
  }
  return {
    getState: () => state,
    check,
    download: () => state?.kind === 'available' ? shell.openExternal(`${RELEASE_BASE}/folune-macos-arm64.dmg`) : undefined,
    install: () => { if (state?.kind === 'ready') autoUpdater.quitAndInstall(); },
  };
}
module.exports = { createUpdater };
