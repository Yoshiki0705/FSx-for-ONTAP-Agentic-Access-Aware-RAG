/**
 * Windows SQLite負荷試験コンストラクト
 * 
 * Windows EC2インスタンス上でのSQLite負荷試験
 * - Windows Server 2022
 * - CIFS/SMB経由でのFSx for ONTAPアクセス
 * - PowerShellベースの負荷試験スクリプト
 * - RDP接続用の踏み台サーバー
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface WindowsSqliteProps {
  readonly projectName: string;
  readonly environment: string;
  readonly vpc: ec2.IVpc;
  readonly privateSubnet: ec2.ISubnet;
  readonly securityGroup: ec2.ISecurityGroup;
  readonly keyPairName: string;
  readonly fsxFileSystemId: string;
  readonly fsxSvmId: string;
  readonly fsxVolumeId: string;
  readonly fsxMountPath: string;
  readonly fsxCifsEndpoint: string;
  readonly fsxCifsShareName: string;
  readonly instanceType?: string;
  readonly enableDetailedMonitoring?: boolean;
}

export class WindowsSqlite extends Construct {
  public readonly instance: ec2.Instance;
  public readonly bastionHost?: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;
  
  private readonly instanceRole: iam.Role;

  constructor(scope: Construct, id: string, props: WindowsSqliteProps) {
    super(scope, id);

    // IAMロール作成
    this.instanceRole = this.createInstanceRole(props);

    // セキュリティグループ作成
    this.securityGroup = this.createSecurityGroup(props);

    // Windows SQLiteインスタンス作成
    this.instance = this.createWindowsInstance(props);

    // 踏み台サーバー作成（プライベートサブネットの場合）
    if (!props.privateSubnet.routeTable.routeTableId.includes('public')) {
      this.bastionHost = this.createBastionHost(props);
    }

    // タグ設定
    this.applyTags(props);
  }

  /**
   * インスタンスロール作成
   */
  private createInstanceRole(props: WindowsSqliteProps): iam.Role {
    const role = new iam.Role(this, 'InstanceRole', {
      roleName: `${props.projectName}-${props.environment}-windows-sqlite-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // FSx権限追加
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'fsx:DescribeFileSystems',
        'fsx:DescribeStorageVirtualMachines',
        'fsx:DescribeVolumes',
      ],
      resources: [
        `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.fsxFileSystemId}`,
        `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:storage-virtual-machine/${props.fsxSvmId}`,
        `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:volume/${props.fsxVolumeId}`,
      ],
    }));

    return role;
  }

  /**
   * セキュリティグループ作成
   */
  private createSecurityGroup(props: WindowsSqliteProps): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Windows SQLite load test',
      allowAllOutbound: true,
    });

    // RDP アクセス（VPC内のみ）
    sg.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(3389),
      'RDP access from VPC'
    );

    // SMB/CIFS アクセス
    sg.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(445),
      'SMB/CIFS access'
    );

    sg.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(139),
      'NetBIOS Session Service'
    );

    // ICMP（ping）
    sg.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.allIcmp(),
      'ICMP from VPC'
    );

    return sg;
  }

  /**
   * Windows インスタンス作成
   */
  private createWindowsInstance(props: WindowsSqliteProps): ec2.Instance {
    // 最新のWindows Server 2022 AMI取得
    const windowsAmi = ec2.MachineImage.latestWindows(ec2.WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE);

    // ユーザーデータスクリプト作成
    const userData = this.createWindowsUserData(props);

    const instance = new ec2.Instance(this, 'WindowsInstance', {
      instanceName: `${props.projectName}-${props.environment}-windows-sqlite`,
      instanceType: new ec2.InstanceType(props.instanceType || 't3.medium'),
      machineImage: windowsAmi,
      vpc: props.vpc,
      vpcSubnets: { subnets: [props.privateSubnet] },
      securityGroup: this.securityGroup,
      keyName: props.keyPairName,
      role: this.instanceRole,
      userData,
      detailedMonitoring: props.enableDetailedMonitoring || false,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(50, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    return instance;
  }

  /**
   * 踏み台サーバー作成
   */
  private createBastionHost(props: WindowsSqliteProps): ec2.Instance {
    // パブリックサブネットを取得
    const publicSubnet = props.vpc.publicSubnets[0];

    const bastionSg = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for bastion host',
      allowAllOutbound: true,
    });

    // SSH アクセス（外部から）
    bastionSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'SSH access from internet'
    );

    const bastion = new ec2.Instance(this, 'BastionHost', {
      instanceName: `${props.projectName}-${props.environment}-bastion`,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpc: props.vpc,
      vpcSubnets: { subnets: [publicSubnet] },
      securityGroup: bastionSg,
      keyName: props.keyPairName,
    });

    return bastion;
  }

  /**
   * Windows ユーザーデータ作成
   */
  private createWindowsUserData(props: WindowsSqliteProps): ec2.UserData {
    const userData = ec2.UserData.forWindows();

    userData.addCommands(
      '# Windows SQLite負荷試験用のユーザーデータスクリプト',
      '',
      '# PowerShell実行ポリシーの設定',
      'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Force',
      '',
      '# Windows Updateの無効化（一時的）',
      'Stop-Service -Name wuauserv -Force',
      'Set-Service -Name wuauserv -StartupType Disabled',
      '',
      '# 作業ディレクトリの作成',
      'New-Item -ItemType Directory -Path "C:\\SQLiteLoadTest" -Force',
      'New-Item -ItemType Directory -Path "C:\\Scripts" -Force',
      '',
      '# Python 3.11のインストール',
      'try {',
      '    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile "C:\\python-3.11.9-amd64.exe"',
      '    Start-Process "C:\\python-3.11.9-amd64.exe" -Wait -ArgumentList \'/quiet InstallAllUsers=1 PrependPath=1\'',
      '} catch {',
      '    "Python installation failed: $($_.Exception.Message)" | Out-File -FilePath "C:\\SQLiteLoadTest\\error.log" -Append',
      '}',
      '',
      '# 環境変数の更新',
      '$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")',
      '',
      '# Python依存関係のインストール',
      'try {',
      '    Start-Process "python" -Wait -ArgumentList \'-m pip install --upgrade pip\'',
      '    Start-Process "python" -Wait -ArgumentList \'-m pip install psutil threading concurrent.futures multiprocessing\'',
      '} catch {',
      '    "Python packages installation failed: $($_.Exception.Message)" | Out-File -FilePath "C:\\SQLiteLoadTest\\error.log" -Append',
      '}',
      '',
      this.generateSqliteTestScript(props),
      '',
      this.generateMountScript(props),
      '',
      this.generateQuickTestScript(props),
      '',
      '# Windows Defenderの除外設定（パフォーマンス向上）',
      'Add-MpPreference -ExclusionPath "C:\\SQLiteLoadTest"',
      'Add-MpPreference -ExclusionPath "Z:\\"',
      '',
      '# 初期化完了の記録',
      '"Windows SQLite負荷試験環境の初期化完了 - $(Get-Date)" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log"',
      '',
      '# システム情報の記録',
      '"=== システム情報 ===" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append',
      '"OS: $(Get-WmiObject -Class Win32_OperatingSystem | Select-Object -ExpandProperty Caption)" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append',
      '"CPU: $(Get-WmiObject -Class Win32_Processor | Select-Object -ExpandProperty Name)" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append',
      '"Memory: $([math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)) GB" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append',
      '',
      'Write-Host "SQLite負荷試験環境の初期化が完了しました"'
    );

    return userData;
  }

  /**
   * SQLite負荷試験スクリプト生成
   */
  private generateSqliteTestScript(props: WindowsSqliteProps): string {
    return `
# SQLite負荷試験スクリプトの作成
$sqliteScript = @'
#!/usr/bin/env python3
"""
Windows用 SQLite UNIQUE制約エラー負荷試験スクリプト
FSx for ONTAP CIFS共有上でSQLiteデータベースに対して並行書き込みを実行し、
UNIQUE制約エラーを意図的に発生させて性能を測定する
"""

import sqlite3
import threading
import time
import random
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing
import psutil

class SQLiteLoadTester:
    def __init__(self, db_path, num_threads=10, num_operations=1000):
        self.db_path = db_path
        self.num_threads = num_threads
        self.num_operations = num_operations
        self.success_count = 0
        self.error_count = 0
        self.unique_error_count = 0
        self.lock = threading.Lock()
        
    def setup_database(self):
        """データベースとテーブルの初期化"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # テストテーブルの作成（UNIQUE制約付き）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_table (
                id INTEGER PRIMARY KEY,
                unique_value INTEGER UNIQUE,
                data TEXT,
                timestamp REAL
            )
        ''')
        
        # インデックスの作成
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON test_table(timestamp)')
        
        conn.commit()
        conn.close()
        
    def worker_thread(self, thread_id, operations_per_thread):
        """ワーカースレッドの処理"""
        local_success = 0
        local_error = 0
        local_unique_error = 0
        
        # スレッドごとに独立したDB接続を作成
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute('PRAGMA journal_mode=WAL')  # WALモードで並行性を向上
        conn.execute('PRAGMA synchronous=NORMAL')
        
        try:
            for i in range(operations_per_thread):
                try:
                    cursor = conn.cursor()
                    
                    # 意図的にUNIQUE制約エラーを発生させるため、
                    # 限定された範囲の値を使用
                    unique_value = random.randint(1, operations_per_thread // 2)
                    data = f"Thread-{thread_id}-Operation-{i}-Data-{random.randint(1000, 9999)}"
                    timestamp = time.time()
                    
                    cursor.execute('''
                        INSERT INTO test_table (unique_value, data, timestamp)
                        VALUES (?, ?, ?)
                    ''', (unique_value, data, timestamp))
                    
                    conn.commit()
                    local_success += 1
                    
                except sqlite3.IntegrityError as e:
                    if "UNIQUE constraint failed" in str(e):
                        local_unique_error += 1
                    else:
                        local_error += 1
                        
                except Exception as e:
                    local_error += 1
                    print(f"Thread {thread_id}: Unexpected error: {e}")
                    
        finally:
            conn.close()
            
        # 結果を集計
        with self.lock:
            self.success_count += local_success
            self.error_count += local_error
            self.unique_error_count += local_unique_error
            
        print(f"Thread {thread_id} completed: Success={local_success}, "
              f"UniqueErrors={local_unique_error}, OtherErrors={local_error}")
    
    def run_load_test(self):
        """負荷試験の実行"""
        print(f"Starting SQLite load test...")
        print(f"Database: {self.db_path}")
        print(f"Threads: {self.num_threads}")
        print(f"Total operations: {self.num_operations}")
        print(f"Operations per thread: {self.num_operations // self.num_threads}")
        
        # データベースの初期化
        self.setup_database()
        
        # システム情報の表示
        print(f"CPU cores: {multiprocessing.cpu_count()}")
        print(f"Memory: {psutil.virtual_memory().total / (1024**3):.1f} GB")
        
        start_time = time.time()
        
        # スレッドプールで並行実行
        operations_per_thread = self.num_operations // self.num_threads
        
        with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
            futures = []
            for thread_id in range(self.num_threads):
                future = executor.submit(self.worker_thread, thread_id, operations_per_thread)
                futures.append(future)
            
            # 全スレッドの完了を待機
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"Thread execution error: {e}")
        
        end_time = time.time()
        duration = end_time - start_time
        
        # 結果の表示
        total_operations = self.success_count + self.error_count + self.unique_error_count
        
        print("\\n" + "="*60)
        print("SQLite UNIQUE制約エラー負荷試験結果")
        print("="*60)
        print(f"実行時間: {duration:.2f} 秒")
        print(f"総操作数: {total_operations}")
        print(f"成功: {self.success_count} ({self.success_count/total_operations*100:.1f}%)")
        print(f"UNIQUE制約エラー: {self.unique_error_count} ({self.unique_error_count/total_operations*100:.1f}%)")
        print(f"その他エラー: {self.error_count} ({self.error_count/total_operations*100:.1f}%)")
        print(f"スループット: {total_operations/duration:.1f} ops/sec")
        print("="*60)
        
        # データベースサイズの確認
        if os.path.exists(self.db_path):
            db_size = os.path.getsize(self.db_path)
            print(f"データベースサイズ: {db_size / (1024*1024):.2f} MB")
        
        return {
            'duration': duration,
            'total_operations': total_operations,
            'success_count': self.success_count,
            'unique_error_count': self.unique_error_count,
            'error_count': self.error_count,
            'throughput': total_operations / duration
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python unique_constraint_test.py <db_path> [threads] [operations]")
        print("Example: python unique_constraint_test.py Z:\\\\test.db 20 5000")
        sys.exit(1)
    
    db_path = sys.argv[1]
    num_threads = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    num_operations = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    
    # ディレクトリが存在しない場合は作成
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    tester = SQLiteLoadTester(db_path, num_threads, num_operations)
    results = tester.run_load_test()
    
    # 結果をファイルに保存
    result_file = f"{db_path}.results.txt"
    with open(result_file, 'w') as f:
        f.write(f"SQLite Load Test Results\\n")
        f.write(f"========================\\n")
        f.write(f"Database: {db_path}\\n")
        f.write(f"Threads: {num_threads}\\n")
        f.write(f"Duration: {results['duration']:.2f} seconds\\n")
        f.write(f"Total Operations: {results['total_operations']}\\n")
        f.write(f"Success: {results['success_count']}\\n")
        f.write(f"UNIQUE Errors: {results['unique_error_count']}\\n")
        f.write(f"Other Errors: {results['error_count']}\\n")
        f.write(f"Throughput: {results['throughput']:.1f} ops/sec\\n")
    
    print(f"\\n結果を {result_file} に保存しました")

if __name__ == "__main__":
    main()
'@

$sqliteScript | Out-File -FilePath "C:\\SQLiteLoadTest\\unique_constraint_test.py" -Encoding UTF8
    `.trim();
  }

  /**
   * FSx マウントスクリプト生成
   */
  private generateMountScript(props: WindowsSqliteProps): string {
    return `
# FSx CIFS共有マウント用のスクリプト作成
$mountScript = @'
# FSx for ONTAP CIFS共有のマウント

$FSX_IP = "${props.fsxCifsEndpoint}"
$SHARE_NAME = "${props.fsxCifsShareName}"
$DRIVE_LETTER = "Z:"

Write-Host "FSx for ONTAP CIFS共有をマウント中..."
Write-Host "IP: $FSX_IP"
Write-Host "共有名: $SHARE_NAME"
Write-Host "ドライブ: $DRIVE_LETTER"

try {
    # 既存のマッピングを削除
    if (Get-PSDrive -Name "Z" -ErrorAction SilentlyContinue) {
        Remove-PSDrive -Name "Z" -Force
    }
    
    # ネットワークドライブのマッピング
    net use $DRIVE_LETTER "\\\\$FSX_IP\\$SHARE_NAME" /persistent:yes
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "マウント成功!"
        Write-Host "マウント状況:"
        Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Name -eq "Z"}
        
        Write-Host "SQLite負荷試験の準備完了"
        Write-Host "実行例:"
        Write-Host "python C:\\SQLiteLoadTest\\unique_constraint_test.py Z:\\test.db 20 5000"
    } else {
        Write-Host "マウント失敗"
        exit 1
    }
} catch {
    Write-Host "エラー: $($_.Exception.Message)"
    exit 1
}
'@

$mountScript | Out-File -FilePath "C:\\SQLiteLoadTest\\mount_fsx.ps1" -Encoding UTF8
    `.trim();
  }

  /**
   * 簡単な負荷試験スクリプト生成
   */
  private generateQuickTestScript(props: WindowsSqliteProps): string {
    return `
# 簡単な負荷試験実行スクリプト
$quickTestScript = @'
# 簡単なSQLite負荷試験の実行

Write-Host "SQLite UNIQUE制約エラー負荷試験を開始します..."

# FSx共有のマウント確認
if (-not (Test-Path "Z:\\")) {
    Write-Host "FSx共有をマウント中..."
    & "C:\\SQLiteLoadTest\\mount_fsx.ps1"
}

# 軽い負荷試験（10スレッド、1000操作）
Write-Host "軽い負荷試験を実行中..."
python "C:\\SQLiteLoadTest\\unique_constraint_test.py" "Z:\\quick_test.db" 10 1000

Write-Host "負荷試験完了"
'@

$quickTestScript | Out-File -FilePath "C:\\SQLiteLoadTest\\run_quick_test.ps1" -Encoding UTF8
    `.trim();
  }

  /**
   * タグ適用
   */
  private applyTags(props: WindowsSqliteProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'WindowsSQLiteLoadTest',
      ManagedBy: 'CDK',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * インスタンス情報取得
   */
  public getInstanceInfo(): Record<string, any> {
    return {
      instanceId: this.instance.instanceId,
      privateIp: this.instance.instancePrivateIp,
      bastionHostPublicIp: this.bastionHost?.instancePublicIp,
    };
  }
}