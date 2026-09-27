/**
 * [INPUT]: 依赖 app/Vite 的公开配置、Bun 前端工具链与 Forge CLI
 * [OUTPUT]: 开发进程编排或双平台限定打包，并将四项公开连接配置写入宿主运行文件
 * [POS]: 根 npm 命令的唯一桌面执行入口；前端/后端的密钥文件不进入安装包
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { spawn } from 'node:child_process';
import { cp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
const desktop = fileURLToPath(new URL('../', import.meta.url));
const frontend = fileURLToPath(new URL('../../app/', import.meta.url));
const mode = process.argv[2];
if (!['dev','make'].includes(mode)) throw new Error('使用 dev 或 make');
if (!((process.platform === 'darwin' && process.arch === 'arm64') || (process.platform === 'win32' && process.arch === 'x64'))) throw new Error('仅支持 macOS arm64 与 Windows x64');
const env = { ...process.env };
env.VITE_DESKTOP = 'true';
const localEnv = {};
// 本地安装测试默认沿用当前开发环境；正式 CI 显式注入 Production 公开变量。
for (const name of ['.env', '.env.local']) {
  try { for (const [key,value] of Object.entries(parse(await readFile(`${frontend}/${name}`)))) {
    if (key.startsWith('VITE_')) localEnv[key] = value;
  } } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
for (const [key, value] of Object.entries(localEnv)) if (env[key] === undefined) env[key] = value;
if (!env.CI) {
  env.VITE_API_BASE_URL ||= 'http://localhost:10001';
  env.VITE_CHAT_BASE_URL ||= 'http://localhost:10002';
}
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('桌面工具链使用锁定的 Node 24，请通过根目录 npm run electron:dev / electron:make 执行');
const config = {};
for (const [key, name] of Object.entries({ apiUrl:'VITE_API_BASE_URL', chatUrl:'VITE_CHAT_BASE_URL', supabaseUrl:'VITE_SUPABASE_URL' })) {
  const value = env[name];
  if (!value) throw new Error(`缺少 ${name}`);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`无效 ${name}`);
  if (env.CI && url.protocol !== 'https:') throw new Error(`正式构建要求 HTTPS: ${name}`);
  config[key] = url.origin;
}
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('缺少 Supabase Publishable key');
await writeFile(`${desktop}/runtime.json`, JSON.stringify(config, null, 2));
const children = new Set();
function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio:'inherit', shell:false });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}
function wait(child) {
  return new Promise((resolve,reject) => { child.once('error',reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`进程退出: ${code}`))); });
}
function stop() { for (const child of children) child.kill('SIGTERM'); }
process.on('SIGINT', () => { stop(); process.exitCode = 130; });
process.on('SIGTERM', () => { stop(); process.exitCode = 143; });
const forge = `${desktop}/node_modules/@electron-forge/cli/dist/electron-forge.js`;
try {
  await import('./icons.mjs');
  if (mode === 'dev') {
    let running = false;
    try { running = (await fetch('http://localhost:10000/@vite/client')).ok; } catch {}
    if (!running) {
      const vite = run(process.execPath, [`${frontend}/node_modules/vite/bin/vite.js`], frontend);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (vite.exitCode !== null) throw new Error('Vite 启动失败');
        try { ready = (await fetch('http://localhost:10000/@vite/client')).ok; } catch {}
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!ready) throw new Error('等待 Vite 超时');
    }
    await wait(run(process.execPath, [forge, 'start'], desktop));
  } else {
    await wait(run(process.execPath, [`${frontend}/node_modules/vite/bin/vite.js`, 'build'], frontend));
    await rm(`${desktop}/web`, { recursive:true, force:true });
    await cp(`${frontend}/dist`, `${desktop}/web`, { recursive:true });
    await wait(run(process.execPath, [forge, 'make', '--arch', process.platform === 'darwin' ? 'arm64' : 'x64'], desktop));
    await import('./collect.mjs');
  }
} finally { stop(); }
