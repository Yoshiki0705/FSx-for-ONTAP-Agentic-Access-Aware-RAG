"use strict";
/**
 * WebAppスタック戦略パターン実装
 *
 * 異なる環境・用途に応じた設定戦略を提供
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
exports.WebAppConfigContext = exports.WebAppConfigStrategyFactory = exports.EnterpriseConfigStrategy = exports.ProductionConfigStrategy = exports.StagingConfigStrategy = exports.DevelopmentConfigStrategy = exports.WebAppConfigStrategy = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
/**
 * 抽象設定戦略
 */
class WebAppConfigStrategy {
    createFullConfig(projectName, environment) {
        return {
            projectName,
            environment,
            cognitoConfig: this.createCognitoConfig(projectName, environment),
            lambdaConfig: this.createLambdaConfig(),
            outputConfig: this.createOutputConfig(),
        };
    }
}
exports.WebAppConfigStrategy = WebAppConfigStrategy;
/**
 * 開発環境戦略
 */
class DevelopmentConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName, environment) {
        return {
            userPool: {
                selfSignUpEnabled: true,
                passwordPolicy: {
                    minLength: 6, // 開発環境では緩い設定
                    requireLowercase: true,
                    requireUppercase: false,
                    requireDigits: true,
                    requireSymbols: false,
                },
                signInAliases: {
                    email: true,
                    username: true,
                },
                autoVerify: {
                    email: true,
                },
                removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境では削除可能
            },
            userPoolClient: {
                generateSecret: false,
                authFlows: {
                    userPassword: true,
                    userSrp: true,
                    adminUserPassword: true, // 開発環境では管理者パスワード認証も有効
                },
            },
            identityPool: {
                allowUnauthenticatedIdentities: true, // 開発環境では未認証アクセス許可
            },
        };
    }
    createLambdaConfig() {
        return {
            imagePath: './docker',
            tag: 'dev',
            vpcConfig: null, // 開発環境ではVPCなし
        };
    }
    createOutputConfig() {
        return {
            enableCognitoOutputs: true,
            enableApiGatewayOutputs: true,
            enableLambdaOutputs: true,
            enableEnvironmentVariables: true, // 開発環境では全出力有効
        };
    }
}
exports.DevelopmentConfigStrategy = DevelopmentConfigStrategy;
/**
 * ステージング環境戦略
 */
class StagingConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName, environment) {
        return {
            userPool: {
                selfSignUpEnabled: true,
                passwordPolicy: {
                    minLength: 8,
                    requireLowercase: true,
                    requireUppercase: true,
                    requireDigits: true,
                    requireSymbols: false,
                },
                signInAliases: {
                    email: true,
                    username: true,
                },
                autoVerify: {
                    email: true,
                },
                removalPolicy: cdk.RemovalPolicy.RETAIN, // ステージングでは保持
            },
            userPoolClient: {
                generateSecret: false,
                authFlows: {
                    userPassword: true,
                    userSrp: true,
                },
            },
            identityPool: {
                allowUnauthenticatedIdentities: false,
            },
        };
    }
    createLambdaConfig() {
        return {
            imagePath: './docker',
            tag: 'staging',
            vpcConfig: null,
        };
    }
    createOutputConfig() {
        return {
            enableCognitoOutputs: true,
            enableApiGatewayOutputs: true,
            enableLambdaOutputs: true,
            enableEnvironmentVariables: false, // ステージングでは環境変数出力無効
        };
    }
}
exports.StagingConfigStrategy = StagingConfigStrategy;
/**
 * 本番環境戦略
 */
class ProductionConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName, environment) {
        return {
            userPool: {
                selfSignUpEnabled: false, // 本番では管理者作成のみ
                passwordPolicy: {
                    minLength: 12, // 本番では厳格なパスワード
                    requireLowercase: true,
                    requireUppercase: true,
                    requireDigits: true,
                    requireSymbols: true,
                },
                signInAliases: {
                    email: true,
                    username: false, // 本番ではメールのみ
                },
                autoVerify: {
                    email: true,
                },
                removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番では必ず保持
            },
            userPoolClient: {
                generateSecret: true, // 本番ではシークレット生成
                authFlows: {
                    userSrp: true, // 本番ではSRPのみ
                },
            },
            identityPool: {
                allowUnauthenticatedIdentities: false,
            },
        };
    }
    createLambdaConfig() {
        return {
            imagePath: './docker',
            tag: 'latest',
            vpcConfig: null, // 本番でもVPCは要件次第
        };
    }
    createOutputConfig() {
        return {
            enableCognitoOutputs: true,
            enableApiGatewayOutputs: true,
            enableLambdaOutputs: false, // 本番ではLambda出力無効
            enableEnvironmentVariables: false, // 本番では環境変数出力無効
        };
    }
}
exports.ProductionConfigStrategy = ProductionConfigStrategy;
/**
 * エンタープライズ環境戦略
 */
class EnterpriseConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName, environment) {
        return {
            userPool: {
                selfSignUpEnabled: false,
                passwordPolicy: {
                    minLength: 14, // エンタープライズでは最も厳格
                    requireLowercase: true,
                    requireUppercase: true,
                    requireDigits: true,
                    requireSymbols: true,
                },
                signInAliases: {
                    email: true,
                    username: false,
                },
                autoVerify: {
                    email: true,
                },
                removalPolicy: cdk.RemovalPolicy.RETAIN,
            },
            userPoolClient: {
                generateSecret: true,
                authFlows: {
                    userSrp: true,
                },
            },
            identityPool: {
                allowUnauthenticatedIdentities: false,
            },
        };
    }
    createLambdaConfig() {
        return {
            imagePath: './docker',
            tag: 'enterprise',
            vpcConfig: null, // エンタープライズではVPC必須の場合が多い
        };
    }
    createOutputConfig() {
        return {
            enableCognitoOutputs: false, // エンタープライズでは出力最小化
            enableApiGatewayOutputs: false,
            enableLambdaOutputs: false,
            enableEnvironmentVariables: false,
        };
    }
}
exports.EnterpriseConfigStrategy = EnterpriseConfigStrategy;
/**
 * 設定戦略ファクトリー
 */
class WebAppConfigStrategyFactory {
    static createStrategy(environment) {
        switch (environment.toLowerCase()) {
            case 'dev':
            case 'development':
                return new DevelopmentConfigStrategy();
            case 'staging':
            case 'stage':
                return new StagingConfigStrategy();
            case 'prod':
            case 'production':
                return new ProductionConfigStrategy();
            case 'enterprise':
            case 'ent':
                return new EnterpriseConfigStrategy();
            default:
                throw new Error(`サポートされていない環境: ${environment}`);
        }
    }
    static getSupportedEnvironments() {
        return ['dev', 'development', 'staging', 'stage', 'prod', 'production', 'enterprise', 'ent'];
    }
}
exports.WebAppConfigStrategyFactory = WebAppConfigStrategyFactory;
/**
 * 設定戦略コンテキスト
 */
class WebAppConfigContext {
    strategy;
    constructor(environment) {
        this.strategy = WebAppConfigStrategyFactory.createStrategy(environment);
    }
    setStrategy(strategy) {
        this.strategy = strategy;
    }
    createConfig(projectName, environment) {
        return this.strategy.createFullConfig(projectName, environment);
    }
    getCognitoConfig(projectName, environment) {
        return this.strategy.createCognitoConfig(projectName, environment);
    }
    getLambdaConfig() {
        return this.strategy.createLambdaConfig();
    }
    getOutputConfig() {
        return this.strategy.createOutputConfig();
    }
}
exports.WebAppConfigContext = WebAppConfigContext;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLXN0cmF0ZWdpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3ZWJhcHAtc3RhY2stc3RyYXRlZ2llcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFJbkM7O0dBRUc7QUFDSCxNQUFzQixvQkFBb0I7SUFLeEMsZ0JBQWdCLENBQUMsV0FBbUIsRUFBRSxXQUFtQjtRQUN2RCxPQUFPO1lBQ0wsV0FBVztZQUNYLFdBQVc7WUFDWCxhQUFhLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUM7WUFDakUsWUFBWSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtZQUN2QyxZQUFZLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFO1NBQ3hDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFkRCxvREFjQztBQUVEOztHQUVHO0FBQ0gsTUFBYSx5QkFBMEIsU0FBUSxvQkFBb0I7SUFDakUsbUJBQW1CLENBQUMsV0FBbUIsRUFBRSxXQUFtQjtRQUMxRCxPQUFPO1lBQ0wsUUFBUSxFQUFFO2dCQUNSLGlCQUFpQixFQUFFLElBQUk7Z0JBQ3ZCLGNBQWMsRUFBRTtvQkFDZCxTQUFTLEVBQUUsQ0FBQyxFQUFFLGFBQWE7b0JBQzNCLGdCQUFnQixFQUFFLElBQUk7b0JBQ3RCLGdCQUFnQixFQUFFLEtBQUs7b0JBQ3ZCLGFBQWEsRUFBRSxJQUFJO29CQUNuQixjQUFjLEVBQUUsS0FBSztpQkFDdEI7Z0JBQ0QsYUFBYSxFQUFFO29CQUNiLEtBQUssRUFBRSxJQUFJO29CQUNYLFFBQVEsRUFBRSxJQUFJO2lCQUNmO2dCQUNELFVBQVUsRUFBRTtvQkFDVixLQUFLLEVBQUUsSUFBSTtpQkFDWjtnQkFDRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsYUFBYTthQUN4RDtZQUNELGNBQWMsRUFBRTtnQkFD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UUFDN0IsT0FBTyxDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvRixDQUFDO0NBQ0Y7QUEzQkQsa0VBMkJDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLG1CQUFtQjtJQUN0QixRQUFRLENBQXVCO0lBRXZDLFlBQVksV0FBbUI7UUFDN0IsSUFBSSxDQUFDLFFBQVEsR0FBRywyQkFBMkIsQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVELFdBQVcsQ0FBQyxRQUE4QjtRQUN4QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztJQUMzQixDQUFDO0lBRUQsWUFBWSxDQUFDLFdBQW1CLEVBQUUsV0FBbUI7UUFDbkQsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsV0FBbUIsRUFBRSxXQUFtQjtRQUN2RCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7SUFFRCxlQUFlO1FBQ2IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDNUMsQ0FBQztJQUVELGVBQWU7UUFDYixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUM1QyxDQUFDO0NBQ0Y7QUExQkQsa0RBMEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBXZWJBcHDjgrnjgr/jg4Pjgq/miKbnlaXjg5Hjgr/jg7zjg7Plrp/oo4VcbiAqIFxuICog55Ww44Gq44KL55Kw5aKD44O755So6YCU44Gr5b+c44GY44Gf6Kit5a6a5oim55Wl44KS5o+Q5L6bXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0IHsgV2ViQXBwU3RhY2tDb25maWcsIENvZ25pdG9TdGFja0NvbmZpZywgTGFtYmRhV2ViQWRhcHRlckNvbmZpZywgT3V0cHV0Q29uZmlnIH0gZnJvbSAnLi93ZWJhcHAtc3RhY2staW1wcm92ZWQnO1xuXG4vKipcbiAqIOaKveixoeioreWumuaIpueVpVxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgV2ViQXBwQ29uZmlnU3RyYXRlZ3kge1xuICBhYnN0cmFjdCBjcmVhdGVDb2duaXRvQ29uZmlnKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiBDb2duaXRvU3RhY2tDb25maWc7XG4gIGFic3RyYWN0IGNyZWF0ZUxhbWJkYUNvbmZpZygpOiBMYW1iZGFXZWJBZGFwdGVyQ29uZmlnO1xuICBhYnN0cmFjdCBjcmVhdGVPdXRwdXRDb25maWcoKTogT3V0cHV0Q29uZmlnO1xuICBcbiAgY3JlYXRlRnVsbENvbmZpZyhwcm9qZWN0TmFtZTogc3RyaW5nLCBlbnZpcm9ubWVudDogc3RyaW5nKTogT21pdDxXZWJBcHBTdGFja0NvbmZpZywgJ2FwaUNvbmZpZyc+IHtcbiAgICByZXR1cm4ge1xuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIGNvZ25pdG9Db25maWc6IHRoaXMuY3JlYXRlQ29nbml0b0NvbmZpZyhwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpLFxuICAgICAgbGFtYmRhQ29uZmlnOiB0aGlzLmNyZWF0ZUxhbWJkYUNvbmZpZygpLFxuICAgICAgb3V0cHV0Q29uZmlnOiB0aGlzLmNyZWF0ZU91dHB1dENvbmZpZygpLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiDplovnmbrnkrDlooPmiKbnlaVcbiAqL1xuZXhwb3J0IGNsYXNzIERldmVsb3BtZW50Q29uZmlnU3RyYXRlZ3kgZXh0ZW5kcyBXZWJBcHBDb25maWdTdHJhdGVneSB7XG4gIGNyZWF0ZUNvZ25pdG9Db25maWcocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IENvZ25pdG9TdGFja0NvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHVzZXJQb29sOiB7XG4gICAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICAgIG1pbkxlbmd0aDogNiwgLy8g6ZaL55m655Kw5aKD44Gn44Gv57ep44GE6Kit5a6aXG4gICAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiBmYWxzZSxcbiAgICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIHVzZXJuYW1lOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIOmWi+eZuueSsOWig+OBp+OBr+WJiumZpOWPr+iDvVxuICAgICAgfSxcbiAgICAgIHVzZXJQb29sQ2xpZW50OiB7XG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IHRydWUsIC8vIOmWi+eZuueSsOWig+OBp+OBr+euoeeQhuiAheODkeOCueODr+ODvOODieiqjeiovOOCguacieWKuVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGlkZW50aXR5UG9vbDoge1xuICAgICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IHRydWUsIC8vIOmWi+eZuueSsOWig+OBp+OBr+acquiqjeiovOOCouOCr+OCu+OCueioseWPr1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlTGFtYmRhQ29uZmlnKCk6IExhbWJkYVdlYkFkYXB0ZXJDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBpbWFnZVBhdGg6ICcuL2RvY2tlcicsXG4gICAgICB0YWc6ICdkZXYnLFxuICAgICAgdnBjQ29uZmlnOiBudWxsLCAvLyDplovnmbrnkrDlooPjgafjga9WUEPjgarjgZdcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlT3V0cHV0Q29uZmlnKCk6IE91dHB1dENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVuYWJsZUNvZ25pdG9PdXRwdXRzOiB0cnVlLFxuICAgICAgZW5hYmxlQXBpR2F0ZXdheU91dHB1dHM6IHRydWUsXG4gICAgICBlbmFibGVMYW1iZGFPdXRwdXRzOiB0cnVlLFxuICAgICAgZW5hYmxlRW52aXJvbm1lbnRWYXJpYWJsZXM6IHRydWUsIC8vIOmWi+eZuueSsOWig+OBp+OBr+WFqOWHuuWKm+acieWKuVxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiDjgrnjg4bjg7zjgrjjg7PjgrDnkrDlooPmiKbnlaVcbiAqL1xuZXhwb3J0IGNsYXNzIFN0YWdpbmdDb25maWdTdHJhdGVneSBleHRlbmRzIFdlYkFwcENvbmZpZ1N0cmF0ZWd5IHtcbiAgY3JlYXRlQ29nbml0b0NvbmZpZyhwcm9qZWN0TmFtZTogc3RyaW5nLCBlbnZpcm9ubWVudDogc3RyaW5nKTogQ29nbml0b1N0YWNrQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgdXNlclBvb2w6IHtcbiAgICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIHVzZXJuYW1lOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBhdXRvVmVyaWZ5OiB7XG4gICAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiwgLy8g44K544OG44O844K444Oz44Kw44Gn44Gv5L+d5oyBXG4gICAgICB9LFxuICAgICAgdXNlclBvb2xDbGllbnQ6IHtcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBpZGVudGl0eVBvb2w6IHtcbiAgICAgICAgYWxsb3dVbmF1dGhlbnRpY2F0ZWRJZGVudGl0aWVzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIGNyZWF0ZUxhbWJkYUNvbmZpZygpOiBMYW1iZGFXZWJBZGFwdGVyQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgaW1hZ2VQYXRoOiAnLi9kb2NrZXInLFxuICAgICAgdGFnOiAnc3RhZ2luZycsXG4gICAgICB2cGNDb25maWc6IG51bGwsXG4gICAgfTtcbiAgfVxuXG4gIGNyZWF0ZU91dHB1dENvbmZpZygpOiBPdXRwdXRDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBlbmFibGVDb2duaXRvT3V0cHV0czogdHJ1ZSxcbiAgICAgIGVuYWJsZUFwaUdhdGV3YXlPdXRwdXRzOiB0cnVlLFxuICAgICAgZW5hYmxlTGFtYmRhT3V0cHV0czogdHJ1ZSxcbiAgICAgIGVuYWJsZUVudmlyb25tZW50VmFyaWFibGVzOiBmYWxzZSwgLy8g44K544OG44O844K444Oz44Kw44Gn44Gv55Kw5aKD5aSJ5pWw5Ye65Yqb54Sh5Yq5XG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIOacrOeVqueSsOWig+aIpueVpVxuICovXG5leHBvcnQgY2xhc3MgUHJvZHVjdGlvbkNvbmZpZ1N0cmF0ZWd5IGV4dGVuZHMgV2ViQXBwQ29uZmlnU3RyYXRlZ3kge1xuICBjcmVhdGVDb2duaXRvQ29uZmlnKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiBDb2duaXRvU3RhY2tDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICB1c2VyUG9vbDoge1xuICAgICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsIC8vIOacrOeVquOBp+OBr+euoeeQhuiAheS9nOaIkOOBruOBv1xuICAgICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICAgIG1pbkxlbmd0aDogMTIsIC8vIOacrOeVquOBp+OBr+WOs+agvOOBquODkeOCueODr+ODvOODiVxuICAgICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgICAgdXNlcm5hbWU6IGZhbHNlLCAvLyDmnKznlarjgafjga/jg6Hjg7zjg6vjga7jgb9cbiAgICAgICAgfSxcbiAgICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sIC8vIOacrOeVquOBp+OBr+W/heOBmuS/neaMgVxuICAgICAgfSxcbiAgICAgIHVzZXJQb29sQ2xpZW50OiB7XG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiB0cnVlLCAvLyDmnKznlarjgafjga/jgrfjg7zjgq/jg6zjg4Pjg4jnlJ/miJBcbiAgICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgICAgdXNlclNycDogdHJ1ZSwgLy8g5pys55Wq44Gn44GvU1JQ44Gu44G/XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgaWRlbnRpdHlQb29sOiB7XG4gICAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogZmFsc2UsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBjcmVhdGVMYW1iZGFDb25maWcoKTogTGFtYmRhV2ViQWRhcHRlckNvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGltYWdlUGF0aDogJy4vZG9ja2VyJyxcbiAgICAgIHRhZzogJ2xhdGVzdCcsXG4gICAgICB2cGNDb25maWc6IG51bGwsIC8vIOacrOeVquOBp+OCglZQQ+OBr+imgeS7tuasoeesrFxuICAgIH07XG4gIH1cblxuICBjcmVhdGVPdXRwdXRDb25maWcoKTogT3V0cHV0Q29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgZW5hYmxlQ29nbml0b091dHB1dHM6IHRydWUsXG4gICAgICBlbmFibGVBcGlHYXRld2F5T3V0cHV0czogdHJ1ZSxcbiAgICAgIGVuYWJsZUxhbWJkYU91dHB1dHM6IGZhbHNlLCAvLyDmnKznlarjgafjga9MYW1iZGHlh7rlipvnhKHlirlcbiAgICAgIGVuYWJsZUVudmlyb25tZW50VmFyaWFibGVzOiBmYWxzZSwgLy8g5pys55Wq44Gn44Gv55Kw5aKD5aSJ5pWw5Ye65Yqb54Sh5Yq5XG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuueSsOWig+aIpueVpVxuICovXG5leHBvcnQgY2xhc3MgRW50ZXJwcmlzZUNvbmZpZ1N0cmF0ZWd5IGV4dGVuZHMgV2ViQXBwQ29uZmlnU3RyYXRlZ3kge1xuICBjcmVhdGVDb2duaXRvQ29uZmlnKHByb2plY3ROYW1lOiBzdHJpbmcsIGVudmlyb25tZW50OiBzdHJpbmcpOiBDb2duaXRvU3RhY2tDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICB1c2VyUG9vbDoge1xuICAgICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgICAgbWluTGVuZ3RoOiAxNCwgLy8g44Ko44Oz44K/44O844OX44Op44Kk44K644Gn44Gv5pyA44KC5Y6z5qC8XG4gICAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICB1c2VybmFtZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgfSxcbiAgICAgIHVzZXJQb29sQ2xpZW50OiB7XG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiB0cnVlLFxuICAgICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGlkZW50aXR5UG9vbDoge1xuICAgICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlTGFtYmRhQ29uZmlnKCk6IExhbWJkYVdlYkFkYXB0ZXJDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBpbWFnZVBhdGg6ICcuL2RvY2tlcicsXG4gICAgICB0YWc6ICdlbnRlcnByaXNlJyxcbiAgICAgIHZwY0NvbmZpZzogbnVsbCwgLy8g44Ko44Oz44K/44O844OX44Op44Kk44K644Gn44GvVlBD5b+F6aCI44Gu5aC05ZCI44GM5aSa44GEXG4gICAgfTtcbiAgfVxuXG4gIGNyZWF0ZU91dHB1dENvbmZpZygpOiBPdXRwdXRDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBlbmFibGVDb2duaXRvT3V0cHV0czogZmFsc2UsIC8vIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOBp+OBr+WHuuWKm+acgOWwj+WMllxuICAgICAgZW5hYmxlQXBpR2F0ZXdheU91dHB1dHM6IGZhbHNlLFxuICAgICAgZW5hYmxlTGFtYmRhT3V0cHV0czogZmFsc2UsXG4gICAgICBlbmFibGVFbnZpcm9ubWVudFZhcmlhYmxlczogZmFsc2UsXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIOioreWumuaIpueVpeODleOCoeOCr+ODiOODquODvFxuICovXG5leHBvcnQgY2xhc3MgV2ViQXBwQ29uZmlnU3RyYXRlZ3lGYWN0b3J5IHtcbiAgc3RhdGljIGNyZWF0ZVN0cmF0ZWd5KGVudmlyb25tZW50OiBzdHJpbmcpOiBXZWJBcHBDb25maWdTdHJhdGVneSB7XG4gICAgc3dpdGNoIChlbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdkZXYnOlxuICAgICAgY2FzZSAnZGV2ZWxvcG1lbnQnOlxuICAgICAgICByZXR1cm4gbmV3IERldmVsb3BtZW50Q29uZmlnU3RyYXRlZ3koKTtcbiAgICAgIFxuICAgICAgY2FzZSAnc3RhZ2luZyc6XG4gICAgICBjYXNlICdzdGFnZSc6XG4gICAgICAgIHJldHVybiBuZXcgU3RhZ2luZ0NvbmZpZ1N0cmF0ZWd5KCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ3Byb2QnOlxuICAgICAgY2FzZSAncHJvZHVjdGlvbic6XG4gICAgICAgIHJldHVybiBuZXcgUHJvZHVjdGlvbkNvbmZpZ1N0cmF0ZWd5KCk7XG4gICAgICBcbiAgICAgIGNhc2UgJ2VudGVycHJpc2UnOlxuICAgICAgY2FzZSAnZW50JzpcbiAgICAgICAgcmV0dXJuIG5ldyBFbnRlcnByaXNlQ29uZmlnU3RyYXRlZ3koKTtcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDjgrXjg53jg7zjg4jjgZXjgozjgabjgYTjgarjgYTnkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGdldFN1cHBvcnRlZEVudmlyb25tZW50cygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFsnZGV2JywgJ2RldmVsb3BtZW50JywgJ3N0YWdpbmcnLCAnc3RhZ2UnLCAncHJvZCcsICdwcm9kdWN0aW9uJywgJ2VudGVycHJpc2UnLCAnZW50J107XG4gIH1cbn1cblxuLyoqXG4gKiDoqK3lrprmiKbnlaXjgrPjg7Pjg4bjgq3jgrnjg4hcbiAqL1xuZXhwb3J0IGNsYXNzIFdlYkFwcENvbmZpZ0NvbnRleHQge1xuICBwcml2YXRlIHN0cmF0ZWd5OiBXZWJBcHBDb25maWdTdHJhdGVneTtcblxuICBjb25zdHJ1Y3RvcihlbnZpcm9ubWVudDogc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJhdGVneSA9IFdlYkFwcENvbmZpZ1N0cmF0ZWd5RmFjdG9yeS5jcmVhdGVTdHJhdGVneShlbnZpcm9ubWVudCk7XG4gIH1cblxuICBzZXRTdHJhdGVneShzdHJhdGVneTogV2ViQXBwQ29uZmlnU3RyYXRlZ3kpOiB2b2lkIHtcbiAgICB0aGlzLnN0cmF0ZWd5ID0gc3RyYXRlZ3k7XG4gIH1cblxuICBjcmVhdGVDb25maWcocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IE9taXQ8V2ViQXBwU3RhY2tDb25maWcsICdhcGlDb25maWcnPiB7XG4gICAgcmV0dXJuIHRoaXMuc3RyYXRlZ3kuY3JlYXRlRnVsbENvbmZpZyhwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuICB9XG5cbiAgZ2V0Q29nbml0b0NvbmZpZyhwcm9qZWN0TmFtZTogc3RyaW5nLCBlbnZpcm9ubWVudDogc3RyaW5nKTogQ29nbml0b1N0YWNrQ29uZmlnIHtcbiAgICByZXR1cm4gdGhpcy5zdHJhdGVneS5jcmVhdGVDb2duaXRvQ29uZmlnKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCk7XG4gIH1cblxuICBnZXRMYW1iZGFDb25maWcoKTogTGFtYmRhV2ViQWRhcHRlckNvbmZpZyB7XG4gICAgcmV0dXJuIHRoaXMuc3RyYXRlZ3kuY3JlYXRlTGFtYmRhQ29uZmlnKCk7XG4gIH1cblxuICBnZXRPdXRwdXRDb25maWcoKTogT3V0cHV0Q29uZmlnIHtcbiAgICByZXR1cm4gdGhpcy5zdHJhdGVneS5jcmVhdGVPdXRwdXRDb25maWcoKTtcbiAgfVxufSJdfQ==