/**
 * WebAppスタック戦略パターン実装
 * 
 * 異なる環境・用途に応じた設定戦略を提供
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { WebAppStackConfig, CognitoStackConfig, LambdaWebAdapterConfig, OutputConfig } from './webapp-stack-improved';

/**
 * 抽象設定戦略
 */
export abstract class WebAppConfigStrategy {
  abstract createCognitoConfig(projectName: string, environment: string): CognitoStackConfig;
  abstract createLambdaConfig(): LambdaWebAdapterConfig;
  abstract createOutputConfig(): OutputConfig;
  
  createFullConfig(projectName: string, environment: string): Omit<WebAppStackConfig, 'apiConfig'> {
    return {
      projectName,
      environment,
      cognitoConfig: this.createCognitoConfig(projectName, environment),
      lambdaConfig: this.createLambdaConfig(),
      outputConfig: this.createOutputConfig(),
    };
  }
}

/**
 * 開発環境戦略
 */
export class DevelopmentConfigStrategy extends WebAppConfigStrategy {
  createCognitoConfig(projectName: string, environment: string): CognitoStackConfig {
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

  createLambdaConfig(): LambdaWebAdapterConfig {
    return {
      imagePath: './docker',
      tag: 'dev',
      vpcConfig: null, // 開発環境ではVPCなし
    };
  }

  createOutputConfig(): OutputConfig {
    return {
      enableCognitoOutputs: true,
      enableApiGatewayOutputs: true,
      enableLambdaOutputs: true,
      enableEnvironmentVariables: true, // 開発環境では全出力有効
    };
  }
}

/**
 * ステージング環境戦略
 */
export class StagingConfigStrategy extends WebAppConfigStrategy {
  createCognitoConfig(projectName: string, environment: string): CognitoStackConfig {
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

  createLambdaConfig(): LambdaWebAdapterConfig {
    return {
      imagePath: './docker',
      tag: 'staging',
      vpcConfig: null,
    };
  }

  createOutputConfig(): OutputConfig {
    return {
      enableCognitoOutputs: true,
      enableApiGatewayOutputs: true,
      enableLambdaOutputs: true,
      enableEnvironmentVariables: false, // ステージングでは環境変数出力無効
    };
  }
}

/**
 * 本番環境戦略
 */
export class ProductionConfigStrategy extends WebAppConfigStrategy {
  createCognitoConfig(projectName: string, environment: string): CognitoStackConfig {
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

  createLambdaConfig(): LambdaWebAdapterConfig {
    return {
      imagePath: './docker',
      tag: 'latest',
      vpcConfig: null, // 本番でもVPCは要件次第
    };
  }

  createOutputConfig(): OutputConfig {
    return {
      enableCognitoOutputs: true,
      enableApiGatewayOutputs: true,
      enableLambdaOutputs: false, // 本番ではLambda出力無効
      enableEnvironmentVariables: false, // 本番では環境変数出力無効
    };
  }
}

/**
 * エンタープライズ環境戦略
 */
export class EnterpriseConfigStrategy extends WebAppConfigStrategy {
  createCognitoConfig(projectName: string, environment: string): CognitoStackConfig {
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

  createLambdaConfig(): LambdaWebAdapterConfig {
    return {
      imagePath: './docker',
      tag: 'enterprise',
      vpcConfig: null, // エンタープライズではVPC必須の場合が多い
    };
  }

  createOutputConfig(): OutputConfig {
    return {
      enableCognitoOutputs: false, // エンタープライズでは出力最小化
      enableApiGatewayOutputs: false,
      enableLambdaOutputs: false,
      enableEnvironmentVariables: false,
    };
  }
}

/**
 * 設定戦略ファクトリー
 */
export class WebAppConfigStrategyFactory {
  static createStrategy(environment: string): WebAppConfigStrategy {
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

  static getSupportedEnvironments(): string[] {
    return ['dev', 'development', 'staging', 'stage', 'prod', 'production', 'enterprise', 'ent'];
  }
}

/**
 * 設定戦略コンテキスト
 */
export class WebAppConfigContext {
  private strategy: WebAppConfigStrategy;

  constructor(environment: string) {
    this.strategy = WebAppConfigStrategyFactory.createStrategy(environment);
  }

  setStrategy(strategy: WebAppConfigStrategy): void {
    this.strategy = strategy;
  }

  createConfig(projectName: string, environment: string): Omit<WebAppStackConfig, 'apiConfig'> {
    return this.strategy.createFullConfig(projectName, environment);
  }

  getCognitoConfig(projectName: string, environment: string): CognitoStackConfig {
    return this.strategy.createCognitoConfig(projectName, environment);
  }

  getLambdaConfig(): LambdaWebAdapterConfig {
    return this.strategy.createLambdaConfig();
  }

  getOutputConfig(): OutputConfig {
    return this.strategy.createOutputConfig();
  }
}