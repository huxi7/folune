/**
 * [INPUT]: 依赖 lib/supabase-rest、已验证用户 access token、profile DTO schemas、Profile/CreateProfileData 与 PatchProfileInput
 * [OUTPUT]: 对外提供强制传入 access token 的 profileRepository findById、createOrIgnore、updateById 与头像 CAS 更新
 * [POS]: repository 层精简 public.profiles 数据访问器，以 authenticated 用户身份执行幂等创建、username/bio 局部更新与防并发头像覆盖，不判断业务权限
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import {
  profileRowsSchema,
  type PatchProfileInput,
} from "../dto/profile.dto.ts";
import {
  createPostgrestQuery,
  supabaseRest,
} from "../lib/supabase-rest.ts";
import type {
  CreateProfileData,
  Profile,
} from "../model/profile.model.ts";

const parseRows = (payload: unknown): Profile[] => {
  const parsed = profileRowsSchema.safeParse(payload ?? []);

  if (!parsed.success) {
    throw new HttpError(
      502,
      "SUPABASE_REST_ERROR",
      "Supabase REST returned invalid profile data",
    );
  }

  return parsed.data;
};

export const profileRepository = {
  async findById(
    userId: string,
    accessToken: string,
  ): Promise<Profile | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { id: userId },
      limit: 1,
    });
    const payload = await supabaseRest<unknown>(
      `profiles${query}`,
      { accessToken },
    );

    return parseRows(payload)[0] ?? null;
  },

  async createOrIgnore(
    data: CreateProfileData,
    accessToken: string,
  ): Promise<Profile | null> {
    const payload = await supabaseRest<unknown>(
      `profiles${createPostgrestQuery({
        select: "*",
        onConflict: "id",
      })}`,
      {
        accessToken,
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          Prefer: "resolution=ignore-duplicates",
        },
        returnRepresentation: true,
      },
    );

    return parseRows(payload)[0] ?? null;
  },

  async updateById(
    userId: string,
    input: PatchProfileInput,
    accessToken: string,
  ): Promise<Profile | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: { id: userId },
    });
    const payload = await supabaseRest<unknown>(
      `profiles${query}`,
      {
        accessToken,
        method: "PATCH",
        body: JSON.stringify(input),
        returnRepresentation: true,
      },
    );

    return parseRows(payload)[0] ?? null;
  },

  async updateAvatarIfCurrent(
    userId: string,
    currentAvatarUrl: string | null,
    nextAvatarUrl: string | null,
    accessToken: string,
  ): Promise<Profile | null> {
    const query = createPostgrestQuery({
      select: "*",
      eq: {
        id: userId,
        ...(currentAvatarUrl === null
          ? {}
          : { avatar_url: currentAvatarUrl }),
      },
      is:
        currentAvatarUrl === null
          ? { avatar_url: null }
          : undefined,
    });
    const payload = await supabaseRest<unknown>(
      `profiles${query}`,
      {
        accessToken,
        method: "PATCH",
        body: JSON.stringify({ avatar_url: nextAvatarUrl }),
        returnRepresentation: true,
      },
    );

    return parseRows(payload)[0] ?? null;
  },
};
