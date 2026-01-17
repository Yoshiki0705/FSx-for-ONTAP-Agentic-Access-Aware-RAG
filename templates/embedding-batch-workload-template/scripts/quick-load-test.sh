#!/bin/bash

# Quick Load Test Script for FSx for ONTAP Embedding
# SQLite UNIQUE制約エラーの負荷試験を簡単に実行

set -euo pipefail

# 色付きログ関数
log_info() {
    echo -e "\\033[32m[INFO]\\033[0m $1"
}

log_warn() {
    echo -e "\\033[33m[WARN]\\033[0m $1"
}

log_error() {
    echo -e "\\033[31m[ERROR]\\033[0m $1"
}

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [テストタイプ]

FSx for ONTAP Embedding負荷試験のクイック実行スクリプト

テストタイプ:
  problem-repro    問題再現テスト (20ファイル、バッチサイズ20)
  small           小規模テスト (50ファイル、バッチサイズ25)
  medium          中規模テスト (100ファイル、バッチサイズ50)
  large           大規模テスト (500ファイル、バッチサイズ100)
  stress          ストレステスト (1000ファイル、バッチサイズ200)

例:
  $0 problem-repro    # 問題再現テスト
  $0 medium          # 中規模テスト
  $0 large           # 大規模テスト

EOF
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # 必要なコマンドの確認
    local missing_commands=()
    
    if ! command -v bc &> /dev/null; then
        missing_commands+=("bc")
    fi
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_error "以下のコマンドが必要です: ${missing_commands[*]}"
        log_info "インストール方法:"
        for cmd in "${missing_commands[@]}"; do
            case $cmd in
                bc)
                    log_info "  bc: apt-get install bc (Ubuntu) または brew install bc (macOS)"
                    ;;
            esac
        done
        return 1
    fi
    
    # 負荷試験スクリプトの確認
    local script_path="$(dirname "$0")/load-test-fsx-embedding.sh"
    if [[ ! -f "$script_path" ]]; then
        log_error "負荷試験スクリプトが見つかりません: $script_path"
        return 1
    fi
    
    if [[ ! -x "$script_path" ]]; then
        log_warn "負荷試験スクリプトに実行権限がありません。権限を設定中..."
        chmod +x "$script_path"
    fi
    
    log_info "前提条件チェック完了"
    return 0
}

# FSxマウントポイントの自動検出
detect_fsx_mount() {
    log_info "FSxマウントポイントを検出中..."
    
    # 一般的なマウントポイントを確認
    local common_mounts=("/mnt/fsx" "/mnt/ontap" "/opt/netapp" "/data/fsx")
    
    for mount_point in "${common_mounts[@]}"; do
        if [[ -d "$mount_point" ]] && [[ -w "$mount_point" ]]; then
            log_info "FSxマウントポイント検出: $mount_point"
            echo "$mount_point"
            return 0
        fi
    done
    
    # mountコマンドでNFSマウントを検索
    if command -v mount &> /dev/null; then
        local nfs_mounts
        nfs_mounts=$(mount | grep -i nfs | awk '{print $3}' | head -1)
        if [[ -n "$nfs_mounts" ]] && [[ -d "$nfs_mounts" ]] && [[ -w "$nfs_mounts" ]]; then
            log_info "NFSマウントポイント検出: $nfs_mounts"
            echo "$nfs_mounts"
            return 0
        fi
    fi
    
    log_warn "FSxマウントポイントが自動検出できませんでした"
    log_info "手動でマウントポイントを指定してください:"
    log_info "  ./load-test-fsx-embedding.sh -m /your/mount/point"
    echo "/tmp"  # フォールバック
    return 1
}

# テスト実行
run_test() {
    local test_type="$1"
    local script_path="$(dirname "$0")/load-test-fsx-embedding.sh"
    local mount_point
    
    # FSxマウントポイント検出
    mount_point=$(detect_fsx_mount)
    
    log_info "=== $test_type 負荷試験開始 ==="
    
    case "$test_type" in
        "problem-repro")
            log_info "問題再現テスト: SQLite制約エラーが発生していた条件を再現"
            "$script_path" -c 20 -b 20 -w 0 -m "$mount_point" -v
            ;;
        "small")
            log_info "小規模テスト: 基本的な動作確認"
            "$script_path" -c 50 -b 25 -w 2 -m "$mount_point" -v
            ;;
        "medium")
            log_info "中規模テスト: 実用的な負荷での動作確認"
            "$script_path" -c 100 -b 50 -w 1 -m "$mount_point" -v
            ;;
        "large")
            log_info "大規模テスト: 高負荷での安定性確認"
            "$script_path" -c 500 -b 100 -w 1 -m "$mount_point" -v
            ;;
        "stress")
            log_info "ストレステスト: 最大負荷での限界確認"
            "$script_path" -c 1000 -b 200 -w 0 -m "$mount_point" -v
            ;;
        *)
            log_error "不明なテストタイプ: $test_type"
            show_usage
            return 1
            ;;
    esac
}

# 結果サマリー表示
show_summary() {
    local test_type="$1"
    
    log_info "=== $test_type 負荷試験完了 ==="
    
    # 最新の結果ファイルを検索
    local latest_csv
    latest_csv=$(find . -name "batch-results-*.csv" -type f | sort | tail -1)
    
    if [[ -n "$latest_csv" ]] && [[ -f "$latest_csv" ]]; then
        log_info "詳細結果: $latest_csv"
        
        # 簡単な統計を表示
        if command -v awk &> /dev/null; then
            local total_batches
            total_batches=$(awk -F',' 'NR>1 {count++} END {print count+0}' "$latest_csv")
            
            local avg_success
            avg_success=$(awk -F',' 'NR>1 {sum+=$3; count++} END {if(count>0) print sum/count; else print 0}' "$latest_csv")
            
            local avg_duration
            avg_duration=$(awk -F',' 'NR>1 {sum+=$5; count++} END {if(count>0) print sum/count; else print 0}' "$latest_csv")
            
            log_info "統計情報:"
            log_info "  総バッチ数: $total_batches"
            log_info "  平均成功数: $(printf "%.1f" "$avg_success")"
            log_info "  平均実行時間: $(printf "%.2f" "$avg_duration")秒"
        fi
    fi
    
    # 最新のログファイルを検索
    local latest_log
    latest_log=$(find . -name "load-test-*.log" -type f | sort | tail -1)
    
    if [[ -n "$latest_log" ]] && [[ -f "$latest_log" ]]; then
        log_info "詳細ログ: $latest_log"
        
        # エラーの確認
        local error_count
        error_count=$(grep -c "ERROR" "$latest_log" 2>/dev/null || echo "0")
        
        if (( error_count > 0 )); then
            log_warn "エラーが $error_count 件発生しました"
            log_info "エラー詳細:"
            grep "ERROR" "$latest_log" | tail -5
        else
            log_info "エラーは発生しませんでした"
        fi
    fi
}

# メイン実行
main() {
    local test_type="${1:-}"
    
    if [[ -z "$test_type" ]]; then
        show_usage
        exit 1
    fi
    
    # 前提条件チェック
    if ! check_prerequisites; then
        exit 1
    fi
    
    # テスト実行
    if run_test "$test_type"; then
        show_summary "$test_type"
        log_info "負荷試験が正常に完了しました"
    else
        log_error "負荷試験中にエラーが発生しました"
        exit 1
    fi
}

# エラーハンドリング
trap 'log_error "スクリプトが予期せず終了しました"; exit 1' ERR

# メイン実行
main "$@"