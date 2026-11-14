"""Call the agent-tools AgentCore Gateway (MCP over HTTPS, AWS_IAM inbound auth).

The Gateway's authorizer is AWS_IAM, so every request is signed with SigV4 for the
`bedrock-agentcore` service using the Runtime's execution role. `mcp` 2.x builds its HTTP
client on `httpx2`, which takes an `Auth` object; `SigV4Auth` below signs each request
just before it is sent (the body is final at that point, so the payload hash matches).
"""

from __future__ import annotations

import json
import os
from collections.abc import Generator
from datetime import timedelta
from typing import Any

import boto3
import httpx2
from botocore.auth import SigV4Auth as BotoSigV4Auth
from botocore.awsrequest import AWSRequest
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
from strands.tools.mcp import MCPClient

SERVICE = "bedrock-agentcore"
# The Gateway names a Lambda target's tools `<target>___<tool>`.
SEARCH_TOOL = os.environ.get(
    "SEARCH_TOOL_NAME", "permission-search___permission_aware_search"
)


class SigV4Auth(httpx2.Auth):
    """Sign each request with SigV4 using the current boto3 credentials."""

    requires_request_body = True

    def __init__(self, region: str, session: boto3.Session | None = None) -> None:
        self._region = region
        self._session = session or boto3.Session()

    def auth_flow(
        self, request: httpx2.Request
    ) -> Generator[httpx2.Request, httpx2.Response, None]:
        credentials = self._session.get_credentials()
        if credentials is None:
            raise RuntimeError(
                "No AWS credentials available to sign the Gateway request"
            )
        # Only the headers SigV4 has to cover. Transport headers (Connection,
        # Accept-Encoding) can be rewritten on the way and would break the signature.
        headers = {
            k: v
            for k, v in request.headers.items()
            if k.lower() in ("content-type", "accept", "host")
        }
        aws_request = AWSRequest(
            method=request.method,
            url=str(request.url),
            data=request.content,
            headers=headers,
        )
        BotoSigV4Auth(
            credentials.get_frozen_credentials(), SERVICE, self._region
        ).add_auth(aws_request)
        for name, value in aws_request.headers.items():
            request.headers[name] = value
        yield request


def make_mcp_client(url: str, region: str) -> MCPClient:
    """An MCP client for the Gateway URL, signing with the execution role."""

    def transport():
        http_client = create_mcp_http_client(auth=SigV4Auth(region))
        return streamable_http_client(url, http_client=http_client)

    return MCPClient(transport)


def result_text(result: Any) -> str:
    """The text of an MCP tool result (`MCPToolResult`, a dict with `content`)."""
    content = (
        result.get("content", [])
        if isinstance(result, dict)
        else getattr(result, "content", [])
    )
    parts = []
    for item in content or []:
        text = (
            item.get("text") if isinstance(item, dict) else getattr(item, "text", None)
        )
        if text:
            parts.append(text)
    return "\n".join(parts)


class PermissionSearch:
    """Calls the Gateway's permission-aware search tool for one signed-in user."""

    def __init__(self, client: MCPClient, user_id: str) -> None:
        self._client = client
        self._user_id = user_id
        self.calls: list[dict[str, Any]] = []

    def search(self, query: str, max_results: int = 5) -> str:
        arguments = {"query": query, "maxResults": max_results, "userId": self._user_id}
        result = self._client.call_tool_sync(
            tool_use_id=f"search-{len(self.calls) + 1}",
            name=SEARCH_TOOL,
            arguments=arguments,
            read_timeout_seconds=timedelta(seconds=60),
        )
        text = result_text(result)
        try:
            parsed = json.loads(text)
        except ValueError:
            parsed = {}
        self.calls.append(
            {
                "query": query,
                "count": parsed.get("count", 0),
                "files": [r.get("fileName") for r in parsed.get("results", [])],
                "filterMethod": (parsed.get("filterLog") or {}).get("filterMethod"),
            }
        )
        return text
