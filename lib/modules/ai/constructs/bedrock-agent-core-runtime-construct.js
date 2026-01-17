"use strict";
/**
 * Amazon Bedrock AgentCore Runtime Construct
 *
 * このConstructは、Bedrock Agentのイベント駆動実行を提供します。
 * Lambda関数、EventBridge、自動スケーリング、KMS暗号化を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-03
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
exports.BedrockAgentCoreRuntimeConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const constructs_1 = require("constructs");
/**
 * Amazon Bedrock AgentCore Runtime Construct
 *
 * このConstructは、以下の機能を提供します：
 * - Lambda関数によるイベント駆動実行
 * - EventBridgeによる非同期処理
 * - 自動スケーリング（Reserved/Provisioned Concurrency）
 * - KMS暗号化による環境変数保護
 * - DLQ（Dead Letter Queue）によるエラーハンドリング
 * - FSx for ONTAP + S3 Access Points統合（Memory機能）
 */
class BedrockAgentCoreRuntimeConstruct extends constructs_1.Construct {
    /**
     * Lambda関数
     */
    lambdaFunction;
    /**
     * EventBridge Rule
     */
    eventRule;
    /**
     * KMS Key
     */
    kmsKey;
    /**
     * Dead Letter Queue
     */
    deadLetterQueue;
    /**
     * IAM Role（Lambda実行ロール）
     */
    executionRole;
    /**
     * FSx for ONTAP + S3 Access Point（Memory機能用）
     * Phase 1未実装: FSx ONTAP統合は将来実装予定
     */
    // public readonly memoryAccessPoint?: FsxOntapS3AccessPointConstruct;
    constructor(scope, id, props) {
        super(scope, id);
        // Runtime機能が無効の場合は何もしない
        if (!props.enabled) {
            return;
        }
        // KMS Key作成（有効な場合）
        if (props.kmsConfig?.enabled !== false) {
            this.kmsKey = this.createKmsKey(props);
        }
        // Dead Letter Queue作成
        this.deadLetterQueue = this.createDeadLetterQueue(props);
        // IAM Role作成
        this.executionRole = this.createExecutionRole(props);
        // FSx for ONTAP + S3 Access Point作成（Memory機能用）
        // Phase 1未実装: FSx ONTAP統合は将来実装予定
        // if (props.fsxOntapConfig) {
        //   this.memoryAccessPoint = this.createMemoryAccessPoint(props);
        // }
        // Lambda関数作成
        this.lambdaFunction = this.createLambdaFunction(props);
        // FSx for ONTAP + S3 Access Pointsへのアクセス権限付与
        // Phase 1未実装: FSx ONTAP統合は将来実装予定
        // if (this.memoryAccessPoint && this.lambdaFunction) {
        //   this.memoryAccessPoint.grantReadWrite(this.lambdaFunction);
        // }
        // EventBridge Rule作成（有効な場合）
        if (props.eventBridgeConfig?.enabled !== false) {
            this.eventRule = this.createEventBridgeRule(props);
        }
        // 自動スケーリング設定
        this.configureAutoScaling(props);
        // タグ付け
        cdk.Tags.of(this).add('Component', 'BedrockAgentCoreRuntime');
        cdk.Tags.of(this).add('Project', props.projectName);
        cdk.Tags.of(this).add('Environment', props.environment);
    }
    /**
     * 自動スケーリング設定
     */
    configureAutoScaling(props) {
        if (!this.lambdaFunction) {
            return;
        }
        // Provisioned Concurrency設定（有効な場合）
        if (props.lambdaConfig?.provisionedConcurrentExecutions !== undefined) {
            const version = this.lambdaFunction.currentVersion;
            const alias = new lambda.Alias(this, 'LiveAlias', {
                aliasName: 'live',
                version,
                provisionedConcurrentExecutions: props.lambdaConfig.provisionedConcurrentExecutions,
                description: 'Live alias with provisioned concurrency for predictable performance',
            });
            // Provisioned Concurrencyの自動スケーリング設定
            const target = alias.addAutoScaling({
                minCapacity: props.lambdaConfig.provisionedConcurrentExecutions,
                maxCapacity: props.lambdaConfig.provisionedConcurrentExecutions * 2,
            });
            // CPU使用率ベースのスケーリング
            target.scaleOnUtilization({
                utilizationTarget: 0.7, // 70%の使用率を目標
            });
            // スケジュールベースのスケーリング（オプション）
            // 例: 平日の営業時間中は高い並行実行数を維持
            // target.scaleOnSchedule('ScaleUpInBusinessHours', {
            //   schedule: appscaling.Schedule.cron({ hour: '9', minute: '0', weekDay: 'MON-FRI' }),
            //   minCapacity: props.lambdaConfig.provisionedConcurrentExecutions * 2,
            // });
            // target.scaleOnSchedule('ScaleDownOutsideBusinessHours', {
            //   schedule: appscaling.Schedule.cron({ hour: '18', minute: '0', weekDay: 'MON-FRI' }),
            //   minCapacity: props.lambdaConfig.provisionedConcurrentExecutions,
            // });
        }
    }
    /**
     * FSx for ONTAP + S3 Access Point作成（Memory機能用）
     * Phase 1未実装: FSx ONTAP統合は将来実装予定
     */
    // private createMemoryAccessPoint(props: BedrockAgentCoreRuntimeConstructProps): FsxOntapS3AccessPointConstruct {
    //   if (!props.fsxOntapConfig) {
    //     throw new Error('fsxOntapConfig is required to create Memory Access Point');
    //   }
    //
    //   return new FsxOntapS3AccessPointConstruct(this, 'MemoryAccessPoint', {
    //     fsxFileSystemId: props.fsxOntapConfig.fileSystemId,
    //     volumePath: props.fsxOntapConfig.volumePath || '/memory-volume',
    //     purpose: 'memory',
    //     vpc: props.fsxOntapConfig.vpc,
    //     privateSubnets: props.fsxOntapConfig.privateSubnets,
    //     projectName: props.projectName,
    //     environment: props.environment,
    //     kmsKey: this.kmsKey,
    //   });
    // }
    /**
     * KMS Key作成
     */
    createKmsKey(props) {
        if (props.kmsConfig?.kmsKey) {
            return props.kmsConfig.kmsKey;
        }
        return new kms.Key(this, 'KmsKey', {
            description: `KMS Key for ${props.projectName} Bedrock AgentCore Runtime`,
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
    }
    /**
     * Dead Letter Queue作成
     */
    createDeadLetterQueue(props) {
        return new sqs.Queue(this, 'DeadLetterQueue', {
            queueName: `${props.projectName}-${props.environment}-runtime-dlq`,
            retentionPeriod: cdk.Duration.days(14),
            encryption: this.kmsKey ? sqs.QueueEncryption.KMS : sqs.QueueEncryption.SQS_MANAGED,
            encryptionMasterKey: this.kmsKey,
        });
    }
    /**
     * IAM Role作成
     */
    createExecutionRole(props) {
        const role = new iam.Role(this, 'ExecutionRole', {
            roleName: `${props.projectName}-${props.environment}-runtime-execution-role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for Bedrock AgentCore Runtime Lambda function',
        });
        // 基本的なLambda実行権限
        role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        // VPC統合の場合
        if (props.lambdaConfig?.vpcConfig) {
            role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
        }
        // Bedrock実行権限
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeAgent',
                'bedrock:InvokeModel',
                'bedrock:GetAgent',
                'bedrock:ListAgents',
            ],
            resources: ['*'],
        }));
        // KMS権限
        if (this.kmsKey) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['kms:Decrypt', 'kms:DescribeKey'],
                resources: [this.kmsKey.keyArn],
            }));
        }
        // DLQ権限
        if (this.deadLetterQueue) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['sqs:SendMessage'],
                resources: [this.deadLetterQueue.queueArn],
            }));
        }
        return role;
    }
    /**
     * Lambda関数作成
     */
    createLambdaFunction(props) {
        const environment = {
            PROJECT_NAME: props.projectName,
            ENVIRONMENT: props.environment,
            BEDROCK_REGION: props.bedrockAgentConfig?.region || 'ap-northeast-1',
            ...(props.lambdaConfig?.environment || {}),
        };
        // Bedrock Agent設定
        if (props.bedrockAgentConfig?.agentId) {
            environment.BEDROCK_AGENT_ID = props.bedrockAgentConfig.agentId;
        }
        if (props.bedrockAgentConfig?.agentAliasId) {
            environment.BEDROCK_AGENT_ALIAS_ID = props.bedrockAgentConfig.agentAliasId;
        }
        // FSx for ONTAP + S3 Access Point ARN設定（Memory機能用）
        // Phase 1未実装: FSx ONTAP統合は将来実装予定
        // if (this.memoryAccessPoint) {
        //   environment.MEMORY_ACCESS_POINT_ARN = this.memoryAccessPoint.accessPointArn;
        // }
        const fn = new lambda.Function(this, 'Function', {
            functionName: `${props.projectName}-${props.environment}-runtime-function`,
            runtime: props.lambdaConfig?.runtime || lambda.Runtime.NODEJS_22_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/agent-core-runtime', {
                bundling: {
                    image: props.lambdaConfig?.runtime?.bundlingImage || lambda.Runtime.NODEJS_22_X.bundlingImage,
                    command: [
                        'bash',
                        '-c',
                        [
                            'npm install',
                            'npm run build',
                            'cp -r dist/* /asset-output/',
                            'cp package.json /asset-output/',
                            'cd /asset-output',
                            'npm install --omit=dev',
                        ].join(' && '),
                    ],
                    user: 'root',
                },
            }),
            timeout: cdk.Duration.seconds(props.lambdaConfig?.timeout || 30),
            memorySize: props.lambdaConfig?.memorySize || 2048,
            environment,
            environmentEncryption: this.kmsKey,
            role: this.executionRole,
            deadLetterQueue: this.deadLetterQueue,
            reservedConcurrentExecutions: props.lambdaConfig?.reservedConcurrentExecutions,
            vpc: props.lambdaConfig?.vpcConfig?.vpc,
            vpcSubnets: props.lambdaConfig?.vpcConfig?.subnetSelection,
            securityGroups: props.lambdaConfig?.vpcConfig?.securityGroups,
            description: 'Bedrock AgentCore Runtime Lambda function for event-driven execution with FSx for ONTAP + S3 Access Points integration',
        });
        return fn;
    }
    /**
     * EventBridge Rule作成
     */
    createEventBridgeRule(props) {
        // デフォルトのイベントパターン
        const defaultEventPattern = {
            source: ['bedrock.agent.runtime'],
            detailType: ['Agent Invocation Request'],
            detail: {
                agentId: [{ exists: true }],
                sessionId: [{ exists: true }],
            },
        };
        const rule = new events.Rule(this, 'EventRule', {
            ruleName: `${props.projectName}-${props.environment}-runtime-rule`,
            description: 'EventBridge rule for Bedrock AgentCore Runtime - triggers Lambda function for agent invocations',
            eventPattern: props.eventBridgeConfig?.eventPattern || defaultEventPattern,
            schedule: props.eventBridgeConfig?.schedule,
            enabled: true,
        });
        // Lambda関数をターゲットに追加
        if (this.lambdaFunction) {
            rule.addTarget(new targets.LambdaFunction(this.lambdaFunction, {
                deadLetterQueue: this.deadLetterQueue,
                retryAttempts: 3, // リトライ回数を3回に増加
                maxEventAge: cdk.Duration.hours(24), // 最大イベント有効期限を24時間に設定
            }));
        }
        return rule;
    }
}
exports.BedrockAgentCoreRuntimeConstruct = BedrockAgentCoreRuntimeConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseURBQTJDO0FBRTNDLDJDQUF1QztBQTZKdkM7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWEsZ0NBQWlDLFNBQVEsc0JBQVM7SUFDN0Q7O09BRUc7SUFDYSxjQUFjLENBQW1CO0lBRWpEOztPQUVHO0lBQ2EsU0FBUyxDQUFlO0lBRXhDOztPQUVHO0lBQ2EsTUFBTSxDQUFZO0lBRWxDOztPQUVHO0lBQ2EsZUFBZSxDQUFhO0lBRTVDOztPQUVHO0lBQ2EsYUFBYSxDQUFZO0lBRXpDOzs7T0FHRztJQUNILHNFQUFzRTtJQUV0RSxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRDO1FBQ3BGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsT0FBTztRQUNULENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFLE9BQU8sS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUN2QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVELHNCQUFzQjtRQUN0QixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV6RCxhQUFhO1FBQ2IsSUFB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IEJlZHJvY2sgQWdlbnRDb3JlIFJ1bnRpbWUgQ29uc3RydWN0XG4gKiBcbiAqIOOBk+OBrkNvbnN0cnVjdOOBr+OAgUJlZHJvY2sgQWdlbnTjga7jgqTjg5njg7Pjg4jpp4bli5Xlrp/ooYzjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIExhbWJkYemWouaVsOOAgUV2ZW50QnJpZGdl44CB6Ieq5YuV44K544Kx44O844Oq44Oz44Kw44CBS01T5pqX5Y+35YyW44KS57Wx5ZCI44GX44G+44GZ44CCXG4gKiBcbiAqIEBhdXRob3IgS2lybyBBSVxuICogQGRhdGUgMjAyNi0wMS0wM1xuICogQHZlcnNpb24gMS4wLjBcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG4vLyBpbXBvcnQgeyBGc3hPbnRhcFMzQWNjZXNzUG9pbnRDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi8uLi9zdG9yYWdlL2NvbnN0cnVjdHMvZnN4LW9udGFwLXMzLWFjY2Vzcy1wb2ludC1jb25zdHJ1Y3QnO1xuXG4vKipcbiAqIEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN044Gu44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3RQcm9wcyB7XG4gIC8qKlxuICAgKiBSdW50aW1l5qmf6IO944KS5pyJ5Yq55YyW44GZ44KL44GL44Gp44GG44GLXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQje+8iGRldiwgc3RhZ2luZywgcHJvZOetie+8iVxuICAgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBsYW1iZGFDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICogTGFtYmRh6Zai5pWw44Gu44K/44Kk44Og44Ki44Km44OI77yI56eS77yJXG4gICAgICogQGRlZmF1bHQgMzBcbiAgICAgKi9cbiAgICByZWFkb25seSB0aW1lb3V0PzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICogTGFtYmRh6Zai5pWw44Gu44Oh44Oi44Oq44K144Kk44K677yITULvvIlcbiAgICAgKiBAZGVmYXVsdCAyMDQ4XG4gICAgICovXG4gICAgcmVhZG9ubHkgbWVtb3J5U2l6ZT86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIExhbWJkYemWouaVsOOBruODqeODs+OCv+OCpOODoFxuICAgICAqIEBkZWZhdWx0IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YXG4gICAgICovXG4gICAgcmVhZG9ubHkgcnVudGltZT86IGxhbWJkYS5SdW50aW1lO1xuXG4gICAgLyoqXG4gICAgICog55Kw5aKD5aSJ5pWwXG4gICAgICovXG4gICAgcmVhZG9ubHkgZW52aXJvbm1lbnQ/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuXG4gICAgLyoqXG4gICAgICogVlBD6Kit5a6aXG4gICAgICovXG4gICAgcmVhZG9ubHkgdnBjQ29uZmlnPzoge1xuICAgICAgcmVhZG9ubHkgdnBjOiBlYzIuSVZwYztcbiAgICAgIHJlYWRvbmx5IHN1Ym5ldFNlbGVjdGlvbj86IGVjMi5TdWJuZXRTZWxlY3Rpb247XG4gICAgICByZWFkb25seSBzZWN1cml0eUdyb3Vwcz86IGVjMi5JU2VjdXJpdHlHcm91cFtdO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXNlcnZlZCBDb25jdXJyZW5jeeioreWumlxuICAgICAqIEBkZWZhdWx0IHVuZGVmaW5lZO+8iOWItumZkOOBquOBl++8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM/OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiBQcm92aXNpb25lZCBDb25jdXJyZW5jeeioreWumlxuICAgICAqIEBkZWZhdWx0IHVuZGVmaW5lZO+8iOeEoeWKue+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHByb3Zpc2lvbmVkQ29uY3VycmVudEV4ZWN1dGlvbnM/OiBudW1iZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIEV2ZW50QnJpZGdl6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBldmVudEJyaWRnZUNvbmZpZz86IHtcbiAgICAvKipcbiAgICAgKiBFdmVudEJyaWRnZSBSdWxl44KS5pyJ5Yq55YyW44GZ44KL44GL44Gp44GG44GLXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIHJlYWRvbmx5IGVuYWJsZWQ/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kk44OZ44Oz44OI44OR44K/44O844OzXG4gICAgICovXG4gICAgcmVhZG9ubHkgZXZlbnRQYXR0ZXJuPzogZXZlbnRzLkV2ZW50UGF0dGVybjtcblxuICAgIC8qKlxuICAgICAqIOOCueOCseOCuOODpeODvOODq+W8j++8iGNyb27lvI/jgb7jgZ/jga9yYXRl5byP77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgc2NoZWR1bGU/OiBldmVudHMuU2NoZWR1bGU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEtNU+aal+WPt+WMluioreWumlxuICAgKi9cbiAgcmVhZG9ubHkga21zQ29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIEtNU+aal+WPt+WMluOCkuacieWKueWMluOBmeOCi+OBi+OBqeOBhuOBi1xuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBlbmFibGVkPzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOaXouWtmOOBrktNUyBLZXnjgpLkvb/nlKjjgZnjgovloLTlkIhcbiAgICAgKi9cbiAgICByZWFkb25seSBrbXNLZXk/OiBrbXMuSUtleTtcbiAgfTtcblxuICAvKipcbiAgICogQmVkcm9jayBBZ2VudOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgYmVkcm9ja0FnZW50Q29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIEJlZHJvY2sgQWdlbnQgSURcbiAgICAgKi9cbiAgICByZWFkb25seSBhZ2VudElkPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogQmVkcm9jayBBZ2VudCBBbGlhcyBJRFxuICAgICAqL1xuICAgIHJlYWRvbmx5IGFnZW50QWxpYXNJZD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIEJlZHJvY2vjg6rjg7zjgrjjg6fjg7NcbiAgICAgKiBAZGVmYXVsdCAnYXAtbm9ydGhlYXN0LTEnXG4gICAgICovXG4gICAgcmVhZG9ubHkgcmVnaW9uPzogc3RyaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW50c+ioreWumu+8iE1lbW9yeeapn+iDveeUqO+8iVxuICAgKi9cbiAgcmVhZG9ubHkgZnN4T250YXBDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICogRlN4IGZvciBPTlRBUOODleOCoeOCpOODq+OCt+OCueODhuODoElEXG4gICAgICovXG4gICAgcmVhZG9ubHkgZmlsZVN5c3RlbUlkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBNZW1vcnnjg5zjg6rjg6Xjg7zjg6Djg5HjgrlcbiAgICAgKiBAZGVmYXVsdCAnL21lbW9yeS12b2x1bWUnXG4gICAgICovXG4gICAgcmVhZG9ubHkgdm9sdW1lUGF0aD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFZQQ1xuICAgICAqL1xuICAgIHJlYWRvbmx5IHZwYzogZWMyLklWcGM7XG5cbiAgICAvKipcbiAgICAgKiDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4hcbiAgICAgKi9cbiAgICByZWFkb25seSBwcml2YXRlU3VibmV0czogZWMyLklTdWJuZXRbXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgUnVudGltZSBDb25zdHJ1Y3RcbiAqIFxuICog44GT44GuQ29uc3RydWN044Gv44CB5Lul5LiL44Gu5qmf6IO944KS5o+Q5L6b44GX44G+44GZ77yaXG4gKiAtIExhbWJkYemWouaVsOOBq+OCiOOCi+OCpOODmeODs+ODiOmnhuWLleWun+ihjFxuICogLSBFdmVudEJyaWRnZeOBq+OCiOOCi+mdnuWQjOacn+WHpueQhlxuICogLSDoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDvvIhSZXNlcnZlZC9Qcm92aXNpb25lZCBDb25jdXJyZW5jee+8iVxuICogLSBLTVPmmpflj7fljJbjgavjgojjgovnkrDlooPlpInmlbDkv53orbdcbiAqIC0gRExR77yIRGVhZCBMZXR0ZXIgUXVldWXvvInjgavjgojjgovjgqjjg6njg7zjg4/jg7Pjg4njg6rjg7PjgrBcbiAqIC0gRlN4IGZvciBPTlRBUCArIFMzIEFjY2VzcyBQb2ludHPntbHlkIjvvIhNZW1vcnnmqZ/og73vvIlcbiAqL1xuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqXG4gICAqIExhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYUZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8qKlxuICAgKiBFdmVudEJyaWRnZSBSdWxlXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXZlbnRSdWxlPzogZXZlbnRzLlJ1bGU7XG5cbiAgLyoqXG4gICAqIEtNUyBLZXlcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBrbXNLZXk/OiBrbXMuSUtleTtcblxuICAvKipcbiAgICogRGVhZCBMZXR0ZXIgUXVldWVcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBkZWFkTGV0dGVyUXVldWU/OiBzcXMuUXVldWU7XG5cbiAgLyoqXG4gICAqIElBTSBSb2xl77yITGFtYmRh5a6f6KGM44Ot44O844Or77yJXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZT86IGlhbS5Sb2xlO1xuXG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW5077yITWVtb3J55qmf6IO955So77yJXG4gICAqIFBoYXNlIDHmnKrlrp/oo4U6IEZTeCBPTlRBUOe1seWQiOOBr+WwhuadpeWun+ijheS6iOWumlxuICAgKi9cbiAgLy8gcHVibGljIHJlYWRvbmx5IG1lbW9yeUFjY2Vzc1BvaW50PzogRnN4T250YXBTM0FjY2Vzc1BvaW50Q29uc3RydWN0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIFJ1bnRpbWXmqZ/og73jgYznhKHlirnjga7loLTlkIjjga/kvZXjgoLjgZfjgarjgYRcbiAgICBpZiAoIXByb3BzLmVuYWJsZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBLTVMgS2V55L2c5oiQ77yI5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLmttc0NvbmZpZz8uZW5hYmxlZCAhPT0gZmFsc2UpIHtcbiAgICAgIHRoaXMua21zS2V5ID0gdGhpcy5jcmVhdGVLbXNLZXkocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIERlYWQgTGV0dGVyIFF1ZXVl5L2c5oiQXG4gICAgdGhpcy5kZWFkTGV0dGVyUXVldWUgPSB0aGlzLmNyZWF0ZURlYWRMZXR0ZXJRdWV1ZShwcm9wcyk7XG5cbiAgICAvLyBJQU0gUm9sZeS9nOaIkFxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IHRoaXMuY3JlYXRlRXhlY3V0aW9uUm9sZShwcm9wcyk7XG5cbiAgICAvLyBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW505L2c5oiQ77yITWVtb3J55qmf6IO955So77yJXG4gICAgLy8gUGhhc2UgMeacquWun+ijhTogRlN4IE9OVEFQ57Wx5ZCI44Gv5bCG5p2l5a6f6KOF5LqI5a6aXG4gICAgLy8gaWYgKHByb3BzLmZzeE9udGFwQ29uZmlnKSB7XG4gICAgLy8gICB0aGlzLm1lbW9yeUFjY2Vzc1BvaW50ID0gdGhpcy5jcmVhdGVNZW1vcnlBY2Nlc3NQb2ludChwcm9wcyk7XG4gICAgLy8gfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbiA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24ocHJvcHMpO1xuXG4gICAgLy8gRlN4IGZvciBPTlRBUCArIFMzIEFjY2VzcyBQb2ludHPjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDku5jkuI5cbiAgICAvLyBQaGFzZSAx5pyq5a6f6KOFOiBGU3ggT05UQVDntbHlkIjjga/lsIbmnaXlrp/oo4XkuojlrppcbiAgICAvLyBpZiAodGhpcy5tZW1vcnlBY2Nlc3NQb2ludCAmJiB0aGlzLmxhbWJkYUZ1bmN0aW9uKSB7XG4gICAgLy8gICB0aGlzLm1lbW9yeUFjY2Vzc1BvaW50LmdyYW50UmVhZFdyaXRlKHRoaXMubGFtYmRhRnVuY3Rpb24pO1xuICAgIC8vIH1cblxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGXkvZzmiJDvvIjmnInlirnjgarloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuZXZlbnRCcmlkZ2VDb25maWc/LmVuYWJsZWQgIT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmV2ZW50UnVsZSA9IHRoaXMuY3JlYXRlRXZlbnRCcmlkZ2VSdWxlKHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyDoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDoqK3lrppcbiAgICB0aGlzLmNvbmZpZ3VyZUF1dG9TY2FsaW5nKHByb3BzKTtcblxuICAgIC8vIOOCv+OCsOS7mOOBkVxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0JlZHJvY2tBZ2VudENvcmVSdW50aW1lJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgcHJvcHMucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICog6Ieq5YuV44K544Kx44O844Oq44Oz44Kw6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIGNvbmZpZ3VyZUF1dG9TY2FsaW5nKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdFByb3BzKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmxhbWJkYUZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUHJvdmlzaW9uZWQgQ29uY3VycmVuY3noqK3lrprvvIjmnInlirnjgarloLTlkIjvvIlcbiAgICBpZiAocHJvcHMubGFtYmRhQ29uZmlnPy5wcm92aXNpb25lZENvbmN1cnJlbnRFeGVjdXRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmxhbWJkYUZ1bmN0aW9uLmN1cnJlbnRWZXJzaW9uO1xuICAgICAgY29uc3QgYWxpYXMgPSBuZXcgbGFtYmRhLkFsaWFzKHRoaXMsICdMaXZlQWxpYXMnLCB7XG4gICAgICAgIGFsaWFzTmFtZTogJ2xpdmUnLFxuICAgICAgICB2ZXJzaW9uLFxuICAgICAgICBwcm92aXNpb25lZENvbmN1cnJlbnRFeGVjdXRpb25zOiBwcm9wcy5sYW1iZGFDb25maWcucHJvdmlzaW9uZWRDb25jdXJyZW50RXhlY3V0aW9ucyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdMaXZlIGFsaWFzIHdpdGggcHJvdmlzaW9uZWQgY29uY3VycmVuY3kgZm9yIHByZWRpY3RhYmxlIHBlcmZvcm1hbmNlJyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBQcm92aXNpb25lZCBDb25jdXJyZW5jeeOBruiHquWLleOCueOCseODvOODquODs+OCsOioreWumlxuICAgICAgY29uc3QgdGFyZ2V0ID0gYWxpYXMuYWRkQXV0b1NjYWxpbmcoe1xuICAgICAgICBtaW5DYXBhY2l0eTogcHJvcHMubGFtYmRhQ29uZmlnLnByb3Zpc2lvbmVkQ29uY3VycmVudEV4ZWN1dGlvbnMsXG4gICAgICAgIG1heENhcGFjaXR5OiBwcm9wcy5sYW1iZGFDb25maWcucHJvdmlzaW9uZWRDb25jdXJyZW50RXhlY3V0aW9ucyAqIDIsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ1BV5L2/55So546H44OZ44O844K544Gu44K544Kx44O844Oq44Oz44KwXG4gICAgICB0YXJnZXQuc2NhbGVPblV0aWxpemF0aW9uKHtcbiAgICAgICAgdXRpbGl6YXRpb25UYXJnZXQ6IDAuNywgLy8gNzAl44Gu5L2/55So546H44KS55uu5qiZXG4gICAgICB9KTtcblxuICAgICAgLy8g44K544Kx44K444Ol44O844Or44OZ44O844K544Gu44K544Kx44O844Oq44Oz44Kw77yI44Kq44OX44K344On44Oz77yJXG4gICAgICAvLyDkvos6IOW5s+aXpeOBruWWtualreaZgumWk+S4reOBr+mrmOOBhOS4puihjOWun+ihjOaVsOOCkue2reaMgVxuICAgICAgLy8gdGFyZ2V0LnNjYWxlT25TY2hlZHVsZSgnU2NhbGVVcEluQnVzaW5lc3NIb3VycycsIHtcbiAgICAgIC8vICAgc2NoZWR1bGU6IGFwcHNjYWxpbmcuU2NoZWR1bGUuY3Jvbih7IGhvdXI6ICc5JywgbWludXRlOiAnMCcsIHdlZWtEYXk6ICdNT04tRlJJJyB9KSxcbiAgICAgIC8vICAgbWluQ2FwYWNpdHk6IHByb3BzLmxhbWJkYUNvbmZpZy5wcm92aXNpb25lZENvbmN1cnJlbnRFeGVjdXRpb25zICogMixcbiAgICAgIC8vIH0pO1xuICAgICAgLy8gdGFyZ2V0LnNjYWxlT25TY2hlZHVsZSgnU2NhbGVEb3duT3V0c2lkZUJ1c2luZXNzSG91cnMnLCB7XG4gICAgICAvLyAgIHNjaGVkdWxlOiBhcHBzY2FsaW5nLlNjaGVkdWxlLmNyb24oeyBob3VyOiAnMTgnLCBtaW51dGU6ICcwJywgd2Vla0RheTogJ01PTi1GUkknIH0pLFxuICAgICAgLy8gICBtaW5DYXBhY2l0eTogcHJvcHMubGFtYmRhQ29uZmlnLnByb3Zpc2lvbmVkQ29uY3VycmVudEV4ZWN1dGlvbnMsXG4gICAgICAvLyB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRlN4IGZvciBPTlRBUCArIFMzIEFjY2VzcyBQb2ludOS9nOaIkO+8iE1lbW9yeeapn+iDveeUqO+8iVxuICAgKiBQaGFzZSAx5pyq5a6f6KOFOiBGU3ggT05UQVDntbHlkIjjga/lsIbmnaXlrp/oo4XkuojlrppcbiAgICovXG4gIC8vIHByaXZhdGUgY3JlYXRlTWVtb3J5QWNjZXNzUG9pbnQocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0UHJvcHMpOiBGc3hPbnRhcFMzQWNjZXNzUG9pbnRDb25zdHJ1Y3Qge1xuICAvLyAgIGlmICghcHJvcHMuZnN4T250YXBDb25maWcpIHtcbiAgLy8gICAgIHRocm93IG5ldyBFcnJvcignZnN4T250YXBDb25maWcgaXMgcmVxdWlyZWQgdG8gY3JlYXRlIE1lbW9yeSBBY2Nlc3MgUG9pbnQnKTtcbiAgLy8gICB9XG4gIC8vXG4gIC8vICAgcmV0dXJuIG5ldyBGc3hPbnRhcFMzQWNjZXNzUG9pbnRDb25zdHJ1Y3QodGhpcywgJ01lbW9yeUFjY2Vzc1BvaW50Jywge1xuICAvLyAgICAgZnN4RmlsZVN5c3RlbUlkOiBwcm9wcy5mc3hPbnRhcENvbmZpZy5maWxlU3lzdGVtSWQsXG4gIC8vICAgICB2b2x1bWVQYXRoOiBwcm9wcy5mc3hPbnRhcENvbmZpZy52b2x1bWVQYXRoIHx8ICcvbWVtb3J5LXZvbHVtZScsXG4gIC8vICAgICBwdXJwb3NlOiAnbWVtb3J5JyxcbiAgLy8gICAgIHZwYzogcHJvcHMuZnN4T250YXBDb25maWcudnBjLFxuICAvLyAgICAgcHJpdmF0ZVN1Ym5ldHM6IHByb3BzLmZzeE9udGFwQ29uZmlnLnByaXZhdGVTdWJuZXRzLFxuICAvLyAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAvLyAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAvLyAgICAga21zS2V5OiB0aGlzLmttc0tleSxcbiAgLy8gICB9KTtcbiAgLy8gfVxuXG4gIC8qKlxuICAgKiBLTVMgS2V55L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUttc0tleShwcm9wczogQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3RQcm9wcyk6IGttcy5JS2V5IHtcbiAgICBpZiAocHJvcHMua21zQ29uZmlnPy5rbXNLZXkpIHtcbiAgICAgIHJldHVybiBwcm9wcy5rbXNDb25maWcua21zS2V5O1xuICAgIH1cblxuICAgIHJldHVybiBuZXcga21zLktleSh0aGlzLCAnS21zS2V5Jywge1xuICAgICAgZGVzY3JpcHRpb246IGBLTVMgS2V5IGZvciAke3Byb3BzLnByb2plY3ROYW1lfSBCZWRyb2NrIEFnZW50Q29yZSBSdW50aW1lYCxcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlYWQgTGV0dGVyIFF1ZXVl5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZURlYWRMZXR0ZXJRdWV1ZShwcm9wczogQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3RQcm9wcyk6IHNxcy5RdWV1ZSB7XG4gICAgcmV0dXJuIG5ldyBzcXMuUXVldWUodGhpcywgJ0RlYWRMZXR0ZXJRdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXJ1bnRpbWUtZGxxYCxcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgZW5jcnlwdGlvbjogdGhpcy5rbXNLZXkgPyBzcXMuUXVldWVFbmNyeXB0aW9uLktNUyA6IHNxcy5RdWV1ZUVuY3J5cHRpb24uU1FTX01BTkFHRUQsXG4gICAgICBlbmNyeXB0aW9uTWFzdGVyS2V5OiB0aGlzLmttc0tleSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJQU0gUm9sZeS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFeGVjdXRpb25Sb2xlKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXJ1bnRpbWUtZXhlY3V0aW9uLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0V4ZWN1dGlvbiByb2xlIGZvciBCZWRyb2NrIEFnZW50Q29yZSBSdW50aW1lIExhbWJkYSBmdW5jdGlvbicsXG4gICAgfSk7XG5cbiAgICAvLyDln7rmnKznmoTjgapMYW1iZGHlrp/ooYzmqKnpmZBcbiAgICByb2xlLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKVxuICAgICk7XG5cbiAgICAvLyBWUEPntbHlkIjjga7loLTlkIhcbiAgICBpZiAocHJvcHMubGFtYmRhQ29uZmlnPy52cGNDb25maWcpIHtcbiAgICAgIHJvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZScpXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEJlZHJvY2vlrp/ooYzmqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudCcsXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jazpMaXN0QWdlbnRzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEtNU+aoqemZkFxuICAgIGlmICh0aGlzLmttc0tleSkge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbJ2ttczpEZWNyeXB0JywgJ2ttczpEZXNjcmliZUtleSddLFxuICAgICAgICAgIHJlc291cmNlczogW3RoaXMua21zS2V5LmtleUFybl0sXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIERMUeaoqemZkFxuICAgIGlmICh0aGlzLmRlYWRMZXR0ZXJRdWV1ZSkge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbJ3NxczpTZW5kTWVzc2FnZSddLFxuICAgICAgICAgIHJlc291cmNlczogW3RoaXMuZGVhZExldHRlclF1ZXVlLnF1ZXVlQXJuXSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUZ1bmN0aW9uKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlUnVudGltZUNvbnN0cnVjdFByb3BzKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBjb25zdCBlbnZpcm9ubWVudDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIFBST0pFQ1RfTkFNRTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICBCRURST0NLX1JFR0lPTjogcHJvcHMuYmVkcm9ja0FnZW50Q29uZmlnPy5yZWdpb24gfHwgJ2FwLW5vcnRoZWFzdC0xJyxcbiAgICAgIC4uLihwcm9wcy5sYW1iZGFDb25maWc/LmVudmlyb25tZW50IHx8IHt9KSxcbiAgICB9O1xuXG4gICAgLy8gQmVkcm9jayBBZ2VudOioreWumlxuICAgIGlmIChwcm9wcy5iZWRyb2NrQWdlbnRDb25maWc/LmFnZW50SWQpIHtcbiAgICAgIGVudmlyb25tZW50LkJFRFJPQ0tfQUdFTlRfSUQgPSBwcm9wcy5iZWRyb2NrQWdlbnRDb25maWcuYWdlbnRJZDtcbiAgICB9XG4gICAgaWYgKHByb3BzLmJlZHJvY2tBZ2VudENvbmZpZz8uYWdlbnRBbGlhc0lkKSB7XG4gICAgICBlbnZpcm9ubWVudC5CRURST0NLX0FHRU5UX0FMSUFTX0lEID0gcHJvcHMuYmVkcm9ja0FnZW50Q29uZmlnLmFnZW50QWxpYXNJZDtcbiAgICB9XG5cbiAgICAvLyBGU3ggZm9yIE9OVEFQICsgUzMgQWNjZXNzIFBvaW50IEFSTuioreWumu+8iE1lbW9yeeapn+iDveeUqO+8iVxuICAgIC8vIFBoYXNlIDHmnKrlrp/oo4U6IEZTeCBPTlRBUOe1seWQiOOBr+WwhuadpeWun+ijheS6iOWumlxuICAgIC8vIGlmICh0aGlzLm1lbW9yeUFjY2Vzc1BvaW50KSB7XG4gICAgLy8gICBlbnZpcm9ubWVudC5NRU1PUllfQUNDRVNTX1BPSU5UX0FSTiA9IHRoaXMubWVtb3J5QWNjZXNzUG9pbnQuYWNjZXNzUG9pbnRBcm47XG4gICAgLy8gfVxuXG4gICAgY29uc3QgZm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXJ1bnRpbWUtZnVuY3Rpb25gLFxuICAgICAgcnVudGltZTogcHJvcHMubGFtYmRhQ29uZmlnPy5ydW50aW1lIHx8IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYWdlbnQtY29yZS1ydW50aW1lJywge1xuICAgICAgICBidW5kbGluZzoge1xuICAgICAgICAgIGltYWdlOiBwcm9wcy5sYW1iZGFDb25maWc/LnJ1bnRpbWU/LmJ1bmRsaW5nSW1hZ2UgfHwgbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1guYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAnYmFzaCcsXG4gICAgICAgICAgICAnLWMnLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAnbnBtIGluc3RhbGwnLFxuICAgICAgICAgICAgICAnbnBtIHJ1biBidWlsZCcsXG4gICAgICAgICAgICAgICdjcCAtciBkaXN0LyogL2Fzc2V0LW91dHB1dC8nLFxuICAgICAgICAgICAgICAnY3AgcGFja2FnZS5qc29uIC9hc3NldC1vdXRwdXQvJyxcbiAgICAgICAgICAgICAgJ2NkIC9hc3NldC1vdXRwdXQnLFxuICAgICAgICAgICAgICAnbnBtIGluc3RhbGwgLS1vbWl0PWRldicsXG4gICAgICAgICAgICBdLmpvaW4oJyAmJiAnKSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZXI6ICdyb290JyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMocHJvcHMubGFtYmRhQ29uZmlnPy50aW1lb3V0IHx8IDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IHByb3BzLmxhbWJkYUNvbmZpZz8ubWVtb3J5U2l6ZSB8fCAyMDQ4LFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICBlbnZpcm9ubWVudEVuY3J5cHRpb246IHRoaXMua21zS2V5LFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgZGVhZExldHRlclF1ZXVlOiB0aGlzLmRlYWRMZXR0ZXJRdWV1ZSxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IHByb3BzLmxhbWJkYUNvbmZpZz8ucmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9ucyxcbiAgICAgIHZwYzogcHJvcHMubGFtYmRhQ29uZmlnPy52cGNDb25maWc/LnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHByb3BzLmxhbWJkYUNvbmZpZz8udnBjQ29uZmlnPy5zdWJuZXRTZWxlY3Rpb24sXG4gICAgICBzZWN1cml0eUdyb3VwczogcHJvcHMubGFtYmRhQ29uZmlnPy52cGNDb25maWc/LnNlY3VyaXR5R3JvdXBzLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50Q29yZSBSdW50aW1lIExhbWJkYSBmdW5jdGlvbiBmb3IgZXZlbnQtZHJpdmVuIGV4ZWN1dGlvbiB3aXRoIEZTeCBmb3IgT05UQVAgKyBTMyBBY2Nlc3MgUG9pbnRzIGludGVncmF0aW9uJyxcbiAgICB9KTtcblxuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVudEJyaWRnZSBSdWxl5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUV2ZW50QnJpZGdlUnVsZShwcm9wczogQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3RQcm9wcyk6IGV2ZW50cy5SdWxlIHtcbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4jjga7jgqTjg5njg7Pjg4jjg5Hjgr/jg7zjg7NcbiAgICBjb25zdCBkZWZhdWx0RXZlbnRQYXR0ZXJuOiBldmVudHMuRXZlbnRQYXR0ZXJuID0ge1xuICAgICAgc291cmNlOiBbJ2JlZHJvY2suYWdlbnQucnVudGltZSddLFxuICAgICAgZGV0YWlsVHlwZTogWydBZ2VudCBJbnZvY2F0aW9uIFJlcXVlc3QnXSxcbiAgICAgIGRldGFpbDoge1xuICAgICAgICBhZ2VudElkOiBbeyBleGlzdHM6IHRydWUgfV0sXG4gICAgICAgIHNlc3Npb25JZDogW3sgZXhpc3RzOiB0cnVlIH1dLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnRXZlbnRSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1ydW50aW1lLXJ1bGVgLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmVudEJyaWRnZSBydWxlIGZvciBCZWRyb2NrIEFnZW50Q29yZSBSdW50aW1lIC0gdHJpZ2dlcnMgTGFtYmRhIGZ1bmN0aW9uIGZvciBhZ2VudCBpbnZvY2F0aW9ucycsXG4gICAgICBldmVudFBhdHRlcm46IHByb3BzLmV2ZW50QnJpZGdlQ29uZmlnPy5ldmVudFBhdHRlcm4gfHwgZGVmYXVsdEV2ZW50UGF0dGVybixcbiAgICAgIHNjaGVkdWxlOiBwcm9wcy5ldmVudEJyaWRnZUNvbmZpZz8uc2NoZWR1bGUsXG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44KS44K/44O844Ky44OD44OI44Gr6L+95YqgXG4gICAgaWYgKHRoaXMubGFtYmRhRnVuY3Rpb24pIHtcbiAgICAgIHJ1bGUuYWRkVGFyZ2V0KFxuICAgICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmxhbWJkYUZ1bmN0aW9uLCB7XG4gICAgICAgICAgZGVhZExldHRlclF1ZXVlOiB0aGlzLmRlYWRMZXR0ZXJRdWV1ZSxcbiAgICAgICAgICByZXRyeUF0dGVtcHRzOiAzLCAvLyDjg6rjg4jjg6njgqTlm57mlbDjgpIz5Zue44Gr5aKX5YqgXG4gICAgICAgICAgbWF4RXZlbnRBZ2U6IGNkay5EdXJhdGlvbi5ob3VycygyNCksIC8vIOacgOWkp+OCpOODmeODs+ODiOacieWKueacn+mZkOOCkjI05pmC6ZaT44Gr6Kit5a6aXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBydWxlO1xuICB9XG59XG4iXX0=