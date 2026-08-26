/**
 * [INPUT]: 依赖 Hono、strict Canvas V2 schemas、auth/canvas services 与统一 ok helper
 * [OUTPUT]: 对外提供 memo 默认 Canvas PUT、独立创建、读取、统一 mutation、可信 context 与 expansion commit 路由
 * [POS]: router 层 Canvas V2 唯一 HTTP 边界；所有写请求显式 protocol_version=2，旧 save/layout/card/promote 入口已不存在
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import { Hono } from "hono";

import { ok } from "../common/response.ts";
import {
  canvasExpansionMutationSchema,
  canvasMutationSchema,
  canvasNodeIdParamSchema,
  canvasV2NodeParamSchema,
  createCanvasV2Schema,
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
export const memoCanvasRouter = new Hono();

memoCanvasRouter.put("/:nodeId/canvas", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(canvasNodeIdParamSchema, c.req.param());
  return ok(
    c,
    await canvasService.getOrCreateForMemo(authUser, accessToken, nodeId),
  );
});

canvasRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(
    c,
    createCanvasV2Schema,
    "Invalid Canvas V2 create data",
  );
  return ok(c, await canvasService.createStandalone(authUser, accessToken, input));
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
    canvasMutationSchema,
    "Invalid Canvas V2 mutation data",
  );
  return ok(c, await canvasService.mutate(authUser, accessToken, nodeId, input));
});

canvasRouter.get("/:canvasId/nodes/:nodeId/expansion-context", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { canvasId, nodeId } = parseRouteParams(
    canvasV2NodeParamSchema,
    c.req.param(),
  );
  return ok(c, await canvasService.getExpansionContext(
    authUser,
    accessToken,
    canvasId,
    nodeId,
  ));
});

canvasRouter.post("/:nodeId/expansions", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(canvasNodeIdParamSchema, c.req.param());
  const input = await parseJsonBody(
    c,
    canvasExpansionMutationSchema,
    "Invalid Canvas V2 expansion data",
  );
  return ok(
    c,
    await canvasService.commitExpansion(authUser, accessToken, nodeId, input),
  );
});
