/**
 * [INPUT]: 依赖 AI 权限 DTO 与共享 API 的 GET/PATCH
 * [OUTPUT]: 对外提供用户隔离的确认值缓存与保存协调；读取等待在途保存，迟到 GET 不覆盖 PATCH
 * [POS]: AgentPanel 权限数据边界；保存独立于组件生命周期，写命令仍只合并在途读取，不复用 UI 快照
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  getAiSettings,
  updateAiSettings,
  type AiPermissionMode,
  type AiUserSettings,
} from "../../shared/api/ai";

export const AI_SETTINGS_CACHE_FRESH_MS = 30_000;

type AiSettingsSnapshot = {
  settings: AiUserSettings;
  storedAt: number;
};

const snapshots = new Map<string, AiSettingsSnapshot>();
const pendingReads = new Map<string, Promise<AiUserSettings>>();
const pendingWrites = new Map<string, Promise<AiUserSettings>>();
const pendingFreshReads = new Map<string, Promise<AiUserSettings>>();

// 写命令只合并同一凭据的在途读取，不复用已完成快照；后续操作仍检查最新权限。
export const readFreshAiSettings = (accessToken: string): Promise<AiUserSettings> => {
  const pending = pendingFreshReads.get(accessToken);
  if (pending !== undefined) return pending;
  const request = getAiSettings(accessToken).finally(() => {
    pendingFreshReads.delete(accessToken);
  });
  pendingFreshReads.set(accessToken, request);
  return request;
};

export const readAiSettings = (
  accessToken: string,
  userId: string,
  now = Date.now(),
): Promise<AiUserSettings> => {
  const saving = pendingWrites.get(userId);
  if (saving !== undefined) return saving;
  const cached = snapshots.get(userId);
  if (cached !== undefined && now - cached.storedAt < AI_SETTINGS_CACHE_FRESH_MS) {
    return Promise.resolve(cached.settings);
  }

  const pending = pendingReads.get(userId);
  if (pending !== undefined) return pending;

  const request = getAiSettings(accessToken)
    .then((settings) => {
      const saving = pendingWrites.get(userId);
      if (saving !== undefined) return saving;
      if (pendingReads.get(userId) !== request) return readAiSettings(accessToken, userId);
      snapshots.set(userId, { settings, storedAt: Date.now() });
      return settings;
    }, (error: unknown) => {
      if (pendingReads.get(userId) !== request) return readAiSettings(accessToken, userId);
      throw error;
    })
    .finally(() => {
      if (pendingReads.get(userId) === request) pendingReads.delete(userId);
    });
  pendingReads.set(userId, request);
  return request;
};

export const writeAiSettings = (
  userId: string,
  settings: AiUserSettings,
  now = Date.now(),
) => {
  pendingReads.delete(userId);
  snapshots.set(userId, { settings, storedAt: now });
};

export const saveAiSettings = (
  accessToken: string,
  userId: string,
  mode: AiPermissionMode,
): Promise<AiUserSettings> => {
  const pending = pendingWrites.get(userId);
  if (pending !== undefined) return pending;
  pendingReads.delete(userId);
  snapshots.delete(userId);
  const request = updateAiSettings(accessToken, mode)
    .then((settings) => {
      writeAiSettings(userId, settings);
      return settings;
    })
    .finally(() => {
      if (pendingWrites.get(userId) === request) pendingWrites.delete(userId);
    });
  pendingWrites.set(userId, request);
  return request;
};

export const resetAiSettingsCacheForTests = () => {
  snapshots.clear();
  pendingReads.clear();
  pendingFreshReads.clear();
  pendingWrites.clear();
};
