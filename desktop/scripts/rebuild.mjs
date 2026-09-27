/**
 * [INPUT]: 依赖 npm 安装上下文和桌面锁定的 Node 24
 * [OUTPUT]: macOS 上重建 DMG 原生工具，避免用户系统 Node 与构建 Node ABI 不一致
 * [POS]: 仅开发依赖安装阶段运行，不进入桌面应用运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { spawnSync } from 'node:child_process';
if (process.platform === 'darwin') {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'rebuild', 'macos-alias', 'fs-xattr'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
