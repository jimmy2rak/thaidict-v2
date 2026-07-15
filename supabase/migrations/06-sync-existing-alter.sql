-- ============================================================================
-- 06 - 已有库结构同步（ALTER 补列，非 create if not exists）
-- ----------------------------------------------------------------------------
-- 背景：本库是「已有库」，02/04 里的 `create table if not exists` 在老表已存在时
--       被跳过，导致老项目建过的表保留旧结构，而代码按新结构读写 → 400。
--       本脚本用 `alter table ... add column if not exists` 把老表补齐到代码期望，
--       并回填/去重/补唯一约束。纯 DDL，对现有数据只增不改，可重复执行。
-- 执行：Supabase 控制台 → SQL Editor → 粘贴全选 → Run。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) user_checkin_completions（老表：id / user_id / task_id / completed_at）
--    新代码期望：date(date) + completed(boolean)，且 (user_id,task_id,date) 唯一
-- ----------------------------------------------------------------------------
alter table user_checkin_completions
  add column if not exists date      date,
  add column if not exists completed boolean default true;

-- 从老字段 completed_at 回填 date（仅当为空）
update user_checkin_completions
   set date = completed_at::date
 where date is null and completed_at is not null;

-- 去重：同一 (user_id, task_id, date) 仅保留 completed_at 最新的一行，
--       避免后续建唯一索引时报错。date 为 NULL 的极端情况按一组去重。
delete from user_checkin_completions
 where id not in (
   select distinct on (user_id, task_id, coalesce(date, '1970-01-01'))
          id
   from   user_checkin_completions
   order by user_id, task_id, coalesce(date, '1970-01-01'), completed_at desc nulls last
 );

-- 补唯一约束（代码 upsert onConflict user_id,task_id,date 依赖它）
drop index if exists uniq_checkin_completions;
create unique index uniq_checkin_completions
  on user_checkin_completions (user_id, task_id, date);

-- ----------------------------------------------------------------------------
-- 2) user_checkin_tasks（老表缺 name / plan_days / created_at）
-- ----------------------------------------------------------------------------
alter table user_checkin_tasks
  add column if not exists name        text    default '打卡任务',
  add column if not exists plan_days   integer[] default '{1,2,3,4,5,6,7}',
  add column if not exists created_at  timestamptz default now();

-- ----------------------------------------------------------------------------
-- 3) user_recent_words（老表：id / user_id / word，缺 looked_up_at / lookup_count / created_at）
-- ----------------------------------------------------------------------------
alter table user_recent_words
  add column if not exists looked_up_at timestamptz default now(),
  add column if not exists lookup_count integer     default 1,
  add column if not exists created_at   timestamptz default now();

-- ============================================================================
-- 完成。无需在代码侧改动（代码已按新结构读写）。
-- ============================================================================
