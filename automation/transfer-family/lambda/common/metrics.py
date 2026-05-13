"""CloudWatch Embedded Metric Format (EMF) helper for Transfer Family ingestion."""

import json
import sys
import time
from typing import Dict, Any, Optional


def emit_metrics(
    namespace: str,
    metrics: Dict[str, float],
    dimensions: Dict[str, str],
    function_name: Optional[str] = None,
) -> None:
    """
    Emit CloudWatch EMF metrics to stdout.

    Args:
        namespace: CloudWatch metric namespace
        metrics: Dict of metric_name -> value
        dimensions: Dict of dimension_name -> value
        function_name: Lambda function name (added as dimension if provided)
    """
    dims = dict(dimensions)
    if function_name:
        dims['FunctionName'] = function_name

    dimension_keys = list(dims.keys())

    emf_payload: Dict[str, Any] = {
        '_aws': {
            'Timestamp': int(time.time() * 1000),
            'CloudWatchMetrics': [
                {
                    'Namespace': namespace,
                    'Dimensions': [dimension_keys],
                    'Metrics': [
                        {'Name': name, 'Unit': 'Count'}
                        for name in metrics.keys()
                    ],
                }
            ],
        },
    }

    # Add dimensions as top-level keys
    for k, v in dims.items():
        emf_payload[k] = v

    # Add metrics as top-level keys
    for k, v in metrics.items():
        emf_payload[k] = v

    # EMF requires printing to stdout as JSON
    print(json.dumps(emf_payload), flush=True)
