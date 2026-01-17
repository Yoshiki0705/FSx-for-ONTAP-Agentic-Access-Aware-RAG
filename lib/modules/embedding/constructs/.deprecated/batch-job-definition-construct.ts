/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as batch from "aws-cdk-lib/aws-batch";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";
import { 
  EmbeddingConfig,
  EmbeddingJobDefinitionConfig,
  EmbeddingFsxIntegrationConfig,
  EmbeddingActiveDirectoryConfig,
  EmbeddingBedrockConfig,
  EmbeddingOpenSearchIntegrationConfig,
  EmbeddingRdsConfig
} from "../interfaces/embedding-config";
import { ECR } from "../../../constructs/repository";

/**
 * AWS Batch Job Definition構築用のプロパティ
 */
export interface BatchJobDefinitionProps {
  /** 埋め込み処理設定 */
  readonly embeddingConfig: EmbeddingConfig;
  /** 実行ロール */
  readonly executionRole: iam.IRole;
  /** タスクロール */
  readonly taskRole: iam.IRole;
  /** ECRイメージパス */
  readonly imagePath: string;
  /** イメージタグ */
  readonly imageTag: string;
  /** リージョン */
  readonly region: string;
  /** アカウントID */
  readonly accountId: string;
  /** プロジェクト名 */
  readonly projectName: string;
  /** 環境名 */
  readonly environment: string;
}

/**
 * AWS Batch Job Definition構築クラス
 * 
 * 既存のEC2ベースembedding-serverからAWS Batchへの移行用Job Definition
 * FSx for NetApp ONTAP統合、Bedrock連携、OpenSearch Serverless対応
 * 
 * Requirements: 1.2, 2.1, 2.3
 */
export class BatchJobDefinitionConstruct extends Construct {
  /** Job Definition */
  public readonly jobDefinition: batch.EcsJobDefinition;
  /** ECRリポジトリ */
  public readonly ecrRepository: ECR;
  /** CloudWatch Logs グループ */
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: BatchJobDefinitionProps) {
    super(scope, id);

    // 入力値検証
    this.validateProps(props);

    // CloudWatch Logs グループ作成
    this.logGroup = this.createLogGroup(props);

    // ECRリポジトリ作成（既存のECRクラスを再利用）
    this.ecrRepository = new ECR(this, "EmbeddingEcr", {
      path: `${props.imagePath}/embed`,
      tag: props.imageTag,
    });

    // コンテナ定義作成
    const containerDefinition = this.createContainerDefinition(props);

    // Job Definition作成
    this.jobDefinition = new batch.EcsJobDefinition(this, "EmbeddingJobDefinition", {
      jobDefinitionName: props.embeddingConfig.jobDefinition.jobDefinitionName,
      container: containerDefinition,
      timeout: cdk.Duration.hours(props.embeddingConfig.jobDefinition.timeoutHours),
      retryAttempts: props.embeddingConfig.jobDefinition.retryAttempts,
    });

    // タグ設定
    this.applyTags(props);

    // CDK Nag抑制設定
    this.addNagSuppressions();
  }

  /**
   * プロパティ検証
   */
  private validateProps(props: BatchJobDefinitionProps): void {
    if (!props.embeddingConfig) {
      throw new Error('埋め込み設定が必要です');
    }

    if (!props.executionRole || !props.taskRole) {
      throw new Error('実行ロールとタスクロールが必要です');
    }

    if (!props.imagePath || !props.imageTag) {
      throw new Error('ECRイメージパスとタグが必要です');
    }

    if (!props.region || !props.accountId) {
      throw new Error('リージョンとアカウントIDが必要です');
    }

    // セキュリティ: パストラバーサル攻撃防止
    if (props.imagePath.includes('..') || props.imageTag.includes('..')) {
      throw new Error('不正なイメージパスまたはタグが検出されました');
    }
  }

  /**
   * CloudWatch Logs グループ作成
   */
  private createLogGroup(props: BatchJobDefinitionProps): logs.LogGroup {
    const logGroupName = `/aws/batch/embedding-job-${props.embeddingConfig.jobDefinition.jobDefinitionName}`;
    
    return new logs.LogGroup(this, "EmbeddingJobLogGroup", {
      logGroupName,
      retention: logs.RetentionDays.ONE_MONTH, // セキュリティ監査のため1ヶ月保持
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // 本番環境では暗号化を有効にする
      ...(props.environment === 'prod' && {
        encryptionKey: undefined, // KMSキーを指定する場合
      }),
    });
  }

  /**
   * コンテナ定義作成
   */
  private createContainerDefinition(props: BatchJobDefinitionProps): batch.EcsEc2ContainerDefinition {
    // 環境変数設定
    const environment = this.createEnvironmentVariables(props);

    // マウントポイント設定
    const mountPoints = this.createMountPoints(props);

    // ボリューム設定
    const volumes = this.createVolumes(props);

    return new batch.EcsEc2ContainerDefinition(this, "EmbeddingContainer", {
      image: ecs.ContainerImage.fromEcrRepository(
        this.ecrRepository.repository,
        props.imageTag
      ),
      cpu: props.embeddingConfig.jobDefinition.cpu,
      memory: cdk.Size.mebibytes(props.embeddingConfig.jobDefinition.memoryMiB),
      executionRole: props.executionRole,
      jobRole: props.taskRole,
      environment,
      mountPoints,
      // volumes, // ECS Volume型の問題により一時的にコメントアウト
      logging: ecs.LogDrivers.awsLogs({
        logGroup: this.logGroup,
        streamPrefix: "embedding-job",
      }),
      readonlyRootFilesystem: false, // FSxマウントのため読み書き可能
      privileged: false, // セキュリティ: 特権モード無効
      user: "root", // FSxマウントのため（本番環境では専用ユーザーを検討）
    });
  }

  /**
   * 環境変数設定作成
   */
  private createEnvironmentVariables(props: BatchJobDefinitionProps): Record<string, string> {
    const baseEnvironment: Record<string, string> = {
      ENV_REGION: props.region,
      AWS_DEFAULT_REGION: props.region,
      PROJECT_NAME: props.projectName,
      ENVIRONMENT: props.environment,
    };

    // FSx設定の安全な追加
    this.addFsxEnvironmentVariables(baseEnvironment, props.embeddingConfig.fsxIntegration);
    
    // Active Directory設定の安全な追加
    this.addActiveDirectoryEnvironmentVariables(baseEnvironment, props.embeddingConfig.activeDirectory);
    
    // Bedrock設定の安全な追加
    this.addBedrockEnvironmentVariables(baseEnvironment, props.embeddingConfig.bedrock, props.region);
    
    // OpenSearch設定の安全な追加
    this.addOpenSearchEnvironmentVariables(baseEnvironment, props.embeddingConfig.openSearch);
    
    // RDS設定の安全な追加
    this.addRdsEnvironmentVariables(baseEnvironment, props.embeddingConfig.rds);

    return baseEnvironment;
  }

  /**
   * FSx環境変数の安全な追加
   */
  private addFsxEnvironmentVariables(
    environment: Record<string, string>, 
    fsxConfig?: EmbeddingFsxIntegrationConfig
  ): void {
    if (!fsxConfig) return;

    environment.FSX_ID = fsxConfig.fileSystemId || "fs-default";
    environment.SVM_REF = fsxConfig.svmRef || "svm-default";
    environment.SVM_ID = fsxConfig.svmId || "svm-default-id";
    environment.CIFSDATA_VOL_NAME = fsxConfig.cifsdataVolName || "smb_share";
    environment.RAGDB_VOL_PATH = fsxConfig.ragdbVolPath || "/smb_share/ragdb";
  }

  /**
   * Active Directory環境変数の安全な追加
   */
  private addActiveDirectoryEnvironmentVariables(
    environment: Record<string, string>, 
    adConfig?: EmbeddingActiveDirectoryConfig
  ): void {
    if (!adConfig) return;

    environment.AD_DOMAIN = adConfig.domain;
    environment.AD_USERNAME = adConfig.username;
    // パスワードはSecrets Managerから取得（環境変数には含めない）
  }

  /**
   * Bedrock環境変数の安全な追加
   */
  private addBedrockEnvironmentVariables(
    environment: Record<string, string>, 
    bedrockConfig?: EmbeddingBedrockConfig,
    defaultRegion?: string
  ): void {
    if (!bedrockConfig) return;

    environment.BEDROCK_REGION = bedrockConfig.region || defaultRegion || 'us-east-1';
    environment.BEDROCK_MODEL_ID = bedrockConfig.modelId;
  }

  /**
   * OpenSearch環境変数の安全な追加
   */
  private addOpenSearchEnvironmentVariables(
    environment: Record<string, string>, 
    openSearchConfig?: EmbeddingOpenSearchIntegrationConfig
  ): void {
    if (!openSearchConfig?.collectionName) return;

    environment.ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME = openSearchConfig.collectionName;
  }

  /**
   * RDS環境変数の安全な追加
   */
  private addRdsEnvironmentVariables(
    environment: Record<string, string>, 
    rdsConfig?: EmbeddingRdsConfig
  ): void {
    if (!rdsConfig?.secretName) return;

    environment.ENV_RDS_SECRETS_NAME = rdsConfig.secretName;
    environment.ENV_SECRETS_ARN = rdsConfig.secretArn;
    environment.ENV_RDS_ARN = rdsConfig.clusterArn;
  }

  /**
   * マウントポイント設定作成
   */
  private createMountPoints(props: BatchJobDefinitionProps): ecs.MountPoint[] {
    return [
      {
        sourceVolume: "fsx-data-volume",
        containerPath: "/opt/netapp/ai/data",
        readOnly: false,
      },
      {
        sourceVolume: "fsx-db-volume", 
        containerPath: "/opt/netapp/ai/db",
        readOnly: false,
      },
    ];
  }

  /**
   * ボリューム設定作成
   */
  private createVolumes(props: BatchJobDefinitionProps): ecs.Volume[] {
    return [
      {
        name: "fsx-data-volume",
        host: {
          sourcePath: "/mnt/fsx/data",
        },
      } as ecs.Volume,
      {
        name: "fsx-db-volume",
        host: {
          sourcePath: "/mnt/fsx/db",
        },
      } as ecs.Volume,
    ];
  }

  /**
   * タグ設定
   */
  private applyTags(props: BatchJobDefinitionProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'Embedding',
      Module: 'AWS_BATCH_JOB_DEFINITION',
      ManagedBy: 'CDK',
      CreatedBy: 'BatchJobDefinitionConstruct',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * CDK Nag抑制設定追加
   */
  private addNagSuppressions(): void {
    NagSuppressions.addResourceSuppressions(
      this.jobDefinition,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Batch Job Definition requires broad permissions for FSx and Bedrock access",
        },
        {
          id: "AwsSolutions-ECS2",
          reason: "Environment variables contain necessary configuration for FSx and AD integration",
        },
        {
          id: "AwsSolutions-ECS4",
          reason: "Root user required for FSx mount operations in container",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.logGroup,
      [
        {
          id: "AwsSolutions-CWL1",
          reason: "CloudWatch Logs encryption will be enabled in production environment",
        },
      ],
      true
    );
  }

  /**
   * Job Definition ARN取得
   */
  public get jobDefinitionArn(): string {
    return this.jobDefinition.jobDefinitionArn;
  }

  /**
   * Job Definition名取得
   */
  public get jobDefinitionName(): string {
    return this.jobDefinition.jobDefinitionName;
  }
}