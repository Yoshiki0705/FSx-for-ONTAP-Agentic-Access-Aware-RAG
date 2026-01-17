#!/bin/bash

# AWS Batch 構成での負荷試験スクリプト
# 大規模文書処理とFSxマウント性能の包括的な負荷試験を実行

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# デフォルト値（設定ファイルから読み込み可能）
readonly DEFAULT_FILE_COUNT=1000
readonly DEFAULT_BATCH_SIZE=50
readonly DEFAULT_CONCURRENT_JOBS=10
readonly DEFAULT_TEST_DURATION=3600  # 1時間
readonly DEFAULT_FSX_MOUNT_PATH="/mnt/fsx"
readonly DEFAULT_FSX_FILESYSTEM_ID=""  # 自動検出
readonly DEFAULT_FSX_VOLUME_NAME=""     # 自動検出（最初のボリューム）
readonly DEFAULT_FSX_SVM_NAME=""        # 自動検出（最初のSVM）

# FSx設定の検証関数
validate_fsx_config() {
    local filesystem_id="$1"
    local volume_name="$2"
    local svm_name="$3"
    
    # ファイルシステムIDの形式検証
    if [[ -n "$filesystem_id" ]] && [[ ! "$filesystem_id" =~ ^fs-[0-9a-f]{17}$ ]]; then
        log_error "無効なFSxファイルシステムID形式: $filesystem_id"
        return 1
    fi
    
    # ボリューム名の検証（英数字とハイフンのみ許可）
    if [[ -n "$volume_name" ]] && [[ ! "$volume_name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "無効なFSxボリューム名形式: $volume_name"
        return 1
    fi
    
    # SVM名の検証（英数字とハイフンのみ許可）
    if [[ -n "$svm_name" ]] && [[ ! "$svm_name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "無効なFSx SVM名形式: $svm_name"
        return 1
    fi
    
    return 0
}

# FSx自動検出関数（最適化版）
auto_detect_fsx_resources() {
    log_info "FSxリソースの自動検出を実行中..."
    
    local detection_errors=()
    
    # ファイルシステムIDの自動検出（リトライ機能付き）
    if [[ -z "$FSX_FILESYSTEM_ID" ]]; then
        local detected_fs_id
        local retry_count=0
        local max_retries=3
        
        while [[ $retry_count -lt $max_retries ]]; do
            if detected_fs_id=$(aws fsx describe-file-systems \
                --query 'FileSystems[?FileSystemType==`ONTAP`].[FileSystemId,Lifecycle]' \
                --output text 2>/dev/null | head -1); then
                
                local fs_id=$(echo "$detected_fs_id" | awk '{print $1}')
                local fs_status=$(echo "$detected_fs_id" | awk '{print $2}')
                
                if [[ -n "$fs_id" ]] && [[ "$fs_id" != "None" ]] && [[ "$fs_status" == "AVAILABLE" ]]; then
                    FSX_FILESYSTEM_ID="$fs_id"
                    log_info "FSxファイルシステムIDを自動検出: ${FSX_FILESYSTEM_ID:0:8}*** (状態: $fs_status)"
                    break
                else
                    log_warn "FSxファイルシステムが利用可能状態ではありません: $fs_status"
                fi
            fi
            
            ((retry_count++))
            if [[ $retry_count -lt $max_retries ]]; then
                log_warn "FSx検出リトライ中 ($retry_count/$max_retries)..."
                sleep $((retry_count * 2))
            fi
        done
        
        if [[ -z "$FSX_FILESYSTEM_ID" ]]; then
            detection_errors+=("FSxファイルシステムIDの自動検出に失敗")
        fi
    fi
    
    # ボリューム名とSVM名の並列検出（パフォーマンス最適化）
    if [[ -n "$FSX_FILESYSTEM_ID" ]]; then
        local volume_detection_pid
        local svm_detection_pid
        
        # ボリューム名の検出（バックグラウンド）
        if [[ -z "$FSX_VOLUME_NAME" ]]; then
            (
                local detected_volume
                detected_volume=$(aws fsx describe-volumes \
                    --filters Name=file-system-id,Values="$FSX_FILESYSTEM_ID" \
                    --query 'Volumes[?VolumeType==`ONTAP`].[Name,Lifecycle]' \
                    --output text 2>/dev/null | head -1)
                
                local volume_name=$(echo "$detected_volume" | awk '{print $1}')
                local volume_status=$(echo "$detected_volume" | awk '{print $2}')
                
                if [[ -n "$volume_name" ]] && [[ "$volume_name" != "None" ]] && [[ "$volume_status" == "AVAILABLE" ]]; then
                    echo "$volume_name" > "/tmp/fsx_volume_$$"
                fi
            ) &
            volume_detection_pid=$!
        fi
        
        # SVM名の検出（バックグラウンド）
        if [[ -z "$FSX_SVM_NAME" ]]; then
            (
                local detected_svm
                detected_svm=$(aws fsx describe-storage-virtual-machines \
                    --filters Name=file-system-id,Values="$FSX_FILESYSTEM_ID" \
                    --query 'StorageVirtualMachines[?Lifecycle==`CREATED`].[Name,Lifecycle]' \
                    --output text 2>/dev/null | head -1)
                
                local svm_name=$(echo "$detected_svm" | awk '{print $1}')
                local svm_status=$(echo "$detected_svm" | awk '{print $2}')
                
                if [[ -n "$svm_name" ]] && [[ "$svm_name" != "None" ]] && [[ "$svm_status" == "CREATED" ]]; then
                    echo "$svm_name" > "/tmp/fsx_svm_$$"
                fi
            ) &
            svm_detection_pid=$!
        fi
        
        # 並列処理の完了を待機
        if [[ -n "$volume_detection_pid" ]]; then
            wait $volume_detection_pid
            if [[ -f "/tmp/fsx_volume_$$" ]]; then
                FSX_VOLUME_NAME=$(cat "/tmp/fsx_volume_$$")
                rm -f "/tmp/fsx_volume_$$"
                log_info "FSxボリューム名を自動検出: $FSX_VOLUME_NAME"
            else
                detection_errors+=("FSxボリューム名の自動検出に失敗")
            fi
        fi
        
        if [[ -n "$svm_detection_pid" ]]; then
            wait $svm_detection_pid
            if [[ -f "/tmp/fsx_svm_$$" ]]; then
                FSX_SVM_NAME=$(cat "/tmp/fsx_svm_$$")
                rm -f "/tmp/fsx_svm_$$"
                log_info "FSx SVM名を自動検出: $FSX_SVM_NAME"
            else
                detection_errors+=("FSx SVM名の自動検出に失敗")
            fi
        fi
    fi
    
    # 検出エラーの報告
    if [[ ${#detection_errors[@]} -gt 0 ]]; then
        log_warn "FSx自動検出で以下のエラーが発生しました:"
        for error in "${detection_errors[@]}"; do
            log_warn "  - $error"
        done
        log_warn "手動でFSx設定を指定することを推奨します"
        return 1
    fi
    
    log_info "FSx自動検出完了"
    return 0
}

# 設定ファイルの読み込み
load_config_file() {
    local config_file="${1:-$PROJECT_ROOT/config/batch-load-test.conf}"
    
    if [[ -f "$config_file" ]]; then
        log_info "設定ファイルを読み込み中: $config_file"
        # shellcheck source=/dev/null
        source "$config_file"
        log_info "設定ファイル読み込み完了"
    else
        log_info "設定ファイルが見つかりません。デフォルト値を使用します: $config_file"
    fi
    
    # FSx設定の初期化
    FSX_FILESYSTEM_ID="${FSX_FILESYSTEM_ID:-$DEFAULT_FSX_FILESYSTEM_ID}"
    FSX_VOLUME_NAME="${FSX_VOLUME_NAME:-$DEFAULT_FSX_VOLUME_NAME}"
    FSX_SVM_NAME="${FSX_SVM_NAME:-$DEFAULT_FSX_SVM_NAME}"
    
    # FSx設定の検証
    if ! validate_fsx_config "$FSX_FILESYSTEM_ID" "$FSX_VOLUME_NAME" "$FSX_SVM_NAME"; then
        log_error "FSx設定の検証に失敗しました"
        exit 1
    fi
    
    # 自動検出の実行
    if [[ -z "$FSX_FILESYSTEM_ID" ]] || [[ -z "$FSX_VOLUME_NAME" ]] || [[ -z "$FSX_SVM_NAME" ]]; then
        auto_detect_fsx_resources
    fi
}

# 設定可能な変数
FILE_COUNT="$DEFAULT_FILE_COUNT"
BATCH_SIZE="$DEFAULT_BATCH_SIZE"
CONCURRENT_JOBS="$DEFAULT_CONCURRENT_JOBS"
TEST_DURATION="$DEFAULT_TEST_DURATION"
FSX_MOUNT_PATH="$DEFAULT_FSX_MOUNT_PATH"
FSX_FILESYSTEM_ID="$DEFAULT_FSX_FILESYSTEM_ID"
FSX_VOLUME_NAME="$DEFAULT_FSX_VOLUME_NAME"
FSX_SVM_NAME="$DEFAULT_FSX_SVM_NAME"
VERBOSE=false
DRY_RUN=false
STACK_NAME=""
AUTO_CLEANUP=false

# ログ設定
LOG_DIR="$PROJECT_ROOT/logs/batch-load-test"
LOG_FILE="$LOG_DIR/aws-batch-load-test-$(date +%Y%m%d-%H%M%S).log"
METRICS_FILE="$LOG_DIR/batch-metrics-$(date +%Y%m%d-%H%M%S).json"

# 色付きログ関数
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

AWS Batch構成での負荷試験スクリプト

オプション:
  -h, --help                  このヘルプを表示
  -s, --stack-name NAME       CloudFormationスタック名を指定
  -c, --file-count COUNT      生成するファイル数 (デフォルト: $DEFAULT_FILE_COUNT)
  -b, --batch-size SIZE       バッチサイズ (デフォルト: $DEFAULT_BATCH_SIZE)
  -j, --concurrent-jobs NUM   同時実行ジョブ数 (デフォルト: $DEFAULT_CONCURRENT_JOBS)
  -d, --duration SECONDS      テスト実行時間（秒） (デフォルト: $DEFAULT_TEST_DURATION)
  -m, --mount-path PATH       FSxマウントパス (デフォルト: $DEFAULT_FSX_MOUNT_PATH)
  -v, --verbose               詳細ログを有効化
  --dry-run                   実際のジョブを投入せずに設定確認のみ実行
  --auto-cleanup              S3テストデータの自動削除を有効化

例:
  $0 --stack-name my-embedding-stack
  $0 -c 2000 -j 20 --verbose
  $0 --dry-run --stack-name test-stack

EOF
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -c|--file-count)
            FILE_COUNT="$2"
            shift 2
            ;;
        -b|--batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        -j|--concurrent-jobs)
            CONCURRENT_JOBS="$2"
            shift 2
            ;;
        -d|--duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        -m|--mount-path)
            FSX_MOUNT_PATH="$2"
            shift 2
            ;;
        --fsx-filesystem-id)
            FSX_FILESYSTEM_ID="$2"
            shift 2
            ;;
        --fsx-volume-name)
            FSX_VOLUME_NAME="$2"
            shift 2
            ;;
        --fsx-svm-name)
            FSX_SVM_NAME="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --auto-cleanup)
            AUTO_CLEANUP=true
            shift
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# ログディレクトリの作成
mkdir -p "$LOG_DIR"

# 設定情報の表示
show_configuration() {
    log_info "=== AWS Batch 負荷試験設定 ==="
    log_info "基本設定:"
    log_info "  ファイル数: $FILE_COUNT"
    log_info "  バッチサイズ: $BATCH_SIZE"
    log_info "  同時実行ジョブ数: $CONCURRENT_JOBS"
    log_info "  テスト実行時間: $TEST_DURATION 秒"
    log_info "  FSxマウントパス: $FSX_MOUNT_PATH"
    log_info "  FSxファイルシステムID: ${FSX_FILESYSTEM_ID:-自動検出}"
    log_info "  FSxボリューム名: ${FSX_VOLUME_NAME:-自動検出}"
    log_info "  FSx SVM名: ${FSX_SVM_NAME:-自動検出}"
    log_info "  ドライラン: $DRY_RUN"
    log_info ""
    log_info "FSx設定:"
    log_info "  マウントパス: $FSX_MOUNT_PATH"
    log_info "  ファイルシステムID: ${FSX_FILESYSTEM_ID:+${FSX_FILESYSTEM_ID:0:8}***}"
    log_info "  ボリューム名: ${FSX_VOLUME_NAME:-未設定}"
    log_info "  SVM名: ${FSX_SVM_NAME:-未設定}"
    log_info ""
    log_info "出力設定:"
    log_info "  ログディレクトリ: $LOG_DIR"
    log_info "  ログファイル: $(basename "$LOG_FILE")"
    log_info "  メトリクスファイル: $(basename "$METRICS_FILE")"
    log_info "================================"
}

log_info "=== AWS Batch 負荷試験開始 ==="
show_configuration

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    local missing_tools=()
    
    # 必要なツールのチェック
    local required_tools=("aws" "jq" "bc" "uuidgen")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    # 不足ツールの報告
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "以下のツールがインストールされていません: ${missing_tools[*]}"
        log_error "インストール方法:"
        for tool in "${missing_tools[@]}"; do
            case "$tool" in
                "aws") log_error "  AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html" ;;
                "jq") log_error "  jq: sudo apt-get install jq (Ubuntu) または brew install jq (macOS)" ;;
                "bc") log_error "  bc: sudo apt-get install bc (Ubuntu) または brew install bc (macOS)" ;;
                "uuidgen") log_error "  uuidgen: 通常はシステムに含まれています" ;;
            esac
        done
        exit 1
    fi
    
    # AWS認証情報チェック
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証情報が設定されていません"
        log_error "以下のいずれかの方法で認証情報を設定してください:"
        log_error "  1. aws configure"
        log_error "  2. 環境変数 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
        log_error "  3. IAM ロール (EC2インスタンス上で実行する場合)"
        exit 1
    fi
    
    # AWS CLI バージョンチェック
    local aws_version
    aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    log_info "AWS CLI バージョン: $aws_version"
    
    log_info "前提条件チェック完了"
}

# FSx for ONTAPリソースの自動検出
detect_fsx_resources() {
    log_info "FSx for ONTAPリソースを検出中..."
    
    # ファイルシステムIDが指定されていない場合は自動検出
    if [[ -z "$FSX_FILESYSTEM_ID" ]]; then
        log_info "FSx for ONTAPファイルシステムを自動検出中..."
        
        FSX_FILESYSTEM_ID=$(aws fsx describe-file-systems \
            --query 'FileSystems[?FileSystemType==`ONTAP`].FileSystemId' \
            --output text 2>/dev/null | head -1)
        
        if [[ -z "$FSX_FILESYSTEM_ID" ]]; then
            log_error "FSx for ONTAPファイルシステムが見つかりません"
            return 1
        fi
        
        log_info "検出されたファイルシステムID: $FSX_FILESYSTEM_ID"
    fi
    
    # SVM名が指定されていない場合は自動検出
    if [[ -z "$FSX_SVM_NAME" ]]; then
        log_info "FSx for ONTAP SVMを自動検出中..."
        
        FSX_SVM_NAME=$(aws fsx describe-storage-virtual-machines \
            --filters Name=file-system-id,Values="$FSX_FILESYSTEM_ID" \
            --query 'StorageVirtualMachines[0].Name' \
            --output text 2>/dev/null)
        
        if [[ -z "$FSX_SVM_NAME" || "$FSX_SVM_NAME" == "None" ]]; then
            log_warn "SVM名を自動検出できませんでした。デフォルトSVMを使用します"
            FSX_SVM_NAME="svm_default"
        fi
        
        log_info "検出されたSVM名: $FSX_SVM_NAME"
    fi
    
    # ボリューム名が指定されていない場合は自動検出
    if [[ -z "$FSX_VOLUME_NAME" ]]; then
        log_info "FSx for ONTAPボリュームを自動検出中..."
        
        FSX_VOLUME_NAME=$(aws fsx describe-volumes \
            --filters Name=file-system-id,Values="$FSX_FILESYSTEM_ID" \
            --query 'Volumes[0].Name' \
            --output text 2>/dev/null)
        
        if [[ -z "$FSX_VOLUME_NAME" || "$FSX_VOLUME_NAME" == "None" ]]; then
            log_warn "ボリューム名を自動検出できませんでした。デフォルトボリュームを使用します"
            FSX_VOLUME_NAME="vol1"
        fi
        
        log_info "検出されたボリューム名: $FSX_VOLUME_NAME"
    fi
    
    # NFSエクスポートパスの構築
    local nfs_export_path="/$FSX_VOLUME_NAME"
    log_info "NFSエクスポートパス: $nfs_export_path"
    
    # FSxファイルシステムの詳細情報を取得
    local fsx_info
    fsx_info=$(aws fsx describe-file-systems \
        --file-system-ids "$FSX_FILESYSTEM_ID" \
        --query 'FileSystems[0].[DNSName,VpcId,SubnetIds[0]]' \
        --output text 2>/dev/null)
    
    if [[ -n "$fsx_info" ]]; then
        local dns_name vpc_id subnet_id
        read -r dns_name vpc_id subnet_id <<< "$fsx_info"
        
        log_info "FSx DNS名: $dns_name"
        log_info "FSx VPC ID: $vpc_id"
        log_info "FSx サブネットID: $subnet_id"
        
        # NFSマウントコマンドの生成
        local mount_command="sudo mount -t nfs -o nfsvers=3 ${dns_name}:${nfs_export_path} ${FSX_MOUNT_PATH}"
        log_info "推奨マウントコマンド: $mount_command"
    fi
    
    return 0
}

# AWS Batch リソース情報の取得
get_batch_resources() {
    log_info "AWS Batch リソース情報を取得中..."
    
    if [[ -z "$STACK_NAME" ]]; then
        # スタック名の自動検出
        local stacks
        stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `embedding`) == `true`].StackName' --output text)
        
        if [[ -z "$stacks" ]]; then
            stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `permission-aware-rag`) == `true`].StackName' --output text)
        fi
        
        if [[ -z "$stacks" ]]; then
            log_error "Embeddingスタックが見つかりません"
            exit 1
        fi
        
        STACK_NAME=$(echo "$stacks" | head -1)
        log_info "自動検出されたスタック名: $STACK_NAME"
    fi
    
    # スタック出力の取得
    local stack_outputs
    stack_outputs=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output json 2>/dev/null || echo "[]")
    
    # Batch リソース情報の抽出
    BATCH_JOB_QUEUE=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="BatchJobQueue" or .OutputKey=="JobQueue") | .OutputValue // empty' | head -1)
    BATCH_COMPUTE_ENV=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="BatchComputeEnvironment" or .OutputKey=="ComputeEnvironment") | .OutputValue // empty' | head -1)
    S3_BUCKET_NAME=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="DocumentsBucketName" or .OutputKey=="S3BucketName") | .OutputValue // empty' | head -1)
    FSX_FILE_SYSTEM_ID=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="FSxOntapFileSystemId" or .OutputKey=="FsxFileSystemId") | .OutputValue // empty' | head -1)
    
    # ジョブ定義の取得
    local job_definitions
    job_definitions=$(aws batch describe-job-definitions --status ACTIVE --query 'jobDefinitions[?contains(jobDefinitionName, `embedding`) == `true`].jobDefinitionArn' --output text)
    
    if [[ -z "$job_definitions" ]]; then
        job_definitions=$(aws batch describe-job-definitions --status ACTIVE --query 'jobDefinitions[-1].jobDefinitionArn' --output text)
    fi
    
    BATCH_JOB_DEFINITION=$(echo "$job_definitions" | head -1)
    
    log_info "Batch Job Queue: ${BATCH_JOB_QUEUE:-未設定}"
    log_info "Batch Compute Environment: ${BATCH_COMPUTE_ENV:-未設定}"
    log_info "Batch Job Definition: ${BATCH_JOB_DEFINITION:-未設定}"
    log_info "S3 Bucket: ${S3_BUCKET_NAME:-未設定}"
    log_info "FSx File System ID: ${FSX_FILE_SYSTEM_ID:-未設定}"
    
    if [[ -z "$BATCH_JOB_QUEUE" ]] || [[ -z "$BATCH_JOB_DEFINITION" ]]; then
        log_error "必要なBatchリソースが見つかりません"
        exit 1
    fi
}

# テストデータの生成
generate_test_data() {
    log_info "テストデータを生成中: $FILE_COUNT ファイル"
    
    local test_data_dir="$PROJECT_ROOT/test-data/batch-load-test-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$test_data_dir"
    
    # 多様なファイルタイプとサイズのテストデータを生成
    local file_types=("txt" "md" "json" "csv")
    local content_templates=(
        "machine_learning_document"
        "technical_specification"
        "research_paper"
        "system_architecture"
        "data_analysis_report"
    )
    
    for ((i=1; i<=FILE_COUNT; i++)); do
        local file_type=${file_types[$((i % ${#file_types[@]}))]}
        local template=${content_templates[$((i % ${#content_templates[@]}))]}
        local filename=$(printf "test-doc-%06d.%s" $i "$file_type")
        local filepath="$test_data_dir/$filename"
        
        # ファイルサイズを変動させる（1KB-100KB）
        local file_size=$((RANDOM % 99 + 1))
        
        generate_document_content "$template" "$file_type" "$file_size" > "$filepath"
        
        if $VERBOSE && (( i % 100 == 0 )); then
            log_info "生成済み: $i/$FILE_COUNT ファイル"
        fi
    done
    
    log_info "テストデータ生成完了: $test_data_dir"
    TEST_DATA_DIR="$test_data_dir"
}

# ドキュメントコンテンツの生成
generate_document_content() {
    local template="$1"
    local file_type="$2"
    local size_kb="$3"
    
    case "$template" in
        "machine_learning_document")
            cat << EOF
# Machine Learning Document $(date +%Y%m%d-%H%M%S)

## Overview
This document covers advanced machine learning concepts and implementations.

## Key Topics
- Deep Learning Architectures
- Neural Network Optimization
- Transfer Learning Techniques
- Model Deployment Strategies

## Technical Details
$(for j in $(seq 1 $((size_kb / 2))); do echo "Line $j: Advanced machine learning concepts including gradient descent, backpropagation, and regularization techniques."; done)

## Conclusion
Machine learning continues to evolve with new architectures and optimization techniques.
EOF
            ;;
        "technical_specification")
            cat << EOF
Technical Specification Document

System: Embedding Processing Pipeline
Version: 1.0
Date: $(date)

Requirements:
$(for j in $(seq 1 $((size_kb / 3))); do echo "REQ-$j: System shall process documents with latency less than 100ms per document."; done)

Architecture:
- Microservices-based design
- Event-driven processing
- Scalable compute resources

Performance Metrics:
- Throughput: > 1000 docs/second
- Latency: < 100ms
- Availability: 99.9%
EOF
            ;;
        *)
            # デフォルトコンテンツ
            cat << EOF
Document ID: $(uuidgen 2>/dev/null || echo "$(date +%s)-$RANDOM")
Generated: $(date)
Type: $template
Format: $file_type

Content:
$(for j in $(seq 1 $size_kb); do echo "Content line $j with sample text for embedding processing and analysis."; done)
EOF
            ;;
    esac
}

# S3へのテストデータアップロード
upload_test_data() {
    log_info "テストデータをS3にアップロード中..."
    
    local upload_prefix="batch-load-test/$(date +%Y%m%d-%H%M%S)"
    local upload_start=$(date +%s.%N)
    
    # 並列アップロード（最適化されたパラメータ）
    find "$TEST_DATA_DIR" -type f -print0 | \
        xargs -0 -P "$CONCURRENT_JOBS" -I {} \
        aws s3 cp {} "s3://$S3_BUCKET_NAME/$upload_prefix/" \
        --storage-class STANDARD_IA \
        --metadata "test-run=$(date +%Y%m%d-%H%M%S),purpose=batch-load-test"
    
    local upload_end=$(date +%s.%N)
    local upload_duration=$(echo "$upload_end - $upload_start" | bc -l)
    
    # アップロード結果の確認
    local uploaded_count
    uploaded_count=$(aws s3 ls "s3://$S3_BUCKET_NAME/$upload_prefix/" | wc -l)
    
    log_info "S3アップロード完了: $uploaded_count ファイル ($(printf "%.2f" "$upload_duration")秒)"
    
    UPLOAD_PREFIX="$upload_prefix"
    UPLOAD_DURATION="$upload_duration"
}

# Batchジョブの投入と監視
submit_batch_jobs() {
    log_info "Batchジョブを投入中: $CONCURRENT_JOBS 個の並列ジョブ"
    
    if $DRY_RUN; then
        log_info "ドライラン: 実際のジョブ投入はスキップ"
        return
    fi
    
    local job_ids=()
    local job_start_time=$(date +%s.%N)
    
    # 並列ジョブの投入
    for ((i=1; i<=CONCURRENT_JOBS; i++)); do
        local job_name="batch-load-test-job-$i-$(date +%Y%m%d-%H%M%S)"
        local files_per_job=$((FILE_COUNT / CONCURRENT_JOBS))
        local start_index=$(((i-1) * files_per_job + 1))
        local end_index=$((i * files_per_job))
        
        if [[ $i -eq $CONCURRENT_JOBS ]]; then
            end_index=$FILE_COUNT  # 最後のジョブで残りを処理
        fi
        
        log_info "ジョブ投入: $job_name (ファイル $start_index-$end_index)"
        
        local job_id
        local retry_count=0
        local max_retries=3
        
        while [[ $retry_count -lt $max_retries ]]; do
            if job_id=$(aws batch submit-job \
                --job-name "$job_name" \
                --job-queue "$BATCH_JOB_QUEUE" \
                --job-definition "$BATCH_JOB_DEFINITION" \
                --parameters inputPath="$UPLOAD_PREFIX",outputPath="batch-results/$(date +%Y%m%d-%H%M%S)",startIndex="$start_index",endIndex="$end_index" \
                --query 'jobId' --output text 2>/dev/null); then
                break
            else
                ((retry_count++))
                log_warn "ジョブ投入失敗 (試行 $retry_count/$max_retries): $job_name"
                if [[ $retry_count -lt $max_retries ]]; then
                    sleep $((retry_count * 5))  # 指数バックオフ
                fi
            fi
        done
        
        if [[ $retry_count -eq $max_retries ]]; then
            log_error "ジョブ投入に失敗しました: $job_name"
            continue
        fi
        
        job_ids+=("$job_id")
        log_info "ジョブ投入完了: $job_id"
        
        # ジョブ投入間隔を調整
        sleep 2
    done
    
    BATCH_JOB_IDS=("${job_ids[@]}")
    JOB_START_TIME="$job_start_time"
}

# ジョブ実行状況の監視
monitor_batch_jobs() {
    log_info "Batchジョブの実行状況を監視中..."
    
    if $DRY_RUN; then
        log_info "ドライラン: ジョブ監視をスキップ"
        return
    fi
    
    local monitoring_start=$(date +%s)
    local monitoring_end=$((monitoring_start + TEST_DURATION))
    local check_interval=30
    
    # メトリクス初期化
    echo '{"monitoring_start": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "job_metrics": []}' > "$METRICS_FILE"
    
    while [[ $(date +%s) -lt $monitoring_end ]]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - monitoring_start))
        
        log_info "監視中: ${elapsed}秒経過 / ${TEST_DURATION}秒"
        
        # 各ジョブの状態を確認
        local job_statuses=()
        local running_jobs=0
        local completed_jobs=0
        local failed_jobs=0
        
        for job_id in "${BATCH_JOB_IDS[@]}"; do
            local job_info
            job_info=$(aws batch describe-jobs --jobs "$job_id" --query 'jobs[0]' --output json)
            
            local job_status
            job_status=$(echo "$job_info" | jq -r '.status')
            
            local job_name
            job_name=$(echo "$job_info" | jq -r '.jobName')
            
            case "$job_status" in
                "RUNNING")
                    ((running_jobs++))
                    ;;
                "SUCCEEDED")
                    ((completed_jobs++))
                    ;;
                "FAILED")
                    ((failed_jobs++))
                    log_warn "ジョブ失敗: $job_name ($job_id)"
                    ;;
            esac
            
            job_statuses+=("$job_status")
        done
        
        # メトリクスの記録
        local metrics_entry
        metrics_entry=$(cat << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "elapsed_seconds": $elapsed,
  "running_jobs": $running_jobs,
  "completed_jobs": $completed_jobs,
  "failed_jobs": $failed_jobs,
  "total_jobs": ${#BATCH_JOB_IDS[@]}
}
EOF
        )
        
        # メトリクスファイルの更新
        local updated_metrics
        updated_metrics=$(jq --argjson entry "$metrics_entry" '.job_metrics += [$entry]' "$METRICS_FILE")
        echo "$updated_metrics" > "$METRICS_FILE"
        
        log_info "ジョブ状況: 実行中=$running_jobs, 完了=$completed_jobs, 失敗=$failed_jobs"
        
        # 全ジョブ完了チェック
        if [[ $running_jobs -eq 0 ]] && [[ $((completed_jobs + failed_jobs)) -eq ${#BATCH_JOB_IDS[@]} ]]; then
            log_info "全ジョブ完了"
            break
        fi
        
        sleep $check_interval
    done
    
    MONITORING_DURATION=$(($(date +%s) - monitoring_start))
}

# FSxマウント性能の測定
measure_fsx_performance() {
    log_info "FSxマウント性能を測定中..."
    
    # FSxマウントパスのセキュリティ検証
    if ! validate_fsx_mount_path "$FSX_MOUNT_PATH"; then
        log_error "FSxマウントパスのセキュリティ検証に失敗: $FSX_MOUNT_PATH"
        return 1
    fi
    
    if [[ ! -d "$FSX_MOUNT_PATH" ]]; then
        log_warn "FSxマウントパスが見つかりません: $FSX_MOUNT_PATH"
        return
    fi
    
    # FSxマウントパスの書き込み権限確認
    if [[ ! -w "$FSX_MOUNT_PATH" ]]; then
        log_error "FSxマウントパスに書き込み権限がありません: $FSX_MOUNT_PATH"
        return
    fi
    
    local perf_test_dir="$FSX_MOUNT_PATH/batch-perf-test-$(date +%Y%m%d-%H%M%S)"
    
    # セキュアなディレクトリ作成
    if ! mkdir -p "$perf_test_dir"; then
        log_error "テストディレクトリの作成に失敗しました: $perf_test_dir"
        return
    fi
    
    # ディレクトリのパーミッション設定
    chmod 700 "$perf_test_dir"
    
    # 書き込み性能測定
    log_info "FSx書き込み性能測定中..."
    local write_start=$(date +%s.%N)
    dd if=/dev/zero of="$perf_test_dir/write_test.dat" bs=1M count=1000 2>/dev/null
    local write_end=$(date +%s.%N)
    local write_time=$(echo "$write_end - $write_start" | bc -l)
    local write_throughput=$(echo "scale=2; 1000 / $write_time" | bc -l)
    
    # 読み込み性能測定
    log_info "FSx読み込み性能測定中..."
    local read_start=$(date +%s.%N)
    dd if="$perf_test_dir/write_test.dat" of=/dev/null bs=1M 2>/dev/null
    local read_end=$(date +%s.%N)
    local read_time=$(echo "$read_end - $read_start" | bc -l)
    local read_throughput=$(echo "scale=2; 1000 / $read_time" | bc -l)
    
    # ランダムアクセス性能測定
    log_info "FSxランダムアクセス性能測定中..."
    local random_start=$(date +%s.%N)
    for ((i=1; i<=100; i++)); do
        dd if="$perf_test_dir/write_test.dat" of=/dev/null bs=1M count=1 skip=$((RANDOM % 1000)) 2>/dev/null
    done
    local random_end=$(date +%s.%N)
    local random_time=$(echo "$random_end - $random_start" | bc -l)
    
    # 結果の記録
    FSX_WRITE_THROUGHPUT="$write_throughput"
    FSX_READ_THROUGHPUT="$read_throughput"
    FSX_RANDOM_ACCESS_TIME="$random_time"
    
    log_info "FSx性能測定結果:"
    log_info "  書き込みスループット: ${write_throughput} MB/s"
    log_info "  読み込みスループット: ${read_throughput} MB/s"
    log_info "  ランダムアクセス時間: $(printf "%.2f" "$random_time")秒 (100回)"
    
    # クリーンアップ
    rm -rf "$perf_test_dir"
}

# 自動スケーリング性能の測定
measure_autoscaling_performance() {
    log_info "自動スケーリング性能を測定中..."
    
    if [[ -z "$BATCH_COMPUTE_ENV" ]]; then
        log_warn "Compute Environment情報が取得できません"
        return
    fi
    
    local scaling_metrics=()
    local measurement_start=$(date +%s)
    local measurement_duration=600  # 10分間測定
    
    while [[ $(($(date +%s) - measurement_start)) -lt $measurement_duration ]]; do
        local compute_env_info
        compute_env_info=$(aws batch describe-compute-environments --compute-environments "$BATCH_COMPUTE_ENV" --query 'computeEnvironments[0]' --output json)
        
        local desired_capacity
        desired_capacity=$(echo "$compute_env_info" | jq -r '.computeResources.desiredvCpus // 0')
        
        local running_capacity
        running_capacity=$(echo "$compute_env_info" | jq -r '.computeResources.runningvCpus // 0')
        
        local scaling_entry
        scaling_entry=$(cat << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "desired_vcpus": $desired_capacity,
  "running_vcpus": $running_capacity,
  "utilization": $(echo "scale=2; if($desired_capacity > 0) $running_capacity / $desired_capacity * 100 else 0" | bc -l)
}
EOF
        )
        
        scaling_metrics+=("$scaling_entry")
        
        if $VERBOSE; then
            log_info "スケーリング状況: 希望=$desired_capacity vCPUs, 実行中=$running_capacity vCPUs"
        fi
        
        sleep 30
    done
    
    # スケーリングメトリクスをファイルに保存
    local scaling_file="$LOG_DIR/scaling-metrics-$(date +%Y%m%d-%H%M%S).json"
    printf '%s\n' "${scaling_metrics[@]}" | jq -s '.' > "$scaling_file"
    
    log_info "自動スケーリング測定完了: $scaling_file"
    SCALING_METRICS_FILE="$scaling_file"
}

# 結果分析とレポート生成
analyze_results() {
    log_info "負荷試験結果を分析中..."
    
    local report_file="$LOG_DIR/aws-batch-load-test-report-$(date +%Y%m%d-%H%M%S).md"
    
    # 基本統計の計算
    local total_jobs=${#BATCH_JOB_IDS[@]}
    local job_completion_rate=0
    local avg_job_duration=0
    
    if [[ -f "$METRICS_FILE" ]] && ! $DRY_RUN; then
        local final_metrics
        final_metrics=$(jq '.job_metrics[-1]' "$METRICS_FILE")
        
        local completed_jobs
        completed_jobs=$(echo "$final_metrics" | jq -r '.completed_jobs')
        
        local failed_jobs
        failed_jobs=$(echo "$final_metrics" | jq -r '.failed_jobs')
        
        job_completion_rate=$(echo "scale=2; ($completed_jobs / $total_jobs) * 100" | bc -l)
    fi
    
    # レポート生成
    cat > "$report_file" << EOF
# AWS Batch 負荷試験レポート

## 実行概要
- 実行日時: $(date)
- スタック名: $STACK_NAME
- テスト実行時間: $TEST_DURATION 秒
- 総ファイル数: $FILE_COUNT
- バッチサイズ: $BATCH_SIZE
- 同時実行ジョブ数: $CONCURRENT_JOBS

## Batch ジョブ性能

### ジョブ実行統計
- 総ジョブ数: $total_jobs
- 完了率: ${job_completion_rate}%
- 監視時間: ${MONITORING_DURATION:-N/A} 秒

### リソース情報
- Job Queue: $BATCH_JOB_QUEUE
- Job Definition: $BATCH_JOB_DEFINITION
- Compute Environment: $BATCH_COMPUTE_ENV

## FSx for ONTAP 性能

### ストレージ性能
- 書き込みスループット: ${FSX_WRITE_THROUGHPUT:-N/A} MB/s
- 読み込みスループット: ${FSX_READ_THROUGHPUT:-N/A} MB/s
- ランダムアクセス時間: ${FSX_RANDOM_ACCESS_TIME:-N/A} 秒

## データ転送性能

### S3アップロード
- アップロード時間: ${UPLOAD_DURATION:-N/A} 秒
- 平均転送速度: $(if [[ -n "$UPLOAD_DURATION" ]]; then echo "scale=2; $FILE_COUNT / $UPLOAD_DURATION" | bc -l; else echo "N/A"; fi) ファイル/秒

## 推奨事項

### パフォーマンス最適化
1. **バッチサイズ調整**: 現在のバッチサイズ($BATCH_SIZE)の最適化を検討
2. **並列度調整**: 同時実行ジョブ数($CONCURRENT_JOBS)の調整を検討
3. **リソース配分**: Compute Environmentのインスタンスタイプ最適化

### 監視強化
1. **リアルタイム監視**: CloudWatch メトリクスの活用
2. **アラート設定**: 失敗率やレイテンシのしきい値設定
3. **コスト監視**: Spot インスタンス使用率の最適化

### スケーラビリティ
1. **自動スケーリング**: より積極的なスケーリング設定
2. **キュー管理**: 複数キューによる優先度制御
3. **リソース予約**: 予測可能なワークロード向けの容量予約

## 詳細ログ
- 実行ログ: $LOG_FILE
- メトリクス: $METRICS_FILE
- スケーリング: ${SCALING_METRICS_FILE:-N/A}

EOF
    
    log_info "負荷試験レポート生成完了: $report_file"
    
    if $VERBOSE; then
        echo ""
        echo "=== 負荷試験レポート ==="
        cat "$report_file"
        echo "======================="
    fi
    
    REPORT_FILE="$report_file"
}

# クリーンアップ
cleanup() {
    local exit_code=$?
    
    log_info "クリーンアップ実行中..."
    
    # 機密変数のクリア
    unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN 2>/dev/null || true
    
    # テストデータの削除
    if [[ -n "${TEST_DATA_DIR:-}" ]] && [[ -d "$TEST_DATA_DIR" ]]; then
        log_info "ローカルテストデータ削除: $TEST_DATA_DIR"
        rm -rf "$TEST_DATA_DIR"
    fi
    
    # S3テストデータの削除（オプション）
    if [[ -n "${UPLOAD_PREFIX:-}" ]] && [[ -n "${S3_BUCKET_NAME:-}" ]]; then
        # 非対話モードでの自動削除オプション追加
        if [[ "${AUTO_CLEANUP:-false}" == "true" ]]; then
            log_info "S3テストデータ自動削除: s3://$S3_BUCKET_NAME/$UPLOAD_PREFIX/"
            aws s3 rm "s3://$S3_BUCKET_NAME/$UPLOAD_PREFIX/" --recursive
        else
            read -p "S3上のテストデータを削除しますか？ (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_info "S3テストデータ削除: s3://$S3_BUCKET_NAME/$UPLOAD_PREFIX/"
                aws s3 rm "s3://$S3_BUCKET_NAME/$UPLOAD_PREFIX/" --recursive
            fi
        fi
    fi
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "負荷試験がエラーで終了しました (終了コード: $exit_code)"
    else
        log_info "AWS Batch 負荷試験完了"
        if [[ -n "${REPORT_FILE:-}" ]]; then
            log_info "詳細レポート: $REPORT_FILE"
        fi
    fi
    
    exit $exit_code
}

# FSxマウントパスのセキュリティ検証
validate_fsx_mount_path() {
    local mount_path="$1"
    
    # パストラバーサル攻撃防止（強化版）
    if [[ "$mount_path" =~ \.\./|/\.\.|^\.\.|\.\.$ ]]; then
        log_error "パストラバーサル攻撃の可能性があるパス: $mount_path"
        return 1
    fi
    
    # 危険な文字の検出
    if [[ "$mount_path" =~ [\$\`\;] ]]; then
        log_error "危険な文字が含まれています: $mount_path"
        return 1
    fi
    
    # 絶対パスの検証
    if [[ ! "$mount_path" =~ ^/ ]]; then
        log_error "FSxマウントパスは絶対パスである必要があります: $mount_path"
        return 1
    fi
    
    # 許可されたマウントパスのホワイトリスト
    local allowed_paths=("/mnt/fsx" "/opt/fsx" "/data/fsx")
    local path_allowed=false
    
    for allowed_path in "${allowed_paths[@]}"; do
        if [[ "$mount_path" =~ ^"$allowed_path" ]]; then
            path_allowed=true
            break
        fi
    done
    
    if [[ "$path_allowed" != "true" ]]; then
        log_error "許可されていないマウントパス: $mount_path"
        log_error "許可されたパス: ${allowed_paths[*]}"
        return 1
    fi
    
    return 0
}

# 入力値検証
validate_inputs() {
    # 数値検証（上限値追加）
    if ! [[ "$FILE_COUNT" =~ ^[0-9]+$ ]] || (( FILE_COUNT <= 0 )) || (( FILE_COUNT > 100000 )); then
        log_error "無効なファイル数: $FILE_COUNT (1-100000の範囲で指定してください)"
        exit 1
    fi
    
    if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || (( BATCH_SIZE <= 0 )) || (( BATCH_SIZE > 1000 )); then
        log_error "無効なバッチサイズ: $BATCH_SIZE (1-1000の範囲で指定してください)"
        exit 1
    fi
    
    if ! [[ "$CONCURRENT_JOBS" =~ ^[0-9]+$ ]] || (( CONCURRENT_JOBS <= 0 )) || (( CONCURRENT_JOBS > 100 )); then
        log_error "無効な同時実行ジョブ数: $CONCURRENT_JOBS (1-100の範囲で指定してください)"
        exit 1
    fi
    
    if ! [[ "$TEST_DURATION" =~ ^[0-9]+$ ]] || (( TEST_DURATION <= 0 )) || (( TEST_DURATION > 86400 )); then
        log_error "無効なテスト実行時間: $TEST_DURATION (1-86400秒の範囲で指定してください)"
        exit 1
    fi
    
    # FSxマウントパスのセキュリティ検証
    if ! validate_fsx_mount_path "$FSX_MOUNT_PATH"; then
        log_error "FSxマウントパスの検証に失敗しました"
        exit 1
    fi
    
    # FSx設定値の最終検証
    if ! validate_fsx_config "$FSX_FILESYSTEM_ID" "$FSX_VOLUME_NAME" "$FSX_SVM_NAME"; then
        log_error "FSx設定の最終検証に失敗しました"
        exit 1
    fi
    
    log_info "入力値検証完了"
}

# メイン実行関数
main() {
    # 設定ファイル読み込み
    load_config_file
    
    # 入力値検証
    validate_inputs
    
    # 前提条件チェック
    check_prerequisites
    
    # FSx for ONTAPリソースの検出（セキュリティ強化版）
    log_info "FSx for ONTAPリソース検出を開始..."
    
    # セキュリティコンテキストの検証
    if [[ -z "${AWS_REGION:-}" ]]; then
        AWS_REGION=$(aws configure get region 2>/dev/null || echo "ap-northeast-1")
        log_warn "AWS_REGIONが未設定のため、デフォルト値を使用: $AWS_REGION"
    fi
    
    # FSx検出の実行（エラーハンドリング強化）
    if ! detect_fsx_resources; then
        log_error "FSx for ONTAPリソースの検出に失敗しました"
        log_error "以下を確認してください:"
        log_error "  1. AWS認証情報の設定"
        log_error "  2. 指定リージョンでのFSx for ONTAPリソースの存在"
        log_error "  3. FSxリソースへのアクセス権限"
        
        # 機密情報のクリア
        unset FSX_FILESYSTEM_ID FSX_VOLUME_NAME FSX_SVM_NAME 2>/dev/null || true
        exit 1
    fi
    
    log_info "FSx for ONTAPリソース検出完了"
    
    # AWS Batch リソース情報取得
    get_batch_resources
    
    # テストデータ生成
    generate_test_data
    
    # S3アップロード
    upload_test_data
    
    # FSx性能測定
    measure_fsx_performance
    
    # Batchジョブ投入
    submit_batch_jobs
    
    # 自動スケーリング測定（バックグラウンド）
    if ! $DRY_RUN; then
        measure_autoscaling_performance &
        SCALING_PID=$!
    fi
    
    # ジョブ監視
    monitor_batch_jobs
    
    # スケーリング測定の完了を待機
    if [[ -n "${SCALING_PID:-}" ]]; then
        wait $SCALING_PID
    fi
    
    # 結果分析
    analyze_results
    
    log_info "AWS Batch 負荷試験完了"
}

# エラートラップ設定
trap cleanup EXIT ERR

# メイン実行
main "$@"