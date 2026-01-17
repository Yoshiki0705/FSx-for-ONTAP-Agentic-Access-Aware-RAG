"use strict";
/**
 * WebAppスタック テンプレートメソッドパターン実装
 *
 * スタック構築の共通フローを定義し、具体的な実装を子クラスに委譲
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HighAvailabilityWebAppStack = exports.SecureWebAppStack = exports.StandardWebAppStack = exports.AbstractWebAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda_web_adapter_1 = require("../../modules/api/constructs/lambda-web-adapter");
/**
 * 抽象WebAppスタック（Template Method Pattern）
 */
class AbstractWebAppStack extends cdk.Stack {
    config;
    dependencies;
    resources;
    constructor(scope, id, config, dependencies, props) {
        super(scope, id, props);
        this.config = config;
        this.dependencies = dependencies;
        // テンプレートメソッド実行
        this.buildStack();
    }
    /**
     * テンプレートメソッド - スタック構築の共通フロー
     */
    buildStack() {
        // 1. 前処理
        this.preProcess();
        // 2. 依存関係設定
        this.setupDependencies();
        // 3. リソース構築
        this.resources = this.buildResources();
        // 4. 後処理
        this.postProcess();
        // 5. 出力作成
        this.createOutputs();
        // 6. タグ設定
        this.addTags();
        // 7. 最終処理
        this.finalize();
    }
    /**
     * 前処理（オーバーライド可能）
     */
    preProcess() {
        // デフォルト実装は空
        this.validateConfig();
    }
    /**
     * 依存関係設定（オーバーライド可能）
     */
    setupDependencies() {
        // デフォルトでは依存関係を設定しない（Lambda Web Adapterでは不要）
    }
    /**
     * 後処理（オーバーライド可能）
     */
    postProcess() {
        // デフォルト実装は空
    }
    /**
     * タグ設定（オーバーライド可能）
     */
    addTags() {
        cdk.Tags.of(this).add('Module', 'WebApp');
        cdk.Tags.of(this).add('StackType', 'Integrated');
        cdk.Tags.of(this).add('Project', this.config.projectName);
        cdk.Tags.of(this).add('Environment', this.config.environment);
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('Frontend', 'Next.js');
    }
    /**
     * 最終処理（オーバーライド可能）
     */
    finalize() {
        // デフォルト実装は空
    }
    /**
     * 設定検証（共通処理）
     */
    validateConfig() {
        if (!this.config.projectName) {
            throw new Error('プロジェクト名は必須です');
        }
        if (!this.config.environment) {
            throw new Error('環境名は必須です');
        }
        if (!this.config.cognitoConfig) {
            throw new Error('Cognito設定は必須です');
        }
        if (!this.config.lambdaConfig) {
            throw new Error('Lambda設定は必須です');
        }
    }
    /**
     * リソース名生成ヘルパー
     */
    generateResourceName(suffix) {
        return `${this.config.projectName}-${this.config.environment}-${suffix}`;
    }
    /**
     * 公開プロパティ
     */
    getResources() {
        if (!this.resources) {
            throw new Error('リソースが構築されていません');
        }
        return this.resources;
    }
    getConfig() {
        return this.config;
    }
}
exports.AbstractWebAppStack = AbstractWebAppStack;
/**
 * 標準WebAppスタック実装
 */
class StandardWebAppStack extends AbstractWebAppStack {
    buildResources() {
        // Cognitoリソース構築
        const userPool = this.buildUserPool();
        const userPoolClient = this.buildUserPoolClient(userPool);
        const identityPool = this.buildIdentityPool(userPool, userPoolClient);
        // API Gatewayリソース構築
        const apiGateway = this.buildApiGateway();
        // Lambda Web Adapterリソース構築
        const webAdapter = this.buildLambdaWebAdapter(userPool, userPoolClient, identityPool);
        return {
            userPool,
            userPoolClient,
            identityPool,
            apiGateway,
            webAdapter,
        };
    }
    buildUserPool() {
        const userPoolConfig = this.config.cognitoConfig.userPool;
        return new cognito.UserPool(this, 'UserPool', {
            userPoolName: this.generateResourceName('users'),
            selfSignUpEnabled: userPoolConfig.selfSignUpEnabled,
            signInAliases: userPoolConfig.signInAliases,
            autoVerify: userPoolConfig.autoVerify,
            passwordPolicy: {
                minLength: userPoolConfig.passwordPolicy.minLength,
                requireLowercase: userPoolConfig.passwordPolicy.requireLowercase,
                requireUppercase: userPoolConfig.passwordPolicy.requireUppercase,
                requireDigits: userPoolConfig.passwordPolicy.requireDigits,
                requireSymbols: userPoolConfig.passwordPolicy.requireSymbols,
            },
            removalPolicy: userPoolConfig.removalPolicy,
        });
    }
    buildUserPoolClient(userPool) {
        const clientConfig = this.config.cognitoConfig.userPoolClient;
        return new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool,
            userPoolClientName: this.generateResourceName('client'),
            generateSecret: clientConfig.generateSecret,
            authFlows: clientConfig.authFlows,
        });
    }
    buildIdentityPool(userPool, userPoolClient) {
        const identityConfig = this.config.cognitoConfig.identityPool;
        return new cognito.CfnIdentityPool(this, 'IdentityPool', {
            identityPoolName: this.generateResourceName('identity'),
            allowUnauthenticatedIdentities: identityConfig.allowUnauthenticatedIdentities,
            cognitoIdentityProviders: [{
                    clientId: userPoolClient.userPoolClientId,
                    providerName: userPool.userPoolProviderName,
                }],
        });
    }
    buildApiGateway() {
        return new apigateway.RestApi(this, 'ApiGateway', {
            restApiName: this.generateResourceName('api'),
            description: 'Permission-aware RAG System API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
            },
        });
    }
    buildLambdaWebAdapter(userPool, userPoolClient, identityPool) {
        return new lambda_web_adapter_1.LambdaWebAdapter(this, 'NextjsWebApp', {
            wafAttrArn: this.dependencies.securityStack.waf.webAcl.attrArn,
            db: this.dependencies.dataStack.dynamoDb.sessionTable,
            cognito: {
                userPoolId: userPool.userPoolId,
                userPoolClientId: userPoolClient.userPoolClientId,
                identityPoolId: identityPool.ref,
            },
            vpcConfig: this.config.lambdaConfig.vpcConfig,
            imagePath: this.config.lambdaConfig.imagePath,
            tag: this.config.lambdaConfig.tag,
        });
    }
    createOutputs() {
        if (!this.resources)
            return;
        const outputConfig = this.config.outputConfig;
        if (outputConfig.enableCognitoOutputs) {
            this.createCognitoOutputs();
        }
        if (outputConfig.enableApiGatewayOutputs) {
            this.createApiGatewayOutputs();
        }
        if (outputConfig.enableLambdaOutputs) {
            this.createLambdaOutputs();
        }
        if (outputConfig.enableEnvironmentVariables) {
            this.createEnvironmentVariableOutputs();
        }
    }
    createCognitoOutputs() {
        if (!this.resources)
            return;
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.resources.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: `${this.stackName}-UserPoolId`,
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.resources.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: `${this.stackName}-UserPoolClientId`,
        });
        new cdk.CfnOutput(this, 'IdentityPoolId', {
            value: this.resources.identityPool.ref,
            description: 'Cognito Identity Pool ID',
            exportName: `${this.stackName}-IdentityPoolId`,
        });
    }
    createApiGatewayOutputs() {
        if (!this.resources)
            return;
        new cdk.CfnOutput(this, 'ApiGatewayUrl', {
            value: this.resources.apiGateway.url,
            description: 'API Gateway URL',
            exportName: `${this.stackName}-ApiGatewayUrl`,
        });
        new cdk.CfnOutput(this, 'ApiGatewayId', {
            value: this.resources.apiGateway.restApiId,
            description: 'API Gateway ID',
            exportName: `${this.stackName}-ApiGatewayId`,
        });
    }
    createLambdaOutputs() {
        if (!this.resources)
            return;
        new cdk.CfnOutput(this, 'WebAppUrl', {
            value: this.resources.webAdapter.functionUrl,
            description: 'Next.js WebApp URL (Lambda Web Adapter)',
            exportName: `${this.stackName}-WebAppUrl`,
        });
        new cdk.CfnOutput(this, 'WebAppFunctionName', {
            value: this.resources.webAdapter.lambda.functionName,
            description: 'Next.js WebApp Lambda Function Name',
            exportName: `${this.stackName}-WebAppFunctionName`,
        });
    }
    createEnvironmentVariableOutputs() {
        if (!this.resources)
            return;
        new cdk.CfnOutput(this, 'NextJsEnvVars', {
            value: JSON.stringify({
                NEXT_PUBLIC_API_URL: this.resources.apiGateway.url,
                NEXT_PUBLIC_USER_POOL_ID: this.resources.userPool.userPoolId,
                NEXT_PUBLIC_USER_POOL_CLIENT_ID: this.resources.userPoolClient.userPoolClientId,
                NEXT_PUBLIC_IDENTITY_POOL_ID: this.resources.identityPool.ref,
                NEXT_PUBLIC_WEBAPP_URL: this.resources.webAdapter.functionUrl,
            }),
            description: 'Next.js Environment Variables',
            exportName: `${this.stackName}-NextJsEnvVars`,
        });
    }
}
exports.StandardWebAppStack = StandardWebAppStack;
/**
 * セキュリティ強化WebAppスタック実装
 */
class SecureWebAppStack extends StandardWebAppStack {
    setupDependencies() {
        // セキュリティ強化版では依存関係を明示的に設定
        this.addDependency(this.dependencies.networkingStack);
        this.addDependency(this.dependencies.securityStack);
        this.addDependency(this.dependencies.dataStack);
        this.addDependency(this.dependencies.embeddingStack);
    }
    addTags() {
        super.addTags();
        cdk.Tags.of(this).add('SecurityLevel', 'Enhanced');
        cdk.Tags.of(this).add('Compliance', 'SOC2');
    }
    finalize() {
        // セキュリティ強化版では最終検証を実行
        this.validateSecuritySettings();
    }
    validateSecuritySettings() {
        if (!this.resources)
            return;
        // パスワードポリシーの検証
        const passwordPolicy = this.config.cognitoConfig.userPool.passwordPolicy;
        if (passwordPolicy.minLength < 8) {
            console.warn('セキュリティ警告: パスワード最小長が8文字未満です');
        }
        // 未認証アクセスの検証
        if (this.config.cognitoConfig.identityPool.allowUnauthenticatedIdentities) {
            console.warn('セキュリティ警告: 未認証アクセスが許可されています');
        }
    }
}
exports.SecureWebAppStack = SecureWebAppStack;
/**
 * 高可用性WebAppスタック実装
 */
class HighAvailabilityWebAppStack extends StandardWebAppStack {
    buildLambdaWebAdapter(userPool, userPoolClient, identityPool) {
        // 高可用性版では異なる設定を使用
        return new lambda_web_adapter_1.LambdaWebAdapter(this, 'NextjsWebApp', {
            wafAttrArn: this.dependencies.securityStack.waf.webAcl.attrArn,
            db: this.dependencies.dataStack.dynamoDb.sessionTable,
            cognito: {
                userPoolId: userPool.userPoolId,
                userPoolClientId: userPoolClient.userPoolClientId,
                identityPoolId: identityPool.ref,
            },
            vpcConfig: this.config.lambdaConfig.vpcConfig,
            imagePath: this.config.lambdaConfig.imagePath,
            tag: this.config.lambdaConfig.tag,
        });
    }
    addTags() {
        super.addTags();
        cdk.Tags.of(this).add('AvailabilityLevel', 'High');
        cdk.Tags.of(this).add('MultiAZ', 'true');
    }
}
exports.HighAvailabilityWebAppStack = HighAvailabilityWebAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLXRlbXBsYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2ViYXBwLXN0YWNrLXRlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUVuQyxpRUFBbUQ7QUFDbkQsdUVBQXlEO0FBRXpELHdGQUFtRjtBQWlCbkY7O0dBRUc7QUFDSCxNQUFzQixtQkFBb0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMvQyxNQUFNLENBQW9CO0lBQzFCLFlBQVksQ0FBMEI7SUFDdEMsU0FBUyxDQUFtQjtJQUV0QyxZQUNFLEtBQWdCLEVBQ2hCLEVBQVUsRUFDVixNQUF5QixFQUN6QixZQUFxQyxFQUNyQyxLQUFzQjtRQUV0QixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztRQUVqQyxlQUFlO1FBQ2YsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFRDs7T0FFRztJQUNLLFVBQVU7UUFDaEIsU0FBUztRQUNULElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUVsQixZQUFZO1FBQ1osSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsWUFBWTtRQUNaLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRXZDLFNBQVM7UUFDVCxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFbkIsVUFBVTtRQUNWLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUVyQixVQUFVO1FBQ1YsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRWYsVUFBVTtRQUNWLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNsQixDQUFDO0lBRUQ7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WUFDN0MsR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUc7U0FDbEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVTLE9BQU87UUFDZixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ25ELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDM0MsQ0FBQztDQUNGO0FBMUJELGtFQTBCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViQXBw44K544K/44OD44KvIOODhuODs+ODl+ODrOODvOODiOODoeOCveODg+ODieODkeOCv+ODvOODs+Wun+ijhVxuICogXG4gKiDjgrnjgr/jg4Pjgq/mp4vnr4njga7lhbHpgJrjg5Xjg63jg7zjgpLlrprnvqnjgZfjgIHlhbfkvZPnmoTjgarlrp/oo4XjgpLlrZDjgq/jg6njgrnjgavlp5TorbJcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuXG5pbXBvcnQgeyBMYW1iZGFXZWJBZGFwdGVyIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9hcGkvY29uc3RydWN0cy9sYW1iZGEtd2ViLWFkYXB0ZXInO1xuaW1wb3J0IHsgV2ViQXBwU3RhY2tDb25maWcsIFdlYkFwcFJlc291cmNlcyB9IGZyb20gJy4vd2ViYXBwLXN0YWNrLWltcHJvdmVkJztcbmltcG9ydCB7IE5ldHdvcmtpbmdTdGFjayB9IGZyb20gJy4vbmV0d29ya2luZy1zdGFjayc7XG5pbXBvcnQgeyBTZWN1cml0eVN0YWNrIH0gZnJvbSAnLi9zZWN1cml0eS1zdGFjayc7XG5pbXBvcnQgeyBEYXRhU3RhY2sgfSBmcm9tICcuL2RhdGEtc3RhY2snO1xuaW1wb3J0IHsgRW1iZWRkaW5nU3RhY2sgfSBmcm9tICcuL2VtYmVkZGluZy1zdGFjayc7XG5cbi8qKlxuICogV2ViQXBw44K544K/44OD44Kv5L6d5a2Y6Zai5L+CXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgV2ViQXBwU3RhY2tEZXBlbmRlbmNpZXMge1xuICByZWFkb25seSBuZXR3b3JraW5nU3RhY2s6IE5ldHdvcmtpbmdTdGFjaztcbiAgcmVhZG9ubHkgc2VjdXJpdHlTdGFjazogU2VjdXJpdHlTdGFjaztcbiAgcmVhZG9ubHkgZGF0YVN0YWNrOiBEYXRhU3RhY2s7XG4gIHJlYWRvbmx5IGVtYmVkZGluZ1N0YWNrOiBFbWJlZGRpbmdTdGFjaztcbn1cblxuLyoqXG4gKiDmir3osaFXZWJBcHDjgrnjgr/jg4Pjgq/vvIhUZW1wbGF0ZSBNZXRob2QgUGF0dGVybu+8iVxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RXZWJBcHBTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHByb3RlY3RlZCBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnO1xuICBwcm90ZWN0ZWQgZGVwZW5kZW5jaWVzOiBXZWJBcHBTdGFja0RlcGVuZGVuY2llcztcbiAgcHJvdGVjdGVkIHJlc291cmNlcz86IFdlYkFwcFJlc291cmNlcztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBzY29wZTogQ29uc3RydWN0LFxuICAgIGlkOiBzdHJpbmcsXG4gICAgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyxcbiAgICBkZXBlbmRlbmNpZXM6IFdlYkFwcFN0YWNrRGVwZW5kZW5jaWVzLFxuICAgIHByb3BzPzogY2RrLlN0YWNrUHJvcHNcbiAgKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy5kZXBlbmRlbmNpZXMgPSBkZXBlbmRlbmNpZXM7XG5cbiAgICAvLyDjg4bjg7Pjg5fjg6zjg7zjg4jjg6Hjgr3jg4Pjg4nlrp/ooYxcbiAgICB0aGlzLmJ1aWxkU3RhY2soKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4bjg7Pjg5fjg6zjg7zjg4jjg6Hjgr3jg4Pjg4kgLSDjgrnjgr/jg4Pjgq/mp4vnr4njga7lhbHpgJrjg5Xjg63jg7xcbiAgICovXG4gIHByaXZhdGUgYnVpbGRTdGFjaygpOiB2b2lkIHtcbiAgICAvLyAxLiDliY3lh6bnkIZcbiAgICB0aGlzLnByZVByb2Nlc3MoKTtcblxuICAgIC8vIDIuIOS+neWtmOmWouS/guioreWumlxuICAgIHRoaXMuc2V0dXBEZXBlbmRlbmNpZXMoKTtcblxuICAgIC8vIDMuIOODquOCveODvOOCueani+eviVxuICAgIHRoaXMucmVzb3VyY2VzID0gdGhpcy5idWlsZFJlc291cmNlcygpO1xuXG4gICAgLy8gNC4g5b6M5Yem55CGXG4gICAgdGhpcy5wb3N0UHJvY2VzcygpO1xuXG4gICAgLy8gNS4g5Ye65Yqb5L2c5oiQXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyA2LiDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFkZFRhZ3MoKTtcblxuICAgIC8vIDcuIOacgOe1guWHpueQhlxuICAgIHRoaXMuZmluYWxpemUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDliY3lh6bnkIbvvIjjgqrjg7zjg5Djg7zjg6njgqTjg4nlj6/og73vvIlcbiAgICovXG4gIHByb3RlY3RlZCBwcmVQcm9jZXNzKCk6IHZvaWQge1xuICAgIC8vIOODh+ODleOCqeODq+ODiOWun+ijheOBr+epulxuICAgIHRoaXMudmFsaWRhdGVDb25maWcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDkvp3lrZjplqLkv4LoqK3lrprvvIjjgqrjg7zjg5Djg7zjg6njgqTjg4nlj6/og73vvIlcbiAgICovXG4gIHByb3RlY3RlZCBzZXR1cERlcGVuZGVuY2llcygpOiB2b2lkIHtcbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4jjgafjga/kvp3lrZjplqLkv4LjgpLoqK3lrprjgZfjgarjgYTvvIhMYW1iZGEgV2ViIEFkYXB0ZXLjgafjga/kuI3opoHvvIlcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6rjgr3jg7zjgrnmp4vnr4nvvIjmir3osaHjg6Hjgr3jg4Pjg4kgLSDlv4XpoIjlrp/oo4XvvIlcbiAgICovXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBidWlsZFJlc291cmNlcygpOiBXZWJBcHBSZXNvdXJjZXM7XG5cbiAgLyoqXG4gICAqIOW+jOWHpueQhu+8iOOCquODvOODkOODvOODqeOCpOODieWPr+iDve+8iVxuICAgKi9cbiAgcHJvdGVjdGVkIHBvc3RQcm9jZXNzKCk6IHZvaWQge1xuICAgIC8vIOODh+ODleOCqeODq+ODiOWun+ijheOBr+epulxuICB9XG5cbiAgLyoqXG4gICAqIOWHuuWKm+S9nOaIkO+8iOaKveixoeODoeOCveODg+ODiSAtIOW/hemgiOWun+ijhe+8iVxuICAgKi9cbiAgcHJvdGVjdGVkIGFic3RyYWN0IGNyZWF0ZU91dHB1dHMoKTogdm9pZDtcblxuICAvKipcbiAgICog44K/44Kw6Kit5a6a77yI44Kq44O844OQ44O844Op44Kk44OJ5Y+v6IO977yJXG4gICAqL1xuICBwcm90ZWN0ZWQgYWRkVGFncygpOiB2b2lkIHtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01vZHVsZScsICdXZWJBcHAnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrVHlwZScsICdJbnRlZ3JhdGVkJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgdGhpcy5jb25maWcucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCB0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdGcm9udGVuZCcsICdOZXh0LmpzJyk7XG4gIH1cblxuICAvKipcbiAgICog5pyA57WC5Yem55CG77yI44Kq44O844OQ44O844Op44Kk44OJ5Y+v6IO977yJXG4gICAqL1xuICBwcm90ZWN0ZWQgZmluYWxpemUoKTogdm9pZCB7XG4gICAgLy8g44OH44OV44Kp44Or44OI5a6f6KOF44Gv56m6XG4gIH1cblxuICAvKipcbiAgICog6Kit5a6a5qSc6Ki877yI5YWx6YCa5Yem55CG77yJXG4gICAqL1xuICBwcm90ZWN0ZWQgdmFsaWRhdGVDb25maWcoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5wcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jga/lv4XpoIjjgafjgZknKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5lbnZpcm9ubWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfnkrDlooPlkI3jga/lv4XpoIjjgafjgZknKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5jb2duaXRvQ29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvZ25pdG/oqK3lrprjga/lv4XpoIjjgafjgZknKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5sYW1iZGFDb25maWcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTGFtYmRh6Kit5a6a44Gv5b+F6aCI44Gn44GZJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODquOCveODvOOCueWQjeeUn+aIkOODmOODq+ODkeODvFxuICAgKi9cbiAgcHJvdGVjdGVkIGdlbmVyYXRlUmVzb3VyY2VOYW1lKHN1ZmZpeDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jb25maWcucHJvamVjdE5hbWV9LSR7dGhpcy5jb25maWcuZW52aXJvbm1lbnR9LSR7c3VmZml4fWA7XG4gIH1cblxuICAvKipcbiAgICog5YWs6ZaL44OX44Ot44OR44OG44KjXG4gICAqL1xuICBwdWJsaWMgZ2V0UmVzb3VyY2VzKCk6IFdlYkFwcFJlc291cmNlcyB7XG4gICAgaWYgKCF0aGlzLnJlc291cmNlcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg6rjgr3jg7zjgrnjgYzmp4vnr4njgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzO1xuICB9XG5cbiAgcHVibGljIGdldENvbmZpZygpOiBXZWJBcHBTdGFja0NvbmZpZyB7XG4gICAgcmV0dXJuIHRoaXMuY29uZmlnO1xuICB9XG59XG5cbi8qKlxuICog5qiZ5rqWV2ViQXBw44K544K/44OD44Kv5a6f6KOFXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGFuZGFyZFdlYkFwcFN0YWNrIGV4dGVuZHMgQWJzdHJhY3RXZWJBcHBTdGFjayB7XG4gIHByb3RlY3RlZCBidWlsZFJlc291cmNlcygpOiBXZWJBcHBSZXNvdXJjZXMge1xuICAgIC8vIENvZ25pdG/jg6rjgr3jg7zjgrnmp4vnr4lcbiAgICBjb25zdCB1c2VyUG9vbCA9IHRoaXMuYnVpbGRVc2VyUG9vbCgpO1xuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gdGhpcy5idWlsZFVzZXJQb29sQ2xpZW50KHVzZXJQb29sKTtcbiAgICBjb25zdCBpZGVudGl0eVBvb2wgPSB0aGlzLmJ1aWxkSWRlbnRpdHlQb29sKHVzZXJQb29sLCB1c2VyUG9vbENsaWVudCk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheeODquOCveODvOOCueani+eviVxuICAgIGNvbnN0IGFwaUdhdGV3YXkgPSB0aGlzLmJ1aWxkQXBpR2F0ZXdheSgpO1xuXG4gICAgLy8gTGFtYmRhIFdlYiBBZGFwdGVy44Oq44K944O844K55qeL56+JXG4gICAgY29uc3Qgd2ViQWRhcHRlciA9IHRoaXMuYnVpbGRMYW1iZGFXZWJBZGFwdGVyKHVzZXJQb29sLCB1c2VyUG9vbENsaWVudCwgaWRlbnRpdHlQb29sKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIHVzZXJQb29sQ2xpZW50LFxuICAgICAgaWRlbnRpdHlQb29sLFxuICAgICAgYXBpR2F0ZXdheSxcbiAgICAgIHdlYkFkYXB0ZXIsXG4gICAgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCBidWlsZFVzZXJQb29sKCk6IGNvZ25pdG8uVXNlclBvb2wge1xuICAgIGNvbnN0IHVzZXJQb29sQ29uZmlnID0gdGhpcy5jb25maWcuY29nbml0b0NvbmZpZy51c2VyUG9vbDtcbiAgICBcbiAgICByZXR1cm4gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiB0aGlzLmdlbmVyYXRlUmVzb3VyY2VOYW1lKCd1c2VycycpLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHVzZXJQb29sQ29uZmlnLnNlbGZTaWduVXBFbmFibGVkLFxuICAgICAgc2lnbkluQWxpYXNlczogdXNlclBvb2xDb25maWcuc2lnbkluQWxpYXNlcyxcbiAgICAgIGF1dG9WZXJpZnk6IHVzZXJQb29sQ29uZmlnLmF1dG9WZXJpZnksXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IHVzZXJQb29sQ29uZmlnLnBhc3N3b3JkUG9saWN5Lm1pbkxlbmd0aCxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdXNlclBvb2xDb25maWcucGFzc3dvcmRQb2xpY3kucmVxdWlyZUxvd2VyY2FzZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdXNlclBvb2xDb25maWcucGFzc3dvcmRQb2xpY3kucmVxdWlyZVVwcGVyY2FzZSxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdXNlclBvb2xDb25maWcucGFzc3dvcmRQb2xpY3kucmVxdWlyZURpZ2l0cyxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHVzZXJQb29sQ29uZmlnLnBhc3N3b3JkUG9saWN5LnJlcXVpcmVTeW1ib2xzLFxuICAgICAgfSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHVzZXJQb29sQ29uZmlnLnJlbW92YWxQb2xpY3ksXG4gICAgfSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYnVpbGRVc2VyUG9vbENsaWVudCh1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbCk6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQge1xuICAgIGNvbnN0IGNsaWVudENvbmZpZyA9IHRoaXMuY29uZmlnLmNvZ25pdG9Db25maWcudXNlclBvb2xDbGllbnQ7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdVc2VyUG9vbENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiB0aGlzLmdlbmVyYXRlUmVzb3VyY2VOYW1lKCdjbGllbnQnKSxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBjbGllbnRDb25maWcuZ2VuZXJhdGVTZWNyZXQsXG4gICAgICBhdXRoRmxvd3M6IGNsaWVudENvbmZpZy5hdXRoRmxvd3MsXG4gICAgfSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYnVpbGRJZGVudGl0eVBvb2woXG4gICAgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2wsXG4gICAgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnRcbiAgKTogY29nbml0by5DZm5JZGVudGl0eVBvb2wge1xuICAgIGNvbnN0IGlkZW50aXR5Q29uZmlnID0gdGhpcy5jb25maWcuY29nbml0b0NvbmZpZy5pZGVudGl0eVBvb2w7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbCh0aGlzLCAnSWRlbnRpdHlQb29sJywge1xuICAgICAgaWRlbnRpdHlQb29sTmFtZTogdGhpcy5nZW5lcmF0ZVJlc291cmNlTmFtZSgnaWRlbnRpdHknKSxcbiAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogaWRlbnRpdHlDb25maWcuYWxsb3dVbmF1dGhlbnRpY2F0ZWRJZGVudGl0aWVzLFxuICAgICAgY29nbml0b0lkZW50aXR5UHJvdmlkZXJzOiBbe1xuICAgICAgICBjbGllbnRJZDogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgcHJvdmlkZXJOYW1lOiB1c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZSxcbiAgICAgIH1dLFxuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIGJ1aWxkQXBpR2F0ZXdheSgpOiBhcGlnYXRld2F5LlJlc3RBcGkge1xuICAgIHJldHVybiBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdBcGlHYXRld2F5Jywge1xuICAgICAgcmVzdEFwaU5hbWU6IHRoaXMuZ2VuZXJhdGVSZXNvdXJjZU5hbWUoJ2FwaScpLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uLWF3YXJlIFJBRyBTeXN0ZW0gQVBJJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleSddLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBidWlsZExhbWJkYVdlYkFkYXB0ZXIoXG4gICAgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2wsXG4gICAgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uVXNlclBvb2xDbGllbnQsXG4gICAgaWRlbnRpdHlQb29sOiBjb2duaXRvLkNmbklkZW50aXR5UG9vbFxuICApOiBMYW1iZGFXZWJBZGFwdGVyIHtcbiAgICByZXR1cm4gbmV3IExhbWJkYVdlYkFkYXB0ZXIodGhpcywgJ05leHRqc1dlYkFwcCcsIHtcbiAgICAgIHdhZkF0dHJBcm46IHRoaXMuZGVwZW5kZW5jaWVzLnNlY3VyaXR5U3RhY2sud2FmLndlYkFjbC5hdHRyQXJuLFxuICAgICAgZGI6IHRoaXMuZGVwZW5kZW5jaWVzLmRhdGFTdGFjay5keW5hbW9EYi5zZXNzaW9uVGFibGUsXG4gICAgICBjb2duaXRvOiB7XG4gICAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIHVzZXJQb29sQ2xpZW50SWQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIGlkZW50aXR5UG9vbElkOiBpZGVudGl0eVBvb2wucmVmLFxuICAgICAgfSxcbiAgICAgIHZwY0NvbmZpZzogdGhpcy5jb25maWcubGFtYmRhQ29uZmlnLnZwY0NvbmZpZyxcbiAgICAgIGltYWdlUGF0aDogdGhpcy5jb25maWcubGFtYmRhQ29uZmlnLmltYWdlUGF0aCxcbiAgICAgIHRhZzogdGhpcy5jb25maWcubGFtYmRhQ29uZmlnLnRhZyxcbiAgICB9KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNvdXJjZXMpIHJldHVybjtcblxuICAgIGNvbnN0IG91dHB1dENvbmZpZyA9IHRoaXMuY29uZmlnLm91dHB1dENvbmZpZztcblxuICAgIGlmIChvdXRwdXRDb25maWcuZW5hYmxlQ29nbml0b091dHB1dHMpIHtcbiAgICAgIHRoaXMuY3JlYXRlQ29nbml0b091dHB1dHMoKTtcbiAgICB9XG5cbiAgICBpZiAob3V0cHV0Q29uZmlnLmVuYWJsZUFwaUdhdGV3YXlPdXRwdXRzKSB7XG4gICAgICB0aGlzLmNyZWF0ZUFwaUdhdGV3YXlPdXRwdXRzKCk7XG4gICAgfVxuXG4gICAgaWYgKG91dHB1dENvbmZpZy5lbmFibGVMYW1iZGFPdXRwdXRzKSB7XG4gICAgICB0aGlzLmNyZWF0ZUxhbWJkYU91dHB1dHMoKTtcbiAgICB9XG5cbiAgICBpZiAob3V0cHV0Q29uZmlnLmVuYWJsZUVudmlyb25tZW50VmFyaWFibGVzKSB7XG4gICAgICB0aGlzLmNyZWF0ZUVudmlyb25tZW50VmFyaWFibGVPdXRwdXRzKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVDb2duaXRvT3V0cHV0cygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzb3VyY2VzKSByZXR1cm47XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc291cmNlcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tVXNlclBvb2xJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc291cmNlcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJQb29sQ2xpZW50SWRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0lkZW50aXR5UG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMucmVzb3VyY2VzLmlkZW50aXR5UG9vbC5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gSWRlbnRpdHkgUG9vbCBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tSWRlbnRpdHlQb29sSWRgLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBcGlHYXRld2F5T3V0cHV0cygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzb3VyY2VzKSByZXR1cm47XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc291cmNlcy5hcGlHYXRld2F5LnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BcGlHYXRld2F5VXJsYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXNvdXJjZXMuYXBpR2F0ZXdheS5yZXN0QXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BcGlHYXRld2F5SWRgLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFPdXRwdXRzKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5yZXNvdXJjZXMpIHJldHVybjtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJBcHBVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXNvdXJjZXMud2ViQWRhcHRlci5mdW5jdGlvblVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTmV4dC5qcyBXZWJBcHAgVVJMIChMYW1iZGEgV2ViIEFkYXB0ZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XZWJBcHBVcmxgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYkFwcEZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc291cmNlcy53ZWJBZGFwdGVyLmxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05leHQuanMgV2ViQXBwIExhbWJkYSBGdW5jdGlvbiBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XZWJBcHBGdW5jdGlvbk5hbWVgLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFbnZpcm9ubWVudFZhcmlhYmxlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucmVzb3VyY2VzKSByZXR1cm47XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTmV4dEpzRW52VmFycycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIE5FWFRfUFVCTElDX0FQSV9VUkw6IHRoaXMucmVzb3VyY2VzLmFwaUdhdGV3YXkudXJsLFxuICAgICAgICBORVhUX1BVQkxJQ19VU0VSX1BPT0xfSUQ6IHRoaXMucmVzb3VyY2VzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIE5FWFRfUFVCTElDX1VTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMucmVzb3VyY2VzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIE5FWFRfUFVCTElDX0lERU5USVRZX1BPT0xfSUQ6IHRoaXMucmVzb3VyY2VzLmlkZW50aXR5UG9vbC5yZWYsXG4gICAgICAgIE5FWFRfUFVCTElDX1dFQkFQUF9VUkw6IHRoaXMucmVzb3VyY2VzLndlYkFkYXB0ZXIuZnVuY3Rpb25VcmwsXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTmV4dC5qcyBFbnZpcm9ubWVudCBWYXJpYWJsZXMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LU5leHRKc0VudlZhcnNgLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICog44K744Kt44Ol44Oq44OG44Kj5by35YyWV2ViQXBw44K544K/44OD44Kv5a6f6KOFXG4gKi9cbmV4cG9ydCBjbGFzcyBTZWN1cmVXZWJBcHBTdGFjayBleHRlbmRzIFN0YW5kYXJkV2ViQXBwU3RhY2sge1xuICBwcm90ZWN0ZWQgc2V0dXBEZXBlbmRlbmNpZXMoKTogdm9pZCB7XG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj5by35YyW54mI44Gn44Gv5L6d5a2Y6Zai5L+C44KS5piO56S655qE44Gr6Kit5a6aXG4gICAgdGhpcy5hZGREZXBlbmRlbmN5KHRoaXMuZGVwZW5kZW5jaWVzLm5ldHdvcmtpbmdTdGFjayk7XG4gICAgdGhpcy5hZGREZXBlbmRlbmN5KHRoaXMuZGVwZW5kZW5jaWVzLnNlY3VyaXR5U3RhY2spO1xuICAgIHRoaXMuYWRkRGVwZW5kZW5jeSh0aGlzLmRlcGVuZGVuY2llcy5kYXRhU3RhY2spO1xuICAgIHRoaXMuYWRkRGVwZW5kZW5jeSh0aGlzLmRlcGVuZGVuY2llcy5lbWJlZGRpbmdTdGFjayk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYWRkVGFncygpOiB2b2lkIHtcbiAgICBzdXBlci5hZGRUYWdzKCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZWN1cml0eUxldmVsJywgJ0VuaGFuY2VkJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wbGlhbmNlJywgJ1NPQzInKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBmaW5hbGl6ZSgpOiB2b2lkIHtcbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPlvLfljJbniYjjgafjga/mnIDntYLmpJzoqLzjgpLlrp/ooYxcbiAgICB0aGlzLnZhbGlkYXRlU2VjdXJpdHlTZXR0aW5ncygpO1xuICB9XG5cbiAgcHJpdmF0ZSB2YWxpZGF0ZVNlY3VyaXR5U2V0dGluZ3MoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnJlc291cmNlcykgcmV0dXJuO1xuXG4gICAgLy8g44OR44K544Ov44O844OJ44Od44Oq44K344O844Gu5qSc6Ki8XG4gICAgY29uc3QgcGFzc3dvcmRQb2xpY3kgPSB0aGlzLmNvbmZpZy5jb2duaXRvQ29uZmlnLnVzZXJQb29sLnBhc3N3b3JkUG9saWN5O1xuICAgIGlmIChwYXNzd29yZFBvbGljeS5taW5MZW5ndGggPCA4KSB7XG4gICAgICBjb25zb2xlLndhcm4oJ+OCu+OCreODpeODquODhuOCo+itpuWRijog44OR44K544Ov44O844OJ5pyA5bCP6ZW344GMOOaWh+Wtl+acqua6gOOBp+OBmScpO1xuICAgIH1cblxuICAgIC8vIOacquiqjeiovOOCouOCr+OCu+OCueOBruaknOiovFxuICAgIGlmICh0aGlzLmNvbmZpZy5jb2duaXRvQ29uZmlnLmlkZW50aXR5UG9vbC5hbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXMpIHtcbiAgICAgIGNvbnNvbGUud2Fybign44K744Kt44Ol44Oq44OG44Kj6K2m5ZGKOiDmnKroqo3oqLzjgqLjgq/jgrvjgrnjgYzoqLHlj6/jgZXjgozjgabjgYTjgb7jgZknKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiDpq5jlj6/nlKjmgKdXZWJBcHDjgrnjgr/jg4Pjgq/lrp/oo4VcbiAqL1xuZXhwb3J0IGNsYXNzIEhpZ2hBdmFpbGFiaWxpdHlXZWJBcHBTdGFjayBleHRlbmRzIFN0YW5kYXJkV2ViQXBwU3RhY2sge1xuICBwcm90ZWN0ZWQgYnVpbGRMYW1iZGFXZWJBZGFwdGVyKFxuICAgIHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sLFxuICAgIHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50LFxuICAgIGlkZW50aXR5UG9vbDogY29nbml0by5DZm5JZGVudGl0eVBvb2xcbiAgKTogTGFtYmRhV2ViQWRhcHRlciB7XG4gICAgLy8g6auY5Y+v55So5oCn54mI44Gn44Gv55Ww44Gq44KL6Kit5a6a44KS5L2/55SoXG4gICAgcmV0dXJuIG5ldyBMYW1iZGFXZWJBZGFwdGVyKHRoaXMsICdOZXh0anNXZWJBcHAnLCB7XG4gICAgICB3YWZBdHRyQXJuOiB0aGlzLmRlcGVuZGVuY2llcy5zZWN1cml0eVN0YWNrLndhZi53ZWJBY2wuYXR0ckFybixcbiAgICAgIGRiOiB0aGlzLmRlcGVuZGVuY2llcy5kYXRhU3RhY2suZHluYW1vRGIuc2Vzc2lvblRhYmxlLFxuICAgICAgY29nbml0bzoge1xuICAgICAgICB1c2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICB1c2VyUG9vbENsaWVudElkOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBpZGVudGl0eVBvb2xJZDogaWRlbnRpdHlQb29sLnJlZixcbiAgICAgIH0sXG4gICAgICB2cGNDb25maWc6IHRoaXMuY29uZmlnLmxhbWJkYUNvbmZpZy52cGNDb25maWcsXG4gICAgICBpbWFnZVBhdGg6IHRoaXMuY29uZmlnLmxhbWJkYUNvbmZpZy5pbWFnZVBhdGgsXG4gICAgICB0YWc6IHRoaXMuY29uZmlnLmxhbWJkYUNvbmZpZy50YWcsXG4gICAgfSk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYWRkVGFncygpOiB2b2lkIHtcbiAgICBzdXBlci5hZGRUYWdzKCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdBdmFpbGFiaWxpdHlMZXZlbCcsICdIaWdoJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNdWx0aUFaJywgJ3RydWUnKTtcbiAgfVxufSJdfQ==