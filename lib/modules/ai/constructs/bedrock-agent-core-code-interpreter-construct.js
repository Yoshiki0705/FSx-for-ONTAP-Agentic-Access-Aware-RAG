"use strict";
/**
 * Amazon Bedrock AgentCore Code Interpreter Construct
 *
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 *
 * 主要機能:
 * - セッション管理（開始、停止）
 * - コード実行（Python）
 * - ファイル操作（書き込み、読み込み、削除、一覧）
 * - ターミナルコマンド実行
 * - FSx for ONTAP統合（オプション）
 *
 * @author Kiro AI
 * @date 2026-01-04
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
exports.BedrockAgentCoreCodeInterpreterConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
/**
 * Amazon Bedrock AgentCore Code Interpreter Construct
 *
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 */
class BedrockAgentCoreCodeInterpreterConstruct extends constructs_1.Construct {
    /**
     * Code Interpreter Lambda関数
     */
    interpreterFunction;
    /**
     * KMS暗号化キー
     */
    encryptionKey;
    /**
     * IAM実行ロール
     */
    executionRole;
    constructor(scope, id, props) {
        super(scope, id);
        // 機能が無効化されている場合は何もしない
        if (!props.enabled) {
            return;
        }
        // KMS暗号化キーの作成または使用
        this.encryptionKey = props.encryptionKey || this.createEncryptionKey(props);
        // IAM実行ロールの作成
        this.executionRole = this.createExecutionRole(props);
        // Code Interpreter Lambda関数の作成
        this.interpreterFunction = this.createInterpreterFunction(props);
        // タグ付け
        this.applyTags(props);
    }
    /**
     * KMS暗号化キーを作成
     */
    createEncryptionKey(props) {
        return new kms.Key(this, 'EncryptionKey', {
            description: `${props.projectName}-${props.environment}-agent-core-code-interpreter-key`,
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
    }
    /**
     * IAM実行ロールを作成
     */
    createExecutionRole(props) {
        const role = new iam.Role(this, 'ExecutionRole', {
            roleName: `${props.projectName}-${props.environment}-code-interpreter-execution-role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for AgentCore Code Interpreter Lambda function',
        });
        // CloudWatch Logs権限
        role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        // VPC統合権限（VPCが指定されている場合）
        if (props.vpc) {
            role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
        }
        // FSx for ONTAP S3 Access Point権限
        if (props.fsxS3AccessPointArn) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    's3:GetObject',
                    's3:PutObject',
                    's3:DeleteObject',
                    's3:ListBucket',
                ],
                resources: [
                    props.fsxS3AccessPointArn,
                    `${props.fsxS3AccessPointArn}/*`,
                ],
            }));
        }
        // Bedrock権限（Code Interpreter API）
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: ['*'],
        }));
        // KMS権限
        if (this.encryptionKey) {
            this.encryptionKey.grantEncryptDecrypt(role);
        }
        return role;
    }
    /**
     * Code Interpreter Lambda関数を作成
     */
    createInterpreterFunction(props) {
        const memorySize = props.lambdaConfig?.memorySize || 2048;
        const timeout = props.lambdaConfig?.timeout || 300;
        const ephemeralStorageSize = props.lambdaConfig?.ephemeralStorageSize || 2048;
        const func = new lambda.Function(this, 'InterpreterFunction', {
            functionName: `${props.projectName}-${props.environment}-agent-core-code-interpreter`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/agent-core-code-interpreter'),
            role: this.executionRole,
            memorySize,
            timeout: cdk.Duration.seconds(timeout),
            ephemeralStorageSize: cdk.Size.mebibytes(ephemeralStorageSize),
            reservedConcurrentExecutions: props.lambdaConfig?.reservedConcurrentExecutions,
            vpc: props.vpc,
            vpcSubnets: props.vpc ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
            securityGroups: props.securityGroup ? [props.securityGroup] : undefined,
            environment: {
                PROJECT_NAME: props.projectName,
                ENVIRONMENT: props.environment,
                FSX_S3_ACCESS_POINT_ARN: props.fsxS3AccessPointArn || '',
                EXECUTION_TIMEOUT: String(props.sandboxConfig?.executionTimeout || 60),
                MEMORY_LIMIT: String(props.sandboxConfig?.memoryLimit || 512),
                ALLOWED_PACKAGES: JSON.stringify(props.sandboxConfig?.allowedPackages || ['numpy', 'pandas', 'matplotlib', 'scipy']),
                ALLOW_NETWORK_ACCESS: String(props.sandboxConfig?.allowNetworkAccess ?? false),
                SESSION_TIMEOUT: String(props.sessionConfig?.sessionTimeout || 3600),
                MAX_CONCURRENT_SESSIONS: String(props.sessionConfig?.maxConcurrentSessions || 10),
            },
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        return func;
    }
    /**
     * タグを適用
     */
    applyTags(props) {
        const tags = {
            Project: props.projectName,
            Environment: props.environment,
            Component: 'AgentCore-CodeInterpreter',
            ManagedBy: 'CDK',
        };
        Object.entries(tags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
}
exports.BedrockAgentCoreCodeInterpreterConstruct = BedrockAgentCoreCodeInterpreterConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWNvZGUtaW50ZXJwcmV0ZXItY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLWNvZGUtaW50ZXJwcmV0ZXItY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7R0FjRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLHlEQUEyQztBQUMzQywyQ0FBdUM7QUFzSHZDOzs7O0dBSUc7QUFDSCxNQUFhLHdDQUF5QyxTQUFRLHNCQUFTO0lBQ3JFOztPQUVHO0lBQ2EsbUJBQW1CLENBQW1CO0lBRXREOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsYUFBYSxDQUFZO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0Q7UUFDNUYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixPQUFPO1FBQ1QsQ0FBQztRQUVELG1CQUFtQjtRQUNuQixJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxhQUFvQyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVuRyxjQUFjO1FBQ2QsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFckQsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFakUsT0FBTztRQUNQLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDeEIsQ0FB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cEgsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLElBQUksS0FBSyxDQUFDO2dCQUM5RSxlQUFlLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUUsY0FBYyxJQUFJLElBQUksQ0FBQztnQkFDcEUsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUUscUJBQXFCLElBQUksRUFBRSxDQUFDO2FBQ2xGO1lBQ0QsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUTtTQUMxQyxDQUFDLENBQUM7UUFFSCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNLLFNBQVMsQ0FBQyxLQUFvRDtRQUNwRSxNQUFNLElBQUksR0FBRztZQUNYLE9BQU8sRUFBRSxLQUFLLENBQUMsV0FBVztZQUMxQixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7WUFDOUIsU0FBUyxFQUFFLDJCQUEyQjtZQUN0QyxTQUFTLEVBQUUsS0FBSztTQUNqQixDQUFDO1FBRUYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO1lBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFsS0QsNEZBa0tDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgQ29kZSBJbnRlcnByZXRlciBDb25zdHJ1Y3RcbiAqIFxuICogUHl0aG9u44Kz44O844OJ44KS5a6J5YWo44Gq44K144Oz44OJ44Oc44OD44Kv44K555Kw5aKD44Gn5a6f6KGM44GZ44KL5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKiBcbiAqIOS4u+imgeapn+iDvTpcbiAqIC0g44K744OD44K344On44Oz566h55CG77yI6ZaL5aeL44CB5YGc5q2i77yJXG4gKiAtIOOCs+ODvOODieWun+ihjO+8iFB5dGhvbu+8iVxuICogLSDjg5XjgqHjgqTjg6vmk43kvZzvvIjmm7jjgY3ovrzjgb/jgIHoqq3jgb/ovrzjgb/jgIHliYrpmaTjgIHkuIDopqfvvIlcbiAqIC0g44K/44O844Of44OK44Or44Kz44Oe44Oz44OJ5a6f6KGMXG4gKiAtIEZTeCBmb3IgT05UQVDntbHlkIjvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAqIFxuICogQGF1dGhvciBLaXJvIEFJXG4gKiBAZGF0ZSAyMDI2LTAxLTA0XG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8qKlxuICogQ29kZSBJbnRlcnByZXRlciBDb25zdHJ1Y3ToqK3lrprjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRDb3JlQ29kZUludGVycHJldGVyQ29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICog5qmf6IO944Gu5pyJ5Yq55YyW44OV44Op44KwXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQje+8iHByb2QsIGRlduetie+8iVxuICAgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogVlBD6Kit5a6a77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSB2cGM/OiBlYzIuSVZwYztcblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSBzZWN1cml0eUdyb3VwPzogZWMyLklTZWN1cml0eUdyb3VwO1xuXG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQIFMzIEFjY2VzcyBQb2ludCBBUk7vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICog5oyH5a6a44GV44KM44Gf5aC05ZCI44CB44OV44Kh44Kk44Or5pON5L2c44GnRlN4IGZvciBPTlRBUOOCkuS9v+eUqFxuICAgKi9cbiAgcmVhZG9ubHkgZnN4UzNBY2Nlc3NQb2ludEFybj86IHN0cmluZztcblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O877yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSBlbmNyeXB0aW9uS2V5Pzoga21zLklLZXk7XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOioreWumu+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgcmVhZG9ubHkgbGFtYmRhQ29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIOODoeODouODquOCteOCpOOCuu+8iE1C77yJXG4gICAgICogQGRlZmF1bHQgMjA0OFxuICAgICAqL1xuICAgIG1lbW9yeVNpemU/OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiDjgr/jgqTjg6DjgqLjgqbjg4jvvIjnp5LvvIlcbiAgICAgKiBAZGVmYXVsdCAzMDBcbiAgICAgKi9cbiAgICB0aW1lb3V0PzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICogRXBoZW1lcmFsIFN0b3JhZ2XvvIhNQu+8iVxuICAgICAqIEBkZWZhdWx0IDIwNDhcbiAgICAgKi9cbiAgICBlcGhlbWVyYWxTdG9yYWdlU2l6ZT86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIFJlc2VydmVkIENvbmN1cnJlbmN5XG4gICAgICogQGRlZmF1bHQgdW5kZWZpbmVk77yI54Sh5Yi26ZmQ77yJXG4gICAgICovXG4gICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9ucz86IG51bWJlcjtcbiAgfTtcblxuICAvKipcbiAgICog44K144Oz44OJ44Oc44OD44Kv44K56Kit5a6a77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSBzYW5kYm94Q29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIFB5dGhvbuWun+ihjOOCv+OCpOODoOOCouOCpuODiO+8iOenku+8iVxuICAgICAqIEBkZWZhdWx0IDYwXG4gICAgICovXG4gICAgZXhlY3V0aW9uVGltZW91dD86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOODoeODouODquWItumZkO+8iE1C77yJXG4gICAgICogQGRlZmF1bHQgNTEyXG4gICAgICovXG4gICAgbWVtb3J5TGltaXQ/OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiDoqLHlj6/jgZXjgozjgotQeXRob27jg5Hjg4PjgrHjg7zjgrhcbiAgICAgKiBAZGVmYXVsdCBbJ251bXB5JywgJ3BhbmRhcycsICdtYXRwbG90bGliJywgJ3NjaXB5J11cbiAgICAgKi9cbiAgICBhbGxvd2VkUGFja2FnZXM/OiBzdHJpbmdbXTtcblxuICAgIC8qKlxuICAgICAqIOODjeODg+ODiOODr+ODvOOCr+OCouOCr+OCu+OCueioseWPr1xuICAgICAqIEBkZWZhdWx0IGZhbHNlXG4gICAgICovXG4gICAgYWxsb3dOZXR3b3JrQWNjZXNzPzogYm9vbGVhbjtcbiAgfTtcblxuICAvKipcbiAgICog44K744OD44K344On44Oz6Kit5a6a77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICByZWFkb25seSBzZXNzaW9uQ29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIOOCu+ODg+OCt+ODp+ODs+OCv+OCpOODoOOCouOCpuODiO+8iOenku+8iVxuICAgICAqIEBkZWZhdWx0IDM2MDBcbiAgICAgKi9cbiAgICBzZXNzaW9uVGltZW91dD86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOacgOWkp+WQjOaZguOCu+ODg+OCt+ODp+ODs+aVsFxuICAgICAqIEBkZWZhdWx0IDEwXG4gICAgICovXG4gICAgbWF4Q29uY3VycmVudFNlc3Npb25zPzogbnVtYmVyO1xuICB9O1xufVxuXG4vKipcbiAqIEFtYXpvbiBCZWRyb2NrIEFnZW50Q29yZSBDb2RlIEludGVycHJldGVyIENvbnN0cnVjdFxuICogXG4gKiBQeXRob27jgrPjg7zjg4njgpLlronlhajjgarjgrXjg7Pjg4njg5zjg4Pjgq/jgrnnkrDlooPjgaflrp/ooYzjgZnjgovmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKipcbiAgICogQ29kZSBJbnRlcnByZXRlciBMYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBpbnRlcnByZXRlckZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJbjgq3jg7xcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBlbmNyeXB0aW9uS2V5Pzoga21zLktleTtcblxuICAvKipcbiAgICogSUFN5a6f6KGM44Ot44O844OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZT86IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlQ29kZUludGVycHJldGVyQ29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8g5qmf6IO944GM54Sh5Yq55YyW44GV44KM44Gm44GE44KL5aC05ZCI44Gv5L2V44KC44GX44Gq44GEXG4gICAgaWYgKCFwcm9wcy5lbmFibGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gS01T5pqX5Y+35YyW44Kt44O844Gu5L2c5oiQ44G+44Gf44Gv5L2/55SoXG4gICAgdGhpcy5lbmNyeXB0aW9uS2V5ID0gcHJvcHMuZW5jcnlwdGlvbktleSBhcyBrbXMuS2V5IHwgdW5kZWZpbmVkIHx8IHRoaXMuY3JlYXRlRW5jcnlwdGlvbktleShwcm9wcyk7XG5cbiAgICAvLyBJQU3lrp/ooYzjg63jg7zjg6vjga7kvZzmiJBcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUgPSB0aGlzLmNyZWF0ZUV4ZWN1dGlvblJvbGUocHJvcHMpO1xuXG4gICAgLy8gQ29kZSBJbnRlcnByZXRlciBMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICB0aGlzLmludGVycHJldGVyRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUludGVycHJldGVyRnVuY3Rpb24ocHJvcHMpO1xuXG4gICAgLy8g44K/44Kw5LuY44GRXG4gICAgdGhpcy5hcHBseVRhZ3MocHJvcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEtNU+aal+WPt+WMluOCreODvOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFbmNyeXB0aW9uS2V5KHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlQ29kZUludGVycHJldGVyQ29uc3RydWN0UHJvcHMpOiBrbXMuS2V5IHtcbiAgICByZXR1cm4gbmV3IGttcy5LZXkodGhpcywgJ0VuY3J5cHRpb25LZXknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LWNvcmUtY29kZS1pbnRlcnByZXRlci1rZXlgLFxuICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSUFN5a6f6KGM44Ot44O844Or44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUV4ZWN1dGlvblJvbGUocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3RQcm9wcyk6IGlhbS5Sb2xlIHtcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdFeGVjdXRpb25Sb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1jb2RlLWludGVycHJldGVyLWV4ZWN1dGlvbi1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdFeGVjdXRpb24gcm9sZSBmb3IgQWdlbnRDb3JlIENvZGUgSW50ZXJwcmV0ZXIgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc+aoqemZkFxuICAgIHJvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpXG4gICAgKTtcblxuICAgIC8vIFZQQ+e1seWQiOaoqemZkO+8iFZQQ+OBjOaMh+WumuOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmIChwcm9wcy52cGMpIHtcbiAgICAgIHJvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZScpXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW505qip6ZmQXG4gICAgaWYgKHByb3BzLmZzeFMzQWNjZXNzUG9pbnRBcm4pIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICBwcm9wcy5mc3hTM0FjY2Vzc1BvaW50QXJuLFxuICAgICAgICAgICAgYCR7cHJvcHMuZnN4UzNBY2Nlc3NQb2ludEFybn0vKmAsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQmVkcm9ja+aoqemZkO+8iENvZGUgSW50ZXJwcmV0ZXIgQVBJ77yJXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEtNU+aoqemZkFxuICAgIGlmICh0aGlzLmVuY3J5cHRpb25LZXkpIHtcbiAgICAgIHRoaXMuZW5jcnlwdGlvbktleS5ncmFudEVuY3J5cHREZWNyeXB0KHJvbGUpO1xuICAgIH1cblxuICAgIHJldHVybiByb2xlO1xuICB9XG5cbiAgLyoqXG4gICAqIENvZGUgSW50ZXJwcmV0ZXIgTGFtYmRh6Zai5pWw44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUludGVycHJldGVyRnVuY3Rpb24ocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3RQcm9wcyk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgY29uc3QgbWVtb3J5U2l6ZSA9IHByb3BzLmxhbWJkYUNvbmZpZz8ubWVtb3J5U2l6ZSB8fCAyMDQ4O1xuICAgIGNvbnN0IHRpbWVvdXQgPSBwcm9wcy5sYW1iZGFDb25maWc/LnRpbWVvdXQgfHwgMzAwO1xuICAgIGNvbnN0IGVwaGVtZXJhbFN0b3JhZ2VTaXplID0gcHJvcHMubGFtYmRhQ29uZmlnPy5lcGhlbWVyYWxTdG9yYWdlU2l6ZSB8fCAyMDQ4O1xuXG4gICAgY29uc3QgZnVuYyA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0ludGVycHJldGVyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1jb3JlLWNvZGUtaW50ZXJwcmV0ZXJgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hZ2VudC1jb3JlLWNvZGUtaW50ZXJwcmV0ZXInKSxcbiAgICAgIHJvbGU6IHRoaXMuZXhlY3V0aW9uUm9sZSxcbiAgICAgIG1lbW9yeVNpemUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyh0aW1lb3V0KSxcbiAgICAgIGVwaGVtZXJhbFN0b3JhZ2VTaXplOiBjZGsuU2l6ZS5tZWJpYnl0ZXMoZXBoZW1lcmFsU3RvcmFnZVNpemUpLFxuICAgICAgcmVzZXJ2ZWRDb25jdXJyZW50RXhlY3V0aW9uczogcHJvcHMubGFtYmRhQ29uZmlnPy5yZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zLFxuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICB2cGNTdWJuZXRzOiBwcm9wcy52cGMgPyB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSA6IHVuZGVmaW5lZCxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBwcm9wcy5zZWN1cml0eUdyb3VwID8gW3Byb3BzLnNlY3VyaXR5R3JvdXBdIDogdW5kZWZpbmVkLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJPSkVDVF9OQU1FOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBGU1hfUzNfQUNDRVNTX1BPSU5UX0FSTjogcHJvcHMuZnN4UzNBY2Nlc3NQb2ludEFybiB8fCAnJyxcbiAgICAgICAgRVhFQ1VUSU9OX1RJTUVPVVQ6IFN0cmluZyhwcm9wcy5zYW5kYm94Q29uZmlnPy5leGVjdXRpb25UaW1lb3V0IHx8IDYwKSxcbiAgICAgICAgTUVNT1JZX0xJTUlUOiBTdHJpbmcocHJvcHMuc2FuZGJveENvbmZpZz8ubWVtb3J5TGltaXQgfHwgNTEyKSxcbiAgICAgICAgQUxMT1dFRF9QQUNLQUdFUzogSlNPTi5zdHJpbmdpZnkocHJvcHMuc2FuZGJveENvbmZpZz8uYWxsb3dlZFBhY2thZ2VzIHx8IFsnbnVtcHknLCAncGFuZGFzJywgJ21hdHBsb3RsaWInLCAnc2NpcHknXSksXG4gICAgICAgIEFMTE9XX05FVFdPUktfQUNDRVNTOiBTdHJpbmcocHJvcHMuc2FuZGJveENvbmZpZz8uYWxsb3dOZXR3b3JrQWNjZXNzID8/IGZhbHNlKSxcbiAgICAgICAgU0VTU0lPTl9USU1FT1VUOiBTdHJpbmcocHJvcHMuc2Vzc2lvbkNvbmZpZz8uc2Vzc2lvblRpbWVvdXQgfHwgMzYwMCksXG4gICAgICAgIE1BWF9DT05DVVJSRU5UX1NFU1NJT05TOiBTdHJpbmcocHJvcHMuc2Vzc2lvbkNvbmZpZz8ubWF4Q29uY3VycmVudFNlc3Npb25zIHx8IDEwKSxcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIHJldHVybiBmdW5jO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOOCkumBqeeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVRhZ3MocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3RQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IHRhZ3MgPSB7XG4gICAgICBQcm9qZWN0OiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIENvbXBvbmVudDogJ0FnZW50Q29yZS1Db2RlSW50ZXJwcmV0ZXInLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJyxcbiAgICB9O1xuXG4gICAgT2JqZWN0LmVudHJpZXModGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==