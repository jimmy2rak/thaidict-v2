# 中泰词典 ThaiDict · 项目长期记忆

Next.js 14 App Router + React 18（JSX，非 TS）。当前本地 mock 阶段，阶段6 接 Supabase + Vercel 上线。进度/目录树/Bug 状态见 `todo.md`。

## 运行
- 双击 `启动中泰词典.command`；或 `npm install && npm run dev` → http://localhost:3000（端口 3000）。
- dev 用 `.next-dev`、build 用 `.next`，启动脚本自动清 `.next-dev`。

## 技术栈
6 个运行时依赖：next / @supabase/supabase-js / lucide-react / react / react-dom / recharts。样式用 CSS 变量 + 内联；图表 recharts；分词 `src/utils/thaiToken.ts`；朗读 `src/utils/tts.js`。

## 架构铁律
1. 数据层单一入口：页面只 import `src/lib/db/*`。
2. mock/真实自动切换：`isSupabaseConfigured` 看 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` 是否存在。
3. 无路由库：状态驱动（4 标签页 + 3 浮层 + navStack）。
4. 子页面在 `src/screens/subsections/`，引用通用组件用 `../../components/`。
5. mock 存储：用户私有 `getUserColl/setUserColl`；全局用 `getGlobal/setGlobal`。
6. 权限 `super_admin>admin>user`；AI 词条→`pending_approvals`→审批后入主词典。
7. 打卡任务 `task_types` 为数组（多选：word/grammar/reading/listening/speaking/writing + 自定义字符串）；`task_type` 为兼容单值=数组首个。类型常量见 `src/lib/taskTypes.js`（`TASK_TYPES`/`typeLabel`/`typeLabels`），LearnPage 与 AdjustPlanSection 共用。
8. **【关键·词典读取】`dictionary_full` 是用户真实库里已存在的【视图】（Supabase 表编辑器"小眼睛"图标），本身不存数据，综合映射 `dictionary` 基表 + `word_freqs` 词频表 + `word_sources` 来源表成每词一行。代码【只读】`dictionary_full`（查词/词条详情/分词词典加载）；【写入】审批入库落基表 `dictionary`（视图自动反映）。⚠️ 绝不 DROP/重建/覆盖该视图——要扩展用户新增词进映射，用 `supabase/migrations/03-extend-dictionary-full.sql` 的 `UNION ALL` 方案（须先用 `pg_get_viewdef` 定稿）。

## 设计系统（2026-07-14 新中式奶油·克制版 · 全局低饱和）
- 底色 `--c-bg #F8F5EF`、卡面 `--c-surface #FEFDFB`、文字 `--c-p800 #433B32`。
- 主色（主题色）`--c-primary #A68A5B`（暖褐金，全站强调/激活态统一用此棕）。
- 功能点缀色（均低饱和、克制、无荧光绿/蓝）：
  `--c-teal #8FA98C`（鼠尾草绿）/ `--c-gold #D4A84A`（浅金）/ `--c-rose #D36B58`（珊瑚陶土）/
  `--c-info #6E8CA0`（雾霭蓝灰）/ `--c-amber #CBA14A`（暗琥珀）。
- 圆角：Card `--radius-md 18px`、内边距 `12px 14px`；按钮 primary 实线描边 / secondary 虚线描边。
- 底部 Tab 彩色：home=teal / words=info / learn=gold / me=rose（`src/App.jsx` `TABS.color`）。
- 装饰：`src/components/Decorations.jsx`（佛塔/粽叶/碗盏）。
- ⚠️ 已落地配色约定：单词本分类 Tab 激活、学习中心「今日打卡」进度环/完成圈/「一键完成」、近7天热力条、MiniStat「已打卡」均用主题棕 `--c-primary`；词条详情 3 按钮=加入文件夹(棕)/词形分析(蓝灰)/笔记(陶土红)，近义(绿)/反义(陶土红)/学习者(金)。
- 改全局色时勿动 `--c-primary/--c-gold/--c-rose`（调整计划、一词多义依赖，保持原样）。

## 踩坑（别再犯）
- React TDZ：hooks 依赖的派生 const 必须声明在所有 hooks 之前。
- 路径含中文「开发者」，别误拼 developer。
- Next 全量客户端渲染：`page.jsx` `'use client'` import AppShell；AppShell 用 `mounted` 守卫，不要用 `dynamic(ssr:false)`。
- Next dev 红遮罩假死：点不动先查 console 的 `is not a function`；`next build` 无此遮罩。
- `import.meta` 在 Next 不可用 → `process.env.NEXT_PUBLIC_*`。
- 静默无限重渲染：effect 依赖别放每次新对象（用 `useMemo` 稳定）。
- 白屏 404：dev/build 共用 `.next` 会污染 → distDir 分离。
- favicon 用 SVG 消除 `/favicon.ico` 404；viewport 已移除 `maximumScale`/`user-scalable`。

## 阶段进度
阶段 1~3.6 ✅；阶段 4 ✅（A~G Bug 核对完成）；阶段 5 ✅（新中式奶油风格改造 + 补强：紧凑卡片、Tab 彩色、配色调鲜艳淡背景、学习中心打卡/调整计划、学习笔记联动）。
下一步：阶段 6（接 Supabase + Vercel）。**Supabase 数据库映射已完成**：
- `supabase/migrations/01-create-schema.sql`：建 20 文档表 + 9 新表 + 8 RPC + RLS + 唯一约束 + 索引（纯结构 DDL，不碰数据）。
- `supabase/DATABASE_MAPPING.md`：文档 20 表 → 新系统 db 文件 + 前端页 + 缺口结论。
- 关键发现：文档 20 表前端入口新系统基本全覆盖（仅 `system_config` 后端only、`dictionary` 旧表并入 `dictionary_full` 不需前端）；新系统反是超集（成就/角色/审批/日记/练习/单词书）。
- 环境变量用 Next.js 的 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`（非文档写的 Vite `VITE_*`，已在 `src/lib/supabase.js` 实现）。
- ⚠️ **上线顺序（按库状态二选一，切勿混用）**：
  - **已有库（你现在是这种，31 张表+6万词）**：跑 `02-sync-existing.sql` → `03-extend-dictionary-full.sql`（建 `dictionary_full_ext` 统一视图）→ `00-fix-known-bugs.sql`（均幂等）→ 配 Vercel 环境变量 → `isSupabaseConfigured` 自动切换真实后端。
  - **全新空库（仅首次从零建库时）**：跑 `01-create-schema.sql` → `00-fix-known-bugs.sql`。
  - **已有库绝不可跑 `01`**：01 给空库设计，其 policy 为「先 `drop policy if exists` 再 `create policy`」的裸建形式（非 `if not exists`），在已有库若同名策略已存在会冲突中断、留半成品。✅ **02 已全量修正为安全写法**：policy = 先 `drop policy if exists` 再 `create policy`；表/列/函数/视图分别用 `create table if not exists`/`add column if not exists`/`drop function if exists`+`create or replace`/`create or replace view`，全程零 DML，对 6 万词安全。⚠️ **关键坑（本轮翻车点）**：**PostgreSQL 的 `CREATE POLICY` 不支持 `IF NOT EXISTS` 语法**，误用会报 `42601: syntax error at or near "not"`；统一用「先删后建」替代。
  - 两个脚本均**纯 DDL、无任何 INSERT/UPDATE/DELETE**，不会动 62101 词。
- 软缺口（未做）：`user_sentence_bookmarks` 无独立"我的收藏句子"列表页（句子夹 folder 已覆盖），待用户确认是否加。

## 部署 / 环境变量（2026-07-14 落地）
- **GitHub 仓库**：`https://github.com/jimmy2rak/thaidict-v2`（已 push，main 跟踪 origin/main）。`gh` 已登录 jimmy2rak。
- **Supabase 项目 ref**：`zvemahqskgluhirzbcqu`（URL 仅到根域名，勿带 `/rest/v1/`）。站点域名 `thaidict.182183.xyz`。
- **`.env.local` 已落地**（gitignored，密钥未进 GitHub）：7 个变量全部填好，URL 已自动清理后缀。沙箱禁外网出网，无法 live 校验，待 Vercel 构建后由真实环境验证。
- **Vercel**：Next.js 自动识别，无需 vercel.json。环境变量经 `.env.local`（gitignored）导入：Dashboard → Settings → Environment Variables → Import from .env，或 `scripts/import-env.sh`（`vercel env import`）。
- **Brevo 邮件架构决策**：原 `auth.js` 真实模式调不存在的 Supabase Edge Function（`/functions/v1/send-otp`）。改为 **Next.js Route Handler**（`app/api/send-otp`、`app/api/verify-otp`），Brevo 密钥作为 **Vercel 环境变量**，故 `.env.local` 必须含 Brevo 三项。
- **必需环境变量清单**：
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（前端，切换真实后端）/
  `SUPABASE_SERVICE_ROLE_KEY`（仅服务端写 `otp_codes`）/
  `NEXT_PUBLIC_SITE_URL`（OAuth/Magic Link 回调）/
  `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME`。
- 服务端 supabase 客户端：`src/lib/supabaseServer.js`（`getServerSupabase`，service_role，无 session）；Brevo 发送：`src/lib/brevo.js`（`sendBrevoEmail`）。
- 注意：`vercel` CLI 未安装；Vercel 部署建议用户在 Dashboard 导入 GitHub 仓库 + 上传 `.env.local`，比 CLI 省事。
