"""
Property-based tests for the guardrails module.

Uses Hypothesis to verify universal correctness properties of the
guardrail evaluation logic.
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from hypothesis import given, assume, settings
from hypothesis import strategies as st

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda"))

from common.guardrails import (
    Decision,
    GuardrailConfig,
    GuardrailConfigError,
    GuardrailResult,
    evaluate_expansion,
    record_expansion,
    validate_config,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

valid_config_strategy = st.builds(
    GuardrailConfig,
    max_grow_per_action_pct=st.floats(min_value=1.0, max_value=100.0),
    max_grow_per_day_gib=st.floats(min_value=0.01, max_value=10000.0),
    cooldown_minutes=st.integers(min_value=0, max_value=1440),
    dry_run=st.booleans(),
    table_name=st.just("test-guardrails-table"),
    cloudwatch_namespace=st.just("FSxNOps/Guardrails"),
)

invalid_config_strategy = st.one_of(
    # max_grow_per_action_pct out of range
    st.builds(
        GuardrailConfig,
        max_grow_per_action_pct=st.one_of(
            st.floats(max_value=0.99),
            st.floats(min_value=100.01, max_value=1000.0),
        ),
        max_grow_per_day_gib=st.floats(min_value=0.01, max_value=10000.0),
        cooldown_minutes=st.integers(min_value=0, max_value=1440),
        dry_run=st.booleans(),
        table_name=st.just("test-table"),
    ),
    # max_grow_per_day_gib <= 0
    st.builds(
        GuardrailConfig,
        max_grow_per_action_pct=st.floats(min_value=1.0, max_value=100.0),
        max_grow_per_day_gib=st.floats(max_value=0.0),
        cooldown_minutes=st.integers(min_value=0, max_value=1440),
        dry_run=st.booleans(),
        table_name=st.just("test-table"),
    ),
    # cooldown_minutes < 0
    st.builds(
        GuardrailConfig,
        max_grow_per_action_pct=st.floats(min_value=1.0, max_value=100.0),
        max_grow_per_day_gib=st.floats(min_value=0.01, max_value=10000.0),
        cooldown_minutes=st.integers(min_value=-1000, max_value=-1),
        dry_run=st.booleans(),
        table_name=st.just("test-table"),
    ),
    # table_name empty
    st.builds(
        GuardrailConfig,
        max_grow_per_action_pct=st.floats(min_value=1.0, max_value=100.0),
        max_grow_per_day_gib=st.floats(min_value=0.01, max_value=10000.0),
        cooldown_minutes=st.integers(min_value=0, max_value=1440),
        dry_run=st.booleans(),
        table_name=st.just(""),
    ),
)


def _make_mock_dynamodb(daily_total_gib=0.0, last_action_ts=None):
    """Create a mock DynamoDB client with configurable state."""
    mock_client = MagicMock()
    item = {}
    if daily_total_gib > 0:
        item["daily_total_gib"] = {"N": str(daily_total_gib)}
    if last_action_ts:
        item["last_action_timestamp"] = {"S": last_action_ts}

    mock_client.get_item.return_value = {"Item": item} if item else {}
    mock_client.update_item.return_value = {}
    return mock_client


def _make_mock_cloudwatch():
    """Create a mock CloudWatch client."""
    mock_client = MagicMock()
    mock_client.put_metric_data.return_value = {}
    return mock_client


# ---------------------------------------------------------------------------
# Property 1: Well-formed decision output
# ---------------------------------------------------------------------------


class TestProperty1WellFormedOutput:
    """Property 1: For any valid inputs, result is a well-formed GuardrailResult."""

    @given(
        current_size_gib=st.floats(min_value=0.1, max_value=100000.0),
        proposed_growth_gib=st.floats(min_value=0.01, max_value=50000.0),
        config=valid_config_strategy,
    )
    @settings(max_examples=100)
    def test_well_formed_output(self, current_size_gib, proposed_growth_gib, config):
        """evaluate_expansion always returns a GuardrailResult with valid decision and non-empty reason."""
        assume(current_size_gib > 0)
        assume(proposed_growth_gib > 0)

        mock_ddb = _make_mock_dynamodb()
        mock_cw = _make_mock_cloudwatch()
        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        result = evaluate_expansion(
            resource_id="test-resource-001",
            resource_type="volume",
            current_size_gib=current_size_gib,
            proposed_growth_gib=proposed_growth_gib,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        assert isinstance(result, GuardrailResult)
        assert result.decision in (Decision.ALLOWED, Decision.BLOCKED, Decision.DRY_RUN)
        assert isinstance(result.reason, str)
        assert len(result.reason) > 0


# ---------------------------------------------------------------------------
# Property 2: Invalid configuration detection
# ---------------------------------------------------------------------------


class TestProperty2InvalidConfig:
    """Property 2: Invalid configs raise GuardrailConfigError."""

    @given(config=invalid_config_strategy)
    @settings(max_examples=100)
    def test_invalid_config_raises(self, config):
        """evaluate_expansion raises GuardrailConfigError for invalid configs."""
        assume(
            not (1 <= config.max_grow_per_action_pct <= 100)
            or config.max_grow_per_day_gib <= 0
            or config.cooldown_minutes < 0
            or not config.table_name
        )

        with pytest.raises(GuardrailConfigError):
            evaluate_expansion(
                resource_id="test-resource",
                resource_type="volume",
                current_size_gib=100.0,
                proposed_growth_gib=10.0,
                config=config,
                dynamodb_client=_make_mock_dynamodb(),
                cloudwatch_client=_make_mock_cloudwatch(),
            )

    @given(config=invalid_config_strategy)
    @settings(max_examples=50)
    def test_validate_config_raises(self, config):
        """validate_config raises GuardrailConfigError for invalid configs."""
        assume(
            not (1 <= config.max_grow_per_action_pct <= 100)
            or config.max_grow_per_day_gib <= 0
            or config.cooldown_minutes < 0
            or not config.table_name
        )

        with pytest.raises(GuardrailConfigError):
            validate_config(config)


# ---------------------------------------------------------------------------
# Property 3: Per-action rate limit correctness
# ---------------------------------------------------------------------------


class TestProperty3PerActionRateLimit:
    """Property 3: Per-action rate limit blocks iff expansion % > max."""

    @given(
        current_size_gib=st.floats(min_value=1.0, max_value=10000.0),
        proposed_growth_gib=st.floats(min_value=0.01, max_value=10000.0),
        max_grow_pct=st.floats(min_value=1.0, max_value=100.0),
    )
    @settings(max_examples=200)
    def test_per_action_rate_limit(self, current_size_gib, proposed_growth_gib, max_grow_pct):
        """Block iff (proposed / current) * 100 > max_grow_per_action_pct."""
        assume(current_size_gib > 0)
        assume(proposed_growth_gib > 0)

        config = GuardrailConfig(
            max_grow_per_action_pct=max_grow_pct,
            max_grow_per_day_gib=999999.0,  # effectively unlimited
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
        )

        mock_ddb = _make_mock_dynamodb()
        mock_cw = _make_mock_cloudwatch()
        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        result = evaluate_expansion(
            resource_id="test-resource",
            resource_type="volume",
            current_size_gib=current_size_gib,
            proposed_growth_gib=proposed_growth_gib,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        expansion_pct = (proposed_growth_gib / current_size_gib) * 100
        if expansion_pct > max_grow_pct:
            assert result.decision == Decision.BLOCKED
            assert "Per-action limit" in result.reason
        else:
            # Should pass per-action check (may still be Allowed)
            assert result.decision == Decision.ALLOWED


# ---------------------------------------------------------------------------
# Property 4: Daily cap enforcement correctness
# ---------------------------------------------------------------------------


class TestProperty4DailyCapEnforcement:
    """Property 4: Daily cap blocks iff daily_total + proposed > max."""

    @given(
        proposed_growth_gib=st.floats(min_value=0.01, max_value=1000.0),
        daily_total_gib=st.floats(min_value=0.0, max_value=1000.0),
        max_grow_per_day_gib=st.floats(min_value=0.01, max_value=2000.0),
    )
    @settings(max_examples=200)
    def test_daily_cap_enforcement(self, proposed_growth_gib, daily_total_gib, max_grow_per_day_gib):
        """Block iff daily_total + proposed > max_grow_per_day_gib."""
        assume(proposed_growth_gib > 0)
        assume(daily_total_gib >= 0)

        config = GuardrailConfig(
            max_grow_per_action_pct=100.0,  # effectively unlimited
            max_grow_per_day_gib=max_grow_per_day_gib,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
        )

        mock_ddb = _make_mock_dynamodb(daily_total_gib=daily_total_gib)
        mock_cw = _make_mock_cloudwatch()
        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        # Use a small proposed_growth relative to current_size to pass per-action check
        current_size_gib = proposed_growth_gib * 100  # ensures < 1% expansion

        result = evaluate_expansion(
            resource_id="test-resource",
            resource_type="volume",
            current_size_gib=current_size_gib,
            proposed_growth_gib=proposed_growth_gib,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        if daily_total_gib + proposed_growth_gib > max_grow_per_day_gib:
            assert result.decision == Decision.BLOCKED
            assert "Daily cap" in result.reason
        else:
            assert result.decision == Decision.ALLOWED


# ---------------------------------------------------------------------------
# Property 5: Cooldown period enforcement correctness
# ---------------------------------------------------------------------------


class TestProperty5CooldownEnforcement:
    """Property 5: Cooldown blocks iff elapsed < cooldown_minutes."""

    @given(
        cooldown_minutes=st.integers(min_value=1, max_value=1440),
        elapsed_minutes=st.integers(min_value=0, max_value=2880),
    )
    @settings(max_examples=200)
    def test_cooldown_enforcement(self, cooldown_minutes, elapsed_minutes):
        """Block iff elapsed < cooldown_minutes."""
        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        last_action_ts = (now - timedelta(minutes=elapsed_minutes)).isoformat()

        config = GuardrailConfig(
            max_grow_per_action_pct=100.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=cooldown_minutes,
            dry_run=False,
            table_name="test-table",
        )

        mock_ddb = _make_mock_dynamodb(
            daily_total_gib=0.0,
            last_action_ts=last_action_ts,
        )
        mock_cw = _make_mock_cloudwatch()

        result = evaluate_expansion(
            resource_id="test-resource",
            resource_type="volume",
            current_size_gib=1000.0,
            proposed_growth_gib=1.0,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        if elapsed_minutes < cooldown_minutes:
            assert result.decision == Decision.BLOCKED
            assert "Cooldown" in result.reason
        else:
            assert result.decision == Decision.ALLOWED


# ---------------------------------------------------------------------------
# Property 6: Fail-safe on DynamoDB errors
# ---------------------------------------------------------------------------


class TestProperty6FailSafeDynamoDB:
    """Property 6: DynamoDB failures → Blocked decision."""

    @given(
        current_size_gib=st.floats(min_value=1.0, max_value=10000.0),
        proposed_growth_gib=st.floats(min_value=0.01, max_value=100.0),
    )
    @settings(max_examples=50)
    def test_dynamodb_read_failure_returns_blocked(self, current_size_gib, proposed_growth_gib):
        """DynamoDB read failure returns Blocked."""
        assume(current_size_gib > 0)
        assume(proposed_growth_gib > 0)
        # Ensure per-action check passes
        assume((proposed_growth_gib / current_size_gib) * 100 <= 50)

        config = GuardrailConfig(
            max_grow_per_action_pct=50.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
        )

        mock_ddb = MagicMock()
        mock_ddb.get_item.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "DDB failure"}},
            "GetItem",
        )
        mock_cw = _make_mock_cloudwatch()

        result = evaluate_expansion(
            resource_id="test-resource",
            resource_type="volume",
            current_size_gib=current_size_gib,
            proposed_growth_gib=proposed_growth_gib,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
        )

        assert result.decision == Decision.BLOCKED
        assert "DynamoDB" in result.reason or "Fail-safe" in result.reason


# ---------------------------------------------------------------------------
# Property 7: Dry-run mode decision mapping
# ---------------------------------------------------------------------------


class TestProperty7DryRunMode:
    """Property 7: When all checks pass, dry_run=True → DryRun, dry_run=False → Allowed."""

    @given(dry_run=st.booleans())
    @settings(max_examples=50)
    def test_dry_run_mapping(self, dry_run):
        """Dry-run mode correctly maps to DryRun or Allowed."""
        config = GuardrailConfig(
            max_grow_per_action_pct=100.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=dry_run,
            table_name="test-table",
        )

        mock_ddb = _make_mock_dynamodb()
        mock_cw = _make_mock_cloudwatch()
        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        result = evaluate_expansion(
            resource_id="test-resource",
            resource_type="volume",
            current_size_gib=1000.0,
            proposed_growth_gib=1.0,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        if dry_run:
            assert result.decision == Decision.DRY_RUN
        else:
            assert result.decision == Decision.ALLOWED


# ---------------------------------------------------------------------------
# Property 8: CloudWatch failure resilience
# ---------------------------------------------------------------------------


class TestProperty8CloudWatchResilience:
    """Property 8: CloudWatch failures don't affect the decision."""

    @given(
        current_size_gib=st.floats(min_value=100.0, max_value=10000.0),
        proposed_growth_gib=st.floats(min_value=0.01, max_value=10.0),
    )
    @settings(max_examples=50)
    def test_cloudwatch_failure_does_not_block(self, current_size_gib, proposed_growth_gib):
        """CloudWatch PutMetricData failure does not change the decision."""
        assume(current_size_gib > 0)
        assume(proposed_growth_gib > 0)
        # Ensure per-action check passes (proposed < 100% of current)
        assume((proposed_growth_gib / current_size_gib) * 100 <= 100.0)

        config = GuardrailConfig(
            max_grow_per_action_pct=100.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
        )

        mock_ddb = _make_mock_dynamodb()
        mock_cw = MagicMock()
        mock_cw.put_metric_data.side_effect = Exception("CloudWatch unavailable")
        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        result = evaluate_expansion(
            resource_id="test-resource",
            resource_type="volume",
            current_size_gib=current_size_gib,
            proposed_growth_gib=proposed_growth_gib,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        # Should still return Allowed (not crash or return Blocked)
        assert result.decision == Decision.ALLOWED
        assert isinstance(result.reason, str)
        assert len(result.reason) > 0


# ---------------------------------------------------------------------------
# Property 9: Independent resource tracking
# ---------------------------------------------------------------------------


class TestProperty9IndependentResourceTracking:
    """Property 9: Different resources are tracked independently."""

    def test_independent_tracking(self):
        """Recording expansion for resource A does not affect resource B."""
        config = GuardrailConfig(
            max_grow_per_action_pct=50.0,
            max_grow_per_day_gib=100.0,
            cooldown_minutes=30,
            dry_run=False,
            table_name="test-table",
        )

        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        # Track calls to DynamoDB
        ddb_calls = []

        def mock_get_item(**kwargs):
            ddb_calls.append(("get_item", kwargs))
            key = kwargs["Key"]
            resource_id = key["resource_id"]["S"]
            # Resource A has used 90 GiB today, Resource B has used 0
            if resource_id == "resource-A":
                return {
                    "Item": {
                        "daily_total_gib": {"N": "90"},
                        "last_action_timestamp": {"S": (now - timedelta(minutes=5)).isoformat()},
                    }
                }
            else:
                return {}

        mock_ddb = MagicMock()
        mock_ddb.get_item.side_effect = mock_get_item
        mock_cw = _make_mock_cloudwatch()

        # Resource A should be blocked (daily cap: 90 + 20 > 100)
        result_a = evaluate_expansion(
            resource_id="resource-A",
            resource_type="volume",
            current_size_gib=1000.0,
            proposed_growth_gib=20.0,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        # Resource B should be allowed (daily cap: 0 + 20 <= 100, no cooldown)
        result_b = evaluate_expansion(
            resource_id="resource-B",
            resource_type="volume",
            current_size_gib=1000.0,
            proposed_growth_gib=20.0,
            config=config,
            dynamodb_client=mock_ddb,
            cloudwatch_client=mock_cw,
            now=now,
        )

        # Resource A blocked by cooldown (5 min < 30 min)
        assert result_a.decision == Decision.BLOCKED

        # Resource B allowed (no prior state)
        assert result_b.decision == Decision.ALLOWED


# ---------------------------------------------------------------------------
# Property 10: Conditional write rejects when daily action limit reached
# ---------------------------------------------------------------------------


class TestProperty10ConditionalWriteRejectsAtLimit:
    """Property 10: record_expansion raises ClientError when daily action limit is reached."""

    def test_conditional_check_failed_raises(self):
        """record_expansion raises ClientError with ConditionalCheckFailedException."""
        config = GuardrailConfig(
            max_grow_per_action_pct=50.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
            daily_max_actions=10,
        )

        mock_ddb = MagicMock()
        mock_ddb.update_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "Condition not met"}},
            "UpdateItem",
        )

        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        with pytest.raises(ClientError) as exc_info:
            record_expansion(
                resource_id="test-resource",
                growth_gib=5.0,
                config=config,
                dynamodb_client=mock_ddb,
                now=now,
            )

        assert exc_info.value.response['Error']['Code'] == 'ConditionalCheckFailedException'

    def test_record_expansion_passes_max_actions_to_condition(self):
        """record_expansion includes ConditionExpression and :max_actions in the DynamoDB call."""
        config = GuardrailConfig(
            max_grow_per_action_pct=50.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
            daily_max_actions=25,
        )

        mock_ddb = MagicMock()
        mock_ddb.update_item.return_value = {}

        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        record_expansion(
            resource_id="test-resource",
            growth_gib=5.0,
            config=config,
            dynamodb_client=mock_ddb,
            now=now,
        )

        # Verify the update_item call includes ConditionExpression
        call_kwargs = mock_ddb.update_item.call_args[1]
        assert "ConditionExpression" in call_kwargs
        assert "attribute_not_exists(action_count) OR action_count < :max_actions" == call_kwargs["ConditionExpression"]
        assert ":max_actions" in call_kwargs["ExpressionAttributeValues"]
        assert call_kwargs["ExpressionAttributeValues"][":max_actions"] == {"N": "25"}

    def test_record_expansion_success_without_limit(self):
        """record_expansion succeeds when under the daily action limit."""
        config = GuardrailConfig(
            max_grow_per_action_pct=50.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
            daily_max_actions=50,
        )

        mock_ddb = MagicMock()
        mock_ddb.update_item.return_value = {}

        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        # Should not raise
        record_expansion(
            resource_id="test-resource",
            growth_gib=5.0,
            config=config,
            dynamodb_client=mock_ddb,
            now=now,
        )

        mock_ddb.update_item.assert_called_once()

    def test_other_client_error_still_raises(self):
        """record_expansion re-raises non-conditional ClientErrors."""
        config = GuardrailConfig(
            max_grow_per_action_pct=50.0,
            max_grow_per_day_gib=999999.0,
            cooldown_minutes=0,
            dry_run=False,
            table_name="test-table",
            daily_max_actions=50,
        )

        mock_ddb = MagicMock()
        mock_ddb.update_item.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "DDB failure"}},
            "UpdateItem",
        )

        now = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        with pytest.raises(ClientError) as exc_info:
            record_expansion(
                resource_id="test-resource",
                growth_gib=5.0,
                config=config,
                dynamodb_client=mock_ddb,
                now=now,
            )

        assert exc_info.value.response['Error']['Code'] == 'InternalServerError'
