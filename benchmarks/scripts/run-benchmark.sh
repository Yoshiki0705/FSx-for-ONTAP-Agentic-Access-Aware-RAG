#!/bin/bash
set -euo pipefail

# =============================================================================
# Permission-Aware RAG Benchmark Runner
# =============================================================================
#
# Usage:
#   bash run-benchmark.sh \
#     --kb-id <KNOWLEDGE_BASE_ID> \
#     --user-access-table <DYNAMODB_TABLE_NAME> \
#     --scale 10k \
#     --queries 100 \
#     --output results/10k-results.json
#
# Prerequisites:
#   - AWS CLI v2 configured
#   - jq installed
#   - Python 3.12+ with boto3
#   - Deployed Permission-Aware RAG environment
#   - Test data uploaded and KB synced
# =============================================================================

# --- Argument Parsing ---

KB_ID=""
USER_ACCESS_TABLE=""
SCALE="10k"
NUM_QUERIES=100
CONCURRENT=5
OUTPUT="results/benchmark-results.json"
REGION="${AWS_REGION:-ap-northeast-1}"
MODEL_ID="anthropic.claude-3-5-haiku-20241022-v1:0"

while [[ $# -gt 0 ]]; do
  case $1 in
    --kb-id) KB_ID="$2"; shift 2 ;;
    --user-access-table) USER_ACCESS_TABLE="$2"; shift 2 ;;
    --scale) SCALE="$2"; shift 2 ;;
    --queries) NUM_QUERIES="$2"; shift 2 ;;
    --concurrent) CONCURRENT="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --model-id) MODEL_ID="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$KB_ID" || -z "$USER_ACCESS_TABLE" ]]; then
  echo "Error: --kb-id and --user-access-table are required"
  exit 1
fi

echo "============================================="
echo " Permission-Aware RAG Benchmark"
echo "============================================="
echo " Scale: $SCALE"
echo " Queries: $NUM_QUERIES"
echo " Concurrent: $CONCURRENT"
echo " KB ID: $KB_ID"
echo " Region: $REGION"
echo " Model: $MODEL_ID"
echo " Output: $OUTPUT"
echo "============================================="

# --- Setup ---

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$(dirname "$OUTPUT")"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# --- Test Queries ---

QUERIES=(
  "会社の売上について教えてください"
  "製品カタログの内容を要約してください"
  "人事ポリシーについて教えてください"
  "プロジェクト計画の概要は？"
  "セキュリティガイドラインを教えてください"
  "最新の研究レポートの要点は？"
  "契約書のテンプレートはありますか？"
  "マーケティング戦略について教えてください"
  "技術仕様書の内容を教えてください"
  "会議議事録の要約をお願いします"
)

# --- Test Users (different permission levels) ---

declare -A TEST_USERS
TEST_USERS[admin]="admin@example.com"
TEST_USERS[engineer]="engineer@example.com"
TEST_USERS[general]="user@example.com"

# --- Benchmark Functions ---

measure_retrieve_api() {
  local query="$1"
  local start_ms=$(python3 -c "import time; print(int(time.time() * 1000))")

  local result
  result=$(aws bedrock-agent-runtime retrieve \
    --knowledge-base-id "$KB_ID" \
    --retrieval-query "{\"text\": \"$query\"}" \
    --retrieval-configuration '{"vectorSearchConfiguration": {"numberOfResults": 10}}' \
    --region "$REGION" \
    --output json 2>/dev/null) || true

  local end_ms=$(python3 -c "import time; print(int(time.time() * 1000))")
  local latency=$((end_ms - start_ms))

  local doc_count=0
  if [[ -n "$result" ]]; then
    doc_count=$(echo "$result" | jq '.retrievalResults | length' 2>/dev/null || echo "0")
  fi

  echo "{\"latency_ms\": $latency, \"documents_retrieved\": $doc_count}"
}

measure_sid_filter() {
  local user_id="$1"
  local doc_count="$2"
  local start_ms=$(python3 -c "import time; print(int(time.time() * 1000))")

  # Simulate SID lookup from DynamoDB
  aws dynamodb get-item \
    --table-name "$USER_ACCESS_TABLE" \
    --key "{\"userId\": {\"S\": \"$user_id\"}}" \
    --region "$REGION" \
    --output json > /dev/null 2>&1 || true

  local end_ms=$(python3 -c "import time; print(int(time.time() * 1000))")
  local latency=$((end_ms - start_ms))

  echo "{\"sid_lookup_ms\": $latency, \"documents_to_filter\": $doc_count}"
}

# --- Run Benchmark ---

echo ""
echo "🚀 Starting benchmark..."
echo ""

RESULTS=()
RETRIEVE_LATENCIES=()
TOTAL_START=$(python3 -c "import time; print(int(time.time() * 1000))")

for i in $(seq 1 "$NUM_QUERIES"); do
  query_idx=$((RANDOM % ${#QUERIES[@]}))
  query="${QUERIES[$query_idx]}"

  user_keys=(${!TEST_USERS[@]})
  user_key="${user_keys[$((RANDOM % ${#user_keys[@]}))]}"
  user_id="${TEST_USERS[$user_key]}"

  # Measure Retrieve API
  retrieve_result=$(measure_retrieve_api "$query")
  retrieve_latency=$(echo "$retrieve_result" | jq '.latency_ms')
  doc_count=$(echo "$retrieve_result" | jq '.documents_retrieved')

  # Measure SID filter
  filter_result=$(measure_sid_filter "$user_id" "$doc_count")
  sid_latency=$(echo "$filter_result" | jq '.sid_lookup_ms')

  # Total latency (Retrieve + SID + estimated Converse)
  total_latency=$((retrieve_latency + sid_latency))

  RETRIEVE_LATENCIES+=("$retrieve_latency")

  # Progress
  if [[ $((i % 10)) -eq 0 ]]; then
    echo "  [$i/$NUM_QUERIES] Last retrieve: ${retrieve_latency}ms, SID: ${sid_latency}ms, Docs: $doc_count"
  fi

  # Store result
  echo "{\"query_num\": $i, \"user\": \"$user_key\", \"retrieve_ms\": $retrieve_latency, \"sid_ms\": $sid_latency, \"total_ms\": $total_latency, \"docs_retrieved\": $doc_count}" >> "$TEMP_DIR/raw_results.jsonl"
done

TOTAL_END=$(python3 -c "import time; print(int(time.time() * 1000))")
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

# --- Analyze Results ---

echo ""
echo "📊 Analyzing results..."

python3 << 'PYTHON_SCRIPT'
import json
import sys
from pathlib import Path

results_file = Path("TEMP_DIR_PLACEHOLDER/raw_results.jsonl")
results = []
with open(results_file) as f:
    for line in f:
        if line.strip():
            results.append(json.loads(line))

if not results:
    print("No results to analyze")
    sys.exit(1)

retrieve_latencies = sorted([r["retrieve_ms"] for r in results])
sid_latencies = sorted([r["sid_ms"] for r in results])
total_latencies = sorted([r["total_ms"] for r in results])
docs_retrieved = [r["docs_retrieved"] for r in results]

def percentile(data, p):
    idx = int(len(data) * p / 100)
    return data[min(idx, len(data) - 1)]

summary = {
    "metadata": {
        "timestamp": "TIMESTAMP_PLACEHOLDER",
        "scale": "SCALE_PLACEHOLDER",
        "num_queries": len(results),
        "region": "REGION_PLACEHOLDER",
        "kb_id": "KB_ID_PLACEHOLDER",
    },
    "retrieve_api": {
        "p50_ms": percentile(retrieve_latencies, 50),
        "p95_ms": percentile(retrieve_latencies, 95),
        "p99_ms": percentile(retrieve_latencies, 99),
        "avg_ms": sum(retrieve_latencies) // len(retrieve_latencies),
        "min_ms": min(retrieve_latencies),
        "max_ms": max(retrieve_latencies),
    },
    "sid_filter": {
        "p50_ms": percentile(sid_latencies, 50),
        "p95_ms": percentile(sid_latencies, 95),
        "avg_ms": sum(sid_latencies) // len(sid_latencies),
    },
    "end_to_end": {
        "p50_ms": percentile(total_latencies, 50),
        "p95_ms": percentile(total_latencies, 95),
        "p99_ms": percentile(total_latencies, 99),
        "avg_ms": sum(total_latencies) // len(total_latencies),
    },
    "documents": {
        "avg_retrieved": sum(docs_retrieved) // len(docs_retrieved),
        "max_retrieved": max(docs_retrieved),
    },
    "throughput": {
        "total_duration_ms": TOTAL_DURATION_PLACEHOLDER,
        "queries_per_minute": len(results) * 60000 // TOTAL_DURATION_PLACEHOLDER if TOTAL_DURATION_PLACEHOLDER > 0 else 0,
    },
}

output_path = Path("OUTPUT_PLACEHOLDER")
with open(output_path, "w") as f:
    json.dump(summary, f, indent=2)

print(f"\n{'='*50}")
print(f" Benchmark Results Summary")
print(f"{'='*50}")
print(f" Scale: {summary['metadata']['scale']}")
print(f" Queries: {summary['metadata']['num_queries']}")
print(f"")
print(f" Retrieve API Latency:")
print(f"   P50: {summary['retrieve_api']['p50_ms']}ms")
print(f"   P95: {summary['retrieve_api']['p95_ms']}ms")
print(f"   P99: {summary['retrieve_api']['p99_ms']}ms")
print(f"")
print(f" SID Filter Latency:")
print(f"   P50: {summary['sid_filter']['p50_ms']}ms")
print(f"   P95: {summary['sid_filter']['p95_ms']}ms")
print(f"")
print(f" End-to-End (Retrieve + SID):")
print(f"   P50: {summary['end_to_end']['p50_ms']}ms")
print(f"   P95: {summary['end_to_end']['p95_ms']}ms")
print(f"   P99: {summary['end_to_end']['p99_ms']}ms")
print(f"")
print(f" Throughput: {summary['throughput']['queries_per_minute']} queries/min")
print(f" Avg docs retrieved: {summary['documents']['avg_retrieved']}")
print(f"{'='*50}")
print(f"\n Results saved to: {output_path}")
PYTHON_SCRIPT

echo ""
echo "✅ Benchmark complete!"
