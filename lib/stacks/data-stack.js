"use strict";
/**
 * Data Stack
 * データ・ストレージ統合スタック
 *
 * 統合機能:
 * - DynamoDB、OpenSearch、RDS、FSx、S3、バックアップ、ライフサイクル
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const backup = __importStar(require("aws-cdk-lib/aws-backup"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
class DataStack extends aws_cdk_lib_1.Stack {
    documentsTable;
    embeddingsTable;
    searchDomain; // OpenSearch Serverless CfnCollection
    documentsBucket;
    backupVault;
    constructor(scope, id, props) {
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
    createDynamoDbTables(config) {
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
            removalPolicy: config.environment === 'prod' ? aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY,
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
            removalPolicy: config.environment === 'prod' ? aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY
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
    createOpenSearchDomain(config, vpc) {
        const domainName = `${config.projectName}-search-${config.environment}`;
        // OpenSearch Serverless collection
        this.searchDomain = new opensearch.CfnCollection(this, 'SearchDomain', {
            name: domainName,
            type: 'VECTORSEARCH',
            description: `OpenSearch Serverless collection for ${config.projectName}`
        }); // Type assertion to match expected type
    }
    createS3Buckets(config) {
        // Documents storage bucket
        this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
            bucketName: `${config.projectName}-documents-${config.environment}-${config.region}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true,
            removalPolicy: config.environment === 'prod' ? aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY,
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
                        transitionAfter: aws_cdk_lib_1.Duration.days(30)
                    },
                    {
                        storageClass: s3.StorageClass.GLACIER,
                        transitionAfter: aws_cdk_lib_1.Duration.days(90)
                    },
                    {
                        storageClass: s3.StorageClass.DEEP_ARCHIVE,
                        transitionAfter: aws_cdk_lib_1.Duration.days(365)
                    }
                ]
            });
            // Delete old versions
            this.documentsBucket.addLifecycleRule({
                id: 'DeleteOldVersions',
                enabled: true,
                noncurrentVersionExpiration: aws_cdk_lib_1.Duration.days(365)
            });
        }
    }
    createBackupConfiguration(config) {
        // Create backup vault
        this.backupVault = new backup.BackupVault(this, 'BackupVault', {
            backupVaultName: `${config.projectName}-backup-vault-${config.environment}`,
            encryptionKey: undefined, // Use default AWS managed key
            removalPolicy: config.environment === 'prod' ? aws_cdk_lib_1.RemovalPolicy.RETAIN : aws_cdk_lib_1.RemovalPolicy.DESTROY
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
                deleteAfter: aws_cdk_lib_1.Duration.days(365),
                moveToColdStorageAfter: aws_cdk_lib_1.Duration.days(30)
            }));
        }
        else {
            // Non-production: Weekly backups with shorter retention
            backupPlan.addRule(new backup.BackupPlanRule({
                ruleName: 'WeeklyBackups',
                scheduleExpression: events.Schedule.cron({
                    weekDay: '1',
                    hour: '2',
                    minute: '0'
                }),
                deleteAfter: aws_cdk_lib_1.Duration.days(30)
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
exports.DataStack = DataStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGEtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCw2Q0FBeUU7QUFFekUsbUVBQXFEO0FBQ3JELGlGQUFtRTtBQUNuRSx1REFBeUM7QUFDekMsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQVVqRCxNQUFhLFNBQVUsU0FBUSxtQkFBSztJQUMzQixjQUFjLENBQWtCO0lBQ2hDLGVBQWUsQ0FBa0I7SUFDakMsWUFBWSxDQUFPLENBQUMsc0NBQXNDO0lBQzFELGVBQWUsQ0FBYTtJQUM1QixXQUFXLENBQXNCO0lBRXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUI7UUFDN0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV6QixrQkFBa0I7UUFDbEIsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELG9CQUFvQjtRQUNwQixJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3hDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxhQUFhO1FBQ2IsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCx1QkFBdUI7UUFDdkIsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE9B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QUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUM5RixHQUFHLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7aUJBQ2pHO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7Q0FDRjtBQWxNRCw4QkFrTUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERhdGEgU3RhY2tcbiAqIOODh+ODvOOCv+ODu+OCueODiOODrOODvOOCuOe1seWQiOOCueOCv+ODg+OCr1xuICogXG4gKiDntbHlkIjmqZ/og706XG4gKiAtIER5bmFtb0RC44CBT3BlblNlYXJjaOOAgVJEU+OAgUZTeOOAgVMz44CB44OQ44OD44Kv44Ki44OD44OX44CB44Op44Kk44OV44K144Kk44Kv44OrXG4gKi9cblxuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIFJlbW92YWxQb2xpY3ksIER1cmF0aW9uIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgb3BlbnNlYXJjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtb3BlbnNlYXJjaHNlcnZlcmxlc3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGJhY2t1cCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYmFja3VwJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCB7IEdsb2JhbFJhZ0NvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERhdGFTdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XG4gIGNvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuICB2cGM/OiBlYzIuSVZwYztcbn1cblxuZXhwb3J0IGNsYXNzIERhdGFTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIGRvY3VtZW50c1RhYmxlPzogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyBlbWJlZGRpbmdzVGFibGU/OiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHNlYXJjaERvbWFpbj86IGFueTsgLy8gT3BlblNlYXJjaCBTZXJ2ZXJsZXNzIENmbkNvbGxlY3Rpb25cbiAgcHVibGljIGRvY3VtZW50c0J1Y2tldD86IHMzLkJ1Y2tldDtcbiAgcHVibGljIGJhY2t1cFZhdWx0PzogYmFja3VwLkJhY2t1cFZhdWx0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEYXRhU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBjb25maWcgfSA9IHByb3BzO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgaWYgKGNvbmZpZy5mZWF0dXJlcy5kYXRhYmFzZS5keW5hbW9kYikge1xuICAgICAgdGhpcy5jcmVhdGVEeW5hbW9EYlRhYmxlcyhjb25maWcpO1xuICAgIH1cblxuICAgIC8vIE9wZW5TZWFyY2ggRG9tYWluXG4gICAgaWYgKGNvbmZpZy5mZWF0dXJlcy5kYXRhYmFzZS5vcGVuc2VhcmNoKSB7XG4gICAgICB0aGlzLmNyZWF0ZU9wZW5TZWFyY2hEb21haW4oY29uZmlnLCBwcm9wcy52cGMpO1xuICAgIH1cblxuICAgIC8vIFMzIEJ1Y2tldHNcbiAgICBpZiAoY29uZmlnLmZlYXR1cmVzLnN0b3JhZ2UuczMpIHtcbiAgICAgIHRoaXMuY3JlYXRlUzNCdWNrZXRzKGNvbmZpZyk7XG4gICAgfVxuXG4gICAgLy8gQmFja3VwIENvbmZpZ3VyYXRpb25cbiAgICBpZiAoY29uZmlnLmZlYXR1cmVzLnN0b3JhZ2UuYmFja3VwKSB7XG4gICAgICB0aGlzLmNyZWF0ZUJhY2t1cENvbmZpZ3VyYXRpb24oY29uZmlnKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUR5bmFtb0RiVGFibGVzKGNvbmZpZzogR2xvYmFsUmFnQ29uZmlnKTogdm9pZCB7XG4gICAgLy8gRG9jdW1lbnRzIG1ldGFkYXRhIHRhYmxlXG4gICAgdGhpcy5kb2N1bWVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRG9jdW1lbnRzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0tZG9jdW1lbnRzLSR7Y29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2RvY3VtZW50SWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3ZlcnNpb24nLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyBSZW1vdmFsUG9saWN5LlJFVEFJTiA6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHN0cmVhbTogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0FORF9PTERfSU1BR0VTXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciB1c2VyLWJhc2VkIHF1ZXJpZXNcbiAgICB0aGlzLmRvY3VtZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1VzZXJJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3VzZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEVtYmVkZGluZ3MgdGFibGUgZm9yIHZlY3RvciBzdG9yYWdlXG4gICAgdGhpcy5lbWJlZGRpbmdzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0VtYmVkZGluZ3NUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7Y29uZmlnLnByb2plY3ROYW1lfS1lbWJlZGRpbmdzLSR7Y29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2VtYmVkZGluZ0lkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBSZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIGRvY3VtZW50LWJhc2VkIHF1ZXJpZXNcbiAgICB0aGlzLmVtYmVkZGluZ3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdEb2N1bWVudEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnZG9jdW1lbnRJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY2h1bmtJbmRleCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZU9wZW5TZWFyY2hEb21haW4oY29uZmlnOiBHbG9iYWxSYWdDb25maWcsIHZwYz86IGVjMi5JVnBjKTogdm9pZCB7XG4gICAgY29uc3QgZG9tYWluTmFtZSA9IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0tc2VhcmNoLSR7Y29uZmlnLmVudmlyb25tZW50fWA7XG5cbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3MgY29sbGVjdGlvblxuICAgIHRoaXMuc2VhcmNoRG9tYWluID0gbmV3IG9wZW5zZWFyY2guQ2ZuQ29sbGVjdGlvbih0aGlzLCAnU2VhcmNoRG9tYWluJywge1xuICAgICAgbmFtZTogZG9tYWluTmFtZSxcbiAgICAgIHR5cGU6ICdWRUNUT1JTRUFSQ0gnLFxuICAgICAgZGVzY3JpcHRpb246IGBPcGVuU2VhcmNoIFNlcnZlcmxlc3MgY29sbGVjdGlvbiBmb3IgJHtjb25maWcucHJvamVjdE5hbWV9YFxuICAgIH0pIGFzIGFueTsgLy8gVHlwZSBhc3NlcnRpb24gdG8gbWF0Y2ggZXhwZWN0ZWQgdHlwZVxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTM0J1Y2tldHMoY29uZmlnOiBHbG9iYWxSYWdDb25maWcpOiB2b2lkIHtcbiAgICAvLyBEb2N1bWVudHMgc3RvcmFnZSBidWNrZXRcbiAgICB0aGlzLmRvY3VtZW50c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0RvY3VtZW50c0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0tZG9jdW1lbnRzLSR7Y29uZmlnLmVudmlyb25tZW50fS0ke2NvbmZpZy5yZWdpb259YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IFJlbW92YWxQb2xpY3kuUkVUQUlOIDogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IGNvbmZpZy5lbnZpcm9ubWVudCAhPT0gJ3Byb2QnXG4gICAgfSk7XG5cbiAgICAvLyBMaWZlY3ljbGUgcnVsZXMgZm9yIGNvc3Qgb3B0aW1pemF0aW9uXG4gICAgaWYgKGNvbmZpZy5mZWF0dXJlcy5zdG9yYWdlLmxpZmVjeWNsZSkge1xuICAgICAgdGhpcy5kb2N1bWVudHNCdWNrZXQuYWRkTGlmZWN5Y2xlUnVsZSh7XG4gICAgICAgIGlkOiAnVHJhbnNpdGlvblRvSUEnLFxuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBEdXJhdGlvbi5kYXlzKDMwKVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogRHVyYXRpb24uZGF5cyg5MClcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkRFRVBfQVJDSElWRSxcbiAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogRHVyYXRpb24uZGF5cygzNjUpXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9KTtcblxuICAgICAgLy8gRGVsZXRlIG9sZCB2ZXJzaW9uc1xuICAgICAgdGhpcy5kb2N1bWVudHNCdWNrZXQuYWRkTGlmZWN5Y2xlUnVsZSh7XG4gICAgICAgIGlkOiAnRGVsZXRlT2xkVmVyc2lvbnMnLFxuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IER1cmF0aW9uLmRheXMoMzY1KVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCYWNrdXBDb25maWd1cmF0aW9uKGNvbmZpZzogR2xvYmFsUmFnQ29uZmlnKTogdm9pZCB7XG4gICAgLy8gQ3JlYXRlIGJhY2t1cCB2YXVsdFxuICAgIHRoaXMuYmFja3VwVmF1bHQgPSBuZXcgYmFja3VwLkJhY2t1cFZhdWx0KHRoaXMsICdCYWNrdXBWYXVsdCcsIHtcbiAgICAgIGJhY2t1cFZhdWx0TmFtZTogYCR7Y29uZmlnLnByb2plY3ROYW1lfS1iYWNrdXAtdmF1bHQtJHtjb25maWcuZW52aXJvbm1lbnR9YCxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHVuZGVmaW5lZCwgLy8gVXNlIGRlZmF1bHQgQVdTIG1hbmFnZWQga2V5XG4gICAgICByZW1vdmFsUG9saWN5OiBjb25maWcuZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IFJlbW92YWxQb2xpY3kuUkVUQUlOIDogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYmFja3VwIHBsYW5cbiAgICBjb25zdCBiYWNrdXBQbGFuID0gbmV3IGJhY2t1cC5CYWNrdXBQbGFuKHRoaXMsICdCYWNrdXBQbGFuJywge1xuICAgICAgYmFja3VwUGxhbk5hbWU6IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0tYmFja3VwLXBsYW4tJHtjb25maWcuZW52aXJvbm1lbnR9YCxcbiAgICAgIGJhY2t1cFZhdWx0OiB0aGlzLmJhY2t1cFZhdWx0XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgYmFja3VwIHJ1bGVzIGJhc2VkIG9uIGVudmlyb25tZW50XG4gICAgaWYgKGNvbmZpZy5lbnZpcm9ubWVudCA9PT0gJ3Byb2QnKSB7XG4gICAgICAvLyBQcm9kdWN0aW9uOiBEYWlseSBiYWNrdXBzIHdpdGggbG9uZyByZXRlbnRpb25cbiAgICAgIGJhY2t1cFBsYW4uYWRkUnVsZShuZXcgYmFja3VwLkJhY2t1cFBsYW5SdWxlKHtcbiAgICAgICAgcnVsZU5hbWU6ICdEYWlseUJhY2t1cHMnLFxuICAgICAgICBzY2hlZHVsZUV4cHJlc3Npb246IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgICBob3VyOiAnMicsXG4gICAgICAgICAgbWludXRlOiAnMCdcbiAgICAgICAgfSksXG4gICAgICAgIGRlbGV0ZUFmdGVyOiBEdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgIG1vdmVUb0NvbGRTdG9yYWdlQWZ0ZXI6IER1cmF0aW9uLmRheXMoMzApXG4gICAgICB9KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vbi1wcm9kdWN0aW9uOiBXZWVrbHkgYmFja3VwcyB3aXRoIHNob3J0ZXIgcmV0ZW50aW9uXG4gICAgICBiYWNrdXBQbGFuLmFkZFJ1bGUobmV3IGJhY2t1cC5CYWNrdXBQbGFuUnVsZSh7XG4gICAgICAgIHJ1bGVOYW1lOiAnV2Vla2x5QmFja3VwcycsXG4gICAgICAgIHNjaGVkdWxlRXhwcmVzc2lvbjogZXZlbnRzLlNjaGVkdWxlLmNyb24oe1xuICAgICAgICAgIHdlZWtEYXk6ICcxJyxcbiAgICAgICAgICBob3VyOiAnMicsXG4gICAgICAgICAgbWludXRlOiAnMCdcbiAgICAgICAgfSksXG4gICAgICAgIGRlbGV0ZUFmdGVyOiBEdXJhdGlvbi5kYXlzKDMwKVxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBiYWNrdXAgc2VsZWN0aW9uIGZvciBEeW5hbW9EQiB0YWJsZXNcbiAgICBpZiAodGhpcy5kb2N1bWVudHNUYWJsZSB8fCB0aGlzLmVtYmVkZGluZ3NUYWJsZSkge1xuICAgICAgbmV3IGJhY2t1cC5CYWNrdXBTZWxlY3Rpb24odGhpcywgJ0JhY2t1cFNlbGVjdGlvbicsIHtcbiAgICAgICAgYmFja3VwUGxhbixcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgLi4uKHRoaXMuZG9jdW1lbnRzVGFibGUgPyBbYmFja3VwLkJhY2t1cFJlc291cmNlLmZyb21EeW5hbW9EYlRhYmxlKHRoaXMuZG9jdW1lbnRzVGFibGUpXSA6IFtdKSxcbiAgICAgICAgICAuLi4odGhpcy5lbWJlZGRpbmdzVGFibGUgPyBbYmFja3VwLkJhY2t1cFJlc291cmNlLmZyb21EeW5hbW9EYlRhYmxlKHRoaXMuZW1iZWRkaW5nc1RhYmxlKV0gOiBbXSlcbiAgICAgICAgXVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59Il19