/**
 * [INPUT]: 依赖浏览器 IndexedDB 与 canvasDocument 的可序列化 CanvasIntent
 * [OUTPUT]: 对外提供按 user_id+canvas_id 隔离的 Canvas V2 WAL 记录、原子草稿封装接口、旧数据库迁移、Folune IndexedDB 实现及测试用内存实现
 * [POS]: shared/store 的 persistenceSlice 恢复边界；重命名数据库时先复制未同步意图，再切换到 Folune 命名；严禁保存 JWT、access token 或 UI 组件实例
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CanvasIntent } from "./canvasDocument";

export type CanvasWalScope = {
  userId: string;
  canvasId: string;
};
type CanvasWalBase = {
  key: string;
  scope: string;
  user_id: string;
  canvas_id: string;
  created_at: number;
};

export type CanvasWalDraft = CanvasWalBase & {
  kind: "draft";
  intents: CanvasIntent[];
};

export type CanvasExpansionEnvelope = {
  source_canvas_node_id: string;
  source_revision: number;
  corpus_version: number;
  request_id: string;
  completion_status: "complete" | "incomplete_due_to_capacity";
  candidate_revisions: Array<{ memo_id: string; revision: number }>;
};

export type CanvasWalMutation = CanvasWalBase & {
  kind: "mutation";
  mutation_id: string;
  base_version: number;
  intent_digest: string;
  intents: CanvasIntent[];
  attempts: number;
  conflict_replays: number;
  expansion: CanvasExpansionEnvelope | null;
};

export type CanvasWalRecord = CanvasWalDraft | CanvasWalMutation;

export type CanvasWalStorage = {
  list(scope: CanvasWalScope): Promise<CanvasWalRecord[]>;
  put(record: CanvasWalRecord): Promise<void>;
  delete(key: string): Promise<void>;
  replaceDraft(
    draftKey: string,
    mutations: readonly CanvasWalMutation[],
  ): Promise<void>;
};

const DATABASE_NAME = "folune-canvas-wal-v2";
const LEGACY_DATABASE_NAME = "supernote-canvas-wal-v2";
const DATABASE_VERSION = 1;
const STORE_NAME = "canvas-wal";
const SCOPE_INDEX = "by-scope";

export const canvasWalScopeKey = ({ userId, canvasId }: CanvasWalScope): string =>
  `${userId}:${canvasId}`;

export const canvasWalDraftKey = (scope: CanvasWalScope): string =>
  `${canvasWalScopeKey(scope)}:draft`;

export const canvasWalMutationKey = (
  scope: CanvasWalScope,
  createdAt: number,
  mutationId: string,
): string =>
  `${canvasWalScopeKey(scope)}:mutation:${String(createdAt).padStart(16, "0")}:${mutationId}`;

const createStoreIfMissing = (database: IDBDatabase) => {
  if (!database.objectStoreNames.contains(STORE_NAME)) {
    const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
    store.createIndex(SCOPE_INDEX, "scope", { unique: false });
  }
};

let legacyMigration: Promise<void> | null = null;

const migrateLegacyDatabase = (): Promise<void> => {
  if (legacyMigration !== null) return legacyMigration;

  legacyMigration = new Promise((resolve, reject) => {
    let createdDuringProbe = false;
    const legacyRequest = indexedDB.open(LEGACY_DATABASE_NAME);
    legacyRequest.onupgradeneeded = () => {
      createdDuringProbe = true;
    };
    legacyRequest.onerror = () => reject(
      legacyRequest.error ?? new Error("无法读取旧版 Canvas 本机恢复存储。"),
    );
    legacyRequest.onsuccess = () => {
      const legacyDatabase = legacyRequest.result;
      if (createdDuringProbe || !legacyDatabase.objectStoreNames.contains(STORE_NAME)) {
        legacyDatabase.close();
        if (createdDuringProbe) indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
        resolve();
        return;
      }

      legacyDatabase.onversionchange = () => legacyDatabase.close();
      const readRequest = legacyDatabase
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .getAll();
      readRequest.onerror = () => reject(
        readRequest.error ?? new Error("无法读取旧版 Canvas 本机恢复记录。"),
      );
      readRequest.onsuccess = () => {
        const records = readRequest.result as CanvasWalRecord[];
        const currentRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        currentRequest.onupgradeneeded = () => createStoreIfMissing(currentRequest.result);
        currentRequest.onerror = () => reject(
          currentRequest.error ?? new Error("无法创建 Folune Canvas 本机恢复存储。"),
        );
        currentRequest.onsuccess = () => {
          const currentDatabase = currentRequest.result;
          const transaction = currentDatabase.transaction(STORE_NAME, "readwrite");
          transaction.oncomplete = () => {
            currentDatabase.close();
            legacyDatabase.close();
            indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
            resolve();
          };
          transaction.onabort = () => {
            currentDatabase.close();
            reject(transaction.error ?? new Error("迁移 Canvas 本机恢复记录失败。"));
          };
          const store = transaction.objectStore(STORE_NAME);
          for (const record of records) {
            const existingRecord = store.get(record.key);
            existingRecord.onsuccess = () => {
              if (existingRecord.result === undefined) store.put(record);
            };
          }
        };
      };
    };
  });

  return legacyMigration;
};

const openDatabase = async (): Promise<IDBDatabase> => {
  if (!("indexedDB" in globalThis)) {
    throw new Error("当前浏览器不支持 IndexedDB，本机恢复不可用。");
  }

  await migrateLegacyDatabase();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(
      request.error ?? new Error("无法打开 Canvas 本机恢复存储。"),
    );
    request.onblocked = () => reject(
      new Error("Canvas 本机恢复存储被另一个旧页面阻塞。"),
    );
    request.onupgradeneeded = () => createStoreIfMissing(request.result);
    request.onsuccess = () => resolve(request.result);
  });
};

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(
      transaction.error ?? new Error("Canvas 本机恢复事务被取消。"),
    );
    transaction.onerror = () => reject(
      transaction.error ?? new Error("Canvas 本机恢复事务失败。"),
    );
  });

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(
      request.error ?? new Error("Canvas 本机恢复读取失败。"),
    );
  });

const isIntent = (value: unknown): value is CanvasIntent =>
  typeof value === "object"
  && value !== null
  && "operation" in value
  && typeof value.operation === "object"
  && value.operation !== null
  && "type" in value.operation
  && typeof value.operation.type === "string";

const isWalRecord = (value: unknown): value is CanvasWalRecord => {
  if (
    typeof value !== "object"
    || value === null
    || !("key" in value)
    || typeof value.key !== "string"
    || !("scope" in value)
    || typeof value.scope !== "string"
    || !("user_id" in value)
    || typeof value.user_id !== "string"
    || !("canvas_id" in value)
    || typeof value.canvas_id !== "string"
    || !("created_at" in value)
    || typeof value.created_at !== "number"
    || !("kind" in value)
    || !("intents" in value)
    || !Array.isArray(value.intents)
    || !value.intents.every(isIntent)
  ) {
    return false;
  }

  if (value.kind === "draft") return true;
  return value.kind === "mutation"
    && "mutation_id" in value
    && typeof value.mutation_id === "string"
    && "base_version" in value
    && typeof value.base_version === "number"
    && "intent_digest" in value
    && typeof value.intent_digest === "string"
    && "attempts" in value
    && typeof value.attempts === "number"
    && "conflict_replays" in value
    && typeof value.conflict_replays === "number";
};

export const createIndexedDbCanvasWalStorage = (): CanvasWalStorage => ({
  async list(scope) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const records = await requestResult(
        store.index(SCOPE_INDEX).getAll(canvasWalScopeKey(scope)),
      );
      await transactionDone(transaction);
      if (!records.every(isWalRecord)) {
        throw new Error("Canvas 本机恢复日志已损坏，请检查恢复内容。");
      }
      return records.sort((left, right) => left.created_at - right.created_at);
    } finally {
      database.close();
    }
  },

  async put(record) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },

  async delete(key) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },

  async replaceDraft(draftKey, mutations) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const mutation of mutations) store.put(mutation);
      store.delete(draftKey);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
});

export const createMemoryCanvasWalStorage = (
  seed: readonly CanvasWalRecord[] = [],
): CanvasWalStorage & { records: Map<string, CanvasWalRecord> } => {
  const records = new Map(seed.map((record) => [record.key, structuredClone(record)]));

  return {
    records,
    async list(scope) {
      const key = canvasWalScopeKey(scope);
      return [...records.values()]
        .filter((record) => record.scope === key)
        .sort((left, right) => left.created_at - right.created_at)
        .map((record) => structuredClone(record));
    },
    async put(record) {
      records.set(record.key, structuredClone(record));
    },
    async delete(key) {
      records.delete(key);
    },
    async replaceDraft(draftKey, mutations) {
      for (const mutation of mutations) {
        records.set(mutation.key, structuredClone(mutation));
      }
      records.delete(draftKey);
    },
  };
};
