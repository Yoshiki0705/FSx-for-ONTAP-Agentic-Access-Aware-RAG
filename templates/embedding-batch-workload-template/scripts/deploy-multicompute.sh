#!/bin/bash

# マルチコンピュート統合デプロイスクリプト
# AWS Batch、Spot Fleet、ECS on EC2の統合デプロイを行います

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_DIR="$PROJECT_ROOT/cdk"
LOG_FILE="$PROJECT_ROOT/logs/multicompute-deploy-$(date +%Y%m%d-%H%M%S).log"

# ログディレクトリの作成
mkdir -p "$(dirname "$LOG_FILE")"

# ログ関数
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $*"
    echo "$message" | tee -a "$LOG_FILE"
}

error() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: $*"
    echo "$message" | tee -a "$LOG_FILE" >&2
}

success() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ✅ SUCCESS: $*"
    echo "$message" | tee -a "$LOG_FILE"
}

warning() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  WARNING: $*"
    echo "$message" | tee -a "$LOG_FILE"
}

debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        local message="[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 DEBUG: $*"
        echo "$message" | tee -a "$LOG_FILE"
    fi
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

マルチコンピュート統合デプロイを実行します。

オプション:
  -c, --config CONFIG_FILE      設定ファイルパス
  -t, --compute-type TYPE       コンピュートタイプ (batch|spot-fleet|ecs|all)
  -e, --environment ENV         環境 (dev|test|staging|prod)
  -r, --region REGION           AWSリージョン
  -p, --profile PROFILE         AWSプロファイル
  -d, --dry-run                 ドライラン（実際のデプロイは行わない）
  -f, --force                   強制デプロイ（確認をスキップ）
  -v, --verbose                 詳細ログを出力
  -h, --help                    このヘルプを表示

例:
  $0 --config examples/nova-multimodal-config.json --compute-type all
  $0 --config config/production.json --compute-type spot-fleet --environment prod
  $0 --compute-type ecs --region us-east-1 --dry-run

EOF
}

# デフォルト設定
CONFIG_FILE=""
COMPUTE_TYPE="batch"
ENVIRONMENT="dev"
REGION="us-east-1"
PROFILE=""
DRY_RUN=false
FORCE=false
VERBOSE=false

# 入力値検証関数
validate_inputs() {
    # コンピュートタイプの検証
    local valid_compute_types=("batch" "spot-fleet" "ecs" "all")
    if [[ ! " ${valid_compute_types[*]} " =~ " ${COMPUTE_TYPE} " ]]; then
        error "無効なコンピュートタイプ: $COMPUTE_TYPE"
        error "有効な値: ${valid_compute_types[*]}"
        exit 1
    fi
    
    # 環境名の検証
    local valid_environments=("dev" "test" "staging" "prod")
    if [[ ! " ${valid_environments[*]} " =~ " ${ENVIRONMENT} " ]]; then
        error "無効な環境名: $ENVIRONMENT"
        error "有効な値: ${valid_environments[*]}"
        exit 1
    fi
    
    # リージョン名の検証
    if [[ ! "$REGION" =~ ^[a-z]{2}-[a-z]+-[0-9]$ ]]; then
        error "無効なAWSリージョン形式: $REGION"
        exit 1
    fi
    
    # 設定ファイルの検証
    if [[ -n "$CONFIG_FILE" ]]; then
        # パストラバーサル攻撃対策
        local normalized_path
        normalized_path=$(realpath "$CONFIG_FILE" 2>/dev/null || echo "$CONFIG_FILE")
        if [[ "$normalized_path" != "$CONFIG_FILE" ]] && [[ "$CONFIG_FILE" =~ \.\. ]]; then
            error "無効なファイルパス: $CONFIG_FILE"
            exit 1
        fi
        
        if [[ ! -f "$CONFIG_FILE" ]]; then
            error "設定ファイルが見つかりません: $CONFIG_FILE"
            exit 1
        fi
        
        # JSON形式の検証
        if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
            error "無効なJSON形式: $CONFIG_FILE"
            exit 1
        fi
    fi
    
    # AWSプロファイルの検証
    if [[ -n "$PROFILE" ]]; then
        if [[ ! "$PROFILE" =~ ^[a-zA-Z0-9_-]+$ ]]; then
            error "無効なAWSプロファイル名: $PROFILE"
            exit 1
        fi
    fi
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            if [[ -z "${2:-}" ]]; then
                error "--config オプションには値が必要です"
                exit 1
            fi
            CONFIG_FILE="$2"
            shift 2
            ;;
        -t|--compute-type)
            if [[ -z "${2:-}" ]]; then
                error "--compute-type オプションには値が必要です"
                exit 1
            fi
            COMPUTE_TYPE="$2"
            shift 2
            ;;
        -e|--environment)
            if [[ -z "${2:-}" ]]; then
                error "--environment オプションには値が必要です"
                exit 1
            fi
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            if [[ -z "${2:-}" ]]; then
                error "--region オプションには値が必要です"
                exit 1
            fi
            REGION="$2"
            shift 2
            ;;
        -p|--profile)
            if [[ -z "${2:-}" ]]; then
                error "--profile オプションには値が必要です"
                exit 1
            fi
            PROFILE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 設定ファイルの処理
process_config_file() {
    if [[ -n "$CONFIG_FILE" ]]; then
        log "設定ファイルを処理中: $CONFIG_FILE"
        
        # 設定ファイルから値を読み込み（存在する場合のみ上書き）
        if command -v jq >/dev/null 2>&1; then
            local config_compute_type
            config_compute_type=$(jq -r '.computeType // empty' "$CONFIG_FILE" 2>/dev/null)
            if [[ -n "$config_compute_type" && "$COMPUTE_TYPE" == "batch" ]]; then
                COMPUTE_TYPE="$config_compute_type"
                debug "設定ファイルからコンピュートタイプを読み込み: $COMPUTE_TYPE"
            fi
            
            local config_environment
            config_environment=$(jq -r '.environment // empty' "$CONFIG_FILE" 2>/dev/null)
            if [[ -n "$config_environment" && "$ENVIRONMENT" == "dev" ]]; then
                ENVIRONMENT="$config_environment"
                debug "設定ファイルから環境を読み込み: $ENVIRONMENT"
            fi
            
            local config_region
            config_region=$(jq -r '.region // empty' "$CONFIG_FILE" 2>/dev/null)
            if [[ -n "$config_region" && "$REGION" == "us-east-1" ]]; then
                REGION="$config_region"
                debug "設定ファイルからリージョンを読み込み: $REGION"
            fi
        else
            warning "jqコマンドが見つかりません。設定ファイルの解析をスキップします"
        fi
    fi
}

log "マルチコンピュート統合デプロイ開始"
log "コンピュートタイプ: $COMPUTE_TYPE"
log "環境: $ENVIRONMENT"
log "リージョン: $REGION"
if [[ -n "$CONFIG_FILE" ]]; then
    log "設定ファイル: $CONFIG_FILE"
fi
if [[ -n "$PROFILE" ]]; then
    log "AWSプロファイル: $PROFILE"
fi
if [[ "$DRY_RUN" == "true" ]]; then
    log "モード: ドライラン"
fi

# 前提条件の確認
check_prerequisites() {
    log "前提条件の確認中..."
    
    # 必要なコマンドの確認
    local required_commands=("aws" "cdk" "npm" "node" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "必要なコマンドがインストールされていません: $cmd"
            exit 1
        fi
    done
    
    # Node.jsバージョン確認
    local node_version
    node_version=$(node --version | sed 's/v//')
    local major_version
    major_version=$(echo "$node_version" | cut -d. -f1)
    
    if [[ $major_version -lt 18 ]]; then
        error "Node.js 18以上が必要です。現在のバージョン: $node_version"
        exit 1
    fi
    
    # CDKディレクトリの確認
    if [[ ! -d "$CDK_DIR" ]]; then
        error "CDKディレクトリが見つかりません: $CDK_DIR"
        exit 1
    fi
    
    if [[ ! -f "$CDK_DIR/package.json" ]]; then
        error "CDK package.jsonが見つかりません: $CDK_DIR/package.json"
        exit 1
    fi
    
    success "前提条件の確認完了"
}

# AWS認証の確認
check_aws_authentication() {
    log "AWS認証の確認中..."
    
    local aws_cmd="aws"
    if [[ -n "$PROFILE" ]]; then
        aws_cmd="aws --profile $PROFILE"
    fi
    
    # AWS認証確認
    if ! $aws_cmd sts get-caller-identity --region "$REGION" &> /dev/null; then
        error "AWS認証が設定されていません"
        if [[ -n "$PROFILE" ]]; then
            error "プロファイル: $PROFILE"
        fi
        error "リージョン: $REGION"
        exit 1
    fi
    
    # アカウント情報の取得
    local account_id
    account_id=$($aws_cmd sts get-caller-identity --query Account --output text --region "$REGION")
    local user_arn
    user_arn=$($aws_cmd sts get-caller-identity --query Arn --output text --region "$REGION")
    
    log "AWS認証確認完了"
    log "アカウントID: $account_id"
    log "ユーザーARN: $user_arn"
    log "リージョン: $REGION"
    
    success "AWS認証の確認完了"
}

# CDKデプロイの実行
execute_cdk_deploy() {
    log "CDKデプロイ実行中..."
    
    # CDKディレクトリに移動
    if ! cd "$CDK_DIR"; then
        error "CDKディレクトリに移動できません: $CDK_DIR"
        exit 1
    fi
    
    # 依存関係のインストール
    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
        log "npm依存関係をインストール中..."
        if ! npm install --silent; then
            error "npm installが失敗しました"
            exit 1
        fi
    fi
    
    # TypeScriptコンパイル
    log "TypeScriptコンパイル中..."
    if ! npm run build; then
        error "TypeScriptコンパイルが失敗しました"
        exit 1
    fi
    
    # CDKコンテキスト設定
    local cdk_context=""
    if [[ -n "$CONFIG_FILE" ]]; then
        cdk_context="--context configFile=$CONFIG_FILE"
    fi
    cdk_context="$cdk_context --context computeType=$COMPUTE_TYPE"
    cdk_context="$cdk_context --context environment=$ENVIRONMENT"
    cdk_context="$cdk_context --context region=$REGION"
    
    # AWSプロファイル設定
    local aws_profile_env=""
    if [[ -n "$PROFILE" ]]; then
        aws_profile_env="AWS_PROFILE=$PROFILE"
    fi
    
    # CDKデプロイ実行
    if [[ "$DRY_RUN" == "false" ]]; then
        log "CDKデプロイ実行中..."
        log "コンテキスト: $cdk_context"
        
        # 確認プロンプト（強制モードでない場合）
        if [[ "$FORCE" == "false" ]]; then
            echo ""
            echo "⚠️  以下の設定でデプロイを実行します："
            echo "   コンピュートタイプ: $COMPUTE_TYPE"
            echo "   環境: $ENVIRONMENT"
            echo "   リージョン: $REGION"
            if [[ -n "$CONFIG_FILE" ]]; then
                echo "   設定ファイル: $CONFIG_FILE"
            fi
            if [[ -n "$PROFILE" ]]; then
                echo "   AWSプロファイル: $PROFILE"
            fi
            echo ""
            read -p "続行しますか？ (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "デプロイをキャンセルしました"
                exit 0
            fi
        fi
        
        # CDKブートストラップ確認
        log "CDKブートストラップ状態を確認中..."
        if ! eval "$aws_profile_env cdk bootstrap --region $REGION" 2>/dev/null; then
            log "CDKブートストラップを実行中..."
            if ! eval "$aws_profile_env cdk bootstrap --region $REGION"; then
                error "CDKブートストラップが失敗しました"
                exit 1
            fi
        fi
        
        # CDKデプロイ実行
        log "CDKデプロイを実行中..."
        if eval "$aws_profile_env cdk deploy --all --require-approval never $cdk_context"; then
            success "CDKデプロイ完了"
            
            # デプロイ結果の確認
            log "デプロイ結果を確認中..."
            if eval "$aws_profile_env cdk list --region $REGION" | grep -q "embedding-workload"; then
                success "スタックが正常にデプロイされました"
            else
                log "⚠️  スタック状態の確認ができませんでした"
            fi
        else
            error "CDKデプロイが失敗しました"
            exit 1
        fi
    else
        log "[DRY-RUN] CDKデプロイをスキップ"
        log "[DRY-RUN] 実行予定コマンド: $aws_profile_env cdk deploy --all --require-approval never $cdk_context"
    fi
}

# クリーンアップ処理
cleanup() {
    local exit_code=$?
    log "クリーンアップ実行中..."
    
    # 機密変数のクリア
    unset CONFIG_FILE COMPUTE_TYPE ENVIRONMENT REGION PROFILE
    unset DRY_RUN FORCE VERBOSE
    
    # 一時ファイルの削除
    rm -f /tmp/multicompute-deploy-* 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
        log "ログファイル: $LOG_FILE"
    fi
    
    exit $exit_code
}

# シグナルハンドラの設定
trap cleanup EXIT INT TERM

# メイン処理
main() {
    local start_time=$(date +%s)
    
    # 設定ファイル処理
    process_config_file
    
    # 入力値検証
    validate_inputs
    
    # 前提条件確認
    check_prerequisites
    
    # AWS認証確認
    check_aws_authentication
    
    # デプロイ実行
    execute_cdk_deploy
    
    # 実行時間計算
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    success "マルチコンピュート統合デプロイ完了 (実行時間: ${duration}秒)"
    log "ログファイル: $LOG_FILE"
}

# メイン処理の実行
main "$@"