#!/bin/bash

# FSx for NetApp ONTAP Embedding Batch Workload Template
# 前提条件チェックスクリプト
# Prerequisites Check Script

set -euo pipefail

# スクリプト設定
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="/tmp/${SCRIPT_NAME%.*}_$(date +%Y%m%d_%H%M%S).log"

# エラーハンドリングとクリーンアップ
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo "❌ スクリプト実行中にエラーが発生しました (終了コード: $exit_code)" >&2
        echo "❌ Script execution failed (exit code: $exit_code)" >&2
        echo "📋 ログファイル: $LOG_FILE" >&2
    fi
    exit $exit_code
}

trap cleanup EXIT ERR

# ログ関数
log_info() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $*"
    echo "$message" | tee -a "$LOG_FILE"
}

log_error() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*"
    echo "$message" >&2 | tee -a "$LOG_FILE"
}

log_success() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $*"
    echo "$message" | tee -a "$LOG_FILE"
}

echo "🔍 デプロイメント前提条件をチェック中..."
echo "🔍 Checking deployment prerequisites..."
echo ""
log_info "前提条件チェック開始"

# Color codes for output (readonly for security)
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# セキュリティ設定
umask 077  # 作成されるファイルのパーミッションを制限

# Track overall status
OVERALL_STATUS=0

# 入力値検証関数
validate_environment() {
    # 環境変数の検証
    if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]] && [[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        log_info "AWS認証情報が環境変数で設定されています"
    fi
    
    # 作業ディレクトリの検証
    if [[ ! -w "$PWD" ]]; then
        log_error "現在のディレクトリに書き込み権限がありません: $PWD"
        return 1
    fi
    
    # 必要なコマンドの存在確認
    local required_commands=("curl" "grep" "awk" "sed")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "必要なコマンドが見つかりません: $cmd"
            return 1
        fi
    done
    
    return 0
}

# ステータス表示関数
print_status() {
    local status=$1
    local message=$2
    
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✅ $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
        OVERALL_STATUS=1
    fi
}

print_warning() {
    local message=$1
    echo -e "${YELLOW}⚠️  $message${NC}"
}

print_info() {
    local message=$1
    echo -e "${BLUE}ℹ️  $message${NC}"
}

# 自動インストール提案関数
suggest_installation() {
    local tool=$1
    local install_cmd=$2
    local description=$3
    
    echo -e "${YELLOW}💡 自動インストールを実行しますか？${NC}"
    echo -e "${BLUE}   $description${NC}"
    echo -e "${BLUE}   実行コマンド: $install_cmd${NC}"
    echo ""
}

# AWS CLIチェック
echo "AWS CLIをチェック中..."
echo "Checking AWS CLI..."
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    print_status 0 "AWS CLI が見つかりました (バージョン: $AWS_VERSION)"
    
    # AWS認証情報チェック
    if aws sts get-caller-identity &> /dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
        print_status 0 "AWS認証情報が設定されています (アカウント: $ACCOUNT_ID)"
        print_info "ユーザー: $USER_ARN"
        
        # IAM権限の基本チェック
        echo "  基本的なIAM権限をチェック中..."
        if aws iam get-user &> /dev/null || aws sts get-caller-identity --query Arn --output text | grep -q "role"; then
            print_status 0 "基本的なIAM権限が確認できました"
        else
            print_warning "IAM権限の確認ができませんでした"
        fi
    else
        print_status 1 "AWS認証情報が設定されていません"
        print_info "実行してください: aws configure"
        suggest_installation "AWS CLI" "aws configure" "AWS認証情報を設定します"
    fi
else
    print_status 1 "AWS CLI が見つかりません"
    print_info "インストール先: https://aws.amazon.com/cli/"
    
    # OS別インストール提案
    if [[ "$OSTYPE" == "darwin"* ]]; then
        suggest_installation "AWS CLI" "brew install awscli" "macOS用AWS CLIをインストールします"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        suggest_installation "AWS CLI" "curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install" "Linux用AWS CLIをインストールします"
    fi
fi

echo ""

# Node.jsチェック
echo "Node.jsをチェック中..."
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$NODE_MAJOR_VERSION" -ge 18 ]; then
        print_status 0 "Node.js が見つかりました ($NODE_VERSION)"
        
        # Node.js 20推奨の確認
        if [ "$NODE_MAJOR_VERSION" -ge 20 ]; then
            print_info "推奨バージョン Node.js 20+ を使用しています"
        else
            print_warning "Node.js 20+ の使用を推奨します (現在: $NODE_VERSION)"
        fi
    else
        print_status 1 "Node.js バージョンが古すぎます ($NODE_VERSION). 必要: 18+"
        print_info "インストール先: https://nodejs.org/"
        
        # バージョンアップ提案
        if [[ "$OSTYPE" == "darwin"* ]]; then
            suggest_installation "Node.js" "brew install node" "最新のNode.jsをインストールします"
        fi
    fi
else
    print_status 1 "Node.js が見つかりません"
    print_info "インストール先: https://nodejs.org/"
    
    # OS別インストール提案
    if [[ "$OSTYPE" == "darwin"* ]]; then
        suggest_installation "Node.js" "brew install node" "macOS用Node.jsをインストールします"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        suggest_installation "Node.js" "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs" "Linux用Node.js 20をインストールします"
    fi
fi

echo ""

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status 0 "npm found (version: $NPM_VERSION)"
else
    print_status 1 "npm not found"
    print_info "Usually installed with Node.js"
fi

echo ""

# AWS CDKチェック (CloudFormationデプロイメントの場合はオプション)
echo "AWS CDKをチェック中..."
echo "Checking AWS CDK..."
if command -v cdk &> /dev/null; then
    CDK_VERSION=$(cdk --version)
    CDK_MAJOR_VERSION=$(echo $CDK_VERSION | cut -d'.' -f1)
    
    print_status 0 "AWS CDK が見つかりました ($CDK_VERSION)"
    
    # CDK v2推奨の確認
    if [ "$CDK_MAJOR_VERSION" -ge 2 ]; then
        print_info "推奨バージョン CDK v2 を使用しています"
    else
        print_warning "CDK v2 の使用を推奨します (現在: $CDK_VERSION)"
        suggest_installation "AWS CDK v2" "npm install -g aws-cdk@latest" "最新のAWS CDK v2にアップグレードします"
    fi
    
    # CDKブートストラップ状況チェック
    REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || echo "us-east-1")}}
    if aws cloudformation describe-stacks --stack-name CDKToolkit --region "$REGION" &> /dev/null; then
        print_status 0 "CDK ブートストラップが完了しています (リージョン: $REGION)"
    else
        print_warning "CDK ブートストラップが必要です (リージョン: $REGION)"
        print_info "実行してください: cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$REGION"
    fi
else
    print_warning "AWS CDK が見つかりません (CDKデプロイメントの場合のみ必要)"
    print_info "インストール: npm install -g aws-cdk@latest"
    suggest_installation "AWS CDK" "npm install -g aws-cdk@latest" "最新のAWS CDK v2をインストールします"
fi

echo ""

# Check Docker (optional)
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | sed 's/,//')
        print_status 0 "Docker found and running (version: $DOCKER_VERSION)"
    else
        print_warning "Docker found but not running"
        print_info "Start Docker Desktop or Docker daemon"
    fi
else
    print_warning "Docker not found (optional for custom containers)"
    print_info "Install from: https://www.docker.com/get-started"
fi

echo ""

# Check Git
echo "Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    print_status 0 "Git found (version: $GIT_VERSION)"
else
    print_warning "Git not found (recommended for version control)"
    print_info "Install from: https://git-scm.com/"
fi

echo ""

# Check jq (for JSON processing)
echo "Checking jq..."
if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    print_status 0 "jq found ($JQ_VERSION)"
else
    print_warning "jq not found (recommended for JSON processing)"
    print_info "Install: brew install jq (macOS) or apt-get install jq (Ubuntu)"
fi

echo ""

# Check AWS region
echo "Checking AWS region configuration..."
if [ -n "${AWS_REGION:-}" ]; then
    print_status 0 "AWS_REGION environment variable set: $AWS_REGION"
elif [ -n "${AWS_DEFAULT_REGION:-}" ]; then
    print_status 0 "AWS_DEFAULT_REGION environment variable set: $AWS_DEFAULT_REGION"
else
    CONFIGURED_REGION=$(aws configure get region 2>/dev/null || echo "")
    if [ -n "$CONFIGURED_REGION" ]; then
        print_status 0 "AWS region configured: $CONFIGURED_REGION"
    else
        print_warning "AWS region not configured"
        print_info "Set AWS_REGION environment variable or run: aws configure"
    fi
fi

echo ""

# リージョン内のAWSサービス可用性チェック
echo "AWSサービスの可用性をチェック中..."
echo "Checking AWS service availability..."
REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || echo "us-east-1")}}

# FSx可用性チェック
echo "  Amazon FSx for NetApp ONTAP をチェック中..."
if aws fsx describe-file-systems --region "$REGION" &> /dev/null; then
    print_status 0 "Amazon FSx がリージョン $REGION で利用可能です"
    
    # FSx for NetApp ONTAP固有のチェック
    if aws fsx describe-file-systems --region "$REGION" --query 'FileSystems[?FileSystemType==`ONTAP`]' --output text | grep -q "ONTAP" 2>/dev/null || true; then
        print_info "既存のFSx for NetApp ONTAPファイルシステムが見つかりました"
    fi
else
    print_warning "Amazon FSx がリージョン $REGION で利用できない可能性があります"
    print_info "サポートされているリージョンを確認してください: https://aws.amazon.com/fsx/netapp-ontap/faqs/"
fi

# Bedrock可用性チェック
echo "  Amazon Bedrock をチェック中..."
# Bedrockは特定のリージョンでのみ利用可能
BEDROCK_REGIONS=("us-east-1" "us-west-2" "eu-west-1" "ap-southeast-1" "ap-northeast-1")
BEDROCK_AVAILABLE=false

for bedrock_region in "${BEDROCK_REGIONS[@]}"; do
    if aws bedrock list-foundation-models --region "$bedrock_region" &> /dev/null 2>&1; then
        print_status 0 "Amazon Bedrock がリージョン $bedrock_region でアクセス可能です"
        BEDROCK_AVAILABLE=true
        
        # Titan Embeddings モデルの確認
        if aws bedrock list-foundation-models --region "$bedrock_region" --query 'modelSummaries[?contains(modelId, `titan-embed`)]' --output text | grep -q "titan-embed" 2>/dev/null; then
            print_info "Titan Embeddings モデルが利用可能です"
        fi
        break
    fi
done

if [ "$BEDROCK_AVAILABLE" = false ]; then
    print_warning "Amazon Bedrock にアクセスできません (権限またはリージョンを確認してください)"
    print_info "Bedrockサポートリージョン: us-east-1, us-west-2, eu-west-1, ap-southeast-1, ap-northeast-1"
fi

# Batch可用性チェック
echo "  AWS Batch をチェック中..."
if aws batch describe-compute-environments --region "$REGION" &> /dev/null; then
    print_status 0 "AWS Batch がリージョン $REGION で利用可能です"
    
    # 既存のコンピュート環境チェック
    EXISTING_ENVS=$(aws batch describe-compute-environments --region "$REGION" --query 'computeEnvironments[?state==`ENABLED`]' --output text | wc -l)
    if [ "$EXISTING_ENVS" -gt 0 ]; then
        print_info "既存のBatchコンピュート環境が $EXISTING_ENVS 個見つかりました"
    fi
else
    print_warning "AWS Batch がリージョン $REGION で利用できない可能性があります"
fi

# DynamoDB可用性チェック
echo "  Amazon DynamoDB をチェック中..."
if aws dynamodb list-tables --region "$REGION" &> /dev/null; then
    print_status 0 "Amazon DynamoDB がリージョン $REGION で利用可能です"
else
    print_warning "Amazon DynamoDB がリージョン $REGION で利用できない可能性があります"
fi

# S3可用性チェック (グローバルサービスだが権限確認)
echo "  Amazon S3 をチェック中..."
if aws s3 ls &> /dev/null; then
    print_status 0 "Amazon S3 にアクセス可能です"
else
    print_warning "Amazon S3 にアクセスできません (権限を確認してください)"
fi

echo ""

# 詳細なリソース制限チェック
echo ""
echo "リソース制限をチェック中..."
echo "Checking resource limits..."

# EC2インスタンス制限チェック
if aws ec2 describe-account-attributes --attribute-names supported-platforms --region "$REGION" &> /dev/null; then
    # vCPU制限チェック (Batch用)
    VCPU_LIMIT=$(aws service-quotas get-service-quota --service-code ec2 --quota-code L-34B43A08 --region "$REGION" --query 'Quota.Value' --output text 2>/dev/null || echo "不明")
    if [ "$VCPU_LIMIT" != "不明" ] && [ "$VCPU_LIMIT" != "Unknown" ]; then
        if (( $(echo "$VCPU_LIMIT >= 100" | bc -l) )); then
            print_status 0 "EC2 vCPU制限が十分です ($VCPU_LIMIT vCPUs)"
        else
            print_warning "EC2 vCPU制限が低い可能性があります ($VCPU_LIMIT vCPUs)"
            print_info "大規模なBatchワークロードには制限緩和が必要な場合があります"
        fi
    fi
fi

# セキュリティ設定チェック
echo ""
echo "セキュリティ設定をチェック中..."
echo "Checking security configuration..."

# MFA設定チェック
if aws sts get-caller-identity --query Arn --output text | grep -q "mfa" 2>/dev/null; then
    print_status 0 "MFA認証が有効になっています"
else
    print_warning "MFA認証が設定されていません (本番環境では推奨)"
fi

# CloudTrail設定チェック
if aws cloudtrail describe-trails --region "$REGION" --query 'trailList[?IsLogging==`true`]' --output text | grep -q "." 2>/dev/null; then
    print_status 0 "CloudTrail ログが有効になっています"
else
    print_warning "CloudTrail ログが無効です (監査のため有効化を推奨)"
fi

# 概要
echo ""
echo "📋 前提条件チェック概要:"
echo "📋 Prerequisites Check Summary:"
echo "================================"

if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}🎉 必要な前提条件がすべて満たされています！${NC}"
    echo -e "${GREEN}🎉 All required prerequisites are satisfied!${NC}"
    echo ""
    echo "次のステップ:"
    echo "Next steps:"
    echo "1. ./scripts/configure.sh を実行してデプロイメント設定を行う"
    echo "   Run ./scripts/configure.sh to set up your deployment configuration"
    echo "2. ./scripts/deploy.sh を実行してワークロードをデプロイする"
    echo "   Run ./scripts/deploy.sh to deploy the workload"
else
    echo -e "${RED}❌ 一部の前提条件が不足または設定に問題があります。${NC}"
    echo -e "${RED}❌ Some prerequisites are missing or misconfigured.${NC}"
    echo ""
    echo "続行する前に上記の問題を解決してください。"
    echo "Please address the issues above before proceeding."
fi

echo ""

# 追加の推奨事項
echo "💡 推奨事項:"
echo "💡 Recommendations:"
echo "==================="
echo "• 以下のAWS権限があることを確認してください:"
echo "• Ensure you have appropriate AWS permissions for:"
echo "  - IAMロールの作成と管理"
echo "    IAM role creation and management"
echo "  - VPCとネットワークリソース (新しいVPCを作成する場合)"
echo "    VPC and networking resources (if creating new VPC)"
echo "  - FSx for NetApp ONTAP (新しいファイルシステムを作成する場合)"
echo "    FSx for NetApp ONTAP (if creating new file system)"
echo "  - AWS Batchコンピュート環境とジョブ定義"
echo "    AWS Batch compute environments and job definitions"
echo "  - S3バケットの作成と管理"
echo "    S3 bucket creation and management"
echo "  - DynamoDBテーブルの作成と管理"
echo "    DynamoDB table creation and management"
echo "  - Amazon Bedrockモデルアクセス"
echo "    Amazon Bedrock model access"
echo ""
echo "• 本番デプロイメントでは以下を検討してください:"
echo "• For production deployments, consider:"
echo "  - 専用のAWSアカウントまたは組織単位の使用"
echo "    Using dedicated AWS accounts or organizational units"
echo "  - 適切なバックアップと災害復旧の実装"
echo "    Implementing proper backup and disaster recovery"
echo "  - 監視とアラートの設定"
echo "    Setting up monitoring and alerting"
echo "  - セキュリティベストプラクティスの確認"
echo "    Reviewing security best practices"

# 環境固有の注意事項
echo ""
echo "🌍 環境固有の注意事項:"
echo "🌍 Environment-specific Notes:"
echo "=============================="
echo "• 現在のリージョン: $REGION"
echo "  Current region: $REGION"
echo "• データ主権要件を確認してください"
echo "  Please verify data sovereignty requirements"
echo "• 地域固有のコンプライアンス要件を確認してください"
echo "  Please verify region-specific compliance requirements"

exit $OVERALL_STATUS