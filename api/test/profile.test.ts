/**
 * [INPUT]: 依赖 Bun test、Hono app、Web File/FormData、内存 Supabase Auth/PostgREST/Storage fetch mock、Profile 模型与 service/auth 的身份缓存测试清空口
 * [OUTPUT]: 覆盖五字段 /profile 与 PUT /profile/avatar 的认证、默认/可修改 username、5MB/签名验证、旧文件删除、并发补偿及请求头测试
 * [POS]: api/test 的 profile HTTP 全链路契约测试，不连接远端服务且不保存或输出真实凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { CreateProfileData, Profile } from "../src/model/profile.model.ts";

const SUPABASE_URL = "https://profile-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_profile_test";
const ACCESS_TOKEN = "profile-test-access-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const USER_EMAIL = "profile-test@example.com";
const AVATAR_PUBLIC_PREFIX =
  `${SUPABASE_URL}/storage/v1/object/public/avatars/`;
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = SUPABASE_URL;
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY;

const { app } = await import("../src/app.ts");
const { authService } = await import("../src/service/auth.service.ts");

const profileFixture = (overrides: Partial<Profile> = {}): Profile => ({
  id: USER_ID,
  email: USER_EMAIL,
  username: "existing_username",
  avatar_url: null,
  bio: null,
  ...overrides,
});

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type MockOptions = {
  rejectAvatarUpdates?: boolean;
  storageUploadFails?: boolean;
  invalidToken?: boolean;
  synchronizeMissingReads?: boolean;
};

class MockSupabase {
  readonly profiles = new Map<string, Profile>();
  readonly insertBodyKeys: string[][] = [];
  readonly patchBodyKeys: string[][] = [];
  readonly storageEvents: string[] = [];
  readonly storageObjects = new Set<string>();
  readonly uploadedContentTypes: string[] = [];
  authCount = 0;
  selectCount = 0;
  insertCount = 0;
  ignoredInsertCount = 0;
  updateCount = 0;
  headersMatched = true;
  conflictContractMatched = true;
  private readonly invalidToken: boolean;
  private readonly rejectAvatarUpdates: boolean;
  private readonly storageUploadFails: boolean;
  private readonly synchronizeMissingReads: boolean;
  private missingReadWaiters: Array<(response: Response) => void> = [];

  constructor(options: MockOptions = {}) {
    this.invalidToken = options.invalidToken ?? false;
    this.rejectAvatarUpdates = options.rejectAvatarUpdates ?? false;
    this.storageUploadFails = options.storageUploadFails ?? false;
    this.synchronizeMissingReads = options.synchronizeMissingReads ?? false;
  }

  readonly fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    this.headersMatched &&=
      request.headers.get("apikey") === PUBLISHABLE_KEY &&
      request.headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`;

    if (url.pathname === "/auth/v1/user") {
      this.authCount += 1;
      return this.invalidToken
        ? jsonResponse({ message: "Invalid token" }, 401)
        : jsonResponse({ id: USER_ID, email: USER_EMAIL });
    }

    if (
      url.pathname.startsWith("/storage/v1/object/avatars/") &&
      request.method === "POST"
    ) {
      return this.uploadAvatar(request, url);
    }

    if (
      url.pathname === "/storage/v1/object/avatars" &&
      request.method === "DELETE"
    ) {
      return this.deleteAvatars(request);
    }

    if (url.pathname !== "/rest/v1/profiles") {
      throw new Error(`Unexpected path: ${url.pathname}`);
    }

    if (request.method === "GET") {
      return this.select(url);
    }

    if (request.method === "POST") {
      return this.insert(request, url);
    }

    if (request.method === "PATCH") {
      return this.update(request, url);
    }

    throw new Error(`Unexpected method: ${request.method}`);
  };

  private select(url: URL): Promise<Response> | Response {
    this.selectCount += 1;
    const profile = this.profiles.get(this.readUserId(url));

    if (
      profile === undefined &&
      this.synchronizeMissingReads &&
      this.missingReadWaiters.length < 2
    ) {
      return new Promise<Response>((resolve) => {
        this.missingReadWaiters.push(resolve);

        if (this.missingReadWaiters.length === 2) {
          const waiters = this.missingReadWaiters;
          this.missingReadWaiters = [];
          waiters.forEach((waiter) => waiter(jsonResponse([])));
        }
      });
    }

    return jsonResponse(profile === undefined ? [] : [profile]);
  }

  private async insert(request: Request, url: URL): Promise<Response> {
    this.insertCount += 1;
    const preferences = new Set(
      (request.headers.get("Prefer") ?? "")
        .split(",")
        .map((value) => value.trim()),
    );
    this.conflictContractMatched &&=
      url.searchParams.get("on_conflict") === "id" &&
      preferences.has("resolution=ignore-duplicates") &&
      preferences.has("return=representation");

    const data = (await request.json()) as CreateProfileData;
    this.insertBodyKeys.push(Object.keys(data).sort());

    if (this.profiles.has(data.id)) {
      this.ignoredInsertCount += 1;
      return jsonResponse([], 201);
    }

    const profile = profileFixture({
      id: data.id,
      email: data.email,
      username: data.username,
    });
    this.profiles.set(data.id, profile);
    return jsonResponse([profile], 201);
  }

  private async update(request: Request, url: URL): Promise<Response> {
    this.updateCount += 1;
    const userId = this.readUserId(url);
    const input = (await request.json()) as Partial<Profile>;
    this.patchBodyKeys.push(Object.keys(input).sort());
    this.storageEvents.push("profile:patch");
    const existing = this.profiles.get(userId);

    if (existing === undefined) {
      return jsonResponse([]);
    }

    if ("avatar_url" in input) {
      if (this.rejectAvatarUpdates) {
        return jsonResponse([]);
      }

      const avatarFilter = url.searchParams.get("avatar_url");
      const avatarMatches =
        avatarFilter === "is.null"
          ? existing.avatar_url === null
          : avatarFilter?.startsWith("eq.") === true
            ? existing.avatar_url === avatarFilter.slice(3)
            : false;

      if (!avatarMatches) {
        return jsonResponse([]);
      }
    }

    const updated = { ...existing, ...input };
    this.profiles.set(userId, updated);
    return jsonResponse([updated]);
  }

  private uploadAvatar(request: Request, url: URL): Response {
    this.storageEvents.push("storage:upload");
    this.uploadedContentTypes.push(
      request.headers.get("Content-Type") ?? "",
    );

    if (this.storageUploadFails) {
      return jsonResponse({ message: "Storage upload failed" }, 500);
    }

    const prefix = "/storage/v1/object/avatars/";
    const objectPath = url.pathname
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    this.storageObjects.add(objectPath);

    return jsonResponse({
      Id: crypto.randomUUID(),
      Key: `avatars/${objectPath}`,
    });
  }

  private async deleteAvatars(request: Request): Promise<Response> {
    this.storageEvents.push("storage:delete");
    const payload = (await request.json()) as { prefixes?: unknown };
    const prefixes = Array.isArray(payload.prefixes)
      ? payload.prefixes.filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    for (const objectPath of prefixes) {
      this.storageObjects.delete(objectPath);
    }

    return jsonResponse([]);
  }

  private readUserId(url: URL): string {
    const filter = url.searchParams.get("id");

    if (filter === null || !filter.startsWith("eq.")) {
      throw new Error("Expected id filter");
    }

    return filter.slice(3);
  }
}

const originalFetch = globalThis.fetch;
let supabase: MockSupabase;

const useSupabase = (options: MockOptions = {}) => {
  supabase = new MockSupabase(options);
  globalThis.fetch = supabase.fetch as typeof fetch;
};

const requestProfile = (
  method: "GET" | "PATCH" = "GET",
  body?: unknown,
): Promise<Response> =>
  Promise.resolve(
    app.request("http://localhost/profile", {
      method,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

const requestAvatar = (formData: FormData): Promise<Response> =>
  Promise.resolve(
    app.request("http://localhost/profile/avatar", {
      method: "PUT",
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: formData,
    }),
  );

const avatarForm = (file?: File): FormData => {
  const formData = new FormData();

  if (file !== undefined) {
    formData.append("avatar", file);
  }

  return formData;
};

const pngFile = (
  size = 8,
  type = "image/png",
): File => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return new File([bytes], "avatar.png", { type });
};

beforeEach(() => {
  authService.resetIdentityCacheForTests();
  useSupabase();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /profile", () => {
  test("缺少 Bearer token 返回 401", async () => {
    const response = await app.request("http://localhost/profile");
    expect(response.status).toBe(401);
    expect(supabase.authCount).toBe(0);
  });

  test("无效 token 返回 401", async () => {
    useSupabase({ invalidToken: true });
    const response = await requestProfile();
    expect(response.status).toBe(401);
    expect(supabase.selectCount).toBe(0);
  });

  test("已有资料原样返回且不插入", async () => {
    const existing = profileFixture({ username: "Edited", bio: "Edited bio" });
    supabase.profiles.set(USER_ID, existing);
    const response = await requestProfile();
    const payload = (await response.json()) as { data: Profile };
    expect(payload.data).toEqual(existing);
    expect(supabase.insertCount).toBe(0);
  });

  test("不存在时创建 folune_ 数字默认资料", async () => {
    const response = await requestProfile();
    const payload = (await response.json()) as { data: Profile };
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(payload.data.username).toMatch(/^folune_\d{8}$/);
    expect(supabase.insertBodyKeys).toEqual([
      ["email", "id", "username"],
    ]);
    expect(supabase.conflictContractMatched).toBe(true);
    expect(supabase.headersMatched).toBe(true);
  });

  test("重复 GET 不重置资料", async () => {
    const first = (await (await requestProfile()).json()) as { data: Profile };
    const second = (await (await requestProfile()).json()) as { data: Profile };
    expect(second.data).toEqual(first.data);
    expect(supabase.insertCount).toBe(1);
  });

  test("并发首次 GET 返回同一资料", async () => {
    useSupabase({ synchronizeMissingReads: true });
    const responses = await Promise.all([requestProfile(), requestProfile()]);
    const profiles = await Promise.all(
      responses.map(async (response) =>
        ((await response.json()) as { data: Profile }).data),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(profiles[1]).toEqual(profiles[0]);
    expect(supabase.insertCount).toBe(2);
    expect(supabase.ignoredInsertCount).toBe(1);
  });
});

describe("PATCH /profile", () => {
  test("不存在时先创建再局部更新", async () => {
    const response = await requestProfile("PATCH", {
      username: "New username",
      bio: "New bio",
    });
    const payload = (await response.json()) as { data: Profile };
    expect(response.status).toBe(200);
    expect(payload.data.username).toBe("New username");
    expect(payload.data.bio).toBe("New bio");
    expect(supabase.patchBodyKeys).toEqual([["bio", "username"]]);
  });

  test("只更新提交字段且保留旧资料", async () => {
    const existing = profileFixture({ username: "keep_user" });
    supabase.profiles.set(USER_ID, existing);
    const response = await requestProfile("PATCH", { bio: "Only bio" });
    const payload = (await response.json()) as { data: Profile };
    expect(payload.data.username).toBe(existing.username);
    expect(supabase.patchBodyKeys).toEqual([["bio"]]);
  });

  test("空对象和空 username 返回 400", async () => {
    expect((await requestProfile("PATCH", {})).status).toBe(400);
    expect((await requestProfile("PATCH", { username: "   " })).status).toBe(400);
    expect((await requestProfile("PATCH", { username: null })).status).toBe(400);
    expect(supabase.updateCount).toBe(0);
  });

  for (const field of [
    "id",
    "user_id",
    "owner_id",
    "nickname",
    "email",
    "avatar_url",
    "age",
    "headline",
    "location",
    "website_url",
    "company",
    "role",
    "honor_title",
    "reputation_score",
    "badges",
    "social_links",
    "metadata",
    "created_at",
    "updated_at",
  ]) {
    test(`禁止修改 ${field}`, async () => {
      const response = await requestProfile("PATCH", { [field]: "forbidden" });
      expect(response.status).toBe(400);
      expect(supabase.updateCount).toBe(0);
    });
  }
});

describe("PUT /profile/avatar", () => {
  test("缺少 Bearer token 在解析文件前返回 401", async () => {
    const response = await app.request("http://localhost/profile/avatar", {
      method: "PUT",
      body: avatarForm(pngFile()),
    });

    expect(response.status).toBe(401);
    expect(supabase.storageEvents).toEqual([]);
  });

  test("缺少 avatar 文件返回 400", async () => {
    const response = await requestAvatar(avatarForm());
    expect(response.status).toBe(400);
    expect(supabase.storageEvents).toEqual([]);
  });

  test("超过 5MB 的文件返回 413 且不访问 Storage", async () => {
    const response = await requestAvatar(
      avatarForm(pngFile(MAX_AVATAR_FILE_BYTES + 1)),
    );

    expect(response.status).toBe(413);
    expect(supabase.storageEvents).toEqual([]);
  });

  test("无效图片签名返回 415", async () => {
    const invalidSignature = await requestAvatar(
      avatarForm(
        new File([new Uint8Array(16)], "avatar.png", {
          type: "image/png",
        }),
      ),
    );

    expect(invalidSignature.status).toBe(415);
    expect(supabase.storageEvents).toEqual([]);
  });

  test("上传有效头像并同步更新 profile.avatar_url", async () => {
    supabase.profiles.set(USER_ID, profileFixture());
    const response = await requestAvatar(avatarForm(pngFile()));
    const payload = (await response.json()) as { data: Profile };
    const objectPath = payload.data.avatar_url?.slice(
      AVATAR_PUBLIC_PREFIX.length,
    );

    expect(response.status).toBe(200);
    expect(payload.data.avatar_url).toMatch(
      new RegExp(
        `^${AVATAR_PUBLIC_PREFIX}${USER_ID}/[0-9a-f-]{36}\\.png$`,
      ),
    );
    expect(objectPath).toBeDefined();
    expect(supabase.storageObjects.has(objectPath ?? "")).toBe(true);
    expect(supabase.uploadedContentTypes).toEqual(["image/png"]);
    expect(supabase.patchBodyKeys).toEqual([["avatar_url"]]);
    expect(supabase.headersMatched).toBe(true);
  });

  test("更换头像时先更新 profile 再通过 Storage API 删除旧文件", async () => {
    const oldObjectPath = `${USER_ID}/old-avatar.png`;
    const oldAvatarUrl = `${AVATAR_PUBLIC_PREFIX}${oldObjectPath}`;
    supabase.profiles.set(
      USER_ID,
      profileFixture({ avatar_url: oldAvatarUrl }),
    );
    supabase.storageObjects.add(oldObjectPath);

    const response = await requestAvatar(avatarForm(pngFile()));
    const payload = (await response.json()) as { data: Profile };
    const newObjectPath = payload.data.avatar_url?.slice(
      AVATAR_PUBLIC_PREFIX.length,
    );

    expect(response.status).toBe(200);
    expect(supabase.storageEvents).toEqual([
      "storage:upload",
      "profile:patch",
      "storage:delete",
    ]);
    expect(supabase.storageObjects.has(oldObjectPath)).toBe(false);
    expect(supabase.storageObjects.has(newObjectPath ?? "")).toBe(true);
  });

  test("外部旧头像 URL 不会被当作受管 Storage 对象删除", async () => {
    supabase.profiles.set(
      USER_ID,
      profileFixture({ avatar_url: "https://example.com/avatar.png" }),
    );

    const response = await requestAvatar(avatarForm(pngFile()));
    expect(response.status).toBe(200);
    expect(supabase.storageEvents).toEqual([
      "storage:upload",
      "profile:patch",
    ]);
  });

  test("profile 并发更新持续冲突时删除新对象并返回 409", async () => {
    useSupabase({ rejectAvatarUpdates: true });
    supabase.profiles.set(USER_ID, profileFixture());

    const response = await requestAvatar(avatarForm(pngFile()));
    expect(response.status).toBe(409);
    expect(supabase.storageObjects.size).toBe(0);
    expect(supabase.storageEvents.at(-1)).toBe("storage:delete");
  });

  test("Storage 上传失败时不更新 profile", async () => {
    useSupabase({ storageUploadFails: true });
    supabase.profiles.set(USER_ID, profileFixture());

    const response = await requestAvatar(avatarForm(pngFile()));
    expect(response.status).toBe(502);
    expect(supabase.updateCount).toBe(0);
  });
});
