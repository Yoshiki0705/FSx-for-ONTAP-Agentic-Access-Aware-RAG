import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as sns from 'aws-cdk-lib/aws-sns';
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
export declare class CiCdPipelineStack extends cdk.Stack {
    readonly pipeline: codepipeline.Pipeline;
    readonly buildProject: codebuild.PipelineProject;
    readonly notificationTopic: sns.Topic;
    constructor(scope: Construct, id: string, props: CiCdPipelineStackProps);
    /**
     * CodeBuildプロジェクトの作成
     */
    private createBuildProject;
    /**
     * CodePipelineの作成
     */
    private createPipeline;
    /**
     * CloudWatch監視・アラームの作成
     */
    private createMonitoring;
}
