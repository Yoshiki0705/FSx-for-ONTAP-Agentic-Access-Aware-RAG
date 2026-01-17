/**
 * WebAppStack設定インターフェース
 * 
 * WebAppStackのデプロイモード（スタンドアローン/統合）と
 * 各種設定を定義します。
 */

/**
 * WebAppStackの全体設定
 */
export interface WebAppStackConfig {
  /**
   * デプロイモード設定
   */
  deployMode: DeployModeConfig;
  
  /**
   * スタンドアローンモード設定
   */
  standalone: StandaloneConfig;
  
  /**
   * 統合モード設定
   */
  integrated: IntegratedConfig;
  
  /**
   * WebApp共通設定
   */
  webapp: WebAppConfig;
}

/**
 * デプロイモード設定
 */
export interface DeployModeConfig {
  /**
   * スタンドアローンモードを使用するか
   * true: 独立したVPC・セキュリティグループを作成
   * false: 既存のNetworking/SecurityStackを参照
   */
  useStandalone: boolean;
  
  /**
   * Lambda関数作成をスキップするか
   * true: ECRリポジトリのみ作成（イメージ未準備時）
   * false: Lambda関数も作成
   */
  skipLambdaCreation: boolean;
  
  /**
   * デバッグモードを有効にするか
   */
  debugMode: boolean;
}

/**
 * スタンドアローンモード設定
 */
export interface StandaloneConfig {
  /**
   * VPC設定
   */
  vpc: StandaloneVpcConfig;
  
  /**
   * セキュリティグループ設定
   */
  securityGroup: StandaloneSecurityGroupConfig;
  
  /**
   * IAMロール設定
   */
  iamRole: StandaloneIamRoleConfig;
}

/**
 * スタンドアローンモードVPC設定
 */
export interface StandaloneVpcConfig {
  /**
   * 既存VPCを使用するか
   */
  useExisting: boolean;
  
  /**
   * 既存VPC ID（useExisting=trueの場合）
   */
  existingVpcId?: string;
  
  /**
   * 新規VPC作成設定（useExisting=falseの場合）
   */
  create?: {
    /**
     * VPC CIDR
     */
    cidr: string;
    
    /**
     * アベイラビリティゾーン数
     */
    maxAzs: number;
    
    /**
     * NATゲートウェイを有効にするか
     */
    enableNatGateway: boolean;
  };
}

/**
 * スタンドアローンモードセキュリティグループ設定
 */
export interface StandaloneSecurityGroupConfig {
  /**
   * 既存セキュリティグループを使用するか
   */
  useExisting: boolean;
  
  /**
   * 既存セキュリティグループID（useExisting=trueの場合）
   */
  existingSecurityGroupId?: string;
  
  /**
   * 新規セキュリティグループ作成設定（useExisting=falseの場合）
   */
  create?: {
    /**
     * セキュリティグループ名
     */
    name: string;
    
    /**
     * 説明
     */
    description: string;
    
    /**
     * インバウンドルール
     */
    ingressRules: SecurityGroupRule[];
    
    /**
     * アウトバウンドルール
     */
    egressRules: SecurityGroupRule[];
  };
}

/**
 * セキュリティグループルール
 */
export interface SecurityGroupRule {
  /**
   * プロトコル（tcp, udp, icmp, all）
   */
  protocol: string;
  
  /**
   * ポート範囲開始
   */
  fromPort: number;
  
  /**
   * ポート範囲終了
   */
  toPort: number;
  
  /**
   * 送信元/送信先CIDR
   */
  cidr: string;
  
  /**
   * 説明
   */
  description: string;
}

/**
 * スタンドアローンモードIAMロール設定
 */
export interface StandaloneIamRoleConfig {
  /**
   * Lambda実行ロール名
   */
  executionRoleName: string;
  
  /**
   * 追加のマネージドポリシーARN
   */
  additionalManagedPolicies?: string[];
  
  /**
   * カスタムポリシーステートメント
   */
  customPolicyStatements?: any[];
}

/**
 * 統合モード設定
 */
export interface IntegratedConfig {
  /**
   * NetworkingStackからの参照設定
   */
  networking: {
    /**
     * NetworkingStackの名前
     */
    stackName: string;
    
    /**
     * VPC出力値の名前
     */
    vpcOutputName: string;
  };
  
  /**
   * SecurityStackからの参照設定
   */
  security: {
    /**
     * SecurityStackの名前
     */
    stackName: string;
    
    /**
     * セキュリティグループ出力値の名前
     */
    securityGroupOutputName: string;
    
    /**
     * IAMロール出力値の名前
     */
    iamRoleOutputName: string;
  };
}

/**
 * WebApp共通設定
 */
export interface WebAppConfig {
  /**
   * ECRリポジトリ設定
   */
  ecr: EcrConfig;
  
  /**
   * Lambda関数設定
   */
  lambda: WebAppLambdaConfig;
  
  /**
   * CloudFront設定
   */
  cloudfront: CloudFrontConfig;
  
  /**
   * タグ設定
   */
  tags: WebAppTagsConfig;
}

/**
 * ECRリポジトリ設定
 */
export interface EcrConfig {
  /**
   * リポジトリ名
   */
  repositoryName: string;
  
  /**
   * イメージスキャンを有効にするか
   */
  imageScanOnPush: boolean;
  
  /**
   * イメージタグの可変性
   * MUTABLE: タグの上書き可能
   * IMMUTABLE: タグの上書き不可
   */
  imageTagMutability: 'MUTABLE' | 'IMMUTABLE';
  
  /**
   * ライフサイクルポリシー
   */
  lifecyclePolicy?: {
    /**
     * 保持するイメージ数
     */
    maxImageCount: number;
  };
}

/**
 * Lambda関数設定
 */
export interface WebAppLambdaConfig {
  /**
   * 関数名
   */
  functionName: string;
  
  /**
   * メモリサイズ（MB）
   */
  memorySize: number;
  
  /**
   * タイムアウト（秒）
   */
  timeout: number;
  
  /**
   * 環境変数
   */
  environment: Record<string, string>;
  
  /**
   * Lambda Web Adapter設定
   */
  webAdapter: {
    /**
     * アプリケーションポート
     */
    port: number;
    
    /**
     * 起動コマンド
     */
    command?: string;
  };
  
  /**
   * 予約済み同時実行数
   */
  reservedConcurrentExecutions?: number;
  
  /**
   * VPC配置設定
   */
  vpc: LambdaVpcConfig;
}

/**
 * Lambda VPC配置設定
 */
export interface LambdaVpcConfig {
  /**
   * Lambda関数をVPC内に配置するか
   * true: VPC内に配置（セキュリティ向上、VPC Endpoint必要）
   * false: VPC外に配置（シンプル、インターネット経由）
   */
  enabled: boolean;
  
  /**
   * VPC Endpoint設定（vpc.enabled=trueの場合のみ有効）
   */
  endpoints?: {
    /**
     * DynamoDB VPC Endpointを作成するか
     * Gateway型、無料
     */
    dynamodb: boolean;
    
    /**
     * Bedrock Runtime VPC Endpointを作成するか
     * Interface型、$7.2/月
     * KB Modeで必要（InvokeModel API）
     */
    bedrockRuntime: boolean;
    
    /**
     * Bedrock Agent Runtime VPC Endpointを作成するか
     * Interface型、$7.2/月
     * Agent Modeで必要（InvokeAgent API）
     */
    bedrockAgentRuntime: boolean;
  };
}

/**
 * CloudFront設定
 */
export interface CloudFrontConfig {
  /**
   * ディストリビューション名
   */
  distributionName: string;
  
  /**
   * 価格クラス
   */
  priceClass: 'PriceClass_100' | 'PriceClass_200' | 'PriceClass_All';
  
  /**
   * キャッシュ設定
   */
  cache: {
    /**
     * デフォルトTTL（秒）
     */
    defaultTtl: number;
    
    /**
     * 最小TTL（秒）
     */
    minTtl: number;
    
    /**
     * 最大TTL（秒）
     */
    maxTtl: number;
  };
  
  /**
   * カスタムドメイン設定
   */
  customDomain?: {
    /**
     * ドメイン名
     */
    domainName: string;
    
    /**
     * ACM証明書ARN
     */
    certificateArn: string;
  };
}

/**
 * WebAppタグ設定
 */
export interface WebAppTagsConfig {
  /**
   * プロジェクト名
   */
  Project: string;
  
  /**
   * 環境名
   */
  Environment: string;
  
  /**
   * スタック名
   */
  Stack: string;
  
  /**
   * デプロイモード
   */
  DeployMode: 'Standalone' | 'Integrated';
  
  /**
   * デプロイ日
   */
  DeployDate: string;
  
  /**
   * コストセンター
   */
  CostCenter: string;
  
  /**
   * 所有者
   */
  Owner: string;
  
  /**
   * バックアップ要件
   */
  Backup: string;
  
  /**
   * 監視要件
   */
  Monitoring: string;
}
