/**
 * [INPUT]: 依赖 Forge make 的平台安装包和 Squirrel 更新元数据
 * [OUTPUT]: 收集固定名称安装包及原名 RELEASES/nupkg 到 release/
 * [POS]: CI 与本地打包共享的产物边界；版本化更新包名称不得改写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../out/make/', import.meta.url));
const output = fileURLToPath(new URL('../release/', import.meta.url));
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes:true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(full);
    else if (/\.dmg$|\.exe$|\.nupkg$|^RELEASES$/.test(entry.name)) {
      const name = entry.name.endsWith('.dmg') ? 'folune-macos-arm64.dmg' : entry.name.endsWith('.exe') ? 'folune-windows-x64.exe' : entry.name;
      await copyFile(full, path.join(output, name));
    }
  }
}
await visit(root);
