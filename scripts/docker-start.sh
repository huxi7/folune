#!/usr/bin/env bash
# [INPUT]: 依赖 docker-common 的环境校验与 Compose 封装、api/chat 源码及各自本地环境文件
# [OUTPUT]: 打印双服务 Banner，构建并前台启动 api-dev 与 chat-dev，保留服务原始 ASCII 日志版式
# [POS]: scripts 本地 Docker 启动入口；app 仍由本机 Bun/Vite 启动，api/chat 共用 Compose 生命周期
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-common.sh"

supernote_prepare_compose
supernote_print_start_banner
supernote_compose up --build --remove-orphans --no-log-prefix api chat
