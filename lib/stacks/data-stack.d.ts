/**
 * Data Stack
 * データ・ストレージ統合スタック
 *
 * 統合機能:
 * - DynamoDB、OpenSearch、RDS、FSx、S3、バックアップ、ライフサイクル
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { GlobalRagConfig } from '../../types/global-config';
export interface DataStackProps extends StackProps {
    config: GlobalRagConfig;
    vpc?: ec2.IVpc;
}
export declare class DataStack extends Stack {
    documentsTable?: dynamodb.Table;
    embeddingsTable?: dynamodb.Table;
    searchDomain?: any;
    documentsBucket?: s3.Bucket;
    backupVault?: backup.BackupVault;
    constructor(scope: Construct, id: string, props: DataStackProps);
    private createDynamoDbTables;
    private createOpenSearchDomain;
    private createS3Buckets;
    private createBackupConfiguration;
}
