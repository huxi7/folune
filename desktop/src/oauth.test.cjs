/**
 * [INPUT]: 依赖 Node 测试工具与模拟 Electron shell
 * [OUTPUT]: 验证 OAuth 回调事务随机性、来源/状态绑定与一次性消费
 * [POS]: 主进程授权边界测试，不访问真实账号或交换用户令牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
Module._load = function (name, ...args) { return name === 'electron' ? { shell: { openExternal: async () => {} } } : original.call(this, name, ...args); };
const { createOAuth } = require('./oauth.cjs');
Module._load = original;
test('回调只接受当前事务，消费一次后失效', async () => {
  const received = [];
  const oauth = createOAuth({packaged:true,supabaseUrl:'https://example.supabase.co',onCallback:query=>received.push(query)});
  try {
    const first = await oauth.prepare();
    const second = await oauth.prepare();
    assert.notEqual(first,second);
    assert.equal(oauth.consume(`${first}&code=old`),false);
    assert.equal(oauth.consume(`${second.replace('folune://auth','folune://evil')}&code=bad`),false);
    assert.equal(oauth.consume(`${second}&access_token=bad`),false);
    assert.equal(oauth.consume(`${second}&code=valid`),true);
    assert.equal(oauth.consume(`${second}&code=valid`),false);
    assert.deepEqual(received,['code=valid']);
    await assert.rejects(oauth.open('https://evil.test'));
  } finally { oauth.clear(); }
});
