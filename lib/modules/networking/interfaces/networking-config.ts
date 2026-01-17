/**
 * ネットワーキング設定インターフェース
 */

export interface NetworkingConfig {
  /** VPC CIDR ブロック */
  vpcCidr: string;
  
  /** アベイラビリティゾーン数 */
  maxAzs: number;
  
  /** パブリックサブネットの有効化 */
  enablePublicSubnets: boolean;
  
  /** プライベートサブネットの有効化 */
  enablePrivateSubnets: boolean;
  
  /** 分離サブネットの有効化 */
  enableIsolatedSubnets: boolean;
  
  /** NATゲートウェイの有効化 */
  enableNatGateway: boolean;
  
  /** VPCエンドポイントの設定 */
  vpcEndpoints?: {
    s3?: boolean;
    dynamodb?: boolean;
    lambda?: boolean;
    opensearch?: boolean;
  };
  
  /** セキュリティグループの設定 */
  securityGroups?: {
    web?: boolean;
    api?: boolean;
    database?: boolean;
    lambda?: boolean;
  };
  
  /** DNS設定 */
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  
  /** フローログの有効化 */
  enableFlowLogs?: boolean;
}

export interface NetworkingConstructProps {
  config: NetworkingConfig;
  projectName: string;
  environment: string;
}