import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
/**
 * FSx for ONTAP S3 Access Point用のBedrock Knowledge Base（S3 Vectors使用）
 *
 * このスタックは以下のリソースを作成します：
 * 1. S3バケット（ベクトルストレージ用）
 * 2. IAMロール（Knowledge Base実行用）
 * 3. Bedrock Knowledge Base（S3 Vectors設定）
 * 4. データソース（FSx for ONTAP S3 Access Point）
 */
export declare class BedrockKnowledgeBaseS3VectorsStack extends cdk.Stack {
    readonly knowledgeBaseId: string;
    readonly knowledgeBaseArn: string;
    readonly vectorBucketArn: string;
    readonly indexArn: string;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
