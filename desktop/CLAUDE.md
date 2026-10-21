# desktop/
> L2 | 父级: ../CLAUDE.md

Electron + Forge 桌面宿主，复用 app 静态构建与云端业务服务。开发加载 Vite，安装版固定使用 folune-app://app 来源，独立持久化浏览器会话。

成员清单
package.json: 当前桌面版本1.3.1、运行依赖与开发/打包命令；正式安装包版本由稳定Git Tag校验并注入
package-lock.json: npm 跨平台锁文件，CI 使用 npm ci
forge.config.cjs: macOS arm64 DMG / Windows x64 Squirrel；安装器图标取同仓库 Release，保留签名入口
src/: 主进程、受限 preload、协议安全与更新策略
scripts/: 开发编排、品牌图标生成与发布文件收集
assets/: 品牌母图生成的桌面图标
README.md: 开发、打包、发布与外部配置操作手册

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
