"""Offline tests for the AgentCore Runtime agent. No AWS call is made: credentials are
dummies, the Gateway client is a fake, and agents are built but never invoked."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import boto3
import httpx2
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("AWS_REGION", "ap-northeast-1")

import agents
import app
from gateway_client import SEARCH_TOOL, PermissionSearch, SigV4Auth, result_text


def dummy_session() -> boto3.Session:
    return boto3.Session(
        aws_access_key_id="AKIDEXAMPLE",
        aws_secret_access_key="secret",
        region_name="ap-northeast-1",
    )


class FakeClient:
    def __init__(self, payload: dict | None = None) -> None:
        self.payload = payload or {
            "results": [{"fileName": "a.md"}],
            "count": 1,
            "filterLog": {"filterMethod": "SID_MATCHING"},
        }
        self.calls: list[tuple[str, dict]] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def call_tool_sync(
        self, tool_use_id, name, arguments=None, read_timeout_seconds=None, **_
    ):
        self.calls.append((name, arguments))
        return {
            "status": "success",
            "toolUseId": tool_use_id,
            "content": [{"text": json.dumps(self.payload)}],
        }


class TestSigV4:
    def test_signs_with_the_bedrock_agentcore_service(self):
        auth = SigV4Auth("ap-northeast-1", dummy_session())
        request = httpx2.Request(
            "POST",
            "https://gw.example/mcp",
            content=b'{"x":1}',
            headers={"content-type": "application/json"},
        )
        signed = next(auth.auth_flow(request))
        authorization = signed.headers["authorization"]
        assert authorization.startswith("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/")
        assert "/ap-northeast-1/bedrock-agentcore/aws4_request" in authorization
        assert "x-amz-date" in signed.headers

    def test_without_credentials_it_refuses(self):
        class NoCreds:
            def get_credentials(self):
                return None

        with pytest.raises(RuntimeError):
            next(
                SigV4Auth("ap-northeast-1", NoCreds()).auth_flow(
                    httpx2.Request("POST", "https://gw.example/mcp")
                )
            )


class TestPermissionSearch:
    def test_the_user_comes_from_the_constructor_not_from_the_model(self):
        client = FakeClient()
        search = PermissionSearch(client, "legal-b@example.com")
        search.search("NDA template", 3)
        name, arguments = client.calls[0]
        assert name == SEARCH_TOOL
        assert arguments == {
            "query": "NDA template",
            "maxResults": 3,
            "userId": "legal-b@example.com",
        }
        assert (
            search.calls[0]["files"] == ["a.md"]
            and search.calls[0]["filterMethod"] == "SID_MATCHING"
        )

    def test_the_model_facing_tool_has_no_user_parameter(self):
        search_tool = agents.make_search_tool(lambda q, n: "")
        properties = search_tool.tool_spec["inputSchema"]["json"]["properties"]
        assert set(properties) == {"query", "max_results"}

    def test_result_text_reads_dicts_and_objects(self):
        assert result_text({"content": [{"text": "a"}, {"text": "b"}]}) == "a\nb"
        assert result_text({"content": []}) == ""


class TestValidate:
    @pytest.mark.parametrize(
        "payload,expected",
        [
            ({}, "message is required"),
            ({"message": "q"}, "userId is required"),
            (
                {"message": "q", "userId": "u"},
                "agent definition is required for mode=single",
            ),
            (
                {"message": "q", "userId": "u", "mode": "team"},
                "team definition is required for mode=team",
            ),
            (
                {"message": "q", "userId": "u", "mode": "x", "agent": {}},
                "mode must be single or team",
            ),
            (
                {"message": "x" * 20001, "userId": "u", "agent": {}},
                "message is longer than 20000 characters",
            ),
        ],
    )
    def test_rejects(self, payload, expected):
        assert app.validate(payload) == expected

    def test_accepts_a_single_agent(self):
        assert app.validate({"message": "q", "userId": "u", "agent": {}}) is None


class TestBuild:
    def test_single_agent_has_the_search_tool_and_the_shared_rules(self):
        agent = agents.build_agent(
            {"agentName": "Legal reviewer", "instruction": "Review contracts."},
            lambda q, n: "",
            "ap-northeast-1",
        )
        assert agent.tool_names == ["search_documents"]
        assert (
            agent.system_prompt.startswith("Review contracts.")
            and agents.SHARED_RULES in agent.system_prompt
        )

    def test_an_agent_without_the_search_tool(self):
        agent = agents.build_agent(
            {"agentName": "chat", "tools": []}, lambda q, n: "", "ap-northeast-1"
        )
        assert agent.tool_names == []

    def test_team_supervisor_calls_collaborators_as_tools(self):
        team = {
            "collaborators": [
                {"agentName": "Retrieval Agent", "role": "retrieval"},
                {"agentName": "Analysis Agent", "role": "analysis"},
            ]
        }
        supervisor, names = agents.build_team(team, lambda q, n: "", "ap-northeast-1")
        assert names == ["Retrieval_Agent", "Analysis_Agent"]
        assert sorted(supervisor.tool_names) == sorted(names)

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("営業 Agent", "Agent"),
            ("1st", "a_1st"),
            ("x" * 80, "x" * 64),
            ("---", "agent"),
        ],
    )
    def test_tool_names_are_safe(self, raw, expected):
        assert agents._tool_safe(raw) == expected


class TestRun:
    def test_runs_the_agent_with_the_payload_user(self, monkeypatch):
        client = FakeClient()
        monkeypatch.setattr(app, "GATEWAY_URL", "https://gw.example/mcp")

        def fake_build(definition, search, region):
            class Fake:
                def __call__(self, message):
                    search(message, 2)
                    return "answer"

            return Fake()

        monkeypatch.setattr(app, "build_agent", fake_build)
        out = app.run(
            {"message": "q", "userId": "u1", "agent": {}},
            client_factory=lambda url, region: client,
        )
        assert out["answer"] == "answer"
        assert client.calls[0][1]["userId"] == "u1"
        assert out["searches"][0]["count"] == 1

    def test_an_invalid_payload_returns_the_error_without_calling_the_gateway(self):
        def factory(url, region):
            raise AssertionError("must not be called")

        assert app.run({"message": ""}, client_factory=factory) == {
            "error": "message is required"
        }
