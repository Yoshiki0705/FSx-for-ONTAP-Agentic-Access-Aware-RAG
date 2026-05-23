"""
Shared fixtures for RAG evaluation tests.

These tests require a deployed Bedrock Knowledge Base.
Mark with @pytest.mark.rag_evaluation for CI filtering.
"""

import pytest


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "rag_evaluation: marks tests that require a deployed KB (deselect with '-m \"not rag_evaluation\"')"
    )
