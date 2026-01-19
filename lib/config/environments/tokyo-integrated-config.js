"use strict";
/**
 * 東京リージョン統合設定 - 環境別統合設定
 *
 * 東京リージョン（ap-northeast-1）での開発環境設定を定義します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokyoIntegratedConfig = void 0;
// 東京リージョン開発環境設定
exports.tokyoIntegratedConfig = {
    environment: 'dev',
    region: 'ap-northeast-1',
    // プロジェクト設定
    project: {
        name: 'rag-system',
        version: '1.0.0',
        description: 'Permission-aware RAG System with FSx for NetApp ONTAP'
    },
    // ネットワーク設定
    networking: {
        vpcCidr: '10.1.0.0/16',
        availabilityZones: 2,
        natGateways: {
            enabled: true,
            count: 2
        },
        enableVpcFlowLogs: true,
        enableDnsHostnames: true,
        enableDnsSupport: true
    },
    // セキュリティ設定
    security: {
        enableWaf: true,
        enableGuardDuty: false, // 既存のGuardDutyとの競合を避けるため無効化
        enableConfig: false, // AWS Configは一時的に無効化
        enableCloudTrail: true,
        kmsKeyRotation: true,
        encryptionAtRest: true,
        encryptionInTransit: true
    },
    // ストレージ設定
    storage: {
        s3: {
            enableVersioning: true,
            enableLifecyclePolicy: true,
            transitionToIADays: 30,
            transitionToGlacierDays: 90,
            expirationDays: 365
        },
        fsxOntap: {
            enabled: true,
            storageCapacity: 1024,
            throughputCapacity: 128,
            deploymentType: 'SINGLE_AZ_1',
            automaticBackupRetentionDays: 7
        }
    },
    // データベース設定
    database: {
        dynamodb: {
            billingMode: 'PAY_PER_REQUEST',
            pointInTimeRecovery: true,
            enableStreams: true,
            streamViewType: 'NEW_AND_OLD_IMAGES'
        },
        opensearch: {
            instanceType: 't3.small.search',
            instanceCount: 1,
            dedicatedMasterEnabled: false,
            masterInstanceCount: 0,
            ebsEnabled: true,
            volumeType: 'gp3',
            volumeSize: 20,
            encryptionAtRest: true
        }
    },
    // Embedding設定
    embedding: {
        lambda: {
            runtime: 'nodejs20.x',
            timeout: 300,
            memorySize: 1024,
            enableXRayTracing: true,
            enableDeadLetterQueue: true
        },
        batch: {
            enabled: false, // 開発環境では無効化
            computeEnvironmentType: 'FARGATE',
            instanceTypes: ['optimal'],
            minvCpus: 0,
            maxvCpus: 256,
            desiredvCpus: 0
        },
        ecs: {
            enabled: true, // ECS on EC2を有効化
            instanceType: 'm5.large',
            minCapacity: 0,
            maxCapacity: 3,
            desiredCapacity: 1,
            enableManagedInstance: true
        }
    },
    // API設定
    api: {
        throttling: {
            rateLimit: 1000,
            burstLimit: 2000
        },
        cors: {
            enabled: true,
            allowOrigins: ['*'],
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key']
        },
        authentication: {
            cognitoEnabled: true,
            apiKeyRequired: false
        }
    },
    // AI設定
    ai: {
        bedrock: {
            enabled: true,
            models: ['anthropic.claude-3-haiku-20240307-v1:0'],
            maxTokens: 4096,
            temperature: 0.7
        },
        embedding: {
            model: 'amazon.titan-embed-text-v1',
            dimensions: 1536,
            batchSize: 100
        }
    },
    // 監視設定
    monitoring: {
        enableDetailedMonitoring: true,
        logRetentionDays: 30,
        enableAlarms: true,
        alarmNotificationEmail: 'admin@example.com',
        enableDashboard: true,
        enableXRayTracing: true
    },
    // エンタープライズ設定
    enterprise: {
        enableAccessControl: true,
        enableAuditLogging: true,
        enableBIAnalytics: false, // 開発環境では無効化
        enableMultiTenant: false, // 開発環境では無効化
        dataRetentionDays: 90
    },
    // 機能フラグ
    features: {
        enableNetworking: true,
        enableSecurity: true,
        enableStorage: true,
        enableDatabase: true,
        enableEmbedding: true,
        enableAPI: true,
        enableAI: true,
        enableMonitoring: true,
        enableEnterprise: false // 開発環境では無効化
    },
    // タグ設定
    tags: {
        Environment: 'dev',
        Project: 'rag-system',
        Owner: 'DevOps',
        CostCenter: 'Engineering',
        Backup: 'Required',
        Monitoring: 'Enabled',
        Compliance: 'Standard',
        DataClassification: 'Internal',
        Region: 'ap-northeast-1',
        Timezone: 'Asia/Tokyo',
        ComplianceFramework: 'SOC2'
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9reW8taW50ZWdyYXRlZC1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0b2t5by1pbnRlZ3JhdGVkLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7O0FBSUgsZ0JBQWdCO0FBQ0gsUUFBQSxxQkFBcUIsR0FBc0I7SUFDdEQsV0FBVyxFQUFFLEtBQUs7SUFDbEIsTUFBTSxFQUFFLGdCQUFnQjtJQUV4QixXQUFXO0lBQ1gsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFlBQVk7UUFDbEIsT0FBTyxFQUFFLE9BQU87UUFDaEIsV0FBVyxFQUFFLHVEQUF1RDtLQUNyRTtJQUVELFdBQVc7SUFDWCxVQUFVLEVBQUU7UUFDVixPQUFPLEVBQUUsYUFBYTtRQUN0QixpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLFdBQVcsRUFBRTtZQUNYLE9BQU8sRUFBRSxJQUFJO1lBQ2IsS0FBSyxFQUFFLENBQUM7U0FDVDtRQUNELGlCQUFpQixFQUFFLElBQUk7UUFDdkIsa0JBQWtCLEVBQUUsSUFBSTtRQUN4QixnQkFBZ0IsRUFBRSxJQUFJO0tBQ3ZCO0lBRUQsV0FBVztJQUNYLFFBQVEsRUFBRTtRQUNSLFNBQVMsRUFBRSxJQUFJO1FBQ2YsZUFBZSxFQUFFLEtBQUssRUFBRSw0QkFBNEI7UUFDcEQsWUFBWSxFQUFFLEtBQUssRUFBRSxxQkFBcUI7UUFDMUMsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixjQUFjLEVBQUUsSUFBSTtRQUNwQixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLG1CQUFtQixFQUFFLElBQUk7S0FDMUI7SUFFRCxVQUFVO0lBQ1YsT0FBTyxFQUFFO1FBQ1AsRUFBRSxFQUFFO1lBQ0YsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLGtCQUFrQixFQUFFLEVBQUU7WUFDdEIsdUJBQXVCLEVBQUUsRUFBRTtZQUMzQixjQUFjLEVBQUUsR0FBRztTQUNwQjtRQUNELFFBQVEsRUFB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aUIsRUFBRSxLQUFLLEVBQUUsWUFBWTtRQUN0QyxpQkFBaUIsRUFBRSxFQUFFO0tBQ3RCO0lBRUQsUUFBUTtJQUNSLFFBQVEsRUFBRTtRQUNSLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsY0FBYyxFQUFFLElBQUk7UUFDcEIsYUFBYSxFQUFFLElBQUk7UUFDbkIsY0FBYyxFQUFFLElBQUk7UUFDcEIsZUFBZSxFQUFFLElBQUk7UUFDckIsU0FBUyxFQUFFLElBQUk7UUFDZixRQUFRLEVBQUUsSUFBSTtRQUNkLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLFlBQVk7S0FDckM7SUFFRCxPQUFPO0lBQ1AsSUFBSSxFQUFFO1FBQ0osV0FBVyxFQUFFLEtBQUs7UUFDbEIsT0FBTyxFQUFFLFlBQVk7UUFDckIsS0FBSyxFQUFFLFFBQVE7UUFDZixVQUFVLEVBQUUsYUFBYTtRQUN6QixNQUFNLEVBQUUsVUFBVTtRQUNsQixVQUFVLEVBQUUsU0FBUztRQUNyQixVQUFVLEVBQUUsVUFBVTtRQUN0QixrQkFBa0IsRUFBRSxVQUFVO1FBQzlCLE1BQU0sRUFBRSxnQkFBZ0I7UUFDeEIsUUFBUSxFQUFFLFlBQVk7UUFDdEIsbUJBQW1CLEVBQUUsTUFBTTtLQUM1QjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOadseS6rOODquODvOOCuOODp+ODs+e1seWQiOioreWumiAtIOeSsOWig+WIpee1seWQiOioreWumlxuICogXG4gKiDmnbHkuqzjg6rjg7zjgrjjg6fjg7PvvIhhcC1ub3J0aGVhc3QtMe+8ieOBp+OBrumWi+eZuueSsOWig+ioreWumuOCkuWumue+qeOBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG4vLyDmnbHkuqzjg6rjg7zjgrjjg6fjg7PplovnmbrnkrDlooPoqK3lrppcbmV4cG9ydCBjb25zdCB0b2t5b0ludGVncmF0ZWRDb25maWc6IEVudmlyb25tZW50Q29uZmlnID0ge1xuICBlbnZpcm9ubWVudDogJ2RldicsXG4gIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0xJyxcbiAgXG4gIC8vIOODl+ODreOCuOOCp+OCr+ODiOioreWumlxuICBwcm9qZWN0OiB7XG4gICAgbmFtZTogJ3JhZy1zeXN0ZW0nLFxuICAgIHZlcnNpb246ICcxLjAuMCcsXG4gICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uLWF3YXJlIFJBRyBTeXN0ZW0gd2l0aCBGU3ggZm9yIE5ldEFwcCBPTlRBUCdcbiAgfSxcblxuICAvLyDjg43jg4Pjg4jjg6/jg7zjgq/oqK3lrppcbiAgbmV0d29ya2luZzoge1xuICAgIHZwY0NpZHI6ICcxMC4xLjAuMC8xNicsXG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDIsXG4gICAgbmF0R2F0ZXdheXM6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBjb3VudDogMlxuICAgIH0sXG4gICAgZW5hYmxlVnBjRmxvd0xvZ3M6IHRydWUsXG4gICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWVcbiAgfSxcblxuICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPoqK3lrppcbiAgc2VjdXJpdHk6IHtcbiAgICBlbmFibGVXYWY6IHRydWUsXG4gICAgZW5hYmxlR3VhcmREdXR5OiBmYWxzZSwgLy8g5pei5a2Y44GuR3VhcmREdXR544Go44Gu56u25ZCI44KS6YG/44GR44KL44Gf44KB54Sh5Yq55YyWXG4gICAgZW5hYmxlQ29uZmlnOiBmYWxzZSwgLy8gQVdTIENvbmZpZ+OBr+S4gOaZgueahOOBq+eEoeWKueWMllxuICAgIGVuYWJsZUNsb3VkVHJhaWw6IHRydWUsXG4gICAga21zS2V5Um90YXRpb246IHRydWUsXG4gICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICBlbmNyeXB0aW9uSW5UcmFuc2l0OiB0cnVlXG4gIH0sXG5cbiAgLy8g44K544OI44Os44O844K46Kit5a6aXG4gIHN0b3JhZ2U6IHtcbiAgICBzMzoge1xuICAgICAgZW5hYmxlVmVyc2lvbmluZzogdHJ1ZSxcbiAgICAgIGVuYWJsZUxpZmVjeWNsZVBvbGljeTogdHJ1ZSxcbiAgICAgIHRyYW5zaXRpb25Ub0lBRGF5czogMzAsXG4gICAgICB0cmFuc2l0aW9uVG9HbGFjaWVyRGF5czogOTAsXG4gICAgICBleHBpcmF0aW9uRGF5czogMzY1XG4gICAgfSxcbiAgICBmc3hPbnRhcDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCxcbiAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogMTI4LFxuICAgICAgZGVwbG95bWVudFR5cGU6ICdTSU5HTEVfQVpfMScsXG4gICAgICBhdXRvbWF0aWNCYWNrdXBSZXRlbnRpb25EYXlzOiA3XG4gICAgfVxuICB9LFxuXG4gIC8vIOODh+ODvOOCv+ODmeODvOOCueioreWumlxuICBkYXRhYmFzZToge1xuICAgIGR5bmFtb2RiOiB7XG4gICAgICBiaWxsaW5nTW9kZTogJ1BBWV9QRVJfUkVRVUVTVCcsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgZW5hYmxlU3RyZWFtczogdHJ1ZSxcbiAgICAgIHN0cmVhbVZpZXdUeXBlOiAnTkVXX0FORF9PTERfSU1BR0VTJ1xuICAgIH0sXG4gICAgb3BlbnNlYXJjaDoge1xuICAgICAgaW5zdGFuY2VUeXBlOiAndDMuc21hbGwuc2VhcmNoJyxcbiAgICAgIGluc3RhbmNlQ291bnQ6IDEsXG4gICAgICBkZWRpY2F0ZWRNYXN0ZXJFbmFibGVkOiBmYWxzZSxcbiAgICAgIG1hc3Rlckluc3RhbmNlQ291bnQ6IDAsXG4gICAgICBlYnNFbmFibGVkOiB0cnVlLFxuICAgICAgdm9sdW1lVHlwZTogJ2dwMycsXG4gICAgICB2b2x1bWVTaXplOiAyMCxcbiAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHRydWVcbiAgICB9XG4gIH0sXG5cbiAgLy8gRW1iZWRkaW5n6Kit5a6aXG4gIGVtYmVkZGluZzoge1xuICAgIGxhbWJkYToge1xuICAgICAgcnVudGltZTogJ25vZGVqczIwLngnLFxuICAgICAgdGltZW91dDogMzAwLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVuYWJsZVhSYXlUcmFjaW5nOiB0cnVlLFxuICAgICAgZW5hYmxlRGVhZExldHRlclF1ZXVlOiB0cnVlXG4gICAgfSxcbiAgICBiYXRjaDoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+eEoeWKueWMllxuICAgICAgY29tcHV0ZUVudmlyb25tZW50VHlwZTogJ0ZBUkdBVEUnLFxuICAgICAgaW5zdGFuY2VUeXBlczogWydvcHRpbWFsJ10sXG4gICAgICBtaW52Q3B1czogMCxcbiAgICAgIG1heHZDcHVzOiAyNTYsXG4gICAgICBkZXNpcmVkdkNwdXM6IDBcbiAgICB9LFxuICAgIGVjczoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8gRUNTIG9uIEVDMuOCkuacieWKueWMllxuICAgICAgaW5zdGFuY2VUeXBlOiAnbTUubGFyZ2UnLFxuICAgICAgbWluQ2FwYWNpdHk6IDAsXG4gICAgICBtYXhDYXBhY2l0eTogMyxcbiAgICAgIGRlc2lyZWRDYXBhY2l0eTogMSxcbiAgICAgIGVuYWJsZU1hbmFnZWRJbnN0YW5jZTogdHJ1ZVxuICAgIH1cbiAgfSxcblxuICAvLyBBUEnoqK3lrppcbiAgYXBpOiB7XG4gICAgdGhyb3R0bGluZzoge1xuICAgICAgcmF0ZUxpbWl0OiAxMDAwLFxuICAgICAgYnVyc3RMaW1pdDogMjAwMFxuICAgIH0sXG4gICAgY29yczoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGFsbG93T3JpZ2luczogWycqJ10sXG4gICAgICBhbGxvd01ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BbXotRGF0ZScsICdYLUFwaS1LZXknXVxuICAgIH0sXG4gICAgYXV0aGVudGljYXRpb246IHtcbiAgICAgIGNvZ25pdG9FbmFibGVkOiB0cnVlLFxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IGZhbHNlXG4gICAgfVxuICB9LFxuXG4gIC8vIEFJ6Kit5a6aXG4gIGFpOiB7XG4gICAgYmVkcm9jazoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vZGVsczogWydhbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MCddLFxuICAgICAgbWF4VG9rZW5zOiA0MDk2LFxuICAgICAgdGVtcGVyYXR1cmU6IDAuN1xuICAgIH0sXG4gICAgZW1iZWRkaW5nOiB7XG4gICAgICBtb2RlbDogJ2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxJyxcbiAgICAgIGRpbWVuc2lvbnM6IDE1MzYsXG4gICAgICBiYXRjaFNpemU6IDEwMFxuICAgIH1cbiAgfSxcblxuICAvLyDnm6PoppboqK3lrppcbiAgbW9uaXRvcmluZzoge1xuICAgIGVuYWJsZURldGFpbGVkTW9uaXRvcmluZzogdHJ1ZSxcbiAgICBsb2dSZXRlbnRpb25EYXlzOiAzMCxcbiAgICBlbmFibGVBbGFybXM6IHRydWUsXG4gICAgYWxhcm1Ob3RpZmljYXRpb25FbWFpbDogJ2FkbWluQGV4YW1wbGUuY29tJyxcbiAgICBlbmFibGVEYXNoYm9hcmQ6IHRydWUsXG4gICAgZW5hYmxlWFJheVRyYWNpbmc6IHRydWVcbiAgfSxcblxuICAvLyDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrroqK3lrppcbiAgZW50ZXJwcmlzZToge1xuICAgIGVuYWJsZUFjY2Vzc0NvbnRyb2w6IHRydWUsXG4gICAgZW5hYmxlQXVkaXRMb2dnaW5nOiB0cnVlLFxuICAgIGVuYWJsZUJJQW5hbHl0aWNzOiBmYWxzZSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv54Sh5Yq55YyWXG4gICAgZW5hYmxlTXVsdGlUZW5hbnQ6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirnljJZcbiAgICBkYXRhUmV0ZW50aW9uRGF5czogOTBcbiAgfSxcblxuICAvLyDmqZ/og73jg5Xjg6njgrBcbiAgZmVhdHVyZXM6IHtcbiAgICBlbmFibGVOZXR3b3JraW5nOiB0cnVlLFxuICAgIGVuYWJsZVNlY3VyaXR5OiB0cnVlLFxuICAgIGVuYWJsZVN0b3JhZ2U6IHRydWUsXG4gICAgZW5hYmxlRGF0YWJhc2U6IHRydWUsXG4gICAgZW5hYmxlRW1iZWRkaW5nOiB0cnVlLFxuICAgIGVuYWJsZUFQSTogdHJ1ZSxcbiAgICBlbmFibGVBSTogdHJ1ZSxcbiAgICBlbmFibGVNb25pdG9yaW5nOiB0cnVlLFxuICAgIGVuYWJsZUVudGVycHJpc2U6IGZhbHNlIC8vIOmWi+eZuueSsOWig+OBp+OBr+eEoeWKueWMllxuICB9LFxuXG4gIC8vIOOCv+OCsOioreWumlxuICB0YWdzOiB7XG4gICAgRW52aXJvbm1lbnQ6ICdkZXYnLFxuICAgIFByb2plY3Q6ICdyYWctc3lzdGVtJyxcbiAgICBPd25lcjogJ0Rldk9wcycsXG4gICAgQ29zdENlbnRlcjogJ0VuZ2luZWVyaW5nJyxcbiAgICBCYWNrdXA6ICdSZXF1aXJlZCcsXG4gICAgTW9uaXRvcmluZzogJ0VuYWJsZWQnLFxuICAgIENvbXBsaWFuY2U6ICdTdGFuZGFyZCcsXG4gICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnSW50ZXJuYWwnLFxuICAgIFJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0xJyxcbiAgICBUaW1lem9uZTogJ0FzaWEvVG9reW8nLFxuICAgIENvbXBsaWFuY2VGcmFtZXdvcms6ICdTT0MyJ1xuICB9XG59OyJdfQ==