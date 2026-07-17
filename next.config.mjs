/** @type {import('next').NextConfig} */
import { execSync } from 'child_process'

// 读取 git 信息，注入到前端环境变量，供「我的」页底部展示分支与哈希（每次推送自动反映）。
// 非 git 环境（如沙箱构建）降级为占位值，不阻断构建。
function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    return { hash: hash || 'unknown', branch: branch || 'unknown' }
  } catch {
    return { hash: 'dev', branch: 'local' }
  }
}

const git = getGitInfo()

const nextConfig = {
  // dev / build 使用不同缓存目录，避免 dev 时被 build 产物覆盖导致 404
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // 严格模式：开发期双重调用 effect，提前暴露副作用问题
  reactStrictMode: true,

  // 迁移过渡期：项目主体是 JS（仅 thaiToken.ts 为 TS），
  // 关闭构建期 TS 类型检查与 ESLint，避免迁移过程中被 lint/类型阻断。
  // 等全量改为 TS 后可移除此两项。
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // 注入到客户端的 git 元数据（NEXT_PUBLIC_* 在构建期被内联）
  env: {
    NEXT_PUBLIC_GIT_HASH: git.hash,
    NEXT_PUBLIC_GIT_BRANCH: git.branch,
  },
}

export default nextConfig
