/**
 * FSx for NetApp ONTAP 統合レイヤー実装
 * 複数ボリュームの動的マウント機能とNFS最適化設定
 */

import { Construct } from 'constructs';
import { Stack, Duration, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { FSxMountConfig, ExtendedEmbeddingConfig } from './types/type';

/**
 * NFS マウントオプション設定
 */
export interface NFSMountOptions {
  /** 読み取りサイズ（バイト） */
  rsize: number;
  /** 書き込みサイズ（バイト） */
  wsize: number;
  /** ハードマウント */
  hard: boolean;
  /** 割り込み可能 */
  intr: boolean;
  /** タイムアウト（秒） */
  timeo: number;
  /** リトライ回数 */
  retrans: number;
  /** NFSバージョン */
  nfsvers: string;
  /** プロトコル */
  proto: 'tcp' | 'udp';
  /** ファイルロック */
  flock: boolean;
  /** 非同期書き込み */
  async: boolean;
}

/**
 * SMB/CIFS マウントオプション設定
 */
export interface SMBMountOptions {
  /** SMBバージョン */
  vers: string;
  /** セキュリティモード */
  sec: 'ntlmssp' | 'krb5' | 'krb5i' | 'krb5p';
  /** ファイルモード */
  fileMode: string;
  /** ディレクトリモード */
  dirMode: string;
  /** UID */
  uid: number;
  /** GID */
  gid: number;
  /** キャッシュモード */
  cache: 'strict' | 'loose' | 'none';
  /** 永続的ハンドル */
  persistenthandles: boolean;
  /** 復元力のあるハンドル */
  resilienthandles: boolean;
}

/**
 * ボリューム設定
 */
export interface VolumeConfig {
  /** ボリューム名 */
  name: string;
  /** マウントポイント */
  mountPoint: string;
  /** プロトコル */
  protocol: 'NFS' | 'SMB';
  /** FSx パス */
  fsxPath: string;
  /** マウントオプション */
  mountOptions: NFSMountOptions | SMBMountOptions;
  /** 自動マウント */
  autoMount: boolean;
  /** 権限設定 */
  permissions: {
    owner: string;
    group: string;
    mode: string;
  };
}

/**
 * FSx ONTAP統合レイヤークラス
 */
export class FSxONTAPIntegrationLayer extends Construct {
  /** FSx ファイルシステムID */
  public readonly fileSystemId: string;
  /** SVM ID */
  public readonly svmId: string;
  /** マウント設定 */
  public readonly mountConfig: FSxMountConfig;
  /** ボリューム設定リスト */
  public readonly volumeConfigs: VolumeConfig[];
  /** マウントスクリプト */
  public readonly mountScript: string;
  /** アンマウントスクリプト */
  public readonly unmountScript: string;

  constructor(scope: Construct, id: string, props: {
    vpc: ec2.IVpc;
    embeddingConfig: ExtendedEmbeddingConfig;
    securityGroup?: ec2.ISecurityGroup;
  }) {
    super(scope, id);

    this.fileSystemId = props.embeddingConfig.fsxMountConfig.fileSystemId;
    this.svmId = props.embeddingConfig.fsxMountConfig.svmId;
    this.mountConfig = props.embeddingConfig.fsxMountConfig;

    // ボリューム設定の生成
    this.volumeConfigs = this.createVolumeConfigs();

    // セキュリティグループの作成または使用
    const securityGroup = props.securityGroup || this.createSecurityGroup(props.vpc);

    // マウントスクリプトの生成
    this.mountScript = this.generateMountScript();
    this.unmountScript = this.generateUnmountScript();

    // SSMパラメータとしてスクリプトを保存
    this.createSSMParameters();

    // IAMロールの作成
    this.createIAMRole();

    // 出力の作成
    this.createOutputs();
  }

  /**
   * ボリューム設定の作成
   */
  private createVolumeConfigs(): VolumeConfig[] {
    const configs: VolumeConfig[] = [];

    // ドキュメントボリューム（SMB/CIFS）
    configs.push({
      name: 'documents',
      mountPoint: this.mountConfig.volumes.documents.mountPoint,
      protocol: 'SMB',
      fsxPath: this.mountConfig.volumes.documents.path,
      mountOptions: this.getOptimizedSMBOptions(),
      autoMount: true,
      permissions: {
        owner: 'ubuntu',
        group: 'ubuntu',
        mode: '0755'
      }
    });

    // 埋め込みボリューム（NFS）
    configs.push({
      name: 'embeddings',
      mountPoint: this.mountConfig.volumes.embeddings.mountPoint,
      protocol: 'NFS',
      fsxPath: this.mountConfig.volumes.embeddings.path,
      mountOptions: this.getOptimizedNFSOptions(),
      autoMount: true,
      permissions: {
        owner: 'ubuntu',
        group: 'ubuntu',
        mode: '0755'
      }
    });

    // インデックスボリューム（NFS）
    configs.push({
      name: 'index',
      mountPoint: this.mountConfig.volumes.index.mountPoint,
      protocol: 'NFS',
      fsxPath: this.mountConfig.volumes.index.path,
      mountOptions: this.getOptimizedNFSOptions(),
      autoMount: true,
      permissions: {
        owner: 'ubuntu',
        group: 'ubuntu',
        mode: '0755'
      }
    });

    return configs;
  }

  /**
   * 最適化されたNFSマウントオプションの取得
   */
  private getOptimizedNFSOptions(): NFSMountOptions {
    return {
      // パフォーマンス最適化設定
      rsize: 1048576,        // 1MB読み取りサイズ（最大パフォーマンス）
      wsize: 1048576,        // 1MB書き込みサイズ（最大パフォーマンス）
      
      // 信頼性設定
      hard: true,            // ハードマウント（サーバー復旧まで待機）
      intr: true,            // 割り込み可能（Ctrl+Cで中断可能）
      
      // タイムアウト設定
      timeo: 600,            // 10分タイムアウト（大容量ファイル対応）
      retrans: 2,            // リトライ回数（ネットワーク障害対応）
      
      // プロトコル設定
      nfsvers: '4.1',        // NFS v4.1（最新の安定版）
      proto: 'tcp',          // TCP使用（信頼性重視）
      
      // ファイルシステム設定
      flock: true,           // ファイルロック有効
      async: false           // 同期書き込み（データ整合性重視）
    };
  }

  /**
   * 最適化されたSMBマウントオプションの取得
   */
  private getOptimizedSMBOptions(): SMBMountOptions {
    return {
      // プロトコル設定
      vers: '3.0',           // SMB 3.0（パフォーマンスと互換性のバランス）
      sec: 'ntlmssp',        // NTLM認証（Active Directory統合）
      
      // 権限設定
      fileMode: '0644',      // ファイル権限
      dirMode: '0755',       // ディレクトリ権限
      uid: 1000,             // ubuntu ユーザー
      gid: 1000,             // ubuntu グループ
      
      // パフォーマンス設定
      cache: 'strict',       // 厳密キャッシュ（データ整合性重視）
      persistenthandles: true,  // 永続的ハンドル（接続安定性）
      resilienthandles: true    // 復元力のあるハンドル（障害回復）
    };
  }

  /**
   * セキュリティグループの作成
   */
  private createSecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, 'FSxSecurityGroup', {
      vpc,
      description: 'FSx ONTAP統合レイヤー用セキュリティグループ',
      allowAllOutbound: true
    });

    // NFS用ポート（2049）
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(2049),
      'NFS アクセス用'
    );

    // SMB/CIFS用ポート（445）
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(445),
      'SMB/CIFS アクセス用'
    );

    // FSx管理用ポート（111, 635, 4045, 4046）
    [111, 635, 4045, 4046].forEach(port => {
      securityGroup.addIngressRule(
        ec2.Peer.ipv4(vpc.vpcCidrBlock),
        ec2.Port.tcp(port),
        `FSx管理ポート ${port}`
      );
    });

    return securityGroup;
  }

  /**
   * マウントスクリプトの生成
   */
  private generateMountScript(): string {
    const scriptLines: string[] = [];
    
    scriptLines.push('#!/bin/bash');
    scriptLines.push('# FSx ONTAP 統合レイヤー - マウントスクリプト');
    scriptLines.push('# 自動生成されたスクリプト - 手動編集しないでください');
    scriptLines.push('');
    scriptLines.push('set -e');
    scriptLines.push('');
    scriptLines.push('echo "=== FSx ONTAP ボリュームマウント開始 ==="');
    scriptLines.push('');

    // 必要なパッケージのインストール
    scriptLines.push('# 必要なパッケージのインストール');
    scriptLines.push('echo "必要なパッケージをインストール中..."');
    scriptLines.push('sudo apt-get update -q');
    scriptLines.push('sudo apt-get install -y nfs-common cifs-utils');
    scriptLines.push('');

    // FSx エンドポイントの取得
    scriptLines.push('# FSx エンドポイントの取得');
    scriptLines.push(`FSX_DNS_NAME=$(aws fsx describe-file-systems --file-system-ids ${this.fileSystemId} --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.DNSName' --output text --region \${AWS_REGION:-us-east-1})`);
    scriptLines.push(`SVM_DNS_NAME=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids ${this.svmId} --query 'StorageVirtualMachines[0].Endpoints.Nfs.DNSName' --output text --region \${AWS_REGION:-us-east-1})`);
    scriptLines.push('');

    // 各ボリュームのマウント
    this.volumeConfigs.forEach(config => {
      scriptLines.push(`# ${config.name}ボリュームのマウント`);
      scriptLines.push(`echo "${config.name}ボリュームをマウント中..."`);
      scriptLines.push(`sudo mkdir -p ${config.mountPoint}`);
      
      if (config.protocol === 'NFS') {
        const nfsOptions = config.mountOptions as NFSMountOptions;
        const optionsStr = [
          `rsize=${nfsOptions.rsize}`,
          `wsize=${nfsOptions.wsize}`,
          nfsOptions.hard ? 'hard' : 'soft',
          nfsOptions.intr ? 'intr' : 'nointr',
          `timeo=${nfsOptions.timeo}`,
          `retrans=${nfsOptions.retrans}`,
          `nfsvers=${nfsOptions.nfsvers}`,
          `proto=${nfsOptions.proto}`,
          nfsOptions.flock ? 'flock' : 'noflock',
          nfsOptions.async ? 'async' : 'sync'
        ].join(',');
        
        scriptLines.push(`sudo mount -t nfs4 -o ${optionsStr} $SVM_DNS_NAME:${config.fsxPath} ${config.mountPoint}`);
      } else {
        const smbOptions = config.mountOptions as SMBMountOptions;
        const optionsStr = [
          `vers=${smbOptions.vers}`,
          `sec=${smbOptions.sec}`,
          `file_mode=${smbOptions.fileMode}`,
          `dir_mode=${smbOptions.dirMode}`,
          `uid=${smbOptions.uid}`,
          `gid=${smbOptions.gid}`,
          `cache=${smbOptions.cache}`,
          smbOptions.persistenthandles ? 'persistenthandles' : 'nopersistenthandles',
          smbOptions.resilienthandles ? 'resilienthandles' : 'noresilienthandles'
        ].join(',');
        
        scriptLines.push(`sudo mount -t cifs -o ${optionsStr} //$FSX_DNS_NAME${config.fsxPath} ${config.mountPoint}`);
      }
      
      scriptLines.push(`sudo chown ${config.permissions.owner}:${config.permissions.group} ${config.mountPoint}`);
      scriptLines.push(`sudo chmod ${config.permissions.mode} ${config.mountPoint}`);
      scriptLines.push(`echo "✅ ${config.name}ボリュームマウント完了: ${config.mountPoint}"`);
      scriptLines.push('');
    });

    // マウント状態の確認
    scriptLines.push('# マウント状態の確認');
    scriptLines.push('echo "=== マウント状態確認 ==="');
    scriptLines.push('df -h | grep -E "(nfs|cifs)" || echo "マウントされたFSxボリュームが見つかりません"');
    scriptLines.push('');

    // fstabエントリの作成（オプション）
    scriptLines.push('# fstabエントリの作成（永続化）');
    scriptLines.push('if [ "$CREATE_FSTAB_ENTRIES" = "true" ]; then');
    scriptLines.push('  echo "fstabエントリを作成中..."');
    scriptLines.push('  sudo cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)');
    
    this.volumeConfigs.forEach(config => {
      if (config.protocol === 'NFS') {
        const nfsOptions = config.mountOptions as NFSMountOptions;
        const optionsStr = [
          `rsize=${nfsOptions.rsize}`,
          `wsize=${nfsOptions.wsize}`,
          nfsOptions.hard ? 'hard' : 'soft',
          nfsOptions.intr ? 'intr' : 'nointr',
          `timeo=${nfsOptions.timeo}`,
          `retrans=${nfsOptions.retrans}`,
          `nfsvers=${nfsOptions.nfsvers}`,
          `proto=${nfsOptions.proto}`,
          nfsOptions.flock ? 'flock' : 'noflock',
          nfsOptions.async ? 'async' : 'sync'
        ].join(',');
        
        scriptLines.push(`  echo "$SVM_DNS_NAME:${config.fsxPath} ${config.mountPoint} nfs4 ${optionsStr} 0 0" | sudo tee -a /etc/fstab`);
      }
    });
    
    scriptLines.push('fi');
    scriptLines.push('');

    scriptLines.push('echo "=== FSx ONTAP ボリュームマウント完了 ==="');
    scriptLines.push('');

    return scriptLines.join('\n');
  }

  /**
   * アンマウントスクリプトの生成
   */
  private generateUnmountScript(): string {
    const scriptLines: string[] = [];
    
    scriptLines.push('#!/bin/bash');
    scriptLines.push('# FSx ONTAP 統合レイヤー - アンマウントスクリプト');
    scriptLines.push('# 自動生成されたスクリプト - 手動編集しないでください');
    scriptLines.push('');
    scriptLines.push('set -e');
    scriptLines.push('');
    scriptLines.push('echo "=== FSx ONTAP ボリュームアンマウント開始 ==="');
    scriptLines.push('');

    // 各ボリュームのアンマウント（逆順）
    [...this.volumeConfigs].reverse().forEach(config => {
      scriptLines.push(`# ${config.name}ボリュームのアンマウント`);
      scriptLines.push(`echo "${config.name}ボリュームをアンマウント中..."`);
      scriptLines.push(`if mountpoint -q ${config.mountPoint}; then`);
      scriptLines.push(`  sudo umount ${config.mountPoint}`);
      scriptLines.push(`  echo "✅ ${config.name}ボリュームアンマウント完了"`);
      scriptLines.push(`else`);
      scriptLines.push(`  echo "⚠️  ${config.name}ボリュームはマウントされていません"`);
      scriptLines.push(`fi`);
      scriptLines.push('');
    });

    // fstabエントリの削除（オプション）
    scriptLines.push('# fstabエントリの削除');
    scriptLines.push('if [ "$REMOVE_FSTAB_ENTRIES" = "true" ]; then');
    scriptLines.push('  echo "fstabエントリを削除中..."');
    scriptLines.push('  sudo cp /etc/fstab /etc/fstab.backup.$(date +%Y%m%d_%H%M%S)');
    
    this.volumeConfigs.forEach(config => {
      scriptLines.push(`  sudo sed -i "\\|${config.mountPoint}|d" /etc/fstab`);
    });
    
    scriptLines.push('fi');
    scriptLines.push('');

    scriptLines.push('echo "=== FSx ONTAP ボリュームアンマウント完了 ==="');
    scriptLines.push('');

    return scriptLines.join('\n');
  }

  /**
   * SSMパラメータの作成
   */
  private createSSMParameters(): void {
    // マウントスクリプト
    new ssm.StringParameter(this, 'MountScript', {
      parameterName: `/fsx-ontap/${this.fileSystemId}/mount-script`,
      stringValue: this.mountScript,
      description: 'FSx ONTAP ボリュームマウントスクリプト',
      tier: ssm.ParameterTier.ADVANCED
    });

    // アンマウントスクリプト
    new ssm.StringParameter(this, 'UnmountScript', {
      parameterName: `/fsx-ontap/${this.fileSystemId}/unmount-script`,
      stringValue: this.unmountScript,
      description: 'FSx ONTAP ボリュームアンマウントスクリプト',
      tier: ssm.ParameterTier.ADVANCED
    });

    // ボリューム設定
    new ssm.StringParameter(this, 'VolumeConfig', {
      parameterName: `/fsx-ontap/${this.fileSystemId}/volume-config`,
      stringValue: JSON.stringify(this.volumeConfigs, null, 2),
      description: 'FSx ONTAP ボリューム設定',
      tier: ssm.ParameterTier.ADVANCED
    });
  }

  /**
   * IAMロールの作成
   */
  private createIAMRole(): iam.Role {
    const role = new iam.Role(this, 'FSxIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'FSx ONTAP統合レイヤー用IAMロール',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    });

    // FSx読み取り権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'fsx:DescribeFileSystems',
        'fsx:DescribeStorageVirtualMachines',
        'fsx:DescribeVolumes'
      ],
      resources: ['*']
    }));

    // SSMパラメータ読み取り権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath'
      ],
      resources: [
        `arn:aws:ssm:*:*:parameter/fsx-ontap/${this.fileSystemId}/*`
      ]
    }));

    return role;
  }

  /**
   * 出力の作成
   */
  private createOutputs(): void {
    new CfnOutput(this, 'FileSystemId', {
      value: this.fileSystemId,
      description: 'FSx ONTAP ファイルシステムID'
    });

    new CfnOutput(this, 'SvmId', {
      value: this.svmId,
      description: 'FSx ONTAP SVM ID'
    });

    new CfnOutput(this, 'MountScriptParameter', {
      value: `/fsx-ontap/${this.fileSystemId}/mount-script`,
      description: 'マウントスクリプトSSMパラメータ名'
    });

    new CfnOutput(this, 'UnmountScriptParameter', {
      value: `/fsx-ontap/${this.fileSystemId}/unmount-script`,
      description: 'アンマウントスクリプトSSMパラメータ名'
    });

    // 各ボリュームのマウントポイント
    this.volumeConfigs.forEach((config, index) => {
      new CfnOutput(this, `${config.name}MountPoint`, {
        value: config.mountPoint,
        description: `${config.name}ボリュームマウントポイント`
      });
    });
  }

  /**
   * マウント状態の検証スクリプト生成
   */
  public generateValidationScript(): string {
    const scriptLines: string[] = [];
    
    scriptLines.push('#!/bin/bash');
    scriptLines.push('# FSx ONTAP 統合レイヤー - マウント状態検証スクリプト');
    scriptLines.push('');
    scriptLines.push('echo "=== FSx ONTAP マウント状態検証 ==="');
    scriptLines.push('');

    let allMounted = true;
    this.volumeConfigs.forEach(config => {
      scriptLines.push(`# ${config.name}ボリュームの検証`);
      scriptLines.push(`if mountpoint -q ${config.mountPoint}; then`);
      scriptLines.push(`  echo "✅ ${config.name}: マウント済み (${config.mountPoint})"`);
      scriptLines.push(`  ls -la ${config.mountPoint} | head -5`);
      scriptLines.push(`else`);
      scriptLines.push(`  echo "❌ ${config.name}: マウントされていません (${config.mountPoint})"`);
      scriptLines.push(`  ALL_MOUNTED=false`);
      scriptLines.push(`fi`);
      scriptLines.push('');
    });

    scriptLines.push('# 全体的な状態確認');
    scriptLines.push('echo "=== マウント状態サマリー ==="');
    scriptLines.push('df -h | grep -E "(nfs|cifs)" || echo "FSxボリュームが見つかりません"');
    scriptLines.push('');
    scriptLines.push('if [ "$ALL_MOUNTED" != "false" ]; then');
    scriptLines.push('  echo "✅ 全てのFSxボリュームが正常にマウントされています"');
    scriptLines.push('  exit 0');
    scriptLines.push('else');
    scriptLines.push('  echo "❌ 一部のFSxボリュームがマウントされていません"');
    scriptLines.push('  exit 1');
    scriptLines.push('fi');

    return scriptLines.join('\n');
  }

  /**
   * パフォーマンステストスクリプト生成
   */
  public generatePerformanceTestScript(): string {
    const scriptLines: string[] = [];
    
    scriptLines.push('#!/bin/bash');
    scriptLines.push('# FSx ONTAP 統合レイヤー - パフォーマンステストスクリプト');
    scriptLines.push('');
    scriptLines.push('echo "=== FSx ONTAP パフォーマンステスト ==="');
    scriptLines.push('');

    this.volumeConfigs.forEach(config => {
      if (config.protocol === 'NFS') {
        scriptLines.push(`# ${config.name}ボリューム（NFS）のパフォーマンステスト`);
        scriptLines.push(`echo "📊 ${config.name}ボリュームのパフォーマンステスト開始..."`);
        scriptLines.push(`TEST_FILE="${config.mountPoint}/performance_test_$(date +%s).tmp"`);
        scriptLines.push('');
        
        // 書き込みテスト
        scriptLines.push('# 書き込みテスト（1GB）');
        scriptLines.push('echo "書き込みテスト実行中..."');
        scriptLines.push(`WRITE_TIME=$(time (dd if=/dev/zero of="$TEST_FILE" bs=1M count=1024 conv=fdatasync) 2>&1 | grep real | awk '{print $2}')`);
        scriptLines.push('echo "書き込み時間: $WRITE_TIME"');
        scriptLines.push('');
        
        // 読み取りテスト
        scriptLines.push('# 読み取りテスト');
        scriptLines.push('echo "読み取りテスト実行中..."');
        scriptLines.push('sync && echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null');
        scriptLines.push(`READ_TIME=$(time (dd if="$TEST_FILE" of=/dev/null bs=1M) 2>&1 | grep real | awk '{print $2}')`);
        scriptLines.push('echo "読み取り時間: $READ_TIME"');
        scriptLines.push('');
        
        // クリーンアップ
        scriptLines.push(`rm -f "$TEST_FILE"`);
        scriptLines.push(`echo "✅ ${config.name}ボリュームテスト完了"`);
        scriptLines.push('');
      }
    });

    scriptLines.push('echo "=== パフォーマンステスト完了 ==="');

    return scriptLines.join('\n');
  }
}

/**
 * FSx ONTAP統合ユーティリティクラス
 */
export class FSxONTAPUtils {
  /**
   * FSx エンドポイント情報の取得
   */
  static async getFSxEndpoints(fileSystemId: string, svmId: string, region: string = 'us-east-1'): Promise<{
    managementEndpoint: string;
    nfsEndpoint: string;
    smbEndpoint: string;
  }> {
    // 実際の実装では AWS SDK を使用
    // ここではプレースホルダーとして型定義のみ提供
    return {
      managementEndpoint: `${fileSystemId}.fsx.${region}.amazonaws.com`,
      nfsEndpoint: `${svmId}.${fileSystemId}.fsx.${region}.amazonaws.com`,
      smbEndpoint: `${svmId}.${fileSystemId}.fsx.${region}.amazonaws.com`
    };
  }

  /**
   * マウントオプションの最適化
   */
  static optimizeNFSOptions(workloadType: 'read-heavy' | 'write-heavy' | 'balanced'): NFSMountOptions {
    const baseOptions: NFSMountOptions = {
      hard: true,
      intr: true,
      timeo: 600,
      retrans: 2,
      nfsvers: '4.1',
      proto: 'tcp',
      flock: true,
      async: false
    };

    switch (workloadType) {
      case 'read-heavy':
        return {
          ...baseOptions,
          rsize: 1048576,  // 1MB - 読み取り最適化
          wsize: 65536     // 64KB - 書き込みは標準
        };
      case 'write-heavy':
        return {
          ...baseOptions,
          rsize: 65536,    // 64KB - 読み取りは標準
          wsize: 1048576   // 1MB - 書き込み最適化
        };
      case 'balanced':
      default:
        return {
          ...baseOptions,
          rsize: 1048576,  // 1MB - バランス型
          wsize: 1048576   // 1MB - バランス型
        };
    }
  }

  /**
   * マウント状態の監視
   */
  static generateMonitoringScript(): string {
    return `#!/bin/bash
# FSx ONTAP マウント状態監視スクリプト

while true; do
  echo "$(date): FSx マウント状態チェック"
  
  # マウント状態確認
  if ! df -h | grep -q "fsx"; then
    echo "警告: FSx ボリュームがマウントされていません"
    # 再マウント試行
    /opt/fsx-ontap/mount-script.sh
  fi
  
  # 60秒待機
  sleep 60
done`;
  }

  /**
   * 障害回復スクリプトの生成
   */
  static generateRecoveryScript(): string {
    return `#!/bin/bash
# FSx ONTAP 障害回復スクリプト

echo "FSx ONTAP 障害回復処理開始"

# 既存マウントの強制アンマウント
sudo umount -f -l /mnt/documents /mnt/embeddings /mnt/index 2>/dev/null || true

# ネットワーク接続確認
if ! ping -c 3 \${SVM_DNS_NAME} > /dev/null 2>&1; then
  echo "エラー: FSx エンドポイントに接続できません"
  exit 1
fi

# 再マウント実行
/opt/fsx-ontap/mount-script.sh

# 検証
/opt/fsx-ontap/validation-script.sh

echo "FSx ONTAP 障害回復処理完了"`;
  }
}
