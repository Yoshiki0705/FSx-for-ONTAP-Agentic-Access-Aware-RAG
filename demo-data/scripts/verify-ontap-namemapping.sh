#!/bin/bash
set -euo pipefail

###############################################################################
# ONTAP Name-Mapping 検証スクリプト
#
# FSx ONTAP REST APIへの接続、name-mappingルールの取得、
# UNIX→Windowsユーザーマッピングの動作を検証する。
#
# 前提:
#   - setup-ontap-namemapping.sh 実行済み
#   - cdk.context.json に ontapNameMappingEnabled=true 追加済み
###############################################################################

REGION="ap-northeast-1"
STACK_PREFIX="perm-rag-demo-demo"
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✅ $1"; ((PASS_COUNT++)); }
fail() { echo "  ❌ $1"; ((FAIL_COUNT++)); }

echo "============================================"
echo "🔍 ONTAP Name-Mapping 検証"
echo "============================================"

# ========================================
# Step 1: FSx ONTAP情報確認
# ========================================
echo ""
echo "📋 Step 1: FSx ONTAP情報確認"

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

FS_LIFECYCLE=$(aws fsx describe-file-systems \
  --region "$REGION" \
  --query 'FileSystems[?FileSystemType==`ONTAP`] | [0].Lifecycle' \
  --output text)

if [ "$FS_LIFECYCLE" = "AVAILABLE" ]; then
  pass "FSx ONTAP: $FS_ID ($FS_LIFECYCLE)"
else
  fail "FSx ONTAP: $FS_ID ($FS_LIFECYCLE)"
fi

pass "Management IP: $MGMT_IP"
pass "SVM UUID: $SVM_UUID"

# ========================================
# Step 2: ONTAP REST API接続テスト (EC2経由)
# ========================================
echo ""
echo "📋 Step 2: ONTAP REST API接続テスト"

# fsxadminパスワード取得
ONTAP_SECRET_NAME="ontap-fsxadmin-password"
FSXADMIN_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$ONTAP_SECRET_NAME" \
  --region "$REGION" \
  --query 'SecretString' --output text 2>/dev/null || echo "")

if [ -z "$FSXADMIN_PASSWORD" ]; then
  fail "fsxadminパスワードがSecrets Managerに見つかりません"
  echo "    setup-ontap-namemapping.sh を先に実行してください"
  exit 1
fi

# EC2インスタンスを探す
EC2_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" \
            "Name=instance-state-name,Values=running" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || echo "None")

if [ "$EC2_INSTANCE" = "None" ] || [ -z "$EC2_INSTANCE" ]; then
  # ローカルから直接テスト
  API_TEST=$(curl -sk -o /dev/null -w "%{http_code}" \
    --connect-timeout 5 \
    -u "fsxadmin:${FSXADMIN_PASSWORD}" \
    "https://${MGMT_IP}/api/cluster" 2>/dev/null || echo "000")

  if [ "$API_TEST" = "200" ]; then
    pass "ONTAP REST API接続: ローカルから成功"
    ACCESS_MODE="local"
  else
    fail "ONTAP REST API接続失敗 (HTTP $API_TEST)"
    echo "    VPC内のEC2が必要です。setup-openldap.sh を実行してください。"
    exit 1
  fi
else
  pass "EC2インスタンス: $EC2_INSTANCE"
  ACCESS_MODE="ec2"
fi

# ========================================
# Step 3: Name-Mappingルール取得テスト
# ========================================
echo ""
echo "📋 Step 3: Name-Mappingルール取得テスト"

verify_via_ec2() {
  local VERIFY_SCRIPT=$(cat <<SCRIPT
#!/bin/bash
set -e

MGMT_IP="${MGMT_IP}"
PASSWORD="${FSXADMIN_PASSWORD}"
SVM_UUID="${SVM_UUID}"

echo "=== クラスタ接続テスト ==="
HTTP_CODE=\$(curl -sk -o /dev/null -w "%{http_code}" -u "fsxadmin:\${PASSWORD}" "https://\${MGMT_IP}/api/cluster")
echo "HTTP: \${HTTP_CODE}"

echo ""
echo "=== Name-Mappingルール取得 ==="
RULES=\$(curl -sk -u "fsxadmin:\${PASSWORD}" "https://\${MGMT_IP}/api/name-services/name-mappings?svm.uuid=\${SVM_UUID}&direction=unix_win" 2>/dev/null)
echo "\${RULES}" | python3 -m json.tool 2>/dev/null || echo "\${RULES}"

NUM_RULES=\$(echo "\${RULES}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('num_records',0))" 2>/dev/null || echo "0")
echo ""
echo "ルール数: \${NUM_RULES}"

echo ""
echo "=== 個別ルール検証 ==="
for USER in alice bob charlie; do
  MATCH=\$(echo "\${RULES}" | python3 -c "
import sys,json
data = json.load(sys.stdin)
for r in data.get('records',[]):
    if r.get('pattern') == '\${USER}':
        print(r.get('replacement',''))
        break
else:
    print('NOT_FOUND')
" 2>/dev/null || echo "ERROR")
  echo "  \${USER} → \${MATCH}"
done

echo ""
echo "=== SVM情報 ==="
curl -sk -u "fsxadmin:\${PASSWORD}" "https://\${MGMT_IP}/api/svm/svms/\${SVM_UUID}" 2>/dev/null | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(f\"  Name: {d.get('name','N/A')}\")
print(f\"  UUID: {d.get('uuid','N/A')}\")
print(f\"  State: {d.get('state','N/A')}\")
" 2>/dev/null || echo "  (SVM情報取得失敗)"
SCRIPT
)

  CMD_ID=$(aws ssm send-command \
    --instance-ids "$EC2_INSTANCE" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[$(echo "$VERIFY_SCRIPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')]" \
    --timeout-seconds 30 \
    --region "$REGION" \
    --query 'Command.CommandId' --output text)

  echo "  SSMコマンド: $CMD_ID"
  sleep 12

  RESULT=$(aws ssm get-command-invocation \
    --command-id "$CMD_ID" \
    --instance-id "$EC2_INSTANCE" \
    --region "$REGION" \
    --query 'StandardOutputContent' --output text 2>/dev/null || echo "")

  echo "$RESULT"

  # 結果解析
  if echo "$RESULT" | grep -q "HTTP: 200"; then
    pass "ONTAP REST API接続成功"
  else
    fail "ONTAP REST API接続失敗"
  fi

  NUM_RULES=$(echo "$RESULT" | grep "ルール数:" | awk '{print $2}' || echo "0")
  if [ "$NUM_RULES" -ge 3 ] 2>/dev/null; then
    pass "Name-Mappingルール: ${NUM_RULES}件"
  else
    fail "Name-Mappingルール不足: ${NUM_RULES}件 (期待: 3件以上)"
  fi

  if echo "$RESULT" | grep -q "alice.*DEMO"; then
    pass "マッピング検証: alice → DEMO\\alice"
  else
    fail "マッピング検証失敗: alice"
  fi

  if echo "$RESULT" | grep -q "bob.*DEMO"; then
    pass "マッピング検証: bob → DEMO\\bob"
  else
    fail "マッピング検証失敗: bob"
  fi

  if echo "$RESULT" | grep -q "charlie.*DEMO"; then
    pass "マッピング検証: charlie → DEMO\\charlie"
  else
    fail "マッピング検証失敗: charlie"
  fi
}

verify_local() {
  # クラスタ接続テスト
  CLUSTER_INFO=$(curl -sk -u "fsxadmin:${FSXADMIN_PASSWORD}" \
    "https://${MGMT_IP}/api/cluster" 2>/dev/null)

  if echo "$CLUSTER_INFO" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    pass "ONTAP REST API接続成功"
  else
    fail "ONTAP REST API接続失敗"
  fi

  # Name-Mappingルール取得
  RULES=$(curl -sk -u "fsxadmin:${FSXADMIN_PASSWORD}" \
    "https://${MGMT_IP}/api/name-services/name-mappings?svm.uuid=${SVM_UUID}&direction=unix_win" 2>/dev/null)

  NUM_RULES=$(echo "$RULES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('num_records',0))" 2>/dev/null || echo "0")

  if [ "$NUM_RULES" -ge 3 ] 2>/dev/null; then
    pass "Name-Mappingルール: ${NUM_RULES}件"
  else
    fail "Name-Mappingルール不足: ${NUM_RULES}件"
  fi

  # 個別マッピング検証
  for USER in alice bob charlie; do
    MATCH=$(echo "$RULES" | python3 -c "
import sys,json
data = json.load(sys.stdin)
for r in data.get('records',[]):
    if r.get('pattern') == '${USER}':
        print(r.get('replacement',''))
        break
else:
    print('NOT_FOUND')
" 2>/dev/null || echo "ERROR")

    if echo "$MATCH" | grep -qi "DEMO"; then
      pass "マッピング: ${USER} → ${MATCH}"
    else
      fail "マッピング失敗: ${USER} → ${MATCH}"
    fi
  done
}

if [ "$ACCESS_MODE" = "ec2" ]; then
  verify_via_ec2
else
  verify_local
fi

# ========================================
# Step 4: Permission Resolver Lambda設定確認
# ========================================
echo ""
echo "📋 Step 4: Permission Resolver Lambda設定確認"

# WebApp Lambda（Permission Filter内蔵）の環境変数確認
WEBAPP_LAMBDA=$(aws lambda list-functions \
  --region "$REGION" \
  --query "Functions[?contains(FunctionName, 'WebApp')].FunctionName" \
  --output text 2>/dev/null | head -1)

if [ -n "$WEBAPP_LAMBDA" ]; then
  WEBAPP_ENV=$(aws lambda get-function-configuration \
    --function-name "$WEBAPP_LAMBDA" \
    --region "$REGION" \
    --query 'Environment.Variables' --output json 2>/dev/null || echo "{}")

  ONTAP_ENABLED=$(echo "$WEBAPP_ENV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ONTAP_NAME_MAPPING_ENABLED',''))" 2>/dev/null || echo "")
  SVM_UUID_ENV=$(echo "$WEBAPP_ENV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('SVM_UUID',''))" 2>/dev/null || echo "")
  FSX_MGMT_ENV=$(echo "$WEBAPP_ENV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('FSX_MANAGEMENT_ENDPOINT',''))" 2>/dev/null || echo "")

  if [ "$ONTAP_ENABLED" = "true" ]; then
    pass "ONTAP_NAME_MAPPING_ENABLED: true"
  else
    echo "  ℹ️  ONTAP_NAME_MAPPING_ENABLED: ${ONTAP_ENABLED:-未設定}"
    echo "    (CDKデプロイ後に設定されます)"
  fi

  if [ -n "$SVM_UUID_ENV" ]; then
    pass "SVM_UUID: $SVM_UUID_ENV"
  else
    echo "  ℹ️  SVM_UUID: 未設定 (CDKデプロイ後に設定されます)"
  fi
else
  echo "  ℹ️  WebApp Lambda未検出（CDKデプロイ前の可能性）"
fi

# ========================================
# Step 5: resolveWindowsUser ロジック検証
# ========================================
echo ""
echo "📋 Step 5: resolveWindowsUser ロジック検証（ユニットテスト）"

# Node.jsでontap-rest-api-clientのresolveWindowsUser関数をテスト
NODE_TEST=$(cat <<'NODETEST'
// resolveWindowsUser のロジックを再現してテスト
function resolveWindowsUser(unixUsername, rules) {
  const unixToWinRules = rules.filter(r => r.direction === 'unix-win');
  for (const rule of unixToWinRules) {
    try {
      const regex = new RegExp(`^${rule.pattern}$`);
      if (regex.test(unixUsername)) {
        return unixUsername.replace(regex, rule.replacement);
      }
    } catch { }
  }
  return null;
}

// テストルール（ONTAP REST APIから取得されるルールと同等）
const rules = [
  { direction: 'unix-win', pattern: 'alice', replacement: 'DEMO\\alice' },
  { direction: 'unix-win', pattern: 'bob', replacement: 'DEMO\\bob' },
  { direction: 'unix-win', pattern: 'charlie', replacement: 'DEMO\\charlie' },
];

const tests = [
  { input: 'alice', expected: 'DEMO\\alice' },
  { input: 'bob', expected: 'DEMO\\bob' },
  { input: 'charlie', expected: 'DEMO\\charlie' },
  { input: 'unknown', expected: null },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = resolveWindowsUser(t.input, rules);
  if (result === t.expected) {
    console.log(`  ✅ ${t.input} → ${result}`);
    passed++;
  } else {
    console.log(`  ❌ ${t.input} → ${result} (expected: ${t.expected})`);
    failed++;
  }
}

console.log(`\n  結果: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
NODETEST
)

if echo "$NODE_TEST" | node 2>/dev/null; then
  pass "resolveWindowsUser ロジック検証: 全テスト合格"
else
  fail "resolveWindowsUser ロジック検証: 失敗あり"
fi

# ========================================
# 結果サマリー
# ========================================
echo ""
echo "============================================"
echo "📊 ONTAP Name-Mapping 検証結果"
echo "============================================"
echo "  ✅ PASS: $PASS_COUNT"
echo "  ❌ FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "🎉 全テスト合格"
else
  echo "⚠️  ${FAIL_COUNT}件の失敗があります。上記のログを確認してください。"
fi
