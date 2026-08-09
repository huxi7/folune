/**
 * [INPUT]: 依赖 Hono、router/request HTTP 输入 helper、auth/profile services、patchProfileSchema、HttpError 与 ok helper
 * [OUTPUT]: 对外提供 GET /、PATCH / 与 multipart PUT /avatar 的 profileRouter
 * [POS]: router 层 /profile HTTP 适配器，只读 Bearer、JSON/multipart 输入并在认证后下传 JWT/File，不承载头像验证与存储业务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import { Hono } from "hono";

import { HttpError } from "../common/http-error.ts";
import { ok } from "../common/response.ts";
import {
  patchProfileSchema,
  type PatchProfileInput,
} from "../dto/profile.dto.ts";
import { authService } from "../service/auth.service.ts";
import { profileService } from "../service/profile.service.ts";
import { parseJsonBody, readAccessToken } from "./request.ts";

const parseAvatarFile = async (c: Context): Promise<File> => {
  if (!c.req.header("Content-Type")?.startsWith("multipart/form-data")) {
    throw new HttpError(
      415,
      "AVATAR_MULTIPART_REQUIRED",
      "Avatar upload requires multipart/form-data",
    );
  }

  let body: Awaited<ReturnType<Context["req"]["parseBody"]>>;

  try {
    body = await c.req.parseBody();
  } catch {
    throw new HttpError(
      400,
      "INVALID_MULTIPART_BODY",
      "Request body must contain a valid avatar file",
    );
  }

  const avatar = body["avatar"];

  if (!(avatar instanceof File)) {
    throw new HttpError(
      400,
      "AVATAR_FILE_REQUIRED",
      "Multipart field avatar must contain a file",
    );
  }

  return avatar;
};

export const profileRouter = new Hono();

profileRouter.get("/", async (c) => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);

  return ok(
    c,
    await profileService.getOrCreate(authUser, accessToken),
  );
});

profileRouter.patch("/", async (c) => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);
  const input: PatchProfileInput = await parseJsonBody(
    c,
    patchProfileSchema,
    "Invalid profile data",
  );

  return ok(
    c,
    await profileService.update(authUser, accessToken, input),
  );
});

profileRouter.put("/avatar", async (c) => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);
  const avatar = await parseAvatarFile(c);

  return ok(
    c,
    await profileService.replaceAvatar(authUser, accessToken, avatar),
  );
});
