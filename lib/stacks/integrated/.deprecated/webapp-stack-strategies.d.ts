/**
 * WebAppスタック戦略パターン実装
 *
 * 異なる環境・用途に応じた設定戦略を提供
 */
import { WebAppStackConfig, CognitoStackConfig, LambdaWebAdapterConfig, OutputConfig } from './webapp-stack-improved';
/**
 * 抽象設定戦略
 */
export declare abstract class WebAppConfigStrategy {
    abstract createCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
    abstract createLambdaConfig(): LambdaWebAdapterConfig;
    abstract createOutputConfig(): OutputConfig;
    createFullConfig(projectName: string, environment: string): Omit<WebAppStackConfig, 'apiConfig'>;
}
/**
 * 開発環境戦略
 */
export declare class DevelopmentConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
    createLambdaConfig(): LambdaWebAdapterConfig;
    createOutputConfig(): OutputConfig;
}
/**
 * ステージング環境戦略
 */
export declare class StagingConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
    createLambdaConfig(): LambdaWebAdapterConfig;
    createOutputConfig(): OutputConfig;
}
/**
 * 本番環境戦略
 */
export declare class ProductionConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
    createLambdaConfig(): LambdaWebAdapterConfig;
    createOutputConfig(): OutputConfig;
}
/**
 * エンタープライズ環境戦略
 */
export declare class EnterpriseConfigStrategy extends WebAppConfigStrategy {
    createCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
    createLambdaConfig(): LambdaWebAdapterConfig;
    createOutputConfig(): OutputConfig;
}
/**
 * 設定戦略ファクトリー
 */
export declare class WebAppConfigStrategyFactory {
    static createStrategy(environment: string): WebAppConfigStrategy;
    static getSupportedEnvironments(): string[];
}
/**
 * 設定戦略コンテキスト
 */
export declare class WebAppConfigContext {
    private strategy;
    constructor(environment: string);
    setStrategy(strategy: WebAppConfigStrategy): void;
    createConfig(projectName: string, environment: string): Omit<WebAppStackConfig, 'apiConfig'>;
    getCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
    getLambdaConfig(): LambdaWebAdapterConfig;
    getOutputConfig(): OutputConfig;
}
