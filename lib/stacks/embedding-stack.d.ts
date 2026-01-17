/**
 * Embedding Stack
 * Embedding統合スタック - 統一命名規則適用
 *
 * 統合機能:
 * - AWS Batch、ECS、Lambda、Bedrock、埋め込み、RAG、文書処理
 * - Component="Embedding"による統一命名規則
 * - 設定・変更容易性を担保するモジュール化アーキテクチャ
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { GlobalRagConfig } from '../../types/global-config';
export interface EmbeddingStackProps extends StackProps {
    config: GlobalRagConfig;
    vpc?: ec2.IVpc;
    documentsTable?: dynamodb.ITable;
    embeddingsTable?: dynamodb.ITable;
    documentsBucket?: s3.IBucket;
}
export declare class EmbeddingStack extends Stack {
    documentProcessorFunction?: lambda.Function;
    embeddingFunction?: lambda.Function;
    ragQueryFunction?: lambda.Function;
    ecsCluster?: ecs.Cluster;
    bedrockRole?: iam.Role;
    tempProcessingBucket?: s3.Bucket;
    constructor(scope: Construct, id: string, props: EmbeddingStackProps);
    private createEcsCluster;
    private createTempProcessingBucket;
    private createBedrockRole;
    private createLambdaFunctions;
    /**
     * リージョンからregionPrefixを取得
     */
    private getRegionPrefix;
}
