/**
 * WebAppStack - 統合Webアプリケーションスタック（モジュラーアーキテクチャ対応）
 * 
 * 機能:
 * - 統合APIコンストラクトによる一元管理
 * - Next.js・CloudFront・Cognito・API Gatewayの統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// 統合APIコンストラクト（モジュラーアーキテクチャ）
import { APIConstruct } from '../../modules/api/constructs/api-construct';

// インターフェース
import { ApiConfig } from '../../modules/api/interfaces/api-config';
// 型定義は一時的にanyを使用（インターフェースファイルが存在しない場合）

// 他スタックからの依存関係
import { SecurityStack } from './security-stack';
import { DataStack } from './data-stack';
import { EmbeddingStack } from './embedding-stack';
// import { LambdaWebAdapter } from '../../modules/api/constructs/lambda-web-adapter';

export interface WebAppStackProps extends cdk.StackProps {
  readonly config: any; // 統合設定オブジェクト
  readonly securityStack?: SecurityStack; // セキュリティスタック（オプション）
  readonly dataStack?: DataStack; // データスタック（オプション）
  readonly embeddingStack?: EmbeddingStack; // Embeddingスタック（オプション）
  readonly namingGenerator?: any; // Agent Steering準拠命名ジェネレーター（オプション）
}

/**
 * 統合Webアプリケーションスタック（モジュラーアーキテクチャ対応）
 * 
 * 統合APIコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export class WebAppStack extends cdk.Stack {
  /** 統合APIコンストラクト */
  public readonly api: APIConstruct;
  
  /** CloudFrontディストリビューションURL（他スタックからの参照用） */
  public readonly cloudFrontUrl?: string;
  
  /** API GatewayエンドポイントURL（他スタックからの参照用） */
  public readonly apiGatewayUrl?: string;
  
  /** Cognito User Pool ID（他スタックからの参照用） */
  public readonly cognitoUserPoolId?: string;

  constructor(scope: Construct, id: string, props: WebAppStackProps) {
    super(scope, id, props);

    console.log('🌍 WebAppStack初期化開始...');
    console.log('📝 スタック名:', id);
    console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');

    // 設定検証
    this.validateConfiguration(props);

    // 依存スタックとの依存関係設定（存在する場合）
    if (props.securityStack) {
      this.addDependency(props.securityStack);
      console.log('🔗 SecurityStackとの依存関係設定完了');
    }
    if (props.dataStack) {
      this.addDependency(props.dataStack);
      console.log('🔗 DataStackとの依存関係設定完了');
    }
    if (props.embeddingStack) {
      this.addDependency(props.embeddingStack);
      console.log('🔗 EmbeddingStackとの依存関係設定完了');
    }

    // 統合APIコンストラクト作成
    try {
      this.api = new APIConstruct(this, 'API', {
        config: props.config.api || {},
        projectName: props.config.project?.name || 'default-project',
        environment: props.config.environment || 'dev',
        // セキュリティ関連の設定は存在する場合のみ追加
        ...(props.securityStack?.kmsKey && { kmsKey: props.securityStack.kmsKey }),
        ...(props.securityStack?.wafWebAclArn && { wafWebAclArn: props.securityStack.wafWebAclArn }),
        ...(props.dataStack?.s3BucketNames && { s3BucketNames: props.dataStack.s3BucketNames }),
        ...(props.dataStack?.dynamoDbTableNames && { dynamoDbTableNames: props.dataStack.dynamoDbTableNames }),
        ...(props.embeddingStack?.getEmbeddingInfo()?.lambdaFunctions && { 
          lambdaFunctionArns: props.embeddingStack.getEmbeddingInfo()?.lambdaFunctions 
        }),
        ...(props.namingGenerator && { namingGenerator: props.namingGenerator }),
      });
      console.log('✅ APIコンストラクト作成完了');
    } catch (error) {
      console.error('❌ APIコンストラクト作成エラー:', error);
      throw new Error(`WebAppStack初期化失敗: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 他スタックからの参照用プロパティ設定
    this.setupCrossStackReferences();

    // スタック出力
    this.createOutputs();

    // タグ設定
    this.addStackTags();

    console.log('✅ WebAppStack初期化完了');
  }

  /**
   * 設定検証（セキュリティ強化）
   */
  private validateConfiguration(props: WebAppStackProps): void {
    // 必須設定の検証
    if (!props.config) {
      throw new Error('WebAppStack: config は必須です');
    }

    if (!props.config.project?.name) {
      throw new Error('WebAppStack: config.project.name は必須です');
    }

    if (!props.config.environment) {
      throw new Error('WebAppStack: config.environment は必須です');
    }

    // プロジェクト名の形式検証（セキュリティ）
    const projectNameRegex = /^[a-z0-9-]+$/;
    if (!projectNameRegex.test(props.config.project.name)) {
      throw new Error('WebAppStack: プロジェクト名は小文字、数字、ハイフンのみ使用可能です');
    }

    // 環境名の検証
    const validEnvironments = ['dev', 'staging', 'prod', 'test'];
    if (!validEnvironments.includes(props.config.environment)) {
      throw new Error(`WebAppStack: 無効な環境名です。有効な値: ${validEnvironments.join(', ')}`);
    }

    console.log('✅ WebAppStack設定検証完了');
  }

  /**
   * 他スタックからの参照用プロパティ設定
   */
  private setupCrossStackReferences(): void {
    // CloudFrontディストリビューションURLの設定（存在する場合）
    if (this.api.outputs?.cloudFrontUrl) {
      (this as any).cloudFrontUrl = this.api.outputs.cloudFrontUrl;
    }

    // API GatewayエンドポイントURLの設定（存在する場合）
    if (this.api.outputs?.apiGatewayUrl) {
      (this as any).apiGatewayUrl = this.api.outputs.apiGatewayUrl;
    }

    // Cognito User Pool IDの設定（存在する場合）
    if (this.api.outputs?.cognitoUserPoolId) {
      (this as any).cognitoUserPoolId = this.api.outputs.cognitoUserPoolId;
    }

    console.log('🔗 他スタック参照用プロパティ設定完了');
  }

  /**
   * スタック出力作成（個別デプロイ対応）
   */
  private createOutputs(): void {
    // CloudFrontディストリビューションURL出力（存在する場合のみ）
    if (this.cloudFrontUrl) {
      new cdk.CfnOutput(this, 'CloudFrontUrl', {
        value: this.cloudFrontUrl,
        description: 'CloudFront Distribution URL',
        exportName: `${this.stackName}-CloudFrontUrl`,
      });
    }

    // API GatewayエンドポイントURL出力（存在する場合のみ）
    if (this.apiGatewayUrl) {
      new cdk.CfnOutput(this, 'ApiGatewayUrl', {
        value: this.apiGatewayUrl,
        description: 'API Gateway Endpoint URL',
        exportName: `${this.stackName}-ApiGatewayUrl`,
      });
    }

    // Cognito User Pool ID出力（存在する場合のみ）
    if (this.cognitoUserPoolId) {
      new cdk.CfnOutput(this, 'CognitoUserPoolId', {
        value: this.cognitoUserPoolId,
        description: 'Cognito User Pool ID',
        exportName: `${this.stackName}-CognitoUserPoolId`,
      });
    }

    // API統合出力（存在する場合のみ）
    if (this.api.outputs) {
      // Lambda Web Adapter Function ARN
      if (this.api.outputs.lambdaWebAdapterArn) {
        new cdk.CfnOutput(this, 'LambdaWebAdapterArn', {
          value: this.api.outputs.lambdaWebAdapterArn,
          description: 'Lambda Web Adapter Function ARN',
          exportName: `${this.stackName}-LambdaWebAdapterArn`,
        });
      }

      // Cognito User Pool Client ID
      if (this.api.outputs.cognitoUserPoolClientId) {
        new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
          value: this.api.outputs.cognitoUserPoolClientId,
          description: 'Cognito User Pool Client ID',
          exportName: `${this.stackName}-CognitoUserPoolClientId`,
        });
      }
    }

    console.log('📤 WebAppStack出力値作成完了');
  }

  /**
   * スタックタグ設定（Agent Steering準拠）
   */
  private addStackTags(): void {
    cdk.Tags.of(this).add('Module', 'API+Frontend');
    cdk.Tags.of(this).add('StackType', 'Integrated');
    cdk.Tags.of(this).add('Architecture', 'Modular');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('WebFramework', 'Next.js');
    cdk.Tags.of(this).add('DeploymentMethod', 'Lambda Web Adapter');
    cdk.Tags.of(this).add('CDN', 'CloudFront');
    cdk.Tags.of(this).add('Authentication', 'Cognito');
    cdk.Tags.of(this).add('IndividualDeploySupport', 'Yes');
    
    console.log('🏷️ WebAppStackタグ設定完了');
  }



}