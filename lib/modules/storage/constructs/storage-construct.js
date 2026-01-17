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
                this.outputs.fsxStorageVolumeId = this.fsxStorageVolume.ref;
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
        const projectName = this.props.environment || 'prod';
        const environment = this.props.environment || 'prod';
        // FSx for ONTAP ファイルシステム作成
        this.fsxFileSystem = new fsx.CfnFileSystem(this, 'FsxFileSystem', {
            fileSystemType: 'ONTAP',
            storageCapacity: config.storageCapacity,
            subnetIds: this.props.privateSubnetIds,
            ontapConfiguration: {
                deploymentType: config.deploymentType || 'SINGLE_AZ_1',
                throughputCapacity: config.throughputCapacity,
                preferredSubnetId: this.props.privateSubnetIds[0],
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
        // SVM作成（fsxOntap設定がある場合のみ）
        if (this.props.config.fsxOntap?.volumes) {
            const svm = new fsx.CfnStorageVirtualMachine(this, 'FsxSvm', {
                fileSystemId: this.fsxFileSystem.ref,
                name: `${projectName}-${environment}-svm`,
                tags: [
                    { key: 'Name', value: `${projectName}-${environment}-svm` },
                ],
            });
            console.log('✅ FSx SVM作成完了');
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
                console.log('✅ FSxデータベースボリューム作成完了');
            }
        }
        // 出力値作成
        new cdk.CfnOutput(this, 'FsxFileSystemId', {
            value: this.fsxFileSystem.ref,
            description: 'FSx for ONTAP File System ID',
            exportName: `${projectName}-${environment}-FsxFileSystemId`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzdG9yYWdlLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyx5REFBMkM7QUFDM0MsdURBQXlDO0FBQ3pDLDJDQUF1QztBQW1CdkMsTUFBYSxnQkFBaUIsU0FBUSxzQkFBUztJQUN0QyxhQUFhLENBQXFCO0lBQ2xDLGdCQUFnQixDQUFpQjtJQUNqQyxpQkFBaUIsQ0FBaUI7SUFDekIsT0FBTyxDQUFpQjtJQUV4QyxTQUFTO0lBQ0YsZUFBZSxDQUFjO0lBQzdCLFlBQVksQ0FBYztJQUMxQixnQkFBZ0IsQ0FBYztJQUVyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRCO1FBQ3BFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFFbkIsYUFBYTtRQUNiLElBQUksQ0FBQyxPQUFPLEdBQUc7WUFDYixTQUFTLEVBQUUsRUFBRTtTQUNkLENBQUM7UUFFRix3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXZCLGtCQUFrQjtRQUNsQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxDQUFDO1lBQzFFLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBRS9CLGFBQWE7WUFDYixJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7WUFDeEQsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENB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L0QsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDM0IsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtnQkFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHO2dCQUNqQyxXQUFXLEVBQUUsd0JBQXdCO2dCQUNyQyxVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxzQkFBc0I7YUFDaEUsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUFqU0QsNENBaVNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGZzeCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZnN4JztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFN0b3JhZ2VDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL3N0b3JhZ2UtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBTdG9yYWdlQ29uc3RydWN0UHJvcHMge1xuICByZWFkb25seSBjb25maWc6IFN0b3JhZ2VDb25maWc7XG4gIHJlYWRvbmx5IHZwYz86IGVjMi5JVnBjO1xuICByZWFkb25seSBwcml2YXRlU3VibmV0SWRzPzogc3RyaW5nW107XG4gIHJlYWRvbmx5IHByb2plY3ROYW1lPzogc3RyaW5nO1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgcmVhZG9ubHkga21zS2V5PzogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0b3JhZ2VPdXRwdXRzIHtcbiAgczNCdWNrZXRzPzogeyBba2V5OiBzdHJpbmddOiBzMy5JQnVja2V0IH07XG4gIGZzeEZpbGVTeXN0ZW1JZD86IHN0cmluZztcbiAgZnN4U3RvcmFnZVZvbHVtZUlkPzogc3RyaW5nO1xuICBmc3hEYXRhYmFzZVZvbHVtZUlkPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU3RvcmFnZUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyBmc3hGaWxlU3lzdGVtPzogZnN4LkNmbkZpbGVTeXN0ZW07XG4gIHB1YmxpYyBmc3hTdG9yYWdlVm9sdW1lPzogZnN4LkNmblZvbHVtZTtcbiAgcHVibGljIGZzeERhdGFiYXNlVm9sdW1lPzogZnN4LkNmblZvbHVtZTtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IFN0b3JhZ2VPdXRwdXRzO1xuICBcbiAgLy8gUzPjg5DjgrHjg4Pjg4hcbiAgcHVibGljIGRvY3VtZW50c0J1Y2tldD86IHMzLklCdWNrZXQ7XG4gIHB1YmxpYyBiYWNrdXBCdWNrZXQ/OiBzMy5JQnVja2V0O1xuICBwdWJsaWMgZW1iZWRkaW5nc0J1Y2tldD86IHMzLklCdWNrZXQ7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFN0b3JhZ2VDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG4gICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuXG4gICAgLy8gb3V0cHV0c+WIneacn+WMllxuICAgIHRoaXMub3V0cHV0cyA9IHtcbiAgICAgIHMzQnVja2V0czoge31cbiAgICB9O1xuXG4gICAgLy8gUzPjg5DjgrHjg4Pjg4jkvZzmiJDvvIhSRUFETUUubWTmupbmi6DvvIlcbiAgICB0aGlzLmNyZWF0ZVMzQnVja2V0cygpO1xuXG4gICAgLy8gRlN4IGZvciBPTlRBUOS9nOaIkFxuICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5mc3g/LmVuYWJsZWQgfHwgdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXA/LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY3JlYXRlRlN4T250YXBSZXNvdXJjZXMoKTtcbiAgICAgIFxuICAgICAgLy8gb3V0cHV0c+OBq+i/veWKoFxuICAgICAgaWYgKHRoaXMuZnN4RmlsZVN5c3RlbSkge1xuICAgICAgICB0aGlzLm91dHB1dHMuZnN4RmlsZVN5c3RlbUlkID0gdGhpcy5mc3hGaWxlU3lzdGVtLnJlZjtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmZzeFN0b3JhZ2VWb2x1bWUpIHtcbiAgICAgICAgdGhpcy5vdXRwdXRzLmZzeFN0b3JhZ2VWb2x1bWVJZCA9IHRoaXMuZnN4U3RvcmFnZVZvbHVtZS5yZWY7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5mc3hEYXRhYmFzZVZvbHVtZSkge1xuICAgICAgICB0aGlzLm91dHB1dHMuZnN4RGF0YWJhc2VWb2x1bWVJZCA9IHRoaXMuZnN4RGF0YWJhc2VWb2x1bWUucmVmO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZG9ubHkgcHJvcHM6IFN0b3JhZ2VDb25zdHJ1Y3RQcm9wcztcblxuICAvKipcbiAgICogUzPjg5DjgrHjg4Pjg4jkvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7MgLSBGU3ggZm9yIE9OVEFQ44Gn5Luj5pu/5Y+v6IO977yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVMzQnVja2V0cygpOiB2b2lkIHtcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHRoaXMucHJvcHMucHJvamVjdE5hbWUgfHwgJ3Blcm1pc3Npb24tYXdhcmUtcmFnJztcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHRoaXMucHJvcHMuZW52aXJvbm1lbnQgfHwgJ3Byb2QnO1xuICAgIGNvbnN0IHMzQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuczM7XG5cbiAgICAvLyBTM+OBjOaYjuekuueahOOBq+eEoeWKueWMluOBleOCjOOBpuOBhOOCi+WgtOWQiOOBr+OCueOCreODg+ODl1xuICAgIGlmIChzM0NvbmZpZz8uZG9jdW1lbnRzPy5lbmFibGVkID09PSBmYWxzZSAmJiBcbiAgICAgICAgczNDb25maWc/LmJhY2t1cD8uZW5hYmxlZCA9PT0gZmFsc2UgJiYgXG4gICAgICAgIHMzQ29uZmlnPy5lbWJlZGRpbmdzPy5lbmFibGVkID09PSBmYWxzZSkge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyBTM+ODkOOCseODg+ODiOOBjOeEoeWKueWMluOBleOCjOOBpuOBhOOCi+OBn+OCgeOAgeS9nOaIkOOCkuOCueOCreODg+ODl+OBl+OBvuOBme+8iEZTeCBmb3IgT05UQVDjgpLjg6HjgqTjg7Pjgrnjg4jjg6zjg7zjgrjjgajjgZfjgabkvb/nlKjvvIknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn8J+TpiBTM+ODkOOCseODg+ODiOS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgLy8g44OJ44Kt44Ol44Oh44Oz44OI44OQ44Kx44OD44OI5L2c5oiQ77yI44Kq44OX44K344On44Oz77yJXG4gICAgaWYgKHMzQ29uZmlnPy5kb2N1bWVudHM/LmVuYWJsZWQgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZG9jdW1lbnRzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRG9jdW1lbnRzQnVja2V0Jywge1xuICAgICAgICBidWNrZXROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZG9jdW1lbnRzYCxcbiAgICAgICAgZW5jcnlwdGlvbjogczNDb25maWc/LmRvY3VtZW50cz8uZW5jcnlwdGlvbiBcbiAgICAgICAgICA/IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCBcbiAgICAgICAgICA6IHMzLkJ1Y2tldEVuY3J5cHRpb24uVU5FTkNSWVBURUQsXG4gICAgICAgIHZlcnNpb25lZDogczNDb25maWc/LmRvY3VtZW50cz8udmVyc2lvbmluZyB8fCBmYWxzZSxcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IHMzQ29uZmlnPy5saWZlY3ljbGU/LmVuYWJsZWQgPyBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLklORlJFUVVFTlRfQUNDRVNTLFxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoczNDb25maWcubGlmZWN5Y2xlLnRyYW5zaXRpb25Ub0lBIHx8IDMwKSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyhzM0NvbmZpZy5saWZlY3ljbGUudHJhbnNpdGlvblRvR2xhY2llciB8fCA5MCksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoczNDb25maWcubGlmZWN5Y2xlLmRlbGV0ZUFmdGVyIHx8IDI1NTUpLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0gOiB1bmRlZmluZWQsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICBhdXRvRGVsZXRlT2JqZWN0czogZW52aXJvbm1lbnQgIT09ICdwcm9kJyxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm91dHB1dHMuczNCdWNrZXRzIVsnZG9jdW1lbnRzJ10gPSB0aGlzLmRvY3VtZW50c0J1Y2tldDtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RvY3VtZW50c0J1Y2tldE5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRvY3VtZW50c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0RvY3VtZW50cyBTMyBCdWNrZXQgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1Eb2N1bWVudHNCdWNrZXROYW1lYCxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIOODieOCreODpeODoeODs+ODiOODkOOCseODg+ODiOS9nOaIkDogJHt0aGlzLmRvY3VtZW50c0J1Y2tldC5idWNrZXROYW1lfWApO1xuICAgIH1cblxuICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ODkOOCseODg+ODiOS9nOaIkO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChzM0NvbmZpZz8uYmFja3VwPy5lbmFibGVkID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmJhY2t1cEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0JhY2t1cEJ1Y2tldCcsIHtcbiAgICAgICAgYnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWJhY2t1cGAsXG4gICAgICAgIGVuY3J5cHRpb246IHMzQ29uZmlnPy5iYWNrdXA/LmVuY3J5cHRpb24gXG4gICAgICAgICAgPyBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQgXG4gICAgICAgICAgOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlVORU5DUllQVEVELFxuICAgICAgICB2ZXJzaW9uZWQ6IHMzQ29uZmlnPy5iYWNrdXA/LnZlcnNpb25pbmcgfHwgZmFsc2UsXG4gICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBzM0NvbmZpZz8ubGlmZWN5Y2xlPy5lbmFibGVkID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDI1NTUpLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0gOiB1bmRlZmluZWQsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiwgLy8g44OQ44OD44Kv44Ki44OD44OX44Gv5bi444Gr5L+d5oyBXG4gICAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm91dHB1dHMuczNCdWNrZXRzIVsnYmFja3VwJ10gPSB0aGlzLmJhY2t1cEJ1Y2tldDtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JhY2t1cEJ1Y2tldE5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJhY2t1cEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JhY2t1cCBTMyBCdWNrZXQgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1CYWNrdXBCdWNrZXROYW1lYCxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIOODkOODg+OCr+OCouODg+ODl+ODkOOCseODg+ODiOS9nOaIkDogJHt0aGlzLmJhY2t1cEJ1Y2tldC5idWNrZXROYW1lfWApO1xuICAgIH1cblxuICAgIC8vIOWfi+OCgei+vOOBv+ODkOOCseODg+ODiOS9nOaIkO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChzM0NvbmZpZz8uZW1iZWRkaW5ncz8uZW5hYmxlZCA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5lbWJlZGRpbmdzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRW1iZWRkaW5nc0J1Y2tldCcsIHtcbiAgICAgICAgYnVja2V0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWVtYmVkZGluZ3NgLFxuICAgICAgICBlbmNyeXB0aW9uOiBzM0NvbmZpZz8uZW1iZWRkaW5ncz8uZW5jcnlwdGlvbiBcbiAgICAgICAgICA/IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCBcbiAgICAgICAgICA6IHMzLkJ1Y2tldEVuY3J5cHRpb24uVU5FTkNSWVBURUQsXG4gICAgICAgIHZlcnNpb25lZDogZmFsc2UsIC8vIOWfi+OCgei+vOOBv+OBr+ODkOODvOOCuOODp+ODi+ODs+OCsOS4jeimgVxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDkwKSwgLy8g5Z+L44KB6L6844G/44GvOTDml6XjgafliYrpmaRcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IGVudmlyb25tZW50ICE9PSAncHJvZCcsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5vdXRwdXRzLnMzQnVja2V0cyFbJ2VtYmVkZGluZ3MnXSA9IHRoaXMuZW1iZWRkaW5nc0J1Y2tldDtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VtYmVkZGluZ3NCdWNrZXROYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5lbWJlZGRpbmdzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRW1iZWRkaW5ncyBTMyBCdWNrZXQgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1FbWJlZGRpbmdzQnVja2V0TmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coYOKchSDln4vjgoHovrzjgb/jg5DjgrHjg4Pjg4jkvZzmiJA6ICR7dGhpcy5lbWJlZGRpbmdzQnVja2V0LmJ1Y2tldE5hbWV9YCk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBTM+ODkOOCseODg+ODiOS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZTeCBmb3IgT05UQVAg44Oq44K944O844K55L2c5oiQ77yIUkVBRE1FLm1k5rqW5oug77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUZTeE9udGFwUmVzb3VyY2VzKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5wcm9wcy52cGMgfHwgIXRoaXMucHJvcHMucHJpdmF0ZVN1Ym5ldElkcykge1xuICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gVlBD44G+44Gf44Gv44OX44Op44Kk44OZ44O844OI44K144OW44ON44OD44OI44GM5oyH5a6a44GV44KM44Gm44GE44Gq44GE44Gf44KB44CBRlN4IGZvciBPTlRBUOOBruS9nOaIkOOCkuOCueOCreODg+ODl+OBl+OBvuOBmScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGZzeOioreWumuOBqGZzeE9udGFw6Kit5a6a44Gu5Lih5pa544KS44OB44Kn44OD44KvXG4gICAgY29uc3QgY29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuZnN4IHx8IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwO1xuICAgIFxuICAgIGlmICghY29uZmlnIHx8ICFjb25maWcuZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyBGU3ggZm9yIE9OVEFQ44GM54Sh5Yq55YyW44GV44KM44Gm44GE44KL44Gf44KB44CB5L2c5oiQ44KS44K544Kt44OD44OX44GX44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ/Cfl4TvuI8gRlN4IGZvciBPTlRBUOS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSB0aGlzLnByb3BzLmVudmlyb25tZW50IHx8ICdwcm9kJztcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHRoaXMucHJvcHMuZW52aXJvbm1lbnQgfHwgJ3Byb2QnO1xuXG4gICAgLy8gRlN4IGZvciBPTlRBUCDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DkvZzmiJBcbiAgICB0aGlzLmZzeEZpbGVTeXN0ZW0gPSBuZXcgZnN4LkNmbkZpbGVTeXN0ZW0odGhpcywgJ0ZzeEZpbGVTeXN0ZW0nLCB7XG4gICAgICBmaWxlU3lzdGVtVHlwZTogJ09OVEFQJyxcbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogY29uZmlnLnN0b3JhZ2VDYXBhY2l0eSxcbiAgICAgIHN1Ym5ldElkczogdGhpcy5wcm9wcy5wcml2YXRlU3VibmV0SWRzLFxuICAgICAgb250YXBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIGRlcGxveW1lbnRUeXBlOiBjb25maWcuZGVwbG95bWVudFR5cGUgfHwgJ1NJTkdMRV9BWl8xJyxcbiAgICAgICAgdGhyb3VnaHB1dENhcGFjaXR5OiBjb25maWcudGhyb3VnaHB1dENhcGFjaXR5LFxuICAgICAgICBwcmVmZXJyZWRTdWJuZXRJZDogdGhpcy5wcm9wcy5wcml2YXRlU3VibmV0SWRzWzBdLFxuICAgICAgICBhdXRvbWF0aWNCYWNrdXBSZXRlbnRpb25EYXlzOiBjb25maWcuYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5cyB8fCAwLFxuICAgICAgICBkYWlseUF1dG9tYXRpY0JhY2t1cFN0YXJ0VGltZTogY29uZmlnLmJhY2t1cD8uYmFja3VwV2luZG93LFxuICAgICAgICB3ZWVrbHlNYWludGVuYW5jZVN0YXJ0VGltZTogY29uZmlnLmJhY2t1cD8ubWFpbnRlbmFuY2VXaW5kb3csXG4gICAgICB9LFxuICAgICAgdGFnczogW1xuICAgICAgICB7IGtleTogJ05hbWUnLCB2YWx1ZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWZzeC1vbnRhcGAgfSxcbiAgICAgICAgeyBrZXk6ICdFbnZpcm9ubWVudCcsIHZhbHVlOiBlbnZpcm9ubWVudCB9LFxuICAgICAgICB7IGtleTogJ1B1cnBvc2UnLCB2YWx1ZTogJ1Blcm1pc3Npb25Bd2FyZVJBRycgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIEZTeCBmb3IgT05UQVDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIFNWTeS9nOaIkO+8iGZzeE9udGFw6Kit5a6a44GM44GC44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwPy52b2x1bWVzKSB7XG4gICAgICBjb25zdCBzdm0gPSBuZXcgZnN4LkNmblN0b3JhZ2VWaXJ0dWFsTWFjaGluZSh0aGlzLCAnRnN4U3ZtJywge1xuICAgICAgICBmaWxlU3lzdGVtSWQ6IHRoaXMuZnN4RmlsZVN5c3RlbS5yZWYsXG4gICAgICAgIG5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1zdm1gLFxuICAgICAgICB0YWdzOiBbXG4gICAgICAgICAgeyBrZXk6ICdOYW1lJywgdmFsdWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1zdm1gIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcblxuICAgICAgY29uc29sZS5sb2coJ+KchSBGU3ggU1ZN5L2c5oiQ5a6M5LqGJyk7XG5cbiAgICAgIC8vIOOCueODiOODrOODvOOCuOODnOODquODpeODvOODoOS9nOaIkFxuICAgICAgaWYgKHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YT8uZW5hYmxlZCkge1xuICAgICAgICB0aGlzLmZzeFN0b3JhZ2VWb2x1bWUgPSBuZXcgZnN4LkNmblZvbHVtZSh0aGlzLCAnU3RvcmFnZVZvbHVtZScsIHtcbiAgICAgICAgICBuYW1lOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGEubmFtZSB8fCAnZGF0YV92b2x1bWUnLFxuICAgICAgICAgIHZvbHVtZVR5cGU6ICdPTlRBUCcsXG4gICAgICAgICAgb250YXBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBzdG9yYWdlVmlydHVhbE1hY2hpbmVJZDogc3ZtLnJlZixcbiAgICAgICAgICAgIHNpemVJbk1lZ2FieXRlczogdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhLnNpemVJbk1lZ2FieXRlcz8udG9TdHJpbmcoKSB8fCAnMTAyNDAnLFxuICAgICAgICAgICAgc2VjdXJpdHlTdHlsZTogdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhLnNlY3VyaXR5U3R5bGUgfHwgJ1VOSVgnLFxuICAgICAgICAgICAganVuY3Rpb25QYXRoOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGEuanVuY3Rpb25QYXRoIHx8ICcvZGF0YScsXG4gICAgICAgICAgICBzdG9yYWdlRWZmaWNpZW5jeUVuYWJsZWQ6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YS5zdG9yYWdlRWZmaWNpZW5jeUVuYWJsZWQgIT09IGZhbHNlID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhZ3M6IFtcbiAgICAgICAgICAgIHsga2V5OiAnTmFtZScsIHZhbHVlOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGF0YS12b2x1bWVgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBGU3jjg4fjg7zjgr/jg5zjg6rjg6Xjg7zjg6DkvZzmiJDlrozkuoYnKTtcbiAgICAgIH1cblxuICAgICAgLy8g44OH44O844K/44OZ44O844K544Oc44Oq44Ol44O844Og5L2c5oiQXG4gICAgICBpZiAodGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhYmFzZT8uZW5hYmxlZCkge1xuICAgICAgICB0aGlzLmZzeERhdGFiYXNlVm9sdW1lID0gbmV3IGZzeC5DZm5Wb2x1bWUodGhpcywgJ0RhdGFiYXNlVm9sdW1lJywge1xuICAgICAgICAgIG5hbWU6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YWJhc2UubmFtZSB8fCAnZGF0YWJhc2Vfdm9sdW1lJyxcbiAgICAgICAgICB2b2x1bWVUeXBlOiAnT05UQVAnLFxuICAgICAgICAgIG9udGFwQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgc3RvcmFnZVZpcnR1YWxNYWNoaW5lSWQ6IHN2bS5yZWYsXG4gICAgICAgICAgICBzaXplSW5NZWdhYnl0ZXM6IHRoaXMucHJvcHMuY29uZmlnLmZzeE9udGFwLnZvbHVtZXMuZGF0YWJhc2Uuc2l6ZUluTWVnYWJ5dGVzPy50b1N0cmluZygpIHx8ICcxMDI0MCcsXG4gICAgICAgICAgICBzZWN1cml0eVN0eWxlOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGFiYXNlLnNlY3VyaXR5U3R5bGUgfHwgJ1VOSVgnLFxuICAgICAgICAgICAganVuY3Rpb25QYXRoOiB0aGlzLnByb3BzLmNvbmZpZy5mc3hPbnRhcC52b2x1bWVzLmRhdGFiYXNlLmp1bmN0aW9uUGF0aCB8fCAnL2RhdGFiYXNlJyxcbiAgICAgICAgICAgIHN0b3JhZ2VFZmZpY2llbmN5RW5hYmxlZDogdGhpcy5wcm9wcy5jb25maWcuZnN4T250YXAudm9sdW1lcy5kYXRhYmFzZS5zdG9yYWdlRWZmaWNpZW5jeUVuYWJsZWQgIT09IGZhbHNlID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhZ3M6IFtcbiAgICAgICAgICAgIHsga2V5OiAnTmFtZScsIHZhbHVlOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGF0YWJhc2Utdm9sdW1lYCB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUgRlN444OH44O844K/44OZ44O844K544Oc44Oq44Ol44O844Og5L2c5oiQ5a6M5LqGJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5Ye65Yqb5YCk5L2c5oiQXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeEZpbGVTeXN0ZW1JZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZzeEZpbGVTeXN0ZW0ucmVmLFxuICAgICAgZGVzY3JpcHRpb246ICdGU3ggZm9yIE9OVEFQIEZpbGUgU3lzdGVtIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1Gc3hGaWxlU3lzdGVtSWRgLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuZnN4U3RvcmFnZVZvbHVtZSkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeFN0b3JhZ2VWb2x1bWVJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZnN4U3RvcmFnZVZvbHVtZS5yZWYsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IFN0b3JhZ2UgVm9sdW1lIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUZzeFN0b3JhZ2VWb2x1bWVJZGAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5mc3hEYXRhYmFzZVZvbHVtZSkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZzeERhdGFiYXNlVm9sdW1lSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmZzeERhdGFiYXNlVm9sdW1lLnJlZixcbiAgICAgICAgZGVzY3JpcHRpb246ICdGU3ggRGF0YWJhc2UgVm9sdW1lIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUZzeERhdGFiYXNlVm9sdW1lSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBGU3ggZm9yIE9OVEFQ5L2c5oiQ5a6M5LqGJyk7XG4gIH1cbn1cbiJdfQ==