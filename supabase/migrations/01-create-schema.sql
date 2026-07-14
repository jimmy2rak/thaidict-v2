-- ============================================================================
-- 01-create-schema.sql
-- ThaiDict / 词笺（中泰双语智能词典）— 基础 Schema（Supabase / PostgreSQL）
-- ----------------------------------------------------------------------------
-- 用途：阶段 6（接入真实 Supabase）首次建库时执行。本文件定义【全部表 + RPC +
--       RLS 策略 + 唯一约束 + 索引】。执行顺序：先跑本文件，再跑
--       `00-fix-known-bugs.sql`（其内 CREATE OR REPLACE / DROP POLICY 会在此基础上补强）。
--
-- 设计依据（双来源交叉验证）：
--   1) 指南文档 `docs/rebuild/01-项目基础信息与锁定清单.md`（§1.6 的 20 张表 + 7 个 RPC）
--   2) 当前 Next.js 版 `src/lib/db/*.js` 代码实际引用到的【列名 / 类型 / onConflict 键】
--      （即代码是唯一权威；列定义严格对齐代码，避免运行时列不存在报错）
--
-- 重要：本文件【不 INSERT / UPDATE / DELETE 任何行数据】，仅定义结构（DDL）。
-- 所有 user_id 一律为 UUID 并外键 `auth.users`（ON DELETE CASCADE），RLS 以
-- `auth.uid()` 鉴权，符合文档 §1.2 锁定项。
--
-- 环境变量（Next.js，与文档 Vite 的 VITE_* 不同，已在 src/lib/supabase.js 实现）：
--   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
-- ============================================================================

create extension if not exists "pgcrypto";   -- 提供 gen_random_uuid()

-- ============================================================================
-- 一、词典领域表（公开数据，anon 可读）
-- ============================================================================

-- 表 1：dictionary_full（词典主表，word 为主键）
-- 代码引用：src/lib/db/search.js（select/upsert/count）、AppContext.jsx（loadDictFromDB）
create table if not exists dictionary_full (
  word                  text primary key,
  romanization          text default '',
  senses                jsonb default '[]'::jsonb,       -- [{pos, meaning, example?}]
  synonyms              jsonb default '[]'::jsonb,
  antonyms              jsonb default '[]'::jsonb,
  learner_associations  jsonb default '[]'::jsonb,
  sense_count           integer default 0,
  enrichment_status     text default 'pending',          -- pending | enriched
  freq_ttc               integer default 0,
  source                text default 'dictionary_full',
  created_at            timestamptz default now()
);
create index if not exists idx_dict_full_senses on dictionary_full using gin (senses jsonb_path_ops);

-- 表 3：sentences（句子/短语库 idioms|buddhist|daily）
-- 代码引用：src/lib/db/sentences.js（select / get_random_sentence RPC）
-- 内容列依据 src/data/phraseData.js 注释（id,thai,zh,category,difficulty,tags,segmented,literal,actual,advice）
create table if not exists sentences (
  id           bigserial primary key,
  thai         text not null,
  zh           text default '',
  literal      text default '',        -- 字面意义
  actual       text default '',        -- 实际意义（代码读 actual || zh）
  note         text default '',
  advice       text default '',        -- 学习者建议
  category     text default 'daily',   -- idioms | buddhist | daily
  difficulty   integer default 1,
  tags         text[] default '{}',
  segmented    jsonb default '[]'::jsonb,  -- [{text, meaning}]
  romanization text default '',
  created_at   timestamptz default now()
);
create index if not exists idx_sentences_category on sentences (category);

-- 表 4：community_words（社区共建 / AI 生成词条）
-- 代码引用：src/lib/db/community.js（upsert onConflict 'word'）、search.js（or ilike）
create table if not exists community_words (
  word        text primary key,
  senses      jsonb default '[]'::jsonb,
  zh_hint     text default '',
  source      text default 'community',
  status      text default 'pending',  -- pending | approved
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);
create index if not exists idx_community_senses on community_words using gin (senses jsonb_path_ops);

-- 表 5：daily_picks（每日推荐 v2，全局只存 ID 引用）
-- 代码引用：src/lib/db/daily-picks.js（select daily_word_id / daily_sentence_id）
create table if not exists daily_picks (
  id                 bigserial primary key,
  daily_word_id      text references dictionary_full(word) on delete set null,
  daily_sentence_id  bigint references sentences(id) on delete set null,
  pick_date          date default current_date,
  created_at         timestamptz default now()
);

-- 表 6：system_config（系统配置，如 AI 密钥；service_role only，前端无入口）
-- 新架构中 AI 密钥已下沉到 user_api_keys（用户自带）+ Edge Function 环境变量，
-- 故此表为可选/后台配置，不开放 anon/authenticated 策略（仅 service_role 绕过 RLS 访问）。
create table if not exists system_config (
  key         text primary key,
  value       jsonb default '{}'::jsonb,
  description text default '',
  updated_at  timestamptz default now()
);

-- 注：文档 §1.6 表 2 `dictionary`（旧版词典表）在本新架构中已由 dictionary_full 取代，
--     real 模式代码（getDictionaryCount）直接查 dictionary_full，故不再单独建 `dictionary` 表。

-- ============================================================================
-- 二、用户数据表（JWT-based RLS：user_id = auth.uid()）
-- ============================================================================

-- 表 7：user_bookmarks（单词收藏）
-- 代码：src/lib/db/bookmarks.js（upsert {user_id, word}）
create table if not exists user_bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  word       text not null,
  created_at timestamptz default now(),
  unique (user_id, word)
);

-- 表 8：user_recent_words（最近查词记录）
-- 代码：src/lib/db/recent.js（update looked_up_at + lookup_count / insert）
create table if not exists user_recent_words (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  word         text not null,
  lookup_count integer default 1,
  looked_up_at timestamptz default now(),
  created_at   timestamptz default now(),
  unique (user_id, word)
);

-- 表 9：user_folders（单词/句子文件夹）
-- 代码：src/lib/db/folders.js（insert {user_id,name,color,folder_type}；select 含关系计数）
create table if not exists user_folders (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text default '#A68A5B',
  folder_type text default 'word',   -- word | sentence
  sort_order  integer default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_folders_user on user_folders (user_id);

-- 表 10：user_folder_words（文件夹-单词关联）
-- 代码：src/lib/db/folders.js（upsert {folder_id, word}）
create table if not exists user_folder_words (
  id         bigserial primary key,
  folder_id  bigint not null references user_folders(id) on delete cascade,
  word       text not null,
  created_at timestamptz default now(),
  unique (folder_id, word)
);

-- 表 11：user_folder_sentences（文件夹-句子关联）
-- 代码：src/lib/db/folders.js（upsert {folder_id, sentence_id}）；RLS 走文件夹归属（见下方 A-1）
create table if not exists user_folder_sentences (
  id          bigserial primary key,
  folder_id   bigint not null references user_folders(id) on delete cascade,
  sentence_id bigint not null references sentences(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (folder_id, sentence_id)
);

-- 表 12：user_learning_plans（学习计划设置）
-- 代码：src/lib/db/learning.js（upsert {user_id, ...plan}）；LearnPage 读 plan?.daily_minutes
-- 设计为 daily_minutes 列 + plan JSONB（容纳任意计划子字段，向后兼容）
create table if not exists user_learning_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  daily_minutes integer not null default 15,
  plan          jsonb not null default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id)
);

-- 表 13：user_learning_progress（每日学习进度）
-- 代码：src/lib/db/learning.js / checkin.js（streak_days, study_minutes, date）
create table if not exists user_learning_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  study_minutes integer default 0,
  streak_days   integer default 0,
  created_at    timestamptz default now(),
  unique (user_id, date)
);

-- 表 14：user_notes（学习笔记）
-- 代码：src/lib/db/notes.js（insert {user_id, word, content, tags}；getNoteForWord 按 word 查重）
create table if not exists user_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  word       text not null,
  content    text default '',
  tags       text[] default '{}',     -- 上线前如需可 ALTER TABLE user_notes ADD COLUMN tags text[]
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, word)
);
create index if not exists idx_notes_user on user_notes (user_id);

-- 表 15：user_settings（用户设置）
-- 代码：src/lib/db/settings.js（upsert onConflict 'user_id'，19 个设置列）
create table if not exists user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  dict_direction     text default 'th_to_zh',   -- th_to_zh | zh_to_th
  color_mode         text default 'light',      -- light | dark
  speech_rate        numeric default 1.0,
  font_size          text default 'medium',
  chinese_font       text default 'noto_sans_sc',
  thai_font          text default 'noto_sans_thai',
  reminder_enabled   boolean default false,
  reminder_time      text default '20:00',
  reminder_frequency text default 'daily',
  webdav_url         text default '',
  webdav_user        text default '',
  webdav_pass_enc    text default '',
  default_api_id     uuid,                         -- 关联 user_api_keys.id
  updated_at         timestamptz default now()
);

-- 表 16：user_sentence_bookmarks（句子收藏 / 星标）
-- 代码：src/lib/db/sentences.js（upsert {user_id, sentence_id}；PhrasesSection / SentenceDetailView 的星标按钮）
create table if not exists user_sentence_bookmarks (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  sentence_id bigint not null references sentences(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (user_id, sentence_id)
);

-- 表 17：user_api_keys（用户自带 AI API 密钥）
-- 代码：src/lib/db/api-keys.js（upsert {id?, user_id, name, provider, key, base_url, model}）
-- 用 UUID 主键（与全站一致）；upsert 时若 key.id 为 undefined 则自动生成。
create table if not exists user_api_keys (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '我的密钥',
  provider   text not null default 'openai',
  key        text not null,
  base_url   text default '',
  model      text default 'gpt-4o',
  is_active  boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_api_keys_user on user_api_keys (user_id);

-- 表 18：user_checkin_tasks（打卡任务）
-- 代码：src/lib/db/checkin.js（insert {user_id,name,duration_minutes,task_types,task_type,plan_days,sort_order,is_active}）
create table if not exists user_checkin_tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  duration_minutes integer default 10,
  task_types       text[] default '{word}',     -- 多选：word/grammar/reading/listening/speaking/writing + 自定义
  task_type        text default 'word',         -- 兼容单值（取 task_types[0]）
  plan_days        integer[] default '{1,2,3,4,5,6,7}',  -- 1=周一…7=周日
  sort_order       integer default 0,
  is_active        boolean default true,
  created_at       timestamptz default now()
);
create index if not exists idx_checkin_tasks_user on user_checkin_tasks (user_id);

-- 表 19：user_checkin_completions（打卡完成记录）
-- 代码：src/lib/db/checkin.js（upsert {user_id, task_id, date, completed} onConflict user_id,task_id,date）
create table if not exists user_checkin_completions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references user_checkin_tasks(id) on delete cascade,
  date       date not null,
  completed  boolean default true,
  created_at timestamptz default now(),
  unique (user_id, task_id, date)
);

-- 表 20：otp_codes（OTP 验证码，service_role only，由 Edge Function 管理）
-- 代码不直接查询（走 send-otp / verify-otp Edge Function）；此处建表供函数写入。
create table if not exists otp_codes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code       text not null,
  purpose    text default 'login',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists idx_otp_email on otp_codes (email);

-- ============================================================================
-- 三、新系统新增表（文档未列出，但当前代码已实现并需要落库）
-- ============================================================================

-- 新增 A：user_achievements（成就 / 徽章） src/lib/db/achievements.js
create table if not exists user_achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  badge_key   text not null,
  unlocked_at timestamptz,
  created_at  timestamptz default now(),
  unique (user_id, badge_key)
);

-- 新增 B：user_roles（角色与权限） src/lib/db/roles.js
create table if not exists user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text default 'user',     -- super_admin | admin | user
  permissions text[] default '{}',
  updated_at  timestamptz default now(),
  unique (user_id)
);

-- 新增 C：pending_approvals（AI 词条/句子入库审批） src/lib/db/approvals.js
create table if not exists pending_approvals (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,          -- word | sentence
  payload      jsonb not null,
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by  uuid references auth.users(id) on delete set null,
  status       text default 'pending', -- pending | approved | rejected
  reject_reason text default '',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_approvals_status on pending_approvals (status);

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

create table if not exists user_diary_images (
  id            uuid primary key default gen_random_uuid(),
  diary_id      uuid not null references user_diaries(id) on delete cascade,
  image_url     text not null,
  storage_type  text default 'local',  -- local | supabase | webdav
  created_at    timestamptz default now()
);
create index if not exists idx_diary_images on user_diary_images (diary_id);

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

create table if not exists user_practice_wrong (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  word           text not null,
  wrong_count    integer default 0,
  last_wrong_at  timestamptz,
  created_at     timestamptz default now(),
  unique (user_id, word)
);

-- 新增 F：word_books / user_word_book_progress（单词书） src/lib/db/wordbooks.js
-- word_books 为全局公共书单（无 user_id）；user_word_book_progress 记录个人进度
create table if not exists word_books (
  id           bigserial primary key,
  name         text not null,
  description  text default '',
  sort_order   integer default 0,
  cover_color  text default '#A68A5B',
  created_at   timestamptz default now()
);

create table if not exists user_word_book_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  book_id           bigint not null references word_books(id) on delete cascade,
  last_word_index   integer default 0,
  completed         boolean default false,
  created_at        timestamptz default now(),
  unique (user_id, book_id)
);

-- ============================================================================
-- 四、RPC 函数（代码调用：search.js / sentences.js / checkin.js / auth Edge）
-- ============================================================================

-- 中文模糊搜索词典（senses.meaning ILIKE）
-- 代码：src/lib/db/search.js → supabase.rpc('search_words_zh', {search_term, max_results})
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

-- 随机取一个已富化词条
create or replace function get_random_word()
returns dictionary_full language sql stable security invoker as $$
  select * from dictionary_full
  where enrichment_status = 'enriched'
  order by random() limit 1;
$$;

-- 随机取一个句子（可按类别由应用层过滤）
create or replace function get_random_sentence()
returns sentences language sql stable security invoker as $$
  select * from sentences order by random() limit 1;
$$;

-- 社区词模糊搜索（代码当前改为内联 or ilike，保留以兼容文档 RPC 列表）
create or replace function search_community_words(search text, max_results int default 20)
returns setof community_words language sql stable security invoker as $$
  select *
  from community_words
  where word ilike '%' || search || '%'
     or exists (
       select 1 from jsonb_array_elements(senses) s
       where s->>'meaning' ilike '%' || search || '%'
     )
  limit max_results;
$$;

-- 为用户创建默认文件夹（我的单词 / 我的句子）
-- 与 00-fix-known-bugs.sql 的 A-5 同源；此处建立基础版（使用当前配色）。
create or replace function create_default_folders(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into user_folders (user_id, name, color, folder_type)
  values (p_user_id, '我的单词', '#A68A5B', 'word')
  on conflict do nothing;
  insert into user_folders (user_id, name, color, folder_type)
  values (p_user_id, '我的句子', '#D4A84A', 'sentence')
  on conflict do nothing;
end;
$$;

-- 原子累加每日学习分钟数（Bug B-6 修复）
-- 代码：src/lib/db/checkin.js → supabase.rpc('add_study_minutes', {p_user_id, p_date, p_minutes})
create or replace function add_study_minutes(p_user_id uuid, p_date date, p_minutes int)
returns void language plpgsql security definer as $$
begin
  insert into user_learning_progress (user_id, date, study_minutes)
  values (p_user_id, p_date, p_minutes)
  on conflict (user_id, date)
  do update set study_minutes = user_learning_progress.study_minutes + p_minutes;
end;
$$;

-- OTP 发送频率限制（60 秒）
-- 代码：Edge Function send-otp 调用（或在应用层检查）
create or replace function check_otp_rate_limit(p_email text)
returns boolean language sql stable security definer as $$
  select not exists (
    select 1 from otp_codes
    where email = p_email and created_at > now() - interval '60 seconds'
  );
$$;

-- 清理过期 OTP
create or replace function cleanup_expired_otps()
returns void language sql security definer as $$
  delete from otp_codes where expires_at < now();
$$;

-- ============================================================================
-- 五、RLS（Row Level Security）
-- ============================================================================

-- 5.1 公开表：anon + authenticated 可读
alter table dictionary_full     enable row level security;
alter table sentences           enable row level security;
alter table daily_picks         enable row level security;
alter table word_books          enable row level security;

create policy "public_read_dictionary"  on dictionary_full  for select to anon, authenticated using (true);
create policy "public_read_sentences"   on sentences        for select to anon, authenticated using (true);
create policy "public_read_daily_picks" on daily_picks      for select to anon, authenticated using (true);
create policy "public_read_word_books"  on word_books       for select to anon, authenticated using (true);

-- community_words：可读 + 登录用户可写
alter table community_words enable row level security;
create policy "public_read_community" on community_words for select to anon, authenticated using (true);
create policy "auth_insert_community" on community_words for insert to authenticated with check (true);

-- system_config / otp_codes：仅 service_role（不建 anon/auth 策略，RLS 开启即拒绝前两者）
alter table system_config enable row level security;
alter table otp_codes     enable row level security;

-- 5.2 用户表：仅本人（auth.uid()）
do $$
declare t text;
begin
  foreach t in array array[
    'user_bookmarks','user_recent_words','user_folders','user_folder_words',
    'user_learning_plans','user_learning_progress','user_notes','user_settings',
    'user_sentence_bookmarks','user_api_keys','user_checkin_tasks','user_checkin_completions',
    'user_achievements','user_roles','pending_approvals','user_diaries','user_diary_images',
    'user_practice_records','user_practice_wrong','user_word_book_progress'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %1$I on %1$I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- 5.3 user_folder_sentences 经文件夹归属鉴权（文档 Bug A-1）
alter table user_folder_sentences enable row level security;
drop policy if exists "user_select_folder_sentences" on user_folder_sentences;
drop policy if exists "user_insert_folder_sentences" on user_folder_sentences;
drop policy if exists "user_delete_folder_sentences" on user_folder_sentences;
create policy "user_select_folder_sentences" on user_folder_sentences
  for select to authenticated
  using (folder_id in (select id from user_folders where user_id = auth.uid()));
create policy "user_insert_folder_sentences" on user_folder_sentences
  for insert to authenticated
  with check (folder_id in (select id from user_folders where user_id = auth.uid()));
create policy "user_delete_folder_sentences" on user_folder_sentences
  for delete to authenticated
  using (folder_id in (select id from user_folders where user_id = auth.uid()));

-- ============================================================================
-- 完成。下一步：执行 00-fix-known-bugs.sql 做 RLS/RPC 补强（本文件已含其主体，
-- 重复部分以 CREATE OR REPLACE / DROP POLICY 幂等覆盖，可安全重跑）。
-- ============================================================================
