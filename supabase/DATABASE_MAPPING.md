# ThaiDict · Supabase 数据库映射（文档 → 新系统）

> 生成依据：`docs/rebuild/01-项目基础信息与锁定清单.md`（§1.6 的 20 表 + 7 RPC）
> 交叉验证：当前 Next.js 版 `src/lib/db/*.js` 代码实际引用到的列名/类型/onConflict。
> 阶段：当前为 mock 本地阶段（`isSupabaseConfigured` 自动切换，未接真实库）。
> 本映射**只定义结构（DDL）与对应关系，不 INSERT/UPDATE/DELETE 任何数据**。

---

## 0. 关键结论（先说结果）

1. **建表 SQL 已产出** → `supabase/migrations/01-create-schema.sql`
   （20 文档表 + 9 新表 + 8 RPC + RLS + 唯一约束 + 索引，纯结构）。
2. **文档 20 表的"前端入口"几乎全部已存在**：扫描后，除下面 2 项外，其余 18 张表在新系统里**既有 db 层函数、也有对应前端页面**，无需新增前端入口。
   - `system_config`：后端/服务配置（AI 密钥已下沉到 `user_api_keys` + Edge 环境变量），本就不该有用户前端入口。
   - `dictionary_full`（**读取视图**）：用户真实库里已存在的视图（Supabase 表编辑器显示"小眼睛"图标），本身不存数据，是把 `dictionary` 主表 + `word_freqs` 词频表 + `word_sources` 来源表综合映射成每词一行。**新代码统一只读 `dictionary_full`**（查词、词条详情、分词词典加载）；写入（审批入库）落基表 `dictionary`，视图自动反映。**绝不 DROP/重建该视图**。
   - `dictionary`（**基表**）：真实词条数据存放处（6 万+ 词条），`dictionary_full` 的数据源之一。
3. **新系统反而是超集**：文档未列出、但代码已实现并需要落库的表有 9 张（成就/角色/审批/日记/练习/单词书等），均已有前端入口。
4. **环境变量命名差异**（重要）：文档写的是 Vite 的 `VITE_SUPABASE_URL/ANON_KEY`；新系统是 Next.js，已在 `src/lib/supabase.js` 改为 `NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY`，无需改代码。

---

## 1. 文档 20 表 → 新系统映射总表

| # | 文档表 | 新系统 db 文件 | 前端入口（页面/组件） | 状态 |
|---|--------|---------------|----------------------|------|
| 1 | `dictionary_full`（读取视图） | `db/search.js` · `AppContext.jsx`(loadDictFromDB) | 首页搜索、词条详情 `WordDetailPage`、单词本查词 | ✅ 已覆盖（只读视图，综合映射 dictionary+word_freqs+word_sources，不重建） |
| 2 | `dictionary`（基表，视图数据源） | `db/search.js`(addDictionaryWord 审批入库) | 审批通过后写回主词典 | ✅ 已覆盖（写入落基表，视图自动反映） |
| 3 | `sentences` | `db/sentences.js` | `PhrasesSection`（短语库）· `PhraseDetailSection`/`SentenceDetailView` | ✅ 已覆盖 |
| 4 | `community_words` | `db/community.js` | `UnknownWordPage`（AI 生成词条）· 审批中心 | ✅ 已覆盖 |
| 5 | `daily_picks` | `db/daily-picks.js` | 首页「每日一词/一句」`HomePage` | ✅ 已覆盖 |
| 6 | `system_config` | （无 app 代码引用） | — | ⚪ **后端 only**：AI 密钥改由 `user_api_keys` + Edge Function 环境变量承载，按设计不开放前端 |
| 7 | `user_bookmarks` | `db/bookmarks.js` | `WordDetailPage` 收藏按钮 | ✅ 已覆盖 |
| 8 | `user_recent_words` | `db/recent.js` | 单词本「最近」Tab `WordBookPage` | ✅ 已覆盖 |
| 9 | `user_folders` | `db/folders.js` | 单词本「单词夹/句子夹」 | ✅ 已覆盖 |
| 10 | `user_folder_words` | `db/folders.js` | 单词本「单词夹」 | ✅ 已覆盖 |
| 11 | `user_folder_sentences` | `db/folders.js` | 句子详情「加入句子夹」· 单词本「句子夹」 | ✅ 已覆盖 |
| 12 | `user_learning_plans` | `db/learning.js` | 学习 →「调整学习计划」`AdjustPlanSection` | ✅ 已覆盖（落库已对齐 `daily_minutes`+`plan` JSONB） |
| 13 | `user_learning_progress` | `db/learning.js` · `db/checkin.js` | 学习中心统计 `StatsSection` · 今日打卡 | ✅ 已覆盖 |
| 14 | `user_notes` | `db/notes.js` | 笔记列表 `NotesDetailSection` · 编辑器 `NoteEditorSection` | ✅ 已覆盖 |
| 15 | `user_settings` | `db/settings.js` | 「我的」→ 设置 `SettingsSection` | ✅ 已覆盖 |
| 16 | `user_sentence_bookmarks` | `db/sentences.js` | 句子详情星标 `SentenceDetailView` · 短语卡片星标 `PhrasesSection` | ✅ 已覆盖（动作存在；**无独立"我的收藏句子"列表页**，但"句子夹"机制已覆盖保存需求，详见 §3） |
| 17 | `user_api_keys` | `db/api-keys.js` | 「我的」→ API 密钥 `ApiKeysSection` | ✅ 已覆盖 |
| 18 | `user_checkin_tasks` | `db/checkin.js` | 调整计划 `AdjustPlanSection` · 学习中心今日打卡 `LearnPage` | ✅ 已覆盖 |
| 19 | `user_checkin_completions` | `db/checkin.js` | 学习中心「今日打卡」`LearnPage` | ✅ 已覆盖 |
| 20 | `otp_codes` | `db/auth.js`（走 Edge Function） | 登录页 OTP 登录/重置 `LoginPage` | ✅ 已覆盖（由 `send-otp`/`verify-otp` Edge 函数管理） |

## 2. 文档 7 个 RPC → 新系统映射

| RPC | 调用位置 | 状态 |
|-----|---------|------|
| `search_words_zh(search_term, max_results)` | `db/search.js` → 中文模糊搜 | ✅ 已建 |
| `get_random_word()` | 首页每日一词（经 `daily_picks` 驱动；RPC 存在可选） | ✅ 已建 |
| `get_random_sentence()` | `db/sentences.js` | ✅ 已建 |
| `create_default_folders(p_user_id)` | 注册时建默认文件夹（`folders.js` 关联） | ✅ 已建 |
| `check_otp_rate_limit(p_email)` | `send-otp` Edge（60s 限频） | ✅ 已建 |
| `cleanup_expired_otps()` | `send-otp` Edge 清理 | ✅ 已建 |
| `search_community_words(search, max_results)` | 代码已改为 `db/community.js` 内联 `or ilike`，保留以兼容文档 | ✅ 已建（兼容） |

## 3. 缺口与处理说明

### 3.1 真正的"前端缺口"：无
文档 20 表中，**18 张表均已具备前端入口**；剩余 2 张（`system_config` 后端配置、`dictionary_full` 视图定义本身）按架构本就不需要/不允许前端直接改。
→ **按本次指令"若发现数据在新系统中没有前端入口则补"，结论为：无需新增前端入口。**

### 3.4 用户新增词/句并入 `dictionary_full` 映射（按最新要求）
- **用户新增【词】**：存于 `community_words`（社区共建/AI 生成词条）。
  - 现状：`search.js` 已单独查 `community_words` 并在前端与 `dictionary_full` 结果合并、按词去重 → 用户新增词**已可被搜到、进词条详情**。
  - 进阶（可选，见 `migrations/03-extend-dictionary-full.sql`）：把 `community_words` 以 `UNION ALL` 并入 `dictionary_full` 视图，使前端只查一个视图即可。该脚本为安全模板，**必须先用你真实库的视图定义（`pg_get_viewdef`）定稿**，绝不盲改既有视图。
- **用户新增【句子】**：句子与词结构不同，不进 `dictionary_full` 词视图。
  - 现状：`sentences` 表为句子统一来源，`db/sentences.js` 读取；用户新增句子落 `sentences`（建议带 `user_id`/`origin` 标记）或独立 `user_sentences` 表，由 `sentences.js` 在查询层 `UNION`。
  - 需你确认：用户新增句子具体落在哪张表（现有 `sentences`？还是另有 `user_sentences`？），我据此补 `sentences.js` 的合并查询。

### 3.2 软缺口（可选增强，未必要做）
- **`user_sentence_bookmarks` 无独立列表页**：用户可"星标收藏句子"（动作已接），但页面里只有"句子夹"（folder 机制）能列出已存句子，没有专门展示"我星标的句子"的列表。
  - 现状：单词本"句子夹" Tab 已覆盖"保存/查看句子"需求，故不是硬缺口。
  - 可选：若希望有"我的收藏句子"独立入口，可在单词本新增一个 Tab 调用 `getSentenceBookmarks` 渲染列表。需你确认是否要加。

### 3.3 文档未列、但新系统已实现（超集，已建表）
| 新表 | db 文件 | 前端入口 |
|------|--------|---------|
| `user_achievements` | `db/achievements.js` | `AchievementsSection`（成就） |
| `user_roles` | `db/roles.js` | `AdminManagementSection`（角色/权限） |
| `pending_approvals` | `db/approvals.js` | `ApprovalCenterSection`（审批中心） |
| `user_diaries` / `user_diary_images` | `db/diaries.js` | `DiaryList`/`DiaryEditor`/`DiaryDetail`（学习日记） |
| `user_practice_records` / `user_practice_wrong` | `db/practice.js` | `PracticeSection`（练习/测验） |
| `word_books` / `user_word_book_progress` | `db/wordbooks.js` | 单词本「单词书」Tab |

## 4. 列定义对齐要点（避免运行时列缺失）
- `user_checkin_tasks.task_types text[]` + 兼容列 `task_type text`（代码 `normalizeTypes` 取 `task_types[0]`）。
- `user_learning_plans.daily_minutes int` + `plan jsonb`（代码 `saveLearningPlan` 已对齐，LearnPage 读 `plan?.daily_minutes`）。
- `user_notes.tags text[]`（代码注释提示上线前 `ALTER TABLE ADD COLUMN tags text[]`；本 SQL 已直接建好）。
- `user_folder_words/_sentences` 通过 `folder_id` 外键 + RLS（文件夹归属）鉴权（文档 Bug A-1）。
- 所有用户表 `user_id UUID REFERENCES auth.users ON DELETE CASCADE` + `user_id = auth.uid()` RLS。

## 5. 上线执行顺序（阶段 6）
1. 在 Supabase 项目 `zvemahqskgluhirzbcqu` 执行 `supabase/migrations/01-create-schema.sql`（建表 + RPC + RLS）。
2. 执行 `supabase/migrations/00-fix-known-bugs.sql`（幂等补强 RLS/RPC，本 SQL 已含其主体）。
3. 配置 Next.js 环境变量 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（Vercel Dashboard）。
4. `isSupabaseConfigured` 自动切换为真实后端，mock 层退出。
