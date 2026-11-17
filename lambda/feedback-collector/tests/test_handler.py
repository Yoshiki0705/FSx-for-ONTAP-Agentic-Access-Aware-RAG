"""
The feedback collector: what it accepts, what it stores, and what it refuses.
DynamoDB is replaced by a recording fake, so nothing here calls AWS.
"""
import json

import pytest

import handler as h


class FakeTable:
    def __init__(self, fail: bool = False):
        self.items: list[dict] = []
        self.fail = fail

    def put_item(self, Item):  # noqa: N803 - boto3's argument name
        if self.fail:
            raise RuntimeError("secret internal detail")
        self.items.append(Item)


@pytest.fixture
def table(monkeypatch):
    t = FakeTable()
    monkeypatch.setenv("FEEDBACK_TABLE", "t")
    monkeypatch.setattr(h.boto3, "resource", lambda *a, **k: type("R", (), {"Table": lambda self, n: t})())
    return t


def event(**over):
    base = {"userId": "u@example.com", "responseId": "resp-1", "rating": "positive"}
    base.update(over)
    return base


def test_saves_a_record_with_a_90_day_ttl_by_default(table, monkeypatch):
    monkeypatch.delenv("TTL_DAYS", raising=False)
    out = h.handler(event(query="how", modelId="jp.anthropic.claude-haiku-5-5", routingTier="simple", sourceDocIds=["a" * 24]), None)
    assert out["statusCode"] == 200
    item = table.items[0]
    assert item["feedbackId"] == out["feedbackId"]
    assert item["rating"] == "positive" and item["sourceDocIds"] == ["a" * 24]
    assert item["ttlEpoch"] - int(__import__("time").time()) == pytest.approx(90 * 86400, abs=5)


def test_ttl_comes_from_the_environment(table, monkeypatch):
    monkeypatch.setenv("TTL_DAYS", "30")
    h.handler(event(), None)
    assert table.items[0]["ttlEpoch"] - int(__import__("time").time()) == pytest.approx(30 * 86400, abs=5)


def test_keeps_only_the_listed_fields_and_cuts_long_text(table):
    h.handler(event(comment="c" * 5000, query="q" * 5000, answer="THE ANSWER BODY", documents=["DOC TEXT"]), None)
    item = table.items[0]
    assert len(item["comment"]) == 1000 and len(item["query"]) == 500
    assert "answer" not in item and "documents" not in item
    assert "THE ANSWER BODY" not in json.dumps(item, default=str)


@pytest.mark.parametrize(
    "over, message",
    [
        ({"rating": "meh"}, "rating"),
        ({"userId": ""}, "userId"),
        ({"userId": "anonymous"}, "userId"),
        ({"responseId": ""}, "responseId"),
        ({"responseId": "../x"}, "responseId"),
        ({"responseId": "x" * 65}, "responseId"),
        ({"modelId": "bad model id"}, "modelId"),
        ({"routingTier": "x" * 200}, "routingTier"),
        ({"sourceDocIds": ["not-a-hash"]}, "sourceDocIds"),
        ({"sourceDocIds": ["a" * 24] * 21}, "sourceDocIds"),
        ({"sourceDocIds": "a" * 24}, "sourceDocIds"),
        ({"comment": 5}, "comment"),
    ],
)
def test_refuses_bad_input_and_writes_nothing(table, over, message):
    out = h.handler(event(**over), None)
    assert out["statusCode"] == 400 and message in out["error"]
    assert table.items == []


def test_duplicate_document_ids_are_stored_once(table):
    h.handler(event(sourceDocIds=["a" * 24, "a" * 24, "b" * 24]), None)
    assert table.items[0]["sourceDocIds"] == ["a" * 24, "b" * 24]


def test_a_save_failure_returns_500_without_the_internal_error(table):
    table.fail = True
    out = h.handler(event(), None)
    assert out == {"statusCode": 500, "error": "failed to save feedback"}


def test_the_log_has_neither_the_user_nor_the_question(table, caplog):
    caplog.set_level("INFO")
    h.handler(event(query="CONFIDENTIAL QUESTION"), None)
    text = " ".join(r.getMessage() for r in caplog.records)
    assert "u@example.com" not in text and "CONFIDENTIAL" not in text


def test_the_operator_script_hashes_document_ids_like_the_web_app():
    """scripts/resolve-feedback-doc-ids.py and docker/nextjs/src/lib/feedback/doc-id.ts must agree.
    The TypeScript test asserts the same fixed value."""
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[3] / "scripts" / "resolve-feedback-doc-ids.py"
    spec = importlib.util.spec_from_file_location("resolve_feedback_doc_ids", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.selftest() == 0
    assert module.doc_id("s3://example-alias/legal/nda.md") == "8e7bb18f7b9542ddd7f6c9a6"
