# 中泰词典 ThaiDict · 项目长期记忆

中泰双语词典网页应用（中文↔泰语）。Next.js 14 App Router + React 18（JSX，非 TS）。
当前=本地 mock 阶段（假数据存 localStorage），功能做完后阶段6 接 Supabase + Vercel 上线。
进度/目录树/全量 Bug 状态表见 `todo.md`。

## 运行
- 双击 `启动中泰词典.command`；或 `npm install && npm run dev` → http://localhost:3000（端口固定 3000）。
- dev 用 `.next-dev`、build 用 `.next`（`next.config.mjs` 按 NEXT_DIST_DIR 分目录），启动脚本自动清 `.next-dev`。

## 技术栈
6 运行时依赖：next / @supabase/supabase-js / lucide-react / react / react-dom / recharts。
样式=CSS变量+内联（非 Tailwind）；图表=recharts；分词=src/utils/thaiToken.ts（newmm,TS）；朗读=src/utils/tts.js。

## 架构铁律
1. 数据层单一入口：页面只 import `src/lib/db/*`，绝不直写 localStorage。
2. mock/真实自动切换：`supabase.js` 的 isSupabaseConfigured 看 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` 是否存在；配了走真实库、否则走 mock，页面零改动。
3. 无路由库：状态驱动（4 标签页 + 3 浮层 + navStack 前进后退）。
4. 子页面在 `src/screens/subsections/`（原 pages/ 改名避免被 Pages Router 误当路由预渲染）；引用通用组件用 `../../components/`。
5. mock 存储：用户私有 `getUserColl/setUserColl(userId,key)`；全局（单词夹内容）用 `getGlobal('__')/setGlobal`。
6. 权限 `roles.js`：super_admin>admin>user。AI 词条→`pending_approvals`→审批后写 `community_words` 并 `addDictionaryWord` 入主词典。

## 踩坑（别再犯）
- React TDZ：被 hooks 依赖引用的派生 const 必须声明在所有 hooks 调用之前。
- 路径含中文「开发者」，别误拼 developer。
- Next 全量客户端渲染：`page.jsx` 标 `'use client'` 直接 import AppShell；AppShell 用 `mounted` 守卫（`useState(false)`+`useEffect` 置 true），**不要用 `dynamic(ssr:false)`**。
- Next dev 全屏红遮罩会"假死"整页：点不动先查 console 的 `is not a function`；`next build` 无此遮罩。
- `import.meta` 在 Next 不可用 → 改 `process.env.NEXT_PUBLIC_*`。
- 静默无限重渲染会卡死无报错：effect 依赖别放每次渲染都新的对象（用 `useMemo` 稳定）。
- 白屏 404：dev/build 共用 `.next` 会污染 → distDir 分离。
- favicon 用 SVG 消除 `/favicon.ico` 404；viewport 已移除 `maximumScale/user-scalable`（Bug E-2 无障碍）。

## 阶段进度
阶段 1~3.6 ✅；阶段 4（A~G Bug 逐项核对）✅ 已完成（前端可复现项全规避，真实库项推迟阶段6，SQL 见 `supabase/migrations/00-fix-known-bugs.sql`）。
下一步：阶段 5（整体自测+政务OA风打磨）→ 阶段 6（接真实 Supabase，需建 `user_roles`/`pending_approvals` 表 + 4 个 `app/api/*` Route Handlers + Vercel）。
