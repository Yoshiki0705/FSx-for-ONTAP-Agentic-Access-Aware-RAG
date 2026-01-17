/**
 * WebAppスタック使用例とベストプラクティス
 */
import { Construct } from 'constructs';
import { WebAppStack as ImprovedWebAppStack } from './webapp-stack-improved';
import { StandardWebAppStack, SecureWebAppStack, HighAvailabilityWebAppStack, WebAppStackDependencies } from './webapp-stack-template';
/**
 * 使用例1: Builder Patternを使用した開発環境スタック
 */
export declare function createDevelopmentWebAppStack(scope: Construct, dependencies: WebAppStackDependencies): ImprovedWebAppStack;
/**
 * 使用例2: Strategy Patternを使用した環境別スタック
 */
export declare function createEnvironmentSpecificWebAppStack(scope: Construct, environment: string, dependencies: WebAppStackDependencies): ImprovedWebAppStack;
/**
 * 使用例3: Template Method Patternを使用した標準スタック
 */
export declare function createStandardWebAppStack(scope: Construct, environment: string, dependencies: WebAppStackDependencies): StandardWebAppStack;
/**
 * 使用例4: セキュリティ強化スタック
 */
export declare function createSecureWebAppStack(scope: Construct, dependencies: WebAppStackDependencies): SecureWebAppStack;
/**
 * 使用例5: 高可用性スタック
 */
export declare function createHighAvailabilityWebAppStack(scope: Construct, dependencies: WebAppStackDependencies): HighAvailabilityWebAppStack;
/**
 * ベストプラクティス例: 設定の検証と最適化
 */
export declare class WebAppStackBestPractices {
    /**
     * 環境別設定の検証
     */
    static validateEnvironmentConfig(environment: string): boolean;
    /**
     * セキュリティ設定の推奨事項チェック
     */
    static checkSecurityRecommendations(environment: string): string[];
    /**
     * パフォーマンス最適化の推奨事項
     */
    static getPerformanceRecommendations(environment: string): string[];
    /**
     * コスト最適化の推奨事項
     */
    static getCostOptimizationRecommendations(environment: string): string[];
}
/**
 * 統合使用例: 全ての改善パターンを組み合わせた例
 */
export declare class ComprehensiveWebAppStackExample {
    static create(scope: Construct, projectName: string, environment: string, dependencies: WebAppStackDependencies): ImprovedWebAppStack;
}
