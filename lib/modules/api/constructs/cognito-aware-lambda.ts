/**
 * Cognito認識型Lambda関数コンストラクト
 * 
 * Cognito VPC Endpoint有効時のみLambda関数をVPC内に配置
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Cognito認識型Lambda関数のプロパティ
 */
export interface CognitoAwareLambdaProps {
  /**
   * Lambda関数名
   */
  functionName: string;
  
  /**
   * Lambda関数コード
   */
  code: lambda.Code;
  
  /**
   * Lambda関数ハンドラー
   */
  handler: string;
  
  /**
   * Lambda関数ランタイム
   * @default lambda.Runtime.NODEJS_20_X
   */
  runtime?: lambda.Runtime;
  
  /**
   * Lambda関数タイムアウト
   * @default cdk.Duration.seconds(30)
   */
  timeout?: cdk.Duration;
  
  /**
   * Lambda関数メモリサイズ
   * @default 512
   */
  memorySize?: number;
  
  /**
   * 環境変数
   */
  environment?: { [key: string]: string };
  
  /**
   * VPC（Cognito Private Endpoint有効時に使用）
   */
  vpc?: ec2.IVpc;
  
  /**
   * VPC内に配置するサブネット選択
   * @default { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
   */
  vpcSubnets?: ec2.SubnetSelection;
  
  /**
   * セキュリティグループ
   */
  securityGroups?: ec2.ISecurityGroup[];
  
  /**
   * Cognito VPC Endpointが有効かどうか
   * 
   * - true: Lambda関数をVPC内に配置
   * - false: Lambda関数をVPC外に配置（デフォルト）
   * 
   * @default false
   */
  cognitoPrivateEndpointEnabled?: boolean;
  
  /**
   * プロジェクト名
   */
  projectName: string;
  
  /**
   * 環境名
   */
}

/**
 * Cognito認識型Lambda関数コンストラクト
 * 
 * Cognito VPC Endpoint有効時のみLambda関数をVPC内に配置し、
 * 環境変数で接続モードを通知します。
 * 
 * 使用例:
 * ```typescript
 * const authFunction = new CognitoAwareLambda(this, 'AuthFunction', {
 *   functionName: 'auth-function',
 *   code: lambda.Code.fromAsset('lambda/auth'),
 *   handler: 'index.handler',
 *   vpc,
 *   cognitoPrivateEndpointEnabled: true,
 *   projectName: 'my-project',
 *   environment: 'prod',
 * });
 * ```
 */
export class CognitoAwareLambda extends Construct {
  /**
   * 作成されたLambda関数
   */
  public readonly function: lambda.Function;
  
  /**
   * Cognito接続モード
   * - 'private': VPC Endpoint経由
   * - 'public': インターネット経由
   */
  public readonly connectionMode: 'private' | 'public';
  
  constructor(scope: Construct, id: string, props: CognitoAwareLambdaProps) {
    super(scope, id);
    
    // Cognito接続モードの決定
    this.connectionMode = props.cognitoPrivateEndpointEnabled ? 'private' : 'public';
    
    // 環境変数の準備
    const environment = { ...props.environment };
    
    // VPC設定の準備（Private接続モードの場合のみ）
    const vpcConfig = this.connectionMode === 'private' && props.vpc ? {
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets ?? {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: props.securityGroups,
    } : {};
    
    // Lambda関数作成
    this.function = new lambda.Function(this, 'Function', {
      functionName: `${props.projectName}-${props.environment}-${props.functionName}`,
      code: props.code,
      handler: props.handler,
      runtime: props.runtime ?? lambda.Runtime.NODEJS_20_X,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      memorySize: props.memorySize ?? 512,
      environment,
      ...vpcConfig,
    });
    
    // Private接続モードの場合、VPC Endpointアクセス用IAMポリシー追加
    if (this.connectionMode === 'private') {
      this.addVpcEndpointAccessPolicy();
    }
    
    // タグ設定
    cdk.Tags.of(this.function).add('ConnectionMode', this.connectionMode);
    cdk.Tags.of(this.function).add('Project', props.projectName);
    
    // ログ出力
    console.log(`✅ Lambda関数作成: ${this.function.functionName}`);
    console.log(`   接続モード: ${this.connectionMode}`);
    console.log(`   VPC配置: ${this.connectionMode === 'private' ? 'Yes' : 'No'}`);
  }
  
  /**
   * VPC Endpointアクセス用IAMポリシー追加
   */
  private addVpcEndpointAccessPolicy(): void {
    // Cognito User Pools APIへのアクセス権限
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:ListUsers',
        'cognito-idp:GetUser',
      ],
      resources: [
        `arn:aws:cognito-idp:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:userpool/*`,
      ],
    }));
    
    // VPC Endpointへのネットワークアクセス権限（暗黙的に付与される）
    console.log('   IAMポリシー追加: Cognito User Pools API アクセス権限');
  }
  
  /**
   * Lambda関数に環境変数を追加
   */
  public addEnvironment(key: string, value: string): void {
    this.function.addEnvironment(key, value);
  }
  
  /**
   * Lambda関数にIAMポリシーを追加
   */
  public addToRolePolicy(statement: iam.PolicyStatement): void {
    this.function.addToRolePolicy(statement);
  }
  
  /**
   * Lambda関数に実行権限を付与
   */
  public grantInvoke(grantee: iam.IGrantable): iam.Grant {
    return this.function.grantInvoke(grantee);
  }
}

/**
 * Cognito認識型Lambda関数を作成するヘルパー関数
 * 
 * @param scope コンストラクトスコープ
 * @param id コンストラクトID
 * @param props Lambda関数プロパティ
 * @returns 作成されたLambda関数
 */
export function createCognitoAwareLambda(
  scope: Construct,
  id: string,
  props: CognitoAwareLambdaProps
): lambda.Function {
  const cognitoAwareLambda = new CognitoAwareLambda(scope, id, props);
  return cognitoAwareLambda.function;
}
