/**
 * 命名設定インターフェース
 * スタック命名の標準化とコンポーネント定義
 */

/**
 * スタックコンポーネント列挙型
 */
export enum StackComponent {
  NETWORKING = 'Networking',
  SECURITY = 'Security', 
  DATA = 'Data',
  COMPUTE = 'Compute',
  WEBAPP = 'WebApp',
  OPERATIONS = 'Operations',
  EMBEDDING = 'Embedding',
  ADVANCED_PERMISSION = 'AdvancedPermission',
  MONITORING = 'Monitoring',
  ENTERPRISE = 'Enterprise'
}

/**
 * 命名設定インターフェース
 */
export interface NamingConfig {
  /** プロジェクト名 */
  projectName: string;
  
  /** 環境名 */
  environment: string;
  
  /** リージョンプレフィックス */
  regionPrefix: string;
  
  /** 区切り文字 */
  separator?: string;
}

/**
 * リソース命名設定
 */
export interface ResourceNamingConfig {
  /** Lambda関数名のプレフィックス */
  lambdaPrefix: string;
  
  /** DynamoDBテーブル名のプレフィックス */
  dynamodbPrefix: string;
  
  /** S3バケット名のプレフィックス */
  s3Prefix: string;
  
  /** CloudWatch LogGroup名のプレフィックス */
  logGroupPrefix: string;
  
  /** IAMロール名のプレフィックス */
  iamRolePrefix: string;
}