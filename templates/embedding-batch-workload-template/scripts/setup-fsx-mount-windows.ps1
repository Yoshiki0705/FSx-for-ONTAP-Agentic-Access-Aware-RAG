# FSx for ONTAP Windows Mount Setup Script
# EC2 WindowsインスタンスでFSx for ONTAPボリュームをマウント

param(
    [Parameter(Mandatory=$true)]
    [string]$FSxDNSName,
    
    [Parameter(Mandatory=$true)]
    [string]$SVMName,
    
    [Parameter(Mandatory=$false)]
    [string]$VolumeName = "embedding_data",
    
    [Parameter(Mandatory=$false)]
    [string]$MountDrive = "Z:",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "fsxadmin",
    
    [Parameter(Mandatory=$false)]
    [switch]$CreateVolume,
    
    [Parameter(Mandatory=$false)]
    [string]$VolumeSize = "100GB"
)

# ログ関数
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

# FSx for ONTAP新ボリューム作成
function New-FSxVolume {
    param(
        [string]$DNSName,
        [string]$SVM,
        [string]$Volume,
        [string]$Size,
        [string]$User
    )
    
    Write-Log "新しいFSxボリュームを作成中: $Volume" "INFO"
    
    # NetApp ONTAP CLIコマンドを使用してボリューム作成
    $createVolumeCommand = @"
ssh $User@$DNSName "volume create -vserver $SVM -volume $Volume -aggregate aggr1 -size $Size -junction-path /$Volume"
"@
    
    Write-Log "実行コマンド: $createVolumeCommand" "INFO"
    Write-Log "注意: 実際の環境では適切な認証情報とアクセス方法を使用してください" "WARN"
    
    # 実際の実装では、AWS CLI、PowerShell、またはREST APIを使用
    Write-Log "ボリューム作成コマンドを手動で実行してください:" "INFO"
    Write-Log $createVolumeCommand "INFO"
}

# NFSクライアント機能の有効化
function Enable-NFSClient {
    Write-Log "NFSクライアント機能を確認中..." "INFO"
    
    $nfsFeature = Get-WindowsFeature -Name "NFS-Client"
    if ($nfsFeature.InstallState -ne "Installed") {
        Write-Log "NFSクライアント機能をインストール中..." "INFO"
        Install-WindowsFeature -Name "NFS-Client" -IncludeManagementTools
        Write-Log "NFSクライアント機能のインストール完了" "INFO"
    } else {
        Write-Log "NFSクライアント機能は既にインストール済み" "INFO"
    }
}

# FSxボリュームのマウント
function Mount-FSxVolume {
    param(
        [string]$DNSName,
        [string]$SVM,
        [string]$Volume,
        [string]$Drive
    )
    
    Write-Log "FSxボリュームをマウント中..." "INFO"
    
    $nfsPath = "$DNSName`:/$Volume"
    Write-Log "NFSパス: $nfsPath" "INFO"
    Write-Log "マウントドライブ: $Drive" "INFO"
    
    try {
        # 既存のマウントを確認
        $existingMount = Get-PSDrive -Name $Drive.TrimEnd(':') -ErrorAction SilentlyContinue
        if ($existingMount) {
            Write-Log "既存のマウントを削除中: $Drive" "WARN"
            Remove-PSDrive -Name $Drive.TrimEnd(':') -Force
        }
        
        # NFSマウント実行
        $mountCommand = "mount -o anon $nfsPath $Drive"
        Write-Log "実行コマンド: $mountCommand" "INFO"
        
        Invoke-Expression $mountCommand
        
        # マウント確認
        if (Test-Path $Drive) {
            Write-Log "マウント成功: $Drive" "INFO"
            
            # テスト書き込み
            $testFile = Join-Path $Drive "mount-test.txt"
            "Mount test - $(Get-Date)" | Out-File -FilePath $testFile -Encoding UTF8
            
            if (Test-Path $testFile) {
                Write-Log "書き込みテスト成功" "INFO"
                Remove-Item $testFile -Force
            } else {
                Write-Log "書き込みテスト失敗" "ERROR"
            }
        } else {
            Write-Log "マウント失敗" "ERROR"
            return $false
        }
        
    } catch {
        Write-Log "マウントエラー: $($_.Exception.Message)" "ERROR"
        return $false
    }
    
    return $true
}

# 永続的マウント設定
function Set-PersistentMount {
    param(
        [string]$DNSName,
        [string]$SVM,
        [string]$Volume,
        [string]$Drive
    )
    
    Write-Log "永続的マウント設定を作成中..." "INFO"
    
    $nfsPath = "$DNSName`:/$Volume"
    $scriptPath = "C:\Scripts\mount-fsx.ps1"
    
    # スクリプトディレクトリ作成
    $scriptDir = Split-Path $scriptPath -Parent
    if (-not (Test-Path $scriptDir)) {
        New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null
    }
    
    # マウントスクリプト作成
    $mountScript = @"
# FSx for ONTAP Auto Mount Script
# Generated: $(Get-Date)

try {
    `$nfsPath = "$nfsPath"
    `$drive = "$Drive"
    
    Write-Host "FSxボリュームを自動マウント中: `$drive"
    
    # 既存マウントの確認と削除
    `$existingMount = Get-PSDrive -Name `$drive.TrimEnd(':') -ErrorAction SilentlyContinue
    if (`$existingMount) {
        Remove-PSDrive -Name `$drive.TrimEnd(':') -Force
    }
    
    # NFSマウント
    Invoke-Expression "mount -o anon `$nfsPath `$drive"
    
    if (Test-Path `$drive) {
        Write-Host "自動マウント成功: `$drive"
    } else {
        Write-Host "自動マウント失敗: `$drive"
    }
    
} catch {
    Write-Host "自動マウントエラー: `$(`$_.Exception.Message)"
}
"@
    
    Set-Content -Path $scriptPath -Value $mountScript -Encoding UTF8
    Write-Log "マウントスクリプト作成: $scriptPath" "INFO"
    
    # タスクスケジューラに登録
    $taskName = "FSx-AutoMount"
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    try {
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force
        Write-Log "自動マウントタスク登録完了: $taskName" "INFO"
    } catch {
        Write-Log "タスク登録エラー: $($_.Exception.Message)" "ERROR"
    }
}

# メイン実行
try {
    Write-Log "=== FSx for ONTAP Windows マウント設定開始 ===" "INFO"
    Write-Log "FSx DNS名: $FSxDNSName" "INFO"
    Write-Log "SVM名: $SVMName" "INFO"
    Write-Log "ボリューム名: $VolumeName" "INFO"
    Write-Log "マウントドライブ: $MountDrive" "INFO"
    
    # 管理者権限チェック
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-Log "このスクリプトは管理者権限で実行してください" "ERROR"
        exit 1
    }
    
    # 新ボリューム作成（オプション）
    if ($CreateVolume) {
        New-FSxVolume -DNSName $FSxDNSName -SVM $SVMName -Volume $VolumeName -Size $VolumeSize -User $Username
        Write-Log "ボリューム作成後、数分待ってからマウントを実行してください" "INFO"
        Read-Host "準備ができたらEnterキーを押してください"
    }
    
    # NFSクライアント有効化
    Enable-NFSClient
    
    # FSxボリュームマウント
    if (Mount-FSxVolume -DNSName $FSxDNSName -SVM $SVMName -Volume $VolumeName -Drive $MountDrive) {
        Write-Log "マウント成功" "INFO"
        
        # 永続的マウント設定
        Set-PersistentMount -DNSName $FSxDNSName -SVM $SVMName -Volume $VolumeName -Drive $MountDrive
        
        Write-Log "=== セットアップ完了 ===" "INFO"
        Write-Log "FSxボリュームは $MountDrive にマウントされました" "INFO"
        Write-Log "負荷試験を実行するには以下のコマンドを使用してください:" "INFO"
        Write-Log ".\load-test-fsx-embedding.ps1 -FSxMountPath $MountDrive" "INFO"
        
    } else {
        Write-Log "マウント失敗" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "エラーが発生しました: $($_.Exception.Message)" "ERROR"
    exit 1
}