/**
 * WebAppスタック テンプレートメソッドパターン実装
 *
 * スタック構築の共通フローを定義し、具体的な実装を子クラスに委譲
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { LambdaWebAdapter } from '../../modules/api/constructs/lambda-web-adapter';
import { WebAppStackConfig, WebAppResources } from './webapp-stack-improved';
import { NetworkingStack } from './networking-stack';
import { SecurityStack } from './security-stack';
import { DataStack } from './data-stack';
import { EmbeddingStack } from './embedding-stack';
/**
 * WebAppスタック依存関係
 */
export interface WebAppStackDependencies {
    readonly networkingStack: NetworkingStack;
    readonly securityStack: SecurityStack;
    readonly dataStack: DataStack;
    readonly embeddingStack: EmbeddingStack;
}
/**
 * 抽象WebAppスタック（Template Method Pattern）
 */
export declare abstract class AbstractWebAppStack extends cdk.Stack {
    protected config: WebAppStackConfig;
    protected dependencies: WebAppStackDependencies;
    protected resources?: WebAppResources;
    constructor(scope: Construct, id: string, config: WebAppStackConfig, dependencies: WebAppStackDependencies, props?: cdk.StackProps);
    /**
     * テンプレートメソッド - スタック構築の共通フロー
     */
    private buildStack;
    /**
     * 前処理（オーバーライド可能）
     */
    protected preProcess(): void;
    /**
     * 依存関係設定（オーバーライド可能）
     */
    protected setupDependencies(): void;
    /**
     * リソース構築（抽象メソッド - 必須実装）
     */
    protected abstract buildResources(): WebAppResources;
    /**
     * 後処理（オーバーライド可能）
     */
    protected postProcess(): void;
    /**
     * 出力作成（抽象メソッド - 必須実装）
     */
    protected abstract createOutputs(): void;
    /**
     * タグ設定（オーバーライド可能）
     */
    protected addTags(): void;
    /**
     * 最終処理（オーバーライド可能）
     */
    protected finalize(): void;
    /**
     * 設定検証（共通処理）
     */
    protected validateConfig(): void;
    /**
     * リソース名生成ヘルパー
     */
    protected generateResourceName(suffix: string): string;
    /**
     * 公開プロパティ
     */
    getResources(): WebAppResources;
    getConfig(): WebAppStackConfig;
}
/**
 * 標準WebAppスタック実装
 */
export declare class StandardWebAppStack extends AbstractWebAppStack {
    protected buildResources(): WebAppResources;
    protected buildUserPool(): cognito.UserPool;
    protected buildUserPoolClient(userPool: cognito.UserPool): cognito.UserPoolClient;
    protected buildIdentityPool(userPool: cognito.UserPool, userPoolClient: cognito.UserPoolClient): cognito.CfnIdentityPool;
    protected buildApiGateway(): apigateway.RestApi;
    protected buildLambdaWebAdapter(userPool: cognito.UserPool, userPoolClient: cognito.UserPoolClient, identityPool: cognito.CfnIdentityPool): LambdaWebAdapter;
    protected createOutputs(): void;
    private createCognitoOutputs;
    private createApiGatewayOutputs;
    private createLambdaOutputs;
    private createEnvironmentVariableOutputs;
}
/**
 * セキュリティ強化WebAppスタック実装
 */
export declare class SecureWebAppStack extends StandardWebAppStack {
    protected setupDependencies(): void;
    protected addTags(): void;
    protected finalize(): void;
    private validateSecuritySettings;
}
/**
 * 高可用性WebAppスタック実装
 */
export declare class HighAvailabilityWebAppStack extends StandardWebAppStack {
    protected buildLambdaWebAdapter(userPool: cognito.UserPool, userPoolClient: cognito.UserPoolClient, identityPool: cognito.CfnIdentityPool): LambdaWebAdapter;
    protected addTags(): void;
}
