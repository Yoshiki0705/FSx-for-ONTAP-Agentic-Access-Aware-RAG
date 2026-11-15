"""model_catalog.py against the WebApp's recorded Tokyo response.

The expected picks are the ones docker/nextjs/src/__tests__/model-catalog/select.test.ts
asserts for the TypeScript rules, so a change to either side that makes them disagree
fails here.
"""
import json
import pathlib

from model_catalog import invoke_ids, newest_of_family, resolve

FIXTURE = pathlib.Path(__file__).resolve().parents[2] / "nextjs/src/__tests__/model-catalog/tokyo-2026-11-15.json"
DATA = json.loads(FIXTURE.read_text())


class Recorded:
    """Stands in for boto3's bedrock client, serving the fixture."""

    def list_foundation_models(self, **_):
        return {"modelSummaries": [
            {**m, "modelLifecycle": {"status": m["lifecycleStatus"], "startOfLifeTime": m["startOfLifeTime"]}}
            for m in DATA["models"]
        ]}

    def list_inference_profiles(self, **_):
        return {"inferenceProfileSummaries": [
            {"inferenceProfileId": p["inferenceProfileId"], "status": p["status"],
             "models": [{"modelArn": a} for a in p["modelArns"]]}
            for p in DATA["profiles"]
        ]}


def test_tiers_match_the_webapp_rules():
    assert resolve("light", "ap-northeast-1", client=Recorded()) == "jp.anthropic.claude-haiku-5-5"
    # Default preference: Sonnet 5.5 has only a global profile in Tokyo, Sonnet 4.6 has jp.
    assert resolve("standard", "ap-northeast-1", client=Recorded()) == "jp.anthropic.claude-sonnet-4-6"
    assert resolve("voice", "ap-northeast-1", client=Recorded()) == "amazon.nova-2-5-sonic"


def test_global_preference():
    assert resolve("light", "ap-northeast-1", client=Recorded(), preference="global") == "global.anthropic.claude-haiku-5-5"
    # With global preferred, tiers go by newness only (same as the TypeScript rules)
    assert resolve("standard", "ap-northeast-1", client=Recorded(), preference="global") == "global.anthropic.claude-sonnet-5-5"


def test_legacy_models_are_not_picked():
    assert newest_of_family(DATA["models"], "anthropic.claude-sonnet-4-5*") is None


def test_every_id_is_one_the_region_lists():
    listed = {m["modelId"] for m in DATA["models"]} | {p["inferenceProfileId"] for p in DATA["profiles"]}
    for preference in ("nearest", "global"):
        ids = invoke_ids(DATA["models"], DATA["profiles"], "ap-northeast-1", preference)
        assert {v[0] for v in ids.values()} <= listed
