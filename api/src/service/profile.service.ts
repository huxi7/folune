/**
 * [INPUT]: 依赖 Web Crypto/File、可信 AuthUser、请求期 access token、profile repository、Supabase Storage 适配器、Profile/Patch 类型与 HttpError
 * [OUTPUT]: 对外提供保留默认用户名生成的并发幂等 getOrCreate、username/bio update 与校验/补偿/清理完整的 replaceAvatar
 * [POS]: service 层单一 username 默认值、owner 与头像生命周期业务边界，串联 PostgREST CAS 更新和 Storage API 对象清理且不依赖 Hono
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type { PatchProfileInput } from "../dto/profile.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  CreateProfileData,
  Profile,
} from "../model/profile.model.ts";
import { profileRepository } from "../repository/profile.repository.ts";
import {
  createAvatarPublicUrl,
  readAvatarObjectPath,
  removeAvatarObject,
  uploadAvatarObject,
} from "../lib/supabase-storage.ts";

const DEFAULT_PROFILE_NAME_PREFIX = "folune_";
const DEFAULT_PROFILE_RANDOM_DIGITS = 8;
const UNBIASED_DECIMAL_BYTE_LIMIT = 250;
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_UPDATE_ATTEMPTS = 3;

type AvatarFormat = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpeg" | "png" | "webp";
  matches: (bytes: Uint8Array) => boolean;
};

const AVATAR_FORMATS: readonly AvatarFormat[] = [
  {
    contentType: "image/jpeg",
    extension: "jpeg",
    matches: (bytes) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    contentType: "image/png",
    extension: "png",
    matches: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    contentType: "image/webp",
    extension: "webp",
    matches: (bytes) =>
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
];

const randomNumericSuffix = (): string => {
  let suffix = "";
  const randomBytes = new Uint8Array(DEFAULT_PROFILE_RANDOM_DIGITS);

  while (suffix.length < DEFAULT_PROFILE_RANDOM_DIGITS) {
    crypto.getRandomValues(randomBytes);

    for (const randomByte of randomBytes) {
      if (randomByte < UNBIASED_DECIMAL_BYTE_LIMIT) {
        suffix += String(randomByte % 10);
      }

      if (suffix.length === DEFAULT_PROFILE_RANDOM_DIGITS) {
        break;
      }
    }
  }

  return suffix;
};

const defaultProfile = (authUser: AuthUser): CreateProfileData => {
  const defaultName =
    `${DEFAULT_PROFILE_NAME_PREFIX}${randomNumericSuffix()}`;

  return {
    id: authUser.id,
    email: authUser.email,
    username: defaultName,
  };
};

const assertOwnedProfile = (
  authUser: AuthUser,
  profile: Profile,
): Profile => {
  if (profile.id !== authUser.id) {
    throw new HttpError(
      403,
      "PROFILE_ACCESS_DENIED",
      "Profile does not belong to the authenticated user",
    );
  }

  return profile;
};

const getOrCreate = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<Profile> => {
  const existing = await profileRepository.findById(
    authUser.id,
    accessToken,
  );

  if (existing !== null) {
    return assertOwnedProfile(authUser, existing);
  }

  const created = await profileRepository.createOrIgnore(
    defaultProfile(authUser),
    accessToken,
  );

  if (created !== null) {
    return assertOwnedProfile(authUser, created);
  }

  const concurrentlyCreated = await profileRepository.findById(
    authUser.id,
    accessToken,
  );

  if (concurrentlyCreated === null) {
    throw new HttpError(
      502,
      "PROFILE_CREATE_FAILED",
      "Profile was not available after creation",
    );
  }

  return assertOwnedProfile(authUser, concurrentlyCreated);
};

const update = async (
  authUser: AuthUser,
  accessToken: string,
  input: PatchProfileInput,
): Promise<Profile> => {
  await getOrCreate(authUser, accessToken);

  const updated = await profileRepository.updateById(
    authUser.id,
    input,
    accessToken,
  );

  if (updated === null) {
    throw new HttpError(
      409,
      "PROFILE_UPDATE_CONFLICT",
      "Profile changed before it could be updated",
    );
  }

  return assertOwnedProfile(authUser, updated);
};

const validateAvatar = async (
  file: File,
): Promise<AvatarFormat & { body: ArrayBuffer }> => {
  if (file.size === 0) {
    throw new HttpError(
      400,
      "AVATAR_FILE_EMPTY",
      "Avatar file must not be empty",
    );
  }

  if (file.size > MAX_AVATAR_FILE_BYTES) {
    throw new HttpError(
      413,
      "AVATAR_FILE_TOO_LARGE",
      "Avatar file must not exceed 5MB",
    );
  }

  const body = await file.arrayBuffer();
  const bytes = new Uint8Array(body);
  const format = AVATAR_FORMATS.find((candidate) =>
    candidate.matches(bytes),
  );

  if (
    format === undefined ||
    (file.type.length > 0 && file.type !== format.contentType)
  ) {
    throw new HttpError(
      415,
      "AVATAR_FILE_TYPE_UNSUPPORTED",
      "Avatar must be a valid JPEG, PNG, or WebP image",
    );
  }

  return { ...format, body };
};

const ownedAvatarObjectPath = (
  avatarUrl: string | null,
  userId: string,
): string | null => {
  if (avatarUrl === null) {
    return null;
  }

  const objectPath = readAvatarObjectPath(avatarUrl);

  return objectPath?.startsWith(`${userId}/`)
    ? objectPath
    : null;
};

const cleanupUploadedAvatar = async (
  objectPath: string,
  accessToken: string,
): Promise<void> => {
  try {
    await removeAvatarObject(objectPath, accessToken);
  } catch {
    // 补偿清理失败不能覆盖原始业务错误，也不得记录用户路径或凭据。
  }
};

const replaceAvatar = async (
  authUser: AuthUser,
  accessToken: string,
  file: File,
): Promise<Profile> => {
  let currentProfile = await getOrCreate(authUser, accessToken);
  const avatar = await validateAvatar(file);
  const newObjectPath =
    `${authUser.id}/${crypto.randomUUID()}.${avatar.extension}`;
  const newAvatarUrl = createAvatarPublicUrl(newObjectPath);

  await uploadAvatarObject({
    accessToken,
    body: avatar.body,
    contentType: avatar.contentType,
    objectPath: newObjectPath,
  });

  let updatedProfile: Profile | null = null;

  try {
    for (
      let attempt = 0;
      attempt < MAX_AVATAR_UPDATE_ATTEMPTS;
      attempt += 1
    ) {
      updatedProfile = await profileRepository.updateAvatarIfCurrent(
        authUser.id,
        currentProfile.avatar_url,
        newAvatarUrl,
        accessToken,
      );

      if (updatedProfile !== null) {
        break;
      }

      const latestProfile = await profileRepository.findById(
        authUser.id,
        accessToken,
      );

      if (latestProfile === null) {
        break;
      }

      currentProfile = assertOwnedProfile(authUser, latestProfile);
    }
  } catch (error) {
    await cleanupUploadedAvatar(newObjectPath, accessToken);
    throw error;
  }

  if (updatedProfile === null) {
    await cleanupUploadedAvatar(newObjectPath, accessToken);
    throw new HttpError(
      409,
      "AVATAR_UPDATE_CONFLICT",
      "Avatar changed concurrently; please retry",
    );
  }

  const oldObjectPath = ownedAvatarObjectPath(
    currentProfile.avatar_url,
    authUser.id,
  );

  if (oldObjectPath !== null && oldObjectPath !== newObjectPath) {
    try {
      await removeAvatarObject(oldObjectPath, accessToken);
    } catch {
      const rolledBack = await profileRepository.updateAvatarIfCurrent(
        authUser.id,
        newAvatarUrl,
        currentProfile.avatar_url,
        accessToken,
      );

      if (rolledBack !== null) {
        await cleanupUploadedAvatar(newObjectPath, accessToken);
      }

      throw new HttpError(
        502,
        "AVATAR_REPLACEMENT_FAILED",
        "Avatar replacement could not remove the previous file",
      );
    }
  }

  return assertOwnedProfile(authUser, updatedProfile);
};

export const profileService = {
  getOrCreate,
  replaceAvatar,
  update,
};
