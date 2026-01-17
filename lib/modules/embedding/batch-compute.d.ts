import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
/**
 * AWS Batch環境の設定
 */
export interface BatchComputeConfig {
    /** プロジェクト名 */
    projectName: string;
    /** 環境名 */
    environment: string;
    /** VPC */
    vpc: ec2.IVpc;
    /** セキュリティグループ */
    securityGroup: ec2.ISecurityGroup;
    /** サブネットID（明示的指定） */
    subnetIds?: string[];
    /** 最小vCPU数 */
    minvCpus?: number;
    /** 最大vCPU数 */
    maxvCpus?: number;
    /** 希望vCPU数 */
    desiredvCpus?: number;
    /** インスタンスタイプ */
    instanceTypes?: ec2.InstanceType[];
    /** コンテナイメージURI */
    containerImageUri?: string;
}
/**
 * AWS Batch Compute Environment Construct
 *
 * SQLite Embedding処理用のBatch環境を構築
 */
export declare class BatchComputeEnvironment extends Construct {
    readonly computeEnvironment: batch.CfnComputeEnvironment;
    readonly jobQueue: batch.CfnJobQueue;
    readonly jobDefinition: batch.CfnJobDefinition;
    readonly batchServiceRole: iam.Role;
    readonly instanceRole: iam.Role;
    constructor(scope: Construct, id: string, config: BatchComputeConfig);
}
