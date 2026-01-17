/**
 * Stack間の型安全な連携のためのインターフェース定義
 * 
 * Phase 7: コード品質向上 - 型定義の厳密化
 * - `any`型の完全排除
 * - 依存性逆転の原則（DIP）準拠
 * - Stack間の明示的な契約定義
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';

/**
 * NetworkingStack公開インターフェース
 * 
 * 他のStackがNetworkingStackに依存する際に使用する型定義
 * 実装の詳細を隠蔽し、必要な公開プロパティのみを公開
 */
export interface INetworkingStack {
  /** VPC */
  readonly vpc: ec2.IVpc;
  
  /** パブリックサブネット */
  readonly publicSubnets: ec2.ISubnet[];
  
  /** プライベートサブネット */
  readonly privateSubnets: ec2.ISubnet[];
  
  /** 分離サブネット */
  readonly isolatedSubnets: ec2.ISubnet[];
  
  /** セキュリティグループマップ */
  readonly securityGroups: { [key: string]: ec2.ISecurityGroup };
  
  /** WebAppスタック用セキュリティグループ（オプション） */
  readonly webAppSecurityGroup?: ec2.ISecurityGroup;
}

/**
 * SecurityStack公開インターフェース
 * 
 * 他のStackがSecurityStackに依存する際に使用する型定義
 * 実装の詳細を隠蔽し、必要な公開プロパティのみを公開
 */
export interface ISecurityStack {
  /** KMSキー */
  readonly kmsKey: kms.IKey;
  
  /** WAF WebACL ARN（オプション） */
  readonly wafWebAclArn?: string;
  
  /** Lambda実行ロール（オプション） */
  readonly lambdaExecutionRole?: iam.IRole;
  
  /** Bedrock Guardrails ARN（オプション） */
  readonly guardrailArn?: string;
  
  /** Bedrock Guardrails ID（オプション） */
  readonly guardrailId?: string;
}

/**
 * DataStack公開インターフェース
 * 
 * 他のStackがDataStackに依存する際に使用する型定義
 */
export interface IDataStack {
  /** DynamoDBテーブルARNリスト */
  readonly tableArns: string[];
  
  /** S3バケットARNリスト */
  readonly bucketArns: string[];
  
  /** OpenSearch Serverlessコレクション名（オプション） */
  readonly opensearchCollectionName?: string;
  
  /** FSx for NetApp ONTAP ファイルシステムID（オプション） */
  readonly fsxFileSystemId?: string;
}

/**
 * EmbeddingStack公開インターフェース
 * 
 * 他のStackがEmbeddingStackに依存する際に使用する型定義
 */
export interface IEmbeddingStack {
  /** Embedding処理Lambda関数ARN */
  readonly embeddingFunctionArn: string;
  
  /** Batch処理ジョブ定義ARN（オプション） */
  readonly batchJobDefinitionArn?: string;
  
  /** Batch処理ジョブキューARN（オプション） */
  readonly batchJobQueueArn?: string;
}

/**
 * OperationsStack公開インターフェース
 * 
 * 他のStackがOperationsStackに依存する際に使用する型定義
 */
export interface IOperationsStack {
  /** CloudWatch Logs ロググループ名 */
  readonly logGroupName: string;
  
  /** SNSトピックARN（アラート通知用） */
  readonly alertTopicArn: string;
  
  /** X-Ray トレーシング有効化フラグ */
  readonly xrayEnabled: boolean;
}
