"""Shared test fixtures for KB Auto Sync tests."""

import sys
from pathlib import Path

import pytest

# Add the lambda source directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))
