"""Gateway MCP client helpers for the Step Functions tools sample.

Connects to the AgentCore Gateway MCP endpoint with IAM (SigV4) auth, filters
the exposed tools to the Step Functions targets, and escapes non-ASCII input
before it reaches the workflow.

The escape hook mirrors the mitigation from the source article: at the time of
writing, non-ASCII characters in the JSON ``input`` passed through the Gateway
could arrive mojibake'd, so the input is re-encoded with ``ensure_ascii=True``
(the json.dumps default) just before the tool call.
"""

import json
import os
import re

from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client
from strands.hooks import BeforeToolCallEvent
from strands.tools.mcp import MCPClient


def gateway_client(pattern: str) -> MCPClient:
    """Return an MCP client exposing only the Gateway tools whose name matches ``pattern``."""
    return MCPClient(
        lambda: aws_iam_streamablehttp_client(
            endpoint=os.environ["GATEWAY_URL"],
            aws_region=os.environ.get("AWS_REGION", "ap-northeast-1"),
            aws_service="bedrock-agentcore",
        ),
        tool_filters={"allowed": [re.compile(pattern)]},
    )


def escape_non_ascii(event: BeforeToolCallEvent) -> None:
    """Re-encode the workflow ``input`` so non-ASCII characters survive the Gateway.

    Only applies to the ``input`` argument (the Step Functions execution input,
    a JSON string). Read-only tools that take no ``input`` are unaffected.
    """
    args = event.tool_use["input"]
    print(f"\n[{event.tool_use['name']}] {json.dumps(args, ensure_ascii=False)}")
    if isinstance(args.get("input"), str):
        # Decode then re-encode with ensure_ascii=True (\uXXXX) before sending.
        args["input"] = json.dumps(json.loads(args["input"]))
