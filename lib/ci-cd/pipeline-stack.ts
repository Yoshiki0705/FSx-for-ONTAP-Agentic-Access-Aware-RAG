import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface CiCdPipelineStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environment: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly githubBranch?: string;
  readonly notificationEmail?: string;
  readonly slackWebhookUrl?: string;
}

/**
 * CI/CDパイプラインスタック
 * 
 * AWS CodePipelineを使用した包括的なCI/CDパイプラインを構築
 * - ソース管理（GitHub）
 * - ビルド・テスト（CodeBuild）
 * - デプロイメント（CloudFormation）
 * - 監視・通知（CloudWatch・SNS）
 */
export class CiCdPipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly buildProject: codebuild.PipelineProject;
  public readonly notificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: CiCdPipelineStackProps) {
    super(scope, id, props);

    // アーティファクト用S3バケット
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `${props.projectName}-${props.environment}-pipeline-artifacts`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // 通知用SNSトピック
    this.notificationTopic = new sns.Topic(this, 'PipelineNotifications', {
      topicName: `${props.projectName}-${props.environment}-pipeline-notifications`,
      displayName: 'RAG System CI/CD Pipeline Notifications',
    });

    // メール通知設定
    if (props.notificationEmail) {
      this.notificationTopic.addSubscription(
        new sns_subscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    // CodeBuildプロジェクト
    this.buildProject = this.createBuildProject(props, artifactBucket);

    // CodePipelineの作成
    this.pipeline = this.createPipeline(props, artifactBucket);

    // CloudWatch監視・アラーム
    this.createMonitoring(props);

    // 出力
    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'CI/CD Pipeline Name',
    });

    new cdk.CfnOutput(this, 'PipelineUrl', {
      value: `https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.pipeline.pipelineName}/view`,
      description: 'CI/CD Pipeline Console URL',
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      description: 'SNS Notification Topic ARN',
    });
  }

  /**
   * CodeBuildプロジェクトの作成
   */
  private createBuildProject(
    props: CiCdPipelineStackProps,
    artifactBucket: s3.Bucket
  ): codebuild.PipelineProject {
    // CodeBuild用IAMロール
    const buildRole = new iam.Role(this, 'BuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeBuildDeveloperAccess'),
      ],
      inlinePolicies: {
        CDKDeployPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudformation:*',
                'iam:*',
                'lambda:*',
                's3:*',
                'dynamodb:*',
                'opensearch:*',
                'cognito-idp:*',
                'cloudfront:*',
                'route53:*',
                'acm:*',
                'logs:*',
                'events:*',
                'sns:*',
                'sqs:*',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // ビルドプロジェクト
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: `${props.projectName}-${props.environment}-build`,
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true, // Docker使用のため
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '20',
            },
            commands: [
              'echo "Installing dependencies..."',
              'npm install -g aws-cdk@latest',
              'npm install -g typescript',
              'node --version',
              'npm --version',
              'cdk --version',
            ],
          },
          pre_build: {
            commands: [
              'echo "Pre-build phase started on `date`"',
              'echo "Installing project dependencies..."',
              'npm ci',
              'echo "Running TypeScript compilation..."',
              'npm run build',
              'echo "Running unit tests..."',
              'npm test',
              'echo "Running integration tests..."',
              './development/scripts/testing/quick_integration_test.sh --mode quick --environment demo',
            ],
          },
          build: {
            commands: [
              'echo "Build phase started on `date`"',
              'echo "Running CDK synthesis..."',
              'cdk synth',
              'echo "Running security scan..."',
              'npm audit --audit-level high || true',
              'echo "Build phase completed successfully"',
            ],
          },
          post_build: {
            commands: [
              'echo "Post-build phase started on `date`"',
              'echo "Generating build report..."',
              'echo "Build completed on `date`"',
            ],
          },
        },
        artifacts: {
          files: [
            '**/*',
          ],
          name: 'BuildArtifact',
        },
        reports: {
          'test-reports': {
            files: [
              'test-results.xml',
              'coverage-report.xml',
            ],
            'file-format': 'JUNITXML',
          },
        },
      }),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
    });

    // アーティファクトバケットへのアクセス権限
    artifactBucket.grantReadWrite(buildProject);

    return buildProject;
  }

  /**
   * CodePipelineの作成
   */
  private createPipeline(
    props: CiCdPipelineStackProps,
    artifactBucket: s3.Bucket
  ): codepipeline.Pipeline {
    // アーティファクト定義
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // パイプライン作成
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `${props.projectName}-${props.environment}-pipeline`,
      artifactBucket: artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: props.githubOwner,
              repo: props.githubRepo,
              branch: props.githubBranch || 'main',
              oauthToken: cdk.SecretValue.secretsManager('github-token'),
              output: sourceOutput,
              trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build_and_Test',
              project: this.buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy-Staging',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy_Staging',
              stackName: `${props.projectName}-staging-stack`,
              templatePath: buildOutput.atPath('cdk.out/RagSystemUsStack.template.json'),
              adminPermissions: true,
              parameterOverrides: {
                Environment: 'staging',
                ProjectName: props.projectName,
              },
              runOrder: 1,
            }),
          ],
        },
        {
          stageName: 'Approval',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Manual_Approval',
              notificationTopic: this.notificationTopic,
              additionalInformation: 'Please review the staging deployment and approve for production deployment.',
              runOrder: 1,
            }),
          ],
        },
        {
          stageName: 'Deploy-Production',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy_Production',
              stackName: `${props.projectName}-production-stack`,
              templatePath: buildOutput.atPath('cdk.out/RagSystemUsStack.template.json'),
              adminPermissions: true,
              parameterOverrides: {
                Environment: 'production',
                ProjectName: props.projectName,
              },
              runOrder: 1,
            }),
          ],
        },
      ],
    });

    // パイプライン状態変更通知
    pipeline.onStateChange('PipelineStateChange', {
      target: new cdk.aws_events_targets.SnsTopic(this.notificationTopic),
      description: 'Pipeline state change notification',
    });

    return pipeline;
  }

  /**
   * CloudWatch監視・アラームの作成
   */
  private createMonitoring(props: CiCdPipelineStackProps): void {
    // パイプライン失敗アラーム
    const pipelineFailureAlarm = new cloudwatch.Alarm(this, 'PipelineFailureAlarm', {
      alarmName: `${props.projectName}-${props.environment}-pipeline-failure`,
      alarmDescription: 'CI/CD Pipeline execution failure',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CodePipeline',
        metricName: 'PipelineExecutionFailure',
        dimensionsMap: {
          PipelineName: this.pipeline.pipelineName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    pipelineFailureAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.notificationTopic)
    );

    // ビルド失敗アラーム
    const buildFailureAlarm = new cloudwatch.Alarm(this, 'BuildFailureAlarm', {
      alarmName: `${props.projectName}-${props.environment}-build-failure`,
      alarmDescription: 'CodeBuild project execution failure',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CodeBuild',
        metricName: 'FailedBuilds',
        dimensionsMap: {
          ProjectName: this.buildProject.projectName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    buildFailureAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.notificationTopic)
    );

    // パイプライン実行時間アラーム
    const pipelineDurationAlarm = new cloudwatch.Alarm(this, 'PipelineDurationAlarm', {
      alarmName: `${props.projectName}-${props.environment}-pipeline-duration`,
      alarmDescription: 'CI/CD Pipeline execution duration exceeded threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CodePipeline',
        metricName: 'PipelineExecutionDuration',
        dimensionsMap: {
          PipelineName: this.pipeline.pipelineName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1800, // 30分
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    pipelineDurationAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.notificationTopic)
    );

    // CloudWatchダッシュボード
    const dashboard = new cloudwatch.Dashboard(this, 'CiCdDashboard', {
      dashboardName: `${props.projectName}-${props.environment}-cicd-dashboard`,
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'Pipeline Execution Success Rate',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/CodePipeline',
                metricName: 'PipelineExecutionSuccess',
                dimensionsMap: {
                  PipelineName: this.pipeline.pipelineName,
                },
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
            ],
            width: 12,
            height: 6,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Build Duration',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/CodeBuild',
                metricName: 'Duration',
                dimensionsMap: {
                  ProjectName: this.buildProject.projectName,
                },
                statistic: 'Average',
                period: cdk.Duration.hours(1),
              }),
            ],
            width: 12,
            height: 6,
          }),
        ],
        [
          new cloudwatch.SingleValueWidget({
            title: 'Pipeline Success Rate (24h)',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AWS/CodePipeline',
                metricName: 'PipelineExecutionSuccess',
                dimensionsMap: {
                  PipelineName: this.pipeline.pipelineName,
                },
                statistic: 'Average',
                period: cdk.Duration.hours(24),
              }),
            ],
            width: 6,
            height: 6,
          }),
          new cloudwatch.SingleValueWidget({
            title: 'Average Build Time (24h)',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AWS/CodeBuild',
                metricName: 'Duration',
                dimensionsMap: {
                  ProjectName: this.buildProject.projectName,
                },
                statistic: 'Average',
                period: cdk.Duration.hours(24),
              }),
            ],
            width: 6,
            height: 6,
          }),
        ],
      ],
    });

    // ダッシュボードURL出力
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}