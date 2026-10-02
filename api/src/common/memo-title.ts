/**
 * [INPUT]: 依赖 common/HttpError 与 lib/supabase-rest 的 postgrestErrorCode 原始 SQLSTATE
 * [OUTPUT]: 对外提供 MEMO_TITLE_CONFLICT 业务错误、isMemoTitleConflict 判据、withTitleConflictTranslation 翻译、默认名候选序列及笔记/画布共用的 createWithDefaultTitle 最大编号分配器
 * [POS]: common 层的命名冲突边界；唯一约束的最终裁决在数据库，本模块只负责把 23505 翻译成稳定业务错误，并让系统生成的默认名在冲突时顺位让开
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "./http-error.ts";
import { postgrestErrorCode } from "../lib/supabase-rest.ts";

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";
/** memo_nodes_title_check 的上限 */
const TITLE_MAX_LENGTH = 500;
/**
 * 默认名分配的并发冲突重试上限；笔记/画布每次直接跳到最新最大编号，
 * 此上限约束竞争重试次数，不限制已有默认笔记数量。
 */
const MAX_TITLE_ATTEMPTS = 20;

export const isMemoTitleConflict = (error: unknown): boolean =>
  postgrestErrorCode(error) === UNIQUE_VIOLATION;

export const memoTitleConflictError = (): HttpError =>
  new HttpError(
    409,
    "MEMO_TITLE_CONFLICT",
    "A sibling of the same type already uses this name",
  );

/**
 * 用户亲手输入的名字撞上唯一约束时的唯一出口：翻译成稳定可识别的业务错误，
 * 让前端能原位提示「已存在同名」，而不是把一个 502 存储错误甩给用户。
 */
export const withTitleConflictTranslation = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isMemoTitleConflict(error)) throw memoTitleConflictError();
    throw error;
  }
};

/**
 * 第 attempt 次尝试的候选名：0 → 原名，1 → 「原名 2」，2 → 「原名 3」。
 * 后缀要占位，所以先把基名截到不会越过 500 字上限的长度。
 */
export const candidateTitle = (base: string, attempt: number): string => {
  if (attempt === 0) return base;
  const suffix = ` ${attempt + 1}`;
  const room = TITLE_MAX_LENGTH - suffix.length;
  return `${[...base].slice(0, room).join("")}${suffix}`;
};

/**
 * 系统生成的默认名（新建备忘录 / 新建独立 Canvas）在同父同类型重名时顺位
 * 让开，与文件管理器新建同名文件的行为一致。用户亲手输入的名字绝不走这里
 * ——那种情况必须原位提示「已存在同名」，而不是替他改名。
 *
 * 唯一约束是并发下的唯一裁决者，因此这里不做预检查，只在数据库拒绝后取下
 * 一个候选重试；预检查会引入一次多余往返，也仍然挡不住并发。
 */
export const createWithAvailableTitle = async <T>(
  base: string,
  create: (title: string) => Promise<T>,
): Promise<T> => {
  for (let attempt = 0; attempt < MAX_TITLE_ATTEMPTS; attempt += 1) {
    try {
      return await create(candidateTitle(base, attempt));
    } catch (error) {
      if (!isMemoTitleConflict(error)) throw error;
    }
  }

  throw memoTitleConflictError();
};

/** 客户端已经同步占号时直接尝试；旧客户端的无编号请求与真正的并发撞名才读取同级快照。 */
export const createWithDefaultTitle = async <T>(
  base: "未命名备忘录" | "未命名 Canvas",
  proposed: string,
  readTitles: () => Promise<readonly string[]>,
  create: (title: string) => Promise<T>,
): Promise<T> => {
  const defaultPattern = new RegExp(`^${base}(?: ([1-9]\\d*))?$`, "i");
  const proposedMatch = defaultPattern.exec(proposed);
  if (proposedMatch === null) return createWithAvailableTitle(proposed, create);
  const nextTitle = async () => {
    let maximum = 0n;
    for (const title of await readTitles()) {
      const match = defaultPattern.exec(title.trim().replace(/\s+/g, " "));
      if (match) {
        const ordinal = BigInt(match[1] ?? "1");
        if (ordinal > maximum) maximum = ordinal;
      }
    }
    return maximum === 0n ? base : `${base} ${maximum + 1n}`;
  };
  let title = proposedMatch[1] === undefined ? await nextTitle() : proposed;
  for (let attempt = 0; attempt < MAX_TITLE_ATTEMPTS; attempt++) {
    try { return await create(title); }
    catch (error) {
      if (!isMemoTitleConflict(error)) throw error;
      title = await nextTitle();
    }
  }
  throw memoTitleConflictError();
};
