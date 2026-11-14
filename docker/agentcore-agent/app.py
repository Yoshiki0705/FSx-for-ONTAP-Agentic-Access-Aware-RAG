"""AgentCore Runtime entrypoint for the permission-aware RAG agents.

Payload (sent by the web app, `docker/nextjs/src/lib/agent-backend/agentcore.ts`):

    {"mode": "single", "agent": {...definition...}, "message": "...", "userId": "..."}
    {"mode": "team",   "team":  {...team with collaborators...}, "message": "...", "userId": "..."}

Response: {"answer": str, "searches": [...], "collaborators": [...]}.

Only the web app's role may invoke this runtime (`grantInvokeRuntime` in CDK), and the
web app takes `userId` from the signed-in session, so the payload's `userId` is trusted.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from agents import build_agent, build_team
from gateway_client import PermissionSearch, make_mcp_client

REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
GATEWAY_URL = os.environ.get("AGENT_TOOLS_GATEWAY_URL", "")
MAX_MESSAGE_CHARS = 20000

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentcore-agent")
app = BedrockAgentCoreApp()


def validate(payload: dict[str, Any]) -> str | None:
    if not isinstance(payload, dict):
        return "payload must be an object"
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        return "message is required"
    if len(message) > MAX_MESSAGE_CHARS:
        return f"message is longer than {MAX_MESSAGE_CHARS} characters"
    if not isinstance(payload.get("userId"), str) or not payload["userId"].strip():
        return "userId is required"
    mode = payload.get("mode", "single")
    if mode == "single" and not isinstance(payload.get("agent"), dict):
        return "agent definition is required for mode=single"
    if mode == "team" and not isinstance(payload.get("team"), dict):
        return "team definition is required for mode=team"
    if mode not in ("single", "team"):
        return "mode must be single or team"
    return None


def run(payload: dict[str, Any], client_factory=make_mcp_client) -> dict[str, Any]:
    error = validate(payload)
    if error:
        return {"error": error}
    if not GATEWAY_URL:
        return {"error": "AGENT_TOOLS_GATEWAY_URL is not set"}
    client = client_factory(GATEWAY_URL, REGION)
    with client:
        search = PermissionSearch(client, payload["userId"].strip())
        if payload.get("mode", "single") == "team":
            agent, collaborators = build_team(payload["team"], search.search, REGION)
        else:
            agent, collaborators = (
                build_agent(payload["agent"], search.search, REGION),
                [],
            )
        answer = str(agent(payload["message"]))
    logger.info(
        "invocation done: mode=%s searches=%d",
        payload.get("mode", "single"),
        len(search.calls),
    )
    return {"answer": answer, "searches": search.calls, "collaborators": collaborators}


@app.entrypoint
def invoke(payload: dict[str, Any]) -> dict[str, Any]:
    return run(payload)


if __name__ == "__main__":
    app.run()
