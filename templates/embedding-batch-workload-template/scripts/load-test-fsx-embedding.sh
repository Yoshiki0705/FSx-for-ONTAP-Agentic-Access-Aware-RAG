#!/bin/bash

# FSx for ONTAP Embedding Load Test Script
# FSx for ONTAPに大量データを投入してEmbedding処理の負荷試験を実行

set -euo pipefail

# デフォルト値（セキュリティ強化）
readonly DEFAULT_FSX_MOUNT_PATH="/mnt/fsx"
readonly DEFAULT_FILE_COUNT=100
readonly DEFAULT_TEST_DATA_DIR="load-test-data"
readonly DEFAULT_BATCH_SIZE=20
readonly DEFAULT_DELAY_BETWEEN_BATCHES=5

# 設定可能な変数
FSX_MOUNT_PATH="$DEFAULT_FSX_MOUNT_PATH"
FILE_COUNT="$DEFAULT_FILE_COUNT"
TEST_DATA_DIR="$DEFAULT_TEST_DATA_DIR"
BATCH_SIZE="$DEFAULT_BATCH_SIZE"
DELAY_BETWEEN_BATCHES="$DEFAULT_DELAY_BETWEEN_BATCHES"
VERBOSE=false

# セキュリティ設定
umask 077  # 作成されるファイルのパーミッションを制限

# ログファイル設定
readonly LOG_FILE="load-test-$(date +%Y%m%d-%H%M%S).log"

# ログ関数（改善版）
log_info() {
    local message="[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1"
    echo -e "\\033[32m$message\\033[0m" | tee -a "$LOG_FILE"
}

log_warn() {
    local message="[WARN] $(date '+%Y-%m-%d %H:%M:%S') $1"
    echo -e "\\033[33m$message\\033[0m" | tee -a "$LOG_FILE"
}

log_error() {
    local message="[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1"
    echo -e "\\033[31m$message\\033[0m" >&2 | tee -a "$LOG_FILE"
}

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

FSx for ONTAP Embedding負荷試験スクリプト

オプション:
  -h, --help                  このヘルプを表示
  -m, --mount-path PATH       FSxマウントパス (デフォルト: $DEFAULT_FSX_MOUNT_PATH)
  -c, --file-count COUNT      生成するファイル数 (デフォルト: $DEFAULT_FILE_COUNT)
  -d, --test-dir DIR          テストデータディレクトリ (デフォルト: $DEFAULT_TEST_DATA_DIR)
  -b, --batch-size SIZE       バッチサイズ (デフォルト: $DEFAULT_BATCH_SIZE)
  -w, --wait SECONDS          バッチ間の待機時間 (デフォルト: $DEFAULT_DELAY_BETWEEN_BATCHES)
  -v, --verbose               詳細ログを有効化

例:
  $0                                    # デフォルト設定で実行
  $0 -c 200 -b 50                      # 200ファイル、バッチサイズ50で実行
  $0 -m /mnt/fsx -c 500 -b 100 -v      # カスタム設定で詳細ログ付き実行

EOF
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -m|--mount-path)
            FSX_MOUNT_PATH="$2"
            shift 2
            ;;
        -c|--file-count)
            FILE_COUNT="$2"
            shift 2
            ;;
        -d|--test-dir)
            TEST_DATA_DIR="$2"
            shift 2
            ;;
        -b|--batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        -w|--wait)
            DELAY_BETWEEN_BATCHES="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# FSxマウント確認
test_fsx_mount() {
    if [[ ! -d "$FSX_MOUNT_PATH" ]]; then
        log_error "FSxマウントパスが見つかりません: $FSX_MOUNT_PATH"
        return 1
    fi
    
    if ! touch "$FSX_MOUNT_PATH/.test_write" 2>/dev/null; then
        log_error "FSxマウントパスに書き込み権限がありません: $FSX_MOUNT_PATH"
        return 1
    fi
    
    rm -f "$FSX_MOUNT_PATH/.test_write"
    log_info "FSxマウント確認完了: $FSX_MOUNT_PATH"
    return 0
}

# テストデータ生成
generate_test_data() {
    local output_dir="$1"
    local count="$2"
    
    log_info "テストデータを生成中: $count ファイル"
    
    mkdir -p "$output_dir"
    
    local sample_texts=(
        "Machine learning is revolutionizing how we process and understand data."
        "Deep learning neural networks can identify complex patterns in large datasets."
        "Natural language processing enables computers to understand human communication."
        "Computer vision algorithms can analyze and interpret visual information."
        "Reinforcement learning allows AI systems to learn through trial and error."
        "Artificial intelligence is transforming industries across the globe."
        "Data science combines statistics, programming, and domain expertise."
        "Cloud computing provides scalable infrastructure for AI workloads."
        "Edge computing brings AI processing closer to data sources."
        "Quantum computing may revolutionize certain AI algorithms in the future."
    )
    
    for ((i=1; i<=count; i++)); do
        local filename=$(printf "test-document-%04d.txt" $i)
        local filepath="$output_dir/$filename"
        local random_text=${sample_texts[$RANDOM % ${#sample_texts[@]}]}
        
        cat > "$filepath" << EOF
Document ID: $i
Generated: $(date)
Content: $random_text

This is a test document for FSx for ONTAP embedding load testing.
The document contains sample text to test the embedding processing pipeline.
File size and content are designed to simulate real-world document processing scenarios.

Additional content to increase file size:
$(for j in {1..10}; do echo "Line $j of additional content for document $i"; done)

Technical specifications:
- File format: Plain text
- Encoding: UTF-8
- Purpose: Load testing
- Batch processing: Enabled
- Unique identifier: $(uuidgen 2>/dev/null || echo "$(date +%s)-$i")

Sample data for embedding:
$(for k in {1..5}; do echo "Sample line $k with technical content about AI and machine learning"; done)
EOF
        
        if $VERBOSE && (( i % 10 == 0 )); then
            log_info "生成済み: $i/$count ファイル"
        fi
    done
    
    log_info "テストデータ生成完了: $count ファイル"
}

# FSxへのデータ転送
transfer_to_fsx() {
    local source_dir="$1"
    local target_dir="$2"
    local batch_size="$3"
    
    log_info "FSxへのデータ転送開始: $source_dir -> $target_dir"
    
    mkdir -p "$target_dir"
    
    local files=($(find "$source_dir" -name "*.txt" | sort))
    local total_files=${#files[@]}
    local transferred=0
    
    for ((i=0; i<total_files; i+=batch_size)); do
        local batch_end=$((i + batch_size - 1))
        if ((batch_end >= total_files)); then
            batch_end=$((total_files - 1))
        fi
        
        log_info "バッチ転送中: $((i+1))-$((batch_end+1))/$total_files"
        
        for ((j=i; j<=batch_end; j++)); do
            local source_file="${files[j]}"
            local filename=$(basename "$source_file")
            local target_file="$target_dir/$filename"
            
            if cp "$source_file" "$target_file"; then
                ((transferred++))
                if $VERBOSE; then
                    log_info "転送完了: $filename"
                fi
            else
                log_error "転送失敗: $filename"
            fi
        done
        
        if ((batch_end + 1 < total_files)); then
            log_info "バッチ間待機: ${DELAY_BETWEEN_BATCHES}秒"
            sleep "$DELAY_BETWEEN_BATCHES"
        fi
    done
    
    log_info "FSxデータ転送完了: $transferred/$total_files ファイル"
}

# パフォーマンス測定
measure_performance() {
    local test_dir="$1"
    
    log_info "パフォーマンス測定開始"
    
    # 書き込み性能測定
    local write_start=$(date +%s.%N)
    dd if=/dev/zero of="$test_dir/write_test.dat" bs=1M count=100 2>/dev/null
    local write_end=$(date +%s.%N)
    local write_time=$(echo "$write_end - $write_start" | bc -l)
    
    # 読み込み性能測定
    local read_start=$(date +%s.%N)
    dd if="$test_dir/write_test.dat" of=/dev/null bs=1M 2>/dev/null
    local read_end=$(date +%s.%N)
    local read_time=$(echo "$read_end - $read_start" | bc -l)
    
    # ファイル一覧性能測定
    local list_start=$(date +%s.%N)
    find "$test_dir" -name "*.txt" > /dev/null
    local list_end=$(date +%s.%N)
    local list_time=$(echo "$list_end - $list_start" | bc -l)
    
    # 結果出力
    log_info "=== パフォーマンス測定結果 ==="
    log_info "書き込み性能: ${write_time}秒 (100MB)"
    log_info "読み込み性能: ${read_time}秒 (100MB)"
    log_info "ファイル一覧: ${list_time}秒"
    
    # クリーンアップ
    rm -f "$test_dir/write_test.dat"
}

# クリーンアップ関数
cleanup() {
    local exit_code=$?
    
    log_info "クリーンアップ実行中..."
    
    # 一時ファイル削除
    if [[ -d "$TEST_DATA_DIR" ]]; then
        log_info "一時テストデータ削除: $TEST_DATA_DIR"
        rm -rf "$TEST_DATA_DIR"
    fi
    
    # FSx上のテストファイル削除（オプション）
    if [[ -d "$FSX_MOUNT_PATH/$TEST_DATA_DIR" ]]; then
        read -p "FSx上のテストデータを削除しますか？ (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "FSxテストデータ削除: $FSX_MOUNT_PATH/$TEST_DATA_DIR"
            rm -rf "$FSX_MOUNT_PATH/$TEST_DATA_DIR"
        fi
    fi
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
    else
        log_info "負荷試験完了"
    fi
    
    exit $exit_code
}

# 入力値検証
validate_inputs() {
    # パストラバーサル攻撃防止
    if [[ "$FSX_MOUNT_PATH" =~ \.\. ]] || [[ "$TEST_DATA_DIR" =~ \.\. ]]; then
        log_error "不正なパス指定が検出されました"
        exit 1
    fi
    
    # 数値検証
    if ! [[ "$FILE_COUNT" =~ ^[0-9]+$ ]] || (( FILE_COUNT <= 0 )); then
        log_error "無効なファイル数: $FILE_COUNT"
        exit 1
    fi
    
    if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || (( BATCH_SIZE <= 0 )); then
        log_error "無効なバッチサイズ: $BATCH_SIZE"
        exit 1
    fi
    
    if ! [[ "$DELAY_BETWEEN_BATCHES" =~ ^[0-9]+$ ]] || (( DELAY_BETWEEN_BATCHES < 0 )); then
        log_error "無効な待機時間: $DELAY_BETWEEN_BATCHES"
        exit 1
    fi
    
    log_info "入力値検証完了"
}

# メイン実行関数
main() {
    log_info "FSx for ONTAP Embedding負荷試験開始"
    
    # 入力値検証
    validate_inputs
    
    # FSxマウント確認
    if ! test_fsx_mount; then
        exit 1
    fi
    
    # テストデータ生成
    generate_test_data "$TEST_DATA_DIR" "$FILE_COUNT"
    
    # FSxへの転送
    transfer_to_fsx "$TEST_DATA_DIR" "$FSX_MOUNT_PATH/$TEST_DATA_DIR" "$BATCH_SIZE"
    
    # パフォーマンス測定
    measure_performance "$FSX_MOUNT_PATH/$TEST_DATA_DIR"
    
    log_info "負荷試験完了"
}

# エラートラップ設定
trap cleanup EXIT ERR

# 必要なコマンド確認
for cmd in bc uuidgen; do
    if ! command -v "$cmd" &> /dev/null; then
        log_warn "推奨コマンドが見つかりません: $cmd"
    fi
done

# メイン実行
main "$@"# バッ
チアップロード実行
start_batch_upload() {
    local source_dir="$1"
    local target_dir="$2"
    local batch_size="$3"
    local delay="$4"
    
    log_info "バッチアップロード開始"
    log_info "ソース: $source_dir"
    log_info "ターゲット: $target_dir"
    log_info "バッチサイズ: $batch_size"
    
    mkdir -p "$target_dir"
    
    local files=($(find "$source_dir" -type f -name "*.txt" | sort))
    local total_files=${#files[@]}
    local batch_count=$(( (total_files + batch_size - 1) / batch_size ))
    
    log_info "総ファイル数: $total_files"
    log_info "バッチ数: $batch_count"
    
    local results_file="batch-results-$(date +%Y%m%d-%H%M%S).csv"
    echo "BatchNumber,FilesProcessed,SuccessCount,FailureCount,Duration,Timestamp" > "$results_file"
    
    local total_success=0
    local total_failures=0
    local total_duration=0
    
    for ((batch=0; batch<batch_count; batch++)); do
        local start_index=$((batch * batch_size))
        local end_index=$(( start_index + batch_size - 1 ))
        if (( end_index >= total_files )); then
            end_index=$((total_files - 1))
        fi
        
        local batch_files=("${files[@]:$start_index:$((end_index - start_index + 1))}")
        local batch_file_count=${#batch_files[@]}
        
        log_info "バッチ $((batch + 1))/$batch_count 実行中 (ファイル $((start_index + 1))-$((end_index + 1)))"
        
        local batch_start_time=$(date +%s.%N)
        local success_count=0
        local failure_count=0
        
        # 並列コピー実行
        local pids=()
        local temp_dir=$(mktemp -d)
        
        for file in "${batch_files[@]}"; do
            local filename=$(basename "$file")
            local target_path="$target_dir/$filename"
            
            (
                if cp "$file" "$target_path" 2>/dev/null; then
                    echo "SUCCESS:$file" > "$temp_dir/$(basename "$file").result"
                else
                    echo "FAILURE:$file:$?" > "$temp_dir/$(basename "$file").result"
                fi
            ) &
            pids+=($!)
        done
        
        # 全ジョブの完了を待機
        for pid in "${pids[@]}"; do
            wait "$pid"
        done
        
        # 結果を集計
        for result_file in "$temp_dir"/*.result; do
            if [[ -f "$result_file" ]]; then
                local result=$(cat "$result_file")
                if [[ "$result" == SUCCESS:* ]]; then
                    ((success_count++))
                else
                    ((failure_count++))
                    if $VERBOSE; then
                        log_warn "アップロード失敗: ${result#FAILURE:}"
                    fi
                fi
            fi
        done
        
        rm -rf "$temp_dir"
        
        local batch_end_time=$(date +%s.%N)
        local batch_duration=$(echo "$batch_end_time - $batch_start_time" | bc -l)
        
        total_success=$((total_success + success_count))
        total_failures=$((total_failures + failure_count))
        total_duration=$(echo "$total_duration + $batch_duration" | bc -l)
        
        # 結果をCSVに記録
        echo "$((batch + 1)),$batch_file_count,$success_count,$failure_count,$batch_duration,$(date)" >> "$results_file"
        
        log_info "バッチ $((batch + 1)) 完了: 成功 $success_count, 失敗 $failure_count, 時間 $(printf "%.2f" "$batch_duration")秒"
        
        # バッチ間の待機
        if (( batch < batch_count - 1 )) && (( delay > 0 )); then
            log_info "$delay 秒待機中..."
            sleep "$delay"
        fi
    done
    
    # 最終結果を返す
    echo "$total_files,$total_success,$total_failures,$total_duration,$results_file"
}

# 結果分析
analyze_results() {
    local total_files="$1"
    local total_success="$2"
    local total_failures="$3"
    local total_duration="$4"
    local results_file="$5"
    
    log_info "=== 負荷試験結果分析 ==="
    
    local success_rate=$(echo "scale=2; ($total_success / $total_files) * 100" | bc -l)
    local throughput=$(echo "scale=2; $total_files / $total_duration" | bc -l)
    
    log_info "総ファイル数: $total_files"
    log_info "成功: $total_success"
    log_info "失敗: $total_failures"
    log_info "成功率: ${success_rate}%"
    log_info "総実行時間: $(printf "%.2f" "$total_duration")秒"
    log_info "スループット: ${throughput} ファイル/秒"
    log_info "詳細結果: $results_file"
    
    # 統計情報の生成
    if command -v awk &> /dev/null && [[ -f "$results_file" ]]; then
        local avg_batch_time=$(awk -F',' 'NR>1 {sum+=$5; count++} END {if(count>0) print sum/count; else print 0}' "$results_file")
        local max_batch_time=$(awk -F',' 'NR>1 {if($5>max) max=$5} END {print max+0}' "$results_file")
        local min_batch_time=$(awk -F',' 'NR>1 {if(NR==2 || $5<min) min=$5} END {print min+0}' "$results_file")
        
        log_info "平均バッチ時間: $(printf "%.2f" "$avg_batch_time")秒"
        log_info "最大バッチ時間: $(printf "%.2f" "$max_batch_time")秒"
        log_info "最小バッチ時間: $(printf "%.2f" "$min_batch_time")秒"
    fi
}

# メイン実行
main() {
    log_info "=== FSx for ONTAP Embedding 負荷試験開始 ==="
    
    log_info "パラメータ:"
    log_info "  FSxマウントパス: $FSX_MOUNT_PATH"
    log_info "  ファイル数: $FILE_COUNT"
    log_info "  バッチサイズ: $BATCH_SIZE"
    log_info "  バッチ間隔: $DELAY_BETWEEN_BATCHES 秒"
    
    # 前提条件チェック
    if ! command -v bc &> /dev/null; then
        log_error "bc コマンドが必要です。インストールしてください。"
        exit 1
    fi
    
    # FSxマウント確認
    if ! test_fsx_mount; then
        exit 1
    fi
    
    # テストデータ生成
    local local_test_dir="./$TEST_DATA_DIR"
    generate_test_data "$local_test_dir" "$FILE_COUNT"
    
    # FSx上のターゲットディレクトリ
    local fsx_target_dir="$FSX_MOUNT_PATH/embedding-load-test-$(date +%Y%m%d-%H%M%S)"
    
    # バッチアップロード実行
    local results
    results=$(start_batch_upload "$local_test_dir" "$fsx_target_dir" "$BATCH_SIZE" "$DELAY_BETWEEN_BATCHES")
    
    # 結果を解析
    IFS=',' read -r total_files total_success total_failures total_duration results_file <<< "$results"
    analyze_results "$total_files" "$total_success" "$total_failures" "$total_duration" "$results_file"
    
    log_info "=== 負荷試験完了 ==="
    
    # 推奨事項
    if (( total_failures > 0 )); then
        log_warn "失敗したファイルがあります。ログを確認してください。"
        log_warn "SQLite UNIQUE制約エラーが発生した場合は、バッチサイズを小さくするか、バッチ間隔を長くしてください。"
    fi
    
    local success_rate=$(echo "scale=0; ($total_success / $total_files) * 100" | bc -l)
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        log_warn "成功率が95%未満です。システムの負荷を確認してください。"
    fi
}

# エラーハンドリング
trap 'log_error "スクリプトが予期せず終了しました"; exit 1' ERR

# メイン実行
main "$@"