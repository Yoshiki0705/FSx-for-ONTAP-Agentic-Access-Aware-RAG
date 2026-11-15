"""
Model selection for the voice agent, by the same rules as the WebApp's model catalog
(docker/nextjs/src/lib/model-catalog/select.ts).

The voice agent runs on the AgentCore Runtime and cannot import the TypeScript module,
so the rules are repeated here in their smallest form: the newest ACTIVE model of a
family, called through the profile with the fewest destination Regions (or a global
one when MODEL_PROFILE_PREFERENCE=global). tests/test_model_catalog.py runs this on
the WebApp's recorded Tokyo fixture and expects the same picks as select.test.ts, so
the two cannot drift apart unnoticed.
"""

from __future__ import annotations

import fnmatch
import math
from typing import Any, Iterable

DEFAULT_FAMILIES = {
    "light": "anthropic.claude-*haiku*",
    "standard": "anthropic.claude-*sonnet*",
    "voice": "amazon.nova-*sonic*",
}


def _regions(model_arns: Iterable[str]) -> float:
    regions = [arn.split(":")[3] if arn.count(":") >= 3 else "" for arn in model_arns]
    if any(r == "" for r in regions):
        return math.inf  # a region-less ARN: global
    return float(len(set(regions)))


def invoke_ids(models: list[dict[str, Any]], profiles: list[dict[str, Any]], region: str,
               preference: str = "nearest") -> dict[str, str]:
    """Base model ID -> the ID to call in `region`."""
    by_base: dict[str, list[tuple[float, str]]] = {}
    for p in profiles:
        if p.get("status", "ACTIVE") != "ACTIVE" or not p.get("modelArns"):
            continue
        base = p["modelArns"][0].split("foundation-model/")[-1]
        by_base.setdefault(base, []).append((_regions(p["modelArns"]), p["inferenceProfileId"]))
    out: dict[str, str] = {}
    for m in models:
        candidates = list(by_base.get(m["modelId"], []))
        if "ON_DEMAND" in (m.get("inferenceTypesSupported") or []):
            candidates.append((1.0, m["modelId"]))
        if not candidates:
            continue
        candidates.sort(key=lambda c: (c[0], c[1]))
        chosen = candidates[0]
        if preference == "global":
            chosen = next((c for c in candidates if c[0] == math.inf), chosen)
        out[m["modelId"]] = chosen[1]
    return out


def newest_of_family(models: list[dict[str, Any]], pattern: str, *, speech: bool = False) -> str | None:
    """Base ID of the newest ACTIVE model matching `pattern` (startOfLifeTime)."""
    def usable(m: dict[str, Any]) -> bool:
        if m.get("lifecycleStatus", "ACTIVE") != "ACTIVE" or not fnmatch.fnmatchcase(m["modelId"], pattern):
            return False
        outputs = m.get("outputModalities") or []
        return ("SPEECH" in outputs) if speech else ("TEXT" in outputs and "SPEECH" not in outputs)

    found = sorted((m for m in models if usable(m)), key=lambda m: (m.get("startOfLifeTime") or "", m["modelId"]))
    return found[-1]["modelId"] if found else None


def resolve(tier: str, region: str, *, families: dict[str, str] | None = None,
            preference: str = "nearest", client: Any = None) -> str | None:
    """The ID to call for `tier`, read from Bedrock with `client` (boto3 `bedrock`)."""
    families = {**DEFAULT_FAMILIES, **(families or {})}
    if client is None:
        import boto3  # only on the Runtime; tests pass recorded data instead

        client = boto3.client("bedrock", region_name=region)
    summaries = client.list_foundation_models(byOutputModality="TEXT").get("modelSummaries", [])
    models = [
        {
            "modelId": s["modelId"],
            "outputModalities": s.get("outputModalities"),
            "inferenceTypesSupported": s.get("inferenceTypesSupported"),
            "lifecycleStatus": (s.get("modelLifecycle") or {}).get("status"),
            "startOfLifeTime": str((s.get("modelLifecycle") or {}).get("startOfLifeTime") or ""),
        }
        for s in summaries
    ]
    profiles: list[dict[str, Any]] = []
    token = None
    while True:
        kwargs = {"typeEquals": "SYSTEM_DEFINED", "maxResults": 1000, **({"nextToken": token} if token else {})}
        page = client.list_inference_profiles(**kwargs)
        profiles += [
            {"inferenceProfileId": p["inferenceProfileId"], "status": p.get("status"),
             "modelArns": [x["modelArn"] for x in p.get("models", [])]}
            for p in page.get("inferenceProfileSummaries", [])
        ]
        token = page.get("nextToken")
        if not token:
            break
    base = newest_of_family(models, families[tier], speech=(tier == "voice"))
    return invoke_ids(models, profiles, region, preference).get(base) if base else None
