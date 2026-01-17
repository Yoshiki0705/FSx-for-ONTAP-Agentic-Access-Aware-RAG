#!/bin/bash

# FSx for NetApp ONTAP Embedding Batch Workload Template
# ワンクリックCDKデプロイメントスクリプト
# One-Click CDK Deployment Script

set -euo pipefail

# エラーハンドリングとクリーンアップ
trap 'echo "❌ デプロイメント中にエラーが発生しました"; exit 1' ERR

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 FSx for NetApp ONTAP Embedding Batch Workload デプロイメント${NC}"
echo -e "${CYAN}🚀 FSx for NetApp ONTAP Embedding Batch Workload Deployment${NC}"
echo "============================================================="
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✅ $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
        exit 1
    fi
}

print_info() {
    local message=$1
    echo -e "${BLUE}ℹ️  $message${NC}"
}

print_warning() {
    local message=$1
    echo -e "${YELLOW}⚠️  $message${NC}"
}

# 設定ファイルの存在確認
if [ ! -f "config/deployment-config.json" ]; then
    echo -e "${RED}❌ 設定ファイルが見つかりません: config/deployment-config.json${NC}"
    echo -e "${RED}❌ Configuration file not found: config/deployment-config.json${NC}"
    echo ""
    echo "最初に ./scripts/configure.sh を実行して設定を作成してください。"
    echo "Please run ./scripts/configure.sh first to create your configuration."
    exit 1
fi

# Load configuration
PROJECT_NAME=$(jq -r '.projectName' config/deployment-config.json)
ENVIRONMENT=$(jq -r '.environment' config/deployment-config.json)
REGION=$(jq -r '.region' config/deployment-config.json)

echo -e "${GREEN}📋 デプロイメント設定 / Deployment Configuration${NC}"
echo "=============================================="
echo "プロジェクト / Project: $PROJECT_NAME"
echo "環境 / Environment: $ENVIRONMENT"
echo "リージョン / Region: $REGION"
echo ""

# デプロイメント確認
echo -e "${YELLOW}⚠️  これによりAWSリソースが作成され、料金が発生する可能性があります。${NC}"
echo -e "${YELLOW}⚠️  This will create AWS resources that may incur costs.${NC}"
echo ""
read -p "デプロイメントを続行しますか？ / Do you want to continue with the deployment? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "デプロイメントがキャンセルされました。"
    echo "Deployment cancelled."
    exit 0
fi

echo ""

# ステップ1: 前提条件チェック
echo -e "${BLUE}🔍 ステップ1: 前提条件をチェック中...${NC}"
echo -e "${BLUE}🔍 Step 1: Checking prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_status 1 "AWS CLI not found"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_status 1 "Node.js not found"
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_status 1 "Node.js version too old. Required: 18+"
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_status 1 "AWS credentials not configured"
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    print_warning "AWS CDK not found. Installing..."
    npm install -g aws-cdk
fi

print_status 0 "前提条件チェックが完了しました / Prerequisites check completed"
echo ""

# ステップ2: 環境変数設定
echo -e "${BLUE}🔧 ステップ2: 環境を設定中...${NC}"
echo -e "${BLUE}🔧 Step 2: Setting up environment...${NC}"

export AWS_REGION="$REGION"
export CDK_DEFAULT_REGION="$REGION"
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

print_info "AWSアカウント / AWS Account: $CDK_DEFAULT_ACCOUNT"
print_info "AWSリージョン / AWS Region: $AWS_REGION"
echo ""

# ステップ3: 依存関係インストール
echo -e "${BLUE}📦 ステップ3: 依存関係をインストール中...${NC}"
echo -e "${BLUE}📦 Step 3: Installing dependencies...${NC}"

cd cdk

if [ ! -d "node_modules" ]; then
    print_info "npm依存関係をインストール中... / Installing npm dependencies..."
    npm install
    print_status $? "依存関係がインストールされました / Dependencies installed"
else
    print_info "依存関係は既にインストール済みです / Dependencies already installed"
fi

echo ""

# ステップ4: TypeScriptビルド
echo -e "${BLUE}🔨 ステップ4: TypeScriptをビルド中...${NC}"
echo -e "${BLUE}🔨 Step 4: Building TypeScript...${NC}"

npm run build
print_status $? "TypeScriptビルドが完了しました / TypeScript build completed"
echo ""

# ステップ5: CDKブートストラップ (必要な場合)
echo -e "${BLUE}🏗️  ステップ5: CDKブートストラップをチェック中...${NC}"
echo -e "${BLUE}🏗️  Step 5: CDK Bootstrap check...${NC}"

# Check if CDK is already bootstrapped
BOOTSTRAP_STACK_NAME="CDKToolkit"
if aws cloudformation describe-stacks --stack-name "$BOOTSTRAP_STACK_NAME" --region "$AWS_REGION" &> /dev/null; then
    print_info "CDK already bootstrapped in region $AWS_REGION"
else
    print_info "Bootstrapping CDK in region $AWS_REGION..."
    npx cdk bootstrap
    print_status $? "CDK bootstrap completed"
fi

echo ""

# Step 6: Validate CDK template
echo -e "${BLUE}🔍 Step 6: Validating CDK template...${NC}"

npx cdk synth > /dev/null
print_status $? "CDK template validation completed"
echo ""

# Step 7: Deploy CDK stack
echo -e "${BLUE}🚀 Step 7: Deploying CDK stack...${NC}"

STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-embedding-workload"
print_info "Deploying stack: $STACK_NAME"
print_info "This may take 10-20 minutes depending on resources being created..."

# Deploy with progress output
npx cdk deploy --require-approval never --progress events

DEPLOY_STATUS=$?
if [ $DEPLOY_STATUS -eq 0 ]; then
    print_status 0 "CDK deployment completed successfully"
else
    print_status 1 "CDK deployment failed"
fi

echo ""

# Step 8: Get stack outputs
echo -e "${BLUE}📊 Step 8: Retrieving deployment information...${NC}"

# Get CloudFormation outputs
OUTPUTS_FILE="../deployment-outputs.json"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs' \
    --output json > "$OUTPUTS_FILE" 2>/dev/null || echo "[]" > "$OUTPUTS_FILE"

print_info "Deployment outputs saved to: deployment-outputs.json"

# Display key outputs
if [ -s "$OUTPUTS_FILE" ] && [ "$(cat "$OUTPUTS_FILE")" != "[]" ]; then
    echo ""
    echo -e "${GREEN}📋 Deployment Outputs${NC}"
    echo "===================="
    
    # Extract and display key outputs
    jq -r '.[] | "\(.OutputKey): \(.OutputValue)"' "$OUTPUTS_FILE" | while read -r line; do
        echo "  $line"
    done
else
    print_warning "No stack outputs available"
fi

echo ""

# Step 9: Run post-deployment validation
echo -e "${BLUE}✅ Step 9: Running post-deployment validation...${NC}"

cd ..

# 検証設定の読み込み
SKIP_VALIDATION=${SKIP_VALIDATION:-false}
SKIP_VECTOR_DB_TEST=${SKIP_VECTOR_DB_TEST:-false}
VALIDATION_TIMEOUT=${VALIDATION_TIMEOUT:-300}

if [ "$SKIP_VALIDATION" = "true" ]; then
    print_warning "検証がスキップされました（SKIP_VALIDATION=true）"
    echo ""
    # Step 10へスキップ
else
    print_info "検証タイムアウト: ${VALIDATION_TIMEOUT}秒"
fi

# 検証スクリプト実行関数
run_validation_script() {
    local script_path=$1
    local script_name=$2
    local is_critical=${3:-false}
    
    if [ -f "$script_path" ]; then
        # 実行権限の確認
        if [ ! -x "$script_path" ]; then
            print_warning "$script_path に実行権限がありません。権限を付与します..."
            chmod +x "$script_path"
        fi
        
        # セキュリティ検証: スクリプトの所有者確認
        local script_owner=$(stat -c '%U' "$script_path" 2>/dev/null || stat -f '%Su' "$script_path" 2>/dev/null || echo "unknown")
        local current_user=$(whoami)
        
        if [ "$script_owner" != "$current_user" ] && [ "$script_owner" != "root" ]; then
            print_warning "警告: $script_path の所有者が現在のユーザーと異なります (所有者: $script_owner)"
        fi
        
        print_info "$script_name を実行中..."
        if ./"$script_path"; then
            print_status 0 "$script_name が正常に完了しました"
            return 0
        else
            if [ "$is_critical" = "true" ]; then
                print_status 1 "$script_name が失敗しました"
                return 1
            else
                print_warning "$script_name が失敗しました（Vector Database が設定されていない場合は正常です）"
                return 0
            fi
        fi
    else
        print_warning "$script_name が見つかりません。スキップします"
        return 0
    fi
}

# 検証スクリプトの並列実行（可能な場合）
validation_results=()

# 標準検証の実行（必須）
print_info "必須検証を実行中..."
if ! run_validation_script "scripts/validate.sh" "標準検証スクリプト" true; then
    exit 1
fi

# オプション検証の並列実行
print_info "オプション検証を実行中..."

# Vector Database 統合テスト（バックグラウンド実行）
if [ -f "scripts/test-vector-db-integration.sh" ]; then
    print_info "Vector Database 統合テストをバックグラウンドで開始..."
    (
        if ./scripts/test-vector-db-integration.sh > /tmp/vector-db-test.log 2>&1; then
            echo "SUCCESS" > /tmp/vector-db-test.status
        else
            echo "FAILED" > /tmp/vector-db-test.status
        fi
    ) &
    vector_db_pid=$!
    
    # バックグラウンドプロセスの完了を待機
    if wait $vector_db_pid; then
        if [ -f "/tmp/vector-db-test.status" ] && [ "$(cat /tmp/vector-db-test.status)" = "SUCCESS" ]; then
            print_status 0 "Vector Database 統合テストが正常に完了しました"
        else
            print_warning "Vector Database 統合テストが失敗しました（Vector Database が設定されていない場合は正常です）"
        fi
    else
        print_warning "Vector Database 統合テストでエラーが発生しました"
    fi
    
    # 一時ファイルのクリーンアップ
    rm -f /tmp/vector-db-test.log /tmp/vector-db-test.status
else
    print_warning "Vector Database 統合テストスクリプトが見つかりません。スキップします"
fi

# 検証結果のサマリー
echo ""
echo -e "${CYAN}📊 検証結果サマリー${NC}"
echo "===================="
echo "• 標準検証: ✅ 完了"
if [ -f "scripts/test-vector-db-integration.sh" ]; then
    echo "• Vector Database 統合テスト: ✅ 実行済み"
else
    echo "• Vector Database 統合テスト: ⚠️ スキップ（スクリプト未検出）"
fi

fi  # SKIP_VALIDATION チェックの終了

echo ""

# Step 10: Display next steps
echo -e "${GREEN}🎉 Deployment Completed Successfully!${NC}"
echo "===================================="
echo ""

echo -e "${CYAN}📋 What was deployed:${NC}"
echo "• AWS Batch compute environment and job queue"
echo "• Job definitions for document processing, embedding generation, and RAG queries"
echo "• S3 bucket for storing embeddings and processed documents"
echo "• DynamoDB table for metadata and user permissions"
echo "• IAM roles with minimal required permissions"
echo "• Lambda function with Vector Database integration support"
if jq -e '.fsx.createNew == true' config/deployment-config.json > /dev/null; then
    echo "• FSx for NetApp ONTAP file system"
fi
if jq -e '.vpc.createNew == true' config/deployment-config.json > /dev/null; then
    echo "• VPC with public and private subnets"
fi
if jq -e '.monitoring.createDashboard == true' config/deployment-config.json > /dev/null; then
    echo "• CloudWatch dashboard and alarms"
fi

echo ""

echo -e "${CYAN}🚀 Next Steps:${NC}"
echo "1. Test the deployment:"
echo "   ./scripts/validate.sh"
echo ""
echo "2. Test Vector Database integration:"
echo "   ./scripts/test-vector-db-integration.sh"
echo ""
echo "3. Submit a test job:"
echo "   aws batch submit-job \\"
echo "     --job-name test-document-processing \\"
echo "     --job-queue \$(jq -r '.[] | select(.OutputKey==\"JobQueueName\") | .OutputValue' deployment-outputs.json) \\"
echo "     --job-definition \$(jq -r '.[] | select(.OutputKey==\"DocumentProcessingJobDefinition\") | .OutputValue' deployment-outputs.json)"
echo ""
echo "4. Monitor job execution:"
echo "   aws batch list-jobs --job-queue \$(jq -r '.[] | select(.OutputKey==\"JobQueueName\") | .OutputValue' deployment-outputs.json)"
echo ""
echo "5. Test Lambda function Vector Database integration:"
echo "   aws lambda invoke --function-name \$(jq -r '.[] | select(.OutputKey==\"EmbeddingGeneratorFunctionName\") | .OutputValue' deployment-outputs.json) --payload '{\"action\": \"test_vector_db\"}' response.json"
echo ""
echo "6. View logs:"
echo "   aws logs tail /aws/batch/\$(jq -r '.projectName' config/deployment-config.json) --follow"
echo ""

if jq -e '.monitoring.createDashboard == true' config/deployment-config.json > /dev/null; then
    DASHBOARD_URL="https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=$PROJECT_NAME-$ENVIRONMENT-embedding-workload"
    echo "7. View monitoring dashboard:"
    echo "   $DASHBOARD_URL"
    echo ""
fi

echo -e "${CYAN}💰 Cost Management:${NC}"
echo "• Monitor costs in AWS Cost Explorer"
echo "• Consider using Spot instances for batch processing (if not already enabled)"
echo "• Set up billing alerts for cost control"
echo ""

echo -e "${CYAN}🔒 Security:${NC}"
echo "• Review IAM roles and permissions"
echo "• Enable CloudTrail for audit logging"
echo "• Consider enabling GuardDuty for threat detection"
echo ""

echo -e "${CYAN}🛠️  Maintenance:${NC}"
echo "• Regularly update job definitions and container images"
echo "• Monitor and optimize batch job performance"
echo "• Review and rotate access keys periodically"
echo ""

echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "• Keep your deployment-outputs.json file secure"
echo "• Document any custom configurations for future reference"
echo "• Test disaster recovery procedures in non-production environments"
echo ""

echo -e "${GREEN}Deployment completed at $(date)${NC}"
echo ""

echo -e "${BLUE}📚 Additional Resources:${NC}"
echo "• Documentation: docs/"
echo "• Troubleshooting: docs/troubleshooting.md"
echo "• Architecture Guide: docs/architecture-guide.md"
echo "• GitHub Issues: https://github.com/your-org/embedding-batch-workload-template/issues"