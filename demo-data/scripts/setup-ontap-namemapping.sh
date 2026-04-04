#!/bin/bash
set -euo pipefail

###############################################################################
# ONTAP Name-Mapping セットアップスクリプト
#
# FSx ONTAP REST APIに接続し、name-mappingルール（UNIX→Windows）を設定する。
# Permission Resolver LambdaがONTAP REST API経由でマッピングを取得できることを検証。
#
# 前提:
#   - AWS CLI設定済み（ap-northeast-1）
#   - FSx ONTAPがデプロイ済み（Storage Stack）
#   - fsxadminパスワードが設定済み
###############################################################################

REGION="ap-northeast-1"
STACK_PREFIX="perm-rag-demo-demo"

# ========================================
# FSx ONTAP情報取得
# ========================================
echo "📋 FSx ONTAP情報を取得中..."

FS_ID=$(aws fsx describe-file-systems \
  --region "$REGION" \
  --query 'FileSystems[?FileSystemType==`ONTAP`] | [0].FileSystemId' \
  --output text)

MGMT_IP=$(aws fsx describe-file-systems \
  --region "$REGION" \
  --query 'FileSystems[?FileSystemType==`ONTAP`] | [0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' \
  --output text)

SVM_UUID=$(aws fsx describe-storage-virtual-machines \
  --region "$REGION" \
  --query 'StorageVirtualMachines[0].UUID' \
  --output text)

SVM_NAME=$(aws fsx describe-storage-virtual-machines \
  --region "$REGION" \
  --query 'StorageVirtualMachines[0].Name' \
  --output text)

SVM_MGMT_IP=$(aws fsx describe-storage-virtual-machines \
  --region "$REGION" \
  --query 'StorageVirtualMachines[0].Endpoints.Management.IpAddresses[0]' \
  --output text)

echo "  FileSystem ID: $FS_ID"
echo "  FS Management IP: $MGMT_IP"
echo "  SVM UUID: $SVM_UUID"
echo "  SVM Name: $SVM_NAME"
echo "  SVM Management IP: $SVM_MGMT_IP"

# ========================================
# fsxadmin パスワード確認
# ========================================
echo ""
echo "🔐 fsxadmin認証情報を確認..."

# Secrets Managerからfsxadminパスワードを取得（存在する場合）
ONTAP_SECRET_NAME="ontap-fsxadmin-password"
FSXADMIN_PASSWORD=""

if aws secretsmanager describe-secret --secret-id "$ONTAP_SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  FSXADMIN_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id "$ONTAP_SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' --output text)
  echo "  Secrets Managerからパスワード取得済み"
else
  echo ""
  echo "⚠️  fsxadminパスワードがSecrets Managerに登録されていません。"
  echo "  FSx ONTAPコンソールでfsxadminパスワードを設定し、以下のコマンドで登録してください:"
  echo ""
  echo "  aws secretsmanager create-secret \\"
  echo "    --name $ONTAP_SECRET_NAME \\"
  echo "    --description 'FSx ONTAP fsxadmin password' \\"
  echo "    --secret-string 'YOUR_FSXADMIN_PASSWORD' \\"
  echo "    --region $REGION"
  echo ""
  read -p "  fsxadminパスワードを入力 (スキップする場合はEnter): " FSXADMIN_PASSWORD

  if [ -z "$FSXADMIN_PASSWORD" ]; then
    echo "  ❌ パスワード未入力。スクリプトを終了します。"
    echo ""
    echo "  📝 FSxコンソールでfsxadminパスワードを設定する手順:"
    echo "    1. AWS Console → FSx → File systems → $FS_ID"
    echo "    2. Administration タブ → Update file system"
    echo "    3. ONTAP administration password を設定"
    echo "    4. このスクリプトを再実行"
    exit 1
  fi

  # Secrets Managerに保存
  aws secretsmanager create-secret \
    --name "$ONTAP_SECRET_NAME" \
    --description "FSx ONTAP fsxadmin password" \
    --secret-string "$FSXADMIN_PASSWORD" \
    --region "$REGION" >/dev/null
  echo "  Secrets Managerに保存しました"
fi

ONTAP_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id "$ONTAP_SECRET_NAME" \
  --region "$REGION" \
  --query 'ARN' --output text)

echo "  Secret ARN: $ONTAP_SECRET_ARN"

# ========================================
# ONTAP REST API接続テスト
# ========================================
echo ""
echo "🔍 ONTAP REST API接続テスト..."

# VPC内からのみアクセス可能なため、Lambda経由でテストする必要がある場合がある
# ここではEC2（OpenLDAP or 踏み台）経由でテストする

# まずローカルからの接続を試行（VPN接続時のみ成功）
echo "  Management Endpoint: https://${MGMT_IP}/api"

API_TEST=$(curl -sk -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 \
  -u "fsxadmin:${FSXADMIN_PASSWORD}" \
  "https://${MGMT_IP}/api/cluster" 2>/dev/null || echo "000")

if [ "$API_TEST" = "200" ]; then
  echo "  ✅ ローカルからONTAP REST APIに接続成功"
  ONTAP_ACCESS="local"
elif [ "$API_TEST" = "401" ]; then
  echo "  ❌ 認証失敗 (401)。fsxadminパスワードを確認してください。"
  exit 1
else
  echo "  ⚠️  ローカルからの接続不可 (HTTP $API_TEST)"
  echo "  VPC内のEC2経由でアクセスします..."
  ONTAP_ACCESS="ec2"
fi

# ========================================
# Name-Mappingルール設定
# ========================================
echo ""
echo "📝 Name-Mappingルールを設定..."

# Name-Mappingルール定義（UNIX→Windows）
# テストユーザーのマッピング:
#   alice (UNIX) → DEMO\alice (Windows)
#   bob (UNIX) → DEMO\bob (Windows)
#   charlie (UNIX) → DEMO\charlie (Windows)
#   * (UNIX) → DEMO\{user} (Windows) — ワイルドカード

setup_namemapping_via_ec2() {
  local INSTANCE_ID="$1"

  # EC2経由でONTAP REST APIにアクセス
  local COMMANDS=$(cat <<CMDS
#!/bin/bash
set -e

MGMT_IP="${MGMT_IP}"
PASSWORD="${FSXADMIN_PASSWORD}"
SVM_UUID="${SVM_UUID}"

# 既存ルール確認
echo "=== 既存Name-Mappingルール ==="
curl -sk -u "fsxadmin:\${PASSWORD}" \\
  "https://\${MGMT_IP}/api/name-services/name-mappings?svm.uuid=\${SVM_UUID}" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "(no rules)"

# ルール1: alice → DEMO\\alice
echo ""
echo "=== ルール1: alice → DEMO\\\\alice ==="
curl -sk -X POST -u "fsxadmin:\${PASSWORD}" \\
  -H "Content-Type: application/json" \\
  "https://\${MGMT_IP}/api/name-services/name-mappings" \\
  -d '{
    "svm": {"uuid": "'""\${SVM_UUID}""'"},
    "direction": "unix_win",
    "index": 1,
    "pattern": "alice",
    "replacement": "DEMO\\\\alice"
  }' 2>/dev/null && echo " OK" || echo " (may already exist)"

# ルール2: bob → DEMO\\bob
echo "=== ルール2: bob → DEMO\\\\bob ==="
curl -sk -X POST -u "fsxadmin:\${PASSWORD}" \\
  -H "Content-Type: application/json" \\
  "https://\${MGMT_IP}/api/name-services/name-mappings" \\
  -d '{
    "svm": {"uuid": "'""\${SVM_UUID}""'"},
    "direction": "unix_win",
    "index": 2,
    "pattern": "bob",
    "replacement": "DEMO\\\\bob"
  }' 2>/dev/null && echo " OK" || echo " (may already exist)"

# ルール3: charlie → DEMO\\charlie
echo "=== ルール3: charlie → DEMO\\\\charlie ==="
curl -sk -X POST -u "fsxadmin:\${PASSWORD}" \\
  -H "Content-Type: application/json" \\
  "https://\${MGMT_IP}/api/name-services/name-mappings" \\
  -d '{
    "svm": {"uuid": "'""\${SVM_UUID}""'"},
    "direction": "unix_win",
    "index": 3,
    "pattern": "charlie",
    "replacement": "DEMO\\\\charlie"
  }' 2>/dev/null && echo " OK" || echo " (may already exist)"

# 設定確認
echo ""
echo "=== 設定後のName-Mappingルール ==="
curl -sk -u "fsxadmin:\${PASSWORD}" \\
  "https://\${MGMT_IP}/api/name-services/name-mappings?svm.uuid=\${SVM_UUID}&direction=unix_win" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "(error)"

echo ""
echo "=== ONTAP REST API クラスタ情報 ==="
curl -sk -u "fsxadmin:\${PASSWORD}" \\
  "https://\${MGMT_IP}/api/cluster" 2>/dev/null | python3 -m json.tool 2>/dev/null | head -20
CMDS
)

  local CMD_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[$(echo "$COMMANDS" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')]" \
    --timeout-seconds 60 \
    --region "$REGION" \
    --query 'Command.CommandId' --output text)

  echo "  SSMコマンド送信: $CMD_ID"
  echo "  ⏳ 実行待機..."
  sleep 15

  aws ssm get-command-invocation \
    --command-id "$CMD_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' \
    --output json 2>/dev/null || echo "  (結果取得中...)"
}

setup_namemapping_local() {
  # ローカルから直接ONTAP REST APIにアクセス
  echo "  既存ルール確認..."
  curl -sk -u "fsxadmin:${FSXADMIN_PASSWORD}" \
    "https://${MGMT_IP}/api/name-services/name-mappings?svm.uuid=${SVM_UUID}&direction=unix_win" 2>/dev/null \
    | python3 -m json.tool 2>/dev/null || echo "  (no rules)"

  echo ""
  echo "  ルール設定中..."

  for i in 1 2 3; do
    case $i in
      1) PATTERN="alice"; REPLACEMENT='DEMO\\alice' ;;
      2) PATTERN="bob"; REPLACEMENT='DEMO\\bob' ;;
      3) PATTERN="charlie"; REPLACEMENT='DEMO\\charlie' ;;
    esac

    HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
      -X POST -u "fsxadmin:${FSXADMIN_PASSWORD}" \
      -H "Content-Type: application/json" \
      "https://${MGMT_IP}/api/name-services/name-mappings" \
      -d "{
        \"svm\": {\"uuid\": \"${SVM_UUID}\"},
        \"direction\": \"unix_win\",
        \"index\": ${i},
        \"pattern\": \"${PATTERN}\",
        \"replacement\": \"${REPLACEMENT}\"
      }" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
      echo "  ✅ ルール${i}: ${PATTERN} → ${REPLACEMENT}"
    elif [ "$HTTP_CODE" = "409" ]; then
      echo "  ⏭️  ルール${i}: ${PATTERN} → ${REPLACEMENT} (既存)"
    else
      echo "  ⚠️  ルール${i}: HTTP ${HTTP_CODE}"
    fi
  done

  echo ""
  echo "  設定後のルール一覧:"
  curl -sk -u "fsxadmin:${FSXADMIN_PASSWORD}" \
    "https://${MGMT_IP}/api/name-services/name-mappings?svm.uuid=${SVM_UUID}&direction=unix_win" 2>/dev/null \
    | python3 -m json.tool 2>/dev/null || echo "  (error)"
}

if [ "$ONTAP_ACCESS" = "local" ]; then
  setup_namemapping_local
else
  # EC2インスタンスを探す（OpenLDAPサーバーを再利用）
  EC2_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" \
              "Name=instance-state-name,Values=running" \
    --region "$REGION" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || echo "None")

  if [ "$EC2_INSTANCE" = "None" ] || [ -z "$EC2_INSTANCE" ]; then
    echo "  ❌ VPC内のEC2インスタンスが見つかりません。"
    echo "  先に setup-openldap.sh を実行してEC2を起動してください。"
    exit 1
  fi

  echo "  EC2経由でアクセス: $EC2_INSTANCE"
  setup_namemapping_via_ec2 "$EC2_INSTANCE"
fi

# ========================================
# 結果サマリー
# ========================================
echo ""
echo "============================================"
echo "✅ ONTAP Name-Mapping セットアップ完了"
echo "============================================"
echo ""
echo "📋 ONTAP情報:"
echo "  FileSystem ID:    $FS_ID"
echo "  Management IP:    $MGMT_IP"
echo "  SVM UUID:         $SVM_UUID"
echo "  SVM Name:         $SVM_NAME"
echo "  Admin Secret ARN: $ONTAP_SECRET_ARN"
echo ""
echo "📝 Name-Mappingルール:"
echo "  1. alice   → DEMO\\alice"
echo "  2. bob     → DEMO\\bob"
echo "  3. charlie → DEMO\\charlie"
echo ""
echo "📝 cdk.context.json に追加する設定:"
echo "  \"ontapNameMappingEnabled\": true,"
echo "  \"ontapMgmtIp\": \"${MGMT_IP}\","
echo "  \"ontapSvmUuid\": \"${SVM_UUID}\","
echo "  \"ontapAdminSecretArn\": \"${ONTAP_SECRET_ARN}\""
echo ""
echo "🔧 次のステップ:"
echo "  1. cdk.context.json に上記設定を追加"
echo "  2. npx cdk deploy ${STACK_PREFIX}-Security ${STACK_PREFIX}-WebApp"
echo "  3. demo-data/scripts/verify-ontap-namemapping.sh を実行"
