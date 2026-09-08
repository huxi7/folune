/**
 * [INPUT]: 依赖 Zustand、单篇 memo API、AiCommand 输出与 MemoDetailNode
 * [OUTPUT]: 对外提供按 ID 加载/缓存、双向请求合并、独立取消与删除失效，及按提交值判定的临时 ID 对账、本地草稿、保存与 AI 正文投影状态
 * [POS]: shared/store 的正文唯一客户端状态源；目录树只持有摘要，本 Store 不复制树结构或自行导航
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type { AiCommand } from "../api/ai";
import {
  getMemo,
  updateMemo,
  type MemoDetailNode,
  type MemoWriteOptions,
  type UpdateMemoInput,
} from "../api/memo";
import { mapMemoDetailNodeDto, type MemoDetailNodeDto } from "../api/memo.mapper";

export type MemoDocumentStatus = "idle" | "loading" | "ready" | "error";

type AiDocumentProjection = {
  content: string;
  nodeId: string;
  previousContent: string;
};

type MemoDocumentState = {
  documents: Record<string, MemoDetailNode>;
  errors: Record<string, string | undefined>;
  statuses: Record<string, MemoDocumentStatus>;
  loadMemo(accessToken: string, nodeId: string, signal?: AbortSignal): Promise<MemoDetailNode>;
  preloadMemo(accessToken: string, nodeId: string): Promise<MemoDetailNode>;
  primeMemo(detail: MemoDetailNode): void;
  rekeyMemo(
    optimisticId: string,
    detail: MemoDetailNode,
    initialContent: string,
    submittedTitle: string,
  ): MemoDetailNode;
  updateContentLocal(nodeId: string, content: string): void;
  saveMemoDraft(
    accessToken: string,
    nodeId: string,
    input: UpdateMemoInput,
    options?: MemoWriteOptions,
  ): Promise<MemoDetailNode>;
  removeMemos(nodeIds: ReadonlySet<string>): void;
  projectAiEdit(toolCallId: string, nodeId: string, content: string): void;
  rollbackAiEdit(toolCallId: string): void;
  reconcileAiCommand(command: AiCommand): void;
  reset(): void;
};

let loadGeneration = 0;
const requestVersions = new Map<string, number>();
type PendingRead = {
  controller: AbortController;
  promise: Promise<MemoDetailNode>;
  readers: number;
};
const pendingReads = new Map<string, PendingRead>();

// 每个消费者只取消自己的等待；最后一个离开后才停止共享传输。
const consumeRead = (request: PendingRead, signal?: AbortSignal): Promise<MemoDetailNode> => {
  request.readers += 1;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener("abort", abort);
      request.readers -= 1;
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      if (request.readers === 0) request.controller.abort();
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    request.promise.then(
      (detail) => { if (finish()) resolve(detail); },
      (error: unknown) => { if (finish()) reject(error); },
    );
    if (signal?.aborted) abort();
  });
};
const aiProjections = new Map<string, AiDocumentProjection>();

const nextRequestVersion = (nodeId: string): number => {
  const version = (requestVersions.get(nodeId) ?? 0) + 1;
  requestVersions.set(nodeId, version);
  return version;
};

const commandDetail = (command: AiCommand): MemoDetailNode | null => {
  const state = command.status === "undone" ? command.undo_result : command.after_state;
  if (state === null) return null;
  const node = state.node;
  const content = state.content;
  if (node === null || typeof node !== "object" || Array.isArray(node)) return null;
  if (content === null || typeof content !== "object" || Array.isArray(content)) return null;
  try {
    return mapMemoDetailNodeDto({
      ...(node as MemoDetailNodeDto),
      children: [],
      memo: content as MemoDetailNodeDto["memo"],
    });
  } catch {
    return null;
  }
};

export const useMemoDocumentStore = create<MemoDocumentState>()((set, get) => ({
  documents: {},
  errors: {},
  statuses: {},

  async loadMemo(accessToken, nodeId, signal) {
    signal?.throwIfAborted();
    const cached = get().documents[nodeId];
    if (cached !== undefined) return cached;
    const pending = pendingReads.get(nodeId);
    if (pending !== undefined && !pending.controller.signal.aborted) {
      return consumeRead(pending, signal);
    }
    const generation = loadGeneration;
    const version = nextRequestVersion(nodeId);
    const controller = new AbortController();
    const current = () => generation === loadGeneration
      && requestVersions.get(nodeId) === version;
    const request: PendingRead = {
      controller,
      readers: 0,
      promise: getMemo(accessToken, nodeId, controller.signal).then((detail) => {
        if (current() && !controller.signal.aborted && get().documents[nodeId] === undefined) {
          get().primeMemo(detail);
        }
        return detail;
      }).catch((error: unknown) => {
        if (current() && get().documents[nodeId] === undefined) {
          set((state) => ({
            errors: { ...state.errors, [nodeId]: controller.signal.aborted
              ? undefined : error instanceof Error ? error.message : "备忘录正文加载失败" },
            statuses: { ...state.statuses, [nodeId]: controller.signal.aborted ? "idle" : "error" },
          }));
        }
        throw error;
      }).finally(() => {
        if (pendingReads.get(nodeId) === request) pendingReads.delete(nodeId);
        // 某些传输替身忽略 abort；取消后的成功响应也不能留住 loading。
        if (current() && controller.signal.aborted && get().statuses[nodeId] === "loading") {
          set((state) => ({ statuses: { ...state.statuses, [nodeId]: "idle" } }));
        }
      }),
    };
    pendingReads.set(nodeId, request);
    set((state) => ({
      errors: { ...state.errors, [nodeId]: undefined },
      statuses: { ...state.statuses, [nodeId]: "loading" },
    }));
    return consumeRead(request, signal);
  },

  preloadMemo(accessToken, nodeId) {
    return get().loadMemo(accessToken, nodeId);
  },

  primeMemo(detail) {
    set((state) => ({
      documents: { ...state.documents, [detail.id]: detail },
      errors: { ...state.errors, [detail.id]: undefined },
      statuses: { ...state.statuses, [detail.id]: "ready" },
    }));
  },

  rekeyMemo(optimisticId, detail, initialContent, submittedTitle) {
    const optimistic = get().documents[optimisticId];
    /*
     * 判据是"本地标题是否还等于我们提交上去的那个", 不是"是否等于服务端返回的"。
     * 系统默认名在同父撞名时由服务端顺位让开（未命名备忘录 → 未命名备忘录 2），
     * 于是"和服务端不一致"既可能是用户已经开始打字, 也可能只是服务端换了名字;
     * 只有与提交值比较才能把两者分开, 否则新建出来的笔记会一直显示一个它从未
     * 拥有过的名字, 并把它反写回文件树。
     */
    const reconciled = optimistic === undefined
      ? detail
      : {
          ...detail,
          title: optimistic.title === submittedTitle
            ? detail.title
            : optimistic.title,
          memo: {
            ...detail.memo,
            content_mdx: optimistic.memo.content_mdx === initialContent
              ? detail.memo.content_mdx
              : optimistic.memo.content_mdx,
          },
        };
    set((state) => {
      const documents = { ...state.documents };
      const statuses = { ...state.statuses };
      const errors = { ...state.errors };
      delete documents[optimisticId];
      delete statuses[optimisticId];
      delete errors[optimisticId];
      documents[detail.id] = reconciled;
      statuses[detail.id] = "ready";
      return { documents, errors, statuses };
    });
    return reconciled;
  },

  updateContentLocal(nodeId, content) {
    set((state) => {
      const current = state.documents[nodeId];
      if (current === undefined) return state;
      return {
        documents: {
          ...state.documents,
          [nodeId]: { ...current, memo: { ...current.memo, content_mdx: content } },
        },
      };
    });
  },

  async saveMemoDraft(accessToken, nodeId, input, options) {
    const before = get().documents[nodeId];
    if (before === undefined) throw new Error("要保存的备忘录正文尚未加载。");
    const updated = await updateMemo(accessToken, nodeId, input, options);
    set((state) => {
      const current = state.documents[nodeId];
      if (current === undefined) return state;
      const contentStillCurrent = input.content_mdx !== undefined
        && current.memo.content_mdx === input.content_mdx;
      return {
        documents: {
          ...state.documents,
          [nodeId]: {
            ...updated,
            title: input.title !== undefined && current.title !== input.title
              ? current.title
              : updated.title,
            memo: contentStillCurrent ? updated.memo : current.memo,
          },
        },
      };
    });
    return updated;
  },

  removeMemos(nodeIds) {
    for (const nodeId of nodeIds) {
      nextRequestVersion(nodeId);
      pendingReads.get(nodeId)?.controller.abort();
      pendingReads.delete(nodeId);
    }
    set((state) => {
      const documents = { ...state.documents };
      const statuses = { ...state.statuses };
      const errors = { ...state.errors };
      for (const nodeId of nodeIds) {
        delete documents[nodeId];
        delete statuses[nodeId];
        delete errors[nodeId];
      }
      return { documents, errors, statuses };
    });
  },

  projectAiEdit(toolCallId, nodeId, content) {
    if (aiProjections.has(toolCallId)) return;
    const detail = get().documents[nodeId];
    if (detail === undefined) return;
    aiProjections.set(toolCallId, {
      content,
      nodeId,
      previousContent: detail.memo.content_mdx,
    });
    get().updateContentLocal(nodeId, content);
  },

  rollbackAiEdit(toolCallId) {
    const projection = aiProjections.get(toolCallId);
    if (projection === undefined) return;
    aiProjections.delete(toolCallId);
    const detail = get().documents[projection.nodeId];
    if (detail?.memo.content_mdx === projection.content) {
      get().updateContentLocal(projection.nodeId, projection.previousContent);
    }
  },

  reconcileAiCommand(command) {
    if (command.tool_call_id !== null) aiProjections.delete(command.tool_call_id);
    const detail = commandDetail(command);
    if (detail !== null && get().documents[detail.id] !== undefined) {
      get().primeMemo(detail);
    }
  },

  reset() {
    loadGeneration += 1;
    requestVersions.clear();
    for (const request of pendingReads.values()) request.controller.abort();
    pendingReads.clear();
    aiProjections.clear();
    set({ documents: {}, errors: {}, statuses: {} });
  },
}));
