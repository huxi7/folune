/**
 * [INPUT]: 依赖可信 AuthUser、请求期 JWT、Run DTO 输入、AI repository/RPC 与 HttpError
 * [OUTPUT]: 对外提供 organize Run 创建/读取/记录方案/应用/拒绝/撤销业务用例及稳定状态错误
 * [POS]: service 层 AI 整理执行边界，不调用模型、不接受 apply plan，只把合法命令交给数据库受控状态机
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type {
  AiRunRpcResult,
  CreateAiRunInput,
  RecordAiRunPlanInput,
} from "../dto/ai.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type { AiRun } from "../model/ai.model.ts";
import { aiRepository } from "../repository/ai.repository.ts";

const requireRpcRun = (result: AiRunRpcResult): AiRun => {
  if (result.run !== undefined) return result.run as AiRun;
  if (result.status === "not_found") {
    throw new HttpError(404, "AI_RUN_NOT_FOUND", "AI run was not found");
  }
  if (result.status === "thread_not_found") {
    throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
  }
  if (result.status === "invalid") {
    throw new HttpError(
      400,
      result.error_code ?? "AI_RUN_INVALID",
      "AI run input was invalid",
    );
  }
  if (result.status === "conflict") {
    throw new HttpError(
      409,
      result.error_code ?? "AI_UNDO_CONFLICT",
      "Memo has changed and cannot be automatically undone",
    );
  }
  if (result.status === "invalid_status") {
    throw new HttpError(
      409,
      "AI_RUN_INVALID_STATUS",
      `AI run cannot perform this action from ${result.run_status ?? "unknown"}`,
    );
  }
  throw new HttpError(502, "AI_RUN_STORAGE_ERROR", "AI run storage operation failed");
};

export const aiRunService = {
  async create(
    authUser: AuthUser,
    accessToken: string,
    input: CreateAiRunInput,
  ): Promise<AiRun> {
    return requireRpcRun(
      await aiRepository.createRun(
        authUser.id,
        input.memo_id,
        input.thread_id ?? null,
        input.idempotency_key,
        accessToken,
      ),
    );
  },

  async get(authUser: AuthUser, accessToken: string, runId: string): Promise<AiRun> {
    const run = await aiRepository.findRun(authUser.id, runId, accessToken);
    if (run === null) {
      throw new HttpError(404, "AI_RUN_NOT_FOUND", "AI run was not found");
    }
    return run;
  },

  async recordPlan(
    authUser: AuthUser,
    accessToken: string,
    runId: string,
    input: RecordAiRunPlanInput,
  ): Promise<AiRun> {
    return requireRpcRun(
      await aiRepository.recordRunPlan(
        authUser.id,
        runId,
        input.plan,
        input.requires_confirmation,
        accessToken,
      ),
    );
  },

  async apply(authUser: AuthUser, accessToken: string, runId: string) {
    return requireRpcRun(await aiRepository.applyRun(authUser.id, runId, accessToken));
  },

  async reject(authUser: AuthUser, accessToken: string, runId: string) {
    return requireRpcRun(await aiRepository.rejectRun(authUser.id, runId, accessToken));
  },

  async undo(authUser: AuthUser, accessToken: string, runId: string) {
    return requireRpcRun(await aiRepository.undoRun(authUser.id, runId, accessToken));
  },

  async fail(
    authUser: AuthUser,
    accessToken: string,
    runId: string,
    errorCode: string,
  ) {
    return requireRpcRun(
      await aiRepository.failRun(authUser.id, runId, errorCode, accessToken),
    );
  },
};

