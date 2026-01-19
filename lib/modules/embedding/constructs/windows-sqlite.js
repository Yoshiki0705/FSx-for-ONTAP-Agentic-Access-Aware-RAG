"use strict";
/**
 * Windows SQLite負荷試験コンストラクト
 *
 * Windows EC2インスタンス上でのSQLite負荷試験
 * - Windows Server 2022
 * - CIFS/SMB経由でのFSx for ONTAPアクセス
 * - PowerShellベースの負荷試験スクリプト
 * - RDP接続用の踏み台サーバー
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
exports.WindowsSqlite = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
class WindowsSqlite extends constructs_1.Construct {
    instance;
    bastionHost;
    securityGroup;
    instanceRole;
    constructor(scope, id, props) {
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
    createInstanceRole(props) {
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
    createSecurityGroup(props) {
        const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for Windows SQLite load test',
            allowAllOutbound: true,
        });
        // RDP アクセス（VPC内のみ）
        sg.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(3389), 'RDP access from VPC');
        // SMB/CIFS アクセス
        sg.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(445), 'SMB/CIFS access');
        sg.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(139), 'NetBIOS Session Service');
        // ICMP（ping）
        sg.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.allIcmp(), 'ICMP from VPC');
        return sg;
    }
    /**
     * Windows インスタンス作成
     */
    createWindowsInstance(props) {
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
    createBastionHost(props) {
        // パブリックサブネットを取得
        const publicSubnet = props.vpc.publicSubnets[0];
        const bastionSg = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for bastion host',
            allowAllOutbound: true,
        });
        // SSH アクセス（外部から）
        bastionSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH access from internet');
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
    createWindowsUserData(props) {
        const userData = ec2.UserData.forWindows();
        userData.addCommands('# Windows SQLite負荷試験用のユーザーデータスクリプト', '', '# PowerShell実行ポリシーの設定', 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Force', '', '# Windows Updateの無効化（一時的）', 'Stop-Service -Name wuauserv -Force', 'Set-Service -Name wuauserv -StartupType Disabled', '', '# 作業ディレクトリの作成', 'New-Item -ItemType Directory -Path "C:\\SQLiteLoadTest" -Force', 'New-Item -ItemType Directory -Path "C:\\Scripts" -Force', '', '# Python 3.11のインストール', 'try {', '    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile "C:\\python-3.11.9-amd64.exe"', '    Start-Process "C:\\python-3.11.9-amd64.exe" -Wait -ArgumentList \'/quiet InstallAllUsers=1 PrependPath=1\'', '} catch {', '    "Python installation failed: $($_.Exception.Message)" | Out-File -FilePath "C:\\SQLiteLoadTest\\error.log" -Append', '}', '', '# 環境変数の更新', '$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")', '', '# Python依存関係のインストール', 'try {', '    Start-Process "python" -Wait -ArgumentList \'-m pip install --upgrade pip\'', '    Start-Process "python" -Wait -ArgumentList \'-m pip install psutil threading concurrent.futures multiprocessing\'', '} catch {', '    "Python packages installation failed: $($_.Exception.Message)" | Out-File -FilePath "C:\\SQLiteLoadTest\\error.log" -Append', '}', '', this.generateSqliteTestScript(props), '', this.generateMountScript(props), '', this.generateQuickTestScript(props), '', '# Windows Defenderの除外設定（パフォーマンス向上）', 'Add-MpPreference -ExclusionPath "C:\\SQLiteLoadTest"', 'Add-MpPreference -ExclusionPath "Z:\\"', '', '# 初期化完了の記録', '"Windows SQLite負荷試験環境の初期化完了 - $(Get-Date)" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log"', '', '# システム情報の記録', '"=== システム情報 ===" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append', '"OS: $(Get-WmiObject -Class Win32_OperatingSystem | Select-Object -ExpandProperty Caption)" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append', '"CPU: $(Get-WmiObject -Class Win32_Processor | Select-Object -ExpandProperty Name)" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append', '"Memory: $([math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)) GB" | Out-File -FilePath "C:\\SQLiteLoadTest\\init_complete.log" -Append', '', 'Write-Host "SQLite負荷試験環境の初期化が完了しました"');
        return userData;
    }
    /**
     * SQLite負荷試験スクリプト生成
     */
    generateSqliteTestScript(props) {
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
    generateMountScript(props) {
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
    generateQuickTestScript(props) {
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
    applyTags(props) {
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
    getInstanceInfo() {
        return {
            instanceId: this.instance.instanceId,
            privateIp: this.instance.instancePrivateIp,
            bastionHostPublicIp: this.bastionHost?.instancePublicIp,
        };
    }
}
exports.WindowsSqlite = WindowsSqlite;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93cy1zcWxpdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3aW5kb3dzLXNxbGl0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMkNBQXVDO0FBbUJ2QyxNQUFhLGFBQWMsU0FBUSxzQkFBUztJQUMxQixRQUFRLENBQWU7SUFDdkIsV0FBVyxDQUFnQjtJQUMzQixhQUFhLENBQW9CO0lBRWhDLFlBQVksQ0FBVztJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsV0FBVztRQUNYLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRW5ELGVBQWU7UUFDZixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyRCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFbEQsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUVELE9BQU87UUFDUCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNLLGtCQUFrQixDQUFDLEtBQXlCO1FBQ2xELE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxD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LFFBQVEsQ0FBQyxpQkFBaUI7WUFDMUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxnQkFBZ0I7U0FDeEQsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWppQkQsc0NBaWlCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2luZG93cyBTUUxpdGXosqDojbfoqabpqJPjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAqIFxuICogV2luZG93cyBFQzLjgqTjg7Pjgrnjgr/jg7PjgrnkuIrjgafjga5TUUxpdGXosqDojbfoqabpqJNcbiAqIC0gV2luZG93cyBTZXJ2ZXIgMjAyMlxuICogLSBDSUZTL1NNQue1jOeUseOBp+OBrkZTeCBmb3IgT05UQVDjgqLjgq/jgrvjgrlcbiAqIC0gUG93ZXJTaGVsbOODmeODvOOCueOBruiyoOiNt+ippumok+OCueOCr+ODquODl+ODiFxuICogLSBSRFDmjqXntprnlKjjga7ouI/jgb/lj7DjgrXjg7zjg5Djg7xcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2luZG93c1NxbGl0ZVByb3BzIHtcbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgcmVhZG9ubHkgdnBjOiBlYzIuSVZwYztcbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldDogZWMyLklTdWJuZXQ7XG4gIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXA6IGVjMi5JU2VjdXJpdHlHcm91cDtcbiAgcmVhZG9ubHkga2V5UGFpck5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgZnN4RmlsZVN5c3RlbUlkOiBzdHJpbmc7XG4gIHJlYWRvbmx5IGZzeFN2bUlkOiBzdHJpbmc7XG4gIHJlYWRvbmx5IGZzeFZvbHVtZUlkOiBzdHJpbmc7XG4gIHJlYWRvbmx5IGZzeE1vdW50UGF0aDogc3RyaW5nO1xuICByZWFkb25seSBmc3hDaWZzRW5kcG9pbnQ6IHN0cmluZztcbiAgcmVhZG9ubHkgZnN4Q2lmc1NoYXJlTmFtZTogc3RyaW5nO1xuICByZWFkb25seSBpbnN0YW5jZVR5cGU/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGVuYWJsZURldGFpbGVkTW9uaXRvcmluZz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBXaW5kb3dzU3FsaXRlIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGluc3RhbmNlOiBlYzIuSW5zdGFuY2U7XG4gIHB1YmxpYyByZWFkb25seSBiYXN0aW9uSG9zdD86IGVjMi5JbnN0YW5jZTtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBcbiAgcHJpdmF0ZSByZWFkb25seSBpbnN0YW5jZVJvbGU6IGlhbS5Sb2xlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBXaW5kb3dzU3FsaXRlUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gSUFN44Ot44O844Or5L2c5oiQXG4gICAgdGhpcy5pbnN0YW5jZVJvbGUgPSB0aGlzLmNyZWF0ZUluc3RhbmNlUm9sZShwcm9wcyk7XG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJBcbiAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXAocHJvcHMpO1xuXG4gICAgLy8gV2luZG93cyBTUUxpdGXjgqTjg7Pjgrnjgr/jg7PjgrnkvZzmiJBcbiAgICB0aGlzLmluc3RhbmNlID0gdGhpcy5jcmVhdGVXaW5kb3dzSW5zdGFuY2UocHJvcHMpO1xuXG4gICAgLy8g6LiP44G/5Y+w44K144O844OQ44O85L2c5oiQ77yI44OX44Op44Kk44OZ44O844OI44K144OW44ON44OD44OI44Gu5aC05ZCI77yJXG4gICAgaWYgKCFwcm9wcy5wcml2YXRlU3VibmV0LnJvdXRlVGFibGUucm91dGVUYWJsZUlkLmluY2x1ZGVzKCdwdWJsaWMnKSkge1xuICAgICAgdGhpcy5iYXN0aW9uSG9zdCA9IHRoaXMuY3JlYXRlQmFzdGlvbkhvc3QocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIOOCv+OCsOioreWumlxuICAgIHRoaXMuYXBwbHlUYWdzKHByb3BzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqTjg7Pjgrnjgr/jg7Pjgrnjg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlSW5zdGFuY2VSb2xlKHByb3BzOiBXaW5kb3dzU3FsaXRlUHJvcHMpOiBpYW0uUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnSW5zdGFuY2VSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS13aW5kb3dzLXNxbGl0ZS1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlYzIuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZScpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0Nsb3VkV2F0Y2hBZ2VudFNlcnZlclBvbGljeScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEZTeOaoqemZkOi/veWKoFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZnN4OkRlc2NyaWJlRmlsZVN5c3RlbXMnLFxuICAgICAgICAnZnN4OkRlc2NyaWJlU3RvcmFnZVZpcnR1YWxNYWNoaW5lcycsXG4gICAgICAgICdmc3g6RGVzY3JpYmVWb2x1bWVzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6ZnN4OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06ZmlsZS1zeXN0ZW0vJHtwcm9wcy5mc3hGaWxlU3lzdGVtSWR9YCxcbiAgICAgICAgYGFybjphd3M6ZnN4OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06c3RvcmFnZS12aXJ0dWFsLW1hY2hpbmUvJHtwcm9wcy5mc3hTdm1JZH1gLFxuICAgICAgICBgYXJuOmF3czpmc3g6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTp2b2x1bWUvJHtwcm9wcy5mc3hWb2x1bWVJZH1gLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlHcm91cChwcm9wczogV2luZG93c1NxbGl0ZVByb3BzKTogZWMyLlNlY3VyaXR5R3JvdXAge1xuICAgIGNvbnN0IHNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiBwcm9wcy52cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBXaW5kb3dzIFNRTGl0ZSBsb2FkIHRlc3QnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFJEUCDjgqLjgq/jgrvjgrnvvIhWUEPlhoXjga7jgb/vvIlcbiAgICBzZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQocHJvcHMudnBjLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC50Y3AoMzM4OSksXG4gICAgICAnUkRQIGFjY2VzcyBmcm9tIFZQQydcbiAgICApO1xuXG4gICAgLy8gU01CL0NJRlMg44Ki44Kv44K744K5XG4gICAgc2cuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5pcHY0KHByb3BzLnZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0NSksXG4gICAgICAnU01CL0NJRlMgYWNjZXNzJ1xuICAgICk7XG5cbiAgICBzZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQocHJvcHMudnBjLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC50Y3AoMTM5KSxcbiAgICAgICdOZXRCSU9TIFNlc3Npb24gU2VydmljZSdcbiAgICApO1xuXG4gICAgLy8gSUNNUO+8iHBpbmfvvIlcbiAgICBzZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQocHJvcHMudnBjLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC5hbGxJY21wKCksXG4gICAgICAnSUNNUCBmcm9tIFZQQydcbiAgICApO1xuXG4gICAgcmV0dXJuIHNnO1xuICB9XG5cbiAgLyoqXG4gICAqIFdpbmRvd3Mg44Kk44Oz44K544K/44Oz44K55L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVdpbmRvd3NJbnN0YW5jZShwcm9wczogV2luZG93c1NxbGl0ZVByb3BzKTogZWMyLkluc3RhbmNlIHtcbiAgICAvLyDmnIDmlrDjga5XaW5kb3dzIFNlcnZlciAyMDIyIEFNSeWPluW+l1xuICAgIGNvbnN0IHdpbmRvd3NBbWkgPSBlYzIuTWFjaGluZUltYWdlLmxhdGVzdFdpbmRvd3MoZWMyLldpbmRvd3NWZXJzaW9uLldJTkRPV1NfU0VSVkVSXzIwMjJfRU5HTElTSF9GVUxMX0JBU0UpO1xuXG4gICAgLy8g44Om44O844K244O844OH44O844K/44K544Kv44Oq44OX44OI5L2c5oiQXG4gICAgY29uc3QgdXNlckRhdGEgPSB0aGlzLmNyZWF0ZVdpbmRvd3NVc2VyRGF0YShwcm9wcyk7XG5cbiAgICBjb25zdCBpbnN0YW5jZSA9IG5ldyBlYzIuSW5zdGFuY2UodGhpcywgJ1dpbmRvd3NJbnN0YW5jZScsIHtcbiAgICAgIGluc3RhbmNlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXdpbmRvd3Mtc3FsaXRlYCxcbiAgICAgIGluc3RhbmNlVHlwZTogbmV3IGVjMi5JbnN0YW5jZVR5cGUocHJvcHMuaW5zdGFuY2VUeXBlIHx8ICd0My5tZWRpdW0nKSxcbiAgICAgIG1hY2hpbmVJbWFnZTogd2luZG93c0FtaSxcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRzOiBbcHJvcHMucHJpdmF0ZVN1Ym5ldF0gfSxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IHRoaXMuc2VjdXJpdHlHcm91cCxcbiAgICAgIGtleU5hbWU6IHByb3BzLmtleVBhaXJOYW1lLFxuICAgICAgcm9sZTogdGhpcy5pbnN0YW5jZVJvbGUsXG4gICAgICB1c2VyRGF0YSxcbiAgICAgIGRldGFpbGVkTW9uaXRvcmluZzogcHJvcHMuZW5hYmxlRGV0YWlsZWRNb25pdG9yaW5nIHx8IGZhbHNlLFxuICAgICAgYmxvY2tEZXZpY2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBkZXZpY2VOYW1lOiAnL2Rldi9zZGExJyxcbiAgICAgICAgICB2b2x1bWU6IGVjMi5CbG9ja0RldmljZVZvbHVtZS5lYnMoNTAsIHtcbiAgICAgICAgICAgIHZvbHVtZVR5cGU6IGVjMi5FYnNEZXZpY2VWb2x1bWVUeXBlLkdQMyxcbiAgICAgICAgICAgIGVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW5zdGFuY2U7XG4gIH1cblxuICAvKipcbiAgICog6LiP44G/5Y+w44K144O844OQ44O85L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJhc3Rpb25Ib3N0KHByb3BzOiBXaW5kb3dzU3FsaXRlUHJvcHMpOiBlYzIuSW5zdGFuY2Uge1xuICAgIC8vIOODkeODluODquODg+OCr+OCteODluODjeODg+ODiOOCkuWPluW+l1xuICAgIGNvbnN0IHB1YmxpY1N1Ym5ldCA9IHByb3BzLnZwYy5wdWJsaWNTdWJuZXRzWzBdO1xuXG4gICAgY29uc3QgYmFzdGlvblNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdCYXN0aW9uU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgYmFzdGlvbiBob3N0JyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTU0gg44Ki44Kv44K744K577yI5aSW6YOo44GL44KJ77yJXG4gICAgYmFzdGlvblNnLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDIyKSxcbiAgICAgICdTU0ggYWNjZXNzIGZyb20gaW50ZXJuZXQnXG4gICAgKTtcblxuICAgIGNvbnN0IGJhc3Rpb24gPSBuZXcgZWMyLkluc3RhbmNlKHRoaXMsICdCYXN0aW9uSG9zdCcsIHtcbiAgICAgIGluc3RhbmNlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJhc3Rpb25gLFxuICAgICAgaW5zdGFuY2VUeXBlOiBuZXcgZWMyLkluc3RhbmNlVHlwZSgndDMubWljcm8nKSxcbiAgICAgIG1hY2hpbmVJbWFnZTogZWMyLk1hY2hpbmVJbWFnZS5sYXRlc3RBbWF6b25MaW51eDIwMjMoKSxcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRzOiBbcHVibGljU3VibmV0XSB9LFxuICAgICAgc2VjdXJpdHlHcm91cDogYmFzdGlvblNnLFxuICAgICAga2V5TmFtZTogcHJvcHMua2V5UGFpck5hbWUsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYmFzdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaW5kb3dzIOODpuODvOOCtuODvOODh+ODvOOCv+S9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVXaW5kb3dzVXNlckRhdGEocHJvcHM6IFdpbmRvd3NTcWxpdGVQcm9wcyk6IGVjMi5Vc2VyRGF0YSB7XG4gICAgY29uc3QgdXNlckRhdGEgPSBlYzIuVXNlckRhdGEuZm9yV2luZG93cygpO1xuXG4gICAgdXNlckRhdGEuYWRkQ29tbWFuZHMoXG4gICAgICAnIyBXaW5kb3dzIFNRTGl0ZeiyoOiNt+ippumok+eUqOOBruODpuODvOOCtuODvOODh+ODvOOCv+OCueOCr+ODquODl+ODiCcsXG4gICAgICAnJyxcbiAgICAgICcjIFBvd2VyU2hlbGzlrp/ooYzjg53jg6rjgrfjg7zjga7oqK3lrponLFxuICAgICAgJ1NldC1FeGVjdXRpb25Qb2xpY3kgLUV4ZWN1dGlvblBvbGljeSBSZW1vdGVTaWduZWQgLUZvcmNlJyxcbiAgICAgICcnLFxuICAgICAgJyMgV2luZG93cyBVcGRhdGXjga7nhKHlirnljJbvvIjkuIDmmYLnmoTvvIknLFxuICAgICAgJ1N0b3AtU2VydmljZSAtTmFtZSB3dWF1c2VydiAtRm9yY2UnLFxuICAgICAgJ1NldC1TZXJ2aWNlIC1OYW1lIHd1YXVzZXJ2IC1TdGFydHVwVHlwZSBEaXNhYmxlZCcsXG4gICAgICAnJyxcbiAgICAgICcjIOS9nOalreODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkCcsXG4gICAgICAnTmV3LUl0ZW0gLUl0ZW1UeXBlIERpcmVjdG9yeSAtUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XCIgLUZvcmNlJyxcbiAgICAgICdOZXctSXRlbSAtSXRlbVR5cGUgRGlyZWN0b3J5IC1QYXRoIFwiQzpcXFxcU2NyaXB0c1wiIC1Gb3JjZScsXG4gICAgICAnJyxcbiAgICAgICcjIFB5dGhvbiAzLjEx44Gu44Kk44Oz44K544OI44O844OrJyxcbiAgICAgICd0cnkgeycsXG4gICAgICAnICAgIEludm9rZS1XZWJSZXF1ZXN0IC1VcmkgXCJodHRwczovL3d3dy5weXRob24ub3JnL2Z0cC9weXRob24vMy4xMS45L3B5dGhvbi0zLjExLjktYW1kNjQuZXhlXCIgLU91dEZpbGUgXCJDOlxcXFxweXRob24tMy4xMS45LWFtZDY0LmV4ZVwiJyxcbiAgICAgICcgICAgU3RhcnQtUHJvY2VzcyBcIkM6XFxcXHB5dGhvbi0zLjExLjktYW1kNjQuZXhlXCIgLVdhaXQgLUFyZ3VtZW50TGlzdCBcXCcvcXVpZXQgSW5zdGFsbEFsbFVzZXJzPTEgUHJlcGVuZFBhdGg9MVxcJycsXG4gICAgICAnfSBjYXRjaCB7JyxcbiAgICAgICcgICAgXCJQeXRob24gaW5zdGFsbGF0aW9uIGZhaWxlZDogJCgkXy5FeGNlcHRpb24uTWVzc2FnZSlcIiB8IE91dC1GaWxlIC1GaWxlUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XFxcXGVycm9yLmxvZ1wiIC1BcHBlbmQnLFxuICAgICAgJ30nLFxuICAgICAgJycsXG4gICAgICAnIyDnkrDlooPlpInmlbDjga7mm7TmlrAnLFxuICAgICAgJyRlbnY6UGF0aCA9IFtTeXN0ZW0uRW52aXJvbm1lbnRdOjpHZXRFbnZpcm9ubWVudFZhcmlhYmxlKFwiUGF0aFwiLFwiTWFjaGluZVwiKSArIFwiO1wiICsgW1N5c3RlbS5FbnZpcm9ubWVudF06OkdldEVudmlyb25tZW50VmFyaWFibGUoXCJQYXRoXCIsXCJVc2VyXCIpJyxcbiAgICAgICcnLFxuICAgICAgJyMgUHl0aG9u5L6d5a2Y6Zai5L+C44Gu44Kk44Oz44K544OI44O844OrJyxcbiAgICAgICd0cnkgeycsXG4gICAgICAnICAgIFN0YXJ0LVByb2Nlc3MgXCJweXRob25cIiAtV2FpdCAtQXJndW1lbnRMaXN0IFxcJy1tIHBpcCBpbnN0YWxsIC0tdXBncmFkZSBwaXBcXCcnLFxuICAgICAgJyAgICBTdGFydC1Qcm9jZXNzIFwicHl0aG9uXCIgLVdhaXQgLUFyZ3VtZW50TGlzdCBcXCctbSBwaXAgaW5zdGFsbCBwc3V0aWwgdGhyZWFkaW5nIGNvbmN1cnJlbnQuZnV0dXJlcyBtdWx0aXByb2Nlc3NpbmdcXCcnLFxuICAgICAgJ30gY2F0Y2ggeycsXG4gICAgICAnICAgIFwiUHl0aG9uIHBhY2thZ2VzIGluc3RhbGxhdGlvbiBmYWlsZWQ6ICQoJF8uRXhjZXB0aW9uLk1lc3NhZ2UpXCIgfCBPdXQtRmlsZSAtRmlsZVBhdGggXCJDOlxcXFxTUUxpdGVMb2FkVGVzdFxcXFxlcnJvci5sb2dcIiAtQXBwZW5kJyxcbiAgICAgICd9JyxcbiAgICAgICcnLFxuICAgICAgdGhpcy5nZW5lcmF0ZVNxbGl0ZVRlc3RTY3JpcHQocHJvcHMpLFxuICAgICAgJycsXG4gICAgICB0aGlzLmdlbmVyYXRlTW91bnRTY3JpcHQocHJvcHMpLFxuICAgICAgJycsXG4gICAgICB0aGlzLmdlbmVyYXRlUXVpY2tUZXN0U2NyaXB0KHByb3BzKSxcbiAgICAgICcnLFxuICAgICAgJyMgV2luZG93cyBEZWZlbmRlcuOBrumZpOWkluioreWumu+8iOODkeODleOCqeODvOODnuODs+OCueWQkeS4iu+8iScsXG4gICAgICAnQWRkLU1wUHJlZmVyZW5jZSAtRXhjbHVzaW9uUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XCInLFxuICAgICAgJ0FkZC1NcFByZWZlcmVuY2UgLUV4Y2x1c2lvblBhdGggXCJaOlxcXFxcIicsXG4gICAgICAnJyxcbiAgICAgICcjIOWIneacn+WMluWujOS6huOBruiomOmMsicsXG4gICAgICAnXCJXaW5kb3dzIFNRTGl0ZeiyoOiNt+ippumok+eSsOWig+OBruWIneacn+WMluWujOS6hiAtICQoR2V0LURhdGUpXCIgfCBPdXQtRmlsZSAtRmlsZVBhdGggXCJDOlxcXFxTUUxpdGVMb2FkVGVzdFxcXFxpbml0X2NvbXBsZXRlLmxvZ1wiJyxcbiAgICAgICcnLFxuICAgICAgJyMg44K344K544OG44Og5oOF5aCx44Gu6KiY6YyyJyxcbiAgICAgICdcIj09PSDjgrfjgrnjg4bjg6Dmg4XloLEgPT09XCIgfCBPdXQtRmlsZSAtRmlsZVBhdGggXCJDOlxcXFxTUUxpdGVMb2FkVGVzdFxcXFxpbml0X2NvbXBsZXRlLmxvZ1wiIC1BcHBlbmQnLFxuICAgICAgJ1wiT1M6ICQoR2V0LVdtaU9iamVjdCAtQ2xhc3MgV2luMzJfT3BlcmF0aW5nU3lzdGVtIHwgU2VsZWN0LU9iamVjdCAtRXhwYW5kUHJvcGVydHkgQ2FwdGlvbilcIiB8IE91dC1GaWxlIC1GaWxlUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XFxcXGluaXRfY29tcGxldGUubG9nXCIgLUFwcGVuZCcsXG4gICAgICAnXCJDUFU6ICQoR2V0LVdtaU9iamVjdCAtQ2xhc3MgV2luMzJfUHJvY2Vzc29yIHwgU2VsZWN0LU9iamVjdCAtRXhwYW5kUHJvcGVydHkgTmFtZSlcIiB8IE91dC1GaWxlIC1GaWxlUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XFxcXGluaXRfY29tcGxldGUubG9nXCIgLUFwcGVuZCcsXG4gICAgICAnXCJNZW1vcnk6ICQoW21hdGhdOjpSb3VuZCgoR2V0LVdtaU9iamVjdCAtQ2xhc3MgV2luMzJfQ29tcHV0ZXJTeXN0ZW0pLlRvdGFsUGh5c2ljYWxNZW1vcnkgLyAxR0IsIDIpKSBHQlwiIHwgT3V0LUZpbGUgLUZpbGVQYXRoIFwiQzpcXFxcU1FMaXRlTG9hZFRlc3RcXFxcaW5pdF9jb21wbGV0ZS5sb2dcIiAtQXBwZW5kJyxcbiAgICAgICcnLFxuICAgICAgJ1dyaXRlLUhvc3QgXCJTUUxpdGXosqDojbfoqabpqJPnkrDlooPjga7liJ3mnJ/ljJbjgYzlrozkuobjgZfjgb7jgZfjgZ9cIidcbiAgICApO1xuXG4gICAgcmV0dXJuIHVzZXJEYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIFNRTGl0ZeiyoOiNt+ippumok+OCueOCr+ODquODl+ODiOeUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZVNxbGl0ZVRlc3RTY3JpcHQocHJvcHM6IFdpbmRvd3NTcWxpdGVQcm9wcyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBcbiMgU1FMaXRl6LKg6I236Kmm6aiT44K544Kv44Oq44OX44OI44Gu5L2c5oiQXG4kc3FsaXRlU2NyaXB0ID0gQCdcbiMhL3Vzci9iaW4vZW52IHB5dGhvbjNcblwiXCJcIlxuV2luZG93c+eUqCBTUUxpdGUgVU5JUVVF5Yi257SE44Ko44Op44O86LKg6I236Kmm6aiT44K544Kv44Oq44OX44OIXG5GU3ggZm9yIE9OVEFQIENJRlPlhbHmnInkuIrjgadTUUxpdGXjg4fjg7zjgr/jg5njg7zjgrnjgavlr77jgZfjgabkuKbooYzmm7jjgY3ovrzjgb/jgpLlrp/ooYzjgZfjgIFcblVOSVFVReWItue0hOOCqOODqeODvOOCkuaEj+Wbs+eahOOBq+eZuueUn+OBleOBm+OBpuaAp+iDveOCkua4rOWumuOBmeOCi1xuXCJcIlwiXG5cbmltcG9ydCBzcWxpdGUzXG5pbXBvcnQgdGhyZWFkaW5nXG5pbXBvcnQgdGltZVxuaW1wb3J0IHJhbmRvbVxuaW1wb3J0IG9zXG5pbXBvcnQgc3lzXG5mcm9tIGNvbmN1cnJlbnQuZnV0dXJlcyBpbXBvcnQgVGhyZWFkUG9vbEV4ZWN1dG9yLCBhc19jb21wbGV0ZWRcbmltcG9ydCBtdWx0aXByb2Nlc3NpbmdcbmltcG9ydCBwc3V0aWxcblxuY2xhc3MgU1FMaXRlTG9hZFRlc3RlcjpcbiAgICBkZWYgX19pbml0X18oc2VsZiwgZGJfcGF0aCwgbnVtX3RocmVhZHM9MTAsIG51bV9vcGVyYXRpb25zPTEwMDApOlxuICAgICAgICBzZWxmLmRiX3BhdGggPSBkYl9wYXRoXG4gICAgICAgIHNlbGYubnVtX3RocmVhZHMgPSBudW1fdGhyZWFkc1xuICAgICAgICBzZWxmLm51bV9vcGVyYXRpb25zID0gbnVtX29wZXJhdGlvbnNcbiAgICAgICAgc2VsZi5zdWNjZXNzX2NvdW50ID0gMFxuICAgICAgICBzZWxmLmVycm9yX2NvdW50ID0gMFxuICAgICAgICBzZWxmLnVuaXF1ZV9lcnJvcl9jb3VudCA9IDBcbiAgICAgICAgc2VsZi5sb2NrID0gdGhyZWFkaW5nLkxvY2soKVxuICAgICAgICBcbiAgICBkZWYgc2V0dXBfZGF0YWJhc2Uoc2VsZik6XG4gICAgICAgIFwiXCJcIuODh+ODvOOCv+ODmeODvOOCueOBqOODhuODvOODluODq+OBruWIneacn+WMllwiXCJcIlxuICAgICAgICBjb25uID0gc3FsaXRlMy5jb25uZWN0KHNlbGYuZGJfcGF0aClcbiAgICAgICAgY3Vyc29yID0gY29ubi5jdXJzb3IoKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4jjg4bjg7zjg5bjg6vjga7kvZzmiJDvvIhVTklRVUXliLbntITku5jjgY3vvIlcbiAgICAgICAgY3Vyc29yLmV4ZWN1dGUoJycnXG4gICAgICAgICAgICBDUkVBVEUgVEFCTEUgSUYgTk9UIEVYSVNUUyB0ZXN0X3RhYmxlIChcbiAgICAgICAgICAgICAgICBpZCBJTlRFR0VSIFBSSU1BUlkgS0VZLFxuICAgICAgICAgICAgICAgIHVuaXF1ZV92YWx1ZSBJTlRFR0VSIFVOSVFVRSxcbiAgICAgICAgICAgICAgICBkYXRhIFRFWFQsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wIFJFQUxcbiAgICAgICAgICAgIClcbiAgICAgICAgJycnKVxuICAgICAgICBcbiAgICAgICAgIyDjgqTjg7Pjg4fjg4Pjgq/jgrnjga7kvZzmiJBcbiAgICAgICAgY3Vyc29yLmV4ZWN1dGUoJ0NSRUFURSBJTkRFWCBJRiBOT1QgRVhJU1RTIGlkeF90aW1lc3RhbXAgT04gdGVzdF90YWJsZSh0aW1lc3RhbXApJylcbiAgICAgICAgXG4gICAgICAgIGNvbm4uY29tbWl0KClcbiAgICAgICAgY29ubi5jbG9zZSgpXG4gICAgICAgIFxuICAgIGRlZiB3b3JrZXJfdGhyZWFkKHNlbGYsIHRocmVhZF9pZCwgb3BlcmF0aW9uc19wZXJfdGhyZWFkKTpcbiAgICAgICAgXCJcIlwi44Ov44O844Kr44O844K544Os44OD44OJ44Gu5Yem55CGXCJcIlwiXG4gICAgICAgIGxvY2FsX3N1Y2Nlc3MgPSAwXG4gICAgICAgIGxvY2FsX2Vycm9yID0gMFxuICAgICAgICBsb2NhbF91bmlxdWVfZXJyb3IgPSAwXG4gICAgICAgIFxuICAgICAgICAjIOOCueODrOODg+ODieOBlOOBqOOBq+eLrOeri+OBl+OBn0RC5o6l57aa44KS5L2c5oiQXG4gICAgICAgIGNvbm4gPSBzcWxpdGUzLmNvbm5lY3Qoc2VsZi5kYl9wYXRoLCB0aW1lb3V0PTMwLjApXG4gICAgICAgIGNvbm4uZXhlY3V0ZSgnUFJBR01BIGpvdXJuYWxfbW9kZT1XQUwnKSAgIyBXQUzjg6Ljg7zjg4njgafkuKbooYzmgKfjgpLlkJHkuIpcbiAgICAgICAgY29ubi5leGVjdXRlKCdQUkFHTUEgc3luY2hyb25vdXM9Tk9STUFMJylcbiAgICAgICAgXG4gICAgICAgIHRyeTpcbiAgICAgICAgICAgIGZvciBpIGluIHJhbmdlKG9wZXJhdGlvbnNfcGVyX3RocmVhZCk6XG4gICAgICAgICAgICAgICAgdHJ5OlxuICAgICAgICAgICAgICAgICAgICBjdXJzb3IgPSBjb25uLmN1cnNvcigpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAjIOaEj+Wbs+eahOOBq1VOSVFVReWItue0hOOCqOODqeODvOOCkueZuueUn+OBleOBm+OCi+OBn+OCgeOAgVxuICAgICAgICAgICAgICAgICAgICAjIOmZkOWumuOBleOCjOOBn+evhOWbsuOBruWApOOCkuS9v+eUqFxuICAgICAgICAgICAgICAgICAgICB1bmlxdWVfdmFsdWUgPSByYW5kb20ucmFuZGludCgxLCBvcGVyYXRpb25zX3Blcl90aHJlYWQgLy8gMilcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IGZcIlRocmVhZC17dGhyZWFkX2lkfS1PcGVyYXRpb24te2l9LURhdGEte3JhbmRvbS5yYW5kaW50KDEwMDAsIDk5OTkpfVwiXG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9IHRpbWUudGltZSgpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjdXJzb3IuZXhlY3V0ZSgnJydcbiAgICAgICAgICAgICAgICAgICAgICAgIElOU0VSVCBJTlRPIHRlc3RfdGFibGUgKHVuaXF1ZV92YWx1ZSwgZGF0YSwgdGltZXN0YW1wKVxuICAgICAgICAgICAgICAgICAgICAgICAgVkFMVUVTICg/LCA/LCA/KVxuICAgICAgICAgICAgICAgICAgICAnJycsICh1bmlxdWVfdmFsdWUsIGRhdGEsIHRpbWVzdGFtcCkpXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25uLmNvbW1pdCgpXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsX3N1Y2Nlc3MgKz0gMVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBleGNlcHQgc3FsaXRlMy5JbnRlZ3JpdHlFcnJvciBhcyBlOlxuICAgICAgICAgICAgICAgICAgICBpZiBcIlVOSVFVRSBjb25zdHJhaW50IGZhaWxlZFwiIGluIHN0cihlKTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsX3VuaXF1ZV9lcnJvciArPSAxXG4gICAgICAgICAgICAgICAgICAgIGVsc2U6XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbF9lcnJvciArPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsX2Vycm9yICs9IDFcbiAgICAgICAgICAgICAgICAgICAgcHJpbnQoZlwiVGhyZWFkIHt0aHJlYWRfaWR9OiBVbmV4cGVjdGVkIGVycm9yOiB7ZX1cIilcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgIGZpbmFsbHk6XG4gICAgICAgICAgICBjb25uLmNsb3NlKClcbiAgICAgICAgICAgIFxuICAgICAgICAjIOe1kOaenOOCkumbhuioiFxuICAgICAgICB3aXRoIHNlbGYubG9jazpcbiAgICAgICAgICAgIHNlbGYuc3VjY2Vzc19jb3VudCArPSBsb2NhbF9zdWNjZXNzXG4gICAgICAgICAgICBzZWxmLmVycm9yX2NvdW50ICs9IGxvY2FsX2Vycm9yXG4gICAgICAgICAgICBzZWxmLnVuaXF1ZV9lcnJvcl9jb3VudCArPSBsb2NhbF91bmlxdWVfZXJyb3JcbiAgICAgICAgICAgIFxuICAgICAgICBwcmludChmXCJUaHJlYWQge3RocmVhZF9pZH0gY29tcGxldGVkOiBTdWNjZXNzPXtsb2NhbF9zdWNjZXNzfSwgXCJcbiAgICAgICAgICAgICAgZlwiVW5pcXVlRXJyb3JzPXtsb2NhbF91bmlxdWVfZXJyb3J9LCBPdGhlckVycm9ycz17bG9jYWxfZXJyb3J9XCIpXG4gICAgXG4gICAgZGVmIHJ1bl9sb2FkX3Rlc3Qoc2VsZik6XG4gICAgICAgIFwiXCJcIuiyoOiNt+ippumok+OBruWun+ihjFwiXCJcIlxuICAgICAgICBwcmludChmXCJTdGFydGluZyBTUUxpdGUgbG9hZCB0ZXN0Li4uXCIpXG4gICAgICAgIHByaW50KGZcIkRhdGFiYXNlOiB7c2VsZi5kYl9wYXRofVwiKVxuICAgICAgICBwcmludChmXCJUaHJlYWRzOiB7c2VsZi5udW1fdGhyZWFkc31cIilcbiAgICAgICAgcHJpbnQoZlwiVG90YWwgb3BlcmF0aW9uczoge3NlbGYubnVtX29wZXJhdGlvbnN9XCIpXG4gICAgICAgIHByaW50KGZcIk9wZXJhdGlvbnMgcGVyIHRocmVhZDoge3NlbGYubnVtX29wZXJhdGlvbnMgLy8gc2VsZi5udW1fdGhyZWFkc31cIilcbiAgICAgICAgXG4gICAgICAgICMg44OH44O844K/44OZ44O844K544Gu5Yid5pyf5YyWXG4gICAgICAgIHNlbGYuc2V0dXBfZGF0YWJhc2UoKVxuICAgICAgICBcbiAgICAgICAgIyDjgrfjgrnjg4bjg6Dmg4XloLHjga7ooajnpLpcbiAgICAgICAgcHJpbnQoZlwiQ1BVIGNvcmVzOiB7bXVsdGlwcm9jZXNzaW5nLmNwdV9jb3VudCgpfVwiKVxuICAgICAgICBwcmludChmXCJNZW1vcnk6IHtwc3V0aWwudmlydHVhbF9tZW1vcnkoKS50b3RhbCAvICgxMDI0KiozKTouMWZ9IEdCXCIpXG4gICAgICAgIFxuICAgICAgICBzdGFydF90aW1lID0gdGltZS50aW1lKClcbiAgICAgICAgXG4gICAgICAgICMg44K544Os44OD44OJ44OX44O844Or44Gn5Lim6KGM5a6f6KGMXG4gICAgICAgIG9wZXJhdGlvbnNfcGVyX3RocmVhZCA9IHNlbGYubnVtX29wZXJhdGlvbnMgLy8gc2VsZi5udW1fdGhyZWFkc1xuICAgICAgICBcbiAgICAgICAgd2l0aCBUaHJlYWRQb29sRXhlY3V0b3IobWF4X3dvcmtlcnM9c2VsZi5udW1fdGhyZWFkcykgYXMgZXhlY3V0b3I6XG4gICAgICAgICAgICBmdXR1cmVzID0gW11cbiAgICAgICAgICAgIGZvciB0aHJlYWRfaWQgaW4gcmFuZ2Uoc2VsZi5udW1fdGhyZWFkcyk6XG4gICAgICAgICAgICAgICAgZnV0dXJlID0gZXhlY3V0b3Iuc3VibWl0KHNlbGYud29ya2VyX3RocmVhZCwgdGhyZWFkX2lkLCBvcGVyYXRpb25zX3Blcl90aHJlYWQpXG4gICAgICAgICAgICAgICAgZnV0dXJlcy5hcHBlbmQoZnV0dXJlKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAjIOWFqOOCueODrOODg+ODieOBruWujOS6huOCkuW+heapn1xuICAgICAgICAgICAgZm9yIGZ1dHVyZSBpbiBhc19jb21wbGV0ZWQoZnV0dXJlcyk6XG4gICAgICAgICAgICAgICAgdHJ5OlxuICAgICAgICAgICAgICAgICAgICBmdXR1cmUucmVzdWx0KClcbiAgICAgICAgICAgICAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgICAgICAgICAgICAgIHByaW50KGZcIlRocmVhZCBleGVjdXRpb24gZXJyb3I6IHtlfVwiKVxuICAgICAgICBcbiAgICAgICAgZW5kX3RpbWUgPSB0aW1lLnRpbWUoKVxuICAgICAgICBkdXJhdGlvbiA9IGVuZF90aW1lIC0gc3RhcnRfdGltZVxuICAgICAgICBcbiAgICAgICAgIyDntZDmnpzjga7ooajnpLpcbiAgICAgICAgdG90YWxfb3BlcmF0aW9ucyA9IHNlbGYuc3VjY2Vzc19jb3VudCArIHNlbGYuZXJyb3JfY291bnQgKyBzZWxmLnVuaXF1ZV9lcnJvcl9jb3VudFxuICAgICAgICBcbiAgICAgICAgcHJpbnQoXCJcXFxcblwiICsgXCI9XCIqNjApXG4gICAgICAgIHByaW50KFwiU1FMaXRlIFVOSVFVReWItue0hOOCqOODqeODvOiyoOiNt+ippumok+e1kOaenFwiKVxuICAgICAgICBwcmludChcIj1cIio2MClcbiAgICAgICAgcHJpbnQoZlwi5a6f6KGM5pmC6ZaTOiB7ZHVyYXRpb246LjJmfSDnp5JcIilcbiAgICAgICAgcHJpbnQoZlwi57eP5pON5L2c5pWwOiB7dG90YWxfb3BlcmF0aW9uc31cIilcbiAgICAgICAgcHJpbnQoZlwi5oiQ5YqfOiB7c2VsZi5zdWNjZXNzX2NvdW50fSAoe3NlbGYuc3VjY2Vzc19jb3VudC90b3RhbF9vcGVyYXRpb25zKjEwMDouMWZ9JSlcIilcbiAgICAgICAgcHJpbnQoZlwiVU5JUVVF5Yi257SE44Ko44Op44O8OiB7c2VsZi51bmlxdWVfZXJyb3JfY291bnR9ICh7c2VsZi51bmlxdWVfZXJyb3JfY291bnQvdG90YWxfb3BlcmF0aW9ucyoxMDA6LjFmfSUpXCIpXG4gICAgICAgIHByaW50KGZcIuOBneOBruS7luOCqOODqeODvDoge3NlbGYuZXJyb3JfY291bnR9ICh7c2VsZi5lcnJvcl9jb3VudC90b3RhbF9vcGVyYXRpb25zKjEwMDouMWZ9JSlcIilcbiAgICAgICAgcHJpbnQoZlwi44K544Or44O844OX44OD44OIOiB7dG90YWxfb3BlcmF0aW9ucy9kdXJhdGlvbjouMWZ9IG9wcy9zZWNcIilcbiAgICAgICAgcHJpbnQoXCI9XCIqNjApXG4gICAgICAgIFxuICAgICAgICAjIOODh+ODvOOCv+ODmeODvOOCueOCteOCpOOCuuOBrueiuuiqjVxuICAgICAgICBpZiBvcy5wYXRoLmV4aXN0cyhzZWxmLmRiX3BhdGgpOlxuICAgICAgICAgICAgZGJfc2l6ZSA9IG9zLnBhdGguZ2V0c2l6ZShzZWxmLmRiX3BhdGgpXG4gICAgICAgICAgICBwcmludChmXCLjg4fjg7zjgr/jg5njg7zjgrnjgrXjgqTjgro6IHtkYl9zaXplIC8gKDEwMjQqMTAyNCk6LjJmfSBNQlwiKVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdkdXJhdGlvbic6IGR1cmF0aW9uLFxuICAgICAgICAgICAgJ3RvdGFsX29wZXJhdGlvbnMnOiB0b3RhbF9vcGVyYXRpb25zLFxuICAgICAgICAgICAgJ3N1Y2Nlc3NfY291bnQnOiBzZWxmLnN1Y2Nlc3NfY291bnQsXG4gICAgICAgICAgICAndW5pcXVlX2Vycm9yX2NvdW50Jzogc2VsZi51bmlxdWVfZXJyb3JfY291bnQsXG4gICAgICAgICAgICAnZXJyb3JfY291bnQnOiBzZWxmLmVycm9yX2NvdW50LFxuICAgICAgICAgICAgJ3Rocm91Z2hwdXQnOiB0b3RhbF9vcGVyYXRpb25zIC8gZHVyYXRpb25cbiAgICAgICAgfVxuXG5kZWYgbWFpbigpOlxuICAgIGlmIGxlbihzeXMuYXJndikgPCAyOlxuICAgICAgICBwcmludChcIlVzYWdlOiBweXRob24gdW5pcXVlX2NvbnN0cmFpbnRfdGVzdC5weSA8ZGJfcGF0aD4gW3RocmVhZHNdIFtvcGVyYXRpb25zXVwiKVxuICAgICAgICBwcmludChcIkV4YW1wbGU6IHB5dGhvbiB1bmlxdWVfY29uc3RyYWludF90ZXN0LnB5IFo6XFxcXFxcXFx0ZXN0LmRiIDIwIDUwMDBcIilcbiAgICAgICAgc3lzLmV4aXQoMSlcbiAgICBcbiAgICBkYl9wYXRoID0gc3lzLmFyZ3ZbMV1cbiAgICBudW1fdGhyZWFkcyA9IGludChzeXMuYXJndlsyXSkgaWYgbGVuKHN5cy5hcmd2KSA+IDIgZWxzZSAxMFxuICAgIG51bV9vcGVyYXRpb25zID0gaW50KHN5cy5hcmd2WzNdKSBpZiBsZW4oc3lzLmFyZ3YpID4gMyBlbHNlIDEwMDBcbiAgICBcbiAgICAjIOODh+OCo+ODrOOCr+ODiOODquOBjOWtmOWcqOOBl+OBquOBhOWgtOWQiOOBr+S9nOaIkFxuICAgIG9zLm1ha2VkaXJzKG9zLnBhdGguZGlybmFtZShkYl9wYXRoKSwgZXhpc3Rfb2s9VHJ1ZSlcbiAgICBcbiAgICB0ZXN0ZXIgPSBTUUxpdGVMb2FkVGVzdGVyKGRiX3BhdGgsIG51bV90aHJlYWRzLCBudW1fb3BlcmF0aW9ucylcbiAgICByZXN1bHRzID0gdGVzdGVyLnJ1bl9sb2FkX3Rlc3QoKVxuICAgIFxuICAgICMg57WQ5p6c44KS44OV44Kh44Kk44Or44Gr5L+d5a2YXG4gICAgcmVzdWx0X2ZpbGUgPSBmXCJ7ZGJfcGF0aH0ucmVzdWx0cy50eHRcIlxuICAgIHdpdGggb3BlbihyZXN1bHRfZmlsZSwgJ3cnKSBhcyBmOlxuICAgICAgICBmLndyaXRlKGZcIlNRTGl0ZSBMb2FkIFRlc3QgUmVzdWx0c1xcXFxuXCIpXG4gICAgICAgIGYud3JpdGUoZlwiPT09PT09PT09PT09PT09PT09PT09PT09XFxcXG5cIilcbiAgICAgICAgZi53cml0ZShmXCJEYXRhYmFzZToge2RiX3BhdGh9XFxcXG5cIilcbiAgICAgICAgZi53cml0ZShmXCJUaHJlYWRzOiB7bnVtX3RocmVhZHN9XFxcXG5cIilcbiAgICAgICAgZi53cml0ZShmXCJEdXJhdGlvbjoge3Jlc3VsdHNbJ2R1cmF0aW9uJ106LjJmfSBzZWNvbmRzXFxcXG5cIilcbiAgICAgICAgZi53cml0ZShmXCJUb3RhbCBPcGVyYXRpb25zOiB7cmVzdWx0c1sndG90YWxfb3BlcmF0aW9ucyddfVxcXFxuXCIpXG4gICAgICAgIGYud3JpdGUoZlwiU3VjY2Vzczoge3Jlc3VsdHNbJ3N1Y2Nlc3NfY291bnQnXX1cXFxcblwiKVxuICAgICAgICBmLndyaXRlKGZcIlVOSVFVRSBFcnJvcnM6IHtyZXN1bHRzWyd1bmlxdWVfZXJyb3JfY291bnQnXX1cXFxcblwiKVxuICAgICAgICBmLndyaXRlKGZcIk90aGVyIEVycm9yczoge3Jlc3VsdHNbJ2Vycm9yX2NvdW50J119XFxcXG5cIilcbiAgICAgICAgZi53cml0ZShmXCJUaHJvdWdocHV0OiB7cmVzdWx0c1sndGhyb3VnaHB1dCddOi4xZn0gb3BzL3NlY1xcXFxuXCIpXG4gICAgXG4gICAgcHJpbnQoZlwiXFxcXG7ntZDmnpzjgpIge3Jlc3VsdF9maWxlfSDjgavkv53lrZjjgZfjgb7jgZfjgZ9cIilcblxuaWYgX19uYW1lX18gPT0gXCJfX21haW5fX1wiOlxuICAgIG1haW4oKVxuJ0BcblxuJHNxbGl0ZVNjcmlwdCB8IE91dC1GaWxlIC1GaWxlUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XFxcXHVuaXF1ZV9jb25zdHJhaW50X3Rlc3QucHlcIiAtRW5jb2RpbmcgVVRGOFxuICAgIGAudHJpbSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZTeCDjg57jgqbjg7Pjg4jjgrnjgq/jg6rjg5fjg4jnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVNb3VudFNjcmlwdChwcm9wczogV2luZG93c1NxbGl0ZVByb3BzKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxuIyBGU3ggQ0lGU+WFseacieODnuOCpuODs+ODiOeUqOOBruOCueOCr+ODquODl+ODiOS9nOaIkFxuJG1vdW50U2NyaXB0ID0gQCdcbiMgRlN4IGZvciBPTlRBUCBDSUZT5YWx5pyJ44Gu44Oe44Km44Oz44OIXG5cbiRGU1hfSVAgPSBcIiR7cHJvcHMuZnN4Q2lmc0VuZHBvaW50fVwiXG4kU0hBUkVfTkFNRSA9IFwiJHtwcm9wcy5mc3hDaWZzU2hhcmVOYW1lfVwiXG4kRFJJVkVfTEVUVEVSID0gXCJaOlwiXG5cbldyaXRlLUhvc3QgXCJGU3ggZm9yIE9OVEFQIENJRlPlhbHmnInjgpLjg57jgqbjg7Pjg4jkuK0uLi5cIlxuV3JpdGUtSG9zdCBcIklQOiAkRlNYX0lQXCJcbldyaXRlLUhvc3QgXCLlhbHmnInlkI06ICRTSEFSRV9OQU1FXCJcbldyaXRlLUhvc3QgXCLjg4njg6njgqTjg5Y6ICREUklWRV9MRVRURVJcIlxuXG50cnkge1xuICAgICMg5pei5a2Y44Gu44Oe44OD44OU44Oz44Kw44KS5YmK6ZmkXG4gICAgaWYgKEdldC1QU0RyaXZlIC1OYW1lIFwiWlwiIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlKSB7XG4gICAgICAgIFJlbW92ZS1QU0RyaXZlIC1OYW1lIFwiWlwiIC1Gb3JjZVxuICAgIH1cbiAgICBcbiAgICAjIOODjeODg+ODiOODr+ODvOOCr+ODieODqeOCpOODluOBruODnuODg+ODlOODs+OCsFxuICAgIG5ldCB1c2UgJERSSVZFX0xFVFRFUiBcIlxcXFxcXFxcJEZTWF9JUFxcXFwkU0hBUkVfTkFNRVwiIC9wZXJzaXN0ZW50Onllc1xuICAgIFxuICAgIGlmICgkTEFTVEVYSVRDT0RFIC1lcSAwKSB7XG4gICAgICAgIFdyaXRlLUhvc3QgXCLjg57jgqbjg7Pjg4jmiJDlip8hXCJcbiAgICAgICAgV3JpdGUtSG9zdCBcIuODnuOCpuODs+ODiOeKtuazgTpcIlxuICAgICAgICBHZXQtUFNEcml2ZSAtUFNQcm92aWRlciBGaWxlU3lzdGVtIHwgV2hlcmUtT2JqZWN0IHskXy5OYW1lIC1lcSBcIlpcIn1cbiAgICAgICAgXG4gICAgICAgIFdyaXRlLUhvc3QgXCJTUUxpdGXosqDojbfoqabpqJPjga7mupblgpnlrozkuoZcIlxuICAgICAgICBXcml0ZS1Ib3N0IFwi5a6f6KGM5L6LOlwiXG4gICAgICAgIFdyaXRlLUhvc3QgXCJweXRob24gQzpcXFxcU1FMaXRlTG9hZFRlc3RcXFxcdW5pcXVlX2NvbnN0cmFpbnRfdGVzdC5weSBaOlxcXFx0ZXN0LmRiIDIwIDUwMDBcIlxuICAgIH0gZWxzZSB7XG4gICAgICAgIFdyaXRlLUhvc3QgXCLjg57jgqbjg7Pjg4jlpLHmlZdcIlxuICAgICAgICBleGl0IDFcbiAgICB9XG59IGNhdGNoIHtcbiAgICBXcml0ZS1Ib3N0IFwi44Ko44Op44O8OiAkKCRfLkV4Y2VwdGlvbi5NZXNzYWdlKVwiXG4gICAgZXhpdCAxXG59XG4nQFxuXG4kbW91bnRTY3JpcHQgfCBPdXQtRmlsZSAtRmlsZVBhdGggXCJDOlxcXFxTUUxpdGVMb2FkVGVzdFxcXFxtb3VudF9mc3gucHMxXCIgLUVuY29kaW5nIFVURjhcbiAgICBgLnRyaW0oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnsKHljZjjgarosqDojbfoqabpqJPjgrnjgq/jg6rjg5fjg4jnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVRdWlja1Rlc3RTY3JpcHQocHJvcHM6IFdpbmRvd3NTcWxpdGVQcm9wcyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBcbiMg57Ch5Y2Y44Gq6LKg6I236Kmm6aiT5a6f6KGM44K544Kv44Oq44OX44OIXG4kcXVpY2tUZXN0U2NyaXB0ID0gQCdcbiMg57Ch5Y2Y44GqU1FMaXRl6LKg6I236Kmm6aiT44Gu5a6f6KGMXG5cbldyaXRlLUhvc3QgXCJTUUxpdGUgVU5JUVVF5Yi257SE44Ko44Op44O86LKg6I236Kmm6aiT44KS6ZaL5aeL44GX44G+44GZLi4uXCJcblxuIyBGU3jlhbHmnInjga7jg57jgqbjg7Pjg4jnorroqo1cbmlmICgtbm90IChUZXN0LVBhdGggXCJaOlxcXFxcIikpIHtcbiAgICBXcml0ZS1Ib3N0IFwiRlN45YWx5pyJ44KS44Oe44Km44Oz44OI5LitLi4uXCJcbiAgICAmIFwiQzpcXFxcU1FMaXRlTG9hZFRlc3RcXFxcbW91bnRfZnN4LnBzMVwiXG59XG5cbiMg6Lu944GE6LKg6I236Kmm6aiT77yIMTDjgrnjg6zjg4Pjg4njgIExMDAw5pON5L2c77yJXG5Xcml0ZS1Ib3N0IFwi6Lu944GE6LKg6I236Kmm6aiT44KS5a6f6KGM5LitLi4uXCJcbnB5dGhvbiBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XFxcXHVuaXF1ZV9jb25zdHJhaW50X3Rlc3QucHlcIiBcIlo6XFxcXHF1aWNrX3Rlc3QuZGJcIiAxMCAxMDAwXG5cbldyaXRlLUhvc3QgXCLosqDojbfoqabpqJPlrozkuoZcIlxuJ0BcblxuJHF1aWNrVGVzdFNjcmlwdCB8IE91dC1GaWxlIC1GaWxlUGF0aCBcIkM6XFxcXFNRTGl0ZUxvYWRUZXN0XFxcXHJ1bl9xdWlja190ZXN0LnBzMVwiIC1FbmNvZGluZyBVVEY4XG4gICAgYC50cmltKCk7XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw6YGp55SoXG4gICAqL1xuICBwcml2YXRlIGFwcGx5VGFncyhwcm9wczogV2luZG93c1NxbGl0ZVByb3BzKTogdm9pZCB7XG4gICAgY29uc3QgdGFncyA9IHtcbiAgICAgIFByb2plY3Q6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgQ29tcG9uZW50OiAnV2luZG93c1NRTGl0ZUxvYWRUZXN0JyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCpOODs+OCueOCv+ODs+OCueaDheWgseWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldEluc3RhbmNlSW5mbygpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICByZXR1cm4ge1xuICAgICAgaW5zdGFuY2VJZDogdGhpcy5pbnN0YW5jZS5pbnN0YW5jZUlkLFxuICAgICAgcHJpdmF0ZUlwOiB0aGlzLmluc3RhbmNlLmluc3RhbmNlUHJpdmF0ZUlwLFxuICAgICAgYmFzdGlvbkhvc3RQdWJsaWNJcDogdGhpcy5iYXN0aW9uSG9zdD8uaW5zdGFuY2VQdWJsaWNJcCxcbiAgICB9O1xuICB9XG59Il19