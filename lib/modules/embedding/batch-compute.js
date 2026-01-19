"use strict";
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
exports.BatchComputeEnvironment = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
/**
 * AWS Batch Compute Environment Construct
 *
 * SQLite Embedding処理用のBatch環境を構築
 */
class BatchComputeEnvironment extends constructs_1.Construct {
    computeEnvironment;
    jobQueue;
    jobDefinition;
    batchServiceRole;
    instanceRole;
    constructor(scope, id, config) {
        super(scope, id);
        // デフォルト値
        const minvCpus = config.minvCpus ?? 0;
        const maxvCpus = config.maxvCpus ?? 10;
        const desiredvCpus = config.desiredvCpus ?? 0;
        const instanceTypes = config.instanceTypes ?? [
            ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
            ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
        ];
        // Batch Service Role
        this.batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
            roleName: `${config.projectName}-${config.environment}-batch-service-role`,
            assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
            ],
        });
        // EC2 Instance Role
        this.instanceRole = new iam.Role(this, 'InstanceRole', {
            roleName: `${config.projectName}-${config.environment}-batch-instance-role`,
            assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal('ec2.amazonaws.com'), new iam.ServicePrincipal('ecs-tasks.amazonaws.com')),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
            ],
        });
        // Bedrockアクセス権限を追加
        this.instanceRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: ['*'],
        }));
        // Instance Profile
        const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
            instanceProfileName: `${config.projectName}-${config.environment}-batch-instance-profile`,
            roles: [this.instanceRole.roleName],
        });
        // サブネットの決定（明示的指定がある場合はそれを使用、なければVPCから取得）
        const subnets = config.subnetIds ?? config.vpc.privateSubnets.map(subnet => subnet.subnetId);
        // Compute Environment
        this.computeEnvironment = new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
            computeEnvironmentName: `${config.projectName}-${config.environment}-batch-compute-env`,
            type: 'MANAGED',
            state: 'ENABLED',
            serviceRole: this.batchServiceRole.roleArn,
            computeResources: {
                type: 'EC2',
                minvCpus,
                maxvCpus,
                desiredvCpus,
                instanceTypes: instanceTypes.map(t => t.toString()),
                subnets,
                securityGroupIds: [config.securityGroup.securityGroupId],
                instanceRole: instanceProfile.attrArn,
            },
        });
        // Job Queue
        this.jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
            jobQueueName: `${config.projectName}-${config.environment}-batch-job-queue`,
            state: 'ENABLED',
            priority: 1,
            computeEnvironmentOrder: [{
                    order: 1,
                    computeEnvironment: this.computeEnvironment.ref,
                }],
        });
        // Job Definition
        this.jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
            jobDefinitionName: `${config.projectName}-${config.environment}-batch-job-definition`,
            type: 'container',
            containerProperties: {
                image: config.containerImageUri ?? 'amazonlinux:2',
                vcpus: 1,
                memory: 2048,
                jobRoleArn: this.instanceRole.roleArn,
                command: ['echo', 'Hello from Batch job'],
                environment: [
                    {
                        name: 'BEDROCK_MODEL_ID',
                        value: 'us.amazon.nova-pro-v1:0',
                    },
                    {
                        name: 'BEDROCK_REGION',
                        value: 'us-east-1',
                    },
                ],
            },
        });
        // 依存関係の設定
        this.jobQueue.addDependency(this.computeEnvironment);
        this.jobDefinition.addDependency(this.jobQueue);
        // タグの追加
        cdk.Tags.of(this).add('Project', config.projectName);
        cdk.Tags.of(this).add('Environment', config.environment);
        cdk.Tags.of(this).add('Component', 'Batch');
        // Outputs
        new cdk.CfnOutput(this, 'ComputeEnvironmentName', {
            value: this.computeEnvironment.computeEnvironmentName,
            description: 'Batch Compute Environment Name',
        });
        new cdk.CfnOutput(this, 'JobQueueName', {
            value: this.jobQueue.jobQueueName,
            description: 'Batch Job Queue Name',
        });
        new cdk.CfnOutput(this, 'JobDefinitionArn', {
            value: this.jobDefinition.ref,
            description: 'Batch Job Definition ARN',
        });
    }
}
exports.BatchComputeEnvironment = BatchComputeEnvironment;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtY29tcHV0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhdGNoLWNvbXB1dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsNkRBQStDO0FBQy9DLHlEQUEyQztBQUUzQyx5REFBMkM7QUFDM0MsMkNBQXVDO0FBNEJ2Qzs7OztHQUlHO0FBQ0gsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwQyxrQkFBa0IsQ0FBOEI7SUFDaEQsUUFBUSxDQUFvQjtJQUM1QixhQUFhLENBQXlCO0lBQ3RDLGdCQUFnQixDQUFXO0lBQzNCLFlBQVksQ0FBVztJQUV2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLE1BQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsU0FBUztRQUNULE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDO1FBQzlDLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxhQUFhLElBQUk7WUFDNUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7WUFDakUsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7U0FDbkUsQ0FBQztRQUVGLHFCQUFxQjtRQUNyQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFB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VyxDQUFDLENBQUM7UUFDckQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDekQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUU1QyxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUNoRCxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLHNCQUF1QjtZQUN0RCxXQUFXLEVBQUUsZ0NBQWdDO1NBQzlDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQWE7WUFDbEMsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUc7WUFDN0IsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF4SUQsMERBd0lDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iYXRjaCc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLyoqXG4gKiBBV1MgQmF0Y2jnkrDlooPjga7oqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYXRjaENvbXB1dGVDb25maWcge1xuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCNICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIC8qKiDnkrDlooPlkI0gKi9cbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgLyoqIFZQQyAqL1xuICB2cGM6IGVjMi5JVnBjO1xuICAvKiog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXICovXG4gIHNlY3VyaXR5R3JvdXA6IGVjMi5JU2VjdXJpdHlHcm91cDtcbiAgLyoqIOOCteODluODjeODg+ODiElE77yI5piO56S655qE5oyH5a6a77yJICovXG4gIHN1Ym5ldElkcz86IHN0cmluZ1tdO1xuICAvKiog5pyA5bCPdkNQVeaVsCAqL1xuICBtaW52Q3B1cz86IG51bWJlcjtcbiAgLyoqIOacgOWkp3ZDUFXmlbAgKi9cbiAgbWF4dkNwdXM/OiBudW1iZXI7XG4gIC8qKiDluIzmnJt2Q1BV5pWwICovXG4gIGRlc2lyZWR2Q3B1cz86IG51bWJlcjtcbiAgLyoqIOOCpOODs+OCueOCv+ODs+OCueOCv+OCpOODlyAqL1xuICBpbnN0YW5jZVR5cGVzPzogZWMyLkluc3RhbmNlVHlwZVtdO1xuICAvKiog44Kz44Oz44OG44OK44Kk44Oh44O844K4VVJJICovXG4gIGNvbnRhaW5lckltYWdlVXJpPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIEFXUyBCYXRjaCBDb21wdXRlIEVudmlyb25tZW50IENvbnN0cnVjdFxuICogXG4gKiBTUUxpdGUgRW1iZWRkaW5n5Yem55CG55So44GuQmF0Y2jnkrDlooPjgpLmp4vnr4lcbiAqL1xuZXhwb3J0IGNsYXNzIEJhdGNoQ29tcHV0ZUVudmlyb25tZW50IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGNvbXB1dGVFbnZpcm9ubWVudDogYmF0Y2guQ2ZuQ29tcHV0ZUVudmlyb25tZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgam9iUXVldWU6IGJhdGNoLkNmbkpvYlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgam9iRGVmaW5pdGlvbjogYmF0Y2guQ2ZuSm9iRGVmaW5pdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGJhdGNoU2VydmljZVJvbGU6IGlhbS5Sb2xlO1xuICBwdWJsaWMgcmVhZG9ubHkgaW5zdGFuY2VSb2xlOiBpYW0uUm9sZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBjb25maWc6IEJhdGNoQ29tcHV0ZUNvbmZpZykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4jlgKRcbiAgICBjb25zdCBtaW52Q3B1cyA9IGNvbmZpZy5taW52Q3B1cyA/PyAwO1xuICAgIGNvbnN0IG1heHZDcHVzID0gY29uZmlnLm1heHZDcHVzID8/IDEwO1xuICAgIGNvbnN0IGRlc2lyZWR2Q3B1cyA9IGNvbmZpZy5kZXNpcmVkdkNwdXMgPz8gMDtcbiAgICBjb25zdCBpbnN0YW5jZVR5cGVzID0gY29uZmlnLmluc3RhbmNlVHlwZXMgPz8gW1xuICAgICAgZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5NNSwgZWMyLkluc3RhbmNlU2l6ZS5MQVJHRSksXG4gICAgICBlYzIuSW5zdGFuY2VUeXBlLm9mKGVjMi5JbnN0YW5jZUNsYXNzLk01LCBlYzIuSW5zdGFuY2VTaXplLlhMQVJHRSksXG4gICAgXTtcblxuICAgIC8vIEJhdGNoIFNlcnZpY2UgUm9sZVxuICAgIHRoaXMuYmF0Y2hTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQmF0Y2hTZXJ2aWNlUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiBgJHtjb25maWcucHJvamVjdE5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1iYXRjaC1zZXJ2aWNlLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JhdGNoLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NCYXRjaFNlcnZpY2VSb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRUMyIEluc3RhbmNlIFJvbGVcbiAgICB0aGlzLmluc3RhbmNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnSW5zdGFuY2VSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke2NvbmZpZy5wcm9qZWN0TmFtZX0tJHtjb25maWcuZW52aXJvbm1lbnR9LWJhdGNoLWluc3RhbmNlLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlYzIuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJylcbiAgICAgICksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUMyQ29udGFpbmVyU2VydmljZWZvckVDMlJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2Nr44Ki44Kv44K744K55qip6ZmQ44KS6L+95YqgXG4gICAgdGhpcy5pbnN0YW5jZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIEluc3RhbmNlIFByb2ZpbGVcbiAgICBjb25zdCBpbnN0YW5jZVByb2ZpbGUgPSBuZXcgaWFtLkNmbkluc3RhbmNlUHJvZmlsZSh0aGlzLCAnSW5zdGFuY2VQcm9maWxlJywge1xuICAgICAgaW5zdGFuY2VQcm9maWxlTmFtZTogYCR7Y29uZmlnLnByb2plY3ROYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tYmF0Y2gtaW5zdGFuY2UtcHJvZmlsZWAsXG4gICAgICByb2xlczogW3RoaXMuaW5zdGFuY2VSb2xlLnJvbGVOYW1lXSxcbiAgICB9KTtcblxuICAgIC8vIOOCteODluODjeODg+ODiOOBruaxuuWumu+8iOaYjuekuueahOaMh+WumuOBjOOBguOCi+WgtOWQiOOBr+OBneOCjOOCkuS9v+eUqOOAgeOBquOBkeOCjOOBsFZQQ+OBi+OCieWPluW+l++8iVxuICAgIGNvbnN0IHN1Ym5ldHMgPSBjb25maWcuc3VibmV0SWRzID8/IGNvbmZpZy52cGMucHJpdmF0ZVN1Ym5ldHMubWFwKHN1Ym5ldCA9PiBzdWJuZXQuc3VibmV0SWQpO1xuXG4gICAgLy8gQ29tcHV0ZSBFbnZpcm9ubWVudFxuICAgIHRoaXMuY29tcHV0ZUVudmlyb25tZW50ID0gbmV3IGJhdGNoLkNmbkNvbXB1dGVFbnZpcm9ubWVudCh0aGlzLCAnQ29tcHV0ZUVudmlyb25tZW50Jywge1xuICAgICAgY29tcHV0ZUVudmlyb25tZW50TmFtZTogYCR7Y29uZmlnLnByb2plY3ROYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tYmF0Y2gtY29tcHV0ZS1lbnZgLFxuICAgICAgdHlwZTogJ01BTkFHRUQnLFxuICAgICAgc3RhdGU6ICdFTkFCTEVEJyxcbiAgICAgIHNlcnZpY2VSb2xlOiB0aGlzLmJhdGNoU2VydmljZVJvbGUucm9sZUFybixcbiAgICAgIGNvbXB1dGVSZXNvdXJjZXM6IHtcbiAgICAgICAgdHlwZTogJ0VDMicsXG4gICAgICAgIG1pbnZDcHVzLFxuICAgICAgICBtYXh2Q3B1cyxcbiAgICAgICAgZGVzaXJlZHZDcHVzLFxuICAgICAgICBpbnN0YW5jZVR5cGVzOiBpbnN0YW5jZVR5cGVzLm1hcCh0ID0+IHQudG9TdHJpbmcoKSksXG4gICAgICAgIHN1Ym5ldHMsXG4gICAgICAgIHNlY3VyaXR5R3JvdXBJZHM6IFtjb25maWcuc2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWRdLFxuICAgICAgICBpbnN0YW5jZVJvbGU6IGluc3RhbmNlUHJvZmlsZS5hdHRyQXJuLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEpvYiBRdWV1ZVxuICAgIHRoaXMuam9iUXVldWUgPSBuZXcgYmF0Y2guQ2ZuSm9iUXVldWUodGhpcywgJ0pvYlF1ZXVlJywge1xuICAgICAgam9iUXVldWVOYW1lOiBgJHtjb25maWcucHJvamVjdE5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1iYXRjaC1qb2ItcXVldWVgLFxuICAgICAgc3RhdGU6ICdFTkFCTEVEJyxcbiAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgY29tcHV0ZUVudmlyb25tZW50T3JkZXI6IFt7XG4gICAgICAgIG9yZGVyOiAxLFxuICAgICAgICBjb21wdXRlRW52aXJvbm1lbnQ6IHRoaXMuY29tcHV0ZUVudmlyb25tZW50LnJlZixcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgLy8gSm9iIERlZmluaXRpb25cbiAgICB0aGlzLmpvYkRlZmluaXRpb24gPSBuZXcgYmF0Y2guQ2ZuSm9iRGVmaW5pdGlvbih0aGlzLCAnSm9iRGVmaW5pdGlvbicsIHtcbiAgICAgIGpvYkRlZmluaXRpb25OYW1lOiBgJHtjb25maWcucHJvamVjdE5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1iYXRjaC1qb2ItZGVmaW5pdGlvbmAsXG4gICAgICB0eXBlOiAnY29udGFpbmVyJyxcbiAgICAgIGNvbnRhaW5lclByb3BlcnRpZXM6IHtcbiAgICAgICAgaW1hZ2U6IGNvbmZpZy5jb250YWluZXJJbWFnZVVyaSA/PyAnYW1hem9ubGludXg6MicsXG4gICAgICAgIHZjcHVzOiAxLFxuICAgICAgICBtZW1vcnk6IDIwNDgsXG4gICAgICAgIGpvYlJvbGVBcm46IHRoaXMuaW5zdGFuY2VSb2xlLnJvbGVBcm4sXG4gICAgICAgIGNvbW1hbmQ6IFsnZWNobycsICdIZWxsbyBmcm9tIEJhdGNoIGpvYiddLFxuICAgICAgICBlbnZpcm9ubWVudDogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdCRURST0NLX01PREVMX0lEJyxcbiAgICAgICAgICAgIHZhbHVlOiAndXMuYW1hem9uLm5vdmEtcHJvLXYxOjAnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ0JFRFJPQ0tfUkVHSU9OJyxcbiAgICAgICAgICAgIHZhbHVlOiAndXMtZWFzdC0xJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIOS+neWtmOmWouS/guOBruioreWumlxuICAgIHRoaXMuam9iUXVldWUuYWRkRGVwZW5kZW5jeSh0aGlzLmNvbXB1dGVFbnZpcm9ubWVudCk7XG4gICAgdGhpcy5qb2JEZWZpbml0aW9uLmFkZERlcGVuZGVuY3kodGhpcy5qb2JRdWV1ZSk7XG5cbiAgICAvLyDjgr/jgrDjga7ov73liqBcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCBjb25maWcucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBjb25maWcuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0JhdGNoJyk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbXB1dGVFbnZpcm9ubWVudE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb21wdXRlRW52aXJvbm1lbnQuY29tcHV0ZUVudmlyb25tZW50TmFtZSEsXG4gICAgICBkZXNjcmlwdGlvbjogJ0JhdGNoIENvbXB1dGUgRW52aXJvbm1lbnQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSm9iUXVldWVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuam9iUXVldWUuam9iUXVldWVOYW1lISxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQmF0Y2ggSm9iIFF1ZXVlIE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0pvYkRlZmluaXRpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5qb2JEZWZpbml0aW9uLnJlZixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQmF0Y2ggSm9iIERlZmluaXRpb24gQVJOJyxcbiAgICB9KTtcbiAgfVxufVxuIl19