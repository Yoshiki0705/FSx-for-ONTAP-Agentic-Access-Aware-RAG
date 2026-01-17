#!/bin/bash

# Windows AD FSxN統合環境 - 環境別設定セットアップスクリプト
# 使用方法: ./setup-environment-config.sh [環境名] [設定ソース] [リージョン] [プロファイル]

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
使用方法: $0 [環境名] [設定ソース] [リージョン] [AWSプロファイル]

引数:
  環境名        : dev, staging, prod のいずれか (デフォルト: dev)
  設定ソース    : parameters, ssm, secrets-manager のいずれか (デフォルト: parameters)
  リージョン    : AWS リージョン (デフォルト: ap-northeast-1)
  AWSプロファイル: AWS CLI プロファイル名 (デフォルト: default)

例:
  $0 dev parameters ap-northeast-1 user01
  $0 prod secrets-manager ap-northeast-1 production
  $0 staging ssm us-east-1 staging-profile

設定ソース:
  parameters      : パラメータファイルから設定を取得
  ssm            : Systems Manager Parameter Storeから設定を取得
  secrets-manager : Secrets Managerから設定を取得
EOF
}

# 入力値検証
validate_parameters() {
    local env="$1"
    local config_source="$2"
    local region="$3"
    local profile="$4"
    
    # 環境名検証
    if [[ ! "$env" =~ ^(dev|staging|prod)$ ]]; then
        log_error "無効な環境名: $env (dev, staging, prod のいずれかを指定してください)"
        return 1
    fi
    
    # 設定ソース検証
    if [[ ! "$config_source" =~ ^(parameters|ssm|secrets-manager)$ ]]; then
        log_error "無効な設定ソース: $config_source (parameters, ssm, secrets-manager のいずれかを指定してください)"
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
    
    log_info "パラメータ検証完了: 環境=$env, 設定ソース=$config_source, リージョン=$region, プロファイル=$profile"
}

# SSM Parameter Store設定
setup_ssm_parameters() {
    local env="$1"
    local region="$2"
    local profile="$3"
    
    log_info "SSM Parameter Store設定中..."
    
    local prefix="/${PROJECT_NAME}/${env}"
    
    # 基本設定パラメータ
    aws ssm put-parameter \
        --name "${prefix}/domain-name" \
        --value "${env}.corp.local" \
        --type "String" \
        --description "Active Directory domain name for ${env} environment" \
        --region "$region" \
        --profile "$profile" \
        --overwrite || true
    
    aws ssm put-parameter \
        --name "${prefix}/netbios-name" \
        --value "$(echo "${env}CORP" | tr '[:lower:]' '[:upper:]')" \
        --type "String" \
        --description "NetBIOS name for ${env} environment" \
        --region "$region" \
        --profile "$profile" \
        --overwrite || true
    
    aws ssm put-parameter \
        --name "${prefix}/vpc-cidr" \
        --value "$(get_vpc_cidr "$env")" \
        --type "String" \
        --description "VPC CIDR for ${env} environment" \
        --region "$region" \
        --profile "$profile" \
        --overwrite || true
    
    aws ssm put-parameter \
        --name "${prefix}/instance-type" \
        --value "$(get_instance_type "$env")" \
        --type "String" \
        --description "EC2 instance type for ${env} environment" \
        --region "$region" \
        --profile "$profile" \
        --overwrite || true
    
    # セキュリティ設定パラメータ（暗号化）
    aws ssm put-parameter \
        --name "${prefix}/security/enable-cloudtrail" \
        --value "true" \
        --type "SecureString" \
        --description "CloudTrail enablement for ${env} environment" \
        --region "$region" \
        --profile "$profile" \
        --overwrite || true
    
    aws ssm put-parameter \
        --name "${prefix}/security/enable-guardduty" \
        --value "$(get_guardduty_setting "$env")" \
        --type "SecureString" \
        --description "GuardDuty enablement for ${env} environment" \
        --region "$region" \
        --profile "$profile" \
        --overwrite || true
    
    log_info "SSM Parameter Store設定完了"
}

# Secrets Manager設定
setup_secrets_manager() {
    local env="$1"
    local region="$2"
    local profile="$3"
    
    log_info "Secrets Manager設定中..."
    
    # 管理者パスワードシークレット作成
    local admin_secret_name="${PROJECT_NAME}/${env}/admin-password"
    local safemode_secret_name="${PROJECT_NAME}/${env}/safemode-password"
    
    # 管理者パスワードシークレット
    if ! aws secretsmanager describe-secret --secret-id "$admin_secret_name" --region "$region" --profile "$profile" >/dev/null 2>&1; then
        log_info "管理者パスワードシークレット作成中: $admin_secret_name"
        
        aws secretsmanager create-secret \
            --name "$admin_secret_name" \
            --description "Active Directory administrator password for ${env} environment" \
            --secret-string "$(generate_secure_password)" \
            --region "$region" \
            --profile "$profile"
    else
        log_info "管理者パスワードシークレット既存: $admin_secret_name"
    fi
    
    # セーフモードパスワードシークレット
    if ! aws secretsmanager describe-secret --secret-id "$safemode_secret_name" --region "$region" --profile "$profile" >/dev/null 2>&1; then
        log_info "セーフモードパスワードシークレット作成中: $safemode_secret_name"
        
        aws secretsmanager create-secret \
            --name "$safemode_secret_name" \
            --description "Active Directory safe mode password for ${env} environment" \
            --secret-string "$(generate_secure_password)" \
            --region "$region" \
            --profile "$profile"
    else
        log_info "セーフモードパスワードシークレット既存: $safemode_secret_name"
    fi
    
    # 統合設定シークレット
    local config_secret_name="${PROJECT_NAME}/${env}/configuration"
    local config_json=$(cat << EOF
{
  "domain_name": "${env}.corp.local",
  "netbios_name": "$(echo "${env}CORP" | tr '[:lower:]' '[:upper:]')",
  "vpc_cidr": "$(get_vpc_cidr "$env")",
  "instance_type": "$(get_instance_type "$env")",
  "enable_guardduty": "$(get_guardduty_setting "$env")",
  "backup_retention_days": "$(get_backup_retention "$env")",
  "environment": "$env",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)
    
    if ! aws secretsmanager describe-secret --secret-id "$config_secret_name" --region "$region" --profile "$profile" >/dev/null 2>&1; then
        log_info "統合設定シークレット作成中: $config_secret_name"
        
        aws secretsmanager create-secret \
            --name "$config_secret_name" \
            --description "Integrated configuration for ${env} environment" \
            --secret-string "$config_json" \
            --region "$region" \
            --profile "$profile"
    else
        log_info "統合設定シークレット更新中: $config_secret_name"
        
        aws secretsmanager update-secret \
            --secret-id "$config_secret_name" \
            --secret-string "$config_json" \
            --region "$region" \
            --profile "$profile"
    fi
    
    log_info "Secrets Manager設定完了"
}

# 環境別設定値取得関数
get_vpc_cidr() {
    local env="$1"
    case "$env" in
        "dev") echo "10.0.0.0/16" ;;
        "staging") echo "10.2.0.0/16" ;;
        "prod") echo "10.1.0.0/16" ;;
        *) echo "10.0.0.0/16" ;;
    esac
}

get_instance_type() {
    local env="$1"
    case "$env" in
        "dev") echo "t3.medium" ;;
        "staging") echo "t3.large" ;;
        "prod") echo "m5.large" ;;
        *) echo "t3.medium" ;;
    esac
}

get_guardduty_setting() {
    local env="$1"
    case "$env" in
        "dev") echo "false" ;;
        "staging") echo "true" ;;
        "prod") echo "true" ;;
        *) echo "false" ;;
    esac
}

get_backup_retention() {
    local env="$1"
    case "$env" in
        "dev") echo "7" ;;
        "staging") echo "14" ;;
        "prod") echo "90" ;;
        *) echo "7" ;;
    esac
}

# セキュアパスワード生成
generate_secure_password() {
    # 大文字、小文字、数字、記号を含む16文字のパスワードを生成
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-16 | sed 's/$/!@#/'
}

# 設定検証
validate_configuration() {
    local env="$1"
    local config_source="$2"
    local region="$3"
    local profile="$4"
    
    log_info "設定検証中..."
    
    case "$config_source" in
        "ssm")
            local prefix="/${PROJECT_NAME}/${env}"
            if aws ssm get-parameter --name "${prefix}/domain-name" --region "$region" --profile "$profile" >/dev/null 2>&1; then
                log_info "SSM Parameter Store設定確認完了"
            else
                log_error "SSM Parameter Store設定が見つかりません"
                return 1
            fi
            ;;
        "secrets-manager")
            local secret_name="${PROJECT_NAME}/${env}/admin-password"
            if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$region" --profile "$profile" >/dev/null 2>&1; then
                log_info "Secrets Manager設定確認完了"
            else
                log_error "Secrets Manager設定が見つかりません"
                return 1
            fi
            ;;
        "parameters")
            local param_file="${TEMPLATE_DIR}/parameters/${env}-environment-parameters.json"
            if [[ -f "$param_file" ]]; then
                log_info "パラメータファイル確認完了: $param_file"
            else
                log_error "パラメータファイルが見つかりません: $param_file"
                return 1
            fi
            ;;
    esac
    
    log_info "設定検証完了"
}

# 設定情報表示
show_configuration_info() {
    local env="$1"
    local config_source="$2"
    local region="$3"
    local profile="$4"
    
    log_info "=== 環境設定情報 ==="
    echo "環境: $env"
    echo "設定ソース: $config_source"
    echo "リージョン: $region"
    echo "プロファイル: $profile"
    echo "VPC CIDR: $(get_vpc_cidr "$env")"
    echo "インスタンスタイプ: $(get_instance_type "$env")"
    echo "GuardDuty: $(get_guardduty_setting "$env")"
    echo "バックアップ保持日数: $(get_backup_retention "$env")"
    echo "========================"
}

# メイン処理
main() {
    # 引数処理
    local environment="${1:-dev}"
    local config_source="${2:-parameters}"
    local region="${3:-ap-northeast-1}"
    local profile="${4:-default}"
    
    # ヘルプ表示
    if [[ "$environment" == "-h" || "$environment" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "Windows AD FSxN統合環境 - 環境別設定セットアップ開始"
    
    # パラメータ検証
    validate_parameters "$environment" "$config_source" "$region" "$profile"
    
    # 設定情報表示
    show_configuration_info "$environment" "$config_source" "$region" "$profile"
    
    # 設定ソース別セットアップ
    case "$config_source" in
        "ssm")
            setup_ssm_parameters "$environment" "$region" "$profile"
            ;;
        "secrets-manager")
            setup_secrets_manager "$environment" "$region" "$profile"
            ;;
        "parameters")
            log_info "パラメータファイル使用のため、追加セットアップは不要です"
            ;;
    esac
    
    # 設定検証
    validate_configuration "$environment" "$config_source" "$region" "$profile"
    
    log_info "環境別設定セットアップ完了!"
    log_info "次のステップ:"
    log_info "1. 必要に応じてパスワードやその他の機密情報を更新"
    log_info "2. デプロイメントスクリプトを実行"
    log_info "3. 設定値の動作確認"
}

# エラーハンドリング
trap 'log_error "スクリプト実行中にエラーが発生しました (行番号: $LINENO)"' ERR

# メイン処理実行
main "$@"