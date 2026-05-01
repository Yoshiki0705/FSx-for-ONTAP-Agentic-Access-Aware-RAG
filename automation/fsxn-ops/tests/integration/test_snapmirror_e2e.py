"""
SnapMirror E2E テスト Lambda

同一 FSx ONTAP クラスタ内でテスト用ボリュームを作成し、
SnapMirror 関係の作成→転送→ブレーク→再同期→クリーンアップを
一連のフローとしてテストする。

環境変数:
    ONTAP_SECRET_ID  : Secrets Manager シークレット ID
    MANAGEMENT_LIF   : ONTAP 管理 LIF IP アドレス
"""

import json
import os
import time
import urllib3

import boto3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class OntapTestClient:
    """テスト用 ONTAP REST API クライアント"""

    def __init__(self, mgmt_lif, username, password):
        self.base = f"https://{mgmt_lif}/api"
        self.http = urllib3.PoolManager(
            cert_reqs="CERT_NONE",
            timeout=urllib3.Timeout(connect=10.0, read=60.0),
            retries=urllib3.Retry(total=2, backoff_factor=1),
        )
        self.headers = urllib3.make_headers(basic_auth=f"{username}:{password}")
        self.headers["Accept"] = "application/json"
        self.headers["Content-Type"] = "application/json"

    def get(self, path, params=None):
        url = f"{self.base}{path}"
        if params:
            qs = "&".join(f"{k}={v}" for k, v in params.items())
            url = f"{url}?{qs}"
        r = self.http.request("GET", url, headers=self.headers)
        return r.status, json.loads(r.data.decode()) if r.data else {}

    def post(self, path, body):
        r = self.http.request(
            "POST", f"{self.base}{path}", headers=self.headers,
            body=json.dumps(body).encode(),
        )
        return r.status, json.loads(r.data.decode()) if r.data else {}

    def patch(self, path, body):
        r = self.http.request(
            "PATCH", f"{self.base}{path}", headers=self.headers,
            body=json.dumps(body).encode(),
        )
        return r.status, json.loads(r.data.decode()) if r.data else {}

    def delete(self, path):
        r = self.http.request("DELETE", f"{self.base}{path}", headers=self.headers)
        return r.status, json.loads(r.data.decode()) if r.data else {}

    def wait_job(self, job_url, timeout=120):
        """非同期ジョブの完了を待機"""
        # job_url は /api/cluster/jobs/UUID 形式 or フル URL
        if job_url.startswith("https://"):
            # フル URL から /api 以降を抽出
            path = "/" + job_url.split("/api/", 1)[1] if "/api/" in job_url else job_url
        elif job_url.startswith("/api/"):
            # 既に /api/ プレフィックス付き → self.base が /api なので除去
            path = "/" + job_url.split("/api/", 1)[1]
        else:
            path = job_url
        for _ in range(timeout // 5):
            status, data = self.get(path)
            state = data.get("state", "")
            if state in ("success", "failure"):
                return state, data
            time.sleep(5)
        return "timeout", {}


def handler(event, context):
    """SnapMirror E2E テスト"""
    mgmt_lif = os.environ.get("MANAGEMENT_LIF", "")
    secret_id = os.environ.get("ONTAP_SECRET_ID", "")

    sm = boto3.client("secretsmanager")
    creds = json.loads(sm.get_secret_value(SecretId=secret_id)["SecretString"])
    client = OntapTestClient(mgmt_lif, creds["username"], creds["password"])

    results = {"tests": [], "cleanup": []}

    def log(name, status, detail=""):
        results["tests"].append({"name": name, "status": status, "detail": detail})
        return status == "PASS"

    # --- Step 0: SVM 情報取得 ---
    status, data = client.get("/svm/svms", {"fields": "name,uuid"})
    svms = data.get("records", [])
    # admin SVM を除外
    user_svms = [s for s in svms if not s["name"].startswith("FsxId")]
    if not user_svms:
        log("find_svm", "FAIL", "ユーザー SVM が見つかりません")
        return results
    svm = user_svms[0]
    svm_uuid = svm["uuid"]
    svm_name = svm["name"]
    log("find_svm", "PASS", f"SVM: {svm_name} ({svm_uuid})")

    # --- Step 1: テスト用ソースボリューム作成 ---
    src_vol_name = "smtest_src"
    status, data = client.post("/storage/volumes", {
        "name": src_vol_name,
        "svm": {"uuid": svm_uuid},
        "size": 1073741824,  # 1 GiB
        "aggregates": [{"name": "aggr1"}],
        "type": "rw",
    })
    if status in (201, 202):
        # 非同期の場合はジョブ待機
        job_link = data.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            client.wait_job(job_link)
        log("create_src_volume", "PASS", f"Created {src_vol_name}")
    elif status == 409:
        log("create_src_volume", "PASS", f"{src_vol_name} already exists")
    else:
        log("create_src_volume", "FAIL", f"HTTP {status}: {json.dumps(data)[:200]}")
        return results

    # ソースボリューム UUID 取得
    status, data = client.get("/storage/volumes", {"name": src_vol_name, "svm.uuid": svm_uuid})
    src_records = data.get("records", [])
    if not src_records:
        log("get_src_volume", "FAIL", "ソースボリュームが見つかりません")
        return results
    src_vol_uuid = src_records[0]["uuid"]
    log("get_src_volume", "PASS", f"UUID: {src_vol_uuid}")

    # --- Step 2: テスト用 DP ボリューム作成 ---
    dp_vol_name = "smtest_dp"
    status, data = client.post("/storage/volumes", {
        "name": dp_vol_name,
        "svm": {"uuid": svm_uuid},
        "size": 1073741824,
        "aggregates": [{"name": "aggr1"}],
        "type": "dp",
    })
    if status in (201, 202):
        job_link = data.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            client.wait_job(job_link)
        log("create_dp_volume", "PASS", f"Created {dp_vol_name}")
    elif status == 409:
        log("create_dp_volume", "PASS", f"{dp_vol_name} already exists")
    else:
        log("create_dp_volume", "FAIL", f"HTTP {status}: {json.dumps(data)[:200]}")
        # クリーンアップしてリターン
        results["cleanup"].append(_cleanup(client, svm_name, src_vol_name, dp_vol_name, None))
        return results

    # DP ボリューム UUID 取得
    status, data = client.get("/storage/volumes", {"name": dp_vol_name, "svm.uuid": svm_uuid})
    dp_records = data.get("records", [])
    if not dp_records:
        log("get_dp_volume", "FAIL", "DP ボリュームが見つかりません")
        results["cleanup"].append(_cleanup(client, svm_name, src_vol_name, dp_vol_name, None))
        return results
    dp_vol_uuid = dp_records[0]["uuid"]
    log("get_dp_volume", "PASS", f"UUID: {dp_vol_uuid}")

    # --- Step 3: SnapMirror 関係作成 ---
    sm_uuid = None
    status, data = client.post("/snapmirror/relationships", {
        "source": {"path": f"{svm_name}:{src_vol_name}"},
        "destination": {"path": f"{svm_name}:{dp_vol_name}"},
    })
    if status in (201, 202):
        sm_uuid = data.get("uuid", "")
        job_link = data.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            state, jdata = client.wait_job(job_link, timeout=180)
            if state == "failure":
                # ジョブ失敗でも関係自体は作成されている場合がある
                log("create_snapmirror", "WARN",
                    f"Job failed but relationship may exist. UUID: {sm_uuid}, msg: {jdata.get('message','')[:200]}")
            else:
                log("create_snapmirror", "PASS", f"UUID: {sm_uuid}, job: {state}")
        else:
            log("create_snapmirror", "PASS", f"UUID: {sm_uuid}")
    else:
        log("create_snapmirror", "FAIL", f"HTTP {status}: {json.dumps(data)[:300]}")
        results["cleanup"].append(_cleanup(client, svm_name, src_vol_name, dp_vol_name, None))
        return results

    if not sm_uuid:
        # UUID を取得
        status, data = client.get("/snapmirror/relationships",
                                   {"destination.path": f"{svm_name}:{dp_vol_name}"})
        rels = data.get("records", [])
        if rels:
            sm_uuid = rels[0]["uuid"]
            log("get_snapmirror_uuid", "PASS", f"UUID: {sm_uuid}")
        else:
            log("get_snapmirror_uuid", "FAIL", "SnapMirror 関係が見つかりません")
            results["cleanup"].append(_cleanup(client, svm_name, src_vol_name, dp_vol_name, None))
            return results

    # --- Step 4: 初期化 (initialize) ---
    # SnapMirror 関係を初期化して初期転送を開始
    status, data = client.post(f"/snapmirror/relationships/{sm_uuid}/transfers", {})
    if status in (200, 201, 202):
        log("initialize_transfer", "PASS", f"Transfer initiated")
    else:
        # 既に初期化済みの場合は resync で対応
        log("initialize_transfer", "WARN", f"HTTP {status}, trying resync")
        client.patch(f"/snapmirror/relationships/{sm_uuid}", {"state": "snapmirrored"})

    # --- Step 4b: 転送完了待機 ---
    time.sleep(10)
    for attempt in range(12):
        status, data = client.get(f"/snapmirror/relationships/{sm_uuid}",
                                   {"fields": "state,healthy,transfer"})
        sm_state = data.get("state", "")
        transfer = data.get("transfer", {})
        transfer_state = transfer.get("state", "idle") if transfer else "idle"
        if sm_state == "snapmirrored" and transfer_state in ("idle", "success", ""):
            log("initial_transfer", "PASS", f"state={sm_state}, attempt={attempt}")
            break
        time.sleep(10)
    else:
        log("initial_transfer", "FAIL", f"state={sm_state}, transfer={transfer_state}")

    # --- Step 5: SnapMirror ブレーク ---
    status, data = client.patch(f"/snapmirror/relationships/{sm_uuid}",
                                 {"state": "broken_off"})
    if status in (200, 202):
        job_link = data.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            state, _ = client.wait_job(job_link)
        time.sleep(5)
        # 状態確認
        status2, data2 = client.get(f"/snapmirror/relationships/{sm_uuid}")
        actual_state = data2.get("state", "")
        if actual_state == "broken_off":
            log("snapmirror_break", "PASS", f"state={actual_state}")
        else:
            log("snapmirror_break", "FAIL", f"expected=broken_off, actual={actual_state}")
    else:
        log("snapmirror_break", "FAIL", f"HTTP {status}: {json.dumps(data)[:200]}")

    # --- Step 6: SnapMirror 再同期 ---
    status, data = client.patch(f"/snapmirror/relationships/{sm_uuid}",
                                 {"state": "snapmirrored"})
    if status in (200, 202):
        job_link = data.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            state, _ = client.wait_job(job_link, timeout=180)
        time.sleep(10)
        # 状態確認
        for attempt in range(12):
            status2, data2 = client.get(f"/snapmirror/relationships/{sm_uuid}")
            actual_state = data2.get("state", "")
            if actual_state == "snapmirrored":
                log("snapmirror_resync", "PASS", f"state={actual_state}, attempt={attempt}")
                break
            time.sleep(10)
        else:
            log("snapmirror_resync", "FAIL", f"state={actual_state} after 12 attempts")
    else:
        log("snapmirror_resync", "FAIL", f"HTTP {status}: {json.dumps(data)[:200]}")

    # --- Step 7: クリーンアップ ---
    results["cleanup"].append(_cleanup(client, svm_name, src_vol_name, dp_vol_name, sm_uuid))

    # サマリー
    passed = sum(1 for t in results["tests"] if t["status"] == "PASS")
    failed = sum(1 for t in results["tests"] if t["status"] == "FAIL")
    results["summary"] = {"total": len(results["tests"]), "passed": passed, "failed": failed}

    return results


def _cleanup(client, svm_name, src_vol_name, dp_vol_name, sm_uuid):
    """テストリソースのクリーンアップ"""
    cleanup_results = []

    # SnapMirror 関係削除
    if sm_uuid:
        # まずブレーク状態にする（再同期中の場合）
        client.patch(f"/snapmirror/relationships/{sm_uuid}", {"state": "broken_off"})
        time.sleep(5)
        status, data = client.delete(f"/snapmirror/relationships/{sm_uuid}?destination_only=true")
        job_link = data.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            client.wait_job(job_link, timeout=60)
        cleanup_results.append(f"delete_snapmirror: HTTP {status}")
        time.sleep(5)

    # DP ボリューム削除
    status, data = client.get("/storage/volumes", {"name": dp_vol_name, "svm.name": svm_name})
    for vol in data.get("records", []):
        s, d = client.delete(f"/storage/volumes/{vol['uuid']}")
        job_link = d.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            client.wait_job(job_link, timeout=60)
        cleanup_results.append(f"delete_{dp_vol_name}: HTTP {s}")

    # ソースボリューム削除
    status, data = client.get("/storage/volumes", {"name": src_vol_name, "svm.name": svm_name})
    for vol in data.get("records", []):
        s, d = client.delete(f"/storage/volumes/{vol['uuid']}")
        job_link = d.get("job", {}).get("_links", {}).get("self", {}).get("href", "")
        if job_link:
            client.wait_job(job_link, timeout=60)
        cleanup_results.append(f"delete_{src_vol_name}: HTTP {s}")

    return cleanup_results
