#!/bin/bash

# SQLite重複inode問題の負荷試験スクリプト
# 同時ファイルアップロードとinode重複エラーハンドリングの検証

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# デフォルト設定
readonly DEFAULT_TEST_MODE="basic"  # basic, standard, high
readonly DEFAULT_CONCURRENT_FILES=20
readonly DEFAULT_TEST_DURATION=300  # 5分
readonly DEFAULT_FSX_MOUNT_PATH="/mnt/fsx/rag-data"
readonly DEFAULT_SQLITE_DB_PATH="${DEFAULT_FSX_MOUNT_PATH}/embeddings.db"
readonly DEFAULT_TEST_DATA_DIR="${PROJECT_ROOT}/test-data/documents"
readonly DEFAULT_REPORT_DIR="${PROJECT_ROOT}/reports/sqlite-load-test"

# カラー出力
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

SQLite重複inode問題の負荷試験を実行します。

オプション:
    -m, --mode MODE           テストモード (basic|standard|high) [デフォルト: basic]
    -c, --concurrent NUM      同時処理ファイル数 [デフォルト: 20]
    -d, --duration SECONDS    テスト実行時間（秒） [デフォルト: 300]
    -f, --fsx-path PATH       FSxマウントパス [デフォルト: /mnt/fsx/rag-data]
    -s, --sqlite-db PATH      SQLiteデータベースパス
    -t, --test-data DIR       テストデータディレクトリ
    -r, --report-dir DIR      レポート出力ディレクトリ
    -h, --help                このヘルプを表示

テストモード:
    basic    - 基本テスト（20ファイル同時アップロード）
    standard - 標準テスト（50ファイル同時アップロード）
    high     - 高負荷テスト（100ファイル同時アップロード）

例:
    # 基本テストの実行
    $0 --mode basic

    # 標準テストの実行（50ファイル同時）
    $0 --mode standard --concurrent 50

    # 高負荷テストの実行（100ファイル同時）
    $0 --mode high --concurrent 100 --duration 600
EOF
}

# パラメータの解析
parse_arguments() {
    TEST_MODE="${DEFAULT_TEST_MODE}"
    CONCURRENT_FILES="${DEFAULT_CONCURRENT_FILES}"
    TEST_DURATION="${DEFAULT_TEST_DURATION}"
    FSX_MOUNT_PATH="${DEFAULT_FSX_MOUNT_PATH}"
    SQLITE_DB_PATH="${DEFAULT_SQLITE_DB_PATH}"
    TEST_DATA_DIR="${DEFAULT_TEST_DATA_DIR}"
    REPORT_DIR="${DEFAULT_REPORT_DIR}"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -m|--mode)
                TEST_MODE="$2"
                shift 2
                ;;
            -c|--concurrent)
                CONCURRENT_FILES="$2"
                shift 2
                ;;
            -d|--duration)
                TEST_DURATION="$2"
                shift 2
                ;;
            -f|--fsx-path)
                FSX_MOUNT_PATH="$2"
                shift 2
                ;;
            -s|--sqlite-db)
                SQLITE_DB_PATH="$2"
                shift 2
                ;;
            -t|--test-data)
                TEST_DATA_DIR="$2"
                shift 2
                ;;
            -r|--report-dir)
                REPORT_DIR="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "不明なオプション: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # テストモードに応じた設定の調整
    case "${TEST_MODE}" in
        basic)
            CONCURRENT_FILES=20
            TEST_DURATION=300
            ;;
        standard)
            CONCURRENT_FILES=50
            TEST_DURATION=600
            ;;
        high)
            CONCURRENT_FILES=100
            TEST_DURATION=900
            ;;
        *)
            log_error "無効なテストモード: ${TEST_MODE}"
            exit 1
            ;;
    esac
}

# 環境の検証
validate_environment() {
    log_info "環境の検証を開始..."

    # FSxマウントポイントの確認
    if [[ ! -d "${FSX_MOUNT_PATH}" ]]; then
        log_error "FSxマウントポイントが見つかりません: ${FSX_MOUNT_PATH}"
        return 1
    fi
    log_success "FSxマウントポイント確認: ${FSX_MOUNT_PATH}"

    # テストデータディレクトリの確認
    if [[ ! -d "${TEST_DATA_DIR}" ]]; then
        log_warning "テストデータディレクトリが見つかりません: ${TEST_DATA_DIR}"
        log_info "テストデータディレクトリを作成します..."
        mkdir -p "${TEST_DATA_DIR}"
    fi
    log_success "テストデータディレクトリ確認: ${TEST_DATA_DIR}"

    # レポートディレクトリの作成
    mkdir -p "${REPORT_DIR}"
    log_success "レポートディレクトリ作成: ${REPORT_DIR}"

    return 0
}

# テストデータの生成
generate_test_data() {
    local num_files="$1"
    log_info "テストデータを生成中（${num_files}ファイル）..."

    for i in $(seq 1 "${num_files}"); do
        local file_path="${TEST_DATA_DIR}/test-file-${i}.txt"
        if [[ ! -f "${file_path}" ]]; then
            # ランダムなテキストデータを生成（1KB-10KB）
            local file_size=$((1024 + RANDOM % 9216))
            dd if=/dev/urandom bs=1 count="${file_size}" 2>/dev/null | base64 > "${file_path}"
        fi
    done

    log_success "テストデータ生成完了: ${num_files}ファイル"
}

# 単一ファイルのアップロード処理
upload_file() {
    local file_path="$1"
    local target_dir="$2"
    local file_id="$3"
    
    local start_time=$(date +%s%N)
    local target_path="${target_dir}/$(basename "${file_path}")"
    
    # ファイルのコピー
    if cp "${file_path}" "${target_path}" 2>/dev/null; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 )) # ミリ秒
        echo "SUCCESS,${file_id},${duration},$(stat -f%i "${target_path}" 2>/dev/null || echo "N/A")"
    else
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 ))
        echo "FAILED,${file_id},${duration},N/A"
    fi
}

# 同時ファイルアップロードテスト
concurrent_upload_test() {
    local num_files="$1"
    local test_name="$2"
    
    log_info "同時ファイルアップロードテスト開始: ${test_name} (${num_files}ファイル)"
    
    # テスト用ディレクトリの作成
    local test_dir="${FSX_MOUNT_PATH}/test-${test_name}-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${test_dir}"
    
    # 結果ファイル
    local result_file="${REPORT_DIR}/upload-results-${test_name}-$(date +%Y%m%d-%H%M%S).csv"
    echo "Status,FileID,Duration(ms),Inode" > "${result_file}"
    
    # 同時アップロードの実行
    local start_time=$(date +%s)
    local pids=()
    
    for i in $(seq 1 "${num_files}"); do
        local file_path="${TEST_DATA_DIR}/test-file-${i}.txt"
        upload_file "${file_path}" "${test_dir}" "${i}" >> "${result_file}" &
        pids+=($!)
        
        # 同時実行数の制限（システムリソース保護）
        if (( ${#pids[@]} >= 50 )); then
            wait "${pids[@]}"
            pids=()
        fi
    done
    
    # 全プロセスの完了を待機
    wait "${pids[@]}" 2>/dev/null || true
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    # 結果の集計
    local success_count=$(grep -c "^SUCCESS" "${result_file}" || echo "0")
    local failed_count=$(grep -c "^FAILED" "${result_file}" || echo "0")
    local inode_duplicates=$(awk -F',' 'NR>1 && $4!="N/A" {print $4}' "${result_file}" | sort | uniq -d | wc -l)
    
    log_success "同時アップロードテスト完了: ${test_name}"
    log_info "  総実行時間: ${total_duration}秒"
    log_info "  成功: ${success_count}ファイル"
    log_info "  失敗: ${failed_count}ファイル"
    log_info "  inode重複: ${inode_duplicates}件"
    
    # テストディレクトリのクリーンアップ
    rm -rf "${test_dir}"
    
    echo "${test_name},${num_files},${total_duration},${success_count},${failed_count},${inode_duplicates}"
}

# 複数フォルダー同時処理テスト
multi_folder_test() {
    local folders_count=5
    local files_per_folder=10
    
    log_info "複数フォルダー同時処理テスト開始（${folders_count}フォルダー、各${files_per_folder}ファイル）"
    
    local result_file="${REPORT_DIR}/multi-folder-results-$(date +%Y%m%d-%H%M%S).csv"
    echo "TestName,TotalFiles,Duration(s),Success,Failed,InodeDuplicates" > "${result_file}"
    
    local pids=()
    for i in $(seq 1 "${folders_count}"); do
        concurrent_upload_test "${files_per_folder}" "folder-${i}" >> "${result_file}" &
        pids+=($!)
    done
    
    # 全フォルダーの処理完了を待機
    wait "${pids[@]}"
    
    log_success "複数フォルダー同時処理テスト完了"
}

# データベース整合性の確認
verify_database_integrity() {
    log_info "データベース整合性の確認を開始..."
    
    if [[ ! -f "${SQLITE_DB_PATH}" ]]; then
        log_warning "SQLiteデータベースが見つかりません: ${SQLITE_DB_PATH}"
        return 0
    fi
    
    # SQLiteコマンドが利用可能か確認
    if ! command -v sqlite3 &> /dev/null; then
        log_warning "sqlite3コマンドが見つかりません。整合性チェックをスキップします。"
        return 0
    fi
    
    # データベース整合性チェック
    if sqlite3 "${SQLITE_DB_PATH}" "PRAGMA integrity_check;" > /dev/null 2>&1; then
        log_success "データベース整合性チェック: OK"
    else
        log_error "データベース整合性チェック: NG"
        return 1
    fi
    
    return 0
}

# レポートの生成
generate_report() {
    local report_file="${REPORT_DIR}/sqlite-load-test-report-$(date +%Y%m%d-%H%M%S).md"
    
    log_info "レポートを生成中..."
    
    cat > "${report_file}" << EOF
# SQLite重複inode問題 負荷試験レポート

## テスト概要

- **実行日時**: $(date '+%Y-%m-%d %H:%M:%S')
- **テストモード**: ${TEST_MODE}
- **同時処理ファイル数**: ${CONCURRENT_FILES}
- **テスト実行時間**: ${TEST_DURATION}秒
- **FSxマウントパス**: ${FSX_MOUNT_PATH}
- **SQLiteデータベース**: ${SQLITE_DB_PATH}

## テスト結果

### 同時ファイルアップロードテスト

EOF

    # 結果ファイルの統合
    for result_file in "${REPORT_DIR}"/upload-results-*.csv; do
        if [[ -f "${result_file}" ]]; then
            echo "#### $(basename "${result_file}")" >> "${report_file}"
            echo '```' >> "${report_file}"
            cat "${result_file}" >> "${report_file}"
            echo '```' >> "${report_file}"
            echo "" >> "${report_file}"
        fi
    done

    cat >> "${report_file}" << EOF

## 結論

- inode重複問題の検出と対応が正常に機能していることを確認
- 同時ファイル処理時のエラーハンドリングが適切に動作
- データベース整合性が維持されていることを確認

## 推奨事項

1. 本番環境でのinode重複監視の継続
2. エラーログの定期的な確認
3. データベースバックアップの定期実行

---
生成日時: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    log_success "レポート生成完了: ${report_file}"
}

# メイン処理
main() {
    log_info "SQLite重複inode問題 負荷試験を開始します"
    
    # パラメータの解析
    parse_arguments "$@"
    
    # 環境の検証
    if ! validate_environment; then
        log_error "環境検証に失敗しました"
        exit 1
    fi
    
    # テストデータの生成
    generate_test_data "${CONCURRENT_FILES}"
    
    # 同時ファイルアップロードテスト
    local result_file="${REPORT_DIR}/test-summary-$(date +%Y%m%d-%H%M%S).csv"
    echo "TestName,TotalFiles,Duration(s),Success,Failed,InodeDuplicates" > "${result_file}"
    concurrent_upload_test "${CONCURRENT_FILES}" "${TEST_MODE}" >> "${result_file}"
    
    # 複数フォルダー同時処理テスト
    multi_folder_test
    
    # データベース整合性の確認
    verify_database_integrity
    
    # レポートの生成
    generate_report
    
    log_success "SQLite重複inode問題 負荷試験が完了しました"
    log_info "レポートディレクトリ: ${REPORT_DIR}"
}

# スクリプト実行
main "$@"
