/**
 * スタック命名ジェネレーター
 * 統一された命名規則でスタック名を生成
 */

import { NamingConfig, StackComponent, ResourceNamingConfig } from '../interfaces/naming-config';

/**
 * スタック命名ジェネレータークラス
 */
export class StackNamingGenerator {
  private config: NamingConfig;
  
  constructor(config: NamingConfig) {
    this.config = {
      ...config,
      separator: config.separator || '-'
    };
  }
  
  /**
   * スタック名生成
   * パターン: {RegionPrefix}-{ProjectName}-{Environment}-{Component}
   */
  generateStackName(component: StackComponent): string {
    const parts = [
      this.config.regionPrefix,
      this.config.projectName,
      this.config.environment,
      component
    ];
    
    return parts.join(this.config.separator);
  }
  
  /**
   * リソース命名設定生成
   */
  generateResourceNamingConfig(): ResourceNamingConfig {
    const basePrefix = `${this.config.projectName}${this.config.separator}${this.config.environment}`;
    
    return {
      lambdaPrefix: `${basePrefix}${this.config.separator}`,
      dynamodbPrefix: `${basePrefix}${this.config.separator}`,
      s3Prefix: `${basePrefix}${this.config.separator}`,
      logGroupPrefix: `/aws/lambda/${basePrefix}${this.config.separator}`,
      iamRolePrefix: `${basePrefix}${this.config.separator}`
    };
  }
  
  /**
   * Lambda関数名生成
   */
  generateLambdaFunctionName(functionName: string): string {
    const resourceConfig = this.generateResourceNamingConfig();
    return `${resourceConfig.lambdaPrefix}${functionName}`;
  }
  
  /**
   * DynamoDBテーブル名生成
   */
  generateDynamoDBTableName(tableName: string): string {
    const resourceConfig = this.generateResourceNamingConfig();
    return `${resourceConfig.dynamodbPrefix}${tableName}`;
  }
  
  /**
   * S3バケット名生成
   */
  generateS3BucketName(bucketName: string): string {
    const resourceConfig = this.generateResourceNamingConfig();
    // S3バケット名は小文字のみ
    return `${resourceConfig.s3Prefix}${bucketName}`.toLowerCase();
  }
  
  /**
   * CloudWatch LogGroup名生成
   */
  generateLogGroupName(functionName: string): string {
    const resourceConfig = this.generateResourceNamingConfig();
    return `${resourceConfig.logGroupPrefix}${functionName}`;
  }
  
  /**
   * IAMロール名生成
   */
  generateIAMRoleName(roleName: string): string {
    const resourceConfig = this.generateResourceNamingConfig();
    return `${resourceConfig.iamRolePrefix}${roleName}`;
  }
  
  /**
   * 設定情報取得
   */
  getConfig(): NamingConfig {
    return { ...this.config };
  }
}