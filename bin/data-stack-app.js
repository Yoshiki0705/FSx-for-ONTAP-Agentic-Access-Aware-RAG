#!/usr/bin/env node
"use strict";
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const efs = __importStar(require("aws-cdk-lib/aws-efs"));
const data_stack_1 = require("../lib/stacks/integrated/data-stack");
/**
 * DataStack専用CDKアプリケーション
 *
 * NetworkingStack統合完了後のDataStackデプロイ用エントリーポイント
 *
 * 前提条件:
 * - NetworkingStack: デプロイ済み（UPDATE_COMPLETE）
 * - SecurityStack: デプロイ済み（CREATE_COMPLETE）
 */
const app = new cdk.App();
// 環境設定
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};
// プロジェクト設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const regionPrefix = 'TokyoRegion';
// NetworkingStackからのVPC情報（CloudFormation出力値から取得）
const vpcConfig = {
    vpcId: 'vpc-09aa251d6db52b1fc',
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
    publicSubnetIds: ['subnet-06a00a8866d09b912', 'subnet-0d7c7e43c1325cd3b', 'subnet-06df589d2ed2a5fc0'],
    privateSubnetIds: ['subnet-0a84a16a1641e970f', 'subnet-0c4599b4863ff4d33', 'subnet-0c9ad18a58c06e7c5'],
    vpcCidrBlock: '10.21.0.0/16',
};
// DataStack完全設定（型定義に完全準拠）
const dataStackConfig = {
    // ストレージ設定（StorageConfig完全準拠）
    storage: {
        // タグ設定（StorageConstruct互換性のため）
        tags: {
            StorageType: 'Hybrid',
            BackupEnabled: 'true',
            EncryptionEnabled: 'true',
            DataClassification: 'Confidential',
            RetentionPeriod: '365days',
        },
        // S3設定（必須）
        s3: {
            encryption: {
                enabled: true,
                kmsManaged: true,
                bucketKeyEnabled: true,
            },
            versioning: true,
            lifecycle: {
                enabled: true,
                transitionToIA: 30,
                transitionToGlacier: 90,
                deleteAfter: 365,
                abortIncompleteMultipartUpload: 7,
            },
            publicAccess: {
                blockPublicRead: true,
                blockPublicWrite: true,
                blockPublicAcls: true,
                restrictPublicBuckets: true,
            },
            // 個別バケット設定（environment-config.ts互換）
            documents: {
                enabled: true,
                bucketName: `${projectName}-${environment}-documents`,
                encryption: true,
                versioning: true,
            },
            backup: {
                enabled: true,
                bucketName: `${projectName}-${environment}-backup`,
                encryption: true,
                versioning: true,
            },
            embeddings: {
                enabled: true,
                bucketName: `${projectName}-${environment}-embeddings`,
                encryption: true,
                versioning: false,
            },
        },
        // FSx設定（一時無効化）
        fsx: {
            enabled: false,
            fileSystemType: 'ONTAP',
            storageCapacity: 1024,
            throughputCapacity: 128,
            automaticBackupRetentionDays: 0,
            disableBackupConfirmed: true,
        },
        // FSx ONTAP設定（environment-config.ts互換性のため）
        fsxOntap: {
            enabled: false,
            fileSystemType: 'ONTAP',
            storageCapacity: 1024,
            throughputCapacity: 128,
            automaticBackupRetentionDays: 0,
            disableBackupConfirmed: true,
        },
        // EFS設定（オプション）
        efs: {
            enabled: false,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            encryption: true,
        },
    },
    // データベース設定（DatabaseConfig完全準拠）
    database: {
        // DynamoDB設定（必須）
        dynamoDb: {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: {
                enabled: true,
                kmsManaged: true,
            },
            pointInTimeRecovery: true,
            streams: {
                enabled: false,
                streamSpecification: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            },
            backup: {
                continuousBackups: true,
                deletionProtection: true,
            },
            customTables: [
                {
                    tableName: `${projectName}-${environment}-sessions`,
                    partitionKey: {
                        name: 'sessionId',
                        type: dynamodb.AttributeType.STRING,
                    },
                    sortKey: {
                        name: 'timestamp',
                        type: dynamodb.AttributeType.NUMBER,
                    },
                    ttl: {
                        enabled: true,
                        attributeName: 'expiresAt',
                    },
                    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                    encryption: {
                        enabled: true,
                        kmsManaged: true,
                    },
                    pointInTimeRecovery: true,
                },
                {
                    tableName: `${projectName}-${environment}-users`,
                    partitionKey: {
                        name: 'userId',
                        type: dynamodb.AttributeType.STRING,
                    },
                    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                    encryption: {
                        enabled: true,
                        kmsManaged: true,
                    },
                    pointInTimeRecovery: true,
                },
            ],
        },
        // OpenSearch設定（必須）
        openSearch: {
            enabled: false,
            serverless: true,
            encryption: {
                enabled: true,
                kmsManaged: true,
            },
        },
        // RDS設定（必須）
        rds: {
            enabled: false,
            engine: 'postgres',
            instanceClass: 'db.t3.micro',
            instanceSize: 'SMALL',
            allocatedStorage: 20,
            multiAz: false,
            databaseName: 'ragdb',
            username: 'raguser',
            encryption: {
                enabled: true,
                kmsManaged: true,
            },
            backup: {
                automaticBackup: true,
                retentionDays: 7,
                deletionProtection: false,
            },
        },
    },
};
// DataStack作成
const dataStack = new data_stack_1.DataStack(app, `${regionPrefix}-${projectName}-${environment}-Data`, {
    env,
    description: 'Data and Storage Stack - S3 and DynamoDB (FSx ONTAP temporarily disabled)',
    // 統合設定
    config: dataStackConfig,
    // VPC設定（NetworkingStackから）
    vpc: vpcConfig,
    privateSubnetIds: vpcConfig.privateSubnetIds,
    // プロジェクト設定
    projectName,
    environment,
    // タグ設定
    tags: {
        Project: projectName,
        Environment: environment,
        ManagedBy: 'CDK',
        Stack: 'DataStack',
        Region: env.region,
        DeployedBy: 'DataStackApp',
        NamingCompliance: 'AgentSteering',
    },
});
// グローバルタグ適用
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Architecture', 'Modular');
cdk.Tags.of(app).add('Region', env.region);
cdk.Tags.of(app).add('CreatedBy', 'DataStackApp');
cdk.Tags.of(app).add('NamingCompliance', 'AgentSteering');
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1zdGFjay1hcHAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhLXN0YWNrLWFwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyxvRUFBZ0U7QUFFaEU7Ozs7Ozs7O0dBUUc7QUFFSCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixPQUFPO0FBQ1AsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxjQUFjO0lBQzFELE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLGdCQUFnQjtDQUMzRCxDQUFDO0FBRUYsV0FBVztBQUNYLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUFDO0FBQzNDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQztBQUMzQixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUM7QUFFbkMsaURBQWlEO0FBQ2pELE1BQU0sU0FBUyxHQUFHO0lBQ2hCLEtBQUssRUFBRSx1QkFBdUI7SUFDOUIsaUJBQWlCLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQztJQUM1RSxlQUFlLEVBQUUsQ0FBQywwQkFBMEIsRUFBRSwwQkFBMEIsRUFBRSwwQkFBMEIsQ0FBQztJQUNyRyxnQkFBZ0IsRUFBRSxDQUFDLDBCQUEwQixFQUFFLDBCQUEwQixFQUFFLDBCQUEwQixDQUFDO0lBQ3RHLFlBQVksRUFBRSxjQUFjO0NBQzdCLENBQUM7QUFFRiwwQkFBMEI7QUFDMUIsTUFBTSxlQUFlLEdBQUc7SUFDdEIsNkJBQTZCO0lBQzdCLE9BQU8sRUFBRTtRQUNQLCtCQUErQjtRQUMvQixJQUFJLEVBQUU7WUFDSixXQUFXLEVBQUUsUUFBUTtZQUNy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Q0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDaEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztBQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFFMUQsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBlZnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVmcyc7XG5pbXBvcnQgeyBEYXRhU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvZGF0YS1zdGFjayc7XG5cbi8qKlxuICogRGF0YVN0YWNr5bCC55SoQ0RL44Ki44OX44Oq44Kx44O844K344On44OzXG4gKiBcbiAqIE5ldHdvcmtpbmdTdGFja+e1seWQiOWujOS6huW+jOOBrkRhdGFTdGFja+ODh+ODl+ODreOCpOeUqOOCqOODs+ODiOODquODvOODneOCpOODs+ODiFxuICogXG4gKiDliY3mj5DmnaHku7Y6XG4gKiAtIE5ldHdvcmtpbmdTdGFjazog44OH44OX44Ot44Kk5riI44G/77yIVVBEQVRFX0NPTVBMRVRF77yJXG4gKiAtIFNlY3VyaXR5U3RhY2s6IOODh+ODl+ODreOCpOa4iOOBv++8iENSRUFURV9DT01QTEVURe+8iVxuICovXG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIOeSsOWig+ioreWumlxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UIHx8ICcxMjM0NTY3ODkwMTInLFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnYXAtbm9ydGhlYXN0LTEnLFxufTtcblxuLy8g44OX44Ot44K444Kn44Kv44OI6Kit5a6aXG5jb25zdCBwcm9qZWN0TmFtZSA9ICdwZXJtaXNzaW9uLWF3YXJlLXJhZyc7XG5jb25zdCBlbnZpcm9ubWVudCA9ICdwcm9kJztcbmNvbnN0IHJlZ2lvblByZWZpeCA9ICdUb2t5b1JlZ2lvbic7XG5cbi8vIE5ldHdvcmtpbmdTdGFja+OBi+OCieOBrlZQQ+aDheWgse+8iENsb3VkRm9ybWF0aW9u5Ye65Yqb5YCk44GL44KJ5Y+W5b6X77yJXG5jb25zdCB2cGNDb25maWcgPSB7XG4gIHZwY0lkOiAndnBjLTA5YWEyNTFkNmRiNTJiMWZjJyxcbiAgYXZhaWxhYmlsaXR5Wm9uZXM6IFsnYXAtbm9ydGhlYXN0LTFhJywgJ2FwLW5vcnRoZWFzdC0xYycsICdhcC1ub3J0aGVhc3QtMWQnXSxcbiAgcHVibGljU3VibmV0SWRzOiBbJ3N1Ym5ldC0wNmEwMGE4ODY2ZDA5YjkxMicsICdzdWJuZXQtMGQ3YzdlNDNjMTMyNWNkM2InLCAnc3VibmV0LTA2ZGY1ODlkMmVkMmE1ZmMwJ10sXG4gIHByaXZhdGVTdWJuZXRJZHM6IFsnc3VibmV0LTBhODRhMTZhMTY0MWU5NzBmJywgJ3N1Ym5ldC0wYzQ1OTliNDg2M2ZmNGQzMycsICdzdWJuZXQtMGM5YWQxOGE1OGMwNmU3YzUnXSxcbiAgdnBjQ2lkckJsb2NrOiAnMTAuMjEuMC4wLzE2Jyxcbn07XG5cbi8vIERhdGFTdGFja+WujOWFqOioreWumu+8iOWei+Wumue+qeOBq+WujOWFqOa6luaLoO+8iVxuY29uc3QgZGF0YVN0YWNrQ29uZmlnID0ge1xuICAvLyDjgrnjg4jjg6zjg7zjgrjoqK3lrprvvIhTdG9yYWdlQ29uZmln5a6M5YWo5rqW5oug77yJXG4gIHN0b3JhZ2U6IHtcbiAgICAvLyDjgr/jgrDoqK3lrprvvIhTdG9yYWdlQ29uc3RydWN05LqS5o+b5oCn44Gu44Gf44KB77yJXG4gICAgdGFnczoge1xuICAgICAgU3RvcmFnZVR5cGU6ICdIeWJyaWQnLFxuICAgICAgQmFja3VwRW5hYmxlZDogJ3RydWUnLFxuICAgICAgRW5jcnlwdGlvbkVuYWJsZWQ6ICd0cnVlJyxcbiAgICAgIERhdGFDbGFzc2lmaWNhdGlvbjogJ0NvbmZpZGVudGlhbCcsXG4gICAgICBSZXRlbnRpb25QZXJpb2Q6ICczNjVkYXlzJyxcbiAgICB9LFxuICAgIC8vIFMz6Kit5a6a77yI5b+F6aCI77yJXG4gICAgczM6IHtcbiAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAga21zTWFuYWdlZDogdHJ1ZSxcbiAgICAgICAgYnVja2V0S2V5RW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICB2ZXJzaW9uaW5nOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHRyYW5zaXRpb25Ub0lBOiAzMCxcbiAgICAgICAgdHJhbnNpdGlvblRvR2xhY2llcjogOTAsXG4gICAgICAgIGRlbGV0ZUFmdGVyOiAzNjUsXG4gICAgICAgIGFib3J0SW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZDogNyxcbiAgICAgIH0sXG4gICAgICBwdWJsaWNBY2Nlc3M6IHtcbiAgICAgICAgYmxvY2tQdWJsaWNSZWFkOiB0cnVlLFxuICAgICAgICBibG9ja1B1YmxpY1dyaXRlOiB0cnVlLFxuICAgICAgICBibG9ja1B1YmxpY0FjbHM6IHRydWUsXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICAvLyDlgIvliKXjg5DjgrHjg4Pjg4joqK3lrprvvIhlbnZpcm9ubWVudC1jb25maWcudHPkupLmj5vvvIlcbiAgICAgIGRvY3VtZW50czoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBidWNrZXROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZG9jdW1lbnRzYCxcbiAgICAgICAgZW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbmluZzogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgYnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWJhY2t1cGAsXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IHRydWUsXG4gICAgICB9LFxuICAgICAgZW1iZWRkaW5nczoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBidWNrZXROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZW1iZWRkaW5nc2AsXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIEZTeOioreWumu+8iOS4gOaZgueEoeWKueWMlu+8iVxuICAgIGZzeDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICBmaWxlU3lzdGVtVHlwZTogJ09OVEFQJyBhcyBjb25zdCxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCxcbiAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogMTI4LFxuICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogMCxcbiAgICAgIGRpc2FibGVCYWNrdXBDb25maXJtZWQ6IHRydWUsXG4gICAgfSxcbiAgICAvLyBGU3ggT05UQVDoqK3lrprvvIhlbnZpcm9ubWVudC1jb25maWcudHPkupLmj5vmgKfjga7jgZ/jgoHvvIlcbiAgICBmc3hPbnRhcDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICBmaWxlU3lzdGVtVHlwZTogJ09OVEFQJyBhcyBjb25zdCxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCxcbiAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogMTI4LFxuICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogMCxcbiAgICAgIGRpc2FibGVCYWNrdXBDb25maXJtZWQ6IHRydWUsXG4gICAgfSxcbiAgICAvLyBFRlPoqK3lrprvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBlZnM6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgcGVyZm9ybWFuY2VNb2RlOiBlZnMuUGVyZm9ybWFuY2VNb2RlLkdFTkVSQUxfUFVSUE9TRSxcbiAgICAgIHRocm91Z2hwdXRNb2RlOiBlZnMuVGhyb3VnaHB1dE1vZGUuQlVSU1RJTkcsXG4gICAgICBlbmNyeXB0aW9uOiB0cnVlLFxuICAgIH0sXG4gIH0sXG4gIFxuICAvLyDjg4fjg7zjgr/jg5njg7zjgrnoqK3lrprvvIhEYXRhYmFzZUNvbmZpZ+WujOWFqOa6luaLoO+8iVxuICBkYXRhYmFzZToge1xuICAgIC8vIER5bmFtb0RC6Kit5a6a77yI5b+F6aCI77yJXG4gICAgZHluYW1vRGI6IHtcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGttc01hbmFnZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIHN0cmVhbXM6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHN0cmVhbVNwZWNpZmljYXRpb246IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICAgIH0sXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgY29udGludW91c0JhY2t1cHM6IHRydWUsXG4gICAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBjdXN0b21UYWJsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRhYmxlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXNlc3Npb25zYCxcbiAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICAgIG5hbWU6ICdzZXNzaW9uSWQnLFxuICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzb3J0S2V5OiB7XG4gICAgICAgICAgICBuYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdHRsOiB7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgYXR0cmlidXRlTmFtZTogJ2V4cGlyZXNBdCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBrbXNNYW5hZ2VkOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRhYmxlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXVzZXJzYCxcbiAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBrbXNNYW5hZ2VkOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICAvLyBPcGVuU2VhcmNo6Kit5a6a77yI5b+F6aCI77yJXG4gICAgb3BlblNlYXJjaDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICBzZXJ2ZXJsZXNzOiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBrbXNNYW5hZ2VkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIFJEU+ioreWumu+8iOW/hemgiO+8iVxuICAgIHJkczoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICBlbmdpbmU6ICdwb3N0Z3JlcycgYXMgYW55LFxuICAgICAgaW5zdGFuY2VDbGFzczogJ2RiLnQzLm1pY3JvJyBhcyBhbnksXG4gICAgICBpbnN0YW5jZVNpemU6ICdTTUFMTCcgYXMgYW55LFxuICAgICAgYWxsb2NhdGVkU3RvcmFnZTogMjAsXG4gICAgICBtdWx0aUF6OiBmYWxzZSxcbiAgICAgIGRhdGFiYXNlTmFtZTogJ3JhZ2RiJyxcbiAgICAgIHVzZXJuYW1lOiAncmFndXNlcicsXG4gICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGttc01hbmFnZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIGF1dG9tYXRpY0JhY2t1cDogdHJ1ZSxcbiAgICAgICAgcmV0ZW50aW9uRGF5czogNyxcbiAgICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn07XG5cbi8vIERhdGFTdGFja+S9nOaIkFxuY29uc3QgZGF0YVN0YWNrID0gbmV3IERhdGFTdGFjayhhcHAsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRGF0YWAsIHtcbiAgZW52LFxuICBkZXNjcmlwdGlvbjogJ0RhdGEgYW5kIFN0b3JhZ2UgU3RhY2sgLSBTMyBhbmQgRHluYW1vREIgKEZTeCBPTlRBUCB0ZW1wb3JhcmlseSBkaXNhYmxlZCknLFxuICBcbiAgLy8g57Wx5ZCI6Kit5a6aXG4gIGNvbmZpZzogZGF0YVN0YWNrQ29uZmlnLFxuICBcbiAgLy8gVlBD6Kit5a6a77yITmV0d29ya2luZ1N0YWNr44GL44KJ77yJXG4gIHZwYzogdnBjQ29uZmlnLFxuICBwcml2YXRlU3VibmV0SWRzOiB2cGNDb25maWcucHJpdmF0ZVN1Ym5ldElkcyxcbiAgXG4gIC8vIOODl+ODreOCuOOCp+OCr+ODiOioreWumlxuICBwcm9qZWN0TmFtZSxcbiAgZW52aXJvbm1lbnQsXG4gIFxuICAvLyDjgr/jgrDoqK3lrppcbiAgdGFnczoge1xuICAgIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICBNYW5hZ2VkQnk6ICdDREsnLFxuICAgIFN0YWNrOiAnRGF0YVN0YWNrJyxcbiAgICBSZWdpb246IGVudi5yZWdpb24sXG4gICAgRGVwbG95ZWRCeTogJ0RhdGFTdGFja0FwcCcsXG4gICAgTmFtaW5nQ29tcGxpYW5jZTogJ0FnZW50U3RlZXJpbmcnLFxuICB9LFxufSk7XG5cbi8vIOOCsOODreODvOODkOODq+OCv+OCsOmBqeeUqFxuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ1Byb2plY3QnLCBwcm9qZWN0TmFtZSk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudCk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ0FyY2hpdGVjdHVyZScsICdNb2R1bGFyJyk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnUmVnaW9uJywgZW52LnJlZ2lvbik7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnQ3JlYXRlZEJ5JywgJ0RhdGFTdGFja0FwcCcpO1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ05hbWluZ0NvbXBsaWFuY2UnLCAnQWdlbnRTdGVlcmluZycpO1xuXG5hcHAuc3ludGgoKTtcbiJdfQ==