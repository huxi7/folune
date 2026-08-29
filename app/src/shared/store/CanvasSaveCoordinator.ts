/**
 * [INPUT]: 依赖 Canvas V2 API、canvasDocument 纯投影、canvasWal 持久存储与可注入 transport/sink/clock
 * [OUTPUT]: 对外提供单 Canvas 单标签页保存协调器：手势级原子入账、600ms 封装、稳定 mutation、串行发送、0.5/1/2s 重试、receipt 重放、一次 409 rebase 与 48KiB pagehide 上限
 * [POS]: shared/store 的 CanvasSaveCoordinator；计时器、网络与 IndexedDB 生命周期只住这里，React 组件只产生 intent 并消费状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ApiError,
} from "../api/client";
import type {
  CanvasDetail,
  CanvasExpansionMutationRequest,
  CanvasMutationRequest,
  CanvasMutationResult,
} from "../api/canvas";
import {
  normalizeCanvasIntents,
  type CanvasIntent,
} from "./canvasDocument";
import {
  canvasWalDraftKey,
  canvasWalMutationKey,
  canvasWalScopeKey,
  type CanvasExpansionEnvelope,
  type CanvasWalDraft,
  type CanvasWalMutation,
  type CanvasWalScope,
  type CanvasWalStorage,
} from "./canvasWal";

export const CANVAS_DRAFT_DELAY_MS = 600;
export const CANVAS_KEEPALIVE_MAX_BYTES = 48 * 1024;
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;

export type CanvasCoordinatorTransport = {
  getCanvas(): Promise<CanvasDetail>;
  mutate(request: CanvasMutationRequest): Promise<CanvasMutationResult>;
  commitExpansion(
    request: CanvasExpansionMutationRequest,
  ): Promise<CanvasMutationResult>;
  keepalive(request: CanvasMutationRequest): boolean;
};

export type CanvasCoordinatorSink = {
  getServerVersion(): number;
  applyLocal(intent: CanvasIntent): void;
  replaceServer(detail: CanvasDetail, pending: readonly CanvasIntent[]): void;
  confirm(
    intents: readonly CanvasIntent[],
    result: CanvasMutationResult,
    pending: readonly CanvasIntent[],
  ): void;
  setPersistence(
    status:
      | "idle"
      | "recovering"
      | "saving"
      | "unsaved"
      | "conflict"
      | "recovery_error"
      | "local_recovery_unavailable",
    pendingCount: number,
    message?: string | null,
  ): void;
};

type CoordinatorOptions = {
  scope: CanvasWalScope;
  storage: CanvasWalStorage;
  transport: CanvasCoordinatorTransport;
  sink: CanvasCoordinatorSink;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  randomUUID?: () => string;
  onResult?: (result: CanvasMutationResult) => void;
  onDiscardedExpansion?: (error: ApiError) => void;
};

export type CanvasFlushResult = {
  persisted: boolean;
  synced: boolean;
};

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
};

const sha256 = async (value: unknown): Promise<string> => {
  const data = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
};

const mutationRequest = (record: CanvasWalMutation): CanvasMutationRequest => ({
  base_version: record.base_version,
  mutation_id: record.mutation_id,
  operations: record.intents.map((intent) => intent.operation),
  protocol_version: 2,
});

const expansionRequest = (
  record: CanvasWalMutation,
): CanvasExpansionMutationRequest => {
  if (record.expansion === null) {
    throw new Error("Canvas expansion mutation 缺少 expansion envelope。");
  }
  return {
    ...mutationRequest(record),
    ...record.expansion,
  };
};

export const canvasMutationByteLength = (
  record: Pick<CanvasWalMutation, "base_version" | "intents" | "mutation_id">,
): number => byteLength(JSON.stringify({
  base_version: record.base_version,
  mutation_id: record.mutation_id,
  operations: record.intents.map((intent) => intent.operation),
  protocol_version: 2,
}));

const splitIntents = (
  intents: readonly CanvasIntent[],
  baseVersion: number,
  randomUUID: () => string,
): Array<{ id: string; intents: CanvasIntent[] }> => {
  const chunks: Array<{ id: string; intents: CanvasIntent[] }> = [];
  let current = { id: randomUUID(), intents: [] as CanvasIntent[] };

  for (const intent of intents) {
    const candidate = [...current.intents, intent];
    const withinOperationLimit = candidate.length <= 100;
    const withinKeepaliveBudget = byteLength(JSON.stringify({
      base_version: baseVersion + chunks.length,
      mutation_id: current.id,
      operations: candidate.map((item) => item.operation),
      protocol_version: 2,
    })) <= CANVAS_KEEPALIVE_MAX_BYTES;

    if (current.intents.length > 0 && (!withinOperationLimit || !withinKeepaliveBudget)) {
      chunks.push(current);
      current = { id: randomUUID(), intents: [intent] };
    } else {
      current.intents = candidate;
    }
  }

  if (current.intents.length > 0) chunks.push(current);
  return chunks;
};

const isTransient = (error: unknown): boolean =>
  error instanceof ApiError
    ? error.status === 0 || error.status === 429 || error.status >= 500
    : true;

export class CanvasSaveCoordinator {
  private readonly scope: CanvasWalScope;
  private readonly storage: CanvasWalStorage;
  private readonly transport: CanvasCoordinatorTransport;
  private readonly sink: CanvasCoordinatorSink;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly randomUUID: () => string;
  private readonly onResult: (result: CanvasMutationResult) => void;
  private readonly onDiscardedExpansion: (error: ApiError) => void;
  private draft: CanvasWalDraft | null = null;
  private queue: CanvasWalMutation[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private processing: Promise<void> | null = null;
  private walChain: Promise<void> = Promise.resolve();
  private disposed = false;
  private sequence = 0;

  constructor({
    scope,
    storage,
    transport,
    sink,
    now = () => Date.now(),
    wait = async (milliseconds) =>
      await new Promise((resolve) => setTimeout(resolve, milliseconds)),
    randomUUID = () => crypto.randomUUID(),
    onResult = () => undefined,
    onDiscardedExpansion = () => undefined,
  }: CoordinatorOptions) {
    this.scope = scope;
    this.storage = storage;
    this.transport = transport;
    this.sink = sink;
    this.now = now;
    this.wait = wait;
    this.randomUUID = randomUUID;
    this.onResult = onResult;
    this.onDiscardedExpansion = onDiscardedExpansion;
  }

  async recover(serverDetail: CanvasDetail): Promise<void> {
    this.sink.setPersistence("recovering", 0);
    try {
      const records = await this.storage.list(this.scope);
      const drafts = records.filter(
        (record): record is CanvasWalDraft => record.kind === "draft",
      );
      if (drafts.length > 1) {
        throw new Error("发现多份 Canvas 草稿，已停止自动恢复。");
      }
      this.draft = drafts[0] ?? null;
      this.queue = records.filter(
        (record): record is CanvasWalMutation => record.kind === "mutation",
      );
      const pending = this.pendingIntents();
      this.sink.replaceServer(serverDetail, pending);
      this.updateStatus("recovering");

      if (this.draft !== null && this.draft.intents.length > 0) {
        await this.sealDraft();
      }
      await this.processQueue();
      if (this.draft === null && this.queue.length === 0) {
        this.updateStatus("idle");
      }
    } catch (error) {
      this.sink.setPersistence(
        "recovery_error",
        this.pendingCount(),
        error instanceof Error ? error.message : "Canvas 恢复失败。",
      );
    }
  }

  async enqueue(intent: CanvasIntent): Promise<void> {
    await this.enqueueMany([intent]);
  }

  /**
   * 一次手势产生的多个 intent 原子入账。整组拖动只写一条 WAL 记录: 要么整组幸
   * 存, 要么整组不存在, 本机恢复里不会留下"只挪动了一半"的画布。逐个 enqueue
   * 除了打开这个缺口, 还要为同一次手势反复取锁与写 IndexedDB。
   */
  async enqueueMany(intents: readonly CanvasIntent[]): Promise<void> {
    if (this.disposed) throw new Error("Canvas 保存会话已经结束。");
    if (intents.length === 0) return;

    await this.withWalLock(async () => {
      const draft: CanvasWalDraft = this.draft ?? {
        canvas_id: this.scope.canvasId,
        created_at: this.nextCreatedAt(),
        intents: [],
        key: canvasWalDraftKey(this.scope),
        kind: "draft",
        scope: canvasWalScopeKey(this.scope),
        user_id: this.scope.userId,
      };
      const next = { ...draft, intents: [...draft.intents, ...intents] };

      try {
        await this.storage.put(next);
      } catch (error) {
        this.sink.setPersistence(
          "local_recovery_unavailable",
          this.pendingCount(),
          error instanceof Error ? error.message : "本机恢复不可用。",
        );
        throw error;
      }

      this.draft = next;
      for (const intent of intents) this.sink.applyLocal(intent);
      this.updateStatus(this.processing === null ? "idle" : "saving");
      this.scheduleSeal();
    });
  }

  async enqueueExpansion(
    intents: readonly CanvasIntent[],
    expansion: CanvasExpansionEnvelope,
  ): Promise<void> {
    try {
      await this.withWalLock(async () => {
        // AI 等待模型期间用户仍可编辑。先把这些人工 intent 封成队列前项，
        // 才能保证 expansion 的 base_version 与用户实际操作顺序一致。
        await this.sealDraftLocked();
        const baseVersion = this.nextBaseVersion();
        const chunks = intents.length === 0
          ? [{ id: this.randomUUID(), intents: [] }]
          : splitIntents(intents, baseVersion, this.randomUUID);
        if (chunks.length !== 1) {
          throw new Error("一次 AI 拓展超过安全提交上限。");
        }

        const mutation = await this.createMutation(
          chunks[0]!.id,
          chunks[0]!.intents,
          baseVersion,
          expansion,
        );

        try {
          await this.storage.put(mutation);
        } catch (error) {
          this.sink.setPersistence(
            "local_recovery_unavailable",
            this.pendingCount(),
            error instanceof Error ? error.message : "本机恢复不可用。",
          );
          throw error;
        }

        this.queue.push(mutation);
        for (const intent of intents) this.sink.applyLocal(intent);
        this.updateStatus("saving");
      });
    } finally {
      // expansion 自身落 WAL 失败时，前面已安全封装的人工 mutation 仍应继续发送。
      if (this.queue.length > 0) void this.processQueue();
    }
  }

  async flush(): Promise<CanvasFlushResult> {
    this.clearSealTimer();
    try {
      await this.sealDraft();
    } catch {
      return { persisted: false, synced: false };
    }
    await this.processQueue();
    return {
      persisted: true,
      synced: this.queue.length === 0 && this.draft === null,
    };
  }

  async retry(): Promise<void> {
    for (const mutation of this.queue) mutation.attempts = 0;
    await this.processQueue();
  }

  flushForPageHide(): void {
    this.clearSealTimer();
    void this.sealDraft().then(() => {
      const mutation = this.queue[0];
      if (
        mutation === undefined
        || mutation.expansion !== null
        || canvasMutationByteLength(mutation) > CANVAS_KEEPALIVE_MAX_BYTES
      ) {
        return;
      }
      this.transport.keepalive(mutationRequest(mutation));
    }).catch(() => undefined);
  }

  dispose(): void {
    this.disposed = true;
    this.clearSealTimer();
  }

  private scheduleSeal(): void {
    this.clearSealTimer();
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.sealDraft()
        .then(() => this.processQueue())
        .catch(() => undefined);
    }, CANVAS_DRAFT_DELAY_MS);
  }

  private clearSealTimer(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private async sealDraft(): Promise<void> {
    await this.withWalLock(async () => this.sealDraftLocked());
  }

  private async sealDraftLocked(): Promise<void> {
    const draft = this.draft;
    if (draft === null || draft.intents.length === 0) return;

    const baseVersion = this.nextBaseVersion();
    const normalized = normalizeCanvasIntents(draft.intents);
    const chunks = splitIntents(normalized, baseVersion, this.randomUUID);
    const mutations = await Promise.all(chunks.map(
      async (chunk, index) => await this.createMutation(
        chunk.id,
        chunk.intents,
        baseVersion + index,
        null,
      ),
    ));

    try {
      await this.storage.replaceDraft(draft.key, mutations);
    } catch (error) {
      this.sink.setPersistence(
        "local_recovery_unavailable",
        this.pendingCount(),
        error instanceof Error ? error.message : "Canvas 草稿无法封装。",
      );
      throw error;
    }

    this.draft = null;
    this.queue.push(...mutations);
    this.updateStatus("saving");
  }

  private async createMutation(
    mutationId: string,
    intents: CanvasIntent[],
    baseVersion: number,
    expansion: CanvasExpansionEnvelope | null,
  ): Promise<CanvasWalMutation> {
    const createdAt = this.nextCreatedAt();
    return {
      attempts: 0,
      base_version: baseVersion,
      canvas_id: this.scope.canvasId,
      conflict_replays: 0,
      created_at: createdAt,
      expansion,
      intent_digest: await sha256({
        canvas_id: this.scope.canvasId,
        expansion,
        operations: intents.map((intent) => intent.operation),
        protocol_version: 2,
      }),
      intents,
      key: canvasWalMutationKey(this.scope, createdAt, mutationId),
      kind: "mutation",
      mutation_id: mutationId,
      scope: canvasWalScopeKey(this.scope),
      user_id: this.scope.userId,
    };
  }

  private async processQueue(): Promise<void> {
    if (this.processing !== null) {
      await this.processing;
      return;
    }

    this.processing = this.drainQueue();
    try {
      await this.processing;
    } finally {
      this.processing = null;
    }
  }

  private async drainQueue(): Promise<void> {
    while (!this.disposed && this.queue.length > 0) {
      const current = this.queue[0]!;
      this.updateStatus("saving");
      const result = await this.sendWithRetry(current);
      if (result === null) return;
      if (result === "discarded") continue;

      const pending = this.pendingIntents(1);
      this.sink.confirm(current.intents, result, pending);
      this.onResult(result);

      try {
        await this.storage.delete(current.key);
      } catch (error) {
        this.sink.setPersistence(
          "recovery_error",
          this.pendingCount(),
          error instanceof Error
            ? error.message
            : "服务端已保存，但本机回执尚未清理。",
        );
        return;
      }

      this.queue.shift();
      this.updateStatus(this.queue.length === 0 ? "idle" : "saving");
    }
  }

  private async sendWithRetry(
    mutation: CanvasWalMutation,
  ): Promise<CanvasMutationResult | "discarded" | null> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        mutation.attempts += 1;
        await this.storage.put(mutation);
        return mutation.expansion === null
          ? await this.transport.mutate(mutationRequest(mutation))
          : await this.transport.commitExpansion(expansionRequest(mutation));
      } catch (error) {
        if (
          error instanceof ApiError
          && error.status === 409
          && error.code === "CANVAS_VERSION_CONFLICT"
        ) {
          return await this.rebaseOnce(mutation);
        }
        if (
          mutation.expansion !== null
          && error instanceof ApiError
          && (
            error.code === "CANVAS_SOURCE_REVISION_CONFLICT"
            || error.code === "CANVAS_CANDIDATE_REVISION_CONFLICT"
          )
          && await this.discardStaleExpansion(mutation, error)
        ) {
          return "discarded";
        }

        if (!isTransient(error) || attempt === RETRY_DELAYS_MS.length) {
          this.sink.setPersistence(
            "unsaved",
            this.pendingCount(),
            error instanceof Error ? error.message : "Canvas 尚未保存。",
          );
          return null;
        }

        await this.wait(RETRY_DELAYS_MS[attempt]!);
      }
    }
    return null;
  }

  private async discardStaleExpansion(
    mutation: CanvasWalMutation,
    error: ApiError,
  ): Promise<boolean> {
    try {
      const latest = await this.transport.getCanvas();
      await this.storage.delete(mutation.key);
      this.queue.shift();
      this.sink.replaceServer(latest, this.pendingIntents());
      this.updateStatus(this.queue.length === 0 ? "idle" : "saving");
      this.onDiscardedExpansion(error);
      return true;
    } catch {
      return false;
    }
  }

  private async rebaseOnce(
    mutation: CanvasWalMutation,
  ): Promise<CanvasMutationResult | null> {
    if (mutation.conflict_replays >= 1) {
      this.sink.setPersistence(
        "conflict",
        this.pendingCount(),
        "Canvas 在另一处持续变化，请检查本地恢复内容。",
      );
      return null;
    }

    try {
      const latest = await this.transport.getCanvas();
      mutation.base_version = latest.canvas.version;
      mutation.conflict_replays += 1;
      await this.storage.put(mutation);
      for (let index = 1; index < this.queue.length; index += 1) {
        const queued = this.queue[index]!;
        queued.base_version = latest.canvas.version + index;
        await this.storage.put(queued);
      }
      this.sink.replaceServer(latest, this.pendingIntents());

      return mutation.expansion === null
        ? await this.transport.mutate(mutationRequest(mutation))
        : await this.transport.commitExpansion(expansionRequest(mutation));
    } catch (error) {
      this.sink.setPersistence(
        "conflict",
        this.pendingCount(),
        error instanceof Error ? error.message : "Canvas 冲突无法自动合并。",
      );
      return null;
    }
  }

  private pendingIntents(skipMutations = 0): CanvasIntent[] {
    return [
      ...this.queue.slice(skipMutations).flatMap((mutation) => mutation.intents),
      ...(this.draft?.intents ?? []),
    ];
  }

  private pendingCount(): number {
    return this.pendingIntents().length;
  }

  private nextBaseVersion(): number {
    return this.sink.getServerVersion() + this.queue.length;
  }

  private nextCreatedAt(): number {
    const value = this.now() + this.sequence;
    this.sequence += 1;
    return value;
  }

  private async withWalLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.walChain;
    let release: () => void = () => undefined;
    this.walChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private updateStatus(
    status: "idle" | "recovering" | "saving",
  ): void {
    this.sink.setPersistence(status, this.pendingCount());
  }
}
