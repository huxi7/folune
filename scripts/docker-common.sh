#!/usr/bin/env bash
# [INPUT]: 依赖仓库根环境文件、chat/.env、docker-compose.dev.yml 与 Docker Compose
# [OUTPUT]: 对外提供统一环境解析、前置校验、Compose 调用和双服务 ASCII 启动 Banner 函数
# [POS]: scripts 的共享运维内核，消除 start/stop/logs 对环境优先级与 Compose 参数的重复实现
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

SUPERNOTE_SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SUPERNOTE_REPO_ROOT="$(cd "$SUPERNOTE_SCRIPT_DIR/.." && pwd)"
SUPERNOTE_COMPOSE_FILE="$SUPERNOTE_REPO_ROOT/docker-compose.dev.yml"
SUPERNOTE_ENV_FILE=""

supernote_prepare_compose() {
  cd "$SUPERNOTE_REPO_ROOT"

  if [[ -f .env.local ]]; then
    SUPERNOTE_ENV_FILE=".env.local"
  elif [[ -f .env ]]; then
    SUPERNOTE_ENV_FILE=".env"
  elif [[ -f api/.env ]]; then
    SUPERNOTE_ENV_FILE="api/.env"
  else
    cat >&2 <<'EOF'
未找到 API 环境文件：.env.local、.env 或 api/.env。
请先执行：cp api/.env.example api/.env
并填写 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY。
EOF
    return 1
  fi

  if [[ ! -f chat/.env ]]; then
    cat >&2 <<'EOF'
未找到 chat/.env。
请先执行：cp chat/.env.example chat/.env
并填写 Supabase 服务端配置与 DEEPSEEK_API_KEY。
EOF
    return 1
  fi
}

supernote_compose() {
  docker compose \
    --env-file "$SUPERNOTE_ENV_FILE" \
    -f "$SUPERNOTE_COMPOSE_FILE" \
    "$@"
}

supernote_print_start_banner() {
  cat <<'EOF'
+============================================================================+
| SUPERNOTE DOCKER DEV STACK                                                 |
+------------+----------------+----------+------------------------------------+
| SERVICE    | CONTAINER      | PORT     | HEALTH                             |
+------------+----------------+----------+------------------------------------+
| API        | api-dev        | 10001    | GET /health                        |
| CHAT       | chat-dev       | 10002    | GET /health / POST /v1/chat SSE    |
+------------+----------------+----------+------------------------------------+
| APP        | host Bun/Vite  | 10000    | outside Compose                    |
+============================================================================+
EOF
}
