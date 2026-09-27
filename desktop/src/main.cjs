/**
 * [INPUT]: 依赖 Electron 窗口/协议/IPC、构建期公开配置、OAuth 与 updater
 * [OUTPUT]: 启动隔离桌面窗口，提供本地静态资源、最小 IPC 与保存后退出协议
 * [POS]: 桌面应用装配入口；云端业务仍由共用前端直接访问，主进程不持有业务令牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { app, BrowserWindow, ipcMain, protocol, net, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { randomUUID, createHash } = require('node:crypto');
const { APP_ORIGIN, isAppUrl, isExternalUrl, assetPath } = require('./policy.cjs');
const { createOAuth } = require('./oauth.cjs');
const { createUpdater } = require('./updater.cjs');
const config = require('../runtime.json');

protocol.registerSchemesAsPrivileged([{ scheme: 'folune-app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
const installerEvent = require('electron-squirrel-startup');
if (installerEvent || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let window = null;
  let closing = false;
  let closeRequest = null;
  const origin = app.isPackaged ? APP_ORIGIN : 'http://localhost:10000';
  const updater = createUpdater((state) => window?.webContents.send('update:state', state));
  const oauth = createOAuth({ packaged: app.isPackaged, supabaseUrl: config.supabaseUrl,
    onCallback: (query) => {
      if (!window) createWindow();
      void window.loadURL(`${origin}/auth/callback?${query}`);
      window.show(); window.focus();
    },
  });
  app.on('open-url', (event, url) => { event.preventDefault(); oauth.consume(url); });
  app.on('second-instance', (_event, argv) => {
    const link = argv.find((value) => value.startsWith('folune://'));
    if (link) oauth.consume(link);
    if (!window) createWindow();
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
  });
  function requestClose(install = false) {
    if (closing || closeRequest) return;
    if (!window || window.webContents.isDestroyed()) { closing = true; app.quit(); return; }
    const id = randomUUID();
    closeRequest = { id, install };
    window.webContents.send('app:prepare-close', id);
    setTimeout(() => { if (closeRequest?.id === id) closeRequest = null; }, 30000).unref();
  }
  function handle(channel, callback) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
        || !isAppUrl(event.senderFrame.url, origin)) throw new Error('拒绝不可信的桌面调用');
      return callback(...args);
    });
  }
  function createWindow() {
    window = new BrowserWindow({ width: 1320, height: 880, minWidth: 800, minHeight: 560,
      title: 'Folune', backgroundColor: '#fafafa', icon: path.join(__dirname, '../assets/icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
        nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false },
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isExternalUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
      if (isAppUrl(url, origin)) return;
      event.preventDefault();
      if (isExternalUrl(url)) void shell.openExternal(url);
    });
    window.webContents.on('will-attach-webview', (event) => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents, permission, callback, details) => {
      callback(permission === 'clipboard-sanitized-write' && details.isMainFrame && isAppUrl(details.requestingUrl, origin));
    });
    window.webContents.session.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
      permission === 'clipboard-sanitized-write' && isAppUrl(requestingOrigin, origin));
    window.on('close', (event) => {
      if (!closing && !window.webContents.isLoadingMainFrame()) { event.preventDefault(); requestClose(); }
    });
    window.on('closed', () => { window = null; });
    void window.loadURL(`${origin}/app`);
  }
  app.on('before-quit', (event) => { if (!closing && window) { event.preventDefault(); requestClose(); } });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (!window) createWindow(); });
  app.on('will-quit', () => oauth.clear());
  app.whenReady().then(() => {
    if (app.isPackaged) app.setAsDefaultProtocolClient('folune');
    if (process.platform === 'win32') app.setAppUserModelId('com.squirrel.Folune.Folune');
    if (!app.isPackaged && process.platform === 'darwin') app.dock.setIcon(path.join(__dirname, '../assets/icon.png'));
    const root = path.join(__dirname, '../web');
    const connectOrigins = [config.apiUrl, config.chatUrl, config.supabaseUrl].map(value => new URL(value).origin);
    const inlineScripts = app.isPackaged ? [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)] : [];
    const scriptHashes = inlineScripts.map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`).join(' ');
    const csp = `default-src 'self'; script-src 'self' ${scriptHashes}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' ${connectOrigins.join(' ')}; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`;
    protocol.handle('folune-app', async (request) => {
      let target = assetPath(root, request.url);
      if (!target || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 403 });
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        if (path.extname(new URL(request.url).pathname)) return new Response(null, { status: 404 });
        target = path.join(root, 'index.html');
      }
      const response = await net.fetch(pathToFileURL(target).toString());
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', csp);
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
    });
    handle('oauth:prepare', () => oauth.prepare());
    handle('oauth:open', (url) => oauth.open(url));
    handle('update:get', () => updater.getState());
    handle('update:download', () => updater.download());
    handle('update:restart', () => { if (updater.getState()?.kind === 'ready') requestClose(true); });
    handle('app:finish-close', (id, saved) => {
      if (!closeRequest || closeRequest.id !== id) return;
      const install = closeRequest.install;
      closeRequest = null;
      if (saved !== true) return;
      closing = true;
      if (install) updater.install(); else app.quit();
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]));
    createWindow();
    setTimeout(() => void updater.check(), process.argv.includes('--squirrel-firstrun') ? 30000 : 10000).unref();
    setInterval(() => void updater.check(), 4 * 60 * 60 * 1000).unref();
  });
}
