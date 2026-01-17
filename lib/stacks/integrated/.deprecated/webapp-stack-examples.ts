/**
 * WebAppスタック使用例とベストプラクティス
 */

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

// 改善版インポート
import { 
  WebAppStack as ImprovedWebAppStack,
  WebAppStackConfigBuilder,
  CognitoConfigFactory 
} from './webapp-stack-improved';

// 戦略パターンインポート
import { 
  WebAppConfigContext,
  WebAppConfigStrategyFactory 
} from './webapp-stack-strategies';

// テンプレートメソッドインポート
import { 
  StandardWebAppStack,
  SecureWebAppStack,
  HighAvailabilityWebAppStack,
  WebAppStackDependencies 
} from './webapp-stack-template';

// 依存スタック
import { NetworkingStack } from './networking-stack';
import { SecurityStack } from './security-stack';
import { DataStack } from './data-stack';
import { EmbeddingStack } from './embedding-stack';

/**
 * 使用例1: Builder Patternを使用した開発環境スタック
 */
export function createDevelopmentWebAppStack(
  scope: Construct,
  dependencies: WebAppStackDependencies
): ImprovedWebAppStack {
  const config = new WebAppStackConfigBuilder()
    .setBasicConfig('permission-aware-rag', 'dev')
    .setCognitoConfig(CognitoConfigFactory.createDefaultConfig('permission-aware-rag', 'dev'))
    .setDefaultConfigs()
    .build();

  return new ImprovedWebAppStack(scope, 'DevWebAppStack', {
    config,
    ...dependencies,
  });
}

/**
 * 使用例2: Strategy Patternを使用した環境別スタック
 */
export function createEnvironmentSpecificWebAppStack(
  scope: Construct,
  environment: string,
  dependencies: WebAppStackDependencies
): ImprovedWebAppStack {
  const configContext = new WebAppConfigContext(environment);
  const baseConfig = configContext.createConfig('permission-aware-rag', environment);

  const config = new WebAppStackConfigBuilder()
    .setBasicConfig(baseConfig.projectName, baseConfig.environment)
    .setCognitoConfig(baseConfig.cognitoConfig)
    .setLambdaConfig(baseConfig.lambdaConfig)
    .setOutputConfig(baseConfig.outputConfig)
    .build();

  return new ImprovedWebAppStack(scope, `${environment}WebAppStack`, {
    config,
    ...dependencies,
  });
}

/**
 * 使用例3: Template Method Patternを使用した標準スタック
 */
export function createStandardWebAppStack(
  scope: Construct,
  environment: string,
  dependencies: WebAppStackDependencies
): StandardWebAppStack {
  const strategy = WebAppConfigStrategyFactory.createStrategy(environment);
  const config = strategy.createFullConfig('permission-aware-rag', environment);

  return new StandardWebAppStack(
    scope,
    `StandardWebAppStack-${environment}`,
    {
      ...config,
      // ApiConfigは別途設定が必要
      apiConfig: {} as any, // 実際の実装では適切なApiConfigを設定
    },
    dependencies
  );
}

/**
 * 使用例4: セキュリティ強化スタック
 */
export function createSecureWebAppStack(
  scope: Construct,
  dependencies: WebAppStackDependencies
): SecureWebAppStack {
  const strategy = WebAppConfigStrategyFactory.createStrategy('production');
  const config = strategy.createFullConfig('permission-aware-rag', 'prod');

  return new SecureWebAppStack(
    scope,
    'SecureWebAppStack',
    {
      ...config,
      apiConfig: {} as any, // 実際の実装では適切なApiConfigを設定
    },
    dependencies
  );
}

/**
 * 使用例5: 高可用性スタック
 */
export function createHighAvailabilityWebAppStack(
  scope: Construct,
  dependencies: WebAppStackDependencies
): HighAvailabilityWebAppStack {
  const strategy = WebAppConfigStrategyFactory.createStrategy('enterprise');
  const config = strategy.createFullConfig('permission-aware-rag', 'enterprise');

  return new HighAvailabilityWebAppStack(
    scope,
    'HAWebAppStack',
    {
      ...config,
      apiConfig: {} as any, // 実際の実装では適切なApiConfigを設定
    },
    dependencies
  );
}

/**
 * ベストプラクティス例: 設定の検証と最適化
 */
export class WebAppStackBestPractices {
  /**
   * 環境別設定の検証
   */
  static validateEnvironmentConfig(environment: string): boolean {
    const supportedEnvironments = WebAppConfigStrategyFactory.getSupportedEnvironments();
    return supportedEnvironments.includes(environment.toLowerCase());
  }

  /**
   * セキュリティ設定の推奨事項チェック
   */
  static checkSecurityRecommendations(environment: string): string[] {
    const recommendations: string[] = [];
    const strategy = WebAppConfigStrategyFactory.createStrategy(environment);
    const config = strategy.createFullConfig('test', environment);

    // パスワードポリシーチェック
    const passwordPolicy = config.cognitoConfig.userPool.passwordPolicy;
    if (passwordPolicy.minLength < 8) {
      recommendations.push('パスワード最小長を8文字以上に設定することを推奨します');
    }

    if (!passwordPolicy.requireSymbols && environment === 'prod') {
      recommendations.push('本番環境では記号を必須にすることを推奨します');
    }

    // セルフサインアップチェック
    if (config.cognitoConfig.userPool.selfSignUpEnabled && environment === 'prod') {
      recommendations.push('本番環境ではセルフサインアップを無効にすることを推奨します');
    }

    // 未認証アクセスチェック
    if (config.cognitoConfig.identityPool.allowUnauthenticatedIdentities) {
      recommendations.push('未認証アクセスを無効にすることを推奨します');
    }

    return recommendations;
  }

  /**
   * パフォーマンス最適化の推奨事項
   */
  static getPerformanceRecommendations(environment: string): string[] {
    const recommendations: string[] = [];

    if (environment === 'prod') {
      recommendations.push('本番環境ではVPC設定を有効にすることを推奨します');
      recommendations.push('CloudFrontキャッシュ設定を最適化することを推奨します');
      recommendations.push('Lambda関数のメモリサイズを調整することを推奨します');
    }

    return recommendations;
  }

  /**
   * コスト最適化の推奨事項
   */
  static getCostOptimizationRecommendations(environment: string): string[] {
    const recommendations: string[] = [];

    if (environment === 'dev') {
      recommendations.push('開発環境では不要な出力を無効にしてコストを削減できます');
      recommendations.push('開発環境ではリソースの自動削除を有効にできます');
    }

    return recommendations;
  }
}

/**
 * 統合使用例: 全ての改善パターンを組み合わせた例
 */
export class ComprehensiveWebAppStackExample {
  static create(
    scope: Construct,
    projectName: string,
    environment: string,
    dependencies: WebAppStackDependencies
  ): ImprovedWebAppStack {
    // 1. 環境検証
    if (!WebAppStackBestPractices.validateEnvironmentConfig(environment)) {
      throw new Error(`サポートされていない環境: ${environment}`);
    }

    // 2. セキュリティ推奨事項の確認
    const securityRecommendations = WebAppStackBestPractices.checkSecurityRecommendations(environment);
    if (securityRecommendations.length > 0) {
      console.warn('セキュリティ推奨事項:', securityRecommendations);
    }

    // 3. Strategy Patternで環境別設定を取得
    const configContext = new WebAppConfigContext(environment);
    const baseConfig = configContext.createConfig(projectName, environment);

    // 4. Builder Patternで設定を構築
    const config = new WebAppStackConfigBuilder()
      .setBasicConfig(baseConfig.projectName, baseConfig.environment)
      .setCognitoConfig(baseConfig.cognitoConfig)
      .setLambdaConfig(baseConfig.lambdaConfig)
      .setOutputConfig(baseConfig.outputConfig)
      .build();

    // 5. 改善されたWebAppStackを作成
    return new ImprovedWebAppStack(scope, `${projectName}-${environment}-webapp`, {
      config,
      ...dependencies,
    });
  }
}