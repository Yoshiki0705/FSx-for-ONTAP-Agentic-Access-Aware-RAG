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
