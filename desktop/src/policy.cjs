/**
 * [INPUT]: 依赖 Node URL/path 与 semver 的版本比较
 * [OUTPUT]: 提供导航/资源边界、PKCE 登录与 GitHub 绑定授权白名单、稳定版本判断
 * [POS]: 桌面主进程的纯安全策略；所有不可信 URL 在进入原生能力前经过此边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const path = require('node:path');
const semver = require('semver');
const RELEASE_REPO = 'solink7/folune-releases';
const RELEASE_BASE = `https://github.com/${RELEASE_REPO}/releases/latest/download`;
const APP_ORIGIN = 'folune-app://app';
function isAppUrl(value, origin) {
  try {
    const url = new URL(value);
    const base = new URL(origin);
    return url.protocol === base.protocol && url.host === base.host && !url.username && !url.password;
  } catch { return false; }
}
function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
function assetPath(root, value) {
  if (!isAppUrl(value, APP_ORIGIN)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) return null;
    const target = path.resolve(root, `.${pathname}`);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return target;
  } catch { return null; }
}
function isNewRelease(tag, current) {
  return Boolean(semver.valid(tag) && !semver.prerelease(tag) && semver.valid(current) && semver.gt(tag, current));
}
function isAuthorizationUrl(value, supabaseUrl, redirectTo) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/authorize'
      && ['google', 'github'].includes(url.searchParams.get('provider'))
      && url.searchParams.get('redirect_to') === redirectTo
      && url.searchParams.get('code_challenge_method')?.toLowerCase() === 's256'
      && Boolean(url.searchParams.get('code_challenge'));
  } catch { return false; }
}
function isGitHubLinkAuthorizationUrl(value, supabaseUrl) {
  try {
    const url = new URL(value);
    const callback = new URL('/auth/v1/callback', supabaseUrl);
    const scopes = (url.searchParams.get('scope') || '').split(/[ ,]+/).filter(Boolean);
    return !url.username && !url.password && url.origin === 'https://github.com'
      && url.pathname === '/login/oauth/authorize'
      && url.searchParams.get('redirect_uri') === callback.href
      && Boolean(url.searchParams.get('client_id'))
      && /^[a-f0-9-]{36}$/i.test(url.searchParams.get('state') || '')
      && scopes.every(scope => ['user:email', 'read:user'].includes(scope));
  } catch { return false; }
}
module.exports = { RELEASE_REPO, RELEASE_BASE, APP_ORIGIN, isAppUrl, isExternalUrl, assetPath, isNewRelease, isAuthorizationUrl, isGitHubLinkAuthorizationUrl };
