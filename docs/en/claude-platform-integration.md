# Claude Platform on AWS Integration Guide

**🌐 Language:** [日本語](../claude-platform-integration.md) | **English**

**Created**: 2026-06-08  
**Status**: Implementation complete, not yet activated  
**Audience**: Developers, Operations staff

---

## Overview

Claude Platform on AWS is Anthropic's native platform on AWS, providing Web Search, Citations, MCP Connector, and Managed Agents.

This system uses **Claude Platform Web Search as a fallback when KB search results are insufficient**, generating reference answers from public web information.

---

## Architecture

```
User Query
  │
  ▼
KB Retrieve API (Permission-Aware RAG)
  │
  ├── Results found (score ≥ threshold) → Bedrock Messages/Converse API → Answer
  │
  └── No results or insufficient → Invocation Router decision
       │
       ├── CLAUDE_PLATFORM_MODE=disabled → "No information available" answer
       │
       └── CLAUDE_PLATFORM_MODE=web-search-only/full
            │
            ▼
       Web Search Sanitizer (PII removal)
            │
            ▼
       Claude Platform Messages API (Web Search tool)
            │
            ▼
       Answer + Citations (boundary: 'reference')
```

### Permission Boundary Separation

| Source | Boundary | UI Display | Meaning |
|--------|----------|-----------|---------|
| KB search results | `verified` | 🔒 | Permission-verified internal documents |
| Web Search results | `reference` | 🌐 | Public web info (no permission verification) |

---

## Configuration

### Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `CLAUDE_PLATFORM_MODE` | `disabled` (default) / `web-search-only` / `full` | Feature scope |
| `CLAUDE_PLATFORM_API_KEY` | Secrets Manager ARN or direct key | Claude Platform API key |
| `ENABLE_WEB_SEARCH` | `true` / `false` | Enable web search fallback |
| `WEB_SEARCH_FALLBACK_THRESHOLD` | `0.5` (default) | KB score below this triggers web search |

### Activation Steps

```bash
# Step 1: Get Claude Platform API Key from Anthropic Console

# Step 2: Store in Secrets Manager
aws secretsmanager create-secret \
  --name "claude-platform-api-key" \
  --secret-string "<YOUR_API_KEY>" \
  --region ap-northeast-1

# Step 3: Set CDK context or Lambda env vars
# Step 4: Deploy
```

---

## Operation Modes

| Mode | Behavior | Cost |
|------|----------|------|
| `disabled` (default) | No Claude Platform usage. Returns "no info" for missing KB data | None |
| `web-search-only` | Web Search fallback when KB insufficient. Results marked as `reference` | Per-query API cost |
| `full` (future) | Web Search + MCP + Extended Citations | Per-query API cost |

---

## Security

- **PII Sanitization**: Email, phone, names removed before web search
- **API Key**: Stored in Secrets Manager with 5-min TTL cache
- **Timeout**: 10-second timeout, graceful fallback on failure
- **Boundary separation**: Web results clearly labeled as `reference` (not `verified`)

---

## Related Documents

- [2026 Q2 AI Update Roadmap](../design/2026q2-ai-update-roadmap.md) — Phase 3
- [Prompt Caching Investigation](../prompt-caching-investigation.md)
- [Operations Runbook](../operations-runbook.md)
