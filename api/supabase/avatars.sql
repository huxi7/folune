-- [INPUT]: 依赖 Supabase Storage 的 storage.buckets/storage.objects、storage.foldername()、auth.uid() 与 authenticated 角色
-- [OUTPUT]: 建立公开 avatars bucket、5MB/JPEG-PNG-WebP 限制，以及用户目录 owner-only SELECT/INSERT/DELETE policies
-- [POS]: api/supabase 的头像对象存储契约，公开读取头像但所有写入与清理必须以当前用户 JWT 通过 Storage API 执行
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
