"use strict";
/**
 * OpenSearch Multimodal Embedding設定
 *
 * 環境別の最適化された設定を提供
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityEnhancedConfig = exports.performanceOptimizedConfig = exports.costOptimizedConfig = exports.highPerformanceConfig = exports.productionConfig = exports.stagingConfig = exports.developmentConfig = void 0;
exports.getOpenSearchMultimodalConfig = getOpenSearchMultimodalConfig;
/**
 * 開発環境用設定
 */
exports.developmentConfig = {
    domainName: 'multimodal-dev',
    environment: 'dev',
    collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'Development environment for multimodal embedding testing',
    },
    networkConfig: {
        vpcEnabled: false,
    },
    securityConfig: {
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHttps: true,
        fineGrainedAccessControl: false,
    },
    monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: false,
        appLogsEnabled: true,
        indexSlowLogsEnabled: false,
    },
    backupConfig: {
        automatedSnapshotStartHour: 3,
    },
    tags: {
        CostCenter: 'Development',
        Purpose: 'MultimodalEmbeddingTesting',
    },
};
/**
 * ステージング環境用設定
 */
exports.stagingConfig = {
    domainName: 'multimodal-staging',
    environment: 'staging',
    collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'Staging environment for multimodal embedding validation',
    },
    networkConfig: {
        vpcEnabled: true,
        // VPC, subnets, securityGroupsは実行時に設定
    },
    securityConfig: {
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHttps: true,
        fineGrainedAccessControl: true,
    },
    monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: true,
        appLogsEnabled: true,
        indexSlowLogsEnabled: true,
    },
    backupConfig: {
        automatedSnapshotStartHour: 2,
    },
    tags: {
        CostCenter: 'Staging',
        Purpose: 'MultimodalEmbeddingTesting',
        DataClassification: 'Internal',
    },
};
/**
 * 本番環境用設定
 */
exports.productionConfig = {
    domainName: 'multimodal-prod',
    environment: 'prod',
    collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'Production environment for multimodal embedding search',
    },
    networkConfig: {
        vpcEnabled: true,
        // VPC, subnets, securityGroupsは実行時に設定
    },
    securityConfig: {
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHttps: true,
        fineGrainedAccessControl: true,
    },
    monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: true,
        appLogsEnabled: true,
        indexSlowLogsEnabled: true,
    },
    backupConfig: {
        automatedSnapshotStartHour: 1,
    },
    tags: {
        CostCenter: 'Production',
        Purpose: 'MultimodalEmbeddingProduction',
        DataClassification: 'Confidential',
        BackupRequired: 'true',
        MonitoringLevel: 'Enhanced',
    },
};
/**
 * 高性能環境用設定（大量データ処理用）
 */
exports.highPerformanceConfig = {
    domainName: 'multimodal-perf',
    environment: 'prod',
    collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'High-performance environment for large-scale multimodal embedding processing',
    },
    networkConfig: {
        vpcEnabled: true,
        // VPC, subnets, securityGroupsは実行時に設定
    },
    securityConfig: {
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHttps: true,
        fineGrainedAccessControl: true,
    },
    monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: true,
        appLogsEnabled: true,
        indexSlowLogsEnabled: true,
    },
    backupConfig: {
        automatedSnapshotStartHour: 0,
    },
    tags: {
        CostCenter: 'Production',
        Purpose: 'MultimodalEmbeddingHighPerformance',
        DataClassification: 'Confidential',
        BackupRequired: 'true',
        MonitoringLevel: 'Enhanced',
        PerformanceTier: 'High',
    },
};
/**
 * 環境に応じた設定取得
 */
function getOpenSearchMultimodalConfig(environment, performanceTier) {
    switch (environment.toLowerCase()) {
        case 'dev':
        case 'development':
            return exports.developmentConfig;
        case 'staging':
        case 'stage':
            return exports.stagingConfig;
        case 'prod':
        case 'production':
            if (performanceTier === 'high') {
                return exports.highPerformanceConfig;
            }
            return exports.productionConfig;
        default:
            throw new Error(`未対応の環境: ${environment}`);
    }
}
/**
 * コスト最適化設定
 */
exports.costOptimizedConfig = {
    collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'Cost-optimized multimodal embedding collection',
    },
    monitoringConfig: {
        logsEnabled: false,
        slowLogsEnabled: false,
        appLogsEnabled: false,
        indexSlowLogsEnabled: false,
    },
};
/**
 * パフォーマンス最適化設定
 */
exports.performanceOptimizedConfig = {
    collectionConfig: {
        type: 'VECTORSEARCH',
        description: 'Performance-optimized multimodal embedding collection',
    },
    monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: true,
        appLogsEnabled: true,
        indexSlowLogsEnabled: true,
    },
};
/**
 * セキュリティ強化設定
 */
exports.securityEnhancedConfig = {
    securityConfig: {
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHttps: true,
        fineGrainedAccessControl: true,
    },
    networkConfig: {
        vpcEnabled: true,
        // 専用VPC、プライベートサブネット、厳格なセキュリティグループ
    },
    monitoringConfig: {
        logsEnabled: true,
        slowLogsEnabled: true,
        appLogsEnabled: true,
        indexSlowLogsEnabled: true,
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaC1tdWx0aW1vZGFsLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW5zZWFyY2gtbXVsdGltb2RhbC1jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQW1MSCxzRUF1QkM7QUFyTUQ7O0dBRUc7QUFDVSxRQUFBLGlCQUFpQixHQUErQjtJQUMzRCxVQUFVLEVBQUUsZ0JBQWdCO0lBQzVCLFdBQVcsRUFBRSxLQUFLO0lBRWxCLGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxjQUFjO1FBQ3BCLFdBQVcsRUFBRSwwREFBMEQ7S0FDeEU7SUFFRCxhQUFhLEVBQUU7UUFDYixVQUFVLEVBQUUsS0FBSztLQUNsQjtJQUVELGNBQWMsRUFBRTtRQUNkLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsb0JBQW9CLEVBQUUsSUFBSTtRQUMxQixZQUFZLEVBQUUsSUFBSTtRQUNsQix3QkFBd0IsRUFBRSxLQUFLO0tBQ2hDO0lBRUQsZ0JBQWdCLEVBQUU7UUFDaEIsV0FBVyxFQUFFLElBQUk7UUFDakIsZUFBZSxFQUFFLEtBQUs7UUFDdEIsY0FBYyxFQUFFLElBQUk7UUFDcEIsb0JBQW9CLEVBQUUsS0FBSztLQUM1QjtJQUVELFlBQVksRUFBRTtRQUNaLDBCQUEwQixFQUFFLENBQUM7S0FDOUI7SUFFRCxJQUFJLEVBQUU7UUFDSixVQUFVLEVBQUUsYUFBYTtRQUN6QixPQUFPLEVBQUUsNEJBQTRCO0tBQ3RDO0NBQ0YsQ0FBQztBQUVGOztHQUVHO0FBQ1UsUUFBQSxhQUFhLEdBQStCO0lBQ3ZELFVBQVUsRUFBRSxvQkFBb0I7SUFDaEMsV0FBVyxFQUFFLFNBQVM7SUFFdEIsZ0JBQWdCLEVBQUU7UUFDaEIsSUFBSSxFQUFFLGNBQWM7UUFDcEIsV0FBVyxFQUFFLHlEQUF5RDtLQUN2RTtJQUVELGFBQWEsRUFBRTtRQUNiLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLHNDQUFzQztLQUN2QztJQUVELGNBQWMsRUFBRTtRQUNkLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsb0JBQW9CLEVBQUUsSUFBSTtRQUMxQixZQUFZLEVBQUUsSUFBSTtRQUNsQix3QkFBd0IsRUFBRSxJQUFJO0tBQy9CO0lBRUQsZ0JBQWdCLEVBQUU7UUFDaEIsV0FBVyxFQUFFLElBQUk7UUFDakIsZUFBZSxFQUFFLElBQUk7UUFDckIsY0FBYyxFQUFFLElBQUk7UUFDcEIsb0JBQW9CLEVBQUUsSUFBSTtLQUMzQjtJQUVELFlBQVksRUFBRTtRQUNaLDBCQUEwQixFQUFFLENBQUM7S0FDOUI7SUFFRCxJQUFJLEVBQUU7UUFDSixVQUFVLEVBQUUsU0FBUztRQUNyQixPQUFPLEVBQUUsNEJBQTRCO1FBQ3JDLGtCQUFrQixFQUFFLFVBQVU7S0FDL0I7Q0FDRixDQUFDO0FBRUY7O0dBRUc7QUFDVSxRQUFBLGdCQUFnQixHQUErQjtJQUMxRCxVQUFVLEVBQUUsaUJBQWlCO0lBQzdCLFdBQVcsRUFBRSxNQUFNO0lBRW5CLGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxjQUFjO1FBQ3BCLFdBQVcsRUFBRSx3REFBd0Q7S0FDdEU7SUFFRCxhQUFhLEVBQUU7UUFDYixVQUFVLEVBQUUsSUFBSTtRQUNoQixzQ0FBc0M7S0FDdkM7SUFFRCxjQUFjLEVBQUU7UUFDZCxnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLG9CQUFvQixFQUFFLElBQUk7UUFDMUIsWUFBWSxFQUFFLElBQUk7UUFDbEIsd0JBQXdCLEVBQUUsSUFBSTtLQUMvQjtJQUVELGdCQUFnQixFQUFFO1FBQ2hCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLGVBQWUsRUFBRSxJQUFJO1FBQ3JCLGNBQWMsRUFBRSxJQUFJO1FBQ3BCLG9CQUFvQixFQUFFLElBQUk7S0FDM0I7SUFFRCxZQUFZLEVBQUU7UUFDWiwwQkFBMEIsRUFBRSxDQUFDO0tBQzlCO0lBRUQsSUFBSSxFQUFFO1FBQ0osVUFBVSxFQUFFLFlBQVk7UUFDeEIsT0FBTyxFQUFFLCtCQUErQjtRQUN4QyxrQkFBa0IsRUFBRSxjQUFjO1FBQ2xDLGNBQWMsRUFBRSxNQUFNO1FBQ3RCLGVBQWUsRUFBRSxVQUFVO0tBQzVCO0NBQ0YsQ0FBQztBQUVGOztHQUVHO0FBQ1UsUUFBQSxxQkFBcUIsR0FBK0I7SUFDL0QsVUFBVSxFQUFFLGlCQUFpQjtJQUM3QixXQUFXLEVBQUUsTUFBTTtJQUVuQixnQkFBZ0IsRUFBRTtRQUNoQixJQUFJLEVBQUUsY0FBYztRQUNwQixXQUFXLEVBQUUsOEVBQThFO0tBQzVGO0lBRUQsYUFBYSxFQUFFO1FBQ2IsVUFBVSxFQUFFLElBQUk7UUFDaEIsc0NBQXNDO0tBQ3ZDO0lBRUQsY0FBYyxFQUFFO1FBQ2QsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixvQkFBb0IsRUFBRSxJQUFJO1FBQzFCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLHdCQUF3QixFQUFFLElBQUk7S0FDL0I7SUFFRCxnQkFBZ0IsRUFBRTtRQUNoQixXQUFXLEVBQUUsSUFBSTtRQUNqQixlQUFlLEVBQUUsSUFBSTtRQUNyQixjQUFjLEVBQUUsSUFBSTtRQUNwQixvQkFBb0IsRUFBRSxJQUFJO0tBQzNCO0lBRUQsWUFBWSxFQUFFO1FBQ1osMEJBQTBCLEVBQUUsQ0FBQztLQUM5QjtJQUVELElBQUksRUFBRTtRQUNKLFVBQVUsRUFBRSxZQUFZO1FBQ3hCLE9BQU8sRUFBRSxvQ0FBb0M7UUFDN0Msa0JBQWtCLEVBQUUsY0FBYztRQUNsQyxjQUFjLEVBQUUsTUFBTTtRQUN0QixlQUFlLEVBQUUsVUFBVTtRQUMzQixlQUFlLEVBQUUsTUFBTTtLQUN4QjtDQUNGLENBQUM7QUFFRjs7R0FFRztBQUNILFNBQWdCLDZCQUE2QixDQUMzQyxXQUFtQixFQUNuQixlQUFxQztJQUVyQyxRQUFRLFdBQVcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1FBQ2xDLEtBQUssS0FBSyxDQUFDO1FBQ1gsS0FBSyxhQUFhO1lBQ2hCLE9BQU8seUJBQWlCLENBQUM7UUFFM0IsS0FBSyxTQUFTLENBQUM7UUFDZixLQUFLLE9BQU87WUFDVixPQUFPLHFCQUFhLENBQUM7UUFFdkIsS0FBSyxNQUFNLENBQUM7UUFDWixLQUFLLFlBQVk7WUFDZixJQUFJLGVBQWUsS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDL0IsT0FBTyw2QkFBcUIsQ0FBQztZQUMvQixDQUFDO1lBQ0QsT0FBTyx3QkFBZ0IsQ0FBQztRQUUxQjtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDVSxRQUFBLG1CQUFtQixHQUF3QztJQUN0RSxnQkFBZ0IsRUFBRTtRQUNoQixJQUFJLEVBQUUsY0FBYztRQUNwQixXQUFXLEVBQUUsZ0RBQWdEO0tBQzlEO0lBRUQsZ0JBQWdCLEVBQUU7UUFDaEIsV0FBVyxFQUFFLEtBQUs7UUFDbEIsZUFBZSxFQUFFLEtBQUs7UUFDdEIsY0FBYyxFQUFFLEtBQUs7UUFDckIsb0JBQW9CLEVBQUUsS0FBSztLQUM1QjtDQUNGLENBQUM7QUFFRjs7R0FFRztBQUNVLFFBQUEsMEJBQTBCLEdBQXdDO0lBQzdFLGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxjQUFjO1FBQ3BCLFdBQVcsRUFBRSx1REFBdUQ7S0FDckU7SUFFRCxnQkFBZ0IsRUFBRTtRQUNoQixXQUFXLEVBQUUsSUFBSTtRQUNqQixlQUFlLEVBQUUsSUFBSTtRQUNyQixjQUFjLEVBQUUsSUFBSTtRQUNwQixvQkFBb0IsRUFBRSxJQUFJO0tBQzNCO0NBQ0YsQ0FBQztBQUVGOztHQUVHO0FBQ1UsUUFBQSxzQkFBc0IsR0FBd0M7SUFDekUsY0FBYyxFQUFFO1FBQ2QsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixvQkFBb0IsRUFBRSxJQUFJO1FBQzFCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLHdCQUF3QixFQUFFLElBQUk7S0FDL0I7SUFFRCxhQUFhLEVBQUU7UUFDYixVQUFVLEVBQUUsSUFBSTtRQUNoQixrQ0FBa0M7S0FDbkM7SUFFRCxnQkFBZ0IsRUFBRTtRQUNoQixXQUFXLEVBQUUsSUFBSTtRQUNqQixlQUFlLEVBQUUsSUFBSTtRQUNyQixjQUFjLEVBQUUsSUFBSTtRQUNwQixvQkFBb0IsRUFBRSxJQUFJO0tBQzNCO0NBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogT3BlblNlYXJjaCBNdWx0aW1vZGFsIEVtYmVkZGluZ+ioreWumlxuICogXG4gKiDnkrDlooPliKXjga7mnIDpganljJbjgZXjgozjgZ/oqK3lrprjgpLmj5DkvptcbiAqL1xuXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBPcGVuU2VhcmNoTXVsdGltb2RhbENvbmZpZyB9IGZyb20gJy4uL2NvbnN0cnVjdHMvb3BlbnNlYXJjaC1tdWx0aW1vZGFsLWNvbnN0cnVjdCc7XG5cbi8qKlxuICog6ZaL55m655Kw5aKD55So6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBkZXZlbG9wbWVudENvbmZpZzogT3BlblNlYXJjaE11bHRpbW9kYWxDb25maWcgPSB7XG4gIGRvbWFpbk5hbWU6ICdtdWx0aW1vZGFsLWRldicsXG4gIGVudmlyb25tZW50OiAnZGV2JyxcbiAgXG4gIGNvbGxlY3Rpb25Db25maWc6IHtcbiAgICB0eXBlOiAnVkVDVE9SU0VBUkNIJyxcbiAgICBkZXNjcmlwdGlvbjogJ0RldmVsb3BtZW50IGVudmlyb25tZW50IGZvciBtdWx0aW1vZGFsIGVtYmVkZGluZyB0ZXN0aW5nJyxcbiAgfSxcbiAgXG4gIG5ldHdvcmtDb25maWc6IHtcbiAgICB2cGNFbmFibGVkOiBmYWxzZSxcbiAgfSxcbiAgXG4gIHNlY3VyaXR5Q29uZmlnOiB7XG4gICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICBub2RlVG9Ob2RlRW5jcnlwdGlvbjogdHJ1ZSxcbiAgICBlbmZvcmNlSHR0cHM6IHRydWUsXG4gICAgZmluZUdyYWluZWRBY2Nlc3NDb250cm9sOiBmYWxzZSxcbiAgfSxcbiAgXG4gIG1vbml0b3JpbmdDb25maWc6IHtcbiAgICBsb2dzRW5hYmxlZDogdHJ1ZSxcbiAgICBzbG93TG9nc0VuYWJsZWQ6IGZhbHNlLFxuICAgIGFwcExvZ3NFbmFibGVkOiB0cnVlLFxuICAgIGluZGV4U2xvd0xvZ3NFbmFibGVkOiBmYWxzZSxcbiAgfSxcbiAgXG4gIGJhY2t1cENvbmZpZzoge1xuICAgIGF1dG9tYXRlZFNuYXBzaG90U3RhcnRIb3VyOiAzLFxuICB9LFxuICBcbiAgdGFnczoge1xuICAgIENvc3RDZW50ZXI6ICdEZXZlbG9wbWVudCcsXG4gICAgUHVycG9zZTogJ011bHRpbW9kYWxFbWJlZGRpbmdUZXN0aW5nJyxcbiAgfSxcbn07XG5cbi8qKlxuICog44K544OG44O844K444Oz44Kw55Kw5aKD55So6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBzdGFnaW5nQ29uZmlnOiBPcGVuU2VhcmNoTXVsdGltb2RhbENvbmZpZyA9IHtcbiAgZG9tYWluTmFtZTogJ211bHRpbW9kYWwtc3RhZ2luZycsXG4gIGVudmlyb25tZW50OiAnc3RhZ2luZycsXG4gIFxuICBjb2xsZWN0aW9uQ29uZmlnOiB7XG4gICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCcsXG4gICAgZGVzY3JpcHRpb246ICdTdGFnaW5nIGVudmlyb25tZW50IGZvciBtdWx0aW1vZGFsIGVtYmVkZGluZyB2YWxpZGF0aW9uJyxcbiAgfSxcbiAgXG4gIG5ldHdvcmtDb25maWc6IHtcbiAgICB2cGNFbmFibGVkOiB0cnVlLFxuICAgIC8vIFZQQywgc3VibmV0cywgc2VjdXJpdHlHcm91cHPjga/lrp/ooYzmmYLjgavoqK3lrppcbiAgfSxcbiAgXG4gIHNlY3VyaXR5Q29uZmlnOiB7XG4gICAgZW5jcnlwdGlvbkF0UmVzdDogdHJ1ZSxcbiAgICBub2RlVG9Ob2RlRW5jcnlwdGlvbjogdHJ1ZSxcbiAgICBlbmZvcmNlSHR0cHM6IHRydWUsXG4gICAgZmluZUdyYWluZWRBY2Nlc3NDb250cm9sOiB0cnVlLFxuICB9LFxuICBcbiAgbW9uaXRvcmluZ0NvbmZpZzoge1xuICAgIGxvZ3NFbmFibGVkOiB0cnVlLFxuICAgIHNsb3dMb2dzRW5hYmxlZDogdHJ1ZSxcbiAgICBhcHBMb2dzRW5hYmxlZDogdHJ1ZSxcbiAgICBpbmRleFNsb3dMb2dzRW5hYmxlZDogdHJ1ZSxcbiAgfSxcbiAgXG4gIGJhY2t1cENvbmZpZzoge1xuICAgIGF1dG9tYXRlZFNuYXBzaG90U3RhcnRIb3VyOiAyLFxuICB9LFxuICBcbiAgdGFnczoge1xuICAgIENvc3RDZW50ZXI6ICdTdGFnaW5nJyxcbiAgICBQdXJwb3NlOiAnTXVsdGltb2RhbEVtYmVkZGluZ1Rlc3RpbmcnLFxuICAgIERhdGFDbGFzc2lmaWNhdGlvbjogJ0ludGVybmFsJyxcbiAgfSxcbn07XG5cbi8qKlxuICog5pys55Wq55Kw5aKD55So6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBwcm9kdWN0aW9uQ29uZmlnOiBPcGVuU2VhcmNoTXVsdGltb2RhbENvbmZpZyA9IHtcbiAgZG9tYWluTmFtZTogJ211bHRpbW9kYWwtcHJvZCcsXG4gIGVudmlyb25tZW50OiAncHJvZCcsXG4gIFxuICBjb2xsZWN0aW9uQ29uZmlnOiB7XG4gICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCcsXG4gICAgZGVzY3JpcHRpb246ICdQcm9kdWN0aW9uIGVudmlyb25tZW50IGZvciBtdWx0aW1vZGFsIGVtYmVkZGluZyBzZWFyY2gnLFxuICB9LFxuICBcbiAgbmV0d29ya0NvbmZpZzoge1xuICAgIHZwY0VuYWJsZWQ6IHRydWUsXG4gICAgLy8gVlBDLCBzdWJuZXRzLCBzZWN1cml0eUdyb3Vwc+OBr+Wun+ihjOaZguOBq+ioreWumlxuICB9LFxuICBcbiAgc2VjdXJpdHlDb25maWc6IHtcbiAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlLFxuICAgIG5vZGVUb05vZGVFbmNyeXB0aW9uOiB0cnVlLFxuICAgIGVuZm9yY2VIdHRwczogdHJ1ZSxcbiAgICBmaW5lR3JhaW5lZEFjY2Vzc0NvbnRyb2w6IHRydWUsXG4gIH0sXG4gIFxuICBtb25pdG9yaW5nQ29uZmlnOiB7XG4gICAgbG9nc0VuYWJsZWQ6IHRydWUsXG4gICAgc2xvd0xvZ3NFbmFibGVkOiB0cnVlLFxuICAgIGFwcExvZ3NFbmFibGVkOiB0cnVlLFxuICAgIGluZGV4U2xvd0xvZ3NFbmFibGVkOiB0cnVlLFxuICB9LFxuICBcbiAgYmFja3VwQ29uZmlnOiB7XG4gICAgYXV0b21hdGVkU25hcHNob3RTdGFydEhvdXI6IDEsXG4gIH0sXG4gIFxuICB0YWdzOiB7XG4gICAgQ29zdENlbnRlcjogJ1Byb2R1Y3Rpb24nLFxuICAgIFB1cnBvc2U6ICdNdWx0aW1vZGFsRW1iZWRkaW5nUHJvZHVjdGlvbicsXG4gICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnQ29uZmlkZW50aWFsJyxcbiAgICBCYWNrdXBSZXF1aXJlZDogJ3RydWUnLFxuICAgIE1vbml0b3JpbmdMZXZlbDogJ0VuaGFuY2VkJyxcbiAgfSxcbn07XG5cbi8qKlxuICog6auY5oCn6IO955Kw5aKD55So6Kit5a6a77yI5aSn6YeP44OH44O844K/5Yem55CG55So77yJXG4gKi9cbmV4cG9ydCBjb25zdCBoaWdoUGVyZm9ybWFuY2VDb25maWc6IE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uZmlnID0ge1xuICBkb21haW5OYW1lOiAnbXVsdGltb2RhbC1wZXJmJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgXG4gIGNvbGxlY3Rpb25Db25maWc6IHtcbiAgICB0eXBlOiAnVkVDVE9SU0VBUkNIJyxcbiAgICBkZXNjcmlwdGlvbjogJ0hpZ2gtcGVyZm9ybWFuY2UgZW52aXJvbm1lbnQgZm9yIGxhcmdlLXNjYWxlIG11bHRpbW9kYWwgZW1iZWRkaW5nIHByb2Nlc3NpbmcnLFxuICB9LFxuICBcbiAgbmV0d29ya0NvbmZpZzoge1xuICAgIHZwY0VuYWJsZWQ6IHRydWUsXG4gICAgLy8gVlBDLCBzdWJuZXRzLCBzZWN1cml0eUdyb3Vwc+OBr+Wun+ihjOaZguOBq+ioreWumlxuICB9LFxuICBcbiAgc2VjdXJpdHlDb25maWc6IHtcbiAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlLFxuICAgIG5vZGVUb05vZGVFbmNyeXB0aW9uOiB0cnVlLFxuICAgIGVuZm9yY2VIdHRwczogdHJ1ZSxcbiAgICBmaW5lR3JhaW5lZEFjY2Vzc0NvbnRyb2w6IHRydWUsXG4gIH0sXG4gIFxuICBtb25pdG9yaW5nQ29uZmlnOiB7XG4gICAgbG9nc0VuYWJsZWQ6IHRydWUsXG4gICAgc2xvd0xvZ3NFbmFibGVkOiB0cnVlLFxuICAgIGFwcExvZ3NFbmFibGVkOiB0cnVlLFxuICAgIGluZGV4U2xvd0xvZ3NFbmFibGVkOiB0cnVlLFxuICB9LFxuICBcbiAgYmFja3VwQ29uZmlnOiB7XG4gICAgYXV0b21hdGVkU25hcHNob3RTdGFydEhvdXI6IDAsXG4gIH0sXG4gIFxuICB0YWdzOiB7XG4gICAgQ29zdENlbnRlcjogJ1Byb2R1Y3Rpb24nLFxuICAgIFB1cnBvc2U6ICdNdWx0aW1vZGFsRW1iZWRkaW5nSGlnaFBlcmZvcm1hbmNlJyxcbiAgICBEYXRhQ2xhc3NpZmljYXRpb246ICdDb25maWRlbnRpYWwnLFxuICAgIEJhY2t1cFJlcXVpcmVkOiAndHJ1ZScsXG4gICAgTW9uaXRvcmluZ0xldmVsOiAnRW5oYW5jZWQnLFxuICAgIFBlcmZvcm1hbmNlVGllcjogJ0hpZ2gnLFxuICB9LFxufTtcblxuLyoqXG4gKiDnkrDlooPjgavlv5zjgZjjgZ/oqK3lrprlj5blvpdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uZmlnKFxuICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICBwZXJmb3JtYW5jZVRpZXI/OiAnc3RhbmRhcmQnIHwgJ2hpZ2gnXG4pOiBPcGVuU2VhcmNoTXVsdGltb2RhbENvbmZpZyB7XG4gIHN3aXRjaCAoZW52aXJvbm1lbnQudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2Rldic6XG4gICAgY2FzZSAnZGV2ZWxvcG1lbnQnOlxuICAgICAgcmV0dXJuIGRldmVsb3BtZW50Q29uZmlnO1xuICAgIFxuICAgIGNhc2UgJ3N0YWdpbmcnOlxuICAgIGNhc2UgJ3N0YWdlJzpcbiAgICAgIHJldHVybiBzdGFnaW5nQ29uZmlnO1xuICAgIFxuICAgIGNhc2UgJ3Byb2QnOlxuICAgIGNhc2UgJ3Byb2R1Y3Rpb24nOlxuICAgICAgaWYgKHBlcmZvcm1hbmNlVGllciA9PT0gJ2hpZ2gnKSB7XG4gICAgICAgIHJldHVybiBoaWdoUGVyZm9ybWFuY2VDb25maWc7XG4gICAgICB9XG4gICAgICByZXR1cm4gcHJvZHVjdGlvbkNvbmZpZztcbiAgICBcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGDmnKrlr77lv5zjga7nkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiDjgrPjgrnjg4jmnIDpganljJboqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IGNvc3RPcHRpbWl6ZWRDb25maWc6IFBhcnRpYWw8T3BlblNlYXJjaE11bHRpbW9kYWxDb25maWc+ID0ge1xuICBjb2xsZWN0aW9uQ29uZmlnOiB7XG4gICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCcsXG4gICAgZGVzY3JpcHRpb246ICdDb3N0LW9wdGltaXplZCBtdWx0aW1vZGFsIGVtYmVkZGluZyBjb2xsZWN0aW9uJyxcbiAgfSxcbiAgXG4gIG1vbml0b3JpbmdDb25maWc6IHtcbiAgICBsb2dzRW5hYmxlZDogZmFsc2UsXG4gICAgc2xvd0xvZ3NFbmFibGVkOiBmYWxzZSxcbiAgICBhcHBMb2dzRW5hYmxlZDogZmFsc2UsXG4gICAgaW5kZXhTbG93TG9nc0VuYWJsZWQ6IGZhbHNlLFxuICB9LFxufTtcblxuLyoqXG4gKiDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmnIDpganljJboqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IHBlcmZvcm1hbmNlT3B0aW1pemVkQ29uZmlnOiBQYXJ0aWFsPE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uZmlnPiA9IHtcbiAgY29sbGVjdGlvbkNvbmZpZzoge1xuICAgIHR5cGU6ICdWRUNUT1JTRUFSQ0gnLFxuICAgIGRlc2NyaXB0aW9uOiAnUGVyZm9ybWFuY2Utb3B0aW1pemVkIG11bHRpbW9kYWwgZW1iZWRkaW5nIGNvbGxlY3Rpb24nLFxuICB9LFxuICBcbiAgbW9uaXRvcmluZ0NvbmZpZzoge1xuICAgIGxvZ3NFbmFibGVkOiB0cnVlLFxuICAgIHNsb3dMb2dzRW5hYmxlZDogdHJ1ZSxcbiAgICBhcHBMb2dzRW5hYmxlZDogdHJ1ZSxcbiAgICBpbmRleFNsb3dMb2dzRW5hYmxlZDogdHJ1ZSxcbiAgfSxcbn07XG5cbi8qKlxuICog44K744Kt44Ol44Oq44OG44Kj5by35YyW6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBzZWN1cml0eUVuaGFuY2VkQ29uZmlnOiBQYXJ0aWFsPE9wZW5TZWFyY2hNdWx0aW1vZGFsQ29uZmlnPiA9IHtcbiAgc2VjdXJpdHlDb25maWc6IHtcbiAgICBlbmNyeXB0aW9uQXRSZXN0OiB0cnVlLFxuICAgIG5vZGVUb05vZGVFbmNyeXB0aW9uOiB0cnVlLFxuICAgIGVuZm9yY2VIdHRwczogdHJ1ZSxcbiAgICBmaW5lR3JhaW5lZEFjY2Vzc0NvbnRyb2w6IHRydWUsXG4gIH0sXG4gIFxuICBuZXR3b3JrQ29uZmlnOiB7XG4gICAgdnBjRW5hYmxlZDogdHJ1ZSxcbiAgICAvLyDlsILnlKhWUEPjgIHjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4jjgIHljrPmoLzjgarjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5dcbiAgfSxcbiAgXG4gIG1vbml0b3JpbmdDb25maWc6IHtcbiAgICBsb2dzRW5hYmxlZDogdHJ1ZSxcbiAgICBzbG93TG9nc0VuYWJsZWQ6IHRydWUsXG4gICAgYXBwTG9nc0VuYWJsZWQ6IHRydWUsXG4gICAgaW5kZXhTbG93TG9nc0VuYWJsZWQ6IHRydWUsXG4gIH0sXG59OyJdfQ==