#!/bin/bash
set -euo pipefail

# Setup default Feature Gate definitions
# Usage: bash demo-data/scripts/setup-feature-gates.sh [STACK_PREFIX] [REGION]

STACK_PREFIX="${1:-v4-test-demo}"
REGION="${2:-ap-northeast-1}"
TABLE_NAME="${STACK_PREFIX}-feature-gates"

echo "Setting up Feature Gates in table: ${TABLE_NAME}"

# Hybrid Search — enabled for all by default
aws dynamodb put-item --table-name "${TABLE_NAME}" --item '{
  "featureId": {"S": "hybrid-search"},
  "defaultEnabled": {"BOOL": true},
  "enabledGroups": {"L": []},
  "enabledUsers": {"L": []},
  "rolloutPercentage": {"N": "100"},
  "description": {"S": "Semantic + Keyword hybrid search mode"}
}' --region "${REGION}" 2>/dev/null && echo "  ✅ hybrid-search" || echo "  ⚠️ hybrid-search (may already exist)"

# Voice Chat — beta testers only
aws dynamodb put-item --table-name "${TABLE_NAME}" --item '{
  "featureId": {"S": "voice-chat"},
  "defaultEnabled": {"BOOL": false},
  "enabledGroups": {"L": [{"S": "beta-testers"}]},
  "enabledUsers": {"L": [{"S": "admin@example.com"}]},
  "rolloutPercentage": {"N": "0"},
  "description": {"S": "Voice chat (Nova Sonic / WebRTC)"}
}' --region "${REGION}" 2>/dev/null && echo "  ✅ voice-chat" || echo "  ⚠️ voice-chat"

# Multi-Agent — 50% rollout
aws dynamodb put-item --table-name "${TABLE_NAME}" --item '{
  "featureId": {"S": "multi-agent"},
  "defaultEnabled": {"BOOL": false},
  "enabledGroups": {"L": [{"S": "engineering"}, {"S": "product"}]},
  "enabledUsers": {"L": []},
  "rolloutPercentage": {"N": "50"},
  "description": {"S": "Multi-agent collaboration (Supervisor + Collaborators)"}
}' --region "${REGION}" 2>/dev/null && echo "  ✅ multi-agent" || echo "  ⚠️ multi-agent"

# Smart Routing — enabled for all
aws dynamodb put-item --table-name "${TABLE_NAME}" --item '{
  "featureId": {"S": "smart-routing"},
  "defaultEnabled": {"BOOL": true},
  "enabledGroups": {"L": []},
  "enabledUsers": {"L": []},
  "rolloutPercentage": {"N": "100"},
  "description": {"S": "3-tier automatic model routing (Haiku/Sonnet/Opus)"}
}' --region "${REGION}" 2>/dev/null && echo "  ✅ smart-routing" || echo "  ⚠️ smart-routing"

# Feedback UI — gradual rollout 25%
aws dynamodb put-item --table-name "${TABLE_NAME}" --item '{
  "featureId": {"S": "feedback-ui"},
  "defaultEnabled": {"BOOL": false},
  "enabledGroups": {"L": []},
  "enabledUsers": {"L": [{"S": "admin@example.com"}]},
  "rolloutPercentage": {"N": "25"},
  "description": {"S": "Thumbs up/down feedback buttons on chat responses"}
}' --region "${REGION}" 2>/dev/null && echo "  ✅ feedback-ui" || echo "  ⚠️ feedback-ui"

echo ""
echo "Feature Gates setup complete. Verify:"
echo "  aws dynamodb scan --table-name ${TABLE_NAME} --region ${REGION} --query 'Items[*].{Feature:featureId.S,Default:defaultEnabled.BOOL,Rollout:rolloutPercentage.N}' --output table"
