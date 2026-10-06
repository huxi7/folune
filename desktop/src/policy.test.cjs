/**
 * [INPUT]: 依赖 Node test/assert 与桌面 URL/版本纯策略
 * [OUTPUT]: 验证路径穿越、跨源、危险协议、PKCE 授权与版本降级拒绝
 * [POS]: 桌面安全边界回归，不代替 Windows 安装器实机验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { assetPath, isAppUrl, isExternalUrl, isNewRelease, isAuthorizationUrl } = require('./policy.cjs');
test('资源边界拒绝编码穿越、跨域与危险协议', () => {
  assert.equal(assetPath('/bundle', 'folune-app://app/%2e%2e%2fsecret'), null);
  assert.equal(assetPath('/bundle', 'folune-app://app/%5csecret'), null);
  assert.equal(assetPath('/bundle', 'folune-app://other/a.js'), null);
  assert.equal(assetPath('/bundle', 'folune-app://app/assets/a.js'), path.resolve('/bundle/assets/a.js'));
  assert.equal(isAppUrl('http://localhost:10000.evil.test/', 'http://localhost:10000'), false);
  assert.equal(isExternalUrl('file:///etc/passwd'), false);
  assert.equal(isExternalUrl('javascript:alert(1)'), false);
  assert.equal(isExternalUrl('https://example.com'), true);
});
test('更新拒绝同版本、降级与预发布', () => {
  assert.equal(isNewRelease('v1.10.0','1.9.0'), true);
  for (const tag of ['v1.0.0','v0.9.0','v2.0.0-beta.1','invalid']) assert.equal(isNewRelease(tag,'1.0.0'), false);
});
test('授权请求必须同 Supabase、同回调、S256', () => {
  const redirect = 'folune://auth/callback?state=one';
  const url = new URL('https://example.supabase.co/auth/v1/authorize');
  url.search = new URLSearchParams({ provider:'google', redirect_to:redirect, code_challenge:'challenge', code_challenge_method:'s256' }).toString();
  assert.equal(isAuthorizationUrl(url.href,'https://example.supabase.co',redirect),true);
  assert.equal(isAuthorizationUrl(url.href,'https://example.supabase.co','folune://auth/callback?state=two'),false);
  url.hostname = 'evil.test';
  assert.equal(isAuthorizationUrl(url.href,'https://example.supabase.co',redirect),false);
});

test('Google/GitHub 均要求固定来源、回调与 S256，拒绝其他提供商', () => {
  const base = 'https://example.supabase.co';
  const redirect = 'folune://auth/callback?state=expected';
  for (const provider of ['google', 'github']) {
    const url = new URL(`${base}/auth/v1/authorize`);
    url.search = new URLSearchParams({ provider, redirect_to: redirect, code_challenge: 'challenge', code_challenge_method: 's256' }).toString();
    assert.equal(isAuthorizationUrl(url.href, base, redirect), true);
    assert.equal(isAuthorizationUrl(url.href, base, `${redirect}-wrong`), false);
    assert.equal(isAuthorizationUrl(url.href, 'https://other.supabase.co', redirect), false);
    url.searchParams.set('code_challenge_method', 'plain');
    assert.equal(isAuthorizationUrl(url.href, base, redirect), false);
    url.searchParams.set('code_challenge_method', 's256');
    url.searchParams.delete('code_challenge');
    assert.equal(isAuthorizationUrl(url.href, base, redirect), false);
    url.searchParams.set('code_challenge', 'challenge');
    url.searchParams.set('provider', 'gitlab');
    assert.equal(isAuthorizationUrl(url.href, base, redirect), false);
  }
});
