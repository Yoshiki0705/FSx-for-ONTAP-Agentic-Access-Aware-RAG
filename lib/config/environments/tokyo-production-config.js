"use strict";
/**
 * 東京リージョン本番設定 - 本番環境統合設定
 *
 * 東京リージョン（ap-northeast-1）での本番環境設定を定義します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokyoProductionConfig = void 0;
// 東京リージョン本番環境設定
exports.tokyoProductionConfig = {
    environment: 'prod',
    region: 'ap-northeast-1',
    // プロジェクト設定
    project: {
        name: 'permission-aware-rag',
        version: '1.0.0',
        description: 'Permission-aware RAG System with FSx for NetApp ONTAP - Production'
    },
    // 命名設定（統一された命名規則）
    naming: {
        projectName: 'permission-aware-rag',
        environment: 'prod',
        regionPrefix: 'TokyoRegion',
        separator: '-'
    },
    // ネットワーク設定（本番環境強化）
    networking: {
        vpcCidr: '10.0.0.0/16',
        availabilityZones: 3, // 本番環境では3AZ
        natGateways: {
            enabled: true,
            count: 3 // 各AZにNAT Gateway
        },
        enableVpcFlowLogs: true,
        enableDnsHostnames: true,
        enableDnsSupport: true
    },
    // セキュリティ設定（本番環境強化）
    security: {
        enableWaf: true,
        enableGuardDuty: true, // 本番環境では有効化
        enableConfig: true, // 本番環境では有効化
        enableCloudTrail: true,
        kmsKeyRotation: true,
        encryptionAtRest: true,
        encryptionInTransit: true
    },
    // ストレージ設定（README.md準拠 - S3 + FSx for ONTAP）
    storage: {
        s3: {
            encryption: {
                enabled: true,
                kmsManaged: false, // S3管理暗号化を使用
                bucketKeyEnabled: true
            },
            versioning: true,
            lifecycle: {
                enabled: true,
                transitionToIA: 30,
                transitionToGlacier: 90,
                deleteAfter: 2555, // 7年保持（コンプライアンス要件）
                abortIncompleteMultipartUpload: 7
            },
            publicAccess: {
                blockPublicRead: true,
                blockPublicWrite: true,
                blockPublicAcls: true,
                restrictPublicBuckets: true
            },
            documents: {
                enabled: false, // FSx for ONTAPをメインストレージとして使用
                encryption: true,
                versioning: true
            },
            backup: {
                enabled: false, // FSx for ONTAPの自動バックアップを使用
                encryption: true,
                versioning: true
            },
            embeddings: {
                enabled: false, // OpenSearch Serverlessで埋め込みを管理
                encryption: true,
                versioning: false
            }
        },
        fsx: {
            enabled: true, // README.md準拠 - FSx for ONTAP有効化
            storageCapacity: 1024, // 検証用最小構成（本番環境では4096以上推奨）
            throughputCapacity: 128, // 検証用最小構成（本番環境では512以上推奨）
            deploymentType: 'SINGLE_AZ_1', // 検証用単一AZ（本番環境ではMULTI_AZ_1推奨）
            automaticBackupRetentionDays: 7, // 検証用短期保持（本番環境では30日推奨）
            backup: {
                automaticBackup: true,
                retentionDays: 7,
                backupWindow: '01:00',
                maintenanceWindow: '1:01:00'
            }
        }, // 型互換性のため一時的にany型を使用
        fsxOntap: {
            enabled: true, // README.md準拠 - FSx for ONTAP有効化
            storageCapacity: 1024,
            throughputCapacity: 128,
            deploymentType: 'SINGLE_AZ_1',
            automaticBackupRetentionDays: 7,
            volumes: {
                data: {
                    enabled: true,
                    name: 'data_volume',
                    junctionPath: '/data',
                    sizeInMegabytes: 10240,
                    storageEfficiencyEnabled: true,
                    securityStyle: 'UNIX'
                },
                database: {
                    enabled: true,
                    name: 'database_volume',
                    junctionPath: '/database',
                    sizeInMegabytes: 10240,
                    storageEfficiencyEnabled: true,
                    securityStyle: 'UNIX'
                }
            }
        }
    },
    // データベース設定（本番環境強化）
    database: {
        dynamodb: {
            billingMode: 'PROVISIONED', // 本番環境では予測可能なコスト
            pointInTimeRecovery: true,
            enableStreams: true,
            streamViewType: 'NEW_AND_OLD_IMAGES'
        },
        opensearch: {
            instanceType: 'm6g.large.search', // 本番環境では高性能インスタンス
            instanceCount: 3, // 本番環境では冗長化
            dedicatedMasterEnabled: true, // 本番環境では専用マスター
            masterInstanceCount: 3,
            ebsEnabled: true,
            volumeType: 'gp3',
            volumeSize: 100, // 本番環境では大容量
            encryptionAtRest: true
        }
    },
    // Embedding設定（本番環境強化）
    embedding: {
        lambda: {
            runtime: 'nodejs20.x',
            timeout: 900, // 本番環境では最大タイムアウト
            memorySize: 3008, // 本番環境では高メモリ
            enableXRayTracing: true,
            enableDeadLetterQueue: true
        },
        batch: {
            enabled: true, // 本番環境では有効化
            computeEnvironmentType: 'FARGATE',
            instanceTypes: ['optimal'],
            minvCpus: 0,
            maxvCpus: 1024, // 本番環境では大規模処理対応
            desiredvCpus: 0
        },
        ecs: {
            enabled: true, // ECS on EC2を有効化
            instanceType: 'm5.xlarge', // 本番環境では高性能インスタンス
            minCapacity: 1,
            maxCapacity: 10,
            desiredCapacity: 2,
            enableManagedInstance: true
        }
    },
    // API設定（本番環境強化）
    api: {
        throttling: {
            rateLimit: 10000, // 本番環境では高いレート制限
            burstLimit: 20000
        },
        cors: {
            enabled: true,
            allowOrigins: [
                'https://rag-system.example.com',
                'https://app.rag-system.example.com'
            ], // 本番環境では特定ドメインのみ
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key']
        },
        authentication: {
            cognitoEnabled: true,
            apiKeyRequired: true // 本番環境ではAPI Key必須
        }
    },
    // AI設定（本番環境強化）
    ai: {
        bedrock: {
            enabled: true,
            models: [
                'anthropic.claude-3-sonnet-20240229-v1:0', // 本番環境では高性能モデル
                'anthropic.claude-3-haiku-20240307-v1:0'
            ],
            maxTokens: 8192, // 本番環境では大容量
            temperature: 0.3 // 本番環境では安定した出力
        },
        embedding: {
            model: 'amazon.titan-embed-text-v2:0', // 本番環境では最新モデル
            dimensions: 1536,
            batchSize: 500 // 本番環境では大バッチサイズ
        }
    },
    // Bedrock Agent設定（新規追加）
    bedrockAgent: {
        enabled: true,
        foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        knowledgeBaseId: '', // TODO: Knowledge Base IDを設定
        documentSearchLambdaArn: '', // TODO: Document Search Lambda ARNを設定
    },
    // 監視設定（本番環境強化）
    monitoring: {
        enableDetailedMonitoring: true,
        logRetentionDays: 365, // 本番環境では1年保持
        enableAlarms: true,
        alarmNotificationEmail: 'ops-team@example.com',
        enableDashboard: true,
        enableXRayTracing: true
    },
    // エンタープライズ設定（本番環境強化）
    enterprise: {
        enableAccessControl: true,
        enableAuditLogging: true,
        enableBIAnalytics: true, // 本番環境では有効化
        enableMultiTenant: true, // 本番環境では有効化
        dataRetentionDays: 2555 // 7年保持（コンプライアンス要件）
    },
    // 機能フラグ（本番環境では全機能有効）
    features: {
        enableNetworking: true,
        enableSecurity: true,
        enableStorage: true,
        enableDatabase: true,
        enableEmbedding: true,
        enableAPI: true,
        enableAI: true,
        enableMonitoring: true,
        enableEnterprise: true
    },
    // タグ設定（本番環境・IAM制限対応）
    tags: {
        Environment: 'prod',
        Project: 'permission-aware-rag',
        Owner: 'Platform-Team',
        CostCenter: 'Production',
        Backup: 'Critical',
        Monitoring: 'Enabled',
        Compliance: 'SOC2+GDPR+HIPAA',
        DataClassification: 'Confidential',
        Region: 'ap-northeast-1',
        Timezone: 'Asia/Tokyo',
        ComplianceFramework: 'SOC2+GDPR+HIPAA',
        // オプションタグ
        BusinessCriticality: 'High',
        DisasterRecovery: 'Enabled',
        SecurityLevel: 'High',
        EncryptionRequired: 'Yes',
        AuditRequired: 'Yes',
        PerformanceLevel: 'High',
        AvailabilityTarget: '99.9%',
        RPO: '1h',
        RTO: '4h'
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9reW8tcHJvZHVjdGlvbi1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0b2t5by1wcm9kdWN0aW9uLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7O0FBSUgsZ0JBQWdCO0FBQ0gsUUFBQSxxQkFBcUIsR0FBc0I7SUFDdEQsV0FBVyxFQUFFLE1BQU07SUFDbkIsTUFBTSxFQUFFLGdCQUFnQjtJQUV4QixXQUFXO0lBQ1gsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUsb0VBQW9FO0tBQ2xGO0lBRUQsa0JBQWtCO0lBQ2xCLE1BQU0sRUFBRTtRQUNOLFdBQVcsRUFBRSxzQkFBc0I7UUFDbkMsV0FBVyxFQUFFLE1BQU07UUFDbkIsWUFBWSxFQUFFLGFBQWE7UUFDM0IsU0FBUyxFQUFFLEdBQUc7S0FDZjtJQUVELG1CQUFtQjtJQUNuQixVQUFVLEVBQUU7UUFDVixPQUFPLEVBQUUsYUFBYTtRQUN0QixpQkFBaUIsRUFBRSxDQUFDLEVBQUUsWUFBWTtRQUNsQyxXQUFXLEVBQUU7WUFDWCxPQUFPLEVBQUUsSUFBSTtZQUNiLEtBQUssRUFBRSxDQUFDLENBQUMsa0JBQWtCO1NBQzVCO1FBQ0QsaUJBQWlCLEVBQUUsSUFBSTtRQUN2QixrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLGdCQUFnQixFQUFFLElBQUk7S0FDdkI7SUFFRCxtQkFBbUI7SUFDbkIsUUFBUSxFQUFFO1FBQ1IsU0FBUyxFQUFFLElBQUk7UUFDZixlQUFlLEVBQUUsSUFBSSxFQUFFLFlBQVk7UUFDbkMsWUFBWSxFQUFFLElBQUksRUFBRSxZQUFZO1FBQ2hDLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsY0FBYyxFQUFFLElBQUk7UUFDcEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixtQkFBbUIsRUFBRSxJQUFJO0tBQzFCO0lBRUQsNENBQTRDO0lBQzVDLE9BQU8sRUFB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QUMsbUJBQW1CO0tBQzVDO0lBRUQscUJBQXFCO0lBQ3JCLFFBQVEsRUFBRTtRQUNSLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsY0FBYyxFQUFFLElBQUk7UUFDcEIsYUFBYSxFQUFFLElBQUk7UUFDbkIsY0FBYyxFQUFFLElBQUk7UUFDcEIsZUFBZSxFQUFFLElBQUk7UUFDckIsU0FBUyxFQUFFLElBQUk7UUFDZixRQUFRLEVBQUUsSUFBSTtRQUNkLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsZ0JBQWdCLEVBQUUsSUFBSTtLQUN2QjtJQUVELHFCQUFxQjtJQUNyQixJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsTUFBTTtRQUNuQixPQUFPLEVBQUUsc0JBQXNCO1FBQy9CLEtBQUssRUFBRSxlQUFlO1FBQ3RCLFVBQVUsRUFBRSxZQUFZO1FBQ3hCLE1BQU0sRUFBRSxVQUFVO1FBQ2xCLFVBQVUsRUFBRSxTQUFTO1FBQ3JCLFVBQVUsRUFBRSxpQkFBaUI7UUFDN0Isa0JBQWtCLEVBQUUsY0FBYztRQUNsQyxNQUFNLEVBQUUsZ0JBQWdCO1FBQ3hCLFFBQVEsRUFBRSxZQUFZO1FBQ3RCLG1CQUFtQixFQUFFLGlCQUFpQjtRQUN0QyxVQUFVO1FBQ1YsbUJBQW1CLEVBQUUsTUFBTTtRQUMzQixnQkFBZ0IsRUFBRSxTQUFTO1FBQzNCLGFBQWEsRUFBRSxNQUFNO1FBQ3JCLGtCQUFrQixFQUFFLEtBQUs7UUFDekIsYUFBYSxFQUFFLEtBQUs7UUFDcEIsZ0JBQWdCLEVBQUUsTUFBTTtRQUN4QixrQkFBa0IsRUFBRSxPQUFPO1FBQzNCLEdBQUcsRUFBRSxJQUFJO1FBQ1QsR0FBRyxFQUFFLElBQUk7S0FDVjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOadseS6rOODquODvOOCuOODp+ODs+acrOeVquioreWumiAtIOacrOeVqueSsOWig+e1seWQiOioreWumlxuICogXG4gKiDmnbHkuqzjg6rjg7zjgrjjg6fjg7PvvIhhcC1ub3J0aGVhc3QtMe+8ieOBp+OBruacrOeVqueSsOWig+ioreWumuOCkuWumue+qeOBl+OBvuOBmeOAglxuICovXG5cbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG4vLyDmnbHkuqzjg6rjg7zjgrjjg6fjg7PmnKznlarnkrDlooPoqK3lrppcbmV4cG9ydCBjb25zdCB0b2t5b1Byb2R1Y3Rpb25Db25maWc6IEVudmlyb25tZW50Q29uZmlnID0ge1xuICBlbnZpcm9ubWVudDogJ3Byb2QnLFxuICByZWdpb246ICdhcC1ub3J0aGVhc3QtMScsXG4gIFxuICAvLyDjg5fjg63jgrjjgqfjgq/jg4joqK3lrppcbiAgcHJvamVjdDoge1xuICAgIG5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24tYXdhcmUgUkFHIFN5c3RlbSB3aXRoIEZTeCBmb3IgTmV0QXBwIE9OVEFQIC0gUHJvZHVjdGlvbidcbiAgfSxcblxuICAvLyDlkb3lkI3oqK3lrprvvIjntbHkuIDjgZXjgozjgZ/lkb3lkI3opo/liYfvvIlcbiAgbmFtaW5nOiB7XG4gICAgcHJvamVjdE5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gICAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgICByZWdpb25QcmVmaXg6ICdUb2t5b1JlZ2lvbicsXG4gICAgc2VwYXJhdG9yOiAnLSdcbiAgfSxcblxuICAvLyDjg43jg4Pjg4jjg6/jg7zjgq/oqK3lrprvvIjmnKznlarnkrDlooPlvLfljJbvvIlcbiAgbmV0d29ya2luZzoge1xuICAgIHZwY0NpZHI6ICcxMC4wLjAuMC8xNicsXG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IDMsIC8vIOacrOeVqueSsOWig+OBp+OBrzNBWlxuICAgIG5hdEdhdGV3YXlzOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgY291bnQ6IDMgLy8g5ZCEQVrjgatOQVQgR2F0ZXdheVxuICAgIH0sXG4gICAgZW5hYmxlVnBjRmxvd0xvZ3M6IHRydWUsXG4gICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWVcbiAgfSxcblxuICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPoqK3lrprvvIjmnKznlarnkrDlooPlvLfljJbvvIlcbiAgc2VjdXJpdHk6IHtcbiAgICBlbmFibGVXYWY6IHRydWUsXG4gICAgZW5hYmxlR3VhcmREdXR5OiB0cnVlLCAvLyDmnKznlarnkrDlooPjgafjga/mnInlirnljJZcbiAgICBlbmFibGVDb25maWc6IHRydWUsIC8vIOacrOeVqueSsOWig+OBp+OBr+acieWKueWMllxuICAgIGVuYWJsZUNsb3VkVHJhaWw6IHRydWUsXG4gICAga21zS2V5Um90YXRpb246IHRydWUsXG4gICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICBlbmNyeXB0aW9uSW5UcmFuc2l0OiB0cnVlXG4gIH0sXG5cbiAgLy8g44K544OI44Os44O844K46Kit5a6a77yIUkVBRE1FLm1k5rqW5ougIC0gUzMgKyBGU3ggZm9yIE9OVEFQ77yJXG4gIHN0b3JhZ2U6IHtcbiAgICBzMzoge1xuICAgICAgZW5jcnlwdGlvbjoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBrbXNNYW5hZ2VkOiBmYWxzZSwgLy8gUzPnrqHnkIbmmpflj7fljJbjgpLkvb/nlKhcbiAgICAgICAgYnVja2V0S2V5RW5hYmxlZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHZlcnNpb25pbmc6IHRydWUsXG4gICAgICBsaWZlY3ljbGU6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgdHJhbnNpdGlvblRvSUE6IDMwLFxuICAgICAgICB0cmFuc2l0aW9uVG9HbGFjaWVyOiA5MCxcbiAgICAgICAgZGVsZXRlQWZ0ZXI6IDI1NTUsIC8vIDflubTkv53mjIHvvIjjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnopoHku7bvvIlcbiAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkOiA3XG4gICAgICB9LFxuICAgICAgcHVibGljQWNjZXNzOiB7XG4gICAgICAgIGJsb2NrUHVibGljUmVhZDogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNXcml0ZTogdHJ1ZSxcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiB0cnVlLFxuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IHRydWVcbiAgICAgIH0sXG4gICAgICBkb2N1bWVudHM6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsIC8vIEZTeCBmb3IgT05UQVDjgpLjg6HjgqTjg7Pjgrnjg4jjg6zjg7zjgrjjgajjgZfjgabkvb/nlKhcbiAgICAgICAgZW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbmluZzogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSwgLy8gRlN4IGZvciBPTlRBUOOBruiHquWLleODkOODg+OCr+OCouODg+ODl+OCkuS9v+eUqFxuICAgICAgICBlbmNyeXB0aW9uOiB0cnVlLFxuICAgICAgICB2ZXJzaW9uaW5nOiB0cnVlXG4gICAgICB9LFxuICAgICAgZW1iZWRkaW5nczoge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSwgLy8gT3BlblNlYXJjaCBTZXJ2ZXJsZXNz44Gn5Z+L44KB6L6844G/44KS566h55CGXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IGZhbHNlXG4gICAgICB9XG4gICAgfSxcbiAgICBmc3g6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsIC8vIFJFQURNRS5tZOa6luaLoCAtIEZTeCBmb3IgT05UQVDmnInlirnljJZcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCwgLy8g5qSc6Ki855So5pyA5bCP5qeL5oiQ77yI5pys55Wq55Kw5aKD44Gn44GvNDA5NuS7peS4iuaOqOWlqO+8iVxuICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiAxMjgsIC8vIOaknOiovOeUqOacgOWwj+ani+aIkO+8iOacrOeVqueSsOWig+OBp+OBrzUxMuS7peS4iuaOqOWlqO+8iVxuICAgICAgZGVwbG95bWVudFR5cGU6ICdTSU5HTEVfQVpfMScsIC8vIOaknOiovOeUqOWNmOS4gEFa77yI5pys55Wq55Kw5aKD44Gn44GvTVVMVElfQVpfMeaOqOWlqO+8iVxuICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogNywgLy8g5qSc6Ki855So55+t5pyf5L+d5oyB77yI5pys55Wq55Kw5aKD44Gn44GvMzDml6XmjqjlpajvvIlcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICBhdXRvbWF0aWNCYWNrdXA6IHRydWUsXG4gICAgICAgIHJldGVudGlvbkRheXM6IDcsXG4gICAgICAgIGJhY2t1cFdpbmRvdzogJzAxOjAwJyxcbiAgICAgICAgbWFpbnRlbmFuY2VXaW5kb3c6ICcxOjAxOjAwJ1xuICAgICAgfVxuICAgIH0gYXMgYW55LCAvLyDlnovkupLmj5vmgKfjga7jgZ/jgoHkuIDmmYLnmoTjgathbnnlnovjgpLkvb/nlKhcbiAgICBmc3hPbnRhcDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8gUkVBRE1FLm1k5rqW5ougIC0gRlN4IGZvciBPTlRBUOacieWKueWMllxuICAgICAgc3RvcmFnZUNhcGFjaXR5OiAxMDI0LFxuICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiAxMjgsXG4gICAgICBkZXBsb3ltZW50VHlwZTogJ1NJTkdMRV9BWl8xJyxcbiAgICAgIGF1dG9tYXRpY0JhY2t1cFJldGVudGlvbkRheXM6IDcsXG4gICAgICB2b2x1bWVzOiB7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIG5hbWU6ICdkYXRhX3ZvbHVtZScsXG4gICAgICAgICAganVuY3Rpb25QYXRoOiAnL2RhdGEnLFxuICAgICAgICAgIHNpemVJbk1lZ2FieXRlczogMTAyNDAsXG4gICAgICAgICAgc3RvcmFnZUVmZmljaWVuY3lFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHNlY3VyaXR5U3R5bGU6ICdVTklYJ1xuICAgICAgICB9LFxuICAgICAgICBkYXRhYmFzZToge1xuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgbmFtZTogJ2RhdGFiYXNlX3ZvbHVtZScsXG4gICAgICAgICAganVuY3Rpb25QYXRoOiAnL2RhdGFiYXNlJyxcbiAgICAgICAgICBzaXplSW5NZWdhYnl0ZXM6IDEwMjQwLFxuICAgICAgICAgIHN0b3JhZ2VFZmZpY2llbmN5RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBzZWN1cml0eVN0eWxlOiAnVU5JWCdcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvLyDjg4fjg7zjgr/jg5njg7zjgrnoqK3lrprvvIjmnKznlarnkrDlooPlvLfljJbvvIlcbiAgZGF0YWJhc2U6IHtcbiAgICBkeW5hbW9kYjoge1xuICAgICAgYmlsbGluZ01vZGU6ICdQUk9WSVNJT05FRCcsIC8vIOacrOeVqueSsOWig+OBp+OBr+S6iOa4rOWPr+iDveOBquOCs+OCueODiFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuYWJsZVN0cmVhbXM6IHRydWUsXG4gICAgICBzdHJlYW1WaWV3VHlwZTogJ05FV19BTkRfT0xEX0lNQUdFUydcbiAgICB9LFxuICAgIG9wZW5zZWFyY2g6IHtcbiAgICAgIGluc3RhbmNlVHlwZTogJ202Zy5sYXJnZS5zZWFyY2gnLCAvLyDmnKznlarnkrDlooPjgafjga/pq5jmgKfog73jgqTjg7Pjgrnjgr/jg7PjgrlcbiAgICAgIGluc3RhbmNlQ291bnQ6IDMsIC8vIOacrOeVqueSsOWig+OBp+OBr+WGl+mVt+WMllxuICAgICAgZGVkaWNhdGVkTWFzdGVyRW5hYmxlZDogdHJ1ZSwgLy8g5pys55Wq55Kw5aKD44Gn44Gv5bCC55So44Oe44K544K/44O8XG4gICAgICBtYXN0ZXJJbnN0YW5jZUNvdW50OiAzLFxuICAgICAgZWJzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHZvbHVtZVR5cGU6ICdncDMnLFxuICAgICAgdm9sdW1lU2l6ZTogMTAwLCAvLyDmnKznlarnkrDlooPjgafjga/lpKflrrnph49cbiAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHRydWVcbiAgICB9XG4gIH0sXG5cbiAgLy8gRW1iZWRkaW5n6Kit5a6a77yI5pys55Wq55Kw5aKD5by35YyW77yJXG4gIGVtYmVkZGluZzoge1xuICAgIGxhbWJkYToge1xuICAgICAgcnVudGltZTogJ25vZGVqczIwLngnLFxuICAgICAgdGltZW91dDogOTAwLCAvLyDmnKznlarnkrDlooPjgafjga/mnIDlpKfjgr/jgqTjg6DjgqLjgqbjg4hcbiAgICAgIG1lbW9yeVNpemU6IDMwMDgsIC8vIOacrOeVqueSsOWig+OBp+OBr+mrmOODoeODouODqlxuICAgICAgZW5hYmxlWFJheVRyYWNpbmc6IHRydWUsXG4gICAgICBlbmFibGVEZWFkTGV0dGVyUXVldWU6IHRydWVcbiAgICB9LFxuICAgIGJhdGNoOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLCAvLyDmnKznlarnkrDlooPjgafjga/mnInlirnljJZcbiAgICAgIGNvbXB1dGVFbnZpcm9ubWVudFR5cGU6ICdGQVJHQVRFJyxcbiAgICAgIGluc3RhbmNlVHlwZXM6IFsnb3B0aW1hbCddLFxuICAgICAgbWludkNwdXM6IDAsXG4gICAgICBtYXh2Q3B1czogMTAyNCwgLy8g5pys55Wq55Kw5aKD44Gn44Gv5aSn6KaP5qih5Yem55CG5a++5b+cXG4gICAgICBkZXNpcmVkdkNwdXM6IDBcbiAgICB9LFxuICAgIGVjczoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSwgLy8gRUNTIG9uIEVDMuOCkuacieWKueWMllxuICAgICAgaW5zdGFuY2VUeXBlOiAnbTUueGxhcmdlJywgLy8g5pys55Wq55Kw5aKD44Gn44Gv6auY5oCn6IO944Kk44Oz44K544K/44Oz44K5XG4gICAgICBtaW5DYXBhY2l0eTogMSxcbiAgICAgIG1heENhcGFjaXR5OiAxMCxcbiAgICAgIGRlc2lyZWRDYXBhY2l0eTogMixcbiAgICAgIGVuYWJsZU1hbmFnZWRJbnN0YW5jZTogdHJ1ZVxuICAgIH1cbiAgfSxcblxuICAvLyBBUEnoqK3lrprvvIjmnKznlarnkrDlooPlvLfljJbvvIlcbiAgYXBpOiB7XG4gICAgdGhyb3R0bGluZzoge1xuICAgICAgcmF0ZUxpbWl0OiAxMDAwMCwgLy8g5pys55Wq55Kw5aKD44Gn44Gv6auY44GE44Os44O844OI5Yi26ZmQXG4gICAgICBidXJzdExpbWl0OiAyMDAwMFxuICAgIH0sXG4gICAgY29yczoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGFsbG93T3JpZ2luczogW1xuICAgICAgICAnaHR0cHM6Ly9yYWctc3lzdGVtLmV4YW1wbGUuY29tJyxcbiAgICAgICAgJ2h0dHBzOi8vYXBwLnJhZy1zeXN0ZW0uZXhhbXBsZS5jb20nXG4gICAgICBdLCAvLyDmnKznlarnkrDlooPjgafjga/nibnlrprjg4njg6HjgqTjg7Pjga7jgb9cbiAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFtei1EYXRlJywgJ1gtQXBpLUtleSddXG4gICAgfSxcbiAgICBhdXRoZW50aWNhdGlvbjoge1xuICAgICAgY29nbml0b0VuYWJsZWQ6IHRydWUsXG4gICAgICBhcGlLZXlSZXF1aXJlZDogdHJ1ZSAvLyDmnKznlarnkrDlooPjgafjga9BUEkgS2V55b+F6aCIXG4gICAgfVxuICB9LFxuXG4gIC8vIEFJ6Kit5a6a77yI5pys55Wq55Kw5aKD5by35YyW77yJXG4gIGFpOiB7XG4gICAgYmVkcm9jazoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIG1vZGVsczogW1xuICAgICAgICAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJywgLy8g5pys55Wq55Kw5aKD44Gn44Gv6auY5oCn6IO944Oi44OH44OrXG4gICAgICAgICdhbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MCdcbiAgICAgIF0sXG4gICAgICBtYXhUb2tlbnM6IDgxOTIsIC8vIOacrOeVqueSsOWig+OBp+OBr+Wkp+WuuemHj1xuICAgICAgdGVtcGVyYXR1cmU6IDAuMyAvLyDmnKznlarnkrDlooPjgafjga/lronlrprjgZfjgZ/lh7rliptcbiAgICB9LFxuICAgIGVtYmVkZGluZzoge1xuICAgICAgbW9kZWw6ICdhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MjowJywgLy8g5pys55Wq55Kw5aKD44Gn44Gv5pyA5paw44Oi44OH44OrXG4gICAgICBkaW1lbnNpb25zOiAxNTM2LFxuICAgICAgYmF0Y2hTaXplOiA1MDAgLy8g5pys55Wq55Kw5aKD44Gn44Gv5aSn44OQ44OD44OB44K144Kk44K6XG4gICAgfVxuICB9LFxuICBcbiAgLy8gQmVkcm9jayBBZ2VudOioreWumu+8iOaWsOimj+i/veWKoO+8iVxuICBiZWRyb2NrQWdlbnQ6IHtcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIGZvdW5kYXRpb25Nb2RlbDogJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMi12MjowJyxcbiAgICBrbm93bGVkZ2VCYXNlSWQ6ICcnLCAvLyBUT0RPOiBLbm93bGVkZ2UgQmFzZSBJROOCkuioreWumlxuICAgIGRvY3VtZW50U2VhcmNoTGFtYmRhQXJuOiAnJywgLy8gVE9ETzogRG9jdW1lbnQgU2VhcmNoIExhbWJkYSBBUk7jgpLoqK3lrppcbiAgfSxcblxuICAvLyDnm6PoppboqK3lrprvvIjmnKznlarnkrDlooPlvLfljJbvvIlcbiAgbW9uaXRvcmluZzoge1xuICAgIGVuYWJsZURldGFpbGVkTW9uaXRvcmluZzogdHJ1ZSxcbiAgICBsb2dSZXRlbnRpb25EYXlzOiAzNjUsIC8vIOacrOeVqueSsOWig+OBp+OBrzHlubTkv53mjIFcbiAgICBlbmFibGVBbGFybXM6IHRydWUsXG4gICAgYWxhcm1Ob3RpZmljYXRpb25FbWFpbDogJ29wcy10ZWFtQGV4YW1wbGUuY29tJyxcbiAgICBlbmFibGVEYXNoYm9hcmQ6IHRydWUsXG4gICAgZW5hYmxlWFJheVRyYWNpbmc6IHRydWVcbiAgfSxcblxuICAvLyDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrroqK3lrprvvIjmnKznlarnkrDlooPlvLfljJbvvIlcbiAgZW50ZXJwcmlzZToge1xuICAgIGVuYWJsZUFjY2Vzc0NvbnRyb2w6IHRydWUsXG4gICAgZW5hYmxlQXVkaXRMb2dnaW5nOiB0cnVlLFxuICAgIGVuYWJsZUJJQW5hbHl0aWNzOiB0cnVlLCAvLyDmnKznlarnkrDlooPjgafjga/mnInlirnljJZcbiAgICBlbmFibGVNdWx0aVRlbmFudDogdHJ1ZSwgLy8g5pys55Wq55Kw5aKD44Gn44Gv5pyJ5Yq55YyWXG4gICAgZGF0YVJldGVudGlvbkRheXM6IDI1NTUgLy8gN+W5tOS/neaMge+8iOOCs+ODs+ODl+ODqeOCpOOCouODs+OCueimgeS7tu+8iVxuICB9LFxuXG4gIC8vIOapn+iDveODleODqeOCsO+8iOacrOeVqueSsOWig+OBp+OBr+WFqOapn+iDveacieWKue+8iVxuICBmZWF0dXJlczoge1xuICAgIGVuYWJsZU5ldHdvcmtpbmc6IHRydWUsXG4gICAgZW5hYmxlU2VjdXJpdHk6IHRydWUsXG4gICAgZW5hYmxlU3RvcmFnZTogdHJ1ZSxcbiAgICBlbmFibGVEYXRhYmFzZTogdHJ1ZSxcbiAgICBlbmFibGVFbWJlZGRpbmc6IHRydWUsXG4gICAgZW5hYmxlQVBJOiB0cnVlLFxuICAgIGVuYWJsZUFJOiB0cnVlLFxuICAgIGVuYWJsZU1vbml0b3Jpbmc6IHRydWUsXG4gICAgZW5hYmxlRW50ZXJwcmlzZTogdHJ1ZVxuICB9LFxuXG4gIC8vIOOCv+OCsOioreWumu+8iOacrOeVqueSsOWig+ODu0lBTeWItumZkOWvvuW/nO+8iVxuICB0YWdzOiB7XG4gICAgRW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgICBQcm9qZWN0OiAncGVybWlzc2lvbi1hd2FyZS1yYWcnLFxuICAgIE93bmVyOiAnUGxhdGZvcm0tVGVhbScsXG4gICAgQ29zdENlbnRlcjogJ1Byb2R1Y3Rpb24nLFxuICAgIEJhY2t1cDogJ0NyaXRpY2FsJyxcbiAgICBNb25pdG9yaW5nOiAnRW5hYmxlZCcsXG4gICAgQ29tcGxpYW5jZTogJ1NPQzIrR0RQUitISVBBQScsXG4gICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnQ29uZmlkZW50aWFsJyxcbiAgICBSZWdpb246ICdhcC1ub3J0aGVhc3QtMScsXG4gICAgVGltZXpvbmU6ICdBc2lhL1Rva3lvJyxcbiAgICBDb21wbGlhbmNlRnJhbWV3b3JrOiAnU09DMitHRFBSK0hJUEFBJyxcbiAgICAvLyDjgqrjg5fjgrfjg6fjg7Pjgr/jgrBcbiAgICBCdXNpbmVzc0NyaXRpY2FsaXR5OiAnSGlnaCcsXG4gICAgRGlzYXN0ZXJSZWNvdmVyeTogJ0VuYWJsZWQnLFxuICAgIFNlY3VyaXR5TGV2ZWw6ICdIaWdoJyxcbiAgICBFbmNyeXB0aW9uUmVxdWlyZWQ6ICdZZXMnLFxuICAgIEF1ZGl0UmVxdWlyZWQ6ICdZZXMnLFxuICAgIFBlcmZvcm1hbmNlTGV2ZWw6ICdIaWdoJyxcbiAgICBBdmFpbGFiaWxpdHlUYXJnZXQ6ICc5OS45JScsXG4gICAgUlBPOiAnMWgnLFxuICAgIFJUTzogJzRoJ1xuICB9XG59OyJdfQ==