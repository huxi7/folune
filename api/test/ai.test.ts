/**
 * [INPUT]: 依赖 Bun test、Hono app、Web fetch、内存 Supabase Auth/PostgREST/RPC mock 与 service/auth 的身份缓存测试清空口
 * [OUTPUT]: 覆盖无归档状态的 AI thread/bootstrap/detail/content 并发读取、prepare-chat 增量首轮/续写与 assistant 定点 PATCH、message/reference/context/run 认证、持久化、幂等、owner、废弃字段拒绝、失效引用与安全执行测试
 * [POS]: api/test 的 AI Native V1 HTTP 全链路契约测试，不连接模型或远端服务，不保存或输出真实凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type {
  AiCommand,
  AiMessage,
  AiRun,
  AiThread,
  AiThreadReference,
  AiUserSettings,
} from "../src/model/ai.model.ts";
import type { MemoContent, MemoNode } from "../src/model/memo.model.ts";

const SUPABASE_URL = "https://profile-test.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_profile_test";
const ACCESS_TOKEN = "ai-test-access-token";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMO_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMO_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MISSING_MEMO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RUN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const COMMAND_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const NOW = "2026-08-13T08:00:00.000Z";

Bun.env["NODE_ENV"] = "test";
Bun.env["SUPABASE_URL"] = SUPABASE_URL;
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY;

const { app } = await import("../src/app.ts");
const { authService } = await import("../src/service/auth.service.ts");

const response = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const threadFixture = (
  overrides: Partial<AiThread> = {},
): AiThread => ({
  id: THREAD_ID,
  user_id: USER_ID,
  title: "新会话",
  created_at: NOW,
  updated_at: NOW,
  last_message_at: NOW,
  ...overrides,
});

const memoNodeFixture = (
  id: string,
  overrides: Partial<MemoNode> = {},
): MemoNode => ({
  id,
  user_id: USER_ID,
  parent_id: null,
  node_type: "memo",
  title: id === MEMO_A ? "产品构想" : "用户调研",
  sort_order: id === MEMO_A ? 1000 : 2000,
  icon: null,
  color: null,
  metadata: {},
  revision: id === MEMO_A ? 3 : 5,
  deleted_at: null,
  deleted_root_id: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const contentFixture = (nodeId: string): MemoContent => ({
  node_id: nodeId,
  user_id: USER_ID,
  content_mdx: nodeId === MEMO_A ? "A 的最新正文" : "B 的参考正文",
  excerpt: null,
  word_count: 7,
  metadata: {},
  created_at: NOW,
  updated_at: NOW,
});

const runFixture = (overrides: Partial<AiRun> = {}): AiRun => ({
  id: RUN_ID,
  user_id: USER_ID,
  thread_id: THREAD_ID,
  run_type: "organize_memo",
  memo_id: MEMO_A,
  source_revision: 3,
  status: "planning",
  idempotency_key: "organize-once",
  plan: null,
  result: null,
  error_code: null,
  created_at: NOW,
  updated_at: NOW,
  applied_at: null,
  undone_at: null,
  ...overrides,
});

const settingsFixture = (overrides: Partial<AiUserSettings> = {}): AiUserSettings => ({
  user_id: USER_ID,
  permission_mode: "ask",
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const commandFixture = (overrides: Partial<AiCommand> = {}): AiCommand => ({
  id: COMMAND_ID,
  user_id: USER_ID,
  thread_id: THREAD_ID,
  tool_call_id: "tool-command-1",
  operation: "rename_node",
  target_node_id: MEMO_A,
  expected_revision: 3,
  idempotency_key: "command-once",
  input: { title: "新标题" },
  before_state: null,
  after_state: null,
  undo_result: null,
  status: "succeeded",
  approval_source: "approval_agent",
  risk: "low",
  approval_reason: "目标明确",
  error_code: null,
  created_at: NOW,
  updated_at: NOW,
  applied_at: NOW,
  undone_at: null,
  ...overrides,
});

class MockSupabase {
  readonly threads = new Map<string, AiThread>();
  readonly messages = new Map<string, AiMessage>();
  readonly references: AiThreadReference[] = [];
  readonly nodes = new Map<string, MemoNode>();
  readonly contents = new Map<string, MemoContent>();
  readonly runs = new Map<string, AiRun>();
  readonly commands = new Map<string, AiCommand>();
  settings: AiUserSettings | null = null;
  readonly rpcBodies: Array<{ name: string; body: Record<string, unknown> }> = [];
  readonly requests: Array<{ method: string; path: string }> = [];
  headersMatched = true;
  upsertMatched = true;
  private threadCounter = 1;

  readonly fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    this.requests.push({ method: request.method, path: url.pathname });
    this.headersMatched &&=
      request.headers.get("apikey") === PUBLISHABLE_KEY &&
      request.headers.get("Authorization") === `Bearer ${ACCESS_TOKEN}`;

    if (url.pathname === "/auth/v1/user") {
      return response({ id: USER_ID, email: "ai-test@example.com" });
    }
    if (url.pathname === "/rest/v1/ai_threads") {
      return this.handleThreads(request, url);
    }
    if (url.pathname === "/rest/v1/ai_messages") {
      return this.handleMessages(request, url);
    }
    if (url.pathname === "/rest/v1/ai_thread_refs") {
      return this.handleReferences(request, url);
    }
    if (url.pathname === "/rest/v1/memo_nodes") {
      return this.handleMemoNodes(request, url);
    }
    if (url.pathname === "/rest/v1/memos") {
      return this.handleMemoContents(request, url);
    }
    if (url.pathname === "/rest/v1/ai_runs") {
      return this.handleRuns(request, url);
    }
    if (url.pathname === "/rest/v1/ai_user_settings") {
      return this.handleSettings(request);
    }
    if (url.pathname === "/rest/v1/ai_commands") {
      return this.handleCommands(request, url);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return this.handleRpc(request, url.pathname.slice("/rest/v1/rpc/".length));
    }
    throw new Error(`Unexpected path: ${url.pathname}`);
  };

  private userId(url: URL): string {
    return url.searchParams.get("user_id")?.replace(/^eq\./, "") ?? "";
  }

  private async handleThreads(request: Request, url: URL): Promise<Response> {
    if (request.method === "POST") {
      const input = (await request.json()) as { user_id: string; title: string };
      const id = this.threadCounter++ === 1
        ? THREAD_ID
        : `aaaaaaaa-aaaa-4aaa-8aaa-${String(this.threadCounter).padStart(12, "0")}`;
      const created = threadFixture({ id, user_id: input.user_id, title: input.title });
      this.threads.set(id, created);
      return response([created], 201);
    }

    const owner = this.userId(url);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const title = url.searchParams.get("title")?.replace(/^eq\./, "");
    let rows = [...this.threads.values()].filter((thread) => thread.user_id === owner);
    if (id) rows = rows.filter((thread) => thread.id === id);
    if (title) rows = rows.filter((thread) => thread.title === title);

    if (request.method === "GET") return response(rows);
    if (request.method === "PATCH") {
      const input = (await request.json()) as Partial<AiThread>;
      const updated = rows.map((thread) => ({ ...thread, ...input, updated_at: NOW }));
      updated.forEach((thread) => this.threads.set(thread.id, thread));
      return response(updated);
    }
    if (request.method === "DELETE") {
      rows.forEach((thread) => this.threads.delete(thread.id));
      return response(rows);
    }
    throw new Error(`Unexpected ai_threads method: ${request.method}`);
  }

  private async handleMessages(request: Request, url: URL): Promise<Response> {
    const owner = this.userId(url);
    const threadId = url.searchParams.get("thread_id")?.replace(/^eq\./, "") ?? "";
    if (request.method === "GET") {
      return response(
        [...this.messages.values()]
          .filter((message) => message.user_id === owner && message.thread_id === threadId)
          .sort((left, right) => left.position - right.position),
      );
    }
    if (request.method === "POST") {
      this.upsertMatched &&=
        url.searchParams.get("on_conflict") === "thread_id,id" &&
        (request.headers.get("Prefer") ?? "").includes("resolution=merge-duplicates");
      const inputs = (await request.json()) as Array<
        Omit<AiMessage, "created_at" | "updated_at">
      >;
      const rows = inputs.map((input) => ({
        ...input,
        created_at: this.messages.get(`${input.thread_id}:${input.id}`)?.created_at ?? NOW,
        updated_at: NOW,
      }));
      rows.forEach((message) => this.messages.set(`${message.thread_id}:${message.id}`, message));
      return response(rows, 201);
    }
    if (request.method === "PATCH") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? "";
      const key = `${threadId}:${id}`;
      const current = this.messages.get(key);
      const role = url.searchParams.get("role")?.replace(/^eq\./, "");
      if (current === undefined || (role !== undefined && current.role !== role)) {
        return response([]);
      }
      const input = await request.json() as Partial<AiMessage>;
      const updated = { ...current, ...input, updated_at: NOW };
      this.messages.set(key, updated);
      return response([updated]);
    }
    throw new Error(`Unexpected ai_messages method: ${request.method}`);
  }

  private handleReferences(request: Request, url: URL): Response {
    if (request.method !== "GET") throw new Error("Unexpected reference write");
    const owner = this.userId(url);
    const threadId = url.searchParams.get("thread_id")?.replace(/^eq\./, "");
    return response(
      this.references.filter(
        (reference) => reference.user_id === owner && reference.thread_id === threadId,
      ),
    );
  }

  private handleMemoNodes(request: Request, url: URL): Response {
    if (request.method !== "GET") throw new Error("Unexpected memo node write");
    const owner = this.userId(url);
    return response(
      [...this.nodes.values()].filter(
        (node) => node.user_id === owner && node.deleted_at === null,
      ),
    );
  }

  private handleMemoContents(request: Request, url: URL): Response {
    if (request.method !== "GET") throw new Error("Unexpected memo content write");
    const owner = this.userId(url);
    return response([...this.contents.values()].filter((content) => content.user_id === owner));
  }

  private handleRuns(request: Request, url: URL): Response {
    if (request.method !== "GET") throw new Error("AI runs must mutate through RPC");
    const owner = this.userId(url);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    return response(
      [...this.runs.values()].filter((run) => run.user_id === owner && (!id || run.id === id)),
    );
  }

  private async handleSettings(request: Request): Promise<Response> {
    if (request.method === "GET") return response(this.settings === null ? [] : [this.settings]);
    if (request.method === "POST") {
      const input = await request.json() as Pick<AiUserSettings, "user_id" | "permission_mode">;
      this.settings = settingsFixture(input);
      return response([this.settings], 201);
    }
    throw new Error(`Unexpected ai_user_settings method: ${request.method}`);
  }

  private handleCommands(request: Request, url: URL): Response {
    if (request.method !== "GET") throw new Error("AI commands must mutate through RPC");
    const owner = this.userId(url);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    return response([...this.commands.values()].filter(
      (command) => command.user_id === owner && (!id || command.id === id),
    ));
  }

  private async handleRpc(request: Request, name: string): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    this.rpcBodies.push({ name, body });
    if (name === "replace_ai_thread_references") {
      const threadId = String(body["p_thread_id"]);
      const ids = [...new Set(body["p_memo_ids"] as string[])];
      if (!this.threads.has(threadId)) return response({ status: "not_found" });
      if (ids.some((id) => !this.nodes.has(id))) {
        return response({ status: "invalid_reference" });
      }
      this.references.splice(
        0,
        this.references.length,
        ...ids.map((memoId, index) => ({
          thread_id: threadId,
          user_id: USER_ID,
          memo_id: memoId,
          created_at: `${NOW}.${index}`,
        })),
      );
      return response({ status: "replaced", references: this.references });
    }

    if (name === "create_ai_organize_run") {
      const existing = [...this.runs.values()].find(
        (run) => run.idempotency_key === body["p_idempotency_key"],
      );
      if (existing) return response({ status: "existing", run: existing });
      const run = runFixture({
        thread_id: (body["p_thread_id"] as string | null) ?? null,
        memo_id: String(body["p_memo_id"]),
        idempotency_key: String(body["p_idempotency_key"]),
      });
      this.runs.set(run.id, run);
      return response({ status: "created", run });
    }

    if (name === "create_ai_command") {
      const existing = [...this.commands.values()].find(
        (command) => command.idempotency_key === body["p_idempotency_key"],
      );
      if (existing) return response({ status: existing.status, command: existing });
      const command = commandFixture({
        operation: body["p_operation"] as AiCommand["operation"],
        target_node_id: body["p_target_node_id"] as string | null,
        expected_revision: body["p_expected_revision"] as number | null,
        idempotency_key: String(body["p_idempotency_key"]),
        input: body["p_input"] as Record<string, unknown>,
      });
      this.commands.set(command.id, command);
      return response({ status: command.status, command });
    }

    if (["approve_ai_command", "reject_ai_command", "undo_ai_command"].includes(name)) {
      const command = this.commands.get(String(body["p_command_id"]));
      if (!command) return response({ status: "not_found" });
      if (name === "reject_ai_command") command.status = "rejected";
      if (name === "undo_ai_command") command.status = "undone";
      return response({ status: command.status, command });
    }

    const run = this.runs.get(String(body["p_run_id"]));
    if (!run) return response({ status: "not_found" });
    if (name === "record_ai_organize_plan") {
      Object.assign(run, {
        plan: body["p_plan"],
        status: body["p_requires_confirmation"] ? "awaiting_confirmation" : "planning",
      });
    } else if (name === "apply_ai_organize_run") {
      if (run.status !== "succeeded") run.status = "succeeded";
    } else if (name === "undo_ai_organize_run") {
      if (run.status !== "undone") run.status = "undone";
    } else if (name === "reject_ai_organize_run") {
      run.status = "rejected";
    } else if (name === "fail_ai_organize_run") {
      run.status = "failed";
      run.error_code = String(body["p_error_code"]);
    }
    return response({ status: run.status, run });
  }
}

const originalFetch = globalThis.fetch;
let mock: MockSupabase;

beforeEach(() => {
  authService.resetIdentityCacheForTests();
  mock = new MockSupabase();
  globalThis.fetch = mock.fetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const request = (path: string, method = "GET", body?: unknown) =>
  app.request(path, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const data = async <T>(result: Response): Promise<T> =>
  ((await result.json()) as { data: T }).data;

describe("AI API authentication", () => {
  test("all AI resources reject missing Bearer before storage access", async () => {
    for (const pending of [
      app.request("/ai-threads"),
      app.request(`/ai-threads/${THREAD_ID}/content`),
      app.request(`/ai-threads/${THREAD_ID}/messages`),
      app.request("/ai-context/resolve", { method: "POST" }),
      app.request(`/ai-runs/${RUN_ID}`),
      app.request("/ai-settings"),
      app.request(`/ai-commands/${COMMAND_ID}`),
    ]) {
      expect((await pending).status).toBe(401);
    }
  });
});

describe("AI settings and commands", () => {
  test("creates default account settings and updates all three modes", async () => {
    const initial = await data<AiUserSettings>(await request("/ai-settings"));
    expect(initial.permission_mode).toBe("ask");
    for (const permission_mode of ["ask", "auto_approve", "full_access"] as const) {
      const updated = await data<AiUserSettings>(
        await request("/ai-settings", "PATCH", { permission_mode }),
      );
      expect(updated.permission_mode).toBe(permission_mode);
    }
  });

  test("submits a revision/idempotency command and supports owner undo", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.nodes.set(MEMO_A, memoNodeFixture(MEMO_A));
    const input = {
      operation: "rename_node",
      thread_id: THREAD_ID,
      tool_call_id: "tool-command-1",
      target_node_id: MEMO_A,
      expected_revision: 3,
      idempotency_key: "command-once",
      input: { title: "新标题" },
      approval_source: "approval_agent",
      risk: "low",
      approval_reason: "目标明确",
    };
    const first = await data<AiCommand>(await request("/ai-commands", "POST", input));
    const second = await data<AiCommand>(await request("/ai-commands", "POST", input));
    expect(second.id).toBe(first.id);
    const rpc = mock.rpcBodies.find((call) => call.name === "create_ai_command");
    expect(rpc?.body).toMatchObject({
      p_expected_revision: 3,
      p_idempotency_key: "command-once",
      p_user_id: USER_ID,
    });
    const undone = await data<AiCommand>(
      await request(`/ai-commands/${COMMAND_ID}/undo`, "POST"),
    );
    expect(undone.status).toBe("undone");
  });

  test("rejects missing revisions and hides another user's command", async () => {
    expect((await request("/ai-commands", "POST", {
      operation: "rename_node",
      target_node_id: MEMO_A,
      idempotency_key: "missing-revision",
      input: { title: "非法" },
    })).status).toBe(400);
    mock.commands.set(COMMAND_ID, commandFixture({ user_id: OTHER_USER_ID }));
    expect((await request(`/ai-commands/${COMMAND_ID}`)).status).toBe(404);
  });
});

describe("AI threads and messages", () => {
  test("GET thread 并发读取详情与引用，只等待一段存储往返", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    const originalMockFetch = mock.fetch;
    let started = 0;
    let overlapped = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fallbackTimer = setTimeout(release, 40);
    globalThis.fetch = (async (input, init) => {
      const url = new URL(input instanceof URL
        ? input.href
        : typeof input === "string"
          ? input
          : input.url);
      const detailRead = url.pathname === "/rest/v1/ai_threads"
        || url.pathname === "/rest/v1/ai_thread_refs";
      if (detailRead && new Request(input, init).method === "GET") {
        started += 1;
        if (started === 2) {
          overlapped = true;
          release();
        }
        await gate;
      }
      return await originalMockFetch(input, init);
    }) as typeof fetch;

    const response = await request(`/ai-threads/${THREAD_ID}`);
    clearTimeout(fallbackTimer);

    expect(response.status).toBe(200);
    expect(overlapped).toBe(true);
  });

  test("bootstrap 一次返回会话列表、选中详情与消息，并尊重有效偏好", async () => {
    mock.threads.set(THREAD_ID, threadFixture({ title: "保留会话" }));
    mock.messages.set(`${THREAD_ID}:message-1`, {
      id: "message-1",
      thread_id: THREAD_ID,
      user_id: USER_ID,
      role: "assistant",
      parts: [{ type: "text", text: "历史" }],
      position: 0,
      status: "complete",
      context_snapshot: null,
      created_at: NOW,
      updated_at: NOW,
    });
    const result = await data<{
      threads: AiThread[];
      selectedThread: AiThread & { references: AiThreadReference[] };
      messages: AiMessage[];
    }>(await request(`/ai-threads/bootstrap?selected_id=${THREAD_ID}`));
    expect(result.threads).toHaveLength(1);
    expect(result.selectedThread.id).toBe(THREAD_ID);
    expect(result.messages[0]?.id).toBe("message-1");
  });

  test("content 用一次 HTTP 响应并发返回目标会话、引用与消息", async () => {
    mock.threads.set(THREAD_ID, threadFixture({ title: "目标会话" }));
    mock.references.push({
      created_at: NOW,
      memo_id: MEMO_A,
      thread_id: THREAD_ID,
      user_id: USER_ID,
    });
    mock.messages.set(`${THREAD_ID}:message-1`, {
      id: "message-1",
      thread_id: THREAD_ID,
      user_id: USER_ID,
      role: "assistant",
      parts: [{ type: "text", text: "历史" }],
      position: 0,
      status: "complete",
      context_snapshot: null,
      created_at: NOW,
      updated_at: NOW,
    });
    const originalMockFetch = mock.fetch;
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fallbackTimer = setTimeout(release, 40);
    globalThis.fetch = (async (input, init) => {
      const url = new URL(input instanceof URL
        ? input.href
        : typeof input === "string"
          ? input
          : input.url);
      if (["/rest/v1/ai_threads", "/rest/v1/ai_thread_refs", "/rest/v1/ai_messages"]
        .includes(url.pathname) && new Request(input, init).method === "GET") {
        started += 1;
        if (started === 3) release();
        await gate;
      }
      return await originalMockFetch(input, init);
    }) as typeof fetch;

    const result = await data<{
      messages: AiMessage[];
      selectedThread: AiThread & { references: AiThreadReference[] };
    }>(await request(`/ai-threads/${THREAD_ID}/content`));
    clearTimeout(fallbackTimer);

    expect(started).toBe(3);
    expect(result.selectedThread.title).toBe("目标会话");
    expect(result.selectedThread.references[0]?.memo_id).toBe(MEMO_A);
    expect(result.messages[0]?.id).toBe("message-1");
  });

  test("Chat bootstrap 历史按 Accept-Encoding 压缩且解压后保持原 envelope", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.messages.set(`${THREAD_ID}:message-large`, {
      id: "message-large",
      thread_id: THREAD_ID,
      user_id: USER_ID,
      role: "assistant",
      parts: [{ type: "text", text: "历史内容 ".repeat(4000) }],
      position: 0,
      status: "complete",
      context_snapshot: null,
      created_at: NOW,
      updated_at: NOW,
    });

    const requestWithEncoding = new Request(
      `http://localhost/ai-threads/bootstrap?selected_id=${THREAD_ID}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      },
    );
    const compressed = await app.fetch(requestWithEncoding);
    expect(compressed.status).toBe(200);
    expect(compressed.headers.get("Content-Encoding")).toBe("gzip");
    expect(compressed.headers.get("Vary")).toContain("Accept-Encoding");
    const decoded = JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(await compressed.arrayBuffer()))),
    ) as { data: { messages: AiMessage[] } };
    expect(decoded.data.messages[0]?.id).toBe("message-large");
  });

  test("creates, renames, lists and permanently deletes a thread", async () => {
    const created = await data<AiThread>(await request("/ai-threads", "POST", {}));
    expect(created.title).toBe("新会话");
    const renamed = await data<AiThread>(
      await request(`/ai-threads/${THREAD_ID}`, "PATCH", { title: "产品讨论" }),
    );
    expect(renamed.title).toBe("产品讨论");
    expect((await data<AiThread[]>(await request("/ai-threads"))).length).toBe(1);
    expect((await request(`/ai-threads/${THREAD_ID}`, "PATCH", {
      status: "archived",
    })).status).toBe(400);
    expect((await request(`/ai-threads/${THREAD_ID}`, "DELETE")).status).toBe(200);
    expect(mock.threads.size).toBe(0);
  });

  test("upserts UIMessage parts idempotently and generates the default title once", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    const messages = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "  帮我   分析这篇产品构想的核心价值  " }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "分析中" },
          { type: "tool-read_memo", toolCallId: "call-1", state: "output-available", output: { ok: true } },
          { type: "text", text: "结论" },
        ],
        status: "complete",
      },
    ];
    await request(`/ai-threads/${THREAD_ID}/messages`, "PUT", messages);
    const saved = mock.messages.get(`${THREAD_ID}:user-1`);
    if (saved !== undefined) {
      saved.context_snapshot = {
        primary: { memo_id: MEMO_A, title: "产品构想", revision: 3 },
        references: [],
      };
    }
    await request(`/ai-threads/${THREAD_ID}/messages`, "PUT", messages);
    const stored = await data<AiMessage[]>(await request(`/ai-threads/${THREAD_ID}/messages`));
    expect(stored).toHaveLength(2);
    expect(stored[1]?.parts).toEqual(messages[1]?.parts);
    expect(stored[0]?.context_snapshot?.primary?.memo_id).toBe(MEMO_A);
    expect(mock.threads.get(THREAD_ID)?.title).toBe("帮我 分析这篇产品构想的核心价值");
    expect(mock.upsertMatched).toBe(true);
  });

  test("普通问答没有引用时不读文件树、正文或会话引用", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.requests.length = 0;
    const result = await request("/ai-context/prepare-chat", "POST", {
      thread_id: THREAD_ID, active_memo_id: null, reference_memo_ids: [],
      expected_revisions: {}, include_thread_references: false,
      response_message_id: "msg_plain",
      message: { id: "plain", role: "user", parts: [{ type: "text", text: "你好" }] },
    });
    expect(result.status).toBe(200);
    expect(mock.requests.filter((call) => ["/rest/v1/memo_nodes", "/rest/v1/memos", "/rest/v1/ai_thread_refs"].includes(call.path))).toHaveLength(0);
  });

  test("历史读取先失败时立即返回错误，不被其他挂起查询拖住或变成未处理拒绝", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname;
      if (path === "/rest/v1/ai_messages") throw new TypeError("network disconnected");
      if (path === "/rest/v1/ai_threads") await blocked;
      return mock.fetch(input, init);
    }) as unknown as typeof fetch;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        request("/ai-context/prepare-chat", "POST", {
          thread_id: THREAD_ID, active_memo_id: null, reference_memo_ids: [],
          expected_revisions: {}, include_thread_references: false,
          response_message_id: "msg_failure",
          message: { id: "failure", role: "user", parts: [{ type: "text", text: "你好" }] },
        }),
        new Promise<Response>((_, reject) => { timer = setTimeout(() => reject(new Error("仍在等待无关查询")), 100); }),
      ]);
      expect(result.status).toBe(503);
    } finally {
      clearTimeout(timer);
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

  test("Chat prepare 支持首轮完整消息与续写增量，并只创建一个稳定 assistant", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.nodes.set(MEMO_A, memoNodeFixture(MEMO_A));
    mock.contents.set(MEMO_A, contentFixture(MEMO_A));
    mock.requests.length = 0;

    const first = await data<{
      context: { primary: { memo_id: string } };
      messages: Array<{ id: string; status?: string }>;
      response_message_id: string;
    }>(await request("/ai-context/prepare-chat", "POST", {
      thread_id: THREAD_ID,
      active_memo_id: MEMO_A,
      reference_memo_ids: [],
      expected_revisions: { [MEMO_A]: 3 },
      include_thread_references: false,
      messages: [{
        id: "user-first",
        role: "user",
        parts: [{ type: "text", text: "请分析" }],
        metadata: {
          context: {
            active_memo_id: MEMO_A,
            reference_memo_ids: [],
            revisions: { [MEMO_A]: 3 },
          },
        },
      }],
      response_message_id: "msg_user-first",
    }));

    expect(first.context.primary.memo_id).toBe(MEMO_A);
    expect(mock.requests.some((call) => call.path === "/rest/v1/ai_thread_refs")).toBe(false);
    expect(first.messages.map((message) => message.id)).toEqual([
      "user-first",
      "msg_user-first",
    ]);
    expect(first.messages.at(-1)?.status).toBe("in_progress");
    expect(mock.requests.filter((request) => request.path === "/rest/v1/ai_messages").map((request) => request.method)).toEqual(["POST"]);

    mock.requests.length = 0;
    const continued = await data<{
      messages: Array<{ id: string; parts: unknown[]; status?: string }>;
    }>(await request("/ai-context/prepare-chat", "POST", {
      thread_id: THREAD_ID,
      active_memo_id: MEMO_A,
      reference_memo_ids: [],
      expected_revisions: {},
      include_thread_references: false,
      message: {
        id: "msg_user-first",
        role: "assistant",
        parts: [{ type: "text", text: "完成" }],
        status: "complete",
      },
      response_message_id: "msg_user-first",
    }));

    expect(continued.messages).toHaveLength(2);
    expect(continued.messages.at(-1)?.id).toBe("msg_user-first");
    expect(continued.messages.at(-1)?.parts).toEqual([
      { type: "text", text: "完成" },
    ]);
    expect(mock.messages.size).toBe(2);
    expect(mock.requests.filter((request) => request.path === "/rest/v1/ai_messages").map((request) => request.method)).toEqual(["GET", "PATCH"]);
  });

  test("assistant PATCH 只更新当前回复，不重写用户消息", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.messages.set(`${THREAD_ID}:user-1`, {
      id: "user-1",
      thread_id: THREAD_ID,
      user_id: USER_ID,
      role: "user",
      parts: [{ type: "text", text: "原问题" }],
      position: 0,
      status: "complete",
      context_snapshot: null,
      created_at: NOW,
      updated_at: NOW,
    });
    mock.messages.set(`${THREAD_ID}:assistant-1`, {
      id: "assistant-1",
      thread_id: THREAD_ID,
      user_id: USER_ID,
      role: "assistant",
      parts: [],
      position: 1,
      status: "in_progress",
      context_snapshot: null,
      created_at: NOW,
      updated_at: NOW,
    });

    const result = await request(
      `/ai-threads/${THREAD_ID}/messages/assistant-1`,
      "PATCH",
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "已完成" }],
        status: "complete",
      },
    );
    expect(result.status).toBe(200);
    expect(mock.messages.get(`${THREAD_ID}:user-1`)?.parts).toEqual([
      { type: "text", text: "原问题" },
    ]);
    expect(mock.messages.get(`${THREAD_ID}:assistant-1`)?.parts).toEqual([
      { type: "text", text: "已完成" },
    ]);
    expect((await request(
      `/ai-threads/${THREAD_ID}/messages/user-1`,
      "PATCH",
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "不应改写" }],
        status: "complete",
      },
    )).status).toBe(404);
  });

  test("prepare-chat 拒绝与当前 turn 不匹配的 assistant id", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    const result = await request("/ai-context/prepare-chat", "POST", {
      thread_id: THREAD_ID,
      active_memo_id: null,
      reference_memo_ids: [],
      expected_revisions: {},
      include_thread_references: false,
      message: {
        id: "user-safe",
        role: "user",
        parts: [{ type: "text", text: "问题" }],
      },
      response_message_id: "user-safe",
    });
    expect(result.status).toBe(400);
    expect(await result.json()).toMatchObject({ code: "AI_RESPONSE_ID_INVALID" });
  });
});

describe("AI references and context", () => {
  test("deduplicates references atomically and rejects missing or over-limit input", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.nodes.set(MEMO_A, memoNodeFixture(MEMO_A));
    mock.nodes.set(MEMO_B, memoNodeFixture(MEMO_B));
    const replaced = await data<AiThreadReference[]>(
      await request(`/ai-threads/${THREAD_ID}/references`, "PUT", {
        memo_ids: [MEMO_A, MEMO_B, MEMO_A],
      }),
    );
    expect(replaced.map((item) => item.memo_id)).toEqual([MEMO_A, MEMO_B]);
    expect(mock.rpcBodies.at(-1)?.name).toBe("replace_ai_thread_references");
    expect(
      (await request(`/ai-threads/${THREAD_ID}/references`, "PUT", {
        memo_ids: [MISSING_MEMO],
      })).status,
    ).toBe(404);
    expect(
      (await request(`/ai-threads/${THREAD_ID}/references`, "PUT", {
        memo_ids: [MEMO_A, MEMO_B, MISSING_MEMO, RUN_ID, THREAD_ID, USER_ID],
      })).status,
    ).toBe(400);
  });

  test("resolves latest primary plus ordered refs, de-duplicates primary and reports stale refs", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.nodes.set(MEMO_A, memoNodeFixture(MEMO_A));
    mock.nodes.set(MEMO_B, memoNodeFixture(MEMO_B));
    mock.contents.set(MEMO_A, contentFixture(MEMO_A));
    mock.contents.set(MEMO_B, contentFixture(MEMO_B));
    mock.references.push(
      { thread_id: THREAD_ID, user_id: USER_ID, memo_id: MEMO_A, created_at: NOW },
      { thread_id: THREAD_ID, user_id: USER_ID, memo_id: MEMO_B, created_at: `${NOW}.1` },
      { thread_id: THREAD_ID, user_id: USER_ID, memo_id: MISSING_MEMO, created_at: `${NOW}.2` },
    );
    const resolved = await data<{
      primary: { memo_id: string; content_mdx: string; revision: number };
      references: Array<{ memo_id: string }>;
      missing_reference_ids: string[];
    }>(
      await request("/ai-context/resolve", "POST", {
        thread_id: THREAD_ID,
        active_memo_id: MEMO_A,
      }),
    );
    expect(resolved.primary).toMatchObject({
      memo_id: MEMO_A,
      content_mdx: "A 的最新正文",
      revision: 3,
    });
    expect(resolved.references.map((item) => item.memo_id)).toEqual([MEMO_B]);
    expect(resolved.missing_reference_ids).toEqual([MISSING_MEMO]);

    const stale = await request("/ai-context/resolve", "POST", {
      thread_id: THREAD_ID,
      active_memo_id: MEMO_A,
      reference_memo_ids: [MEMO_B],
      include_thread_references: false,
      expected_revisions: { [MEMO_A]: 2, [MEMO_B]: 5 },
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      code: "AI_CONTEXT_STALE",
    });
  });
});

describe("AI organize runs", () => {
  test("create is idempotent and apply/undo submit only trusted run identity", async () => {
    mock.threads.set(THREAD_ID, threadFixture());
    mock.nodes.set(MEMO_A, memoNodeFixture(MEMO_A));
    const createBody = {
      memo_id: MEMO_A,
      thread_id: THREAD_ID,
      idempotency_key: "organize-once",
    };
    const first = await data<AiRun>(await request("/ai-runs", "POST", createBody));
    const second = await data<AiRun>(await request("/ai-runs", "POST", createBody));
    expect(second.id).toBe(first.id);
    const plan = {
      suggested_title: "新的标题",
      destination: { kind: "keep_current" },
      confidence: 0.95,
      reason: "已有位置最合适",
    };
    await request(`/ai-runs/${RUN_ID}/plan`, "PATCH", {
      plan,
      requires_confirmation: false,
    });
    await request(`/ai-runs/${RUN_ID}/apply`, "POST");
    await request(`/ai-runs/${RUN_ID}/apply`, "POST");
    await request(`/ai-runs/${RUN_ID}/undo`, "POST");
    await request(`/ai-runs/${RUN_ID}/undo`, "POST");
    const applyBodies = mock.rpcBodies.filter(
      (call) => call.name === "apply_ai_organize_run",
    );
    expect(applyBodies).toHaveLength(2);
    expect(applyBodies.every((call) => Object.keys(call.body).sort().join(",") === "p_run_id,p_user_id")).toBe(true);
    expect(mock.runs.get(RUN_ID)?.status).toBe("undone");
    expect(mock.headersMatched).toBe(true);
  });

  test("other-user runs remain indistinguishable from missing runs", async () => {
    mock.runs.set(RUN_ID, runFixture({ user_id: OTHER_USER_ID }));
    const result = await request(`/ai-runs/${RUN_ID}`);
    expect(result.status).toBe(404);
    expect((await result.json()).code).toBe("AI_RUN_NOT_FOUND");
  });
});
