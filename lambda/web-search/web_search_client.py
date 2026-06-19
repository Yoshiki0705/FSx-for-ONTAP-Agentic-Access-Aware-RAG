"""
AgentCore Web Search Client

us-east-1 の AgentCore Gateway 経由で Web Search Tool を呼び出す。
ap-northeast-1 の Lambda から cross-region で利用される。

設計方針:
- boto3 のみ依存（Lambda ランタイム同梱、追加 pip 不要）
- Gateway MCP protocol に準拠した呼び出し
- レスポンスから citations（URL + title + snippet）を抽出
- タイムアウト、リトライ、エラーハンドリングを内包
- クエリサニタイズは呼び出し側の責務（sanitizeWebSearchQuery 等で事前処理）

出所: 連携リポジトリ fsxn-s3ap-serverless-patterns/shared/web_search_client.py を参考に
本プロジェクト向けに再実装。

@see docs/investigations/agentcore-web-search-integration.md — §5, §9.1
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, ReadTimeoutError

# ─── Configuration ─────────────────────────────────────────
logger = logging.getLogger(__name__)

# Gateway endpoint in us-east-1 (set via environment variable or CDK output)
WEB_SEARCH_GATEWAY_URL = os.environ.get("WEB_SEARCH_GATEWAY_URL", "")
WEB_SEARCH_GATEWAY_REGION = os.environ.get("WEB_SEARCH_GATEWAY_REGION", "us-east-1")
WEB_SEARCH_TIMEOUT_SECONDS = int(os.environ.get("WEB_SEARCH_TIMEOUT_SECONDS", "15"))
WEB_SEARCH_MAX_RESULTS = int(os.environ.get("WEB_SEARCH_MAX_RESULTS", "5"))


@dataclass
class WebSearchCitation:
    """Web検索結果の引用情報"""

    title: str
    url: str
    snippet: str


@dataclass
class WebSearchResult:
    """Web検索の結果"""

    text: str
    citations: list[WebSearchCitation] = field(default_factory=list)
    model: str = "agentcore-web-search"
    latency_ms: float = 0.0
    error: Optional[str] = None


def _create_agentcore_client():
    """us-east-1 向け AgentCore ランタイムクライアントを生成"""
    return boto3.client(
        "bedrock-agent-runtime",
        region_name=WEB_SEARCH_GATEWAY_REGION,
        config=Config(
            retries={"max_attempts": 2, "mode": "adaptive"},
            read_timeout=WEB_SEARCH_TIMEOUT_SECONDS,
            connect_timeout=5,
        ),
    )


def invoke_web_search(
    query: str,
    *,
    max_results: int = 0,
    gateway_url: str = "",
    session_id: Optional[str] = None,
) -> WebSearchResult:
    """
    AgentCore Gateway 経由で Web Search Tool を呼び出す。

    Args:
        query: 検索クエリ（事前にサニタイズ済みであること）
        max_results: 最大検索結果数（0=デフォルト使用）
        gateway_url: Gateway URL（未指定時は環境変数から取得）
        session_id: MCP セッション ID（省略時は新規セッション）

    Returns:
        WebSearchResult: テキスト応答 + 引用リスト

    Raises:
        WebSearchError: Gateway 呼び出しに失敗した場合
    """
    effective_url = gateway_url or WEB_SEARCH_GATEWAY_URL
    effective_max = max_results or WEB_SEARCH_MAX_RESULTS

    if not effective_url:
        logger.error("WEB_SEARCH_GATEWAY_URL is not configured")
        return WebSearchResult(
            text="",
            error="Web Search is not configured (WEB_SEARCH_GATEWAY_URL not set)",
        )

    start_time = time.time()

    try:
        client = _create_agentcore_client()

        # MCP tools/call リクエスト構築
        # AgentCore Gateway MCP protocol: invoke the web-search tool
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "web_search",
                "arguments": {
                    "query": query,
                    "max_results": effective_max,
                },
            },
            "id": session_id or f"ws-{int(time.time() * 1000)}",
        }

        logger.info(
            "Invoking Web Search",
            extra={
                "gateway_url": effective_url,
                "query_length": len(query),
                "max_results": effective_max,
            },
        )

        # Gateway invocation via bedrock-agent-runtime
        # NOTE: The exact API method depends on the SDK version.
        # For AgentCore Gateway MCP, we use invoke_inline_agent or
        # a direct HTTPS call. Here we use the SDK pattern.
        response = client.invoke_agent(
            agentId="GATEWAY",  # Placeholder — actual invocation uses Gateway URL
            agentAliasId="DEFAULT",
            sessionId=session_id or f"ws-{int(time.time())}",
            inputText=json.dumps(payload),
            # Override endpoint to Gateway URL
            endpointUrl=effective_url,
        )

        # Parse streaming response
        result_text = ""
        citations = []

        if "completion" in response:
            for event in response["completion"]:
                if "chunk" in event:
                    chunk = event["chunk"]
                    if "bytes" in chunk:
                        result_text += chunk["bytes"].decode("utf-8")

        # Alternative: direct MCP response parsing
        # If the response is a direct JSON (non-streaming), parse it
        if not result_text and "body" in response:
            body = json.loads(response["body"].read())
            result_text, citations = _parse_mcp_response(body)

        latency_ms = (time.time() - start_time) * 1000

        logger.info(
            "Web Search completed",
            extra={
                "latency_ms": round(latency_ms, 1),
                "result_length": len(result_text),
                "citation_count": len(citations),
            },
        )

        return WebSearchResult(
            text=result_text,
            citations=citations,
            latency_ms=latency_ms,
        )

    except ReadTimeoutError:
        latency_ms = (time.time() - start_time) * 1000
        logger.warning("Web Search timeout", extra={"latency_ms": latency_ms})
        return WebSearchResult(
            text="",
            error=f"Web Search timed out after {WEB_SEARCH_TIMEOUT_SECONDS}s",
            latency_ms=latency_ms,
        )

    except ClientError as e:
        latency_ms = (time.time() - start_time) * 1000
        error_code = e.response["Error"]["Code"]
        error_msg = e.response["Error"]["Message"]
        logger.error(
            "Web Search ClientError",
            extra={
                "error_code": error_code,
                "error_message": error_msg,
                "latency_ms": latency_ms,
            },
        )
        return WebSearchResult(
            text="",
            error=f"Web Search failed: {error_code} - {error_msg}",
            latency_ms=latency_ms,
        )

    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.exception("Web Search unexpected error")
        return WebSearchResult(
            text="",
            error=f"Web Search unexpected error: {str(e)}",
            latency_ms=latency_ms,
        )


def invoke_web_search_http(
    query: str,
    *,
    max_results: int = 0,
    gateway_url: str = "",
) -> WebSearchResult:
    """
    HTTPS 直接呼び出しによる Web Search（SigV4 署名付き）。

    boto3 の AgentCore API がまだ安定しない場合のフォールバック。
    urllib3 + botocore SigV4Auth を使って Gateway MCP endpoint に POST する。

    Args:
        query: 検索クエリ
        max_results: 最大結果数
        gateway_url: Gateway MCP endpoint URL

    Returns:
        WebSearchResult
    """
    import urllib.request
    import urllib.error

    from botocore.auth import SigV4Auth
    from botocore.awsrequest import AWSRequest

    effective_url = gateway_url or WEB_SEARCH_GATEWAY_URL
    effective_max = max_results or WEB_SEARCH_MAX_RESULTS

    if not effective_url:
        return WebSearchResult(
            text="",
            error="Web Search is not configured (WEB_SEARCH_GATEWAY_URL not set)",
        )

    start_time = time.time()

    try:
        # MCP tools/call payload
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "web_search",
                "arguments": {
                    "query": query,
                    "max_results": effective_max,
                },
            },
            "id": f"ws-{int(time.time() * 1000)}",
        }).encode("utf-8")

        # SigV4 signing
        session = boto3.Session()
        credentials = session.get_credentials().get_frozen_credentials()

        request = AWSRequest(
            method="POST",
            url=effective_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        SigV4Auth(credentials, "bedrock-agentcore", WEB_SEARCH_GATEWAY_REGION).add_auth(request)

        # Send request
        req = urllib.request.Request(
            effective_url,
            data=payload,
            headers=dict(request.headers),
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=WEB_SEARCH_TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        result_text, citations = _parse_mcp_response(body)
        latency_ms = (time.time() - start_time) * 1000

        logger.info(
            "Web Search (HTTP) completed",
            extra={
                "latency_ms": round(latency_ms, 1),
                "result_length": len(result_text),
                "citation_count": len(citations),
            },
        )

        return WebSearchResult(
            text=result_text,
            citations=citations,
            latency_ms=latency_ms,
        )

    except urllib.error.URLError as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.error("Web Search HTTP error", extra={"error": str(e)})
        return WebSearchResult(
            text="",
            error=f"Web Search HTTP error: {str(e)}",
            latency_ms=latency_ms,
        )

    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.exception("Web Search HTTP unexpected error")
        return WebSearchResult(
            text="",
            error=f"Web Search HTTP error: {str(e)}",
            latency_ms=latency_ms,
        )


def _parse_mcp_response(body: dict) -> tuple[str, list[WebSearchCitation]]:
    """
    MCP tools/call レスポンスを解析し、テキストと引用を抽出する。

    Expected MCP response shape:
    {
      "jsonrpc": "2.0",
      "result": {
        "content": [
          {"type": "text", "text": "..."},
          {"type": "resource", "resource": {"uri": "...", "title": "...", "snippet": "..."}}
        ]
      },
      "id": "..."
    }
    """
    result_text = ""
    citations: list[WebSearchCitation] = []

    result = body.get("result", {})

    # Fallback: if result is a plain string
    if isinstance(result, str):
        return result, []

    content_list = result.get("content", [])

    if isinstance(content_list, list):
        for item in content_list:
            if not isinstance(item, dict):
                continue

            item_type = item.get("type", "")

            if item_type == "text":
                result_text += item.get("text", "")

            elif item_type == "resource":
                resource = item.get("resource", {})
                citations.append(
                    WebSearchCitation(
                        title=resource.get("title", resource.get("name", "Untitled")),
                        url=resource.get("uri", ""),
                        snippet=resource.get("snippet", resource.get("description", "")),
                    )
                )

    # Fallback: error response
    if not result_text and "error" in body:
        error = body["error"]
        error_msg = error.get("message", str(error)) if isinstance(error, dict) else str(error)
        return "", []

    return result_text, citations
