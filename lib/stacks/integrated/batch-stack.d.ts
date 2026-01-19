import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BatchComputeEnvironment } from '../../modules/embedding/batch-compute';
/**
 * Batch Stack Configuration
 */
export interface BatchStackProps extends cdk.StackProps {
    /** プロジェクト名 */
    projectName: string;
    /** 環境名 */
    environment: string;
    /** VPC ID（既存VPCを使用） */
    vpcId?: string;
    /** 最小vCPU数 */
    minvCpus?: number;
    /** 最大vCPU数 */
    maxvCpus?: number;
    /** 希望vCPU数 */
    desiredvCpus?: number;
    /** コンテナイメージURI */
    containerImageUri?: string;
}
/**
 * AWS Batch Stack
 *
 * SQLite Embedding処理用のBatch環境を構築
 *
 * 主な機能:
 * - AWS Batch Compute Environment
 * - Job Queue
 * - Job Definition
 * - IAM Roles
 */
export declare class BatchStack extends cdk.Stack {
    readonly batchEnvironment: BatchComputeEnvironment;
    constructor(scope: Construct, id: string, props: BatchStackProps);
}
