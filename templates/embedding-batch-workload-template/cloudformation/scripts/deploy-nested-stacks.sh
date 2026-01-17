#!/bin/bash

# CloudFormation Nested Stacks Deployment Script
# ネストされたCloudFormationスタックのデプロイメント

set -euo pipefail

# デフォルト値
STACK_NAME="${1:-embedding-workload-master}"
S3_BUCKET="${2:-}"
ENVIRONMENT="${3:-dev}"
S3_KEY_PREFIX="cloudformation/nested/"

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFN_DIR="$(dirname "$SCRIPT_DIR")"
NESTED_DIR="$CFN_DIR/nested"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [マスタースタック名] [S3バケット名] [環境名]

ネストされたCloudFormationスタックをデプロイします

引数:
    マスタースタック名   CloudFormationマスタースタック名 (デフォルト: embedding-workload-master)
    S3バケット名        ネストされたテンプレートを格納するS3バケット名 (必須)
    環境名             環境名 (dev/staging/prod) (デフォルト: dev)

オプション:
    --prefix PREFIX    S3キープレフィックス (デフォルト: cloudformation/nested/)
    --create-bucket    S3バケットが存在しない場合は作成
    --validate-only    テンプレートの検証のみ実行
    -h, --help         このヘルプを表示

例:
    $0 my-master-stack my-cloudformation-bucket prod
    $0 --create-bucket my-master-stack my-new-bucket dev
    $0 --validate-only my-master-stack my-bucket

EOF
}

# オプション変数
CREATE_BUCKET=false
VALIDATE_ONLY=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --prefix)
            S3_KEY_PREFIX="$2"
            shift 2
            ;;
        --create-bucket)
            CREATE_BUCKET=true
            shift
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        -*)
            error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
        *)
            # 位置引数の処理
            if [[ -z "${STACK_NAME_SET:-}" ]]; then
                STACK_NAME="$1"
                STACK_NAME_SET=true
            elif [[ -z "${S3_BUCKET_SET:-}" ]]; then
                S3_BUCKET="$1"
                S3_BUCKET_SET=true
            elif [[ -z "${ENVIRONMENT_SET:-}" ]]; then
                ENVIRONMENT="$1"
                ENVIRONMENT_SET=true
            else
                error "余分な引数: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# S3バケット名の確認
if [[ -z "$S3_BUCKET" ]]; then
    error "S3バケット名が必要です"
    show_usage
    exit 1
fi

# 前提条件の確認
check_prerequisites() {
    log "前提条件を確認中..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI が必要です。インストールしてください。"
        exit 1
    fi
    
    # AWS 認証情報
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS 認証情報が設定されていません。aws configure を実行してください。"
        exit 1
    fi
    
    # ネストされたテンプレートディレクトリの確認
    if [[ ! -d "$NESTED_DIR" ]]; then
        error "ネストされたテンプレートディレクトリが見つかりません: $NESTED_DIR"
        exit 1
    fi
    
    log "前提条件の確認完了"
}

# S3バケットの確認・作成
setup_s3_bucket() {
    log "S3バケットを確認中: $S3_BUCKET"
    
    # バケットの存在確認
    if aws s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
        log "S3バケットが存在します: $S3_BUCKET"
    else
        if [[ "$CREATE_BUCKET" == "true" ]]; then
            log "S3バケットを作成中: $S3_BUCKET"
            
            local region
            region=$(aws configure get region)
            
            if [[ "$region" == "us-east-1" ]]; then
                aws s3api create-bucket --bucket "$S3_BUCKET"
            else
                aws s3api create-bucket \
                    --bucket "$S3_BUCKET" \
                    --create-bucket-configuration LocationConstraint="$region"
            fi
            
            # バケットのバージョニングを有効化
            aws s3api put-bucket-versioning \
                --bucket "$S3_BUCKET" \
                --versioning-configuration Status=Enabled
            
            log "S3バケットを作成しました: $S3_BUCKET"
        else
            error "S3バケットが存在しません: $S3_BUCKET"
            error "--create-bucket オプションを使用してバケットを作成してください"
            exit 1
        fi
    fi
}

# ネストされたテンプレートの検証
validate_nested_templates() {
    log "ネストされたテンプレートを検証中..."
    
    local validation_errors=0
    
    # 各テンプレートファイルを検証
    find "$NESTED_DIR" -name "*.template.json" | while read -r template_file; do
        local template_name
        template_name=$(basename "$template_file")
        
        log "検証中: $template_name"
        
        if aws cloudformation validate-template --template-body "file://$template_file" >/dev/null 2>&1; then
            log "✅ $template_name: 検証成功"
        else
            error "❌ $template_name: 検証失敗"
            aws cloudformation validate-template --template-body "file://$template_file" 2>&1 | head -5
            ((validation_errors++))
        fi
    done
    
    if [[ $validation_errors -eq 0 ]]; then
        log "すべてのネストされたテンプレートの検証が成功しました"
    else
        error "$validation_errors 個のテンプレートで検証エラーが発生しました"
        exit 1
    fi
}

# ネストされたテンプレートのS3アップロード
upload_nested_templates() {
    log "ネストされたテンプレートをS3にアップロード中..."
    
    # ネストされたテンプレートをS3に同期
    aws s3 sync "$NESTED_DIR/" "s3://$S3_BUCKET/$S3_KEY_PREFIX" \
        --exclude "*" \
        --include "*.template.json" \
        --delete
    
    log "ネストされたテンプレートのアップロード完了"
    
    # アップロードされたファイルの一覧表示
    log "アップロードされたテンプレート:"
    aws s3 ls "s3://$S3_BUCKET/$S3_KEY_PREFIX" --recursive | grep "\.template\.json$"
}

# マスタースタックのデプロイ
deploy_master_stack() {
    log "マスタースタックをデプロイ中..."
    log "スタック名: $STACK_NAME"
    log "S3バケット: $S3_BUCKET"
    log "環境: $ENVIRONMENT"
    
    local master_template="$NESTED_DIR/master-stack.template.json"
    
    if [[ ! -f "$master_template" ]]; then
        error "マスターテンプレートが見つかりません: $master_template"
        exit 1
    fi
    
    # マスタースタックのデプロイ
    aws cloudformation deploy \
        --template-file "$master_template" \
        --stack-name "$STACK_NAME" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            Environment="$ENVIRONMENT" \
            ProjectName="embedding-workload" \
            TemplateS3Bucket="$S3_BUCKET" \
            TemplateS3KeyPrefix="$S3_KEY_PREFIX" \
            AlertContactEmail="ops@company.com" \
        --tags \
            Project=embedding-workload \
            Environment="$ENVIRONMENT" \
            ManagedBy=CloudFormation \
            StackType=Master \
            DeployedAt="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    log "✅ マスタースタックのデプロイ成功"
}

# ネストされたスタックの状態確認
check_nested_stacks() {
    log "ネストされたスタックの状態を確認中..."
    
    # マスタースタックのリソースを取得
    local nested_stacks
    nested_stacks=$(aws cloudformation list-stack-resources \
        --stack-name "$STACK_NAME" \
        --query 'StackResourceSummaries[?ResourceType==`AWS::CloudFormation::Stack`].[LogicalResourceId,PhysicalResourceId,ResourceStatus]' \
        --output text)
    
    if [[ -n "$nested_stacks" ]]; then
        log "📋 ネストされたスタック一覧:"
        echo "$nested_stacks" | while read -r logical_id physical_id status; do
            log "  - $logical_id: $status"
            
            # 各ネストされたスタックの出力を表示
            if [[ "$status" == "CREATE_COMPLETE" ]] || [[ "$status" == "UPDATE_COMPLETE" ]]; then
                local outputs
                outputs=$(aws cloudformation describe-stacks \
                    --stack-name "$physical_id" \
                    --query 'Stacks[0].Outputs[?OutputKey && OutputValue].[OutputKey,OutputValue]' \
                    --output text 2>/dev/null || echo "")
                
                if [[ -n "$outputs" ]]; then
                    log "    出力:"
                    echo "$outputs" | while read -r key value; do
                        log "      $key: $value"
                    done
                fi
            fi
        done
    else
        log "ネストされたスタックが見つかりません"
    fi
}

# スタック情報の表示
show_stack_info() {
    log "マスタースタック情報を取得中..."
    
    # スタックの状態確認
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    log "マスタースタック状態: $stack_status"
    
    if [[ "$stack_status" == "CREATE_COMPLETE" ]] || [[ "$stack_status" == "UPDATE_COMPLETE" ]]; then
        log "📋 マスタースタック出力:"
        aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --query 'Stacks[0].Outputs[?OutputKey && OutputValue].[OutputKey,OutputValue]' \
            --output table
    fi
}

# 後処理の実行
post_deployment() {
    log "デプロイメント後の処理を実行中..."
    
    # スタック情報の表示
    show_stack_info
    
    # ネストされたスタックの確認
    check_nested_stacks
    
    # 次のステップの案内
    log ""
    log "🎉 ネストされたスタックのデプロイメントが完了しました！"
    log ""
    log "📋 次のステップ:"
    log "1. AWS コンソールで各スタックを確認"
    log "2. ネストされたスタックの依存関係を確認"
    log "3. 各コンポーネントの動作テスト"
    log ""
    log "🔗 便利なリンク:"
    log "- CloudFormation コンソール: https://console.aws.amazon.com/cloudformation/home?region=$(aws configure get region)"
    log "- S3 バケット: https://s3.console.aws.amazon.com/s3/buckets/$S3_BUCKET?region=$(aws configure get region)"
    log ""
}

# メイン実行
main() {
    log "ネストされたCloudFormationスタックのデプロイメントを開始"
    
    # 前提条件の確認
    check_prerequisites
    
    # S3バケットの確認・作成
    setup_s3_bucket
    
    # ネストされたテンプレートの検証
    validate_nested_templates
    
    # 検証のみの場合は終了
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "テンプレートの検証が完了しました"
        exit 0
    fi
    
    # ネストされたテンプレートのS3アップロード
    upload_nested_templates
    
    # マスタースタックのデプロイ
    deploy_master_stack
    
    # 後処理の実行
    post_deployment
    
    log "ネストされたCloudFormationスタックのデプロイメントが完了しました"
}

# スクリプト実行
main "$@"