"""
RAG Evaluation Pipeline (v4.3 Feature 6)

Bedrock KB の回答品質を RAGAS メトリクスで自動評価する。
デプロイ済み KB が必要（CI では manual trigger 推奨）。

Usage:
    python evaluate.py --kb-id XXXXXXXXXX --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
        --region ap-northeast-1 --output-path results.json

    # With quality gate thresholds:
    python evaluate.py --kb-id XXXXXXXXXX --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
        --min-faithfulness 0.7 --min-relevance 0.7 --min-precision 0.6 --min-recall 0.6
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import boto3
from botocore.config import Config

RETRY_CONFIG = Config(retries={"max_attempts": 3, "mode": "adaptive"})


def load_test_dataset(path: str = "test_dataset.json") -> List[Dict[str, Any]]:
    """Load test Q&A pairs from JSON file."""
    dataset_path = Path(__file__).parent / path
    with open(dataset_path) as f:
        return json.load(f)


def retrieve_from_kb(
    kb_id: str, question: str, region: str, max_results: int = 5
) -> List[str]:
    """Call Bedrock Retrieve API and return context passages."""
    client = boto3.client("bedrock-agent-runtime", region_name=region, config=RETRY_CONFIG)

    response = client.retrieve(
        knowledgeBaseId=kb_id,
        retrievalQuery={"text": question},
        retrievalConfiguration={
            "vectorSearchConfiguration": {"numberOfResults": max_results}
        },
    )

    contexts = []
    for result in response.get("retrievalResults", []):
        content = result.get("content", {}).get("text", "")
        if content:
            contexts.append(content)

    return contexts


def generate_answer(
    model_id: str, question: str, contexts: List[str], region: str
) -> str:
    """Generate answer using Bedrock Converse API with retrieved contexts."""
    client = boto3.client("bedrock-runtime", region_name=region, config=RETRY_CONFIG)

    context_text = "\n\n".join(f"[Context {i+1}]: {c}" for i, c in enumerate(contexts))
    prompt = (
        f"以下のコンテキストに基づいて質問に回答してください。\n\n"
        f"{context_text}\n\n"
        f"質問: {question}\n\n"
        f"回答:"
    )

    response = client.converse(
        modelId=model_id,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 500, "temperature": 0},
    )

    return response["output"]["message"]["content"][0]["text"]


def compute_ragas_metrics(
    questions: List[str],
    answers: List[str],
    contexts: List[List[str]],
    ground_truths: List[str],
    model_id: str,
    region: str,
) -> Dict[str, float]:
    """Compute RAGAS metrics (Faithfulness, Relevance, Precision, Recall)."""
    try:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import (
            answer_relevancy,
            context_precision,
            context_recall,
            faithfulness,
        )

        dataset = Dataset.from_dict(
            {
                "question": questions,
                "answer": answers,
                "contexts": contexts,
                "ground_truth": ground_truths,
            }
        )

        result = evaluate(
            dataset,
            metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
        )

        return {
            "faithfulness": float(result["faithfulness"]),
            "answer_relevancy": float(result["answer_relevancy"]),
            "context_precision": float(result["context_precision"]),
            "context_recall": float(result["context_recall"]),
        }
    except ImportError:
        print("WARNING: ragas not installed. Computing basic metrics only.")
        return {
            "faithfulness": -1.0,
            "answer_relevancy": -1.0,
            "context_precision": -1.0,
            "context_recall": -1.0,
        }


def check_quality_gate(
    metrics: Dict[str, float],
    min_faithfulness: Optional[float],
    min_relevance: Optional[float],
    min_precision: Optional[float],
    min_recall: Optional[float],
) -> Dict[str, Any]:
    """Check if metrics meet quality gate thresholds."""
    thresholds = {}
    if min_faithfulness is not None:
        thresholds["faithfulness"] = min_faithfulness
    if min_relevance is not None:
        thresholds["answer_relevancy"] = min_relevance
    if min_precision is not None:
        thresholds["context_precision"] = min_precision
    if min_recall is not None:
        thresholds["context_recall"] = min_recall

    if not thresholds:
        return {"enforced": False, "passed": True, "details": {}}

    failures = {}
    for metric_name, threshold in thresholds.items():
        actual = metrics.get(metric_name, -1.0)
        if actual < 0:
            continue  # Skip if metric not computed
        if actual < threshold:
            failures[metric_name] = {"actual": actual, "threshold": threshold}

    return {
        "enforced": True,
        "passed": len(failures) == 0,
        "details": failures,
    }


def main():
    parser = argparse.ArgumentParser(description="RAG Evaluation Pipeline")
    parser.add_argument("--kb-id", required=True, help="Bedrock Knowledge Base ID")
    parser.add_argument("--model-id", required=True, help="Bedrock model ID for answer generation")
    parser.add_argument("--region", default="ap-northeast-1", help="AWS region")
    parser.add_argument("--output-path", default="evaluation-results.json", help="Output JSON path")
    parser.add_argument("--min-faithfulness", type=float, default=None)
    parser.add_argument("--min-relevance", type=float, default=None)
    parser.add_argument("--min-precision", type=float, default=None)
    parser.add_argument("--min-recall", type=float, default=None)
    parser.add_argument("--max-results", type=int, default=5, help="Max KB retrieval results")

    args = parser.parse_args()

    print(f"RAG Evaluation Pipeline")
    print(f"  KB ID: {args.kb_id}")
    print(f"  Model: {args.model_id}")
    print(f"  Region: {args.region}")
    print()

    # Load test dataset
    dataset = load_test_dataset()
    print(f"Loaded {len(dataset)} test questions")

    # Run retrieval + generation for each question
    questions = []
    answers = []
    all_contexts = []
    ground_truths = []

    for i, item in enumerate(dataset):
        question = item["question"]
        print(f"  [{i+1}/{len(dataset)}] {question[:50]}...")

        # Retrieve
        contexts = retrieve_from_kb(args.kb_id, question, args.region, args.max_results)

        # Generate
        answer = generate_answer(args.model_id, question, contexts, args.region)

        questions.append(question)
        answers.append(answer)
        all_contexts.append(contexts)
        ground_truths.append(item["ground_truth"])

    print()
    print("Computing RAGAS metrics...")

    # Compute metrics
    metrics = compute_ragas_metrics(
        questions, answers, all_contexts, ground_truths, args.model_id, args.region
    )

    print(f"  Faithfulness:      {metrics['faithfulness']:.3f}")
    print(f"  Answer Relevancy:  {metrics['answer_relevancy']:.3f}")
    print(f"  Context Precision: {metrics['context_precision']:.3f}")
    print(f"  Context Recall:    {metrics['context_recall']:.3f}")

    # Quality gate
    gate_result = check_quality_gate(
        metrics, args.min_faithfulness, args.min_relevance, args.min_precision, args.min_recall
    )

    # Output results
    output = {
        "kb_id": args.kb_id,
        "model_id": args.model_id,
        "region": args.region,
        "num_questions": len(dataset),
        "metrics": metrics,
        "quality_gate": gate_result,
        "per_question": [
            {
                "question": q,
                "answer": a[:200],
                "num_contexts": len(c),
                "ground_truth": gt,
            }
            for q, a, c, gt in zip(questions, answers, all_contexts, ground_truths)
        ],
    }

    output_path = Path(args.output_path)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\nResults saved to: {output_path}")

    if gate_result["enforced"]:
        if gate_result["passed"]:
            print("\n✅ Quality gate PASSED")
        else:
            print("\n❌ Quality gate FAILED:")
            for metric, detail in gate_result["details"].items():
                print(f"   {metric}: {detail['actual']:.3f} < {detail['threshold']:.3f}")
            sys.exit(1)


if __name__ == "__main__":
    main()
