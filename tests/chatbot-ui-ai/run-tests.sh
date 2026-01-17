#!/bin/bash
# =============================================================================
# Chatbot UI AI統合テストスイート実行スクリプト
# 
# 使用方法:
#   ./run-tests.sh [command] [options]
# 
# コマンド:
#   all          - 全テスト実行 (デフォルト)
#   ui           - UIテストのみ
#   ai           - AIテストのみ
#   rag          - RAGテストのみ
#   security     - セキュリティテストのみ
#   nova         - Nova統合テストのみ
#   multiregion  - マルチリージョンテストのみ
#   setup        - 初期セットアップ
#   clean        - クリーンアップ
# 
# オプション:
#   --environment <env>    - 実行環境 (dev/staging/prod)
#   --region <region>      - AWSリージョン
#   --profile <profile>    - AWSプロファイル
#   --output <path>        - 結果出力ファイル
#   --html <path>          - HTMLレポート出力
#   --verbose              - 詳細ログ
#   --quiet                - 最小限ログ
#   --help                 - ヘルプ表示
# 
# 例:
#   ./run-tests.sh all --environment prod --region ap-northeast-1
#   ./run-tests.sh ai --output ./results.json --html ./report.html
#   ./run-tests.sh security --verbose
# 
# @version 1.0.0
# @author NetApp Japan Technology Team
# =============================================================================

set -euo pipefail

# スクリプトディレクトリの取得
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$SCRIPT_DIR"

# ログ設定
readonly LOG_FILE="$PROJECT_ROOT/logs/test-execution-$(date +%Y%m%d_%H%M%S).log"

# ログ関数
log_info() {
    local message="$1"
    local timestamp="$(date '+%Y/%m/%d %H:%M:%S')"
    echo "[${timestamp}] [INFO] ${message}" | tee -a "${LOG_FILE}"
}

log_warn() {
    local message="$1"
    local timestamp="$(date '+%Y/%m/%d %H:%M:%S')"
    echo "[${timestamp}] [WARN] ${message}" | tee -a "${LOG_FILE}" >&2
}

log_error() {
    local message="$1"
    local timestamp="$(date '+%Y/%m/%d %H:%M:%S')"
    echo "[${timestamp}] [ERROR] ${message}" | tee -a "${LOG_FILE}" >&2
}

# ヘルプ表示
show_help() {
    cat << 'EOF'
🤖 Chatbot UI AI統合テストスイート実行スクリプト

使用方法:
  ./run-tests.sh [command] [options]

コマンド:
  all          - 全テスト実行 (デフォルト)
  ui           - UIテストのみ
  ai           - AIテストのみ
  rag          - RAGテストのみ
  security     - セキュリティテストのみ
  nova         - Nova統合テストのみ
  multiregion  - マルチリージョンテストのみ
  setup        - 初期セットアップ
  clean        - クリーンアップ

オプション:
  --environment <env>    - 実行環境 (dev/staging/prod)
  --region <region>      - AWSリージョン
  --profile <profile>    - AWSプロファイル
  --output <path>        - 結果出力ファイル
  --html <path>          - HTMLレポート出力
  --verbose              - 詳細ログ
  --quiet                - 最小限ログ
  --help                 - ヘルプ表示

例:
  ./run-tests.sh all --environment prod --region ap-northeast-1
  ./run-tests.sh ai --output ./results.json --html ./report.html
  ./run-tests.sh security --verbose

環境変数:
  AWS_REGION             - AWSリージョン (デフォルト: ap-northeast-1)
  AWS_PROFILE            - AWSプロファイル (デフォルト: user01)
  NODE_ENV               - 実行環境 (デフォルト: development)
  LOG_LEVEL              - ログレベル (デフォルト: info)

EOF
}

# 前提条件チェック
check_prerequisites() {
    log_info "🔍 前提条件をチェック中..."

    # Node.js バージョンチェック
    if ! command -v node >/dev/null 2>&1; then
        log_error "❌ Node.jsがインストールされていません"
        return 1
    fi

    local node_version
    node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    
    if ! version_compare "$node_version" "$required_version"; then
        log_error "❌ Node.js ${required_version}以上が必要です (現在: ${node_version})"
        return 1
    fi

    log_info "✅ Node.js: ${node_version}"

    # npm バージョンチェック
    if ! command -v npm >/dev/null 2>&1; then
        log_error "❌ npmがインストールされていません"
        return 1
    fi

    local npm_version
    npm_version=$(npm --version)
    log_info "✅ npm: ${npm_version}"

    # AWS CLI チェック
    if ! command -v aws >/dev/null 2>&1; then
        log_warn "⚠️  AWS CLIがインストールされていません"
        log_info "📋 AWS CLIをインストールしてください: https://aws.amazon.com/cli/"
    else
        local aws_version
        aws_version=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
        log_info "✅ AWS CLI: ${aws_version}"
    fi

    # TypeScript チェック
    if ! command -v npx >/dev/null 2>&1; then
        log_error "❌ npxが利用できません"
        return 1
    fi

    log_info "✅ 前提条件チェック完了"
    return 0
}

# バージョン比較関数
version_compare() {
    local version1="$1"
    local version2="$2"
    
    # セマンティックバージョニング比較
    local IFS='.'
    local ver1_array=($version1)
    local ver2_array=($version2)
    
    for i in {0..2}; do
        local v1=${ver1_array[i]:-0}
        local v2=${ver2_array[i]:-0}
        
        if [[ $v1 -gt $v2 ]]; then
            return 0
        elif [[ $v1 -lt $v2 ]]; then
            return 1
        fi
    done
    
    return 0
}

# 初期セットアップ
setup_environment() {
    log_info "🔧 環境セットアップ中..."

    # ディレクトリ作成
    mkdir -p "$PROJECT_ROOT/results"
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/temp"

    # 依存関係インストール
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        log_info "📦 依存関係をインストール中..."
        cd "$PROJECT_ROOT"
        npm install
    else
        log_info "✅ 依存関係は既にインストール済みです"
    fi

    # TypeScriptビルド
    log_info "🔨 TypeScriptビルド中..."
    cd "$PROJECT_ROOT"
    npm run build

    log_info "✅ 環境セットアップ完了"
}

# クリーンアップ
cleanup_environment() {
    log_info "🧹 環境クリーンアップ中..."

    cd "$PROJECT_ROOT"
    
    # ビルド成果物削除
    if [[ -d "dist" ]]; then
        rm -rf dist
        log_info "✅ distディレクトリを削除しました"
    fi

    # 一時ファイル削除
    if [[ -d "temp" ]]; then
        rm -rf temp/*
        log_info "✅ 一時ファイルを削除しました"
    fi

    # 古いログファイル削除（7日以上前）
    if [[ -d "logs" ]]; then
        find logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
        log_info "✅ 古いログファイルを削除しました"
    fi

    # node_modules削除（オプション）
    if [[ "${CLEAN_NODE_MODULES:-false}" == "true" ]]; then
        if [[ -d "node_modules" ]]; then
            rm -rf node_modules
            log_info "✅ node_modulesを削除しました"
        fi
    fi

    log_info "✅ クリーンアップ完了"
}

# AWS認証確認
check_aws_credentials() {
    local profile="${AWS_PROFILE:-user01}"
    local region="${AWS_REGION:-ap-northeast-1}"

    log_info "🔐 AWS認証情報を確認中..."
    log_info "   プロファイル: ${profile}"
    log_info "   リージョン: ${region}"

    if command -v aws >/dev/null 2>&1; then
        if aws sts get-caller-identity --profile "$profile" >/dev/null 2>&1; then
            local account_id
            account_id=$(aws sts get-caller-identity --profile "$profile" --query Account --output text 2>/dev/null)
            log_info "✅ AWS認証成功 (アカウント: ${account_id})"
        else
            log_warn "⚠️  AWS認証に失敗しました"
            log_info "📋 以下のコマンドで認証情報を設定してください:"
            log_info "   aws configure --profile ${profile}"
        fi
    else
        log_warn "⚠️  AWS CLIが利用できません"
    fi
}

# テスト実行
run_tests() {
    local command="${1:-all}"
    shift
    local args=("$@")

    log_info "🚀 テスト実行開始: ${command}"
    log_info "📅 実行日時: $(date '+%Y/%m/%d %H:%M:%S')"

    cd "$PROJECT_ROOT"

    # 環境変数設定
    export NODE_ENV="${NODE_ENV:-development}"
    export AWS_REGION="${AWS_REGION:-ap-northeast-1}"
    export AWS_PROFILE="${AWS_PROFILE:-user01}"

    # テスト実行
    local exit_code=0
    case "$command" in
        "all")
            npm run test:all -- "${args[@]}" || exit_code=$?
            ;;
        "ui")
            npm run test:ui -- "${args[@]}" || exit_code=$?
            ;;
        "ai")
            npm run test:ai -- "${args[@]}" || exit_code=$?
            ;;
        "rag")
            npm run test:rag -- "${args[@]}" || exit_code=$?
            ;;
        "security")
            npm run test:security -- "${args[@]}" || exit_code=$?
            ;;
        "nova")
            npm run test:nova -- "${args[@]}" || exit_code=$?
            ;;
        "multiregion")
            npm run test:multiregion -- "${args[@]}" || exit_code=$?
            ;;
        *)
            log_error "❌ 未知のコマンド: ${command}"
            show_help
            return 1
            ;;
    esac

    if [[ $exit_code -eq 0 ]]; then
        log_info "🎉 テスト実行完了: ${command}"
    else
        log_error "❌ テスト実行失敗: ${command} (終了コード: ${exit_code})"
    fi

    return $exit_code
}

# メイン実行関数
main() {
    local command="${1:-all}"
    local args=()

    # 引数解析
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --environment)
                export NODE_ENV="$2"
                args+=("$1" "$2")
                shift 2
                ;;
            --region)
                export AWS_REGION="$2"
                args+=("$1" "$2")
                shift 2
                ;;
            --profile)
                export AWS_PROFILE="$2"
                args+=("$1" "$2")
                shift 2
                ;;
            --verbose)
                export LOG_LEVEL="debug"
                args+=("$1")
                shift
                ;;
            --quiet)
                export LOG_LEVEL="error"
                args+=("$1")
                shift
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done

    # ログディレクトリ作成
    mkdir -p "$(dirname "$LOG_FILE")"

    log_info "🤖 Chatbot UI AI統合テストスイート"
    log_info "📋 コマンド: ${command}"
    log_info "🌍 環境: ${NODE_ENV:-development}"
    log_info "🌏 リージョン: ${AWS_REGION:-ap-northeast-1}"
    log_info "👤 プロファイル: ${AWS_PROFILE:-user01}"
    log_info ""

    # 特別なコマンド処理
    case "$command" in
        "setup")
            check_prerequisites && setup_environment
            return $?
            ;;
        "clean")
            cleanup_environment
            return $?
            ;;
    esac

    # 前提条件チェック
    if ! check_prerequisites; then
        log_error "❌ 前提条件チェックに失敗しました"
        return 1
    fi

    # AWS認証確認
    check_aws_credentials

    # 環境セットアップ（必要に応じて）
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]] || [[ ! -d "$PROJECT_ROOT/dist" ]]; then
        setup_environment
    fi

    # テスト実行
    if run_tests "$command" "${args[@]}"; then
        log_info "✅ 全ての処理が正常に完了しました"
        return 0
    else
        log_error "❌ 処理中にエラーが発生しました"
        return 1
    fi
}

# エラーハンドリング
handle_error() {
    local exit_code=$?
    local line_number=$1
    
    log_error "❌ スクリプト実行中にエラーが発生しました"
    log_error "   行番号: ${line_number}"
    log_error "   終了コード: ${exit_code}"
    log_error "   ログファイル: ${LOG_FILE}"
    
    exit $exit_code
}

# 終了時クリーンアップ
cleanup_on_exit() {
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_info "📄 ログファイル: ${LOG_FILE}"
    else
        log_error "📄 エラーログ: ${LOG_FILE}"
    fi
}

# トラップ設定
trap 'handle_error $LINENO' ERR
trap 'cleanup_on_exit' EXIT
trap 'log_warn "🛑 スクリプトが中断されました"; exit 130' INT TERM

# メイン実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi