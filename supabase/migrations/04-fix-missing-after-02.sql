-- ============================================================================
-- 04-fix-missing-after-02.sql
-- 用途：如果你已经跑过 02-sync-existing.sql 但首页每日推荐仍空白、
--       F12 报 user_checkin_completions / user_sentence_bookmarks 400，
--       说明旧版 02 漏建了这 2 张表和 2 个 RPC。本补丁幂等补建。
-- 执行：在 Supabase Dashboard → SQL Editor 里贴入执行。
-- ============================================================================

-- 句子收藏（sentences.js / PhrasesSection 星标）
create table if not exists user_sentence_bookmarks (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  sentence_id bigint not null references sentences(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, sentence_id)
);
alter table user_sentence_bookmarks enable row level security;
drop policy if exists "own_sentence_bookmarks" on user_sentence_bookmarks;
create policy "own_sentence_bookmarks" on user_sentence_bookmarks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 打卡完成记录（checkin.js / HomePage 统计）
create table if not exists user_checkin_completions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references user_checkin_tasks(id) on delete cascade,
  date       date not null,
  completed  boolean default true,
  created_at timestamptz default now(),
  unique (user_id, task_id, date)
);
alter table user_checkin_completions enable row level security;
drop policy if exists "own_checkin_completions" on user_checkin_completions;
create policy "own_checkin_completions" on user_checkin_completions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 随机取一个已富化词条（每日推荐用）
drop function if exists get_random_word();
create or replace function get_random_word()
returns dictionary_full language sql stable security invoker as $$
  select * from dictionary_full
  where enrichment_status = 'enriched'
  order by random() limit 1;
$$;

-- 随机取一个句子（每日推荐用）
drop function if exists get_random_sentence();
create or replace function get_random_sentence()
returns sentences language sql stable security invoker as $$
  select * from sentences order by random() limit 1;
$$;
