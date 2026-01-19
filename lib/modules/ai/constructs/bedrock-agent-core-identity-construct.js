"use strict";
/**
 * AgentCore Identity Construct
 *
 * Active Directory SID自動取得とIdentity管理機能を提供
 *
 * Features:
 * - AD SID自動取得（Lambda + SSM Run Command）
 * - DynamoDB Identity Table（SIDキャッシュ）
 * - IAM権限管理
 * - VPC統合
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
exports.BedrockAgentCoreIdentityConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class BedrockAgentCoreIdentityConstruct extends constructs_1.Construct {
    /**
     * Identity DynamoDBテーブル
     */
    identityTable;
    /**
     * AD Sync Lambda関数
     */
    adSyncFunction;
    /**
     * Lambda実行ロール
     */
    lambdaRole;
    constructor(scope, id, props) {
        super(scope, id);
        if (!props.enabled) {
            console.log('AgentCore Identity is disabled');
            return;
        }
        // Identity DynamoDBテーブル作成
        const tableName = props.identityTableName ||
            `${props.projectName}-${props.environment}-identity`;
        this.identityTable = new dynamodb.Table(this, 'IdentityTable', {
            tableName: tableName,
            partitionKey: {
                name: 'username',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            timeToLiveAttribute: 'expiresAt',
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true
        });
        // Lambda実行ロール作成
        this.lambdaRole = new iam.Role(this, 'LambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'AgentCore Identity Lambda execution role',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        // DynamoDB権限追加
        this.identityTable.grantReadWriteData(this.lambdaRole);
        // AD Sync機能が有効な場合
        if (props.adSyncEnabled && props.adEc2InstanceId) {
            // SSM Run Command権限追加
            this.lambdaRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'ssm:SendCommand',
                    'ssm:GetCommandInvocation'
                ],
                resources: [
                    `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:instance/${props.adEc2InstanceId}`,
                    `arn:aws:ssm:${cdk.Stack.of(this).region}::document/AWS-RunPowerShellScript`
                ]
            }));
            // VPC統合が有効な場合、VPC権限追加
            if (props.vpcConfig) {
                this.lambdaRole.addToPolicy(new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ec2:CreateNetworkInterface',
                        'ec2:DescribeNetworkInterfaces',
                        'ec2:DeleteNetworkInterface',
                        'ec2:AssignPrivateIpAddresses',
                        'ec2:UnassignPrivateIpAddresses'
                    ],
                    resources: ['*']
                }));
            }
            // AD Sync Lambda関数作成
            this.adSyncFunction = new lambda.Function(this, 'AdSyncFunction', {
                functionName: `${props.projectName}-${props.environment}-ad-sync`,
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: 'index.handler',
                code: lambda.Code.fromAsset('lambda/agent-core-ad-sync'),
                role: this.lambdaRole,
                timeout: cdk.Duration.seconds(props.ssmTimeout ? props.ssmTimeout + 30 : 60),
                memorySize: 512,
                environment: {
                    AD_EC2_INSTANCE_ID: props.adEc2InstanceId,
                    IDENTITY_TABLE_NAME: this.identityTable.tableName,
                    SSM_TIMEOUT: (props.ssmTimeout || 30).toString(),
                    SID_CACHE_TTL: (props.sidCacheTtl || 86400).toString()
                },
                logRetention: logs.RetentionDays.ONE_MONTH,
                description: 'AgentCore AD Sync - Active Directory SID自動取得'
            });
            // タグ追加
            cdk.Tags.of(this.adSyncFunction).add('Project', props.projectName);
            cdk.Tags.of(this.adSyncFunction).add('Environment', props.environment);
            cdk.Tags.of(this.adSyncFunction).add('Component', 'AgentCore-Identity');
        }
        // タグ追加
        cdk.Tags.of(this.identityTable).add('Project', props.projectName);
        cdk.Tags.of(this.identityTable).add('Environment', props.environment);
        cdk.Tags.of(this.identityTable).add('Component', 'AgentCore-Identity');
        // CloudFormation出力
        new cdk.CfnOutput(this, 'IdentityTableName', {
            value: this.identityTable.tableName,
            description: 'AgentCore Identity DynamoDB Table Name',
            exportName: `${props.projectName}-${props.environment}-identity-table-name`
        });
        if (this.adSyncFunction) {
            new cdk.CfnOutput(this, 'AdSyncFunctionArn', {
                value: this.adSyncFunction.functionArn,
                description: 'AgentCore AD Sync Lambda Function ARN',
                exportName: `${props.projectName}-${props.environment}-ad-sync-function-arn`
            });
        }
    }
}
exports.BedrockAgentCoreIdentityConstruct = BedrockAgentCoreIdentityConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWlkZW50aXR5LWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtY29yZS1pZGVudGl0eS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCxtRUFBcUQ7QUFDckQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3QywyQ0FBdUM7QUF1RHZDLE1BQWEsaUNBQWtDLFNBQVEsc0JBQVM7SUFDOUQ7O09BRUc7SUFDYSxhQUFhLENBQWlCO0lBRTlDOztPQUVHO0lBQ2EsY0FBYyxDQUFtQjtJQUVqRDs7T0FFRztJQUNhLFVBQVUsQ0FBVztJQUVyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTZDO1FBQ3JGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7WUFDOUMsT0FBTztRQUNULENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLGlCQUFpQjtZQUN2QyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsV0FBVyxDQUFDO1FBRXZELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDN0QsU0FBUyxFQUFFLFNBQVM7WUFDcEIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELG1CQUFtQixFQUFFLFdBQVc7WUFDaEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxtQkFBbUIsRUFBRSxJQUFJO1NBQzFCLENBQUMsQ0FBQztRQUVILGdCQUFnQjtRQUNoQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ2pELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxXQUFXLEVBQUUsMENBQTBDO1lBQ3ZELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2FBQ3ZGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZUFBZTtRQUNmLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXZELGtCQUFrQjtRQUNsQixJQUFJLEtBQUssQ0FBQyxhQUFhLElBQUksS0FBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ2pELHNCQUFzQjtZQUN0QixJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7Z0JBQ2xELE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7Z0JBQ3hCLE9BQU8sRUFBRTtvQkFDUCxpQkFBaUI7b0JBQ2pCLDBCQUEwQjtpQkFDM0I7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULGVBQWUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sYUFBYSxLQUFLLENBQUMsZUFBZSxFQUFFO29CQUMxRyxlQUFlLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sb0NBQW9DO2lCQUM3RTthQUNGLENBQUMsQ0FBQyxDQUFDO1lBRUosc0JBQXNCO1lBQ3RCLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7b0JBQ2xELE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7b0JBQ3hCLE9BQU8sRUFBRTt3QkFDUCw0QkFBNEI7d0JBQzVCLCtCQUErQjt3QkFDL0IsNEJBQTRCO3dCQUM1Qiw4QkFBOEI7d0JBQzlCLGdDQUFnQztxQkFDakM7b0JBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO2lCQUNqQixDQUFDLENBQUMsQ0FBQztZQUNOLENBQUM7WUFFRCxxQkFBcUI7WUFDckIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO2dCQUNoRSxZQUFZLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLFVBQVU7Z0JBQ2pFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7Z0JBQ25DLE9BQU8sRUFBRSxlQUFlO2dCQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsMkJBQTJCLENBQUM7Z0JBQ3hELElBQUksRUFBRSxJQUFJLENBQUMsVUFBVTtnQkFDckIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzVFLFVBQVUsRUFBRSxHQUFHO2dCQUNmLFdBQVcsRUFBRTtvQkFDWCxrQkFBa0IsRUFBRSxLQUFLLENBQUMsZUFBZTtvQkFDekMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO29CQUNqRCxXQUFXLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRTtvQkFDaEQsYUFBYSxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUU7aUJBQ3ZEO2dCQUNELFlBQVksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVM7Z0JBQzFDLFdBQVcsRUFBRSw4Q0FBOEM7YUFDNUQsQ0FBQyxDQUFDO1lBRUgsT0FBTztZQUNQLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNuRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsT0FBTztRQUNQLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNsRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUV2RSxtQkFBbUI7UUFDbkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO1lBQ25DLFdBQVcsRUFBRSx3Q0FBd0M7WUFDckQsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxzQkFBc0I7U0FDNUUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDeEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtnQkFDM0MsS0FBSyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVztnQkFDdEMsV0FBVyxFQUFFLHVDQUF1QztnQkFDcEQsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyx1QkFBdUI7YUFDN0UsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7Q0FDRjtBQWhJRCw4RUFnSUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFnZW50Q29yZSBJZGVudGl0eSBDb25zdHJ1Y3RcbiAqIFxuICogQWN0aXZlIERpcmVjdG9yeSBTSUToh6rli5Xlj5blvpfjgahJZGVudGl0eeeuoeeQhuapn+iDveOCkuaPkOS+m1xuICogXG4gKiBGZWF0dXJlczpcbiAqIC0gQUQgU0lE6Ieq5YuV5Y+W5b6X77yITGFtYmRhICsgU1NNIFJ1biBDb21tYW5k77yJXG4gKiAtIER5bmFtb0RCIElkZW50aXR5IFRhYmxl77yIU0lE44Kt44Oj44OD44K344Ol77yJXG4gKiAtIElBTeaoqemZkOeuoeeQhlxuICogLSBWUEPntbHlkIhcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICog5qmf6IO944Gu5pyJ5Yq55YyW44OV44Op44KwXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQje+8iHByb2QvZGV2L3N0YWdpbmfvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFEIFNJROiHquWLleWPluW+l+OBruacieWKueWMllxuICAgKi9cbiAgcmVhZG9ubHkgYWRTeW5jRW5hYmxlZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFjdGl2ZSBEaXJlY3RvcnkgRUMy44Kk44Oz44K544K/44Oz44K5SURcbiAgICovXG4gIHJlYWRvbmx5IGFkRWMySW5zdGFuY2VJZD86IHN0cmluZztcblxuICAvKipcbiAgICogSWRlbnRpdHkgRHluYW1vRELjg4bjg7zjg5bjg6vlkI1cbiAgICovXG4gIHJlYWRvbmx5IGlkZW50aXR5VGFibGVOYW1lPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBTSUTjgq3jg6Pjg4Pjgrfjg6VUVEzvvIjnp5LvvIlcbiAgICogQGRlZmF1bHQgODY0MDAgKDI05pmC6ZaTKVxuICAgKi9cbiAgcmVhZG9ubHkgc2lkQ2FjaGVUdGw/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFNTTeOCv+OCpOODoOOCouOCpuODiO+8iOenku+8iVxuICAgKiBAZGVmYXVsdCAzMFxuICAgKi9cbiAgcmVhZG9ubHkgc3NtVGltZW91dD86IG51bWJlcjtcblxuICAvKipcbiAgICogVlBD57Wx5ZCI6Kit5a6aXG4gICAqL1xuICByZWFkb25seSB2cGNDb25maWc/OiB7XG4gICAgcmVhZG9ubHkgdnBjSWQ6IHN0cmluZztcbiAgICByZWFkb25seSBzdWJuZXRJZHM6IHN0cmluZ1tdO1xuICAgIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXBJZHM6IHN0cmluZ1tdO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqXG4gICAqIElkZW50aXR5IER5bmFtb0RC44OG44O844OW44OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaWRlbnRpdHlUYWJsZTogZHluYW1vZGIuVGFibGU7XG5cbiAgLyoqXG4gICAqIEFEIFN5bmMgTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWRTeW5jRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLyoqXG4gICAqIExhbWJkYeWun+ihjOODreODvOODq1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYVJvbGU6IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBpZiAoIXByb3BzLmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdBZ2VudENvcmUgSWRlbnRpdHkgaXMgZGlzYWJsZWQnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJZGVudGl0eSBEeW5hbW9EQuODhuODvOODluODq+S9nOaIkFxuICAgIGNvbnN0IHRhYmxlTmFtZSA9IHByb3BzLmlkZW50aXR5VGFibGVOYW1lIHx8IFxuICAgICAgYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWlkZW50aXR5YDtcblxuICAgIHRoaXMuaWRlbnRpdHlUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSWRlbnRpdHlUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VybmFtZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdleHBpcmVzQXQnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh5a6f6KGM44Ot44O844Or5L2c5oiQXG4gICAgdGhpcy5sYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBJZGVudGl0eSBMYW1iZGEgZXhlY3V0aW9uIHJvbGUnLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQuaoqemZkOi/veWKoFxuICAgIHRoaXMuaWRlbnRpdHlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5sYW1iZGFSb2xlKTtcblxuICAgIC8vIEFEIFN5bmPmqZ/og73jgYzmnInlirnjgarloLTlkIhcbiAgICBpZiAocHJvcHMuYWRTeW5jRW5hYmxlZCAmJiBwcm9wcy5hZEVjMkluc3RhbmNlSWQpIHtcbiAgICAgIC8vIFNTTSBSdW4gQ29tbWFuZOaoqemZkOi/veWKoFxuICAgICAgdGhpcy5sYW1iZGFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NzbTpTZW5kQ29tbWFuZCcsXG4gICAgICAgICAgJ3NzbTpHZXRDb21tYW5kSW52b2NhdGlvbidcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6ZWMyOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06aW5zdGFuY2UvJHtwcm9wcy5hZEVjMkluc3RhbmNlSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpzc206JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufTo6ZG9jdW1lbnQvQVdTLVJ1blBvd2VyU2hlbGxTY3JpcHRgXG4gICAgICAgIF1cbiAgICAgIH0pKTtcblxuICAgICAgLy8gVlBD57Wx5ZCI44GM5pyJ5Yq544Gq5aC05ZCI44CBVlBD5qip6ZmQ6L+95YqgXG4gICAgICBpZiAocHJvcHMudnBjQ29uZmlnKSB7XG4gICAgICAgIHRoaXMubGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAnZWMyOkRlc2NyaWJlTmV0d29ya0ludGVyZmFjZXMnLFxuICAgICAgICAgICAgJ2VjMjpEZWxldGVOZXR3b3JrSW50ZXJmYWNlJyxcbiAgICAgICAgICAgICdlYzI6QXNzaWduUHJpdmF0ZUlwQWRkcmVzc2VzJyxcbiAgICAgICAgICAgICdlYzI6VW5hc3NpZ25Qcml2YXRlSXBBZGRyZXNzZXMnXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgIH0pKTtcbiAgICAgIH1cblxuICAgICAgLy8gQUQgU3luYyBMYW1iZGHplqLmlbDkvZzmiJBcbiAgICAgIHRoaXMuYWRTeW5jRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZFN5bmNGdW5jdGlvbicsIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWQtc3luY2AsXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FnZW50LWNvcmUtYWQtc3luYycpLFxuICAgICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKHByb3BzLnNzbVRpbWVvdXQgPyBwcm9wcy5zc21UaW1lb3V0ICsgMzAgOiA2MCksXG4gICAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBBRF9FQzJfSU5TVEFOQ0VfSUQ6IHByb3BzLmFkRWMySW5zdGFuY2VJZCxcbiAgICAgICAgICBJREVOVElUWV9UQUJMRV9OQU1FOiB0aGlzLmlkZW50aXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIFNTTV9USU1FT1VUOiAocHJvcHMuc3NtVGltZW91dCB8fCAzMCkudG9TdHJpbmcoKSxcbiAgICAgICAgICBTSURfQ0FDSEVfVFRMOiAocHJvcHMuc2lkQ2FjaGVUdGwgfHwgODY0MDApLnRvU3RyaW5nKClcbiAgICAgICAgfSxcbiAgICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBBRCBTeW5jIC0gQWN0aXZlIERpcmVjdG9yeSBTSUToh6rli5Xlj5blvpcnXG4gICAgICB9KTtcblxuICAgICAgLy8g44K/44Kw6L+95YqgXG4gICAgICBjZGsuVGFncy5vZih0aGlzLmFkU3luY0Z1bmN0aW9uKS5hZGQoJ1Byb2plY3QnLCBwcm9wcy5wcm9qZWN0TmFtZSk7XG4gICAgICBjZGsuVGFncy5vZih0aGlzLmFkU3luY0Z1bmN0aW9uKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcy5hZFN5bmNGdW5jdGlvbikuYWRkKCdDb21wb25lbnQnLCAnQWdlbnRDb3JlLUlkZW50aXR5Jyk7XG4gICAgfVxuXG4gICAgLy8g44K/44Kw6L+95YqgXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5pZGVudGl0eVRhYmxlKS5hZGQoJ1Byb2plY3QnLCBwcm9wcy5wcm9qZWN0TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5pZGVudGl0eVRhYmxlKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuaWRlbnRpdHlUYWJsZSkuYWRkKCdDb21wb25lbnQnLCAnQWdlbnRDb3JlLUlkZW50aXR5Jyk7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbuWHuuWKm1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJZGVudGl0eVRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmlkZW50aXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgSWRlbnRpdHkgRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0taWRlbnRpdHktdGFibGUtbmFtZWBcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmFkU3luY0Z1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWRTeW5jRnVuY3Rpb25Bcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFkU3luY0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBBRCBTeW5jIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWQtc3luYy1mdW5jdGlvbi1hcm5gXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==