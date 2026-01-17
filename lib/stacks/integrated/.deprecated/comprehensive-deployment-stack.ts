/**
 * 包括的デプロイメントスタック
 * 
 * 全てのCDKスタックを統合的にデプロイするためのマスタースタック
 * 依存関係を管理し、段階的なデプロイメントを実現
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// 既存スタックのインポート
import { SecurityStack } from '../security-stack';
import { NetworkingStack } from '../networking-stack';
import { DataStack } from '../data-stack';
import { EmbeddingStack } from '../embedding-stack';
import { WebAppStack } from '../webapp-stack';
import { OperationsStack } from '../operations-stack';

// リージョン別スタック
import { JapanDeploymentStack } from '../japan-deployment-stack';
import { USDeploymentStack } from '../us-deployment-stack';
import { EUDeploymentStack } from '../eu-deployment-stack';
import { APACDeploymentStack } from '../apac-deployment-stack';
import { SouthAmericaDeploymentStack } from '../south-america-deployment-stack';

// 特殊スタック
import { DisasterRecoveryStack } from '../disaster-recovery-stack';
import { GlobalDeploymentStack } from '../global-deployment-stack';

// ルートレベルスタック
import { FSxNStack } from '../../fsxn-stack';
import { NetworkStack } from '../../network-stack';
import { MinimalProductionStack } from '../../minimal-production-stack';

export interface ComprehensiveDeploymentStackProps extends cdk.StackProps {
  /** プロジェクト名（50文字以内、英数字・ハイフン・アンダースコアのみ） */
  projectName: string;
  /** 環境名（厳密な型制約） */
  environment: 'dev' | 'staging' | 'prod' | 'test';
  
  // デプロイメント設定
  deploymentConfig: {
    // 基本コンポーネント
    enableSecurity: boolean;
    enableNetworking: boolean;
    enableData: boolean;
    enableEmbedding: boolean;
    enableWebApp: boolean;
    enableOperations: boolean;
    
    // リージョン別デプロイメント
    enableJapan: boolean;
    enableUS: boolean;
    enableEU: boolean;
    enableAPAC: boolean;
    enableSouthAmerica: boolean;
    
    // 特殊機能
    enableDisasterRecovery: boolean;
    enableGlobalDeployment: boolean;
    enableFSxN: boolean;
    enableMinimalProduction: boolean;
  };
  
  // リージョン設定
  regions: {
    primary: string;
    secondary?: string;
    disaster?: string;
  };
  
  // 各スタック固有の設定（必須）
  securityConfig?: any;
  networkingConfig?: any;
  dataConfig?: any;
  computeConfig?: any;
  webAppConfig?: any;
  operationsConfig?: any;
}

export class ComprehensiveDeploymentStack extends cdk.Stack {
  // 基本スタック
  public readonly securityStack?: SecurityStack;
  public readonly networkingStack?: NetworkingStack;
  public readonly dataStack?: DataStack;
  public readonly embeddingStack?: EmbeddingStack;
  public readonly webAppStack?: WebAppStack;
  public readonly operationsStack?: OperationsStack;
  
  // リージョン別スタック
  public readonly japanStack?: JapanDeploymentStack;
  public readonly usStack?: USDeploymentStack;
  public readonly euStack?: EUDeploymentStack;
  public readonly apacStack?: APACDeploymentStack;
  public readonly southAmericaStack?: SouthAmericaDeploymentStack;
  
  // 特殊スタック
  public readonly disasterRecoveryStack?: DisasterRecoveryStack;
  public readonly globalStack?: GlobalDeploymentStack;
  public readonly fsxnStack?: FSxNStack;
  public readonly networkStack?: NetworkStack;
  public readonly minimalProductionStack?: MinimalProductionStack;
  
  // デプロイメント情報
  public readonly deploymentInfo: {
    deployedStacks: string[];
    skippedStacks: string[];
    totalStacks: number;
    deploymentOrder: string[];
  };

  constructor(scope: Construct, id: string, props: ComprehensiveDeploymentStackProps) {
    super(scope, id, props);

    // 入力値の検証（セキュリティ対策）
    this.validateInputs(props);

    const { projectName, environment, deploymentConfig, regions } = props;
    
    const deployedStacks: string[] = [];
    const skippedStacks: string[] = [];
    const deploymentOrder: string[] = [];

    // Phase 1: セキュリティ基盤
    if (deploymentConfig.enableSecurity) {
      try {
        this.securityStack = new SecurityStack(this, 'Security', {
          config: props.securityConfig || this.getDefaultSecurityConfig(projectName, environment),
          projectName,
          environment,
          env: { region: regions.primary },
        });
        deployedStacks.push('SecurityStack');
        deploymentOrder.push('Phase1-Security');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`SecurityStack の作成に失敗しました: ${errorMessage}`);
      }
    } else {
      skippedStacks.push('SecurityStack');
    }

    // Phase 2: ネットワーク基盤
    if (deploymentConfig.enableNetworking) {
      this.networkingStack = new NetworkingStack(this, 'Networking', {
        env: { region: regions.primary },
      });
      
      // セキュリティスタックへの依存関係
      if (this.securityStack) {
        this.networkingStack.addDependency(this.securityStack);
      }
      
      deployedStacks.push('NetworkingStack');
      deploymentOrder.push('Phase2-Networking');
    } else {
      skippedStacks.push('NetworkingStack');
    }

    // 従来のネットワークスタック（互換性のため）
    if (deploymentConfig.enableNetworking) {
      this.networkStack = new NetworkStack(this, 'Network', {
        env: { region: regions.primary },
      });
      
      if (this.networkingStack) {
        this.networkStack.addDependency(this.networkingStack);
      }
      
      deployedStacks.push('NetworkStack');
    }

    // Phase 3: データ・ストレージ
    if (deploymentConfig.enableData) {
      this.dataStack = new DataStack(this, 'Data', {
        env: { region: regions.primary },
      });
      
      // 依存関係設定
      if (this.securityStack) {
        this.dataStack.addDependency(this.securityStack);
      }
      if (this.networkingStack) {
        this.dataStack.addDependency(this.networkingStack);
      }
      
      deployedStacks.push('DataStack');
      deploymentOrder.push('Phase3-Data');
    } else {
      skippedStacks.push('DataStack');
    }

    // FSxN スタック
    if (deploymentConfig.enableFSxN) {
      this.fsxnStack = new FSxNStack(this, 'FSxN', {
        env: { region: regions.primary },
      });
      
      if (this.networkStack) {
        this.fsxnStack.addDependency(this.networkStack);
      }
      
      deployedStacks.push('FSxNStack');
    }

    // Phase 4: Embedding・AI
    if (deploymentConfig.enableEmbedding) {
      this.embeddingStack = new EmbeddingStack(this, 'Embedding', {
        env: { region: regions.primary },
      });
      
      // 依存関係設定
      if (this.securityStack) {
        this.embeddingStack.addDependency(this.securityStack);
      }
      if (this.networkingStack) {
        this.embeddingStack.addDependency(this.networkingStack);
      }
      if (this.dataStack) {
        this.embeddingStack.addDependency(this.dataStack);
      }
      
      deployedStacks.push('EmbeddingStack');
      deploymentOrder.push('Phase4-Embedding');
    } else {
      skippedStacks.push('EmbeddingStack');
    }

    // Phase 5: WebApp・API
    if (deploymentConfig.enableWebApp) {
      this.webAppStack = new WebAppStack(this, 'WebApp', {
        env: { region: regions.primary },
      });
      
      // 依存関係設定
      if (this.securityStack) {
        this.webAppStack.addDependency(this.securityStack);
      }
      if (this.networkingStack) {
        this.webAppStack.addDependency(this.networkingStack);
      }
      if (this.embeddingStack) {
        this.webAppStack.addDependency(this.embeddingStack);
      }
      
      deployedStacks.push('WebAppStack');
      deploymentOrder.push('Phase5-WebApp');
    } else {
      skippedStacks.push('WebAppStack');
    }

    // Phase 6: 運用・監視
    if (deploymentConfig.enableOperations) {
      this.operationsStack = new OperationsStack(this, 'Operations', {
        env: { region: regions.primary },
      });
      
      // 全スタックへの依存関係
      [this.securityStack, this.networkingStack, this.dataStack, this.embeddingStack, this.webAppStack]
        .filter(stack => stack)
        .forEach(stack => {
          if (stack && this.operationsStack) {
            this.operationsStack.addDependency(stack);
          }
        });
      
      deployedStacks.push('OperationsStack');
      deploymentOrder.push('Phase6-Operations');
    } else {
      skippedStacks.push('OperationsStack');
    }

    // Phase 7: リージョン別デプロイメント
    if (deploymentConfig.enableJapan) {
      this.japanStack = new JapanDeploymentStack(this, 'Japan', {
        env: { region: 'ap-northeast-1' },
      });
      deployedStacks.push('JapanDeploymentStack');
      deploymentOrder.push('Phase7-Japan');
    }

    if (deploymentConfig.enableUS) {
      this.usStack = new USDeploymentStack(this, 'US', {
        env: { region: 'us-east-1' },
      });
      deployedStacks.push('USDeploymentStack');
      deploymentOrder.push('Phase7-US');
    }

    if (deploymentConfig.enableEU) {
      this.euStack = new EUDeploymentStack(this, 'EU', {
        env: { region: 'eu-west-1' },
      });
      deployedStacks.push('EUDeploymentStack');
      deploymentOrder.push('Phase7-EU');
    }

    if (deploymentConfig.enableAPAC) {
      this.apacStack = new APACDeploymentStack(this, 'APAC', {
        env: { region: 'ap-southeast-1' },
      });
      deployedStacks.push('APACDeploymentStack');
      deploymentOrder.push('Phase7-APAC');
    }

    if (deploymentConfig.enableSouthAmerica) {
      this.southAmericaStack = new SouthAmericaDeploymentStack(this, 'SouthAmerica', {
        env: { region: 'sa-east-1' },
      });
      deployedStacks.push('SouthAmericaDeploymentStack');
      deploymentOrder.push('Phase7-SouthAmerica');
    }

    // Phase 8: 特殊機能
    if (deploymentConfig.enableDisasterRecovery && regions.disaster) {
      this.disasterRecoveryStack = new DisasterRecoveryStack(this, 'DisasterRecovery', {
        env: { region: regions.disaster },
      });
      deployedStacks.push('DisasterRecoveryStack');
      deploymentOrder.push('Phase8-DisasterRecovery');
    }

    if (deploymentConfig.enableGlobalDeployment) {
      this.globalStack = new GlobalDeploymentStack(this, 'Global', {
        env: { region: regions.primary },
      });
      deployedStacks.push('GlobalDeploymentStack');
      deploymentOrder.push('Phase8-Global');
    }

    if (deploymentConfig.enableMinimalProduction) {
      this.minimalProductionStack = new MinimalProductionStack(this, 'MinimalProduction', {
        env: { region: regions.primary },
      });
      deployedStacks.push('MinimalProductionStack');
      deploymentOrder.push('Phase8-MinimalProduction');
    }

    // デプロイメント情報の設定
    this.deploymentInfo = {
      deployedStacks,
      skippedStacks,
      totalStacks: deployedStacks.length + skippedStacks.length,
      deploymentOrder,
    };

    // CloudFormation出力
    this.createOutputs();

    // スタックレベルのタグ設定
    this.applyStackTags(projectName, environment);
  }

  /**
   * 入力値の検証（セキュリティ対策）
   */
  private validateInputs(props: ComprehensiveDeploymentStackProps): void {
    const { projectName, environment, regions } = props;

    // プロジェクト名の検証
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('プロジェクト名が設定されていません');
    }

    if (projectName.trim().length === 0) {
      throw new Error('プロジェクト名が空文字です');
    }

    if (projectName.length > 50) {
      throw new Error('プロジェクト名は50文字以内で設定してください');
    }

    // セキュリティ: 安全な文字のみ許可
    if (!/^[a-zA-Z0-9\-_]+$/.test(projectName)) {
      throw new Error('プロジェクト名に不正な文字が含まれています（英数字、ハイフン、アンダースコアのみ許可）');
    }

    // 環境名の検証
    const validEnvironments = ['dev', 'staging', 'prod', 'test'] as const;
    if (!validEnvironments.includes(environment)) {
      throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
    }

    // リージョン設定の検証
    if (!regions.primary || typeof regions.primary !== 'string') {
      throw new Error('プライマリリージョンが設定されていません');
    }

    // AWSリージョン形式の検証
    const regionPattern = /^[a-z]{2}-[a-z]+-\d+$/;
    if (!regionPattern.test(regions.primary)) {
      throw new Error(`無効なリージョン形式です: ${regions.primary}`);
    }

    if (regions.secondary && !regionPattern.test(regions.secondary)) {
      throw new Error(`無効なセカンダリリージョン形式です: ${regions.secondary}`);
    }

    if (regions.disaster && !regionPattern.test(regions.disaster)) {
      throw new Error(`無効な災害復旧リージョン形式です: ${regions.disaster}`);
    }
  }

  /**
   * CloudFormation出力の作成
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'DeployedStacks', {
      value: this.deploymentInfo.deployedStacks.join(', '),
      description: 'Successfully deployed stacks',
      exportName: `${this.stackName}-DeployedStacks`,
    });

    new cdk.CfnOutput(this, 'SkippedStacks', {
      value: this.deploymentInfo.skippedStacks.join(', ') || 'None',
      description: 'Skipped stacks',
      exportName: `${this.stackName}-SkippedStacks`,
    });

    new cdk.CfnOutput(this, 'TotalStacks', {
      value: this.deploymentInfo.totalStacks.toString(),
      description: 'Total number of stacks',
      exportName: `${this.stackName}-TotalStacks`,
    });

    new cdk.CfnOutput(this, 'DeploymentOrder', {
      value: this.deploymentInfo.deploymentOrder.join(' -> '),
      description: 'Deployment order phases',
      exportName: `${this.stackName}-DeploymentOrder`,
    });
  }

  /**
   * スタックレベルのタグ設定（セキュリティ対策付き）
   */
  private applyStackTags(projectName: string, environment: string): void {
    // タグ値のサニタイズ（セキュリティ対策）
    const sanitizedProjectName = this.sanitizeTagValue(projectName);
    const sanitizedEnvironment = this.sanitizeTagValue(environment);
    
    const tags = {
      Project: sanitizedProjectName,
      Environment: sanitizedEnvironment,
      Stack: 'ComprehensiveDeploymentStack',
      Component: 'MasterDeployment',
      ManagedBy: 'CDK',
      Architecture: 'Comprehensive',
      CostCenter: `${sanitizedProjectName}-${sanitizedEnvironment}-comprehensive`,
      CreatedAt: new Date().toISOString().split('T')[0],
      Version: '1.0.0'
    };

    // 一括でタグを適用
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * タグ値のサニタイズ（セキュリティ対策）
   */
  private sanitizeTagValue(value: string): string {
    return value
      .replace(/[<>\"'&]/g, '') // XSS対策
      .substring(0, 256) // AWS タグ値の最大長制限
      .trim();
  }

  /**
   * デフォルトセキュリティ設定の取得
   */
  private getDefaultSecurityConfig(projectName: string, environment: string): any {
    return {
      kms: {
        enableKeyRotation: true,
        keySpec: 'SYMMETRIC_DEFAULT',
        keyUsage: 'ENCRYPT_DECRYPT',
      },
      waf: {
        enabled: true,
        scope: 'REGIONAL',
        rules: {
          enableAWSManagedRules: true,
          enableRateLimiting: true,
          rateLimit: 2000,
          enableGeoBlocking: false,
          blockedCountries: [],
        },
      },
      cloudTrail: {
        enabled: true,
        s3BucketName: `${projectName}-${environment}-cloudtrail`,
        includeGlobalServiceEvents: true,
        isMultiRegionTrail: true,
        enableLogFileValidation: true,
      },
      tags: {
        SecurityLevel: 'High',
        EncryptionRequired: true,
        ComplianceFramework: 'SOC2',
        DataClassification: 'Confidential',
      },
    };
  }

  /**
   * デフォルトネットワーキング設定の取得
   */
  private getDefaultNetworkingConfig(): any {
    return {
      vpcCidr: '10.0.0.0/16',
      maxAzs: 3,
      enablePublicSubnets: true,
      enablePrivateSubnets: true,
      enableIsolatedSubnets: true,
      enableNatGateway: true,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      enableFlowLogs: true,
      vpcEndpoints: {
        s3: true,
        dynamodb: true,
        lambda: true,
        opensearch: true,
      },
      securityGroups: {
        web: true,
        api: true,
        database: true,
        lambda: true,
      },
    };
  }

  /**
   * デプロイメント統計の取得
   */
  public getDeploymentStats() {
    return {
      ...this.deploymentInfo,
      deploymentPhases: {
        'Phase1-Security': this.securityStack ? 'Deployed' : 'Skipped',
        'Phase2-Networking': this.networkingStack ? 'Deployed' : 'Skipped',
        'Phase3-Data': this.dataStack ? 'Deployed' : 'Skipped',
        'Phase4-Embedding': this.embeddingStack ? 'Deployed' : 'Skipped',
        'Phase5-WebApp': this.webAppStack ? 'Deployed' : 'Skipped',
        'Phase6-Operations': this.operationsStack ? 'Deployed' : 'Skipped',
        'Phase7-Regional': [
          this.japanStack && 'Japan',
          this.usStack && 'US',
          this.euStack && 'EU',
          this.apacStack && 'APAC',
          this.southAmericaStack && 'SouthAmerica'
        ].filter(Boolean).join(', ') || 'None',
        'Phase8-Special': [
          this.disasterRecoveryStack && 'DisasterRecovery',
          this.globalStack && 'Global',
          this.minimalProductionStack && 'MinimalProduction'
        ].filter(Boolean).join(', ') || 'None',
      },
    };
  }

  /**
   * システム情報の取得
   */
  public getSystemInfo() {
    return {
      stackName: this.stackName,
      region: this.region,
      account: this.account,
      deploymentInfo: this.deploymentInfo,
      enabledComponents: {
        security: !!this.securityStack,
        networking: !!this.networkingStack,
        data: !!this.dataStack,
        embedding: !!this.embeddingStack,
        webapp: !!this.webAppStack,
        operations: !!this.operationsStack,
      },
      regionalDeployments: {
        japan: !!this.japanStack,
        us: !!this.usStack,
        eu: !!this.euStack,
        apac: !!this.apacStack,
        southAmerica: !!this.southAmericaStack,
      },
      specialFeatures: {
        disasterRecovery: !!this.disasterRecoveryStack,
        global: !!this.globalStack,
        fsxn: !!this.fsxnStack,
        minimalProduction: !!this.minimalProductionStack,
      },
    };
  }

  /**
   * セキュリティリソースの取得
   */
  public getSecurityResources() {
    return {
      securityStack: this.securityStack,
      kmsKey: this.securityStack?.kmsKey || null,
      wafWebAcl: this.securityStack?.wafWebAcl || null,
    };
  }

  /**
   * ネットワークリソースの取得
   */
  public getNetworkResources() {
    return {
      networkingStack: this.networkingStack,
      networkStack: this.networkStack,
      vpc: this.networkingStack?.vpc || null,
      publicSubnets: this.networkingStack?.publicSubnets || [],
      privateSubnets: this.networkingStack?.privateSubnets || [],
      isolatedSubnets: this.networkingStack?.isolatedSubnets || [],
      securityGroups: this.networkingStack?.securityGroups || {},
    };
  }

  /**
   * データリソースの取得
   */
  public getDataResources() {
    return {
      dataStack: this.dataStack,
      fsxnStack: this.fsxnStack,
      s3Buckets: this.dataStack?.s3Buckets || {},
      dynamoDbTables: this.dataStack?.dynamoDbTables || {},
      openSearchCollection: this.dataStack?.openSearchCollection || null,
      fsxFileSystem: this.fsxnStack?.fsxFileSystem || null,
    };
  }
}