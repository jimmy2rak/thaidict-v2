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

## 设计系统（2026-07-13 新中式奶油轻泰式极简）
- 底色 `--c-bg #F6F1E7`、卡面 `--c-surface #FCF9F2`、文字 `--c-p800 #423A31`。
- 主色 `--c-primary #9A8467`；功能色 `--c-teal #9FB08E` / `--c-gold #C2A878` / `--c-rose #C08A7A` / `--c-info #8FA3B0` / `--c-amber #C9A86A`。
- 圆角 `--radius-lg 24px`；按钮：primary 实线描边、secondary 虚线描边。
- 装饰：`src/components/Decorations.jsx`（佛塔/粽叶/碗盏）。旧色值已全局替换，新增代码勿用。

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
阶段 1~3.6 ✅；阶段 4 ✅（A~G Bug 核对完成）；阶段 5 ✅（新中式奶油风格改造完成）。
下一步：阶段 6（接 Supabase + Vercel，需建 `user_roles`/`pending_approvals` 表 + 4 个 `app/api/*` Route Handlers）。
