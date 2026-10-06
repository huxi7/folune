/**
 * [INPUT]: 依赖 Web Crypto/File、可信 AuthUser、请求期 access token、profile repository、Supabase Storage 适配器、Profile/Patch 类型与 HttpError
 * [OUTPUT]: 对外提供保留默认用户名生成的并发幂等 getOrCreate、username/bio update 与校验/失败补偿/尽力清理旧文件的 replaceAvatar
 * [POS]: service 层单一 username 默认值、owner 与头像生命周期业务边界；CAS 响应丢失只读核对，不删除可能已引用的新对象；提交后旧文件清理失败不回滚到可能已删除的旧对象，不依赖 Hono
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

const cleanupAvatarObject = async (
  objectPath: string,
  accessToken: string,
): Promise<void> => {
  try {
    await removeAvatarObject(objectPath, accessToken);
  } catch {
    // 对象清理失败不能覆盖原始业务结果；超时也可能已删除对象，不能据此回滚头像。
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
    // 断连不代表事务回滚；读回已提交头像可恢复成功，否则保留对象供后续核对。
    // 即使此刻仍读到旧 URL，超时写入也可能随后提交，不能删除新对象。
    let persisted: Profile | null;
    try {
      persisted = await profileRepository.findById(authUser.id, accessToken);
    } catch {
      throw error;
    }
    if (persisted?.avatar_url !== newAvatarUrl) throw error;
    updatedProfile = assertOwnedProfile(authUser, persisted);
  }

  if (updatedProfile === null) {
    await cleanupAvatarObject(newObjectPath, accessToken);
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
    await cleanupAvatarObject(oldObjectPath, accessToken);
  }

  return assertOwnedProfile(authUser, updatedProfile);
};

export const profileService = {
  getOrCreate,
  replaceAvatar,
  update,
};
