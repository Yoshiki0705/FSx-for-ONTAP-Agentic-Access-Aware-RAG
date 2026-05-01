"""
ONTAP REST API 疎通テスト Lambda

VPC 内から ONTAP 管理 LIF に HTTPS 接続し、
/api/cluster エンドポイントで疎通確認を行う。

環境変数:
    ONTAP_SECRET_ID  : Secrets Manager シークレット ID
    MANAGEMENT_LIF   : ONTAP 管理 LIF IP アドレス
"""

import json
import os
import urllib3

import boto3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def handler(event, context):
    """疎通テスト Lambda ハンドラー"""
    management_lif = os.environ.get("MANAGEMENT_LIF", event.get("management_lif", ""))
    secret_id = os.environ.get("ONTAP_SECRET_ID", event.get("secret_id", ""))

    results = {
        "management_lif": management_lif,
        "tests": [],
    }

    # 1. Secrets Manager からの認証情報取得テスト
    try:
        sm = boto3.client("secretsmanager")
        secret = sm.get_secret_value(SecretId=secret_id)
        creds = json.loads(secret["SecretString"])
        username = creds["username"]
        password = creds["password"]
        results["tests"].append({
            "name": "secrets_manager",
            "status": "PASS",
            "detail": f"username={username}",
        })
    except Exception as e:
        results["tests"].append({
            "name": "secrets_manager",
            "status": "FAIL",
            "detail": str(e),
        })
        return results

    # 2. ONTAP REST API /api/cluster 疎通テスト
    http = urllib3.PoolManager(
        cert_reqs="CERT_NONE",
        timeout=urllib3.Timeout(connect=10.0, read=30.0),
    )
    headers = urllib3.make_headers(basic_auth=f"{username}:{password}")
    headers["Accept"] = "application/json"

    try:
        resp = http.request(
            "GET",
            f"https://{management_lif}/api/cluster",
            headers=headers,
        )
        if resp.status == 200:
            data = json.loads(resp.data.decode("utf-8"))
            results["tests"].append({
                "name": "ontap_cluster_api",
                "status": "PASS",
                "detail": {
                    "cluster_name": data.get("name"),
                    "version": data.get("version", {}).get("full"),
                    "uuid": data.get("uuid"),
                },
            })
        else:
            results["tests"].append({
                "name": "ontap_cluster_api",
                "status": "FAIL",
                "detail": f"HTTP {resp.status}: {resp.data.decode('utf-8')[:200]}",
            })
    except Exception as e:
        results["tests"].append({
            "name": "ontap_cluster_api",
            "status": "FAIL",
            "detail": str(e),
        })

    # 3. ボリューム一覧取得テスト
    try:
        resp = http.request(
            "GET",
            f"https://{management_lif}/api/storage/volumes?fields=name,size,space,svm,state",
            headers=headers,
        )
        if resp.status == 200:
            data = json.loads(resp.data.decode("utf-8"))
            volumes = data.get("records", [])
            results["tests"].append({
                "name": "ontap_list_volumes",
                "status": "PASS",
                "detail": {
                    "volume_count": len(volumes),
                    "volumes": [
                        {
                            "name": v.get("name"),
                            "svm": v.get("svm", {}).get("name"),
                            "state": v.get("state"),
                            "size_gib": round(v.get("size", 0) / (1024**3), 2),
                        }
                        for v in volumes
                    ],
                },
            })
        else:
            results["tests"].append({
                "name": "ontap_list_volumes",
                "status": "FAIL",
                "detail": f"HTTP {resp.status}",
            })
    except Exception as e:
        results["tests"].append({
            "name": "ontap_list_volumes",
            "status": "FAIL",
            "detail": str(e),
        })

    # 4. SnapMirror 関係一覧テスト
    try:
        resp = http.request(
            "GET",
            f"https://{management_lif}/api/snapmirror/relationships?fields=source,destination,state,healthy",
            headers=headers,
        )
        if resp.status == 200:
            data = json.loads(resp.data.decode("utf-8"))
            rels = data.get("records", [])
            results["tests"].append({
                "name": "ontap_list_snapmirror",
                "status": "PASS",
                "detail": {
                    "relationship_count": len(rels),
                    "relationships": [
                        {
                            "source": r.get("source", {}).get("path"),
                            "destination": r.get("destination", {}).get("path"),
                            "state": r.get("state"),
                            "healthy": r.get("healthy"),
                        }
                        for r in rels
                    ],
                },
            })
        else:
            results["tests"].append({
                "name": "ontap_list_snapmirror",
                "status": "FAIL",
                "detail": f"HTTP {resp.status}",
            })
    except Exception as e:
        results["tests"].append({
            "name": "ontap_list_snapmirror",
            "status": "FAIL",
            "detail": str(e),
        })

    # 5. SVM 情報取得テスト
    try:
        resp = http.request(
            "GET",
            f"https://{management_lif}/api/svm/svms?fields=name,state,ip_interfaces",
            headers=headers,
        )
        if resp.status == 200:
            data = json.loads(resp.data.decode("utf-8"))
            svms = data.get("records", [])
            results["tests"].append({
                "name": "ontap_list_svms",
                "status": "PASS",
                "detail": {
                    "svm_count": len(svms),
                    "svms": [
                        {"name": s.get("name"), "state": s.get("state")}
                        for s in svms
                    ],
                },
            })
        else:
            results["tests"].append({
                "name": "ontap_list_svms",
                "status": "FAIL",
                "detail": f"HTTP {resp.status}",
            })
    except Exception as e:
        results["tests"].append({
            "name": "ontap_list_svms",
            "status": "FAIL",
            "detail": str(e),
        })

    # サマリー
    passed = sum(1 for t in results["tests"] if t["status"] == "PASS")
    failed = sum(1 for t in results["tests"] if t["status"] == "FAIL")
    results["summary"] = {
        "total": len(results["tests"]),
        "passed": passed,
        "failed": failed,
        "all_passed": failed == 0,
    }

    return results
