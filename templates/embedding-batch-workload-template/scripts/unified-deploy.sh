#!/bin/bash
# 統一デプロイメントスクリプト - CDK & CloudFormation対応

set -euo pipefail

# スクリプトディレクトリの取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定
LOG_FILE="${PROJECT_ROOT}/deployment.log"
CONFIG_DIR="${PROJECT_ROOT}/config"
CLOUDFORMATION_DIR="${PROJECT_ROOT}/cloudformation-templates"
PARAMETERS_DIR="${PROJECT_ROOT}/parameters"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ログ関数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# 使用方法表示
show_usage() {
    cat << EOF
統一デプロイメントスクリプト - CDK & CloudFormation対応

使用方法: $0 [OPTIONS]

OPTIONS:
    -m, --method <cdk|cloudformation>  デプロイメント方式 (必須)
    -e, --env <environment>            環境名 (必須)
    -c, --config <file>                設定ファイルパス
    -s, --stack-name <name>            スタック名 (オプション)
    -r, --region <region>              AWSリージョン
    -p, --profile <profile>            AWSプロファイル
    -d, --dry-run                      ドライラン実行
    -f, --force                        強制実行（確認スキップ）
    -v, --validate                     デプロイ前検証を実行
    -w, --watch                        デプロイ後の監視を開始
    -b, --backup                       デプロイ前バックアップ作成
    -n, --notify <email>               完了通知先メールアドレス
    --rollback-on-failure              失敗時の自動ロールバック
    --timeout <minutes>                タイムアウト時間（分）
    -h, --help                         このヘルプを表示

環境名:
    dev, staging, prod, または任意の環境名

例:
    # CDKでdev環境をデプロイ
    $0 --method cdk --env dev --config config/dev.json

    # CloudFormationでprod環境をデプロイ（検証付き）
    $0 --method cloudformation --env prod --validate --backup

    # ドライラン実行
    $0 --method cdk --env staging --dry-run

    # 監視付きデプロイ
    $0 --method cloudformation --env prod --watch --notify admin@company.com
EOF
}

# 前提条件チェック
check_prerequisites() {
    local method="$1"
    
    log "前提条件をチェック中..."
    
    # 共通チェック
    if ! command -v aws &> /dev/null; then
        error "AWS CLIがインストールされていません"
        return 1
    fi
    
    if ! command -v jq &> /dev/null; then
        error "jqがインストールされていません"
        return 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS認証が設定されていません"
        return 1
    fi
    
    # 方式固有チェック
    case "$method" in
        "cdk")
            if ! command -v node &> /dev/null; then
                error "Node.jsがインストールされていません"
                return 1
            fi
            
            if ! command -v npm &> /dev/null; then
                error "npmがインストールされていません"
                return 1
            fi
            
            if ! npx cdk --version &> /dev/null; then
                error "AWS CDKがインストールされていません"
                return 1
            fi
            ;;
            
        "cloudformation")
            # CloudFormation固有のチェック
            if ! aws cloudformation list-stacks &> /dev/null; then
                error "CloudFormationへのアクセス権限がありません"
                return 1
            fi
            ;;
    esac
    
    success "前提条件チェック完了"
}

# 設定ファイル読み込み
load_configuration() {
    local config_file="$1"
    local environment="$2"
    
    log "設定ファイル読み込み中: $config_file"
    
    if [[ ! -f "$config_file" ]]; then
        error "設定ファイルが見つかりません: $config_file"
        return 1
    fi
    
    # JSON構文チェック
    if ! jq empty "$config_file" 2>/dev/null; then
        error "設定ファイルのJSON構文エラー: $config_file"
        return 1
    fi
    
    # 環境固有設定の確認
    if ! jq -e ".environments.\"$environment\"" "$config_file" &> /dev/null; then
        warning "環境固有設定が見つかりません: $environment"
    fi
    
    success "設定ファイル読み込み完了"
}

# バックアップ作成
create_backup() {
    local stack_name="$1"
    local environment="$2"
    
    log "バックアップ作成中: $stack_name"
    
    local backup_dir="${PROJECT_ROOT}/backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # スタック情報バックアップ
    if aws cloudformation describe-stacks --stack-name "$stack_name" &> /dev/null; then
        aws cloudformation describe-stacks \
            --stack-name "$stack_name" \
            --output json > "$backup_dir/stack-info.json"
        
        aws cloudformation get-template \
            --stack-name "$stack_name" \
            --template-stage Original \
            --output json > "$backup_dir/template.json"
        
        aws cloudformation describe-stack-resources \
            --stack-name "$stack_name" \
            --output json > "$backup_dir/resources.json"
        
        success "バックアップ作成完了: $backup_dir"
        echo "$backup_dir" > "${PROJECT_ROOT}/.last-backup"
    else
        info "既存スタックが見つかりません。新規作成として続行します。"
    fi
}

# CDKデプロイメント
deploy_with_cdk() {
    local environment="$1"
    local config_file="$2"
    local stack_name="$3"
    local dry_run="$4"
    local force="$5"
    
    log "CDKデプロイメント開始: $environment"
    
    # CDKディレクトリに移動
    cd "${PROJECT_ROOT}/cdk"
    
    # 依存関係インストール
    log "依存関係インストール中..."
    npm install
    
    # TypeScriptビルド
    log "TypeScriptビルド中..."
    npm run build
    
    # 環境変数設定
    export CDK_ENVIRONMENT="$environment"
    export CDK_CONFIG_FILE="$config_file"
    
    if [[ "$dry_run" == "true" ]]; then
        log "CDK差分確認中..."
        npx cdk diff "$stack_name"
        return 0
    fi
    
    # CDKブートストラップ（必要に応じて）
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
        log "CDKブートストラップ実行中..."
        npx cdk bootstrap
    fi
    
    # デプロイ実行
    local cdk_args=()
    
    if [[ "$force" == "true" ]]; then
        cdk_args+=(--require-approval never)
    fi
    
    if [[ -n "$stack_name" ]]; then
        cdk_args+=("$stack_name")
    else
        cdk_args+=(--all)
    fi
    
    log "CDKデプロイ実行中..."
    if npx cdk deploy "${cdk_args[@]}"; then
        success "CDKデプロイメント完了"
        return 0
    else
        error "CDKデプロイメントに失敗しました"
        return 1
    fi
}

# CloudFormationデプロイメント
deploy_with_cloudformation() {
    local environment="$1"
    local config_file="$2"
    local stack_name="$3"
    local dry_run="$4"
    local force="$5"
    local rollback_on_failure="$6"
    
    log "CloudFormationデプロイメント開始: $environment"
    
    # テンプレートファイル確認
    local template_file="${CLOUDFORMATION_DIR}/EmbeddingWorkloadStack.template.json"
    if [[ ! -f "$template_file" ]]; then
        error "CloudFormationテンプレートが見つかりません: $template_file"
        return 1
    fi
    
    # パラメータファイル生成
    local param_file="${PARAMETERS_DIR}/parameters-${environment}.json"
    if [[ ! -f "$param_file" ]]; then
        log "パラメータファイル生成中..."
        "${SCRIPT_DIR}/generate-cloudformation-params.sh" \
            --config "$config_file" \
            --env "$environment" \
            --output "$param_file"
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log "CloudFormation変更セット作成中..."
        local change_set_name="dryrun-$(date +%s)"
        
        aws cloudformation create-change-set \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters "file://$param_file" \
            --change-set-name "$change_set_name" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
        
        # 変更セット内容表示
        aws cloudformation describe-change-set \
            --stack-name "$stack_name" \
            --change-set-name "$change_set_name" \
            --query 'Changes[].{Action:Action,LogicalResourceId:ResourceChange.LogicalResourceId,ResourceType:ResourceChange.ResourceType}' \
            --output table
        
        # 変更セット削除
        aws cloudformation delete-change-set \
            --stack-name "$stack_name" \
            --change-set-name "$change_set_name"
        
        return 0
    fi
    
    # デプロイ実行
    local cf_args=(
        --template-file "$template_file"
        --stack-name "$stack_name"
        --parameter-overrides "file://$param_file"
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
    )
    
    if [[ "$rollback_on_failure" == "true" ]]; then
        cf_args+=(--disable-rollback false)
    fi
    
    log "CloudFormationデプロイ実行中..."
    if aws cloudformation deploy "${cf_args[@]}"; then
        success "CloudFormationデプロイメント完了"
        return 0
    else
        error "CloudFormationデプロイメントに失敗しました"
        return 1
    fi
}

# デプロイ後検証
validate_deployment() {
    local stack_name="$1"
    local environment="$2"
    
    log "デプロイメント検証中..."
    
    # スタック状態確認
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$stack_status" == *"COMPLETE"* ]]; then
        success "スタック状態正常: $stack_status"
    else
        error "スタック状態異常: $stack_status"
        return 1
    fi
    
    # 機能テスト実行
    if [[ -f "${SCRIPT_DIR}/validate.sh" ]]; then
        log "機能テスト実行中..."
        if "${SCRIPT_DIR}/validate.sh" --env "$environment" --stack-name "$stack_name"; then
            success "機能テスト完了"
        else
            warning "機能テストで問題が検出されました"
        fi
    fi
    
    return 0
}

# 監視開始
start_monitoring() {
    local stack_name="$1"
    
    log "監視開始: $stack_name"
    
    if [[ -f "${SCRIPT_DIR}/monitor-cloudformation.sh" ]]; then
        info "監視ツールを別プロセスで開始します..."
        nohup "${SCRIPT_DIR}/monitor-cloudformation.sh" \
            --stack "$stack_name" \
            --watch \
            --interval 60 \
            > "${PROJECT_ROOT}/monitoring.log" 2>&1 &
        
        echo $! > "${PROJECT_ROOT}/.monitoring-pid"
        success "監視開始完了 (PID: $!)"
    else
        warning "監視スクリプトが見つかりません"
    fi
}

# 通知送信
send_notification() {
    local email="$1"
    local subject="$2"
    local message="$3"
    
    if [[ -n "$email" ]]; then
        log "通知送信中: $email"
        
        # SESを使用してメール送信
        local email_body
        email_body=$(cat << EOF
{
    "Source": "noreply@company.com",
    "Destination": {
        "ToAddresses": ["$email"]
    },
    "Message": {
        "Subject": {
            "Data": "$subject"
        },
        "Body": {
            "Text": {
                "Data": "$message"
            }
        }
    }
}
EOF
        )
        
        if aws ses send-email --cli-input-json "$email_body" &> /dev/null; then
            success "通知送信完了"
        else
            warning "通知送信に失敗しました（SES設定を確認してください）"
        fi
    fi
}

# メイン処理
main() {
    local method=""
    local environment=""
    local config_file=""
    local stack_name=""
    local region=""
    local profile=""
    local dry_run=false
    local force=false
    local validate=false
    local watch=false
    local backup=false
    local notify_email=""
    local rollback_on_failure=false
    local timeout=60
    
    # パラメータ解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -m|--method)
                method="$2"
                shift 2
                ;;
            -e|--env)
                environment="$2"
                shift 2
                ;;
            -c|--config)
                config_file="$2"
                shift 2
                ;;
            -s|--stack-name)
                stack_name="$2"
                shift 2
                ;;
            -r|--region)
                region="$2"
                shift 2
                ;;
            -p|--profile)
                profile="$2"
                shift 2
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -v|--validate)
                validate=true
                shift
                ;;
            -w|--watch)
                watch=true
                shift
                ;;
            -b|--backup)
                backup=true
                shift
                ;;
            -n|--notify)
                notify_email="$2"
                shift 2
                ;;
            --rollback-on-failure)
                rollback_on_failure=true
                shift
                ;;
            --timeout)
                timeout="$2"
                shift 2
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
    
    # 必須パラメータチェック
    if [[ -z "$method" || -z "$environment" ]]; then
        error "デプロイメント方式と環境名は必須です"
        show_usage
        exit 1
    fi
    
    # 方式チェック
    if [[ "$method" != "cdk" && "$method" != "cloudformation" ]]; then
        error "サポートされていないデプロイメント方式: $method"
        echo "サポート方式: cdk, cloudformation"
        exit 1
    fi
    
    # デフォルト設定
    if [[ -z "$config_file" ]]; then
        config_file="${CONFIG_DIR}/${environment}.json"
    fi
    
    if [[ -z "$stack_name" ]]; then
        stack_name="embedding-batch-${environment}"
    fi
    
    # AWS設定
    if [[ -n "$region" ]]; then
        export AWS_DEFAULT_REGION="$region"
    fi
    
    if [[ -n "$profile" ]]; then
        export AWS_PROFILE="$profile"
    fi
    
    # ログファイル初期化
    > "$LOG_FILE"
    
    log "統一デプロイメント開始"
    log "方式: $method"
    log "環境: $environment"
    log "設定: $config_file"
    log "スタック: $stack_name"
    
    # 前提条件チェック
    if ! check_prerequisites "$method"; then
        exit 1
    fi
    
    # 設定ファイル読み込み
    if ! load_configuration "$config_file" "$environment"; then
        exit 1
    fi
    
    # バックアップ作成
    if [[ "$backup" == "true" ]]; then
        create_backup "$stack_name" "$environment"
    fi
    
    # デプロイ前検証
    if [[ "$validate" == "true" ]]; then
        log "デプロイ前検証実行中..."
        case "$method" in
            "cdk")
                cd "${PROJECT_ROOT}/cdk"
                npm run test
                ;;
            "cloudformation")
                "${SCRIPT_DIR}/validate-cloudformation.sh" \
                    --environment "$environment" \
                    --lint --security
                ;;
        esac
    fi
    
    # 確認プロンプト
    if [[ "$force" != "true" && "$dry_run" != "true" ]]; then
        echo ""
        echo -e "${YELLOW}デプロイメント設定確認:${NC}"
        echo -e "  方式: ${CYAN}$method${NC}"
        echo -e "  環境: ${CYAN}$environment${NC}"
        echo -e "  スタック: ${CYAN}$stack_name${NC}"
        echo -e "  設定: ${CYAN}$config_file${NC}"
        echo ""
        read -p "デプロイメントを実行しますか？ (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "デプロイメントがキャンセルされました"
            exit 0
        fi
    fi
    
    # デプロイメント実行
    local deploy_success=false
    local start_time=$(date +%s)
    
    case "$method" in
        "cdk")
            if deploy_with_cdk "$environment" "$config_file" "$stack_name" "$dry_run" "$force"; then
                deploy_success=true
            fi
            ;;
        "cloudformation")
            if deploy_with_cloudformation "$environment" "$config_file" "$stack_name" "$dry_run" "$force" "$rollback_on_failure"; then
                deploy_success=true
            fi
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$deploy_success" == "true" && "$dry_run" != "true" ]]; then
        success "デプロイメント成功 (所要時間: ${duration}秒)"
        
        # デプロイ後検証
        if ! validate_deployment "$stack_name" "$environment"; then
            warning "デプロイ後検証で問題が検出されました"
        fi
        
        # 監視開始
        if [[ "$watch" == "true" ]]; then
            start_monitoring "$stack_name"
        fi
        
        # 通知送信
        if [[ -n "$notify_email" ]]; then
            send_notification "$notify_email" \
                "デプロイメント完了: $stack_name" \
                "環境 $environment のデプロイメントが正常に完了しました。\n\n方式: $method\nスタック: $stack_name\n所要時間: ${duration}秒"
        fi
        
    elif [[ "$dry_run" == "true" ]]; then
        success "ドライラン完了"
    else
        error "デプロイメントに失敗しました"
        
        # 失敗通知
        if [[ -n "$notify_email" ]]; then
            send_notification "$notify_email" \
                "デプロイメント失敗: $stack_name" \
                "環境 $environment のデプロイメントに失敗しました。\n\nログファイル: $LOG_FILE"
        fi
        
        exit 1
    fi
    
    log "統一デプロイメント完了"
    log "ログファイル: $LOG_FILE"
}

# スクリプト実行
main "$@"