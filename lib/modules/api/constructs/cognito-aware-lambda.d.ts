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
    environment?: {
        [key: string]: string;
    };
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
export declare class CognitoAwareLambda extends Construct {
    /**
     * 作成されたLambda関数
     */
    readonly function: lambda.Function;
    /**
     * Cognito接続モード
     * - 'private': VPC Endpoint経由
     * - 'public': インターネット経由
     */
    readonly connectionMode: 'private' | 'public';
    constructor(scope: Construct, id: string, props: CognitoAwareLambdaProps);
    /**
     * VPC Endpointアクセス用IAMポリシー追加
     */
    private addVpcEndpointAccessPolicy;
    /**
     * Lambda関数に環境変数を追加
     */
    addEnvironment(key: string, value: string): void;
    /**
     * Lambda関数にIAMポリシーを追加
     */
    addToRolePolicy(statement: iam.PolicyStatement): void;
    /**
     * Lambda関数に実行権限を付与
     */
    grantInvoke(grantee: iam.IGrantable): iam.Grant;
}
/**
 * Cognito認識型Lambda関数を作成するヘルパー関数
 *
 * @param scope コンストラクトスコープ
 * @param id コンストラクトID
 * @param props Lambda関数プロパティ
 * @returns 作成されたLambda関数
 */
export declare function createCognitoAwareLambda(scope: Construct, id: string, props: CognitoAwareLambdaProps): lambda.Function;
