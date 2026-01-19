"use strict";
/**
 * 統合スタック インデックス
 *
 * モジュラーアーキテクチャに基づく6つの統合CDKスタック
 * 依存関係に基づく段階的デプロイメント対応
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEGRATED_STACKS_INFO = exports.STACK_METADATA = exports.STACK_DEPENDENCIES = exports.DEPLOYMENT_ORDER = exports.OperationsStack = exports.WebAppStack = exports.EmbeddingStack = exports.DataStack = exports.NetworkingStack = exports.SecurityStack = void 0;
// 統合スタックのエクスポート
var security_stack_1 = require("./security-stack");
Object.defineProperty(exports, "SecurityStack", { enumerable: true, get: function () { return security_stack_1.SecurityStack; } });
var networking_stack_1 = require("./networking-stack");
Object.defineProperty(exports, "NetworkingStack", { enumerable: true, get: function () { return networking_stack_1.NetworkingStack; } });
var data_stack_1 = require("./data-stack");
Object.defineProperty(exports, "DataStack", { enumerable: true, get: function () { return data_stack_1.DataStack; } });
var embedding_stack_1 = require("./embedding-stack");
Object.defineProperty(exports, "EmbeddingStack", { enumerable: true, get: function () { return embedding_stack_1.EmbeddingStack; } });
var webapp_stack_1 = require("./webapp-stack");
Object.defineProperty(exports, "WebAppStack", { enumerable: true, get: function () { return webapp_stack_1.WebAppStack; } });
// export { AdvancedPermissionStack, AdvancedPermissionStackProps } from './advanced-permission-stack';
var operations_stack_1 = require("./operations-stack");
Object.defineProperty(exports, "OperationsStack", { enumerable: true, get: function () { return operations_stack_1.OperationsStack; } });
/**
 * 統合スタックのデプロイメント順序
 *
 * 依存関係に基づく推奨デプロイメント順序:
 * 1. SecurityStack - セキュリティ基盤（KMS、WAF、CloudTrail）
 * 2. NetworkingStack - ネットワーク基盤（VPC、サブネット、セキュリティグループ）
 * 3. DataStack - データ・ストレージ（S3、DynamoDB、OpenSearch、FSx）
 * 4. EmbeddingStack - Embedding・AI（Lambda、ECS、Bedrock、AWS Batch）
 * 5. WebAppStack - API・フロントエンド（API Gateway、CloudFront、Cognito）
 * 6. AdvancedPermissionStack - 高度権限制御（時間・地理・動的権限制御）
 * 7. OperationsStack - 監視・エンタープライズ（CloudWatch、SNS、アクセス制御）
 *
 * 注意: AdvancedPermissionStackはWebAppStackの後にデプロイする必要があります
 * （OpenSearchエンドポイントとAPI統合が必要なため）
 */
exports.DEPLOYMENT_ORDER = [
    'SecurityStack',
    'NetworkingStack',
    'DataStack',
    'EmbeddingStack',
    'WebAppStack',
    'AdvancedPermissionStack',
    'OperationsStack',
];
/**
 * スタック間の依存関係マッピング
 *
 * 各スタックが依存する他のスタックを明示的に定義
 * デプロイメント順序の決定とエラー防止に使用
 */
exports.STACK_DEPENDENCIES = {
    SecurityStack: [],
    NetworkingStack: ['SecurityStack'],
    DataStack: ['SecurityStack', 'NetworkingStack'],
    EmbeddingStack: ['SecurityStack', 'NetworkingStack', 'DataStack'],
    WebAppStack: ['SecurityStack', 'NetworkingStack', 'EmbeddingStack'],
    AdvancedPermissionStack: ['SecurityStack', 'NetworkingStack', 'DataStack', 'WebAppStack'],
    OperationsStack: ['SecurityStack', 'NetworkingStack', 'DataStack', 'EmbeddingStack', 'WebAppStack', 'AdvancedPermissionStack'],
};
/**
 * 統合スタックのメタデータ
 */
exports.STACK_METADATA = {
    SecurityStack: {
        description: 'セキュリティ統合管理（KMS、WAF、CloudTrail、IAM）',
        category: 'Security',
        estimatedCost: 'Low',
        deploymentTime: '5-10 minutes',
    },
    NetworkingStack: {
        description: 'ネットワーク基盤統合管理（VPC、サブネット、ゲートウェイ）',
        category: 'Infrastructure',
        estimatedCost: 'Medium',
        deploymentTime: '10-15 minutes',
    },
    DataStack: {
        description: 'データ・ストレージ統合管理（S3、DynamoDB、OpenSearch、FSx）',
        category: 'Data',
        estimatedCost: 'High',
        deploymentTime: '15-30 minutes',
    },
    EmbeddingStack: {
        description: 'Embedding・AI統合管理（Lambda、ECS、Bedrock、AWS Batch）',
        category: 'Embedding',
        estimatedCost: 'Medium',
        deploymentTime: '10-20 minutes',
    },
    WebAppStack: {
        description: 'API・フロントエンド統合管理（API Gateway、CloudFront、Cognito）',
        category: 'Frontend',
        estimatedCost: 'Medium',
        deploymentTime: '15-25 minutes',
    },
    AdvancedPermissionStack: {
        description: '高度権限制御統合管理（時間制限、地理制限、動的権限）',
        category: 'Security',
        estimatedCost: 'Medium',
        deploymentTime: '10-20 minutes',
    },
    OperationsStack: {
        description: '監視・エンタープライズ統合管理（CloudWatch、SNS、アクセス制御）',
        category: 'Operations',
        estimatedCost: 'Low',
        deploymentTime: '5-15 minutes',
    },
};
/**
 * 統合スタックの総合情報
 */
exports.INTEGRATED_STACKS_INFO = {
    totalStacks: 7,
    totalEstimatedDeploymentTime: '65-125 minutes',
    totalEstimatedMonthlyCost: '$275-875 (depending on usage)',
    supportedRegions: [
        'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
        'ap-northeast-1', 'ap-northeast-3', 'ap-southeast-1', 'ap-southeast-2'
    ],
    requiredPermissions: [
        'CloudFormation full access',
        'IAM full access',
        'EC2 full access',
        'S3 full access',
        'Lambda full access',
        'API Gateway full access',
        'CloudFront full access',
        'DynamoDB full access',
        'OpenSearch full access',
        'FSx full access',
        'Bedrock full access',
        'CloudWatch full access',
        'SNS full access',
        'Cognito full access',
        'WAF full access',
        'KMS full access',
        'CloudTrail full access',
    ],
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7OztBQUVILGdCQUFnQjtBQUNoQixtREFBcUU7QUFBNUQsK0dBQUEsYUFBYSxPQUFBO0FBQ3RCLHVEQUEyRTtBQUFsRSxtSEFBQSxlQUFlLE9BQUE7QUFDeEIsMkNBQXlEO0FBQWhELHVHQUFBLFNBQVMsT0FBQTtBQUNsQixxREFBd0U7QUFBL0QsaUhBQUEsY0FBYyxPQUFBO0FBQ3ZCLCtDQUErRDtBQUF0RCwyR0FBQSxXQUFXLE9BQUE7QUFDcEIsdUdBQXVHO0FBQ3ZHLHVEQUEyRTtBQUFsRSxtSEFBQSxlQUFlLE9BQUE7QUFFeEI7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDVSxRQUFBLGdCQUFnQixHQUFHO0lBQzlCLGVBQWU7SUFDZixpQkFBaUI7SUFDakIsV0FBVztJQUNYLGdCQUFnQjtJQUNoQixhQUFhO0lBQ2IseUJBQXlCO0lBQ3pCLGlCQUFpQjtDQUNULENBQUM7QUFFWDs7Ozs7R0FLRztBQUNVLFFBQUEsa0JBQWtCLEdBQUc7SUFDaEMsYUFBYSxFQUFFLEVBQUU7SUFDakIsZUFBZSxFQUFFLENBQUMsZUFBZSxDQUFDO0lBQ2xDLFNBQVMsRUFBRSxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQztJQUMvQyxjQUFjLEVBQUUsQ0FBQyxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsV0FBVyxDQUFDO0lBQ2pFLFdBQVcsRUFBRSxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsQ0FBQztJQUNuRSx1QkFBdUIsRUFBRSxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsYUFBYSxDQUFDO0lBQ3pGLGVBQWUsRUFBRSxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLHlCQUF5QixDQUFDO0NBQ3RILENBQUM7QUFxQ1g7O0dBRUc7QUFDVSxRQUFBLGNBQWMsR0FBRztJQUM1QixhQUFhLEVBQUU7UUFDYixXQUFXLEVBQUUsb0NBQW9DO1FBQ2pELFFBQVEsRUFBRSxVQUFVO1FBQ3BCLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLGNBQWMsRUFBRSxjQUFjO0tBQy9CO0lBQ0QsZUFBZSxFQUFFO1FBQ2YsV0FBVyxFQUFFLGdDQUFnQztRQUM3QyxRQUFRLEVBQUUsZ0JBQWdCO1FBQzFCLGFBQWEsRUFBRSxRQUFRO1FBQ3ZCLGNBQWMsRUFBRSxlQUFlO0tBQ2hDO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsV0FBVyxFQUFFLDJDQUEyQztRQUN4RCxRQUFRLEVBQUUsTUFBTTtRQUNoQixhQUFhLEVBQUUsTUFBTTtRQUNyQixjQUFjLEVBQUUsZUFBZTtLQUNoQztJQUNELGNBQWMsRUFBRTtRQUNkLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsUUFBUSxFQUFFLFdBQVc7UUFDckIsYUFBYSxFQUFFLFFBQVE7UUFDdkIsY0FBYyxFQUFFLGVBQWU7S0FDaEM7SUFDRCxXQUFXLEVBQUU7UUFDWCxXQUFXLEVBQUUsaURBQWlEO1FBQzlELFFBQVEsRUFBRSxVQUFVO1FBQ3BCLGFBQWEsRUFBRSxRQUFRO1FBQ3ZCLGNBQWMsRUFBRSxlQUFlO0tBQ2hDO0lBQ0QsdUJBQXVCLEVBQUU7UUFDdkIsV0FBVyxFQUFFLDRCQUE0QjtRQUN6QyxRQUFRLEVBQUUsVUFBVTtRQUNwQixhQUFhLEVBQUUsUUFBUTtRQUN2QixjQUFjLEVBQUUsZUFBZTtLQUNoQztJQUNELGVBQWUsRUFBRTtRQUNmLFdBQVcsRUFBRSx3Q0FBd0M7UUFDckQsUUFBUSxFQUFFLFlBQVk7UUFDdEIsYUFBYSxFQUFFLEtBQUs7UUFDcEIsY0FBYyxFQUFFLGNBQWM7S0FDL0I7Q0FDTyxDQUFDO0FBRVg7O0dBRUc7QUFDVSxRQUFBLHNCQUFzQixHQUFHO0lBQ3BDLFdBQVcsRUFBRSxDQUFDO0lBQ2QsNEJBQTRCLEVBQUUsZ0JBQWdCO0lBQzlDLHlCQUF5QixFQUFFLCtCQUErQjtJQUMxRCxnQkFBZ0IsRUFBRTtRQUNoQixXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxjQUFjO1FBQ3JELGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLGdCQUFnQjtLQUN2RTtJQUNELG1CQUFtQixFQUFFO1FBQ25CLDRCQUE0QjtRQUM1QixpQkFBaUI7UUFDakIsaUJBQWlCO1FBQ2pCLGdCQUFnQjtRQUNoQixvQkFBb0I7UUFDcEIseUJBQXlCO1FBQ3pCLHdCQUF3QjtRQUN4QixzQkFBc0I7UUFDdEIsd0JBQXdCO1FBQ3hCLGlCQUFpQjtRQUNqQixxQkFBcUI7UUFDckIsd0JBQXdCO1FBQ3hCLGlCQUFpQjtRQUNqQixxQkFBcUI7UUFDckIsaUJBQWlCO1FBQ2pCLGlCQUFpQjtRQUNqQix3QkFBd0I7S0FDekI7Q0FDTyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDntbHlkIjjgrnjgr/jg4Pjgq8g44Kk44Oz44OH44OD44Kv44K5XG4gKiBcbiAqIOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+OBq+WfuuOBpeOBjzbjgaTjga7ntbHlkIhDREvjgrnjgr/jg4Pjgq9cbiAqIOS+neWtmOmWouS/guOBq+WfuuOBpeOBj+autemajueahOODh+ODl+ODreOCpOODoeODs+ODiOWvvuW/nFxuICovXG5cbi8vIOe1seWQiOOCueOCv+ODg+OCr+OBruOCqOOCr+OCueODneODvOODiFxuZXhwb3J0IHsgU2VjdXJpdHlTdGFjaywgU2VjdXJpdHlTdGFja1Byb3BzIH0gZnJvbSAnLi9zZWN1cml0eS1zdGFjayc7XG5leHBvcnQgeyBOZXR3b3JraW5nU3RhY2ssIE5ldHdvcmtpbmdTdGFja1Byb3BzIH0gZnJvbSAnLi9uZXR3b3JraW5nLXN0YWNrJztcbmV4cG9ydCB7IERhdGFTdGFjaywgRGF0YVN0YWNrUHJvcHMgfSBmcm9tICcuL2RhdGEtc3RhY2snO1xuZXhwb3J0IHsgRW1iZWRkaW5nU3RhY2ssIEVtYmVkZGluZ1N0YWNrUHJvcHMgfSBmcm9tICcuL2VtYmVkZGluZy1zdGFjayc7XG5leHBvcnQgeyBXZWJBcHBTdGFjaywgV2ViQXBwU3RhY2tQcm9wcyB9IGZyb20gJy4vd2ViYXBwLXN0YWNrJztcbi8vIGV4cG9ydCB7IEFkdmFuY2VkUGVybWlzc2lvblN0YWNrLCBBZHZhbmNlZFBlcm1pc3Npb25TdGFja1Byb3BzIH0gZnJvbSAnLi9hZHZhbmNlZC1wZXJtaXNzaW9uLXN0YWNrJztcbmV4cG9ydCB7IE9wZXJhdGlvbnNTdGFjaywgT3BlcmF0aW9uc1N0YWNrUHJvcHMgfSBmcm9tICcuL29wZXJhdGlvbnMtc3RhY2snO1xuXG4vKipcbiAqIOe1seWQiOOCueOCv+ODg+OCr+OBruODh+ODl+ODreOCpOODoeODs+ODiOmghuW6j1xuICogXG4gKiDkvp3lrZjplqLkv4Ljgavln7rjgaXjgY/mjqjlpajjg4fjg5fjg63jgqTjg6Hjg7Pjg4jpoIbluo86XG4gKiAxLiBTZWN1cml0eVN0YWNrIC0g44K744Kt44Ol44Oq44OG44Kj5Z+655uk77yIS01T44CBV0FG44CBQ2xvdWRUcmFpbO+8iVxuICogMi4gTmV0d29ya2luZ1N0YWNrIC0g44ON44OD44OI44Ov44O844Kv5Z+655uk77yIVlBD44CB44K144OW44ON44OD44OI44CB44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX77yJXG4gKiAzLiBEYXRhU3RhY2sgLSDjg4fjg7zjgr/jg7vjgrnjg4jjg6zjg7zjgrjvvIhTM+OAgUR5bmFtb0RC44CBT3BlblNlYXJjaOOAgUZTeO+8iVxuICogNC4gRW1iZWRkaW5nU3RhY2sgLSBFbWJlZGRpbmfjg7tBSe+8iExhbWJkYeOAgUVDU+OAgUJlZHJvY2vjgIFBV1MgQmF0Y2jvvIlcbiAqIDUuIFdlYkFwcFN0YWNrIC0gQVBJ44O744OV44Ot44Oz44OI44Ko44Oz44OJ77yIQVBJIEdhdGV3YXnjgIFDbG91ZEZyb25044CBQ29nbml0b++8iVxuICogNi4gQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2sgLSDpq5jluqbmqKnpmZDliLblvqHvvIjmmYLplpPjg7vlnLDnkIbjg7vli5XnmoTmqKnpmZDliLblvqHvvIlcbiAqIDcuIE9wZXJhdGlvbnNTdGFjayAtIOebo+imluODu+OCqOODs+OCv+ODvOODl+ODqeOCpOOCuu+8iENsb3VkV2F0Y2jjgIFTTlPjgIHjgqLjgq/jgrvjgrnliLblvqHvvIlcbiAqIFxuICog5rOo5oSPOiBBZHZhbmNlZFBlcm1pc3Npb25TdGFja+OBr1dlYkFwcFN0YWNr44Gu5b6M44Gr44OH44OX44Ot44Kk44GZ44KL5b+F6KaB44GM44GC44KK44G+44GZXG4gKiDvvIhPcGVuU2VhcmNo44Ko44Oz44OJ44Od44Kk44Oz44OI44GoQVBJ57Wx5ZCI44GM5b+F6KaB44Gq44Gf44KB77yJXG4gKi9cbmV4cG9ydCBjb25zdCBERVBMT1lNRU5UX09SREVSID0gW1xuICAnU2VjdXJpdHlTdGFjaycsXG4gICdOZXR3b3JraW5nU3RhY2snLCBcbiAgJ0RhdGFTdGFjaycsXG4gICdFbWJlZGRpbmdTdGFjaycsXG4gICdXZWJBcHBTdGFjaycsXG4gICdBZHZhbmNlZFBlcm1pc3Npb25TdGFjaycsXG4gICdPcGVyYXRpb25zU3RhY2snLFxuXSBhcyBjb25zdDtcblxuLyoqXG4gKiDjgrnjgr/jg4Pjgq/plpPjga7kvp3lrZjplqLkv4Ljg57jg4Pjg5Tjg7PjgrBcbiAqIFxuICog5ZCE44K544K/44OD44Kv44GM5L6d5a2Y44GZ44KL5LuW44Gu44K544K/44OD44Kv44KS5piO56S655qE44Gr5a6a576pXG4gKiDjg4fjg5fjg63jgqTjg6Hjg7Pjg4jpoIbluo/jga7msbrlrprjgajjgqjjg6njg7zpmLLmraLjgavkvb/nlKhcbiAqL1xuZXhwb3J0IGNvbnN0IFNUQUNLX0RFUEVOREVOQ0lFUyA9IHtcbiAgU2VjdXJpdHlTdGFjazogW10sXG4gIE5ldHdvcmtpbmdTdGFjazogWydTZWN1cml0eVN0YWNrJ10sXG4gIERhdGFTdGFjazogWydTZWN1cml0eVN0YWNrJywgJ05ldHdvcmtpbmdTdGFjayddLFxuICBFbWJlZGRpbmdTdGFjazogWydTZWN1cml0eVN0YWNrJywgJ05ldHdvcmtpbmdTdGFjaycsICdEYXRhU3RhY2snXSxcbiAgV2ViQXBwU3RhY2s6IFsnU2VjdXJpdHlTdGFjaycsICdOZXR3b3JraW5nU3RhY2snLCAnRW1iZWRkaW5nU3RhY2snXSxcbiAgQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2s6IFsnU2VjdXJpdHlTdGFjaycsICdOZXR3b3JraW5nU3RhY2snLCAnRGF0YVN0YWNrJywgJ1dlYkFwcFN0YWNrJ10sXG4gIE9wZXJhdGlvbnNTdGFjazogWydTZWN1cml0eVN0YWNrJywgJ05ldHdvcmtpbmdTdGFjaycsICdEYXRhU3RhY2snLCAnRW1iZWRkaW5nU3RhY2snLCAnV2ViQXBwU3RhY2snLCAnQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2snXSxcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICog57Wx5ZCI44K544K/44OD44Kv6Kit5a6a44Kk44Oz44K/44O844OV44Kn44O844K5XG4gKiBcbiAqIOWFqOe1seWQiOOCueOCv+ODg+OCr+OBruioreWumuOCkue1seS4gOeahOOBq+euoeeQhuOBmeOCi+OBn+OCgeOBruOCpOODs+OCv+ODvOODleOCp+ODvOOCuVxuICog5Z6L5a6J5YWo5oCn44KS56K65L+d44GX44CB6Kit5a6a44Gu5LiA6LKr5oCn44KS5L+d44GkXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW50ZWdyYXRlZFN0YWNrc0NvbmZpZyB7XG4gIC8qKiDjg5fjg63jgrjjgqfjgq/jg4jlkI3vvIjjg6rjgr3jg7zjgrnlkb3lkI3jgavkvb/nlKjvvIkgKi9cbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgLyoqIOeSsOWig+WQje+8iGRldi9zdGFnaW5nL3Byb2TvvIkgKi9cbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgLyoqIEFXU+ODquODvOOCuOODp+ODsyAqL1xuICByZWdpb246IHN0cmluZztcbiAgXG4gIC8vIOapn+iDveODleODqeOCsO+8iOWQhOOCueOCv+ODg+OCr+OBruacieWKuS/nhKHlirnliLblvqHvvIlcbiAgZW5hYmxlU2VjdXJpdHk6IGJvb2xlYW47XG4gIGVuYWJsZU5ldHdvcmtpbmc6IGJvb2xlYW47XG4gIGVuYWJsZURhdGE6IGJvb2xlYW47XG4gIGVuYWJsZUVtYmVkZGluZzogYm9vbGVhbjtcbiAgZW5hYmxlV2ViQXBwOiBib29sZWFuO1xuICBlbmFibGVBZHZhbmNlZFBlcm1pc3Npb25Db250cm9sOiBib29sZWFuO1xuICBlbmFibGVPcGVyYXRpb25zOiBib29sZWFuO1xuICBcbiAgLy8g5ZCE44K544K/44OD44Kv5Zu65pyJ44Gu6Kit5a6a77yI5Z6L5a6J5YWo5oCn44Gu44Gf44KB5YW35L2T55qE44Gq5Z6L5a6a576p44KS5o6o5aWo77yJXG4gIHNlY3VyaXR5Q29uZmlnPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIG5ldHdvcmtpbmdDb25maWc/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgc3RvcmFnZUNvbmZpZz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBkYXRhYmFzZUNvbmZpZz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBlbWJlZGRpbmdDb25maWc/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgYWlDb25maWc/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgYXBpQ29uZmlnPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIG1vbml0b3JpbmdDb25maWc/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgZW50ZXJwcmlzZUNvbmZpZz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG4vKipcbiAqIOe1seWQiOOCueOCv+ODg+OCr+OBruODoeOCv+ODh+ODvOOCv1xuICovXG5leHBvcnQgY29uc3QgU1RBQ0tfTUVUQURBVEEgPSB7XG4gIFNlY3VyaXR5U3RhY2s6IHtcbiAgICBkZXNjcmlwdGlvbjogJ+OCu+OCreODpeODquODhuOCo+e1seWQiOeuoeeQhu+8iEtNU+OAgVdBRuOAgUNsb3VkVHJhaWzjgIFJQU3vvIknLFxuICAgIGNhdGVnb3J5OiAnU2VjdXJpdHknLFxuICAgIGVzdGltYXRlZENvc3Q6ICdMb3cnLFxuICAgIGRlcGxveW1lbnRUaW1lOiAnNS0xMCBtaW51dGVzJyxcbiAgfSxcbiAgTmV0d29ya2luZ1N0YWNrOiB7XG4gICAgZGVzY3JpcHRpb246ICfjg43jg4Pjg4jjg6/jg7zjgq/ln7rnm6TntbHlkIjnrqHnkIbvvIhWUEPjgIHjgrXjg5bjg43jg4Pjg4jjgIHjgrLjg7zjg4jjgqbjgqfjgqTvvIknLFxuICAgIGNhdGVnb3J5OiAnSW5mcmFzdHJ1Y3R1cmUnLFxuICAgIGVzdGltYXRlZENvc3Q6ICdNZWRpdW0nLFxuICAgIGRlcGxveW1lbnRUaW1lOiAnMTAtMTUgbWludXRlcycsXG4gIH0sXG4gIERhdGFTdGFjazoge1xuICAgIGRlc2NyaXB0aW9uOiAn44OH44O844K/44O744K544OI44Os44O844K457Wx5ZCI566h55CG77yIUzPjgIFEeW5hbW9EQuOAgU9wZW5TZWFyY2jjgIFGU3jvvIknLFxuICAgIGNhdGVnb3J5OiAnRGF0YScsXG4gICAgZXN0aW1hdGVkQ29zdDogJ0hpZ2gnLFxuICAgIGRlcGxveW1lbnRUaW1lOiAnMTUtMzAgbWludXRlcycsXG4gIH0sXG4gIEVtYmVkZGluZ1N0YWNrOiB7XG4gICAgZGVzY3JpcHRpb246ICdFbWJlZGRpbmfjg7tBSee1seWQiOeuoeeQhu+8iExhbWJkYeOAgUVDU+OAgUJlZHJvY2vjgIFBV1MgQmF0Y2jvvIknLFxuICAgIGNhdGVnb3J5OiAnRW1iZWRkaW5nJyxcbiAgICBlc3RpbWF0ZWRDb3N0OiAnTWVkaXVtJyxcbiAgICBkZXBsb3ltZW50VGltZTogJzEwLTIwIG1pbnV0ZXMnLFxuICB9LFxuICBXZWJBcHBTdGFjazoge1xuICAgIGRlc2NyaXB0aW9uOiAnQVBJ44O744OV44Ot44Oz44OI44Ko44Oz44OJ57Wx5ZCI566h55CG77yIQVBJIEdhdGV3YXnjgIFDbG91ZEZyb25044CBQ29nbml0b++8iScsXG4gICAgY2F0ZWdvcnk6ICdGcm9udGVuZCcsXG4gICAgZXN0aW1hdGVkQ29zdDogJ01lZGl1bScsXG4gICAgZGVwbG95bWVudFRpbWU6ICcxNS0yNSBtaW51dGVzJyxcbiAgfSxcbiAgQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2s6IHtcbiAgICBkZXNjcmlwdGlvbjogJ+mrmOW6puaoqemZkOWItuW+oee1seWQiOeuoeeQhu+8iOaZgumWk+WItumZkOOAgeWcsOeQhuWItumZkOOAgeWLleeahOaoqemZkO+8iScsXG4gICAgY2F0ZWdvcnk6ICdTZWN1cml0eScsXG4gICAgZXN0aW1hdGVkQ29zdDogJ01lZGl1bScsXG4gICAgZGVwbG95bWVudFRpbWU6ICcxMC0yMCBtaW51dGVzJyxcbiAgfSxcbiAgT3BlcmF0aW9uc1N0YWNrOiB7XG4gICAgZGVzY3JpcHRpb246ICfnm6Poppbjg7vjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrntbHlkIjnrqHnkIbvvIhDbG91ZFdhdGNo44CBU05T44CB44Ki44Kv44K744K55Yi25b6h77yJJyxcbiAgICBjYXRlZ29yeTogJ09wZXJhdGlvbnMnLFxuICAgIGVzdGltYXRlZENvc3Q6ICdMb3cnLFxuICAgIGRlcGxveW1lbnRUaW1lOiAnNS0xNSBtaW51dGVzJyxcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICog57Wx5ZCI44K544K/44OD44Kv44Gu57eP5ZCI5oOF5aCxXG4gKi9cbmV4cG9ydCBjb25zdCBJTlRFR1JBVEVEX1NUQUNLU19JTkZPID0ge1xuICB0b3RhbFN0YWNrczogNyxcbiAgdG90YWxFc3RpbWF0ZWREZXBsb3ltZW50VGltZTogJzY1LTEyNSBtaW51dGVzJyxcbiAgdG90YWxFc3RpbWF0ZWRNb250aGx5Q29zdDogJyQyNzUtODc1IChkZXBlbmRpbmcgb24gdXNhZ2UpJyxcbiAgc3VwcG9ydGVkUmVnaW9uczogW1xuICAgICd1cy1lYXN0LTEnLCAndXMtd2VzdC0yJywgJ2V1LXdlc3QtMScsICdldS1jZW50cmFsLTEnLFxuICAgICdhcC1ub3J0aGVhc3QtMScsICdhcC1ub3J0aGVhc3QtMycsICdhcC1zb3V0aGVhc3QtMScsICdhcC1zb3V0aGVhc3QtMidcbiAgXSxcbiAgcmVxdWlyZWRQZXJtaXNzaW9uczogW1xuICAgICdDbG91ZEZvcm1hdGlvbiBmdWxsIGFjY2VzcycsXG4gICAgJ0lBTSBmdWxsIGFjY2VzcycsXG4gICAgJ0VDMiBmdWxsIGFjY2VzcycsXG4gICAgJ1MzIGZ1bGwgYWNjZXNzJyxcbiAgICAnTGFtYmRhIGZ1bGwgYWNjZXNzJyxcbiAgICAnQVBJIEdhdGV3YXkgZnVsbCBhY2Nlc3MnLFxuICAgICdDbG91ZEZyb250IGZ1bGwgYWNjZXNzJyxcbiAgICAnRHluYW1vREIgZnVsbCBhY2Nlc3MnLFxuICAgICdPcGVuU2VhcmNoIGZ1bGwgYWNjZXNzJyxcbiAgICAnRlN4IGZ1bGwgYWNjZXNzJyxcbiAgICAnQmVkcm9jayBmdWxsIGFjY2VzcycsXG4gICAgJ0Nsb3VkV2F0Y2ggZnVsbCBhY2Nlc3MnLFxuICAgICdTTlMgZnVsbCBhY2Nlc3MnLFxuICAgICdDb2duaXRvIGZ1bGwgYWNjZXNzJyxcbiAgICAnV0FGIGZ1bGwgYWNjZXNzJyxcbiAgICAnS01TIGZ1bGwgYWNjZXNzJyxcbiAgICAnQ2xvdWRUcmFpbCBmdWxsIGFjY2VzcycsXG4gIF0sXG59IGFzIGNvbnN0OyJdfQ==