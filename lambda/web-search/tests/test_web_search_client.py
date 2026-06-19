"""
Unit tests for web_search_client and handler.

Pure unit tests using unittest.mock — no real AWS calls.
Tests cover: MCP response parsing, error handling, timeout, handler routing.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add parent directory to path so we can import the modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from web_search_client import (
    WebSearchCitation,
    WebSearchResult,
    _parse_mcp_response,
    invoke_web_search,
    invoke_web_search_http,
)


# ─── _parse_mcp_response tests ────────────────────────────────────────────────


class TestParseMcpResponse:
    """MCP レスポンス解析のテスト"""

    def test_text_content(self):
        """テキストコンテンツを正しく抽出する"""
        body = {
            "jsonrpc": "2.0",
            "result": {
                "content": [
                    {"type": "text", "text": "Here is the answer."},
                ]
            },
            "id": "ws-1",
        }
        text, citations = _parse_mcp_response(body)
        assert text == "Here is the answer."
        assert citations == []

    def test_resource_citations(self):
        """resource タイプから citations を抽出する"""
        body = {
            "jsonrpc": "2.0",
            "result": {
                "content": [
                    {"type": "text", "text": "Summary."},
                    {
                        "type": "resource",
                        "resource": {
                            "uri": "https://example.com/page",
                            "title": "Example Page",
                            "snippet": "This is a snippet.",
                        },
                    },
                ]
            },
            "id": "ws-2",
        }
        text, citations = _parse_mcp_response(body)
        assert text == "Summary."
        assert len(citations) == 1
        assert citations[0].url == "https://example.com/page"
        assert citations[0].title == "Example Page"
        assert citations[0].snippet == "This is a snippet."

    def test_multiple_text_concatenation(self):
        """複数の text コンテンツが連結される"""
        body = {
            "result": {
                "content": [
                    {"type": "text", "text": "Part 1. "},
                    {"type": "text", "text": "Part 2."},
                ]
            }
        }
        text, citations = _parse_mcp_response(body)
        assert text == "Part 1. Part 2."

    def test_empty_result(self):
        """空レスポンスを正しく処理する"""
        body = {"result": {"content": []}}
        text, citations = _parse_mcp_response(body)
        assert text == ""
        assert citations == []

    def test_missing_result_key(self):
        """result キーがないレスポンス"""
        body = {"jsonrpc": "2.0", "id": "ws-3"}
        text, citations = _parse_mcp_response(body)
        assert text == ""
        assert citations == []

    def test_error_response(self):
        """エラーレスポンスを正しく処理する"""
        body = {
            "jsonrpc": "2.0",
            "error": {"code": -32600, "message": "Invalid Request"},
            "id": "ws-4",
        }
        text, citations = _parse_mcp_response(body)
        assert text == ""
        assert citations == []

    def test_resource_with_name_fallback(self):
        """title がない場合 name にフォールバックする"""
        body = {
            "result": {
                "content": [
                    {
                        "type": "resource",
                        "resource": {
                            "uri": "https://example.com",
                            "name": "Fallback Name",
                            "description": "Desc as snippet",
                        },
                    },
                ]
            }
        }
        text, citations = _parse_mcp_response(body)
        assert citations[0].title == "Fallback Name"
        assert citations[0].snippet == "Desc as snippet"

    def test_non_dict_items_skipped(self):
        """content 内の非 dict 要素はスキップする"""
        body = {
            "result": {
                "content": [
                    "invalid string item",
                    None,
                    {"type": "text", "text": "valid"},
                ]
            }
        }
        text, citations = _parse_mcp_response(body)
        assert text == "valid"

    def test_string_result_fallback(self):
        """result が文字列の場合のフォールバック"""
        body = {"result": "Plain text result"}
        text, citations = _parse_mcp_response(body)
        assert text == "Plain text result"
        assert citations == []


# ─── invoke_web_search tests ──────────────────────────────────────────────────


class TestInvokeWebSearch:
    """invoke_web_search のテスト"""

    def test_no_gateway_url_returns_error(self):
        """Gateway URL 未設定時にエラーを返す"""
        with patch.dict("os.environ", {"WEB_SEARCH_GATEWAY_URL": ""}, clear=False):
            # Need to reimport to pick up env change
            import web_search_client as wsc

            wsc.WEB_SEARCH_GATEWAY_URL = ""
            result = wsc.invoke_web_search("test query")
            assert result.error is not None
            assert "not configured" in result.error

    @patch("web_search_client._create_agentcore_client")
    def test_client_error_handled(self, mock_client_factory):
        """ClientError を正しくハンドリングする"""
        from botocore.exceptions import ClientError

        mock_client = MagicMock()
        mock_client.invoke_agent.side_effect = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "Not authorized"}},
            "InvokeAgent",
        )
        mock_client_factory.return_value = mock_client

        import web_search_client as wsc

        wsc.WEB_SEARCH_GATEWAY_URL = "https://example.gateway.com/mcp"
        result = wsc.invoke_web_search("test query", gateway_url="https://example.gateway.com/mcp")
        assert result.error is not None
        assert "AccessDeniedException" in result.error
        assert result.latency_ms > 0

    @patch("web_search_client._create_agentcore_client")
    def test_timeout_handled(self, mock_client_factory):
        """ReadTimeoutError を正しくハンドリングする"""
        from botocore.exceptions import ReadTimeoutError

        mock_client = MagicMock()
        mock_client.invoke_agent.side_effect = ReadTimeoutError(endpoint_url="https://example.com")
        mock_client_factory.return_value = mock_client

        import web_search_client as wsc

        result = wsc.invoke_web_search("test query", gateway_url="https://example.gateway.com/mcp")
        assert result.error is not None
        assert "timed out" in result.error


# ─── Handler tests ────────────────────────────────────────────────────────────


class TestHandler:
    """Lambda handler のテスト"""

    @patch("handler.invoke_web_search_http")
    def test_direct_invoke_success(self, mock_search):
        """直接呼び出しで正常レスポンスを返す"""
        mock_search.return_value = WebSearchResult(
            text="Answer from web",
            citations=[
                WebSearchCitation(title="Page 1", url="https://example.com", snippet="Snippet 1")
            ],
            latency_ms=150.0,
        )

        from handler import handler

        event = {"query": "what is CDK", "userId": "user-1", "maxResults": 3}
        result = handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["success"] is True
        assert body["text"] == "Answer from web"
        assert len(body["citations"]) == 1
        assert body["citations"][0]["boundaryType"] == "reference"
        assert body["citations"][0]["permissionVerified"] is False
        assert body["metadata"]["webSearchUsed"] is True

    @patch("handler.invoke_web_search_http")
    def test_api_gateway_proxy_format(self, mock_search):
        """API Gateway proxy 形式のイベントを解析する"""
        mock_search.return_value = WebSearchResult(text="Result", latency_ms=100.0)

        from handler import handler

        event = {
            "httpMethod": "POST",
            "body": json.dumps({"query": "hello", "userId": "user-2"}),
        }
        result = handler(event, None)

        assert result["statusCode"] == 200
        mock_search.assert_called_once_with("hello", max_results=5)

    def test_empty_query_returns_400(self):
        """空クエリで 400 を返す"""
        from handler import handler

        event = {"query": "", "userId": "user-1"}
        result = handler(event, None)

        assert result["statusCode"] == 400
        body = json.loads(result["body"])
        assert body["success"] is False
        assert "required" in body["error"]

    def test_long_query_returns_400(self):
        """1000文字超のクエリで 400 を返す"""
        from handler import handler

        event = {"query": "x" * 1001, "userId": "user-1"}
        result = handler(event, None)

        assert result["statusCode"] == 400
        body = json.loads(result["body"])
        assert "maximum length" in body["error"]

    @patch("handler.invoke_web_search_http")
    def test_search_error_returns_502(self, mock_search):
        """Web Search エラー時に 502 を返す"""
        mock_search.return_value = WebSearchResult(
            text="", error="Gateway timeout", latency_ms=15000.0
        )

        from handler import handler

        event = {"query": "test", "userId": "user-1"}
        result = handler(event, None)

        assert result["statusCode"] == 502
        body = json.loads(result["body"])
        assert body["success"] is False
        assert "Gateway timeout" in body["error"]

    @patch("handler.invoke_web_search")
    def test_sdk_mode_invocation(self, mock_search):
        """WEB_SEARCH_INVOCATION_MODE=sdk で invoke_web_search を使う"""
        mock_search.return_value = WebSearchResult(text="SDK result", latency_ms=80.0)

        import handler as h

        original_mode = h.INVOCATION_MODE
        h.INVOCATION_MODE = "sdk"

        try:
            result = h.handler({"query": "test sdk", "userId": "u"}, None)
            assert result["statusCode"] == 200
            mock_search.assert_called_once_with("test sdk", max_results=5)
        finally:
            h.INVOCATION_MODE = original_mode
