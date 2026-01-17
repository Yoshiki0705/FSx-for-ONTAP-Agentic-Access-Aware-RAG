/**
 * シンプル統合スタック
 * 
 * 実装済みモジュールのみを使用した統合スタック
 * - SecurityStack: KMS、WAF、CloudTrail、GuardDuty
 * - NetworkingStack: VPC、サブネット、セキュリティグループ
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityStack } from './security-stack';
import { NetworkingStack } from './networking-stack';

/**
 * SimpleIntegratedStack のプロパティ
 */
export interface SimpleIntegratedStackProps extends cdk.StackProps {
  /** プロジェクト名（50文字以内、英数字・ハイフン・アンダースコアのみ） */
  projectName: string;
  /** 環境名（dev/staging/prod/test） */
  environment: 'dev' | 'staging' | 'prod' | 'test';
  /** セキュリティスタックを有効にするか（デフォルト: true） */
  enableSecurity?: boolean;
  /** ネットワーキングスタックを有効にするか（デフォルト: true） */
  enableNetworking?: boolean;
}

export class SimpleIntegratedStack extends cdk.Stack {
  public readonly securityStack?: SecurityStack;
  public readonly networkingStack?: NetworkingStack;

  constructor(scope: Construct, id: string, props: SimpleIntegratedStackProps) {
    super(scope, id, props);

    // 入力値検証
    this.validateProps(props);

    const { projectName, environment, enableSecurity = true, enableNetworking = true } = props;

    // 1. SecurityStack のデプロイ
    if (enableSecurity) {
      try {
        this.securityStack = new SecurityStack(this, 'SecurityStack', {
        config: {
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
            SecurityLevel: 'Medium',
            EncryptionRequired: true,
            ComplianceFramework: 'SOC2',
            DataClassification: 'Internal',
          },
        },
          projectName,
          environment,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`SecurityStack の作成に失敗しました: ${errorMessage}`);
      }
    }

    // 2. NetworkingStack のデプロイ
    if (enableNetworking) {
      try {
        this.networkingStack = new NetworkingStack(this, 'NetworkingStack', {
        config: {
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
        },
          projectName,
          environment,
        });

        // SecurityStack への依存関係設定
        if (this.securityStack) {
          this.networkingStack.addDependency(this.securityStack);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`NetworkingStack の作成に失敗しました: ${errorMessage}`);
      }
    }

    // CloudFormation出力
    this.createOutputs();

    // スタックレベルのタグ設定
    this.applyStackTags(projectName, environment);
  }

  /**
   * プロパティの検証
   */
  private validateProps(props: SimpleIntegratedStackProps): void {
    const { projectName, environment } = props;

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

    // 安全な文字のみ許可（英数字、ハイフン、アンダースコア）
    if (!/^[a-zA-Z0-9\-_]+$/.test(projectName)) {
      throw new Error('プロジェクト名に不正な文字が含まれています（英数字、ハイフン、アンダースコアのみ許可）');
    }

    // 環境名の検証
    const validEnvironments = ['dev', 'staging', 'prod', 'test'];
    if (!validEnvironments.includes(environment)) {
      throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
    }
  }

  /**
   * CloudFormation出力の作成
   */
  private createOutputs(): void {
    // セキュリティ情報
    if (this.securityStack) {
      new cdk.CfnOutput(this, 'KmsKeyId', {
        value: this.securityStack.kmsKey.keyId,
        description: 'KMS Key ID',
        exportName: `${this.stackName}-KmsKeyId`,
      });

      new cdk.CfnOutput(this, 'KmsKeyArn', {
        value: this.securityStack.kmsKey.keyArn,
        description: 'KMS Key ARN',
        exportName: `${this.stackName}-KmsKeyArn`,
      });

      if (this.securityStack.wafWebAcl) {
        new cdk.CfnOutput(this, 'WafWebAclArn', {
          value: this.securityStack.wafWebAcl.attrArn,
          description: 'WAF WebACL ARN',
          exportName: `${this.stackName}-WafWebAclArn`,
        });
      }
    }

    // ネットワーク情報
    if (this.networkingStack) {
      new cdk.CfnOutput(this, 'VpcId', {
        value: this.networkingStack.vpc.vpcId,
        description: 'VPC ID',
        exportName: `${this.stackName}-VpcId`,
      });

      new cdk.CfnOutput(this, 'VpcCidr', {
        value: this.networkingStack.vpc.vpcCidrBlock,
        description: 'VPC CIDR Block',
        exportName: `${this.stackName}-VpcCidr`,
      });

      // サブネット情報
      this.networkingStack.publicSubnets.forEach((subnet, index) => {
        new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
          value: subnet.subnetId,
          description: `Public Subnet ${index + 1} ID`,
          exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
        });
      });

      this.networkingStack.privateSubnets.forEach((subnet, index) => {
        new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
          value: subnet.subnetId,
          description: `Private Subnet ${index + 1} ID`,
          exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
        });
      });
    }
  }

  /**
   * スタックレベルのタグ設定
   */
  private applyStackTags(projectName: string, environment: string): void {
    // タグ値のサニタイズ（セキュリティ対策）
    const sanitizedProjectName = this.sanitizeTagValue(projectName);
    const sanitizedEnvironment = this.sanitizeTagValue(environment);
    
    cdk.Tags.of(this).add('Project', sanitizedProjectName);
    cdk.Tags.of(this).add('Environment', sanitizedEnvironment);
    cdk.Tags.of(this).add('Stack', 'SimpleIntegratedStack');
    cdk.Tags.of(this).add('Component', 'Integration');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CostCenter', `${sanitizedProjectName}-${sanitizedEnvironment}-integrated`);
    cdk.Tags.of(this).add('CreatedAt', new Date().toISOString().split('T')[0]);
  }

  /**
   * タグ値のサニタイズ
   */
  private sanitizeTagValue(value: string): string {
    // 不正な文字を除去し、長さを制限
    return value
      .replace(/[<>\"'&]/g, '') // XSS対策
      .substring(0, 256) // AWS タグ値の最大長制限
      .trim();
  }

  /**
   * システム情報の取得
   */
  public getSystemInfo() {
    return {
      projectName: this.stackName,
      region: this.region,
      account: this.account,
      enabledStacks: {
        security: !!this.securityStack,
        networking: !!this.networkingStack,
      },
      endpoints: {
        vpc: this.networkingStack?.vpc.vpcId || null,
        kmsKey: this.securityStack?.kmsKey.keyArn || null,
      },
    };
  }

  /**
   * セキュリティ情報の取得
   */
  public getSecurityInfo() {
    if (!this.securityStack) {
      return null;
    }

    return {
      kmsKey: this.securityStack.kmsKey,
      wafWebAcl: this.securityStack.wafWebAcl,
    };
  }

  /**
   * ネットワーク情報の取得
   */
  public getNetworkingInfo() {
    if (!this.networkingStack) {
      return null;
    }

    return {
      vpc: this.networkingStack.vpc,
      publicSubnets: this.networkingStack.publicSubnets,
      privateSubnets: this.networkingStack.privateSubnets,
      isolatedSubnets: this.networkingStack.isolatedSubnets,
      securityGroups: this.networkingStack.securityGroups,
    };
  }
}