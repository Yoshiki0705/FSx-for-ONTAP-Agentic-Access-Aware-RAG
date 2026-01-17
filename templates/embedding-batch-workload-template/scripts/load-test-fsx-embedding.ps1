# FSx for ONTAP Embedding Load Test Script
# EC2 WindowsインスタンスからFSx for ONTAPに大量データを投入して負荷試験を実行

param(
    [Parameter(Mandatory=$false)]
    [string]$FSxMountPath = "Z:\",
    
    [Parameter(Mandatory=$false)]
    [int]$FileCount = 100,
    
    [Parameter(Mandatory=$false)]
    [string]$TestDataDir = "load-test-data",
    
    [Parameter(Mandatory=$false)]
    [int]$BatchSize = 20,
    
    [Parameter(Mandatory=$false)]
    [int]$DelayBetweenBatches = 5,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# ログ関数
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path "load-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').log" -Value $logMessage
}

# FSxマウント確認
function Test-FSxMount {
    if (-not (Test-Path $FSxMountPath)) {
        Write-Log "FSxマウントパスが見つかりません: $FSxMountPath" "ERROR"
        return $false
    }
    Write-Log "FSxマウント確認完了: $FSxMountPath" "INFO"
    return $true
}

# テストデータ生成
function Generate-TestData {
    param([string]$OutputDir, [int]$Count)
    
    Write-Log "テストデータを生成中: $Count ファイル" "INFO"
    
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    
    $sampleTexts = @(
        "Machine learning is revolutionizing how we process and understand data.",
        "Deep learning neural networks can identify complex patterns in large datasets.",
        "Natural language processing enables computers to understand human communication.",
        "Computer vision algorithms can analyze and interpret visual information.",
        "Reinforcement learning allows AI systems to learn through trial and error."
    )
    
    for ($i = 1; $i -le $Count; $i++) {
        $filename = "test-document-{0:D4}.txt" -f $i
        $filepath = Join-Path $OutputDir $filename
        
        $content = @"
Document ID: $i
Generated: $(Get-Date)
Content: $($sampleTexts | Get-Random)

This is a test document for FSx for ONTAP embedding load testing.
The document contains sample text to test the embedding processing pipeline.
File size and content are designed to simulate real-world document processing scenarios.

Additional content to increase file size:
$(1..10 | ForEach-Object { "Line $_ of additional content for document $i" })
"@
        
        Set-Content -Path $filepath -Value $content -Encoding UTF8
        
        if ($Verbose -and ($i % 10 -eq 0)) {
            Write-Log "生成済み: $i/$Count ファイル" "INFO"
        }
    }
    
    Write-Log "テストデータ生成完了: $Count ファイル" "INFO"
}

Write-Log "=== FSx for ONTAP Embedding 負荷試験開始 ===" "INFO"# バッチアップロ
ード実行
function Start-BatchUpload {
    param([string]$SourceDir, [string]$TargetDir, [int]$BatchSize, [int]$Delay)
    
    Write-Log "バッチアップロード開始" "INFO"
    Write-Log "ソース: $SourceDir" "INFO"
    Write-Log "ターゲット: $TargetDir" "INFO"
    Write-Log "バッチサイズ: $BatchSize" "INFO"
    
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }
    
    $files = Get-ChildItem -Path $SourceDir -File
    $totalFiles = $files.Count
    $batchCount = [Math]::Ceiling($totalFiles / $BatchSize)
    
    Write-Log "総ファイル数: $totalFiles" "INFO"
    Write-Log "バッチ数: $batchCount" "INFO"
    
    $uploadResults = @()
    
    for ($batch = 0; $batch -lt $batchCount; $batch++) {
        $startIndex = $batch * $BatchSize
        $endIndex = [Math]::Min($startIndex + $BatchSize - 1, $totalFiles - 1)
        $batchFiles = $files[$startIndex..$endIndex]
        
        Write-Log "バッチ $($batch + 1)/$batchCount 実行中 (ファイル $($startIndex + 1)-$($endIndex + 1))" "INFO"
        
        $batchStartTime = Get-Date
        
        # 並列コピー実行
        $jobs = @()
        foreach ($file in $batchFiles) {
            $targetPath = Join-Path $TargetDir $file.Name
            $job = Start-Job -ScriptBlock {
                param($source, $target)
                try {
                    Copy-Item -Path $source -Destination $target -Force
                    return @{ Success = $true; File = $source; Error = $null }
                } catch {
                    return @{ Success = $false; File = $source; Error = $_.Exception.Message }
                }
            } -ArgumentList $file.FullName, $targetPath
            $jobs += $job
        }
        
        # ジョブ完了待機
        $results = $jobs | Wait-Job | Receive-Job
        $jobs | Remove-Job
        
        $batchEndTime = Get-Date
        $batchDuration = ($batchEndTime - $batchStartTime).TotalSeconds
        
        $successCount = ($results | Where-Object { $_.Success }).Count
        $failureCount = ($results | Where-Object { -not $_.Success }).Count
        
        $batchResult = @{
            BatchNumber = $batch + 1
            FilesProcessed = $batchFiles.Count
            SuccessCount = $successCount
            FailureCount = $failureCount
            Duration = $batchDuration
            Timestamp = $batchStartTime
        }
        
        $uploadResults += $batchResult
        
        Write-Log "バッチ $($batch + 1) 完了: 成功 $successCount, 失敗 $failureCount, 時間 $([Math]::Round($batchDuration, 2))秒" "INFO"
        
        # 失敗があった場合の詳細ログ
        $failures = $results | Where-Object { -not $_.Success }
        foreach ($failure in $failures) {
            Write-Log "アップロード失敗: $($failure.File) - $($failure.Error)" "ERROR"
        }
        
        # バッチ間の待機
        if ($batch -lt $batchCount - 1 -and $Delay -gt 0) {
            Write-Log "$Delay 秒待機中..." "INFO"
            Start-Sleep -Seconds $Delay
        }
    }
    
    return $uploadResults
}

# 結果分析
function Analyze-Results {
    param([array]$Results)
    
    Write-Log "=== 負荷試験結果分析 ===" "INFO"
    
    $totalFiles = ($Results | Measure-Object -Property FilesProcessed -Sum).Sum
    $totalSuccess = ($Results | Measure-Object -Property SuccessCount -Sum).Sum
    $totalFailures = ($Results | Measure-Object -Property FailureCount -Sum).Sum
    $totalDuration = ($Results | Measure-Object -Property Duration -Sum).Sum
    $avgBatchTime = ($Results | Measure-Object -Property Duration -Average).Average
    
    Write-Log "総ファイル数: $totalFiles" "INFO"
    Write-Log "成功: $totalSuccess" "INFO"
    Write-Log "失敗: $totalFailures" "INFO"
    Write-Log "成功率: $([Math]::Round(($totalSuccess / $totalFiles) * 100, 2))%" "INFO"
    Write-Log "総実行時間: $([Math]::Round($totalDuration, 2))秒" "INFO"
    Write-Log "平均バッチ時間: $([Math]::Round($avgBatchTime, 2))秒" "INFO"
    Write-Log "スループット: $([Math]::Round($totalFiles / $totalDuration, 2)) ファイル/秒" "INFO"
    
    # 結果をCSVで保存
    $csvPath = "load-test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
    $Results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Log "詳細結果を保存: $csvPath" "INFO"
}

# メイン実行
try {
    Write-Log "パラメータ:" "INFO"
    Write-Log "  FSxマウントパス: $FSxMountPath" "INFO"
    Write-Log "  ファイル数: $FileCount" "INFO"
    Write-Log "  バッチサイズ: $BatchSize" "INFO"
    Write-Log "  バッチ間隔: $DelayBetweenBatches 秒" "INFO"
    
    # FSxマウント確認
    if (-not (Test-FSxMount)) {
        exit 1
    }
    
    # テストデータ生成
    $localTestDir = ".\$TestDataDir"
    Generate-TestData -OutputDir $localTestDir -Count $FileCount
    
    # FSx上のターゲットディレクトリ
    $fsxTargetDir = Join-Path $FSxMountPath "embedding-load-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    # バッチアップロード実行
    $results = Start-BatchUpload -SourceDir $localTestDir -TargetDir $fsxTargetDir -BatchSize $BatchSize -Delay $DelayBetweenBatches
    
    # 結果分析
    Analyze-Results -Results $results
    
    Write-Log "=== 負荷試験完了 ===" "INFO"
    
} catch {
    Write-Log "エラーが発生しました: $($_.Exception.Message)" "ERROR"
    Write-Log "スタックトレース: $($_.ScriptStackTrace)" "ERROR"
    exit 1
}