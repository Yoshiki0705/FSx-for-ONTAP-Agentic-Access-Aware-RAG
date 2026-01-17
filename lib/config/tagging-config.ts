/**
 * AWS リソースタグ設定
 * コスト配布とリソース管理のための統一タグ戦略
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// 環境名の型定義を追加
export type Environment = 'dev' | 'staging' | 'prod';

// サービスタイプの型定義を追加
export type ServiceType = 'FSx-for-NetApp-ONTAP' | 'AWS-Batch' | 'OpenSearch-Serverless' | 'AWS-Lambda' | 'EC2' | 'S3' | 'CloudFront';

export interface TaggingConfig {
  /** プロジェクト名（コスト配布の主要キー） */
  projectName: string;
  
  /** 環境名 (dev, staging, prod) */
  environment: Environment;
  
  /** 部門・チーム名 */
  department?: string;
  
  /** 所有者 */
  owner?: string;
  
  /** 作成日 */
  createdDate?: string;
  
  /** 追加のカスタムタグ */
  customTags?: Record<string, string>;
}

export interface CostAllocationTags {
  /** コスト配布タグ（必須） */
  cost: string;
  
  /** 環境タグ */
  Environment: string;
  
  /** プロジェクトタグ */
  Project: string;
  
  /** 部門タグ */
  Department?: string;
  
  /** 所有者タグ */
  Owner?: string;
  
  /** 作成日タグ */
  CreatedDate: string;
  
  /** CDKアプリケーションタグ */
  'CDK-Application': string;
  
  /** 管理方法タグ */
  'Management-Method': string;
}

/**
 * 統一されたタグ設定を生成
 */
export class TaggingStrategy {
  /**
   * タグ設定の妥当性を検証
   */
  static validateConfig(config: TaggingConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // プロジェクト名の検証（AWS タグ制限に準拠）
    if (!config.projectName || config.projectName.length > 128) {
      errors.push('プロジェクト名は1-128文字である必要があります');
    }
    
    // 環境名の検証
    const validEnvironments: Environment[] = ['dev', 'staging', 'prod'];
    if (!validEnvironments.includes(config.environment)) {
      errors.push(`環境名は ${validEnvironments.join(', ')} のいずれかである必要があります`);
    }
    
    // カスタムタグの検証
    if (config.customTags) {
      Object.entries(config.customTags).forEach(([key, value]) => {
        if (key.length > 128 || value.length > 256) {
          errors.push(`タグ "${key}" のキーまたは値が長すぎます（キー: 最大128文字、値: 最大256文字）`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  /**
   * コスト配布タグを生成
   */
  static generateCostAllocationTags(config: TaggingConfig): CostAllocationTags {
    // 設定の妥当性を検証
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`タグ設定が無効です: ${validation.errors.join(', ')}`);
    }
    
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    return {
      // コスト配布の主要タグ
      cost: config.projectName,
      
      // 基本タグ
      Environment: config.environment,
      Project: config.projectName,
      Department: config.department || 'Engineering',
      Owner: config.owner || 'CDK-Deployment',
      CreatedDate: config.createdDate || currentDate,
      
      // 管理情報タグ
      'CDK-Application': 'Permission-aware-RAG-FSxN',
      'Management-Method': 'AWS-CDK',
    };
  }
  
  /**
   * CDKスタックにタグを適用
   */
  static applyTagsToStack(stack: cdk.Stack, config: TaggingConfig): void {
    try {
      const tags = this.generateCostAllocationTags(config);
      let appliedTagsCount = 0;
      
      // 全てのタグをスタックに適用
      Object.entries(tags).forEach(([key, value]) => {
        if (value) {
          cdk.Tags.of(stack).add(key, value);
          appliedTagsCount++;
        }
      });
      
      // カスタムタグの適用
      if (config.customTags) {
        Object.entries(config.customTags).forEach(([key, value]) => {
          cdk.Tags.of(stack).add(key, value);
          appliedTagsCount++;
        });
      }
      
      // デバッグ情報をコンソールに出力（開発環境のみ）
      if (config.environment === 'dev') {
        console.log(`✅ スタック "${stack.stackName}" に ${appliedTagsCount} 個のタグを適用しました`);
      }
    } catch (error) {
      console.error(`❌ スタック "${stack.stackName}" へのタグ適用に失敗:`, error);
      throw error;
    }
  }
  
  /**
   * 特定のリソースにタグを適用
   */
  static applyTagsToResource(resource: Construct, config: TaggingConfig): void {
    const tags = this.generateCostAllocationTags(config);
    
    Object.entries(tags).forEach(([key, value]) => {
      if (value) {
        cdk.Tags.of(resource).add(key, value);
      }
    });
  }
  
  /**
   * FSx for ONTAP専用タグを生成
   */
  static generateFSxTags(config: TaggingConfig): Record<string, string> {
    const baseTags = this.generateCostAllocationTags(config);
    
    return {
      ...baseTags,
      'Service-Type': 'FSx-for-NetApp-ONTAP',
      'Use-Case': 'RAG-Document-Storage',
      'Performance-Tier': config.environment === 'prod' ? 'High' : 'Standard',
      'Backup-Required': 'true',
      'Encryption-Required': 'true',
    };
  }
  
  /**
   * AWS Batch専用タグを生成
   */
  static generateBatchTags(config: TaggingConfig): Record<string, string> {
    const baseTags = this.generateCostAllocationTags(config);
    
    return {
      ...baseTags,
      'Service-Type': 'AWS-Batch',
      'Use-Case': 'Embedding-Processing',
      'Compute-Type': 'Batch-Jobs',
      'Auto-Scaling': 'true',
    };
  }
  
  /**
   * OpenSearch専用タグを生成
   */
  static generateOpenSearchTags(config: TaggingConfig): Record<string, string> {
    const baseTags = this.generateCostAllocationTags(config);
    
    return {
      ...baseTags,
      'Service-Type': 'OpenSearch-Serverless',
      'Use-Case': 'Vector-Search',
      'Data-Type': 'Embeddings',
      'Search-Type': 'Semantic-Search',
    };
  }
  
  /**
   * Lambda専用タグを生成
   */
  static generateLambdaTags(config: TaggingConfig, functionPurpose: string): Record<string, string> {
    const baseTags = this.generateCostAllocationTags(config);
    
    return {
      ...baseTags,
      'Service-Type': 'AWS-Lambda',
      'Function-Purpose': functionPurpose,
      'Runtime': 'nodejs20.x',
      'Architecture': 'x86_64',
    };
  }
  
  /**
   * コスト最適化用タグを生成
   */
  static generateCostOptimizationTags(config: TaggingConfig, resourceType: ServiceType): Record<string, string> {
    const baseTags = this.generateCostAllocationTags(config);
    
    // リソースタイプ別のコスト最適化設定
    const optimizationSettings = {
      'FSx-for-NetApp-ONTAP': {
        'Cost-Optimization': 'Storage-Tiering',
        'Billing-Mode': 'Provisioned',
        'Review-Schedule': 'Monthly',
      },
      'AWS-Batch': {
        'Cost-Optimization': 'Spot-Instances',
        'Billing-Mode': 'On-Demand',
        'Review-Schedule': 'Weekly',
      },
      'OpenSearch-Serverless': {
        'Cost-Optimization': 'Auto-Scaling',
        'Billing-Mode': 'Serverless',
        'Review-Schedule': 'Daily',
      },
      'AWS-Lambda': {
        'Cost-Optimization': 'Memory-Optimization',
        'Billing-Mode': 'Pay-Per-Use',
        'Review-Schedule': 'Weekly',
      },
    };
    
    return {
      ...baseTags,
      'Service-Type': resourceType,
      ...optimizationSettings[resourceType] || {},
      'Cost-Review-Required': config.environment === 'prod' ? 'true' : 'false',
    };
  }
}

/**
 * プロジェクト固有のタグ設定
 */
export class PermissionAwareRAGTags {
  /**
   * プロジェクト標準のタグ設定を取得
   */
  static getStandardConfig(projectName: string, environment: Environment): TaggingConfig {
    return {
      projectName,
      environment,
      department: 'AI-Engineering',
      owner: 'RAG-Team',
      customTags: {
        'Application-Type': 'RAG-System',
        'Technology-Stack': 'CDK-TypeScript',
        'Data-Classification': 'Internal',
        'Compliance-Required': 'true',
      },
    };
  }
  
  /**
   * 環境別のタグ設定を取得
   */
  static getEnvironmentConfig(environment: string): Partial<TaggingConfig> {
    const configs = {
      dev: {
        customTags: {
          'Cost-Center': 'Development',
          'Auto-Shutdown': 'true',
          'Monitoring-Level': 'Basic',
        },
      },
      staging: {
        customTags: {
          'Cost-Center': 'Testing',
          'Auto-Shutdown': 'false',
          'Monitoring-Level': 'Enhanced',
        },
      },
      prod: {
        customTags: {
          'Cost-Center': 'Production',
          'Auto-Shutdown': 'false',
          'Monitoring-Level': 'Full',
          'Backup-Required': 'true',
          'DR-Required': 'true',
        },
      },
    };
    
    return configs[environment as keyof typeof configs] || configs.dev;
  }
  
  /**
   * セキュリティ要件に基づくタグ設定を取得
   */
  static getSecurityConfig(environment: Environment): Partial<TaggingConfig> {
    const securityConfigs = {
      dev: {
        customTags: {
          'Security-Level': 'Basic',
          'Data-Classification': 'Internal',
          'Encryption-Required': 'false',
          'Access-Review': 'Quarterly',
        },
      },
      staging: {
        customTags: {
          'Security-Level': 'Enhanced',
          'Data-Classification': 'Confidential',
          'Encryption-Required': 'true',
          'Access-Review': 'Monthly',
        },
      },
      prod: {
        customTags: {
          'Security-Level': 'Maximum',
          'Data-Classification': 'Restricted',
          'Encryption-Required': 'true',
          'Access-Review': 'Weekly',
          'Compliance-Required': 'true',
          'Audit-Required': 'true',
        },
      },
    };
    
    return securityConfigs[environment] || securityConfigs.dev;
  }
}