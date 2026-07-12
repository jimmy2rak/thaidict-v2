# 文档2：全量 Bug 汇总 + 触发条件 + 问题根因 + 修复方案

## 分类索引

- A. 数据库 / RLS 安全 Bug（5条）
- B. 前端逻辑 Bug（6条）
- C. 数据一致性 Bug（4条）
- D. 鉴权 / OAuth Bug（3条）
- E. 移动端适配 Bug（2条）
- F. Edge Function Bug（3条）
- G. 架构缺陷（4条）

---

## A. 数据库 / RLS 安全 Bug

### Bug A-1：user_folder_sentences 表 RLS 仍为 anon（未升级至 JWT）

**【Bug现象】** `user_folder_sentences` 表的 RLS 策略仍为 `USING (true)`（任何人可读写），而所有其他用户表已在 `rls_upgrade_uuid.sql` 中升级为 `auth.uid()` 鉴权。

**【复现步骤】**
1. 在 Supabase Dashboard → Authentication → Policies 查看 `user_folder_sentences` 表
2. 发现策略为 `anon_select_folder_sentences` 等，条件均为 `true`

**【问题根源】** `20260615_add_sentence_folders.sql` 创建该表时使用的是 anon 策略，而 `rls_upgrade_uuid.sql` 中遗漏了此表的 JWT 升级。

**【修复方案】** 在 Supabase Dashboard SQL Editor 执行：
```sql
-- 删除旧 anon 策略
DROP POLICY IF EXISTS "anon_select_folder_sentences" ON user_folder_sentences;
DROP POLICY IF EXISTS "anon_insert_folder_sentences" ON user_folder_sentences;
DROP POLICY IF EXISTS "anon_update_folder_sentences" ON user_folder_sentences;
DROP POLICY IF EXISTS "anon_delete_folder_sentences" ON user_folder_sentences;

-- 创建 JWT-based 策略（通过 folder 归属验证）
CREATE POLICY "user_select_folder_sentences" ON user_folder_sentences
  FOR SELECT TO authenticated
  USING (folder_id IN (SELECT id FROM user_folders WHERE user_id = auth.uid()));
CREATE POLICY "user_insert_folder_sentences" ON user_folder_sentences
  FOR INSERT TO authenticated
  WITH CHECK (folder_id IN (SELECT id FROM user_folders WHERE user_id = auth.uid()));
CREATE POLICY "user_delete_folder_sentences" ON user_folder_sentences
  FOR DELETE TO authenticated
  USING (folder_id IN (SELECT id FROM user_folders WHERE user_id = auth.uid()));
```

---

### Bug A-2：user_api_keys 表无 CREATE TABLE 迁移脚本

**【Bug现象】** `supabase.js` 中 `getApiKeys`、`saveApiKey`、`deleteApiKey` 三个函数操作 `user_api_keys` 表，`rls_upgrade_uuid.sql` 也引用此表（条件性 ALTER），但整个 `supabase/` 目录中无此表的 CREATE TABLE 语句。

**【复现步骤】**
1. 在全新 Supabase 项目中运行所有迁移脚本
2. 进入 ProfilePage → API 密钥管理 → 尝试保存密钥
3. 报错：`relation "user_api_keys" does not exist`

**【问题根源】** 该表可能在早期开发中通过 Dashboard 手动创建，但未纳入迁移脚本。

**【修复方案】** 新增迁移脚本或直接在 SQL Editor 执行：
```sql
CREATE TABLE IF NOT EXISTS user_api_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'openai',
  key TEXT NOT NULL,
  base_url TEXT DEFAULT '',
  model TEXT DEFAULT 'gpt-4o',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON user_api_keys(user_id);
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_api_keys" ON user_api_keys
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_insert_api_keys" ON user_api_keys
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_delete_api_keys" ON user_api_keys
  FOR DELETE TO authenticated USING (user_id = auth.uid());
```

---

### Bug A-3：user_sentence_bookmarks 的 user_id 类型不一致

**【Bug现象】** `phase5_add_rpcs_and_sentences.sql` 创建 `user_sentence_bookmarks` 时 `user_id` 为 `TEXT` 类型，但 `rls_upgrade_uuid.sql` 将其 ALTER 为 `UUID`。如果用户先运行 phase5 再运行 rls_upgrade，中间状态可能导致类型冲突。

**【复现步骤】**
1. 运行 `phase5_add_rpcs_and_sentences.sql` → user_id 为 TEXT
2. 运行 `rls_upgrade_uuid.sql` → TRUNCATE + ALTER TYPE UUID
3. 如果中间有新数据插入（TEXT 格式的 UUID 字符串），TRUNCATE 会清除

**【问题根源】** 迁移脚本之间缺少执行顺序说明和原子性保证。

**【修复方案】** 在 `phase5_add_rpcs_and_sentences.sql` 中直接将 `user_id` 定义为 `UUID`：
```sql
CREATE TABLE IF NOT EXISTS user_sentence_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 改为 UUID
  sentence_id BIGINT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sentence_id)
);
```

---

### Bug A-4：community_words RLS INSERT 策略对 anon 用户开放

**【Bug现象】** `community_words` 表的 INSERT 策略为 `auth_users_can_insert_community_words ... WITH CHECK (true)`，未限制为 `authenticated` 角色。匿名用户可以AI生成的方式写入社区词库。

**【复现步骤】**
1. 不登录，直接使用搜索功能
2. 搜索一个不存在的词 → 触发 `saveCommunityWord`（如果前端未做登录检查）

**【问题根源】** `community_words_and_daily_picks.sql` 中策略定义：
```sql
CREATE POLICY "auth_users_can_insert_community_words"
  ON community_words FOR INSERT
  WITH CHECK (true);  -- 缺少 TO authenticated
```

**【修复方案】**
```sql
DROP POLICY IF EXISTS "auth_users_can_insert_community_words" ON community_words;
CREATE POLICY "auth_users_can_insert_community_words"
  ON community_words FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

---

### Bug A-5：create_default_folders RPC 的 user_id 参数仍为 TEXT

**【Bug现象】** `create_default_folders(p_user_id TEXT)` 函数参数类型为 TEXT，但 `user_folders.user_id` 已在 `rls_upgrade_uuid.sql` 中升级为 UUID。传入 UUID 字符串时 PostgreSQL 会隐式转换，但如果传入非 UUID 格式的 TEXT 则会报错。

**【问题根源】** `20260615_add_sentence_folders.sql` 创建 RPC 时定义为 TEXT，未随后续 UUID 迁移更新。

**【修复方案】**
```sql
CREATE OR REPLACE FUNCTION create_default_folders(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO user_folders (user_id, name, color, folder_type)
  VALUES (p_user_id, '我的单词', '#5B8C7E', 'word')
  ON CONFLICT DO NOTHING;
  INSERT INTO user_folders (user_id, name, color, folder_type)
  VALUES (p_user_id, '我的句子', '#C4993D', 'sentence')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

---

## B. 前端逻辑 Bug

### Bug B-1：recordWordLookup 不会递增 lookup_count

**【Bug现象】** `recordWordLookup` 函数首次查词使用 upsert 插入 `lookup_count: 1`，后续再查同一个词时 upsert 冲突会触发 `onConflict`，但 upsert 的 SET 部分仍然是 `lookup_count: 1`（不会递增）。catch 分支中的 update 也只更新 `looked_up_at`，不递增 count。

**【复现步骤】**
1. 搜索同一个词 3 次
2. 查看 `user_recent_words` 表 → `lookup_count` 始终为 1

**【问题根源】** `supabase.js` 第 441-462 行：
```js
.upsert(
  { user_id: userId, word, looked_up_at: new Date().toISOString(), lookup_count: 1 },
  { onConflict: 'user_id,word' }
)
```
upsert 在冲突时执行的是全量覆盖，不会自动递增。

**【修复方案】**
```js
export async function recordWordLookup(userId, word) {
  if (!supabase || !userId || !word) return null
  // 先尝试 update（递增）
  const { data: existing } = await supabase
    .from('user_recent_words')
    .select('lookup_count')
    .eq('user_id', userId).eq('word', word)
    .single()
  if (existing) {
    await supabase.from('user_recent_words')
      .update({
        looked_up_at: new Date().toISOString(),
        lookup_count: (existing.lookup_count || 0) + 1
      })
      .eq('user_id', userId).eq('word', word)
  } else {
    await supabase.from('user_recent_words')
      .insert({ user_id: userId, word, looked_up_at: new Date().toISOString(), lookup_count: 1 })
  }
}
```

---

### Bug B-2：handleWordTap 并发竞态——多次快速点击触发重复查询

**【Bug现象】** 在句子详情页快速点击多个未知词条时，`handleWordTap` 会被并发调用多次，每次都触发 `setDetailLoading(true)` + DB 查询，导致：
1. 多个并行 `getWordByThai` 请求
2. `detailLoading` 状态闪烁
3. 可能覆盖已设置的 `dbWordData`

**【复现步骤】**
1. 进入句子详情页
2. 快速连续点击 3 个高亮单词

**【问题根源】** `AppContext.jsx` 第 391-412 行，`handleWordTap` 无防抖/互斥机制。

**【修复方案】** 添加 in-flight Map 防止重复查询：
```js
const pendingLookups = useRef(new Set())

const handleWordTap = async (word) => {
  if (!word || pendingLookups.current.has(word)) return
  // ... existing checks ...
  pendingLookups.current.add(word)
  setDetailLoading(true)
  try {
    const row = await getWordByThai(word)
    // ... process result ...
  } finally {
    pendingLookups.current.delete(word)
    setDetailLoading(false)
  }
}
```

---

### Bug B-3：getDictionaryCount 查询 `dictionary` 表而非 `dictionary_full`

**【Bug现象】** `HomePage` 显示词典总数时调用 `getDictionaryCount()`，该函数查询的是 `dictionary` 表（旧版），而实际搜索使用的是 `dictionary_full` 表。两表数据量可能不同。

**【问题根源】** `supabase.js` 第 1075-1083 行：
```js
export async function getDictionaryCount() {
  const { count } = await supabase
    .from('dictionary')  // ← 应为 dictionary_full
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_status', 'enriched')
}
```

**【修复方案】** 将 `'dictionary'` 改为 `'dictionary_full'`。

---

### Bug B-4：refreshDailyPick 在 anon 状态下写入会失败

**【Bug现象】** `refreshDailyPick` 函数尝试 upsert `daily_picks` 表，但该表的写入策略为 `service_can_manage_daily_picks`（需要 service_role）。前端使用 anon key 调用，写入会被 RLS 拒绝。

**【复现步骤】**
1. 登录用户点击首页「换一批」刷新每日推荐
2. `refreshDailyPick` 执行 upsert → 被 RLS 拒绝（静默失败）
3. 推荐数据在内存中更新成功，但未持久化到数据库

**【问题根源】** `daily_picks_v2.sql` 中写入策略设计为仅 service_role 可写，但前端直接调用 upsert。

**【修复方案】** 二选一：
- 方案A：创建 Edge Function `refresh-daily-pick` 使用 service_role 写入
- 方案B：新增 RLS 策略允许 authenticated 用户写入：
```sql
CREATE POLICY "authenticated_can_refresh_daily_picks"
  ON daily_picks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_can_update_daily_picks"
  ON daily_picks FOR UPDATE TO authenticated USING (true);
```

---

### Bug B-5：saveUserSettings 存在 read-then-upsert 竞态

**【Bug现象】** `saveUserSettings` 先读取现有设置，合并后再 upsert。如果两个设置项几乎同时保存（如用户快速切换多个选项），后一个写入可能覆盖前一个的更改。

**【问题根源】** `supabase.js` 第 1013-1033 行的 read-then-write 模式。

**【修复方案】** 使用 PostgreSQL 的 `COALESCE` 在数据库层合并：
```js
export async function saveUserSettings(userId, settings) {
  // 直接 upsert，让数据库处理合并
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ ...settings, user_id: userId, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' })
    .select()
    .single()
  // ...
}
```
注意：这要求前端每次传入完整的 settings 对象，或改用 RPC 函数在数据库层做 partial update。

---

### Bug B-6：toggleCheckinTaskCompletion 的 study_minutes 更新存在竞态

**【Bug现象】** 打卡任务完成时，先读取当前 `study_minutes`，然后加上 `duration_minutes` 写回。如果同时有多个操作，会导致数据丢失。

**【问题根源】** `supabase.js` 第 1604-1663 行的 read-then-write 模式。

**【修复方案】** 使用 RPC 函数在数据库层原子操作：
```sql
CREATE OR REPLACE FUNCTION add_study_minutes(
  p_user_id UUID, p_date DATE, p_minutes INT
) RETURNS void AS $$
BEGIN
  INSERT INTO user_learning_progress (user_id, date, study_minutes)
  VALUES (p_user_id, p_date, p_minutes)
  ON CONFLICT (user_id, date)
  DO UPDATE SET study_minutes = user_learning_progress.study_minutes + p_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## C. 数据一致性 Bug

### Bug C-1：daily_picks v2 的 daily_word_id 为 TEXT，引用 dictionary_full.word

**【Bug现象】** `daily_picks_v2` 中 `daily_word_id` 为 TEXT 类型，存储的是 `dictionary_full.word`（泰语文本）。如果词典中某个词被修改/删除，daily_picks 中的引用变成悬空引用。

**【问题根源】** 设计选择——用文本引用而非外键。`fetchWordByText` 有 fallback 到 `community_words`，但如果两处都找不到则返回 null。

**【修复方案】** 这是设计权衡（避免外键约束限制词典更新），当前可接受。建议在 `loadDailyPick` 中增加更完善的 fallback：如果今日推荐找不到，自动调用 `refreshDailyPick` 生成新推荐。

---

### Bug C-2：community_words 的 UNIQUE 索引使用 LOWER(word)，但 upsert 使用 word

**【Bug现象】** `community_words` 表的唯一索引为 `idx_community_words_word ON community_words (LOWER(word))`，但 `saveCommunityWord` 的 upsert 使用 `onConflict: 'word'`（非 LOWER）。

**【复现步骤】**
1. 保存社区词 "กิน"（小写）
2. 再保存 "กิน"（相同）→ 可能因大小写差异导致冲突检测失败

**【问题根源】** 索引和 upsert conflict column 不一致。

**【修复方案】** 统一使用 `word` 列（不加 LOWER）作为唯一约束，或在 upsert 时显式 LOWER：
```js
.from('community_words')
.upsert({ ...row, word: row.word.toLowerCase() }, { onConflict: 'word' })
```

---

### Bug C-3：user_settings 的 user_id 类型为 TEXT（主键），但 RLS 使用 auth.uid()（UUID）

**【Bug现象】** `user_settings` 表创建时 `user_id TEXT PRIMARY KEY`，`rls_upgrade_uuid.sql` 将其 ALTER 为 UUID。但 `saveUserSettings` 中的 merge 逻辑先读取再 upsert，如果 user_id 类型不匹配会导致创建重复行。

**【问题根源】** 迁移脚本 `20260614_create_user_data_tables.sql` 中 `user_settings` 定义为 TEXT，后续通过 ALTER 改为 UUID。

**【修复方案】** 在初始建表脚本中直接使用 UUID：
```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ...
);
```

---

### Bug C-4：getFolders 的 count 查询返回格式依赖 Supabase 版本

**【Bug现象】** `getFolders` 使用嵌套 count 查询 `word_count:user_folder_words(count)`，返回格式为 `f.word_count?.[0]?.count`。Supabase JS v2 的嵌套 count 返回格式可能因版本不同而变化。

**【问题根源】** `supabase.js` 第 466-478 行。

**【修复方案】** 添加防御性解析：
```js
const wordCount = Array.isArray(f.word_count)
  ? f.word_count[0]?.count ?? 0
  : (typeof f.word_count === 'number' ? f.word_count : 0)
```

---

## D. 鉴权 / OAuth Bug

### Bug D-1：OAuth 回调路径 `/auth/callback` 无处理逻辑

**【Bug现象】** `signInWithOAuth` 设置 `redirectTo: window.location.origin + '/auth/callback'`，但 SPA 中没有 `/auth/callback` 路由处理。Vercel rewrites 会将此路径重定向到 `index.html`，但 App.jsx 会根据 `isLoggedIn` 状态决定显示 LoginPage 还是主界面。

**【复现步骤】**
1. 点击 Google/GitHub 登录
2. OAuth 完成后重定向回 `/auth/callback?code=xxx`
3. Supabase JS SDK 的 `onAuthStateChange` 应能自动处理 hash-based token
4. 但如果使用 `code` 参数（PKCE flow），需要手动 `exchangeCodeForSession`

**【问题根源】** Supabase v2 默认使用 PKCE flow，需要在前端处理 code 交换。

**【修复方案】** 在 `main.jsx` 的 `AuthProvider` 中添加 PKCE code 处理：
```js
useEffect(() => {
  const handleOAuthCallback = async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      await supabase.auth.exchangeCodeForSession(code)
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
    }
  }
  handleOAuthCallback()
}, [])
```

---

### Bug D-2：signUpWithEmail 不自动登录——注册后用户需手动登录

**【Bug现象】** `signUpWithEmail` 调用 `supabase.auth.signUp()`，如果 Supabase 未开启「自动确认」，用户需要先去邮箱点击确认链接，然后才能登录。但应用没有引导用户检查邮箱的 UI。

**【复现步骤】**
1. 在 LoginPage 输入新邮箱和密码注册
2. 注册成功但 session 为 null（邮箱未确认）
3. 页面仍显示登录表单，无任何提示

**【问题根源】** Supabase Dashboard 默认开启邮箱确认，但应用未处理确认流程。

**【修复方案】** 二选一：
- 方案A：在 Supabase Dashboard 关闭邮箱确认（Authentication → Settings → Enable "Disable email confirmation"）
- 方案B：注册成功后显示「请检查邮箱确认」提示 UI

---

### Bug D-3：sendMagicLink 的 redirectTo 指向根路径，无后续处理

**【Bug现象】** `sendMagicLink` 使用 `signInWithOtp` 发送 magic link，`redirectTo` 默认为当前页面。用户点击邮件中的链接后，Supabase 会将 token 附加到 URL，但 SPA 可能无法正确处理。

**【修复方案】** 同 Bug D-1，需要在应用启动时检查 URL 中的 token/code 参数。

---

## E. 移动端适配 Bug

### Bug E-1：动态 viewport height 在 iOS Safari 中仍有偏差

**【Bug现象】** `App.jsx` 通过 JS 设置 `--app-height` 来适配底部地址栏，但在 iOS Safari 中，地址栏的显示/隐藏会触发 `resize` 事件导致布局抖动。

**【问题根源】** `App.jsx` 第 144-155 行使用 `window.innerHeight`，在 iOS Safari 中不稳定。

**【修复方案】** 使用 CSS `dvh` 单位替代（现代浏览器支持）：
```css
height: 100dvh; /* 替代 var(--app-height) */
```
或使用 `visualViewport` API：
```js
const vv = window.visualViewport
vv.addEventListener('resize', () => {
  document.documentElement.style.setProperty('--app-height', `${vv.height}px`)
})
```

---

### Bug E-2：`user-scalable=no` 导致无障碍问题

**【Bug现象】** `index.html` 的 viewport meta 设置了 `maximum-scale=1.0, user-scalable=no`，阻止用户缩放页面，影响视障用户的无障碍体验。

**【修复方案】** 移除 `maximum-scale=1.0, user-scalable=no`，改用 CSS `touch-action` 属性控制特定区域的缩放行为。

---

## F. Edge Function Bug

### Bug F-1：ai-proxy 的 system_config 缓存无失效机制

**【Bug现象】** `ai-proxy/index.ts` 缓存 `system_config` 表的查询结果 5 分钟，但没有手动失效机制。修改 system_config 后需等待最多 5 分钟才能生效。

**【修复方案】** 添加 `Cache-Control` 响应头或在 system_config 表中增加 `updated_at` 字段，缓存时比对时间戳。

---

### Bug F-2：send-otp 的 Brevo API 错误未详细分类

**【Bug现象】** `send-otp` 函数在 Brevo API 调用失败时返回通用错误信息，不区分「邮箱不存在」「API key 无效」「频率限制」等不同情况。

**【修复方案】** 根据 Brevo 返回的 HTTP 状态码返回不同错误信息。

---

### Bug F-3：send-reminder 的 tasks 参数无验证

**【Bug现象】** `send-reminder` 函数接受 `tasks` 数组但未验证其结构，恶意调用可传入超大数组导致邮件模板渲染异常。

**【修复方案】** 添加输入验证：限制 tasks 数组最大长度（如 20），验证每个 task 包含 `name` 和 `completed` 字段。

---

## G. 架构缺陷

### Bug G-1：supabase.js 单文件 1923 行，88 个导出函数

**【Bug现象】** 所有数据库操作、auth 函数、AI 代理、数据转换逻辑集中在一个文件中，难以维护和测试。

**【修复方案】** 拆分为模块化文件：
```
src/lib/
├── supabase.js          # 客户端初始化 + 导出（~20行）
├── db/
│   ├── search.js        # searchWords, getWordByThai, transformWordData
│   ├── bookmarks.js     # getBookmarks, addBookmark, removeBookmark
│   ├── folders.js       # getFolders, createFolder, getFolderWords...
│   ├── sentences.js     # getDailySentence, bookmarkSentence...
│   ├── learning.js      # getLearningPlan, getLearningProgress...
│   ├── checkin.js       # getCheckinTasks, toggleCheckinTaskCompletion...
│   ├── settings.js      # getUserSettings, saveUserSettings
│   ├── api-keys.js      # getApiKeys, saveApiKey, deleteApiKey
│   ├── community.js     # saveCommunityWord, transformCommunityWord
│   ├── daily-picks.js   # loadDailyPick, refreshDailyPick
│   └── auth.js          # signInWithEmail, signUpWithEmail, signInWithOAuth...
├── ai-proxy.js          # callAiProxy
└── utils.js             # getTodayCST, getCSTWeekday（getDateCST 当前为内部函数，需提取导出）
```

---

### Bug G-2：ProfilePage.jsx 897 行——单页面过大

**【Bug现象】** ProfilePage 包含设置、API 密钥管理、WebDAV 配置、头像上传、字体设置、提醒设置等所有功能，单文件 897 行。

**【修复方案】** 拆分为 subsection 组件：
```
src/pages/subsections/
├── ApiKeysSection.jsx     # API 密钥 CRUD
├── WebDavSection.jsx      # WebDAV 配置
├── AvatarSection.jsx      # 头像上传
├── AppearanceSection.jsx   # 主题/字体设置
└── AccountSection.jsx     # 账号信息/退出登录
```

---

### Bug G-3：无错误日志收集机制

**【Bug现象】** 所有 `console.error` 仅在浏览器控制台输出，无集中错误日志收集。生产环境中用户遇到的问题无法被开发者感知。

**【修复方案】** 集成轻量错误监控（如 Sentry free tier），或创建 `error_logs` 表记录前端错误。

---

### Bug G-4：thaiSegment 分词词典加载无版本控制

**【Bug现象】** `loadDictFromDB` 在应用启动时从 `dictionary_full` 加载所有泰语词条到内存用于分词，但无版本号或时间戳判断是否需要重新加载。如果词典数据更新，用户需刷新页面才能获取最新分词词典。

**【修复方案】** 在 `dictionary_full` 表中维护 `updated_at` 字段，`loadDictFromDB` 比对本地缓存的版本号决定是否需要更新。
