/**
 * [INPUT]: 依赖 Hono、router/request、memo zod schemas、auth/memo services 与统一 ok helper
 * [OUTPUT]: 对外提供 /memo-tree、/memo-search、/memo-folders、/memos、/memo-nodes、/memo-trash 六个资源 router
 * [POS]: router 层备忘录 HTTP 适配器，只做认证、body/query/param 校验并把轻量读取、单篇正文和命令下传 service
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import { Hono } from "hono";

import { ok } from "../common/response.ts";
import {
  createMemoFolderSchema,
  createMemoSchema,
  memoNodeIdParamSchema,
  memoSearchQuerySchema,
  moveMemoNodeSchema,
  patchMemoSchema,
  renameMemoNodeSchema,
} from "../dto/memo.dto.ts";
import { authService } from "../service/auth.service.ts";
import { memoTrashService } from "../service/memo-trash.service.ts";
import { memoService } from "../service/memo.service.ts";
import {
  parseJsonBody,
  parseQueryParams,
  parseRouteParams,
  readAccessToken,
} from "./request.ts";

const authenticate = async (c: Context) => {
  const accessToken = readAccessToken(c);
  const authUser = await authService.authenticate(accessToken);

  return { accessToken, authUser };
};

export const memoTreeRouter = new Hono();
export const memoSearchRouter = new Hono();
export const memoFolderRouter = new Hono();
export const memoRouter = new Hono();
export const memoNodeRouter = new Hono();
export const memoTrashRouter = new Hono();

memoTreeRouter.get("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);

  return ok(c, await memoService.getTree(authUser, accessToken));
});

memoSearchRouter.get("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const query = parseQueryParams(memoSearchQuerySchema, c.req.query());

  return ok(c, await memoService.searchMemos(authUser, accessToken, query));
});

memoFolderRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(
    c,
    createMemoFolderSchema,
    "Invalid memo folder data",
  );

  return ok(
    c,
    await memoService.createFolder(authUser, accessToken, input),
  );
});

memoRouter.post("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const input = await parseJsonBody(
    c,
    createMemoSchema,
    "Invalid memo data",
  );

  return ok(
    c,
    await memoService.createMemo(authUser, accessToken, input),
  );
});

memoRouter.get("/:nodeId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );

  return ok(
    c,
    await memoService.getMemo(authUser, accessToken, nodeId),
  );
});

memoRouter.patch("/:nodeId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );
  const input = await parseJsonBody(
    c,
    patchMemoSchema,
    "Invalid memo data",
  );

  return ok(
    c,
    await memoService.updateMemo(
      authUser,
      accessToken,
      nodeId,
      input,
    ),
  );
});

memoNodeRouter.patch("/:nodeId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );
  const input = await parseJsonBody(
    c,
    renameMemoNodeSchema,
    "Invalid memo node data",
  );

  return ok(
    c,
    await memoService.renameNode(
      authUser,
      accessToken,
      nodeId,
      input,
    ),
  );
});

memoNodeRouter.patch("/:nodeId/move", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );
  const input = await parseJsonBody(
    c,
    moveMemoNodeSchema,
    "Invalid memo move data",
  );

  return ok(
    c,
    await memoService.moveNode(
      authUser,
      accessToken,
      nodeId,
      input,
    ),
  );
});

memoTrashRouter.get("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);

  return ok(c, await memoTrashService.listTrash(authUser, accessToken));
});

memoTrashRouter.delete("/", async (c) => {
  const { accessToken, authUser } = await authenticate(c);

  return ok(c, await memoTrashService.emptyTrash(authUser, accessToken));
});

memoNodeRouter.post("/:nodeId/trash", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );

  return ok(
    c,
    await memoTrashService.softDeleteNode(
      authUser,
      accessToken,
      nodeId,
    ),
  );
});

memoNodeRouter.post("/:nodeId/restore", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );

  return ok(
    c,
    await memoService.restoreNode(authUser, accessToken, nodeId),
  );
});

memoNodeRouter.delete("/:nodeId", async (c) => {
  const { accessToken, authUser } = await authenticate(c);
  const { nodeId } = parseRouteParams(
    memoNodeIdParamSchema,
    c.req.param(),
  );

  return ok(
    c,
    await memoTrashService.permanentlyDeleteNode(
      authUser,
      accessToken,
      nodeId,
    ),
  );
});
