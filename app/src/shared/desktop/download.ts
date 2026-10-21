/**
 * [INPUT]: 依赖 Navigator 的现代平台提示与兼容 userAgent
 * [OUTPUT]: 返回受支持系统或需要人工选择的空值，并提供源码仓库的固定安装包 URL
 * [POS]: 官网下载纯策略，区分移动设备/不支持架构，浏览器未披露架构时由用户选择
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type DesktopPlatform = "macos" | "windows";
export const desktopDownloadUrls = {
  macos: "https://github.com/solink7/folune/releases/latest/download/folune-macos-arm64.dmg",
  windows: "https://github.com/solink7/folune/releases/latest/download/folune-windows-x64.exe",
} as const;
type PlatformHints = { platform?: string; architecture?: string; bitness?: string; mobile?: boolean };
export function platformFromHints(hints: PlatformHints, userAgent: string): DesktopPlatform | null {
  if (hints.mobile || /Android|iPhone|iPad|iPod/i.test(userAgent)) return null;
  const platform = hints.platform ?? userAgent;
  if (/mac/i.test(platform)) {
    // Safari/旧浏览器的 Intel Mac OS X 字样不代表真实 CPU；缺少提示时显式选择。
    return hints.architecture === "arm" && hints.bitness === "64" ? "macos" : null;
  }
  if (/win/i.test(platform)) {
    if (hints.architecture) return hints.architecture === "x86" && hints.bitness === "64" ? "windows" : null;
    return /Win64|WOW64/.test(userAgent) && !/ARM/i.test(userAgent) ? "windows" : null;
  }
  return null;
}
export async function detectDesktopPlatform(): Promise<DesktopPlatform | null> {
  const nav = navigator as Navigator & { userAgentData?: PlatformHints & {
    getHighEntropyValues(keys: string[]): Promise<PlatformHints>;
  } };
  if (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent)) return null;
  let hints: PlatformHints = nav.userAgentData ?? {};
  try {
    if (nav.userAgentData) hints = { ...hints, ...await nav.userAgentData.getHighEntropyValues(["architecture", "bitness", "platform"]) };
  } catch { /* 权限不足时使用兼容路径，不猜测 CPU。 */ }
  return platformFromHints(hints, nav.userAgent);
}
