/**
 * FSx for ONTAP オプショナルコンストラクト
 * 
 * 現在のFsxOntapConfigインターフェースに合わせて簡素化
 * 複雑な設定は将来のバージョンで実装予定
 */

import { Construct } from 'constructs';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CfnOutput } from 'aws-cdk-lib';
import { FsxOntapConfig } from '../../../config/interfaces/environment-config';

export interface FSxONTAPOptionalProps {
  readonly config: FsxOntapConfig;
  readonly projectName: string;
  readonly environment: string;
  readonly vpc?: ec2.IVpc;
  readonly subnetIds?: string[];
  readonly tags?: { [key: string]: string };
}

/**
 * FSx for ONTAP オプショナルコンストラクト（簡素化版）
 */
export class FSxONTAPOptionalConstruct extends Construct {
  public readonly fileSystem?: fsx.CfnFileSystem;
  public readonly dnsName?: string;

  constructor(scope: Construct, id: string, props: FSxONTAPOptionalProps) {
    super(scope, id);

    // FSx機能が無効化されている場合はスキップ
    if (!props.config.enabled) {
      console.log('⏭️  FSx for ONTAP機能が無効化されています');
      return;
    }

    console.log('🗄️ FSx for ONTAPファイルシステム作成開始（簡素化版）...');

    // 基本的なFSx for ONTAPファイルシステムの作成
    if (props.vpc && props.subnetIds && props.subnetIds.length > 0) {
      this.createBasicFsxFileSystem(props);
    } else {
      console.log('⚠️  VPCまたはサブネット情報が不足しています。FSx作成をスキップします。');
    }

    console.log('✅ FSx for ONTAPコンストラクト初期化完了');
  }

  private createBasicFsxFileSystem(props: FSxONTAPOptionalProps): void {
    // 基本的なFSx for ONTAPファイルシステム
    const fileSystem = new fsx.CfnFileSystem(this, 'FSxONTAPFileSystem', {
      fileSystemType: 'ONTAP',
      storageCapacity: props.config.storageCapacity,
      subnetIds: [props.subnetIds![0]], // 単一AZデプロイメント

      ontapConfiguration: {
        deploymentType: props.config.deploymentType as 'SINGLE_AZ_1' | 'MULTI_AZ_1',
        throughputCapacity: props.config.throughputCapacity,
        preferredSubnetId: props.subnetIds![0],
        automaticBackupRetentionDays: props.config.automaticBackupRetentionDays,
        weeklyMaintenanceStartTime: '7:09:00',
        diskIopsConfiguration: {
          mode: 'AUTOMATIC'
        }
      },

      tags: [
        {
          key: 'Name',
          value: `${props.projectName}-${props.environment}-fsx-ontap`
        },
        {
          key: 'Environment',
          value: props.environment
        },
        {
          key: 'Project',
          value: props.projectName
        },
        ...(props.tags ? Object.entries(props.tags).map(([key, value]) => ({ key, value })) : [])
      ]
    });

    // readonlyプロパティに代入するため、型アサーションを使用
    (this as any).fileSystem = fileSystem;
    (this as any).dnsName = fileSystem.attrDnsName;

    // CloudFormation出力
    new CfnOutput(this, 'FSxONTAPFileSystemId', {
      value: fileSystem.ref,
      description: 'FSx for ONTAP File System ID'
    });

    new CfnOutput(this, 'FSxONTAPDnsName', {
      value: fileSystem.attrDnsName,
      description: 'FSx for ONTAP DNS Name'
    });

    console.log('✅ 基本的なFSx for ONTAPファイルシステム作成完了');
  }

  /**
   * FSx機能が有効かどうかを確認
   */
  public isEnabled(): boolean {
    return this.fileSystem !== undefined;
  }

  /**
   * 接続情報を取得
   */
  public getConnectionInfo(): {
    fileSystemId?: string;
    dnsName?: string;
  } {
    return {
      fileSystemId: this.fileSystem?.ref,
      dnsName: this.dnsName
    };
  }
}