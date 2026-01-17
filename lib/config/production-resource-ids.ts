/**
 * 本番環境リソースID管理
 */

export const ProductionResourceIds = {
  // VPC設定
  vpc: {
    id: 'vpc-0a1b2c3d4e5f6g7h8',
    cidr: '10.0.0.0/16'
  },
  
  // サブネット設定
  subnets: {
    public: ['subnet-pub1', 'subnet-pub2'],
    private: ['subnet-priv1', 'subnet-priv2']
  },
  
  // セキュリティグループ
  securityGroups: {
    lambda: 'sg-lambda-001',
    fsx: 'sg-fsx-001',
    opensearch: 'sg-opensearch-001'
  }
};

export type ProductionResourceIdsType = typeof ProductionResourceIds;
