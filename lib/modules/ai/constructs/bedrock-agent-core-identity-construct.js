"use strict";
/**
 * Amazon Bedrock AgentCore Identity Construct
 *
 * このConstructは、Bedrock Agentの認証・認可機能を提供します。
 * エージェントID管理、RBAC、ABACを統合します。
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
exports.BedrockAgentCoreIdentityConstruct = exports.AgentRole = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const constructs_1 = require("constructs");
/**
 * ロール定義
 */
var AgentRole;
(function (AgentRole) {
    AgentRole["ADMIN"] = "Admin";
    AgentRole["USER"] = "User";
    AgentRole["READ_ONLY"] = "ReadOnly";
})(AgentRole || (exports.AgentRole = AgentRole = {}));
/**
 * Amazon Bedrock AgentCore Identity Construct
 *
 * このConstructは、以下の機能を提供します：
 * - エージェントID管理（DynamoDB）
 * - RBAC（Role-Based Access Control）
 * - ABAC（Attribute-Based Access Control）
 * - KMS暗号化によるデータ保護
 * - IAM統合
 */
class BedrockAgentCoreIdentityConstruct extends constructs_1.Construct {
    /**
     * DynamoDBテーブル（エージェントID管理）
     */
    identityTable;
    /**
     * KMS Key
     */
    kmsKey;
    /**
     * IAM Role（Identity管理ロール）
     */
    managementRole;
    /**
     * ロール定義マップ
     */
    roles;
    /**
     * Lambda関数（Identity管理API）
     */
    lambdaFunction;
    constructor(scope, id, props) {
        super(scope, id);
        // Identity機能が無効の場合は何もしない
        if (!props.enabled) {
            this.roles = new Map();
            return;
        }
        // KMS Key作成（有効な場合）
        if (props.kmsConfig?.enabled !== false) {
            this.kmsKey = this.createKmsKey(props);
        }
        // DynamoDBテーブル作成
        this.identityTable = this.createIdentityTable(props);
        // IAM Role作成
        this.managementRole = this.createManagementRole(props);
        // RBAC設定
        this.roles = new Map();
        if (props.rbacConfig?.enabled !== false) {
            this.setupRbac(props);
        }
        // Lambda関数作成
        this.lambdaFunction = this.createLambdaFunction(props);
        // タグ付け
        cdk.Tags.of(this).add('Component', 'BedrockAgentCoreIdentity');
        cdk.Tags.of(this).add('Project', props.projectName);
        cdk.Tags.of(this).add('Environment', props.environment);
    }
    /**
     * KMS Key作成
     */
    createKmsKey(props) {
        if (props.kmsConfig?.kmsKey) {
            return props.kmsConfig.kmsKey;
        }
        return new kms.Key(this, 'KmsKey', {
            description: `KMS Key for ${props.projectName} Bedrock AgentCore Identity`,
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
    }
    /**
     * DynamoDBテーブル作成
     */
    createIdentityTable(props) {
        const tableName = props.dynamoDbConfig?.tableName ||
            `${props.projectName}-${props.environment}-agent-identity`;
        return new dynamodb.Table(this, 'IdentityTable', {
            tableName,
            partitionKey: {
                name: 'agentId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER,
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: props.dynamoDbConfig?.readCapacity || 5,
            writeCapacity: props.dynamoDbConfig?.writeCapacity || 5,
            encryption: this.kmsKey
                ? dynamodb.TableEncryption.CUSTOMER_MANAGED
                : dynamodb.TableEncryption.AWS_MANAGED,
            encryptionKey: this.kmsKey,
            pointInTimeRecovery: props.dynamoDbConfig?.pointInTimeRecovery !== false,
            deletionProtection: props.dynamoDbConfig?.deletionProtection !== false,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });
    }
    /**
     * IAM Role作成
     */
    createManagementRole(props) {
        const role = new iam.Role(this, 'ManagementRole', {
            roleName: `${props.projectName}-${props.environment}-identity-management-role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Management role for Bedrock AgentCore Identity',
        });
        // 基本的なLambda実行権限
        role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        // DynamoDB権限
        if (this.identityTable) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                    'dynamodb:Scan',
                ],
                resources: [this.identityTable.tableArn],
            }));
        }
        // KMS権限
        if (this.kmsKey) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'kms:Decrypt',
                    'kms:Encrypt',
                    'kms:DescribeKey',
                    'kms:GenerateDataKey',
                ],
                resources: [this.kmsKey.keyArn],
            }));
        }
        return role;
    }
    /**
     * RBAC設定
     */
    setupRbac(props) {
        // 標準ロール作成
        this.createStandardRoles(props);
        // カスタムロール作成
        if (props.rbacConfig?.customRoles) {
            this.createCustomRoles(props);
        }
    }
    /**
     * 標準ロール作成
     */
    createStandardRoles(props) {
        // Adminロール
        const adminRole = new iam.Role(this, 'AdminRole', {
            roleName: `${props.projectName}-${props.environment}-agent-admin-role`,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'Admin role for Bedrock AgentCore',
        });
        adminRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:*'],
            resources: ['*'],
        }));
        this.roles.set(AgentRole.ADMIN, adminRole);
        // Userロール
        const userRole = new iam.Role(this, 'UserRole', {
            roleName: `${props.projectName}-${props.environment}-agent-user-role`,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'User role for Bedrock AgentCore',
        });
        userRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeAgent',
                'bedrock:GetAgent',
                'bedrock:ListAgents',
            ],
            resources: ['*'],
        }));
        this.roles.set(AgentRole.USER, userRole);
        // ReadOnlyロール
        const readOnlyRole = new iam.Role(this, 'ReadOnlyRole', {
            roleName: `${props.projectName}-${props.environment}-agent-readonly-role`,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'ReadOnly role for Bedrock AgentCore',
        });
        readOnlyRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:GetAgent',
                'bedrock:ListAgents',
            ],
            resources: ['*'],
        }));
        this.roles.set(AgentRole.READ_ONLY, readOnlyRole);
    }
    /**
     * カスタムロール作成
     */
    createCustomRoles(props) {
        if (!props.rbacConfig?.customRoles) {
            return;
        }
        Object.entries(props.rbacConfig.customRoles).forEach(([roleName, roleConfig]) => {
            const role = new iam.Role(this, `CustomRole${roleName}`, {
                roleName: `${props.projectName}-${props.environment}-agent-${roleName.toLowerCase()}-role`,
                assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
                description: roleConfig.description,
            });
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: roleConfig.permissions,
                resources: ['*'],
            }));
            this.roles.set(roleName, role);
        });
    }
    /**
     * エージェントID生成
     */
    generateAgentId() {
        return `agent-${cdk.Names.uniqueId(this).toLowerCase()}`;
    }
    /**
     * ロール取得
     */
    getRole(roleName) {
        return this.roles.get(roleName);
    }
    /**
     * DynamoDBテーブルへのアクセス権限付与
     */
    grantReadWrite(grantee) {
        if (!this.identityTable) {
            throw new Error('Identity table is not created');
        }
        return this.identityTable.grantReadWriteData(grantee);
    }
    /**
     * DynamoDBテーブルへの読み取り権限付与
     */
    grantRead(grantee) {
        if (!this.identityTable) {
            throw new Error('Identity table is not created');
        }
        return this.identityTable.grantReadData(grantee);
    }
    /**
     * Lambda関数作成
     */
    createLambdaFunction(props) {
        const fn = new lambda.Function(this, 'Function', {
            functionName: `${props.projectName}-${props.environment}-identity-function`,
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/agent-core-identity', {
                bundling: {
                    image: lambda.Runtime.NODEJS_22_X.bundlingImage,
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
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            environment: {
                PROJECT_NAME: props.projectName,
                ENVIRONMENT: props.environment,
                IDENTITY_TABLE_NAME: this.identityTable?.tableName || '',
                AWS_REGION: cdk.Stack.of(this).region,
            },
            environmentEncryption: this.kmsKey,
            role: this.managementRole,
            description: 'Bedrock AgentCore Identity management Lambda function',
        });
        return fn;
    }
}
exports.BedrockAgentCoreIdentityConstruct = BedrockAgentCoreIdentityConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWlkZW50aXR5LWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtY29yZS1pZGVudGl0eS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7R0FTRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELDJDQUF1QztBQUV2Qzs7R0FFRztBQUNILElBQVksU0FJWDtBQUpELFdBQVksU0FBUztJQUNuQiw0QkFBZSxDQUFBO0lBQ2YsMEJBQWEsQ0FBQTtJQUNiLG1DQUFzQixDQUFBO0FBQ3hCLENBQUMsRUFKVyxTQUFTLHlCQUFULFNBQVMsUUFJcEI7QUEwSkQ7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxpQ0FBa0MsU0FBUSxzQkFBUztJQUM5RDs7T0FFRztJQUNhLGFBQWEsQ0FBa0I7SUFFL0M7O09BRUc7SUFDYSxNQUFNLENBQVk7SUFFbEM7O09BRUc7SUFDYSxjQUFjLENBQVk7SUFFMUM7O09BRUc7SUFDYSxLQUFLLENBQXdCO0lBRTdDOztPQUVHO0lBQ2EsY0FBYyxDQUFtQjtJQUVqRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTZDO1FBQ3JGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ3ZCLE9BQU87UUFDVCxDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRSxPQUFPLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFB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QUFFO29CQUNSLEtBQUssRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxhQUFhO29CQUMvQyxPQUFPLEVBQUU7d0JBQ1AsTUFBTTt3QkFDTixJQUFJO3dCQUNKOzRCQUNFLGFBQWE7NEJBQ2IsZUFBZTs0QkFDZiw2QkFBNkI7NEJBQzdCLGdDQUFnQzs0QkFDaEMsa0JBQWtCOzRCQUNsQix3QkFBd0I7eUJBQ3pCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztxQkFDZjtvQkFDRCxJQUFJLEVBQUUsTUFBTTtpQkFDYjthQUNGLENBQUM7WUFDRixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFO2dCQUNYLFlBQVksRUFBRSxLQUFLLENBQUMsV0FBVztnQkFDL0IsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO2dCQUM5QixtQkFBbUIsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLFNBQVMsSUFBSSxFQUFFO2dCQUN4RCxVQUFVLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTTthQUN0QztZQUNELHFCQUFxQixFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ2xDLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYztZQUN6QixXQUFXLEVBQUUsdURBQXVEO1NBQ3JFLENBQUMsQ0FBQztRQUVILE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztDQUNGO0FBblZELDhFQW1WQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIElkZW50aXR5IENvbnN0cnVjdFxuICogXG4gKiDjgZPjga5Db25zdHJ1Y3Tjga/jgIFCZWRyb2NrIEFnZW5044Gu6KqN6Ki844O76KqN5Y+v5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKiDjgqjjg7zjgrjjgqfjg7Pjg4hJROeuoeeQhuOAgVJCQUPjgIFBQkFD44KS57Wx5ZCI44GX44G+44GZ44CCXG4gKiBcbiAqIEBhdXRob3IgS2lybyBBSVxuICogQGRhdGUgMjAyNi0wMS0wM1xuICogQHZlcnNpb24gMS4wLjBcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vKipcbiAqIOODreODvOODq+Wumue+qVxuICovXG5leHBvcnQgZW51bSBBZ2VudFJvbGUge1xuICBBRE1JTiA9ICdBZG1pbicsXG4gIFVTRVIgPSAnVXNlcicsXG4gIFJFQURfT05MWSA9ICdSZWFkT25seScsXG59XG5cbi8qKlxuICog5bGe5oCn5a6a576p77yIQUJBQ+eUqO+8iVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFnZW50QXR0cmlidXRlcyB7XG4gIC8qKlxuICAgKiDpg6jnvbJcbiAgICovXG4gIHJlYWRvbmx5IGRlcGFydG1lbnQ/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiFxuICAgKi9cbiAgcmVhZG9ubHkgcHJvamVjdD86IHN0cmluZztcblxuICAvKipcbiAgICog5qmf5a+G5bqm44Os44OZ44Or77yIcHVibGljLCBpbnRlcm5hbCwgY29uZmlkZW50aWFsLCBzZWNyZXTvvIlcbiAgICovXG4gIHJlYWRvbmx5IHNlbnNpdGl2aXR5PzogJ3B1YmxpYycgfCAnaW50ZXJuYWwnIHwgJ2NvbmZpZGVudGlhbCcgfCAnc2VjcmV0JztcblxuICAvKipcbiAgICog44Kr44K544K/44Og5bGe5oCnXG4gICAqL1xuICByZWFkb25seSBjdXN0b21BdHRyaWJ1dGVzPzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3Tjga7jg5fjg63jg5Hjg4bjgqNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3RQcm9wcyB7XG4gIC8qKlxuICAgKiBJZGVudGl0eeapn+iDveOCkuacieWKueWMluOBmeOCi+OBi+OBqeOBhuOBi1xuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIhkZXYsIHN0YWdpbmcsIHByb2TnrYnvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBkeW5hbW9EYkNvbmZpZz86IHtcbiAgICAvKipcbiAgICAgKiDjg4bjg7zjg5bjg6vlkI1cbiAgICAgKiBAZGVmYXVsdCBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tYWdlbnQtaWRlbnRpdHlgXG4gICAgICovXG4gICAgcmVhZG9ubHkgdGFibGVOYW1lPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICog6Kqt44G/5Y+W44KK44Kt44Oj44OR44K344OG44Kj44Om44OL44OD44OIXG4gICAgICogQGRlZmF1bHQgNVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHJlYWRDYXBhY2l0eT86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOabuOOBjei+vOOBv+OCreODo+ODkeOCt+ODhuOCo+ODpuODi+ODg+ODiFxuICAgICAqIEBkZWZhdWx0IDVcbiAgICAgKi9cbiAgICByZWFkb25seSB3cml0ZUNhcGFjaXR5PzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICogUG9pbnQtaW4tVGltZSBSZWNvdmVyeeOCkuacieWKueWMllxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBwb2ludEluVGltZVJlY292ZXJ5PzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOWJiumZpOS/neitt+OCkuacieWKueWMllxuICAgICAqIEBkZWZhdWx0IHRydWXvvIjmnKznlarnkrDlooPvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBkZWxldGlvblByb3RlY3Rpb24/OiBib29sZWFuO1xuICB9O1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJboqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IGttc0NvbmZpZz86IHtcbiAgICAvKipcbiAgICAgKiBLTVPmmpflj7fljJbjgpLmnInlirnljJbjgZnjgovjgYvjganjgYbjgYtcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgcmVhZG9ubHkgZW5hYmxlZD86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDml6LlrZjjga5LTVMgS2V544KS5L2/55So44GZ44KL5aC05ZCIXG4gICAgICovXG4gICAgcmVhZG9ubHkga21zS2V5Pzoga21zLklLZXk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJCQUPoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHJiYWNDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICogUkJBQ+OCkuacieWKueWMluOBmeOCi+OBi+OBqeOBhuOBi1xuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBlbmFibGVkPzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOODh+ODleOCqeODq+ODiOODreODvOODq1xuICAgICAqIEBkZWZhdWx0IEFnZW50Um9sZS5VU0VSXG4gICAgICovXG4gICAgcmVhZG9ubHkgZGVmYXVsdFJvbGU/OiBBZ2VudFJvbGU7XG5cbiAgICAvKipcbiAgICAgKiDjgqvjgrnjgr/jg6Djg63jg7zjg6vlrprnvqlcbiAgICAgKi9cbiAgICByZWFkb25seSBjdXN0b21Sb2xlcz86IHtcbiAgICAgIFtyb2xlTmFtZTogc3RyaW5nXToge1xuICAgICAgICBwZXJtaXNzaW9uczogc3RyaW5nW107XG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgICB9O1xuICAgIH07XG4gIH07XG5cbiAgLyoqXG4gICAqIEFCQUPoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IGFiYWNDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICogQUJBQ+OCkuacieWKueWMluOBmeOCi+OBi+OBqeOBhuOBi1xuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBlbmFibGVkPzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOW/hemgiOWxnuaAp1xuICAgICAqL1xuICAgIHJlYWRvbmx5IHJlcXVpcmVkQXR0cmlidXRlcz86IHN0cmluZ1tdO1xuXG4gICAgLyoqXG4gICAgICog5bGe5oCn5qSc6Ki844Or44O844OrXG4gICAgICovXG4gICAgcmVhZG9ubHkgdmFsaWRhdGlvblJ1bGVzPzoge1xuICAgICAgW2F0dHJpYnV0ZU5hbWU6IHN0cmluZ106IHtcbiAgICAgICAgdHlwZTogJ3N0cmluZycgfCAnbnVtYmVyJyB8ICdib29sZWFuJyB8ICdlbnVtJztcbiAgICAgICAgcmVxdWlyZWQ/OiBib29sZWFuO1xuICAgICAgICBwYXR0ZXJuPzogc3RyaW5nO1xuICAgICAgICBlbnVtVmFsdWVzPzogc3RyaW5nW107XG4gICAgICB9O1xuICAgIH07XG4gIH07XG59XG5cbi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIElkZW50aXR5IENvbnN0cnVjdFxuICogXG4gKiDjgZPjga5Db25zdHJ1Y3Tjga/jgIHku6XkuIvjga7mqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnvvJpcbiAqIC0g44Ko44O844K444Kn44Oz44OISUTnrqHnkIbvvIhEeW5hbW9EQu+8iVxuICogLSBSQkFD77yIUm9sZS1CYXNlZCBBY2Nlc3MgQ29udHJvbO+8iVxuICogLSBBQkFD77yIQXR0cmlidXRlLUJhc2VkIEFjY2VzcyBDb250cm9s77yJXG4gKiAtIEtNU+aal+WPt+WMluOBq+OCiOOCi+ODh+ODvOOCv+S/neitt1xuICogLSBJQU3ntbHlkIhcbiAqL1xuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBEeW5hbW9EQuODhuODvOODluODq++8iOOCqOODvOOCuOOCp+ODs+ODiElE566h55CG77yJXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaWRlbnRpdHlUYWJsZT86IGR5bmFtb2RiLlRhYmxlO1xuXG4gIC8qKlxuICAgKiBLTVMgS2V5XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkga21zS2V5Pzoga21zLklLZXk7XG5cbiAgLyoqXG4gICAqIElBTSBSb2xl77yISWRlbnRpdHnnrqHnkIbjg63jg7zjg6vvvIlcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtYW5hZ2VtZW50Um9sZT86IGlhbS5Sb2xlO1xuXG4gIC8qKlxuICAgKiDjg63jg7zjg6vlrprnvqnjg57jg4Pjg5dcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSByb2xlczogTWFwPHN0cmluZywgaWFtLlJvbGU+O1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDvvIhJZGVudGl0eeeuoeeQhkFQSe+8iVxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYUZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBJZGVudGl0eeapn+iDveOBjOeEoeWKueOBruWgtOWQiOOBr+S9leOCguOBl+OBquOBhFxuICAgIGlmICghcHJvcHMuZW5hYmxlZCkge1xuICAgICAgdGhpcy5yb2xlcyA9IG5ldyBNYXAoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBLTVMgS2V55L2c5oiQ77yI5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLmttc0NvbmZpZz8uZW5hYmxlZCAhPT0gZmFsc2UpIHtcbiAgICAgIHRoaXMua21zS2V5ID0gdGhpcy5jcmVhdGVLbXNLZXkocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIER5bmFtb0RC44OG44O844OW44Or5L2c5oiQXG4gICAgdGhpcy5pZGVudGl0eVRhYmxlID0gdGhpcy5jcmVhdGVJZGVudGl0eVRhYmxlKHByb3BzKTtcblxuICAgIC8vIElBTSBSb2xl5L2c5oiQXG4gICAgdGhpcy5tYW5hZ2VtZW50Um9sZSA9IHRoaXMuY3JlYXRlTWFuYWdlbWVudFJvbGUocHJvcHMpO1xuXG4gICAgLy8gUkJBQ+ioreWumlxuICAgIHRoaXMucm9sZXMgPSBuZXcgTWFwKCk7XG4gICAgaWYgKHByb3BzLnJiYWNDb25maWc/LmVuYWJsZWQgIT09IGZhbHNlKSB7XG4gICAgICB0aGlzLnNldHVwUmJhYyhwcm9wcyk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbiA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24ocHJvcHMpO1xuXG4gICAgLy8g44K/44Kw5LuY44GRXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgcHJvcHMucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICogS01TIEtleeS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVLbXNLZXkocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdFByb3BzKToga21zLklLZXkge1xuICAgIGlmIChwcm9wcy5rbXNDb25maWc/Lmttc0tleSkge1xuICAgICAgcmV0dXJuIHByb3BzLmttc0NvbmZpZy5rbXNLZXk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBrbXMuS2V5KHRoaXMsICdLbXNLZXknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYEtNUyBLZXkgZm9yICR7cHJvcHMucHJvamVjdE5hbWV9IEJlZHJvY2sgQWdlbnRDb3JlIElkZW50aXR5YCxcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUlkZW50aXR5VGFibGUocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdFByb3BzKTogZHluYW1vZGIuVGFibGUge1xuICAgIGNvbnN0IHRhYmxlTmFtZSA9IHByb3BzLmR5bmFtb0RiQ29uZmlnPy50YWJsZU5hbWUgfHwgXG4gICAgICBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWdlbnQtaWRlbnRpdHlgO1xuXG4gICAgcmV0dXJuIG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSWRlbnRpdHlUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZSxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYWdlbnRJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIHJlYWRDYXBhY2l0eTogcHJvcHMuZHluYW1vRGJDb25maWc/LnJlYWRDYXBhY2l0eSB8fCA1LFxuICAgICAgd3JpdGVDYXBhY2l0eTogcHJvcHMuZHluYW1vRGJDb25maWc/LndyaXRlQ2FwYWNpdHkgfHwgNSxcbiAgICAgIGVuY3J5cHRpb246IHRoaXMua21zS2V5IFxuICAgICAgICA/IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5DVVNUT01FUl9NQU5BR0VEXG4gICAgICAgIDogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXksXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBwcm9wcy5keW5hbW9EYkNvbmZpZz8ucG9pbnRJblRpbWVSZWNvdmVyeSAhPT0gZmFsc2UsXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IHByb3BzLmR5bmFtb0RiQ29uZmlnPy5kZWxldGlvblByb3RlY3Rpb24gIT09IGZhbHNlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSUFNIFJvbGXkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTWFuYWdlbWVudFJvbGUocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ01hbmFnZW1lbnRSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1pZGVudGl0eS1tYW5hZ2VtZW50LXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbmFnZW1lbnQgcm9sZSBmb3IgQmVkcm9jayBBZ2VudENvcmUgSWRlbnRpdHknLFxuICAgIH0pO1xuXG4gICAgLy8g5Z+65pys55qE44GqTGFtYmRh5a6f6KGM5qip6ZmQXG4gICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJylcbiAgICApO1xuXG4gICAgLy8gRHluYW1vRELmqKnpmZBcbiAgICBpZiAodGhpcy5pZGVudGl0eVRhYmxlKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFt0aGlzLmlkZW50aXR5VGFibGUudGFibGVBcm5dLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBLTVPmqKnpmZBcbiAgICBpZiAodGhpcy5rbXNLZXkpIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgICAgICdrbXM6RW5jcnlwdCcsXG4gICAgICAgICAgICAna21zOkRlc2NyaWJlS2V5JyxcbiAgICAgICAgICAgICdrbXM6R2VuZXJhdGVEYXRhS2V5JyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW3RoaXMua21zS2V5LmtleUFybl0sXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiByb2xlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJCQUPoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBSYmFjKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3RQcm9wcyk6IHZvaWQge1xuICAgIC8vIOaomea6luODreODvOODq+S9nOaIkFxuICAgIHRoaXMuY3JlYXRlU3RhbmRhcmRSb2xlcyhwcm9wcyk7XG5cbiAgICAvLyDjgqvjgrnjgr/jg6Djg63jg7zjg6vkvZzmiJBcbiAgICBpZiAocHJvcHMucmJhY0NvbmZpZz8uY3VzdG9tUm9sZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlQ3VzdG9tUm9sZXMocHJvcHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmqJnmupbjg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU3RhbmRhcmRSb2xlcyhwcm9wczogQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0UHJvcHMpOiB2b2lkIHtcbiAgICAvLyBBZG1pbuODreODvOODq1xuICAgIGNvbnN0IGFkbWluUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWRtaW5Sb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1hZG1pbi1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gcm9sZSBmb3IgQmVkcm9jayBBZ2VudENvcmUnLFxuICAgIH0pO1xuXG4gICAgYWRtaW5Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazoqJ10sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnJvbGVzLnNldChBZ2VudFJvbGUuQURNSU4sIGFkbWluUm9sZSk7XG5cbiAgICAvLyBVc2Vy44Ot44O844OrXG4gICAgY29uc3QgdXNlclJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1VzZXJSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC11c2VyLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIHJvbGUgZm9yIEJlZHJvY2sgQWdlbnRDb3JlJyxcbiAgICB9KTtcblxuICAgIHVzZXJSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudCcsXG4gICAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5yb2xlcy5zZXQoQWdlbnRSb2xlLlVTRVIsIHVzZXJSb2xlKTtcblxuICAgIC8vIFJlYWRPbmx544Ot44O844OrXG4gICAgY29uc3QgcmVhZE9ubHlSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdSZWFkT25seVJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LXJlYWRvbmx5LXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWFkT25seSByb2xlIGZvciBCZWRyb2NrIEFnZW50Q29yZScsXG4gICAgfSk7XG5cbiAgICByZWFkT25seVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jazpMaXN0QWdlbnRzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMucm9sZXMuc2V0KEFnZW50Um9sZS5SRUFEX09OTFksIHJlYWRPbmx5Um9sZSk7XG4gIH1cblxuICAvKipcbiAgICog44Kr44K544K/44Og44Ot44O844Or5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUN1c3RvbVJvbGVzKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3RQcm9wcyk6IHZvaWQge1xuICAgIGlmICghcHJvcHMucmJhY0NvbmZpZz8uY3VzdG9tUm9sZXMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBPYmplY3QuZW50cmllcyhwcm9wcy5yYmFjQ29uZmlnLmN1c3RvbVJvbGVzKS5mb3JFYWNoKChbcm9sZU5hbWUsIHJvbGVDb25maWddKSA9PiB7XG4gICAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIGBDdXN0b21Sb2xlJHtyb2xlTmFtZX1gLCB7XG4gICAgICAgIHJvbGVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWdlbnQtJHtyb2xlTmFtZS50b0xvd2VyQ2FzZSgpfS1yb2xlYCxcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgICAgICBkZXNjcmlwdGlvbjogcm9sZUNvbmZpZy5kZXNjcmlwdGlvbixcbiAgICAgIH0pO1xuXG4gICAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IHJvbGVDb25maWcucGVybWlzc2lvbnMsXG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAgIHRoaXMucm9sZXMuc2V0KHJvbGVOYW1lLCByb2xlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqjjg7zjgrjjgqfjg7Pjg4hJROeUn+aIkFxuICAgKi9cbiAgcHVibGljIGdlbmVyYXRlQWdlbnRJZCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBgYWdlbnQtJHtjZGsuTmFtZXMudW5pcXVlSWQodGhpcykudG9Mb3dlckNhc2UoKX1gO1xuICB9XG5cbiAgLyoqXG4gICAqIOODreODvOODq+WPluW+l1xuICAgKi9cbiAgcHVibGljIGdldFJvbGUocm9sZU5hbWU6IHN0cmluZyk6IGlhbS5Sb2xlIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5yb2xlcy5nZXQocm9sZU5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or44G444Gu44Ki44Kv44K744K55qip6ZmQ5LuY5LiOXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRSZWFkV3JpdGUoZ3JhbnRlZTogaWFtLklHcmFudGFibGUpOiBpYW0uR3JhbnQge1xuICAgIGlmICghdGhpcy5pZGVudGl0eVRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lkZW50aXR5IHRhYmxlIGlzIG5vdCBjcmVhdGVkJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaWRlbnRpdHlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZ3JhbnRlZSk7XG4gIH1cblxuICAvKipcbiAgICogRHluYW1vRELjg4bjg7zjg5bjg6vjgbjjga7oqq3jgb/lj5bjgormqKnpmZDku5jkuI5cbiAgICovXG4gIHB1YmxpYyBncmFudFJlYWQoZ3JhbnRlZTogaWFtLklHcmFudGFibGUpOiBpYW0uR3JhbnQge1xuICAgIGlmICghdGhpcy5pZGVudGl0eVRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lkZW50aXR5IHRhYmxlIGlzIG5vdCBjcmVhdGVkJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuaWRlbnRpdHlUYWJsZS5ncmFudFJlYWREYXRhKGdyYW50ZWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbihwcm9wczogQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGNvbnN0IGZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1pZGVudGl0eS1mdW5jdGlvbmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FnZW50LWNvcmUtaWRlbnRpdHknLCB7XG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLmJ1bmRsaW5nSW1hZ2UsXG4gICAgICAgICAgY29tbWFuZDogW1xuICAgICAgICAgICAgJ2Jhc2gnLFxuICAgICAgICAgICAgJy1jJyxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgJ25wbSBpbnN0YWxsJyxcbiAgICAgICAgICAgICAgJ25wbSBydW4gYnVpbGQnLFxuICAgICAgICAgICAgICAnY3AgLXIgZGlzdC8qIC9hc3NldC1vdXRwdXQvJyxcbiAgICAgICAgICAgICAgJ2NwIHBhY2thZ2UuanNvbiAvYXNzZXQtb3V0cHV0LycsXG4gICAgICAgICAgICAgICdjZCAvYXNzZXQtb3V0cHV0JyxcbiAgICAgICAgICAgICAgJ25wbSBpbnN0YWxsIC0tb21pdD1kZXYnLFxuICAgICAgICAgICAgXS5qb2luKCcgJiYgJyksXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2VyOiAncm9vdCcsXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBST0pFQ1RfTkFNRTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgSURFTlRJVFlfVEFCTEVfTkFNRTogdGhpcy5pZGVudGl0eVRhYmxlPy50YWJsZU5hbWUgfHwgJycsXG4gICAgICAgIEFXU19SRUdJT046IGNkay5TdGFjay5vZih0aGlzKS5yZWdpb24sXG4gICAgICB9LFxuICAgICAgZW52aXJvbm1lbnRFbmNyeXB0aW9uOiB0aGlzLmttc0tleSxcbiAgICAgIHJvbGU6IHRoaXMubWFuYWdlbWVudFJvbGUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnRDb3JlIElkZW50aXR5IG1hbmFnZW1lbnQgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICB9KTtcblxuICAgIHJldHVybiBmbjtcbiAgfVxufVxuIl19