"""
Permission Interceptor Lambda — Unit Tests

Tests cover:
1. Basic permission checks (ALLOW/DENY)
2. Fail-safe behavior (missing SIDs → DENY)
3. Admin-only tools
4. Owner-only scope enforcement
5. Unknown tool handling
"""

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Add lambda directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["USER_ACCESS_TABLE_NAME"] = "test-user-access"
os.environ["LOG_LEVEL"] = "WARNING"

from handler import check_permission, get_user_permission_level, lambda_handler


# ─── Unit Tests: get_user_permission_level ─────────────────


class TestGetUserPermissionLevel:
    def test_empty_sids_returns_deny(self):
        assert get_user_permission_level([]) == "deny"

    def test_domain_admins_sid_returns_admin(self):
        sids = ["S-1-5-21-1234567890-1234567890-1234567890-512"]
        assert get_user_permission_level(sids) == "admin"

    def test_regular_sids_returns_read(self):
        sids = [
            "S-1-5-21-1234567890-1234567890-1234567890-1001",
            "S-1-5-21-1234567890-1234567890-1234567890-2001",
        ]
        assert get_user_permission_level(sids) == "read"

    def test_mixed_sids_with_admin_returns_admin(self):
        sids = [
            "S-1-5-21-1234567890-1234567890-1234567890-1001",
            "S-1-5-21-1234567890-1234567890-1234567890-512",  # Domain Admins
        ]
        assert get_user_permission_level(sids) == "admin"


# ─── Unit Tests: check_permission ──────────────────────────


class TestCheckPermission:
    def test_unknown_tool_denied(self):
        result = check_permission("user1", ["S-1-5-21-xxx-1001"], "unknown_tool", {})
        assert result["decision"] == "DENY"
        assert "Unknown tool" in result["reason"]

    def test_read_tool_allowed_for_regular_user(self):
        result = check_permission("user1", ["S-1-5-21-xxx-1001"], "list_volumes", {})
        assert result["decision"] == "ALLOW"

    def test_admin_tool_denied_for_regular_user(self):
        result = check_permission("user1", ["S-1-5-21-xxx-1001"], "expand_volume", {})
        assert result["decision"] == "DENY"
        assert "Insufficient permission" in result["reason"]

    def test_admin_tool_allowed_for_admin_user(self):
        result = check_permission(
            "admin1", ["S-1-5-21-xxx-512"], "expand_volume", {}
        )
        assert result["decision"] == "ALLOW"

    def test_no_sids_fails_safe(self):
        result = check_permission("user1", [], "list_volumes", {})
        assert result["decision"] == "DENY"
        assert "No valid SIDs" in result["reason"]

    def test_owner_only_scope_allows_owner(self):
        result = check_permission(
            "admin1",
            ["S-1-5-21-xxx-512"],
            "delete_file",
            {"owner_uid": "1001", "user_uid": "1001"},
        )
        assert result["decision"] == "ALLOW"

    def test_owner_only_scope_denies_non_owner(self):
        result = check_permission(
            "admin1",
            ["S-1-5-21-xxx-512"],
            "delete_file",
            {"owner_uid": "1001", "user_uid": "2002"},
        )
        assert result["decision"] == "DENY"
        assert "Owner-only" in result["reason"]

    def test_search_kb_allowed_for_any_authenticated_user(self):
        result = check_permission("user1", ["S-1-5-21-xxx-1001"], "search_kb", {})
        assert result["decision"] == "ALLOW"


# ─── Integration Test: lambda_handler ──────────────────────


class TestLambdaHandler:
    @patch("handler.dynamodb")
    def test_handler_allow(self, mock_dynamodb):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {"userId": "user1", "SID": ["S-1-5-21-xxx-1001"]}
        }
        mock_dynamodb.Table.return_value = mock_table

        event = {
            "toolName": "list_volumes",
            "toolInput": {},
            "userContext": {"userId": "user1"},
            "requestId": "test-req-1",
        }

        result = lambda_handler(event, None)
        assert result["decision"] == "ALLOW"

    @patch("handler.dynamodb")
    def test_handler_deny_insufficient_permission(self, mock_dynamodb):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {"userId": "user1", "SID": ["S-1-5-21-xxx-1001"]}
        }
        mock_dynamodb.Table.return_value = mock_table

        event = {
            "toolName": "expand_volume",
            "toolInput": {},
            "userContext": {"userId": "user1"},
            "requestId": "test-req-2",
        }

        result = lambda_handler(event, None)
        assert result["decision"] == "DENY"

    @patch("handler.dynamodb")
    def test_handler_deny_on_dynamodb_error(self, mock_dynamodb):
        mock_table = MagicMock()
        mock_table.get_item.side_effect = Exception("DynamoDB connection timeout")
        mock_dynamodb.Table.return_value = mock_table

        event = {
            "toolName": "list_volumes",
            "toolInput": {},
            "userContext": {"userId": "user1"},
            "requestId": "test-req-3",
        }

        result = lambda_handler(event, None)
        # Fail-safe: error → DENY
        assert result["decision"] == "DENY"
        assert "fail-safe" in result["reason"].lower()

    @patch("handler.dynamodb")
    def test_handler_deny_user_not_found(self, mock_dynamodb):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}  # No Item
        mock_dynamodb.Table.return_value = mock_table

        event = {
            "toolName": "list_volumes",
            "toolInput": {},
            "userContext": {"userId": "unknown-user"},
            "requestId": "test-req-4",
        }

        result = lambda_handler(event, None)
        assert result["decision"] == "DENY"
        assert "No valid SIDs" in result["reason"]
