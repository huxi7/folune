#!/usr/bin/env bash
# [INPUT]: 依赖 docker-common 的环境校验与 Compose 封装
# [OUTPUT]: 停止 api-dev/chat-dev 并移除孤儿容器，保留命名卷与用户数据
# [POS]: scripts 本地 Docker 停止入口，只作用于本仓库 Compose 项目，不删除卷或执行全局 prune
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-common.sh"

supernote_prepare_compose
supernote_compose down --remove-orphans
