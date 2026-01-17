#!/bin/bash

# CloudFormation Basic Deployment Script
# 基本的なCloudFormationテンプレートのデプロイメント

set -euo pipefail

# デフォルト値
STACK_NAME="${1:-embedding-workload-stack}"
TEMPLATE_FILE="${2:-templates/embedding-workload-stack.template.json}"
ENVIRONMENT="${3:-dev}"
PARAMETERS_FILE=""

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFN_DIR="$(dirname "$SCRIPT_DIR")"

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
使用方法: $0 [スタック名] [テンプレートファイル] [環境名]

CloudFormationスタックをデプロイします

引数:
    スタック名           CloudFormationスタック名 (デフォルト: embedding-workload-stack)
    テンプレートファイル  CloudFormationテンプレートファイル (デフォルト: templates/embedding-workload-stack.template.json)
    環境名              環境名 (dev/staging/prod) (デフォルト: dev)

オプション:
    -p, --parameters FILE  パラメータファイルを指定
    -h, --help            このヘルプを表示

例:
    $0
    $0 my-stack templates/embedding-workload-stack.template.json prod
    $0 -p parameters/prod-parameters.json my-stack

EOF
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--parameters)
            PARAMETERS_FILE="$2"
            shift 2
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
            elif [[ -z "${TEMPLATE_FILE_SET:-}" ]]; then
                TEMPLATE_FILE="$1"
                TEMPLATE_FILE_SET=true
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

# パラメータファイルの自動決定
if [[ -z "$PARAMETERS_FILE" ]]; then
    PARAMETERS_FILE="$CFN_DIR/parameters/${ENVIRONMENT}-parameters.json"
fi

# ファイルの存在確認
check_files() {
    log "ファイルの存在確認中..."
    
    # テンプレートファイルの確認
    if [[ ! -f "$CFN_DIR/$TEMPLATE_FILE" ]]; then
        error "テンプレートファイルが見つかりません: $CFN_DIR/$TEMPLATE_FILE"
        exit 1
    fi
    
    # パラメータファイルの確認
    if [[ -n "$PARAMETERS_FILE" ]] && [[ ! -f "$CFN_DIR/$PARAMETERS_FILE" ]]; then
        log "パラメータファイルが見つかりません: $CFN_DIR/$PARAMETERS_FILE"
        log "パラメータなしでデプロイを続行します"
        PARAMETERS_FILE=""
    fi
    
    log "ファイルの確認完了"
}

# テンプレートの検証
validate_template() {
    log "CloudFormationテンプレートを検証中..."
    
    if aws cloudformation validate-template --template-body "file://$CFN_DIR/$TEMPLATE_FILE" >/dev/null 2>&1; then
        log "✅ テンプレートの検証成功"
    else
        error "❌ テンプレートの検証失敗"
        aws cloudformation validate-template --template-body "file://$CFN_DIR/$TEMPLATE_FILE"
        exit 1
    fi
}

# スタックの存在確認
check_stack_exists() {
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" >/dev/null 2>&1; then
        log "既存のスタックが見つかりました: $STACK_NAME"
        return 0
    else
        log "新しいスタックを作成します: $STACK_NAME"
        return 1
    fi
}

# パラメータの構築
build_parameters() {
    local params=""
    
    if [[ -n "$PARAMETERS_FILE" ]]; then
        log "パラメータファイルを使用: $PARAMETERS_FILE"
        params="--parameters file://$CFN_DIR/$PARAMETERS_FILE"
    else
        log "デフォルトパラメータを使用"
        params="--parameter-overrides Environment=$ENVIRONMENT ProjectName=embedding-workload"
    fi
    
    echo "$params"
}

# CloudFormationスタックのデプロイ
deploy_stack() {
    log "CloudFormationスタックをデプロイ中..."
    log "スタック名: $STACK_NAME"
    log "テンプレート: $TEMPLATE_FILE"
    log "環境: $ENVIRONMENT"
    
    local parameters
    parameters=$(build_parameters)
    
    # デプロイコマンドの実行
    local deploy_cmd="aws cloudformation deploy \
        --template-file $CFN_DIR/$TEMPLATE_FILE \
        --stack-name $STACK_NAME \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        $parameters \
        --tags \
            Project=embedding-workload \
            Environment=$ENVIRONMENT \
            ManagedBy=CloudFormation \
            DeployedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    log "実行コマンド: $deploy_cmd"
    
    if eval "$deploy_cmd"; then
        log "✅ デプロイメント成功"
    else
        error "❌ デプロイメント失敗"
        exit 1
    fi
}

# スタック情報の表示
show_stack_info() {
    log "スタック情報を取得中..."
    
    # スタックの状態確認
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    log "スタック状態: $stack_status"
    
    if [[ "$stack_status" == "CREATE_COMPLETE" ]] || [[ "$stack_status" == "UPDATE_COMPLETE" ]]; then
        log "📋 スタック出力:"
        aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --query 'Stacks[0].Outputs[?OutputKey && OutputValue].[OutputKey,OutputValue]' \
            --output table
        
        log "🏷️ スタックタグ:"
        aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --query 'Stacks[0].Tags[?Key && Value].[Key,Value]' \
            --output table
    fi
}

# リソースの確認
check_resources() {
    log "作成されたリソースを確認中..."
    
    # 主要リソースの確認
    local resources=(
        "AWS::Batch::ComputeEnvironment"
        "AWS::Batch::JobQueue"
        "AWS::S3::Bucket"
        "AWS::DynamoDB::Table"
        "AWS::SNS::Topic"
    )
    
    for resource_type in "${resources[@]}"; do
        local count
        count=$(aws cloudformation list-stack-resources \
            --stack-name "$STACK_NAME" \
            --query "StackResourceSummaries[?ResourceType=='$resource_type'] | length(@)" \
            --output text 2>/dev/null || echo "0")
        
        log "$resource_type: $count 個"
    done
}

# 後処理の実行
post_deployment() {
    log "デプロイメント後の処理を実行中..."
    
    # スタック情報の表示
    show_stack_info
    
    # リソースの確認
    check_resources
    
    # 次のステップの案内
    log ""
    log "🎉 デプロイメントが完了しました！"
    log ""
    log "📋 次のステップ:"
    log "1. AWS コンソールでリソースを確認"
    log "2. Batch ジョブの実行テスト"
    log "3. アラート設定の確認"
    log ""
    log "🔗 便利なリンク:"
    log "- CloudFormation コンソール: https://console.aws.amazon.com/cloudformation/home?region=$(aws configure get region)#/stacks/stackinfo?stackId=$STACK_NAME"
    log "- Batch コンソール: https://console.aws.amazon.com/batch/home?region=$(aws configure get region)"
    log ""
}

# メイン実行
main() {
    log "CloudFormation デプロイメントを開始"
    
    # 前提条件の確認
    if ! command -v aws &> /dev/null; then
        error "AWS CLI が必要です。インストールしてください。"
        exit 1
    fi
    
    # AWS 認証情報の確認
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS 認証情報が設定されていません。aws configure を実行してください。"
        exit 1
    fi
    
    # ファイルの存在確認
    check_files
    
    # テンプレートの検証
    validate_template
    
    # スタックの存在確認
    if check_stack_exists; then
        log "既存のスタックを更新します"
    else
        log "新しいスタックを作成します"
    fi
    
    # CloudFormationスタックのデプロイ
    deploy_stack
    
    # 後処理の実行
    post_deployment
    
    log "CloudFormation デプロイメントが完了しました"
}

# スクリプト実行
main "$@"