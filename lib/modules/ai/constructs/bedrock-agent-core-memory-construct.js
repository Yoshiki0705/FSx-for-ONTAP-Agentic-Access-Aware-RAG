"use strict";
/**
 * Amazon Bedrock AgentCore Memory Construct
 *
 * このConstructは、Bedrock AgentのMemory機能を提供します。
 *
 * 重要: AgentCore Memoryは完全なフルマネージドサービスです。
 * Memory Resourceを作成するだけで、AWSが以下を自動的に管理します：
 * - ストレージ（DynamoDB、OpenSearch Serverless、FSx for ONTAP）
 * - ベクトル化（Bedrock Embeddings）
 * - メモリ抽出（短期→長期メモリの自動変換）
 *
 * 主要機能:
 * - Memory Resource作成（CfnMemory）
 * - 3つのMemory Strategies設定（Semantic、Summary、User Preference）
 * - KMS暗号化設定（オプション）
 * - IAM Role設定（オプション）
 *
 * @author Kiro AI
 * @date 2026-01-03
 * @version 2.0.0 - AgentCore Memory APIベースに完全書き換え
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
exports.BedrockAgentCoreMemoryConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const constructs_1 = require("constructs");
const bedrockagentcore = __importStar(require("aws-cdk-lib/aws-bedrockagentcore"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
/**
 * Amazon Bedrock AgentCore Memory Construct
 *
 * Bedrock AgentのMemory機能を提供します。
 *
 * 使用方法:
 * ```typescript
 * const memory = new BedrockAgentCoreMemoryConstruct(this, 'Memory', {
 *   enabled: true,
 *   projectName: 'my-project',
 *   environment: 'prod',
 *   eventExpiryDuration: 90,
 * });
 *
 * // Memory Resource ARNを取得
 * const memoryArn = memory.memoryResourceArn;
 *
 * // Memory Resource IDを取得
 * const memoryId = memory.memoryResourceId;
 * ```
 *
 * アプリケーション側での使用例:
 * ```typescript
 * import { BedrockAgentCoreClient, WriteEventCommand } from '@aws-sdk/client-bedrock-agent-core';
 *
 * const client = new BedrockAgentCoreClient({ region: 'ap-northeast-1' });
 *
 * // イベント書き込み（短期メモリ）
 * await client.send(new WriteEventCommand({
 *   memoryId: 'memory-resource-id',
 *   actorId: 'user-123',
 *   sessionId: 'session-456',
 *   content: { text: 'こんにちは', role: 'USER' },
 * }));
 *
 * // 長期メモリ検索
 * await client.send(new SearchLongTermMemoriesCommand({
 *   memoryId: 'memory-resource-id',
 *   actorId: 'user-123',
 *   query: '検索クエリ',
 *   topK: 5,
 * }));
 * ```
 */
class BedrockAgentCoreMemoryConstruct extends constructs_1.Construct {
    /**
     * Memory Resource ARN
     */
    memoryResourceArn;
    /**
     * Memory Resource ID
     */
    memoryResourceId;
    /**
     * KMS暗号化キー
     */
    kmsKey;
    /**
     * Memory実行ロール
     */
    executionRole;
    constructor(scope, id, props) {
        super(scope, id);
        // Memory機能が無効の場合は何もしない
        if (!props.enabled) {
            // ダミー値を設定（TypeScriptの型エラーを回避）
            this.memoryResourceArn = '';
            this.memoryResourceId = '';
            return;
        }
        // リージョンプレフィックスを生成
        const regionPrefix = this.getRegionPrefix(cdk.Stack.of(this).region);
        // リソース名プレフィックス
        const resourcePrefix = `${regionPrefix}-${props.projectName}-${props.environment}-Memory`;
        // KMS暗号化キーを作成または取得
        if (props.kms?.keyArn) {
            this.kmsKey = kms.Key.fromKeyArn(this, 'ExistingKmsKey', props.kms.keyArn);
        }
        else if (props.kms) {
            this.kmsKey = new kms.Key(this, 'KmsKey', {
                alias: `${props.kms.keyAliasPrefix || resourcePrefix}-Key`,
                description: `KMS key for ${resourcePrefix}`,
                enableKeyRotation: true,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
            });
        }
        // Memory実行ロールを作成または取得
        if (props.memoryExecutionRoleArn) {
            this.executionRole = iam.Role.fromRoleArn(this, 'ExistingExecutionRole', props.memoryExecutionRoleArn);
        }
        else {
            this.executionRole = this.createExecutionRole(resourcePrefix);
        }
        // Memory Strategiesを構築
        const memoryStrategies = this.buildMemoryStrategies(props.memoryStrategy);
        // Memory Resourceを作成
        const memoryResource = new bedrockagentcore.CfnMemory(this, 'MemoryResource', {
            name: `${resourcePrefix}-Resource`,
            description: `Memory resource for ${props.projectName} ${props.environment} environment`,
            eventExpiryDuration: props.eventExpiryDuration || 90,
            encryptionKeyArn: this.kmsKey?.keyArn,
            memoryExecutionRoleArn: this.executionRole?.roleArn,
            memoryStrategies: memoryStrategies,
        });
        // Memory Resource ARNとIDを保存
        this.memoryResourceArn = memoryResource.attrMemoryArn;
        this.memoryResourceId = memoryResource.attrMemoryId;
        // CloudFormation出力
        new cdk.CfnOutput(this, 'MemoryResourceArn', {
            value: this.memoryResourceArn,
            description: 'Memory Resource ARN',
            exportName: `${resourcePrefix}-Arn`,
        });
        new cdk.CfnOutput(this, 'MemoryResourceId', {
            value: this.memoryResourceId,
            description: 'Memory Resource ID',
            exportName: `${resourcePrefix}-Id`,
        });
        // タグを適用
        if (props.tags) {
            Object.entries(props.tags).forEach(([key, value]) => {
                cdk.Tags.of(this).add(key, value);
            });
        }
        // デフォルトタグを適用
        cdk.Tags.of(this).add('Project', props.projectName);
        cdk.Tags.of(this).add('Environment', props.environment);
        cdk.Tags.of(this).add('Component', 'BedrockAgentCoreMemory');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
    }
    /**
     * リージョンプレフィックスを取得
     */
    getRegionPrefix(region) {
        const regionPrefixMap = {
            'ap-northeast-1': 'TokyoRegion',
            'us-east-1': 'NorthVirginiaRegion',
            'us-west-2': 'OregonRegion',
            'eu-west-1': 'IrelandRegion',
            'ap-southeast-1': 'SingaporeRegion',
        };
        return regionPrefixMap[region] || 'UnknownRegion';
    }
    /**
     * Memory実行ロールを作成
     */
    createExecutionRole(resourcePrefix) {
        // IAM Role名は64文字以内に制限されているため、長い場合は短縮
        let roleName = `${resourcePrefix}-Execution-Role`;
        if (roleName.length > 64) {
            // リージョンプレフィックスを短縮形に変換
            roleName = roleName
                .replace('TokyoRegion-', 'TKY-')
                .replace('NorthVirginiaRegion-', 'VA-')
                .replace('OregonRegion-', 'OR-')
                .replace('IrelandRegion-', 'IE-')
                .replace('SingaporeRegion-', 'SG-');
            // それでも長い場合は、さらに短縮
            if (roleName.length > 64) {
                roleName = roleName.substring(0, 64);
            }
        }
        const role = new iam.Role(this, 'ExecutionRole', {
            roleName,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: `Execution role for ${resourcePrefix}`,
        });
        // Bedrock Memory APIに必要な権限を追加
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: ['*'],
        }));
        // KMS権限を追加（暗号化が有効な場合）
        if (this.kmsKey) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'kms:Decrypt',
                    'kms:Encrypt',
                    'kms:GenerateDataKey',
                    'kms:DescribeKey',
                ],
                resources: [this.kmsKey.keyArn],
            }));
        }
        return role;
    }
    /**
     * Memory Strategiesを構築
     */
    buildMemoryStrategies(config) {
        const strategies = [];
        // デフォルト設定
        const enableSemantic = config?.enableSemantic !== false;
        const enableSummary = config?.enableSummary !== false;
        const enableUserPreference = config?.enableUserPreference !== false;
        // Semantic Memory（意味的長期記憶）
        if (enableSemantic) {
            strategies.push({
                semanticMemoryStrategy: {
                    name: 'semanticLongTermMemory',
                    namespaces: config?.semanticNamespaces || ['default'],
                },
            });
        }
        // Summary Memory（要約記憶）
        if (enableSummary) {
            strategies.push({
                summaryMemoryStrategy: {
                    name: 'summaryMemory',
                    namespaces: config?.summaryNamespaces || ['default'],
                },
            });
        }
        // User Preference Memory（ユーザー嗜好記憶）
        if (enableUserPreference) {
            strategies.push({
                userPreferenceMemoryStrategy: {
                    name: 'userPreferenceMemory',
                    namespaces: config?.userPreferenceNamespaces || ['default'],
                },
            });
        }
        return strategies;
    }
}
exports.BedrockAgentCoreMemoryConstruct = BedrockAgentCoreMemoryConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLW1lbW9yeS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZWRyb2NrLWFnZW50LWNvcmUtbWVtb3J5LWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQywyQ0FBdUM7QUFDdkMsbUZBQXFFO0FBQ3JFLHlEQUEyQztBQUMzQyx5REFBMkM7QUE2RzNDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMkNHO0FBQ0gsTUFBYSwrQkFBZ0MsU0FBUSxzQkFBUztJQUM1RDs7T0FFRztJQUNhLGlCQUFpQixDQUFTO0lBRTFDOztPQUVHO0lBQ2EsZ0JBQWdCLENBQVM7SUFFekM7O09BRUc7SUFDYSxNQUFNLENBQVk7SUFFbEM7O09BRUc7SUFDYSxhQUFhLENBQWE7SUFFMUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQztRQUNuRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHVCQUF1QjtRQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25CLDhCQUE4QjtZQUM5QixJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7WUFDM0IsT0FBTztRQUNULENBQUM7UUFFRCxrQkFBa0I7UUFDbEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVyRSxlQUFlO1FBQ2YsTUFBTSxjQUFjLEdBQUcsR0FBRyxZQUFZLElBQUksS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMs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QUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7Q0FDRjtBQTlORCwwRUE4TkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFtYXpvbiBCZWRyb2NrIEFnZW50Q29yZSBNZW1vcnkgQ29uc3RydWN0XG4gKiBcbiAqIOOBk+OBrkNvbnN0cnVjdOOBr+OAgUJlZHJvY2sgQWdlbnTjga5NZW1vcnnmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIFxuICog6YeN6KaBOiBBZ2VudENvcmUgTWVtb3J544Gv5a6M5YWo44Gq44OV44Or44Oe44ON44O844K444OJ44K144O844OT44K544Gn44GZ44CCXG4gKiBNZW1vcnkgUmVzb3VyY2XjgpLkvZzmiJDjgZnjgovjgaDjgZHjgafjgIFBV1PjgYzku6XkuIvjgpLoh6rli5XnmoTjgavnrqHnkIbjgZfjgb7jgZnvvJpcbiAqIC0g44K544OI44Os44O844K477yIRHluYW1vRELjgIFPcGVuU2VhcmNoIFNlcnZlcmxlc3PjgIFGU3ggZm9yIE9OVEFQ77yJXG4gKiAtIOODmeOCr+ODiOODq+WMlu+8iEJlZHJvY2sgRW1iZWRkaW5nc++8iVxuICogLSDjg6Hjg6Ljg6rmir3lh7rvvIjnn63mnJ/ihpLplbfmnJ/jg6Hjg6Ljg6rjga7oh6rli5XlpInmj5vvvIlcbiAqIFxuICog5Li76KaB5qmf6IO9OlxuICogLSBNZW1vcnkgUmVzb3VyY2XkvZzmiJDvvIhDZm5NZW1vcnnvvIlcbiAqIC0gM+OBpOOBrk1lbW9yeSBTdHJhdGVnaWVz6Kit5a6a77yIU2VtYW50aWPjgIFTdW1tYXJ544CBVXNlciBQcmVmZXJlbmNl77yJXG4gKiAtIEtNU+aal+WPt+WMluioreWumu+8iOOCquODl+OCt+ODp+ODs++8iVxuICogLSBJQU0gUm9sZeioreWumu+8iOOCquODl+OCt+ODp+ODs++8iVxuICogXG4gKiBAYXV0aG9yIEtpcm8gQUlcbiAqIEBkYXRlIDIwMjYtMDEtMDNcbiAqIEB2ZXJzaW9uIDIuMC4wIC0gQWdlbnRDb3JlIE1lbW9yeSBBUEnjg5njg7zjgrnjgavlrozlhajmm7jjgY3mj5vjgYhcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBiZWRyb2NrYWdlbnRjb3JlIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrYWdlbnRjb3JlJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcblxuLyoqXG4gKiBNZW1vcnkgU3RyYXRlZ3noqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNZW1vcnlTdHJhdGVneUNvbmZpZyB7XG4gIC8qKlxuICAgKiBTZW1hbnRpYyBNZW1vcnnvvIjmhI/lkbPnmoTplbfmnJ/oqJjmhrbvvInjga7mnInlirnljJZcbiAgICog44OH44OV44Kp44Or44OIOiB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVTZW1hbnRpYz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFN1bW1hcnkgTWVtb3J577yI6KaB57SE6KiY5oa277yJ44Gu5pyJ5Yq55YyWXG4gICAqIOODh+ODleOCqeODq+ODiDogdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlU3VtbWFyeT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFVzZXIgUHJlZmVyZW5jZSBNZW1vcnnvvIjjg6bjg7zjgrbjg7zll5zlpb3oqJjmhrbvvInjga7mnInlirnljJZcbiAgICog44OH44OV44Kp44Or44OIOiB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVVc2VyUHJlZmVyZW5jZT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFNlbWFudGljIE1lbW9yeeOBrm5hbWVzcGFjZXNcbiAgICog44OH44OV44Kp44Or44OIOiBbJ2RlZmF1bHQnXVxuICAgKi9cbiAgcmVhZG9ubHkgc2VtYW50aWNOYW1lc3BhY2VzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFN1bW1hcnkgTWVtb3J544GubmFtZXNwYWNlc1xuICAgKiDjg4fjg5Xjgqnjg6vjg4g6IFsnZGVmYXVsdCddXG4gICAqL1xuICByZWFkb25seSBzdW1tYXJ5TmFtZXNwYWNlcz86IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBVc2VyIFByZWZlcmVuY2UgTWVtb3J544GubmFtZXNwYWNlc1xuICAgKiDjg4fjg5Xjgqnjg6vjg4g6IFsnZGVmYXVsdCddXG4gICAqL1xuICByZWFkb25seSB1c2VyUHJlZmVyZW5jZU5hbWVzcGFjZXM/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBLTVPmmpflj7fljJboqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBLbXNDb25maWcge1xuICAvKipcbiAgICogS01TIEtleSBBUk7vvIjml6LlrZjjga5LTVMgS2V544KS5L2/55So44GZ44KL5aC05ZCI77yJXG4gICAqL1xuICByZWFkb25seSBrZXlBcm4/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEtNUyBLZXkgQWxpYXPjg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICovXG4gIHJlYWRvbmx5IGtleUFsaWFzUHJlZml4Pzogc3RyaW5nO1xufVxuXG4vKipcbiAqIE1lbW9yeSBDb25zdHJ1Y3Qg44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdFByb3BzIHtcbiAgLyoqXG4gICAqIE1lbW9yeeapn+iDveOBruacieWKueWMluODleODqeOCsFxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIhkZXYsIHN0YWdpbmcsIHByb2TvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOOCpOODmeODs+ODiOacieWKueacn+mZkO+8iOaXpeaVsO+8iVxuICAgKiDjg4fjg5Xjgqnjg6vjg4g6IDkw5pelXG4gICAqIFxuICAgKiDnn63mnJ/jg6Hjg6Ljg6rvvIjjgqTjg5njg7Pjg4jvvInjga7kv53mjIHmnJ/plpPjgpLmjIflrprjgZfjgb7jgZnjgIJcbiAgICog44GT44Gu5pyf6ZaT44KS6YGO44GO44Gf44Kk44OZ44Oz44OI44Gv6Ieq5YuV55qE44Gr5YmK6Zmk44GV44KM44G+44GZ44CCXG4gICAqL1xuICByZWFkb25seSBldmVudEV4cGlyeUR1cmF0aW9uPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBNZW1vcnkgU3RyYXRlZ3noqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IG1lbW9yeVN0cmF0ZWd5PzogTWVtb3J5U3RyYXRlZ3lDb25maWc7XG5cbiAgLyoqXG4gICAqIEtNU+aal+WPt+WMluioreWumlxuICAgKi9cbiAgcmVhZG9ubHkga21zPzogS21zQ29uZmlnO1xuXG4gIC8qKlxuICAgKiBNZW1vcnnlrp/ooYzjg63jg7zjg6tBUk7vvIjml6LlrZjjga7jg63jg7zjg6vjgpLkvb/nlKjjgZnjgovloLTlkIjvvIlcbiAgICogXG4gICAqIOaMh+WumuOBl+OBquOBhOWgtOWQiOOAgeiHquWLleeahOOBq+aWsOOBl+OBhOODreODvOODq+OBjOS9nOaIkOOBleOCjOOBvuOBmeOAglxuICAgKi9cbiAgcmVhZG9ubHkgbWVtb3J5RXhlY3V0aW9uUm9sZUFybj86IHN0cmluZztcblxuICAvKipcbiAgICog44K/44KwXG4gICAqL1xuICByZWFkb25seSB0YWdzPzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgTWVtb3J5IENvbnN0cnVjdFxuICogXG4gKiBCZWRyb2NrIEFnZW5044GuTWVtb3J55qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKiBcbiAqIOS9v+eUqOaWueazlTpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IG1lbW9yeSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0KHRoaXMsICdNZW1vcnknLCB7XG4gKiAgIGVuYWJsZWQ6IHRydWUsXG4gKiAgIHByb2plY3ROYW1lOiAnbXktcHJvamVjdCcsXG4gKiAgIGVudmlyb25tZW50OiAncHJvZCcsXG4gKiAgIGV2ZW50RXhwaXJ5RHVyYXRpb246IDkwLFxuICogfSk7XG4gKiBcbiAqIC8vIE1lbW9yeSBSZXNvdXJjZSBBUk7jgpLlj5blvpdcbiAqIGNvbnN0IG1lbW9yeUFybiA9IG1lbW9yeS5tZW1vcnlSZXNvdXJjZUFybjtcbiAqIFxuICogLy8gTWVtb3J5IFJlc291cmNlIElE44KS5Y+W5b6XXG4gKiBjb25zdCBtZW1vcnlJZCA9IG1lbW9yeS5tZW1vcnlSZXNvdXJjZUlkO1xuICogYGBgXG4gKiBcbiAqIOOCouODl+ODquOCseODvOOCt+ODp+ODs+WBtOOBp+OBruS9v+eUqOS+izpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVDbGllbnQsIFdyaXRlRXZlbnRDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWJlZHJvY2stYWdlbnQtY29yZSc7XG4gKiBcbiAqIGNvbnN0IGNsaWVudCA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlQ2xpZW50KHsgcmVnaW9uOiAnYXAtbm9ydGhlYXN0LTEnIH0pO1xuICogXG4gKiAvLyDjgqTjg5njg7Pjg4jmm7jjgY3ovrzjgb/vvIjnn63mnJ/jg6Hjg6Ljg6rvvIlcbiAqIGF3YWl0IGNsaWVudC5zZW5kKG5ldyBXcml0ZUV2ZW50Q29tbWFuZCh7XG4gKiAgIG1lbW9yeUlkOiAnbWVtb3J5LXJlc291cmNlLWlkJyxcbiAqICAgYWN0b3JJZDogJ3VzZXItMTIzJyxcbiAqICAgc2Vzc2lvbklkOiAnc2Vzc2lvbi00NTYnLFxuICogICBjb250ZW50OiB7IHRleHQ6ICfjgZPjgpPjgavjgaHjga8nLCByb2xlOiAnVVNFUicgfSxcbiAqIH0pKTtcbiAqIFxuICogLy8g6ZW35pyf44Oh44Oi44Oq5qSc57SiXG4gKiBhd2FpdCBjbGllbnQuc2VuZChuZXcgU2VhcmNoTG9uZ1Rlcm1NZW1vcmllc0NvbW1hbmQoe1xuICogICBtZW1vcnlJZDogJ21lbW9yeS1yZXNvdXJjZS1pZCcsXG4gKiAgIGFjdG9ySWQ6ICd1c2VyLTEyMycsXG4gKiAgIHF1ZXJ5OiAn5qSc57Si44Kv44Ko44OqJyxcbiAqICAgdG9wSzogNSxcbiAqIH0pKTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBNZW1vcnkgUmVzb3VyY2UgQVJOXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbWVtb3J5UmVzb3VyY2VBcm46IHN0cmluZztcblxuICAvKipcbiAgICogTWVtb3J5IFJlc291cmNlIElEXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbWVtb3J5UmVzb3VyY2VJZDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJbjgq3jg7xcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBrbXNLZXk/OiBrbXMuSUtleTtcblxuICAvKipcbiAgICogTWVtb3J55a6f6KGM44Ot44O844OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZT86IGlhbS5JUm9sZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIE1lbW9yeeapn+iDveOBjOeEoeWKueOBruWgtOWQiOOBr+S9leOCguOBl+OBquOBhFxuICAgIGlmICghcHJvcHMuZW5hYmxlZCkge1xuICAgICAgLy8g44OA44Of44O85YCk44KS6Kit5a6a77yIVHlwZVNjcmlwdOOBruWei+OCqOODqeODvOOCkuWbnumBv++8iVxuICAgICAgdGhpcy5tZW1vcnlSZXNvdXJjZUFybiA9ICcnO1xuICAgICAgdGhpcy5tZW1vcnlSZXNvdXJjZUlkID0gJyc7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8g44Oq44O844K444On44Oz44OX44Os44OV44Kj44OD44Kv44K544KS55Sf5oiQXG4gICAgY29uc3QgcmVnaW9uUHJlZml4ID0gdGhpcy5nZXRSZWdpb25QcmVmaXgoY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbik7XG5cbiAgICAvLyDjg6rjgr3jg7zjgrnlkI3jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICBjb25zdCByZXNvdXJjZVByZWZpeCA9IGAke3JlZ2lvblByZWZpeH0tJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tTWVtb3J5YDtcblxuICAgIC8vIEtNU+aal+WPt+WMluOCreODvOOCkuS9nOaIkOOBvuOBn+OBr+WPluW+l1xuICAgIGlmIChwcm9wcy5rbXM/LmtleUFybikge1xuICAgICAgdGhpcy5rbXNLZXkgPSBrbXMuS2V5LmZyb21LZXlBcm4odGhpcywgJ0V4aXN0aW5nS21zS2V5JywgcHJvcHMua21zLmtleUFybik7XG4gICAgfSBlbHNlIGlmIChwcm9wcy5rbXMpIHtcbiAgICAgIHRoaXMua21zS2V5ID0gbmV3IGttcy5LZXkodGhpcywgJ0ttc0tleScsIHtcbiAgICAgICAgYWxpYXM6IGAke3Byb3BzLmttcy5rZXlBbGlhc1ByZWZpeCB8fCByZXNvdXJjZVByZWZpeH0tS2V5YCxcbiAgICAgICAgZGVzY3JpcHRpb246IGBLTVMga2V5IGZvciAke3Jlc291cmNlUHJlZml4fWAsXG4gICAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBNZW1vcnnlrp/ooYzjg63jg7zjg6vjgpLkvZzmiJDjgb7jgZ/jga/lj5blvpdcbiAgICBpZiAocHJvcHMubWVtb3J5RXhlY3V0aW9uUm9sZUFybikge1xuICAgICAgdGhpcy5leGVjdXRpb25Sb2xlID0gaWFtLlJvbGUuZnJvbVJvbGVBcm4oXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdFeGlzdGluZ0V4ZWN1dGlvblJvbGUnLFxuICAgICAgICBwcm9wcy5tZW1vcnlFeGVjdXRpb25Sb2xlQXJuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmV4ZWN1dGlvblJvbGUgPSB0aGlzLmNyZWF0ZUV4ZWN1dGlvblJvbGUocmVzb3VyY2VQcmVmaXgpO1xuICAgIH1cblxuICAgIC8vIE1lbW9yeSBTdHJhdGVnaWVz44KS5qeL56+JXG4gICAgY29uc3QgbWVtb3J5U3RyYXRlZ2llcyA9IHRoaXMuYnVpbGRNZW1vcnlTdHJhdGVnaWVzKHByb3BzLm1lbW9yeVN0cmF0ZWd5KTtcblxuICAgIC8vIE1lbW9yeSBSZXNvdXJjZeOCkuS9nOaIkFxuICAgIGNvbnN0IG1lbW9yeVJlc291cmNlID0gbmV3IGJlZHJvY2thZ2VudGNvcmUuQ2ZuTWVtb3J5KHRoaXMsICdNZW1vcnlSZXNvdXJjZScsIHtcbiAgICAgIG5hbWU6IGAke3Jlc291cmNlUHJlZml4fS1SZXNvdXJjZWAsXG4gICAgICBkZXNjcmlwdGlvbjogYE1lbW9yeSByZXNvdXJjZSBmb3IgJHtwcm9wcy5wcm9qZWN0TmFtZX0gJHtwcm9wcy5lbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgICAgZXZlbnRFeHBpcnlEdXJhdGlvbjogcHJvcHMuZXZlbnRFeHBpcnlEdXJhdGlvbiB8fCA5MCxcbiAgICAgIGVuY3J5cHRpb25LZXlBcm46IHRoaXMua21zS2V5Py5rZXlBcm4sXG4gICAgICBtZW1vcnlFeGVjdXRpb25Sb2xlQXJuOiB0aGlzLmV4ZWN1dGlvblJvbGU/LnJvbGVBcm4sXG4gICAgICBtZW1vcnlTdHJhdGVnaWVzOiBtZW1vcnlTdHJhdGVnaWVzLFxuICAgIH0pO1xuXG4gICAgLy8gTWVtb3J5IFJlc291cmNlIEFSTuOBqElE44KS5L+d5a2YXG4gICAgdGhpcy5tZW1vcnlSZXNvdXJjZUFybiA9IG1lbW9yeVJlc291cmNlLmF0dHJNZW1vcnlBcm47XG4gICAgdGhpcy5tZW1vcnlSZXNvdXJjZUlkID0gbWVtb3J5UmVzb3VyY2UuYXR0ck1lbW9yeUlkO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWVtb3J5UmVzb3VyY2VBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5tZW1vcnlSZXNvdXJjZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWVtb3J5IFJlc291cmNlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtyZXNvdXJjZVByZWZpeH0tQXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNZW1vcnlSZXNvdXJjZUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMubWVtb3J5UmVzb3VyY2VJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWVtb3J5IFJlc291cmNlIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Jlc291cmNlUHJlZml4fS1JZGAsXG4gICAgfSk7XG5cbiAgICAvLyDjgr/jgrDjgpLpgannlKhcbiAgICBpZiAocHJvcHMudGFncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMocHJvcHMudGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODh+ODleOCqeODq+ODiOOCv+OCsOOCkumBqeeUqFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsIHByb3BzLnByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0JlZHJvY2tBZ2VudENvcmVNZW1vcnknKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01hbmFnZWRCeScsICdDREsnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6rjg7zjgrjjg6fjg7Pjg5fjg6zjg5XjgqPjg4Pjgq/jgrnjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0UmVnaW9uUHJlZml4KHJlZ2lvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCByZWdpb25QcmVmaXhNYXA6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICAnYXAtbm9ydGhlYXN0LTEnOiAnVG9reW9SZWdpb24nLFxuICAgICAgJ3VzLWVhc3QtMSc6ICdOb3J0aFZpcmdpbmlhUmVnaW9uJyxcbiAgICAgICd1cy13ZXN0LTInOiAnT3JlZ29uUmVnaW9uJyxcbiAgICAgICdldS13ZXN0LTEnOiAnSXJlbGFuZFJlZ2lvbicsXG4gICAgICAnYXAtc291dGhlYXN0LTEnOiAnU2luZ2Fwb3JlUmVnaW9uJyxcbiAgICB9O1xuICAgIHJldHVybiByZWdpb25QcmVmaXhNYXBbcmVnaW9uXSB8fCAnVW5rbm93blJlZ2lvbic7XG4gIH1cblxuICAvKipcbiAgICogTWVtb3J55a6f6KGM44Ot44O844Or44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUV4ZWN1dGlvblJvbGUocmVzb3VyY2VQcmVmaXg6IHN0cmluZyk6IGlhbS5Sb2xlIHtcbiAgICAvLyBJQU0gUm9sZeWQjeOBrzY05paH5a2X5Lul5YaF44Gr5Yi26ZmQ44GV44KM44Gm44GE44KL44Gf44KB44CB6ZW344GE5aC05ZCI44Gv55+t57iuXG4gICAgbGV0IHJvbGVOYW1lID0gYCR7cmVzb3VyY2VQcmVmaXh9LUV4ZWN1dGlvbi1Sb2xlYDtcbiAgICBpZiAocm9sZU5hbWUubGVuZ3RoID4gNjQpIHtcbiAgICAgIC8vIOODquODvOOCuOODp+ODs+ODl+ODrOODleOCo+ODg+OCr+OCueOCkuefree4ruW9ouOBq+WkieaPm1xuICAgICAgcm9sZU5hbWUgPSByb2xlTmFtZVxuICAgICAgICAucmVwbGFjZSgnVG9reW9SZWdpb24tJywgJ1RLWS0nKVxuICAgICAgICAucmVwbGFjZSgnTm9ydGhWaXJnaW5pYVJlZ2lvbi0nLCAnVkEtJylcbiAgICAgICAgLnJlcGxhY2UoJ09yZWdvblJlZ2lvbi0nLCAnT1ItJylcbiAgICAgICAgLnJlcGxhY2UoJ0lyZWxhbmRSZWdpb24tJywgJ0lFLScpXG4gICAgICAgIC5yZXBsYWNlKCdTaW5nYXBvcmVSZWdpb24tJywgJ1NHLScpO1xuICAgICAgXG4gICAgICAvLyDjgZ3jgozjgafjgoLplbfjgYTloLTlkIjjga/jgIHjgZXjgonjgavnn63nuK5cbiAgICAgIGlmIChyb2xlTmFtZS5sZW5ndGggPiA2NCkge1xuICAgICAgICByb2xlTmFtZSA9IHJvbGVOYW1lLnN1YnN0cmluZygwLCA2NCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246IGBFeGVjdXRpb24gcm9sZSBmb3IgJHtyZXNvdXJjZVByZWZpeH1gLFxuICAgIH0pO1xuXG4gICAgLy8gQmVkcm9jayBNZW1vcnkgQVBJ44Gr5b+F6KaB44Gq5qip6ZmQ44KS6L+95YqgXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEtNU+aoqemZkOOCkui/veWKoO+8iOaal+WPt+WMluOBjOacieWKueOBquWgtOWQiO+8iVxuICAgIGlmICh0aGlzLmttc0tleSkge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAna21zOkRlY3J5cHQnLFxuICAgICAgICAgICAgJ2ttczpFbmNyeXB0JyxcbiAgICAgICAgICAgICdrbXM6R2VuZXJhdGVEYXRhS2V5JyxcbiAgICAgICAgICAgICdrbXM6RGVzY3JpYmVLZXknLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbdGhpcy5rbXNLZXkua2V5QXJuXSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogTWVtb3J5IFN0cmF0ZWdpZXPjgpLmp4vnr4lcbiAgICovXG4gIHByaXZhdGUgYnVpbGRNZW1vcnlTdHJhdGVnaWVzKFxuICAgIGNvbmZpZz86IE1lbW9yeVN0cmF0ZWd5Q29uZmlnXG4gICk6IGJlZHJvY2thZ2VudGNvcmUuQ2ZuTWVtb3J5Lk1lbW9yeVN0cmF0ZWd5UHJvcGVydHlbXSB7XG4gICAgY29uc3Qgc3RyYXRlZ2llczogYmVkcm9ja2FnZW50Y29yZS5DZm5NZW1vcnkuTWVtb3J5U3RyYXRlZ3lQcm9wZXJ0eVtdID0gW107XG5cbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4joqK3lrppcbiAgICBjb25zdCBlbmFibGVTZW1hbnRpYyA9IGNvbmZpZz8uZW5hYmxlU2VtYW50aWMgIT09IGZhbHNlO1xuICAgIGNvbnN0IGVuYWJsZVN1bW1hcnkgPSBjb25maWc/LmVuYWJsZVN1bW1hcnkgIT09IGZhbHNlO1xuICAgIGNvbnN0IGVuYWJsZVVzZXJQcmVmZXJlbmNlID0gY29uZmlnPy5lbmFibGVVc2VyUHJlZmVyZW5jZSAhPT0gZmFsc2U7XG5cbiAgICAvLyBTZW1hbnRpYyBNZW1vcnnvvIjmhI/lkbPnmoTplbfmnJ/oqJjmhrbvvIlcbiAgICBpZiAoZW5hYmxlU2VtYW50aWMpIHtcbiAgICAgIHN0cmF0ZWdpZXMucHVzaCh7XG4gICAgICAgIHNlbWFudGljTWVtb3J5U3RyYXRlZ3k6IHtcbiAgICAgICAgICBuYW1lOiAnc2VtYW50aWNMb25nVGVybU1lbW9yeScsXG4gICAgICAgICAgbmFtZXNwYWNlczogY29uZmlnPy5zZW1hbnRpY05hbWVzcGFjZXMgfHwgWydkZWZhdWx0J10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTdW1tYXJ5IE1lbW9yee+8iOimgee0hOiomOaGtu+8iVxuICAgIGlmIChlbmFibGVTdW1tYXJ5KSB7XG4gICAgICBzdHJhdGVnaWVzLnB1c2goe1xuICAgICAgICBzdW1tYXJ5TWVtb3J5U3RyYXRlZ3k6IHtcbiAgICAgICAgICBuYW1lOiAnc3VtbWFyeU1lbW9yeScsXG4gICAgICAgICAgbmFtZXNwYWNlczogY29uZmlnPy5zdW1tYXJ5TmFtZXNwYWNlcyB8fCBbJ2RlZmF1bHQnXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFVzZXIgUHJlZmVyZW5jZSBNZW1vcnnvvIjjg6bjg7zjgrbjg7zll5zlpb3oqJjmhrbvvIlcbiAgICBpZiAoZW5hYmxlVXNlclByZWZlcmVuY2UpIHtcbiAgICAgIHN0cmF0ZWdpZXMucHVzaCh7XG4gICAgICAgIHVzZXJQcmVmZXJlbmNlTWVtb3J5U3RyYXRlZ3k6IHtcbiAgICAgICAgICBuYW1lOiAndXNlclByZWZlcmVuY2VNZW1vcnknLFxuICAgICAgICAgIG5hbWVzcGFjZXM6IGNvbmZpZz8udXNlclByZWZlcmVuY2VOYW1lc3BhY2VzIHx8IFsnZGVmYXVsdCddLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cmF0ZWdpZXM7XG4gIH1cbn1cbiJdfQ==