/** @type {import('next').NextConfig} */
const nextConfig = {
  // 严格模式：开发期双重调用 effect，提前暴露副作用问题
  reactStrictMode: true,

  // 迁移过渡期：项目主体是 JS（仅 thaiToken.ts 为 TS），
  // 关闭构建期 TS 类型检查与 ESLint，避免迁移过程中被 lint/类型阻断。
  // 等全量改为 TS 后可移除此两项。
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
