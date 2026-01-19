/**
 * スタック命名ジェネレーター
 * 統一された命名規則でスタック名を生成
 */
import { NamingConfig, StackComponent, ResourceNamingConfig } from '../interfaces/naming-config';
/**
 * スタック命名ジェネレータークラス
 */
export declare class StackNamingGenerator {
    private config;
    constructor(config: NamingConfig);
    /**
     * スタック名生成
     * パターン: {RegionPrefix}-{ProjectName}-{Environment}-{Component}
     */
    generateStackName(component: StackComponent): string;
    /**
     * リソース命名設定生成
     */
    generateResourceNamingConfig(): ResourceNamingConfig;
    /**
     * Lambda関数名生成
     */
    generateLambdaFunctionName(functionName: string): string;
    /**
     * DynamoDBテーブル名生成
     */
    generateDynamoDBTableName(tableName: string): string;
    /**
     * S3バケット名生成
     */
    generateS3BucketName(bucketName: string): string;
    /**
     * CloudWatch LogGroup名生成
     */
    generateLogGroupName(functionName: string): string;
    /**
     * IAMロール名生成
     */
    generateIAMRoleName(roleName: string): string;
    /**
     * 設定情報取得
     */
    getConfig(): NamingConfig;
}
