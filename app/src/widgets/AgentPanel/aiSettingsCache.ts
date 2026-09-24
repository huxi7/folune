/**
 * [INPUT]: 依赖 AI 权限设置 DTO 与共享 API 的读取函数
 * [OUTPUT]: 对外提供按用户隔离、短时新鲜且可合并在途请求的审批设置读取/写入缓存
 * [POS]: AgentPanel 权限设置的数据边界；侧栏使用短时快照，写命令仅合并在途请求，不替代服务端确认事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  getAiSettings,
  type AiUserSettings,
} from "../../shared/api/ai";

export const AI_SETTINGS_CACHE_FRESH_MS = 30_000;

type AiSettingsSnapshot = {
  settings: AiUserSettings;
  storedAt: number;
};

const snapshots = new Map<string, AiSettingsSnapshot>();
const pendingReads = new Map<string, Promise<AiUserSettings>>();
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
  const cached = snapshots.get(userId);
  if (cached !== undefined && now - cached.storedAt < AI_SETTINGS_CACHE_FRESH_MS) {
    return Promise.resolve(cached.settings);
  }

  const pending = pendingReads.get(userId);
  if (pending !== undefined) return pending;

  const request = getAiSettings(accessToken)
    .then((settings) => {
      snapshots.set(userId, { settings, storedAt: Date.now() });
      return settings;
    })
    .finally(() => {
      pendingReads.delete(userId);
    });
  pendingReads.set(userId, request);
  return request;
};

export const writeAiSettings = (
  userId: string,
  settings: AiUserSettings,
  now = Date.now(),
) => {
  snapshots.set(userId, { settings, storedAt: now });
};

export const resetAiSettingsCacheForTests = () => {
  snapshots.clear();
  pendingReads.clear();
  pendingFreshReads.clear();
};
