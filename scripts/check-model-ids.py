#!/usr/bin/env python3
"""Fail when a Bedrock model ID is written into application code.

Which models exist, how each is called and which one each tier uses come from the Bedrock
APIs at run time (docker/nextjs/src/lib/model-catalog, docker/pipecat-agent/model_catalog.py).
Tiers are configured as family patterns (`anthropic.claude-*sonnet*`), which this check
does not match. A literal model ID is what goes stale when a model is released or
retired, so a new one must either be removed or be listed in ALLOWED with the reason it
has to be fixed at deploy time.

    python3 scripts/check-model-ids.py --selftest   # the scan finds a planted ID
    python3 scripts/check-model-ids.py
"""
from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SCANNED = ["docker/nextjs/src", "docker/pipecat-agent", "docker/agentcore-agent", "lib", "bin", "lambda"]
SUFFIXES = {".ts", ".tsx", ".js", ".py"}
# Tests carry recorded responses and expectations by design.
SKIPPED_PARTS = {"__tests__", "__tests__.disabled", "tests", "node_modules", ".venv", ".next"}

PROVIDERS = (
    "anthropic|amazon|meta|mistral|cohere|deepseek|openai|qwen|google|ai21|minimax|"
    "moonshot|moonshotai|nvidia|zai|xai|twelvelabs|stability|writer"
)
# A quoted string that is a whole model ID (optionally with a profile prefix). Every model
# ID carries a version digit, so patterns with `*` and bare prefixes such as
# 'anthropic.claude' do not match. The selftest checks the recorded Tokyo list against it.
MODEL_ID = re.compile(
    r"""["'`](?:(?:global|jp|apac|au|us|us-gov|eu|ca|sa)\.)?(?:%s)\.(?=[a-z0-9.-]*[0-9])[a-z0-9][a-z0-9.-]*(?::[0-9]+)?["'`]""" % PROVIDERS
)

# path -> reason. Each is a value that has to exist at deploy time or is out of scope.
ALLOWED = {
    "bin/demo-app.ts": "imageGenerationModelId context default; image generation runs in another Region by design",
    "lib/stacks/demo/demo-webapp-stack.ts": "imageGenerationModelId default for the tools prop (same value as bin)",
    "docker/nextjs/src/lib/genu-tools/image.ts": "image model default when the stack sets none (same value as bin)",
    "lib/stacks/demo/demo-ai-stack.ts": "deploy-time models: Bedrock Agents (Classic) backend, removed next release, and the AgentCore Optimization (Preview) initial bundle",
    "docker/agentcore-agent/agents.py": "last-resort default when a request carries no model; the WebApp always resolves one",
    "docker/nextjs/src/config/embedding-models.ts": "embedding models: fixed at deploy, a change needs re-ingestion (out of scope)",
    "docker/nextjs/src/config/system-info-factory.ts": "embedding model shown on the system info page (out of scope)",
    "docker/nextjs/src/components/bedrock/EmbeddingModelInfo.tsx": "embedding model shown on the system info page (out of scope)",
    "lib/config/embedding-model-registry.ts": "embedding models: fixed at deploy, a change needs re-ingestion (out of scope)",
}

COMMENT = re.compile(r"^\s*(//|\*|/\*|#)")


def scan(root: Path) -> list[str]:
    findings = []
    for base in SCANNED:
        top = root / base
        if not top.exists():
            continue
        for path in sorted(top.rglob("*")):
            if path.suffix not in SUFFIXES or not path.is_file():
                continue
            rel = path.relative_to(root)
            if SKIPPED_PARTS.intersection(rel.parts) or ".test." in path.name or str(rel) in ALLOWED:
                continue
            in_docstring = False
            for n, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                if path.suffix == ".py" and line.count('"""') % 2 == 1:
                    in_docstring = not in_docstring
                    continue
                if in_docstring or COMMENT.match(line):
                    continue
                if MODEL_ID.search(line):
                    findings.append(f"{rel}:{n}: {line.strip()[:140]}")
    return findings


def selftest() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        bad = root / "docker/nextjs/src/lib/x.ts"
        bad.parent.mkdir(parents=True)
        bad.write_text(
            "const a = 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';\n"
            "const ok = 'anthropic.claude-*sonnet*';\n"
            "// 'amazon.nova-pro-v1:0' in a comment is fine\n"
            "if (id.startsWith('anthropic.claude')) {}\n"
        )
        found = scan(root)
        if len(found) != 1 or "x.ts:1:" not in found[0]:
            print(f"selftest FAILED: expected exactly line 1 of x.ts, got {found}")
            return 1
    import json

    fixture = ROOT / "docker/nextjs/src/__tests__/model-catalog/tokyo-2026-11-15.json"
    data = json.loads(fixture.read_text())
    ids = [m["modelId"] for m in data["models"]] + [p["inferenceProfileId"] for p in data["profiles"]]
    missed = [i for i in ids if not MODEL_ID.search(f"'{i}'")]
    if missed:
        print(f"selftest FAILED: the pattern misses recorded model IDs: {missed[:5]}")
        return 1
    stale = [p for p in ALLOWED if not (ROOT / p).exists()]
    if stale:
        print(f"selftest FAILED: allowed paths that no longer exist: {stale}")
        return 1
    print("selftest OK: a planted model ID is found; patterns, prefixes and comments are not")
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    findings = scan(ROOT)
    if findings:
        print("Model IDs written into application code (resolve them through the model catalog,")
        print("or add the file to ALLOWED in scripts/check-model-ids.py with the reason):")
        for f in findings:
            print(f"  {f}")
        return 1
    print(f"model-ids: no model ID literals outside {len(ALLOWED)} allowed files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
