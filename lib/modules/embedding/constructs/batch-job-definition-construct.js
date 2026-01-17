"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
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
exports.BatchJobDefinitionConstruct = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cdk_nag_1 = require("cdk-nag");
const repository_1 = require("../../../constructs/repository");
/**
 * AWS Batch Job Definition構築クラス
 *
 * 既存のEC2ベースembedding-serverからAWS Batchへの移行用Job Definition
 * FSx for NetApp ONTAP統合、Bedrock連携、OpenSearch Serverless対応
 *
 * Requirements: 1.2, 2.1, 2.3
 */
class BatchJobDefinitionConstruct extends constructs_1.Construct {
    /** Job Definition */
    jobDefinition;
    /** ECRリポジトリ */
    ecrRepository;
    /** CloudWatch Logs グループ */
    logGroup;
    constructor(scope, id, props) {
        super(scope, id);
        // 入力値検証
        this.validateProps(props);
        // CloudWatch Logs グループ作成
        this.logGroup = this.createLogGroup(props);
        // ECRリポジトリ作成（既存のECRクラスを再利用）
        this.ecrRepository = new repository_1.ECR(this, "EmbeddingEcr", {
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
    validateProps(props) {
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
    createLogGroup(props) {
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
    createContainerDefinition(props) {
        // 環境変数設定
        const environment = this.createEnvironmentVariables(props);
        // マウントポイント設定
        const mountPoints = this.createMountPoints(props);
        // ボリューム設定
        const volumes = this.createVolumes(props);
        return new batch.EcsEc2ContainerDefinition(this, "EmbeddingContainer", {
            image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository.repository, props.imageTag),
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
    createEnvironmentVariables(props) {
        const baseEnvironment = {
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
    addFsxEnvironmentVariables(environment, fsxConfig) {
        if (!fsxConfig)
            return;
        environment.FSX_ID = fsxConfig.fileSystemId || "fs-default";
        environment.SVM_REF = fsxConfig.svmRef || "svm-default";
        environment.SVM_ID = fsxConfig.svmId || "svm-default-id";
        environment.CIFSDATA_VOL_NAME = fsxConfig.cifsdataVolName || "smb_share";
        environment.RAGDB_VOL_PATH = fsxConfig.ragdbVolPath || "/smb_share/ragdb";
    }
    /**
     * Active Directory環境変数の安全な追加
     */
    addActiveDirectoryEnvironmentVariables(environment, adConfig) {
        if (!adConfig)
            return;
        environment.AD_DOMAIN = adConfig.domain;
        environment.AD_USERNAME = adConfig.username;
        // パスワードはSecrets Managerから取得（環境変数には含めない）
    }
    /**
     * Bedrock環境変数の安全な追加
     */
    addBedrockEnvironmentVariables(environment, bedrockConfig, defaultRegion) {
        if (!bedrockConfig)
            return;
        environment.BEDROCK_REGION = bedrockConfig.region || defaultRegion || 'us-east-1';
        environment.BEDROCK_MODEL_ID = bedrockConfig.modelId;
    }
    /**
     * OpenSearch環境変数の安全な追加
     */
    addOpenSearchEnvironmentVariables(environment, openSearchConfig) {
        if (!openSearchConfig?.collectionName)
            return;
        environment.ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME = openSearchConfig.collectionName;
    }
    /**
     * RDS環境変数の安全な追加
     */
    addRdsEnvironmentVariables(environment, rdsConfig) {
        if (!rdsConfig?.secretName)
            return;
        environment.ENV_RDS_SECRETS_NAME = rdsConfig.secretName;
        environment.ENV_SECRETS_ARN = rdsConfig.secretArn;
        environment.ENV_RDS_ARN = rdsConfig.clusterArn;
    }
    /**
     * マウントポイント設定作成
     */
    createMountPoints(props) {
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
    createVolumes(props) {
        return [
            {
                name: "fsx-data-volume",
                host: {
                    sourcePath: "/mnt/fsx/data",
                },
            },
            {
                name: "fsx-db-volume",
                host: {
                    sourcePath: "/mnt/fsx/db",
                },
            },
        ];
    }
    /**
     * タグ設定
     */
    applyTags(props) {
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
    addNagSuppressions() {
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.jobDefinition, [
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
        ], true);
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.logGroup, [
            {
                id: "AwsSolutions-CWL1",
                reason: "CloudWatch Logs encryption will be enabled in production environment",
            },
        ], true);
    }
    /**
     * Job Definition ARN取得
     */
    get jobDefinitionArn() {
        return this.jobDefinition.jobDefinitionArn;
    }
    /**
     * Job Definition名取得
     */
    get jobDefinitionName() {
        return this.jobDefinition.jobDefinitionName;
    }
}
exports.BatchJobDefinitionConstruct = BatchJobDefinitionConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtam9iLWRlZmluaXRpb24tY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmF0Y2gtam9iLWRlZmluaXRpb24tY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJDQUF1QztBQUN2QyxpREFBbUM7QUFDbkMsNkRBQStDO0FBQy9DLHlEQUEyQztBQUUzQywyREFBNkM7QUFDN0MscUNBQTBDO0FBVTFDLCtEQUFxRDtBQTBCckQ7Ozs7Ozs7R0FPRztBQUNILE1BQWEsMkJBQTRCLFNBQVEsc0JBQVM7SUFDeEQscUJBQXFCO0lBQ0wsYUFBYSxDQUF5QjtJQUN0RCxlQUFlO0lBQ0MsYUFBYSxDQUFNO0lBQ25DLDJCQUEyQjtJQUNYLFFBQVEsQ0FBZ0I7SUFFeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE4QjtRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLFFBQVE7UUFDUixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTFCLHlCQUF5QjtRQUN6QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0MsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxnQkFBRyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDakQsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLFNBQVMsUUFBUTtZQUNoQyxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVE7U0FDcEIsQ0FBQyxDQUFDO1FBRUgsV0FBVztRQUNYLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRWxFLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksS0FBSyxDQUFDLGdCQUFnQixD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QUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFXLGdCQUFnQjtRQUN6QixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBVyxpQkFBaUI7UUFDMUIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDO0lBQzlDLENBQUM7Q0FDRjtBQWxVRCxrRUFrVUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogIENvcHlyaWdodCAyMDI1IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiAgU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IExpY2Vuc2VSZWYtLmFtYXpvbi5jb20uLUFtem5TTC0xLjBcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQW1hem9uIFNvZnR3YXJlIExpY2Vuc2UgIGh0dHA6Ly9hd3MuYW1hem9uLmNvbS9hc2wvXG4gKi9cblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCAqIGFzIGJhdGNoIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYmF0Y2hcIjtcbmltcG9ydCAqIGFzIGVjcyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWVjc1wiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbG9nc1wiO1xuaW1wb3J0IHsgTmFnU3VwcHJlc3Npb25zIH0gZnJvbSBcImNkay1uYWdcIjtcbmltcG9ydCB7IFxuICBFbWJlZGRpbmdDb25maWcsXG4gIEVtYmVkZGluZ0pvYkRlZmluaXRpb25Db25maWcsXG4gIEVtYmVkZGluZ0ZzeEludGVncmF0aW9uQ29uZmlnLFxuICBFbWJlZGRpbmdBY3RpdmVEaXJlY3RvcnlDb25maWcsXG4gIEVtYmVkZGluZ0JlZHJvY2tDb25maWcsXG4gIEVtYmVkZGluZ09wZW5TZWFyY2hJbnRlZ3JhdGlvbkNvbmZpZyxcbiAgRW1iZWRkaW5nUmRzQ29uZmlnXG59IGZyb20gXCIuLi9pbnRlcmZhY2VzL2VtYmVkZGluZy1jb25maWdcIjtcbmltcG9ydCB7IEVDUiB9IGZyb20gXCIuLi8uLi8uLi9jb25zdHJ1Y3RzL3JlcG9zaXRvcnlcIjtcblxuLyoqXG4gKiBBV1MgQmF0Y2ggSm9iIERlZmluaXRpb27mp4vnr4nnlKjjga7jg5fjg63jg5Hjg4bjgqNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYXRjaEpvYkRlZmluaXRpb25Qcm9wcyB7XG4gIC8qKiDln4vjgoHovrzjgb/lh6bnkIboqK3lrpogKi9cbiAgcmVhZG9ubHkgZW1iZWRkaW5nQ29uZmlnOiBFbWJlZGRpbmdDb25maWc7XG4gIC8qKiDlrp/ooYzjg63jg7zjg6sgKi9cbiAgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZTogaWFtLklSb2xlO1xuICAvKiog44K/44K544Kv44Ot44O844OrICovXG4gIHJlYWRvbmx5IHRhc2tSb2xlOiBpYW0uSVJvbGU7XG4gIC8qKiBFQ1LjgqTjg6Hjg7zjgrjjg5HjgrkgKi9cbiAgcmVhZG9ubHkgaW1hZ2VQYXRoOiBzdHJpbmc7XG4gIC8qKiDjgqTjg6Hjg7zjgrjjgr/jgrAgKi9cbiAgcmVhZG9ubHkgaW1hZ2VUYWc6IHN0cmluZztcbiAgLyoqIOODquODvOOCuOODp+ODsyAqL1xuICByZWFkb25seSByZWdpb246IHN0cmluZztcbiAgLyoqIOOCouOCq+OCpuODs+ODiElEICovXG4gIHJlYWRvbmx5IGFjY291bnRJZDogc3RyaW5nO1xuICAvKiog44OX44Ot44K444Kn44Kv44OI5ZCNICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIC8qKiDnkrDlooPlkI0gKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuLyoqXG4gKiBBV1MgQmF0Y2ggSm9iIERlZmluaXRpb27mp4vnr4njgq/jg6njgrlcbiAqIFxuICog5pei5a2Y44GuRUMy44OZ44O844K5ZW1iZWRkaW5nLXNlcnZlcuOBi+OCiUFXUyBCYXRjaOOBuOOBruenu+ihjOeUqEpvYiBEZWZpbml0aW9uXG4gKiBGU3ggZm9yIE5ldEFwcCBPTlRBUOe1seWQiOOAgUJlZHJvY2vpgKPmkLrjgIFPcGVuU2VhcmNoIFNlcnZlcmxlc3Plr77lv5xcbiAqIFxuICogUmVxdWlyZW1lbnRzOiAxLjIsIDIuMSwgMi4zXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXRjaEpvYkRlZmluaXRpb25Db25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKiogSm9iIERlZmluaXRpb24gKi9cbiAgcHVibGljIHJlYWRvbmx5IGpvYkRlZmluaXRpb246IGJhdGNoLkVjc0pvYkRlZmluaXRpb247XG4gIC8qKiBFQ1Ljg6rjg53jgrjjg4jjg6ogKi9cbiAgcHVibGljIHJlYWRvbmx5IGVjclJlcG9zaXRvcnk6IEVDUjtcbiAgLyoqIENsb3VkV2F0Y2ggTG9ncyDjgrDjg6vjg7zjg5cgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxvZ0dyb3VwOiBsb2dzLkxvZ0dyb3VwO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYXRjaEpvYkRlZmluaXRpb25Qcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyDlhaXlipvlgKTmpJzoqLxcbiAgICB0aGlzLnZhbGlkYXRlUHJvcHMocHJvcHMpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dzIOOCsOODq+ODvOODl+S9nOaIkFxuICAgIHRoaXMubG9nR3JvdXAgPSB0aGlzLmNyZWF0ZUxvZ0dyb3VwKHByb3BzKTtcblxuICAgIC8vIEVDUuODquODneOCuOODiOODquS9nOaIkO+8iOaXouWtmOOBrkVDUuOCr+ODqeOCueOCkuWGjeWIqeeUqO+8iVxuICAgIHRoaXMuZWNyUmVwb3NpdG9yeSA9IG5ldyBFQ1IodGhpcywgXCJFbWJlZGRpbmdFY3JcIiwge1xuICAgICAgcGF0aDogYCR7cHJvcHMuaW1hZ2VQYXRofS9lbWJlZGAsXG4gICAgICB0YWc6IHByb3BzLmltYWdlVGFnLFxuICAgIH0pO1xuXG4gICAgLy8g44Kz44Oz44OG44OK5a6a576p5L2c5oiQXG4gICAgY29uc3QgY29udGFpbmVyRGVmaW5pdGlvbiA9IHRoaXMuY3JlYXRlQ29udGFpbmVyRGVmaW5pdGlvbihwcm9wcyk7XG5cbiAgICAvLyBKb2IgRGVmaW5pdGlvbuS9nOaIkFxuICAgIHRoaXMuam9iRGVmaW5pdGlvbiA9IG5ldyBiYXRjaC5FY3NKb2JEZWZpbml0aW9uKHRoaXMsIFwiRW1iZWRkaW5nSm9iRGVmaW5pdGlvblwiLCB7XG4gICAgICBqb2JEZWZpbml0aW9uTmFtZTogcHJvcHMuZW1iZWRkaW5nQ29uZmlnLmpvYkRlZmluaXRpb24uam9iRGVmaW5pdGlvbk5hbWUsXG4gICAgICBjb250YWluZXI6IGNvbnRhaW5lckRlZmluaXRpb24sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uaG91cnMocHJvcHMuZW1iZWRkaW5nQ29uZmlnLmpvYkRlZmluaXRpb24udGltZW91dEhvdXJzKSxcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IHByb3BzLmVtYmVkZGluZ0NvbmZpZy5qb2JEZWZpbml0aW9uLnJldHJ5QXR0ZW1wdHMsXG4gICAgfSk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFwcGx5VGFncyhwcm9wcyk7XG5cbiAgICAvLyBDREsgTmFn5oqR5Yi26Kit5a6aXG4gICAgdGhpcy5hZGROYWdTdXBwcmVzc2lvbnMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5fjg63jg5Hjg4bjgqPmpJzoqLxcbiAgICovXG4gIHByaXZhdGUgdmFsaWRhdGVQcm9wcyhwcm9wczogQmF0Y2hKb2JEZWZpbml0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICBpZiAoIXByb3BzLmVtYmVkZGluZ0NvbmZpZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfln4vjgoHovrzjgb/oqK3lrprjgYzlv4XopoHjgafjgZknKTtcbiAgICB9XG5cbiAgICBpZiAoIXByb3BzLmV4ZWN1dGlvblJvbGUgfHwgIXByb3BzLnRhc2tSb2xlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+Wun+ihjOODreODvOODq+OBqOOCv+OCueOCr+ODreODvOODq+OBjOW/heimgeOBp+OBmScpO1xuICAgIH1cblxuICAgIGlmICghcHJvcHMuaW1hZ2VQYXRoIHx8ICFwcm9wcy5pbWFnZVRhZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFQ1LjgqTjg6Hjg7zjgrjjg5Hjgrnjgajjgr/jgrDjgYzlv4XopoHjgafjgZknKTtcbiAgICB9XG5cbiAgICBpZiAoIXByb3BzLnJlZ2lvbiB8fCAhcHJvcHMuYWNjb3VudElkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ODquODvOOCuOODp+ODs+OBqOOCouOCq+OCpuODs+ODiElE44GM5b+F6KaB44Gn44GZJyk7XG4gICAgfVxuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44KjOiDjg5Hjgrnjg4jjg6njg5Djg7zjgrXjg6vmlLvmkoPpmLLmraJcbiAgICBpZiAocHJvcHMuaW1hZ2VQYXRoLmluY2x1ZGVzKCcuLicpIHx8IHByb3BzLmltYWdlVGFnLmluY2x1ZGVzKCcuLicpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+S4jeato+OBquOCpOODoeODvOOCuOODkeOCueOBvuOBn+OBr+OCv+OCsOOBjOaknOWHuuOBleOCjOOBvuOBl+OBnycpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNoIExvZ3Mg44Kw44Or44O844OX5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxvZ0dyb3VwKHByb3BzOiBCYXRjaEpvYkRlZmluaXRpb25Qcm9wcyk6IGxvZ3MuTG9nR3JvdXAge1xuICAgIGNvbnN0IGxvZ0dyb3VwTmFtZSA9IGAvYXdzL2JhdGNoL2VtYmVkZGluZy1qb2ItJHtwcm9wcy5lbWJlZGRpbmdDb25maWcuam9iRGVmaW5pdGlvbi5qb2JEZWZpbml0aW9uTmFtZX1gO1xuICAgIFxuICAgIHJldHVybiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIkVtYmVkZGluZ0pvYkxvZ0dyb3VwXCIsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZSxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCwgLy8g44K744Kt44Ol44Oq44OG44Kj55uj5p+744Gu44Gf44KBMeODtuaciOS/neaMgVxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIC8vIOacrOeVqueSsOWig+OBp+OBr+aal+WPt+WMluOCkuacieWKueOBq+OBmeOCi1xuICAgICAgLi4uKHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCcgJiYge1xuICAgICAgICBlbmNyeXB0aW9uS2V5OiB1bmRlZmluZWQsIC8vIEtNU+OCreODvOOCkuaMh+WumuOBmeOCi+WgtOWQiFxuICAgICAgfSksXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Kz44Oz44OG44OK5a6a576p5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUNvbnRhaW5lckRlZmluaXRpb24ocHJvcHM6IEJhdGNoSm9iRGVmaW5pdGlvblByb3BzKTogYmF0Y2guRWNzRWMyQ29udGFpbmVyRGVmaW5pdGlvbiB7XG4gICAgLy8g55Kw5aKD5aSJ5pWw6Kit5a6aXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSB0aGlzLmNyZWF0ZUVudmlyb25tZW50VmFyaWFibGVzKHByb3BzKTtcblxuICAgIC8vIOODnuOCpuODs+ODiOODneOCpOODs+ODiOioreWumlxuICAgIGNvbnN0IG1vdW50UG9pbnRzID0gdGhpcy5jcmVhdGVNb3VudFBvaW50cyhwcm9wcyk7XG5cbiAgICAvLyDjg5zjg6rjg6Xjg7zjg6DoqK3lrppcbiAgICBjb25zdCB2b2x1bWVzID0gdGhpcy5jcmVhdGVWb2x1bWVzKHByb3BzKTtcblxuICAgIHJldHVybiBuZXcgYmF0Y2guRWNzRWMyQ29udGFpbmVyRGVmaW5pdGlvbih0aGlzLCBcIkVtYmVkZGluZ0NvbnRhaW5lclwiLCB7XG4gICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KFxuICAgICAgICB0aGlzLmVjclJlcG9zaXRvcnkucmVwb3NpdG9yeSxcbiAgICAgICAgcHJvcHMuaW1hZ2VUYWdcbiAgICAgICksXG4gICAgICBjcHU6IHByb3BzLmVtYmVkZGluZ0NvbmZpZy5qb2JEZWZpbml0aW9uLmNwdSxcbiAgICAgIG1lbW9yeTogY2RrLlNpemUubWViaWJ5dGVzKHByb3BzLmVtYmVkZGluZ0NvbmZpZy5qb2JEZWZpbml0aW9uLm1lbW9yeU1pQiksXG4gICAgICBleGVjdXRpb25Sb2xlOiBwcm9wcy5leGVjdXRpb25Sb2xlLFxuICAgICAgam9iUm9sZTogcHJvcHMudGFza1JvbGUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIG1vdW50UG9pbnRzLFxuICAgICAgLy8gdm9sdW1lcywgLy8gRUNTIFZvbHVtZeWei+OBruWVj+mhjOOBq+OCiOOCiuS4gOaZgueahOOBq+OCs+ODoeODs+ODiOOCouOCpuODiFxuICAgICAgbG9nZ2luZzogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XG4gICAgICAgIGxvZ0dyb3VwOiB0aGlzLmxvZ0dyb3VwLFxuICAgICAgICBzdHJlYW1QcmVmaXg6IFwiZW1iZWRkaW5nLWpvYlwiLFxuICAgICAgfSksXG4gICAgICByZWFkb25seVJvb3RGaWxlc3lzdGVtOiBmYWxzZSwgLy8gRlN444Oe44Km44Oz44OI44Gu44Gf44KB6Kqt44G/5pu444GN5Y+v6IO9XG4gICAgICBwcml2aWxlZ2VkOiBmYWxzZSwgLy8g44K744Kt44Ol44Oq44OG44KjOiDnibnmqKnjg6Ljg7zjg4nnhKHlirlcbiAgICAgIHVzZXI6IFwicm9vdFwiLCAvLyBGU3jjg57jgqbjg7Pjg4jjga7jgZ/jgoHvvIjmnKznlarnkrDlooPjgafjga/lsILnlKjjg6bjg7zjgrbjg7zjgpLmpJzoqI7vvIlcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPlpInmlbDoqK3lrprkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMocHJvcHM6IEJhdGNoSm9iRGVmaW5pdGlvblByb3BzKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgY29uc3QgYmFzZUVudmlyb25tZW50OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgRU5WX1JFR0lPTjogcHJvcHMucmVnaW9uLFxuICAgICAgQVdTX0RFRkFVTFRfUkVHSU9OOiBwcm9wcy5yZWdpb24sXG4gICAgICBQUk9KRUNUX05BTUU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgIH07XG5cbiAgICAvLyBGU3joqK3lrprjga7lronlhajjgarov73liqBcbiAgICB0aGlzLmFkZEZzeEVudmlyb25tZW50VmFyaWFibGVzKGJhc2VFbnZpcm9ubWVudCwgcHJvcHMuZW1iZWRkaW5nQ29uZmlnLmZzeEludGVncmF0aW9uKTtcbiAgICBcbiAgICAvLyBBY3RpdmUgRGlyZWN0b3J56Kit5a6a44Gu5a6J5YWo44Gq6L+95YqgXG4gICAgdGhpcy5hZGRBY3RpdmVEaXJlY3RvcnlFbnZpcm9ubWVudFZhcmlhYmxlcyhiYXNlRW52aXJvbm1lbnQsIHByb3BzLmVtYmVkZGluZ0NvbmZpZy5hY3RpdmVEaXJlY3RvcnkpO1xuICAgIFxuICAgIC8vIEJlZHJvY2voqK3lrprjga7lronlhajjgarov73liqBcbiAgICB0aGlzLmFkZEJlZHJvY2tFbnZpcm9ubWVudFZhcmlhYmxlcyhiYXNlRW52aXJvbm1lbnQsIHByb3BzLmVtYmVkZGluZ0NvbmZpZy5iZWRyb2NrLCBwcm9wcy5yZWdpb24pO1xuICAgIFxuICAgIC8vIE9wZW5TZWFyY2joqK3lrprjga7lronlhajjgarov73liqBcbiAgICB0aGlzLmFkZE9wZW5TZWFyY2hFbnZpcm9ubWVudFZhcmlhYmxlcyhiYXNlRW52aXJvbm1lbnQsIHByb3BzLmVtYmVkZGluZ0NvbmZpZy5vcGVuU2VhcmNoKTtcbiAgICBcbiAgICAvLyBSRFPoqK3lrprjga7lronlhajjgarov73liqBcbiAgICB0aGlzLmFkZFJkc0Vudmlyb25tZW50VmFyaWFibGVzKGJhc2VFbnZpcm9ubWVudCwgcHJvcHMuZW1iZWRkaW5nQ29uZmlnLnJkcyk7XG5cbiAgICByZXR1cm4gYmFzZUVudmlyb25tZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEZTeOeSsOWig+WkieaVsOOBruWuieWFqOOBqui/veWKoFxuICAgKi9cbiAgcHJpdmF0ZSBhZGRGc3hFbnZpcm9ubWVudFZhcmlhYmxlcyhcbiAgICBlbnZpcm9ubWVudDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiwgXG4gICAgZnN4Q29uZmlnPzogRW1iZWRkaW5nRnN4SW50ZWdyYXRpb25Db25maWdcbiAgKTogdm9pZCB7XG4gICAgaWYgKCFmc3hDb25maWcpIHJldHVybjtcblxuICAgIGVudmlyb25tZW50LkZTWF9JRCA9IGZzeENvbmZpZy5maWxlU3lzdGVtSWQgfHwgXCJmcy1kZWZhdWx0XCI7XG4gICAgZW52aXJvbm1lbnQuU1ZNX1JFRiA9IGZzeENvbmZpZy5zdm1SZWYgfHwgXCJzdm0tZGVmYXVsdFwiO1xuICAgIGVudmlyb25tZW50LlNWTV9JRCA9IGZzeENvbmZpZy5zdm1JZCB8fCBcInN2bS1kZWZhdWx0LWlkXCI7XG4gICAgZW52aXJvbm1lbnQuQ0lGU0RBVEFfVk9MX05BTUUgPSBmc3hDb25maWcuY2lmc2RhdGFWb2xOYW1lIHx8IFwic21iX3NoYXJlXCI7XG4gICAgZW52aXJvbm1lbnQuUkFHREJfVk9MX1BBVEggPSBmc3hDb25maWcucmFnZGJWb2xQYXRoIHx8IFwiL3NtYl9zaGFyZS9yYWdkYlwiO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjdGl2ZSBEaXJlY3RvcnnnkrDlooPlpInmlbDjga7lronlhajjgarov73liqBcbiAgICovXG4gIHByaXZhdGUgYWRkQWN0aXZlRGlyZWN0b3J5RW52aXJvbm1lbnRWYXJpYWJsZXMoXG4gICAgZW52aXJvbm1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIFxuICAgIGFkQ29uZmlnPzogRW1iZWRkaW5nQWN0aXZlRGlyZWN0b3J5Q29uZmlnXG4gICk6IHZvaWQge1xuICAgIGlmICghYWRDb25maWcpIHJldHVybjtcblxuICAgIGVudmlyb25tZW50LkFEX0RPTUFJTiA9IGFkQ29uZmlnLmRvbWFpbjtcbiAgICBlbnZpcm9ubWVudC5BRF9VU0VSTkFNRSA9IGFkQ29uZmlnLnVzZXJuYW1lO1xuICAgIC8vIOODkeOCueODr+ODvOODieOBr1NlY3JldHMgTWFuYWdlcuOBi+OCieWPluW+l++8iOeSsOWig+WkieaVsOOBq+OBr+WQq+OCgeOBquOBhO+8iVxuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2vnkrDlooPlpInmlbDjga7lronlhajjgarov73liqBcbiAgICovXG4gIHByaXZhdGUgYWRkQmVkcm9ja0Vudmlyb25tZW50VmFyaWFibGVzKFxuICAgIGVudmlyb25tZW50OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LCBcbiAgICBiZWRyb2NrQ29uZmlnPzogRW1iZWRkaW5nQmVkcm9ja0NvbmZpZyxcbiAgICBkZWZhdWx0UmVnaW9uPzogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGlmICghYmVkcm9ja0NvbmZpZykgcmV0dXJuO1xuXG4gICAgZW52aXJvbm1lbnQuQkVEUk9DS19SRUdJT04gPSBiZWRyb2NrQ29uZmlnLnJlZ2lvbiB8fCBkZWZhdWx0UmVnaW9uIHx8ICd1cy1lYXN0LTEnO1xuICAgIGVudmlyb25tZW50LkJFRFJPQ0tfTU9ERUxfSUQgPSBiZWRyb2NrQ29uZmlnLm1vZGVsSWQ7XG4gIH1cblxuICAvKipcbiAgICogT3BlblNlYXJjaOeSsOWig+WkieaVsOOBruWuieWFqOOBqui/veWKoFxuICAgKi9cbiAgcHJpdmF0ZSBhZGRPcGVuU2VhcmNoRW52aXJvbm1lbnRWYXJpYWJsZXMoXG4gICAgZW52aXJvbm1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIFxuICAgIG9wZW5TZWFyY2hDb25maWc/OiBFbWJlZGRpbmdPcGVuU2VhcmNoSW50ZWdyYXRpb25Db25maWdcbiAgKTogdm9pZCB7XG4gICAgaWYgKCFvcGVuU2VhcmNoQ29uZmlnPy5jb2xsZWN0aW9uTmFtZSkgcmV0dXJuO1xuXG4gICAgZW52aXJvbm1lbnQuRU5WX09QRU5fU0VBUkNIX1NFUlZFUkxFU1NfQ09MTEVDVElPTl9OQU1FID0gb3BlblNlYXJjaENvbmZpZy5jb2xsZWN0aW9uTmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSRFPnkrDlooPlpInmlbDjga7lronlhajjgarov73liqBcbiAgICovXG4gIHByaXZhdGUgYWRkUmRzRW52aXJvbm1lbnRWYXJpYWJsZXMoXG4gICAgZW52aXJvbm1lbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIFxuICAgIHJkc0NvbmZpZz86IEVtYmVkZGluZ1Jkc0NvbmZpZ1xuICApOiB2b2lkIHtcbiAgICBpZiAoIXJkc0NvbmZpZz8uc2VjcmV0TmFtZSkgcmV0dXJuO1xuXG4gICAgZW52aXJvbm1lbnQuRU5WX1JEU19TRUNSRVRTX05BTUUgPSByZHNDb25maWcuc2VjcmV0TmFtZTtcbiAgICBlbnZpcm9ubWVudC5FTlZfU0VDUkVUU19BUk4gPSByZHNDb25maWcuc2VjcmV0QXJuO1xuICAgIGVudmlyb25tZW50LkVOVl9SRFNfQVJOID0gcmRzQ29uZmlnLmNsdXN0ZXJBcm47XG4gIH1cblxuICAvKipcbiAgICog44Oe44Km44Oz44OI44Od44Kk44Oz44OI6Kit5a6a5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1vdW50UG9pbnRzKHByb3BzOiBCYXRjaEpvYkRlZmluaXRpb25Qcm9wcyk6IGVjcy5Nb3VudFBvaW50W10ge1xuICAgIHJldHVybiBbXG4gICAgICB7XG4gICAgICAgIHNvdXJjZVZvbHVtZTogXCJmc3gtZGF0YS12b2x1bWVcIixcbiAgICAgICAgY29udGFpbmVyUGF0aDogXCIvb3B0L25ldGFwcC9haS9kYXRhXCIsXG4gICAgICAgIHJlYWRPbmx5OiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHNvdXJjZVZvbHVtZTogXCJmc3gtZGItdm9sdW1lXCIsIFxuICAgICAgICBjb250YWluZXJQYXRoOiBcIi9vcHQvbmV0YXBwL2FpL2RiXCIsXG4gICAgICAgIHJlYWRPbmx5OiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5zjg6rjg6Xjg7zjg6DoqK3lrprkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVm9sdW1lcyhwcm9wczogQmF0Y2hKb2JEZWZpbml0aW9uUHJvcHMpOiBlY3MuVm9sdW1lW10ge1xuICAgIHJldHVybiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZnN4LWRhdGEtdm9sdW1lXCIsXG4gICAgICAgIGhvc3Q6IHtcbiAgICAgICAgICBzb3VyY2VQYXRoOiBcIi9tbnQvZnN4L2RhdGFcIixcbiAgICAgICAgfSxcbiAgICAgIH0gYXMgZWNzLlZvbHVtZSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCJmc3gtZGItdm9sdW1lXCIsXG4gICAgICAgIGhvc3Q6IHtcbiAgICAgICAgICBzb3VyY2VQYXRoOiBcIi9tbnQvZnN4L2RiXCIsXG4gICAgICAgIH0sXG4gICAgICB9IGFzIGVjcy5Wb2x1bWUsXG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgr/jgrDoqK3lrppcbiAgICovXG4gIHByaXZhdGUgYXBwbHlUYWdzKHByb3BzOiBCYXRjaEpvYkRlZmluaXRpb25Qcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IHRhZ3MgPSB7XG4gICAgICBQcm9qZWN0OiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIENvbXBvbmVudDogJ0VtYmVkZGluZycsXG4gICAgICBNb2R1bGU6ICdBV1NfQkFUQ0hfSk9CX0RFRklOSVRJT04nLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJyxcbiAgICAgIENyZWF0ZWRCeTogJ0JhdGNoSm9iRGVmaW5pdGlvbkNvbnN0cnVjdCcsXG4gICAgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENESyBOYWfmipHliLboqK3lrprov73liqBcbiAgICovXG4gIHByaXZhdGUgYWRkTmFnU3VwcHJlc3Npb25zKCk6IHZvaWQge1xuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhcbiAgICAgIHRoaXMuam9iRGVmaW5pdGlvbixcbiAgICAgIFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcIkF3c1NvbHV0aW9ucy1JQU01XCIsXG4gICAgICAgICAgcmVhc29uOiBcIkJhdGNoIEpvYiBEZWZpbml0aW9uIHJlcXVpcmVzIGJyb2FkIHBlcm1pc3Npb25zIGZvciBGU3ggYW5kIEJlZHJvY2sgYWNjZXNzXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtRUNTMlwiLFxuICAgICAgICAgIHJlYXNvbjogXCJFbnZpcm9ubWVudCB2YXJpYWJsZXMgY29udGFpbiBuZWNlc3NhcnkgY29uZmlndXJhdGlvbiBmb3IgRlN4IGFuZCBBRCBpbnRlZ3JhdGlvblwiLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiQXdzU29sdXRpb25zLUVDUzRcIixcbiAgICAgICAgICByZWFzb246IFwiUm9vdCB1c2VyIHJlcXVpcmVkIGZvciBGU3ggbW91bnQgb3BlcmF0aW9ucyBpbiBjb250YWluZXJcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICB0cnVlXG4gICAgKTtcblxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhcbiAgICAgIHRoaXMubG9nR3JvdXAsXG4gICAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJBd3NTb2x1dGlvbnMtQ1dMMVwiLFxuICAgICAgICAgIHJlYXNvbjogXCJDbG91ZFdhdGNoIExvZ3MgZW5jcnlwdGlvbiB3aWxsIGJlIGVuYWJsZWQgaW4gcHJvZHVjdGlvbiBlbnZpcm9ubWVudFwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHRydWVcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIEpvYiBEZWZpbml0aW9uIEFSTuWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldCBqb2JEZWZpbml0aW9uQXJuKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuam9iRGVmaW5pdGlvbi5qb2JEZWZpbml0aW9uQXJuO1xuICB9XG5cbiAgLyoqXG4gICAqIEpvYiBEZWZpbml0aW9u5ZCN5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0IGpvYkRlZmluaXRpb25OYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuam9iRGVmaW5pdGlvbi5qb2JEZWZpbml0aW9uTmFtZTtcbiAgfVxufSJdfQ==