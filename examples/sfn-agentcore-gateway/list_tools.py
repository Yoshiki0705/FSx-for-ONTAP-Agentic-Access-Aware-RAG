"""One-shot tools/list of the Step Functions tools Gateway.

Read-only: lists the tools the Gateway exposes and their input schemas. Does not
start any execution.

Usage:
    export GATEWAY_URL=<SfnGatewayUrl from cdk deploy output>
    export AWS_REGION=<the Gateway's region>
    uv run list_tools.py
"""

import asyncio
import json
import os

from mcp import ClientSession
from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client


async def main() -> None:
    async with aws_iam_streamablehttp_client(
        endpoint=os.environ["GATEWAY_URL"],
        aws_region=os.environ.get("AWS_REGION", "ap-northeast-1"),
        aws_service="bedrock-agentcore",
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            for tool in tools.tools:
                print(tool.name)
                print("  ", json.dumps(tool.inputSchema, ensure_ascii=False))
                print("  ", tool.description)
            print(f"\ntotal tools: {len(tools.tools)}")


asyncio.run(main())
