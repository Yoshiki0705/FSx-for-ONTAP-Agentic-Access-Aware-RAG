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

    def test_filter_details_never_reach_the_model(self):
        # A tool response carrying denied document names must not pass them on.
        client = FakeClient(
            {
                "results": [{"fileName": "allowed.md"}],
                "count": 1,
                "filterLog": {
                    "filterMethod": "SID_MATCHING",
                    "details": [{"fileName": "denied-secret.md", "matched": False}],
                },
            }
        )
        text = PermissionSearch(client, "legal-a@example.com").search("q")
        assert "denied-secret.md" not in text
        assert json.loads(text) == {"results": [{"fileName": "allowed.md"}], "count": 1}

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

        def fake_build(definition, search, region, docs=None):
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
        assert "docsCalls" not in out

    def test_no_documentation_tool_is_wired_without_the_deployment_setting(self, monkeypatch):
        seen = {}
        monkeypatch.setattr(app, "GATEWAY_URL", "https://gw.example/mcp")
        monkeypatch.setattr(app, "AWS_DOCS_TOOL_PREFIX", "")

        def fake_build(definition, search, region, docs=None):
            seen["docs"] = docs
            return lambda message: "answer"

        monkeypatch.setattr(app, "build_agent", fake_build)
        app.run({"message": "q", "userId": "u1", "agent": {}}, client_factory=lambda url, region: FakeClient())
        assert seen["docs"] is None

    def test_documentation_calls_are_reported_without_their_arguments(self, monkeypatch):
        client = DocsClient("abc")
        monkeypatch.setattr(app, "GATEWAY_URL", "https://gw.example/mcp")
        monkeypatch.setattr(app, "AWS_DOCS_TOOL_PREFIX", "aws-docs___")

        def fake_build(definition, search, region, docs=None):
            def agent(message):
                docs.call("search_documentation", {"search_phrase": "SECRET PROJECT NAME"})
                return "answer"

            return agent

        monkeypatch.setattr(app, "build_agent", fake_build)
        out = app.run({"message": "q", "userId": "u1", "agent": {}}, client_factory=lambda url, region: client)
        assert out["docsCalls"] == [{"tool": "search_documentation", "chars": 3}]
        assert "SECRET PROJECT NAME" not in json.dumps(out)

    def test_an_invalid_payload_returns_the_error_without_calling_the_gateway(self):
        def factory(url, region):
            raise AssertionError("must not be called")

        assert app.run({"message": ""}, client_factory=factory) == {
            "error": "message is required"
        }


class DocsClient:
    """A fake Gateway client for the aws-docs tools; it records every call."""

    def __init__(self, text: str = "page text") -> None:
        self.text = text
        self.calls: list[tuple[str, dict]] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def call_tool_sync(self, tool_use_id, name, arguments=None, read_timeout_seconds=None, **_):
        self.calls.append((name, arguments))
        return {"status": "success", "content": [{"text": self.text}]}


class TestAwsDocs:
    PREFIX = "aws-docs___"

    def docs(self, text: str = "page text"):
        from docs_tool import AwsDocs

        client = DocsClient(text)
        return AwsDocs(client, self.PREFIX), client

    def test_calls_the_gateway_target_by_prefixed_name(self):
        docs, client = self.docs()
        docs.call("search_documentation", {"search_phrase": "S3 access points", "limit": 3})
        assert client.calls == [("aws-docs___search_documentation", {"search_phrase": "S3 access points", "limit": 3})]

    @pytest.mark.parametrize("name", ["search_table", "recommend", "get_available_services", "anything_else", ""])
    def test_only_the_three_allowed_tools_can_be_called(self, name):
        docs, client = self.docs()
        assert "not available" in docs.call(name, {})
        assert client.calls == []

    @pytest.mark.parametrize(
        "url",
        [
            "https://example.com/a.html",
            "http://docs.aws.amazon.com/a.html",
            "https://docs.aws.amazon.com.evil.example/a.html",
            "https://evil.example/https://docs.aws.amazon.com/a.html",
            "https://docs.aws.amazon.com@evil.example/a.html",
            "https://169.254.169.254/latest/meta-data/",
            "file:///etc/passwd",
        ],
    )
    def test_a_url_outside_docs_aws_amazon_com_is_refused_before_any_call(self, url):
        docs, client = self.docs()
        assert "docs.aws.amazon.com" in docs.call("read_documentation", {"url": url, "max_length": 100})
        assert client.calls == []

    def test_a_docs_page_url_is_passed_on(self):
        docs, client = self.docs()
        docs.call("read_documentation", {"url": "https://docs.aws.amazon.com/s3/latest/userguide/a.html", "max_length": 100})
        assert len(client.calls) == 1

    def test_search_phrase_and_result_are_capped(self):
        docs, client = self.docs("x" * 50000)
        out = docs.call("search_documentation", {"search_phrase": "q" * 1000, "limit": 5})
        assert len(client.calls[0][1]["search_phrase"]) == 200
        assert len(out) == 20000

    def test_calls_per_question_are_capped(self):
        docs, client = self.docs()
        for _ in range(6):
            docs.call("search_documentation", {"search_phrase": "q"})
        assert "at most 6" in docs.call("search_documentation", {"search_phrase": "q"})
        assert len(client.calls) == 6

    def test_the_call_log_keeps_the_tool_and_size_not_the_arguments(self):
        docs, _ = self.docs("abc")
        docs.call("search_documentation", {"search_phrase": "SECRET PROJECT NAME"})
        assert docs.calls == [{"tool": "search_documentation", "chars": 3}]

    def test_model_facing_tools_have_no_user_or_gateway_parameter(self):
        from docs_tool import make_docs_tools

        tools = make_docs_tools(self.docs()[0])
        names = {t.tool_spec["name"] for t in tools}
        assert names == {"search_aws_documentation", "read_aws_documentation", "read_aws_documentation_sections"}
        for t in tools:
            assert not {"userId", "user_id", "target", "name", "tool"} & set(t.tool_spec["inputSchema"]["json"]["properties"])


class TestDocsToolSelection:
    DEFINITION = {"agentName": "a", "instruction": "i"}

    def tool_names(self, agent) -> set[str]:
        return set(agent.tool_names)

    def test_an_agent_without_the_tool_in_its_definition_never_gets_it(self):
        from docs_tool import AwsDocs

        docs = AwsDocs(DocsClient(), "aws-docs___")
        agent = agents.build_agent({**self.DEFINITION, "tools": ["PermissionAwareSearch"]}, lambda q, n: "", "ap-northeast-1", docs)
        assert self.tool_names(agent) == {"search_documents"}

    def test_an_agent_with_the_tool_gets_it_only_when_the_deployment_has_it(self):
        from docs_tool import AwsDocs

        definition = {**self.DEFINITION, "tools": ["PermissionAwareSearch", "AwsDocumentation"]}
        without = agents.build_agent(definition, lambda q, n: "", "ap-northeast-1")
        assert self.tool_names(without) == {"search_documents"}
        with_docs = agents.build_agent(definition, lambda q, n: "", "ap-northeast-1", AwsDocs(DocsClient(), "aws-docs___"))
        assert self.tool_names(with_docs) == {
            "search_documents", "search_aws_documentation", "read_aws_documentation", "read_aws_documentation_sections",
        }

    def test_a_definition_without_tools_gets_only_the_internal_search(self):
        from docs_tool import AwsDocs

        agent = agents.build_agent(self.DEFINITION, lambda q, n: "", "ap-northeast-1", AwsDocs(DocsClient(), "aws-docs___"))
        assert self.tool_names(agent) == {"search_documents"}
