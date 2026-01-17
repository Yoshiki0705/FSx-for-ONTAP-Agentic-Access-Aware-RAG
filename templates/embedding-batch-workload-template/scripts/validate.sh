#!/bin/bash

# FSx for NetApp ONTAP Embedding Batch Workload Template
# デプロイメント検証スクリプト
# Deployment Validation Script

set -euo pipefail

# エラーハンドリングとクリーンアップ
trap 'echo "❌ 検証中にエラーが発生しました / Error occurred during validation"; exit 1' ERR

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}✅ FSx for NetApp ONTAP Embedding Batch Workload 検証${NC}"
echo -e "${CYAN}✅ FSx for NetApp ONTAP Embedding Batch Workload Validation${NC}"
echo "============================================================="
echo ""

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

print_info() {
    local message=$1
    echo -e "${BLUE}ℹ️  $message${NC}"
}

print_warning() {
    local message=$1
    echo -e "${YELLOW}⚠️  $message${NC}"
}

# 全体ステータス追跡
OVERALL_STATUS=0

# 設定ファイルの存在確認
if [ ! -f "config/deployment-config.json" ]; then
    echo -e "${RED}❌ 設定ファイルが見つかりません: config/deployment-config.json${NC}"
    echo -e "${RED}❌ Configuration file not found: config/deployment-config.json${NC}"
    echo ""
    echo "デプロイメントを先に実行してください。"
    echo "Please run deployment first."
    exit 1
fi

# 設定読み込み
PROJECT_NAME=$(jq -r '.projectName' config/deployment-config.json)
ENVIRONMENT=$(jq -r '.environment' config/deployment-config.json)
REGION=$(jq -r '.region' config/deployment-config.json)
STACK_NAME="$PROJECT_NAME-$ENVIRONMENT-embedding-workload"

echo -e "${GREEN}📋 検証設定 / Validation Configuration${NC}"
echo "======================================"
echo "プロジェクト / Project: $PROJECT_NAME"
echo "環境 / Environment: $ENVIRONMENT"
echo "リージョン / Region: $REGION"
echo "スタック名 / Stack Name: $STACK_NAME"
echo ""

# ステップ1: CloudFormationスタック状態チェック
echo -e "${BLUE}🔍 ステップ1: CloudFormationスタック状態をチェック中...${NC}"
echo -e "${BLUE}🔍 Step 1: Checking CloudFormation stack status...${NC}"

STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ]; then
    print_status 0 "CloudFormationスタックが正常に作成されています / CloudFormation stack is successfully created"
    print_info "スタック状態 / Stack Status: $STACK_STATUS"
else
    print_status 1 "CloudFormationスタックに問題があります / CloudFormation stack has issues"
    print_info "スタック状態 / Stack Status: $STACK_STATUS"
fi

echo ""

# ステップ2: AWS Batchリソース検証
echo -e "${BLUE}🔍 ステップ2: AWS Batchリソースを検証中...${NC}"
echo -e "${BLUE}🔍 Step 2: Validating AWS Batch resources...${NC}"

# コンピュート環境チェック
COMPUTE_ENV_NAME="$PROJECT_NAME-$ENVIRONMENT-compute-env"
COMPUTE_ENV_STATUS=$(aws batch describe-compute-environments \
    --compute-environments "$COMPUTE_ENV_NAME" \
    --region "$REGION" \
    --query 'computeEnvironments[0].status' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$COMPUTE_ENV_STATUS" = "VALID" ]; then
    print_status 0 "Batchコンピュート環境が有効です / Batch compute environment is valid"
else
    print_status 1 "Batchコンピュート環境に問題があります / Batch compute environment has issues"
    print_info "コンピュート環境状態 / Compute Environment Status: $COMPUTE_ENV_STATUS"
fi

# ジョブキューチェック
JOB_QUEUE_NAME="$PROJECT_NAME-$ENVIRONMENT-job-queue"
JOB_QUEUE_STATUS=$(aws batch describe-job-queues \
    --job-queues "$JOB_QUEUE_NAME" \
    --region "$REGION" \
    --query 'jobQueues[0].state' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$JOB_QUEUE_STATUS" = "ENABLED" ]; then
    print_status 0 "Batchジョブキューが有効です / Batch job queue is enabled"
else
    print_status 1 "Batchジョブキューに問題があります / Batch job queue has issues"
    print_info "ジョブキュー状態 / Job Queue Status: $JOB_QUEUE_STATUS"
fi

echo ""

# ステップ3: ジョブ定義検証
echo -e "${BLUE}🔍 ステップ3: ジョブ定義を検証中...${NC}"
echo -e "${BLUE}🔍 Step 3: Validating job definitions...${NC}"

# 文書処理ジョブ定義
DOC_JOB_DEF="$PROJECT_NAME-$ENVIRONMENT-document-processing"
DOC_JOB_STATUS=$(aws batch describe-job-definitions \
    --job-definition-name "$DOC_JOB_DEF" \
    --status ACTIVE \
    --region "$REGION" \
    --query 'jobDefinitions[0].status' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DOC_JOB_STATUS" = "ACTIVE" ]; then
    print_status 0 "文書処理ジョブ定義が有効です / Document processing job definition is active"
else
    print_status 1 "文書処理ジョブ定義に問題があります / Document processing job definition has issues"
fi

# 埋め込み生成ジョブ定義
EMBED_JOB_DEF="$PROJECT_NAME-$ENVIRONMENT-embedding-generation"
EMBED_JOB_STATUS=$(aws batch describe-job-definitions \
    --job-definition-name "$EMBED_JOB_DEF" \
    --status ACTIVE \
    --region "$REGION" \
    --query 'jobDefinitions[0].status' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$EMBED_JOB_STATUS" = "ACTIVE" ]; then
    print_status 0 "埋め込み生成ジョブ定義が有効です / Embedding generation job definition is active"
else
    print_status 1 "埋め込み生成ジョブ定義に問題があります / Embedding generation job definition has issues"
fi

# RAGクエリジョブ定義
RAG_JOB_DEF="$PROJECT_NAME-$ENVIRONMENT-rag-query"
RAG_JOB_STATUS=$(aws batch describe-job-definitions \
    --job-definition-name "$RAG_JOB_DEF" \
    --status ACTIVE \
    --region "$REGION" \
    --query 'jobDefinitions[0].status' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$RAG_JOB_STATUS" = "ACTIVE" ]; then
    print_status 0 "RAGクエリジョブ定義が有効です / RAG query job definition is active"
else
    print_status 1 "RAGクエリジョブ定義に問題があります / RAG query job definition has issues"
fi

echo ""

# ステップ4: S3バケット検証
echo -e "${BLUE}🔍 ステップ4: S3バケットを検証中...${NC}"
echo -e "${BLUE}🔍 Step 4: Validating S3 bucket...${NC}"

S3_BUCKET_NAME="$PROJECT_NAME-$ENVIRONMENT-embeddings-$(aws sts get-caller-identity --query Account --output text)"
S3_BUCKET_EXISTS=$(aws s3api head-bucket --bucket "$S3_BUCKET_NAME" --region "$REGION" 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND")

if [ "$S3_BUCKET_EXISTS" = "EXISTS" ]; then
    print_status 0 "S3バケットが存在します / S3 bucket exists"
    print_info "バケット名 / Bucket Name: $S3_BUCKET_NAME"
else
    print_status 1 "S3バケットが見つかりません / S3 bucket not found"
fi

echo ""

# ステップ5: DynamoDBテーブル検証
echo -e "${BLUE}🔍 ステップ5: DynamoDBテーブルを検証中...${NC}"
echo -e "${BLUE}🔍 Step 5: Validating DynamoDB table...${NC}"

DYNAMODB_TABLE_NAME="$PROJECT_NAME-$ENVIRONMENT-metadata"
DYNAMODB_STATUS=$(aws dynamodb describe-table \
    --table-name "$DYNAMODB_TABLE_NAME" \
    --region "$REGION" \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DYNAMODB_STATUS" = "ACTIVE" ]; then
    print_status 0 "DynamoDBテーブルが有効です / DynamoDB table is active"
    print_info "テーブル名 / Table Name: $DYNAMODB_TABLE_NAME"
else
    print_status 1 "DynamoDBテーブルに問題があります / DynamoDB table has issues"
    print_info "テーブル状態 / Table Status: $DYNAMODB_STATUS"
fi

echo ""

# ステップ6: FSxマウント機能テスト
echo -e "${BLUE}🔍 ステップ6: FSxマウント機能をテスト中...${NC}"
echo -e "${BLUE}🔍 Step 6: Testing FSx mount functionality...${NC}"

# FSx設定確認
HAS_FSX=$(jq -r '.fsx.hasExisting // .fsx.createNew' config/deployment-config.json)

if [ "$HAS_FSX" = "true" ]; then
    FSX_ID=$(jq -r '.fsx.fileSystemId // empty' config/deployment-config.json)
    
    if [ -n "$FSX_ID" ] && [ "$FSX_ID" != "null" ]; then
        FSX_STATUS=$(aws fsx describe-file-systems \
            --file-system-ids "$FSX_ID" \
            --region "$REGION" \
            --query 'FileSystems[0].Lifecycle' \
            --output text 2>/dev/null || echo "NOT_FOUND")
        
        if [ "$FSX_STATUS" = "AVAILABLE" ]; then
            print_status 0 "FSx for NetApp ONTAPファイルシステムが利用可能です / FSx for NetApp ONTAP file system is available"
            print_info "ファイルシステムID / File System ID: $FSX_ID"
            
            # テストジョブを実行してFSxマウントをテスト
            print_info "FSxマウントテストジョブを実行中... / Running FSx mount test job..."
            
            TEST_JOB_NAME="fsx-mount-test-$(date +%s)"
            TEST_JOB_ID=$(aws batch submit-job \
                --job-name "$TEST_JOB_NAME" \
                --job-queue "$JOB_QUEUE_NAME" \
                --job-definition "$DOC_JOB_DEF" \
                --parameters "inputPath=/rag-data,testMode=true" \
                --region "$REGION" \
                --query 'jobId' \
                --output text 2>/dev/null || echo "FAILED")
            
            if [ "$TEST_JOB_ID" != "FAILED" ]; then
                print_info "テストジョブが送信されました / Test job submitted: $TEST_JOB_ID"
                print_info "ジョブの完了を待機中... / Waiting for job completion..."
                
                # ジョブ完了を最大5分間待機
                TIMEOUT=300
                ELAPSED=0
                while [ $ELAPSED -lt $TIMEOUT ]; do
                    JOB_STATUS=$(aws batch describe-jobs \
                        --jobs "$TEST_JOB_ID" \
                        --region "$REGION" \
                        --query 'jobs[0].status' \
                        --output text 2>/dev/null || echo "UNKNOWN")
                    
                    if [ "$JOB_STATUS" = "SUCCEEDED" ]; then
                        print_status 0 "FSxマウントテストが成功しました / FSx mount test succeeded"
                        break
                    elif [ "$JOB_STATUS" = "FAILED" ]; then
                        print_status 1 "FSxマウントテストが失敗しました / FSx mount test failed"
                        break
                    elif [ "$JOB_STATUS" = "RUNNING" ] || [ "$JOB_STATUS" = "RUNNABLE" ] || [ "$JOB_STATUS" = "PENDING" ] || [ "$JOB_STATUS" = "SUBMITTED" ]; then
                        print_info "テストジョブ実行中... / Test job running... (Status: $JOB_STATUS)"
                        sleep 30
                        ELAPSED=$((ELAPSED + 30))
                    else
                        print_warning "テストジョブの状態が不明です / Test job status unknown: $JOB_STATUS"
                        break
                    fi
                done
                
                if [ $ELAPSED -ge $TIMEOUT ]; then
                    print_warning "テストジョブがタイムアウトしました / Test job timed out"
                fi
            else
                print_warning "テストジョブの送信に失敗しました / Failed to submit test job"
            fi
        else
            print_status 1 "FSx for NetApp ONTAPファイルシステムに問題があります / FSx for NetApp ONTAP file system has issues"
            print_info "ファイルシステム状態 / File System Status: $FSX_STATUS"
        fi
    else
        print_warning "FSx設定が見つかりません / FSx configuration not found"
    fi
else
    print_info "FSxは設定されていません / FSx is not configured"
fi

echo ""

# ステップ7: IAMロール検証
echo -e "${BLUE}🔍 ステップ7: IAMロールを検証中...${NC}"
echo -e "${BLUE}🔍 Step 7: Validating IAM roles...${NC}"

# Batchサービスロール
BATCH_SERVICE_ROLE="$PROJECT_NAME-$ENVIRONMENT-batch-service-role"
BATCH_SERVICE_ROLE_EXISTS=$(aws iam get-role --role-name "$BATCH_SERVICE_ROLE" --region "$REGION" 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND")

if [ "$BATCH_SERVICE_ROLE_EXISTS" = "EXISTS" ]; then
    print_status 0 "Batchサービスロールが存在します / Batch service role exists"
else
    print_status 1 "Batchサービスロールが見つかりません / Batch service role not found"
fi

# Batchインスタンスロール
BATCH_INSTANCE_ROLE="$PROJECT_NAME-$ENVIRONMENT-batch-instance-role"
BATCH_INSTANCE_ROLE_EXISTS=$(aws iam get-role --role-name "$BATCH_INSTANCE_ROLE" --region "$REGION" 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND")

if [ "$BATCH_INSTANCE_ROLE_EXISTS" = "EXISTS" ]; then
    print_status 0 "Batchインスタンスロールが存在します / Batch instance role exists"
else
    print_status 1 "Batchインスタンスロールが見つかりません / Batch instance role not found"
fi

# Batchジョブロール
BATCH_JOB_ROLE="$PROJECT_NAME-$ENVIRONMENT-batch-job-role"
BATCH_JOB_ROLE_EXISTS=$(aws iam get-role --role-name "$BATCH_JOB_ROLE" --region "$REGION" 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND")

if [ "$BATCH_JOB_ROLE_EXISTS" = "EXISTS" ]; then
    print_status 0 "Batchジョブロールが存在します / Batch job role exists"
else
    print_status 1 "Batchジョブロールが見つかりません / Batch job role not found"
fi

echo ""

# ステップ8: Amazon Bedrock接続テスト
echo -e "${BLUE}🔍 ステップ8: Amazon Bedrock接続をテスト中...${NC}"
echo -e "${BLUE}🔍 Step 8: Testing Amazon Bedrock connectivity...${NC}"

# Bedrockサポートリージョンチェック
BEDROCK_REGIONS=("us-east-1" "us-west-2" "eu-west-1" "ap-southeast-1" "ap-northeast-1")
BEDROCK_AVAILABLE=false

for bedrock_region in "${BEDROCK_REGIONS[@]}"; do
    if aws bedrock list-foundation-models --region "$bedrock_region" &> /dev/null 2>&1; then
        print_status 0 "Amazon Bedrockにアクセス可能です / Amazon Bedrock is accessible (Region: $bedrock_region)"
        BEDROCK_AVAILABLE=true
        
        # Titan Embeddings モデルの確認
        TITAN_MODELS=$(aws bedrock list-foundation-models \
            --region "$bedrock_region" \
            --query 'modelSummaries[?contains(modelId, `titan-embed`)]' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$TITAN_MODELS" ]; then
            print_info "Titan Embeddings モデルが利用可能です / Titan Embeddings model is available"
        else
            print_warning "Titan Embeddings モデルが見つかりません / Titan Embeddings model not found"
        fi
        break
    fi
done

if [ "$BEDROCK_AVAILABLE" = false ]; then
    print_status 1 "Amazon Bedrockにアクセスできません / Cannot access Amazon Bedrock"
    print_info "サポートリージョン / Supported regions: ${BEDROCK_REGIONS[*]}"
fi

echo ""

# 検証結果サマリー
echo -e "${GREEN}📊 検証結果サマリー / Validation Summary${NC}"
echo "============================================"

if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}🎉 すべての検証が成功しました！${NC}"
    echo -e "${GREEN}🎉 All validations passed successfully!${NC}"
    echo ""
    echo -e "${CYAN}✅ デプロイメントが正常に完了し、すべてのコンポーネントが動作しています。${NC}"
    echo -e "${CYAN}✅ Deployment completed successfully and all components are working.${NC}"
    echo ""
    echo -e "${CYAN}🚀 次のステップ / Next Steps:${NC}"
    echo "1. 文書をFSxボリュームにアップロード / Upload documents to FSx volume"
    echo "2. 埋め込み生成ジョブを実行 / Run embedding generation job"
    echo "3. RAGクエリジョブでテスト / Test with RAG query job"
else
    echo -e "${RED}❌ 一部の検証が失敗しました${NC}"
    echo -e "${RED}❌ Some validations failed${NC}"
    echo ""
    echo -e "${YELLOW}⚠️ 上記のエラーを確認し、必要に応じて修正してください。${NC}"
    echo -e "${YELLOW}⚠️ Please review the errors above and fix as needed.${NC}"
    echo ""
    echo -e "${CYAN}🔧 トラブルシューティング / Troubleshooting:${NC}"
    echo "1. CloudFormationコンソールでスタック状態を確認 / Check stack status in CloudFormation console"
    echo "2. AWS Batchコンソールでリソース状態を確認 / Check resource status in AWS Batch console"
    echo "3. CloudWatchログでエラー詳細を確認 / Check CloudWatch logs for error details"
fi

echo ""
echo -e "${CYAN}📋 リソース情報 / Resource Information${NC}"
echo "====================================="
echo "CloudFormationスタック / CloudFormation Stack: $STACK_NAME"
echo "S3バケット / S3 Bucket: $S3_BUCKET_NAME"
echo "DynamoDBテーブル / DynamoDB Table: $DYNAMODB_TABLE_NAME"
echo "Batchコンピュート環境 / Batch Compute Environment: $COMPUTE_ENV_NAME"
echo "Batchジョブキュー / Batch Job Queue: $JOB_QUEUE_NAME"

exit $OVERALL_STATUS