/**
 * [INPUT]: 依赖 Node HTTP/crypto、Electron shell 与授权 URL 白名单策略
 * [OUTPUT]: 提供短时 OAuth 事务与两种宿主回调；转发授权码及错误分类，不转发令牌
 * [POS]: 系统浏览器授权适配；仅传 PKCE code 与错误分类给 Web 回调页，令牌不进入主进程
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { shell } = require('electron');
const { isAuthorizationUrl } = require('./policy.cjs');
function createOAuth({ packaged, supabaseUrl, onCallback }) {
  let pending = null;
  let server = null;
  let timer = null;
  function clear() {
    pending = null;
    clearTimeout(timer);
    server?.close();
    server = null;
  }
  function consume(value) {
    if (!pending) return false;
    let url;
    try { url = new URL(value); } catch { return false; }
    const expected = new URL(pending);
    if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname
      || url.searchParams.get('state') !== expected.searchParams.get('state')) return false;
    const query = new URLSearchParams();
    for (const name of ['code', 'error', 'error_code', 'error_description']) {
      const value = url.searchParams.get(name);
      if (value && value.length < 4096) query.set(name, value);
    }
    if (!query.size) return false;
    clear();
    onCallback(query.toString());
    return true;
  }
  async function prepare() {
    clear();
    const state = randomBytes(24).toString('hex');
    if (packaged) {
      pending = `folune://auth/callback?state=${state}`;
    } else {
      server = http.createServer((request, response) => {
        const valid = request.method === 'GET' && consume(`http://127.0.0.1:10003${request.url}`);
        response.writeHead(valid ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(valid ? '登录已返回 Folune，可以关闭此页面。' : '无效或已过期的登录回调。');
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(10003, '127.0.0.1', resolve);
      });
      pending = `http://127.0.0.1:10003/auth/callback?state=${state}`;
    }
    timer = setTimeout(clear, 5 * 60 * 1000);
    timer.unref();
    return pending;
  }
  return {
    prepare, consume, clear,
    open: async (value) => {
      if (!pending || typeof value !== 'string'
        || !isAuthorizationUrl(value, supabaseUrl, pending)) throw new Error('无效的授权请求');
      await shell.openExternal(value);
    },
  };
}
module.exports = { createOAuth };
