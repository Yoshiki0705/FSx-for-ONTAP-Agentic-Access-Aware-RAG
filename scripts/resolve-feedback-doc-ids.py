#!/usr/bin/env python3
"""Find the documents behind the `sourceDocIds` of feedback records.

A feedback record keeps no file name: each cited document is the first 24 hex characters of
the SHA-256 of its S3 URI (docker/nextjs/src/lib/feedback/doc-id.ts). A reviewer who may read
the bucket lists its objects and asks which of them match.

    aws s3api list-objects-v2 --bucket <alias> --query 'Contents[].Key' --output text \\
      | tr '\\t' '\\n' | python3 scripts/resolve-feedback-doc-ids.py --bucket <alias> <id> [<id> ...]

Each line of standard input is one object key. `--selftest` checks the hash against a fixed
value that the TypeScript test also asserts.
"""
import argparse
import hashlib
import sys

SELFTEST_URI = "s3://example-alias/legal/nda.md"
SELFTEST_ID = "8e7bb18f7b9542ddd7f6c9a6"


def doc_id(uri: str) -> str:
    return hashlib.sha256(uri.encode("utf-8")).hexdigest()[:24]


def resolve(bucket: str, keys: list[str], ids: set[str]) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {i: [] for i in ids}
    for key in keys:
        uri = f"s3://{bucket}/{key}"
        i = doc_id(uri)
        if i in found:
            found[i].append(uri)
    return found


def selftest() -> int:
    assert doc_id(SELFTEST_URI) == SELFTEST_ID, "hash differs from the TypeScript implementation"
    out = resolve("example-alias", ["legal/nda.md", "legal/other.md"], {SELFTEST_ID, "0" * 24})
    assert out[SELFTEST_ID] == [SELFTEST_URI] and out["0" * 24] == []
    print("selftest ok")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="24-character ids from sourceDocIds")
    ap.add_argument("--bucket", help="bucket or access point alias the keys belong to")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if not args.bucket or not args.ids:
        ap.error("--bucket and at least one id are required")
    keys = [line.rstrip("\n") for line in sys.stdin if line.strip()]
    found = resolve(args.bucket, keys, set(args.ids))
    missing = 0
    for i in args.ids:
        hits = found.get(i, [])
        print(f"{i}\t{', '.join(hits) if hits else '(not found among the keys given)'}")
        missing += not hits
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
