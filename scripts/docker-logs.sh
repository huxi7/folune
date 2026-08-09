#!/usr/bin/env bash
# [INPUT]: 依赖可选 api/chat/all 服务名与 docker-common 的 Compose 封装
# [OUTPUT]: 默认持续输出双服务无 Compose 行前缀日志，也可只跟随 api 或 chat
# [POS]: scripts 本地 Docker 日志入口，保持服务自身 ASCII/JSON 版式且拒绝未编排服务名
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-common.sh"

SERVICE="${1:-all}"
case "$SERVICE" in
  api)
    SERVICES=(api)
    ;;
  chat)
    SERVICES=(chat)
    ;;
  all)
    SERVICES=(api chat)
    ;;
  *)
    echo "未知服务：$SERVICE；可用值为 api、chat、all（app 不在 Compose 中）。" >&2
    exit 1
    ;;
esac

supernote_prepare_compose
supernote_compose logs --no-log-prefix -f "${SERVICES[@]}"
