"""
Guardrails Module — expansion safety checks for FSx ONTAP auto-expansion.

Per-action rate limiting, daily cumulative cap, and cooldown period enforcement
using DynamoDB for persistent state tracking. Emits CloudWatch custom metrics
for operational visibility.

All functions accept injectable clients (dynamodb_client, cloudwatch_client, now)
for testing.
"""

from __future__ import annotations

import calendar
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------


class Decision(Enum):
    """Guardrail evaluation outcome."""

    ALLOWED = "Allowed"
    BLOCKED = "Blocked"
    DRY_RUN = "DryRun"


class GuardrailConfigError(Exception):
    """Raised when guardrail configuration is missing or invalid."""

    pass


@dataclass(frozen=True)
class GuardrailResult:
    """Result of a guardrail evaluation."""

    decision: Decision
    reason: str


@dataclass(frozen=True)
class GuardrailConfig:
    """Configuration for guardrail checks."""

    max_grow_per_action_pct: float  # Range: [1, 100]
    max_grow_per_day_gib: float  # Range: (0, ∞)
    cooldown_minutes: int  # Range: [0, ∞)
    dry_run: bool
    table_name: str
    cloudwatch_namespace: str = "FSxNOps/Guardrails"
    daily_max_actions: int = 50  # Max number of expansion actions per resource per day


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_config(config: GuardrailConfig) -> None:
    """
    Validate guardrail configuration.

    Raises GuardrailConfigError if:
    - max_grow_per_action_pct not in [1, 100]
    - max_grow_per_day_gib <= 0
    - cooldown_minutes < 0
    - table_name is empty
    """
    errors: list[str] = []

    if not (1 <= config.max_grow_per_action_pct <= 100):
        errors.append(
            f"max_grow_per_action_pct must be in [1, 100], got {config.max_grow_per_action_pct}"
        )

    if config.max_grow_per_day_gib <= 0:
        errors.append(
            f"max_grow_per_day_gib must be > 0, got {config.max_grow_per_day_gib}"
        )

    if config.cooldown_minutes < 0:
        errors.append(
            f"cooldown_minutes must be >= 0, got {config.cooldown_minutes}"
        )

    if not config.table_name:
        errors.append("table_name must not be empty")

    if errors:
        raise GuardrailConfigError("; ".join(errors))


# ---------------------------------------------------------------------------
# Core Evaluation
# ---------------------------------------------------------------------------


def evaluate_expansion(
    resource_id: str,
    resource_type: str,
    current_size_gib: float,
    proposed_growth_gib: float,
    config: GuardrailConfig,
    dynamodb_client: Optional[Any] = None,
    cloudwatch_client: Optional[Any] = None,
    now: Optional[datetime] = None,
) -> GuardrailResult:
    """
    Evaluate whether a proposed expansion is allowed.

    Checks are applied in order:
    1. Per-action rate limit
    2. Daily cumulative cap (reads DynamoDB)
    3. Cooldown period (reads DynamoDB)

    Returns GuardrailResult with decision and reason.
    Fail-safe: DynamoDB read failures → Blocked.
    CloudWatch failures → logged and ignored.
    """
    # Validate config — raises GuardrailConfigError if invalid
    validate_config(config)

    # Guard against invalid inputs
    if current_size_gib <= 0:
        result = GuardrailResult(
            decision=Decision.BLOCKED,
            reason=f"Invalid current_size_gib: {current_size_gib} (must be > 0)",
        )
        _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
        return result

    if proposed_growth_gib <= 0:
        result = GuardrailResult(
            decision=Decision.BLOCKED,
            reason=f"Invalid proposed_growth_gib: {proposed_growth_gib} (must be > 0)",
        )
        _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
        return result

    # Resolve current time
    if now is None:
        now = datetime.now(timezone.utc)

    # Initialize DynamoDB client
    if dynamodb_client is None:
        dynamodb_client = boto3.client("dynamodb")

    # --- Check 1: Per-action rate limit ---
    expansion_pct = (proposed_growth_gib / current_size_gib) * 100
    if expansion_pct > config.max_grow_per_action_pct:
        result = GuardrailResult(
            decision=Decision.BLOCKED,
            reason=(
                f"Per-action limit exceeded: expansion {expansion_pct:.1f}% "
                f"> max {config.max_grow_per_action_pct}%"
            ),
        )
        _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
        return result

    # --- Check 2: Daily cumulative cap ---
    today_str = now.strftime("%Y-%m-%d")
    try:
        ddb_response = dynamodb_client.get_item(
            TableName=config.table_name,
            Key={
                "resource_id": {"S": resource_id},
                "date": {"S": today_str},
            },
            ConsistentRead=True,
        )
        item = ddb_response.get("Item", {})
        daily_total_gib = float(item.get("daily_total_gib", {}).get("N", "0"))
        last_action_ts_str = item.get("last_action_timestamp", {}).get("S", "")
    except (ClientError, Exception) as e:
        logger.error(
            "DynamoDB read failed for resource_id=%s: %s", resource_id, e
        )
        result = GuardrailResult(
            decision=Decision.BLOCKED,
            reason=f"Fail-safe: DynamoDB read error — {e}",
        )
        _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
        return result

    if daily_total_gib + proposed_growth_gib > config.max_grow_per_day_gib:
        result = GuardrailResult(
            decision=Decision.BLOCKED,
            reason=(
                f"Daily cap exceeded: today's total {daily_total_gib:.1f} GiB + "
                f"proposed {proposed_growth_gib:.1f} GiB > "
                f"max {config.max_grow_per_day_gib} GiB/day"
            ),
        )
        _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
        return result

    # --- Check 3: Cooldown period ---
    if config.cooldown_minutes > 0 and last_action_ts_str:
        try:
            last_action_ts = datetime.fromisoformat(last_action_ts_str)
            elapsed_minutes = (now - last_action_ts).total_seconds() / 60
            if elapsed_minutes < config.cooldown_minutes:
                result = GuardrailResult(
                    decision=Decision.BLOCKED,
                    reason=(
                        f"Cooldown active: {elapsed_minutes:.1f} min elapsed "
                        f"< required {config.cooldown_minutes} min"
                    ),
                )
                _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
                return result
        except (ValueError, TypeError) as e:
            logger.warning(
                "Failed to parse last_action_timestamp '%s': %s — treating cooldown as satisfied",
                last_action_ts_str,
                e,
            )

    # --- All checks passed ---
    if config.dry_run:
        result = GuardrailResult(
            decision=Decision.DRY_RUN,
            reason=(
                f"All guardrail checks passed (dry-run mode): "
                f"expansion {expansion_pct:.1f}%, "
                f"daily total would be {daily_total_gib + proposed_growth_gib:.1f} GiB"
            ),
        )
    else:
        result = GuardrailResult(
            decision=Decision.ALLOWED,
            reason=(
                f"All guardrail checks passed: "
                f"expansion {expansion_pct:.1f}%, "
                f"daily total would be {daily_total_gib + proposed_growth_gib:.1f} GiB"
            ),
        )

    _emit_metric(result, resource_id, resource_type, config, cloudwatch_client)
    return result


# ---------------------------------------------------------------------------
# Record Expansion
# ---------------------------------------------------------------------------


def record_expansion(
    resource_id: str,
    growth_gib: float,
    config: GuardrailConfig,
    dynamodb_client: Optional[Any] = None,
    now: Optional[datetime] = None,
) -> None:
    """
    Record a successful expansion in DynamoDB.

    Atomically updates daily_total_gib, action_count, and last_action_timestamp.
    Key: { resource_id, date: YYYY-MM-DD }
    TTL = record date + 7 days (epoch seconds)

    On DynamoDB write failure: logs error (caller should handle).
    """
    if now is None:
        now = datetime.now(timezone.utc)

    if dynamodb_client is None:
        dynamodb_client = boto3.client("dynamodb")

    today_str = now.strftime("%Y-%m-%d")
    timestamp_str = now.isoformat()

    # Calculate TTL: 7 days from the record date (start of day + 7 days)
    record_date = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    ttl_epoch = int((record_date + timedelta(days=7)).timestamp())

    try:
        dynamodb_client.update_item(
            TableName=config.table_name,
            Key={
                "resource_id": {"S": resource_id},
                "date": {"S": today_str},
            },
            UpdateExpression=(
                "ADD daily_total_gib :growth, action_count :one "
                "SET last_action_timestamp = :ts, ttl_epoch = :ttl"
            ),
            ConditionExpression=(
                "attribute_not_exists(action_count) OR action_count < :max_actions"
            ),
            ExpressionAttributeValues={
                ":growth": {"N": str(growth_gib)},
                ":one": {"N": "1"},
                ":ts": {"S": timestamp_str},
                ":ttl": {"N": str(ttl_epoch)},
                ":max_actions": {"N": str(config.daily_max_actions)},
            },
        )
        logger.info(
            "Recorded expansion: resource_id=%s, growth_gib=%.2f, date=%s",
            resource_id,
            growth_gib,
            today_str,
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            logger.warning(
                "Conditional write rejected for resource_id=%s: daily action limit reached",
                resource_id,
            )
            raise
        logger.error(
            "DynamoDB write failed for resource_id=%s: %s", resource_id, e
        )
        raise
    except Exception as e:
        logger.error(
            "DynamoDB write failed for resource_id=%s: %s", resource_id, e
        )
        raise


# ---------------------------------------------------------------------------
# CloudWatch Metric Emission
# ---------------------------------------------------------------------------


def _emit_metric(
    result: GuardrailResult,
    resource_id: str,
    resource_type: str,
    config: GuardrailConfig,
    cloudwatch_client: Optional[Any] = None,
) -> None:
    """
    Emit a CloudWatch custom metric for the guardrail decision.

    Failures are logged and swallowed — metrics are not safety-critical.
    """
    try:
        if cloudwatch_client is None:
            cloudwatch_client = boto3.client("cloudwatch")

        cloudwatch_client.put_metric_data(
            Namespace=config.cloudwatch_namespace,
            MetricData=[
                {
                    "MetricName": "GuardrailDecision",
                    "Dimensions": [
                        {"Name": "Decision", "Value": result.decision.value},
                        {"Name": "ResourceType", "Value": resource_type},
                        {"Name": "ResourceId", "Value": resource_id},
                    ],
                    "Value": 1,
                    "Unit": "Count",
                }
            ],
        )
    except Exception as e:
        logger.warning("CloudWatch PutMetricData failed: %s", e)
