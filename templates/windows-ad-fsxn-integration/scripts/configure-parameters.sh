#!/bin/bash

# Windows AD FSxN統合環境 パラメータ設定支援スクリプト
# 使用方法: ./configure-parameters.sh [環境名] [AWSプロファイル]

set -euo pipefail

# スクリプト設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"

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

log_success() {
    echo -e "\033[32m[SUCCESS]\033[0m $1"
}

# 使用方法表示
show_usage() {
    cat << EOF
使用方法: $0 [環境名] [AWSプロファイル]

引数:
  環境名        : dev, staging, prod のいずれか (デフォルト: dev)
  AWSプロファイル: AWS CLI プロファイル名 (デフォルト: default)

例:
  $0 dev user01
  $0 prod production-profile

このスクリプトは以下の作業を支援します:
  1. 既存リソースの確認（EC2キーペア、FSxファイルシステム）
  2. パラメータファイルの対話的設定
  3. パスワード生成支援
  4. 設定値の検証

前提条件:
  - AWS CLI がインストール・設定済み
  - jq がインストール済み
EOF
}

# 入力値検証
validate_input() {
    local input="$1"
    local pattern="$2"
    local error_msg="$3"
    
    if [[ ! "$input" =~ $pattern ]]; then
        log_error "$error_msg"
        return 1
    fi
    return 0
}

# セキュアパスワード生成
generate_secure_password() {
    local length="${1:-16}"
    
    # 大文字、小文字、数字、記号を含む16文字のパスワード生成
    local password
    password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-$((length-4)))
    
    # 複雑性要件を満たすよう調整
    password="${password}A1@"
    
    echo "$password"
}

# EC2キーペア確認
check_ec2_keypairs() {
    local profile="$1"
    
    log_info "利用可能なEC2キーペアを確認中..."
    
    local keypairs
    keypairs=$(aws ec2 describe-key-pairs \
        --profile "$profile" \
        --query 'KeyPairs[].KeyName' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$keypairs" ]]; then
        log_success "利用可能なEC2キーペア:"
        echo "$keypairs" | tr '\t' '\n' | sed 's/^/  - /'
        return 0
    else
        log_warn "EC2キーペアが見つかりません"
        return 1
    fi
}

# FSxファイルシステム確認
check_fsx_filesystems() {
    local profile="$1"
    
    log_info "利用可能なFSx for ONTAPファイルシステムを確認中..."
    
    local filesystems
    filesystems=$(aws fsx describe-file-systems \
        --profile "$profile" \
        --query 'FileSystems[?FileSystemType==`ONTAP`].[FileSystemId,StorageCapacity,Lifecycle]' \
        --output table 2>/dev/null || echo "")
    
    if [[ -n "$filesystems" && "$filesystems" != *"None"* ]]; then
        log_success "利用可能なFSx for ONTAPファイルシステム:"
        echo "$filesystems"
        return 0
    else
        log_warn "FSx for ONTAPファイルシステムが見つかりません"
        return 1
    fi
}

# 対話的パラメータ設定
interactive_parameter_setup() {
    local environment="$1"
    local profile="$2"
    local output_file="$3"
    
    log_info "=== 対話的パラメータ設定開始 ==="
    
    # ベースファイル読み込み
    local base_file="$TEMPLATE_DIR/parameters/${environment}-environment-parameters.json"
    if [[ ! -f "$base_file" ]]; then
        log_error "ベースパラメータファイルが見つかりません: $base_file"
        return 1
    fi
    
    # 一時ファイル作成
    local temp_file=$(mktemp)
    cp "$base_file" "$temp_file"
    
    echo
    log_info "--- 必須パラメータ設定 ---"
    
    # 管理者パスワード設定
    echo
    read -p "Active Directory管理者パスワードを入力してください（空白で自動生成）: " -s admin_password
    echo
    
    if [[ -z "$admin_password" ]]; then
        admin_password=$(generate_secure_password 16)
        log_info "管理者パスワードを自動生成しました: $admin_password"
    fi
    
    # セーフモードパスワード設定
    echo
    read -p "Active Directoryセーフモードパスワードを入力してください（空白で自動生成）: " -s safemode_password
    echo
    
    if [[ -z "$safemode_password" ]]; then
        safemode_password=$(generate_secure_password 16)
        log_info "セーフモードパスワードを自動生成しました: $safemode_password"
    fi
    
    # EC2キーペア名設定
    echo
    check_ec2_keypairs "$profile" || true
    echo
    read -p "EC2キーペア名を入力してください: " keypair_name
    
    while [[ -z "$keypair_name" ]]; do
        log_warn "EC2キーペア名は必須です"
        read -p "EC2キーペア名を入力してください: " keypair_name
    done
    
    # FSxファイルシステムID設定
    echo
    check_fsx_filesystems "$profile" || true
    echo
    read -p "FSx for ONTAPファイルシステムIDを入力してください: " fsx_filesystem_id
    
    while [[ -z "$fsx_filesystem_id" || ! "$fsx_filesystem_id" =~ ^fs-[0-9a-f]{17}$ ]]; do
        log_warn "有効なFSxファイルシステムIDを入力してください（例: fs-0123456789abcdef0）"
        read -p "FSx for ONTAPファイルシステムIDを入力してください: " fsx_filesystem_id
    done
    
    echo
    log_info "--- オプションパラメータ設定 ---"
    
    # 通知メールアドレス
    echo
    read -p "アラート通知用メールアドレス（オプション）: " notification_email
    
    # カスタムドメイン名
    echo
    read -p "カスタムドメイン名（デフォルト: ${environment}.corp.local）: " custom_domain
    
    if [[ -z "$custom_domain" ]]; then
        custom_domain="${environment}.corp.local"
    fi
    
    # 追加タグ
    echo
    read -p "追加タグ（Key=Value,Key=Value形式、オプション）: " additional_tags
    
    # パラメータファイル更新
    log_info "パラメータファイルを更新中..."
    
    # jqを使用してパラメータを更新
    jq --arg admin_pass "$admin_password" \
       --arg safe_pass "$safemode_password" \
       --arg keypair "$keypair_name" \
       --arg fsx_id "$fsx_filesystem_id" \
       --arg email "$notification_email" \
       --arg domain "$custom_domain" \
       --arg tags "$additional_tags" \
       '
       map(
         if .ParameterKey == "AdminPassword" then .ParameterValue = $admin_pass
         elif .ParameterKey == "SafeModePassword" then .ParameterValue = $safe_pass
         elif .ParameterKey == "KeyPairName" then .ParameterValue = $keypair
         elif .ParameterKey == "FSxFileSystemId" then .ParameterValue = $fsx_id
         elif .ParameterKey == "NotificationEmail" then .ParameterValue = $email
         elif .ParameterKey == "DomainName" then .ParameterValue = $domain
         elif .ParameterKey == "AdditionalTags" and $tags != "" then .ParameterValue = $tags
         else .
         end
       )
       ' "$temp_file" > "$output_file"
    
    rm "$temp_file"
    
    log_success "パラメータファイルを作成しました: $output_file"
    
    # 設定内容確認
    echo
    log_info "=== 設定内容確認 ==="
    jq -r '.[] | select(.ParameterKey | contains("Password") | not) | "\(.ParameterKey): \(.ParameterValue)"' "$output_file"
    
    echo
    log_warn "パスワードは表示されません。安全に保管してください。"
}

# パラメータ検証
validate_parameters() {
    local param_file="$1"
    
    log_info "パラメータファイル検証中..."
    
    local validation_errors=()
    
    # JSON構文チェック
    if ! jq empty "$param_file" >/dev/null 2>&1; then
        validation_errors+=("JSON構文エラー")
    fi
    
    # 必須パラメータチェック
    local required_params=(
        "AdminPassword"
        "SafeModePassword"
        "FSxFileSystemId"
        "KeyPairName"
    )
    
    for param in "${required_params[@]}"; do
        local value
        value=$(jq -r ".[] | select(.ParameterKey == \"$param\") | .ParameterValue" "$param_file" 2>/dev/null || echo "")
        
        if [[ -z "$value" || "$value" == "null" || "$value" == *"CHANGE_ME"* ]]; then
            validation_errors+=("必須パラメータが設定されていません: $param")
        fi
    done
    
    # パスワード複雑性チェック
    local admin_password
    admin_password=$(jq -r '.[] | select(.ParameterKey == "AdminPassword") | .ParameterValue' "$param_file" 2>/dev/null || echo "")
    
    if [[ ${#admin_password} -lt 8 ]]; then
        validation_errors+=("管理者パスワードが短すぎます（8文字以上必要）")
    fi
    
    # FSxファイルシステムIDフォーマットチェック
    local fsx_id
    fsx_id=$(jq -r '.[] | select(.ParameterKey == "FSxFileSystemId") | .ParameterValue' "$param_file" 2>/dev/null || echo "")
    
    if [[ ! "$fsx_id" =~ ^fs-[0-9a-f]{17}$ ]]; then
        validation_errors+=("FSxファイルシステムIDの形式が正しくありません")
    fi
    
    # 結果表示
    if [[ ${#validation_errors[@]} -eq 0 ]]; then
        log_success "✓ パラメータファイル検証成功"
        return 0
    else
        log_error "✗ パラメータファイル検証失敗:"
        for error in "${validation_errors[@]}"; do
            echo "  - $error"
        done
        return 1
    fi
}

# メイン処理
main() {
    local environment="${1:-dev}"
    local profile="${2:-default}"
    
    # ヘルプ表示
    if [[ "$environment" == "-h" || "$environment" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # 環境名検証
    if [[ ! "$environment" =~ ^(dev|staging|prod)$ ]]; then
        log_error "無効な環境名: $environment (dev, staging, prod のいずれかを指定してください)"
        exit 1
    fi
    
    # jq確認
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq コマンドがインストールされていません"
        log_error "インストール方法: brew install jq (macOS) または apt-get install jq (Ubuntu)"
        exit 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity --profile "$profile" >/dev/null 2>&1; then
        log_error "AWS認証に失敗しました。プロファイル設定を確認してください: $profile"
        exit 1
    fi
    
    log_info "Windows AD FSxN統合環境 パラメータ設定支援開始"
    log_info "対象環境: $environment"
    log_info "AWSプロファイル: $profile"
    
    # 出力ファイル名
    local output_file="$TEMPLATE_DIR/parameters/my-${environment}-parameters.json"
    
    # 対話的設定
    interactive_parameter_setup "$environment" "$profile" "$output_file"
    
    # 検証実行
    if validate_parameters "$output_file"; then
        echo
        log_success "パラメータ設定が完了しました！"
        log_info "次のステップ:"
        log_info "1. テンプレート検証: ./scripts/validate-templates.sh"
        log_info "2. デプロイ実行: ./scripts/deploy-stack.sh $environment ap-northeast-1 $profile"
        log_info "3. 設定ファイル: $output_file"
    else
        echo
        log_error "パラメータ設定に問題があります。修正してから再実行してください。"
        exit 1
    fi
}

# エラーハンドリング
trap 'log_error "スクリプト実行中にエラーが発生しました (行番号: $LINENO)"' ERR

# メイン処理実行
main "$@"