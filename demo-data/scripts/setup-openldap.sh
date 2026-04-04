#!/bin/bash
set -euo pipefail

###############################################################################
# OpenLDAP サーバー構築スクリプト
#
# VPC内にEC2インスタンスを起動し、OpenLDAPをインストール・設定する。
# テストユーザー/グループ（POSIX属性付き）を登録し、
# Identity Sync LambdaのLDAP Connectorが接続できる状態にする。
#
# 前提:
#   - AWS CLI設定済み（ap-northeast-1）
#   - CDKスタック（Networking/Storage/Security）デプロイ済み
###############################################################################

REGION="ap-northeast-1"
STACK_PREFIX="perm-rag-demo-demo"

# ========================================
# 環境情報取得
# ========================================
echo "📋 環境情報を取得中..."

VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-Networking" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' \
  --output text)

PRIVATE_SUBNET_IDS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-Networking" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetIds`].OutputValue' \
  --output text)

LAMBDA_SG_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_PREFIX}-Networking" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaSgId`].OutputValue' \
  --output text)

# 最初のプライベートサブネットを使用
SUBNET_ID=$(echo "$PRIVATE_SUBNET_IDS" | cut -d',' -f1)

echo "  VPC: $VPC_ID"
echo "  Subnet: $SUBNET_ID"
echo "  Lambda SG: $LAMBDA_SG_ID"

# ========================================
# LDAP バインドパスワードをSecrets Managerに登録
# ========================================
LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-LdapB1nd!P@ss2026}"
SECRET_NAME="ldap-bind-password"

echo ""
echo "🔐 Secrets Manager にLDAPバインドパスワードを登録..."

# 既存シークレットがあれば更新、なければ作成
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$LDAP_BIND_PASSWORD" \
    --region "$REGION" >/dev/null
  echo "  既存シークレットを更新しました"
else
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "OpenLDAP bind password for Identity Sync Lambda" \
    --secret-string "$LDAP_BIND_PASSWORD" \
    --region "$REGION" >/dev/null
  echo "  新規シークレットを作成しました"
fi

SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --query 'ARN' --output text)

echo "  Secret ARN: $SECRET_ARN"

# ========================================
# OpenLDAP用セキュリティグループ作成
# ========================================
echo ""
echo "🔒 OpenLDAP用セキュリティグループを作成..."

LDAP_SG_NAME="${STACK_PREFIX}-openldap-sg"

# 既存SGチェック
EXISTING_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$LDAP_SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --region "$REGION" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")

if [ "$EXISTING_SG" != "None" ] && [ "$EXISTING_SG" != "" ]; then
  LDAP_SG_ID="$EXISTING_SG"
  echo "  既存SG使用: $LDAP_SG_ID"
else
  LDAP_SG_ID=$(aws ec2 create-security-group \
    --group-name "$LDAP_SG_NAME" \
    --description "Security group for OpenLDAP server" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --query 'GroupId' --output text)

  # Lambda SGからのLDAP (389) インバウンドを許可
  aws ec2 authorize-security-group-ingress \
    --group-id "$LDAP_SG_ID" \
    --protocol tcp --port 389 \
    --source-group "$LAMBDA_SG_ID" \
    --region "$REGION" >/dev/null

  # Lambda SGからのLDAPS (636) インバウンドを許可
  aws ec2 authorize-security-group-ingress \
    --group-id "$LDAP_SG_ID" \
    --protocol tcp --port 636 \
    --source-group "$LAMBDA_SG_ID" \
    --region "$REGION" >/dev/null

  # SSH (22) — VPC内からのみ
  aws ec2 authorize-security-group-ingress \
    --group-id "$LDAP_SG_ID" \
    --protocol tcp --port 22 \
    --cidr "10.0.0.0/16" \
    --region "$REGION" >/dev/null

  # アウトバウンド: HTTPS (パッケージインストール用)
  aws ec2 authorize-security-group-egress \
    --group-id "$LDAP_SG_ID" \
    --protocol tcp --port 443 \
    --cidr "0.0.0.0/0" \
    --region "$REGION" 2>/dev/null || true

  # アウトバウンド: HTTP (パッケージインストール用)
  aws ec2 authorize-security-group-egress \
    --group-id "$LDAP_SG_ID" \
    --protocol tcp --port 80 \
    --cidr "0.0.0.0/0" \
    --region "$REGION" 2>/dev/null || true

  echo "  新規SG作成: $LDAP_SG_ID"
fi

# ========================================
# EC2 User Data (OpenLDAP インストール・設定)
# ========================================
echo ""
echo "📝 User Data スクリプトを生成..."

USERDATA=$(cat <<'USERDATA_EOF'
#!/bin/bash
set -ex

# ========================================
# OpenLDAP インストール (Amazon Linux 2023)
# ========================================
dnf install -y openldap openldap-servers openldap-clients

# slapd設定
systemctl enable slapd

# パスワードハッシュ生成
ADMIN_PASS_HASH=$(slappasswd -s "LdapB1nd!P@ss2026")

# ========================================
# slapd.conf ベース設定
# ========================================
cat > /etc/openldap/slapd.d/cn\=config/olcDatabase\=\{2\}mdb.ldif.new <<EOF2
dn: olcDatabase={2}mdb
objectClass: olcDatabaseConfig
objectClass: olcMdbConfig
olcDatabase: {2}mdb
olcDbDirectory: /var/lib/ldap
olcSuffix: dc=demo,dc=local
olcRootDN: cn=admin,dc=demo,dc=local
olcRootPW: ${ADMIN_PASS_HASH}
olcDbIndex: objectClass eq
olcDbIndex: uid eq
olcDbIndex: uidNumber eq
olcDbIndex: gidNumber eq
olcDbIndex: mail eq
olcDbIndex: cn eq
olcDbIndex: memberOf eq
olcAccess: {0}to * by dn.exact="cn=admin,dc=demo,dc=local" write by * read
EOF2

# slapd.confを直接使用するアプローチ（より確実）
cat > /etc/openldap/slapd.conf <<'SLAPDCONF'
include /etc/openldap/schema/core.schema
include /etc/openldap/schema/cosine.schema
include /etc/openldap/schema/inetorgperson.schema
include /etc/openldap/schema/nis.schema

moduleload memberof
overlay memberof

pidfile   /run/openldap/slapd.pid
argsfile  /run/openldap/slapd.args

database mdb
maxsize  1073741824
suffix   "dc=demo,dc=local"
rootdn   "cn=admin,dc=demo,dc=local"
rootpw   LdapB1nd!P@ss2026
directory /var/lib/ldap

index objectClass eq
index uid eq
index uidNumber eq
index gidNumber eq
index mail eq
index cn eq
SLAPDCONF

# slapd.d を無効化して slapd.conf を使用
rm -rf /etc/openldap/slapd.d/*

# ディレクトリ権限
chown -R ldap:ldap /var/lib/ldap
chmod 700 /var/lib/ldap

mkdir -p /run/openldap
chown ldap:ldap /run/openldap

# slapd起動（slapd.confモード）
mkdir -p /etc/systemd/system/slapd.service.d
cat > /etc/systemd/system/slapd.service.d/override.conf <<'OVERRIDE'
[Service]
ExecStart=
ExecStart=/usr/sbin/slapd -f /etc/openldap/slapd.conf -u ldap -g ldap -h "ldap:/// ldapi:///"
OVERRIDE

systemctl daemon-reload
systemctl restart slapd
sleep 2

# ========================================
# ベースDN + OU作成
# ========================================
ldapadd -x -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" <<'BASEDN'
dn: dc=demo,dc=local
objectClass: top
objectClass: dcObject
objectClass: organization
o: Demo Organization
dc: demo

dn: ou=users,dc=demo,dc=local
objectClass: top
objectClass: organizationalUnit
ou: users

dn: ou=groups,dc=demo,dc=local
objectClass: top
objectClass: organizationalUnit
ou: groups
BASEDN

# ========================================
# テストグループ作成（POSIX属性付き）
# ========================================
ldapadd -x -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" <<'GROUPS'
dn: cn=engineering,ou=groups,dc=demo,dc=local
objectClass: top
objectClass: posixGroup
cn: engineering
gidNumber: 5001
description: Engineering team

dn: cn=finance,ou=groups,dc=demo,dc=local
objectClass: top
objectClass: posixGroup
cn: finance
gidNumber: 5002
description: Finance team

dn: cn=hr,ou=groups,dc=demo,dc=local
objectClass: top
objectClass: posixGroup
cn: hr
gidNumber: 5003
description: HR team

dn: cn=confidential-readers,ou=groups,dc=demo,dc=local
objectClass: top
objectClass: posixGroup
cn: confidential-readers
gidNumber: 5010
description: Users with access to confidential documents
memberUid: alice
memberUid: charlie

dn: cn=public-readers,ou=groups,dc=demo,dc=local
objectClass: top
objectClass: posixGroup
cn: public-readers
gidNumber: 5020
description: Users with access to public documents
memberUid: alice
memberUid: bob
memberUid: charlie
GROUPS

# ========================================
# テストユーザー作成（POSIX属性付き）
# ========================================
ldapadd -x -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" <<'USERS'
dn: uid=alice,ou=users,dc=demo,dc=local
objectClass: top
objectClass: inetOrgPerson
objectClass: posixAccount
uid: alice
cn: Alice Johnson
sn: Johnson
givenName: Alice
mail: alice@demo.local
uidNumber: 10001
gidNumber: 5001
homeDirectory: /home/alice
loginShell: /bin/bash
userPassword: alice123

dn: uid=bob,ou=users,dc=demo,dc=local
objectClass: top
objectClass: inetOrgPerson
objectClass: posixAccount
uid: bob
cn: Bob Smith
sn: Smith
givenName: Bob
mail: bob@demo.local
uidNumber: 10002
gidNumber: 5002
homeDirectory: /home/bob
loginShell: /bin/bash
userPassword: bob123

dn: uid=charlie,ou=users,dc=demo,dc=local
objectClass: top
objectClass: inetOrgPerson
objectClass: posixAccount
uid: charlie
cn: Charlie Brown
sn: Brown
givenName: Charlie
mail: charlie@demo.local
uidNumber: 10003
gidNumber: 5003
homeDirectory: /home/charlie
loginShell: /bin/bash
userPassword: charlie123
USERS

# ========================================
# groupOfNames エントリ作成（memberOfオーバーレイ用）
# ========================================
ldapadd -x -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" <<'ROLES'
dn: ou=roles,dc=demo,dc=local
objectClass: top
objectClass: organizationalUnit
ou: roles

dn: cn=engineering,ou=roles,dc=demo,dc=local
objectClass: top
objectClass: groupOfNames
cn: engineering
member: uid=alice,ou=users,dc=demo,dc=local

dn: cn=confidential-readers,ou=roles,dc=demo,dc=local
objectClass: top
objectClass: groupOfNames
cn: confidential-readers
member: uid=alice,ou=users,dc=demo,dc=local
member: uid=charlie,ou=users,dc=demo,dc=local

dn: cn=public-readers,ou=roles,dc=demo,dc=local
objectClass: top
objectClass: groupOfNames
cn: public-readers
member: uid=alice,ou=users,dc=demo,dc=local
member: uid=bob,ou=users,dc=demo,dc=local
member: uid=charlie,ou=users,dc=demo,dc=local
ROLES

echo "✅ OpenLDAP setup complete"
echo "  Base DN: dc=demo,dc=local"
echo "  Admin DN: cn=admin,dc=demo,dc=local"
echo "  Users: alice (10001/5001), bob (10002/5002), charlie (10003/5003)"
echo "  Groups: engineering(5001), finance(5002), hr(5003), confidential-readers(5010), public-readers(5020)"
echo "  memberOf: enabled (groupOfNames in ou=roles)"
USERDATA_EOF
)

# ========================================
# EC2 IAMロール作成（SSM用）
# ========================================
echo ""
echo "🔧 EC2 IAMロール確認..."

ROLE_NAME="${STACK_PREFIX}-openldap-role"
INSTANCE_PROFILE_NAME="${STACK_PREFIX}-openldap-profile"

if ! aws iam get-role --role-name "$ROLE_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ec2.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null

  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"

  echo "  IAMロール作成完了"
else
  echo "  既存IAMロール使用"
fi

if ! aws iam get-instance-profile --instance-profile-name "$INSTANCE_PROFILE_NAME" >/dev/null 2>&1; then
  aws iam create-instance-profile \
    --instance-profile-name "$INSTANCE_PROFILE_NAME" >/dev/null
  aws iam add-role-to-instance-profile \
    --instance-profile-name "$INSTANCE_PROFILE_NAME" \
    --role-name "$ROLE_NAME" >/dev/null
  echo "  インスタンスプロファイル作成完了"
  echo "  ⏳ IAMプロファイル伝播待機 (15秒)..."
  sleep 15
else
  echo "  既存インスタンスプロファイル使用"
fi

# ========================================
# EC2インスタンス起動
# ========================================
echo ""
echo "🚀 OpenLDAP EC2インスタンスを起動..."

# 既存インスタンスチェック
EXISTING_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" \
            "Name=instance-state-name,Values=running,pending" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || echo "None")

if [ "$EXISTING_INSTANCE" != "None" ] && [ "$EXISTING_INSTANCE" != "" ]; then
  INSTANCE_ID="$EXISTING_INSTANCE"
  echo "  既存インスタンス使用: $INSTANCE_ID"
else
  # Amazon Linux 2023 AMI取得
  AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023*-x86_64" \
              "Name=state,Values=available" \
    --region "$REGION" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' --output text)

  echo "  AMI: $AMI_ID"

  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type t3.micro \
    --subnet-id "$SUBNET_ID" \
    --security-group-ids "$LDAP_SG_ID" \
    --iam-instance-profile "Name=$INSTANCE_PROFILE_NAME" \
    --user-data "$USERDATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${STACK_PREFIX}-openldap},{Key=Project,Value=perm-rag-demo},{Key=Purpose,Value=OpenLDAP-Test}]" \
    --region "$REGION" \
    --query 'Instances[0].InstanceId' --output text)

  echo "  インスタンス起動: $INSTANCE_ID"
fi

# インスタンスのRunning待機
echo "  ⏳ インスタンス起動待機..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

# プライベートIPアドレス取得
LDAP_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)

echo "  ✅ OpenLDAP IP: $LDAP_IP"

# ========================================
# User Data完了待機
# ========================================
echo ""
echo "⏳ OpenLDAPセットアップ完了待機 (最大3分)..."
for i in $(seq 1 18); do
  STATUS=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --region "$REGION" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || echo "Unknown")
  if [ "$STATUS" = "Online" ]; then
    echo "  SSM接続確認: Online"
    break
  fi
  echo "  [$i/18] SSMステータス: $STATUS"
  sleep 10
done

# SSM経由でLDAP動作確認
echo ""
echo "🔍 OpenLDAP動作確認..."
sleep 30  # user-data完了待機

VERIFY_CMD='ldapsearch -x -H ldap://localhost -D "cn=admin,dc=demo,dc=local" -w "LdapB1nd!P@ss2026" -b "ou=users,dc=demo,dc=local" "(objectClass=posixAccount)" uid uidNumber gidNumber mail 2>&1 | head -50'

VERIFY_RESULT=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"$VERIFY_CMD\"]" \
  --region "$REGION" \
  --query 'Command.CommandId' --output text 2>/dev/null || echo "")

if [ -n "$VERIFY_RESULT" ]; then
  sleep 10
  aws ssm get-command-invocation \
    --command-id "$VERIFY_RESULT" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'StandardOutputContent' --output text 2>/dev/null || echo "  (SSMコマンド結果取得待ち)"
fi

# ========================================
# 結果サマリー
# ========================================
echo ""
echo "============================================"
echo "✅ OpenLDAP セットアップ完了"
echo "============================================"
echo ""
echo "📋 接続情報:"
echo "  LDAP URL:    ldap://${LDAP_IP}:389"
echo "  Base DN:     dc=demo,dc=local"
echo "  Bind DN:     cn=admin,dc=demo,dc=local"
echo "  Secret ARN:  $SECRET_ARN"
echo "  Instance ID: $INSTANCE_ID"
echo "  SG ID:       $LDAP_SG_ID"
echo ""
echo "👤 テストユーザー:"
echo "  alice  — uid:10001, gid:5001 (engineering), confidential-readers, public-readers"
echo "  bob    — uid:10002, gid:5002 (finance), public-readers"
echo "  charlie — uid:10003, gid:5003 (hr), confidential-readers, public-readers"
echo ""
echo "📝 cdk.context.json に追加する ldapConfig:"
echo '  "ldapConfig": {'
echo "    \"ldapUrl\": \"ldap://${LDAP_IP}:389\","
echo '    "baseDn": "dc=demo,dc=local",'
echo '    "bindDn": "cn=admin,dc=demo,dc=local",'
echo "    \"bindPasswordSecretArn\": \"${SECRET_ARN}\","
echo '    "userSearchFilter": "(mail={email})",'
echo '    "groupSearchFilter": "(memberUid={uid})"'
echo '  }'
echo ""
echo "🔧 次のステップ:"
echo "  1. cdk.context.json に上記 ldapConfig を追加"
echo "  2. npx cdk deploy ${STACK_PREFIX}-Security"
echo "  3. demo-data/scripts/verify-ldap-integration.sh を実行"
