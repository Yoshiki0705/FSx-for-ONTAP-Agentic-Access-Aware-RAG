#!/bin/bash
set -euo pipefail

###############################################################################
# モードC: OIDC + LDAP デモ環境 ワンショットセットアップ
#
# 前提:
#   - AWS CLI設定済み（ap-northeast-1）
#   - OIDC IdP（Auth0等）でクライアント作成済み
#   - clientSecretをSecrets Managerに登録済み
#   - CDK Bootstrap済み
#   - pre-deploy-setup.sh 実行済み（ECR + Dockerイメージ）
#
# 使用方法:
#   export OIDC_CLIENT_ID="your-client-id"
#   export OIDC_CLIENT_SECRET_ARN="arn:aws:secretsmanager:..."
#   export OIDC_ISSUER_URL="https://your-idp.auth0.com"
#   export OIDC_PROVIDER_NAME="Auth0"  # optional, default: Auth0
#   bash demo-data/scripts/setup-mode-c-oidc-ldap.sh
###############################################################################

REGION="ap-northeast-1"
STACK_PREFIX="perm-rag-demo-demo"
OIDC_PROVIDER_NAME="${OIDC_PROVIDER_NAME:-Auth0}"

# ========================================
# 入力チェック
# ========================================
echo "============================================"
echo "  モードC: OIDC + LDAP デモ環境セットアップ"
echo "============================================"

if [ -z "${OIDC_CLIENT_ID:-}" ]; then
  echo "❌ OIDC_CLIENT_ID が未設定です"
  echo "   export OIDC_CLIENT_ID=\"your-client-id\""
  exit 1
fi
if [ -z "${OIDC_CLIENT_SECRET_ARN:-}" ]; then
  echo "❌ OIDC_CLIENT_SECRET_ARN が未設定です"
  echo "   export OIDC_CLIENT_SECRET_ARN=\"arn:aws:secretsmanager:...\""
  exit 1
fi
if [ -z "${OIDC_ISSUER_URL:-}" ]; then
  echo "❌ OIDC_ISSUER_URL が未設定です"
  echo "   export OIDC_ISSUER_URL=\"https://your-idp.auth0.com\""
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo "  OIDC Provider: $OIDC_PROVIDER_NAME"
echo "  OIDC Issuer: $OIDC_ISSUER_URL"
echo ""

# ========================================
# Phase 1: Networking + Storage デプロイ（OpenLDAPに必要）
# ========================================
echo "🔧 Phase 1: 基盤スタックデプロイ..."

# まず最小構成でデプロイ（cloudFrontUrl未設定）
cat > cdk.context.json << CTXEOF
{
  "projectName": "perm-rag-demo",
  "environment": "demo",
  "adPassword": "DemoP@ssw0rd123",
  "adDomainName": "demo.local",
  "enableAdFederation": false,
  "enableAgent": true,
  "vectorStoreType": "s3vectors",
  "permissionMappingStrategy": "hybrid"
}
CTXEOF

npx cdk deploy ${STACK_PREFIX}-Networking ${STACK_PREFIX}-Storage --require-approval never

# ========================================
# Phase 2: OpenLDAPサーバー構築
# ========================================
echo ""
echo "🔧 Phase 2: OpenLDAPサーバー構築..."
bash demo-data/scripts/setup-openldap.sh

# OpenLDAP IPとSecret ARNを取得
LDAP_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" \
            "Name=instance-state-name,Values=running" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)

LDAP_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id "ldap-bind-password" \
  --region "$REGION" \
  --query 'ARN' --output text)

echo "  LDAP IP: $LDAP_IP"
echo "  LDAP Secret: $LDAP_SECRET_ARN"

# ========================================
# Phase 3: OIDC + LDAP構成でフルデプロイ
# ========================================
echo ""
echo "🔧 Phase 3: OIDC + LDAP構成でフルデプロイ..."

cat > cdk.context.json << CTXEOF
{
  "adPassword": "DemoP@ssw0rd123",
  "adDomainName": "demo.local",
  "enableAdFederation": false,
  "enableAgent": true,
  "vectorStoreType": "s3vectors",
  "oidcProviderConfig": {
    "providerName": "${OIDC_PROVIDER_NAME}",
    "clientId": "${OIDC_CLIENT_ID}",
    "clientSecret": "${OIDC_CLIENT_SECRET_ARN}",
    "issuerUrl": "${OIDC_ISSUER_URL}",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldap://${LDAP_IP}:389",
    "baseDn": "dc=demo,dc=local",
    "bindDn": "cn=admin,dc=demo,dc=local",
    "bindPasswordSecretArn": "${LDAP_SECRET_ARN}",
    "userSearchFilter": "(mail={email})",
    "groupSearchFilter": "(memberUid={uid})"
  },
  "permissionMappingStrategy": "hybrid",
  "ontapNameMappingEnabled": true
}
CTXEOF

npx cdk deploy --all --require-approval never

# ========================================
# Phase 4: CloudFront URL取得 → 再デプロイ
# ========================================
echo ""
echo "🔧 Phase 4: CloudFront URL設定..."

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "  CloudFront URL: $CF_URL"

# cloudFrontUrlを追加して再デプロイ
python3 -c "
import json
with open('cdk.context.json') as f:
    ctx = json.load(f)
ctx['cloudFrontUrl'] = '${CF_URL}'
with open('cdk.context.json', 'w') as f:
    json.dump(ctx, f, indent=2, ensure_ascii=False)
    f.write('\n')
"

npx cdk deploy ${STACK_PREFIX}-Security ${STACK_PREFIX}-WebApp --require-approval never

# ========================================
# Phase 5: ONTAP Name-Mapping設定
# ========================================
echo ""
echo "🔧 Phase 5: ONTAP Name-Mapping設定..."
bash demo-data/scripts/setup-ontap-namemapping.sh || echo "⚠️ ONTAP name-mapping設定をスキップ（手動設定が必要な場合があります）"

# ========================================
# Phase 6: ポストデプロイ + 検証
# ========================================
echo ""
echo "🔧 Phase 6: ポストデプロイセットアップ..."
bash demo-data/scripts/post-deploy-setup.sh

echo ""
echo "🔍 Phase 7: 検証..."
bash demo-data/scripts/verify-deployment.sh
bash demo-data/scripts/verify-ldap-integration.sh || true

# ========================================
# 結果サマリー
# ========================================
echo ""
echo "============================================"
echo "✅ モードC: OIDC + LDAP デモ環境構築完了"
echo "============================================"
echo ""
echo "📋 アクセス情報:"
echo "  CloudFront URL: $CF_URL"
echo "  OIDC Provider: $OIDC_PROVIDER_NAME ($OIDC_ISSUER_URL)"
echo "  OpenLDAP IP: $LDAP_IP"
echo ""
echo "👤 テストユーザー (OpenLDAP):"
echo "  alice@demo.local — uid:10001, gid:5001"
echo "  bob@demo.local   — uid:10002, gid:5002"
echo "  charlie@demo.local — uid:10003, gid:5003"
echo ""
echo "🔧 次のステップ:"
echo "  1. OIDC IdPのコールバックURLを設定:"
COGNITO_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`CognitoDomain`)].OutputValue' \
  --output text 2>/dev/null || echo "perm-rag-demo-demo-auth")
echo "     https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/idpresponse"
echo "  2. ブラウザで $CF_URL にアクセス"
echo "  3. 「${OIDC_PROVIDER_NAME}でサインイン」ボタンをクリック"
