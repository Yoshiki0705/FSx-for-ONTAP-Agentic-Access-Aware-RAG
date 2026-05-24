"""
Feature Gate Lambda (#12)

ユーザーのグループ/ロールに基づいて機能の有効/無効を判定する。
段階的機能開放（カナリアリリース）を実現。

呼び出し方式: WebApp API Route (GET /api/config/feature-gates)
環境変数:
    FEATURE_GATE_TABLE: Feature Gate テーブル名
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    ユーザーに対して有効な機能一覧を返す。

    イベント構造:
    {
        "userId": "user@example.com",
        "groups": ["engineering", "beta-testers"]
    }

    レスポンス:
    {
        "features": {
            "hybrid-search": true,
            "voice-chat": false,
            "multi-agent": true
        }
    }
    """
    table_name = os.environ["FEATURE_GATE_TABLE"]
    dynamodb = boto3.resource("dynamodb", config=RETRY_CONFIG)
    table = dynamodb.Table(table_name)

    user_id = event.get("userId", "")
    user_groups = set(event.get("groups", []))
    now = datetime.now(timezone.utc).isoformat()

    # 全 Feature Gate を取得
    gates = _get_all_gates(table)

    # ユーザーに対する機能判定
    features = {}
    for gate in gates:
        feature_id = gate["featureId"]
        enabled = _evaluate_gate(gate, user_id, user_groups, now)
        features[feature_id] = enabled

    logger.info(
        json.dumps({
            "message": "Feature gates evaluated",
            "userId": user_id,
            "enabledFeatures": [k for k, v in features.items() if v],
            "totalGates": len(gates),
        })
    )

    return {
        "statusCode": 200,
        "features": features,
    }


def _get_all_gates(table: Any) -> List[Dict[str, Any]]:
    """全 Feature Gate レコードを取得."""
    response = table.scan()
    items = response.get("Items", [])
    while response.get("LastEvaluatedKey"):
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def _evaluate_gate(
    gate: Dict[str, Any],
    user_id: str,
    user_groups: set,
    now: str,
) -> bool:
    """
    Feature Gate の判定ロジック。

    有効条件（OR）:
    1. enabledUsers に userId が含まれる
    2. enabledGroups と user_groups に共通要素がある
    3. rolloutPercentage に基づくハッシュ判定
    4. 期間内（startDate <= now <= endDate）

    全て無効の場合は defaultEnabled を返す。
    """
    # 期間チェック
    start_date = gate.get("startDate", "")
    end_date = gate.get("endDate", "")
    if start_date and now < start_date:
        return False
    if end_date and now > end_date:
        return False

    # 明示的なユーザー指定
    enabled_users = set(gate.get("enabledUsers", []))
    if user_id and user_id in enabled_users:
        return True

    # グループ指定
    enabled_groups = set(gate.get("enabledGroups", []))
    if user_groups & enabled_groups:
        return True

    # ロールアウト率
    rollout_pct = gate.get("rolloutPercentage", 0)
    if rollout_pct > 0 and user_id:
        user_hash = hash(user_id + gate["featureId"]) % 100
        if user_hash < rollout_pct:
            return True

    # デフォルト値
    return gate.get("defaultEnabled", False)
