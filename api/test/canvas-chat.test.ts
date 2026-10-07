/**
 * [INPUT]: 依赖实际 API 服务与仓储替身
 * [OUTPUT]: 验证冻结图、范围、续写只读身份和命令入口拒绝
 * [POS]: Canvas 问答业务契约回归，不连接远端数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, spyOn, test } from "bun:test";
Bun.env["SUPABASE_URL"] = "https://canvas-chat-test.supabase.co";
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test_key";
const { projectCanvasChat } = await import(
  "../src/service/canvas-chat.service.ts"
);
const { canvasService } = await import("../src/service/canvas.service.ts");
const { aiThreadService } = await import("../src/service/ai-thread.service.ts");
const { aiContextService } = await import(
  "../src/service/ai-context.service.ts"
);
const { aiCommandService, aiSettingsService } = await import(
  "../src/service/ai-command.service.ts"
);
const { aiRepository } = await import("../src/repository/ai.repository.ts");
import type { CanvasDetailV2 } from "../src/model/canvas.model.ts";
import type { AiMessage } from "../src/model/ai.model.ts";
import type { AuthUser } from "../src/model/auth.model.ts";
const cid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  mid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  nid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  tid = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const user = { id: cid } as AuthUser;
const detail = {
  canvas: { node_id: cid, version: 2 },
  node: { title: "画布" },
  nodes: [
    {
      id: nid,
      kind: "memo_ref",
      target_node_id: mid,
      target: { title: "笔记", revision: 3, deleted_at: null, excerpt: "摘要" },
      text: null,
    },
    {
      id: other,
      kind: "native",
      target_node_id: null,
      target: null,
      text: "标注",
    },
  ],
  edges: [
    {
      id: tid,
      source_id: nid,
      target_id: other,
      rationale: "联系",
      created_by: "ai",
    },
  ],
} as CanvasDetailV2;
const snapshot = projectCanvasChat(detail, {
  canvas_id: cid,
  version: 2,
  mode: "all",
  memo_ids: [],
});
const restores: Array<() => void> = [];
afterEach(() =>
  restores
    .splice(0)
    .reverse()
    .forEach((f) => f()),
);
function mock<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: unknown,
) {
  const s = spyOn(obj, key as any).mockImplementation(value as any);
  restores.push(() => s.mockRestore());
  return s;
}
test("整图包含空间文字，指定笔记只包含范围内节点和边", () => {
  expect(snapshot.nodes).toHaveLength(2);
  expect(snapshot.edges).toHaveLength(1);
  const subset = projectCanvasChat(detail, {
    canvas_id: cid,
    version: 2,
    mode: "selected",
    memo_ids: [mid],
  });
  expect(subset.nodes).toHaveLength(1);
  expect(subset.edges).toHaveLength(0);
  expect(() =>
    projectCanvasChat(detail, {
      canvas_id: cid,
      version: 1,
      mode: "all",
      memo_ids: [],
    }),
  ).toThrow("变化");
  expect(() =>
    projectCanvasChat(detail, {
      canvas_id: cid,
      version: 2,
      mode: "selected",
      memo_ids: [other],
    }),
  ).toThrow("不可用");
});
test("续写剥掉请求画布字段后仍恢复原范围与只读快照", async () => {
  const history = [
    {
      id: "u",
      role: "user",
      parts: [{ type: "text", text: "问题" }],
      context_snapshot: { primary: null, references: [], canvas: snapshot },
      status: "complete",
    },
    {
      id: "msg_u",
      role: "assistant",
      parts: [],
      context_snapshot: { primary: null, references: [], canvas: snapshot },
      status: "in_progress",
    },
  ] as unknown as AiMessage[];
  mock(aiRepository, "findThread", async () => ({ id: tid, title: "对话" }));
  mock(aiRepository, "listMessages", async () => history);
  mock(aiSettingsService, "get", async () => ({
    permission_mode: "full_access",
  }));
  mock(aiContextService, "resolveForThread", async () => ({
    primary: null,
    references: [],
    missing_reference_ids: [],
  }));
  const read = mock(canvasService, "read", async () => detail);
  mock(aiRepository, "updateMessage", async () => ({
    id: "msg_u",
    updated_at: "now",
  }));
  mock(aiRepository, "updateThread", async () => null);
  const result = await aiThreadService.prepareChatTurn(user, "token", {
    thread_id: tid,
    active_memo_id: null,
    reference_memo_ids: [],
    expected_revisions: {},
    include_thread_references: false,
    message: { id: "msg_u", role: "assistant", parts: [] },
    response_message_id: "msg_u",
  });
  expect(read).toHaveBeenCalledTimes(1);
  expect(result.context.canvas).toEqual(snapshot);
  expect(result.messages.at(-1)?.context_snapshot?.canvas).toEqual(snapshot);
});
test("完全访问账号的画布轮次拒绝创建命令，普通历史写命令仍可执行", async () => {
  const create = mock(aiRepository, "createCommand", async () => ({
    status: "ok",
    command: { id: tid },
  }));
  const list = mock(aiRepository, "listMessages", async () => [
    { role: "assistant", parts: [], context_snapshot: { canvas: snapshot } },
  ]);
  const input = {
    thread_id: tid,
    tool_call_id: "w",
    idempotency_key: "w",
    operation: "rename_node" as const,
    target_node_id: mid,
    expected_revision: 3,
    input: { title: "新名" },
  };
  await expect(aiCommandService.create(user, "token", input)).rejects.toThrow(
    "不能修改",
  );
  expect(create).not.toHaveBeenCalled();
  list.mockResolvedValue([
    { role: "assistant", parts: [{ toolCallId: "w" }], context_snapshot: null },
    { role: "assistant", parts: [], context_snapshot: { canvas: snapshot } },
  ] as any);
  await aiCommandService.create(user, "token", input);
  expect(create).toHaveBeenCalledTimes(1);
});
