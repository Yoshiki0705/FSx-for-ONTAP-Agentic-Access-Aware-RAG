"use strict";
/**
 * Amazon Bedrock AgentCore Policy Construct
 *
 * このConstructは、Bedrock Agentのポリシー管理機能を提供します。
 * 自然言語ポリシー、Cedar統合、形式的検証、競合検出を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
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
exports.BedrockAgentCorePolicyConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const constructs_1 = require("constructs");
/**
 * Amazon Bedrock AgentCore Policy Construct
 *
 * Bedrock Agentのポリシー管理機能を提供するConstruct。
 *
 * 主な機能:
 * - 自然言語ポリシー作成
 * - Cedar統合による形式的検証
 * - ポリシー競合検出
 * - ポリシー管理API
 * - 監査ログ
 *
 * 使用例:
 * ```typescript
 * const policy = new BedrockAgentCorePolicyConstruct(this, 'Policy', {
 *   enabled: true,
 *   projectName: 'my-project',
 *   environment: 'production',
 *   naturalLanguagePolicyConfig: {
 *     enabled: true,
 *     autoConversion: true,
 *   },
 *   cedarIntegrationConfig: {
 *     enabled: true,
 *     formalVerification: true,
 *     conflictDetection: true,
 *   },
 *   policyManagementConfig: {
 *     enabled: true,
 *     versionControl: true,
 *     auditLogging: true,
 *   },
 * });
 * ```
 */
class BedrockAgentCorePolicyConstruct extends constructs_1.Construct {
    /**
     * ポリシー保存用S3バケット
     */
    policyBucket;
    /**
     * ポリシーメタデータ保存用DynamoDBテーブル
     */
    policyTable;
    /**
     * 監査ログ保存用DynamoDBテーブル
     */
    auditLogTable;
    /**
     * ログループ
     */
    logGroup;
    /**
     * ポリシー管理Lambda関数
     */
    policyFunction;
    constructor(scope, id, props) {
        super(scope, id);
        // 無効化されている場合はダミーリソースのみ作成
        if (!props.enabled) {
            this.logGroup = new logs.LogGroup(this, 'DummyLogGroup', {
                logGroupName: `/aws/bedrock/agent-core/${props.projectName}/${props.environment}/policy-disabled`,
                retention: logs.RetentionDays.ONE_DAY,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            // ダミーバケット
            this.policyBucket = new s3.Bucket(this, 'DummyBucket', {
                bucketName: `${props.projectName}-${props.environment}-policy-disabled-${cdk.Aws.ACCOUNT_ID}`,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
            });
            // ダミーテーブル
            this.policyTable = new dynamodb.Table(this, 'DummyTable', {
                tableName: `${props.projectName}-${props.environment}-policy-disabled`,
                partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            return;
        }
        // S3バケット作成（ポリシー保存用）
        this.policyBucket = new s3.Bucket(this, 'PolicyBucket', {
            bucketName: `${props.projectName}-${props.environment}-policy-${cdk.Aws.ACCOUNT_ID}`,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            lifecycleRules: [
                {
                    id: 'DeleteOldPolicies',
                    enabled: true,
                    noncurrentVersionExpiration: cdk.Duration.days(props.policyRetentionDays || 365),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });
        // DynamoDBテーブル作成（ポリシーメタデータ保存用）
        this.policyTable = new dynamodb.Table(this, 'PolicyTable', {
            tableName: `${props.projectName}-${props.environment}-policy`,
            partitionKey: { name: 'policyId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl',
        });
        // GSI: ポリシータイプ別検索用
        this.policyTable.addGlobalSecondaryIndex({
            indexName: 'PolicyTypeIndex',
            partitionKey: { name: 'policyType', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.NUMBER },
        });
        // GSI: ステータス別検索用
        this.policyTable.addGlobalSecondaryIndex({
            indexName: 'StatusIndex',
            partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.NUMBER },
        });
        // 監査ログテーブル作成（監査ログ有効時）
        if (props.policyManagementConfig?.auditLogging) {
            this.auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
                tableName: `${props.projectName}-${props.environment}-policy-audit`,
                partitionKey: { name: 'auditId', type: dynamodb.AttributeType.STRING },
                sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
                billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                pointInTimeRecovery: true,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
                timeToLiveAttribute: 'ttl',
            });
            // GSI: ポリシーID別検索用
            this.auditLogTable.addGlobalSecondaryIndex({
                indexName: 'PolicyIdIndex',
                partitionKey: { name: 'policyId', type: dynamodb.AttributeType.STRING },
                sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
            });
            // GSI: アクション別検索用
            this.auditLogTable.addGlobalSecondaryIndex({
                indexName: 'ActionIndex',
                partitionKey: { name: 'action', type: dynamodb.AttributeType.STRING },
                sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
            });
        }
        // CloudWatch Logsログループ作成
        this.logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/bedrock/agent-core/${props.projectName}/${props.environment}/policy`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // タグ付け
        if (props.tags) {
            Object.entries(props.tags).forEach(([key, value]) => {
                cdk.Tags.of(this.policyBucket).add(key, value);
                cdk.Tags.of(this.policyTable).add(key, value);
                if (this.auditLogTable) {
                    cdk.Tags.of(this.auditLogTable).add(key, value);
                }
            });
        }
        // デフォルトタグ
        cdk.Tags.of(this.policyBucket).add('Component', 'Policy');
        cdk.Tags.of(this.policyTable).add('Component', 'Policy');
        if (this.auditLogTable) {
            cdk.Tags.of(this.auditLogTable).add('Component', 'Policy');
        }
    }
    /**
     * Lambda関数にポリシーバケットへのアクセス権限を付与
     */
    grantPolicyBucketAccess(grantee) {
        return this.policyBucket.grantReadWrite(grantee);
    }
    /**
     * Lambda関数にポリシーテーブルへのアクセス権限を付与
     */
    grantPolicyTableAccess(grantee) {
        return this.policyTable.grantReadWriteData(grantee);
    }
    /**
     * Lambda関数に監査ログテーブルへのアクセス権限を付与
     */
    grantAuditLogTableAccess(grantee) {
        if (this.auditLogTable) {
            return this.auditLogTable.grantReadWriteData(grantee);
        }
        return undefined;
    }
}
exports.BedrockAgentCorePolicyConstruct = BedrockAgentCorePolicyConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLXBvbGljeS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZWRyb2NrLWFnZW50LWNvcmUtcG9saWN5LWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFHckQsMkRBQTZDO0FBQzdDLHVEQUF5QztBQUN6QywyQ0FBdUM7QUE4SXZDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0NHO0FBQ0gsTUFBYSwrQkFBZ0MsU0FBUSxzQkFBUztJQUM1RDs7T0FFRztJQUNhLFlBQVksQ0FBWTtJQUV4Qzs7T0FFRztJQUNhLFdBQVcsQ0FBaUI7SUFFNUM7O09BRUc7SUFDYSxhQUFhLENBQWtCO0lBRS9DOztPQUVHO0lBQ2EsUUFBUSxDQUFnQjtJQUV4Qzs7T0FFRztJQUNhLGNBQWMsQ0FBbUI7SUFFakQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQztRQUNuRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHlCQUF5QjtRQUN6QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7Z0JBQ3ZELFlBQVksRUFBRSwyQkFBMkIsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxrQkFBa0I7Z0JBQ2pHLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU87Z0JBQ3JDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87YUFDekMsQ0FBQyxDQUFDO1lBRUgsVUFBVTtZQUNWLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7Z0JBQ3JELFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsb0JBQW9CLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFO2dCQUM3RixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO2dCQUN4QyxpQkFBaUIsRUFBRSxJQUFJO2FBQ3hCLENBQUMsQ0FBQztZQUVILFVBQVU7WUFDVixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO2dCQUN4RCxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLGtCQUFrQjtnQkFDdEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7Z0JBQ2pFLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87YUFDekMsQ0FBQyxDQUFDO1lBRUgsT0FBTztRQUNULENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0RCxVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDcEYsU0FBUyxFQUFFLElBQUk7WUFDZixVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsY0FBYyxFQUFFO2dCQUNkO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLE9BQU8sRUFBRSxJQUFJO29CQUNiLDJCQUEyQixFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsSUFBSSxHQUFHLENBQUM7aUJBQ2pGO2FBQ0Y7WUFDRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLGlCQUFpQixFQUFFLEtBQUs7U0FDekIsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDekQsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxTQUFTO1lBQzdELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3ZFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1lBQ3ZDLG1CQUFtQixFQUFFLEtBQUs7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxXQUFXLENBQUMsdUJBQXVCLENBQUM7WUFDdkMsU0FBUyxFQUFFLGlCQUFpQjtZQUM1QixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN6RSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtTQUNwRSxDQUFDLENBQUM7UUFFSCxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLFdBQVcsQ0FBQyx1QkFBdUIsQ0FBQztZQUN2QyxTQUFTLEVBQUUsYUFBYTtZQUN4QixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtTQUNwRSxDQUFDLENBQUM7UUFFSCxzQkFBc0I7UUFDdEIsSUFBSSxLQUFLLENBQUMsc0JBQXNCLEVBQUUsWUFBWSxFQUFFLENBQUM7WUFDL0MsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtnQkFDN0QsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxlQUFlO2dCQUNuRSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtnQkFDdEUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7Z0JBQ25FLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7Z0JBQ2pELG1CQUFtQixFQUFFLElBQUk7Z0JBQ3pCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQ3ZDLG1CQUFtQixFQUFFLEtBQUs7YUFDM0IsQ0FBQyxDQUFDO1lBRUgsa0JBQWtCO1lBQ2xCLElBQUksQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUM7Z0JBQ3pDLFNBQVMsRUFBRSxlQUFlO2dCQUMxQixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtnQkFDdkUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7YUFDcEUsQ0FBQyxDQUFDO1lBRUgsaUJBQWlCO1lBQ2pCLElBQUksQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUM7Z0JBQ3pDLFNBQVMsRUFBRSxhQUFhO2dCQUN4QixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtnQkFDckUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7YUFDcEUsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELHlCQUF5QjtRQUN6QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ2xELFlBQVksRUFBRSwyQkFBMkIsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxTQUFTO1lBQ3hGLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVM7WUFDdkMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDZixNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO2dCQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDL0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzlDLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUN2QixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDbEQsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELFVBQVU7UUFDVixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN6RCxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN2QixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM3RCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ksdUJBQXVCLENBQUMsT0FBdUI7UUFDcEQsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxzQkFBc0IsQ0FBQyxPQUF1QjtRQUNuRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksd0JBQXdCLENBQUMsT0FBdUI7UUFDckQsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDdkIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0NBQ0Y7QUEzS0QsMEVBMktDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgUG9saWN5IENvbnN0cnVjdFxuICogXG4gKiDjgZPjga5Db25zdHJ1Y3Tjga/jgIFCZWRyb2NrIEFnZW5044Gu44Od44Oq44K344O8566h55CG5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKiDoh6rnhLboqIDoqp7jg53jg6rjgrfjg7zjgIFDZWRhcue1seWQiOOAgeW9ouW8j+eahOaknOiovOOAgeertuWQiOaknOWHuuOCkue1seWQiOOBl+OBvuOBmeOAglxuICogXG4gKiBAYXV0aG9yIEtpcm8gQUlcbiAqIEBkYXRlIDIwMjYtMDEtMDRcbiAqIEB2ZXJzaW9uIDEuMC4wXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLyoqXG4gKiDoh6rnhLboqIDoqp7jg53jg6rjgrfjg7zoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBOYXR1cmFsTGFuZ3VhZ2VQb2xpY3lDb25maWcge1xuICAvKipcbiAgICog6Ieq54S26KiA6Kqe44Od44Oq44K344O844KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODkeODvOOCteODvOODouODh+ODq1xuICAgKiBAZGVmYXVsdCAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJ1xuICAgKi9cbiAgcmVhZG9ubHkgcGFyc2VyTW9kZWw/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOiHquWLlUNlZGFy5aSJ5o+b44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGF1dG9Db252ZXJzaW9uPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44Od44Oq44K344O844OG44Oz44OX44Os44O844OI44KS5L2/55SoXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IHVzZVRlbXBsYXRlcz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQ2VkYXLntbHlkIjoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDZWRhckludGVncmF0aW9uQ29uZmlnIHtcbiAgLyoqXG4gICAqIENlZGFy57Wx5ZCI44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOW9ouW8j+eahOaknOiovOOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBmb3JtYWxWZXJpZmljYXRpb24/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDnq7blkIjmpJzlh7rjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgY29uZmxpY3REZXRlY3Rpb24/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg53jg6rjgrfjg7zmnIDpganljJbjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHJlYWRvbmx5IHBvbGljeU9wdGltaXphdGlvbj86IGJvb2xlYW47XG59XG5cbi8qKlxuICog44Od44Oq44K344O8566h55CG6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUG9saWN5TWFuYWdlbWVudENvbmZpZyB7XG4gIC8qKlxuICAgKiDjg53jg6rjgrfjg7znrqHnkIbjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OQ44O844K444On44Oz566h55CG44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IHZlcnNpb25Db250cm9sPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog55uj5p+744Ot44Kw44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGF1ZGl0TG9nZ2luZz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODneODquOCt+ODvOaJv+iqjeODr+ODvOOCr+ODleODreODvOOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgYXBwcm92YWxXb3JrZmxvdz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODneODquOCt+ODvOODrOODk+ODpeODvOacn+mWk++8iOaXpeaVsO+8iVxuICAgKiBAZGVmYXVsdCA5MFxuICAgKi9cbiAgcmVhZG9ubHkgcmV2aWV3UGVyaW9kRGF5cz86IG51bWJlcjtcbn1cblxuLyoqXG4gKiBCZWRyb2NrQWdlbnRDb3JlUG9saWN5Q29uc3RydWN044Gu44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZVBvbGljeUNvbnN0cnVjdFByb3BzIHtcbiAgLyoqXG4gICAqIFBvbGljeeapn+iDveOCkuacieWKueWMluOBmeOCi+OBi+OBqeOBhuOBi1xuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIhkZXYsIHN0YWdpbmcsIHByb2TnrYnvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOiHqueEtuiogOiqnuODneODquOCt+ODvOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgbmF0dXJhbExhbmd1YWdlUG9saWN5Q29uZmlnPzogTmF0dXJhbExhbmd1YWdlUG9saWN5Q29uZmlnO1xuXG4gIC8qKlxuICAgKiBDZWRhcue1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgY2VkYXJJbnRlZ3JhdGlvbkNvbmZpZz86IENlZGFySW50ZWdyYXRpb25Db25maWc7XG5cbiAgLyoqXG4gICAqIOODneODquOCt+ODvOeuoeeQhuioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgcG9saWN5TWFuYWdlbWVudENvbmZpZz86IFBvbGljeU1hbmFnZW1lbnRDb25maWc7XG5cbiAgLyoqXG4gICAqIOODneODquOCt+ODvOOBruS/neaMgeacn+mWk++8iOaXpeaVsO+8iVxuICAgKiBAZGVmYXVsdCAzNjVcbiAgICovXG4gIHJlYWRvbmx5IHBvbGljeVJldGVudGlvbkRheXM/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIOOCv+OCsFxuICAgKi9cbiAgcmVhZG9ubHkgdGFncz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIFBvbGljeSBDb25zdHJ1Y3RcbiAqIFxuICogQmVkcm9jayBBZ2VudOOBruODneODquOCt+ODvOeuoeeQhuapn+iDveOCkuaPkOS+m+OBmeOCi0NvbnN0cnVjdOOAglxuICogXG4gKiDkuLvjgarmqZ/og706XG4gKiAtIOiHqueEtuiogOiqnuODneODquOCt+ODvOS9nOaIkFxuICogLSBDZWRhcue1seWQiOOBq+OCiOOCi+W9ouW8j+eahOaknOiovFxuICogLSDjg53jg6rjgrfjg7znq7blkIjmpJzlh7pcbiAqIC0g44Od44Oq44K344O8566h55CGQVBJXG4gKiAtIOebo+afu+ODreOCsFxuICogXG4gKiDkvb/nlKjkvos6XG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBwb2xpY3kgPSBuZXcgQmVkcm9ja0FnZW50Q29yZVBvbGljeUNvbnN0cnVjdCh0aGlzLCAnUG9saWN5Jywge1xuICogICBlbmFibGVkOiB0cnVlLFxuICogICBwcm9qZWN0TmFtZTogJ215LXByb2plY3QnLFxuICogICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICogICBuYXR1cmFsTGFuZ3VhZ2VQb2xpY3lDb25maWc6IHtcbiAqICAgICBlbmFibGVkOiB0cnVlLFxuICogICAgIGF1dG9Db252ZXJzaW9uOiB0cnVlLFxuICogICB9LFxuICogICBjZWRhckludGVncmF0aW9uQ29uZmlnOiB7XG4gKiAgICAgZW5hYmxlZDogdHJ1ZSxcbiAqICAgICBmb3JtYWxWZXJpZmljYXRpb246IHRydWUsXG4gKiAgICAgY29uZmxpY3REZXRlY3Rpb246IHRydWUsXG4gKiAgIH0sXG4gKiAgIHBvbGljeU1hbmFnZW1lbnRDb25maWc6IHtcbiAqICAgICBlbmFibGVkOiB0cnVlLFxuICogICAgIHZlcnNpb25Db250cm9sOiB0cnVlLFxuICogICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZSxcbiAqICAgfSxcbiAqIH0pO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRDb3JlUG9saWN5Q29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqXG4gICAqIOODneODquOCt+ODvOS/neWtmOeUqFMz44OQ44Kx44OD44OIXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcG9saWN5QnVja2V0OiBzMy5CdWNrZXQ7XG5cbiAgLyoqXG4gICAqIOODneODquOCt+ODvOODoeOCv+ODh+ODvOOCv+S/neWtmOeUqER5bmFtb0RC44OG44O844OW44OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcG9saWN5VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIC8qKlxuICAgKiDnm6Pmn7vjg63jgrDkv53lrZjnlKhEeW5hbW9EQuODhuODvOODluODq1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGF1ZGl0TG9nVGFibGU/OiBkeW5hbW9kYi5UYWJsZTtcblxuICAvKipcbiAgICog44Ot44Kw44Or44O844OXXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXA7XG5cbiAgLyoqXG4gICAqIOODneODquOCt+ODvOeuoeeQhkxhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHBvbGljeUZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlUG9saWN5Q29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8g54Sh5Yq55YyW44GV44KM44Gm44GE44KL5aC05ZCI44Gv44OA44Of44O844Oq44K944O844K544Gu44G/5L2c5oiQXG4gICAgaWYgKCFwcm9wcy5lbmFibGVkKSB7XG4gICAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0R1bW15TG9nR3JvdXAnLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYmVkcm9jay9hZ2VudC1jb3JlLyR7cHJvcHMucHJvamVjdE5hbWV9LyR7cHJvcHMuZW52aXJvbm1lbnR9L3BvbGljeS1kaXNhYmxlZGAsXG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgLy8g44OA44Of44O844OQ44Kx44OD44OIXG4gICAgICB0aGlzLnBvbGljeUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0R1bW15QnVja2V0Jywge1xuICAgICAgICBidWNrZXROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tcG9saWN5LWRpc2FibGVkLSR7Y2RrLkF3cy5BQ0NPVU5UX0lEfWAsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOODgOODn+ODvOODhuODvOODluODq1xuICAgICAgdGhpcy5wb2xpY3lUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRHVtbXlUYWJsZScsIHtcbiAgICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tcG9saWN5LWRpc2FibGVkYCxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFMz44OQ44Kx44OD44OI5L2c5oiQ77yI44Od44Oq44K344O85L+d5a2Y55So77yJXG4gICAgdGhpcy5wb2xpY3lCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdQb2xpY3lCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tcG9saWN5LSR7Y2RrLkF3cy5BQ0NPVU5UX0lEfWAsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRQb2xpY2llcycsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKHByb3BzLnBvbGljeVJldGVudGlvbkRheXMgfHwgMzY1KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQuODhuODvOODluODq+S9nOaIkO+8iOODneODquOCt+ODvOODoeOCv+ODh+ODvOOCv+S/neWtmOeUqO+8iVxuICAgIHRoaXMucG9saWN5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1BvbGljeVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tcG9saWN5YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncG9saWN5SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndmVyc2lvbicsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgIH0pO1xuXG4gICAgLy8gR1NJOiDjg53jg6rjgrfjg7zjgr/jgqTjg5fliKXmpJzntKLnlKhcbiAgICB0aGlzLnBvbGljeVRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1BvbGljeVR5cGVJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BvbGljeVR5cGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZEF0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICB9KTtcblxuICAgIC8vIEdTSTog44K544OG44O844K/44K55Yil5qSc57Si55SoXG4gICAgdGhpcy5wb2xpY3lUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0YXR1cycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd1cGRhdGVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgIH0pO1xuXG4gICAgLy8g55uj5p+744Ot44Kw44OG44O844OW44Or5L2c5oiQ77yI55uj5p+744Ot44Kw5pyJ5Yq55pmC77yJXG4gICAgaWYgKHByb3BzLnBvbGljeU1hbmFnZW1lbnRDb25maWc/LmF1ZGl0TG9nZ2luZykge1xuICAgICAgdGhpcy5hdWRpdExvZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBdWRpdExvZ1RhYmxlJywge1xuICAgICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1wb2xpY3ktYXVkaXRgLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2F1ZGl0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEdTSTog44Od44Oq44K344O8SUTliKXmpJzntKLnlKhcbiAgICAgIHRoaXMuYXVkaXRMb2dUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICAgIGluZGV4TmFtZTogJ1BvbGljeUlkSW5kZXgnLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BvbGljeUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBHU0k6IOOCouOCr+OCt+ODp+ODs+WIpeaknOe0oueUqFxuICAgICAgdGhpcy5hdWRpdExvZ1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgICAgaW5kZXhOYW1lOiAnQWN0aW9uSW5kZXgnLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2FjdGlvbicsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Pjg63jgrDjg6vjg7zjg5fkvZzmiJBcbiAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9iZWRyb2NrL2FnZW50LWNvcmUvJHtwcm9wcy5wcm9qZWN0TmFtZX0vJHtwcm9wcy5lbnZpcm9ubWVudH0vcG9saWN5YCxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyDjgr/jgrDku5jjgZFcbiAgICBpZiAocHJvcHMudGFncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMocHJvcHMudGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMucG9saWN5QnVja2V0KS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMucG9saWN5VGFibGUpLmFkZChrZXksIHZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMuYXVkaXRMb2dUYWJsZSkge1xuICAgICAgICAgIGNkay5UYWdzLm9mKHRoaXMuYXVkaXRMb2dUYWJsZSkuYWRkKGtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4jjgr/jgrBcbiAgICBjZGsuVGFncy5vZih0aGlzLnBvbGljeUJ1Y2tldCkuYWRkKCdDb21wb25lbnQnLCAnUG9saWN5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5wb2xpY3lUYWJsZSkuYWRkKCdDb21wb25lbnQnLCAnUG9saWN5Jyk7XG4gICAgaWYgKHRoaXMuYXVkaXRMb2dUYWJsZSkge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5hdWRpdExvZ1RhYmxlKS5hZGQoJ0NvbXBvbmVudCcsICdQb2xpY3knKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr44Od44Oq44K344O844OQ44Kx44OD44OI44G444Gu44Ki44Kv44K744K55qip6ZmQ44KS5LuY5LiOXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRQb2xpY3lCdWNrZXRBY2Nlc3MoZ3JhbnRlZTogaWFtLklHcmFudGFibGUpOiBpYW0uR3JhbnQge1xuICAgIHJldHVybiB0aGlzLnBvbGljeUJ1Y2tldC5ncmFudFJlYWRXcml0ZShncmFudGVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDjgavjg53jg6rjgrfjg7zjg4bjg7zjg5bjg6vjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDjgpLku5jkuI5cbiAgICovXG4gIHB1YmxpYyBncmFudFBvbGljeVRhYmxlQWNjZXNzKGdyYW50ZWU6IGlhbS5JR3JhbnRhYmxlKTogaWFtLkdyYW50IHtcbiAgICByZXR1cm4gdGhpcy5wb2xpY3lUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZ3JhbnRlZSk7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr55uj5p+744Ot44Kw44OG44O844OW44Or44G444Gu44Ki44Kv44K744K55qip6ZmQ44KS5LuY5LiOXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRBdWRpdExvZ1RhYmxlQWNjZXNzKGdyYW50ZWU6IGlhbS5JR3JhbnRhYmxlKTogaWFtLkdyYW50IHwgdW5kZWZpbmVkIHtcbiAgICBpZiAodGhpcy5hdWRpdExvZ1RhYmxlKSB7XG4gICAgICByZXR1cm4gdGhpcy5hdWRpdExvZ1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShncmFudGVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuIl19