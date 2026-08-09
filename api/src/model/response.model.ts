/**
 * [INPUT]: 不依赖框架或校验库，仅使用 TypeScript 泛型与字面量类型
 * [OUTPUT]: 对外提供 ApiSuccessResponse<T> 与 ApiErrorResponse 统一响应信封类型
 * [POS]: model 层的 HTTP 响应语义模型，被 common/response 统一消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface ApiSuccessResponse<T> {
  code: "ok";
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  data: null;
}
