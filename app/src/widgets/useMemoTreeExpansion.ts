/**
 * [INPUT]: 依赖 React 状态/副作用、浏览器 localStorage、当前用户 id、树加载完成信号与有效 folder id 列表
 * [OUTPUT]: 对外提供 useMemoTreeExpansion hook，以及可测试的展开快照解析与 folder 集合归一化工具
 * [POS]: app/src/widgets 的设备级文件树 UI 偏好边界；按用户持久化展开 id，不污染 memo 业务表，并在树增删后自动清理或展开新 folder
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const EXPANSION_STORAGE_PREFIX = "supernote:memo-tree-expanded";
const EXPANSION_STORAGE_VERSION = 1;

type MemoTreeExpansionSnapshot = {
  expanded: string[];
  version: typeof EXPANSION_STORAGE_VERSION;
};

type UseMemoTreeExpansionInput = {
  folderIds: readonly string[];
  ready: boolean;
  userId: string;
};

type UseMemoTreeExpansionResult = {
  expandedFolders: Set<string>;
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>;
};

const storageKeyForUser = (userId: string): string =>
  `${EXPANSION_STORAGE_PREFIX}:${userId}`;

const setsEqual = (left: ReadonlySet<string>, right: ReadonlySet<string>) =>
  left.size === right.size && [...left].every((value) => right.has(value));

export function parseMemoTreeExpansionSnapshot(
  value: string | null,
): Set<string> | null {
  if (value === null) {
    return null;
  }

  try {
    const snapshot = JSON.parse(value) as Partial<MemoTreeExpansionSnapshot>;

    if (
      snapshot.version !== EXPANSION_STORAGE_VERSION ||
      !Array.isArray(snapshot.expanded) ||
      snapshot.expanded.some((folderId) => typeof folderId !== "string")
    ) {
      return null;
    }

    return new Set(snapshot.expanded);
  } catch {
    return null;
  }
}

export function reconcileExpandedFolderIds(
  expandedFolders: ReadonlySet<string>,
  previousFolderIds: ReadonlySet<string>,
  nextFolderIds: readonly string[],
): Set<string> {
  const nextFolderIdSet = new Set(nextFolderIds);
  const reconciled = new Set(
    [...expandedFolders].filter((folderId) => nextFolderIdSet.has(folderId)),
  );

  nextFolderIds.forEach((folderId) => {
    if (!previousFolderIds.has(folderId)) {
      reconciled.add(folderId);
    }
  });

  return reconciled;
}

function readExpandedFolders(storageKey: string): Set<string> | null {
  try {
    return parseMemoTreeExpansionSnapshot(
      window.localStorage.getItem(storageKey),
    );
  } catch {
    return null;
  }
}

function writeExpandedFolders(
  storageKey: string,
  expandedFolders: ReadonlySet<string>,
) {
  const snapshot: MemoTreeExpansionSnapshot = {
    expanded: [...expandedFolders].sort(),
    version: EXPANSION_STORAGE_VERSION,
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // localStorage 不可用时退化为当前会话内状态，不阻塞文件树交互。
  }
}

export function useMemoTreeExpansion({
  folderIds,
  ready,
  userId,
}: UseMemoTreeExpansionInput): UseMemoTreeExpansionResult {
  const storageKey = useMemo(() => storageKeyForUser(userId), [userId]);
  const folderKey = JSON.stringify(folderIds);
  const knownFolderIdsRef = useRef<Set<string>>(new Set());
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(
    null,
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!ready) {
      knownFolderIdsRef.current = new Set();
      setHydratedStorageKey(null);
      setExpandedFolders(new Set());
      return;
    }

    const availableFolderIds = new Set(folderIds);
    const storedExpandedFolders = readExpandedFolders(storageKey);
    const nextExpandedFolders = storedExpandedFolders === null
      ? new Set(availableFolderIds)
      : new Set(
          [...storedExpandedFolders].filter((folderId) =>
            availableFolderIds.has(folderId)),
        );

    knownFolderIdsRef.current = availableFolderIds;
    setExpandedFolders(nextExpandedFolders);
    setHydratedStorageKey(storageKey);
  }, [ready, storageKey]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) {
      return;
    }

    const previousFolderIds = knownFolderIdsRef.current;
    knownFolderIdsRef.current = new Set(folderIds);
    setExpandedFolders((currentFolders) => {
      const reconciled = reconcileExpandedFolderIds(
        currentFolders,
        previousFolderIds,
        folderIds,
      );

      return setsEqual(currentFolders, reconciled)
        ? currentFolders
        : reconciled;
    });
  }, [folderKey, hydratedStorageKey, storageKey]);

  useEffect(() => {
    if (hydratedStorageKey === storageKey) {
      writeExpandedFolders(storageKey, expandedFolders);
    }
  }, [expandedFolders, hydratedStorageKey, storageKey]);

  return { expandedFolders, setExpandedFolders };
}
