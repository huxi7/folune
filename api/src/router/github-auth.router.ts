/**
 * [INPUT]: 依赖 Hono、Bearer 提取和 github-auth service 的标准 userinfo
 * [OUTPUT]: 提供 GET /auth/github/userinfo 的 OAuth2 原始 JSON，响应禁止缓存
 * [POS]: Supabase 服务端 userinfo 适配路由；Bearer 是 GitHub token，不能作为 Folune 业务会话使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Hono } from "hono";
import { getGitHubUserInfo } from "../service/github-auth.service.ts";
import { readAccessToken } from "./request.ts";

export const githubAuthRouter = new Hono();
githubAuthRouter.get("/userinfo", async c => {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
  return c.json(await getGitHubUserInfo(readAccessToken(c)));
});
