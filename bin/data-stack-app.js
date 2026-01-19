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
const data_stack_1 = require("../lib/stacks/integrated/data-stack");
const resource_conflict_handler_1 = require("../lib/utils/resource-conflict-handler");
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
    vpcId: 'vpc-066c268dc0cd2e6fd',
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
    publicSubnetIds: ['subnet-009f9c39eb1783be3', 'subnet-0bcf9bb06f9123bc6'],
    privateSubnetIds: ['subnet-06047e82ccdc7fbea', 'subnet-0e48a5cddf1c88b57'],
    vpcCidrBlock: '10.0.0.0/16',
};
// DataStack完全設定（型定義に完全準拠）
const dataStackConfig = {
    // ストレージ設定（StorageConfig完全準拠）
    storage: {
        // タグ設定（StorageConstruct互換性のため）
        tags: {
            StorageType: 'FSxONTAP',
            BackupEnabled: 'false',
            EncryptionEnabled: 'true',
            DataClassification: 'Confidential',
            RetentionPeriod: '0days',
        },
        // FSx設定（主要ストレージ）- Phase 5: FSx for ONTAP + S3 Access Point統合
        fsx: {
            enabled: true, // ✅ Phase 5: FSx for ONTAP再有効化
            fileSystemType: 'ONTAP',
            storageCapacity: 1024,
            throughputCapacity: 128,
            multiAz: false,
            deploymentType: 'SINGLE_AZ_1',
            automaticBackupRetentionDays: 0,
            disableBackupConfirmed: true,
            backup: {
                automaticBackup: false,
                retentionDays: 0,
                disableBackupConfirmed: true,
            },
            // ✅ Phase 5: S3 Access Point設定（IaC準拠）
            s3AccessPoint: {
                enabled: true,
                name: `${projectName}-${environment}-gateway-specs-ap`, // 動的生成
                fileSystemIdentity: {
                    type: 'UNIX',
                    unixUser: {
                        name: 'ec2-user', // UNIXユーザー（ファイルシステム権限あり）
                    },
                },
                networkConfiguration: {
                    vpcRestricted: true, // VPC制限を有効化
                    vpcId: vpcConfig.vpcId, // vpc-066c268dc0cd2e6fd（動的参照）
                },
                iamPolicy: {
                    enabled: false, // 初期デプロイでは無効化（後で有効化可能）
                    allowedPrincipals: [], // IAM Role ARNs（後で追加）
                    allowedActions: ['s3:GetObject', 's3:ListBucket'], // 基本的なS3アクション
                },
            },
        },
        // Gateway設定（Phase 4: AgentCore Gateway統合）
        gateway: {
            enabled: true,
            deploySpecs: true,
            bucketNamePrefix: 'permission-aware-rag', // Optional
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
// DataStack作成（VPC設定あり - FSx for ONTAP用）
const dataStack = new data_stack_1.DataStack(app, `${regionPrefix}-${projectName}-${environment}-Data`, {
    env,
    description: 'Data and Storage Stack - DynamoDB + FSx for ONTAP + Gateway Specs Bucket',
    // 統合設定
    config: dataStackConfig,
    // VPC設定（NetworkingStackから）- FSx for ONTAP用
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
// リソース競合チェックAspectの追加（デプロイ前に自動チェック）
const conflictHandler = new resource_conflict_handler_1.ResourceConflictHandler({
    region: env.region,
    accountId: env.account,
    stackName: `${regionPrefix}-${projectName}-${environment}-Data`,
    resourcePrefix: `${projectName}-${environment}`,
});
const conflictAspect = new resource_conflict_handler_1.ResourceConflictAspect(conflictHandler);
cdk.Aspects.of(dataStack).add(conflictAspect);
// CDK Synth実行
const assembly = app.synth();
// Synth後に競合チェックを実行（非同期）
(async () => {
    try {
        console.log('\n🔍 リソース競合チェック実行中...');
        const result = await conflictAspect.checkConflicts();
        conflictHandler.printConflictReport(result);
        if (result.hasConflict) {
            console.log('\n⚠️  競合が検出されました。デプロイ前に解決してください。');
            console.log('💡 自動修復スクリプトを使用:');
            console.log(`   npx ts-node development/scripts/deployment/pre-deploy-check.ts --stack-name ${regionPrefix}-${projectName}-${environment}-Data --auto-fix`);
            console.log('');
            // 競合があってもSynthは成功させる（デプロイ時にエラーになる）
        }
        else {
            console.log('✅ リソース競合なし - デプロイ可能');
        }
    }
    catch (error) {
        console.warn('⚠️  競合チェック中にエラーが発生しました:', error.message);
        console.warn('   デプロイは続行されますが、Early Validation errorが発生する可能性があります');
    }
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1zdGFjay1hcHAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhLXN0YWNrLWFwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsbUVBQXFEO0FBRXJELG9FQUFnRTtBQUNoRSxzRkFBeUc7QUFFekc7Ozs7Ozs7O0dBUUc7QUFFSCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixPQUFPO0FBQ1AsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxjQUFjO0lBQzFELE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLGdCQUFnQjtDQUMzRCxDQUFDO0FBRUYsV0FBVztBQUNYLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUFDO0FBQzNDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQztBQUMzQixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUM7QUFFbkMsaURBQWlEO0FBQ2pELE1BQU0sU0FBUyxHQUFHO0lBQ2hCLEtBQUssRUFBRSx1QkFBdUI7SUFDOUIsaUJBQWlCLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQztJQUN6RCxlQUFlLEVBQUUsQ0FBQywwQkFBMEIsRUFBRSwwQkFBMEIsQ0FBQztJQUN6RSxnQkFBZ0IsRUFBRSxDQUFDLDBCQUEwQixFQUFFLDBCQUEwQixDQUFDO0lBQzFFLFlBQVksRUFBRSxhQUFhO0NBQzVCLENBQUM7QUFFRiwwQkFBMEI7QUFDMUIsTUFBTSxlQUFlLEdBQUc7SUFDdEIsNkJBQTZCO0lBQzdCLE9BQU8sRUFBRTtRQUNQLCtCQUErQjtRQUMvQixJQUFJLEVBQUU7WUFDSixXQUFXLEVBQUUsVUFBVTtZQUN2QixhQUFhLEVBQUUsT0FBTztZQUN0QixpQkFBaUIsRUFBRSxN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QUNILENBQUM7SUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZELE9BQU8sQ0FBQyxJQUFJLENBQUMscURBQXFELENBQUMsQ0FBQztJQUN0RSxDQUFDO0FBQ0gsQ0FBQyxDQUFDLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgZWZzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lZnMnO1xuaW1wb3J0IHsgRGF0YVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9pbnRlZ3JhdGVkL2RhdGEtc3RhY2snO1xuaW1wb3J0IHsgUmVzb3VyY2VDb25mbGljdEhhbmRsZXIsIFJlc291cmNlQ29uZmxpY3RBc3BlY3QgfSBmcm9tICcuLi9saWIvdXRpbHMvcmVzb3VyY2UtY29uZmxpY3QtaGFuZGxlcic7XG5cbi8qKlxuICogRGF0YVN0YWNr5bCC55SoQ0RL44Ki44OX44Oq44Kx44O844K344On44OzXG4gKiBcbiAqIE5ldHdvcmtpbmdTdGFja+e1seWQiOWujOS6huW+jOOBrkRhdGFTdGFja+ODh+ODl+ODreOCpOeUqOOCqOODs+ODiOODquODvOODneOCpOODs+ODiFxuICogXG4gKiDliY3mj5DmnaHku7Y6XG4gKiAtIE5ldHdvcmtpbmdTdGFjazog44OH44OX44Ot44Kk5riI44G/77yIVVBEQVRFX0NPTVBMRVRF77yJXG4gKiAtIFNlY3VyaXR5U3RhY2s6IOODh+ODl+ODreOCpOa4iOOBv++8iENSRUFURV9DT01QTEVURe+8iVxuICovXG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIOeSsOWig+ioreWumlxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UIHx8ICcxMjM0NTY3ODkwMTInLFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAnYXAtbm9ydGhlYXN0LTEnLFxufTtcblxuLy8g44OX44Ot44K444Kn44Kv44OI6Kit5a6aXG5jb25zdCBwcm9qZWN0TmFtZSA9ICdwZXJtaXNzaW9uLWF3YXJlLXJhZyc7XG5jb25zdCBlbnZpcm9ubWVudCA9ICdwcm9kJztcbmNvbnN0IHJlZ2lvblByZWZpeCA9ICdUb2t5b1JlZ2lvbic7XG5cbi8vIE5ldHdvcmtpbmdTdGFja+OBi+OCieOBrlZQQ+aDheWgse+8iENsb3VkRm9ybWF0aW9u5Ye65Yqb5YCk44GL44KJ5Y+W5b6X77yJXG5jb25zdCB2cGNDb25maWcgPSB7XG4gIHZwY0lkOiAndnBjLTA2NmMyNjhkYzBjZDJlNmZkJyxcbiAgYXZhaWxhYmlsaXR5Wm9uZXM6IFsnYXAtbm9ydGhlYXN0LTFhJywgJ2FwLW5vcnRoZWFzdC0xYyddLFxuICBwdWJsaWNTdWJuZXRJZHM6IFsnc3VibmV0LTAwOWY5YzM5ZWIxNzgzYmUzJywgJ3N1Ym5ldC0wYmNmOWJiMDZmOTEyM2JjNiddLFxuICBwcml2YXRlU3VibmV0SWRzOiBbJ3N1Ym5ldC0wNjA0N2U4MmNjZGM3ZmJlYScsICdzdWJuZXQtMGU0OGE1Y2RkZjFjODhiNTcnXSxcbiAgdnBjQ2lkckJsb2NrOiAnMTAuMC4wLjAvMTYnLFxufTtcblxuLy8gRGF0YVN0YWNr5a6M5YWo6Kit5a6a77yI5Z6L5a6a576p44Gr5a6M5YWo5rqW5oug77yJXG5jb25zdCBkYXRhU3RhY2tDb25maWcgPSB7XG4gIC8vIOOCueODiOODrOODvOOCuOioreWumu+8iFN0b3JhZ2VDb25maWflrozlhajmupbmi6DvvIlcbiAgc3RvcmFnZToge1xuICAgIC8vIOOCv+OCsOioreWumu+8iFN0b3JhZ2VDb25zdHJ1Y3TkupLmj5vmgKfjga7jgZ/jgoHvvIlcbiAgICB0YWdzOiB7XG4gICAgICBTdG9yYWdlVHlwZTogJ0ZTeE9OVEFQJyxcbiAgICAgIEJhY2t1cEVuYWJsZWQ6ICdmYWxzZScsXG4gICAgICBFbmNyeXB0aW9uRW5hYmxlZDogJ3RydWUnLFxuICAgICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnQ29uZmlkZW50aWFsJyxcbiAgICAgIFJldGVudGlvblBlcmlvZDogJzBkYXlzJyxcbiAgICB9LFxuICAgIC8vIEZTeOioreWumu+8iOS4u+imgeOCueODiOODrOODvOOCuO+8iS0gUGhhc2UgNTogRlN4IGZvciBPTlRBUCArIFMzIEFjY2VzcyBQb2ludOe1seWQiFxuICAgIGZzeDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8g4pyFIFBoYXNlIDU6IEZTeCBmb3IgT05UQVDlho3mnInlirnljJZcbiAgICAgIGZpbGVTeXN0ZW1UeXBlOiAnT05UQVAnIGFzIGNvbnN0LFxuICAgICAgc3RvcmFnZUNhcGFjaXR5OiAxMDI0LFxuICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiAxMjgsXG4gICAgICBtdWx0aUF6OiBmYWxzZSxcbiAgICAgIGRlcGxveW1lbnRUeXBlOiAnU0lOR0xFX0FaXzEnIGFzIGNvbnN0LFxuICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogMCxcbiAgICAgIGRpc2FibGVCYWNrdXBDb25maXJtZWQ6IHRydWUsXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgYXV0b21hdGljQmFja3VwOiBmYWxzZSxcbiAgICAgICAgcmV0ZW50aW9uRGF5czogMCxcbiAgICAgICAgZGlzYWJsZUJhY2t1cENvbmZpcm1lZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICAvLyDinIUgUGhhc2UgNTogUzMgQWNjZXNzIFBvaW506Kit5a6a77yISWFD5rqW5oug77yJXG4gICAgICBzM0FjY2Vzc1BvaW50OiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1nYXRld2F5LXNwZWNzLWFwYCwgLy8g5YuV55qE55Sf5oiQXG4gICAgICAgIGZpbGVTeXN0ZW1JZGVudGl0eToge1xuICAgICAgICAgIHR5cGU6ICdVTklYJyBhcyBjb25zdCxcbiAgICAgICAgICB1bml4VXNlcjoge1xuICAgICAgICAgICAgbmFtZTogJ2VjMi11c2VyJywgLy8gVU5JWOODpuODvOOCtuODvO+8iOODleOCoeOCpOODq+OCt+OCueODhuODoOaoqemZkOOBguOCiu+8iVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIG5ldHdvcmtDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgdnBjUmVzdHJpY3RlZDogdHJ1ZSwgLy8gVlBD5Yi26ZmQ44KS5pyJ5Yq55YyWXG4gICAgICAgICAgdnBjSWQ6IHZwY0NvbmZpZy52cGNJZCwgLy8gdnBjLTA2NmMyNjhkYzBjZDJlNmZk77yI5YuV55qE5Y+C54Wn77yJXG4gICAgICAgIH0sXG4gICAgICAgIGlhbVBvbGljeToge1xuICAgICAgICAgIGVuYWJsZWQ6IGZhbHNlLCAvLyDliJ3mnJ/jg4fjg5fjg63jgqTjgafjga/nhKHlirnljJbvvIjlvozjgafmnInlirnljJblj6/og73vvIlcbiAgICAgICAgICBhbGxvd2VkUHJpbmNpcGFsczogW10sIC8vIElBTSBSb2xlIEFSTnPvvIjlvozjgafov73liqDvvIlcbiAgICAgICAgICBhbGxvd2VkQWN0aW9uczogWydzMzpHZXRPYmplY3QnLCAnczM6TGlzdEJ1Y2tldCddLCAvLyDln7rmnKznmoTjgapTM+OCouOCr+OCt+ODp+ODs1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIEdhdGV3YXnoqK3lrprvvIhQaGFzZSA0OiBBZ2VudENvcmUgR2F0ZXdheee1seWQiO+8iVxuICAgIGdhdGV3YXk6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBkZXBsb3lTcGVjczogdHJ1ZSxcbiAgICAgIGJ1Y2tldE5hbWVQcmVmaXg6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsIC8vIE9wdGlvbmFsXG4gICAgfSxcbiAgfSxcbiAgXG4gIC8vIOODh+ODvOOCv+ODmeODvOOCueioreWumu+8iERhdGFiYXNlQ29uZmln5a6M5YWo5rqW5oug77yJXG4gIGRhdGFiYXNlOiB7XG4gICAgLy8gRHluYW1vRELoqK3lrprvvIjlv4XpoIjvvIlcbiAgICBkeW5hbW9EYjoge1xuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAga21zTWFuYWdlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgc3RyZWFtczoge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgc3RyZWFtU3BlY2lmaWNhdGlvbjogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0FORF9PTERfSU1BR0VTLFxuICAgICAgfSxcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICBjb250aW51b3VzQmFja3VwczogdHJ1ZSxcbiAgICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGN1c3RvbVRhYmxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgdGFibGVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tc2Vzc2lvbnNgLFxuICAgICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgICAgbmFtZTogJ3Nlc3Npb25JZCcsXG4gICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0dGw6IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBhdHRyaWJ1dGVOYW1lOiAnZXhwaXJlc0F0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgICAgZW5jcnlwdGlvbjoge1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGttc01hbmFnZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGFibGVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tdXNlcnNgLFxuICAgICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgICAgbmFtZTogJ3VzZXJJZCcsXG4gICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgICAgZW5jcnlwdGlvbjoge1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGttc01hbmFnZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIC8vIE9wZW5TZWFyY2joqK3lrprvvIjlv4XpoIjvvIlcbiAgICBvcGVuU2VhcmNoOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIHNlcnZlcmxlc3M6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIGttc01hbmFnZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgLy8gUkRT6Kit5a6a77yI5b+F6aCI77yJXG4gICAgcmRzOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIGVuZ2luZTogJ3Bvc3RncmVzJyBhcyBhbnksXG4gICAgICBpbnN0YW5jZUNsYXNzOiAnZGIudDMubWljcm8nIGFzIGFueSxcbiAgICAgIGluc3RhbmNlU2l6ZTogJ1NNQUxMJyBhcyBhbnksXG4gICAgICBhbGxvY2F0ZWRTdG9yYWdlOiAyMCxcbiAgICAgIG11bHRpQXo6IGZhbHNlLFxuICAgICAgZGF0YWJhc2VOYW1lOiAncmFnZGInLFxuICAgICAgdXNlcm5hbWU6ICdyYWd1c2VyJyxcbiAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAga21zTWFuYWdlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgYXV0b21hdGljQmFja3VwOiB0cnVlLFxuICAgICAgICByZXRlbnRpb25EYXlzOiA3LFxuICAgICAgICBkZWxldGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gRGF0YVN0YWNr5L2c5oiQ77yIVlBD6Kit5a6a44GC44KKIC0gRlN4IGZvciBPTlRBUOeUqO+8iVxuY29uc3QgZGF0YVN0YWNrID0gbmV3IERhdGFTdGFjayhhcHAsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRGF0YWAsIHtcbiAgZW52LFxuICBkZXNjcmlwdGlvbjogJ0RhdGEgYW5kIFN0b3JhZ2UgU3RhY2sgLSBEeW5hbW9EQiArIEZTeCBmb3IgT05UQVAgKyBHYXRld2F5IFNwZWNzIEJ1Y2tldCcsXG4gIFxuICAvLyDntbHlkIjoqK3lrppcbiAgY29uZmlnOiBkYXRhU3RhY2tDb25maWcsXG4gIFxuICAvLyBWUEPoqK3lrprvvIhOZXR3b3JraW5nU3RhY2vjgYvjgonvvIktIEZTeCBmb3IgT05UQVDnlKhcbiAgdnBjOiB2cGNDb25maWcsXG4gIHByaXZhdGVTdWJuZXRJZHM6IHZwY0NvbmZpZy5wcml2YXRlU3VibmV0SWRzLFxuICBcbiAgLy8g44OX44Ot44K444Kn44Kv44OI6Kit5a6aXG4gIHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudCxcbiAgXG4gIC8vIOOCv+OCsOioreWumlxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogcHJvamVjdE5hbWUsXG4gICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgU3RhY2s6ICdEYXRhU3RhY2snLFxuICAgIFJlZ2lvbjogZW52LnJlZ2lvbixcbiAgICBEZXBsb3llZEJ5OiAnRGF0YVN0YWNrQXBwJyxcbiAgICBOYW1pbmdDb21wbGlhbmNlOiAnQWdlbnRTdGVlcmluZycsXG4gIH0sXG59KTtcblxuLy8g44Kw44Ot44O844OQ44Or44K/44Kw6YGp55SoXG5jZGsuVGFncy5vZihhcHApLmFkZCgnUHJvamVjdCcsIHByb2plY3ROYW1lKTtcbmNkay5UYWdzLm9mKGFwcCkuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcbmNkay5UYWdzLm9mKGFwcCkuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnQXJjaGl0ZWN0dXJlJywgJ01vZHVsYXInKTtcbmNkay5UYWdzLm9mKGFwcCkuYWRkKCdSZWdpb24nLCBlbnYucmVnaW9uKTtcbmNkay5UYWdzLm9mKGFwcCkuYWRkKCdDcmVhdGVkQnknLCAnRGF0YVN0YWNrQXBwJyk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnTmFtaW5nQ29tcGxpYW5jZScsICdBZ2VudFN0ZWVyaW5nJyk7XG5cbi8vIOODquOCveODvOOCueertuWQiOODgeOCp+ODg+OCr0FzcGVjdOOBrui/veWKoO+8iOODh+ODl+ODreOCpOWJjeOBq+iHquWLleODgeOCp+ODg+OCr++8iVxuY29uc3QgY29uZmxpY3RIYW5kbGVyID0gbmV3IFJlc291cmNlQ29uZmxpY3RIYW5kbGVyKHtcbiAgcmVnaW9uOiBlbnYucmVnaW9uLFxuICBhY2NvdW50SWQ6IGVudi5hY2NvdW50LFxuICBzdGFja05hbWU6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRGF0YWAsXG4gIHJlc291cmNlUHJlZml4OiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH1gLFxufSk7XG5cbmNvbnN0IGNvbmZsaWN0QXNwZWN0ID0gbmV3IFJlc291cmNlQ29uZmxpY3RBc3BlY3QoY29uZmxpY3RIYW5kbGVyKTtcbmNkay5Bc3BlY3RzLm9mKGRhdGFTdGFjaykuYWRkKGNvbmZsaWN0QXNwZWN0KTtcblxuLy8gQ0RLIFN5bnRo5a6f6KGMXG5jb25zdCBhc3NlbWJseSA9IGFwcC5zeW50aCgpO1xuXG4vLyBTeW50aOW+jOOBq+ertuWQiOODgeOCp+ODg+OCr+OCkuWun+ihjO+8iOmdnuWQjOacn++8iVxuKGFzeW5jICgpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZygnXFxu8J+UjSDjg6rjgr3jg7zjgrnnq7blkIjjg4Hjgqfjg4Pjgq/lrp/ooYzkuK0uLi4nKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb25mbGljdEFzcGVjdC5jaGVja0NvbmZsaWN0cygpO1xuICAgIGNvbmZsaWN0SGFuZGxlci5wcmludENvbmZsaWN0UmVwb3J0KHJlc3VsdCk7XG4gICAgXG4gICAgaWYgKHJlc3VsdC5oYXNDb25mbGljdCkge1xuICAgICAgY29uc29sZS5sb2coJ1xcbuKaoO+4jyAg56u25ZCI44GM5qSc5Ye644GV44KM44G+44GX44Gf44CC44OH44OX44Ot44Kk5YmN44Gr6Kej5rG644GX44Gm44GP44Gg44GV44GE44CCJyk7XG4gICAgICBjb25zb2xlLmxvZygn8J+SoSDoh6rli5Xkv67lvqnjgrnjgq/jg6rjg5fjg4jjgpLkvb/nlKg6Jyk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgbnB4IHRzLW5vZGUgZGV2ZWxvcG1lbnQvc2NyaXB0cy9kZXBsb3ltZW50L3ByZS1kZXBsb3ktY2hlY2sudHMgLS1zdGFjay1uYW1lICR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1EYXRhIC0tYXV0by1maXhgKTtcbiAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIC8vIOertuWQiOOBjOOBguOBo+OBpuOCglN5bnRo44Gv5oiQ5Yqf44GV44Gb44KL77yI44OH44OX44Ot44Kk5pmC44Gr44Ko44Op44O844Gr44Gq44KL77yJXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUg44Oq44K944O844K556u25ZCI44Gq44GXIC0g44OH44OX44Ot44Kk5Y+v6IO9Jyk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS53YXJuKCfimqDvuI8gIOertuWQiOODgeOCp+ODg+OCr+S4reOBq+OCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnzonLCBlcnJvci5tZXNzYWdlKTtcbiAgICBjb25zb2xlLndhcm4oJyAgIOODh+ODl+ODreOCpOOBr+e2muihjOOBleOCjOOBvuOBmeOBjOOAgUVhcmx5IFZhbGlkYXRpb24gZXJyb3LjgYznmbrnlJ/jgZnjgovlj6/og73mgKfjgYzjgYLjgorjgb7jgZknKTtcbiAgfVxufSkoKTtcbiJdfQ==