#!/bin/bash

# Embedding Batch Workload 包括的デモスクリプト
# CDKとCloudFormationの両方のデプロイメント方法を実演します

set -euo pipefail

# セキュリティ設定
umask 077

# エラーハンドリング強化
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "デモ実行中にエラーが発生しました (終了コード: $exit_code)"
    fi
    # 機密情報のクリア
    unset DEMO_PROJECT_NAME DEMO_ENVIRONMENT DEMO_REGION 2>/dev/null || true
    return $exit_code
}

trap 'echo "❌ エラー: 行 $LINENO でスクリプトが失敗しました" >&2; cleanup; exit 1' ERR
trap 'cleanup; exit 0' EXIT

# 設定値（readonly化）
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
readonly DEMO_PROJECT_NAME="embedding-demo"
readonly DEMO_ENVIRONMENT="demo"
readonly DEMO_REGION="us-east-1"

# ログ設定
readonly LOG_FILE="$PROJECT_ROOT/logs/comprehensive-demo-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"
chmod 700 "$(dirname "$LOG_FILE")"

# セキュアログ関数
log() {
    local message="$*"
    # 機密情報をマスク
    message=$(echo "$message" | sed -E 's/[0-9]{12}/***ACCOUNT***/g')
    message=$(echo "$message" | sed -E 's/arn:aws:[^:]*:[^:]*:[0-9]{12}:[^[:space:]]*/***ARN***/g')
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

error() {
    local message="$*"
    # 機密情報をマスク
    message=$(echo "$message" | sed -E 's/[0-9]{12}/***ACCOUNT***/g')
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $message" | tee -a "$LOG_FILE" >&2
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

Embedding Batch Workloadの包括的なデモンストレーション

オプション:
    --method METHOD      デプロイメント方法 (cdk, cloudformation, both)
    --config CONFIG      設定ファイル (minimal, production, multi-account)
    --cleanup           デモ終了後にリソースをクリーンアップ
    --interactive       インタラクティブモードで実行
    --dry-run           実際のデプロイは行わず、手順のみ表示
    -h, --help          このヘルプを表示

例:
    $0 --method cdk --config minimal
    $0 --method both --config production --cleanup
    $0 --interactive

EOF
}

# 入力値検証関数
validate_deploy_method() {
    local method="$1"
    case "$method" in
        cdk|cloudformation|both)
            return 0
            ;;
        *)
            error "無効なデプロイメント方法: $method"
            error "有効な値: cdk, cloudformation, both"
            return 1
            ;;
    esac
}

validate_config_type() {
    local config="$1"
    case "$config" in
        minimal|production|multi-account)
            return 0
            ;;
        *)
            error "無効な設定タイプ: $config"
            error "有効な値: minimal, production, multi-account"
            return 1
            ;;
    esac
}

# 前提条件チェック
check_prerequisites() {
    log "前提条件チェック中..."
    
    # AWS CLI確認
    if ! command -v aws &> /dev/null; then
        error "AWS CLIがインストールされていません"
        return 1
    fi
    
    # Node.js確認
    if ! command -v node &> /dev/null; then
        error "Node.jsがインストールされていません"
        return 1
    fi
    
    # CDK確認
    if ! command -v cdk &> /dev/null; then
        error "AWS CDKがインストールされていません"
        return 1
    fi
    
    # jq確認
    if ! command -v jq &> /dev/null; then
        error "jqがインストールされていません"
        return 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS認証が設定されていません"
        return 1
    fi
    
    log "前提条件チェック完了"
}

# デモ設定ファイル生成
generate_demo_config() {
    log "デモ設定ファイル生成中..."
    
    local config_file="$PROJECT_ROOT/config/demo-config.json"
    mkdir -p "$(dirname "$config_file")"
    
    cat > "$config_file" << EOF
{
  "projectName": "$DEMO_PROJECT_NAME",
  "environment": "$DEMO_ENVIRONMENT",
  "region": "$DEMO_REGION",
  "vpc": {
    "mode": "create",
    "create": {
      "cidrBlock": "10.0.0.0/16",
      "availabilityZones": 2
    }
  },
  "fsx": {
    "mode": "create",
    "create": {
      "storageCapacity": 1024,
      "throughputCapacity": 128,
      "deploymentType": "SINGLE_AZ_1"
    }
  },
  "batch": {
    "computeEnvironment": {
      "maxvCpus": 50,
      "minvCpus": 0,
      "desiredvCpus": 0,
      "instanceTypes": ["m5.large"],
      "useSpotInstances": true
    }
  }
}
EOF
    
    chmod 600 "$config_file"
    log "デモ設定ファイル生成完了: $config_file"
}

# CDKデモ実行
run_cdk_demo() {
    log "CDKデモ実行開始"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] CDKデプロイメント手順:"
        log "[DRY-RUN] 1. cd $PROJECT_ROOT/cdk"
        log "[DRY-RUN] 2. npm install"
        log "[DRY-RUN] 3. npm run build"
        log "[DRY-RUN] 4. npx cdk bootstrap"
        log "[DRY-RUN] 5. npx cdk deploy"
        return 0
    fi
    
    cd "$PROJECT_ROOT/cdk" || {
        error "CDKディレクトリが見つかりません: $PROJECT_ROOT/cdk"
        return 1
    }
    
    log "CDK依存関係インストール中..."
    npm install
    
    log "CDKビルド実行中..."
    npm run build
    
    log "CDKブートストラップ実行中..."
    npx cdk bootstrap
    
    log "CDKデプロイ実行中..."
    npx cdk deploy --require-approval never
    
    log "CDKデモ実行完了"
}

# CloudFormationデモ実行
run_cloudformation_demo() {
    log "CloudFormationデモ実行開始"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] CloudFormationデプロイメント手順:"
        log "[DRY-RUN] 1. テンプレート検証"
        log "[DRY-RUN] 2. パラメータファイル生成"
        log "[DRY-RUN] 3. スタック作成"
        return 0
    fi
    
    local template_file="$PROJECT_ROOT/cloudformation/templates/embedding-workload-stack.template.json"
    local param_file="$PROJECT_ROOT/parameters/demo-parameters.json"
    
    if [[ ! -f "$template_file" ]]; then
        error "CloudFormationテンプレートが見つかりません: $template_file"
        return 1
    fi
    
    log "CloudFormationテンプレート検証中..."
    aws cloudformation validate-template --template-body "file://$template_file"
    
    log "CloudFormationデプロイ実行中..."
    aws cloudformation deploy \
        --template-file "$template_file" \
        --stack-name "$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT" \
        --parameter-overrides "file://$param_file" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
    
    log "CloudFormationデモ実行完了"
}

# デプロイメント検証
validate_deployment() {
    log "デプロイメント検証中..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] 検証手順をスキップ"
        return 0
    fi
    
    # スタック状態確認
    local stack_name="$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT"
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$stack_status" == *"COMPLETE"* ]]; then
        log "デプロイメント検証成功: $stack_status"
    else
        error "デプロイメント検証失敗: $stack_status"
        return 1
    fi
}

# リソースクリーンアップ
cleanup_resources() {
    log "リソースクリーンアップ開始"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] クリーンアップ手順をスキップ"
        return 0
    fi
    
    local stack_name="$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT"
    
    log "スタック削除中: $stack_name"
    aws cloudformation delete-stack --stack-name "$stack_name"
    
    log "スタック削除完了待機中..."
    aws cloudformation wait stack-delete-complete --stack-name "$stack_name"
    
    log "リソースクリーンアップ完了"
}

# デフォルト値
DEPLOY_METHOD="both"
CONFIG_TYPE="minimal"
CLEANUP=false
INTERACTIVE=false
DRY_RUN=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --method)
            if ! validate_deploy_method "$2"; then
                exit 1
            fi
            DEPLOY_METHOD="$2"
            shift 2
            ;;
        --config)
            if ! validate_config_type "$2"; then
                exit 1
            fi
            CONFIG_TYPE="$2"
            shift 2
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
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

# インタラクティブモード
interactive_mode() {
    log "インタラクティブモード開始"
    
    echo "デプロイメント方法を選択してください:"
    echo "1) CDK"
    echo "2) CloudFormation"
    echo "3) 両方"
    read -p "選択 (1-3): " method_choice
    
    case $method_choice in
        1) DEPLOY_METHOD="cdk" ;;
        2) DEPLOY_METHOD="cloudformation" ;;
        3) DEPLOY_METHOD="both" ;;
        *) error "無効な選択です"; exit 1 ;;
    esac
    
    echo "設定タイプを選択してください:"
    echo "1) Minimal"
    echo "2) Production"
    echo "3) Multi-account"
    read -p "選択 (1-3): " config_choice
    
    case $config_choice in
        1) CONFIG_TYPE="minimal" ;;
        2) CONFIG_TYPE="production" ;;
        3) CONFIG_TYPE="multi-account" ;;
        *) error "無効な選択です"; exit 1 ;;
    esac
    
    read -p "デモ終了後にリソースをクリーンアップしますか？ (y/N): " cleanup_choice
    if [[ "$cleanup_choice" =~ ^[Yy]$ ]]; then
        CLEANUP=true
    fi
    
    read -p "ドライランモードで実行しますか？ (y/N): " dryrun_choice
    if [[ "$dryrun_choice" =~ ^[Yy]$ ]]; then
        DRY_RUN=true
    fi
}

# メイン処理
main() {
    log "Embedding Batch Workload 包括的デモ開始"
    
    # インタラクティブモード処理
    if [[ "$INTERACTIVE" == "true" ]]; then
        interactive_mode
    fi
    
    log "設定: method=$DEPLOY_METHOD, config=$CONFIG_TYPE, cleanup=$CLEANUP, dry-run=$DRY_RUN"
    
    # 前提条件チェック
    if ! check_prerequisites; then
        exit 1
    fi
    
    # 設定ファイル生成
    generate_demo_config
    
    # デプロイメント実行
    case "$DEPLOY_METHOD" in
        cdk)
            run_cdk_demo
            ;;
        cloudformation)
            run_cloudformation_demo
            ;;
        both)
            run_cdk_demo
            run_cloudformation_demo
            ;;
    esac
    
    # 検証実行
    if ! validate_deployment; then
        error "デプロイメント検証に失敗しました"
        exit 1
    fi
    
    # クリーンアップ
    if [[ "$CLEANUP" == "true" ]]; then
        cleanup_resources
    fi
    
    log "包括的デモ完了"
    log "ログファイル: $LOG_FILE"
}

# スクリプト実行
main "$@"# 
インタラクティブモードの設定
setup_interactive_mode() {
    if [[ "$INTERACTIVE" != "true" ]]; then
        return
    fi
    
    log "インタラクティブモードを開始します"
    
    echo "デプロイメント方法を選択してください:"
    echo "1) CDK のみ"
    echo "2) CloudFormation のみ"
    echo "3) 両方"
    read -p "選択 (1-3): " method_choice
    
    case "$method_choice" in
        1) DEPLOY_METHOD="cdk" ;;
        2) DEPLOY_METHOD="cloudformation" ;;
        3) DEPLOY_METHOD="both" ;;
        *) DEPLOY_METHOD="both" ;;
    esac
    
    echo "設定タイプを選択してください:"
    echo "1) 最小構成 (開発・テスト用)"
    echo "2) 本番構成 (フル機能)"
    echo "3) マルチアカウント構成 (エンタープライズ)"
    read -p "選択 (1-3): " config_choice
    
    case "$config_choice" in
        1) CONFIG_TYPE="minimal" ;;
        2) CONFIG_TYPE="production" ;;
        3) CONFIG_TYPE="multi-account" ;;
        *) CONFIG_TYPE="minimal" ;;
    esac
    
    read -p "デモ終了後にリソースをクリーンアップしますか？ (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        CLEANUP=true
    fi
    
    log "設定完了: 方法=$DEPLOY_METHOD, 設定=$CONFIG_TYPE, クリーンアップ=$CLEANUP"
}

# 前提条件の確認
check_prerequisites() {
    log "前提条件を確認中..."
    
    local missing_tools=()
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        missing_tools+=("aws-cli")
    fi
    
    # Node.js (CDK用)
    if [[ "$DEPLOY_METHOD" == "cdk" ]] || [[ "$DEPLOY_METHOD" == "both" ]]; then
        if ! command -v node &> /dev/null; then
            missing_tools+=("node.js")
        fi
        if ! command -v npm &> /dev/null; then
            missing_tools+=("npm")
        fi
    fi
    
    # jq
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "以下のツールが必要です: ${missing_tools[*]}"
        log "インストール方法:"
        for tool in "${missing_tools[@]}"; do
            case "$tool" in
                "aws-cli")
                    log "  AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
                    ;;
                "node.js")
                    log "  Node.js: https://nodejs.org/en/download/"
                    ;;
                "npm")
                    log "  npm: Node.jsと一緒にインストールされます"
                    ;;
                "jq")
                    log "  jq: https://stedolan.github.io/jq/download/"
                    ;;
            esac
        done
        exit 1
    fi
    
    # AWS認証情報の確認
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS認証情報が設定されていません"
        log "aws configure を実行して認証情報を設定してください"
        exit 1
    fi
    
    log "前提条件の確認完了"
}

# デモ環境の準備
prepare_demo_environment() {
    log "デモ環境を準備中..."
    
    # 設定ファイルの選択
    local config_file
    case "$CONFIG_TYPE" in
        "minimal")
            config_file="$PROJECT_ROOT/examples/cdk/minimal-config.json"
            ;;
        "production")
            config_file="$PROJECT_ROOT/examples/cdk/production-config.json"
            ;;
        "multi-account")
            config_file="$PROJECT_ROOT/examples/cdk/multi-account-config.json"
            ;;
        *)
            config_file="$PROJECT_ROOT/examples/cdk/minimal-config.json"
            ;;
    esac
    
    if [[ ! -f "$config_file" ]]; then
        error "設定ファイルが見つかりません: $config_file"
        exit 1
    fi
    
    # デモ用設定の作成
    local demo_config_file="$PROJECT_ROOT/demo-config.json"
    jq --arg project "$DEMO_PROJECT_NAME" \
       --arg env "$DEMO_ENVIRONMENT" \
       --arg region "$DEMO_REGION" \
       '.projectName = $project | .environment = $env | .region = $region' \
       "$config_file" > "$demo_config_file"
    
    log "デモ用設定ファイルを作成: $demo_config_file"
    log "設定内容:"
    jq -r 'to_entries[] | "  \(.key): \(.value)"' "$demo_config_file" | head -10
    
    log "デモ環境の準備完了"
}

# CDKデモの実行
run_cdk_demo() {
    log "=== CDK デモンストレーション開始 ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY-RUN: CDKデプロイメント手順を表示"
        show_cdk_steps
        return
    fi
    
    log "CDKプロジェクトのセットアップ中..."
    cd "$PROJECT_ROOT/cdk"
    
    # 依存関係のインストール
    if [[ ! -d "node_modules" ]]; then
        log "依存関係をインストール中..."
        npm install
    fi
    
    # TypeScriptのコンパイル
    log "TypeScriptをコンパイル中..."
    npm run build
    
    # CDK Bootstrap (必要に応じて)
    log "CDK Bootstrapの確認中..."
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit >/dev/null 2>&1; then
        log "CDK Bootstrapを実行中..."
        npx cdk bootstrap
    fi
    
    # CDK Deploy
    log "CDKスタックをデプロイ中..."
    npx cdk deploy \
        --context configFile="../demo-config.json" \
        --require-approval never \
        --outputs-file "../cdk-outputs.json"
    
    # 出力の表示
    if [[ -f "../cdk-outputs.json" ]]; then
        log "CDKデプロイメント出力:"
        jq -r 'to_entries[] | "  \(.key): \(.value)"' "../cdk-outputs.json"
    fi
    
    log "=== CDK デモンストレーション完了 ==="
}

# CloudFormationデモの実行
run_cloudformation_demo() {
    log "=== CloudFormation デモンストレーション開始 ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY-RUN: CloudFormationデプロイメント手順を表示"
        show_cloudformation_steps
        return
    fi
    
    # パラメータファイルの選択
    local param_file
    case "$CONFIG_TYPE" in
        "minimal")
            param_file="$PROJECT_ROOT/examples/cloudformation/minimal-parameters.json"
            ;;
        "production")
            param_file="$PROJECT_ROOT/cloudformation/parameters/prod-parameters.json"
            ;;
        *)
            param_file="$PROJECT_ROOT/examples/cloudformation/minimal-parameters.json"
            ;;
    esac
    
    # デモ用パラメータファイルの作成
    local demo_param_file="$PROJECT_ROOT/demo-parameters.json"
    jq --arg project "$DEMO_PROJECT_NAME" \
       --arg env "$DEMO_ENVIRONMENT" \
       'map(if .ParameterKey == "ProjectName" then .ParameterValue = $project elif .ParameterKey == "Environment" then .ParameterValue = $env else . end)' \
       "$param_file" > "$demo_param_file"
    
    log "CloudFormationスタックをデプロイ中..."
    aws cloudformation deploy \
        --template-file "$PROJECT_ROOT/cloudformation/templates/embedding-workload-stack.template.json" \
        --stack-name "$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT-stack" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --parameters "file://$demo_param_file" \
        --tags \
            Project="$DEMO_PROJECT_NAME" \
            Environment="$DEMO_ENVIRONMENT" \
            Demo=true
    
    # スタック出力の表示
    log "CloudFormationデプロイメント出力:"
    aws cloudformation describe-stacks \
        --stack-name "$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT-stack" \
        --query 'Stacks[0].Outputs[?OutputKey && OutputValue].[OutputKey,OutputValue]' \
        --output table
    
    log "=== CloudFormation デモンストレーション完了 ==="
}

# CDK手順の表示
show_cdk_steps() {
    cat << EOF

=== CDK デプロイメント手順 ===

1. 前提条件の確認
   - Node.js と npm のインストール
   - AWS CLI の設定
   - AWS CDK のインストール: npm install -g aws-cdk

2. プロジェクトのセットアップ
   cd cdk/
   npm install
   npm run build

3. CDK Bootstrap (初回のみ)
   npx cdk bootstrap

4. 設定ファイルの準備
   - examples/cdk/minimal-config.json (最小構成)
   - examples/cdk/production-config.json (本番構成)
   - examples/cdk/multi-account-config.json (マルチアカウント)

5. デプロイメント
   npx cdk deploy --context configFile="../examples/cdk/minimal-config.json"

6. 確認
   npx cdk list
   npx cdk diff

7. クリーンアップ (必要に応じて)
   npx cdk destroy

EOF
}

# CloudFormation手順の表示
show_cloudformation_steps() {
    cat << EOF

=== CloudFormation デプロイメント手順 ===

1. 前提条件の確認
   - AWS CLI のインストールと設定

2. テンプレートの準備
   - cloudformation/templates/embedding-workload-stack.template.json

3. パラメータファイルの準備
   - examples/cloudformation/minimal-parameters.json (最小構成)
   - cloudformation/parameters/prod-parameters.json (本番構成)

4. テンプレートの検証
   aws cloudformation validate-template \\
     --template-body file://cloudformation/templates/embedding-workload-stack.template.json

5. デプロイメント
   aws cloudformation deploy \\
     --template-file cloudformation/templates/embedding-workload-stack.template.json \\
     --stack-name embedding-workload-stack \\
     --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \\
     --parameters file://examples/cloudformation/minimal-parameters.json

6. 確認
   aws cloudformation describe-stacks --stack-name embedding-workload-stack
   aws cloudformation list-stack-resources --stack-name embedding-workload-stack

7. クリーンアップ (必要に応じて)
   aws cloudformation delete-stack --stack-name embedding-workload-stack

EOF
}

# リソースのテスト
test_deployed_resources() {
    log "=== デプロイされたリソースのテスト開始 ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY-RUN: リソーステスト手順を表示"
        show_test_steps
        return
    fi
    
    # Batch Job Queueの確認
    log "Batch Job Queueを確認中..."
    local job_queues
    job_queues=$(aws batch describe-job-queues \
        --query "jobQueues[?starts_with(jobQueueName, '$DEMO_PROJECT_NAME')].jobQueueName" \
        --output text)
    
    if [[ -n "$job_queues" ]]; then
        log "✅ Batch Job Queue が見つかりました: $job_queues"
    else
        log "❌ Batch Job Queue が見つかりません"
    fi
    
    # S3バケットの確認
    log "S3バケットを確認中..."
    local s3_buckets
    s3_buckets=$(aws s3api list-buckets \
        --query "Buckets[?starts_with(Name, '$DEMO_PROJECT_NAME')].Name" \
        --output text)
    
    if [[ -n "$s3_buckets" ]]; then
        log "✅ S3バケットが見つかりました: $s3_buckets"
    else
        log "❌ S3バケットが見つかりません"
    fi
    
    # DynamoDBテーブルの確認
    log "DynamoDBテーブルを確認中..."
    local dynamo_tables
    dynamo_tables=$(aws dynamodb list-tables \
        --query "TableNames[?starts_with(@, '$DEMO_PROJECT_NAME')]" \
        --output text)
    
    if [[ -n "$dynamo_tables" ]]; then
        log "✅ DynamoDBテーブルが見つかりました: $dynamo_tables"
    else
        log "❌ DynamoDBテーブルが見つかりません"
    fi
    
    log "=== リソーステスト完了 ==="
}

# テスト手順の表示
show_test_steps() {
    cat << EOF

=== リソーステスト手順 ===

1. Batch リソースの確認
   aws batch describe-job-queues
   aws batch describe-compute-environments

2. S3 バケットの確認
   aws s3 ls
   aws s3api get-bucket-location --bucket <bucket-name>

3. DynamoDB テーブルの確認
   aws dynamodb list-tables
   aws dynamodb describe-table --table-name <table-name>

4. IAM ロールの確認
   aws iam list-roles --query "Roles[?starts_with(RoleName, 'embedding-workload')]"

5. CloudWatch ログの確認
   aws logs describe-log-groups --log-group-name-prefix "/aws/batch/job"

6. SNS トピックの確認
   aws sns list-topics

EOF
}

# クリーンアップの実行
cleanup_resources() {
    if [[ "$CLEANUP" != "true" ]]; then
        return
    fi
    
    log "=== リソースのクリーンアップ開始 ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY-RUN: クリーンアップ手順を表示"
        show_cleanup_steps
        return
    fi
    
    # CDKスタックの削除
    if [[ "$DEPLOY_METHOD" == "cdk" ]] || [[ "$DEPLOY_METHOD" == "both" ]]; then
        log "CDKスタックを削除中..."
        cd "$PROJECT_ROOT/cdk"
        npx cdk destroy --force --context configFile="../demo-config.json" || true
    fi
    
    # CloudFormationスタックの削除
    if [[ "$DEPLOY_METHOD" == "cloudformation" ]] || [[ "$DEPLOY_METHOD" == "both" ]]; then
        log "CloudFormationスタックを削除中..."
        aws cloudformation delete-stack \
            --stack-name "$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT-stack" || true
        
        # 削除完了まで待機
        log "スタック削除の完了を待機中..."
        aws cloudformation wait stack-delete-complete \
            --stack-name "$DEMO_PROJECT_NAME-$DEMO_ENVIRONMENT-stack" || true
    fi
    
    # 一時ファイルの削除
    log "一時ファイルを削除中..."
    rm -f "$PROJECT_ROOT/demo-config.json"
    rm -f "$PROJECT_ROOT/demo-parameters.json"
    rm -f "$PROJECT_ROOT/cdk-outputs.json"
    
    log "=== クリーンアップ完了 ==="
}

# クリーンアップ手順の表示
show_cleanup_steps() {
    cat << EOF

=== クリーンアップ手順 ===

1. CDK スタックの削除
   cd cdk/
   npx cdk destroy

2. CloudFormation スタックの削除
   aws cloudformation delete-stack --stack-name <stack-name>
   aws cloudformation wait stack-delete-complete --stack-name <stack-name>

3. 手動削除が必要な場合があるリソース
   - S3 バケット (オブジェクトが含まれている場合)
   - CloudWatch ログ
   - FSx ファイルシステム (既存のものを使用した場合)

4. 一時ファイルの削除
   rm -f demo-config.json demo-parameters.json cdk-outputs.json

EOF
}

# サマリーの表示
show_summary() {
    log "=== デモンストレーション サマリー ==="
    
    log "実行された内容:"
    log "  - デプロイメント方法: $DEPLOY_METHOD"
    log "  - 設定タイプ: $CONFIG_TYPE"
    log "  - プロジェクト名: $DEMO_PROJECT_NAME"
    log "  - 環境: $DEMO_ENVIRONMENT"
    log "  - リージョン: $DEMO_REGION"
    log "  - クリーンアップ: $CLEANUP"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "  - モード: DRY-RUN (実際のデプロイは実行されませんでした)"
    fi
    
    log ""
    log "📚 参考ドキュメント:"
    log "  - CDK Deployment Guide: docs/CDK_DEPLOYMENT_GUIDE.md"
    log "  - CloudFormation Deployment Guide: docs/CLOUDFORMATION_DEPLOYMENT_GUIDE.md"
    log "  - Configuration Guide: docs/CONFIGURATION_GUIDE.md"
    log "  - Troubleshooting Guide: docs/CDK_TROUBLESHOOTING_GUIDE.md"
    
    log ""
    log "🔗 便利なリンク:"
    log "  - AWS Console: https://console.aws.amazon.com/"
    log "  - CloudFormation: https://console.aws.amazon.com/cloudformation/"
    log "  - Batch: https://console.aws.amazon.com/batch/"
    log "  - Bedrock: https://console.aws.amazon.com/bedrock/"
    
    log ""
    log "ログファイル: $LOG_FILE"
    
    log "=== デモンストレーション完了 ==="
}

# メイン実行
main() {
    log "Embedding Batch Workload 包括的デモンストレーションを開始"
    
    # インタラクティブモードの設定
    setup_interactive_mode
    
    # 前提条件の確認
    check_prerequisites
    
    # デモ環境の準備
    prepare_demo_environment
    
    # デプロイメントの実行
    case "$DEPLOY_METHOD" in
        "cdk")
            run_cdk_demo
            ;;
        "cloudformation")
            run_cloudformation_demo
            ;;
        "both")
            run_cdk_demo
            run_cloudformation_demo
            ;;
        *)
            error "無効なデプロイメント方法: $DEPLOY_METHOD"
            exit 1
            ;;
    esac
    
    # リソースのテスト
    test_deployed_resources
    
    # クリーンアップの実行
    cleanup_resources
    
    # サマリーの表示
    show_summary
}

# スクリプト実行
main "$@"