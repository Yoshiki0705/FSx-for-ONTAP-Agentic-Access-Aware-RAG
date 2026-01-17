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
exports.CiCdPipelineStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const codepipeline = __importStar(require("aws-cdk-lib/aws-codepipeline"));
const codepipeline_actions = __importStar(require("aws-cdk-lib/aws-codepipeline-actions"));
const codebuild = __importStar(require("aws-cdk-lib/aws-codebuild"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const sns_subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
/**
 * CI/CDパイプラインスタック
 *
 * AWS CodePipelineを使用した包括的なCI/CDパイプラインを構築
 * - ソース管理（GitHub）
 * - ビルド・テスト（CodeBuild）
 * - デプロイメント（CloudFormation）
 * - 監視・通知（CloudWatch・SNS）
 */
class CiCdPipelineStack extends cdk.Stack {
    pipeline;
    buildProject;
    notificationTopic;
    constructor(scope, id, props) {
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
            this.notificationTopic.addSubscription(new sns_subscriptions.EmailSubscription(props.notificationEmail));
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
    createBuildProject(props, artifactBucket) {
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
    createPipeline(props, artifactBucket) {
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
    createMonitoring(props) {
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
        pipelineFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.notificationTopic));
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
        buildFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.notificationTopic));
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
        pipelineDurationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.notificationTopic));
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
exports.CiCdPipelineStack = CiCdPipelineStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwaXBlbGluZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywyRUFBNkQ7QUFDN0QsMkZBQTZFO0FBQzdFLHFFQUF1RDtBQUN2RCx1REFBeUM7QUFDekMseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyxxRkFBdUU7QUFDdkUsdUVBQXlEO0FBQ3pELHVGQUF5RTtBQWF6RTs7Ozs7Ozs7R0FRRztBQUNILE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUIsUUFBUSxDQUF3QjtJQUNoQyxZQUFZLENBQTRCO0lBQ3hDLGlCQUFpQixDQUFZO0lBRTdDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBNkI7UUFDckUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsa0JBQWtCO1FBQ2xCLE1BQU0sY0FBYyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDM0QsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxxQkFBcUI7WUFDMUUsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1NBQzNDLENBQUMsQ0FBQztRQUVILGFBQWE7UUFDYixJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNwRSxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLHlCQUF5QjtZQUM3RSxXQUFXLEVBQUUseUNBQXlDO1NBQ3ZELENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQ3BDLElBQUksaUJBQWlCLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQ2pFLENBQUM7UUFDSixDQUFDO1FBRUQsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsQ0FBQztRQUVuRSxrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsQ0FBQztRQUUzRCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTdCLEtBQUs7UUFDTCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZO1lBQ2pDLFdBQVcsRUFBRSxxQkFBcUI7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLG1FQUFtRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksT0FBTztZQUMzRyxXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRO1lBQ3RDLFdBQVcsRUFBRSw0QkFBNEI7U0FDMUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ssa0JBQWtCLENBQ3hCLEtBQTZCLEVBQzdCLGNBQXlCO1FBRXpCLG1CQUFtQjtRQUNuQixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMseUJBQXlCLENBQUM7WUFDOUQsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsNkJBQTZCLENBQUM7YUFDMUU7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsZUFBZSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDdEMsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGtCQUFrQjtnQ0FDbEIsT0FBTztnQ0FDUCxVQUFVO2dDQUNWLE1BQU07Z0NBQ04sWUFBWTtnQ0FDWixjQUFjO2dDQUNkLGVBQWU7Z0NBQ2YsY0FBYztnQ0FDZCxXQUFXO2dDQUNYLE9BQU87Z0NBQ1AsUUFBUTtnQ0FDUixVQUFVO2dDQUNWLE9BQU87Z0NBQ1AsT0FBTzs2QkFDUjs0QkFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7eUJBQ2pCLENBQUM7cUJBQ0g7aUJBQ0YsQ0FBQzthQUNIO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsWUFBWTtRQUNaLE1BQU0sWUFBWSxHQUFHLElBQUksU0FBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3ZFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsUUFBUTtZQUM5RCxJQUFJLEVBQUUsU0FBUztZQUNmLFdBQVcsRUFBRTtnQkFDWCxVQUFVLEVBQUUsU0FBUyxDQUFDLGVBQWUsQ0FBQyxZQUFZO2dCQUNsRCxXQUFXLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxNQUFNO2dCQUN6QyxVQUFVLEVBQUUsSUFBSSxFQUFFLGNBQWM7YUFDakM7WUFDRCxTQUFTLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUM7Z0JBQ3hDLE9BQU8sRUFBRSxLQUFLO2dCQUNkLE1BQU0sRUFBRTtvQkFDTixPQUFPLEVBQUU7d0JBQ1Asa0JBQWtCLEVBQUU7NEJBQ2xCLE1BQU0sRUFBRSxJQUFJO3lCQUNiO3dCQUNELFFBQVEsRUFBRTs0QkFDUixtQ0FBbUM7NEJBQ25DLCtCQUErQjs0QkFDL0IsMkJBQTJCOzRCQUMzQixnQkFBZ0I7NEJBQ2hCLGVBQWU7NEJBQ2YsZUFBZTt5QkFDaEI7cUJBQ0Y7b0JBQ0QsU0FBUyxFQUFFO3dCQUNULFFBQVEsRUFBRTs0QkFDUiwwQ0FBMEM7NEJBQzFDLDJDQUEyQzs0QkFDM0MsUUFBUTs0QkFDUiwwQ0FBMEM7NEJBQzFDLGVBQWU7NEJBQ2YsOEJBQThCOzRCQUM5QixVQUFVOzRCQUNWLHFDQUFxQzs0QkFDckMseUZBQXlGO3lCQUMxRjtxQkFDRjtvQkFDRCxLQUFLLEVBQUU7d0JBQ0wsUUFBUSxFQUFFOzRCQUNSLHNDQUFzQzs0QkFDdEMsaUNBQWlDOzRCQUNqQyxXQUFXOzRCQUNYLGlDQUFpQzs0QkFDakMsc0NBQXNDOzRCQUN0QywyQ0FBMkM7eUJBQzVDO3FCQUNGO29CQUNELFVBQVUsRUFBRTt3QkFDVixRQUFRLEVBQUU7NEJBQ1IsMkNBQTJDOzRCQUMzQyxtQ0FBbUM7NEJBQ25DLGtDQUFrQzt5QkFDbkM7cUJBQ0Y7aUJBQ0Y7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULEtBQUssRUFBRTt3QkFDTCxNQUFNO3FCQUNQO29CQUNELElBQUksRUFBRSxlQUFlO2lCQUN0QjtnQkFDRCxPQUFPLEVBQUU7b0JBQ1AsY0FBYyxFQUFFO3dCQUNkLEtBQUssRUFBRTs0QkFDTCxrQkFBa0I7NEJBQ2xCLHFCQUFxQjt5QkFDdEI7d0JBQ0QsYUFBYSxFQUFFLFVBQVU7cUJBQzFCO2lCQUNGO2FBQ0YsQ0FBQztZQUNGLEtBQUssRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQztTQUNwRSxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsY0FBYyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU1QyxPQUFPLFlBQVksQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxjQUFjLENBQ3BCLEtBQTZCLEVBQzdCLGNBQXlCO1FBRXpCLGFBQWE7UUFDYixNQUFNLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRTdELFdBQVc7UUFDWCxNQUFNLFFBQVEsR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUMzRCxZQUFZLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLFdBQVc7WUFDbEUsY0FBYyxFQUFFLGNBQWM7WUFDOUIsTUFBTSxFQUFFO2dCQUNOO29CQUNFLFNBQVMsRUFBRSxRQUFRO29CQUNuQixPQUFPLEVBQUU7d0JBQ1AsSUFBSSxvQkFBb0IsQ0FBQyxrQkFBa0IsQ0FBQzs0QkFDMUMsVUFBVSxFQUFFLGVBQWU7NEJBQzNCLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVzs0QkFDeEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxVQUFVOzRCQUN0QixNQUFNLEVBQUUsS0FBSyxDQUFDLFlBQVksSUFBSSxNQUFNOzRCQUNwQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDOzRCQUMxRCxNQUFNLEVBQUUsWUFBWTs0QkFDcEIsT0FBTyxFQUFFLG9CQUFvQixDQUFDLGFBQWEsQ0FBQyxPQUFPO3lCQUNwRCxDQUFDO3FCQUNIO2lCQUNGO2dCQUNEO29CQUNFLFNBQVMsRUFBRSxPQUFPO29CQUNsQixPQUFPLEVBQUU7d0JBQ1AsSUFBSSxvQkFBb0IsQ0FBQyxlQUFlLENBQUM7NEJBQ3ZDLFVBQVUsRUFBRSxnQkFBZ0I7NEJBQzVCLE9BQU8sRUFBRSxJQUFJLENBQUMsWUFBWTs0QkFDMUIsS0FBSyxFQUFFLFlBQVk7NEJBQ25CLE9BQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQzt5QkFDdkIsQ0FBQztxQkFDSDtpQkFDRjtnQkFDRDtvQkFDRSxTQUFTLEVBQUUsZ0JBQWdCO29CQUMzQixPQUFPLEVBQUU7d0JBQ1AsSUFBSSxvQkFBb0IsQ0FBQyxxQ0FBcUMsQ0FBQzs0QkFDN0QsVUFBVSxFQUFFLGdCQUFnQjs0QkFDNUIsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsZ0JBQWdCOzRCQUMvQyxZQUFZLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyx3Q0FBd0MsQ0FBQzs0QkFDMUUsZ0JBQWdCLEVBQUUsSUFBSTs0QkFDdEIsa0JBQWtCLEVBQUU7Z0NBQ2xCLFdBQVcsRUFBRSxTQUFTO2dDQUN0QixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7NkJBQy9COzRCQUNELFFBQVEsRUFBRSxDQUFDO3lCQUNaLENBQUM7cUJBQ0g7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsU0FBUyxFQUFFLFVBQVU7b0JBQ3JCLE9BQU8sRUFBRTt3QkFDUCxJQUFJLG9CQUFvQixDQUFDLG9CQUFvQixDQUFDOzRCQUM1QyxVQUFVLEVBQUUsaUJBQWlCOzRCQUM3QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCOzRCQUN6QyxxQkFBcUIsRUFBRSw2RUFBNkU7NEJBQ3BHLFFBQVEsRUFBRSxDQUFDO3lCQUNaLENBQUM7cUJBQ0g7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsU0FBUyxFQUFFLG1CQUFtQjtvQkFDOUIsT0FBTyxFQUFFO3dCQUNQLElBQUksb0JBQW9CLENBQUMscUNBQXFDLENBQUM7NEJBQzdELFVBQVUsRUFBRSxtQkFBbUI7NEJBQy9CLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLG1CQUFtQjs0QkFDbEQsWUFBWSxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsd0NBQXdDLENBQUM7NEJBQzFFLGdCQUFnQixFQUFFLElBQUk7NEJBQ3RCLGtCQUFrQixFQUFFO2dDQUNsQixXQUFXLEVBQUUsWUFBWTtnQ0FDekIsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXOzZCQUMvQjs0QkFDRCxRQUFRLEVBQUUsQ0FBQzt5QkFDWixDQUFDO3FCQUNIO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxlQUFlO1FBQ2YsUUFBUSxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsRUFBRTtZQUM1QyxNQUFNLEVBQUUsSUFBSSxHQUFHLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztZQUNuRSxXQUFXLEVBQUUsb0NBQW9DO1NBQ2xELENBQUMsQ0FBQztRQUVILE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFFRDs7T0FFRztJQUNLLGdCQUFnQixDQUFDLEtBQTZCO1FBQ3BELGVBQWU7UUFDZixNQUFNLG9CQUFvQixHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUUsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxtQkFBbUI7WUFDdkUsZ0JBQWdCLEVBQUUsa0NBQWtDO1lBQ3BELE1BQU0sRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFNBQVMsRUFBRSxrQkFBa0I7Z0JBQzdCLFVBQVUsRUFBRSwwQkFBMEI7Z0JBQ3RDLGFBQWEsRUFBRTtvQkFDYixZQUFZLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZO2lCQUN6QztnQkFDRCxTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsU0FBUyxFQUFFLENBQUM7WUFDWixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILG9CQUFvQixDQUFDLGNBQWMsQ0FDakMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQ3pELENBQUM7UUFFRixZQUFZO1FBQ1osTUFBTSxpQkFBaUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3hFLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsZ0JBQWdCO1lBQ3BFLGdCQUFnQixFQUFFLHFDQUFxQztZQUN2RCxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsZUFBZTtnQkFDMUIsVUFBVSxFQUFFLGNBQWM7Z0JBQzFCLGFBQWEsRUFBRTtvQkFDYixXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXO2lCQUMzQztnQkFDRCxTQUFTLEVBQUUsS0FBSztnQkFDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNoQyxDQUFDO1lBQ0YsU0FBUyxFQUFFLENBQUM7WUFDWixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILGlCQUFpQixDQUFDLGNBQWMsQ0FDOUIsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQ3pELENBQUM7UUFFRixpQkFBaUI7UUFDakIsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2hGLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsb0JBQW9CO1lBQ3hFLGdCQUFnQixFQUFFLHNEQUFzRDtZQUN4RSxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dCQUM1QixTQUFTLEVBQUUsa0JBQWtCO2dCQUM3QixVQUFVLEVBQUUsMkJBQTJCO2dCQUN2QyxhQUFhLEVBQUU7b0JBQ2IsWUFBWSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWTtpQkFDekM7Z0JBQ0QsU0FBUyxFQUFFLFNBQVM7Z0JBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztZQUNGLFNBQVMsRUFBRSxJQUFJLEVBQUUsTUFBTTtZQUN2QixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILHFCQUFxQixDQUFDLGNBQWMsQ0FDbEMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQ3pELENBQUM7UUFFRixvQkFBb0I7UUFDcEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDaEUsYUFBYSxFQUFFLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxpQkFBaUI7WUFDekUsT0FBTyxFQUFFO2dCQUNQO29CQUNFLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQzt3QkFDekIsS0FBSyxFQUFFLGlDQUFpQzt3QkFDeEMsSUFBSSxFQUFFOzRCQUNKLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQ0FDcEIsU0FBUyxFQUFFLGtCQUFrQjtnQ0FDN0IsVUFBVSxFQUFFLDBCQUEwQjtnQ0FDdEMsYUFBYSxFQUFFO29DQUNiLFlBQVksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVk7aUNBQ3pDO2dDQUNELFNBQVMsRUFBRSxLQUFLO2dDQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOzZCQUM5QixDQUFDO3lCQUNIO3dCQUNELEtBQUssRUFBRSxFQUFFO3dCQUNULE1BQU0sRUFBRSxDQUFDO3FCQUNWLENBQUM7aUJBQ0g7Z0JBQ0Q7b0JBQ0UsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUN6QixLQUFLLEVBQUUsZ0JBQWdCO3dCQUN2QixJQUFJLEVBQUU7NEJBQ0osSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dDQUNwQixTQUFTLEVBQUUsZUFBZTtnQ0FDMUIsVUFBVSxFQUFFLFVBQVU7Z0NBQ3RCLGFBQWEsRUFBRTtvQ0FDYixXQUFXLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXO2lDQUMzQztnQ0FDRCxTQUFTLEVBQUUsU0FBUztnQ0FDcEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzs2QkFDOUIsQ0FBQzt5QkFDSDt3QkFDRCxLQUFLLEVBQUUsRUFBRTt3QkFDVCxNQUFNLEVBQUUsQ0FBQztxQkFDVixDQUFDO2lCQUNIO2dCQUNEO29CQUNFLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDO3dCQUMvQixLQUFLLEVBQUUsNkJBQTZCO3dCQUNwQyxPQUFPLEVBQUU7NEJBQ1AsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dDQUNwQixTQUFTLEVBQUUsa0JBQWtCO2dDQUM3QixVQUFVLEVBQUUsMEJBQTBCO2dDQUN0QyxhQUFhLEVBQUU7b0NBQ2IsWUFBWSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWTtpQ0FDekM7Z0NBQ0QsU0FBUyxFQUFFLFNBQVM7Z0NBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7NkJBQy9CLENBQUM7eUJBQ0g7d0JBQ0QsS0FBSyxFQUFFLENBQUM7d0JBQ1IsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztvQkFDRixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQzt3QkFDL0IsS0FBSyxFQUFFLDBCQUEwQjt3QkFDakMsT0FBTyxFQUFFOzRCQUNQLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQ0FDcEIsU0FBUyxFQUFFLGVBQWU7Z0NBQzFCLFVBQVUsRUFBRSxVQUFVO2dDQUN0QixhQUFhLEVBQUU7b0NBQ2IsV0FBVyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVztpQ0FDM0M7Z0NBQ0QsU0FBUyxFQUFFLFNBQVM7Z0NBQ3BCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7NkJBQy9CLENBQUM7eUJBQ0g7d0JBQ0QsS0FBSyxFQUFFLENBQUM7d0JBQ1IsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztpQkFDSDthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZUFBZTtRQUNmLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSx5REFBeUQsSUFBSSxDQUFDLE1BQU0sb0JBQW9CLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDeEgsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEzYUQsOENBMmFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc25zX3N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2lDZFBpcGVsaW5lU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgcmVhZG9ubHkgZ2l0aHViT3duZXI6IHN0cmluZztcbiAgcmVhZG9ubHkgZ2l0aHViUmVwbzogc3RyaW5nO1xuICByZWFkb25seSBnaXRodWJCcmFuY2g/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IG5vdGlmaWNhdGlvbkVtYWlsPzogc3RyaW5nO1xuICByZWFkb25seSBzbGFja1dlYmhvb2tVcmw/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQ0kvQ0Tjg5HjgqTjg5fjg6njgqTjg7Pjgrnjgr/jg4Pjgq9cbiAqIFxuICogQVdTIENvZGVQaXBlbGluZeOCkuS9v+eUqOOBl+OBn+WMheaLrOeahOOBqkNJL0NE44OR44Kk44OX44Op44Kk44Oz44KS5qeL56+JXG4gKiAtIOOCveODvOOCueeuoeeQhu+8iEdpdEh1Yu+8iVxuICogLSDjg5Pjg6vjg4njg7vjg4bjgrnjg4jvvIhDb2RlQnVpbGTvvIlcbiAqIC0g44OH44OX44Ot44Kk44Oh44Oz44OI77yIQ2xvdWRGb3JtYXRpb27vvIlcbiAqIC0g55uj6KaW44O76YCa55+l77yIQ2xvdWRXYXRjaOODu1NOU++8iVxuICovXG5leHBvcnQgY2xhc3MgQ2lDZFBpcGVsaW5lU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgcGlwZWxpbmU6IGNvZGVwaXBlbGluZS5QaXBlbGluZTtcbiAgcHVibGljIHJlYWRvbmx5IGJ1aWxkUHJvamVjdDogY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdDtcbiAgcHVibGljIHJlYWRvbmx5IG5vdGlmaWNhdGlvblRvcGljOiBzbnMuVG9waWM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENpQ2RQaXBlbGluZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOOCouODvOODhuOCo+ODleOCoeOCr+ODiOeUqFMz44OQ44Kx44OD44OIXG4gICAgY29uc3QgYXJ0aWZhY3RCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBcnRpZmFjdEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1waXBlbGluZS1hcnRpZmFjdHNgLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgIH0pO1xuXG4gICAgLy8g6YCa55+l55SoU05T44OI44OU44OD44KvXG4gICAgdGhpcy5ub3RpZmljYXRpb25Ub3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1BpcGVsaW5lTm90aWZpY2F0aW9ucycsIHtcbiAgICAgIHRvcGljTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXBpcGVsaW5lLW5vdGlmaWNhdGlvbnNgLFxuICAgICAgZGlzcGxheU5hbWU6ICdSQUcgU3lzdGVtIENJL0NEIFBpcGVsaW5lIE5vdGlmaWNhdGlvbnMnLFxuICAgIH0pO1xuXG4gICAgLy8g44Oh44O844Or6YCa55+l6Kit5a6aXG4gICAgaWYgKHByb3BzLm5vdGlmaWNhdGlvbkVtYWlsKSB7XG4gICAgICB0aGlzLm5vdGlmaWNhdGlvblRvcGljLmFkZFN1YnNjcmlwdGlvbihcbiAgICAgICAgbmV3IHNuc19zdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLm5vdGlmaWNhdGlvbkVtYWlsKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDb2RlQnVpbGTjg5fjg63jgrjjgqfjgq/jg4hcbiAgICB0aGlzLmJ1aWxkUHJvamVjdCA9IHRoaXMuY3JlYXRlQnVpbGRQcm9qZWN0KHByb3BzLCBhcnRpZmFjdEJ1Y2tldCk7XG5cbiAgICAvLyBDb2RlUGlwZWxpbmXjga7kvZzmiJBcbiAgICB0aGlzLnBpcGVsaW5lID0gdGhpcy5jcmVhdGVQaXBlbGluZShwcm9wcywgYXJ0aWZhY3RCdWNrZXQpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOebo+imluODu+OCouODqeODvOODoFxuICAgIHRoaXMuY3JlYXRlTW9uaXRvcmluZyhwcm9wcyk7XG5cbiAgICAvLyDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGlwZWxpbmVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucGlwZWxpbmUucGlwZWxpbmVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDSS9DRCBQaXBlbGluZSBOYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQaXBlbGluZVVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL2NvZGVzdWl0ZS9jb2RlcGlwZWxpbmUvcGlwZWxpbmVzLyR7dGhpcy5waXBlbGluZS5waXBlbGluZU5hbWV9L3ZpZXdgLFxuICAgICAgZGVzY3JpcHRpb246ICdDSS9DRCBQaXBlbGluZSBDb25zb2xlIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTm90aWZpY2F0aW9uVG9waWNBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5ub3RpZmljYXRpb25Ub3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIE5vdGlmaWNhdGlvbiBUb3BpYyBBUk4nLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvZGVCdWlsZOODl+ODreOCuOOCp+OCr+ODiOOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCdWlsZFByb2plY3QoXG4gICAgcHJvcHM6IENpQ2RQaXBlbGluZVN0YWNrUHJvcHMsXG4gICAgYXJ0aWZhY3RCdWNrZXQ6IHMzLkJ1Y2tldFxuICApOiBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0IHtcbiAgICAvLyBDb2RlQnVpbGTnlKhJQU3jg63jg7zjg6tcbiAgICBjb25zdCBidWlsZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0J1aWxkUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2RlYnVpbGQuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQVdTQ29kZUJ1aWxkRGV2ZWxvcGVyQWNjZXNzJyksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgQ0RLRGVwbG95UG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdjbG91ZGZvcm1hdGlvbjoqJyxcbiAgICAgICAgICAgICAgICAnaWFtOionLFxuICAgICAgICAgICAgICAgICdsYW1iZGE6KicsXG4gICAgICAgICAgICAgICAgJ3MzOionLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjoqJyxcbiAgICAgICAgICAgICAgICAnb3BlbnNlYXJjaDoqJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6KicsXG4gICAgICAgICAgICAgICAgJ2Nsb3VkZnJvbnQ6KicsXG4gICAgICAgICAgICAgICAgJ3JvdXRlNTM6KicsXG4gICAgICAgICAgICAgICAgJ2FjbToqJyxcbiAgICAgICAgICAgICAgICAnbG9nczoqJyxcbiAgICAgICAgICAgICAgICAnZXZlbnRzOionLFxuICAgICAgICAgICAgICAgICdzbnM6KicsXG4gICAgICAgICAgICAgICAgJ3NxczoqJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIOODk+ODq+ODieODl+ODreOCuOOCp+OCr+ODiFxuICAgIGNvbnN0IGJ1aWxkUHJvamVjdCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KHRoaXMsICdCdWlsZFByb2plY3QnLCB7XG4gICAgICBwcm9qZWN0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJ1aWxkYCxcbiAgICAgIHJvbGU6IGJ1aWxkUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfN18wLFxuICAgICAgICBjb21wdXRlVHlwZTogY29kZWJ1aWxkLkNvbXB1dGVUeXBlLk1FRElVTSxcbiAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZSwgLy8gRG9ja2Vy5L2/55So44Gu44Gf44KBXG4gICAgICB9LFxuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgaW5zdGFsbDoge1xuICAgICAgICAgICAgJ3J1bnRpbWUtdmVyc2lvbnMnOiB7XG4gICAgICAgICAgICAgIG5vZGVqczogJzIwJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBcIkluc3RhbGxpbmcgZGVwZW5kZW5jaWVzLi4uXCInLFxuICAgICAgICAgICAgICAnbnBtIGluc3RhbGwgLWcgYXdzLWNka0BsYXRlc3QnLFxuICAgICAgICAgICAgICAnbnBtIGluc3RhbGwgLWcgdHlwZXNjcmlwdCcsXG4gICAgICAgICAgICAgICdub2RlIC0tdmVyc2lvbicsXG4gICAgICAgICAgICAgICducG0gLS12ZXJzaW9uJyxcbiAgICAgICAgICAgICAgJ2NkayAtLXZlcnNpb24nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gXCJQcmUtYnVpbGQgcGhhc2Ugc3RhcnRlZCBvbiBgZGF0ZWBcIicsXG4gICAgICAgICAgICAgICdlY2hvIFwiSW5zdGFsbGluZyBwcm9qZWN0IGRlcGVuZGVuY2llcy4uLlwiJyxcbiAgICAgICAgICAgICAgJ25wbSBjaScsXG4gICAgICAgICAgICAgICdlY2hvIFwiUnVubmluZyBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLi4uXCInLFxuICAgICAgICAgICAgICAnbnBtIHJ1biBidWlsZCcsXG4gICAgICAgICAgICAgICdlY2hvIFwiUnVubmluZyB1bml0IHRlc3RzLi4uXCInLFxuICAgICAgICAgICAgICAnbnBtIHRlc3QnLFxuICAgICAgICAgICAgICAnZWNobyBcIlJ1bm5pbmcgaW50ZWdyYXRpb24gdGVzdHMuLi5cIicsXG4gICAgICAgICAgICAgICcuL2RldmVsb3BtZW50L3NjcmlwdHMvdGVzdGluZy9xdWlja19pbnRlZ3JhdGlvbl90ZXN0LnNoIC0tbW9kZSBxdWljayAtLWVudmlyb25tZW50IGRlbW8nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBcIkJ1aWxkIHBoYXNlIHN0YXJ0ZWQgb24gYGRhdGVgXCInLFxuICAgICAgICAgICAgICAnZWNobyBcIlJ1bm5pbmcgQ0RLIHN5bnRoZXNpcy4uLlwiJyxcbiAgICAgICAgICAgICAgJ2NkayBzeW50aCcsXG4gICAgICAgICAgICAgICdlY2hvIFwiUnVubmluZyBzZWN1cml0eSBzY2FuLi4uXCInLFxuICAgICAgICAgICAgICAnbnBtIGF1ZGl0IC0tYXVkaXQtbGV2ZWwgaGlnaCB8fCB0cnVlJyxcbiAgICAgICAgICAgICAgJ2VjaG8gXCJCdWlsZCBwaGFzZSBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XCInLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBvc3RfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIFwiUG9zdC1idWlsZCBwaGFzZSBzdGFydGVkIG9uIGBkYXRlYFwiJyxcbiAgICAgICAgICAgICAgJ2VjaG8gXCJHZW5lcmF0aW5nIGJ1aWxkIHJlcG9ydC4uLlwiJyxcbiAgICAgICAgICAgICAgJ2VjaG8gXCJCdWlsZCBjb21wbGV0ZWQgb24gYGRhdGVgXCInLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICBmaWxlczogW1xuICAgICAgICAgICAgJyoqLyonLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgbmFtZTogJ0J1aWxkQXJ0aWZhY3QnLFxuICAgICAgICB9LFxuICAgICAgICByZXBvcnRzOiB7XG4gICAgICAgICAgJ3Rlc3QtcmVwb3J0cyc6IHtcbiAgICAgICAgICAgIGZpbGVzOiBbXG4gICAgICAgICAgICAgICd0ZXN0LXJlc3VsdHMueG1sJyxcbiAgICAgICAgICAgICAgJ2NvdmVyYWdlLXJlcG9ydC54bWwnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICdmaWxlLWZvcm1hdCc6ICdKVU5JVFhNTCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgY2FjaGU6IGNvZGVidWlsZC5DYWNoZS5sb2NhbChjb2RlYnVpbGQuTG9jYWxDYWNoZU1vZGUuRE9DS0VSX0xBWUVSKSxcbiAgICB9KTtcblxuICAgIC8vIOOCouODvOODhuOCo+ODleOCoeOCr+ODiOODkOOCseODg+ODiOOBuOOBruOCouOCr+OCu+OCueaoqemZkFxuICAgIGFydGlmYWN0QnVja2V0LmdyYW50UmVhZFdyaXRlKGJ1aWxkUHJvamVjdCk7XG5cbiAgICByZXR1cm4gYnVpbGRQcm9qZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIENvZGVQaXBlbGluZeOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQaXBlbGluZShcbiAgICBwcm9wczogQ2lDZFBpcGVsaW5lU3RhY2tQcm9wcyxcbiAgICBhcnRpZmFjdEJ1Y2tldDogczMuQnVja2V0XG4gICk6IGNvZGVwaXBlbGluZS5QaXBlbGluZSB7XG4gICAgLy8g44Ki44O844OG44Kj44OV44Kh44Kv44OI5a6a576pXG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnU291cmNlT3V0cHV0Jyk7XG4gICAgY29uc3QgYnVpbGRPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCdCdWlsZE91dHB1dCcpO1xuXG4gICAgLy8g44OR44Kk44OX44Op44Kk44Oz5L2c5oiQXG4gICAgY29uc3QgcGlwZWxpbmUgPSBuZXcgY29kZXBpcGVsaW5lLlBpcGVsaW5lKHRoaXMsICdQaXBlbGluZScsIHtcbiAgICAgIHBpcGVsaW5lTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXBpcGVsaW5lYCxcbiAgICAgIGFydGlmYWN0QnVja2V0OiBhcnRpZmFjdEJ1Y2tldCxcbiAgICAgIHN0YWdlczogW1xuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnU291cmNlJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuR2l0SHViU291cmNlQWN0aW9uKHtcbiAgICAgICAgICAgICAgYWN0aW9uTmFtZTogJ0dpdEh1Yl9Tb3VyY2UnLFxuICAgICAgICAgICAgICBvd25lcjogcHJvcHMuZ2l0aHViT3duZXIsXG4gICAgICAgICAgICAgIHJlcG86IHByb3BzLmdpdGh1YlJlcG8sXG4gICAgICAgICAgICAgIGJyYW5jaDogcHJvcHMuZ2l0aHViQnJhbmNoIHx8ICdtYWluJyxcbiAgICAgICAgICAgICAgb2F1dGhUb2tlbjogY2RrLlNlY3JldFZhbHVlLnNlY3JldHNNYW5hZ2VyKCdnaXRodWItdG9rZW4nKSxcbiAgICAgICAgICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgICAgIHRyaWdnZXI6IGNvZGVwaXBlbGluZV9hY3Rpb25zLkdpdEh1YlRyaWdnZXIuV0VCSE9PSyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFnZU5hbWU6ICdCdWlsZCcsXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICAgICAgICAgIGFjdGlvbk5hbWU6ICdCdWlsZF9hbmRfVGVzdCcsXG4gICAgICAgICAgICAgIHByb2plY3Q6IHRoaXMuYnVpbGRQcm9qZWN0LFxuICAgICAgICAgICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgICAgICBvdXRwdXRzOiBbYnVpbGRPdXRwdXRdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0RlcGxveS1TdGFnaW5nJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ2xvdWRGb3JtYXRpb25DcmVhdGVVcGRhdGVTdGFja0FjdGlvbih7XG4gICAgICAgICAgICAgIGFjdGlvbk5hbWU6ICdEZXBsb3lfU3RhZ2luZycsXG4gICAgICAgICAgICAgIHN0YWNrTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LXN0YWdpbmctc3RhY2tgLFxuICAgICAgICAgICAgICB0ZW1wbGF0ZVBhdGg6IGJ1aWxkT3V0cHV0LmF0UGF0aCgnY2RrLm91dC9SYWdTeXN0ZW1Vc1N0YWNrLnRlbXBsYXRlLmpzb24nKSxcbiAgICAgICAgICAgICAgYWRtaW5QZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgICAgICAgICAgcGFyYW1ldGVyT3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6ICdzdGFnaW5nJyxcbiAgICAgICAgICAgICAgICBQcm9qZWN0TmFtZTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHJ1bk9yZGVyOiAxLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0FwcHJvdmFsJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuTWFudWFsQXBwcm92YWxBY3Rpb24oe1xuICAgICAgICAgICAgICBhY3Rpb25OYW1lOiAnTWFudWFsX0FwcHJvdmFsJyxcbiAgICAgICAgICAgICAgbm90aWZpY2F0aW9uVG9waWM6IHRoaXMubm90aWZpY2F0aW9uVG9waWMsXG4gICAgICAgICAgICAgIGFkZGl0aW9uYWxJbmZvcm1hdGlvbjogJ1BsZWFzZSByZXZpZXcgdGhlIHN0YWdpbmcgZGVwbG95bWVudCBhbmQgYXBwcm92ZSBmb3IgcHJvZHVjdGlvbiBkZXBsb3ltZW50LicsXG4gICAgICAgICAgICAgIHJ1bk9yZGVyOiAxLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0RlcGxveS1Qcm9kdWN0aW9uJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ2xvdWRGb3JtYXRpb25DcmVhdGVVcGRhdGVTdGFja0FjdGlvbih7XG4gICAgICAgICAgICAgIGFjdGlvbk5hbWU6ICdEZXBsb3lfUHJvZHVjdGlvbicsXG4gICAgICAgICAgICAgIHN0YWNrTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LXByb2R1Y3Rpb24tc3RhY2tgLFxuICAgICAgICAgICAgICB0ZW1wbGF0ZVBhdGg6IGJ1aWxkT3V0cHV0LmF0UGF0aCgnY2RrLm91dC9SYWdTeXN0ZW1Vc1N0YWNrLnRlbXBsYXRlLmpzb24nKSxcbiAgICAgICAgICAgICAgYWRtaW5QZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgICAgICAgICAgcGFyYW1ldGVyT3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgICAgICAgICBQcm9qZWN0TmFtZTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHJ1bk9yZGVyOiAxLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyDjg5HjgqTjg5fjg6njgqTjg7PnirbmhYvlpInmm7TpgJrnn6VcbiAgICBwaXBlbGluZS5vblN0YXRlQ2hhbmdlKCdQaXBlbGluZVN0YXRlQ2hhbmdlJywge1xuICAgICAgdGFyZ2V0OiBuZXcgY2RrLmF3c19ldmVudHNfdGFyZ2V0cy5TbnNUb3BpYyh0aGlzLm5vdGlmaWNhdGlvblRvcGljKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGlwZWxpbmUgc3RhdGUgY2hhbmdlIG5vdGlmaWNhdGlvbicsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gcGlwZWxpbmU7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRXYXRjaOebo+imluODu+OCouODqeODvOODoOOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNb25pdG9yaW5nKHByb3BzOiBDaUNkUGlwZWxpbmVTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgLy8g44OR44Kk44OX44Op44Kk44Oz5aSx5pWX44Ki44Op44O844OgXG4gICAgY29uc3QgcGlwZWxpbmVGYWlsdXJlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnUGlwZWxpbmVGYWlsdXJlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1waXBlbGluZS1mYWlsdXJlYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdDSS9DRCBQaXBlbGluZSBleGVjdXRpb24gZmFpbHVyZScsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9Db2RlUGlwZWxpbmUnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnUGlwZWxpbmVFeGVjdXRpb25GYWlsdXJlJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIFBpcGVsaW5lTmFtZTogdGhpcy5waXBlbGluZS5waXBlbGluZU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBwaXBlbGluZUZhaWx1cmVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMubm90aWZpY2F0aW9uVG9waWMpXG4gICAgKTtcblxuICAgIC8vIOODk+ODq+ODieWkseaVl+OCouODqeODvOODoFxuICAgIGNvbnN0IGJ1aWxkRmFpbHVyZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0J1aWxkRmFpbHVyZUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYnVpbGQtZmFpbHVyZWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQ29kZUJ1aWxkIHByb2plY3QgZXhlY3V0aW9uIGZhaWx1cmUnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ29kZUJ1aWxkJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0ZhaWxlZEJ1aWxkcycsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBQcm9qZWN0TmFtZTogdGhpcy5idWlsZFByb2plY3QucHJvamVjdE5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBidWlsZEZhaWx1cmVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMubm90aWZpY2F0aW9uVG9waWMpXG4gICAgKTtcblxuICAgIC8vIOODkeOCpOODl+ODqeOCpOODs+Wun+ihjOaZgumWk+OCouODqeODvOODoFxuICAgIGNvbnN0IHBpcGVsaW5lRHVyYXRpb25BbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdQaXBlbGluZUR1cmF0aW9uQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1waXBlbGluZS1kdXJhdGlvbmAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQ0kvQ0QgUGlwZWxpbmUgZXhlY3V0aW9uIGR1cmF0aW9uIGV4Y2VlZGVkIHRocmVzaG9sZCcsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9Db2RlUGlwZWxpbmUnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnUGlwZWxpbmVFeGVjdXRpb25EdXJhdGlvbicsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBQaXBlbGluZU5hbWU6IHRoaXMucGlwZWxpbmUucGlwZWxpbmVOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxODAwLCAvLyAzMOWIhlxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIHBpcGVsaW5lRHVyYXRpb25BbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMubm90aWZpY2F0aW9uVG9waWMpXG4gICAgKTtcblxuICAgIC8vIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4lcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0NpQ2REYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tY2ljZC1kYXNoYm9hcmRgLFxuICAgICAgd2lkZ2V0czogW1xuICAgICAgICBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdQaXBlbGluZSBFeGVjdXRpb24gU3VjY2VzcyBSYXRlJyxcbiAgICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ29kZVBpcGVsaW5lJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnUGlwZWxpbmVFeGVjdXRpb25TdWNjZXNzJyxcbiAgICAgICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgICAgICBQaXBlbGluZU5hbWU6IHRoaXMucGlwZWxpbmUucGlwZWxpbmVOYW1lLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdCdWlsZCBEdXJhdGlvbicsXG4gICAgICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0NvZGVCdWlsZCcsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcbiAgICAgICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICAgICAgICBQcm9qZWN0TmFtZTogdGhpcy5idWlsZFByb2plY3QucHJvamVjdE5hbWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guU2luZ2xlVmFsdWVXaWRnZXQoe1xuICAgICAgICAgICAgdGl0bGU6ICdQaXBlbGluZSBTdWNjZXNzIFJhdGUgKDI0aCknLFxuICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9Db2RlUGlwZWxpbmUnLFxuICAgICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdQaXBlbGluZUV4ZWN1dGlvblN1Y2Nlc3MnLFxuICAgICAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgICAgIFBpcGVsaW5lTmFtZTogdGhpcy5waXBlbGluZS5waXBlbGluZU5hbWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHdpZHRoOiA2LFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnQXZlcmFnZSBCdWlsZCBUaW1lICgyNGgpJyxcbiAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQ29kZUJ1aWxkJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgICAgIFByb2plY3ROYW1lOiB0aGlzLmJ1aWxkUHJvamVjdC5wcm9qZWN0TmFtZSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDYsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8g44OA44OD44K344Ol44Oc44O844OJVVJM5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9jb25zb2xlLmF3cy5hbWF6b24uY29tL2Nsb3Vkd2F0Y2gvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jZGFzaGJvYXJkczpuYW1lPSR7ZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==