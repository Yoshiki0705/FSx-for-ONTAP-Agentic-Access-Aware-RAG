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
                    'ssm:SendCommand'
                ],
                resources: [
                    `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:instance/${props.adEc2InstanceId}`,
                    `arn:aws:ssm:${cdk.Stack.of(this).region}::document/AWS-RunPowerShellScript`
                ]
            }));
            // SSM GetCommandInvocation権限（全リソース）
            this.lambdaRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'ssm:GetCommandInvocation'
                ],
                resources: ['*']
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
                code: lambda.Code.fromAsset('lambda/agent-core-ad-sync', {
                    bundling: {
                        image: lambda.Runtime.NODEJS_20_X.bundlingImage,
                        command: [
                            'bash', '-c', [
                                'npm install --production',
                                'npx tsc',
                                'cp -r dist/* /asset-output/',
                                'cp -r node_modules /asset-output/'
                            ].join(' && ')
                        ]
                    }
                }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWlkZW50aXR5LWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtY29yZS1pZGVudGl0eS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7O0dBVUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCxtRUFBcUQ7QUFDckQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3QywyQ0FBdUM7QUF1RHZDLE1BQWEsaUNBQWtDLFNBQVEsc0JBQVM7SUFDOUQ7O09BRUc7SUFDYSxhQUFhLENBQWlCO0lBRTlDOztPQUVHO0lBQ2EsY0FBYyxDQUFtQjtJQUVqRDs7T0FFRztJQUNhLFVBQVUsQ0FBVztJQUVyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTZDO1FBQ3JGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7WUFDOUMsT0FBTztRQUNULENBQUM7UUFFRCwwQkFBMEI7UUFDMUIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLGlCQUFpQjtZQUN2QyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsV0FBVyxDQUFDO1FBRXZELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDN0QsU0FBUyxFQUFFLFNBQVM7WUFDcEIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZ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IElkZW50aXR5IENvbnN0cnVjdFxuICogXG4gKiBBY3RpdmUgRGlyZWN0b3J5IFNJROiHquWLleWPluW+l+OBqElkZW50aXR5566h55CG5qmf6IO944KS5o+Q5L6bXG4gKiBcbiAqIEZlYXR1cmVzOlxuICogLSBBRCBTSUToh6rli5Xlj5blvpfvvIhMYW1iZGEgKyBTU00gUnVuIENvbW1hbmTvvIlcbiAqIC0gRHluYW1vREIgSWRlbnRpdHkgVGFibGXvvIhTSUTjgq3jg6Pjg4Pjgrfjg6XvvIlcbiAqIC0gSUFN5qip6ZmQ566h55CGXG4gKiAtIFZQQ+e1seWQiFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3RQcm9wcyB7XG4gIC8qKlxuICAgKiDmqZ/og73jga7mnInlirnljJbjg5Xjg6njgrBcbiAgICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOWQjVxuICAgKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICog55Kw5aKD5ZCN77yIcHJvZC9kZXYvc3RhZ2luZ++8iVxuICAgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogQUQgU0lE6Ieq5YuV5Y+W5b6X44Gu5pyJ5Yq55YyWXG4gICAqL1xuICByZWFkb25seSBhZFN5bmNFbmFibGVkPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQWN0aXZlIERpcmVjdG9yeSBFQzLjgqTjg7Pjgrnjgr/jg7PjgrlJRFxuICAgKi9cbiAgcmVhZG9ubHkgYWRFYzJJbnN0YW5jZUlkPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBJZGVudGl0eSBEeW5hbW9EQuODhuODvOODluODq+WQjVxuICAgKi9cbiAgcmVhZG9ubHkgaWRlbnRpdHlUYWJsZU5hbWU/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFNJROOCreODo+ODg+OCt+ODpVRUTO+8iOenku+8iVxuICAgKiBAZGVmYXVsdCA4NjQwMCAoMjTmmYLplpMpXG4gICAqL1xuICByZWFkb25seSBzaWRDYWNoZVR0bD86IG51bWJlcjtcblxuICAvKipcbiAgICogU1NN44K/44Kk44Og44Ki44Km44OI77yI56eS77yJXG4gICAqIEBkZWZhdWx0IDMwXG4gICAqL1xuICByZWFkb25seSBzc21UaW1lb3V0PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBWUEPntbHlkIjoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHZwY0NvbmZpZz86IHtcbiAgICByZWFkb25seSB2cGNJZDogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHN1Ym5ldElkczogc3RyaW5nW107XG4gICAgcmVhZG9ubHkgc2VjdXJpdHlHcm91cElkczogc3RyaW5nW107XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKipcbiAgICogSWRlbnRpdHkgRHluYW1vRELjg4bjg7zjg5bjg6tcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBpZGVudGl0eVRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcblxuICAvKipcbiAgICogQUQgU3luYyBMYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhZFN5bmNGdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvKipcbiAgICogTGFtYmRh5a6f6KGM44Ot44O844OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhUm9sZTogaWFtLlJvbGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGlmICghcHJvcHMuZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ0FnZW50Q29yZSBJZGVudGl0eSBpcyBkaXNhYmxlZCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIElkZW50aXR5IER5bmFtb0RC44OG44O844OW44Or5L2c5oiQXG4gICAgY29uc3QgdGFibGVOYW1lID0gcHJvcHMuaWRlbnRpdHlUYWJsZU5hbWUgfHwgXG4gICAgICBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0taWRlbnRpdHlgO1xuXG4gICAgdGhpcy5pZGVudGl0eVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdJZGVudGl0eVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiB0YWJsZU5hbWUsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3VzZXJuYW1lJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ2V4cGlyZXNBdCcsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGHlrp/ooYzjg63jg7zjg6vkvZzmiJBcbiAgICB0aGlzLmxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIElkZW50aXR5IExhbWJkYSBleGVjdXRpb24gcm9sZScsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJylcbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RC5qip6ZmQ6L+95YqgXG4gICAgdGhpcy5pZGVudGl0eVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmxhbWJkYVJvbGUpO1xuXG4gICAgLy8gQUQgU3luY+apn+iDveOBjOacieWKueOBquWgtOWQiFxuICAgIGlmIChwcm9wcy5hZFN5bmNFbmFibGVkICYmIHByb3BzLmFkRWMySW5zdGFuY2VJZCkge1xuICAgICAgLy8gU1NNIFJ1biBDb21tYW5k5qip6ZmQ6L+95YqgXG4gICAgICB0aGlzLmxhbWJkYVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnc3NtOlNlbmRDb21tYW5kJ1xuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czplYzI6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTppbnN0YW5jZS8ke3Byb3BzLmFkRWMySW5zdGFuY2VJZH1gLFxuICAgICAgICAgIGBhcm46YXdzOnNzbToke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259Ojpkb2N1bWVudC9BV1MtUnVuUG93ZXJTaGVsbFNjcmlwdGBcbiAgICAgICAgXVxuICAgICAgfSkpO1xuXG4gICAgICAvLyBTU00gR2V0Q29tbWFuZEludm9jYXRpb27mqKnpmZDvvIjlhajjg6rjgr3jg7zjgrnvvIlcbiAgICAgIHRoaXMubGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdzc206R2V0Q29tbWFuZEludm9jYXRpb24nXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgIH0pKTtcblxuICAgICAgLy8gVlBD57Wx5ZCI44GM5pyJ5Yq544Gq5aC05ZCI44CBVlBD5qip6ZmQ6L+95YqgXG4gICAgICBpZiAocHJvcHMudnBjQ29uZmlnKSB7XG4gICAgICAgIHRoaXMubGFtYmRhUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAnZWMyOkRlc2NyaWJlTmV0d29ya0ludGVyZmFjZXMnLFxuICAgICAgICAgICAgJ2VjMjpEZWxldGVOZXR3b3JrSW50ZXJmYWNlJyxcbiAgICAgICAgICAgICdlYzI6QXNzaWduUHJpdmF0ZUlwQWRkcmVzc2VzJyxcbiAgICAgICAgICAgICdlYzI6VW5hc3NpZ25Qcml2YXRlSXBBZGRyZXNzZXMnXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgIH0pKTtcbiAgICAgIH1cblxuICAgICAgLy8gQUQgU3luYyBMYW1iZGHplqLmlbDkvZzmiJBcbiAgICAgIHRoaXMuYWRTeW5jRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZFN5bmNGdW5jdGlvbicsIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWQtc3luY2AsXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FnZW50LWNvcmUtYWQtc3luYycsIHtcbiAgICAgICAgICBidW5kbGluZzoge1xuICAgICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLmJ1bmRsaW5nSW1hZ2UsXG4gICAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAgICdiYXNoJywgJy1jJywgW1xuICAgICAgICAgICAgICAgICducG0gaW5zdGFsbCAtLXByb2R1Y3Rpb24nLFxuICAgICAgICAgICAgICAgICducHggdHNjJyxcbiAgICAgICAgICAgICAgICAnY3AgLXIgZGlzdC8qIC9hc3NldC1vdXRwdXQvJyxcbiAgICAgICAgICAgICAgICAnY3AgLXIgbm9kZV9tb2R1bGVzIC9hc3NldC1vdXRwdXQvJ1xuICAgICAgICAgICAgICBdLmpvaW4oJyAmJiAnKVxuICAgICAgICAgICAgXVxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIHJvbGU6IHRoaXMubGFtYmRhUm9sZSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMocHJvcHMuc3NtVGltZW91dCA/IHByb3BzLnNzbVRpbWVvdXQgKyAzMCA6IDYwKSxcbiAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIEFEX0VDMl9JTlNUQU5DRV9JRDogcHJvcHMuYWRFYzJJbnN0YW5jZUlkLFxuICAgICAgICAgIElERU5USVRZX1RBQkxFX05BTUU6IHRoaXMuaWRlbnRpdHlUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgU1NNX1RJTUVPVVQ6IChwcm9wcy5zc21UaW1lb3V0IHx8IDMwKS50b1N0cmluZygpLFxuICAgICAgICAgIFNJRF9DQUNIRV9UVEw6IChwcm9wcy5zaWRDYWNoZVR0bCB8fCA4NjQwMCkudG9TdHJpbmcoKVxuICAgICAgICB9LFxuICAgICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIEFEIFN5bmMgLSBBY3RpdmUgRGlyZWN0b3J5IFNJROiHquWLleWPluW+lydcbiAgICAgIH0pO1xuXG4gICAgICAvLyDjgr/jgrDov73liqBcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMuYWRTeW5jRnVuY3Rpb24pLmFkZCgnUHJvamVjdCcsIHByb3BzLnByb2plY3ROYW1lKTtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMuYWRTeW5jRnVuY3Rpb24pLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgICBjZGsuVGFncy5vZih0aGlzLmFkU3luY0Z1bmN0aW9uKS5hZGQoJ0NvbXBvbmVudCcsICdBZ2VudENvcmUtSWRlbnRpdHknKTtcbiAgICB9XG5cbiAgICAvLyDjgr/jgrDov73liqBcbiAgICBjZGsuVGFncy5vZih0aGlzLmlkZW50aXR5VGFibGUpLmFkZCgnUHJvamVjdCcsIHByb3BzLnByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLmlkZW50aXR5VGFibGUpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy5pZGVudGl0eVRhYmxlKS5hZGQoJ0NvbXBvbmVudCcsICdBZ2VudENvcmUtSWRlbnRpdHknKTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0lkZW50aXR5VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuaWRlbnRpdHlUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBJZGVudGl0eSBEeW5hbW9EQiBUYWJsZSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1pZGVudGl0eS10YWJsZS1uYW1lYFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuYWRTeW5jRnVuY3Rpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZFN5bmNGdW5jdGlvbkFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWRTeW5jRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIEFEIFN5bmMgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZC1zeW5jLWZ1bmN0aW9uLWFybmBcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19