/**
 * [INPUT]: 依赖 Forge、本地图标、源码仓库 Release 图标与可选 CI 签名环境变量
 * [OUTPUT]: 仅 macOS arm64 DMG / Windows x64 Squirrel 安装产物；无真实证书时经 postPackage 钩子对 .app 做 deep ad-hoc 签名
 * [POS]: 桌面打包契约；只包含静态前端和宿主运行文件，不包含后端、环境文件或测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const path = require('node:path');
module.exports = {
  packagerConfig: {
    download: { checksums: require('electron/checksums.json') },
    asar: true, appBundleId: 'com.folune.desktop', executableName: 'Folune',
    icon: path.join(__dirname, 'assets/icon'),
    protocols: [{ name: 'Folune OAuth', schemes: ['folune'] }],
    ignore: (file) => Boolean(file && !/^\/(src|web|assets|node_modules)(\/|$)/.test(file)
      && !['/package.json', '/runtime.json'].includes(file)) || /\.test\.cjs$|CLAUDE\.md$/.test(file),
    ...(process.env.APPLE_SIGN_IDENTITY ? { osxSign: { identity: process.env.APPLE_SIGN_IDENTITY } } : {}),
    ...(process.env.APPLE_ID && process.env.APPLE_APP_PASSWORD && process.env.APPLE_TEAM_ID ? {
      osxNotarize: { appleId: process.env.APPLE_ID, appleIdPassword: process.env.APPLE_APP_PASSWORD, teamId: process.env.APPLE_TEAM_ID },
    } : {}),
  },
  hooks: {
    // ---- 无真实证书时,对整个 .app 做 deep ad-hoc 签名并封存资源(打包器的 osxSign 对 '-' 不生效)。
    //      否则 arm64 应用下载后带隔离属性会被 Gatekeeper 判「已损坏」,连右键打开都不给。 ----
    postPackage: async (_forgeConfig, options) => {
      if (process.platform !== 'darwin' || process.env.APPLE_SIGN_IDENTITY) return;
      const fs = require('node:fs');
      const { execFileSync } = require('node:child_process');
      for (const dir of options.outputPaths) {
        const bundle = fs.readdirSync(dir).find((entry) => entry.endsWith('.app'));
        if (bundle) execFileSync('codesign', ['--force', '--deep', '--sign', '-', path.join(dir, bundle)], { stdio: 'inherit' });
      }
    },
  },
  makers: [
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { name: 'folune-macos-arm64', format: 'ULFO', icon: path.join(__dirname, 'assets/icon.icns') } },
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: {
      name: 'Folune', setupExe: 'folune-windows-x64.exe', setupIcon: path.join(__dirname, 'assets/icon.ico'),
      iconUrl: 'https://github.com/solink7/folune/releases/latest/download/icon.ico',
      ...(process.env.WINDOWS_CERTIFICATE_FILE ? { certificateFile: process.env.WINDOWS_CERTIFICATE_FILE, certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD } : {}),
    } },
  ],
};
