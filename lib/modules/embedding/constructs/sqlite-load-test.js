"use strict";
/**
 * SQLite負荷試験統合コンストラクト
 *
 * FSx for ONTAP上でのSQLite負荷試験とEmbedding処理の統合
 * - AWS Batch統合
 * - EventBridge定期実行
 * - CloudWatch監視
 * - IAM権限管理
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
exports.SqliteLoadTest = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
class SqliteLoadTest extends constructs_1.Construct {
    computeEnvironment;
    jobQueue;
    jobDefinition;
    logGroup;
    scheduledRule;
    serviceRole;
    jobRole;
    eventRole;
    constructor(scope, id, props) {
        super(scope, id);
        // IAMロール作成
        this.serviceRole = this.createBatchServiceRole(props);
        this.jobRole = this.createJobExecutionRole(props);
        this.eventRole = this.createEventBridgeRole(props);
        // CloudWatch Logs
        this.logGroup = this.createLogGroup(props);
        // Batch Compute Environment
        this.computeEnvironment = this.createComputeEnvironment(props);
        // Batch Job Queue
        this.jobQueue = this.createJobQueue(props);
        // Batch Job Definition
        this.jobDefinition = this.createJobDefinition(props);
        // EventBridge定期実行（有効化されている場合）
        if (props.enableScheduledExecution) {
            this.scheduledRule = this.createScheduledRule(props);
        }
        // タグ設定
        this.applyTags(props);
    }
    /**
     * Batch Service Role作成
     */
    createBatchServiceRole(props) {
        return new iam.Role(this, 'BatchServiceRole', {
            roleName: `${props.projectName}-${props.environment}-sqlite-batch-service-role`,
            assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
            ],
        });
    }
    /**
     * Job Execution Role作成
     */
    createJobExecutionRole(props) {
        const role = new iam.Role(this, 'JobExecutionRole', {
            roleName: `${props.projectName}-${props.environment}-sqlite-job-execution-role`,
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
        });
        // Bedrock権限追加
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:ListFoundationModels',
            ],
            resources: [
                `arn:aws:bedrock:${props.bedrockRegion}:*:foundation-model/${props.bedrockModelId}`,
                `arn:aws:bedrock:${props.bedrockRegion}:*:foundation-model/amazon.titan-embed-*`,
            ],
        }));
        // FSx権限追加
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'fsx:DescribeFileSystems',
                'fsx:DescribeStorageVirtualMachines',
                'fsx:DescribeVolumes',
            ],
            resources: [
                `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.fsxFileSystemId}`,
                `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:storage-virtual-machine/${props.fsxSvmId}`,
                `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:volume/${props.fsxVolumeId}`,
            ],
        }));
        return role;
    }
    /**
     * EventBridge Role作成
     */
    createEventBridgeRole(props) {
        const role = new iam.Role(this, 'EventBridgeRole', {
            roleName: `${props.projectName}-${props.environment}-sqlite-eventbridge-role`,
            assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
        });
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['batch:SubmitJob'],
            resources: [
                `arn:aws:batch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:job-queue/*`,
                `arn:aws:batch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:job-definition/*`,
            ],
        }));
        return role;
    }
    /**
     * CloudWatch Log Group作成
     */
    createLogGroup(props) {
        return new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/batch/${props.projectName}-${props.environment}-sqlite-embedding`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
    /**
     * Batch Compute Environment作成
     */
    createComputeEnvironment(props) {
        return new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
            computeEnvironmentName: `${props.projectName}-${props.environment}-sqlite-compute-env`,
            type: 'MANAGED',
            state: 'ENABLED',
            serviceRole: this.serviceRole.roleArn,
            computeResources: {
                type: 'EC2',
                minvCpus: 0,
                maxvCpus: props.maxvCpus || 20,
                desiredvCpus: 0,
                instanceTypes: props.instanceTypes || ['m5.large', 'm5.xlarge'],
                subnets: props.privateSubnets.map(subnet => subnet.subnetId),
                securityGroupIds: [props.securityGroup.securityGroupId],
                instanceRole: `arn:aws:iam::${cdk.Stack.of(this).account}:instance-profile/ecsInstanceRole`,
                tags: {
                    Project: props.projectName,
                    Environment: props.environment,
                    Component: 'SQLiteEmbedding',
                },
            },
        });
    }
    /**
     * Batch Job Queue作成
     */
    createJobQueue(props) {
        return new batch.CfnJobQueue(this, 'JobQueue', {
            jobQueueName: `${props.projectName}-${props.environment}-sqlite-job-queue`,
            state: 'ENABLED',
            priority: 1,
            computeEnvironmentOrder: [
                {
                    order: 1,
                    computeEnvironment: this.computeEnvironment.ref,
                },
            ],
        });
    }
    /**
     * Batch Job Definition作成
     */
    createJobDefinition(props) {
        const command = this.generateJobCommand(props);
        return new batch.CfnJobDefinition(this, 'JobDefinition', {
            jobDefinitionName: `${props.projectName}-${props.environment}-sqlite-embedding-job-def`,
            type: 'container',
            containerProperties: {
                image: 'public.ecr.aws/amazonlinux/amazonlinux:2023',
                vcpus: 2,
                memory: 4096,
                command,
                environment: [
                    { name: 'FSX_FILE_SYSTEM_ID', value: props.fsxFileSystemId },
                    { name: 'FSX_SVM_ID', value: props.fsxSvmId },
                    { name: 'FSX_VOLUME_ID', value: props.fsxVolumeId },
                    { name: 'FSX_MOUNT_PATH', value: props.fsxMountPath },
                    { name: 'FSX_NFS_ENDPOINT', value: props.fsxNfsEndpoint },
                    { name: 'BEDROCK_REGION', value: props.bedrockRegion },
                    { name: 'BEDROCK_MODEL_ID', value: props.bedrockModelId },
                    { name: 'AWS_DEFAULT_REGION', value: cdk.Stack.of(this).region },
                    { name: 'PROJECT_NAME', value: props.projectName },
                    { name: 'ENVIRONMENT', value: props.environment },
                ],
                jobRoleArn: this.jobRole.roleArn,
                privileged: false,
            },
            retryStrategy: {
                attempts: 3,
            },
            timeout: {
                attemptDurationSeconds: 3600,
            },
        });
    }
    /**
     * EventBridge定期実行ルール作成
     */
    createScheduledRule(props) {
        const rule = new events.Rule(this, 'ScheduledRule', {
            ruleName: `${props.projectName}-${props.environment}-sqlite-embedding-schedule`,
            description: 'SQLite負荷試験用のEmbedding処理を定期実行',
            schedule: events.Schedule.expression(props.scheduleExpression),
            enabled: true,
        });
        rule.addTarget(new targets.BatchJob(this.jobQueue.ref, this.jobQueue, this.jobDefinition.ref, this.jobDefinition, {
            jobName: `${props.projectName}-${props.environment}-sqlite-embedding-scheduled`,
            event: events.RuleTargetInput.fromObject({
                inputPath: props.fsxMountPath,
                scheduledExecution: true,
            }),
        }));
        return rule;
    }
    /**
     * ジョブコマンド生成
     */
    generateJobCommand(props) {
        return [
            'sh',
            '-c',
            `
echo 'Starting SQLite Embedding Batch Job...' &&
yum update -y &&
yum install -y nfs-utils python3 python3-pip &&
echo 'Installing Python dependencies...' &&
pip3 install boto3 numpy &&
echo 'Creating mount point...' &&
mkdir -p /mnt/fsx-sqlite &&
echo 'Mounting FSx for ONTAP sqlite-load-test volume...' &&
mount -t nfs -o nfsvers=3 \${FSX_NFS_ENDPOINT}:\${FSX_MOUNT_PATH} /mnt/fsx-sqlite &&
echo 'Mount successful!' &&
df -h /mnt/fsx-sqlite &&
ls -la /mnt/fsx-sqlite &&
echo 'Creating embedding processing script...' &&
cat > /tmp/embedding_processor.py << 'EOF'
import os
import json
import boto3
import time
from datetime import datetime

def process_sqlite_files():
    """SQLiteファイルからEmbedding処理を実行"""
    bedrock = boto3.client('bedrock-runtime', region_name=os.environ.get('BEDROCK_REGION', 'ap-northeast-1'))
    
    # SQLiteファイルを検索
    sqlite_dir = '/mnt/fsx-sqlite'
    sqlite_files = []
    
    for root, dirs, files in os.walk(sqlite_dir):
        for file in files:
            if file.endswith('.db'):
                sqlite_files.append(os.path.join(root, file))
    
    print(f'Found {len(sqlite_files)} SQLite files for processing')
    
    # 各SQLiteファイルに対してEmbedding処理をシミュレート
    for sqlite_file in sqlite_files:
        print(f'Processing: {sqlite_file}')
        
        # ファイル情報を取得
        file_stat = os.stat(sqlite_file)
        file_size = file_stat.st_size
        
        # Embedding処理のシミュレート（実際のBedrockは使用せず、メタデータのみ作成）
        embedding_metadata = {
            'file_path': sqlite_file,
            'file_size': file_size,
            'processed_at': datetime.now().isoformat(),
            'embedding_model': os.environ.get('BEDROCK_MODEL_ID', 'amazon.titan-embed-text-v1'),
            'status': 'processed',
            'chunk_count': max(1, file_size // 1024)  # 1KBあたり1チャンク
        }
        
        # メタデータファイルを作成
        metadata_file = sqlite_file + '.embedding_metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(embedding_metadata, f, indent=2)
        
        print(f'Created embedding metadata: {metadata_file}')
        
        # 処理時間をシミュレート
        time.sleep(1)
    
    return len(sqlite_files)

if __name__ == '__main__':
    try:
        processed_count = process_sqlite_files()
        print(f'Successfully processed {processed_count} SQLite files')
    except Exception as e:
        print(f'Error processing SQLite files: {e}')
        exit(1)
EOF
echo 'Running embedding processing...' &&
python3 /tmp/embedding_processor.py &&
echo 'Listing processed files...' &&
find /mnt/fsx-sqlite -name '*.embedding_metadata.json' -exec ls -la {} \\; &&
echo 'SQLite Embedding Batch Job completed successfully!'
      `.trim(),
        ];
    }
    /**
     * タグ適用
     */
    applyTags(props) {
        const tags = {
            Project: props.projectName,
            Environment: props.environment,
            Component: 'SQLiteEmbedding',
            ManagedBy: 'CDK',
        };
        Object.entries(tags).forEach(([key, value]) => {
            cdk.Tags.of(this).add(key, value);
        });
    }
    /**
     * ジョブ投入
     */
    submitJob(jobName) {
        const name = jobName || `sqlite-embedding-${Date.now()}`;
        // 実際のジョブ投入はAWS SDKを使用して実装
        // ここではジョブ名を返すのみ
        return name;
    }
    /**
     * 統合情報取得
     */
    getIntegrationInfo() {
        return {
            computeEnvironment: this.computeEnvironment.ref,
            jobQueue: this.jobQueue.ref,
            jobDefinition: this.jobDefinition.ref,
            logGroup: this.logGroup.logGroupName,
            scheduledRule: this.scheduledRule?.ruleArn,
        };
    }
}
exports.SqliteLoadTest = SqliteLoadTest;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FsaXRlLWxvYWQtdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNxbGl0ZS1sb2FkLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyw2REFBK0M7QUFFL0MseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3QywrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELDJDQUF1QztBQXFCdkMsTUFBYSxjQUFlLFNBQVEsc0JBQVM7SUFDM0Isa0JBQWtCLENBQThCO0lBQ2hELFFBQVEsQ0FBb0I7SUFDNUIsYUFBYSxDQUF5QjtJQUN0QyxRQUFRLENBQWdCO0lBQ3hCLGFBQWEsQ0FBZTtJQUUzQixXQUFXLENBQVc7SUFDdEIsT0FBTyxDQUFXO0lBQ2xCLFNBQVMsQ0FBVztJQUVyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsV0FBVztRQUNYLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRW5ELGtCQUFrQjtRQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0MsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFL0Qsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxL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QUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxTQUFTLENBQUMsT0FBZ0I7UUFDL0IsTUFBTSxJQUFJLEdBQUcsT0FBTyxJQUFJLG9CQUFvQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztRQUV6RCwwQkFBMEI7UUFDMUIsZ0JBQWdCO1FBQ2hCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0ksa0JBQWtCO1FBQ3ZCLE9BQU87WUFDTCxrQkFBa0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRztZQUMvQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHO1lBQzNCLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUc7WUFDckMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWTtZQUNwQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxPQUFPO1NBQzNDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUEvV0Qsd0NBK1dDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTUUxpdGXosqDojbfoqabpqJPntbHlkIjjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAqIFxuICogRlN4IGZvciBPTlRBUOS4iuOBp+OBrlNRTGl0ZeiyoOiNt+ippumok+OBqEVtYmVkZGluZ+WHpueQhuOBrue1seWQiFxuICogLSBBV1MgQmF0Y2jntbHlkIhcbiAqIC0gRXZlbnRCcmlkZ2XlrprmnJ/lrp/ooYxcbiAqIC0gQ2xvdWRXYXRjaOebo+imllxuICogLSBJQU3mqKnpmZDnrqHnkIZcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYmF0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWJhdGNoJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3FsaXRlTG9hZFRlc3RQcm9wcyB7XG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG4gIHJlYWRvbmx5IHZwYzogZWMyLklWcGM7XG4gIHJlYWRvbmx5IHByaXZhdGVTdWJuZXRzOiBlYzIuSVN1Ym5ldFtdO1xuICByZWFkb25seSBzZWN1cml0eUdyb3VwOiBlYzIuSVNlY3VyaXR5R3JvdXA7XG4gIHJlYWRvbmx5IGZzeEZpbGVTeXN0ZW1JZDogc3RyaW5nO1xuICByZWFkb25seSBmc3hTdm1JZDogc3RyaW5nO1xuICByZWFkb25seSBmc3hWb2x1bWVJZDogc3RyaW5nO1xuICByZWFkb25seSBmc3hNb3VudFBhdGg6IHN0cmluZztcbiAgcmVhZG9ubHkgZnN4TmZzRW5kcG9pbnQ6IHN0cmluZztcbiAgcmVhZG9ubHkgYmVkcm9ja1JlZ2lvbjogc3RyaW5nO1xuICByZWFkb25seSBiZWRyb2NrTW9kZWxJZDogc3RyaW5nO1xuICByZWFkb25seSBzY2hlZHVsZUV4cHJlc3Npb246IHN0cmluZztcbiAgcmVhZG9ubHkgZW5hYmxlU2NoZWR1bGVkRXhlY3V0aW9uOiBib29sZWFuO1xuICByZWFkb25seSBtYXh2Q3B1cz86IG51bWJlcjtcbiAgcmVhZG9ubHkgaW5zdGFuY2VUeXBlcz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY2xhc3MgU3FsaXRlTG9hZFRlc3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgY29tcHV0ZUVudmlyb25tZW50OiBiYXRjaC5DZm5Db21wdXRlRW52aXJvbm1lbnQ7XG4gIHB1YmxpYyByZWFkb25seSBqb2JRdWV1ZTogYmF0Y2guQ2ZuSm9iUXVldWU7XG4gIHB1YmxpYyByZWFkb25seSBqb2JEZWZpbml0aW9uOiBiYXRjaC5DZm5Kb2JEZWZpbml0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgbG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXA7XG4gIHB1YmxpYyByZWFkb25seSBzY2hlZHVsZWRSdWxlPzogZXZlbnRzLlJ1bGU7XG4gIFxuICBwcml2YXRlIHJlYWRvbmx5IHNlcnZpY2VSb2xlOiBpYW0uUm9sZTtcbiAgcHJpdmF0ZSByZWFkb25seSBqb2JSb2xlOiBpYW0uUm9sZTtcbiAgcHJpdmF0ZSByZWFkb25seSBldmVudFJvbGU6IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTcWxpdGVMb2FkVGVzdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIElBTeODreODvOODq+S9nOaIkFxuICAgIHRoaXMuc2VydmljZVJvbGUgPSB0aGlzLmNyZWF0ZUJhdGNoU2VydmljZVJvbGUocHJvcHMpO1xuICAgIHRoaXMuam9iUm9sZSA9IHRoaXMuY3JlYXRlSm9iRXhlY3V0aW9uUm9sZShwcm9wcyk7XG4gICAgdGhpcy5ldmVudFJvbGUgPSB0aGlzLmNyZWF0ZUV2ZW50QnJpZGdlUm9sZShwcm9wcyk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3NcbiAgICB0aGlzLmxvZ0dyb3VwID0gdGhpcy5jcmVhdGVMb2dHcm91cChwcm9wcyk7XG5cbiAgICAvLyBCYXRjaCBDb21wdXRlIEVudmlyb25tZW50XG4gICAgdGhpcy5jb21wdXRlRW52aXJvbm1lbnQgPSB0aGlzLmNyZWF0ZUNvbXB1dGVFbnZpcm9ubWVudChwcm9wcyk7XG5cbiAgICAvLyBCYXRjaCBKb2IgUXVldWVcbiAgICB0aGlzLmpvYlF1ZXVlID0gdGhpcy5jcmVhdGVKb2JRdWV1ZShwcm9wcyk7XG5cbiAgICAvLyBCYXRjaCBKb2IgRGVmaW5pdGlvblxuICAgIHRoaXMuam9iRGVmaW5pdGlvbiA9IHRoaXMuY3JlYXRlSm9iRGVmaW5pdGlvbihwcm9wcyk7XG5cbiAgICAvLyBFdmVudEJyaWRnZeWumuacn+Wun+ihjO+8iOacieWKueWMluOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5lbmFibGVTY2hlZHVsZWRFeGVjdXRpb24pIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVkUnVsZSA9IHRoaXMuY3JlYXRlU2NoZWR1bGVkUnVsZShwcm9wcyk7XG4gICAgfVxuXG4gICAgLy8g44K/44Kw6Kit5a6aXG4gICAgdGhpcy5hcHBseVRhZ3MocHJvcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJhdGNoIFNlcnZpY2UgUm9sZeS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCYXRjaFNlcnZpY2VSb2xlKHByb3BzOiBTcWxpdGVMb2FkVGVzdFByb3BzKTogaWFtLlJvbGUge1xuICAgIHJldHVybiBuZXcgaWFtLlJvbGUodGhpcywgJ0JhdGNoU2VydmljZVJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXNxbGl0ZS1iYXRjaC1zZXJ2aWNlLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JhdGNoLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NCYXRjaFNlcnZpY2VSb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEpvYiBFeGVjdXRpb24gUm9sZeS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVKb2JFeGVjdXRpb25Sb2xlKHByb3BzOiBTcWxpdGVMb2FkVGVzdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0pvYkV4ZWN1dGlvblJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXNxbGl0ZS1qb2ItZXhlY3V0aW9uLXJvbGVgLFxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2Nr5qip6ZmQ6L+95YqgXG4gICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7cHJvcHMuYmVkcm9ja1JlZ2lvbn06Kjpmb3VuZGF0aW9uLW1vZGVsLyR7cHJvcHMuYmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3Byb3BzLmJlZHJvY2tSZWdpb259Oio6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24udGl0YW4tZW1iZWQtKmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEZTeOaoqemZkOi/veWKoFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZnN4OkRlc2NyaWJlRmlsZVN5c3RlbXMnLFxuICAgICAgICAnZnN4OkRlc2NyaWJlU3RvcmFnZVZpcnR1YWxNYWNoaW5lcycsXG4gICAgICAgICdmc3g6RGVzY3JpYmVWb2x1bWVzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6ZnN4OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06ZmlsZS1zeXN0ZW0vJHtwcm9wcy5mc3hGaWxlU3lzdGVtSWR9YCxcbiAgICAgICAgYGFybjphd3M6ZnN4OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06c3RvcmFnZS12aXJ0dWFsLW1hY2hpbmUvJHtwcm9wcy5mc3hTdm1JZH1gLFxuICAgICAgICBgYXJuOmF3czpmc3g6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTp2b2x1bWUvJHtwcm9wcy5mc3hWb2x1bWVJZH1gLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVudEJyaWRnZSBSb2xl5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUV2ZW50QnJpZGdlUm9sZShwcm9wczogU3FsaXRlTG9hZFRlc3RQcm9wcyk6IGlhbS5Sb2xlIHtcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdFdmVudEJyaWRnZVJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXNxbGl0ZS1ldmVudGJyaWRnZS1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdldmVudHMuYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JhdGNoOlN1Ym1pdEpvYiddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJhdGNoOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06am9iLXF1ZXVlLypgLFxuICAgICAgICBgYXJuOmF3czpiYXRjaDoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmpvYi1kZWZpbml0aW9uLypgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNoIExvZyBHcm91cOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMb2dHcm91cChwcm9wczogU3FsaXRlTG9hZFRlc3RQcm9wcyk6IGxvZ3MuTG9nR3JvdXAge1xuICAgIHJldHVybiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2JhdGNoLyR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXNxbGl0ZS1lbWJlZGRpbmdgLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCYXRjaCBDb21wdXRlIEVudmlyb25tZW505L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUNvbXB1dGVFbnZpcm9ubWVudChwcm9wczogU3FsaXRlTG9hZFRlc3RQcm9wcyk6IGJhdGNoLkNmbkNvbXB1dGVFbnZpcm9ubWVudCB7XG4gICAgcmV0dXJuIG5ldyBiYXRjaC5DZm5Db21wdXRlRW52aXJvbm1lbnQodGhpcywgJ0NvbXB1dGVFbnZpcm9ubWVudCcsIHtcbiAgICAgIGNvbXB1dGVFbnZpcm9ubWVudE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1zcWxpdGUtY29tcHV0ZS1lbnZgLFxuICAgICAgdHlwZTogJ01BTkFHRUQnLFxuICAgICAgc3RhdGU6ICdFTkFCTEVEJyxcbiAgICAgIHNlcnZpY2VSb2xlOiB0aGlzLnNlcnZpY2VSb2xlLnJvbGVBcm4sXG4gICAgICBjb21wdXRlUmVzb3VyY2VzOiB7XG4gICAgICAgIHR5cGU6ICdFQzInLFxuICAgICAgICBtaW52Q3B1czogMCxcbiAgICAgICAgbWF4dkNwdXM6IHByb3BzLm1heHZDcHVzIHx8IDIwLFxuICAgICAgICBkZXNpcmVkdkNwdXM6IDAsXG4gICAgICAgIGluc3RhbmNlVHlwZXM6IHByb3BzLmluc3RhbmNlVHlwZXMgfHwgWydtNS5sYXJnZScsICdtNS54bGFyZ2UnXSxcbiAgICAgICAgc3VibmV0czogcHJvcHMucHJpdmF0ZVN1Ym5ldHMubWFwKHN1Ym5ldCA9PiBzdWJuZXQuc3VibmV0SWQpLFxuICAgICAgICBzZWN1cml0eUdyb3VwSWRzOiBbcHJvcHMuc2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWRdLFxuICAgICAgICBpbnN0YW5jZVJvbGU6IGBhcm46YXdzOmlhbTo6JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06aW5zdGFuY2UtcHJvZmlsZS9lY3NJbnN0YW5jZVJvbGVgLFxuICAgICAgICB0YWdzOiB7XG4gICAgICAgICAgUHJvamVjdDogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICAgIENvbXBvbmVudDogJ1NRTGl0ZUVtYmVkZGluZycsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEJhdGNoIEpvYiBRdWV1ZeS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVKb2JRdWV1ZShwcm9wczogU3FsaXRlTG9hZFRlc3RQcm9wcyk6IGJhdGNoLkNmbkpvYlF1ZXVlIHtcbiAgICByZXR1cm4gbmV3IGJhdGNoLkNmbkpvYlF1ZXVlKHRoaXMsICdKb2JRdWV1ZScsIHtcbiAgICAgIGpvYlF1ZXVlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXNxbGl0ZS1qb2ItcXVldWVgLFxuICAgICAgc3RhdGU6ICdFTkFCTEVEJyxcbiAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgY29tcHV0ZUVudmlyb25tZW50T3JkZXI6IFtcbiAgICAgICAge1xuICAgICAgICAgIG9yZGVyOiAxLFxuICAgICAgICAgIGNvbXB1dGVFbnZpcm9ubWVudDogdGhpcy5jb21wdXRlRW52aXJvbm1lbnQucmVmLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCYXRjaCBKb2IgRGVmaW5pdGlvbuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVKb2JEZWZpbml0aW9uKHByb3BzOiBTcWxpdGVMb2FkVGVzdFByb3BzKTogYmF0Y2guQ2ZuSm9iRGVmaW5pdGlvbiB7XG4gICAgY29uc3QgY29tbWFuZCA9IHRoaXMuZ2VuZXJhdGVKb2JDb21tYW5kKHByb3BzKTtcblxuICAgIHJldHVybiBuZXcgYmF0Y2guQ2ZuSm9iRGVmaW5pdGlvbih0aGlzLCAnSm9iRGVmaW5pdGlvbicsIHtcbiAgICAgIGpvYkRlZmluaXRpb25OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tc3FsaXRlLWVtYmVkZGluZy1qb2ItZGVmYCxcbiAgICAgIHR5cGU6ICdjb250YWluZXInLFxuICAgICAgY29udGFpbmVyUHJvcGVydGllczoge1xuICAgICAgICBpbWFnZTogJ3B1YmxpYy5lY3IuYXdzL2FtYXpvbmxpbnV4L2FtYXpvbmxpbnV4OjIwMjMnLFxuICAgICAgICB2Y3B1czogMixcbiAgICAgICAgbWVtb3J5OiA0MDk2LFxuICAgICAgICBjb21tYW5kLFxuICAgICAgICBlbnZpcm9ubWVudDogW1xuICAgICAgICAgIHsgbmFtZTogJ0ZTWF9GSUxFX1NZU1RFTV9JRCcsIHZhbHVlOiBwcm9wcy5mc3hGaWxlU3lzdGVtSWQgfSxcbiAgICAgICAgICB7IG5hbWU6ICdGU1hfU1ZNX0lEJywgdmFsdWU6IHByb3BzLmZzeFN2bUlkIH0sXG4gICAgICAgICAgeyBuYW1lOiAnRlNYX1ZPTFVNRV9JRCcsIHZhbHVlOiBwcm9wcy5mc3hWb2x1bWVJZCB9LFxuICAgICAgICAgIHsgbmFtZTogJ0ZTWF9NT1VOVF9QQVRIJywgdmFsdWU6IHByb3BzLmZzeE1vdW50UGF0aCB9LFxuICAgICAgICAgIHsgbmFtZTogJ0ZTWF9ORlNfRU5EUE9JTlQnLCB2YWx1ZTogcHJvcHMuZnN4TmZzRW5kcG9pbnQgfSxcbiAgICAgICAgICB7IG5hbWU6ICdCRURST0NLX1JFR0lPTicsIHZhbHVlOiBwcm9wcy5iZWRyb2NrUmVnaW9uIH0sXG4gICAgICAgICAgeyBuYW1lOiAnQkVEUk9DS19NT0RFTF9JRCcsIHZhbHVlOiBwcm9wcy5iZWRyb2NrTW9kZWxJZCB9LFxuICAgICAgICAgIHsgbmFtZTogJ0FXU19ERUZBVUxUX1JFR0lPTicsIHZhbHVlOiBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uIH0sXG4gICAgICAgICAgeyBuYW1lOiAnUFJPSkVDVF9OQU1FJywgdmFsdWU6IHByb3BzLnByb2plY3ROYW1lIH0sXG4gICAgICAgICAgeyBuYW1lOiAnRU5WSVJPTk1FTlQnLCB2YWx1ZTogcHJvcHMuZW52aXJvbm1lbnQgfSxcbiAgICAgICAgXSxcbiAgICAgICAgam9iUm9sZUFybjogdGhpcy5qb2JSb2xlLnJvbGVBcm4sXG4gICAgICAgIHByaXZpbGVnZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHJldHJ5U3RyYXRlZ3k6IHtcbiAgICAgICAgYXR0ZW1wdHM6IDMsXG4gICAgICB9LFxuICAgICAgdGltZW91dDoge1xuICAgICAgICBhdHRlbXB0RHVyYXRpb25TZWNvbmRzOiAzNjAwLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVudEJyaWRnZeWumuacn+Wun+ihjOODq+ODvOODq+S9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTY2hlZHVsZWRSdWxlKHByb3BzOiBTcWxpdGVMb2FkVGVzdFByb3BzKTogZXZlbnRzLlJ1bGUge1xuICAgIGNvbnN0IHJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1NjaGVkdWxlZFJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXNxbGl0ZS1lbWJlZGRpbmctc2NoZWR1bGVgLFxuICAgICAgZGVzY3JpcHRpb246ICdTUUxpdGXosqDojbfoqabpqJPnlKjjga5FbWJlZGRpbmflh6bnkIbjgpLlrprmnJ/lrp/ooYwnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKHByb3BzLnNjaGVkdWxlRXhwcmVzc2lvbiksXG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgcnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuQmF0Y2hKb2IoXG4gICAgICB0aGlzLmpvYlF1ZXVlLnJlZixcbiAgICAgIHRoaXMuam9iUXVldWUsXG4gICAgICB0aGlzLmpvYkRlZmluaXRpb24ucmVmLFxuICAgICAgdGhpcy5qb2JEZWZpbml0aW9uLFxuICAgICAge1xuICAgICAgICBqb2JOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tc3FsaXRlLWVtYmVkZGluZy1zY2hlZHVsZWRgLFxuICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICBpbnB1dFBhdGg6IHByb3BzLmZzeE1vdW50UGF0aCxcbiAgICAgICAgICBzY2hlZHVsZWRFeGVjdXRpb246IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgICkpO1xuXG4gICAgcmV0dXJuIHJ1bGU7XG4gIH1cblxuICAvKipcbiAgICog44K444On44OW44Kz44Oe44Oz44OJ55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlSm9iQ29tbWFuZChwcm9wczogU3FsaXRlTG9hZFRlc3RQcm9wcyk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAgJ3NoJyxcbiAgICAgICctYycsXG4gICAgICBgXG5lY2hvICdTdGFydGluZyBTUUxpdGUgRW1iZWRkaW5nIEJhdGNoIEpvYi4uLicgJiZcbnl1bSB1cGRhdGUgLXkgJiZcbnl1bSBpbnN0YWxsIC15IG5mcy11dGlscyBweXRob24zIHB5dGhvbjMtcGlwICYmXG5lY2hvICdJbnN0YWxsaW5nIFB5dGhvbiBkZXBlbmRlbmNpZXMuLi4nICYmXG5waXAzIGluc3RhbGwgYm90bzMgbnVtcHkgJiZcbmVjaG8gJ0NyZWF0aW5nIG1vdW50IHBvaW50Li4uJyAmJlxubWtkaXIgLXAgL21udC9mc3gtc3FsaXRlICYmXG5lY2hvICdNb3VudGluZyBGU3ggZm9yIE9OVEFQIHNxbGl0ZS1sb2FkLXRlc3Qgdm9sdW1lLi4uJyAmJlxubW91bnQgLXQgbmZzIC1vIG5mc3ZlcnM9MyBcXCR7RlNYX05GU19FTkRQT0lOVH06XFwke0ZTWF9NT1VOVF9QQVRIfSAvbW50L2ZzeC1zcWxpdGUgJiZcbmVjaG8gJ01vdW50IHN1Y2Nlc3NmdWwhJyAmJlxuZGYgLWggL21udC9mc3gtc3FsaXRlICYmXG5scyAtbGEgL21udC9mc3gtc3FsaXRlICYmXG5lY2hvICdDcmVhdGluZyBlbWJlZGRpbmcgcHJvY2Vzc2luZyBzY3JpcHQuLi4nICYmXG5jYXQgPiAvdG1wL2VtYmVkZGluZ19wcm9jZXNzb3IucHkgPDwgJ0VPRidcbmltcG9ydCBvc1xuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IHRpbWVcbmZyb20gZGF0ZXRpbWUgaW1wb3J0IGRhdGV0aW1lXG5cbmRlZiBwcm9jZXNzX3NxbGl0ZV9maWxlcygpOlxuICAgIFwiXCJcIlNRTGl0ZeODleOCoeOCpOODq+OBi+OCiUVtYmVkZGluZ+WHpueQhuOCkuWun+ihjFwiXCJcIlxuICAgIGJlZHJvY2sgPSBib3RvMy5jbGllbnQoJ2JlZHJvY2stcnVudGltZScsIHJlZ2lvbl9uYW1lPW9zLmVudmlyb24uZ2V0KCdCRURST0NLX1JFR0lPTicsICdhcC1ub3J0aGVhc3QtMScpKVxuICAgIFxuICAgICMgU1FMaXRl44OV44Kh44Kk44Or44KS5qSc57SiXG4gICAgc3FsaXRlX2RpciA9ICcvbW50L2ZzeC1zcWxpdGUnXG4gICAgc3FsaXRlX2ZpbGVzID0gW11cbiAgICBcbiAgICBmb3Igcm9vdCwgZGlycywgZmlsZXMgaW4gb3Mud2FsayhzcWxpdGVfZGlyKTpcbiAgICAgICAgZm9yIGZpbGUgaW4gZmlsZXM6XG4gICAgICAgICAgICBpZiBmaWxlLmVuZHN3aXRoKCcuZGInKTpcbiAgICAgICAgICAgICAgICBzcWxpdGVfZmlsZXMuYXBwZW5kKG9zLnBhdGguam9pbihyb290LCBmaWxlKSlcbiAgICBcbiAgICBwcmludChmJ0ZvdW5kIHtsZW4oc3FsaXRlX2ZpbGVzKX0gU1FMaXRlIGZpbGVzIGZvciBwcm9jZXNzaW5nJylcbiAgICBcbiAgICAjIOWQhFNRTGl0ZeODleOCoeOCpOODq+OBq+WvvuOBl+OBpkVtYmVkZGluZ+WHpueQhuOCkuOCt+ODn+ODpeODrOODvOODiFxuICAgIGZvciBzcWxpdGVfZmlsZSBpbiBzcWxpdGVfZmlsZXM6XG4gICAgICAgIHByaW50KGYnUHJvY2Vzc2luZzoge3NxbGl0ZV9maWxlfScpXG4gICAgICAgIFxuICAgICAgICAjIOODleOCoeOCpOODq+aDheWgseOCkuWPluW+l1xuICAgICAgICBmaWxlX3N0YXQgPSBvcy5zdGF0KHNxbGl0ZV9maWxlKVxuICAgICAgICBmaWxlX3NpemUgPSBmaWxlX3N0YXQuc3Rfc2l6ZVxuICAgICAgICBcbiAgICAgICAgIyBFbWJlZGRpbmflh6bnkIbjga7jgrfjg5/jg6Xjg6zjg7zjg4jvvIjlrp/pmpvjga5CZWRyb2Nr44Gv5L2/55So44Gb44Ga44CB44Oh44K/44OH44O844K/44Gu44G/5L2c5oiQ77yJXG4gICAgICAgIGVtYmVkZGluZ19tZXRhZGF0YSA9IHtcbiAgICAgICAgICAgICdmaWxlX3BhdGgnOiBzcWxpdGVfZmlsZSxcbiAgICAgICAgICAgICdmaWxlX3NpemUnOiBmaWxlX3NpemUsXG4gICAgICAgICAgICAncHJvY2Vzc2VkX2F0JzogZGF0ZXRpbWUubm93KCkuaXNvZm9ybWF0KCksXG4gICAgICAgICAgICAnZW1iZWRkaW5nX21vZGVsJzogb3MuZW52aXJvbi5nZXQoJ0JFRFJPQ0tfTU9ERUxfSUQnLCAnYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjEnKSxcbiAgICAgICAgICAgICdzdGF0dXMnOiAncHJvY2Vzc2VkJyxcbiAgICAgICAgICAgICdjaHVua19jb3VudCc6IG1heCgxLCBmaWxlX3NpemUgLy8gMTAyNCkgICMgMUtC44GC44Gf44KKMeODgeODo+ODs+OCr1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAjIOODoeOCv+ODh+ODvOOCv+ODleOCoeOCpOODq+OCkuS9nOaIkFxuICAgICAgICBtZXRhZGF0YV9maWxlID0gc3FsaXRlX2ZpbGUgKyAnLmVtYmVkZGluZ19tZXRhZGF0YS5qc29uJ1xuICAgICAgICB3aXRoIG9wZW4obWV0YWRhdGFfZmlsZSwgJ3cnKSBhcyBmOlxuICAgICAgICAgICAganNvbi5kdW1wKGVtYmVkZGluZ19tZXRhZGF0YSwgZiwgaW5kZW50PTIpXG4gICAgICAgIFxuICAgICAgICBwcmludChmJ0NyZWF0ZWQgZW1iZWRkaW5nIG1ldGFkYXRhOiB7bWV0YWRhdGFfZmlsZX0nKVxuICAgICAgICBcbiAgICAgICAgIyDlh6bnkIbmmYLplpPjgpLjgrfjg5/jg6Xjg6zjg7zjg4hcbiAgICAgICAgdGltZS5zbGVlcCgxKVxuICAgIFxuICAgIHJldHVybiBsZW4oc3FsaXRlX2ZpbGVzKVxuXG5pZiBfX25hbWVfXyA9PSAnX19tYWluX18nOlxuICAgIHRyeTpcbiAgICAgICAgcHJvY2Vzc2VkX2NvdW50ID0gcHJvY2Vzc19zcWxpdGVfZmlsZXMoKVxuICAgICAgICBwcmludChmJ1N1Y2Nlc3NmdWxseSBwcm9jZXNzZWQge3Byb2Nlc3NlZF9jb3VudH0gU1FMaXRlIGZpbGVzJylcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIHByaW50KGYnRXJyb3IgcHJvY2Vzc2luZyBTUUxpdGUgZmlsZXM6IHtlfScpXG4gICAgICAgIGV4aXQoMSlcbkVPRlxuZWNobyAnUnVubmluZyBlbWJlZGRpbmcgcHJvY2Vzc2luZy4uLicgJiZcbnB5dGhvbjMgL3RtcC9lbWJlZGRpbmdfcHJvY2Vzc29yLnB5ICYmXG5lY2hvICdMaXN0aW5nIHByb2Nlc3NlZCBmaWxlcy4uLicgJiZcbmZpbmQgL21udC9mc3gtc3FsaXRlIC1uYW1lICcqLmVtYmVkZGluZ19tZXRhZGF0YS5qc29uJyAtZXhlYyBscyAtbGEge30gXFxcXDsgJiZcbmVjaG8gJ1NRTGl0ZSBFbWJlZGRpbmcgQmF0Y2ggSm9iIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkhJ1xuICAgICAgYC50cmltKCksXG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgr/jgrDpgannlKhcbiAgICovXG4gIHByaXZhdGUgYXBwbHlUYWdzKHByb3BzOiBTcWxpdGVMb2FkVGVzdFByb3BzKTogdm9pZCB7XG4gICAgY29uc3QgdGFncyA9IHtcbiAgICAgIFByb2plY3Q6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgQ29tcG9uZW50OiAnU1FMaXRlRW1iZWRkaW5nJyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCuOODp+ODluaKleWFpVxuICAgKi9cbiAgcHVibGljIHN1Ym1pdEpvYihqb2JOYW1lPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBuYW1lID0gam9iTmFtZSB8fCBgc3FsaXRlLWVtYmVkZGluZy0ke0RhdGUubm93KCl9YDtcbiAgICBcbiAgICAvLyDlrp/pmpvjga7jgrjjg6fjg5bmipXlhaXjga9BV1MgU0RL44KS5L2/55So44GX44Gm5a6f6KOFXG4gICAgLy8g44GT44GT44Gn44Gv44K444On44OW5ZCN44KS6L+U44GZ44Gu44G/XG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI5oOF5aCx5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0SW50ZWdyYXRpb25JbmZvKCk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIHJldHVybiB7XG4gICAgICBjb21wdXRlRW52aXJvbm1lbnQ6IHRoaXMuY29tcHV0ZUVudmlyb25tZW50LnJlZixcbiAgICAgIGpvYlF1ZXVlOiB0aGlzLmpvYlF1ZXVlLnJlZixcbiAgICAgIGpvYkRlZmluaXRpb246IHRoaXMuam9iRGVmaW5pdGlvbi5yZWYsXG4gICAgICBsb2dHcm91cDogdGhpcy5sb2dHcm91cC5sb2dHcm91cE5hbWUsXG4gICAgICBzY2hlZHVsZWRSdWxlOiB0aGlzLnNjaGVkdWxlZFJ1bGU/LnJ1bGVBcm4sXG4gICAgfTtcbiAgfVxufSJdfQ==