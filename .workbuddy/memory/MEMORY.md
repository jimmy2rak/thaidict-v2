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
下一步：阶段 6（接 Supabase + Vercel，需建 `user_roles`/`pending_approvals` 表 + 4 个 `app/api/*` Route Handlers）。
