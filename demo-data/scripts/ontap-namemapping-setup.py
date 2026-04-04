#!/usr/bin/env python3
"""ONTAP Name-Mapping Setup Script - runs on EC2 inside VPC"""
import json, urllib.request, ssl, base64, sys, os

mgmt = os.environ.get("ONTAP_MGMT_IP", "https://REPLACE_MGMT_IP")
if not mgmt.startswith("https://"):
    mgmt = f"https://{mgmt}"
password = os.environ.get("ONTAP_ADMIN_PASSWORD", "")
if not password:
    print("ERROR: Set ONTAP_ADMIN_PASSWORD environment variable")
    sys.exit(1)
auth = base64.b64encode(f"fsxadmin:{password}".encode()).decode()
svm_uuid = os.environ.get("ONTAP_SVM_UUID", "REPLACE_SVM_UUID")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

rules = [
    {"index": 1, "pattern": "alice", "replacement": "DEMO\\alice"},
    {"index": 2, "pattern": "bob", "replacement": "DEMO\\bob"},
    {"index": 3, "pattern": "charlie", "replacement": "DEMO\\charlie"},
]

print("=== Creating Name-Mapping Rules ===")
for rule in rules:
    data = json.dumps({"svm": {"uuid": svm_uuid}, "direction": "unix_win", **rule}).encode()
    req = urllib.request.Request(f"{mgmt}/api/name-services/name-mappings", data=data, method="POST")
    req.add_header("Authorization", f"Basic {auth}")
    req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req, context=ctx)
        print(f"  Rule {rule['index']}: {rule['pattern']} -> {rule['replacement']} (HTTP {resp.status})")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "entry already exists" in body.lower() or "duplicate" in body.lower() or e.code == 409:
            print(f"  Rule {rule['index']}: {rule['pattern']} -> {rule['replacement']} (already exists)")
        else:
            print(f"  Rule {rule['index']}: {rule['pattern']} -> HTTP {e.code}: {body[:200]}")

print("\n=== Verifying Name-Mapping Rules ===")
req = urllib.request.Request(f"{mgmt}/api/name-services/name-mappings?svm.uuid={svm_uuid}&direction=unix_win")
req.add_header("Authorization", f"Basic {auth}")
resp = urllib.request.urlopen(req, context=ctx)
result = json.loads(resp.read())
print(json.dumps(result, indent=2))
print(f"\nTotal rules: {result.get('num_records', 0)}")
