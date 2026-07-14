-- ============================================================================
-- 02-sync-existing.sql
-- 用途：把「已有 31 张表」的真实 Supabase 库，对齐到新系统代码所需的 schema。
-- 设计原则（严禁破坏已有数据）：
--   1. dictionary 已存在（6 万+ 词条）→ 绝不重建，只补「匿名可读」RLS。
--   2. 仅 CREATE 代码需要、但库里【还不存在】的 9 张表。
--   3. 已有表仅 ADD COLUMN IF NOT EXISTS 补新列（存在则跳过，绝不冲突）。
--   4. RPC 用 CREATE OR REPLACE（幂等）。
--   5. 全程不 INSERT / UPDATE / DELETE 任何业务数据。
-- 执行顺序：本文件可单独跑；如需完整建库用 01-create-schema.sql（仅限全新空库）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. 公开读 RLS：确保已存在的公开表对 anon/authenticated 可读
--    注意：PostgreSQL 的 CREATE POLICY 不支持 IF NOT EXISTS，故统一采用
--          「先 DROP POLICY IF EXISTS 再 CREATE POLICY」写法，可重复安全执行。
-- ----------------------------------------------------------------------------
alter table dictionary      enable row level security;
alter table sentences       enable row level security;
alter table daily_picks     enable row level security;
alter table community_words enable row level security;

drop policy if exists "public_read_dictionary"  on dictionary;
create policy "public_read_dictionary"
  on dictionary for select to anon, authenticated using (true);
drop policy if exists "public_read_sentences"   on sentences;
create policy "public_read_sentences"
  on sentences for select to anon, authenticated using (true);
drop policy if exists "public_read_daily_picks" on daily_picks;
create policy "public_read_daily_picks"
  on daily_picks for select to anon, authenticated using (true);
drop policy if exists "public_read_community"   on community_words;
create policy "public_read_community"
  on community_words for select to anon, authenticated using (true);

-- dictionary_full 是已存在的【视图】（映射 dictionary + word_freqs + word_sources + user_sentences）。
-- ⚠️ PostgreSQL 不允许对视图启用 RLS，故【不】对其建 policy；
--    视图可读性由底层基表的 anon 可读策略 + 视图级 grant select 保证。
-- 确保视图所依赖的基表对 anon/authenticated 可读（先删后建，可重复跑）：
alter table word_freqs      enable row level security;
alter table word_sources    enable row level security;
alter table user_sentences  enable row level security;

drop policy if exists "public_read_word_freqs"     on word_freqs;
create policy "public_read_word_freqs"
  on word_freqs for select to anon, authenticated using (true);
drop policy if exists "public_read_word_sources"   on word_sources;
create policy "public_read_word_sources"
  on word_sources for select to anon, authenticated using (true);
drop policy if exists "public_read_user_sentences" on user_sentences;
create policy "public_read_user_sentences"
  on user_sentences for select to anon, authenticated using (true);

-- 视图级 SELECT 授权（前端 anon key 读取视图需要该权限）
grant select on dictionary_full to anon, authenticated;

-- ----------------------------------------------------------------------------
-- B. 已有表补新列（仅 ADD COLUMN IF NOT EXISTS，存在则跳过）
--    这些列是新系统相对旧 schema 新增的，旧表通常没有。
-- ----------------------------------------------------------------------------
alter table user_notes
  add column if not exists tags text[] default '{}';

alter table user_checkin_tasks
  add column if not exists task_types text[] default '{word}',
  add column if not exists task_type  text  default 'word';

alter table user_learning_plans
  add column if not exists daily_minutes integer not null default 15,
  add column if not exists plan          jsonb   not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- C. 缺失的 9 张表（库里不存在才创建）
-- ----------------------------------------------------------------------------

-- 新增 A：user_achievements（成就 / 徽章） src/lib/db/achievements.js
create table if not exists user_achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  badge_key   text not null,
  unlocked_at timestamptz,
  created_at  timestamptz default now(),
  unique (user_id, badge_key)
);
alter table user_achievements enable row level security;
drop policy if exists "own_achievements" on user_achievements;
create policy "own_achievements" on user_achievements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 新增 B：user_roles（角色与权限） src/lib/db/roles.js
create table if not exists user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text default 'user',     -- super_admin | admin | user
  permissions text[] default '{}',
  updated_at  timestamptz default now(),
  unique (user_id)
);
alter table user_roles enable row level security;
drop policy if exists "own_roles" on user_roles;
create policy "own_roles" on user_roles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 新增 C：pending_approvals（AI 词条/句子入库审批） src/lib/db/approvals.js
create table if not exists pending_approvals (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,          -- word | sentence
  payload       jsonb not null,
  requested_by  uuid references auth.users(id) on delete set null,
  reviewed_by   uuid references auth.users(id) on delete set null,
  status        text default 'pending', -- pending | approved | rejected
  reject_reason text default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_approvals_status on pending_approvals (status);
alter table pending_approvals enable row level security;
-- 审批列表仅管理员可读写；普通用户无策略即被 RLS 拒绝（由 admin 后端用 service_role 访问）
drop policy if exists "admin_approvals" on pending_approvals;
create policy "admin_approvals" on pending_approvals
  for all to authenticated
  using (exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','super_admin')))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','super_admin')));

-- 新增 D：user_diaries / user_diary_images（学习日记） src/lib/db/diaries.js
create table if not exists user_diaries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  content       text default '',
  mood          text default 'neutral',
  study_minutes integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_diaries_user on user_diaries (user_id);
alter table user_diaries enable row level security;
drop policy if exists "own_diaries" on user_diaries;
create policy "own_diaries" on user_diaries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists user_diary_images (
  id            uuid primary key default gen_random_uuid(),
  diary_id      uuid not null references user_diaries(id) on delete cascade,
  image_url     text not null,
  storage_type  text default 'local',  -- local | supabase | webdav
  created_at    timestamptz default now()
);
create index if not exists idx_diary_images on user_diary_images (diary_id);
alter table user_diary_images enable row level security;
drop policy if exists "own_diary_images" on user_diary_images;
create policy "own_diary_images" on user_diary_images
  for all to authenticated
  using (exists (select 1 from user_diaries d where d.id = diary_id and d.user_id = auth.uid()))
  with check (exists (select 1 from user_diaries d where d.id = diary_id and d.user_id = auth.uid()));

-- 新增 E：user_practice_records / user_practice_wrong（练习/测验） src/lib/db/practice.js
create table if not exists user_practice_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  mode             text not null,       -- mcq | typing | listening ...
  correct_count    integer default 0,
  total_count      integer default 0,
  duration_seconds integer default 0,
  created_at       timestamptz default now()
);
create index if not exists idx_practice_user on user_practice_records (user_id);
alter table user_practice_records enable row level security;
drop policy if exists "own_practice" on user_practice_records;
create policy "own_practice" on user_practice_records
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists user_practice_wrong (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  word           text not null,
  wrong_count    integer default 0,
  last_wrong_at  timestamptz,
  created_at     timestamptz default now(),
  unique (user_id, word)
);
alter table user_practice_wrong enable row level security;
drop policy if exists "own_practice_wrong" on user_practice_wrong;
create policy "own_practice_wrong" on user_practice_wrong
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 新增 F：word_books / user_word_book_progress（单词书） src/lib/db/wordbooks.js
create table if not exists word_books (
  id           bigserial primary key,
  name         text not null,
  description  text default '',
  sort_order   integer default 0,
  cover_color  text default '#A68A5B',
  created_at   timestamptz default now()
);
alter table word_books enable row level security;
drop policy if exists "public_read_word_books" on word_books;
create policy "public_read_word_books" on word_books
  for select to anon, authenticated using (true);

create table if not exists user_word_book_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  book_id           bigint not null references word_books(id) on delete cascade,
  last_word_index   integer default 0,
  completed         boolean default false,
  created_at        timestamptz default now(),
  unique (user_id, book_id)
);
alter table user_word_book_progress enable row level security;
drop policy if exists "own_word_book_progress" on user_word_book_progress;
create policy "own_word_book_progress" on user_word_book_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- D. RPC：search_words_zh（中文释义模糊搜索，search.js 调用）
--    CREATE OR REPLACE 幂等；若已存在则更新实现，不破坏数据。
-- ----------------------------------------------------------------------------
-- PG 不允许 CREATE OR REPLACE 改返回类型；先删后建，确保可重复执行（无论库里是否已有旧版）。
drop function if exists search_words_zh(text, int);
create or replace function search_words_zh(search_term text, max_results int default 20)
returns setof dictionary_full language sql stable security invoker as $$
  select *
  from dictionary_full
  where word ilike '%' || search_term || '%'
     or exists (
       select 1 from jsonb_array_elements(senses) s
       where s->>'meaning' ilike '%' || search_term || '%'
     )
  order by (word = search_term) desc, word
  limit max_results;
$$;

-- ----------------------------------------------------------------------------
-- E. otp_codes：库里已存在，这里只确保 RLS 开启（写入由 service_role 绕过 RLS）。
--    ⚠️ 若你的 otp_codes 列结构与我路由写入的列(email,code,purpose,expires_at)不一致，
--       请把 otp_codes 的列结构贴给我，我再对齐 app/api/verify-otp 的写入逻辑。
-- ----------------------------------------------------------------------------
alter table otp_codes enable row level security;
