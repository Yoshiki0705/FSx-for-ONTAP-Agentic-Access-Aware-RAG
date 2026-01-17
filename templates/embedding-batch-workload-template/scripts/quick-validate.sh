#!/bin/bash

# Quick Real Data Validation Script
# 実データ検証のクイックスタート用スクリプト

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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
使用方法: $0 [オプション]

このスクリプトは実データ検証を簡単に実行するためのクイックスタートツールです。

オプション:
  -h, --help              このヘルプを表示
  -s, --stack-name NAME   CloudFormationスタック名を指定
  -f, --full              完全な検証を実行（デフォルトは簡易版）
  -q, --quick             クイック検証のみ（アップロードとテストのみ）
  -a, --analysis-only     品質分析のみ実行
  -v, --verbose           詳細ログを有効化

実行例:
  $0                      # 簡易検証を実行
  $0 --full               # 完全検証を実行
  $0 --quick              # クイック検証のみ
  $0 --analysis-only      # 品質分析のみ

EOF
}

# デフォルト値
STACK_NAME=""
FULL_VALIDATION=false
QUICK_ONLY=false
ANALYSIS_ONLY=false
VERBOSE=false

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
        -f|--full)
            FULL_VALIDATION=true
            shift
            ;;
        -q|--quick)
            QUICK_ONLY=true
            shift
            ;;
        -a|--analysis-only)
            ANALYSIS_ONLY=true
            shift
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

log_info "=== 実データ検証クイックスタート ==="

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    local missing_tools=()
    
    # 必要なツールのチェック
    if ! command -v aws &> /dev/null; then
        missing_tools+=("aws")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if ! command -v python3 &> /dev/null; then
        missing_tools+=("python3")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "以下のツールがインストールされていません: ${missing_tools[*]}"
        log_info "インストール方法:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                aws)
                    log_info "  AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
                    ;;
                jq)
                    log_info "  jq: brew install jq (macOS) または apt-get install jq (Ubuntu)"
                    ;;
                python3)
                    log_info "  Python 3: https://www.python.org/downloads/"
                    ;;
            esac
        done
        exit 1
    fi
    
    # AWS認証情報チェック
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証情報が設定されていません"
        log_info "aws configure を実行して認証情報を設定してください"
        exit 1
    fi
    
    log_info "前提条件チェック完了"
}

# Pythonライブラリのインストール
install_python_dependencies() {
    log_info "Python依存関係をチェック中..."
    
    local requirements_file="$SCRIPT_DIR/requirements-analysis.txt"
    
    if [[ -f "$requirements_file" ]]; then
        # 仮想環境の作成（オプション）
        if [[ ! -d "$PROJECT_ROOT/venv" ]]; then
            log_info "Python仮想環境を作成中..."
            python3 -m venv "$PROJECT_ROOT/venv"
        fi
        
        # 仮想環境のアクティベート
        source "$PROJECT_ROOT/venv/bin/activate"
        
        # 依存関係のインストール
        log_info "Python依存関係をインストール中..."
        pip install -q -r "$requirements_file"
        
        log_info "Python依存関係のインストール完了"
    else
        log_warn "requirements-analysis.txt が見つかりません。手動でライブラリをインストールしてください。"
    fi
}

# スタック情報の自動検出
detect_stack() {
    if [[ -z "$STACK_NAME" ]]; then
        log_info "RAG/Embeddingスタックを自動検出中..."
        
        local stacks
        
        # パターン1: embedding を含むスタック
        stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `embedding`) == `true`].StackName' --output text)
        
        # パターン2: permission-aware-rag を含むスタック
        if [[ -z "$stacks" ]]; then
            stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `permission-aware-rag`) == `true`].StackName' --output text)
        fi
        
        # パターン3: rag を含むスタック
        if [[ -z "$stacks" ]]; then
            stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `rag`) == `true`].StackName' --output text)
        fi
        
        if [[ -z "$stacks" ]]; then
            log_error "RAG/Embeddingスタックが見つかりません"
            log_info "手動でスタック名を指定してください: $0 --stack-name YOUR_STACK_NAME"
            log_info "利用可能なスタック:"
            aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[].StackName' --output table
            exit 1
        fi
        
        STACK_NAME=$(echo "$stacks" | head -1)
        log_info "検出されたスタック: $STACK_NAME"
    fi
}

# クイック検証の実行
run_quick_validation() {
    log_info "クイック検証を実行中..."
    
    local args=()
    
    if [[ -n "$STACK_NAME" ]]; then
        args+=("--stack-name" "$STACK_NAME")
    fi
    
    if $VERBOSE; then
        args+=("--verbose")
    fi
    
    # データアップロードと基本的な検索テストのみ
    args+=("--skip-processing" "--skip-embedding")
    
    "$SCRIPT_DIR/validate-real-data-workflow.sh" "${args[@]}"
}

# 完全検証の実行
run_full_validation() {
    log_info "完全検証を実行中..."
    
    local args=()
    
    if [[ -n "$STACK_NAME" ]]; then
        args+=("--stack-name" "$STACK_NAME")
    fi
    
    if $VERBOSE; then
        args+=("--verbose")
    fi
    
    "$SCRIPT_DIR/validate-real-data-workflow.sh" "${args[@]}"
}

# 簡易検証の実行
run_simple_validation() {
    log_info "簡易検証を実行中..."
    
    local args=()
    
    if [[ -n "$STACK_NAME" ]]; then
        args+=("--stack-name" "$STACK_NAME")
    fi
    
    if $VERBOSE; then
        args+=("--verbose")
    fi
    
    # エンベディング生成をスキップ（処理時間短縮）
    args+=("--skip-embedding")
    
    "$SCRIPT_DIR/validate-real-data-workflow.sh" "${args[@]}"
}

# 品質分析の実行
run_analysis_only() {
    log_info "エンベディング品質分析を実行中..."
    
    # スタック情報を取得してS3バケットとOpenSearchエンドポイントを特定
    local stack_outputs
    stack_outputs=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output json)
    
    local s3_bucket
    s3_bucket=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="S3BucketName") | .OutputValue // empty')
    
    local opensearch_endpoint
    opensearch_endpoint=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="OpenSearchEndpoint") | .OutputValue // empty')
    
    if [[ -z "$s3_bucket" ]]; then
        log_error "S3バケット名が取得できません"
        exit 1
    fi
    
    if [[ -z "$opensearch_endpoint" ]]; then
        log_warn "OpenSearchエンドポイントが取得できません。検索テストはスキップされます。"
        opensearch_endpoint="https://dummy-endpoint"
    fi
    
    # 最新のエンベディングプレフィックスを検索
    local embedding_prefix
    embedding_prefix=$(aws s3 ls "s3://$s3_bucket/embeddings/" | tail -1 | awk '{print $2}' | sed 's|/$||')
    
    if [[ -z "$embedding_prefix" ]]; then
        log_error "エンベディングデータが見つかりません"
        log_info "先に実データ検証を実行してください: $0 --full"
        exit 1
    fi
    
    embedding_prefix="embeddings/$embedding_prefix"
    
    # 分析実行
    local analysis_args=(
        "--opensearch-endpoint" "$opensearch_endpoint"
        "--s3-bucket" "$s3_bucket"
        "--embedding-prefix" "$embedding_prefix"
        "--output-dir" "$PROJECT_ROOT/analysis-results"
    )
    
    # クエリファイルが存在する場合は追加
    local queries_file="$PROJECT_ROOT/test-data/queries.json"
    if [[ -f "$queries_file" ]]; then
        analysis_args+=("--queries-file" "$queries_file")
    fi
    
    if $VERBOSE; then
        analysis_args+=("--verbose")
    fi
    
    # 仮想環境をアクティベート（存在する場合）
    if [[ -f "$PROJECT_ROOT/venv/bin/activate" ]]; then
        source "$PROJECT_ROOT/venv/bin/activate"
    fi
    
    python3 "$SCRIPT_DIR/analyze-embedding-quality.py" "${analysis_args[@]}"
}

# 結果の表示
show_results() {
    log_info "=== 検証結果 ==="
    
    # ログファイルの場所を表示
    local log_dir="$PROJECT_ROOT/cdk/test/logs"
    if [[ -d "$log_dir" ]]; then
        local latest_log
        latest_log=$(find "$log_dir" -name "real-data-validation-*.log" -type f | sort | tail -1)
        
        if [[ -n "$latest_log" ]]; then
            log_info "詳細ログ: $latest_log"
        fi
        
        # レポートファイルの確認
        local latest_report
        latest_report=$(find "$log_dir" -name "real-data-validation-report-*.md" -type f | sort | tail -1)
        
        if [[ -n "$latest_report" ]]; then
            log_info "検証レポート: $latest_report"
            
            if $VERBOSE; then
                echo ""
                echo "=== 検証レポート概要 ==="
                head -20 "$latest_report"
                echo "..."
                echo "完全なレポートは上記ファイルを参照してください。"
            fi
        fi
    fi
    
    # 分析結果の確認
    local analysis_dir="$PROJECT_ROOT/analysis-results"
    if [[ -d "$analysis_dir" ]]; then
        local latest_analysis
        latest_analysis=$(find "$analysis_dir" -name "embedding_quality_analysis_*.json" -type f | sort | tail -1)
        
        if [[ -n "$latest_analysis" ]]; then
            log_info "品質分析結果: $latest_analysis"
            
            # 可視化レポートの確認
            local latest_plot
            latest_plot=$(find "$analysis_dir" -name "embedding_analysis_*.png" -type f | sort | tail -1)
            
            if [[ -n "$latest_plot" ]]; then
                log_info "可視化レポート: $latest_plot"
            fi
        fi
    fi
}

# メイン実行フロー
main() {
    local exit_code=0
    
    # 前処理
    check_prerequisites
    
    if ! $ANALYSIS_ONLY; then
        install_python_dependencies
    fi
    
    detect_stack
    
    # 検証実行
    if $ANALYSIS_ONLY; then
        run_analysis_only || exit_code=$?
    elif $QUICK_ONLY; then
        run_quick_validation || exit_code=$?
    elif $FULL_VALIDATION; then
        run_full_validation || exit_code=$?
    else
        run_simple_validation || exit_code=$?
    fi
    
    # 結果表示
    show_results
    
    if [[ $exit_code -eq 0 ]]; then
        log_info "=== 実データ検証完了 (成功) ==="
        log_info "次のステップ:"
        log_info "  1. 検証レポートを確認"
        log_info "  2. 品質分析結果を確認"
        log_info "  3. 必要に応じて設定を調整"
    else
        log_error "=== 実データ検証完了 (失敗) ==="
        log_info "トラブルシューティング:"
        log_info "  1. ログファイルを確認"
        log_info "  2. AWS権限を確認"
        log_info "  3. --verbose オプションで詳細ログを確認"
    fi
    
    exit $exit_code
}

# エラーハンドリング
trap 'log_error "スクリプトが予期せず終了しました"; exit 1' ERR

# メイン実行
main "$@"