#!/bin/bash
set -euo pipefail

# ============================================================
# FSx ONTAP 運用自動化 — AWS 環境統合検証スクリプト
# ============================================================
# 使い方:
#   環境変数で設定するか、引数なしで実行するとプロンプトで入力を求めます。
#
#   export FSXN_FS_ID=fs-0123456789abcdef0
#   export FSXN_MGMT_LIF=10.0.1.100
#   export FSXN_SECRET_ID=fsx-ontap-fsxadmin-credentials
#   export FSXN_SVM_NAME=MySVM
#   export FSXN_SUBNET=subnet-xxx
#   export FSXN_SG=sg-xxx
#   bash run_aws_verification.sh
# ============================================================

REGION="${AWS_DEFAULT_REGION:-ap-northeast-1}"
ROLE_NAME="fsxn-ops-verification-role"

# 環境変数から取得 (未設定の場合は FSx API で自動検出)
FS_ID="${FSXN_FS_ID:-}"
MGMT_LIF="${FSXN_MGMT_LIF:-}"
SECRET_ID="${FSXN_SECRET_ID:-fsx-ontap-fsxadmin-credentials}"
SVM_NAME="${FSXN_SVM_NAME:-}"
SUBNET="${FSXN_SUBNET:-}"
SG="${FSXN_SG:-}"
LAMBDA_DIR="$(dirname "$0")/../../lambda"

echo "============================================"
echo "FSx ONTAP 運用自動化 — AWS 統合検証"
echo "============================================"
echo ""

# --- 自動検出 ---
if [ -z "$FS_ID" ]; then
  FS_ID=$(aws fsx describe-file-systems --query 'FileSystems[?FileSystemType==`ONTAP` && Lifecycle==`AVAILABLE`].FileSystemId | [0]' --output text 2>/dev/null)
  echo "Auto-detected FS_ID: $FS_ID"
fi
if [ -z "$MGMT_LIF" ]; then
  MGMT_LIF=$(aws fsx describe-file-systems --file-system-ids "$FS_ID" --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text 2>/dev/null)
  echo "Auto-detected MGMT_LIF: $MGMT_LIF"
fi
if [ -z "$SVM_NAME" ]; then
  SVM_NAME=$(aws fsx describe-storage-virtual-machines --query "StorageVirtualMachines[?FileSystemId==\`$FS_ID\` && !starts_with(Name, \`FsxId\`)].Name | [0]" --output text 2>/dev/null)
  echo "Auto-detected SVM_NAME: $SVM_NAME"
fi
if [ -z "$SUBNET" ]; then
  VPC_ID=$(aws fsx describe-file-systems --file-system-ids "$FS_ID" --query 'FileSystems[0].VpcId' --output text 2>/dev/null)
  SUBNET=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[?MapPublicIpOnLaunch==`false`].SubnetId | [0]' --output text 2>/dev/null)
  if [ "$SUBNET" = "None" ] || [ -z "$SUBNET" ]; then
    SUBNET=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[0].SubnetId' --output text 2>/dev/null)
  fi
  echo "Auto-detected SUBNET: $SUBNET"
fi
if [ -z "$SG" ]; then
  VPC_ID=$(aws fsx describe-file-systems --file-system-ids "$FS_ID" --query 'FileSystems[0].VpcId' --output text 2>/dev/null)
  SG=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)
  echo "Auto-detected SG: $SG"
fi
echo ""

# --- Helper ---
get_account_id() {
  aws sts get-caller-identity --query Account --output text
}
ACCOUNT_ID=$(get_account_id)
echo "Account: $ACCOUNT_ID"
echo "Region:  $REGION"
echo ""

# ============================================================
# Phase 0: IAM ロール作成
# ============================================================
echo ">>> Phase 0: IAM ロール作成"

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --output text --query 'Role.Arn' 2>/dev/null || true

aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true
aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole 2>/dev/null || true
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name InlinePolicy \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"*"},{"Effect":"Allow","Action":["fsx:Describe*","fsx:Update*"],"Resource":"*"},{"Effect":"Allow","Action":["cloudwatch:GetMetric*"],"Resource":"*"},{"Effect":"Allow","Action":["sns:Publish"],"Resource":"*"}]}' 2>/dev/null || true

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "  Role: $ROLE_ARN"
echo "  Waiting 12s for IAM propagation..."
sleep 12
echo "  Done."
echo ""

# ============================================================
# Phase 1: Lambda パッケージ作成
# ============================================================
echo ">>> Phase 1: Lambda パッケージ作成"

# connectivity test
(cd "$LAMBDA_DIR/../tests/integration" && zip -j /tmp/fsxn_test_connectivity.zip test_ontap_connectivity.py) > /dev/null 2>&1
echo "  /tmp/fsxn_test_connectivity.zip"

# capacity_monitor
(cd "$LAMBDA_DIR" && zip -r /tmp/fsxn_capacity_monitor.zip common/ capacity_monitor/) > /dev/null 2>&1
echo "  /tmp/fsxn_capacity_monitor.zip"

# ontap_api_executor
(cd "$LAMBDA_DIR" && zip -r /tmp/fsxn_ontap_api_executor.zip common/ ontap_api_executor/) > /dev/null 2>&1
echo "  /tmp/fsxn_ontap_api_executor.zip"

# snapmirror_ops
(cd "$LAMBDA_DIR" && zip -r /tmp/fsxn_snapmirror_ops.zip common/ snapmirror_ops/) > /dev/null 2>&1
echo "  /tmp/fsxn_snapmirror_ops.zip"

echo ""

# ============================================================
# Helper: Lambda 作成・実行・結果取得
# ============================================================
create_and_invoke_lambda() {
  local FUNC_NAME="$1"
  local HANDLER="$2"
  local ZIP_FILE="$3"
  local PAYLOAD="$4"
  local TIMEOUT="${5:-120}"
  local ENV_JSON="$6"
  local RESULT_FILE="/tmp/fsxn_result_${FUNC_NAME}.json"

  echo "  Creating $FUNC_NAME..."
  aws lambda create-function \
    --function-name "$FUNC_NAME" \
    --runtime python3.12 \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file "fileb://$ZIP_FILE" \
    --timeout "$TIMEOUT" \
    --memory-size 256 \
    --vpc-config "SubnetIds=$SUBNET,SecurityGroupIds=$SG" \
    --environment "$ENV_JSON" \
    --output text --query 'FunctionArn' 2>&1 || {
      echo "  WARN: Function may already exist, updating code..."
      aws lambda update-function-code \
        --function-name "$FUNC_NAME" \
        --zip-file "fileb://$ZIP_FILE" \
        --output text --query 'FunctionArn' 2>&1
    }

  echo "  Waiting for $FUNC_NAME to be active..."
  aws lambda wait function-active-v2 --function-name "$FUNC_NAME" 2>&1

  echo "  Invoking $FUNC_NAME..."
  aws lambda invoke \
    --function-name "$FUNC_NAME" \
    --cli-binary-format raw-in-base64-out \
    --payload "$PAYLOAD" \
    --cli-read-timeout 300 \
    "$RESULT_FILE" > /dev/null 2>&1

  echo "  Result:"
  cat "$RESULT_FILE" | python3 -m json.tool 2>&1 | head -40
  echo ""
}

# ============================================================
# Phase 2: ONTAP REST API 疎通テスト
# ============================================================
echo ">>> Phase 2: ONTAP REST API 疎通テスト"
create_and_invoke_lambda \
  "fsxn-verify-connectivity" \
  "test_ontap_connectivity.handler" \
  "/tmp/fsxn_test_connectivity.zip" \
  '{}' \
  120 \
  "{\"Variables\":{\"MANAGEMENT_LIF\":\"$MGMT_LIF\",\"ONTAP_SECRET_ID\":\"$SECRET_ID\"}}"

# ============================================================
# Phase 3: capacity_monitor テスト
# ============================================================
echo ">>> Phase 3: capacity_monitor テスト"
create_and_invoke_lambda \
  "fsxn-verify-capacity-monitor" \
  "capacity_monitor.handler.handler" \
  "/tmp/fsxn_capacity_monitor.zip" \
  '{"source":"verification-test"}' \
  300 \
  "{\"Variables\":{\"FSX_FILESYSTEM_ID\":\"$FS_ID\",\"ONTAP_SECRET_ID\":\"$SECRET_ID\",\"MANAGEMENT_LIF\":\"$MGMT_LIF\",\"SNS_TOPIC_ARN\":\"\",\"FS_THRESHOLD_PCT\":\"85\",\"VOL_THRESHOLD_PCT\":\"80\",\"AUTO_RESIZE_ENABLED\":\"false\",\"DRY_RUN\":\"true\"}}"

# ============================================================
# Phase 4: ontap_api_executor テスト
# ============================================================
echo ">>> Phase 4: ontap_api_executor テスト"
create_and_invoke_lambda \
  "fsxn-verify-api-executor" \
  "ontap_api_executor.handler.handler" \
  "/tmp/fsxn_ontap_api_executor.zip" \
  '{"method":"GET","path":"/cluster","params":{"fields":"name,version"}}' \
  120 \
  "{\"Variables\":{\"ONTAP_SECRET_ID\":\"$SECRET_ID\",\"MANAGEMENT_LIF\":\"$MGMT_LIF\",\"ALLOWED_OPERATIONS\":\"GET\"}}"

# ============================================================
# Phase 5: snapmirror_ops テスト (discover のみ)
# ============================================================
echo ">>> Phase 5: snapmirror_ops テスト"
create_and_invoke_lambda \
  "fsxn-verify-snapmirror-ops" \
  "snapmirror_ops.handler.handler" \
  "/tmp/fsxn_snapmirror_ops.zip" \
  "{\"action\":\"discover\",\"management_lif\":\"$MGMT_LIF\",\"svm_name\":\"$SVM_NAME\"}" \
  120 \
  "{\"Variables\":{\"ONTAP_SECRET_ID\":\"$SECRET_ID\"}}"

# discover_shares テスト
echo "  --- discover_shares ---"
aws lambda invoke \
  --function-name "fsxn-verify-snapmirror-ops" \
  --cli-binary-format raw-in-base64-out \
  --payload "{\"action\":\"discover_shares\",\"management_lif\":\"$MGMT_LIF\",\"svm_name\":\"$SVM_NAME\"}" \
  --cli-read-timeout 120 \
  /tmp/fsxn_result_discover_shares.json > /dev/null 2>&1
cat /tmp/fsxn_result_discover_shares.json | python3 -m json.tool 2>&1 | head -20
echo ""

# ============================================================
# Phase 6: Step Functions テスト
# ============================================================
echo ">>> Phase 6: Step Functions テスト"

SFN_ROLE_NAME="fsxn-verify-sfn-role"
aws iam create-role \
  --role-name "$SFN_ROLE_NAME" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"states.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  --output text --query 'Role.Arn' 2>/dev/null || true
aws iam put-role-policy --role-name "$SFN_ROLE_NAME" --policy-name SfnPolicy \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:fsxn-verify-*\"}]}" 2>/dev/null || true

SFN_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${SFN_ROLE_NAME}"
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:fsxn-verify-snapmirror-ops"

echo "  Waiting 10s for IAM propagation..."
sleep 10

SFN_DEF="{\"Comment\":\"Verification Test\",\"StartAt\":\"Discover\",\"States\":{\"Discover\":{\"Type\":\"Task\",\"Resource\":\"$LAMBDA_ARN\",\"Parameters\":{\"action\":\"discover\",\"management_lif.\$\":\"$.mgmt_lif\",\"svm_name.\$\":\"$.svm\"},\"ResultPath\":\"$.discovery\",\"Next\":\"DiscoverShares\"},\"DiscoverShares\":{\"Type\":\"Task\",\"Resource\":\"$LAMBDA_ARN\",\"Parameters\":{\"action\":\"discover_shares\",\"management_lif.\$\":\"$.mgmt_lif\",\"svm_name.\$\":\"$.svm\"},\"ResultPath\":\"$.shares\",\"Next\":\"Done\"},\"Done\":{\"Type\":\"Succeed\"}}}"

SFN_ARN=$(aws stepfunctions create-state-machine \
  --name "fsxn-verify-failover-test" \
  --definition "$SFN_DEF" \
  --role-arn "$SFN_ROLE_ARN" \
  --type STANDARD \
  --query 'stateMachineArn' --output text 2>&1)
echo "  State Machine: $SFN_ARN"

EXEC_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn "$SFN_ARN" \
  --input "{\"mgmt_lif\":\"$MGMT_LIF\",\"svm\":\"$SVM_NAME\"}" \
  --query 'executionArn' --output text 2>&1)
echo "  Execution: $EXEC_ARN"
echo "  Waiting for completion..."

for i in $(seq 1 20); do
  sleep 10
  STATUS=$(aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" --query 'status' --output text 2>&1)
  echo "    [$i] Status: $STATUS"
  if [ "$STATUS" = "SUCCEEDED" ] || [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "TIMED_OUT" ] || [ "$STATUS" = "ABORTED" ]; then
    break
  fi
done

echo "  Final result:"
aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" --query '{Status:status}' --output json 2>&1
echo ""

# ============================================================
# Phase 7: クリーンアップ
# ============================================================
echo ">>> Phase 7: クリーンアップ"

for FUNC in fsxn-verify-connectivity fsxn-verify-capacity-monitor fsxn-verify-api-executor fsxn-verify-snapmirror-ops; do
  echo "  Deleting Lambda: $FUNC"
  aws lambda delete-function --function-name "$FUNC" 2>/dev/null || true
done

echo "  Deleting State Machine..."
aws stepfunctions delete-state-machine --state-machine-arn "$SFN_ARN" 2>/dev/null || true

echo "  Deleting IAM roles..."
for ROLE in "$ROLE_NAME" "$SFN_ROLE_NAME"; do
  # Detach managed policies
  for POLICY_ARN in $(aws iam list-attached-role-policies --role-name "$ROLE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
    aws iam detach-role-policy --role-name "$ROLE" --policy-arn "$POLICY_ARN" 2>/dev/null || true
  done
  # Delete inline policies
  for POLICY_NAME in $(aws iam list-role-policies --role-name "$ROLE" --query 'PolicyNames[]' --output text 2>/dev/null); do
    aws iam delete-role-policy --role-name "$ROLE" --policy-name "$POLICY_NAME" 2>/dev/null || true
  done
  aws iam delete-role --role-name "$ROLE" 2>/dev/null || true
done

echo "  Done."
echo ""

# ============================================================
# サマリー
# ============================================================
echo "============================================"
echo "検証完了"
echo "============================================"
echo ""
echo "Phase 1: CFn テンプレート検証     — (別途実行済み)"
echo "Phase 2: ONTAP REST API 疎通     — 結果: /tmp/fsxn_result_fsxn-verify-connectivity.json"
echo "Phase 3: capacity_monitor        — 結果: /tmp/fsxn_result_fsxn-verify-capacity-monitor.json"
echo "Phase 4: ontap_api_executor      — 結果: /tmp/fsxn_result_fsxn-verify-api-executor.json"
echo "Phase 5: snapmirror_ops          — 結果: /tmp/fsxn_result_fsxn-verify-snapmirror-ops.json"
echo "Phase 6: Step Functions          — Status: $STATUS"
echo "Phase 7: クリーンアップ           — 完了"
