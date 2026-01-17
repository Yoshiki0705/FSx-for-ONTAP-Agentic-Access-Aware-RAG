/**
 * Data Stack
 * データ・ストレージ統合スタック
 * 
 * 統合機能:
 * - DynamoDB、OpenSearch、RDS、FSx、S3、バックアップ、ライフサイクル
 */

import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { GlobalRagConfig } from '../../types/global-config';

export interface DataStackProps extends StackProps {
  config: GlobalRagConfig;
  vpc?: ec2.IVpc;
}

export class DataStack extends Stack {
  public documentsTable?: dynamodb.Table;
  public embeddingsTable?: dynamodb.Table;
  public searchDomain?: any; // OpenSearch Serverless CfnCollection
  public documentsBucket?: s3.Bucket;
  public backupVault?: backup.BackupVault;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;

    // DynamoDB Tables
    if (config.features.database.dynamodb) {
      this.createDynamoDbTables(config);
    }

    // OpenSearch Domain
    if (config.features.database.opensearch) {
      this.createOpenSearchDomain(config, props.vpc);
    }

    // S3 Buckets
    if (config.features.storage.s3) {
      this.createS3Buckets(config);
    }

    // Backup Configuration
    if (config.features.storage.backup) {
      this.createBackupConfiguration(config);
    }
  }

  private createDynamoDbTables(config: GlobalRagConfig): void {
    // Documents metadata table
    this.documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      tableName: `${config.projectName}-documents-${config.environment}`,
      partitionKey: {
        name: 'documentId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'version',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // Add GSI for user-based queries
    this.documentsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Embeddings table for vector storage
    this.embeddingsTable = new dynamodb.Table(this, 'EmbeddingsTable', {
      tableName: `${config.projectName}-embeddings-${config.environment}`,
      partitionKey: {
        name: 'embeddingId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    });

    // Add GSI for document-based queries
    this.embeddingsTable.addGlobalSecondaryIndex({
      indexName: 'DocumentIndex',
      partitionKey: {
        name: 'documentId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'chunkIndex',
        type: dynamodb.AttributeType.NUMBER
      }
    });
  }

  private createOpenSearchDomain(config: GlobalRagConfig, vpc?: ec2.IVpc): void {
    const domainName = `${config.projectName}-search-${config.environment}`;

    // OpenSearch Serverless collection
    this.searchDomain = new opensearch.CfnCollection(this, 'SearchDomain', {
      name: domainName,
      type: 'VECTORSEARCH',
      description: `OpenSearch Serverless collection for ${config.projectName}`
    }) as any; // Type assertion to match expected type
  }

  private createS3Buckets(config: GlobalRagConfig): void {
    // Documents storage bucket
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `${config.projectName}-documents-${config.environment}-${config.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod'
    });

    // Lifecycle rules for cost optimization
    if (config.features.storage.lifecycle) {
      this.documentsBucket.addLifecycleRule({
        id: 'TransitionToIA',
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: Duration.days(30)
          },
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: Duration.days(90)
          },
          {
            storageClass: s3.StorageClass.DEEP_ARCHIVE,
            transitionAfter: Duration.days(365)
          }
        ]
      });

      // Delete old versions
      this.documentsBucket.addLifecycleRule({
        id: 'DeleteOldVersions',
        enabled: true,
        noncurrentVersionExpiration: Duration.days(365)
      });
    }
  }

  private createBackupConfiguration(config: GlobalRagConfig): void {
    // Create backup vault
    this.backupVault = new backup.BackupVault(this, 'BackupVault', {
      backupVaultName: `${config.projectName}-backup-vault-${config.environment}`,
      encryptionKey: undefined, // Use default AWS managed key
      removalPolicy: config.environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    });

    // Create backup plan
    const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
      backupPlanName: `${config.projectName}-backup-plan-${config.environment}`,
      backupVault: this.backupVault
    });

    // Add backup rules based on environment
    if (config.environment === 'prod') {
      // Production: Daily backups with long retention
      backupPlan.addRule(new backup.BackupPlanRule({
        ruleName: 'DailyBackups',
        scheduleExpression: events.Schedule.cron({
          hour: '2',
          minute: '0'
        }),
        deleteAfter: Duration.days(365),
        moveToColdStorageAfter: Duration.days(30)
      }));
    } else {
      // Non-production: Weekly backups with shorter retention
      backupPlan.addRule(new backup.BackupPlanRule({
        ruleName: 'WeeklyBackups',
        scheduleExpression: events.Schedule.cron({
          weekDay: '1',
          hour: '2',
          minute: '0'
        }),
        deleteAfter: Duration.days(30)
      }));
    }

    // Create backup selection for DynamoDB tables
    if (this.documentsTable || this.embeddingsTable) {
      new backup.BackupSelection(this, 'BackupSelection', {
        backupPlan,
        resources: [
          ...(this.documentsTable ? [backup.BackupResource.fromDynamoDbTable(this.documentsTable)] : []),
          ...(this.embeddingsTable ? [backup.BackupResource.fromDynamoDbTable(this.embeddingsTable)] : [])
        ]
      });
    }
  }
}