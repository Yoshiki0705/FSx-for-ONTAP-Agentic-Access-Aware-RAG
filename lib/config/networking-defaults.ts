/**
 * ネットワーキング設定のデフォルト値
 */

import { NetworkingConfig } from '../modules/networking';

export const DEFAULT_NETWORKING_CONFIG: NetworkingConfig = {
  vpcCidr: '10.0.0.0/16',
  maxAzs: 2,
  enablePublicSubnets: true,
  enablePrivateSubnets: true,
  enableIsolatedSubnets: true,
  enableNatGateway: true,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  enableFlowLogs: true,
  vpcEndpoints: {
    s3: true,
    dynamodb: true,
    lambda: true,
  },
  securityGroups: {
    web: true,
    api: true,
    database: true,
    lambda: true,
  },
};

/**
 * 環境別設定のファクトリー関数
 */
export function createNetworkingConfig(
  environment: 'dev' | 'staging' | 'prod' | 'test',
  overrides?: Partial<NetworkingConfig>
): NetworkingConfig {
  const baseConfig = { ...DEFAULT_NETWORKING_CONFIG };

  // 環境別の調整
  switch (environment) {
    case 'dev':
      baseConfig.maxAzs = 1; // 開発環境はコスト削減
      baseConfig.enableNatGateway = false;
      break;
    case 'test':
      baseConfig.maxAzs = 1;
      baseConfig.enableFlowLogs = false;
      break;
    case 'staging':
      baseConfig.maxAzs = 2;
      break;
    case 'prod':
      baseConfig.maxAzs = 3; // 本番環境は高可用性
      baseConfig.enableFlowLogs = true;
      break;
  }

  return { ...baseConfig, ...overrides };
}