const createNextIntlPlugin = require('next-intl/plugin');

// Next.js 15はプロジェクトルートのi18n.tsを優先的に探す
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  // i18n設定ファイルをstandaloneビルドに含める
  outputFileTracingIncludes: {
    '/': ['./i18n.ts', './src/i18n/**/*', './messages/**/*'],
  },
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-lambda'],
  images: {
    unoptimized: true
  },
  env: {
    CUSTOM_KEY: 'my-value',
    // v4.0.0 フィーチャーフラグ — ビルド時に process.env から読み取りインライン化
    // Docker build-arg または環境変数で設定: NEXT_PUBLIC_VOICE_CHAT_ENABLED=true
    NEXT_PUBLIC_VOICE_CHAT_ENABLED: process.env.NEXT_PUBLIC_VOICE_CHAT_ENABLED || 'false',
    NEXT_PUBLIC_GUARDRAILS_ENABLED: process.env.NEXT_PUBLIC_GUARDRAILS_ENABLED || 'false',
    NEXT_PUBLIC_ENABLE_AGENT_REGISTRY: process.env.NEXT_PUBLIC_ENABLE_AGENT_REGISTRY || 'false',
    NEXT_PUBLIC_AGENT_REGISTRY_REGION: process.env.NEXT_PUBLIC_AGENT_REGISTRY_REGION || 'ap-northeast-1',
    NEXT_PUBLIC_AGENT_POLICY_ENABLED: process.env.NEXT_PUBLIC_AGENT_POLICY_ENABLED || 'false',
    NEXT_PUBLIC_EPISODIC_MEMORY_ENABLED: process.env.NEXT_PUBLIC_EPISODIC_MEMORY_ENABLED || 'false',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
