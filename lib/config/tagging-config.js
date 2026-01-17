"use strict";
/**
 * AWS リソースタグ設定
 * コスト配布とリソース管理のための統一タグ戦略
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
exports.PermissionAwareRAGTags = exports.TaggingStrategy = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
/**
 * 統一されたタグ設定を生成
 */
class TaggingStrategy {
    /**
     * タグ設定の妥当性を検証
     */
    static validateConfig(config) {
        const errors = [];
        // プロジェクト名の検証（AWS タグ制限に準拠）
        if (!config.projectName || config.projectName.length > 128) {
            errors.push('プロジェクト名は1-128文字である必要があります');
        }
        // 環境名の検証
        const validEnvironments = ['dev', 'staging', 'prod'];
        if (!validEnvironments.includes(config.environment)) {
            errors.push(`環境名は ${validEnvironments.join(', ')} のいずれかである必要があります`);
        }
        // カスタムタグの検証
        if (config.customTags) {
            Object.entries(config.customTags).forEach(([key, value]) => {
                if (key.length > 128 || value.length > 256) {
                    errors.push(`タグ "${key}" のキーまたは値が長すぎます（キー: 最大128文字、値: 最大256文字）`);
                }
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * コスト配布タグを生成
     */
    static generateCostAllocationTags(config) {
        // 設定の妥当性を検証
        const validation = this.validateConfig(config);
        if (!validation.isValid) {
            throw new Error(`タグ設定が無効です: ${validation.errors.join(', ')}`);
        }
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
        return {
            // コスト配布の主要タグ
            cost: config.projectName,
            // 基本タグ
            Environment: config.environment,
            Project: config.projectName,
            Department: config.department || 'Engineering',
            Owner: config.owner || 'CDK-Deployment',
            CreatedDate: config.createdDate || currentDate,
            // 管理情報タグ
            'CDK-Application': 'Permission-aware-RAG-FSxN',
            'Management-Method': 'AWS-CDK',
        };
    }
    /**
     * CDKスタックにタグを適用
     */
    static applyTagsToStack(stack, config) {
        try {
            const tags = this.generateCostAllocationTags(config);
            let appliedTagsCount = 0;
            // 全てのタグをスタックに適用
            Object.entries(tags).forEach(([key, value]) => {
                if (value) {
                    cdk.Tags.of(stack).add(key, value);
                    appliedTagsCount++;
                }
            });
            // カスタムタグの適用
            if (config.customTags) {
                Object.entries(config.customTags).forEach(([key, value]) => {
                    cdk.Tags.of(stack).add(key, value);
                    appliedTagsCount++;
                });
            }
            // デバッグ情報をコンソールに出力（開発環境のみ）
            if (config.environment === 'dev') {
                console.log(`✅ スタック "${stack.stackName}" に ${appliedTagsCount} 個のタグを適用しました`);
            }
        }
        catch (error) {
            console.error(`❌ スタック "${stack.stackName}" へのタグ適用に失敗:`, error);
            throw error;
        }
    }
    /**
     * 特定のリソースにタグを適用
     */
    static applyTagsToResource(resource, config) {
        const tags = this.generateCostAllocationTags(config);
        Object.entries(tags).forEach(([key, value]) => {
            if (value) {
                cdk.Tags.of(resource).add(key, value);
            }
        });
    }
    /**
     * FSx for ONTAP専用タグを生成
     */
    static generateFSxTags(config) {
        const baseTags = this.generateCostAllocationTags(config);
        return {
            ...baseTags,
            'Service-Type': 'FSx-for-NetApp-ONTAP',
            'Use-Case': 'RAG-Document-Storage',
            'Performance-Tier': config.environment === 'prod' ? 'High' : 'Standard',
            'Backup-Required': 'true',
            'Encryption-Required': 'true',
        };
    }
    /**
     * AWS Batch専用タグを生成
     */
    static generateBatchTags(config) {
        const baseTags = this.generateCostAllocationTags(config);
        return {
            ...baseTags,
            'Service-Type': 'AWS-Batch',
            'Use-Case': 'Embedding-Processing',
            'Compute-Type': 'Batch-Jobs',
            'Auto-Scaling': 'true',
        };
    }
    /**
     * OpenSearch専用タグを生成
     */
    static generateOpenSearchTags(config) {
        const baseTags = this.generateCostAllocationTags(config);
        return {
            ...baseTags,
            'Service-Type': 'OpenSearch-Serverless',
            'Use-Case': 'Vector-Search',
            'Data-Type': 'Embeddings',
            'Search-Type': 'Semantic-Search',
        };
    }
    /**
     * Lambda専用タグを生成
     */
    static generateLambdaTags(config, functionPurpose) {
        const baseTags = this.generateCostAllocationTags(config);
        return {
            ...baseTags,
            'Service-Type': 'AWS-Lambda',
            'Function-Purpose': functionPurpose,
            'Runtime': 'nodejs20.x',
            'Architecture': 'x86_64',
        };
    }
    /**
     * コスト最適化用タグを生成
     */
    static generateCostOptimizationTags(config, resourceType) {
        const baseTags = this.generateCostAllocationTags(config);
        // リソースタイプ別のコスト最適化設定
        const optimizationSettings = {
            'FSx-for-NetApp-ONTAP': {
                'Cost-Optimization': 'Storage-Tiering',
                'Billing-Mode': 'Provisioned',
                'Review-Schedule': 'Monthly',
            },
            'AWS-Batch': {
                'Cost-Optimization': 'Spot-Instances',
                'Billing-Mode': 'On-Demand',
                'Review-Schedule': 'Weekly',
            },
            'OpenSearch-Serverless': {
                'Cost-Optimization': 'Auto-Scaling',
                'Billing-Mode': 'Serverless',
                'Review-Schedule': 'Daily',
            },
            'AWS-Lambda': {
                'Cost-Optimization': 'Memory-Optimization',
                'Billing-Mode': 'Pay-Per-Use',
                'Review-Schedule': 'Weekly',
            },
        };
        return {
            ...baseTags,
            'Service-Type': resourceType,
            ...optimizationSettings[resourceType] || {},
            'Cost-Review-Required': config.environment === 'prod' ? 'true' : 'false',
        };
    }
}
exports.TaggingStrategy = TaggingStrategy;
/**
 * プロジェクト固有のタグ設定
 */
class PermissionAwareRAGTags {
    /**
     * プロジェクト標準のタグ設定を取得
     */
    static getStandardConfig(projectName, environment) {
        return {
            projectName,
            environment,
            department: 'AI-Engineering',
            owner: 'RAG-Team',
            customTags: {
                'Application-Type': 'RAG-System',
                'Technology-Stack': 'CDK-TypeScript',
                'Data-Classification': 'Internal',
                'Compliance-Required': 'true',
            },
        };
    }
    /**
     * 環境別のタグ設定を取得
     */
    static getEnvironmentConfig(environment) {
        const configs = {
            dev: {
                customTags: {
                    'Cost-Center': 'Development',
                    'Auto-Shutdown': 'true',
                    'Monitoring-Level': 'Basic',
                },
            },
            staging: {
                customTags: {
                    'Cost-Center': 'Testing',
                    'Auto-Shutdown': 'false',
                    'Monitoring-Level': 'Enhanced',
                },
            },
            prod: {
                customTags: {
                    'Cost-Center': 'Production',
                    'Auto-Shutdown': 'false',
                    'Monitoring-Level': 'Full',
                    'Backup-Required': 'true',
                    'DR-Required': 'true',
                },
            },
        };
        return configs[environment] || configs.dev;
    }
    /**
     * セキュリティ要件に基づくタグ設定を取得
     */
    static getSecurityConfig(environment) {
        const securityConfigs = {
            dev: {
                customTags: {
                    'Security-Level': 'Basic',
                    'Data-Classification': 'Internal',
                    'Encryption-Required': 'false',
                    'Access-Review': 'Quarterly',
                },
            },
            staging: {
                customTags: {
                    'Security-Level': 'Enhanced',
                    'Data-Classification': 'Confidential',
                    'Encryption-Required': 'true',
                    'Access-Review': 'Monthly',
                },
            },
            prod: {
                customTags: {
                    'Security-Level': 'Maximum',
                    'Data-Classification': 'Restricted',
                    'Encryption-Required': 'true',
                    'Access-Review': 'Weekly',
                    'Compliance-Required': 'true',
                    'Audit-Required': 'true',
                },
            },
        };
        return securityConfigs[environment] || securityConfigs.dev;
    }
}
exports.PermissionAwareRAGTags = PermissionAwareRAGTags;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnZ2luZy1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0YWdnaW5nLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQXVEbkM7O0dBRUc7QUFDSCxNQUFhLGVBQWU7SUFDMUI7O09BRUc7SUFDSCxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQXFCO1FBQ3pDLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUU1QiwwQkFBMEI7UUFDMUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFLENBQUM7WUFDM0QsTUFBTSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFFRCxTQUFTO1FBQ1QsTUFBTSxpQkFBaUIsR0FBa0IsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBRUQsWUFBWTtRQUNaLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7Z0JBQ3pELElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQztvQkFDM0MsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcseUNBQXlDLENBQUMsQ0FBQztnQkFDbkUsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU87WUFDTCxPQUFPLEVBQUUsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQzVCLE1BQU07U0FDUCxDQUFDO0lBQ0osQ0FBQztJQUNEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLDBCQUEwQixDQUFDLE1BQXFCO1FBQ3JELFlBQVk7UUFDWixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNoRSxDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlO1FBRTNFLE9BQU87WUFDTCxhQUFhO1lBQ2IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxXQUFXO1lBRXhCLE9BQU87WUFDUCxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7WUFDL0IsT0FBTyxFQUFFLE1BQU0sQ0FBQyxXQUFXO1lBQzNCLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxJQUFJLGFBQWE7WUFDOUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLElBQUksZ0JBQWdCO1lBQ3ZDLFdBQVcsRUFBRSxNQUFNLENBQUMsV0FBVyxJQUFJLFdBQVc7WUFFOUMsU0FBUztZQUNULGlCQUFpQixFQUFFLDJCQUEyQjtZQUM5QyxtQkFBbUIsRUFBRSxTQUFTO1NBQy9CLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBZ0IsRUFBRSxNQUFxQjtRQUM3RCxJQUFJLENBQUM7WUFDSCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckQsSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7WUFFekIsZ0JBQWdCO1lBQ2hCLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtnQkFDNUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDVixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO29CQUNuQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNyQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxZQUFZO1lBQ1osSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3RCLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7b0JBQ3pELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQ25DLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3JCLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztZQUVELDBCQUEwQjtZQUMxQixJQUFJLE1BQU0sQ0FBQyxXQUFXLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ2pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxLQUFLLENBQUMsU0FBUyxPQUFPLGdCQUFnQixjQUFjLENBQUMsQ0FBQztZQUMvRSxDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsS0FBSyxDQUFDLFNBQVMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9ELE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxRQUFtQixFQUFFLE1BQXFCO1FBQ25FLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVyRCxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7WUFDNUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDVixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3hDLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBcUI7UUFDMUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXpELE9BQU87WUFDTCxHQUFHLFFBQVE7WUFDWCxjQUFjLEVBQUUsc0JBQXNCO1lBQ3RDLFVBQVUsRUFBRSxzQkFBc0I7WUFDbEMsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLFdBQVcsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVTtZQUN2RSxpQkFBaUIsRUFBRSxNQUFNO1lBQ3pCLHFCQUFxQixFQUFFLE1BQU07U0FDOUIsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxNQUFxQjtRQUM1QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFekQsT0FBTztZQUNMLEdBQUcsUUFBUTtZQUNYLGNBQWMsRUFBRSxXQUFXO1lBQzNCLFVBQVUsRUFBRSxzQkFBc0I7WUFDbEMsY0FBYyxFQUFFLFlBQVk7WUFDNUIsY0FBYyxFQUFFLE1BQU07U0FDdkIsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxNQUFxQjtRQUNqRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFekQsT0FBTztZQUNMLEdBQUcsUUFBUTtZQUNYLGNBQWMsRUFBRSx1QkFBdUI7WUFDdkMsVUFBVSxFQUFFLGVBQWU7WUFDM0IsV0FBVyxFQUFFLFlBQVk7WUFDekIsYUFBYSxFQUFFLGlCQUFpQjtTQUNqQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLGtCQUFrQixDQUFDLE1BQXFCLEVBQUUsZUFBdUI7UUFDdEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXpELE9BQU87WUFDTCxHQUFHLFFBQVE7WUFDWCxjQUFjLEVBQUUsWUFBWTtZQUM1QixrQkFBa0IsRUFBRSxlQUFlO1lBQ25DLFNBQVMsRUFBRSxZQUFZO1lBQ3ZCLGNBQWMsRUFBRSxRQUFRO1NBQ3pCLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsNEJBQTRCLENBQUMsTUFBcUIsRUFBRSxZQUF5QjtRQUNsRixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFekQsb0JBQW9CO1FBQ3BCLE1BQU0sb0JBQW9CLEdBQUc7WUFDM0Isc0JBQXNCLEVBQUU7Z0JBQ3RCLG1CQUFtQixFQUFFLGlCQUFpQjtnQkFDdEMsY0FBYyxFQUFFLGFBQWE7Z0JBQzdCLGlCQUFpQixFQUFFLFNBQVM7YUFDN0I7WUFDRCxXQUFXLEVBQUU7Z0JBQ1gsbUJBQW1CLEVBQUUsZ0JBQWdCO2dCQUNyQyxjQUFjLEVBQUUsV0FBVztnQkFDM0IsaUJBQWlCLEVBQUUsUUFBUTthQUM1QjtZQUNELHVCQUF1QixFQUFFO2dCQUN2QixtQkFBbUIsRUFBRSxjQUFjO2dCQUNuQyxjQUFjLEVBQUUsWUFBWTtnQkFDNUIsaUJBQWlCLEVBQUUsT0FBTzthQUMzQjtZQUNELFlBQVksRUFBRTtnQkFDWixtQkFBbUIsRUFBRSxxQkFBcUI7Z0JBQzFDLGNBQWMsRUFBRSxhQUFhO2dCQUM3QixpQkFBaUIsRUFBRSxRQUFRO2FBQzVCO1NBQ0YsQ0FBQztRQUVGLE9BQU87WUFDTCxHQUFHLFFBQVE7WUFDWCxjQUFjLEVBQUUsWUFBWTtZQUM1QixHQUFHLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUU7WUFDM0Msc0JBQXNCLEVBQUUsTUFBTSxDQUFDLFdBQVcsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTztTQUN6RSxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBOU1ELDBDQThNQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxzQkFBc0I7SUFDakM7O09BRUc7SUFDSCxNQUFNLENBQUMsaUJBQWlCLENBQUMsV0FBbUIsRUFBRSxXQUF3QjtRQUNwRSxPQUFPO1lBQ0wsV0FBVztZQUNYLFdBQVc7WUFDWCxVQUFVLEVBQUUsZ0JBQWdCO1lBQzVCLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFVBQVUsRUFBRTtnQkFDVixrQkFBa0IsRUFBRSxZQUFZO2dCQUNoQyxrQkFBa0IsRUFBRSxnQkFBZ0I7Z0JBQ3BDLHFCQUFxQixFQUFFLFVBQVU7Z0JBQ2pDLHFCQUFxQixFQUFFLE1BQU07YUFDOUI7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLG9CQUFvQixDQUFDLFdBQW1CO1FBQzdDLE1BQU0sT0FBTyxHQUFHO1lBQ2QsR0FBRyxFQUFFO2dCQUNILFVBQVUsRUFBRTtvQkFDVixhQUFhLEVBQUUsYUFBYTtvQkFDNUIsZUFBZSxFQUFFLE1BQU07b0JBQ3ZCLGtCQUFrQixFQUFFLE9BQU87aUJBQzVCO2FBQ0Y7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsVUFBVSxFQUFFO29CQUNWLGFBQWEsRUFBRSxTQUFTO29CQUN4QixlQUFlLEVBQUUsT0FBTztvQkFDeEIsa0JBQWtCLEVBQUUsVUFBVTtpQkFDL0I7YUFDRjtZQUNELElBQUksRUFBRTtnQkFDSixVQUFVLEVBQUU7b0JBQ1YsYUFBYSxFQUFFLFlBQVk7b0JBQzNCLGVBQWUsRUFBRSxPQUFPO29CQUN4QixrQkFBa0IsRUFBRSxNQUFNO29CQUMxQixpQkFBaUIsRUFBRSxNQUFNO29CQUN6QixhQUFhLEVBQUUsTUFBTTtpQkFDdEI7YUFDRjtTQUNGLENBQUM7UUFFRixPQUFPLE9BQU8sQ0FBQyxXQUFtQyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQztJQUNyRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsaUJBQWlCLENBQUMsV0FBd0I7UUFDL0MsTUFBTSxlQUFlLEdBQUc7WUFDdEIsR0FBRyxFQUFFO2dCQUNILFVBQVUsRUFBRTtvQkFDVixnQkFBZ0IsRUFBRSxPQUFPO29CQUN6QixxQkFBcUIsRUFBRSxVQUFVO29CQUNqQyxxQkFBcUIsRUFBRSxPQUFPO29CQUM5QixlQUFlLEVBQUUsV0FBVztpQkFDN0I7YUFDRjtZQUNELE9BQU8sRUFBRTtnQkFDUCxVQUFVLEVBQUU7b0JBQ1YsZ0JBQWdCLEVBQUUsVUFBVTtvQkFDNUIscUJBQXFCLEVBQUUsY0FBYztvQkFDckMscUJBQXFCLEVBQUUsTUFBTTtvQkFDN0IsZUFBZSxFQUFFLFNBQVM7aUJBQzNCO2FBQ0Y7WUFDRCxJQUFJLEVBQUU7Z0JBQ0osVUFBVSxFQUFFO29CQUNWLGdCQUFnQixFQUFFLFNBQVM7b0JBQzNCLHFCQUFxQixFQUFFLFlBQVk7b0JBQ25DLHFCQUFxQixFQUFFLE1BQU07b0JBQzdCLGVBQWUsRUFBRSxRQUFRO29CQUN6QixxQkFBcUIsRUFBRSxNQUFNO29CQUM3QixnQkFBZ0IsRUFBRSxNQUFNO2lCQUN6QjthQUNGO1NBQ0YsQ0FBQztRQUVGLE9BQU8sZUFBZSxDQUFDLFdBQVcsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUM7SUFDN0QsQ0FBQztDQUNGO0FBdkZELHdEQXVGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQVdTIOODquOCveODvOOCueOCv+OCsOioreWumlxuICog44Kz44K544OI6YWN5biD44Go44Oq44K944O844K5566h55CG44Gu44Gf44KB44Gu57Wx5LiA44K/44Kw5oim55WlXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vLyDnkrDlooPlkI3jga7lnovlrprnvqnjgpLov73liqBcbmV4cG9ydCB0eXBlIEVudmlyb25tZW50ID0gJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCc7XG5cbi8vIOOCteODvOODk+OCueOCv+OCpOODl+OBruWei+Wumue+qeOCkui/veWKoFxuZXhwb3J0IHR5cGUgU2VydmljZVR5cGUgPSAnRlN4LWZvci1OZXRBcHAtT05UQVAnIHwgJ0FXUy1CYXRjaCcgfCAnT3BlblNlYXJjaC1TZXJ2ZXJsZXNzJyB8ICdBV1MtTGFtYmRhJyB8ICdFQzInIHwgJ1MzJyB8ICdDbG91ZEZyb250JztcblxuZXhwb3J0IGludGVyZmFjZSBUYWdnaW5nQ29uZmlnIHtcbiAgLyoqIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iOOCs+OCueODiOmFjeW4g+OBruS4u+imgeOCreODvO+8iSAqL1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBcbiAgLyoqIOeSsOWig+WQjSAoZGV2LCBzdGFnaW5nLCBwcm9kKSAqL1xuICBlbnZpcm9ubWVudDogRW52aXJvbm1lbnQ7XG4gIFxuICAvKiog6YOo6ZaA44O744OB44O844Og5ZCNICovXG4gIGRlcGFydG1lbnQ/OiBzdHJpbmc7XG4gIFxuICAvKiog5omA5pyJ6ICFICovXG4gIG93bmVyPzogc3RyaW5nO1xuICBcbiAgLyoqIOS9nOaIkOaXpSAqL1xuICBjcmVhdGVkRGF0ZT86IHN0cmluZztcbiAgXG4gIC8qKiDov73liqDjga7jgqvjgrnjgr/jg6Djgr/jgrAgKi9cbiAgY3VzdG9tVGFncz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29zdEFsbG9jYXRpb25UYWdzIHtcbiAgLyoqIOOCs+OCueODiOmFjeW4g+OCv+OCsO+8iOW/hemgiO+8iSAqL1xuICBjb3N0OiBzdHJpbmc7XG4gIFxuICAvKiog55Kw5aKD44K/44KwICovXG4gIEVudmlyb25tZW50OiBzdHJpbmc7XG4gIFxuICAvKiog44OX44Ot44K444Kn44Kv44OI44K/44KwICovXG4gIFByb2plY3Q6IHN0cmluZztcbiAgXG4gIC8qKiDpg6jploDjgr/jgrAgKi9cbiAgRGVwYXJ0bWVudD86IHN0cmluZztcbiAgXG4gIC8qKiDmiYDmnInogIXjgr/jgrAgKi9cbiAgT3duZXI/OiBzdHJpbmc7XG4gIFxuICAvKiog5L2c5oiQ5pel44K/44KwICovXG4gIENyZWF0ZWREYXRlOiBzdHJpbmc7XG4gIFxuICAvKiogQ0RL44Ki44OX44Oq44Kx44O844K344On44Oz44K/44KwICovXG4gICdDREstQXBwbGljYXRpb24nOiBzdHJpbmc7XG4gIFxuICAvKiog566h55CG5pa55rOV44K/44KwICovXG4gICdNYW5hZ2VtZW50LU1ldGhvZCc6IHN0cmluZztcbn1cblxuLyoqXG4gKiDntbHkuIDjgZXjgozjgZ/jgr/jgrDoqK3lrprjgpLnlJ/miJBcbiAqL1xuZXhwb3J0IGNsYXNzIFRhZ2dpbmdTdHJhdGVneSB7XG4gIC8qKlxuICAgKiDjgr/jgrDoqK3lrprjga7lpqXlvZPmgKfjgpLmpJzoqLxcbiAgICovXG4gIHN0YXRpYyB2YWxpZGF0ZUNvbmZpZyhjb25maWc6IFRhZ2dpbmdDb25maWcpOiB7IGlzVmFsaWQ6IGJvb2xlYW47IGVycm9yczogc3RyaW5nW10gfSB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOODl+ODreOCuOOCp+OCr+ODiOWQjeOBruaknOiovO+8iEFXUyDjgr/jgrDliLbpmZDjgavmupbmi6DvvIlcbiAgICBpZiAoIWNvbmZpZy5wcm9qZWN0TmFtZSB8fCBjb25maWcucHJvamVjdE5hbWUubGVuZ3RoID4gMTI4KSB7XG4gICAgICBlcnJvcnMucHVzaCgn44OX44Ot44K444Kn44Kv44OI5ZCN44GvMS0xMjjmloflrZfjgafjgYLjgovlv4XopoHjgYzjgYLjgorjgb7jgZknKTtcbiAgICB9XG4gICAgXG4gICAgLy8g55Kw5aKD5ZCN44Gu5qSc6Ki8XG4gICAgY29uc3QgdmFsaWRFbnZpcm9ubWVudHM6IEVudmlyb25tZW50W10gPSBbJ2RldicsICdzdGFnaW5nJywgJ3Byb2QnXTtcbiAgICBpZiAoIXZhbGlkRW52aXJvbm1lbnRzLmluY2x1ZGVzKGNvbmZpZy5lbnZpcm9ubWVudCkpIHtcbiAgICAgIGVycm9ycy5wdXNoKGDnkrDlooPlkI3jga8gJHt2YWxpZEVudmlyb25tZW50cy5qb2luKCcsICcpfSDjga7jgYTjgZrjgozjgYvjgafjgYLjgovlv4XopoHjgYzjgYLjgorjgb7jgZlgKTtcbiAgICB9XG4gICAgXG4gICAgLy8g44Kr44K544K/44Og44K/44Kw44Gu5qSc6Ki8XG4gICAgaWYgKGNvbmZpZy5jdXN0b21UYWdzKSB7XG4gICAgICBPYmplY3QuZW50cmllcyhjb25maWcuY3VzdG9tVGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChrZXkubGVuZ3RoID4gMTI4IHx8IHZhbHVlLmxlbmd0aCA+IDI1Nikge1xuICAgICAgICAgIGVycm9ycy5wdXNoKGDjgr/jgrAgXCIke2tleX1cIiDjga7jgq3jg7zjgb7jgZ/jga/lgKTjgYzplbfjgZnjgY7jgb7jgZnvvIjjgq3jg7w6IOacgOWkpzEyOOaWh+Wtl+OAgeWApDog5pyA5aSnMjU25paH5a2X77yJYCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGVycm9yc1xuICAgIH07XG4gIH1cbiAgLyoqXG4gICAqIOOCs+OCueODiOmFjeW4g+OCv+OCsOOCkueUn+aIkFxuICAgKi9cbiAgc3RhdGljIGdlbmVyYXRlQ29zdEFsbG9jYXRpb25UYWdzKGNvbmZpZzogVGFnZ2luZ0NvbmZpZyk6IENvc3RBbGxvY2F0aW9uVGFncyB7XG4gICAgLy8g6Kit5a6a44Gu5aal5b2T5oCn44KS5qSc6Ki8XG4gICAgY29uc3QgdmFsaWRhdGlvbiA9IHRoaXMudmFsaWRhdGVDb25maWcoY29uZmlnKTtcbiAgICBpZiAoIXZhbGlkYXRpb24uaXNWYWxpZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDjgr/jgrDoqK3lrprjgYznhKHlirnjgafjgZk6ICR7dmFsaWRhdGlvbi5lcnJvcnMuam9pbignLCAnKX1gKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY3VycmVudERhdGUgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXTsgLy8gWVlZWS1NTS1EROW9ouW8j1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAvLyDjgrPjgrnjg4jphY3luIPjga7kuLvopoHjgr/jgrBcbiAgICAgIGNvc3Q6IGNvbmZpZy5wcm9qZWN0TmFtZSxcbiAgICAgIFxuICAgICAgLy8g5Z+65pys44K/44KwXG4gICAgICBFbnZpcm9ubWVudDogY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgUHJvamVjdDogY29uZmlnLnByb2plY3ROYW1lLFxuICAgICAgRGVwYXJ0bWVudDogY29uZmlnLmRlcGFydG1lbnQgfHwgJ0VuZ2luZWVyaW5nJyxcbiAgICAgIE93bmVyOiBjb25maWcub3duZXIgfHwgJ0NESy1EZXBsb3ltZW50JyxcbiAgICAgIENyZWF0ZWREYXRlOiBjb25maWcuY3JlYXRlZERhdGUgfHwgY3VycmVudERhdGUsXG4gICAgICBcbiAgICAgIC8vIOeuoeeQhuaDheWgseOCv+OCsFxuICAgICAgJ0NESy1BcHBsaWNhdGlvbic6ICdQZXJtaXNzaW9uLWF3YXJlLVJBRy1GU3hOJyxcbiAgICAgICdNYW5hZ2VtZW50LU1ldGhvZCc6ICdBV1MtQ0RLJyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICogQ0RL44K544K/44OD44Kv44Gr44K/44Kw44KS6YGp55SoXG4gICAqL1xuICBzdGF0aWMgYXBwbHlUYWdzVG9TdGFjayhzdGFjazogY2RrLlN0YWNrLCBjb25maWc6IFRhZ2dpbmdDb25maWcpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdGFncyA9IHRoaXMuZ2VuZXJhdGVDb3N0QWxsb2NhdGlvblRhZ3MoY29uZmlnKTtcbiAgICAgIGxldCBhcHBsaWVkVGFnc0NvdW50ID0gMDtcbiAgICAgIFxuICAgICAgLy8g5YWo44Gm44Gu44K/44Kw44KS44K544K/44OD44Kv44Gr6YGp55SoXG4gICAgICBPYmplY3QuZW50cmllcyh0YWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgY2RrLlRhZ3Mub2Yoc3RhY2spLmFkZChrZXksIHZhbHVlKTtcbiAgICAgICAgICBhcHBsaWVkVGFnc0NvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyDjgqvjgrnjgr/jg6Djgr/jgrDjga7pgannlKhcbiAgICAgIGlmIChjb25maWcuY3VzdG9tVGFncykge1xuICAgICAgICBPYmplY3QuZW50cmllcyhjb25maWcuY3VzdG9tVGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgY2RrLlRhZ3Mub2Yoc3RhY2spLmFkZChrZXksIHZhbHVlKTtcbiAgICAgICAgICBhcHBsaWVkVGFnc0NvdW50Kys7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDjg4fjg5Djg4PjgrDmg4XloLHjgpLjgrPjg7Pjgr3jg7zjg6vjgavlh7rlipvvvIjplovnmbrnkrDlooPjga7jgb/vvIlcbiAgICAgIGlmIChjb25maWcuZW52aXJvbm1lbnQgPT09ICdkZXYnKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDinIUg44K544K/44OD44KvIFwiJHtzdGFjay5zdGFja05hbWV9XCIg44GrICR7YXBwbGllZFRhZ3NDb3VudH0g5YCL44Gu44K/44Kw44KS6YGp55So44GX44G+44GX44GfYCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCDjgrnjgr/jg4Pjgq8gXCIke3N0YWNrLnN0YWNrTmFtZX1cIiDjgbjjga7jgr/jgrDpgannlKjjgavlpLHmlZc6YCwgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog54m55a6a44Gu44Oq44K944O844K544Gr44K/44Kw44KS6YGp55SoXG4gICAqL1xuICBzdGF0aWMgYXBwbHlUYWdzVG9SZXNvdXJjZShyZXNvdXJjZTogQ29uc3RydWN0LCBjb25maWc6IFRhZ2dpbmdDb25maWcpOiB2b2lkIHtcbiAgICBjb25zdCB0YWdzID0gdGhpcy5nZW5lcmF0ZUNvc3RBbGxvY2F0aW9uVGFncyhjb25maWcpO1xuICAgIFxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGNkay5UYWdzLm9mKHJlc291cmNlKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQ5bCC55So44K/44Kw44KS55Sf5oiQXG4gICAqL1xuICBzdGF0aWMgZ2VuZXJhdGVGU3hUYWdzKGNvbmZpZzogVGFnZ2luZ0NvbmZpZyk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICAgIGNvbnN0IGJhc2VUYWdzID0gdGhpcy5nZW5lcmF0ZUNvc3RBbGxvY2F0aW9uVGFncyhjb25maWcpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlVGFncyxcbiAgICAgICdTZXJ2aWNlLVR5cGUnOiAnRlN4LWZvci1OZXRBcHAtT05UQVAnLFxuICAgICAgJ1VzZS1DYXNlJzogJ1JBRy1Eb2N1bWVudC1TdG9yYWdlJyxcbiAgICAgICdQZXJmb3JtYW5jZS1UaWVyJzogY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyAnSGlnaCcgOiAnU3RhbmRhcmQnLFxuICAgICAgJ0JhY2t1cC1SZXF1aXJlZCc6ICd0cnVlJyxcbiAgICAgICdFbmNyeXB0aW9uLVJlcXVpcmVkJzogJ3RydWUnLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBBV1MgQmF0Y2jlsILnlKjjgr/jgrDjgpLnlJ/miJBcbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZUJhdGNoVGFncyhjb25maWc6IFRhZ2dpbmdDb25maWcpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgICBjb25zdCBiYXNlVGFncyA9IHRoaXMuZ2VuZXJhdGVDb3N0QWxsb2NhdGlvblRhZ3MoY29uZmlnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZVRhZ3MsXG4gICAgICAnU2VydmljZS1UeXBlJzogJ0FXUy1CYXRjaCcsXG4gICAgICAnVXNlLUNhc2UnOiAnRW1iZWRkaW5nLVByb2Nlc3NpbmcnLFxuICAgICAgJ0NvbXB1dGUtVHlwZSc6ICdCYXRjaC1Kb2JzJyxcbiAgICAgICdBdXRvLVNjYWxpbmcnOiAndHJ1ZScsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIE9wZW5TZWFyY2jlsILnlKjjgr/jgrDjgpLnlJ/miJBcbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZU9wZW5TZWFyY2hUYWdzKGNvbmZpZzogVGFnZ2luZ0NvbmZpZyk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICAgIGNvbnN0IGJhc2VUYWdzID0gdGhpcy5nZW5lcmF0ZUNvc3RBbGxvY2F0aW9uVGFncyhjb25maWcpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlVGFncyxcbiAgICAgICdTZXJ2aWNlLVR5cGUnOiAnT3BlblNlYXJjaC1TZXJ2ZXJsZXNzJyxcbiAgICAgICdVc2UtQ2FzZSc6ICdWZWN0b3ItU2VhcmNoJyxcbiAgICAgICdEYXRhLVR5cGUnOiAnRW1iZWRkaW5ncycsXG4gICAgICAnU2VhcmNoLVR5cGUnOiAnU2VtYW50aWMtU2VhcmNoJyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICogTGFtYmRh5bCC55So44K/44Kw44KS55Sf5oiQXG4gICAqL1xuICBzdGF0aWMgZ2VuZXJhdGVMYW1iZGFUYWdzKGNvbmZpZzogVGFnZ2luZ0NvbmZpZywgZnVuY3Rpb25QdXJwb3NlOiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgICBjb25zdCBiYXNlVGFncyA9IHRoaXMuZ2VuZXJhdGVDb3N0QWxsb2NhdGlvblRhZ3MoY29uZmlnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgLi4uYmFzZVRhZ3MsXG4gICAgICAnU2VydmljZS1UeXBlJzogJ0FXUy1MYW1iZGEnLFxuICAgICAgJ0Z1bmN0aW9uLVB1cnBvc2UnOiBmdW5jdGlvblB1cnBvc2UsXG4gICAgICAnUnVudGltZSc6ICdub2RlanMyMC54JyxcbiAgICAgICdBcmNoaXRlY3R1cmUnOiAneDg2XzY0JyxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog44Kz44K544OI5pyA6YGp5YyW55So44K/44Kw44KS55Sf5oiQXG4gICAqL1xuICBzdGF0aWMgZ2VuZXJhdGVDb3N0T3B0aW1pemF0aW9uVGFncyhjb25maWc6IFRhZ2dpbmdDb25maWcsIHJlc291cmNlVHlwZTogU2VydmljZVR5cGUpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgICBjb25zdCBiYXNlVGFncyA9IHRoaXMuZ2VuZXJhdGVDb3N0QWxsb2NhdGlvblRhZ3MoY29uZmlnKTtcbiAgICBcbiAgICAvLyDjg6rjgr3jg7zjgrnjgr/jgqTjg5fliKXjga7jgrPjgrnjg4jmnIDpganljJboqK3lrppcbiAgICBjb25zdCBvcHRpbWl6YXRpb25TZXR0aW5ncyA9IHtcbiAgICAgICdGU3gtZm9yLU5ldEFwcC1PTlRBUCc6IHtcbiAgICAgICAgJ0Nvc3QtT3B0aW1pemF0aW9uJzogJ1N0b3JhZ2UtVGllcmluZycsXG4gICAgICAgICdCaWxsaW5nLU1vZGUnOiAnUHJvdmlzaW9uZWQnLFxuICAgICAgICAnUmV2aWV3LVNjaGVkdWxlJzogJ01vbnRobHknLFxuICAgICAgfSxcbiAgICAgICdBV1MtQmF0Y2gnOiB7XG4gICAgICAgICdDb3N0LU9wdGltaXphdGlvbic6ICdTcG90LUluc3RhbmNlcycsXG4gICAgICAgICdCaWxsaW5nLU1vZGUnOiAnT24tRGVtYW5kJyxcbiAgICAgICAgJ1Jldmlldy1TY2hlZHVsZSc6ICdXZWVrbHknLFxuICAgICAgfSxcbiAgICAgICdPcGVuU2VhcmNoLVNlcnZlcmxlc3MnOiB7XG4gICAgICAgICdDb3N0LU9wdGltaXphdGlvbic6ICdBdXRvLVNjYWxpbmcnLFxuICAgICAgICAnQmlsbGluZy1Nb2RlJzogJ1NlcnZlcmxlc3MnLFxuICAgICAgICAnUmV2aWV3LVNjaGVkdWxlJzogJ0RhaWx5JyxcbiAgICAgIH0sXG4gICAgICAnQVdTLUxhbWJkYSc6IHtcbiAgICAgICAgJ0Nvc3QtT3B0aW1pemF0aW9uJzogJ01lbW9yeS1PcHRpbWl6YXRpb24nLFxuICAgICAgICAnQmlsbGluZy1Nb2RlJzogJ1BheS1QZXItVXNlJyxcbiAgICAgICAgJ1Jldmlldy1TY2hlZHVsZSc6ICdXZWVrbHknLFxuICAgICAgfSxcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAuLi5iYXNlVGFncyxcbiAgICAgICdTZXJ2aWNlLVR5cGUnOiByZXNvdXJjZVR5cGUsXG4gICAgICAuLi5vcHRpbWl6YXRpb25TZXR0aW5nc1tyZXNvdXJjZVR5cGVdIHx8IHt9LFxuICAgICAgJ0Nvc3QtUmV2aWV3LVJlcXVpcmVkJzogY29uZmlnLmVudmlyb25tZW50ID09PSAncHJvZCcgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiDjg5fjg63jgrjjgqfjgq/jg4jlm7rmnInjga7jgr/jgrDoqK3lrppcbiAqL1xuZXhwb3J0IGNsYXNzIFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3Mge1xuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5qiZ5rqW44Gu44K/44Kw6Kit5a6a44KS5Y+W5b6XXG4gICAqL1xuICBzdGF0aWMgZ2V0U3RhbmRhcmRDb25maWcocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50KTogVGFnZ2luZ0NvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2plY3ROYW1lLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICBkZXBhcnRtZW50OiAnQUktRW5naW5lZXJpbmcnLFxuICAgICAgb3duZXI6ICdSQUctVGVhbScsXG4gICAgICBjdXN0b21UYWdzOiB7XG4gICAgICAgICdBcHBsaWNhdGlvbi1UeXBlJzogJ1JBRy1TeXN0ZW0nLFxuICAgICAgICAnVGVjaG5vbG9neS1TdGFjayc6ICdDREstVHlwZVNjcmlwdCcsXG4gICAgICAgICdEYXRhLUNsYXNzaWZpY2F0aW9uJzogJ0ludGVybmFsJyxcbiAgICAgICAgJ0NvbXBsaWFuY2UtUmVxdWlyZWQnOiAndHJ1ZScsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnkrDlooPliKXjga7jgr/jgrDoqK3lrprjgpLlj5blvpdcbiAgICovXG4gIHN0YXRpYyBnZXRFbnZpcm9ubWVudENvbmZpZyhlbnZpcm9ubWVudDogc3RyaW5nKTogUGFydGlhbDxUYWdnaW5nQ29uZmlnPiB7XG4gICAgY29uc3QgY29uZmlncyA9IHtcbiAgICAgIGRldjoge1xuICAgICAgICBjdXN0b21UYWdzOiB7XG4gICAgICAgICAgJ0Nvc3QtQ2VudGVyJzogJ0RldmVsb3BtZW50JyxcbiAgICAgICAgICAnQXV0by1TaHV0ZG93bic6ICd0cnVlJyxcbiAgICAgICAgICAnTW9uaXRvcmluZy1MZXZlbCc6ICdCYXNpYycsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RhZ2luZzoge1xuICAgICAgICBjdXN0b21UYWdzOiB7XG4gICAgICAgICAgJ0Nvc3QtQ2VudGVyJzogJ1Rlc3RpbmcnLFxuICAgICAgICAgICdBdXRvLVNodXRkb3duJzogJ2ZhbHNlJyxcbiAgICAgICAgICAnTW9uaXRvcmluZy1MZXZlbCc6ICdFbmhhbmNlZCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcHJvZDoge1xuICAgICAgICBjdXN0b21UYWdzOiB7XG4gICAgICAgICAgJ0Nvc3QtQ2VudGVyJzogJ1Byb2R1Y3Rpb24nLFxuICAgICAgICAgICdBdXRvLVNodXRkb3duJzogJ2ZhbHNlJyxcbiAgICAgICAgICAnTW9uaXRvcmluZy1MZXZlbCc6ICdGdWxsJyxcbiAgICAgICAgICAnQmFja3VwLVJlcXVpcmVkJzogJ3RydWUnLFxuICAgICAgICAgICdEUi1SZXF1aXJlZCc6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gY29uZmlnc1tlbnZpcm9ubWVudCBhcyBrZXlvZiB0eXBlb2YgY29uZmlnc10gfHwgY29uZmlncy5kZXY7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPopoHku7bjgavln7rjgaXjgY/jgr/jgrDoqK3lrprjgpLlj5blvpdcbiAgICovXG4gIHN0YXRpYyBnZXRTZWN1cml0eUNvbmZpZyhlbnZpcm9ubWVudDogRW52aXJvbm1lbnQpOiBQYXJ0aWFsPFRhZ2dpbmdDb25maWc+IHtcbiAgICBjb25zdCBzZWN1cml0eUNvbmZpZ3MgPSB7XG4gICAgICBkZXY6IHtcbiAgICAgICAgY3VzdG9tVGFnczoge1xuICAgICAgICAgICdTZWN1cml0eS1MZXZlbCc6ICdCYXNpYycsXG4gICAgICAgICAgJ0RhdGEtQ2xhc3NpZmljYXRpb24nOiAnSW50ZXJuYWwnLFxuICAgICAgICAgICdFbmNyeXB0aW9uLVJlcXVpcmVkJzogJ2ZhbHNlJyxcbiAgICAgICAgICAnQWNjZXNzLVJldmlldyc6ICdRdWFydGVybHknLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0YWdpbmc6IHtcbiAgICAgICAgY3VzdG9tVGFnczoge1xuICAgICAgICAgICdTZWN1cml0eS1MZXZlbCc6ICdFbmhhbmNlZCcsXG4gICAgICAgICAgJ0RhdGEtQ2xhc3NpZmljYXRpb24nOiAnQ29uZmlkZW50aWFsJyxcbiAgICAgICAgICAnRW5jcnlwdGlvbi1SZXF1aXJlZCc6ICd0cnVlJyxcbiAgICAgICAgICAnQWNjZXNzLVJldmlldyc6ICdNb250aGx5JyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwcm9kOiB7XG4gICAgICAgIGN1c3RvbVRhZ3M6IHtcbiAgICAgICAgICAnU2VjdXJpdHktTGV2ZWwnOiAnTWF4aW11bScsXG4gICAgICAgICAgJ0RhdGEtQ2xhc3NpZmljYXRpb24nOiAnUmVzdHJpY3RlZCcsXG4gICAgICAgICAgJ0VuY3J5cHRpb24tUmVxdWlyZWQnOiAndHJ1ZScsXG4gICAgICAgICAgJ0FjY2Vzcy1SZXZpZXcnOiAnV2Vla2x5JyxcbiAgICAgICAgICAnQ29tcGxpYW5jZS1SZXF1aXJlZCc6ICd0cnVlJyxcbiAgICAgICAgICAnQXVkaXQtUmVxdWlyZWQnOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHNlY3VyaXR5Q29uZmlnc1tlbnZpcm9ubWVudF0gfHwgc2VjdXJpdHlDb25maWdzLmRldjtcbiAgfVxufSJdfQ==