#!/usr/bin/env node
"use strict";
/**
 * DataStack個別デプロイスクリプト
 * SecurityStack修正後のデプロイ用
 *
 * 注意: SessionTableStackは存在しないため、DataStackのみをデプロイします。
 * DataStackには全てのDynamoDBテーブル（セッション、ユーザー設定、チャット履歴等）が含まれています。
 *
 * 重要: 既存のNetworkingStackのVPCを使用します（vpc-05273211525990e49）
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const data_stack_1 = require("../lib/stacks/integrated/data-stack");
const app = new cdk.App();
// 環境設定
const projectName = 'permission-aware-rag';
const environment = 'prod';
const region = 'ap-northeast-1';
const account = '178625946981';
// 既存VPC情報（NetworkingStackから）
const existingVpcId = 'vpc-05273211525990e49';
const existingVpcCidr = '10.0.0.0/16'; // NetworkingStackのデフォルトCIDR
// 既存VPCをインポート
const vpc = ec2.Vpc.fromLookup(app, 'ExistingVpc', {
    vpcId: existingVpcId,
    region: region
});
// プライベートサブネットIDを取得（NetworkingStackのエクスポートから）
const privateSubnetIds = [
    cdk.Fn.importValue('TokyoRegion-permission-aware-rag-prod-Networking-Stack-PrivateSubnet1Id'),
    cdk.Fn.importValue('TokyoRegion-permission-aware-rag-prod-Networking-Stack-PrivateSubnet2Id')
];
// DataStackConfig準拠の設定
const dataStackConfig = {
    storage: {
        s3: {
            encryption: {
                enabled: true,
                kmsManaged: true,
                bucketKeyEnabled: true
            },
            versioning: true,
            lifecycle: {
                enabled: true,
                transitionToIA: 30,
                transitionToGlacier: 90,
                deleteAfter: 365
            },
            publicAccess: {
                blockPublicRead: true,
                blockPublicWrite: true,
                blockPublicAcls: true,
                restrictPublicBuckets: true
            },
            documents: {
                enabled: false // FSx for ONTAPを使用
            },
            backup: {
                enabled: false
            },
            embeddings: {
                enabled: false
            }
        },
        fsx: {
            enabled: true,
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
                disableBackupConfirmed: true
            }
        }
    },
    database: {
        dynamoDb: {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: {
                enabled: true,
                kmsManaged: true
            },
            pointInTimeRecovery: true
        },
        openSearch: {
            enabled: false, // OpenSearchは削除済み
            serverless: false,
            encryption: {
                enabled: true,
                kmsManaged: true
            }
        },
        rds: {
            enabled: false,
            engine: {} // RDSは使用しない
        }
    }
};
// DataStackのデプロイ（既存VPCを使用）
const dataStack = new data_stack_1.DataStack(app, `TokyoRegion-${projectName}-${environment}-Data`, {
    config: dataStackConfig,
    projectName: projectName,
    environment: environment,
    vpc: vpc, // 既存VPCを渡す
    privateSubnetIds: privateSubnetIds, // プライベートサブネットIDを渡す
    env: {
        account: account,
        region: region
    },
    description: 'Data Stack - FSx (using existing VPC), DynamoDB (includes Session, UserPreferences, ChatHistory tables)',
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWRhdGEtc2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlcGxveS1kYXRhLXNlc3Npb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyxvRUFBZ0U7QUFFaEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsT0FBTztBQUNQLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUFDO0FBQzNDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQztBQUMzQixNQUFNLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQztBQUNoQyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUM7QUFFL0IsNkJBQTZCO0FBQzdCLE1BQU0sYUFBYSxHQUFHLHVCQUF1QixDQUFDO0FBQzlDLE1BQU0sZUFBZSxHQUFHLGFBQWEsQ0FBQyxDQUFDLDRCQUE0QjtBQUVuRSxjQUFjO0FBQ2QsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLGFBQWEsRUFBRTtJQUNqRCxLQUFLLEVBQUUsYUFBYTtJQUNwQixNQUFNLEVBQUUsTUFBTTtDQUNmLENBQUMsQ0FBQztBQUVILDZDQUE2QztBQUM3QyxNQUFNLGdCQUFnQixHQUFHO0lBQ3ZCLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLHlFQUF5RSxDQUFDO0lBQzdGLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLHlFQUF5RSxDQUFDO0NBQzlGLENBQUM7QUFFRix1QkFBdUI7QUFDdkIsTUFBTSxlQUFlLEdBQUc7SUFDdEIsT0FBTyxFQUFFO1FBQ1AsRUFBRSxFQUFFO1lBQ0YsVUFBVSxFQUFFO2dCQUNWLE9BQU8sRUFBRSxJQUFJO2dCQUNiLFVBQVUsRUFBRSxJQUFJO2dCQUNoQixnQkFBZ0IsRUFBRSxJQUFJO2FBQ3ZCO1lBQ0QsVUFBVSxFQUFFLElBQUk7WUFDaEIsU0FBUyxFQUFFO2dCQUNULE9BQU8sRUFBRSxJQUFJO2dCQUNiLGNBQWMsRUFBRSxFQUFFO2dCQUNsQixtQkFBbUIsRUFBRSxFQUFFO2dCQUN2QixXQUFXLEVBQUUsR0FBRzthQUNqQjtZQUNELFlBQVksRUFBRTtnQkFDWixlQUFlLEVBQUUsSUFBSTtnQkFDckIsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsZUFBZSxFQUFFLElBQUk7Z0JBQ3JCLHFCQUFxQixFQUFFLElBQUk7YUFDNUI7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEtBQUssQ0FBQyxtQkFBbUI7YUFDbkM7WUFDRCxNQUFNLEVBQUU7Z0JBQ04sT0FBTyxFQUFFLEtBQUs7YUFDZjtZQUNELFVBQVUsRUFBRTtnQkFDVixPQUFPLEVBQUUsS0FBSzthQUNmO1NBQ0Y7UUFDRCxHQUFHLEVBQUU7WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLGNBQWMsRUFBRSxPQUFnQjtZQUNoQyxlQUFlLEVBQUUsSUFBSTtZQUNyQixrQkFBa0IsRUFBRSxHQUFHO1lBQ3ZCLE9BQU8sRUFBRSxLQUFLO1lBQ2QsY0FBYyxFQUFFLGFBQXNCO1lBQ3RDLDRCQUE0QixFQUFFLENBQUM7WUFDL0Isc0JBQXNCLEVBQUUsSUFBSTtZQUM1QixNQUFNLEVBQUU7Z0JBQ04sZUFBZSxFQUFFLEtBQUs7Z0JBQ3RCLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixzQkFBc0IsRUFBRSxJQUFJO2FBQzdCO1NBQ0Y7S0FDRjtJQUNELFFBQVEsRUFBRTtRQUNSLFFBQVEsRUFBRTtZQUNSLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsVUFBVSxFQUFFO2dCQUNWLE9BQU8sRUFBRSxJQUFJO2dCQUNiLFVBQVUsRUFBRSxJQUFJO2FBQ2pCO1lBQ0QsbUJBQW1CLEVBQUUsSUFBSTtTQUMxQjtRQUNELFVBQVUsRUFBRTtZQUNWLE9BQU8sRUFBRSxLQUFLLEVBQUUsa0JBQWtCO1lBQ2xDLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLFVBQVUsRUFBRTtnQkFDVixPQUFPLEVBQUUsSUFBSTtnQkFDYixVQUFVLEVBQUUsSUFBSTthQUNqQjtTQUNGO1FBQ0QsR0FBRyxFQUFFO1lBQ0gsT0FBTyxFQUFFLEtBQUs7WUFDZCxNQUFNLEVBQUUsRUFBUyxDQUFDLFlBQVk7U0FDL0I7S0FDRjtDQUNGLENBQUM7QUFFRiwyQkFBMkI7QUFDM0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEdBQUcsRUFBRSxlQUFlLFdBQVcsSUFBSSxXQUFXLE9BQU8sRUFBRTtJQUNyRixNQUFNLEVBQUUsZUFBZTtJQUN2QixXQUFXLEVBQUUsV0FBVztJQUN4QixXQUFXLEVBQUUsV0FBVztJQUN4QixHQUFHLEVBQUUsR0FBRyxFQUFFLFdBQVc7SUFDckIsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsbUJBQW1CO0lBQ3ZELEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPO1FBQ2hCLE1BQU0sRUFBRSxNQUFNO0tBQ2Y7SUFDRCxXQUFXLEVBQUUseUdBQXlHO0NBQ3ZILENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogRGF0YVN0YWNr5YCL5Yil44OH44OX44Ot44Kk44K544Kv44Oq44OX44OIXG4gKiBTZWN1cml0eVN0YWNr5L+u5q2j5b6M44Gu44OH44OX44Ot44Kk55SoXG4gKiBcbiAqIOazqOaEjzogU2Vzc2lvblRhYmxlU3RhY2vjga/lrZjlnKjjgZfjgarjgYTjgZ/jgoHjgIFEYXRhU3RhY2vjga7jgb/jgpLjg4fjg5fjg63jgqTjgZfjgb7jgZnjgIJcbiAqIERhdGFTdGFja+OBq+OBr+WFqOOBpuOBrkR5bmFtb0RC44OG44O844OW44Or77yI44K744OD44K344On44Oz44CB44Om44O844K244O86Kit5a6a44CB44OB44Oj44OD44OI5bGl5q20562J77yJ44GM5ZCr44G+44KM44Gm44GE44G+44GZ44CCXG4gKiBcbiAqIOmHjeimgTog5pei5a2Y44GuTmV0d29ya2luZ1N0YWNr44GuVlBD44KS5L2/55So44GX44G+44GZ77yIdnBjLTA1MjczMjExNTI1OTkwZTQ577yJXG4gKi9cblxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBEYXRhU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2ludGVncmF0ZWQvZGF0YS1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIOeSsOWig+ioreWumlxuY29uc3QgcHJvamVjdE5hbWUgPSAncGVybWlzc2lvbi1hd2FyZS1yYWcnO1xuY29uc3QgZW52aXJvbm1lbnQgPSAncHJvZCc7XG5jb25zdCByZWdpb24gPSAnYXAtbm9ydGhlYXN0LTEnO1xuY29uc3QgYWNjb3VudCA9ICcxNzg2MjU5NDY5ODEnO1xuXG4vLyDml6LlrZhWUEPmg4XloLHvvIhOZXR3b3JraW5nU3RhY2vjgYvjgonvvIlcbmNvbnN0IGV4aXN0aW5nVnBjSWQgPSAndnBjLTA1MjczMjExNTI1OTkwZTQ5JztcbmNvbnN0IGV4aXN0aW5nVnBjQ2lkciA9ICcxMC4wLjAuMC8xNic7IC8vIE5ldHdvcmtpbmdTdGFja+OBruODh+ODleOCqeODq+ODiENJRFJcblxuLy8g5pei5a2YVlBD44KS44Kk44Oz44Od44O844OIXG5jb25zdCB2cGMgPSBlYzIuVnBjLmZyb21Mb29rdXAoYXBwLCAnRXhpc3RpbmdWcGMnLCB7XG4gIHZwY0lkOiBleGlzdGluZ1ZwY0lkLFxuICByZWdpb246IHJlZ2lvblxufSk7XG5cbi8vIOODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiElE44KS5Y+W5b6X77yITmV0d29ya2luZ1N0YWNr44Gu44Ko44Kv44K544Od44O844OI44GL44KJ77yJXG5jb25zdCBwcml2YXRlU3VibmV0SWRzID0gW1xuICBjZGsuRm4uaW1wb3J0VmFsdWUoJ1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtTmV0d29ya2luZy1TdGFjay1Qcml2YXRlU3VibmV0MUlkJyksXG4gIGNkay5Gbi5pbXBvcnRWYWx1ZSgnVG9reW9SZWdpb24tcGVybWlzc2lvbi1hd2FyZS1yYWctcHJvZC1OZXR3b3JraW5nLVN0YWNrLVByaXZhdGVTdWJuZXQySWQnKVxuXTtcblxuLy8gRGF0YVN0YWNrQ29uZmln5rqW5oug44Gu6Kit5a6aXG5jb25zdCBkYXRhU3RhY2tDb25maWcgPSB7XG4gIHN0b3JhZ2U6IHtcbiAgICBzMzoge1xuICAgICAgZW5jcnlwdGlvbjoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBrbXNNYW5hZ2VkOiB0cnVlLFxuICAgICAgICBidWNrZXRLZXlFbmFibGVkOiB0cnVlXG4gICAgICB9LFxuICAgICAgdmVyc2lvbmluZzogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZToge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB0cmFuc2l0aW9uVG9JQTogMzAsXG4gICAgICAgIHRyYW5zaXRpb25Ub0dsYWNpZXI6IDkwLFxuICAgICAgICBkZWxldGVBZnRlcjogMzY1XG4gICAgICB9LFxuICAgICAgcHVibGljQWNjZXNzOiB7XG4gICAgICAgIGJsb2NrUHVibGljUmVhZDogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNXcml0ZTogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiB0cnVlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IHRydWVcbiAgICAgIH0sXG4gICAgICBkb2N1bWVudHM6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UgLy8gRlN4IGZvciBPTlRBUOOCkuS9v+eUqFxuICAgICAgfSxcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICBlbmFibGVkOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIGVtYmVkZGluZ3M6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2VcbiAgICAgIH1cbiAgICB9LFxuICAgIGZzeDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGZpbGVTeXN0ZW1UeXBlOiAnT05UQVAnIGFzIGNvbnN0LFxuICAgICAgc3RvcmFnZUNhcGFjaXR5OiAxMDI0LFxuICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiAxMjgsXG4gICAgICBtdWx0aUF6OiBmYWxzZSxcbiAgICAgIGRlcGxveW1lbnRUeXBlOiAnU0lOR0xFX0FaXzEnIGFzIGNvbnN0LFxuICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogMCxcbiAgICAgIGRpc2FibGVCYWNrdXBDb25maXJtZWQ6IHRydWUsXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgYXV0b21hdGljQmFja3VwOiBmYWxzZSxcbiAgICAgICAgcmV0ZW50aW9uRGF5czogMCxcbiAgICAgICAgZGlzYWJsZUJhY2t1cENvbmZpcm1lZDogdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgZGF0YWJhc2U6IHtcbiAgICBkeW5hbW9EYjoge1xuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAga21zTWFuYWdlZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWVcbiAgICB9LFxuICAgIG9wZW5TZWFyY2g6IHtcbiAgICAgIGVuYWJsZWQ6IGZhbHNlLCAvLyBPcGVuU2VhcmNo44Gv5YmK6Zmk5riI44G/XG4gICAgICBzZXJ2ZXJsZXNzOiBmYWxzZSxcbiAgICAgIGVuY3J5cHRpb246IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAga21zTWFuYWdlZDogdHJ1ZVxuICAgICAgfVxuICAgIH0sXG4gICAgcmRzOiB7XG4gICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgIGVuZ2luZToge30gYXMgYW55IC8vIFJEU+OBr+S9v+eUqOOBl+OBquOBhFxuICAgIH1cbiAgfVxufTtcblxuLy8gRGF0YVN0YWNr44Gu44OH44OX44Ot44Kk77yI5pei5a2YVlBD44KS5L2/55So77yJXG5jb25zdCBkYXRhU3RhY2sgPSBuZXcgRGF0YVN0YWNrKGFwcCwgYFRva3lvUmVnaW9uLSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LURhdGFgLCB7XG4gIGNvbmZpZzogZGF0YVN0YWNrQ29uZmlnLFxuICBwcm9qZWN0TmFtZTogcHJvamVjdE5hbWUsXG4gIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgdnBjOiB2cGMsIC8vIOaXouWtmFZQQ+OCkua4oeOBmVxuICBwcml2YXRlU3VibmV0SWRzOiBwcml2YXRlU3VibmV0SWRzLCAvLyDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4hJROOCkua4oeOBmVxuICBlbnY6IHtcbiAgICBhY2NvdW50OiBhY2NvdW50LFxuICAgIHJlZ2lvbjogcmVnaW9uXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiAnRGF0YSBTdGFjayAtIEZTeCAodXNpbmcgZXhpc3RpbmcgVlBDKSwgRHluYW1vREIgKGluY2x1ZGVzIFNlc3Npb24sIFVzZXJQcmVmZXJlbmNlcywgQ2hhdEhpc3RvcnkgdGFibGVzKScsXG59KTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=