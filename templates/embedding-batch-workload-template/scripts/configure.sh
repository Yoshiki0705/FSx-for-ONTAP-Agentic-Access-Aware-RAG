#!/bin/bash

# FSx for NetApp ONTAP Embedding Batch Workload Template
# インタラクティブ設定スクリプト (改良版)
# Interactive Configuration Script (Improved)

set -euo pipefail

# エラーハンドリングとクリーンアップ
trap 'echo "❌ 設定中にエラーが発生しました"; exit 1' ERR

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🛠️  FSx for NetApp ONTAP Embedding Batch Workload 設定${NC}"
echo -e "${CYAN}🛠️  FSx for NetApp ONTAP Embedding Batch Workload Configuration${NC}"
echo "=================================================================="
echo ""
echo "このスクリプトはデプロイメント設定をサポートします。"
echo "This script will help you configure your deployment settings."
echo "[括弧]内のデフォルト値を使用する場合はEnterを押してください。"
echo "Press Enter to use default values shown in [brackets]."
echo ""

# 設定ディレクトリ作成
mkdir -p config

# デフォルト値付き入力読み取り関数
read_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    echo -ne "${BLUE}$prompt${NC}"
    if [ -n "$default" ]; then
        echo -ne " ${YELLOW}[$default]${NC}: "
    else
        echo -ne ": "
    fi
    
    read -r input
    if [ -z "$input" ] && [ -n "$default" ]; then
        input=$default
    fi
    
    # 入力値の検証
    if [ -z "$input" ]; then
        echo -e "${RED}❌ 値が必要です${NC}"
        return 1
    fi
    
    eval "$var_name='$input'"
}

# Yes/No入力読み取り関数
read_yes_no() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    while true; do
        echo -ne "${BLUE}$prompt${NC} ${YELLOW}[$default]${NC} (y/n): "
        read -r input
        
        if [ -z "$input" ]; then
            input=$default
        fi
        
        case $input in
            [Yy]|[Yy][Ee][Ss]|[はハ]|[イイ])
                eval "$var_name=true"
                break
                ;;
            [Nn]|[Nn][Oo]|[いイ]|[イイ][エエ])
                eval "$var_name=false"
                break
                ;;
            *)
                echo -e "${RED}はい (y) または いいえ (n) で答えてください。${NC}"
                echo -e "${RED}Please answer yes (y) or no (n).${NC}"
                ;;
        esac
    done
}

# AWS リソース検証関数
validate_aws_resource() {
    local resource_type=$1
    local resource_id=$2
    local region=${3:-$REGION}
    
    case $resource_type in
        "vpc")
            if aws ec2 describe-vpcs --vpc-ids "$resource_id" --region "$region" &>/dev/null; then
                echo -e "${GREEN}✅ VPC $resource_id が確認できました${NC}"
                return 0
            else
                echo -e "${RED}❌ VPC $resource_id が見つかりません${NC}"
                return 1
            fi
            ;;
        "fsx")
            if aws fsx describe-file-systems --file-system-ids "$resource_id" --region "$region" &>/dev/null; then
                echo -e "${GREEN}✅ FSx $resource_id が確認できました${NC}"
                return 0
            else
                echo -e "${RED}❌ FSx $resource_id が見つかりません${NC}"
                return 1
            fi
            ;;
    esac
}

echo -e "${GREEN}📋 基本設定 / Basic Configuration${NC}"
echo "=================================="

# 基本設定
echo "プロジェクト名を入力してください (英数字とハイフンのみ):"
echo "Enter project name (alphanumeric and hyphens only):"
while true; do
    read_with_default "プロジェクト名 / Project Name" "embedding-batch" PROJECT_NAME
    if [[ "$PROJECT_NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
        break
    else
        echo -e "${RED}❌ プロジェクト名は英数字とハイフンのみ使用できます${NC}"
        echo -e "${RED}❌ Project name can only contain alphanumeric characters and hyphens${NC}"
    fi
done

echo ""
echo "環境を選択してください:"
echo "Select environment:"
echo "1. dev (開発環境)"
echo "2. staging (ステージング環境)"
echo "3. prod (本番環境)"
read_with_default "環境 / Environment (1-3)" "1" ENV_CHOICE

case $ENV_CHOICE in
    1) ENVIRONMENT="dev" ;;
    2) ENVIRONMENT="staging" ;;
    3) ENVIRONMENT="prod" ;;
    *) ENVIRONMENT="dev" ;;
esac

echo ""
echo "AWSリージョンを選択してください:"
echo "Select AWS region:"
echo "1. ap-northeast-1 (東京)"
echo "2. us-east-1 (バージニア北部)"
echo "3. us-west-2 (オレゴン)"
echo "4. eu-west-1 (アイルランド)"
echo "5. その他 / Other"
read_with_default "リージョン / Region (1-5)" "1" REGION_CHOICE

case $REGION_CHOICE in
    1) REGION="ap-northeast-1" ;;
    2) REGION="us-east-1" ;;
    3) REGION="us-west-2" ;;
    4) REGION="eu-west-1" ;;
    5) read_with_default "カスタムリージョン / Custom Region" "${AWS_REGION:-ap-northeast-1}" REGION ;;
    *) REGION="ap-northeast-1" ;;
esac

echo -e "${GREEN}✅ 基本設定完了: $PROJECT_NAME-$ENVIRONMENT ($REGION)${NC}"

echo ""
echo -e "${GREEN}🌐 ネットワーク設定 / Network Configuration${NC}"
echo "============================================="

echo "既存のVPCを使用しますか？"
read_yes_no "既存のVPCを使用しますか？ / Do you have an existing VPC?" "y" HAS_VPC

if [ "$HAS_VPC" = "true" ]; then
    while true; do
        read_with_default "VPC ID" "" VPC_ID
        if [ -n "$VPC_ID" ]; then
            echo ""
            echo "VPC情報を取得中: $VPC_ID"
            echo "Fetching VPC information for: $VPC_ID"
            
            if validate_aws_resource "vpc" "$VPC_ID" "$REGION"; then
                # プライベートサブネットを取得
                echo "プライベートサブネット情報を取得中..."
                echo "Fetching private subnet information..."
                
                PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
                    --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*private*,*Private*" \
                    --query 'Subnets[].SubnetId' \
                    --region "$REGION" \
                    --output text 2>/dev/null || echo "")
                
                if [ -n "$PRIVATE_SUBNETS" ] && [ "$PRIVATE_SUBNETS" != "None" ]; then
                    PRIVATE_SUBNET_IDS=$(echo $PRIVATE_SUBNETS | tr '\t' ',')
                    echo -e "${GREEN}✅ プライベートサブネットが見つかりました: $PRIVATE_SUBNET_IDS${NC}"
                    echo -e "${GREEN}✅ Found private subnets: $PRIVATE_SUBNET_IDS${NC}"
                    read_with_default "プライベートサブネットID (カンマ区切り) / Private Subnet IDs (comma-separated)" "$PRIVATE_SUBNET_IDS" SUBNET_IDS
                else
                    echo -e "${YELLOW}⚠️ プライベートサブネットが見つかりませんでした${NC}"
                    echo -e "${YELLOW}⚠️ No private subnets found${NC}"
                    read_with_default "プライベートサブネットID (カンマ区切り) / Private Subnet IDs (comma-separated)" "" SUBNET_IDS
                fi
                break
            else
                echo -e "${RED}❌ 指定されたVPCが見つかりません。再入力してください。${NC}"
                echo -e "${RED}❌ Specified VPC not found. Please re-enter.${NC}"
            fi
        else
            echo -e "${RED}❌ VPC IDが必要です${NC}"
            echo -e "${RED}❌ VPC ID is required${NC}"
        fi
    done
    
    CREATE_VPC=false
    VPC_CIDR=""
else
    CREATE_VPC=true
    VPC_ID=""
    SUBNET_IDS=""
    echo ""
    echo "新しいVPCを作成します。"
    echo "Creating a new VPC."
    read_with_default "VPC CIDR ブロック / VPC CIDR Block" "10.0.0.0/16" VPC_CIDR
    
    # CIDR形式の検証
    if ! [[ "$VPC_CIDR" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo -e "${YELLOW}⚠️ CIDR形式が正しくない可能性があります: $VPC_CIDR${NC}"
        echo -e "${YELLOW}⚠️ CIDR format may be incorrect: $VPC_CIDR${NC}"
    fi
fi

echo ""
echo -e "${GREEN}💾 FSx for NetApp ONTAP 設定 / FSx for NetApp ONTAP Configuration${NC}"
echo "=================================================================="

echo "既存のFSx for NetApp ONTAPファイルシステムを使用しますか？"
read_yes_no "既存のFSx for NetApp ONTAPファイルシステムを使用しますか？ / Do you have an existing FSx for NetApp ONTAP file system?" "y" HAS_FSX

if [ "$HAS_FSX" = "true" ]; then
    while true; do
        read_with_default "FSx ファイルシステムID / FSx File System ID" "" FSX_ID
        if [ -n "$FSX_ID" ]; then
            echo ""
            echo "FSx情報を取得中: $FSX_ID"
            echo "Fetching FSx information for: $FSX_ID"
            
            if validate_aws_resource "fsx" "$FSX_ID" "$REGION"; then
                # SVM情報を取得
                echo "SVM情報を取得中..."
                echo "Fetching SVM information..."
                
                SVM_INFO=$(aws fsx describe-storage-virtual-machines \
                    --filters "Name=file-system-id,Values=$FSX_ID" \
                    --query 'StorageVirtualMachines[0].StorageVirtualMachineId' \
                    --region "$REGION" \
                    --output text 2>/dev/null || echo "")
                
                if [ -n "$SVM_INFO" ] && [ "$SVM_INFO" != "None" ]; then
                    echo -e "${GREEN}✅ SVMが見つかりました: $SVM_INFO${NC}"
                    echo -e "${GREEN}✅ Found SVM: $SVM_INFO${NC}"
                    read_with_default "SVM ID" "$SVM_INFO" SVM_ID
                else
                    echo -e "${YELLOW}⚠️ SVMが見つかりませんでした${NC}"
                    echo -e "${YELLOW}⚠️ No SVM found${NC}"
                    read_with_default "SVM ID" "" SVM_ID
                fi
                break
            else
                echo -e "${RED}❌ 指定されたFSxファイルシステムが見つかりません。再入力してください。${NC}"
                echo -e "${RED}❌ Specified FSx file system not found. Please re-enter.${NC}"
            fi
        else
            echo -e "${RED}❌ FSx ファイルシステムIDが必要です${NC}"
            echo -e "${RED}❌ FSx File System ID is required${NC}"
        fi
    done
    
    read_with_default "FSx ボリュームパス / FSx Volume Path" "/rag-data" VOLUME_PATH
    CREATE_FSX=false
    STORAGE_CAPACITY=""
    THROUGHPUT_CAPACITY=""
    DEPLOYMENT_TYPE=""
else
    CREATE_FSX=true
    FSX_ID=""
    SVM_ID=""
    echo ""
    echo "新しいFSx for NetApp ONTAPファイルシステムを作成します。"
    echo "Creating a new FSx for NetApp ONTAP file system."
    
    read_with_default "FSx ボリュームパス / FSx Volume Path" "/rag-data" VOLUME_PATH
    
    echo ""
    echo "ストレージ容量を選択してください (GB):"
    echo "Select storage capacity (GB):"
    echo "1. 1024 GB (最小構成)"
    echo "2. 2048 GB (推奨)"
    echo "3. 4096 GB (大容量)"
    echo "4. カスタム / Custom"
    read_with_default "ストレージ容量 / Storage Capacity (1-4)" "2" STORAGE_CHOICE
    
    case $STORAGE_CHOICE in
        1) STORAGE_CAPACITY="1024" ;;
        2) STORAGE_CAPACITY="2048" ;;
        3) STORAGE_CAPACITY="4096" ;;
        4) read_with_default "カスタムストレージ容量 (GB) / Custom Storage Capacity (GB)" "1024" STORAGE_CAPACITY ;;
        *) STORAGE_CAPACITY="2048" ;;
    esac
    
    echo ""
    echo "スループット容量を選択してください (MB/s):"
    echo "Select throughput capacity (MB/s):"
    echo "1. 128 MB/s (基本)"
    echo "2. 256 MB/s (推奨)"
    echo "3. 512 MB/s (高性能)"
    echo "4. カスタム / Custom"
    read_with_default "スループット容量 / Throughput Capacity (1-4)" "2" THROUGHPUT_CHOICE
    
    case $THROUGHPUT_CHOICE in
        1) THROUGHPUT_CAPACITY="128" ;;
        2) THROUGHPUT_CAPACITY="256" ;;
        3) THROUGHPUT_CAPACITY="512" ;;
        4) read_with_default "カスタムスループット容量 (MB/s) / Custom Throughput Capacity (MB/s)" "128" THROUGHPUT_CAPACITY ;;
        *) THROUGHPUT_CAPACITY="256" ;;
    esac
    
    echo ""
    echo "デプロイメントタイプを選択してください:"
    echo "Select deployment type:"
    echo "1. SINGLE_AZ_1 (低コスト、単一AZ)"
    echo "2. MULTI_AZ_1 (高可用性、複数AZ)"
    read_with_default "デプロイメントタイプ / Deployment Type (1-2)" "1" DEPLOYMENT_TYPE_CHOICE
    
    if [ "$DEPLOYMENT_TYPE_CHOICE" = "2" ]; then
        DEPLOYMENT_TYPE="MULTI_AZ_1"
        echo -e "${YELLOW}⚠️ MULTI_AZ_1は高コストです (月額約$800-1,200)${NC}"
        echo -e "${YELLOW}⚠️ MULTI_AZ_1 is high cost (approximately $800-1,200/month)${NC}"
    else
        DEPLOYMENT_TYPE="SINGLE_AZ_1"
        echo -e "${GREEN}✅ SINGLE_AZ_1を選択 (月額約$330-400)${NC}"
        echo -e "${GREEN}✅ SINGLE_AZ_1 selected (approximately $330-400/month)${NC}"
    fi
fi

echo ""
echo -e "${GREEN}⚡ AWS Batch 設定 / AWS Batch Configuration${NC}"
echo "============================================="

echo ""
echo "最大vCPU数を設定してください:"
echo "Set maximum vCPUs:"
echo "1. 100 vCPUs (小規模)"
echo "2. 500 vCPUs (中規模)"
echo "3. 1000 vCPUs (大規模)"
echo "4. カスタム / Custom"
read_with_default "最大vCPU数 / Maximum vCPUs (1-4)" "2" VCPU_CHOICE

case $VCPU_CHOICE in
    1) MAX_VCPUS="100" ;;
    2) MAX_VCPUS="500" ;;
    3) MAX_VCPUS="1000" ;;
    4) read_with_default "カスタム最大vCPU数 / Custom Maximum vCPUs" "1000" MAX_VCPUS ;;
    *) MAX_VCPUS="500" ;;
esac

echo ""
echo "インスタンスタイプを選択してください:"
echo "Select instance types:"
echo "1. m5.large,m5.xlarge (汎用、推奨)"
echo "2. c5.large,c5.xlarge (CPU最適化)"
echo "3. r5.large,r5.xlarge (メモリ最適化)"
echo "4. カスタム / Custom"
read_with_default "インスタンスタイプ / Instance Types (1-4)" "1" INSTANCE_CHOICE

case $INSTANCE_CHOICE in
    1) INSTANCE_TYPES="m5.large,m5.xlarge" ;;
    2) INSTANCE_TYPES="c5.large,c5.xlarge" ;;
    3) INSTANCE_TYPES="r5.large,r5.xlarge" ;;
    4) read_with_default "カスタムインスタンスタイプ (カンマ区切り) / Custom Instance Types (comma-separated)" "m5.large,m5.xlarge" INSTANCE_TYPES ;;
    *) INSTANCE_TYPES="m5.large,m5.xlarge" ;;
esac

echo ""
echo "スポットインスタンスを使用してコストを削減しますか？"
echo "スポットインスタンスは最大90%のコスト削減が可能ですが、中断される可能性があります。"
read_yes_no "スポットインスタンスを使用しますか？ / Use Spot Instances (for cost savings)?" "y" USE_SPOT

if [ "$USE_SPOT" = "true" ]; then
    echo ""
    echo "スポット入札価格の割合を設定してください (オンデマンド価格の%):"
    echo "Set spot bid percentage (% of On-Demand price):"
    echo "1. 30% (最大節約)"
    echo "2. 50% (推奨)"
    echo "3. 70% (安定性重視)"
    echo "4. カスタム / Custom"
    read_with_default "スポット入札割合 / Spot Bid Percentage (1-4)" "2" SPOT_CHOICE
    
    case $SPOT_CHOICE in
        1) SPOT_BID_PERCENTAGE="30" ;;
        2) SPOT_BID_PERCENTAGE="50" ;;
        3) SPOT_BID_PERCENTAGE="70" ;;
        4) read_with_default "カスタムスポット入札割合 (%) / Custom Spot Bid Percentage (%)" "50" SPOT_BID_PERCENTAGE ;;
        *) SPOT_BID_PERCENTAGE="50" ;;
    esac
    
    echo -e "${GREEN}✅ スポットインスタンス有効 (${SPOT_BID_PERCENTAGE}% 入札)${NC}"
    echo -e "${GREEN}✅ Spot instances enabled (${SPOT_BID_PERCENTAGE}% bid)${NC}"
else
    SPOT_BID_PERCENTAGE=""
    echo -e "${BLUE}ℹ️ オンデマンドインスタンスを使用します${NC}"
    echo -e "${BLUE}ℹ️ Using On-Demand instances${NC}"
fi

echo ""
echo -e "${GREEN}🤖 Amazon Bedrock 設定 / Amazon Bedrock Configuration${NC}"
echo "======================================================"

echo ""
echo "Bedrockリージョンを選択してください:"
echo "Select Bedrock region:"
echo "1. us-east-1 (バージニア北部、推奨)"
echo "2. us-west-2 (オレゴン)"
echo "3. eu-west-1 (アイルランド)"
echo "4. ap-southeast-1 (シンガポール)"
echo "5. ap-northeast-1 (東京)"
read_with_default "Bedrockリージョン / Bedrock Region (1-5)" "1" BEDROCK_REGION_CHOICE

case $BEDROCK_REGION_CHOICE in
    1) BEDROCK_REGION="us-east-1" ;;
    2) BEDROCK_REGION="us-west-2" ;;
    3) BEDROCK_REGION="eu-west-1" ;;
    4) BEDROCK_REGION="ap-southeast-1" ;;
    5) BEDROCK_REGION="ap-northeast-1" ;;
    *) BEDROCK_REGION="us-east-1" ;;
esac

echo ""
echo "埋め込みモデルを選択してください:"
echo "Select embedding model:"
echo "1. amazon.titan-embed-text-v1 (推奨、多言語対応)"
echo "2. amazon.titan-embed-text-v2:0 (最新版)"
echo "3. cohere.embed-english-v3 (英語特化)"
echo "4. カスタム / Custom"
read_with_default "埋め込みモデル / Embedding Model (1-4)" "1" EMBEDDING_CHOICE

case $EMBEDDING_CHOICE in
    1) EMBEDDING_MODEL_ID="amazon.titan-embed-text-v1" ;;
    2) EMBEDDING_MODEL_ID="amazon.titan-embed-text-v2:0" ;;
    3) EMBEDDING_MODEL_ID="cohere.embed-english-v3" ;;
    4) read_with_default "カスタム埋め込みモデルID / Custom Embedding Model ID" "amazon.titan-embed-text-v1" EMBEDDING_MODEL_ID ;;
    *) EMBEDDING_MODEL_ID="amazon.titan-embed-text-v1" ;;
esac

echo ""
echo "テキスト生成モデルを選択してください:"
echo "Select text generation model:"
echo "1. amazon.nova-pro-v1:0 (推奨、バランス型)"
echo "2. amazon.nova-lite-v1:0 (高速、低コスト)"
echo "3. amazon.nova-pro-v1:0 (最高性能、高コスト)"
echo "4. amazon.titan-text-premier-v1:0 (Amazon製)"
echo "5. カスタム / Custom"
read_with_default "テキスト生成モデル / Text Generation Model (1-5)" "1" TEXT_CHOICE

case $TEXT_CHOICE in
    1) TEXT_MODEL_ID="amazon.nova-pro-v1:0" ;;
    2) TEXT_MODEL_ID="amazon.nova-lite-v1:0" ;;
    3) TEXT_MODEL_ID="amazon.nova-pro-v1:0" ;;
    4) TEXT_MODEL_ID="amazon.titan-text-premier-v1:0" ;;
    5) read_with_default "カスタムテキスト生成モデルID / Custom Text Generation Model ID" "amazon.nova-pro-v1:0" TEXT_MODEL_ID ;;
    *) TEXT_MODEL_ID="amazon.nova-pro-v1:0" ;;
esac

echo -e "${GREEN}✅ Bedrock設定完了: $BEDROCK_REGION, $EMBEDDING_MODEL_ID, $TEXT_MODEL_ID${NC}"

echo ""
echo -e "${GREEN}📊 オプション機能 / Optional Features${NC}"
echo "====================================="

echo "詳細監視を有効にしますか？ (CloudWatch メトリクス、ログ)"
read_yes_no "詳細監視を有効にしますか？ / Enable detailed monitoring?" "n" ENABLE_MONITORING

echo "CloudWatch ダッシュボードを作成しますか？"
read_yes_no "CloudWatch ダッシュボードを作成しますか？ / Create CloudWatch dashboard?" "n" CREATE_DASHBOARD

if [ "$ENABLE_MONITORING" = "true" ]; then
    echo ""
    echo "アラート通知用のメールアドレスを入力してください (オプション):"
    read_with_default "アラートメール / Alert Email (optional)" "" ALERT_EMAIL
    
    echo ""
    echo "ログ保持期間を選択してください:"
    echo "Select log retention period:"
    echo "1. 7日"
    echo "2. 30日 (推奨)"
    echo "3. 90日"
    echo "4. 1年"
    read_with_default "ログ保持期間 / Log Retention (1-4)" "2" RETENTION_CHOICE
    
    case $RETENTION_CHOICE in
        1) RETENTION_DAYS="7" ;;
        2) RETENTION_DAYS="30" ;;
        3) RETENTION_DAYS="90" ;;
        4) RETENTION_DAYS="365" ;;
        *) RETENTION_DAYS="30" ;;
    esac
else
    ALERT_EMAIL=""
    RETENTION_DAYS="30"
fi

echo ""
echo "セキュリティ機能を設定してください:"
echo "Configure security features:"

echo "WAF保護を有効にしますか？ (Web Application Firewall)"
read_yes_no "WAF保護を有効にしますか？ / Enable WAF protection?" "n" ENABLE_WAF

echo "GuardDutyを有効にしますか？ (脅威検出)"
read_yes_no "GuardDutyを有効にしますか？ / Enable GuardDuty?" "n" ENABLE_GUARDDUTY

echo ""
echo -e "${GREEN}💰 コスト最適化 / Cost Optimization${NC}"
echo "===================================="

echo ""
echo "推定月額コスト (概算):"
echo "Estimated monthly costs (approximate):"
echo ""

if [ "$USE_SPOT" = "true" ]; then
    echo "• AWS Batch (スポット): $50-200/月"
    echo "• AWS Batch (Spot): $50-200/month"
else
    echo "• AWS Batch (オンデマンド): $100-500/月"
    echo "• AWS Batch (On-Demand): $100-500/month"
fi

if [ "$CREATE_FSX" = "true" ]; then
    if [ "$DEPLOYMENT_TYPE" = "MULTI_AZ_1" ]; then
        echo "• FSx for NetApp ONTAP (Multi-AZ): $800-1,200/月"
        echo "• FSx for NetApp ONTAP (Multi-AZ): $800-1,200/month"
    else
        echo "• FSx for NetApp ONTAP (Single-AZ): $330-400/月"
        echo "• FSx for NetApp ONTAP (Single-AZ): $330-400/month"
    fi
else
    echo "• FSx for NetApp ONTAP: 既存使用 (追加コストなし)"
    echo "• FSx for NetApp ONTAP: Using existing (no additional cost)"
fi

echo "• S3 + DynamoDB: $10-50/月"
echo "• S3 + DynamoDB: $10-50/month"
echo "• Amazon Bedrock: $0.10-1.00 per 1K tokens"

if [ "$ENABLE_MONITORING" = "true" ]; then
    echo "• CloudWatch: $20-50/月"
    echo "• CloudWatch: $20-50/month"
fi

if [ "$ENABLE_WAF" = "true" ]; then
    echo "• AWS WAF: $5-20/月"
    echo "• AWS WAF: $5-20/month"
fi

if [ "$ENABLE_GUARDDUTY" = "true" ]; then
    echo "• GuardDuty: $10-30/月"
    echo "• GuardDuty: $10-30/month"
fi

echo ""
echo -e "${YELLOW}⚠️ 注意: 実際のコストは使用量により変動します${NC}"
echo -e "${YELLOW}⚠️ Note: Actual costs may vary based on usage${NC}"

echo ""
read_yes_no "この設定で続行しますか？ / Continue with these settings?" "y" CONTINUE

if [ "$CONTINUE" = "false" ]; then
    echo -e "${YELLOW}設定がキャンセルされました。${NC}"
    echo -e "${YELLOW}Configuration cancelled.${NC}"
    exit 0
fi

# 設定ファイル生成
echo ""
echo -e "${GREEN}📝 設定ファイルを生成中...${NC}"
echo -e "${GREEN}📝 Generating configuration file...${NC}"

# カンマ区切り値をJSON配列に変換
INSTANCE_TYPES_JSON=$(echo "\"$INSTANCE_TYPES\"" | sed 's/,/","/g' | sed 's/^/[/' | sed 's/$/]/')
SUBNET_IDS_JSON=""
if [ -n "$SUBNET_IDS" ]; then
    SUBNET_IDS_JSON=$(echo "\"$SUBNET_IDS\"" | sed 's/,/","/g' | sed 's/^/[/' | sed 's/$/]/')
else
    SUBNET_IDS_JSON="[]"
fi

# 設定ファイル作成
cat > config/deployment-config.json << EOF
{
  "projectName": "$PROJECT_NAME",
  "environment": "$ENVIRONMENT",
  "region": "$REGION",
  
  "vpc": {
    "vpcId": "${VPC_ID:-}",
    "createNew": $CREATE_VPC,
    "cidrBlock": "${VPC_CIDR:-}",
    "privateSubnetIds": $SUBNET_IDS_JSON
  },
  
  "fsx": {
    "fileSystemId": "${FSX_ID:-}",
    "svmId": "${SVM_ID:-}",
    "createNew": $CREATE_FSX,
    "storageCapacity": ${STORAGE_CAPACITY:-1024},
    "throughputCapacity": ${THROUGHPUT_CAPACITY:-128},
    "deploymentType": "${DEPLOYMENT_TYPE:-SINGLE_AZ_1}",
    "volumePath": "$VOLUME_PATH"
  },
  
  "batch": {
    "maxvCpus": $MAX_VCPUS,
    "instanceTypes": $INSTANCE_TYPES_JSON,
    "useSpotInstances": $USE_SPOT$([ -n "$SPOT_BID_PERCENTAGE" ] && echo ",
    \"spotBidPercentage\": $SPOT_BID_PERCENTAGE" || echo "")
  },
  
  "bedrock": {
    "region": "$BEDROCK_REGION",
    "modelId": "$EMBEDDING_MODEL_ID",
    "textModelId": "$TEXT_MODEL_ID"
  },
  
  "monitoring": {
    "enableDetailedMonitoring": $ENABLE_MONITORING,
    "createDashboard": $CREATE_DASHBOARD$([ -n "$ALERT_EMAIL" ] && echo ",
    \"alertEmail\": \"$ALERT_EMAIL\"" || echo ""),
    "retentionDays": $RETENTION_DAYS
  },
  
  "security": {
    "enableWAF": $ENABLE_WAF,
    "enableGuardDuty": $ENABLE_GUARDDUTY
  }
}
EOF

echo -e "${GREEN}✅ 設定ファイルが保存されました: config/deployment-config.json${NC}"
echo -e "${GREEN}✅ Configuration saved to config/deployment-config.json${NC}"
echo ""

# 設定概要の表示
echo -e "${CYAN}📋 設定概要 / Configuration Summary${NC}"
echo "===================================="
echo "プロジェクト / Project: $PROJECT_NAME"
echo "環境 / Environment: $ENVIRONMENT"
echo "リージョン / Region: $REGION"
echo "VPC: $([ "$CREATE_VPC" = "true" ] && echo "新規作成 ($VPC_CIDR) / Create New ($VPC_CIDR)" || echo "$VPC_ID")"
echo "FSx: $([ "$CREATE_FSX" = "true" ] && echo "新規作成 ($DEPLOYMENT_TYPE, ${STORAGE_CAPACITY}GB) / Create New ($DEPLOYMENT_TYPE, ${STORAGE_CAPACITY}GB)" || echo "$FSX_ID")"
echo "Batch 最大vCPU / Batch Max vCPUs: $MAX_VCPUS"
echo "スポットインスタンス / Spot Instances: $([ "$USE_SPOT" = "true" ] && echo "有効 / Enabled" || echo "無効 / Disabled")"
echo "監視 / Monitoring: $([ "$ENABLE_MONITORING" = "true" ] && echo "有効 / Enabled" || echo "無効 / Disabled")"
echo "Bedrockリージョン / Bedrock Region: $BEDROCK_REGION"
echo "埋め込みモデル / Embedding Model: $EMBEDDING_MODEL_ID"
echo "テキスト生成モデル / Text Model: $TEXT_MODEL_ID"
echo ""

echo -e "${GREEN}🚀 次のステップ / Next Steps${NC}"
echo "============================="
echo "1. 設定ファイルを確認: config/deployment-config.json"
echo "   Review the configuration file: config/deployment-config.json"
echo "2. デプロイメントスクリプトを実行:"
echo "   Run deployment script:"
echo "   • CDKの場合 / For CDK: ./scripts/deploy.sh"
echo "   • CloudFormationの場合 / For CloudFormation: ./scripts/deploy-cloudformation.sh"
echo "3. AWSコンソールでデプロイメント進行状況を監視"
echo "   Monitor deployment progress in AWS Console"
echo ""

echo -e "${BLUE}💡 ヒント / Tips${NC}"
echo "================"
echo "• 必要に応じてconfig/deployment-config.jsonを手動編集できます"
echo "  You can edit config/deployment-config.json manually if needed"
echo "• デプロイメント後は./scripts/validate.shで動作確認してください"
echo "  Use ./scripts/validate.sh after deployment to verify everything works"
echo "• 不要になったら./scripts/cleanup.shでリソースを削除できます"
echo "  Check ./scripts/cleanup.sh to remove resources when no longer needed"
echo ""

echo -e "${GREEN}設定が正常に完了しました！ 🎉${NC}"
echo -e "${GREEN}Configuration completed successfully! 🎉${NC}"

# 設定ファイルの検証
echo ""
echo -e "${BLUE}🔍 設定ファイルの検証中...${NC}"
echo -e "${BLUE}🔍 Validating configuration file...${NC}"

if [ -f "config/deployment-config.json" ]; then
    if jq empty config/deployment-config.json 2>/dev/null; then
        echo -e "${GREEN}✅ 設定ファイルのJSON形式が正しいです${NC}"
        echo -e "${GREEN}✅ Configuration file JSON format is valid${NC}"
    else
        echo -e "${RED}❌ 設定ファイルのJSON形式にエラーがあります${NC}"
        echo -e "${RED}❌ Configuration file JSON format has errors${NC}"
    fi
else
    echo -e "${RED}❌ 設定ファイルが作成されませんでした${NC}"
    echo -e "${RED}❌ Configuration file was not created${NC}"
fi