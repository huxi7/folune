/**
 * [INPUT]: 依赖 Hono、router/request、canvas zod schemas、auth/canvas services 与统一 ok helper
 * [OUTPUT]: 对外提供 /canvases（保存/读取/布局/新增卡片）与 /canvas-cards（晋升）两个资源 router
 * [POS]: router 层知识画布 HTTP 适配器，只做认证、body/param 校验并把命令下传 service；保存与晋升都是 POST，因为二者都在创建新的树节点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import { Hono } from "hono";

import { ok } from "../common/response.ts";
import {
  canvasCardIdParamSchema,
  canvasLayoutSchema,
  canvasNodeIdParamSchema,
  createCanvasCardSchema,
  promoteCanvasNodeSchema,
  saveCanvasSchema,
} from "../dto/canvas.dto.ts";
import { authService } from "../service/auth.service.ts";
import { canvasService } from "../service/canvas.service.ts";
import {
  parseJsonBody,
  parseRouteParams,
  readAccessToken,
} from "./request.ts";

const authenticate = async (c: Context) => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);

  return { accessToken, authUser };
};

export const canvasRouter = new Hono();
export const canvasCardRouter = new Hono();

canvasRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(
    c,
    saveCanvasSchema,
    "Invalid canvas save data",
  );

  return ok(c, await canvasService.save(authUser, accessToken, input));
});

canvasRouter.get("/:nodeId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(canvasNodeIdParamSchema, c.req.param());

  return ok(c, await canvasService.read(authUser, accessToken, nodeId));
});

canvasRouter.patch("/:nodeId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(canvasNodeIdParamSchema, c.req.param());
  const input = await parseJsonBody(
    c,
    canvasLayoutSchema,
    "Invalid canvas layout data",
  );

  return ok(
    c,
    await canvasService.updateLayout(authUser, accessToken, nodeId, input),
  );
});

canvasRouter.post("/:nodeId/cards", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(canvasNodeIdParamSchema, c.req.param());
  const input = await parseJsonBody(
    c,
    createCanvasCardSchema,
    "Invalid canvas card data",
  );

  return ok(
    c,
    await canvasService.createCard(authUser, accessToken, nodeId, input),
  );
});

canvasCardRouter.post("/:cardId/promote", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { cardId } = parseRouteParams(canvasCardIdParamSchema, c.req.param());
  const input = await parseJsonBody(
    c,
    promoteCanvasNodeSchema,
    "Invalid canvas promotion data",
  );

  return ok(c, await canvasService.promote(authUser, accessToken, cardId, input));
});
