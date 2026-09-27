/**
 * [INPUT]: 依赖 Forge、桌面图标与可选 CI 签名环境变量
 * [OUTPUT]: 仅 macOS arm64 DMG / Windows x64 Squirrel 安装产物
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
  makers: [
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { name: 'folune-macos-arm64', format: 'ULFO', icon: path.join(__dirname, 'assets/icon.icns') } },
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: {
      name: 'Folune', setupExe: 'folune-windows-x64.exe', setupIcon: path.join(__dirname, 'assets/icon.ico'),
      iconUrl: 'https://raw.githubusercontent.com/solink7/folune-releases/main/icon.ico',
      ...(process.env.WINDOWS_CERTIFICATE_FILE ? { certificateFile: process.env.WINDOWS_CERTIFICATE_FILE, certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD } : {}),
    } },
  ],
};
