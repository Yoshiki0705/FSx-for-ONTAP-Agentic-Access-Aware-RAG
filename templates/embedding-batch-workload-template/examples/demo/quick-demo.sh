#!/bin/bash
# クイックデモスクリプト - 5分でEmbedding Batch Workloadを体験

set -euo pipefail

# スクリプトディレクトリの取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

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
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# デモ設定
DEMO_PROJECT_NAME="embedding-demo-$(date +%s)"
DEMO_ENVIRONMENT="demo"
DEMO_CONFIG_FILE="${PROJECT_ROOT}/config/demo-config.json"
DEMO_METHOD="cdk"

# ウェルカムメッセージ
show_welcome() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    🚀 FSx for NetApp ONTAP Embedding Batch Workload - Quick Demo            ║
║                                                                              ║
║    このデモでは、5分でEmbedding Batch Workloadの主要機能を体験できます      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}デモ内容:${NC}"
    echo "  1. 前提条件の自動チェック"
    echo "  2. デモ用設定の自動生成"
    echo "  3. CDKまたはCloudFormationでのデプロイ"
    echo "  4. サンプルジョブの実行"
    echo "  5. 結果の確認"
    echo "  6. リソースのクリーンアップ"
    echo ""
    echo -e "${YELLOW}注意: このデモではAWSリソースが作成され、料金が発生する可能性があります${NC}"
    echo ""
    read -p "デモを開始しますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "デモを終了します"
        exit 0
    fi
}

# デプロイメント方式選択
select_deployment_method() {
    echo ""
    echo -e "${PURPLE}=== デプロイメント方式選択 ===${NC}"
    echo ""
    echo "1) CDK (推奨) - TypeScriptベースの高機能デプロイメント"
    echo "2) CloudFormation - AWS標準のテンプレートベースデプロイメント"
    echo ""
    read -p "デプロイメント方式を選択してください (1-2): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            DEMO_METHOD="cdk"
            info "CDKデプロイメントを選択しました"
            ;;
        2)
            DEMO_METHOD="cloudformation"
            info "CloudFormationデプロイメントを選択しました"
            ;;
        *)
            warning "無効な選択です。CDKを使用します"
            DEMO_METHOD="cdk"
            ;;
    esac
}

# 前提条件チェック
check_prerequisites() {
    log "前提条件をチェック中..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLIがインストールされていません"
        echo "インストール方法: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS認証が設定されていません"
        echo "設定方法: aws configure"
        exit 1
    fi
    
    # CDK固有チェック
    if [[ "$DEMO_METHOD" == "cdk" ]]; then
        if ! command -v node &> /dev/null; then
            error "Node.jsがインストールされていません"
            echo "インストール方法: https://nodejs.org/"
            exit 1
        fi
        
        if ! command -v npm &> /dev/null; then
            error "npmがインストールされていません"
            exit 1
        fi
        
        if ! npx cdk --version &> /dev/null; then
            warning "AWS CDKがインストールされていません。インストール中..."
            npm install -g aws-cdk
        fi
    fi
    
    # jq
    if ! command -v jq &> /dev/null; then
        warning "jqがインストールされていません。一部の機能が制限されます"
    fi
    
    success "前提条件チェック完了"
}

# デモ設定生成
generate_demo_config() {
    log "デモ用設定を生成中..."
    
    # AWS情報取得
    local aws_region
    aws_region=$(aws configure get region || echo "us-east-1")
    
    local aws_account_id
    aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    
    # デフォルトVPC取得
    local default_vpc_id
    default_vpc_id=$(aws ec2 describe-vpcs \
        --filters "Name=is-default,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null || echo "")
    
    if [[ "$default_vpc_id" == "None" || -z "$default_vpc_id" ]]; then
        warning "デフォルトVPCが見つかりません。新しいVPCを作成します"
        default_vpc_id=""
    fi
    
    # サブネット取得
    local subnet_ids=""
    if [[ -n "$default_vpc_id" ]]; then
        subnet_ids=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$default_vpc_id" "Name=default-for-az,Values=true" \
            --query 'Subnets[0:2].SubnetId' \
            --output text 2>/dev/null | tr '\t' ',' || echo "")
    fi
    
    # 設定ファイル作成
    mkdir -p "$(dirname "$DEMO_CONFIG_FILE")"
    
    cat > "$DEMO_CONFIG_FILE" << EOF
{
  "projectName": "$DEMO_PROJECT_NAME",
  "environment": "$DEMO_ENVIRONMENT",
  "region": "$aws_region",
  "description": "Quick demo configuration for Embedding Batch Workload",
  
  "vpc": {
    "createNew": $([ -z "$default_vpc_id" ] && echo "true" || echo "false"),
    $([ -n "$default_vpc_id" ] && echo "\"vpcId\": \"$default_vpc_id\",")
    $([ -n "$subnet_ids" ] && echo "\"privateSubnetIds\": [\"$(echo "$subnet_ids" | sed 's/,/","/g')\"],")
    "cidrBlock": "10.0.0.0/16"
  },
  
  "fsx": {
    "createNew": true,
    "storageCapacity": 1024,
    "throughputCapacity": 128,
    "deploymentType": "SINGLE_AZ_1"
  },
  
  "batch": {
    "maxvCpus": 20,
    "desiredvCpus": 0,
    "minvCpus": 0,
    "instanceTypes": ["t3.small", "t3.medium"],
    "enableSpotInstances": true,
    "bidPercentage": 50
  },
  
  "bedrock": {
    "region": "us-east-1",
    "modelId": "amazon.titan-embed-text-v1"
  },
  
  "storage": {
    "s3": {
      "createBucket": true,
      "bucketName": "",
      "enableVersioning": false
    },
    "dynamodb": {
      "createTable": true,
      "tableName": "",
      "billingMode": "PAY_PER_REQUEST"
    }
  },
  
  "monitoring": {
    "enableDetailedMonitoring": false,
    "createDashboard": true,
    "logRetentionDays": 1
  },
  
  "security": {
    "enableEncryption": false,
    "enableVpcFlowLogs": false
  },
  
  "tags": {
    "Environment": "$DEMO_ENVIRONMENT",
    "Project": "$DEMO_PROJECT_NAME",
    "Purpose": "demo",
    "Owner": "demo-user"
  }
}
EOF
    
    success "デモ設定生成完了: $DEMO_CONFIG_FILE"
    info "プロジェクト名: $DEMO_PROJECT_NAME"
    info "リージョン: $aws_region"
    info "アカウントID: $aws_account_id"
}

# デプロイメント実行
deploy_demo() {
    log "デモ環境をデプロイ中..."
    
    cd "$PROJECT_ROOT"
    
    # 統一デプロイメントスクリプト使用
    if [[ -f "scripts/unified-deploy.sh" ]]; then
        ./scripts/unified-deploy.sh \
            --method "$DEMO_METHOD" \
            --env "$DEMO_ENVIRONMENT" \
            --config "$DEMO_CONFIG_FILE" \
            --validate \
            --force
    else
        error "統一デプロイメントスクリプトが見つかりません"
        exit 1
    fi
    
    success "デプロイメント完了"
}

# サンプルデータ準備
prepare_sample_data() {
    log "サンプルデータを準備中..."
    
    local sample_dir="${PROJECT_ROOT}/examples/demo/sample-data"
    mkdir -p "$sample_dir"
    
    # サンプル文書作成
    cat > "$sample_dir/document1.txt" << 'EOF'
Amazon FSx for NetApp ONTAP is a fully managed service that provides highly reliable, scalable, high-performing, and feature-rich file storage built on NetApp's popular ONTAP file system. FSx for ONTAP combines the familiar features, performance, capabilities, and API operations of NetApp file systems with the agility, scalability, and simplicity of a fully managed AWS service.
EOF
    
    cat > "$sample_dir/document2.txt" << 'EOF'
AWS Batch enables developers, scientists, and engineers to easily and efficiently run hundreds of thousands of batch computing jobs on AWS. AWS Batch dynamically provisions the optimal quantity and type of compute resources (e.g., CPU or memory optimized instances) based on the volume and specific resource requirements of the batch jobs submitted.
EOF
    
    cat > "$sample_dir/document3.txt" << 'EOF'
Amazon Bedrock is a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies like AI21 Labs, Anthropic, Cohere, Meta, Stability AI, and Amazon via a single API, along with a broad set of capabilities you need to build generative AI applications with security, privacy, and responsible AI.
EOF
    
    success "サンプルデータ準備完了"
    info "サンプル文書: $sample_dir"
}

# サンプルジョブ実行
run_sample_jobs() {
    log "サンプルジョブを実行中..."
    
    # スタック名取得
    local stack_name="${DEMO_PROJECT_NAME}-${DEMO_ENVIRONMENT}"
    
    # Batchジョブキュー取得
    local job_queue
    job_queue=$(aws batch describe-job-queues \
        --query "jobQueues[?starts_with(jobQueueName, '$stack_name')].jobQueueName" \
        --output text | head -1)
    
    if [[ -z "$job_queue" ]]; then
        warning "Batchジョブキューが見つかりません。スキップします"
        return 0
    fi
    
    # ジョブ定義取得
    local job_definition
    job_definition=$(aws batch describe-job-definitions \
        --status ACTIVE \
        --query "jobDefinitions[?starts_with(jobDefinitionName, '$stack_name')].jobDefinitionArn" \
        --output text | head -1)
    
    if [[ -z "$job_definition" ]]; then
        warning "Batchジョブ定義が見つかりません。スキップします"
        return 0
    fi
    
    info "ジョブキュー: $job_queue"
    info "ジョブ定義: $job_definition"
    
    # サンプルジョブ実行
    local job_id
    job_id=$(aws batch submit-job \
        --job-name "demo-embedding-job-$(date +%s)" \
        --job-queue "$job_queue" \
        --job-definition "$job_definition" \
        --parameters inputPath="s3://demo-bucket/sample-data/",outputPath="s3://demo-bucket/results/" \
        --query 'jobId' \
        --output text)
    
    if [[ -n "$job_id" ]]; then
        success "サンプルジョブ実行完了"
        info "ジョブID: $job_id"
        
        # ジョブ状態監視
        log "ジョブ実行状況を監視中..."
        local attempts=0
        while [[ $attempts -lt 30 ]]; do
            local job_status
            job_status=$(aws batch describe-jobs \
                --jobs "$job_id" \
                --query 'jobs[0].status' \
                --output text)
            
            case "$job_status" in
                "SUCCEEDED")
                    success "ジョブが正常に完了しました"
                    break
                    ;;
                "FAILED")
                    error "ジョブが失敗しました"
                    aws batch describe-jobs --jobs "$job_id" --query 'jobs[0].statusReason' --output text
                    break
                    ;;
                "RUNNING")
                    info "ジョブ実行中... (${attempts}0秒経過)"
                    ;;
                *)
                    info "ジョブ状態: $job_status"
                    ;;
            esac
            
            sleep 10
            ((attempts++))
        done
    else
        warning "ジョブの実行に失敗しました"
    fi
}

# 結果確認
show_results() {
    log "デプロイメント結果を確認中..."
    
    echo ""
    echo -e "${PURPLE}=== デプロイメント結果 ===${NC}"
    
    # CloudFormationスタック確認
    local stack_name="${DEMO_PROJECT_NAME}-${DEMO_ENVIRONMENT}"
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$stack_status" == *"COMPLETE"* ]]; then
        success "CloudFormationスタック: $stack_status"
        
        # 出力値表示
        echo ""
        echo -e "${CYAN}スタック出力値:${NC}"
        aws cloudformation describe-stacks \
            --stack-name "$stack_name" \
            --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
            --output table 2>/dev/null || echo "出力値なし"
    else
        warning "CloudFormationスタック状態: $stack_status"
    fi
    
    # リソース一覧
    echo ""
    echo -e "${CYAN}作成されたリソース:${NC}"
    aws cloudformation describe-stack-resources \
        --stack-name "$stack_name" \
        --query 'StackResources[].[ResourceType,LogicalResourceId,ResourceStatus]' \
        --output table 2>/dev/null || echo "リソース情報取得エラー"
    
    # コスト概算
    echo ""
    echo -e "${YELLOW}推定コスト (1時間あたり):${NC}"
    echo "  - FSx for ONTAP (1TB): ~$0.20"
    echo "  - Batch (t3.small x 2): ~$0.04"
    echo "  - DynamoDB (オンデマンド): ~$0.01"
    echo "  - S3 (標準): ~$0.01"
    echo "  - その他: ~$0.04"
    echo "  合計概算: ~$0.30/時間"
}

# クリーンアップ
cleanup_demo() {
    echo ""
    echo -e "${PURPLE}=== クリーンアップ ===${NC}"
    echo ""
    read -p "デモリソースを削除しますか？ (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "デモリソースを削除中..."
        
        local stack_name="${DEMO_PROJECT_NAME}-${DEMO_ENVIRONMENT}"
        
        # CloudFormationスタック削除
        if aws cloudformation describe-stacks --stack-name "$stack_name" &> /dev/null; then
            aws cloudformation delete-stack --stack-name "$stack_name"
            
            log "スタック削除を開始しました。完了まで数分かかります..."
            
            # 削除完了待機（オプション）
            read -p "削除完了まで待機しますか？ (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                aws cloudformation wait stack-delete-complete --stack-name "$stack_name"
                success "スタック削除完了"
            else
                info "バックグラウンドで削除が続行されます"
                info "確認方法: aws cloudformation describe-stacks --stack-name $stack_name"
            fi
        else
            warning "削除対象のスタックが見つかりません"
        fi
        
        # 設定ファイル削除
        if [[ -f "$DEMO_CONFIG_FILE" ]]; then
            rm -f "$DEMO_CONFIG_FILE"
            info "デモ設定ファイルを削除しました"
        fi
        
        success "クリーンアップ完了"
    else
        warning "リソースは保持されます。手動で削除してください:"
        echo "  aws cloudformation delete-stack --stack-name ${DEMO_PROJECT_NAME}-${DEMO_ENVIRONMENT}"
    fi
}

# 終了メッセージ
show_completion() {
    echo ""
    echo -e "${PURPLE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    🎉 デモ完了！ Embedding Batch Workloadをお試しいただきありがとうございます ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}次のステップ:${NC}"
    echo "  1. 詳細なドキュメントを確認: docs/"
    echo "  2. 本格的な設定でデプロイ: examples/"
    echo "  3. カスタマイズ: cdk/lib/constructs/"
    echo "  4. コミュニティに参加: GitHub Discussions"
    echo ""
    echo -e "${YELLOW}サポート:${NC}"
    echo "  - GitHub Issues: バグ報告・機能要求"
    echo "  - Documentation: 包括的なガイド"
    echo "  - Community: GitHub Discussions"
    echo ""
    echo -e "${GREEN}Happy Embedding! 🚀${NC}"
}

# メイン処理
main() {
    show_welcome
    select_deployment_method
    check_prerequisites
    generate_demo_config
    deploy_demo
    prepare_sample_data
    run_sample_jobs
    show_results
    cleanup_demo
    show_completion
}

# エラーハンドリング
trap 'error "デモ実行中にエラーが発生しました"; exit 1' ERR

# スクリプト実行
main "$@"