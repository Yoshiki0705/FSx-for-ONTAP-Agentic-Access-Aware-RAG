"use strict";
/**
 * FSx for NetApp ONTAP 統合レイヤー実装
 * 複数ボリュームの動的マウント機能とNFS最適化設定
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
exports.FSxONTAPUtils = exports.FSxONTAPIntegrationLayer = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
/**
 * FSx ONTAP統合レイヤークラス
 */
class FSxONTAPIntegrationLayer extends constructs_1.Construct {
    /** FSx ファイルシステムID */
    fileSystemId;
    /** SVM ID */
    svmId;
    /** マウント設定 */
    mountConfig;
    /** ボリューム設定リスト */
    volumeConfigs;
    /** マウントスクリプト */
    mountScript;
    /** アンマウントスクリプト */
    unmountScript;
    constructor(scope, id, props) {
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
    createVolumeConfigs() {
        const configs = [];
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
    getOptimizedNFSOptions() {
        return {
            // パフォーマンス最適化設定
            rsize: 1048576, // 1MB読み取りサイズ（最大パフォーマンス）
            wsize: 1048576, // 1MB書き込みサイズ（最大パフォーマンス）
            // 信頼性設定
            hard: true, // ハードマウント（サーバー復旧まで待機）
            intr: true, // 割り込み可能（Ctrl+Cで中断可能）
            // タイムアウト設定
            timeo: 600, // 10分タイムアウト（大容量ファイル対応）
            retrans: 2, // リトライ回数（ネットワーク障害対応）
            // プロトコル設定
            nfsvers: '4.1', // NFS v4.1（最新の安定版）
            proto: 'tcp', // TCP使用（信頼性重視）
            // ファイルシステム設定
            flock: true, // ファイルロック有効
            async: false // 同期書き込み（データ整合性重視）
        };
    }
    /**
     * 最適化されたSMBマウントオプションの取得
     */
    getOptimizedSMBOptions() {
        return {
            // プロトコル設定
            vers: '3.0', // SMB 3.0（パフォーマンスと互換性のバランス）
            sec: 'ntlmssp', // NTLM認証（Active Directory統合）
            // 権限設定
            fileMode: '0644', // ファイル権限
            dirMode: '0755', // ディレクトリ権限
            uid: 1000, // ubuntu ユーザー
            gid: 1000, // ubuntu グループ
            // パフォーマンス設定
            cache: 'strict', // 厳密キャッシュ（データ整合性重視）
            persistenthandles: true, // 永続的ハンドル（接続安定性）
            resilienthandles: true // 復元力のあるハンドル（障害回復）
        };
    }
    /**
     * セキュリティグループの作成
     */
    createSecurityGroup(vpc) {
        const securityGroup = new ec2.SecurityGroup(this, 'FSxSecurityGroup', {
            vpc,
            description: 'FSx ONTAP統合レイヤー用セキュリティグループ',
            allowAllOutbound: true
        });
        // NFS用ポート（2049）
        securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(2049), 'NFS アクセス用');
        // SMB/CIFS用ポート（445）
        securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(445), 'SMB/CIFS アクセス用');
        // FSx管理用ポート（111, 635, 4045, 4046）
        [111, 635, 4045, 4046].forEach(port => {
            securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(port), `FSx管理ポート ${port}`);
        });
        return securityGroup;
    }
    /**
     * マウントスクリプトの生成
     */
    generateMountScript() {
        const scriptLines = [];
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
                const nfsOptions = config.mountOptions;
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
            }
            else {
                const smbOptions = config.mountOptions;
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
                const nfsOptions = config.mountOptions;
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
    generateUnmountScript() {
        const scriptLines = [];
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
    createSSMParameters() {
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
    createIAMRole() {
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
    createOutputs() {
        new aws_cdk_lib_1.CfnOutput(this, 'FileSystemId', {
            value: this.fileSystemId,
            description: 'FSx ONTAP ファイルシステムID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'SvmId', {
            value: this.svmId,
            description: 'FSx ONTAP SVM ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'MountScriptParameter', {
            value: `/fsx-ontap/${this.fileSystemId}/mount-script`,
            description: 'マウントスクリプトSSMパラメータ名'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UnmountScriptParameter', {
            value: `/fsx-ontap/${this.fileSystemId}/unmount-script`,
            description: 'アンマウントスクリプトSSMパラメータ名'
        });
        // 各ボリュームのマウントポイント
        this.volumeConfigs.forEach((config, index) => {
            new aws_cdk_lib_1.CfnOutput(this, `${config.name}MountPoint`, {
                value: config.mountPoint,
                description: `${config.name}ボリュームマウントポイント`
            });
        });
    }
    /**
     * マウント状態の検証スクリプト生成
     */
    generateValidationScript() {
        const scriptLines = [];
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
    generatePerformanceTestScript() {
        const scriptLines = [];
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
exports.FSxONTAPIntegrationLayer = FSxONTAPIntegrationLayer;
/**
 * FSx ONTAP統合ユーティリティクラス
 */
class FSxONTAPUtils {
    /**
     * FSx エンドポイント情報の取得
     */
    static async getFSxEndpoints(fileSystemId, svmId, region = 'us-east-1') {
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
    static optimizeNFSOptions(workloadType) {
        const baseOptions = {
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
                    rsize: 1048576, // 1MB - 読み取り最適化
                    wsize: 65536 // 64KB - 書き込みは標準
                };
            case 'write-heavy':
                return {
                    ...baseOptions,
                    rsize: 65536, // 64KB - 読み取りは標準
                    wsize: 1048576 // 1MB - 書き込み最適化
                };
            case 'balanced':
            default:
                return {
                    ...baseOptions,
                    rsize: 1048576, // 1MB - バランス型
                    wsize: 1048576 // 1MB - バランス型
                };
        }
    }
    /**
     * マウント状態の監視
     */
    static generateMonitoringScript() {
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
    static generateRecoveryScript() {
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
exports.FSxONTAPUtils = FSxONTAPUtils;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4X29udGFwX2ludGVncmF0aW9uX2xheWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnN4X29udGFwX2ludGVncmF0aW9uX2xheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsMkNBQXVDO0FBQ3ZDLDZDQUF5RDtBQUN6RCx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHlEQUEyQztBQTZFM0M7O0dBRUc7QUFDSCxNQUFhLHdCQUF5QixTQUFRLHNCQUFTO0lBQ3JELHFCQUFxQjtJQUNMLFlBQVksQ0FBUztJQUNyQyxhQUFhO0lBQ0csS0FBSyxDQUFTO0lBQzlCLGFBQWE7SUFDRyxXQUFXLENBQWlCO0lBQzVDLGlCQUFpQjtJQUNELGFBQWEsQ0FBaUI7SUFDOUMsZ0JBQWdCO0lBQ0EsV0FBVyxDQUFTO0lBQ3BDLGtCQUFrQjtJQUNGLGFBQWEsQ0FBUztJQUV0QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBSXpDO1FBQ0MsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQztRQUN0RSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztRQUN4RCxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDO1FBRXhELGFBQWE7UUFDYixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBRWhELHFCQUFxQjtRQUNyQixNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFakYsZUFBZTtRQUNmLElBQUksQ0FB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Q0FBRyxnQkFBZ0I7aUJBQ2xDLENBQUM7WUFDSixLQUFLLFVBQVUsQ0FBQztZQUNoQjtnQkFDRSxPQUFPO29CQUNMLEdBQUcsV0FBVztvQkFDZCxLQUFLLEVBQUUsT0FBTyxFQUFHLGNBQWM7b0JBQy9CLEtBQUssRUFBRSxPQUFPLENBQUcsY0FBYztpQkFDaEMsQ0FBQztRQUNOLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsd0JBQXdCO1FBQzdCLE9BQU87Ozs7Ozs7Ozs7Ozs7OztLQWVOLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsc0JBQXNCO1FBQzNCLE9BQU87Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzBCQW9CZSxDQUFDO0lBQ3pCLENBQUM7Q0FDRjtBQXhHRCxzQ0F3R0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZTeCBmb3IgTmV0QXBwIE9OVEFQIOe1seWQiOODrOOCpOODpOODvOWun+ijhVxuICog6KSH5pWw44Oc44Oq44Ol44O844Og44Gu5YuV55qE44Oe44Km44Oz44OI5qmf6IO944GoTkZT5pyA6YGp5YyW6Kit5a6aXG4gKi9cblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBTdGFjaywgRHVyYXRpb24sIENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCB7IEZTeE1vdW50Q29uZmlnLCBFeHRlbmRlZEVtYmVkZGluZ0NvbmZpZyB9IGZyb20gJy4vdHlwZXMvdHlwZSc7XG5cbi8qKlxuICogTkZTIOODnuOCpuODs+ODiOOCquODl+OCt+ODp+ODs+ioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE5GU01vdW50T3B0aW9ucyB7XG4gIC8qKiDoqq3jgb/lj5bjgorjgrXjgqTjgrrvvIjjg5DjgqTjg4jvvIkgKi9cbiAgcnNpemU6IG51bWJlcjtcbiAgLyoqIOabuOOBjei+vOOBv+OCteOCpOOCuu+8iOODkOOCpOODiO+8iSAqL1xuICB3c2l6ZTogbnVtYmVyO1xuICAvKiog44OP44O844OJ44Oe44Km44Oz44OIICovXG4gIGhhcmQ6IGJvb2xlYW47XG4gIC8qKiDlibLjgorovrzjgb/lj6/og70gKi9cbiAgaW50cjogYm9vbGVhbjtcbiAgLyoqIOOCv+OCpOODoOOCouOCpuODiO+8iOenku+8iSAqL1xuICB0aW1lbzogbnVtYmVyO1xuICAvKiog44Oq44OI44Op44Kk5Zue5pWwICovXG4gIHJldHJhbnM6IG51bWJlcjtcbiAgLyoqIE5GU+ODkOODvOOCuOODp+ODsyAqL1xuICBuZnN2ZXJzOiBzdHJpbmc7XG4gIC8qKiDjg5fjg63jg4jjgrPjg6sgKi9cbiAgcHJvdG86ICd0Y3AnIHwgJ3VkcCc7XG4gIC8qKiDjg5XjgqHjgqTjg6vjg63jg4Pjgq8gKi9cbiAgZmxvY2s6IGJvb2xlYW47XG4gIC8qKiDpnZ7lkIzmnJ/mm7jjgY3ovrzjgb8gKi9cbiAgYXN5bmM6IGJvb2xlYW47XG59XG5cbi8qKlxuICogU01CL0NJRlMg44Oe44Km44Oz44OI44Kq44OX44K344On44Oz6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU01CTW91bnRPcHRpb25zIHtcbiAgLyoqIFNNQuODkOODvOOCuOODp+ODsyAqL1xuICB2ZXJzOiBzdHJpbmc7XG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjg6Ljg7zjg4kgKi9cbiAgc2VjOiAnbnRsbXNzcCcgfCAna3JiNScgfCAna3JiNWknIHwgJ2tyYjVwJztcbiAgLyoqIOODleOCoeOCpOODq+ODouODvOODiSAqL1xuICBmaWxlTW9kZTogc3RyaW5nO1xuICAvKiog44OH44Kj44Os44Kv44OI44Oq44Oi44O844OJICovXG4gIGRpck1vZGU6IHN0cmluZztcbiAgLyoqIFVJRCAqL1xuICB1aWQ6IG51bWJlcjtcbiAgLyoqIEdJRCAqL1xuICBnaWQ6IG51bWJlcjtcbiAgLyoqIOOCreODo+ODg+OCt+ODpeODouODvOODiSAqL1xuICBjYWNoZTogJ3N0cmljdCcgfCAnbG9vc2UnIHwgJ25vbmUnO1xuICAvKiog5rC457aa55qE44OP44Oz44OJ44OrICovXG4gIHBlcnNpc3RlbnRoYW5kbGVzOiBib29sZWFuO1xuICAvKiog5b6p5YWD5Yqb44Gu44GC44KL44OP44Oz44OJ44OrICovXG4gIHJlc2lsaWVudGhhbmRsZXM6IGJvb2xlYW47XG59XG5cbi8qKlxuICog44Oc44Oq44Ol44O844Og6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVm9sdW1lQ29uZmlnIHtcbiAgLyoqIOODnOODquODpeODvOODoOWQjSAqL1xuICBuYW1lOiBzdHJpbmc7XG4gIC8qKiDjg57jgqbjg7Pjg4jjg53jgqTjg7Pjg4ggKi9cbiAgbW91bnRQb2ludDogc3RyaW5nO1xuICAvKiog44OX44Ot44OI44Kz44OrICovXG4gIHByb3RvY29sOiAnTkZTJyB8ICdTTUInO1xuICAvKiogRlN4IOODkeOCuSAqL1xuICBmc3hQYXRoOiBzdHJpbmc7XG4gIC8qKiDjg57jgqbjg7Pjg4jjgqrjg5fjgrfjg6fjg7MgKi9cbiAgbW91bnRPcHRpb25zOiBORlNNb3VudE9wdGlvbnMgfCBTTUJNb3VudE9wdGlvbnM7XG4gIC8qKiDoh6rli5Xjg57jgqbjg7Pjg4ggKi9cbiAgYXV0b01vdW50OiBib29sZWFuO1xuICAvKiog5qip6ZmQ6Kit5a6aICovXG4gIHBlcm1pc3Npb25zOiB7XG4gICAgb3duZXI6IHN0cmluZztcbiAgICBncm91cDogc3RyaW5nO1xuICAgIG1vZGU6IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiBGU3ggT05UQVDntbHlkIjjg6zjgqTjg6Tjg7zjgq/jg6njgrlcbiAqL1xuZXhwb3J0IGNsYXNzIEZTeE9OVEFQSW50ZWdyYXRpb25MYXllciBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKiBGU3gg44OV44Kh44Kk44Or44K344K544OG44OgSUQgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZpbGVTeXN0ZW1JZDogc3RyaW5nO1xuICAvKiogU1ZNIElEICovXG4gIHB1YmxpYyByZWFkb25seSBzdm1JZDogc3RyaW5nO1xuICAvKiog44Oe44Km44Oz44OI6Kit5a6aICovXG4gIHB1YmxpYyByZWFkb25seSBtb3VudENvbmZpZzogRlN4TW91bnRDb25maWc7XG4gIC8qKiDjg5zjg6rjg6Xjg7zjg6DoqK3lrprjg6rjgrnjg4ggKi9cbiAgcHVibGljIHJlYWRvbmx5IHZvbHVtZUNvbmZpZ3M6IFZvbHVtZUNvbmZpZ1tdO1xuICAvKiog44Oe44Km44Oz44OI44K544Kv44Oq44OX44OIICovXG4gIHB1YmxpYyByZWFkb25seSBtb3VudFNjcmlwdDogc3RyaW5nO1xuICAvKiog44Ki44Oz44Oe44Km44Oz44OI44K544Kv44Oq44OX44OIICovXG4gIHB1YmxpYyByZWFkb25seSB1bm1vdW50U2NyaXB0OiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IHtcbiAgICB2cGM6IGVjMi5JVnBjO1xuICAgIGVtYmVkZGluZ0NvbmZpZzogRXh0ZW5kZWRFbWJlZGRpbmdDb25maWc7XG4gICAgc2VjdXJpdHlHcm91cD86IGVjMi5JU2VjdXJpdHlHcm91cDtcbiAgfSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLmZpbGVTeXN0ZW1JZCA9IHByb3BzLmVtYmVkZGluZ0NvbmZpZy5mc3hNb3VudENvbmZpZy5maWxlU3lzdGVtSWQ7XG4gICAgdGhpcy5zdm1JZCA9IHByb3BzLmVtYmVkZGluZ0NvbmZpZy5mc3hNb3VudENvbmZpZy5zdm1JZDtcbiAgICB0aGlzLm1vdW50Q29uZmlnID0gcHJvcHMuZW1iZWRkaW5nQ29uZmlnLmZzeE1vdW50Q29uZmlnO1xuXG4gICAgLy8g44Oc44Oq44Ol44O844Og6Kit5a6a44Gu55Sf5oiQXG4gICAgdGhpcy52b2x1bWVDb25maWdzID0gdGhpcy5jcmVhdGVWb2x1bWVDb25maWdzKCk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjga7kvZzmiJDjgb7jgZ/jga/kvb/nlKhcbiAgICBjb25zdCBzZWN1cml0eUdyb3VwID0gcHJvcHMuc2VjdXJpdHlHcm91cCB8fCB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXAocHJvcHMudnBjKTtcblxuICAgIC8vIOODnuOCpuODs+ODiOOCueOCr+ODquODl+ODiOOBrueUn+aIkFxuICAgIHRoaXMubW91bnRTY3JpcHQgPSB0aGlzLmdlbmVyYXRlTW91bnRTY3JpcHQoKTtcbiAgICB0aGlzLnVubW91bnRTY3JpcHQgPSB0aGlzLmdlbmVyYXRlVW5tb3VudFNjcmlwdCgpO1xuXG4gICAgLy8gU1NN44OR44Op44Oh44O844K/44Go44GX44Gm44K544Kv44Oq44OX44OI44KS5L+d5a2YXG4gICAgdGhpcy5jcmVhdGVTU01QYXJhbWV0ZXJzKCk7XG5cbiAgICAvLyBJQU3jg63jg7zjg6vjga7kvZzmiJBcbiAgICB0aGlzLmNyZWF0ZUlBTVJvbGUoKTtcblxuICAgIC8vIOWHuuWKm+OBruS9nOaIkFxuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODnOODquODpeODvOODoOioreWumuOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVWb2x1bWVDb25maWdzKCk6IFZvbHVtZUNvbmZpZ1tdIHtcbiAgICBjb25zdCBjb25maWdzOiBWb2x1bWVDb25maWdbXSA9IFtdO1xuXG4gICAgLy8g44OJ44Kt44Ol44Oh44Oz44OI44Oc44Oq44Ol44O844Og77yIU01CL0NJRlPvvIlcbiAgICBjb25maWdzLnB1c2goe1xuICAgICAgbmFtZTogJ2RvY3VtZW50cycsXG4gICAgICBtb3VudFBvaW50OiB0aGlzLm1vdW50Q29uZmlnLnZvbHVtZXMuZG9jdW1lbnRzLm1vdW50UG9pbnQsXG4gICAgICBwcm90b2NvbDogJ1NNQicsXG4gICAgICBmc3hQYXRoOiB0aGlzLm1vdW50Q29uZmlnLnZvbHVtZXMuZG9jdW1lbnRzLnBhdGgsXG4gICAgICBtb3VudE9wdGlvbnM6IHRoaXMuZ2V0T3B0aW1pemVkU01CT3B0aW9ucygpLFxuICAgICAgYXV0b01vdW50OiB0cnVlLFxuICAgICAgcGVybWlzc2lvbnM6IHtcbiAgICAgICAgb3duZXI6ICd1YnVudHUnLFxuICAgICAgICBncm91cDogJ3VidW50dScsXG4gICAgICAgIG1vZGU6ICcwNzU1J1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g5Z+L44KB6L6844G/44Oc44Oq44Ol44O844Og77yITkZT77yJXG4gICAgY29uZmlncy5wdXNoKHtcbiAgICAgIG5hbWU6ICdlbWJlZGRpbmdzJyxcbiAgICAgIG1vdW50UG9pbnQ6IHRoaXMubW91bnRDb25maWcudm9sdW1lcy5lbWJlZGRpbmdzLm1vdW50UG9pbnQsXG4gICAgICBwcm90b2NvbDogJ05GUycsXG4gICAgICBmc3hQYXRoOiB0aGlzLm1vdW50Q29uZmlnLnZvbHVtZXMuZW1iZWRkaW5ncy5wYXRoLFxuICAgICAgbW91bnRPcHRpb25zOiB0aGlzLmdldE9wdGltaXplZE5GU09wdGlvbnMoKSxcbiAgICAgIGF1dG9Nb3VudDogdHJ1ZSxcbiAgICAgIHBlcm1pc3Npb25zOiB7XG4gICAgICAgIG93bmVyOiAndWJ1bnR1JyxcbiAgICAgICAgZ3JvdXA6ICd1YnVudHUnLFxuICAgICAgICBtb2RlOiAnMDc1NSdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOOCpOODs+ODh+ODg+OCr+OCueODnOODquODpeODvOODoO+8iE5GU++8iVxuICAgIGNvbmZpZ3MucHVzaCh7XG4gICAgICBuYW1lOiAnaW5kZXgnLFxuICAgICAgbW91bnRQb2ludDogdGhpcy5tb3VudENvbmZpZy52b2x1bWVzLmluZGV4Lm1vdW50UG9pbnQsXG4gICAgICBwcm90b2NvbDogJ05GUycsXG4gICAgICBmc3hQYXRoOiB0aGlzLm1vdW50Q29uZmlnLnZvbHVtZXMuaW5kZXgucGF0aCxcbiAgICAgIG1vdW50T3B0aW9uczogdGhpcy5nZXRPcHRpbWl6ZWRORlNPcHRpb25zKCksXG4gICAgICBhdXRvTW91bnQ6IHRydWUsXG4gICAgICBwZXJtaXNzaW9uczoge1xuICAgICAgICBvd25lcjogJ3VidW50dScsXG4gICAgICAgIGdyb3VwOiAndWJ1bnR1JyxcbiAgICAgICAgbW9kZTogJzA3NTUnXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29uZmlncztcbiAgfVxuXG4gIC8qKlxuICAgKiDmnIDpganljJbjgZXjgozjgZ9ORlPjg57jgqbjg7Pjg4jjgqrjg5fjgrfjg6fjg7Pjga7lj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0T3B0aW1pemVkTkZTT3B0aW9ucygpOiBORlNNb3VudE9wdGlvbnMge1xuICAgIHJldHVybiB7XG4gICAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmnIDpganljJboqK3lrppcbiAgICAgIHJzaXplOiAxMDQ4NTc2LCAgICAgICAgLy8gMU1C6Kqt44G/5Y+W44KK44K144Kk44K677yI5pyA5aSn44OR44OV44Kp44O844Oe44Oz44K577yJXG4gICAgICB3c2l6ZTogMTA0ODU3NiwgICAgICAgIC8vIDFNQuabuOOBjei+vOOBv+OCteOCpOOCuu+8iOacgOWkp+ODkeODleOCqeODvOODnuODs+OCue+8iVxuICAgICAgXG4gICAgICAvLyDkv6HpoLzmgKfoqK3lrppcbiAgICAgIGhhcmQ6IHRydWUsICAgICAgICAgICAgLy8g44OP44O844OJ44Oe44Km44Oz44OI77yI44K144O844OQ44O85b6p5pen44G+44Gn5b6F5qmf77yJXG4gICAgICBpbnRyOiB0cnVlLCAgICAgICAgICAgIC8vIOWJsuOCiui+vOOBv+WPr+iDve+8iEN0cmwrQ+OBp+S4reaWreWPr+iDve+8iVxuICAgICAgXG4gICAgICAvLyDjgr/jgqTjg6DjgqLjgqbjg4joqK3lrppcbiAgICAgIHRpbWVvOiA2MDAsICAgICAgICAgICAgLy8gMTDliIbjgr/jgqTjg6DjgqLjgqbjg4jvvIjlpKflrrnph4/jg5XjgqHjgqTjg6vlr77lv5zvvIlcbiAgICAgIHJldHJhbnM6IDIsICAgICAgICAgICAgLy8g44Oq44OI44Op44Kk5Zue5pWw77yI44ON44OD44OI44Ov44O844Kv6Zqc5a6z5a++5b+c77yJXG4gICAgICBcbiAgICAgIC8vIOODl+ODreODiOOCs+ODq+ioreWumlxuICAgICAgbmZzdmVyczogJzQuMScsICAgICAgICAvLyBORlMgdjQuMe+8iOacgOaWsOOBruWuieWumueJiO+8iVxuICAgICAgcHJvdG86ICd0Y3AnLCAgICAgICAgICAvLyBUQ1Dkvb/nlKjvvIjkv6HpoLzmgKfph43oppbvvIlcbiAgICAgIFxuICAgICAgLy8g44OV44Kh44Kk44Or44K344K544OG44Og6Kit5a6aXG4gICAgICBmbG9jazogdHJ1ZSwgICAgICAgICAgIC8vIOODleOCoeOCpOODq+ODreODg+OCr+acieWKuVxuICAgICAgYXN5bmM6IGZhbHNlICAgICAgICAgICAvLyDlkIzmnJ/mm7jjgY3ovrzjgb/vvIjjg4fjg7zjgr/mlbTlkIjmgKfph43oppbvvIlcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOacgOmBqeWMluOBleOCjOOBn1NNQuODnuOCpuODs+ODiOOCquODl+OCt+ODp+ODs+OBruWPluW+l1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRPcHRpbWl6ZWRTTUJPcHRpb25zKCk6IFNNQk1vdW50T3B0aW9ucyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIOODl+ODreODiOOCs+ODq+ioreWumlxuICAgICAgdmVyczogJzMuMCcsICAgICAgICAgICAvLyBTTUIgMy4w77yI44OR44OV44Kp44O844Oe44Oz44K544Go5LqS5o+b5oCn44Gu44OQ44Op44Oz44K577yJXG4gICAgICBzZWM6ICdudGxtc3NwJywgICAgICAgIC8vIE5UTE3oqo3oqLzvvIhBY3RpdmUgRGlyZWN0b3J557Wx5ZCI77yJXG4gICAgICBcbiAgICAgIC8vIOaoqemZkOioreWumlxuICAgICAgZmlsZU1vZGU6ICcwNjQ0JywgICAgICAvLyDjg5XjgqHjgqTjg6vmqKnpmZBcbiAgICAgIGRpck1vZGU6ICcwNzU1JywgICAgICAgLy8g44OH44Kj44Os44Kv44OI44Oq5qip6ZmQXG4gICAgICB1aWQ6IDEwMDAsICAgICAgICAgICAgIC8vIHVidW50dSDjg6bjg7zjgrbjg7xcbiAgICAgIGdpZDogMTAwMCwgICAgICAgICAgICAgLy8gdWJ1bnR1IOOCsOODq+ODvOODl1xuICAgICAgXG4gICAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqK3lrppcbiAgICAgIGNhY2hlOiAnc3RyaWN0JywgICAgICAgLy8g5Y6z5a+G44Kt44Oj44OD44K344Ol77yI44OH44O844K/5pW05ZCI5oCn6YeN6KaW77yJXG4gICAgICBwZXJzaXN0ZW50aGFuZGxlczogdHJ1ZSwgIC8vIOawuOe2mueahOODj+ODs+ODieODq++8iOaOpee2muWuieWumuaAp++8iVxuICAgICAgcmVzaWxpZW50aGFuZGxlczogdHJ1ZSAgICAvLyDlvqnlhYPlipvjga7jgYLjgovjg4/jg7Pjg4njg6vvvIjpmpzlrrPlm57lvqnvvIlcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTZWN1cml0eUdyb3VwKHZwYzogZWMyLklWcGMpOiBlYzIuU2VjdXJpdHlHcm91cCB7XG4gICAgY29uc3Qgc2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnRlN4U2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IE9OVEFQ57Wx5ZCI44Os44Kk44Ok44O855So44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWVcbiAgICB9KTtcblxuICAgIC8vIE5GU+eUqOODneODvOODiO+8iDIwNDnvvIlcbiAgICBzZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuaXB2NCh2cGMudnBjQ2lkckJsb2NrKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCgyMDQ5KSxcbiAgICAgICdORlMg44Ki44Kv44K744K555SoJ1xuICAgICk7XG5cbiAgICAvLyBTTUIvQ0lGU+eUqOODneODvOODiO+8iDQ0Ne+8iVxuICAgIHNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0NSksXG4gICAgICAnU01CL0NJRlMg44Ki44Kv44K744K555SoJ1xuICAgICk7XG5cbiAgICAvLyBGU3jnrqHnkIbnlKjjg53jg7zjg4jvvIgxMTEsIDYzNSwgNDA0NSwgNDA0Nu+8iVxuICAgIFsxMTEsIDYzNSwgNDA0NSwgNDA0Nl0uZm9yRWFjaChwb3J0ID0+IHtcbiAgICAgIHNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICAgIGVjMi5QZWVyLmlwdjQodnBjLnZwY0NpZHJCbG9jayksXG4gICAgICAgIGVjMi5Qb3J0LnRjcChwb3J0KSxcbiAgICAgICAgYEZTeOeuoeeQhuODneODvOODiCAke3BvcnR9YFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzZWN1cml0eUdyb3VwO1xuICB9XG5cbiAgLyoqXG4gICAqIOODnuOCpuODs+ODiOOCueOCr+ODquODl+ODiOOBrueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZU1vdW50U2NyaXB0KCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2NyaXB0TGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgc2NyaXB0TGluZXMucHVzaCgnIyEvYmluL2Jhc2gnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIEZTeCBPTlRBUCDntbHlkIjjg6zjgqTjg6Tjg7wgLSDjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4gnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIOiHquWLleeUn+aIkOOBleOCjOOBn+OCueOCr+ODquODl+ODiCAtIOaJi+WLlee3qOmbhuOBl+OBquOBhOOBp+OBj+OBoOOBleOBhCcpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ3NldCAtZScpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2VjaG8gXCI9PT0gRlN4IE9OVEFQIOODnOODquODpeODvOODoOODnuOCpuODs+ODiOmWi+WniyA9PT1cIicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuXG4gICAgLy8g5b+F6KaB44Gq44OR44OD44Kx44O844K444Gu44Kk44Oz44K544OI44O844OrXG4gICAgc2NyaXB0TGluZXMucHVzaCgnIyDlv4XopoHjgarjg5Hjg4PjgrHjg7zjgrjjga7jgqTjg7Pjgrnjg4jjg7zjg6snKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdlY2hvIFwi5b+F6KaB44Gq44OR44OD44Kx44O844K444KS44Kk44Oz44K544OI44O844Or5LitLi4uXCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdzdWRvIGFwdC1nZXQgdXBkYXRlIC1xJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnc3VkbyBhcHQtZ2V0IGluc3RhbGwgLXkgbmZzLWNvbW1vbiBjaWZzLXV0aWxzJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnJyk7XG5cbiAgICAvLyBGU3gg44Ko44Oz44OJ44Od44Kk44Oz44OI44Gu5Y+W5b6XXG4gICAgc2NyaXB0TGluZXMucHVzaCgnIyBGU3gg44Ko44Oz44OJ44Od44Kk44Oz44OI44Gu5Y+W5b6XJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaChgRlNYX0ROU19OQU1FPSQoYXdzIGZzeCBkZXNjcmliZS1maWxlLXN5c3RlbXMgLS1maWxlLXN5c3RlbS1pZHMgJHt0aGlzLmZpbGVTeXN0ZW1JZH0gLS1xdWVyeSAnRmlsZVN5c3RlbXNbMF0uT250YXBDb25maWd1cmF0aW9uLkVuZHBvaW50cy5NYW5hZ2VtZW50LkROU05hbWUnIC0tb3V0cHV0IHRleHQgLS1yZWdpb24gXFwke0FXU19SRUdJT046LXVzLWVhc3QtMX0pYCk7XG4gICAgc2NyaXB0TGluZXMucHVzaChgU1ZNX0ROU19OQU1FPSQoYXdzIGZzeCBkZXNjcmliZS1zdG9yYWdlLXZpcnR1YWwtbWFjaGluZXMgLS1zdG9yYWdlLXZpcnR1YWwtbWFjaGluZS1pZHMgJHt0aGlzLnN2bUlkfSAtLXF1ZXJ5ICdTdG9yYWdlVmlydHVhbE1hY2hpbmVzWzBdLkVuZHBvaW50cy5OZnMuRE5TTmFtZScgLS1vdXRwdXQgdGV4dCAtLXJlZ2lvbiBcXCR7QVdTX1JFR0lPTjotdXMtZWFzdC0xfSlgKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcnKTtcblxuICAgIC8vIOWQhOODnOODquODpeODvOODoOOBruODnuOCpuODs+ODiFxuICAgIHRoaXMudm9sdW1lQ29uZmlncy5mb3JFYWNoKGNvbmZpZyA9PiB7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGAjICR7Y29uZmlnLm5hbWV944Oc44Oq44Ol44O844Og44Gu44Oe44Km44Oz44OIYCk7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGBlY2hvIFwiJHtjb25maWcubmFtZX3jg5zjg6rjg6Xjg7zjg6DjgpLjg57jgqbjg7Pjg4jkuK0uLi5cImApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgc3VkbyBta2RpciAtcCAke2NvbmZpZy5tb3VudFBvaW50fWApO1xuICAgICAgXG4gICAgICBpZiAoY29uZmlnLnByb3RvY29sID09PSAnTkZTJykge1xuICAgICAgICBjb25zdCBuZnNPcHRpb25zID0gY29uZmlnLm1vdW50T3B0aW9ucyBhcyBORlNNb3VudE9wdGlvbnM7XG4gICAgICAgIGNvbnN0IG9wdGlvbnNTdHIgPSBbXG4gICAgICAgICAgYHJzaXplPSR7bmZzT3B0aW9ucy5yc2l6ZX1gLFxuICAgICAgICAgIGB3c2l6ZT0ke25mc09wdGlvbnMud3NpemV9YCxcbiAgICAgICAgICBuZnNPcHRpb25zLmhhcmQgPyAnaGFyZCcgOiAnc29mdCcsXG4gICAgICAgICAgbmZzT3B0aW9ucy5pbnRyID8gJ2ludHInIDogJ25vaW50cicsXG4gICAgICAgICAgYHRpbWVvPSR7bmZzT3B0aW9ucy50aW1lb31gLFxuICAgICAgICAgIGByZXRyYW5zPSR7bmZzT3B0aW9ucy5yZXRyYW5zfWAsXG4gICAgICAgICAgYG5mc3ZlcnM9JHtuZnNPcHRpb25zLm5mc3ZlcnN9YCxcbiAgICAgICAgICBgcHJvdG89JHtuZnNPcHRpb25zLnByb3RvfWAsXG4gICAgICAgICAgbmZzT3B0aW9ucy5mbG9jayA/ICdmbG9jaycgOiAnbm9mbG9jaycsXG4gICAgICAgICAgbmZzT3B0aW9ucy5hc3luYyA/ICdhc3luYycgOiAnc3luYydcbiAgICAgICAgXS5qb2luKCcsJyk7XG4gICAgICAgIFxuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKGBzdWRvIG1vdW50IC10IG5mczQgLW8gJHtvcHRpb25zU3RyfSAkU1ZNX0ROU19OQU1FOiR7Y29uZmlnLmZzeFBhdGh9ICR7Y29uZmlnLm1vdW50UG9pbnR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzbWJPcHRpb25zID0gY29uZmlnLm1vdW50T3B0aW9ucyBhcyBTTUJNb3VudE9wdGlvbnM7XG4gICAgICAgIGNvbnN0IG9wdGlvbnNTdHIgPSBbXG4gICAgICAgICAgYHZlcnM9JHtzbWJPcHRpb25zLnZlcnN9YCxcbiAgICAgICAgICBgc2VjPSR7c21iT3B0aW9ucy5zZWN9YCxcbiAgICAgICAgICBgZmlsZV9tb2RlPSR7c21iT3B0aW9ucy5maWxlTW9kZX1gLFxuICAgICAgICAgIGBkaXJfbW9kZT0ke3NtYk9wdGlvbnMuZGlyTW9kZX1gLFxuICAgICAgICAgIGB1aWQ9JHtzbWJPcHRpb25zLnVpZH1gLFxuICAgICAgICAgIGBnaWQ9JHtzbWJPcHRpb25zLmdpZH1gLFxuICAgICAgICAgIGBjYWNoZT0ke3NtYk9wdGlvbnMuY2FjaGV9YCxcbiAgICAgICAgICBzbWJPcHRpb25zLnBlcnNpc3RlbnRoYW5kbGVzID8gJ3BlcnNpc3RlbnRoYW5kbGVzJyA6ICdub3BlcnNpc3RlbnRoYW5kbGVzJyxcbiAgICAgICAgICBzbWJPcHRpb25zLnJlc2lsaWVudGhhbmRsZXMgPyAncmVzaWxpZW50aGFuZGxlcycgOiAnbm9yZXNpbGllbnRoYW5kbGVzJ1xuICAgICAgICBdLmpvaW4oJywnKTtcbiAgICAgICAgXG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goYHN1ZG8gbW91bnQgLXQgY2lmcyAtbyAke29wdGlvbnNTdHJ9IC8vJEZTWF9ETlNfTkFNRSR7Y29uZmlnLmZzeFBhdGh9ICR7Y29uZmlnLm1vdW50UG9pbnR9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNjcmlwdExpbmVzLnB1c2goYHN1ZG8gY2hvd24gJHtjb25maWcucGVybWlzc2lvbnMub3duZXJ9OiR7Y29uZmlnLnBlcm1pc3Npb25zLmdyb3VwfSAke2NvbmZpZy5tb3VudFBvaW50fWApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgc3VkbyBjaG1vZCAke2NvbmZpZy5wZXJtaXNzaW9ucy5tb2RlfSAke2NvbmZpZy5tb3VudFBvaW50fWApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgZWNobyBcIuKchSAke2NvbmZpZy5uYW1lfeODnOODquODpeODvOODoOODnuOCpuODs+ODiOWujOS6hjogJHtjb25maWcubW91bnRQb2ludH1cImApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaCgnJyk7XG4gICAgfSk7XG5cbiAgICAvLyDjg57jgqbjg7Pjg4jnirbmhYvjga7norroqo1cbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIOODnuOCpuODs+ODiOeKtuaFi+OBrueiuuiqjScpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2VjaG8gXCI9PT0g44Oe44Km44Oz44OI54q25oWL56K66KqNID09PVwiJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnZGYgLWggfCBncmVwIC1FIFwiKG5mc3xjaWZzKVwiIHx8IGVjaG8gXCLjg57jgqbjg7Pjg4jjgZXjgozjgZ9GU3jjg5zjg6rjg6Xjg7zjg6DjgYzopovjgaTjgYvjgorjgb7jgZvjgpNcIicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuXG4gICAgLy8gZnN0YWLjgqjjg7Pjg4jjg6rjga7kvZzmiJDvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIGZzdGFi44Ko44Oz44OI44Oq44Gu5L2c5oiQ77yI5rC457aa5YyW77yJJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnaWYgWyBcIiRDUkVBVEVfRlNUQUJfRU5UUklFU1wiID0gXCJ0cnVlXCIgXTsgdGhlbicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJyAgZWNobyBcImZzdGFi44Ko44Oz44OI44Oq44KS5L2c5oiQ5LitLi4uXCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcgIHN1ZG8gY3AgL2V0Yy9mc3RhYiAvZXRjL2ZzdGFiLmJhY2t1cC4kKGRhdGUgKyVZJW0lZF8lSCVNJVMpJyk7XG4gICAgXG4gICAgdGhpcy52b2x1bWVDb25maWdzLmZvckVhY2goY29uZmlnID0+IHtcbiAgICAgIGlmIChjb25maWcucHJvdG9jb2wgPT09ICdORlMnKSB7XG4gICAgICAgIGNvbnN0IG5mc09wdGlvbnMgPSBjb25maWcubW91bnRPcHRpb25zIGFzIE5GU01vdW50T3B0aW9ucztcbiAgICAgICAgY29uc3Qgb3B0aW9uc1N0ciA9IFtcbiAgICAgICAgICBgcnNpemU9JHtuZnNPcHRpb25zLnJzaXplfWAsXG4gICAgICAgICAgYHdzaXplPSR7bmZzT3B0aW9ucy53c2l6ZX1gLFxuICAgICAgICAgIG5mc09wdGlvbnMuaGFyZCA/ICdoYXJkJyA6ICdzb2Z0JyxcbiAgICAgICAgICBuZnNPcHRpb25zLmludHIgPyAnaW50cicgOiAnbm9pbnRyJyxcbiAgICAgICAgICBgdGltZW89JHtuZnNPcHRpb25zLnRpbWVvfWAsXG4gICAgICAgICAgYHJldHJhbnM9JHtuZnNPcHRpb25zLnJldHJhbnN9YCxcbiAgICAgICAgICBgbmZzdmVycz0ke25mc09wdGlvbnMubmZzdmVyc31gLFxuICAgICAgICAgIGBwcm90bz0ke25mc09wdGlvbnMucHJvdG99YCxcbiAgICAgICAgICBuZnNPcHRpb25zLmZsb2NrID8gJ2Zsb2NrJyA6ICdub2Zsb2NrJyxcbiAgICAgICAgICBuZnNPcHRpb25zLmFzeW5jID8gJ2FzeW5jJyA6ICdzeW5jJ1xuICAgICAgICBdLmpvaW4oJywnKTtcbiAgICAgICAgXG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goYCAgZWNobyBcIiRTVk1fRE5TX05BTUU6JHtjb25maWcuZnN4UGF0aH0gJHtjb25maWcubW91bnRQb2ludH0gbmZzNCAke29wdGlvbnNTdHJ9IDAgMFwiIHwgc3VkbyB0ZWUgLWEgL2V0Yy9mc3RhYmApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIHNjcmlwdExpbmVzLnB1c2goJ2ZpJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnJyk7XG5cbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdlY2hvIFwiPT09IEZTeCBPTlRBUCDjg5zjg6rjg6Xjg7zjg6Djg57jgqbjg7Pjg4jlrozkuoYgPT09XCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcnKTtcblxuICAgIHJldHVybiBzY3JpcHRMaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqLjg7Pjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4jjga7nlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVVbm1vdW50U2NyaXB0KCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2NyaXB0TGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgc2NyaXB0TGluZXMucHVzaCgnIyEvYmluL2Jhc2gnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIEZTeCBPTlRBUCDntbHlkIjjg6zjgqTjg6Tjg7wgLSDjgqLjg7Pjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4gnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIOiHquWLleeUn+aIkOOBleOCjOOBn+OCueOCr+ODquODl+ODiCAtIOaJi+WLlee3qOmbhuOBl+OBquOBhOOBp+OBj+OBoOOBleOBhCcpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ3NldCAtZScpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2VjaG8gXCI9PT0gRlN4IE9OVEFQIOODnOODquODpeODvOODoOOCouODs+ODnuOCpuODs+ODiOmWi+WniyA9PT1cIicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuXG4gICAgLy8g5ZCE44Oc44Oq44Ol44O844Og44Gu44Ki44Oz44Oe44Km44Oz44OI77yI6YCG6aCG77yJXG4gICAgWy4uLnRoaXMudm9sdW1lQ29uZmlnc10ucmV2ZXJzZSgpLmZvckVhY2goY29uZmlnID0+IHtcbiAgICAgIHNjcmlwdExpbmVzLnB1c2goYCMgJHtjb25maWcubmFtZX3jg5zjg6rjg6Xjg7zjg6Djga7jgqLjg7Pjg57jgqbjg7Pjg4hgKTtcbiAgICAgIHNjcmlwdExpbmVzLnB1c2goYGVjaG8gXCIke2NvbmZpZy5uYW1lfeODnOODquODpeODvOODoOOCkuOCouODs+ODnuOCpuODs+ODiOS4rS4uLlwiYCk7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGBpZiBtb3VudHBvaW50IC1xICR7Y29uZmlnLm1vdW50UG9pbnR9OyB0aGVuYCk7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGAgIHN1ZG8gdW1vdW50ICR7Y29uZmlnLm1vdW50UG9pbnR9YCk7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGAgIGVjaG8gXCLinIUgJHtjb25maWcubmFtZX3jg5zjg6rjg6Xjg7zjg6DjgqLjg7Pjg57jgqbjg7Pjg4jlrozkuoZcImApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgZWxzZWApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgICBlY2hvIFwi4pqg77iPICAke2NvbmZpZy5uYW1lfeODnOODquODpeODvOODoOOBr+ODnuOCpuODs+ODiOOBleOCjOOBpuOBhOOBvuOBm+OCk1wiYCk7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGBmaWApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaCgnJyk7XG4gICAgfSk7XG5cbiAgICAvLyBmc3RhYuOCqOODs+ODiOODquOBruWJiumZpO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIHNjcmlwdExpbmVzLnB1c2goJyMgZnN0YWLjgqjjg7Pjg4jjg6rjga7liYrpmaQnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdpZiBbIFwiJFJFTU9WRV9GU1RBQl9FTlRSSUVTXCIgPSBcInRydWVcIiBdOyB0aGVuJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnICBlY2hvIFwiZnN0YWLjgqjjg7Pjg4jjg6rjgpLliYrpmaTkuK0uLi5cIicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJyAgc3VkbyBjcCAvZXRjL2ZzdGFiIC9ldGMvZnN0YWIuYmFja3VwLiQoZGF0ZSArJVklbSVkXyVIJU0lUyknKTtcbiAgICBcbiAgICB0aGlzLnZvbHVtZUNvbmZpZ3MuZm9yRWFjaChjb25maWcgPT4ge1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgICBzdWRvIHNlZCAtaSBcIlxcXFx8JHtjb25maWcubW91bnRQb2ludH18ZFwiIC9ldGMvZnN0YWJgKTtcbiAgICB9KTtcbiAgICBcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdmaScpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuXG4gICAgc2NyaXB0TGluZXMucHVzaCgnZWNobyBcIj09PSBGU3ggT05UQVAg44Oc44Oq44Ol44O844Og44Ki44Oz44Oe44Km44Oz44OI5a6M5LqGID09PVwiJyk7XG4gICAgc2NyaXB0TGluZXMucHVzaCgnJyk7XG5cbiAgICByZXR1cm4gc2NyaXB0TGluZXMuam9pbignXFxuJyk7XG4gIH1cblxuICAvKipcbiAgICogU1NN44OR44Op44Oh44O844K/44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNTTVBhcmFtZXRlcnMoKTogdm9pZCB7XG4gICAgLy8g44Oe44Km44Oz44OI44K544Kv44Oq44OX44OIXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ01vdW50U2NyaXB0Jywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9mc3gtb250YXAvJHt0aGlzLmZpbGVTeXN0ZW1JZH0vbW91bnQtc2NyaXB0YCxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLm1vdW50U2NyaXB0LFxuICAgICAgZGVzY3JpcHRpb246ICdGU3ggT05UQVAg44Oc44Oq44Ol44O844Og44Oe44Km44Oz44OI44K544Kv44Oq44OX44OIJyxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLkFEVkFOQ0VEXG4gICAgfSk7XG5cbiAgICAvLyDjgqLjg7Pjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4hcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnVW5tb3VudFNjcmlwdCcsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvZnN4LW9udGFwLyR7dGhpcy5maWxlU3lzdGVtSWR9L3VubW91bnQtc2NyaXB0YCxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLnVubW91bnRTY3JpcHQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBPTlRBUCDjg5zjg6rjg6Xjg7zjg6DjgqLjg7Pjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4gnLFxuICAgICAgdGllcjogc3NtLlBhcmFtZXRlclRpZXIuQURWQU5DRURcbiAgICB9KTtcblxuICAgIC8vIOODnOODquODpeODvOODoOioreWumlxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdWb2x1bWVDb25maWcnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL2ZzeC1vbnRhcC8ke3RoaXMuZmlsZVN5c3RlbUlkfS92b2x1bWUtY29uZmlnYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeSh0aGlzLnZvbHVtZUNvbmZpZ3MsIG51bGwsIDIpLFxuICAgICAgZGVzY3JpcHRpb246ICdGU3ggT05UQVAg44Oc44Oq44Ol44O844Og6Kit5a6aJyxcbiAgICAgIHRpZXI6IHNzbS5QYXJhbWV0ZXJUaWVyLkFEVkFOQ0VEXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSUFN44Ot44O844Or44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUlBTVJvbGUoKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0ZTeEludGVncmF0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlYzIuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdGU3ggT05UQVDntbHlkIjjg6zjgqTjg6Tjg7znlKhJQU3jg63jg7zjg6snLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZScpXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBGU3joqq3jgb/lj5bjgormqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2ZzeDpEZXNjcmliZUZpbGVTeXN0ZW1zJyxcbiAgICAgICAgJ2ZzeDpEZXNjcmliZVN0b3JhZ2VWaXJ0dWFsTWFjaGluZXMnLFxuICAgICAgICAnZnN4OkRlc2NyaWJlVm9sdW1lcydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgLy8gU1NN44OR44Op44Oh44O844K/6Kqt44G/5Y+W44KK5qip6ZmQXG4gICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzQnlQYXRoJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpzc206KjoqOnBhcmFtZXRlci9mc3gtb250YXAvJHt0aGlzLmZpbGVTeXN0ZW1JZH0vKmBcbiAgICAgIF1cbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlh7rlipvjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdGaWxlU3lzdGVtSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5maWxlU3lzdGVtSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBPTlRBUCDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6BJRCdcbiAgICB9KTtcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1N2bUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3ZtSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0ZTeCBPTlRBUCBTVk0gSUQnXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdNb3VudFNjcmlwdFBhcmFtZXRlcicsIHtcbiAgICAgIHZhbHVlOiBgL2ZzeC1vbnRhcC8ke3RoaXMuZmlsZVN5c3RlbUlkfS9tb3VudC1zY3JpcHRgLFxuICAgICAgZGVzY3JpcHRpb246ICfjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4hTU03jg5Hjg6njg6Hjg7zjgr/lkI0nXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdVbm1vdW50U2NyaXB0UGFyYW1ldGVyJywge1xuICAgICAgdmFsdWU6IGAvZnN4LW9udGFwLyR7dGhpcy5maWxlU3lzdGVtSWR9L3VubW91bnQtc2NyaXB0YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAn44Ki44Oz44Oe44Km44Oz44OI44K544Kv44Oq44OX44OIU1NN44OR44Op44Oh44O844K/5ZCNJ1xuICAgIH0pO1xuXG4gICAgLy8g5ZCE44Oc44Oq44Ol44O844Og44Gu44Oe44Km44Oz44OI44Od44Kk44Oz44OIXG4gICAgdGhpcy52b2x1bWVDb25maWdzLmZvckVhY2goKGNvbmZpZywgaW5kZXgpID0+IHtcbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7Y29uZmlnLm5hbWV9TW91bnRQb2ludGAsIHtcbiAgICAgICAgdmFsdWU6IGNvbmZpZy5tb3VudFBvaW50LFxuICAgICAgICBkZXNjcmlwdGlvbjogYCR7Y29uZmlnLm5hbWV944Oc44Oq44Ol44O844Og44Oe44Km44Oz44OI44Od44Kk44Oz44OIYFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Oe44Km44Oz44OI54q25oWL44Gu5qSc6Ki844K544Kv44Oq44OX44OI55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVWYWxpZGF0aW9uU2NyaXB0KCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2NyaXB0TGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgc2NyaXB0TGluZXMucHVzaCgnIyEvYmluL2Jhc2gnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIEZTeCBPTlRBUCDntbHlkIjjg6zjgqTjg6Tjg7wgLSDjg57jgqbjg7Pjg4jnirbmhYvmpJzoqLzjgrnjgq/jg6rjg5fjg4gnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdlY2hvIFwiPT09IEZTeCBPTlRBUCDjg57jgqbjg7Pjg4jnirbmhYvmpJzoqLwgPT09XCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcnKTtcblxuICAgIGxldCBhbGxNb3VudGVkID0gdHJ1ZTtcbiAgICB0aGlzLnZvbHVtZUNvbmZpZ3MuZm9yRWFjaChjb25maWcgPT4ge1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgIyAke2NvbmZpZy5uYW1lfeODnOODquODpeODvOODoOOBruaknOiovGApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgaWYgbW91bnRwb2ludCAtcSAke2NvbmZpZy5tb3VudFBvaW50fTsgdGhlbmApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgICBlY2hvIFwi4pyFICR7Y29uZmlnLm5hbWV9OiDjg57jgqbjg7Pjg4jmuIjjgb8gKCR7Y29uZmlnLm1vdW50UG9pbnR9KVwiYCk7XG4gICAgICBzY3JpcHRMaW5lcy5wdXNoKGAgIGxzIC1sYSAke2NvbmZpZy5tb3VudFBvaW50fSB8IGhlYWQgLTVgKTtcbiAgICAgIHNjcmlwdExpbmVzLnB1c2goYGVsc2VgKTtcbiAgICAgIHNjcmlwdExpbmVzLnB1c2goYCAgZWNobyBcIuKdjCAke2NvbmZpZy5uYW1lfTog44Oe44Km44Oz44OI44GV44KM44Gm44GE44G+44Gb44KTICgke2NvbmZpZy5tb3VudFBvaW50fSlcImApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgICBBTExfTU9VTlRFRD1mYWxzZWApO1xuICAgICAgc2NyaXB0TGluZXMucHVzaChgZmlgKTtcbiAgICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgIH0pO1xuXG4gICAgc2NyaXB0TGluZXMucHVzaCgnIyDlhajkvZPnmoTjgarnirbmhYvnorroqo0nKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdlY2hvIFwiPT09IOODnuOCpuODs+ODiOeKtuaFi+OCteODnuODquODvCA9PT1cIicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2RmIC1oIHwgZ3JlcCAtRSBcIihuZnN8Y2lmcylcIiB8fCBlY2hvIFwiRlN444Oc44Oq44Ol44O844Og44GM6KaL44Gk44GL44KK44G+44Gb44KTXCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCdpZiBbIFwiJEFMTF9NT1VOVEVEXCIgIT0gXCJmYWxzZVwiIF07IHRoZW4nKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcgIGVjaG8gXCLinIUg5YWo44Gm44GuRlN444Oc44Oq44Ol44O844Og44GM5q2j5bi444Gr44Oe44Km44Oz44OI44GV44KM44Gm44GE44G+44GZXCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcgIGV4aXQgMCcpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2Vsc2UnKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcgIGVjaG8gXCLinYwg5LiA6YOo44GuRlN444Oc44Oq44Ol44O844Og44GM44Oe44Km44Oz44OI44GV44KM44Gm44GE44G+44Gb44KTXCInKTtcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcgIGV4aXQgMScpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2ZpJyk7XG5cbiAgICByZXR1cm4gc2NyaXB0TGluZXMuam9pbignXFxuJyk7XG4gIH1cblxuICAvKipcbiAgICog44OR44OV44Kp44O844Oe44Oz44K544OG44K544OI44K544Kv44Oq44OX44OI55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVQZXJmb3JtYW5jZVRlc3RTY3JpcHQoKTogc3RyaW5nIHtcbiAgICBjb25zdCBzY3JpcHRMaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBzY3JpcHRMaW5lcy5wdXNoKCcjIS9iaW4vYmFzaCcpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJyMgRlN4IE9OVEFQIOe1seWQiOODrOOCpOODpOODvCAtIOODkeODleOCqeODvOODnuODs+OCueODhuOCueODiOOCueOCr+ODquODl+ODiCcpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJ2VjaG8gXCI9PT0gRlN4IE9OVEFQIOODkeODleOCqeODvOODnuODs+OCueODhuOCueODiCA9PT1cIicpO1xuICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuXG4gICAgdGhpcy52b2x1bWVDb25maWdzLmZvckVhY2goY29uZmlnID0+IHtcbiAgICAgIGlmIChjb25maWcucHJvdG9jb2wgPT09ICdORlMnKSB7XG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goYCMgJHtjb25maWcubmFtZX3jg5zjg6rjg6Xjg7zjg6DvvIhORlPvvInjga7jg5Hjg5Xjgqnjg7zjg57jg7Pjgrnjg4bjgrnjg4hgKTtcbiAgICAgICAgc2NyaXB0TGluZXMucHVzaChgZWNobyBcIvCfk4ogJHtjb25maWcubmFtZX3jg5zjg6rjg6Xjg7zjg6Djga7jg5Hjg5Xjgqnjg7zjg57jg7Pjgrnjg4bjgrnjg4jplovlp4suLi5cImApO1xuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKGBURVNUX0ZJTEU9XCIke2NvbmZpZy5tb3VudFBvaW50fS9wZXJmb3JtYW5jZV90ZXN0XyQoZGF0ZSArJXMpLnRtcFwiYCk7XG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgICAgICBcbiAgICAgICAgLy8g5pu444GN6L6844G/44OG44K544OIXG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJyMg5pu444GN6L6844G/44OG44K544OI77yIMUdC77yJJyk7XG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJ2VjaG8gXCLmm7jjgY3ovrzjgb/jg4bjgrnjg4jlrp/ooYzkuK0uLi5cIicpO1xuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKGBXUklURV9USU1FPSQodGltZSAoZGQgaWY9L2Rldi96ZXJvIG9mPVwiJFRFU1RfRklMRVwiIGJzPTFNIGNvdW50PTEwMjQgY29udj1mZGF0YXN5bmMpIDI+JjEgfCBncmVwIHJlYWwgfCBhd2sgJ3twcmludCAkMn0nKWApO1xuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKCdlY2hvIFwi5pu444GN6L6844G/5pmC6ZaTOiAkV1JJVEVfVElNRVwiJyk7XG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgICAgICBcbiAgICAgICAgLy8g6Kqt44G/5Y+W44KK44OG44K544OIXG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJyMg6Kqt44G/5Y+W44KK44OG44K544OIJyk7XG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJ2VjaG8gXCLoqq3jgb/lj5bjgorjg4bjgrnjg4jlrp/ooYzkuK0uLi5cIicpO1xuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKCdzeW5jICYmIGVjaG8gMyB8IHN1ZG8gdGVlIC9wcm9jL3N5cy92bS9kcm9wX2NhY2hlcyA+IC9kZXYvbnVsbCcpO1xuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKGBSRUFEX1RJTUU9JCh0aW1lIChkZCBpZj1cIiRURVNUX0ZJTEVcIiBvZj0vZGV2L251bGwgYnM9MU0pIDI+JjEgfCBncmVwIHJlYWwgfCBhd2sgJ3twcmludCAkMn0nKWApO1xuICAgICAgICBzY3JpcHRMaW5lcy5wdXNoKCdlY2hvIFwi6Kqt44G/5Y+W44KK5pmC6ZaTOiAkUkVBRF9USU1FXCInKTtcbiAgICAgICAgc2NyaXB0TGluZXMucHVzaCgnJyk7XG4gICAgICAgIFxuICAgICAgICAvLyDjgq/jg6rjg7zjg7PjgqLjg4Pjg5dcbiAgICAgICAgc2NyaXB0TGluZXMucHVzaChgcm0gLWYgXCIkVEVTVF9GSUxFXCJgKTtcbiAgICAgICAgc2NyaXB0TGluZXMucHVzaChgZWNobyBcIuKchSAke2NvbmZpZy5uYW1lfeODnOODquODpeODvOODoOODhuOCueODiOWujOS6hlwiYCk7XG4gICAgICAgIHNjcmlwdExpbmVzLnB1c2goJycpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgc2NyaXB0TGluZXMucHVzaCgnZWNobyBcIj09PSDjg5Hjg5Xjgqnjg7zjg57jg7Pjgrnjg4bjgrnjg4jlrozkuoYgPT09XCInKTtcblxuICAgIHJldHVybiBzY3JpcHRMaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxufVxuXG4vKipcbiAqIEZTeCBPTlRBUOe1seWQiOODpuODvOODhuOCo+ODquODhuOCo+OCr+ODqeOCuVxuICovXG5leHBvcnQgY2xhc3MgRlN4T05UQVBVdGlscyB7XG4gIC8qKlxuICAgKiBGU3gg44Ko44Oz44OJ44Od44Kk44Oz44OI5oOF5aCx44Gu5Y+W5b6XXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgZ2V0RlN4RW5kcG9pbnRzKGZpbGVTeXN0ZW1JZDogc3RyaW5nLCBzdm1JZDogc3RyaW5nLCByZWdpb246IHN0cmluZyA9ICd1cy1lYXN0LTEnKTogUHJvbWlzZTx7XG4gICAgbWFuYWdlbWVudEVuZHBvaW50OiBzdHJpbmc7XG4gICAgbmZzRW5kcG9pbnQ6IHN0cmluZztcbiAgICBzbWJFbmRwb2ludDogc3RyaW5nO1xuICB9PiB7XG4gICAgLy8g5a6f6Zqb44Gu5a6f6KOF44Gn44GvIEFXUyBTREsg44KS5L2/55SoXG4gICAgLy8g44GT44GT44Gn44Gv44OX44Os44O844K544Ob44Or44OA44O844Go44GX44Gm5Z6L5a6a576p44Gu44G/5o+Q5L6bXG4gICAgcmV0dXJuIHtcbiAgICAgIG1hbmFnZW1lbnRFbmRwb2ludDogYCR7ZmlsZVN5c3RlbUlkfS5mc3guJHtyZWdpb259LmFtYXpvbmF3cy5jb21gLFxuICAgICAgbmZzRW5kcG9pbnQ6IGAke3N2bUlkfS4ke2ZpbGVTeXN0ZW1JZH0uZnN4LiR7cmVnaW9ufS5hbWF6b25hd3MuY29tYCxcbiAgICAgIHNtYkVuZHBvaW50OiBgJHtzdm1JZH0uJHtmaWxlU3lzdGVtSWR9LmZzeC4ke3JlZ2lvbn0uYW1hem9uYXdzLmNvbWBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODnuOCpuODs+ODiOOCquODl+OCt+ODp+ODs+OBruacgOmBqeWMllxuICAgKi9cbiAgc3RhdGljIG9wdGltaXplTkZTT3B0aW9ucyh3b3JrbG9hZFR5cGU6ICdyZWFkLWhlYXZ5JyB8ICd3cml0ZS1oZWF2eScgfCAnYmFsYW5jZWQnKTogTkZTTW91bnRPcHRpb25zIHtcbiAgICBjb25zdCBiYXNlT3B0aW9uczogTkZTTW91bnRPcHRpb25zID0ge1xuICAgICAgaGFyZDogdHJ1ZSxcbiAgICAgIGludHI6IHRydWUsXG4gICAgICB0aW1lbzogNjAwLFxuICAgICAgcmV0cmFuczogMixcbiAgICAgIG5mc3ZlcnM6ICc0LjEnLFxuICAgICAgcHJvdG86ICd0Y3AnLFxuICAgICAgZmxvY2s6IHRydWUsXG4gICAgICBhc3luYzogZmFsc2VcbiAgICB9O1xuXG4gICAgc3dpdGNoICh3b3JrbG9hZFR5cGUpIHtcbiAgICAgIGNhc2UgJ3JlYWQtaGVhdnknOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLmJhc2VPcHRpb25zLFxuICAgICAgICAgIHJzaXplOiAxMDQ4NTc2LCAgLy8gMU1CIC0g6Kqt44G/5Y+W44KK5pyA6YGp5YyWXG4gICAgICAgICAgd3NpemU6IDY1NTM2ICAgICAvLyA2NEtCIC0g5pu444GN6L6844G/44Gv5qiZ5rqWXG4gICAgICAgIH07XG4gICAgICBjYXNlICd3cml0ZS1oZWF2eSc6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgICAgcnNpemU6IDY1NTM2LCAgICAvLyA2NEtCIC0g6Kqt44G/5Y+W44KK44Gv5qiZ5rqWXG4gICAgICAgICAgd3NpemU6IDEwNDg1NzYgICAvLyAxTUIgLSDmm7jjgY3ovrzjgb/mnIDpganljJZcbiAgICAgICAgfTtcbiAgICAgIGNhc2UgJ2JhbGFuY2VkJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgICAgcnNpemU6IDEwNDg1NzYsICAvLyAxTUIgLSDjg5Djg6njg7PjgrnlnotcbiAgICAgICAgICB3c2l6ZTogMTA0ODU3NiAgIC8vIDFNQiAtIOODkOODqeODs+OCueWei1xuICAgICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg57jgqbjg7Pjg4jnirbmhYvjga7nm6PoppZcbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZU1vbml0b3JpbmdTY3JpcHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCMhL2Jpbi9iYXNoXG4jIEZTeCBPTlRBUCDjg57jgqbjg7Pjg4jnirbmhYvnm6Poppbjgrnjgq/jg6rjg5fjg4hcblxud2hpbGUgdHJ1ZTsgZG9cbiAgZWNobyBcIiQoZGF0ZSk6IEZTeCDjg57jgqbjg7Pjg4jnirbmhYvjg4Hjgqfjg4Pjgq9cIlxuICBcbiAgIyDjg57jgqbjg7Pjg4jnirbmhYvnorroqo1cbiAgaWYgISBkZiAtaCB8IGdyZXAgLXEgXCJmc3hcIjsgdGhlblxuICAgIGVjaG8gXCLorablkYo6IEZTeCDjg5zjg6rjg6Xjg7zjg6DjgYzjg57jgqbjg7Pjg4jjgZXjgozjgabjgYTjgb7jgZvjgpNcIlxuICAgICMg5YaN44Oe44Km44Oz44OI6Kmm6KGMXG4gICAgL29wdC9mc3gtb250YXAvbW91bnQtc2NyaXB0LnNoXG4gIGZpXG4gIFxuICAjIDYw56eS5b6F5qmfXG4gIHNsZWVwIDYwXG5kb25lYDtcbiAgfVxuXG4gIC8qKlxuICAgKiDpmpzlrrPlm57lvqnjgrnjgq/jg6rjg5fjg4jjga7nlJ/miJBcbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZVJlY292ZXJ5U2NyaXB0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAjIS9iaW4vYmFzaFxuIyBGU3ggT05UQVAg6Zqc5a6z5Zue5b6p44K544Kv44Oq44OX44OIXG5cbmVjaG8gXCJGU3ggT05UQVAg6Zqc5a6z5Zue5b6p5Yem55CG6ZaL5aeLXCJcblxuIyDml6LlrZjjg57jgqbjg7Pjg4jjga7lvLfliLbjgqLjg7Pjg57jgqbjg7Pjg4hcbnN1ZG8gdW1vdW50IC1mIC1sIC9tbnQvZG9jdW1lbnRzIC9tbnQvZW1iZWRkaW5ncyAvbW50L2luZGV4IDI+L2Rldi9udWxsIHx8IHRydWVcblxuIyDjg43jg4Pjg4jjg6/jg7zjgq/mjqXntprnorroqo1cbmlmICEgcGluZyAtYyAzIFxcJHtTVk1fRE5TX05BTUV9ID4gL2Rldi9udWxsIDI+JjE7IHRoZW5cbiAgZWNobyBcIuOCqOODqeODvDogRlN4IOOCqOODs+ODieODneOCpOODs+ODiOOBq+aOpee2muOBp+OBjeOBvuOBm+OCk1wiXG4gIGV4aXQgMVxuZmlcblxuIyDlho3jg57jgqbjg7Pjg4jlrp/ooYxcbi9vcHQvZnN4LW9udGFwL21vdW50LXNjcmlwdC5zaFxuXG4jIOaknOiovFxuL29wdC9mc3gtb250YXAvdmFsaWRhdGlvbi1zY3JpcHQuc2hcblxuZWNobyBcIkZTeCBPTlRBUCDpmpzlrrPlm57lvqnlh6bnkIblrozkuoZcImA7XG4gIH1cbn1cbiJdfQ==