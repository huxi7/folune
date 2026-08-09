/**
 * [INPUT]: 依赖 shared/api/client 的统一鉴权请求能力与后端 /profile 五字段 snake_case 响应契约
 * [OUTPUT]: 对外提供 Profile、username/bio ProfileUpdateInput、5MB/格式常量、getProfile、updateProfile 与 uploadProfileAvatar
 * [POS]: app/src/shared/api 的最小个人资料边界，以非空 username 统一展示和编辑名称，并封装 JSON PATCH 与 multipart 头像替换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { apiRequest } from "./client";

type ProfileDto = {
  avatar_url: string | null;
  bio: string | null;
  email: string | null;
  id: string;
  username: string;
};

export type Profile = {
  avatarUrl: string | null;
  bio: string | null;
  email: string | null;
  id: string;
  username: string;
};

export type ProfileUpdateInput = {
  bio?: string | null;
  username?: string;
};

export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const mapProfile = (profile: ProfileDto): Profile => ({
  avatarUrl: profile.avatar_url,
  bio: profile.bio,
  email: profile.email,
  id: profile.id,
  username: profile.username,
});

export const getProfile = async (accessToken?: string): Promise<Profile> =>
  mapProfile(await apiRequest<ProfileDto>("/profile", {}, accessToken));

export const updateProfile = async (
  input: ProfileUpdateInput,
): Promise<Profile> => {
  const body: Record<string, string | null> = {};

  if (input.username !== undefined) {
    body["username"] = input.username;
  }

  if (input.bio !== undefined) {
    body["bio"] = input.bio;
  }

  return mapProfile(
    await apiRequest<ProfileDto>("/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
};

export const uploadProfileAvatar = async (
  file: File,
): Promise<Profile> => {
  const formData = new FormData();
  formData.append("avatar", file);

  return mapProfile(
    await apiRequest<ProfileDto>("/profile/avatar", {
      method: "PUT",
      body: formData,
    }),
  );
};
