"use strict";
/**
 * 東京リージョン開発設定 - SQLite負荷試験対応
 *
 * 東京リージョン（ap-northeast-1）での開発環境設定を定義します。
 * SQLite負荷試験機能を含む包括的な設定
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokyoDevelopmentConfig = void 0;
// 東京リージョン開発環境設定
exports.tokyoDevelopmentConfig = {
    environment: 'dev',
    region: 'ap-northeast-1',
    // プロジェクト設定
    project: {
        name: 'permission-aware-rag',
        version: '1.0.0',
        description: 'Permission-aware RAG System with FSx for NetApp ONTAP - Development'
    },
    // 命名設定（統一された命名規則）
    naming: {
        projectName: 'permission-aware-rag',
        environment: 'dev',
        regionPrefix: 'TokyoRegion',
        separator: '-'
    },
    // ネットワーク設定（開発環境）
    networking: {
        vpcCidr: '10.21.0.0/16', // 既存VPCのCIDR
        availabilityZones: 2, // 開発環境では2AZ
        natGateways: {
            enabled: true,
            count: 1 // 開発環境では1つのNAT Gateway
        },
        enableVpcFlowLogs: false, // 開発環境ではコスト削減
        enableDnsHostnames: true,
        enableDnsSupport: true
    },
    // セキュリティ設定（開発環境）
    security: {
        enableWaf: false, // 開発環境ではコスト削減
        enableGuardDuty: false,
        enableConfig: false,
        enableCloudTrail: true,
        kmsKeyRotation: false, // 開発環境では無効
        encryptionAtRest: true,
        encryptionInTransit: true
    },
    // ストレージ設定（開発環境）
    storage: {
        s3: {
            enableVersioning: true,
            enableLifecyclePolicy: true,
            transitionToIADays: 30,
            transitionToGlacierDays: 90,
            expirationDays: 365, // 開発環境では1年保持
            documents: {
                encryption: true,
                versioning: true
            },
            backup: {
                encryption: true,
                versioning: false
            },
            embeddings: {
                encryption: true,
                versioning: false
            }
        },
        fsxOntap: {
            enabled: true,
            storageCapacity: 1024, // 開発環境では小容量
            throughputCapacity: 128, // 開発環境では低スループット
            deploymentType: 'SINGLE_AZ_1', // 開発環境では単一AZ
            automaticBackupRetentionDays: 7, // 開発環境では短期保持
            activeDirectory: {
                enabled: false // デフォルトは無効
            }
        }
    },
    // データベース設定（開発環境）
    database: {
        dynamodb: {
            billingMode: 'PAY_PER_REQUEST', // 開発環境では従量課金
            pointInTimeRecovery: false, // 開発環境では無効
            enableStreams: false,
            streamViewType: 'KEYS_ONLY'
        },
        opensearch: {
            instanceType: 't3.small.search', // 開発環境では小型インスタンス
            instanceCount: 1, // 開発環境では単一インスタンス
            dedicatedMasterEnabled: false,
            masterInstanceCount: 0,
            ebsEnabled: true,
            volumeType: 'gp3',
            volumeSize: 20, // 開発環境では小容量
            encryptionAtRest: true
        }
    },
    // Embedding設定（開発環境・SQLite負荷試験対応）
    embedding: {
        lambda: {
            runtime: 'nodejs20.x',
            timeout: 300, // 開発環境では短いタイムアウト
            memorySize: 1024, // 開発環境では標準メモリ
            enableXRayTracing: false, // 開発環境ではコスト削減
            enableDeadLetterQueue: true
        },
        batch: {
            enabled: true,
            computeEnvironmentType: 'EC2', // 開発環境ではEC2
            instanceTypes: ['m5.large', 'm5.xlarge'],
            minvCpus: 0,
            maxvCpus: 20, // 開発環境では小規模
            desiredvCpus: 0
        },
        ecs: {
            enabled: false, // 開発環境では無効化
            instanceType: 'm5.large',
            minCapacity: 0,
            maxCapacity: 2,
            desiredCapacity: 0,
            enableManagedInstance: false
        }
    },
    // API設定（開発環境）
    api: {
        throttling: {
            rateLimit: 1000, // 開発環境では低いレート制限
            burstLimit: 2000
        },
        cors: {
            enabled: true,
            allowOrigins: ['*'], // 開発環境では全て許可
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key']
        },
        authentication: {
            cognitoEnabled: true,
            apiKeyRequired: false // 開発環境では不要
        }
    },
    // AI設定（開発環境）
    ai: {
        bedrock: {
            enabled: true,
            models: [
                'anthropic.claude-3-haiku-20240307-v1:0', // 開発環境では軽量モデル
                'amazon.titan-embed-text-v1'
            ],
            maxTokens: 4096, // 開発環境では標準容量
            temperature: 0.7 // 開発環境では多様な出力
        },
        embedding: {
            model: 'amazon.titan-embed-text-v1',
            dimensions: 1536,
            batchSize: 100 // 開発環境では小バッチサイズ
        }
    },
    // 監視設定（開発環境）
    monitoring: {
        enableDetailedMonitoring: false, // 開発環境ではコスト削減
        logRetentionDays: 30, // 開発環境では短期保持
        enableAlarms: true,
        alarmNotificationEmail: 'dev-team@example.com',
        enableDashboard: true,
        enableXRayTracing: false // 開発環境ではコスト削減
    },
    // エンタープライズ設定（開発環境）
    enterprise: {
        enableAccessControl: true,
        enableAuditLogging: false, // 開発環境では無効
        enableBIAnalytics: false,
        enableMultiTenant: false,
        dataRetentionDays: 90 // 開発環境では短期保持
    },
    // 機能フラグ（開発環境では選択的有効化）
    features: {
        enableNetworking: true,
        enableSecurity: true,
        enableStorage: true,
        enableDatabase: true,
        enableEmbedding: true,
        enableAPI: true,
        enableAI: true,
        enableMonitoring: true,
        enableEnterprise: false // 開発環境では無効
    },
    // タグ設定（開発環境）
    tags: {
        Environment: 'dev',
        Project: 'permission-aware-rag',
        Owner: 'Development-Team',
        CostCenter: 'Development',
        Backup: 'Standard',
        Monitoring: 'Basic',
        Compliance: 'Basic',
        DataClassification: 'Internal',
        Region: 'ap-northeast-1',
        Timezone: 'Asia/Tokyo',
        ComplianceFramework: 'Basic'
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9reW8tZGV2ZWxvcG1lbnQtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidG9reW8tZGV2ZWxvcG1lbnQtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7O0FBSUgsZ0JBQWdCO0FBQ0gsUUFBQSxzQkFBc0IsR0FBc0I7SUFDdkQsV0FBVyxFQUFFLEtBQUs7SUFDbEIsTUFBTSxFQUFFLGdCQUFnQjtJQUV4QixXQUFXO0lBQ1gsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUscUVBQXFFO0tBQ25GO0lBRUQsa0JBQWtCO0lBQ2xCLE1BQU0sRUFBRTtRQUNOLFdBQVcsRUFBRSxzQkFBc0I7UUFDbkMsV0FBVyxFQUFFLEtBQUs7UUFDbEIsWUFBWSxFQUFFLGFBQWE7UUFDM0IsU0FBUyxFQUFFLEdBQUc7S0FDZjtJQUVELGlCQUFpQjtJQUNqQixVQUFVLEVBQUU7UUFDVixPQUFPLEVBQUUsY0FBYyxFQUFFLGFBQWE7UUFDdEMsaUJBQWlCLEVBQUUsQ0FBQyxFQUFFLFlBQVk7UUFDbEMsV0FBVyxFQUFFO1lBQ1gsT0FBTyxFQUFFLElBQUk7WUFDYixLQUFLLEVBQUUsQ0FBQyxDQUFDLHVCQUF1QjtTQUNqQztRQUNELGlCQUFpQixFQUFFLEtBQUssRUFBRSxjQUFjO1FBQ3hDLGtCQUFrQixFQUFFLElBQUk7UUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtLQUN2QjtJQUVELGlCQUFpQjtJQUNqQixRQUFRLEVBQUU7UUFDUixTQUFTLEVBQUUsS0FBSyxFQUFFLGNBQWM7UUFDaEMsZUFBZSxFQUFFLEtBQUs7UUFDdEIsWUFBWSxFQUFFLEtBQUs7UUFDbkIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixjQUFjLEVBQUUsS0FBSyxFQUFFLFdBQVc7UUFDbEMsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixtQkFBbUIsRUFBRSxJQUFJO0tBQzFCO0lB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RUFBRSxJQUFJO1FBQ2YsUUFBUSxFQUFFLElBQUk7UUFDZCxnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxXQUFXO0tBQ3BDO0lBRUQsYUFBYTtJQUNiLElBQUksRUFBRTtRQUNKLFdBQVcsRUFBRSxLQUFLO1FBQ2xCLE9BQU8sRUFBRSxzQkFBc0I7UUFDL0IsS0FBSyxFQUFFLGtCQUFrQjtRQUN6QixVQUFVLEVBQUUsYUFBYTtRQUN6QixNQUFNLEVBQUUsVUFBVTtRQUNsQixVQUFVLEVBQUUsT0FBTztRQUNuQixVQUFVLEVBQUUsT0FBTztRQUNuQixrQkFBa0IsRUFBRSxVQUFVO1FBQzlCLE1BQU0sRUFBRSxnQkFBZ0I7UUFDeEIsUUFBUSxFQUFFLFlBQVk7UUFDdEIsbUJBQW1CLEVBQUUsT0FBTztLQUM3QjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOadseS6rOODquODvOOCuOODp+ODs+mWi+eZuuioreWumiAtIFNRTGl0ZeiyoOiNt+ippumok+WvvuW/nFxuICogXG4gKiDmnbHkuqzjg6rjg7zjgrjjg6fjg7PvvIhhcC1ub3J0aGVhc3QtMe+8ieOBp+OBrumWi+eZuueSsOWig+ioreWumuOCkuWumue+qeOBl+OBvuOBmeOAglxuICogU1FMaXRl6LKg6I236Kmm6aiT5qmf6IO944KS5ZCr44KA5YyF5ous55qE44Gq6Kit5a6aXG4gKi9cblxuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbi8vIOadseS6rOODquODvOOCuOODp+ODs+mWi+eZuueSsOWig+ioreWumlxuZXhwb3J0IGNvbnN0IHRva3lvRGV2ZWxvcG1lbnRDb25maWc6IEVudmlyb25tZW50Q29uZmlnID0ge1xuICBlbnZpcm9ubWVudDogJ2RldicsXG4gIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0xJyxcbiAgXG4gIC8vIOODl+ODreOCuOOCp+OCr+ODiOioreWumlxuICBwcm9qZWN0OiB7XG4gICAgbmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgICB2ZXJzaW9uOiAnMS4wLjAnLFxuICAgIGRlc2NyaXB0aW9uOiAnUGVybWlzc2lvbi1hd2FyZSBSQUcgU3lzdGVtIHdpdGggRlN4IGZvciBOZXRBcHAgT05UQVAgLSBEZXZlbG9wbWVudCdcbiAgfSxcblxuICAvLyDlkb3lkI3oqK3lrprvvIjntbHkuIDjgZXjgozjgZ/lkb3lkI3opo/liYfvvIlcbiAgbmFtaW5nOiB7XG4gICAgcHJvamVjdE5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gICAgZW52aXJvbm1lbnQ6ICdkZXYnLFxuICAgIHJlZ2lvblByZWZpeDogJ1Rva3lvUmVnaW9uJyxcbiAgICBzZXBhcmF0b3I6ICctJ1xuICB9LFxuXG4gIC8vIOODjeODg+ODiOODr+ODvOOCr+ioreWumu+8iOmWi+eZuueSsOWig++8iVxuICBuZXR3b3JraW5nOiB7XG4gICAgdnBjQ2lkcjogJzEwLjIxLjAuMC8xNicsIC8vIOaXouWtmFZQQ+OBrkNJRFJcbiAgICBhdmFpbGFiaWxpdHlab25lczogMiwgLy8g6ZaL55m655Kw5aKD44Gn44GvMkFaXG4gICAgbmF0R2F0ZXdheXM6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBjb3VudDogMSAvLyDplovnmbrnkrDlooPjgafjga8x44Gk44GuTkFUIEdhdGV3YXlcbiAgICB9LFxuICAgIGVuYWJsZVZwY0Zsb3dMb2dzOiBmYWxzZSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv44Kz44K544OI5YmK5ribXG4gICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWVcbiAgfSxcblxuICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPoqK3lrprvvIjplovnmbrnkrDlooPvvIlcbiAgc2VjdXJpdHk6IHtcbiAgICBlbmFibGVXYWY6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/jgrPjgrnjg4jliYrmuJtcbiAgICBlbmFibGVHdWFyZER1dHk6IGZhbHNlLFxuICAgIGVuYWJsZUNvbmZpZzogZmFsc2UsXG4gICAgZW5hYmxlQ2xvdWRUcmFpbDogdHJ1ZSxcbiAgICBrbXNLZXlSb3RhdGlvbjogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+eEoeWKuVxuICAgIGVuY3J5cHRpb25BdFJlc3Q6IHRydWUsXG4gICAgZW5jcnlwdGlvbkluVHJhbnNpdDogdHJ1ZVxuICB9LFxuXG4gIC8vIOOCueODiOODrOODvOOCuOioreWumu+8iOmWi+eZuueSsOWig++8iVxuICBzdG9yYWdlOiB7XG4gICAgczM6IHtcbiAgICAgIGVuYWJsZVZlcnNpb25pbmc6IHRydWUsXG4gICAgICBlbmFibGVMaWZlY3ljbGVQb2xpY3k6IHRydWUsXG4gICAgICB0cmFuc2l0aW9uVG9JQURheXM6IDMwLFxuICAgICAgdHJhbnNpdGlvblRvR2xhY2llckRheXM6IDkwLFxuICAgICAgZXhwaXJhdGlvbkRheXM6IDM2NSwgLy8g6ZaL55m655Kw5aKD44Gn44GvMeW5tOS/neaMgVxuICAgICAgZG9jdW1lbnRzOiB7XG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IHRydWVcbiAgICAgIH0sXG4gICAgICBiYWNrdXA6IHtcbiAgICAgICAgZW5jcnlwdGlvbjogdHJ1ZSxcbiAgICAgICAgdmVyc2lvbmluZzogZmFsc2VcbiAgICAgIH0sXG4gICAgICBlbWJlZGRpbmdzOiB7XG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIHZlcnNpb25pbmc6IGZhbHNlXG4gICAgICB9XG4gICAgfSxcbiAgICBmc3hPbnRhcDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogMTAyNCwgLy8g6ZaL55m655Kw5aKD44Gn44Gv5bCP5a656YePXG4gICAgICB0aHJvdWdocHV0Q2FwYWNpdHk6IDEyOCwgLy8g6ZaL55m655Kw5aKD44Gn44Gv5L2O44K544Or44O844OX44OD44OIXG4gICAgICBkZXBsb3ltZW50VHlwZTogJ1NJTkdMRV9BWl8xJywgLy8g6ZaL55m655Kw5aKD44Gn44Gv5Y2Y5LiAQVpcbiAgICAgIGF1dG9tYXRpY0JhY2t1cFJldGVudGlvbkRheXM6IDcsIC8vIOmWi+eZuueSsOWig+OBp+OBr+efreacn+S/neaMgVxuICAgICAgYWN0aXZlRGlyZWN0b3J5OiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlIC8vIOODh+ODleOCqeODq+ODiOOBr+eEoeWKuVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvLyDjg4fjg7zjgr/jg5njg7zjgrnoqK3lrprvvIjplovnmbrnkrDlooPvvIlcbiAgZGF0YWJhc2U6IHtcbiAgICBkeW5hbW9kYjoge1xuICAgICAgYmlsbGluZ01vZGU6ICdQQVlfUEVSX1JFUVVFU1QnLCAvLyDplovnmbrnkrDlooPjgafjga/lvpPph4/oqrLph5FcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGZhbHNlLCAvLyDplovnmbrnkrDlooPjgafjga/nhKHlirlcbiAgICAgIGVuYWJsZVN0cmVhbXM6IGZhbHNlLFxuICAgICAgc3RyZWFtVmlld1R5cGU6ICdLRVlTX09OTFknXG4gICAgfSxcbiAgICBvcGVuc2VhcmNoOiB7XG4gICAgICBpbnN0YW5jZVR5cGU6ICd0My5zbWFsbC5zZWFyY2gnLCAvLyDplovnmbrnkrDlooPjgafjga/lsI/lnovjgqTjg7Pjgrnjgr/jg7PjgrlcbiAgICAgIGluc3RhbmNlQ291bnQ6IDEsIC8vIOmWi+eZuueSsOWig+OBp+OBr+WNmOS4gOOCpOODs+OCueOCv+ODs+OCuVxuICAgICAgZGVkaWNhdGVkTWFzdGVyRW5hYmxlZDogZmFsc2UsXG4gICAgICBtYXN0ZXJJbnN0YW5jZUNvdW50OiAwLFxuICAgICAgZWJzRW5hYmxlZDogdHJ1ZSxcbiAgICAgIHZvbHVtZVR5cGU6ICdncDMnLFxuICAgICAgdm9sdW1lU2l6ZTogMjAsIC8vIOmWi+eZuueSsOWig+OBp+OBr+Wwj+WuuemHj1xuICAgICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZVxuICAgIH1cbiAgfSxcblxuICAvLyBFbWJlZGRpbmfoqK3lrprvvIjplovnmbrnkrDlooPjg7tTUUxpdGXosqDojbfoqabpqJPlr77lv5zvvIlcbiAgZW1iZWRkaW5nOiB7XG4gICAgbGFtYmRhOiB7XG4gICAgICBydW50aW1lOiAnbm9kZWpzMjAueCcsXG4gICAgICB0aW1lb3V0OiAzMDAsIC8vIOmWi+eZuueSsOWig+OBp+OBr+efreOBhOOCv+OCpOODoOOCouOCpuODiFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8g6ZaL55m655Kw5aKD44Gn44Gv5qiZ5rqW44Oh44Oi44OqXG4gICAgICBlbmFibGVYUmF5VHJhY2luZzogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+OCs+OCueODiOWJiua4m1xuICAgICAgZW5hYmxlRGVhZExldHRlclF1ZXVlOiB0cnVlXG4gICAgfSxcbiAgICBiYXRjaDoge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIGNvbXB1dGVFbnZpcm9ubWVudFR5cGU6ICdFQzInLCAvLyDplovnmbrnkrDlooPjgafjga9FQzJcbiAgICAgIGluc3RhbmNlVHlwZXM6IFsnbTUubGFyZ2UnLCAnbTUueGxhcmdlJ10sXG4gICAgICBtaW52Q3B1czogMCxcbiAgICAgIG1heHZDcHVzOiAyMCwgLy8g6ZaL55m655Kw5aKD44Gn44Gv5bCP6KaP5qihXG4gICAgICBkZXNpcmVkdkNwdXM6IDBcbiAgICB9LFxuICAgIGVjczoge1xuICAgICAgZW5hYmxlZDogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+eEoeWKueWMllxuICAgICAgaW5zdGFuY2VUeXBlOiAnbTUubGFyZ2UnLFxuICAgICAgbWluQ2FwYWNpdHk6IDAsXG4gICAgICBtYXhDYXBhY2l0eTogMixcbiAgICAgIGRlc2lyZWRDYXBhY2l0eTogMCxcbiAgICAgIGVuYWJsZU1hbmFnZWRJbnN0YW5jZTogZmFsc2VcbiAgICB9XG4gIH0sXG5cbiAgLy8gQVBJ6Kit5a6a77yI6ZaL55m655Kw5aKD77yJXG4gIGFwaToge1xuICAgIHRocm90dGxpbmc6IHtcbiAgICAgIHJhdGVMaW1pdDogMTAwMCwgLy8g6ZaL55m655Kw5aKD44Gn44Gv5L2O44GE44Os44O844OI5Yi26ZmQXG4gICAgICBidXJzdExpbWl0OiAyMDAwXG4gICAgfSxcbiAgICBjb3JzOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgYWxsb3dPcmlnaW5zOiBbJyonXSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv5YWo44Gm6Kix5Y+vXG4gICAgICBhbGxvd01ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BbXotRGF0ZScsICdYLUFwaS1LZXknXVxuICAgIH0sXG4gICAgYXV0aGVudGljYXRpb246IHtcbiAgICAgIGNvZ25pdG9FbmFibGVkOiB0cnVlLFxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IGZhbHNlIC8vIOmWi+eZuueSsOWig+OBp+OBr+S4jeimgVxuICAgIH1cbiAgfSxcblxuICAvLyBBSeioreWumu+8iOmWi+eZuueSsOWig++8iVxuICBhaToge1xuICAgIGJlZHJvY2s6IHtcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBtb2RlbHM6IFtcbiAgICAgICAgJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJywgLy8g6ZaL55m655Kw5aKD44Gn44Gv6Lu96YeP44Oi44OH44OrXG4gICAgICAgICdhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MSdcbiAgICAgIF0sXG4gICAgICBtYXhUb2tlbnM6IDQwOTYsIC8vIOmWi+eZuueSsOWig+OBp+OBr+aomea6luWuuemHj1xuICAgICAgdGVtcGVyYXR1cmU6IDAuNyAvLyDplovnmbrnkrDlooPjgafjga/lpJrmp5jjgarlh7rliptcbiAgICB9LFxuICAgIGVtYmVkZGluZzoge1xuICAgICAgbW9kZWw6ICdhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MScsXG4gICAgICBkaW1lbnNpb25zOiAxNTM2LFxuICAgICAgYmF0Y2hTaXplOiAxMDAgLy8g6ZaL55m655Kw5aKD44Gn44Gv5bCP44OQ44OD44OB44K144Kk44K6XG4gICAgfVxuICB9LFxuXG4gIC8vIOebo+imluioreWumu+8iOmWi+eZuueSsOWig++8iVxuICBtb25pdG9yaW5nOiB7XG4gICAgZW5hYmxlRGV0YWlsZWRNb25pdG9yaW5nOiBmYWxzZSwgLy8g6ZaL55m655Kw5aKD44Gn44Gv44Kz44K544OI5YmK5ribXG4gICAgbG9nUmV0ZW50aW9uRGF5czogMzAsIC8vIOmWi+eZuueSsOWig+OBp+OBr+efreacn+S/neaMgVxuICAgIGVuYWJsZUFsYXJtczogdHJ1ZSxcbiAgICBhbGFybU5vdGlmaWNhdGlvbkVtYWlsOiAnZGV2LXRlYW1AZXhhbXBsZS5jb20nLFxuICAgIGVuYWJsZURhc2hib2FyZDogdHJ1ZSxcbiAgICBlbmFibGVYUmF5VHJhY2luZzogZmFsc2UgLy8g6ZaL55m655Kw5aKD44Gn44Gv44Kz44K544OI5YmK5ribXG4gIH0sXG5cbiAgLy8g44Ko44Oz44K/44O844OX44Op44Kk44K66Kit5a6a77yI6ZaL55m655Kw5aKD77yJXG4gIGVudGVycHJpc2U6IHtcbiAgICBlbmFibGVBY2Nlc3NDb250cm9sOiB0cnVlLFxuICAgIGVuYWJsZUF1ZGl0TG9nZ2luZzogZmFsc2UsIC8vIOmWi+eZuueSsOWig+OBp+OBr+eEoeWKuVxuICAgIGVuYWJsZUJJQW5hbHl0aWNzOiBmYWxzZSxcbiAgICBlbmFibGVNdWx0aVRlbmFudDogZmFsc2UsXG4gICAgZGF0YVJldGVudGlvbkRheXM6IDkwIC8vIOmWi+eZuueSsOWig+OBp+OBr+efreacn+S/neaMgVxuICB9LFxuXG4gIC8vIOapn+iDveODleODqeOCsO+8iOmWi+eZuueSsOWig+OBp+OBr+mBuOaKnueahOacieWKueWMlu+8iVxuICBmZWF0dXJlczoge1xuICAgIGVuYWJsZU5ldHdvcmtpbmc6IHRydWUsXG4gICAgZW5hYmxlU2VjdXJpdHk6IHRydWUsXG4gICAgZW5hYmxlU3RvcmFnZTogdHJ1ZSxcbiAgICBlbmFibGVEYXRhYmFzZTogdHJ1ZSxcbiAgICBlbmFibGVFbWJlZGRpbmc6IHRydWUsXG4gICAgZW5hYmxlQVBJOiB0cnVlLFxuICAgIGVuYWJsZUFJOiB0cnVlLFxuICAgIGVuYWJsZU1vbml0b3Jpbmc6IHRydWUsXG4gICAgZW5hYmxlRW50ZXJwcmlzZTogZmFsc2UgLy8g6ZaL55m655Kw5aKD44Gn44Gv54Sh5Yq5XG4gIH0sXG5cbiAgLy8g44K/44Kw6Kit5a6a77yI6ZaL55m655Kw5aKD77yJXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogJ2RldicsXG4gICAgUHJvamVjdDogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgICBPd25lcjogJ0RldmVsb3BtZW50LVRlYW0nLFxuICAgIENvc3RDZW50ZXI6ICdEZXZlbG9wbWVudCcsXG4gICAgQmFja3VwOiAnU3RhbmRhcmQnLFxuICAgIE1vbml0b3Jpbmc6ICdCYXNpYycsXG4gICAgQ29tcGxpYW5jZTogJ0Jhc2ljJyxcbiAgICBEYXRhQ2xhc3NpZmljYXRpb246ICdJbnRlcm5hbCcsXG4gICAgUmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnLFxuICAgIFRpbWV6b25lOiAnQXNpYS9Ub2t5bycsXG4gICAgQ29tcGxpYW5jZUZyYW1ld29yazogJ0Jhc2ljJ1xuICB9XG59OyJdfQ==