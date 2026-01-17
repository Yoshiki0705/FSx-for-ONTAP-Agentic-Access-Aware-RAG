import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force new build ID and file hashes
  generateBuildId: async () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  },
  // Add headers to fix MIME type issues
  async headers() {
    return [
      {
        source: "/_next/static/css/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "text/css",
          },
        ],
      },
      {
        source: "/_next/static/js/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, webpack, nextRuntime }) => {
    if (isServer && nextRuntime === "nodejs") {
      // AWS SDKの問題を回避するための設定
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^aws-sdk$/,
        })
      );

      // aws-crtの問題も同時に解決
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^aws-crt$/,
        })
      );
    }

    // OpenSearchのAWS SDK依存を外部モジュールとして扱う
    config.externals = [...(config.externals || []), "aws-sdk"];

    // Force new chunk names with timestamp
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          default: {
            ...config.optimization?.splitChunks?.cacheGroups?.default,
            name: `chunk-${Date.now()}`,
          },
        },
      },
    };

    return config;
  },
};

export default withNextIntl(nextConfig);