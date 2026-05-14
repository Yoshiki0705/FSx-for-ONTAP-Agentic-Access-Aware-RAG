/**
 * DemoTransferFamilyStack
 *
 * AWS Transfer Family を FSx for ONTAP S3 Access Points と統合し、
 * SFTP/FTPS 経由のドキュメントアップロードから Bedrock Knowledge Base への
 * 自動インジェスションパイプラインを構築する。
 *
 * フィーチャーフラグ: enableTransferFamily=true で有効化
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as transfer from 'aws-cdk-lib/aws-transfer';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';

// ========================================
// Interfaces
// ========================================

/** 権限セット */
export interface PermissionSet {
  allowed_sids?: string[];
  allowed_uids?: string[];
  allowed_gids?: string[];
}

/** SFTP ユーザー構成 */
export interface TransferFamilyUserConfig {
  userName: string;
  sshPublicKey: string;
  homeDirectoryPrefix?: string;
  permissions?: PermissionSet;
}

/** スタックプロパティ */
export interface DemoTransferFamilyStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;

  // StorageStack からの入力
  s3AccessPointArn: string;
  /** S3 Access Point Alias (ending in -ext-s3alias). Required for HomeDirectoryMappings. */
  s3AccessPointAlias: string;
  fileSystemId: string;
  svmId: string;
  volumeId: string;

  // AIStack からの入力
  knowledgeBaseId: string;
  dataSourceId: string;

  // 監視連携（オプション）
  enableMonitoring?: boolean;
  snsTopicArn?: string;

  // Transfer Family 設定
  transferFamilyUsers?: TransferFamilyUserConfig[];
  transferFamilyEndpointType?: 'PUBLIC' | 'VPC';
  transferFamilyProtocols?: ('SFTP' | 'FTPS')[];
  transferFamilyAllowedCidrs?: string[];
  transferFamilyPollingIntervalMinutes?: number;
  transferFamilyTriggerMode?: 'polling' | 'cloudtrail';
  transferFamilyDefaultPermissions?: PermissionSet;

  // VPC（VPC エンドポイントタイプ時に必要）
  vpc?: ec2.IVpc;
  privateSubnets?: ec2.ISubnet[];
}

export class DemoTransferFamilyStack extends cdk.Stack {
  /** Transfer Family サーバー ID */
  public readonly serverId: string;
  /** Transfer Family エンドポイントホスト名 */
  public readonly serverEndpoint: string;
  /** Ingestion Trigger Lambda ARN */
  public readonly ingestionTriggerLambdaArn: string;
  /** Metadata Generator Lambda ARN */
  public readonly metadataGeneratorLambdaArn: string;
  /** スキャン状態テーブル名 */
  public readonly scanStateTableName: string;
  /** ファイルインベントリテーブル名 */
  public readonly fileInventoryTableName: string;
  /** 権限マッピングテーブル名 */
  public readonly permissionMappingTableName: string;

  constructor(scope: Construct, id: string, props: DemoTransferFamilyStackProps) {
    super(scope, id, props);

    const prefix = `${props.projectName}-${props.environment}`;
    const triggerMode = props.transferFamilyTriggerMode || 'polling';
    const pollingInterval = props.transferFamilyPollingIntervalMinutes || 5;
    const endpointType = props.transferFamilyEndpointType || 'PUBLIC';
    const protocols = props.transferFamilyProtocols || ['SFTP'];
    const enableMonitoring = props.enableMonitoring ?? false;
    const defaultPermissions = props.transferFamilyDefaultPermissions || {
      allowed_sids: [],
      allowed_uids: [],
      allowed_gids: [],
    };

    // Tags
    cdk.Tags.of(this).add('Feature', 'TransferFamily');
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);

    // ========================================
    // DynamoDB Tables (Task 2.1)
    // ========================================

    // スキャン状態テーブル
    const scanStateTable = new dynamodb.Table(this, 'ScanStateTable', {
      tableName: `${prefix}-transfer-scan-state`,
      partitionKey: { name: 'scanId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });
    scanStateTable.addGlobalSecondaryIndex({
      indexName: 'scanTimestamp-index',
      partitionKey: { name: 'scanTimestamp', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scanId', type: dynamodb.AttributeType.STRING },
    });
    this.scanStateTableName = scanStateTable.tableName;

    // ファイルインベントリテーブル
    const fileInventoryTable = new dynamodb.Table(this, 'FileInventoryTable', {
      tableName: `${prefix}-transfer-file-inventory`,
      partitionKey: { name: 'fileKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.fileInventoryTableName = fileInventoryTable.tableName;

    // 権限マッピングテーブル
    const permissionMappingTable = new dynamodb.Table(this, 'PermissionMappingTable', {
      tableName: `${prefix}-transfer-permission-mapping`,
      partitionKey: { name: 'userName', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.permissionMappingTableName = permissionMappingTable.tableName;

    // ========================================
    // Transfer Family Server (Task 3.1)
    // ========================================

    // CloudWatch Logs for Transfer Family structured logging
    const transferLogGroup = new logs.LogGroup(this, 'TransferLogGroup', {
      logGroupName: `/aws/transfer/${prefix}-sftp`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const transferLoggingRole = new iam.Role(this, 'TransferLoggingRole', {
      assumedBy: new iam.ServicePrincipal('transfer.amazonaws.com'),
      inlinePolicies: {
        logging: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:CreateLogGroup',
                'logs:PutLogEvents',
              ],
              resources: [transferLogGroup.logGroupArn + ':*'],
            }),
          ],
        }),
      },
    });

    // Transfer Family Server
    const serverProps: transfer.CfnServerProps = {
      protocols,
      securityPolicyName: 'TransferSecurityPolicy-2024-01',
      identityProviderType: 'SERVICE_MANAGED',
      loggingRole: transferLoggingRole.roleArn,
      structuredLogDestinations: [transferLogGroup.logGroupArn],
    };

    if (endpointType === 'VPC' && props.vpc && props.privateSubnets) {
      // VPC endpoint configuration with security group IP restrictions (Requirement 7.2)
      const sg = new ec2.SecurityGroup(this, 'TransferSg', {
        vpc: props.vpc,
        description: 'Security group for Transfer Family VPC endpoint',
        allowAllOutbound: true,
      });

      // Determine which ports to open based on configured protocols
      const sftpPort = ec2.Port.tcp(22);
      const ftpsControlPort = ec2.Port.tcp(21);
      const ftpsDataPorts = ec2.Port.tcpRange(8192, 8200);
      const hasFtps = protocols.includes('FTPS');

      if (props.transferFamilyAllowedCidrs && props.transferFamilyAllowedCidrs.length > 0) {
        // IP allowlist: restrict inbound access to specified CIDR ranges
        for (const cidr of props.transferFamilyAllowedCidrs) {
          sg.addIngressRule(ec2.Peer.ipv4(cidr), sftpPort, `SFTP from ${cidr}`);
          if (hasFtps) {
            sg.addIngressRule(ec2.Peer.ipv4(cidr), ftpsControlPort, `FTPS control from ${cidr}`);
            sg.addIngressRule(ec2.Peer.ipv4(cidr), ftpsDataPorts, `FTPS data from ${cidr}`);
          }
        }
      } else {
        // No CIDR restriction: allow from anywhere
        sg.addIngressRule(ec2.Peer.anyIpv4(), sftpPort, 'SFTP from anywhere');
        if (hasFtps) {
          sg.addIngressRule(ec2.Peer.anyIpv4(), ftpsControlPort, 'FTPS control from anywhere');
          sg.addIngressRule(ec2.Peer.anyIpv4(), ftpsDataPorts, 'FTPS data from anywhere');
        }
      }

      (serverProps as any).endpointType = 'VPC';
      (serverProps as any).endpointDetails = {
        vpcId: props.vpc.vpcId,
        subnetIds: props.privateSubnets.map(s => s.subnetId),
        securityGroupIds: [sg.securityGroupId],
      };
    } else {
      // PUBLIC endpoint type
      (serverProps as any).endpointType = 'PUBLIC';

      // Requirement 7.2: For PUBLIC endpoints, Transfer Family does not natively support
      // IP allowlists without a Network Load Balancer or custom identity provider.
      // Emit a CDK annotation warning if CIDRs are specified with PUBLIC endpoint.
      if (props.transferFamilyAllowedCidrs && props.transferFamilyAllowedCidrs.length > 0) {
        cdk.Annotations.of(this).addWarningV2(
          'TransferFamily:PublicEndpointIpRestriction',
          'transferFamilyAllowedCidrs is specified but endpoint type is PUBLIC. ' +
          'IP restrictions for PUBLIC endpoints require a VPC endpoint type with security groups. ' +
          'Consider setting transferFamilyEndpointType to "VPC" to enforce IP allowlists.',
        );
      }
    }

    const server = new transfer.CfnServer(this, 'TransferServer', serverProps);
    this.serverId = server.attrServerId;
    this.serverEndpoint = `${server.attrServerId}.server.transfer.${this.region}.amazonaws.com`;

    // ========================================
    // SFTP Users (Task 3.2)
    // ========================================

    const users = props.transferFamilyUsers && props.transferFamilyUsers.length > 0
      ? props.transferFamilyUsers
      : undefined;

    if (users) {
      for (const userConfig of users) {
        this.createSftpUser(server, userConfig, props.s3AccessPointArn, props.s3AccessPointAlias, prefix);
      }
    } else {
      // Default demo user with generated SSH key in Secrets Manager
      const demoKeySecret = new secretsmanager.Secret(this, 'DemoSshKeySecret', {
        secretName: `${prefix}-transfer-demo-ssh-key`,
        description: 'Demo SFTP user SSH key pair for Transfer Family',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ note: 'Generate SSH key pair externally and update this secret' }),
          generateStringKey: 'placeholder',
        },
      });

      // Create demo user with a placeholder public key
      const demoUser: TransferFamilyUserConfig = {
        userName: 'demo-user',
        sshPublicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC+placeholder+demo+key demo@transfer-family',
      };
      this.createSftpUser(server, demoUser, props.s3AccessPointArn, props.s3AccessPointAlias, prefix);

      new cdk.CfnOutput(this, 'DemoSshKeySecretArn', {
        value: demoKeySecret.secretArn,
        description: 'Secrets Manager ARN for demo SFTP user SSH key',
      });
    }

    // ========================================
    // IP Allowlist (Task 3.3) - Requirement 7.2
    // ========================================
    // VPC endpoint: Security group ingress rules restrict access to transferFamilyAllowedCidrs.
    //   - SFTP (port 22) and FTPS (ports 21, 8192-8200) are opened per protocol config.
    // PUBLIC endpoint: Transfer Family does not natively support IP allowlists.
    //   - A CDK warning annotation is emitted if CIDRs are specified with PUBLIC endpoint.
    //   - To enforce IP restrictions, use VPC endpoint type.

    // ========================================
    // Lambda Functions (Task 9.1)
    // ========================================

    const lambdaCodePath = path.join(__dirname, '../../../automation/transfer-family/lambda');

    // Dead Letter Queue for async invocations
    const dlq = new sqs.Queue(this, 'MetadataGeneratorDLQ', {
      queueName: `${prefix}-metadata-generator-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Metadata Generator Lambda
    const metadataGeneratorFn = new lambda.Function(this, 'MetadataGeneratorFn', {
      functionName: `${prefix}-metadata-generator`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'metadata_generator.handler.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      timeout: cdk.Duration.seconds(60),
      memorySize: 128,
      environment: {
        S3_ACCESS_POINT_ARN: props.s3AccessPointArn,
        PERMISSION_CONFIG_TABLE: permissionMappingTable.tableName,
        DEFAULT_PERMISSIONS: JSON.stringify(defaultPermissions),
        SNS_TOPIC_ARN: props.snsTopicArn || '',
      },
      deadLetterQueue: dlq,
      retryAttempts: 2,
    });
    this.metadataGeneratorLambdaArn = metadataGeneratorFn.functionArn;

    // Ingestion Trigger Lambda
    const ingestionTriggerFn = new lambda.Function(this, 'IngestionTriggerFn', {
      functionName: `${prefix}-ingestion-trigger`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'ingestion_trigger.handler.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      timeout: cdk.Duration.seconds(300),
      memorySize: 256,
      environment: {
        S3_ACCESS_POINT_ARN: props.s3AccessPointArn,
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        DATA_SOURCE_ID: props.dataSourceId,
        STATE_TABLE_NAME: scanStateTable.tableName,
        INVENTORY_TABLE_NAME: fileInventoryTable.tableName,
        METADATA_GENERATOR_ARN: metadataGeneratorFn.functionArn,
        SCAN_PREFIX: '/uploads/',
        TRIGGER_MODE: triggerMode,
        DEFAULT_PERMISSIONS: JSON.stringify(defaultPermissions),
        SNS_TOPIC_ARN: props.snsTopicArn || '',
      },
    });
    this.ingestionTriggerLambdaArn = ingestionTriggerFn.functionArn;

    // ========================================
    // IAM Roles - Least Privilege (Task 9.2)
    // ========================================

    // Ingestion Trigger Lambda permissions
    scanStateTable.grantReadWriteData(ingestionTriggerFn);
    fileInventoryTable.grantReadWriteData(ingestionTriggerFn);
    metadataGeneratorFn.grantInvoke(ingestionTriggerFn);

    ingestionTriggerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject'],
      resources: [
        props.s3AccessPointArn,
        `${props.s3AccessPointArn}/object/*`,
      ],
    }));

    ingestionTriggerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:StartIngestionJob', 'bedrock:GetIngestionJob', 'bedrock:ListIngestionJobs'],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${props.knowledgeBaseId}`,
      ],
    }));

    if (props.snsTopicArn) {
      ingestionTriggerFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: [props.snsTopicArn],
      }));
    }

    // Metadata Generator Lambda permissions
    permissionMappingTable.grantReadData(metadataGeneratorFn);

    metadataGeneratorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${props.s3AccessPointArn}/object/uploads/*`],
    }));

    if (props.snsTopicArn) {
      metadataGeneratorFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: [props.snsTopicArn],
      }));
    }

    // ========================================
    // EventBridge Trigger (Task 8.1, 8.2)
    // ========================================

    if (triggerMode === 'polling') {
      // EventBridge Scheduler (polling mode)
      const schedulerRole = new iam.Role(this, 'SchedulerRole', {
        assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
        inlinePolicies: {
          invokeLambda: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['lambda:InvokeFunction'],
                resources: [ingestionTriggerFn.functionArn],
              }),
            ],
          }),
        },
      });

      new scheduler.CfnSchedule(this, 'PollingSchedule', {
        name: `${prefix}-transfer-polling`,
        scheduleExpression: `rate(${pollingInterval} ${pollingInterval === 1 ? 'minute' : 'minutes'})`,
        flexibleTimeWindow: { mode: 'OFF' },
        target: {
          arn: ingestionTriggerFn.functionArn,
          roleArn: schedulerRole.roleArn,
          input: JSON.stringify({ source: 'scheduler', triggerMode: 'polling' }),
        },
        state: 'ENABLED',
      });
    } else if (triggerMode === 'cloudtrail') {
      // CloudTrail Trail with S3 data events (Requirement 4.1)
      // A CloudTrail trail must be configured to capture S3 data events
      // so that they are forwarded to EventBridge.
      const trail = new cloudtrail.Trail(this, 'TransferCloudTrail', {
        trailName: `${prefix}-transfer-s3-data-events`,
        isMultiRegionTrail: false,
        includeGlobalServiceEvents: false,
        managementEvents: cloudtrail.ReadWriteType.NONE,
      });

      // Add S3 data event selector for the S3 Access Point
      // This uses the S3 AP ARN to scope data events to only this access point
      trail.addS3EventSelector([{
        bucket: s3.Bucket.fromBucketArn(this, 'S3APBucket', props.s3AccessPointArn),
      }], {
        readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY,
      });

      // EventBridge Rule (CloudTrail mode) - Requirement 4.2, 4.3
      // Filters PutObject and CompleteMultipartUpload events on the specific S3 AP ARN
      const cloudTrailRule = new events.Rule(this, 'CloudTrailRule', {
        ruleName: `${prefix}-transfer-cloudtrail`,
        eventPattern: {
          source: ['aws.s3'],
          detailType: ['AWS API Call via CloudTrail'],
          detail: {
            eventSource: ['s3.amazonaws.com'],
            eventName: ['PutObject', 'CompleteMultipartUpload'],
            resources: {
              ARN: [{ prefix: props.s3AccessPointArn }],
            },
          },
        },
      });

      // Target: Ingestion Trigger Lambda with DLQ and max 2 retries (Requirement 4.2)
      cloudTrailRule.addTarget(new targets.LambdaFunction(ingestionTriggerFn, {
        retryAttempts: 2,
        deadLetterQueue: dlq,
      }));
    }

    // ========================================
    // Monitoring (Task 10.1, 10.2)
    // ========================================

    if (enableMonitoring) {
      const snsTopic = props.snsTopicArn
        ? sns.Topic.fromTopicArn(this, 'AlertTopic', props.snsTopicArn)
        : undefined;

      // Ingestion Trigger Lambda error alarm
      const triggerErrorAlarm = new cloudwatch.Alarm(this, 'TriggerErrorAlarm', {
        alarmName: `${prefix}-transfer-trigger-errors`,
        metric: ingestionTriggerFn.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Ingestion Trigger Lambda error rate exceeded 3 consecutive failures',
      });

      if (snsTopic) {
        triggerErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
      }

      // Ingestion job failure custom metric alarm
      const jobFailureMetric = new cloudwatch.Metric({
        namespace: 'TransferFamilyIngestion',
        metricName: 'IngestionJobFailed',
        dimensionsMap: { FunctionName: ingestionTriggerFn.functionName },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const jobFailureAlarm = new cloudwatch.Alarm(this, 'JobFailureAlarm', {
        alarmName: `${prefix}-transfer-job-failures`,
        metric: jobFailureMetric,
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Bedrock KB ingestion job failed',
      });

      if (snsTopic) {
        jobFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
      }

      // SFTP login failure metric filter
      const loginFailureFilter = new logs.MetricFilter(this, 'LoginFailureFilter', {
        logGroup: transferLogGroup,
        filterPattern: logs.FilterPattern.literal('"ERRORS" "Authentication"'),
        metricNamespace: 'TransferFamilyIngestion',
        metricName: 'SftpLoginFailures',
        metricValue: '1',
      });

      const loginFailureAlarm = new cloudwatch.Alarm(this, 'LoginFailureAlarm', {
        alarmName: `${prefix}-transfer-login-failures`,
        metric: new cloudwatch.Metric({
          namespace: 'TransferFamilyIngestion',
          metricName: 'SftpLoginFailures',
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'Multiple SFTP login failures detected',
      });

      if (snsTopic) {
        loginFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
      }

      // CloudWatch Dashboard (Requirement 9.5)
      const dashboard = new cloudwatch.Dashboard(this, 'TransferDashboard', {
        dashboardName: `${prefix}-transfer-family`,
      });

      // Row 1: Transfer Family native metrics (転送バイト数、アップロードファイル数、アクティブセッション数)
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Transfer Family - Bytes Transferred',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Transfer',
              metricName: 'BytesIn',
              dimensionsMap: { ServerId: server.attrServerId },
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
              label: 'Bytes In',
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/Transfer',
              metricName: 'BytesOut',
              dimensionsMap: { ServerId: server.attrServerId },
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
              label: 'Bytes Out',
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: 'Transfer Family - Files Uploaded',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Transfer',
              metricName: 'FilesIn',
              dimensionsMap: { ServerId: server.attrServerId },
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
              label: 'Files Uploaded',
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: 'Transfer Family - Active Sessions',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/Transfer',
              metricName: 'InboundMessage',
              dimensionsMap: { ServerId: server.attrServerId },
              period: cdk.Duration.minutes(5),
              statistic: 'SampleCount',
              label: 'Active Sessions',
            }),
          ],
          width: 8,
        }),
      );

      // Row 2: Ingestion Pipeline EMF metrics (検出ファイル数、ジョブ数、所要時間、メタデータ生成数)
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Ingestion Pipeline - Detected Files & Jobs (EMF)',
          left: [
            new cloudwatch.Metric({
              namespace: 'TransferFamilyIngestion',
              metricName: 'DetectedFiles',
              dimensionsMap: { FunctionName: ingestionTriggerFn.functionName },
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
              label: 'Detected Files',
            }),
            new cloudwatch.Metric({
              namespace: 'TransferFamilyIngestion',
              metricName: 'IngestionJobTriggered',
              dimensionsMap: { FunctionName: ingestionTriggerFn.functionName },
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
              label: 'Ingestion Jobs Triggered',
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: 'Ingestion Pipeline - Scan Duration (EMF)',
          left: [
            new cloudwatch.Metric({
              namespace: 'TransferFamilyIngestion',
              metricName: 'ScanDurationMs',
              dimensionsMap: { FunctionName: ingestionTriggerFn.functionName },
              period: cdk.Duration.minutes(5),
              statistic: 'Average',
              label: 'Avg Scan Duration (ms)',
            }),
            new cloudwatch.Metric({
              namespace: 'TransferFamilyIngestion',
              metricName: 'ScanDurationMs',
              dimensionsMap: { FunctionName: ingestionTriggerFn.functionName },
              period: cdk.Duration.minutes(5),
              statistic: 'Maximum',
              label: 'Max Scan Duration (ms)',
            }),
          ],
          width: 8,
        }),
        new cloudwatch.GraphWidget({
          title: 'Ingestion Pipeline - Metadata Generated',
          left: [
            metadataGeneratorFn.metricInvocations({
              period: cdk.Duration.minutes(5),
              label: 'Metadata Files Generated',
            }),
            metadataGeneratorFn.metricErrors({
              period: cdk.Duration.minutes(5),
              label: 'Metadata Generation Errors',
            }),
          ],
          width: 8,
        }),
      );

      // Row 3: Lambda function health
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Ingestion Trigger Lambda',
          left: [
            ingestionTriggerFn.metricInvocations({ period: cdk.Duration.minutes(5) }),
            ingestionTriggerFn.metricErrors({ period: cdk.Duration.minutes(5) }),
            ingestionTriggerFn.metricDuration({ period: cdk.Duration.minutes(5) }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'SFTP Login Failures',
          left: [
            new cloudwatch.Metric({
              namespace: 'TransferFamilyIngestion',
              metricName: 'SftpLoginFailures',
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
            }),
          ],
          width: 12,
        }),
      );
    }

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'TransferServerId', {
      value: this.serverId,
      exportName: `${prefix}-TransferServerId`,
      description: 'Transfer Family Server ID',
    });

    new cdk.CfnOutput(this, 'TransferServerEndpoint', {
      value: this.serverEndpoint,
      exportName: `${prefix}-TransferServerEndpoint`,
      description: 'Transfer Family SFTP endpoint hostname',
    });

    new cdk.CfnOutput(this, 'IngestionTriggerLambdaArn', {
      value: this.ingestionTriggerLambdaArn,
      exportName: `${prefix}-IngestionTriggerLambdaArn`,
    });

    new cdk.CfnOutput(this, 'MetadataGeneratorLambdaArn', {
      value: this.metadataGeneratorLambdaArn,
      exportName: `${prefix}-MetadataGeneratorLambdaArn`,
    });

    new cdk.CfnOutput(this, 'ScanStateTableName', {
      value: this.scanStateTableName,
      exportName: `${prefix}-TransferScanStateTable`,
    });

    new cdk.CfnOutput(this, 'FileInventoryTableName', {
      value: this.fileInventoryTableName,
      exportName: `${prefix}-TransferFileInventoryTable`,
    });

    new cdk.CfnOutput(this, 'PermissionMappingTableName', {
      value: this.permissionMappingTableName,
      exportName: `${prefix}-TransferPermissionMappingTable`,
    });
  }

  /**
   * SFTP ユーザーを作成する
   */
  private createSftpUser(
    server: transfer.CfnServer,
    userConfig: TransferFamilyUserConfig,
    s3AccessPointArn: string,
    s3AccessPointAlias: string,
    prefix: string,
  ): void {
    const homePrefix = userConfig.homeDirectoryPrefix || `/uploads/${userConfig.userName}`;
    // Strip leading slash for s3:prefix condition (S3 prefixes don't use leading slash)
    const s3Prefix = homePrefix.startsWith('/') ? homePrefix.slice(1) : homePrefix;

    // IAM Role for SFTP user - scoped to home directory
    // NOTE: IAM policies use S3 AP ARN format, NOT alias
    const userRole = new iam.Role(this, `SftpUserRole-${userConfig.userName}`, {
      roleName: `${prefix}-sftp-${userConfig.userName}`,
      assumedBy: new iam.ServicePrincipal('transfer.amazonaws.com'),
      inlinePolicies: {
        s3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['s3:ListBucket', 's3:GetBucketLocation'],
              resources: [s3AccessPointArn],
              conditions: {
                StringLike: {
                  's3:prefix': [`${s3Prefix}/*`, s3Prefix],
                },
              },
            }),
            new iam.PolicyStatement({
              actions: ['s3:PutObject', 's3:GetObject', 's3:GetObjectVersion', 's3:DeleteObject'],
              resources: [`${s3AccessPointArn}/object/${s3Prefix}/*`],
            }),
            // Deny: Prevent SFTP users from overwriting permission metadata files.
            // .metadata.json files are generated by the Metadata Generator Lambda
            // using an administrator-managed DynamoDB permission mapping.
            new iam.PolicyStatement({
              effect: iam.Effect.DENY,
              actions: ['s3:PutObject', 's3:DeleteObject'],
              resources: [`${s3AccessPointArn}/object/${s3Prefix}/*.metadata.json`],
            }),
          ],
        }),
      },
    });

    // Transfer Family User
    // NOTE: HomeDirectoryMappings Target uses S3 AP ALIAS (not ARN, not AP name)
    // Format: /{s3-access-point-alias}/path (no trailing slash)
    new transfer.CfnUser(this, `SftpUser-${userConfig.userName}`, {
      serverId: server.attrServerId,
      userName: userConfig.userName,
      role: userRole.roleArn,
      sshPublicKeys: [userConfig.sshPublicKey],
      homeDirectoryType: 'LOGICAL',
      homeDirectoryMappings: [
        {
          entry: '/',
          target: `/${s3AccessPointAlias}${homePrefix}`,
        },
      ],
    });
  }
}
