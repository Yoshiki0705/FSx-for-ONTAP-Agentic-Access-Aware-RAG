#!/bin/bash
set -euo pipefail

# FSx ONTAPボリューム設定スクリプト
# ONTAP REST APIを使用してSVM・ボリュームを作成する

# 設定
FSX_MGMT_ENDPOINT="${FSX_MANAGEMENT_ENDPOINT:?環境変数 FSX_MANAGEMENT_ENDPOINT を設定してください}"
ONTAP_USER="${ONTAP_ADMIN_USER:-fsxadmin}"
ONTAP_PASS="${ONTAP_ADMIN_PASSWORD:?環境変数 ONTAP_ADMIN_PASSWORD を設定してください}"

echo "=========================================="
echo "FSx ONTAP ボリューム設定"
echo "=========================================="
echo "Management Endpoint: ${FSX_MGMT_ENDPOINT}"
echo ""

# SVM一覧取得
echo "📋 SVM一覧を取得中..."
curl -sk -u "${ONTAP_USER}:${ONTAP_PASS}" \
  "https://${FSX_MGMT_ENDPOINT}/api/svm/svms" \
  | python3 -m json.tool

echo ""
echo "=========================================="
echo "ボリューム作成手順"
echo "=========================================="
echo ""
echo "以下のONTAP CLIコマンドをSSM Session Manager経由で実行してください:"
echo ""
echo "1. SVM作成（未作成の場合）:"
echo "   vserver create -vserver demo-svm -subtype default -rootvolume demo_root"
echo ""
echo "2. データボリューム作成:"
echo "   volume create -vserver demo-svm -volume demo_data -aggregate aggr1 -size 100GB -junction-path /demo_data"
echo ""
echo "3. NFS エクスポートポリシー設定:"
echo "   export-policy rule create -vserver demo-svm -policyname default -clientmatch 0.0.0.0/0 -rorule sys -rwrule sys -superuser sys"
echo ""
echo "4. CIFS共有設定（Windows ACL用）:"
echo "   cifs share create -vserver demo-svm -share-name demo_data -path /demo_data"
echo ""
echo "5. ACL設定:"
echo "   cifs share access-control create -vserver demo-svm -share demo_data -user-or-group Everyone -permission read"
echo "   cifs share access-control create -vserver demo-svm -share demo_data -user-or-group Administrators -permission full_control"
echo ""
echo "=========================================="
echo "📝 詳細手順は demo-data/guides/ontap-setup-guide.md を参照"
echo "=========================================="
