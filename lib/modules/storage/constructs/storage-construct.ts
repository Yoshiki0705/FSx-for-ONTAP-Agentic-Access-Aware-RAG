import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StorageConfig } from '../interfaces/storage-config';

export interface StorageConstructProps {
  readonly config: StorageConfig;
  readonly vpc?: ec2.IVpc;
  readonly privateSubnetIds?: string[];
  readonly projectName?: string;
  readonly environment?: string;
  readonly kmsKey?: any;
}

export interface StorageOutputs {
  s3Buckets?: { [key: string]: s3.IBucket };
  fsxFileSystemId?: string;
  fsxStorageVolumeId?: string;
  fsxDatabaseVolumeId?: string;
}

export class StorageConstruct extends Construct {
  public fsxFileSystem?: fsx.CfnFileSystem;
  public fsxStorageVolume?: fsx.CfnVolume;
  public fsxDatabaseVolume?: fsx.CfnVolume;
  public readonly outputs: StorageOutputs;
  
  // S3バケット
  public documentsBucket?: s3.IBucket;
  public backupBucket?: s3.IBucket;
  public embeddingsBucket?: s3.IBucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
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

  private readonly props: StorageConstructProps;

  /**
   * S3バケット作成（オプション - FSx for ONTAPで代替可能）
   */
  private createS3Buckets(): void {
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

      this.outputs.s3Buckets!['documents'] = this.documentsBucket;

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

      this.outputs.s3Buckets!['backup'] = this.backupBucket;

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

      this.outputs.s3Buckets!['embeddings'] = this.embeddingsBucket;

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
  private createFSxOntapResources(): void {
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
