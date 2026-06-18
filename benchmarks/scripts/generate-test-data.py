#!/usr/bin/env python3
"""
Permission-Aware RAG Benchmark — Test Data Generator

Generates synthetic documents with .metadata.json files for benchmarking
at 10K, 100K, and 1M file scales.

Usage:
    python3 generate-test-data.py --scale 10k --output /tmp/bench-data
    python3 generate-test-data.py --scale 100k --output /tmp/bench-data
    python3 generate-test-data.py --scale 1m --output /tmp/bench-data
"""

import argparse
import json
import os
import random
import string
import sys
from pathlib import Path


# --- Configuration ---

SCALES = {
    "10k": 10_000,
    "100k": 100_000,
    "1m": 1_000_000,
}

# SID definitions for permission diversity
SIDS = {
    "everyone": "S-1-1-0",
    "domain_admins": "S-1-5-21-0000000000-0000000000-0000000000-512",
    "engineering": "S-1-5-21-0000000000-0000000000-0000000000-1100",
    "finance": "S-1-5-21-0000000000-0000000000-0000000000-1200",
    "hr": "S-1-5-21-0000000000-0000000000-0000000000-1300",
    "legal": "S-1-5-21-0000000000-0000000000-0000000000-1400",
    "marketing": "S-1-5-21-0000000000-0000000000-0000000000-1500",
    "sales": "S-1-5-21-0000000000-0000000000-0000000000-1600",
    "research": "S-1-5-21-0000000000-0000000000-0000000000-1700",
    "operations": "S-1-5-21-0000000000-0000000000-0000000000-1800",
}

# Permission distribution (realistic enterprise pattern)
PERMISSION_PATTERNS = [
    {"weight": 30, "sids": ["everyone"]},  # 30% public
    {"weight": 15, "sids": ["domain_admins"]},  # 15% admin only
    {"weight": 12, "sids": ["engineering", "domain_admins"]},  # 12% engineering
    {"weight": 10, "sids": ["finance", "domain_admins"]},  # 10% finance
    {"weight": 8, "sids": ["hr", "domain_admins"]},  # 8% HR
    {"weight": 7, "sids": ["legal", "domain_admins"]},  # 7% legal
    {"weight": 6, "sids": ["marketing", "everyone"]},  # 6% marketing (public)
    {"weight": 5, "sids": ["sales", "domain_admins"]},  # 5% sales
    {"weight": 4, "sids": ["research", "engineering"]},  # 4% research
    {"weight": 3, "sids": ["operations", "domain_admins"]},  # 3% operations
]

# Document categories
CATEGORIES = [
    "reports", "policies", "procedures", "guides",
    "specifications", "meeting-notes", "proposals",
    "contracts", "presentations", "research-papers",
]

# Average document sizes (characters)
DOC_SIZES = {
    "small": (500, 2000),
    "medium": (2000, 8000),
    "large": (8000, 20000),
}

DOC_SIZE_DISTRIBUTION = [
    ("small", 40),
    ("medium", 45),
    ("large", 15),
]


def generate_document_content(size_category: str) -> str:
    """Generate realistic-looking document content."""
    min_chars, max_chars = DOC_SIZES[size_category]
    target_length = random.randint(min_chars, max_chars)

    paragraphs = []
    current_length = 0

    while current_length < target_length:
        # Generate a paragraph of 3-8 sentences
        sentences = random.randint(3, 8)
        paragraph_parts = []
        for _ in range(sentences):
            word_count = random.randint(8, 25)
            words = [
                "".join(random.choices(string.ascii_lowercase, k=random.randint(3, 10)))
                for _ in range(word_count)
            ]
            sentence = " ".join(words).capitalize() + "."
            paragraph_parts.append(sentence)

        paragraph = " ".join(paragraph_parts)
        paragraphs.append(paragraph)
        current_length += len(paragraph)

    return "\n\n".join(paragraphs)[:target_length]


def select_permission_pattern() -> list[str]:
    """Select a permission pattern based on weighted distribution."""
    total_weight = sum(p["weight"] for p in PERMISSION_PATTERNS)
    r = random.randint(1, total_weight)
    cumulative = 0
    for pattern in PERMISSION_PATTERNS:
        cumulative += pattern["weight"]
        if r <= cumulative:
            return [SIDS[sid_name] for sid_name in pattern["sids"]]
    return [SIDS["everyone"]]


def select_doc_size() -> str:
    """Select document size based on distribution."""
    total = sum(w for _, w in DOC_SIZE_DISTRIBUTION)
    r = random.randint(1, total)
    cumulative = 0
    for size, weight in DOC_SIZE_DISTRIBUTION:
        cumulative += weight
        if r <= cumulative:
            return size
    return "medium"


def generate_test_data(scale: int, output_dir: Path) -> None:
    """Generate test documents with metadata."""
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {scale:,} documents in {output_dir}...")

    for i in range(scale):
        if i % 1000 == 0 and i > 0:
            print(f"  Progress: {i:,} / {scale:,} ({i * 100 // scale}%)")

        # Determine category and path
        category = random.choice(CATEGORIES)
        doc_dir = output_dir / category
        doc_dir.mkdir(parents=True, exist_ok=True)

        # Generate document
        size_category = select_doc_size()
        content = generate_document_content(size_category)
        doc_name = f"doc-{i:07d}.md"
        doc_path = doc_dir / doc_name

        # Write document
        with open(doc_path, "w") as f:
            f.write(f"# Document {i:07d}\n\n")
            f.write(f"Category: {category}\n")
            f.write(f"Size: {size_category}\n\n")
            f.write(content)

        # Generate metadata
        allowed_sids = select_permission_pattern()
        access_level = (
            "public" if SIDS["everyone"] in allowed_sids
            else "confidential" if SIDS["domain_admins"] in allowed_sids and len(allowed_sids) == 1
            else "restricted"
        )

        metadata = {
            "metadataAttributes": {
                "allowed_group_sids": allowed_sids,
                "access_level": access_level,
                "doc_type": category,
            }
        }

        metadata_path = doc_dir / f"{doc_name}.metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

    print(f"✅ Generated {scale:,} documents with metadata in {output_dir}")

    # Print statistics
    print("\nStatistics:")
    total_size = sum(
        f.stat().st_size for f in output_dir.rglob("*.md") if f.is_file()
    )
    print(f"  Total document size: {total_size / 1024 / 1024:.1f} MB")
    print(f"  Average document size: {total_size / scale / 1024:.1f} KB")
    print(f"  Categories: {len(CATEGORIES)}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate test data for Permission-Aware RAG benchmarks"
    )
    parser.add_argument(
        "--scale",
        choices=list(SCALES.keys()),
        required=True,
        help="Scale of test data to generate",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output directory for generated data",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )

    args = parser.parse_args()
    random.seed(args.seed)

    scale = SCALES[args.scale]
    generate_test_data(scale, args.output)


if __name__ == "__main__":
    main()
