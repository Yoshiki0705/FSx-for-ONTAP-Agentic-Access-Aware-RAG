#!/bin/bash
# Markitdown Lambda Layer Build Script

set -euo pipefail

echo "🔨 Building Markitdown Lambda Layer..."

# Create layer directory structure
mkdir -p python/lib/python3.11/site-packages

# Install dependencies
pip install -r requirements.txt -t python/lib/python3.11/site-packages/

# Remove unnecessary files to reduce layer size
find python/lib/python3.11/site-packages/ -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find python/lib/python3.11/site-packages/ -type f -name "*.pyc" -delete 2>/dev/null || true
find python/lib/python3.11/site-packages/ -type f -name "*.pyo" -delete 2>/dev/null || true
find python/lib/python3.11/site-packages/ -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find python/lib/python3.11/site-packages/ -type d -name "test" -exec rm -rf {} + 2>/dev/null || true

# Create zip file for deployment
zip -r markitdown-layer.zip python/

echo "✅ Markitdown Lambda Layer built successfully"
echo "📦 Layer size: $(du -sh markitdown-layer.zip | cut -f1)"