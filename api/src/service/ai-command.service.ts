/**
 * [INPUT]: 依赖可信 AuthUser、请求期 JWT、AI settings/command DTO、HttpError 与 aiRepository
 * [OUTPUT]: 对外提供账号级权限读写及命令查询、创建、人工批准、拒绝和冲突安全撤销服务
 * [POS]: service 层 AI Native V2 可信执行入口，将 Postgres 状态机结果映射成稳定 HTTP 领域错误，不执行模型审批
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type {
  CreateAiCommandInput,
  PatchAiUserSettingsInput,
} from "../dto/ai.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type { AiCommand, AiUserSettings } from "../model/ai.model.ts";
import { aiRepository } from "../repository/ai.repository.ts";

const requireCommand = (command: AiCommand | undefined): AiCommand => {
  if (command === undefined) {
    throw new HttpError(404, "AI_COMMAND_NOT_FOUND", "AI command was not found");
  }
  return command;
};

const resolveCommandResult = (
  result: Awaited<ReturnType<typeof aiRepository.commandRpc>>,
): AiCommand => {
  if (result.status === "not_found") {
    throw new HttpError(404, "AI_COMMAND_NOT_FOUND", "AI command was not found");
  }
  if (result.status === "conflict") {
    throw new HttpError(
      409,
      "AI_UNDO_CONFLICT",
      "The command cannot be undone because the memo changed afterward",
    );
  }
  if (result.status === "invalid_status") {
    throw new HttpError(
      409,
      "AI_COMMAND_INVALID_STATUS",
      "The AI command is not in a valid state for this operation",
    );
  }
  return requireCommand(result.command);
};

export const aiSettingsService = {
  async get(authUser: AuthUser, accessToken: string): Promise<AiUserSettings> {
    const existing = await aiRepository.findSettings(authUser.id, accessToken);
    if (existing !== null) return existing;

    const created = await aiRepository.upsertSettings(
      authUser.id,
      "ask",
      accessToken,
    );
    if (created === null) {
      throw new HttpError(502, "AI_SETTINGS_WRITE_FAILED", "AI settings could not be created");
    }
    return created;
  },

  async update(
    authUser: AuthUser,
    accessToken: string,
    input: PatchAiUserSettingsInput,
  ): Promise<AiUserSettings> {
    const settings = await aiRepository.upsertSettings(
      authUser.id,
      input.permission_mode,
      accessToken,
    );
    if (settings === null) {
      throw new HttpError(502, "AI_SETTINGS_WRITE_FAILED", "AI settings could not be updated");
    }
    return settings;
  },
};

export const aiCommandService = {
  async get(authUser: AuthUser, accessToken: string, commandId: string) {
    const command = await aiRepository.findCommand(authUser.id, commandId, accessToken);
    if (command === null) {
      throw new HttpError(404, "AI_COMMAND_NOT_FOUND", "AI command was not found");
    }
    return command;
  },

  async create(
    authUser: AuthUser,
    accessToken: string,
    input: CreateAiCommandInput,
  ) {
    return resolveCommandResult(
      await aiRepository.createCommand(authUser.id, input, accessToken),
    );
  },

  async approve(authUser: AuthUser, accessToken: string, commandId: string) {
    return resolveCommandResult(
      await aiRepository.approveCommand(authUser.id, commandId, accessToken),
    );
  },

  async reject(authUser: AuthUser, accessToken: string, commandId: string) {
    return resolveCommandResult(
      await aiRepository.rejectCommand(authUser.id, commandId, accessToken),
    );
  },

  async undo(authUser: AuthUser, accessToken: string, commandId: string) {
    return resolveCommandResult(
      await aiRepository.undoCommand(authUser.id, commandId, accessToken),
    );
  },
};
