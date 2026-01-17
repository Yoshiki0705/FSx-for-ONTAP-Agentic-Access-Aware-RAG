#!/bin/bash

# Windows AD FSxN統合環境デプロイメントスクリプト
# 使用方法: ./deploy-stack.sh [環境名] [リージョン] [プロファイル]

set -euo pipefail

# スクリプト設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="windows-ad-fsxn"

# 色付きログ出力関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# 使用方法表示
show_usage() {
    cat << EOF
使用方法: $0 [環境名] [リージョン] [AWSプロファイル]

引数:
  環境名        : dev, staging, prod のいずれか (デフォルト: dev)
  リージョン    : AWS リージョン (デフォルト: ap-northeast-1)
  AWSプロファイル: AWS CLI プロファイル名 (デフォルト: default)

例:
  $0 dev ap-northeast-1 user01
  $0 prod ap-northeast-1 production
  $0 staging us-east-1 staging-profile

前提条件:
  - AWS CLI がインストール・設定済み
  - 適切な IAM 権限を持つプロファイル
  - EC2 キーペアが作成済み
  - FSx for ONTAP ファイルシステムが作成済み
EOF
}

# 入力値サニタイゼーション
sanitize_input() {
    local input="$1"
    # パストラバーサル攻撃防止
    echo "$input" | sed 's/[\.\/]//g' | tr -cd '[:alnum:]-_'
}

# パラメータ検証
validate_parameters() {
    local env="$1"
    local region="$2"
    local profile="$3"
    
    # 入力値サニタイゼーション
    env=$(sanitize_input "$env")
    region=$(sanitize_input "$region")
    profile=$(sanitize_input "$profile")
    
    # 環境名検証
    if [[ ! "$env" =~ ^(dev|staging|prod)$ ]]; then
        log_error "無効な環境名: $env (dev, staging, prod のいずれかを指定してください)"
        return 1
    fi
    
    # リージョン検証
    if ! aws ec2 describe-regions --region-names "$region" --profile "$profile" >/dev/null 2>&1; then
        log_error "無効なリージョン: $region"
        return 1
    fi
    
    # プロファイル検証
    if ! aws sts get-caller-identity --profile "$profile" >/dev/null 2>&1; then
        log_error "無効なAWSプロファイル: $profile"
        return 1
    fi
    
    log_info "パラメータ検証完了: 環境=$env, リージョン=$region, プロファイル=$profile"
}

# CloudFormationテンプレート検証
validate_template() {
    local template_file="$1"
    local profile="$2"
    
    log_info "CloudFormationテンプレート検証中: $template_file"
    
    if ! aws cloudformation validate-template \
        --template-body "file://$template_file" \
        --profile "$profile" >/dev/null 2>&1; then
        log_error "テンプレート検証失敗: $template_file"
        return 1
    fi
    
    log_info "テンプレート検証成功: $template_file"
}

# S3バケット作成・確認
ensure_s3_bucket() {
    local bucket_name="$1"
    local region="$2"
    local profile="$3"
    
    log_info "S3バケット確認中: $bucket_name"
    
    if aws s3api head-bucket --bucket "$bucket_name" --profile "$profile" 2>/dev/null; then
        log_info "S3バケット存在確認: $bucket_name"
    else
        log_info "S3バケット作成中: $bucket_name"
        
        if [[ "$region" == "us-east-1" ]]; then
            aws s3api create-bucket \
                --bucket "$bucket_name" \
                --profile "$profile"
        else
            aws s3api create-bucket \
                --bucket "$bucket_name" \
                --region "$region" \
                --create-bucket-configuration LocationConstraint="$region" \
                --profile "$profile"
        fi
        
        # バケットのバージョニング有効化
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled \
            --profile "$profile"
        
        # パブリックアクセスブロック設定
        aws s3api put-public-access-block \
            --bucket "$bucket_name" \
            --public-access-block-configuration \
                BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
            --profile "$profile"
        
        log_info "S3バケット作成完了: $bucket_name"
    fi
}

# ネストされたテンプレートのアップロード
upload_nested_templates() {
    local bucket_name="$1"
    local profile="$2"
    
    log_info "ネストされたテンプレートをS3にアップロード中..."
    
    local nested_dir="$TEMPLATE_DIR/nested-stacks"
    
    if [[ -d "$nested_dir" ]]; then
        aws s3 sync "$nested_dir" "s3://$bucket_name/nested-stacks/" \
            --profile "$profile" \
            --delete
        log_info "ネストされたテンプレートアップロード完了"
    else
        log_warn "ネストされたテンプレートディレクトリが見つかりません: $nested_dir"
    fi
}

# CloudFormationスタックデプロイ
deploy_stack() {
    local stack_name="$1"
    local template_file="$2"
    local parameters_file="$3"
    local region="$4"
    local profile="$5"
    
    log_info "CloudFormationスタックデプロイ開始: $stack_name"
    
    # スタック存在確認
    if aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" >/dev/null 2>&1; then
        
        log_info "既存スタック更新中: $stack_name"
        
        aws cloudformation update-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters "file://$parameters_file" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
            --region "$region" \
            --profile "$profile" \
            --tags \
                Key=Project,Value="$PROJECT_NAME" \
                Key=Environment,Value="$(basename "$parameters_file" | cut -d'-' -f1)" \
                Key=DeployedBy,Value="$(whoami)" \
                Key=DeployedAt,Value="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        
        log_info "スタック更新完了待機中..."
        aws cloudformation wait stack-update-complete \
            --stack-name "$stack_name" \
            --region "$region" \
            --profile "$profile"
    else
        log_info "新規スタック作成中: $stack_name"
        
        aws cloudformation create-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters "file://$parameters_file" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
            --region "$region" \
            --profile "$profile" \
            --enable-termination-protection \
            --tags \
                Key=Project,Value="$PROJECT_NAME" \
                Key=Environment,Value="$(basename "$parameters_file" | cut -d'-' -f1)" \
                Key=DeployedBy,Value="$(whoami)" \
                Key=DeployedAt,Value="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        
        log_info "スタック作成完了待機中..."
        aws cloudformation wait stack-create-complete \
            --stack-name "$stack_name" \
            --region "$region" \
            --profile "$profile"
    fi
    
    log_info "CloudFormationスタックデプロイ完了: $stack_name"
}

# スタック出力値表示
show_stack_outputs() {
    local stack_name="$1"
    local region="$2"
    local profile="$3"
    
    log_info "スタック出力値:"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" \
        --query 'Stacks[0].Outputs[?OutputKey==`WindowsADPrivateIP` || OutputKey==`DomainName` || OutputKey==`RDPConnectionCommand`].[OutputKey,OutputValue,Description]' \
        --output table
}

# 設定の外部化
load_config() {
    local config_file="${SCRIPT_DIR}/../config/deploy-config.env"
    
    if [[ -f "$config_file" ]]; then
        # shellcheck source=/dev/null
        source "$config_file"
        log_info "設定ファイルを読み込みました: $config_file"
    fi
}

# デプロイ前チェック
pre_deployment_checks() {
    local region="$1"
    local profile="$2"
    
    log_info "デプロイ前チェックを実行中..."
    
    # AWS CLI バージョン確認
    local aws_version
    aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    log_info "AWS CLI バージョン: $aws_version"
    
    # 必要な権限確認
    if ! aws iam get-user --profile "$profile" >/dev/null 2>&1; then
        log_warn "IAM ユーザー情報を取得できません。ロールベースの認証を使用している可能性があります"
    fi
    
    # リージョンのサービス可用性確認
    if ! aws ec2 describe-availability-zones --region "$region" --profile "$profile" >/dev/null 2>&1; then
        log_error "指定されたリージョンでEC2サービスが利用できません: $region"
        return 1
    fi
    
    log_info "デプロイ前チェック完了"
}

# メイン処理
main() {
    # 設定読み込み
    load_config
    
    # 引数処理
    local environment="${1:-${DEFAULT_ENVIRONMENT:-dev}}"
    local region="${2:-${DEFAULT_REGION:-ap-northeast-1}}"
    local profile="${3:-${DEFAULT_PROFILE:-default}}"
    
    # ヘルプ表示
    if [[ "$environment" == "-h" || "$environment" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "Windows AD FSxN統合環境デプロイメント開始"
    log_info "環境: $environment, リージョン: $region, プロファイル: $profile"
    
    # パラメータ検証
    validate_parameters "$environment" "$region" "$profile"
    
    # デプロイ前チェック
    pre_deployment_checks "$region" "$profile"
    
    # ファイルパス設定
    local template_file="$TEMPLATE_DIR/windows-ad-fsxn-environment.yaml"
    local parameters_file="$TEMPLATE_DIR/parameters/${environment}-environment-parameters.json"
    local stack_name="${PROJECT_NAME}-${environment}"
    local bucket_name="${PROJECT_NAME}-${environment}-cfn-templates"
    
    # ファイル存在確認とセキュリティ検証
    if [[ ! -f "$template_file" ]]; then
        log_error "テンプレートファイルが見つかりません: $template_file"
        exit 1
    fi
    
    # ファイルパーミッション確認（セキュリティ）
    if [[ $(stat -c %a "$template_file" 2>/dev/null || stat -f %A "$template_file") -gt 644 ]]; then
        log_warn "テンプレートファイルの権限が過度に開放されています: $template_file"
        chmod 644 "$template_file"
    fi
    
    if [[ ! -f "$parameters_file" ]]; then
        log_error "パラメータファイルが見つかりません: $parameters_file"
        exit 1
    fi
    
    # パラメータファイルのセキュリティ設定（機密情報含有）
    chmod 600 "$parameters_file"
    
    # テンプレート検証
    validate_template "$template_file" "$profile"
    
    # S3バケット準備
    ensure_s3_bucket "$bucket_name" "$region" "$profile"
    
    # ネストされたテンプレートアップロード
    upload_nested_templates "$bucket_name" "$profile"
    
    # スタックデプロイ
    deploy_stack "$stack_name" "$template_file" "$parameters_file" "$region" "$profile"
    
    # 結果表示
    show_stack_outputs "$stack_name" "$region" "$profile"
    
    # デプロイ後の検証
    post_deployment_validation "$stack_name" "$region" "$profile"
    
    log_info "デプロイメント完了!"
    log_info "次のステップ:"
    log_info "1. RDP接続でWindows ADサーバーにアクセス"
    log_info "2. Active Directoryユーザー・グループの設定"
    log_info "3. FSx ONTAPファイル共有の設定"
    log_info "4. アクセス権限のテスト"
    
    # 機密変数のクリア
    cleanup_sensitive_vars
}

# エラーハンドリング
cleanup_on_error() {
    local exit_code=$?
    log_error "スクリプト実行中にエラーが発生しました (行番号: $LINENO, 終了コード: $exit_code)"
    
    # 機密変数のクリア
    unset AdminPassword SafeModePassword 2>/dev/null || true
    
    # 一時ファイルのクリーンアップ
    [[ -n "${TEMP_DIR:-}" ]] && rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    exit $exit_code
}

trap cleanup_on_error ERR

# デプロイ後検証
post_deployment_validation() {
    local stack_name="$1"
    local region="$2"
    local profile="$3"
    
    log_info "デプロイ後検証を実行中..."
    
    # スタックステータス確認
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")
    
    if [[ "$stack_status" == "CREATE_COMPLETE" || "$stack_status" == "UPDATE_COMPLETE" ]]; then
        log_info "スタックステータス: $stack_status ✓"
    else
        log_warn "スタックステータス: $stack_status"
    fi
    
    # リソース作成確認
    local resource_count
    resource_count=$(aws cloudformation list-stack-resources \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" \
        --query 'length(StackResourceSummaries)' \
        --output text 2>/dev/null || echo "0")
    
    log_info "作成されたリソース数: $resource_count"
    
    log_info "デプロイ後検証完了"
}

# 機密変数クリア
cleanup_sensitive_vars() {
    unset AdminPassword SafeModePassword 2>/dev/null || true
    log_info "機密変数をクリアしました"
}

# メイン処理実行
main "$@"