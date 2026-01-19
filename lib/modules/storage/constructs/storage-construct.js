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
exports.StorageConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const fsx = __importStar(require("aws-cdk-lib/aws-fsx"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const constructs_1 = require("constructs");
class StorageConstruct extends constructs_1.Construct {
    fsxFileSystem;
    fsxStorageVolume;
    fsxDatabaseVolume;
    outputs;
    // S3バケット
    documentsBucket;
    backupBucket;
    embeddingsBucket;
    constructor(scope, id, props) {
        super(scope, id);
        this.props = props;
        // outputs初期化
        this.outputs = {
            s3Buckets: {}
        };
        // S3バケット作成（README.md準拠）
        this.createS3Buckets();
        // FSx for ONTAP作成
        if (this.props.config.fsx?.enabled || this.props.config.fsxOntap?.enabled) {
            this.createFSxOntapResources();
            // outputsに追加
            if (this.fsxFileSystem) {
                this.outputs.fsxFileSystemId = this.fsxFileSystem.ref;
            }
            if (this.fsxStorageVolume) {
                this.outputs.fsxDataVolumeId = this.fsxStorageVolume.ref;
            }
            if (this.fsxDatabaseVolume) {
                this.outputs.fsxDatabaseVolumeId = this.fsxDatabaseVolume.ref;
            }
        }
    }
    props;
    /**
     * S3バケット作成（オプション - FSx for ONTAPで代替可能）
     */
    createS3Buckets() {
        const projectName = this.props.projectName || 'permission-aware-rag';
        const environment = this.props.environment || 'prod';
        const s3Config = this.props.config.s3;
        // S3が未定義の場合はスキップ（FSx for ONTAPをメインストレージとして使用）
        if (!s3Config) {
            console.log('ℹ️ S3設定が未定義のため、S3バケット作成をスキップします（FSx for ONTAPをメインストレージとして使用）');
            return;
        }
        // S3が明示的に無効化されている場合はスキップ
        if (s3Config?.documents?.enabled === false &&
            s3Config?.backup?.enabled === false &&
            s3Config?.embeddings?.enabled === false) {
            console.log('ℹ️ S3バケットが無効化されているため、作成をスキップします（FSx for ONTAPをメインストレージとして使用）');
            return;
        }
        console.log('📦 S3バケット作成開始...');
        // ドキュメントバケット作成（オプション）
        if (s3Config?.documents?.enabled === true) {
            this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
                bucketName: `${projectName}-${environment}-documents`,
                encryption: s3Config?.documents?.encryption
                    ? s3.BucketEncryption.S3_MANAGED
                    : s3.BucketEncryption.UNENCRYPTED,
                versioned: s3Config?.documents?.versioning || false,
                lifecycleRules: s3Config?.lifecycle?.enabled ? [
                    {
                        transitions: [
                            {
                                storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                                transitionAfter: cdk.Duration.days(s3Config.lifecycle.transitionToIA || 30),
                            },
                            {
                                storageClass: s3.StorageClass.GLACIER,
                                transitionAfter: cdk.Duration.days(s3Config.lifecycle.transitionToGlacier || 90),
                            },
                        ],
                        expiration: cdk.Duration.days(s3Config.lifecycle.deleteAfter || 2555),
                    },
                ] : undefined,
                removalPolicy: environment === 'prod'
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
                autoDeleteObjects: environment !== 'prod',
            });
            this.outputs.s3Buckets['documents'] = this.documentsBucket;
            new cdk.CfnOutput(this, 'DocumentsBucketName', {
                value: this.documentsBucket.bucketName,
                description: 'Documents S3 Bucket Name',
                exportName: `${projectName}-${environment}-DocumentsBucketName`,
            });
            console.log(`✅ ドキュメントバケット作成: ${this.documentsBucket.bucketName}`);
        }
        // バックアップバケット作成（オプション）
        if (s3Config?.backup?.enabled === true) {
            this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
                bucketName: `${projectName}-${environment}-backup`,
                encryption: s3Config?.backup?.encryption
                    ? s3.BucketEncryption.S3_MANAGED
                    : s3.BucketEncryption.UNENCRYPTED,
                versioned: s3Config?.backup?.versioning || false,
                lifecycleRules: s3Config?.lifecycle?.enabled ? [
                    {
                        transitions: [
                            {
                                storageClass: s3.StorageClass.GLACIER,
                                transitionAfter: cdk.Duration.days(30),
                            },
                        ],
                        expiration: cdk.Duration.days(2555),
                    },
                ] : undefined,
                removalPolicy: cdk.RemovalPolicy.RETAIN, // バックアップは常に保持
                autoDeleteObjects: false,
            });
            this.outputs.s3Buckets['backup'] = this.backupBucket;
            new cdk.CfnOutput(this, 'BackupBucketName', {
                value: this.backupBucket.bucketName,
                description: 'Backup S3 Bucket Name',
                exportName: `${projectName}-${environment}-BackupBucketName`,
            });
            console.log(`✅ バックアップバケット作成: ${this.backupBucket.bucketName}`);
        }
        // 埋め込みバケット作成（オプション）
        if (s3Config?.embeddings?.enabled === true) {
            this.embeddingsBucket = new s3.Bucket(this, 'EmbeddingsBucket', {
                bucketName: `${projectName}-${environment}-embeddings`,
                encryption: s3Config?.embeddings?.encryption
                    ? s3.BucketEncryption.S3_MANAGED
                    : s3.BucketEncryption.UNENCRYPTED,
                versioned: false, // 埋め込みはバージョニング不要
                lifecycleRules: [
                    {
                        expiration: cdk.Duration.days(90), // 埋め込みは90日で削除
                    },
                ],
                removalPolicy: environment === 'prod'
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
                autoDeleteObjects: environment !== 'prod',
            });
            this.outputs.s3Buckets['embeddings'] = this.embeddingsBucket;
            new cdk.CfnOutput(this, 'EmbeddingsBucketName', {
                value: this.embeddingsBucket.bucketName,
                description: 'Embeddings S3 Bucket Name',
                exportName: `${projectName}-${environment}-EmbeddingsBucketName`,
            });
            console.log(`✅ 埋め込みバケット作成: ${this.embeddingsBucket.bucketName}`);
        }
        console.log('✅ S3バケット作成完了');
    }
    /**
     * FSx for ONTAP リソース作成（README.md準拠）
     */
    createFSxOntapResources() {
        if (!this.props.vpc || !this.props.privateSubnetIds) {
            console.warn('⚠️ VPCまたはプライベートサブネットが指定されていないため、FSx for ONTAPの作成をスキップします');
            return;
        }
        // fsx設定とfsxOntap設定の両方をチェック
        const config = this.props.config.fsx || this.props.config.fsxOntap;
        if (!config || !config.enabled) {
            console.log('ℹ️ FSx for ONTAPが無効化されているため、作成をスキップします');
            return;
        }
        console.log('🗄️ FSx for ONTAP作成開始...');
        const projectName = this.props.projectName || 'permission-aware-rag';
        const environment = this.props.environment || 'prod';
        // FSx for ONTAP サブネット数の決定
        // - SINGLE_AZ_1: 1つのサブネットのみ
        // - MULTI_AZ_1: 2つのサブネット（異なるAZ）
        const deploymentType = config.deploymentType || 'SINGLE_AZ_1';
        const requiredSubnetCount = deploymentType === 'SINGLE_AZ_1' ? 1 : 2;
        const fsxSubnetIds = this.props.privateSubnetIds.slice(0, requiredSubnetCount);
        console.log(`📍 FSx for ONTAP配置先サブネット: ${fsxSubnetIds.length}個（${deploymentType}）`);
        console.log(`   - Subnet 1: ${fsxSubnetIds[0]}`);
        if (fsxSubnetIds[1]) {
            console.log(`   - Subnet 2: ${fsxSubnetIds[1]}`);
        }
        // FSx for ONTAP ファイルシステム作成
        this.fsxFileSystem = new fsx.CfnFileSystem(this, 'FsxFileSystem', {
            fileSystemType: 'ONTAP',
            storageCapacity: config.storageCapacity,
            subnetIds: fsxSubnetIds, // ✅ 最大2つのサブネットのみ
            ontapConfiguration: {
                deploymentType: config.deploymentType || 'SINGLE_AZ_1',
                throughputCapacity: config.throughputCapacity,
                preferredSubnetId: fsxSubnetIds[0],
                automaticBackupRetentionDays: config.automaticBackupRetentionDays || 0,
                dailyAutomaticBackupStartTime: config.backup?.backupWindow,
                weeklyMaintenanceStartTime: config.backup?.maintenanceWindow,
            },
            tags: [
                { key: 'Name', value: `${projectName}-${environment}-fsx-ontap` },
                { key: 'Environment', value: environment },
                { key: 'Purpose', value: 'PermissionAwareRAG' },
            ],
        });
        console.log('✅ FSx for ONTAPファイルシステム作成完了');
        // ✅ Phase 5: SVM作成（S3 Access Pointの前提条件）
        // FSx for ONTAP S3 Access PointsはSVMとVolumeが必須
        console.log('🔧 FSx SVM作成開始...');
        const svm = new fsx.CfnStorageVirtualMachine(this, 'FsxSvm', {
            fileSystemId: this.fsxFileSystem.ref,
            name: `${projectName}-${environment}-svm`,
            rootVolumeSecurityStyle: 'UNIX', // S3 Access Point用にUNIXスタイル
            tags: [
                { key: 'Name', value: `${projectName}-${environment}-svm` },
                { key: 'Environment', value: environment },
                { key: 'Purpose', value: 'GatewaySpecsAccess' },
            ],
        });
        this.outputs.fsxSvm = svm;
        this.outputs.fsxSvmId = svm.ref;
        console.log('✅ FSx SVM作成完了');
        // ✅ Phase 5: Gateway Specs Volume作成（S3 Access Pointの前提条件）
        console.log('📦 Gateway Specs Volume作成開始...');
        const gatewayVolume = new fsx.CfnVolume(this, 'GatewaySpecsVolume', {
            name: 'gateway_specs_volume',
            volumeType: 'ONTAP',
            ontapConfiguration: {
                storageVirtualMachineId: svm.ref,
                sizeInMegabytes: '10240', // 10GB
                securityStyle: 'UNIX',
                junctionPath: '/gateway_specs',
                storageEfficiencyEnabled: 'true',
            },
            tags: [
                { key: 'Name', value: `${projectName}-${environment}-gateway-specs-volume` },
                { key: 'Environment', value: environment },
                { key: 'Purpose', value: 'GatewaySpecsStorage' },
            ],
        });
        this.outputs.fsxGatewayVolume = gatewayVolume;
        this.outputs.fsxGatewayVolumeId = gatewayVolume.ref;
        console.log('✅ Gateway Specs Volume作成完了');
        // ✅ Phase 5: S3 Access Point Attachment作成（正しいAPI使用）
        if (config.s3AccessPoint?.enabled) {
            console.log('🔗 FSx S3 Access Point Attachment作成開始...');
            const s3AccessPointName = config.s3AccessPoint.name ||
                `${projectName}-${environment}-gateway-specs-ap`;
            // S3 Access Point Attachment作成（CfnS3AccessPointAttachment使用）
            const s3AccessPoint = new fsx.CfnS3AccessPointAttachment(this, 'FsxS3AccessPoint', {
                name: s3AccessPointName,
                type: 'ONTAP',
                ontapConfiguration: {
                    volumeId: gatewayVolume.ref,
                    fileSystemIdentity: {
                        type: config.s3AccessPoint.fileSystemIdentity.type,
                        unixUser: config.s3AccessPoint.fileSystemIdentity.type === 'UNIX' ? {
                            name: config.s3AccessPoint.fileSystemIdentity.unixUser?.name || 'ec2-user',
                        } : undefined,
                        windowsUser: config.s3AccessPoint.fileSystemIdentity.type === 'WINDOWS' ? {
                            name: config.s3AccessPoint.fileSystemIdentity.windowsUser?.name || 'Administrator',
                        } : undefined,
                    },
                },
                s3AccessPoint: config.s3AccessPoint.networkConfiguration?.vpcRestricted ? {
                    vpcConfiguration: {
                        vpcId: config.s3AccessPoint.networkConfiguration.vpcId || this.props.vpc?.vpcId,
                    },
                    policy: config.s3AccessPoint.iamPolicy?.enabled ? JSON.stringify({
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Sid: 'AllowGatewayAccess',
                                Effect: 'Allow',
                                Principal: {
                                    AWS: config.s3AccessPoint.iamPolicy.allowedPrincipals || [],
                                },
                                Action: config.s3AccessPoint.iamPolicy.allowedActions || [
                                    's3:GetObject',
                                    's3:ListBucket',
                                ],
                                Resource: '*', // Access point ARN (auto-generated)
                            },
                        ],
                    }) : undefined,
                } : undefined,
            });
            // Outputs更新
            this.outputs.fsxS3AccessPoint = s3AccessPoint;
            this.outputs.fsxS3AccessPointArn = s3AccessPoint.attrS3AccessPointResourceArn;
            this.outputs.fsxS3AccessPointAlias = s3AccessPoint.attrS3AccessPointAlias;
            this.outputs.fsxS3AccessPointName = s3AccessPointName;
            // CloudFormation Outputs
            new cdk.CfnOutput(this, 'FsxS3AccessPointArn', {
                value: s3AccessPoint.attrS3AccessPointResourceArn,
                description: 'FSx for ONTAP S3 Access Point ARN',
                exportName: `${projectName}-${environment}-FsxS3AccessPointArn`,
            });
            new cdk.CfnOutput(this, 'FsxS3AccessPointAlias', {
                value: s3AccessPoint.attrS3AccessPointAlias,
                description: 'FSx for ONTAP S3 Access Point Alias',
                exportName: `${projectName}-${environment}-FsxS3AccessPointAlias`,
            });
            new cdk.CfnOutput(this, 'FsxS3AccessPointName', {
                value: s3AccessPointName,
                description: 'FSx for ONTAP S3 Access Point Name',
                exportName: `${projectName}-${environment}-FsxS3AccessPointName`,
            });
            console.log('✅ FSx S3 Access Point Attachment作成完了');
        }
        // 追加ボリューム作成（fsxOntap設定がある場合のみ）
        if (this.props.config.fsxOntap?.volumes) {
            // ストレージボリューム作成
            if (this.props.config.fsxOntap.volumes.data?.enabled) {
                this.fsxStorageVolume = new fsx.CfnVolume(this, 'StorageVolume', {
                    name: this.props.config.fsxOntap.volumes.data.name || 'data_volume',
                    volumeType: 'ONTAP',
                    ontapConfiguration: {
                        storageVirtualMachineId: svm.ref,
                        sizeInMegabytes: this.props.config.fsxOntap.volumes.data.sizeInMegabytes?.toString() || '10240',
                        securityStyle: this.props.config.fsxOntap.volumes.data.securityStyle || 'UNIX',
                        junctionPath: this.props.config.fsxOntap.volumes.data.junctionPath || '/data',
                        storageEfficiencyEnabled: this.props.config.fsxOntap.volumes.data.storageEfficiencyEnabled !== false ? 'true' : 'false',
                    },
                    tags: [
                        { key: 'Name', value: `${projectName}-${environment}-data-volume` },
                    ],
                });
                this.outputs.fsxDataVolume = this.fsxStorageVolume;
                this.outputs.fsxDataVolumeId = this.fsxStorageVolume.ref;
                console.log('✅ FSxデータボリューム作成完了');
            }
            // データベースボリューム作成
            if (this.props.config.fsxOntap.volumes.database?.enabled) {
                this.fsxDatabaseVolume = new fsx.CfnVolume(this, 'DatabaseVolume', {
                    name: this.props.config.fsxOntap.volumes.database.name || 'database_volume',
                    volumeType: 'ONTAP',
                    ontapConfiguration: {
                        storageVirtualMachineId: svm.ref,
                        sizeInMegabytes: this.props.config.fsxOntap.volumes.database.sizeInMegabytes?.toString() || '10240',
                        securityStyle: this.props.config.fsxOntap.volumes.database.securityStyle || 'UNIX',
                        junctionPath: this.props.config.fsxOntap.volumes.database.junctionPath || '/database',
                        storageEfficiencyEnabled: this.props.config.fsxOntap.volumes.database.storageEfficiencyEnabled !== false ? 'true' : 'false',
                    },
                    tags: [
                        { key: 'Name', value: `${projectName}-${environment}-database-volume` },
                    ],
                });
                this.outputs.fsxDatabaseVolume = this.fsxDatabaseVolume;
                this.outputs.fsxDatabaseVolumeId = this.fsxDatabaseVolume.ref;
                console.log('✅ FSxデータベースボリューム作成完了');
            }
        }
        // 出力値作成
        new cdk.CfnOutput(this, 'FsxFileSystemId', {
            value: this.fsxFileSystem.ref,
            description: 'FSx for ONTAP File System ID',
            exportName: `${projectName}-${environment}-FsxFileSystemId`,
        });
        new cdk.CfnOutput(this, 'FsxSvmId', {
            value: svm.ref,
            description: 'FSx for ONTAP SVM ID',
            exportName: `${projectName}-${environment}-FsxSvmId`,
        });
        new cdk.CfnOutput(this, 'FsxGatewayVolumeId', {
            value: gatewayVolume.ref,
            description: 'FSx Gateway Specs Volume ID',
            exportName: `${projectName}-${environment}-FsxGatewayVolumeId`,
        });
        if (this.fsxStorageVolume) {
            new cdk.CfnOutput(this, 'FsxStorageVolumeId', {
                value: this.fsxStorageVolume.ref,
                description: 'FSx Storage Volume ID',
                exportName: `${projectName}-${environment}-FsxStorageVolumeId`,
            });
        }
        if (this.fsxDatabaseVolume) {
            new cdk.CfnOutput(this, 'FsxDatabaseVolumeId', {
                value: this.fsxDatabaseVolume.ref,
                description: 'FSx Database Volume ID',
                exportName: `${projectName}-${environment}-FsxDatabaseVolumeId`,
            });
        }
        console.log('✅ FSx for ONTAP作成完了');
    }
}
exports.StorageConstruct = StorageConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzdG9yYWdlLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyx5REFBMkM7QUFDM0MsdURBQXlDO0FBQ3pDLDJDQUF1QztBQWlCdkMsTUFBYSxnQkFBaUIsU0FBUSxzQkFBUztJQUN0QyxhQUFhLENBQXFCO0lBQ2xDLGdCQUFnQixDQUFpQjtJQUNqQyxpQkFBaUIsQ0FBaUI7SUFDekIsT0FBTyxDQUFpQztJQUV4RCxTQUFTO0lBQ0YsZUFBZSxDQUFjO0lBQzdCLFlBQVksQ0FBYztJQUMxQixnQkFBZ0IsQ0FBYztJQUVyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRCO1FBQ3BFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFFbkIsYUFBYTtRQUNiLElBQUksQ0FBQyxPQUFPLEdBQUc7WUFDYixTQUFTLEVBQUUsRUFBRTtTQUNkLENBQUM7UUFFRix3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXZCLGtCQUFrQjtRQUNsQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxDQUFDO1lBQzFFLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBRS9CLGFBQWE7WUFDYixJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7WUFDeEQsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENB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WUFDM0IsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtnQkFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHO2dCQUNqQyxXQUFXLEVBQUUsd0JBQXdCO2dCQUNyQyxVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxzQkFBc0I7YUFDaEUsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUFwYkQsNENBb2JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGZzeCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZnN4JztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFN0b3JhZ2VDb25maWcsIFN0b3JhZ2VPdXRwdXRzIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9zdG9yYWdlLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RvcmFnZUNvbnN0cnVjdFByb3BzIHtcbiAgcmVhZG9ubHkgY29uZmlnOiBTdG9yYWdlQ29uZmlnO1xuICByZWFkb25seSB2cGM/OiBlYzIuSVZwYztcbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldElkcz86IHN0cmluZ1tdO1xuICByZWFkb25seSBwcm9qZWN0TmFtZT86IHN0cmluZztcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGttc0tleT86IGFueTtcbn1cblxuLy8gTXV0YWJsZSB2ZXJzaW9uIG9mIFN0b3JhZ2VPdXRwdXRzIGZvciBpbnRlcm5hbCB1c2VcbnR5cGUgTXV0YWJsZVN0b3JhZ2VPdXRwdXRzID0ge1xuICAtcmVhZG9ubHkgW0sgaW4ga2V5b2YgU3RvcmFnZU91dHB1dHNdOiBTdG9yYWdlT3V0cHV0c1tLXTtcbn07XG5cbmV4cG9ydCBjbGFzcyBTdG9yYWdlQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIGZzeEZpbGVTeXN0ZW0/OiBmc3guQ2ZuRmlsZVN5c3RlbTtcbiAgcHVibGljIGZzeFN0b3JhZ2VWb2x1bWU/OiBmc3guQ2ZuVm9sdW1lO1xuICBwdWJsaWMgZnN4RGF0YWJhc2VWb2x1bWU/OiBmc3guQ2ZuVm9sdW1lO1xuICBwdWJsaWMgcmVhZG9ubHkgb3V0cHV0czogUGFydGlhbDxNdXRhYmxlU3RvcmFnZU91dHB1dHM+O1xuICBcbiAgLy8gUzPjg5DjgrHjg4Pjg4hcbiAgcHVibGljIGRvY3VtZW50c0J1Y2tldD86IHMzLklCdWNrZXQ7XG4gIHB1YmxpYyBiYWNrdXBCdWNrZXQ/OiBzMy5JQnVja2V0O1xuICBwdWJsaWMgZW1iZWRkaW5nc0J1Y2tldD86IHMzLklCdWNrZXQ7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFN0b3JhZ2VDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuXG4gICAgLy8gb3V0cHV0c+WIneacn+WMllxuICAgIHRoaXMub3V0cHV0cyA9IHtcbiAgICAgIHMzQnVja2V0czoge31cbiAgICB9O1xuXG4gICAgLy8gUzPjg5DjgrHjg4Pjg4jkvZzmiJDvvIhSRUFETUUubWTmupbmi6DvvIlcbiAgICB0aGlzLmNyZWF0ZVMzQnVja2V0cygpO1xuXG4gICAgLy8gRlN4IGZvciBPTlRBUOS9nOaIkFxuICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5mc3g/LmVuYWJsZWQgfHwgdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXA/LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY3JlYXRlRlN4T250YXBSZXNvdXJjZXMoKTtcbiAgICAgIFxuICAgICAgLy8gb3V0cHV0c+OBq+i/veWKoFxuICAgICAgaWYgKHRoaXMuZnN4RmlsZVN5c3RlbSkge1xuICAgICAgICB0aGlzLm91dHB1dHMuZnN4RmlsZVN5c3RlbUlkID0gdGhpcy5mc3hGaWxlU3lzdGVtLnJlZjtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmZzeFN0b3JhZ2VWb2x1bWUpIHtcbiAgICAgICAgdGhpcy5vdXRwdXRzLmZzeERhdGFWb2x1bWVJZCA9IHRoaXMuZnN4U3RvcmFnZVZvbHVtZS5yZWY7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5mc3hEYXRhYmFzZVZvbHVtZSkge1xuICAgICAgICB0aGlzLm91dHB1dHMuZnN4RGF0YWJhc2VWb2x1bWVJZCA9IHRoaXMuZnN4RGF0YWJhc2VWb2x1bWUucmVmO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZG9ubHkgcHJvcHM6IFN0b3JhZ2VDb25zdHJ1Y3RQcm9wcztcblxuICAvKipcbiAgICogUzPjg5DjgrHjg4Pjg4jkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7MgLSBGU3ggZm9yIE9OVEFQ44Gn5Luj5pu/5Y+v6IO977yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVMzQnVja2V0cygpOiB2b2lkIHtcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHRoaXMucHJvcHMucHJvamVjdE5hbWUgfHwgJ3Blcm1pc3Npb24tYXdhcmUtcmFnJztcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHRoaXMucHJvcHMuZW52aXJvbm1lbnQgfHwgJ3Byb2QnO1xuICAgIGNvbnN0IHMzQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuczM7XG5cbiAgICAvLyBTM+OBjOacquWumue+qeOBruWgtOWQiOOBr+OCueOCreODg+ODl++8iEZTeCBmb3IgT05UQVDjgpLjg6HjgqTjg7Pjgrnjg4jjg6zjg7zjgrjjgajjgZfjgabkvb/nlKjvvIlcbiAgICBpZiAoIXMzQ29uZmlnKSB7XG4gICAgICBjb25zb2xlLmxvZygn4oS577iPIFMz6Kit5a6a44GM5pyq5a6a576p44Gu44Gf44KB44CBUzPjg5DjgrHjg4Pjg4jkvZzmiJDjgpLjgrnjgq3jg4Pjg5fjgZfjgb7jgZnvvIhGU3ggZm9yIE9OVEFQ44KS44Oh44Kk44Oz44K544OI44Os44O844K444Go44GX44Gm5L2/55So77yJJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUzPjgYzmmI7npLrnmoTjgavnhKHlirnljJbjgZXjgozjgabjgYTjgovloLTlkIjjga/jgrnjgq3jg4Pjg5dcbiAgICBpZiAoczNDb25maWc/LmRvY3VtZW50cz8uZW5hYmxlZCA9PT0gZmFsc2UgJiYgXG4gICAgICAgIHMzQ29uZmlnPy5iYWNrdXA/LmVuYWJsZWQgPT09IGZhbHNlICYmIFxuICAgICAgICBzM0NvbmZpZz8uZW1iZWRkaW5ncz8uZW5hYmxlZCA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gUzPjg5DjgrHjg4Pjg4jjgYznhKHlirnljJbjgZXjgozjgabjgYTjgovjgZ/jgoHjgIHkvZzmiJDjgpLjgrnjgq3jg4Pjg5fjgZfjgb7jgZnvvIhGU3ggZm9yIE9OVEFQ44KS44Oh44Kk44Oz44K544OI44Os44O844K444Go44GX44Gm5L2/55So77yJJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ/Cfk6YgUzPjg5DjgrHjg4Pjg4jkvZzmiJDplovlp4suLi4nKTtcblxuICAgIC8vIOODieOCreODpeODoeODs+ODiOODkOOCseODg+ODiOS9nOaIkO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChzM0NvbmZpZz8uZG9jdW1lbnRzPy5lbmFibGVkID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRvY3VtZW50c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0RvY3VtZW50c0J1Y2tldCcsIHtcbiAgICAgICAgYnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWRvY3VtZW50c2AsXG4gICAgICAgIGVuY3J5cHRpb246IHMzQ29uZmlnPy5kb2N1bWVudHM/LmVuY3J5cHRpb24gXG4gICAgICAgICAgPyBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQgXG4gICAgICAgICAgOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlVORU5DUllQVEVELFxuICAgICAgICB2ZXJzaW9uZWQ6IHMzQ29uZmlnPy5kb2N1bWVudHM/LnZlcnNpb25pbmcgfHwgZmFsc2UsXG4gICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBzM0NvbmZpZz8ubGlmZWN5Y2xlPy5lbmFibGVkID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKHMzQ29uZmlnLmxpZmVjeWNsZS50cmFuc2l0aW9uVG9JQSB8fCAzMCksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoczNDb25maWcubGlmZWN5Y2xlLnRyYW5zaXRpb25Ub0dsYWNpZXIgfHwgOTApLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKHMzQ29uZmlnLmxpZmVjeWNsZS5kZWxldGVBZnRlciB8fCAyNTU1KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdIDogdW5kZWZpbmVkLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IGVudmlyb25tZW50ICE9PSAncHJvZCcsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5vdXRwdXRzLnMzQnVja2V0cyFbJ2RvY3VtZW50cyddID0gdGhpcy5kb2N1bWVudHNCdWNrZXQ7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2N1bWVudHNCdWNrZXROYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kb2N1bWVudHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdEb2N1bWVudHMgUzMgQnVja2V0IE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRG9jdW1lbnRzQnVja2V0TmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coYOKchSDjg4njgq3jg6Xjg6Hjg7Pjg4jjg5DjgrHjg4Pjg4jkvZzmiJA6ICR7dGhpcy5kb2N1bWVudHNCdWNrZXQuYnVja2V0TmFtZX1gKTtcbiAgICB9XG5cbiAgICAvLyDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5DjgrHjg4Pjg4jkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAoczNDb25maWc/LmJhY2t1cD8uZW5hYmxlZCA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5iYWNrdXBCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdCYWNrdXBCdWNrZXQnLCB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1iYWNrdXBgLFxuICAgICAgICBlbmNyeXB0aW9uOiBzM0NvbmZpZz8uYmFja3VwPy5lbmNyeXB0aW9uIFxuICAgICAgICAgID8gczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VEIFxuICAgICAgICAgIDogczMuQnVja2V0RW5jcnlwdGlvbi5VTkVOQ1JZUFRFRCxcbiAgICAgICAgdmVyc2lvbmVkOiBzM0NvbmZpZz8uYmFja3VwPy52ZXJzaW9uaW5nIHx8IGZhbHNlLFxuICAgICAgICBsaWZlY3ljbGVSdWxlczogczNDb25maWc/LmxpZmVjeWNsZT8uZW5hYmxlZCA/IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygyNTU1KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdIDogdW5kZWZpbmVkLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sIC8vIOODkOODg+OCr+OCouODg+ODl+OBr+W4uOOBq+S/neaMgVxuICAgICAgICBhdXRvRGVsZXRlT2JqZWN0czogZmFsc2UsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5vdXRwdXRzLnMzQnVja2V0cyFbJ2JhY2t1cCddID0gdGhpcy5iYWNrdXBCdWNrZXQ7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCYWNrdXBCdWNrZXROYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iYWNrdXBCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCYWNrdXAgUzMgQnVja2V0IE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tQmFja3VwQnVja2V0TmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coYOKchSDjg5Djg4Pjgq/jgqLjg4Pjg5fjg5DjgrHjg4Pjg4jkvZzmiJA6ICR7dGhpcy5iYWNrdXBCdWNrZXQuYnVja2V0TmFtZX1gKTtcbiAgICB9XG5cbiAgICAvLyDln4vjgoHovrzjgb/jg5DjgrHjg4Pjg4jkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAoczNDb25maWc/LmVtYmVkZGluZ3M/LmVuYWJsZWQgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZW1iZWRkaW5nc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0VtYmVkZGluZ3NCdWNrZXQnLCB7XG4gICAgICAgIGJ1Y2tldE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1lbWJlZGRpbmdzYCxcbiAgICAgICAgZW5jcnlwdGlvbjogczNDb25maWc/LmVtYmVkZGluZ3M/LmVuY3J5cHRpb24gXG4gICAgICAgICAgPyBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQgXG4gICAgICAgICAgOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlVORU5DUllQVEVELFxuICAgICAgICB2ZXJzaW9uZWQ6IGZhbHNlLCAvLyDln4vjgoHovrzjgb/jga/jg5Djg7zjgrjjg6fjg4vjg7PjgrDkuI3opoFcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksIC8vIOWfi+OCgei+vOOBv+OBrzkw5pel44Gn5YmK6ZmkXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBlbnZpcm9ubWVudCAhPT0gJ3Byb2QnLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMub3V0cHV0cy5zM0J1Y2tldHMhWydlbWJlZGRpbmdzJ10gPSB0aGlzLmVtYmVkZGluZ3NCdWNrZXQ7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbWJlZGRpbmdzQnVja2V0TmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZW1iZWRkaW5nc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0VtYmVkZGluZ3MgUzMgQnVja2V0IE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRW1iZWRkaW5nc0J1Y2tldE5hbWVgLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKGDinIUg5Z+L44KB6L6844G/44OQ44Kx44OD44OI5L2c5oiQOiAke3RoaXMuZW1iZWRkaW5nc0J1Y2tldC5idWNrZXROYW1lfWApO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgUzPjg5DjgrHjg4Pjg4jkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGU3ggZm9yIE9OVEFQIOODquOCveODvOOCueS9nOaIkO+8iFJFQURNRS5tZOa6luaLoO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVGU3hPbnRhcFJlc291cmNlcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucHJvcHMudnBjIHx8ICF0aGlzLnByb3BzLnByaXZhdGVTdWJuZXRJZHMpIHtcbiAgICAgIGNvbnNvbGUud2Fybign4pqg77iPIFZQQ+OBvuOBn+OBr+ODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiOOBjOaMh+WumuOBleOCjOOBpuOBhOOBquOBhOOBn+OCgeOAgUZTeCBmb3IgT05UQVDjga7kvZzmiJDjgpLjgrnjgq3jg4Pjg5fjgZfjgb7jgZknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBmc3joqK3lrprjgahmc3hPbnRhcOioreWumuOBruS4oeaWueOCkuODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMucHJvcHMuY29uZmlnLmZzeCB8fCB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcDtcbiAgICBcbiAgICBpZiAoIWNvbmZpZyB8fCAhY29uZmlnLmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gRlN4IGZvciBPTlRBUOOBjOeEoeWKueWMluOBleOCjOOBpuOBhOOCi+OBn+OCgeOAgeS9nOaIkOOCkuOCueOCreODg+ODl+OBl+OBvuOBmScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfwn5eE77iPIEZTeCBmb3IgT05UQVDkvZzmiJDplovlp4suLi4nKTtcblxuICAgIGNvbnN0IHByb2plY3ROYW1lID0gdGhpcy5wcm9wcy5wcm9qZWN0TmFtZSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWcnO1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gdGhpcy5wcm9wcy5lbnZpcm9ubWVudCB8fCAncHJvZCc7XG5cbiAgICAvLyBGU3ggZm9yIE9OVEFQIOOCteODluODjeODg+ODiOaVsOOBruaxuuWumlxuICAgIC8vIC0gU0lOR0xFX0FaXzE6IDHjgaTjga7jgrXjg5bjg43jg4Pjg4jjga7jgb9cbiAgICAvLyAtIE1VTFRJX0FaXzE6IDLjgaTjga7jgrXjg5bjg43jg4Pjg4jvvIjnlbDjgarjgotBWu+8iVxuICAgIGNvbnN0IGRlcGxveW1lbnRUeXBlID0gY29uZmlnLmRlcGxveW1lbnRUeXBlIHx8ICdTSU5HTEVfQVpfMSc7XG4gICAgY29uc3QgcmVxdWlyZWRTdWJuZXRDb3VudCA9IGRlcGxveW1lbnRUeXBlID09PSAnU0lOR0xFX0FaXzEnID8gMSA6IDI7XG4gICAgY29uc3QgZnN4U3VibmV0SWRzID0gdGhpcy5wcm9wcy5wcml2YXRlU3VibmV0SWRzLnNsaWNlKDAsIHJlcXVpcmVkU3VibmV0Q291bnQpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGDwn5ONIEZTeCBmb3IgT05UQVDphY3nva7lhYjjgrXjg5bjg43jg4Pjg4g6ICR7ZnN4U3VibmV0SWRzLmxlbmd0aH3lgIvvvIgke2RlcGxveW1lbnRUeXBlfe+8iWApO1xuICAgIGNvbnNvbGUubG9nKGAgICAtIFN1Ym5ldCAxOiAke2ZzeFN1Ym5ldElkc1swXX1gKTtcbiAgICBpZiAoZnN4U3VibmV0SWRzWzFdKSB7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSBTdWJuZXQgMjogJHtmc3hTdWJuZXRJZHNbMV19YCk7XG4gICAgfVxuXG4gICAgLy8gRlN4IGZvciBPTlRBUCDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DkvZzmiJBcbiAgICB0aGlzLmZzeEZpbGVTeXN0ZW0gPSBuZXcgZnN4LkNmbkZpbGVTeXN0ZW0odGhpcywgJ0ZzeEZpbGVTeXN0ZW0nLCB7XG4gICAgICBmaWxlU3lzdGVtVHlwZTogJ09OVEFQJyxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogY29uZmlnLnN0b3JhZ2VDYXBhY2l0eSxcbiAgICAgIHN1Ym5ldElkczogZnN4U3VibmV0SWRzLCAvLyDinIUg5pyA5aSnMuOBpOOBruOCteODluODjeODg+ODiOOBruOBv1xuICAgICAgb250YXBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIGRlcGxveW1lbnRUeXBlOiBjb25maWcuZGVwbG95bWVudFR5cGUgfHwgJ1NJTkdMRV9BWl8xJyxcbiAgICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiBjb25maWcudGhyb3VnaHB1dENhcGFjaXR5LFxuICAgICAgICBwcmVmZXJyZWRTdWJuZXRJZDogZnN4U3VibmV0SWRzWzBdLFxuICAgICAgICBhdXRvbWF0aWNCYWNrdXBSZXRlbnRpb25EYXlzOiBjb25maWcuYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5cyB8fCAwLFxuICAgICAgICBkYWlseUF1dG9tYXRpY0JhY2t1cFN0YXJ0VGltZTogY29uZmlnLmJhY2t1cD8uYmFja3VwV2luZG93LFxuICAgICAgICB3ZWVrbHlNYWludGVuYW5jZVN0YXJ0VGltZTogY29uZmlnLmJhY2t1cD8ubWFpbnRlbmFuY2VXaW5kb3csXG4gICAgICB9LFxuICAgICAgdGFnczogW1xuICAgICAgICB7IGtleTogJ05hbWUnLCB2YWx1ZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWZzeC1vbnRhcGAgfSxcbiAgICAgICAgeyBrZXk6ICdFbnZpcm9ubWVudCcsIHZhbHVlOiBlbnZpcm9ubWVudCB9LFxuICAgICAgICB7IGtleTogJ1B1cnBvc2UnLCB2YWx1ZTogJ1Blcm1pc3Npb25Bd2FyZVJBRycgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIEZTeCBmb3IgT05UQVDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIOKchSBQaGFzZSA1OiBTVk3kvZzmiJDvvIhTMyBBY2Nlc3MgUG9pbnTjga7liY3mj5DmnaHku7bvvIlcbiAgICAvLyBGU3ggZm9yIE9OVEFQIFMzIEFjY2VzcyBQb2ludHPjga9TVk3jgahWb2x1bWXjgYzlv4XpoIhcbiAgICBjb25zb2xlLmxvZygn8J+UpyBGU3ggU1ZN5L2c5oiQ6ZaL5aeLLi4uJyk7XG4gICAgXG4gICAgY29uc3Qgc3ZtID0gbmV3IGZzeC5DZm5TdG9yYWdlVmlydHVhbE1hY2hpbmUodGhpcywgJ0ZzeFN2bScsIHtcbiAgICAgIGZpbGVTeXN0ZW1JZDogdGhpcy5mc3hGaWxlU3lzdGVtLnJlZixcbiAgICAgIG5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1zdm1gLFxuICAgICAgcm9vdFZvbHVtZVNlY3VyaXR5U3R5bGU6ICdVTklYJywgLy8gUzMgQWNjZXNzIFBvaW5055So44GrVU5JWOOCueOCv+OCpOODq1xuICAgICAgdGFnczogW1xuICAgICAgICB7IGtleTogJ05hbWUnLCB2YWx1ZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXN2bWAgfSxcbiAgICAgICAgeyBrZXk6ICdFbnZpcm9ubWVudCcsIHZhbHVlOiBlbnZpcm9ubWVudCB9LFxuICAgICAgICB7IGtleTogJ1B1cnBvc2UnLCB2YWx1ZTogJ0dhdGV3YXlTcGVjc0FjY2VzcycgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLm91dHB1dHMuZnN4U3ZtID0gc3ZtO1xuICAgIHRoaXMub3V0cHV0cy5mc3hTdm1JZCA9IHN2bS5yZWY7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIEZTeCBTVk3kvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIOKchSBQaGFzZSA1OiBHYXRld2F5IFNwZWNzIFZvbHVtZeS9nOaIkO+8iFMzIEFjY2VzcyBQb2ludOOBruWJjeaPkOadoeS7tu+8iVxuICAgIGNvbnNvbGUubG9nKCfwn5OmIEdhdGV3YXkgU3BlY3MgVm9sdW1l5L2c5oiQ6ZaL5aeLLi4uJyk7XG4gICAgXG4gICAgY29uc3QgZ2F0ZXdheVZvbHVtZSA9IG5ldyBmc3guQ2ZuVm9sdW1lKHRoaXMsICdHYXRld2F5U3BlY3NWb2x1bWUnLCB7XG4gICAgICBuYW1lOiAnZ2F0ZXdheV9zcGVjc192b2x1bWUnLFxuICAgICAgdm9sdW1lVHlwZTogJ09OVEFQJyxcbiAgICAgIG9udGFwQ29uZmlndXJhdGlvbjoge1xuICAgICAgICBzdG9yYWdlVmlydHVhbE1hY2hpbmVJZDogc3ZtLnJlZixcbiAgICAgICAgc2l6ZUluTWVnYWJ5dGVzOiAnMTAyNDAnLCAvLyAxMEdCXG4gICAgICAgIHNlY3VyaXR5U3R5bGU6ICdVTklYJyxcbiAgICAgICAganVuY3Rpb25QYXRoOiAnL2dhdGV3YXlfc3BlY3MnLFxuICAgICAgICBzdG9yYWdlRWZmaWNpZW5jeUVuYWJsZWQ6ICd0cnVlJyxcbiAgICAgIH0sXG4gICAgICB0YWdzOiBbXG4gICAgICAgIHsga2V5OiAnTmFtZScsIHZhbHVlOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZ2F0ZXdheS1zcGVjcy12b2x1bWVgIH0sXG4gICAgICAgIHsga2V5OiAnRW52aXJvbm1lbnQnLCB2YWx1ZTogZW52aXJvbm1lbnQgfSxcbiAgICAgICAgeyBrZXk6ICdQdXJwb3NlJywgdmFsdWU6ICdHYXRld2F5U3BlY3NTdG9yYWdlJyB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMub3V0cHV0cy5mc3hHYXRld2F5Vm9sdW1lID0gZ2F0ZXdheVZvbHVtZTtcbiAgICB0aGlzLm91dHB1dHMuZnN4R2F0ZXdheVZvbHVtZUlkID0gZ2F0ZXdheVZvbHVtZS5yZWY7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIEdhdGV3YXkgU3BlY3MgVm9sdW1l5L2c5oiQ5a6M5LqGJyk7XG5cbiAgICAvLyDinIUgUGhhc2UgNTogUzMgQWNjZXNzIFBvaW50IEF0dGFjaG1lbnTkvZzmiJDvvIjmraPjgZfjgYRBUEnkvb/nlKjvvIlcbiAgICBpZiAoY29uZmlnLnMzQWNjZXNzUG9pbnQ/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SXIEZTeCBTMyBBY2Nlc3MgUG9pbnQgQXR0YWNobWVudOS9nOaIkOmWi+Wniy4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCBzM0FjY2Vzc1BvaW50TmFtZSA9IGNvbmZpZy5zM0FjY2Vzc1BvaW50Lm5hbWUgfHwgXG4gICAgICAgIGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1nYXRld2F5LXNwZWNzLWFwYDtcbiAgICAgIFxuICAgICAgLy8gUzMgQWNjZXNzIFBvaW50IEF0dGFjaG1lbnTkvZzmiJDvvIhDZm5TM0FjY2Vzc1BvaW50QXR0YWNobWVudOS9v+eUqO+8iVxuICAgICAgY29uc3QgczNBY2Nlc3NQb2ludCA9IG5ldyBmc3guQ2ZuUzNBY2Nlc3NQb2ludEF0dGFjaG1lbnQodGhpcywgJ0ZzeFMzQWNjZXNzUG9pbnQnLCB7XG4gICAgICAgIG5hbWU6IHMzQWNjZXNzUG9pbnROYW1lLFxuICAgICAgICB0eXBlOiAnT05UQVAnLFxuICAgICAgICBvbnRhcENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICB2b2x1bWVJZDogZ2F0ZXdheVZvbHVtZS5yZWYsXG4gICAgICAgICAgZmlsZVN5c3RlbUlkZW50aXR5OiB7XG4gICAgICAgICAgICB0eXBlOiBjb25maWcuczNBY2Nlc3NQb2ludC5maWxlU3lzdGVtSWRlbnRpdHkudHlwZSxcbiAgICAgICAgICAgIHVuaXhVc2VyOiBjb25maWcuczNBY2Nlc3NQb2ludC5maWxlU3lzdGVtSWRlbnRpdHkudHlwZSA9PT0gJ1VOSVgnID8ge1xuICAgICAgICAgICAgICBuYW1lOiBjb25maWcuczNBY2Nlc3NQb2ludC5maWxlU3lzdGVtSWRlbnRpdHkudW5peFVzZXI/Lm5hbWUgfHwgJ2VjMi11c2VyJyxcbiAgICAgICAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgICB3aW5kb3dzVXNlcjogY29uZmlnLnMzQWNjZXNzUG9pbnQuZmlsZVN5c3RlbUlkZW50aXR5LnR5cGUgPT09ICdXSU5ET1dTJyA/IHtcbiAgICAgICAgICAgICAgbmFtZTogY29uZmlnLnMzQWNjZXNzUG9pbnQuZmlsZVN5c3RlbUlkZW50aXR5LndpbmRvd3NVc2VyPy5uYW1lIHx8ICdBZG1pbmlzdHJhdG9yJyxcbiAgICAgICAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgczNBY2Nlc3NQb2ludDogY29uZmlnLnMzQWNjZXNzUG9pbnQubmV0d29ya0NvbmZpZ3VyYXRpb24/LnZwY1Jlc3RyaWN0ZWQgPyB7XG4gICAgICAgICAgdnBjQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgdnBjSWQ6IGNvbmZpZy5zM0FjY2Vzc1BvaW50Lm5ldHdvcmtDb25maWd1cmF0aW9uLnZwY0lkIHx8IHRoaXMucHJvcHMudnBjPy52cGNJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBvbGljeTogY29uZmlnLnMzQWNjZXNzUG9pbnQuaWFtUG9saWN5Py5lbmFibGVkID8gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgVmVyc2lvbjogJzIwMTItMTAtMTcnLFxuICAgICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBTaWQ6ICdBbGxvd0dhdGV3YXlBY2Nlc3MnLFxuICAgICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgICBQcmluY2lwYWw6IHtcbiAgICAgICAgICAgICAgICAgIEFXUzogY29uZmlnLnMzQWNjZXNzUG9pbnQuaWFtUG9saWN5LmFsbG93ZWRQcmluY2lwYWxzIHx8IFtdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgQWN0aW9uOiBjb25maWcuczNBY2Nlc3NQb2ludC5pYW1Qb2xpY3kuYWxsb3dlZEFjdGlvbnMgfHwgW1xuICAgICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgICAnczM6TGlzdEJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBSZXNvdXJjZTogJyonLCAvLyBBY2Nlc3MgcG9pbnQgQVJOIChhdXRvLWdlbmVyYXRlZClcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSkgOiB1bmRlZmluZWQsXG4gICAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgICB9KTtcblxuICAgICAgLy8gT3V0cHV0c+abtOaWsFxuICAgICAgdGhpcy5vdXRwdXRzLmZzeFMzQWNjZXNzUG9pbnQgPSBzM0FjY2Vzc1BvaW50O1xuICAgICAgdGhpcy5vdXRwdXRzLmZzeFMzQWNjZXNzUG9pbnRBcm4gPSBzM0FjY2Vzc1BvaW50LmF0dHJTM0FjY2Vzc1BvaW50UmVzb3VyY2VBcm47XG4gICAgICB0aGlzLm91dHB1dHMuZnN4UzNBY2Nlc3NQb2ludEFsaWFzID0gczNBY2Nlc3NQb2ludC5hdHRyUzNBY2Nlc3NQb2ludEFsaWFzO1xuICAgICAgdGhpcy5vdXRwdXRzLmZzeFMzQWNjZXNzUG9pbnROYW1lID0gczNBY2Nlc3NQb2ludE5hbWU7XG5cbiAgICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHNcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hTM0FjY2Vzc1BvaW50QXJuJywge1xuICAgICAgICB2YWx1ZTogczNBY2Nlc3NQb2ludC5hdHRyUzNBY2Nlc3NQb2ludFJlc291cmNlQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW50IEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1Gc3hTM0FjY2Vzc1BvaW50QXJuYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnN4UzNBY2Nlc3NQb2ludEFsaWFzJywge1xuICAgICAgICB2YWx1ZTogczNBY2Nlc3NQb2ludC5hdHRyUzNBY2Nlc3NQb2ludEFsaWFzLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBmb3IgT05UQVAgUzMgQWNjZXNzIFBvaW50IEFsaWFzJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUZzeFMzQWNjZXNzUG9pbnRBbGlhc2AsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeFMzQWNjZXNzUG9pbnROYW1lJywge1xuICAgICAgICB2YWx1ZTogczNBY2Nlc3NQb2ludE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBPTlRBUCBTMyBBY2Nlc3MgUG9pbnQgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1Gc3hTM0FjY2Vzc1BvaW50TmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coJ+KchSBGU3ggUzMgQWNjZXNzIFBvaW50IEF0dGFjaG1lbnTkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyDov73liqDjg5zjg6rjg6Xjg7zjg6DkvZzmiJDvvIhmc3hPbnRhcOioreWumuOBjOOBguOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcD8udm9sdW1lcykge1xuICAgICAgLy8g44K544OI44Os44O844K444Oc44Oq44Ol44O844Og5L2c5oiQXG4gICAgICBpZiAodGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhPy5lbmFibGVkKSB7XG4gICAgICAgIHRoaXMuZnN4U3RvcmFnZVZvbHVtZSA9IG5ldyBmc3guQ2ZuVm9sdW1lKHRoaXMsICdTdG9yYWdlVm9sdW1lJywge1xuICAgICAgICAgIG5hbWU6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YS5uYW1lIHx8ICdkYXRhX3ZvbHVtZScsXG4gICAgICAgICAgdm9sdW1lVHlwZTogJ09OVEFQJyxcbiAgICAgICAgICBvbnRhcENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgIHN0b3JhZ2VWaXJ0dWFsTWFjaGluZUlkOiBzdm0ucmVmLFxuICAgICAgICAgICAgc2l6ZUluTWVnYWJ5dGVzOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGEuc2l6ZUluTWVnYWJ5dGVzPy50b1N0cmluZygpIHx8ICcxMDI0MCcsXG4gICAgICAgICAgICBzZWN1cml0eVN0eWxlOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGEuc2VjdXJpdHlTdHlsZSB8fCAnVU5JWCcsXG4gICAgICAgICAgICBqdW5jdGlvblBhdGg6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YS5qdW5jdGlvblBhdGggfHwgJy9kYXRhJyxcbiAgICAgICAgICAgIHN0b3JhZ2VFZmZpY2llbmN5RW5hYmxlZDogdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhLnN0b3JhZ2VFZmZpY2llbmN5RW5hYmxlZCAhPT0gZmFsc2UgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdGFnczogW1xuICAgICAgICAgICAgeyBrZXk6ICdOYW1lJywgdmFsdWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYXRhLXZvbHVtZWAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm91dHB1dHMuZnN4RGF0YVZvbHVtZSA9IHRoaXMuZnN4U3RvcmFnZVZvbHVtZTtcbiAgICAgICAgdGhpcy5vdXRwdXRzLmZzeERhdGFWb2x1bWVJZCA9IHRoaXMuZnN4U3RvcmFnZVZvbHVtZS5yZWY7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBGU3jjg4fjg7zjgr/jg5zjg6rjg6Xjg7zjg6DkvZzmiJDlrozkuoYnKTtcbiAgICAgIH1cblxuICAgICAgLy8g44OH44O844K/44OZ44O844K544Oc44Oq44Ol44O844Og5L2c5oiQXG4gICAgICBpZiAodGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhYmFzZT8uZW5hYmxlZCkge1xuICAgICAgICB0aGlzLmZzeERhdGFiYXNlVm9sdW1lID0gbmV3IGZzeC5DZm5Wb2x1bWUodGhpcywgJ0RhdGFiYXNlVm9sdW1lJywge1xuICAgICAgICAgIG5hbWU6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YWJhc2UubmFtZSB8fCAnZGF0YWJhc2Vfdm9sdW1lJyxcbiAgICAgICAgICB2b2x1bWVUeXBlOiAnT05UQVAnLFxuICAgICAgICAgIG9udGFwQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgc3RvcmFnZVZpcnR1YWxNYWNoaW5lSWQ6IHN2bS5yZWYsXG4gICAgICAgICAgICBzaXplSW5NZWdhYnl0ZXM6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YWJhc2Uuc2l6ZUluTWVnYWJ5dGVzPy50b1N0cmluZygpIHx8ICcxMDI0MCcsXG4gICAgICAgICAgICBzZWN1cml0eVN0eWxlOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGFiYXNlLnNlY3VyaXR5U3R5bGUgfHwgJ1VOSVgnLFxuICAgICAgICAgICAganVuY3Rpb25QYXRoOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGFiYXNlLmp1bmN0aW9uUGF0aCB8fCAnL2RhdGFiYXNlJyxcbiAgICAgICAgICAgIHN0b3JhZ2VFZmZpY2llbmN5RW5hYmxlZDogdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhYmFzZS5zdG9yYWdlRWZmaWNpZW5jeUVuYWJsZWQgIT09IGZhbHNlID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhZ3M6IFtcbiAgICAgICAgICAgIHsga2V5OiAnTmFtZScsIHZhbHVlOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGF0YWJhc2Utdm9sdW1lYCB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMub3V0cHV0cy5mc3hEYXRhYmFzZVZvbHVtZSA9IHRoaXMuZnN4RGF0YWJhc2VWb2x1bWU7XG4gICAgICAgIHRoaXMub3V0cHV0cy5mc3hEYXRhYmFzZVZvbHVtZUlkID0gdGhpcy5mc3hEYXRhYmFzZVZvbHVtZS5yZWY7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBGU3jjg4fjg7zjgr/jg5njg7zjgrnjg5zjg6rjg6Xjg7zjg6DkvZzmiJDlrozkuoYnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDlh7rlipvlgKTkvZzmiJBcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnN4RmlsZVN5c3RlbUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuZnN4RmlsZVN5c3RlbS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBmb3IgT05UQVAgRmlsZSBTeXN0ZW0gSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUZzeEZpbGVTeXN0ZW1JZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnN4U3ZtSWQnLCB7XG4gICAgICB2YWx1ZTogc3ZtLnJlZixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IGZvciBPTlRBUCBTVk0gSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUZzeFN2bUlkYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hHYXRld2F5Vm9sdW1lSWQnLCB7XG4gICAgICB2YWx1ZTogZ2F0ZXdheVZvbHVtZS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBHYXRld2F5IFNwZWNzIFZvbHVtZSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRnN4R2F0ZXdheVZvbHVtZUlkYCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmZzeFN0b3JhZ2VWb2x1bWUpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hTdG9yYWdlVm9sdW1lSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmZzeFN0b3JhZ2VWb2x1bWUucmVmLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBTdG9yYWdlIFZvbHVtZSBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1Gc3hTdG9yYWdlVm9sdW1lSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZnN4RGF0YWJhc2VWb2x1bWUpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hEYXRhYmFzZVZvbHVtZUlkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5mc3hEYXRhYmFzZVZvbHVtZS5yZWYsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IERhdGFiYXNlIFZvbHVtZSBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1Gc3hEYXRhYmFzZVZvbHVtZUlkYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgRlN4IGZvciBPTlRBUOS9nOaIkOWujOS6hicpO1xuICB9XG59XG4iXX0=