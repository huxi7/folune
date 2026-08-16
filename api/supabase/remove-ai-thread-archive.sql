-- [INPUT]: 依赖已部署的 public.ai_threads 表及旧归档索引
-- [OUTPUT]: 移除 AI 历史会话的 status 字段与归档索引，保留所有会话数据并统一按活动时间排序
-- [POS]: api/supabase 的一次性数据库迁移；原已归档会话不删除，会自然回到统一历史列表
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

drop index if exists public.ai_threads_user_status_activity_idx;

alter table public.ai_threads
  drop column if exists status;

create index if not exists ai_threads_user_activity_idx
  on public.ai_threads (user_id, last_message_at desc, id);
