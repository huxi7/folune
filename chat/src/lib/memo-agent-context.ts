/**
 * [INPUT]: 依赖 business-api 的 ResolvedContext 纯数据
 * [OUTPUT]: 对外提供不向 RequestContext JSON/span 暴露正文的 MemoAgentContext 容器
 * [POS]: lib 层动态 prompt 的敏感数据盒，只允许 Agent instructions 运行时取值，不承载 JWT 或数据库访问
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ResolvedContext } from "@/lib/business-api";

export class MemoAgentContext {
  readonly #value: ResolvedContext;

  constructor(value: ResolvedContext) {
    this.#value = value;
  }

  read(): ResolvedContext {
    return this.#value;
  }

  toJSON(): Record<string, never> {
    return {};
  }
}

