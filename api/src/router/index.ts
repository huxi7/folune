/**
 * [INPUT]: 依赖 Hono 与 health/profile/billing/memo/ai/canvas 资源 routers
 * [OUTPUT]: 对外提供聚合全部业务路径的 router
 * [POS]: router 层聚合根，只挂载资源路径，不读取环境变量或承载业务判断
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Hono } from "hono";

import {
  aiCommandRouter,
  aiContextRouter,
  aiRunRouter,
  aiSettingsRouter,
  aiThreadRouter,
  aiUsageRouter,
} from "./ai.router.ts";

import { canvasRouter, memoCanvasRouter } from "./canvas.router.ts";
import { billingRouter } from "./billing.router.ts";
import { healthRouter } from "./health.router.ts";
import {
  memoFolderRouter,
  memoNodeRouter,
  memoRouter,
  memoSearchRouter,
  memoTrashRouter,
  memoTreeRouter,
} from "./memo.router.ts";
import { profileRouter } from "./profile.router.ts";

export const router = new Hono();

router.route("/health", healthRouter);
router.route("/profile", profileRouter);
router.route("/billing", billingRouter);
router.route("/memo-tree", memoTreeRouter);
router.route("/memo-search", memoSearchRouter);
router.route("/memo-folders", memoFolderRouter);
router.route("/memos", memoCanvasRouter);
router.route("/memos", memoRouter);
router.route("/memo-nodes", memoNodeRouter);
router.route("/memo-trash", memoTrashRouter);
router.route("/ai-threads", aiThreadRouter);
router.route("/ai-context", aiContextRouter);
router.route("/ai-runs", aiRunRouter);
router.route("/ai-settings", aiSettingsRouter);
router.route("/ai-commands", aiCommandRouter);
router.route("/ai-usage", aiUsageRouter);
router.route("/canvases", canvasRouter);
