/**
 * NetworkingConfig アダプター
 * 
 * EnvironmentConfigのnetworking設定をNetworkingConfigインターフェースに変換
 */

import { NetworkingConfig } from '../../modules/networking/interfaces/networking-config';

/**
 * EnvironmentConfigからNetworkingConfigを生成
 */
export function adaptNetworkingConfig(envConfig: any): NetworkingConfig {
  const networking = envConfig.networking || {};
  
  return {
    vpcCidr: networking.vpcCidr || '10.0.0.0/16',
    maxAzs: networking.availabilityZones || 3,
    enablePublicSubnets: true, // デフォルトで有効
    enablePrivateSubnets: true, // デフォルトで有効
    enableIsolatedSubnets: false, // デフォルトで無効
    enableNatGateway: networking.natGateways?.enabled ?? true,
    vpcEndpoints: {
      s3: true,
      dynamodb: true,
      lambda: true,
      opensearch: true
    },
    securityGroups: {
      web: true,
      api: true,
      database: true,
      lambda: true
    },
    enableDnsHostnames: networking.enableDnsHostnames ?? true,
    enableDnsSupport: networking.enableDnsSupport ?? true,
    enableFlowLogs: networking.enableVpcFlowLogs ?? true
  };
}
