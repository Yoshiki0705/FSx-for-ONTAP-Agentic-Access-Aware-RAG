# AGENTS.md

> Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP — v4.2.0
> Permission-aware RAG + Agentic AI system with 22 integrated capabilities

## Build & Test Commands

```bash
# TypeScript compilation check (run first — catches type errors before synth)
npx tsc --noEmit

# CDK synthesis (feature flag variants — test all combinations)
npx cdk synth --quiet
npx cdk synth --quiet -c enableTransferFamily=true
npx cdk synth --quiet -c enableKbAutoSync=true
npx cdk synth --quiet -c enableVoiceChat=true -c voiceChatMode=webrtc
npx cdk synth --quiet -c enableGuardrails=true -c enableAgentCoreGateway=true -c enableWebSearch=true
npx cdk synth --quiet -c enableAgent=true -c enableAgentCoreGateway=true -c enableAgentOptimization=true
npx cdk synth --quiet -c kbSearchType=HYBRID
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC

# CDK tests (Jest + fast-check property tests)
npx jest --no-coverage
npx jest tests/transfer-family-stack.test.ts --no-coverage
npx jest tests/kb-auto-sync-construct.test.ts --no-coverage
npx jest tests/ai-stack-chunking.test.ts --no-coverage
npx jest tests/voice-chat-webrtc-cdk.property.test.ts --no-coverage
npx jest tests/guardrails-config.property.test.ts --no-coverage

# Python Lambda tests (each directory is independent)
cd automation/transfer-family && python3 -m pytest tests/ -v
cd automation/fsxn-ops && python3 -m pytest tests/ -v
cd lambda/kb-auto-sync && python3 -m pytest tests/ -v

# Frontend tests (Vitest for property tests, Jest for unit tests)
cd docker/nextjs && npx jest --no-coverage
cd docker/nextjs && npx vitest run

# RAG evaluation (requires deployed KB — manual trigger only)
cd tests/rag-evaluation && python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1

# E2E Transfer Family test
bash demo-data/scripts/test-transfer-family-e2e.sh --stack-prefix perm-rag-demo --region ap-northeast-1
```

## Project Structure

```
├── bin/demo-app.ts                    — CDK app entry point
├── lib/
│   ├── stacks/demo/                   — CDK stacks (8 stacks)
│   │   ├── demo-waf-stack.ts          — WAF (us-east-1)
│   │   ├── demo-networking-stack.ts   — VPC, subnets, endpoints
│   │   ├── demo-security-stack.ts     — Cognito, OIDC/SAML/LDAP federation
│   │   ├── demo-storage-stack.ts      — FSx ONTAP, S3, DynamoDB
│   │   ├── demo-ai-stack.ts           — Bedrock KB, S3 Vectors, Guardrails, KbAutoSync
│   │   ├── demo-webapp-stack.ts       — Lambda (Next.js), CloudFront, Monitoring
│   │   ├── demo-embedding-stack.ts    — EC2 embedding server (optional)
│   │   └── demo-transfer-family-stack.ts — SFTP ingestion pipeline
│   └── constructs/                    — Reusable CDK constructs (8 constructs)
├── automation/
│   ├── transfer-family/lambda/        — Transfer Family Lambda (Python 3.12)
│   └── fsxn-ops/lambda/               — FSx ONTAP operations + Capacity Guardrails (Python 3.12)
├── lambda/kb-auto-sync/               — KB Auto-Sync Lambda (Python 3.12)
├── docker/
│   ├── nextjs/                        — Next.js 15 frontend (Lambda Web Adapter)
│   └── pipecat-agent/                 — Pipecat Voice Agent (AgentCore Runtime)
├── tests/                             — CDK assertion + property tests (Jest + fast-check)
│   ├── rag-evaluation/                — RAGAS evaluation pipeline
│   └── permission-matrix/             — 31 permission test scenarios
├── demo-data/
│   ├── scripts/                       — Deployment scripts
│   ├── industry-packs/                — 7 industry demo data packs
│   └── guides/                        — Demo scenario guides
└── docs/                              — 50+ design/operation documents (8 languages)
```

## Coding Conventions

### TypeScript (CDK)
- Use `aws-cdk-lib` v2 constructs only (currently v2.244.0)
- Stack props interfaces must extend `cdk.StackProps`
- Feature flags via `cdk.context.json` — never hardcode boolean toggles
- Prefix all resource names with `${projectName}-${environment}`
- Export stack outputs for cross-stack references
- Use `cdk.RemovalPolicy.DESTROY` for demo resources
- Validate CDK context parameters at synth time (throw Error for invalid values)

### Python (Lambda)
- Python 3.12 runtime
- Structured JSON logging via `logging` module
- CloudWatch EMF metrics via custom `emit_metrics()` helper
- Separate pure logic from handler (testability) — e.g., `diff.py`, `trigger.py`, `inventory.py`
- Use `boto3` with adaptive retry: `Config(retries={"max_attempts": 3, "mode": "adaptive"})`
- Property-based tests with Hypothesis; unit tests with pytest + moto
- DynamoDB operations use `batch_writer()` for bulk writes

### Frontend (Next.js 15)
- App Router (`src/app/[locale]/`)
- Zustand for state management (`src/store/`)
- `next-intl` for i18n (8 languages: ja, en, ko, zh-CN, zh-TW, fr, de, es)
- Components in `src/components/`, hooks in `src/hooks/`, types in `src/types/`
- Strategy pattern for voice chat (`src/hooks/strategies/`)
- Smart Routing: `src/lib/complexity-classifier.ts` + `src/lib/smart-router.ts`
- KB query routing: `src/lib/kb-query-router.ts` (Hybrid Search, Dual KB)
- Dynamic imports for WebRTC modules (bundle optimization)
- Vitest + fast-check for property tests (`src/__tests__/`)

## Critical Constraints

- **Never hardcode AWS account IDs** — use `cdk.Aws.ACCOUNT_ID` or CDK context parameters
- **ECR image format**: Always use `docker buildx build --provenance=false --sbom=false --push` (Docker V2 manifest required for Lambda)
- **CDK imageTag**: Never use `latest` — always use explicit tags in `cdk.context.json`
- **Transfer Family HomeDirectoryMappings**: Target uses S3 AP **alias** (not ARN). Format: `/{alias}/path`
- **IAM s3:prefix condition**: No leading slash
- **Guard Hook**: Deactivate `FSxNS3AP::Guard::Hook` before `cdk deploy` if active
- **Permission metadata**: `.metadata.json` files are generated by service role only — SFTP users have IAM Deny for `*.metadata.json`
- **Fail-closed RAG**: Documents without trusted metadata are excluded from retrieval
- **AgentCore Runtime**: CloudFormation not supported — deploy via CLI/SDK manually
- **AgentCore Web Search (REVISED)**: The `enableWebSearch` flag no longer creates a Gateway target in ap-northeast-1. Web Search Tool is us-east-1 only (UNVERIFIED — project-context). The flag now emits a CDK synth-time warning directing to Step 4 (us-east-1 Gateway creation). Current Web Search functionality uses mechanism A (Claude Platform `callWithWebSearch` via `ENABLE_WEB_SEARCH` env var) which is region-agnostic and works from ap-northeast-1.
- **Policy+Guardrails Cedar (CORRECTED)**: The Policy Engine ships a baseline `permit(principal, action, resource)` for LOG_ONLY observation (verified Cedar syntax). The earlier `context.guardrails.evaluation` policy was fabricated and removed — that field does not exist; a non-matching permit + Cedar default-deny would deny ALL tool calls in ENFORCE. Author least-privilege per-tool Cedar policies (`AgentCore::Action::"Target___tool"`) and attach Guardrails via documented `policyConfiguration` before ENFORCE
- **AgentCore Optimization (Preview, UNVERIFIED)**: `createConfigurationBundle` params via `AwsCustomResource` are unconfirmed — opt-in only (`enableAgentOptimization=false` default). CDK provisions Config Bundle + IAM role; Recommendations/A/B tests run via agentcore CLI/SDK
- **Chunk Safety Filter**: Fail-Open (content-safety layer, NOT the permission boundary). The SID filter (Fail-Closed) remains the authorization boundary. ApplyGuardrail uses `source=INPUT` so PROMPT_ATTACK fires on retrieved chunks
- **Bedrock KB Chunking**: Changing `kbChunkingStrategy` requires DataSource re-sync (re-ingestion)
- **DynamoDB Streams**: Adding Streams to existing table may trigger replacement — always run `cdk diff` first
- **S3 Vectors**: Default vector store (low cost). OpenSearch Serverless available via `vectorStoreType` context
- **Smart Routing GPT-5.5**: Never auto-routed — manual selection only with availability verification

## Feature Flags (cdk.context.json)

| Flag | Default | Description |
|------|---------|-------------|
| `enableTransferFamily` | `false` | Transfer Family SFTP ingestion pipeline |
| `enableKbAutoSync` | `false` | EventBridge Scheduler KB synchronization (polling-based) |
| `enableAgent` | `false` | Bedrock Agent (single mode) |
| `enableMultiAgent` | follows `enableAgent` | Multi-agent collaboration (Supervisor + Collaborators) |
| `enableVoiceChat` | `false` | Voice chat (Phase 1: REST, Phase 2: WebRTC) |
| `voiceChatMode` | `"rest"` | Voice chat mode (`"rest"` \| `"webrtc"`) |
| `enableMonitoring` | `false` | CloudWatch alarms + dashboard + SNS alerts |
| `enableGuardrails` | `false` | Bedrock Guardrails (content filter, topic policy, PII, Automated Reasoning) |
| `enableAgentCoreMemory` | `false` | AgentCore Memory (short-term + long-term) |
| `enableEpisodicMemory` | `false` | Episodic Memory (requires AgentCoreMemory) |
| `enableAgentPolicy` | `false` | AgentCore Policy (agent behavior control) |
| `enableAgentCoreGateway` | `false` | AgentCore Gateway + Permission Interceptor (auto-enabled with enableAgentPolicy) |
| `enableWebSearch` | `false` | Web Search toggle: emits synth warning (Gateway target removed — us-east-1 constraint); controls `ENABLE_WEB_SEARCH` env var for Claude Platform mechanism A |
| `policyEngineMode` | `"LOG_ONLY"` | Policy Engine enforcement (`"LOG_ONLY"` \| `"ENFORCE"`) |
| `enableAgentOptimization` | `false` | AgentCore Optimization — Configuration Bundles + Recommendations + A/B Testing (Preview, requires enableAgentCoreGateway) |
| `enableGraphRAG` | `false` | Graph RAG with Neptune Analytics (document relationship graph) |
| `enableAgentRegistry` | `false` | Agent Registry integration |
| `enableAdvancedPermissions` | `false` | Time-based access control + audit logging |
| `enableAdFederation` | `false` | AD SAML federation for Cognito |
| `kbSearchType` | `"SEMANTIC"` | KB search type (`"SEMANTIC"` \| `"HYBRID"`) |
| `kbChunkingStrategy` | `"FIXED_SIZE"` | Chunking strategy (`FIXED_SIZE` \| `HIERARCHICAL` \| `SEMANTIC` \| `NONE`) |
| `vectorStoreType` | `"s3-vectors"` | Vector store (`"s3-vectors"` \| `"opensearch-serverless"`) |

### Runtime Environment Variables (Chunk Safety / Web Search)

Set automatically by the stack when `enableGuardrails=true`; tunable via CDK context or Lambda env:

| Env var | Default | Description |
|---------|---------|-------------|
| `ENABLE_CHUNK_SAFETY_FILTER` | `true` when `guardrailId` set | Per-chunk inline safety check before LLM |
| `CHUNK_SAFETY_THRESHOLD` | `0.7` | Safety score below which a chunk is dropped (CDK context `chunkSafetyThreshold`) |
| `CHUNK_SAFETY_TIMEOUT_MS` | `3000` | Overall timeout for chunk checks (CDK context `chunkSafetyTimeoutMs`) |
| `CHUNK_SAFETY_CONCURRENCY` | `3` | Max concurrent ApplyGuardrail calls (throttle guard) |
| `WEB_SEARCH_TARGET_ENDPOINT` | (unused) | Reserved for Step 4: us-east-1 Gateway Web Search target endpoint (not currently deployed) |

## Architecture Patterns

### Permission-Aware RAG (Core)
```
User Query → Cognito JWT → DynamoDB (user-access: SID/UID/GID)
  → Bedrock KB Retrieve → Permission Filter (SID matching) → Converse API → Response
```

### KB Auto-Sync (2-Phase Inventory Model)
```
EventBridge Scheduler → Lambda (scan)
  → S3 AP ListObjectsV2 → DynamoDB diff (committed only)
  → StartIngestionJob → mark_inventory_pending
  → [async] GetIngestionJob → commit_inventory / mark_inventory_failed
```

### Capacity Guardrails (3-Mode)
```
capacity_monitor Lambda → evaluate_expansion(ENFORCE | DRY_RUN | BREAK_GLASS)
  → Per-action rate limit → Daily cumulative cap → Cooldown period
  → record_expansion (DynamoDB atomic update) → CloudWatch metrics
```

### Smart Routing (3-Tier)
```
Query → classifyQuery(contextSize) → simple | complex | full-context
  → simple → Haiku | complex → Sonnet | full-context → Claude Opus
  → GPT-5.5 (manual only, availability-verified)
```

### Gateway Guardrails + Web Search (Summit NY 2026)
```
Agent Request → AgentCore Gateway
  → Policy Engine (Cedar + Guardrails evaluation)
    → PASS: route to target tool
    → BLOCKED: deny with audit trace
  → Permission Interceptor Lambda (SID/UID/GID check)
  → Target Tool execution (KB search, Web Search, MCP servers)
  → Response (citations + source URLs)

Web Search flow:
  Agent query → Gateway → Web Search connector target
    → Relevant snippets + source URLs + publication dates
    → Model reasoning → Grounded response with citations
```

### AgentCore Optimization Loop (Summit NY 2026, Preview)
```
Production traces (CloudWatch) → StartRecommendation (target evaluator)
  → AI-generated prompt/tool description improvement
  → Configuration Bundle new version (immutable, versioned)
  → A/B Test via Gateway (control vs treatment, sticky session routing)
    → Online evaluation scoring → statistical significance (p < 0.05)
  → Promote winning variant → 100% traffic → next iteration

Prerequisites: enableAgentCoreGateway + CloudWatch Transaction Search
Operated via: agentcore CLI / boto3 (CDK provisions Config Bundle + IAM role)
```

### Voice Chat (Strategy Pattern)
```
useVoiceSession → createStrategy(mode)
  → REST: POST /api/voice/stream → Nova Sonic → Response
  → WebRTC: KVS Signaling → AgentCore Runtime → Pipecat Agent → RAG Tool
  → Fallback: WebRTC timeout (15s) → auto-switch to REST
```

## Testing Requirements

- All CDK changes must pass `npx tsc --noEmit` and `npx jest --no-coverage`
- All Python Lambda changes must pass `python3 -m pytest tests/ -v` in the relevant directory
- Property-based tests: Hypothesis (Python), fast-check (TypeScript/Vitest)
- Do not break existing tests when adding features
- Permission matrix: 31 scenarios in `tests/permission-matrix/` (ACL edge cases, Fail-Closed, group nesting)
- CDK synth must succeed with both `enableTransferFamily=true` and `false`
- Frontend: existing `.next/types/` errors are known (Next.js 15 async params) — not blocking

## Deployment

```bash
# Pre-deploy (ECR image build — handles Apple Silicon cross-compilation)
bash demo-data/scripts/pre-deploy-setup.sh

# Deploy all stacks (~30-40 min)
npx cdk deploy --all --require-approval never

# Post-deploy (Cognito users, KB data source, demo data)
bash demo-data/scripts/post-deploy-setup.sh

# Frontend-only update (faster iteration)
bash development/scripts/deploy-webapp.sh
```

### Deployment Order (Stack Dependencies)
```
WafStack (us-east-1) → NetworkingStack → SecurityStack → StorageStack
  → AIStack → WebAppStack → EmbeddingStack (optional) → TransferFamilyStack (optional)
```

## Supply-Chain Security

### Automated Security Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| zizmor | `.github/workflows/zizmor.yml` | GitHub Actions security linting (SHA-pinning, credential persistence, injection) |
| gitleaks | `.github/workflows/gitleaks.yml` | Secret detection — custom rules in `.gitleaks.toml` |
| OpenSSF Scorecard | `.github/workflows/scorecard.yml` | Automated security health scoring |

### Local Security Checks

```bash
# Pre-commit hook runs automatically on commit (via .githooks/pre-commit):
#   1. Author email verification
#   2. gitleaks secret scanning (staged files)
#   3. zizmor lint (if workflow files changed)

# Manual verification
gitleaks detect --config .gitleaks.toml --no-git --source .
zizmor .github/workflows/
```

### Actions Pinning Policy

- All third-party Actions MUST be pinned to SHA hashes: `uses: owner/action@<sha> # vX.Y.Z`
- `actions/checkout` must set `persist-credentials: false`
- Verify with `zizmor .github/workflows/` before committing workflow changes

### Custom Secret Detection (.gitleaks.toml)

Detects: internal IPs (10.x/172.16-31.x/192.168.x), AWS Account IDs, internal hostnames (`.internal.`/`.corp.`), VPN configs, NetApp internal references

## Security Rules

- No secrets in source code — use CDK context, Secrets Manager, or environment variables
- `.gitignore` excludes: `cdk.context.json`, `cdk.out/`, `.env`, `.kiro/`, `development/`, `*.pem`
- Screenshots must mask AWS account IDs before committing
- SFTP user IAM roles are scoped to home directory with `.metadata.json` Deny
- DynamoDB guardrails use `ConditionExpression` for concurrent-request protection
- Capacity Guardrails: fail-safe on DynamoDB read errors (returns Blocked)
- BREAK_GLASS mode: always emits SNS notification + structured audit log
- WebRTC: DTLS-SRTP encryption, KVS resource policy (same-account only)

## Related Repositories

| Repository | Purpose |
|-----------|---------|
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | 17 industry serverless patterns via S3 AP |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Athena/Glue/EMR/SageMaker integration via S3 AP |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | EC2-free audit log delivery to Datadog/Splunk/Grafana |

## Common Pitfalls & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| `cdk deploy` fails with Guard Hook | `FSxNS3AP::Guard::Hook` active | Deactivate hook before deploy |
| ECR image not found | Docker V1 manifest | Use `--provenance=false --sbom=false` |
| KB search returns 0 results | Missing `.metadata.json` | Check service role generated metadata |
| Transfer Family user can't upload | Wrong S3 AP alias format | Use `/{alias}/path` (not ARN) |
| `cdk synth` schema version mismatch | Global CDK CLI outdated | Use `npx cdk` (project-local) |
| DynamoDB table replacement on deploy | Streams added to existing table | Run `cdk diff` first, backup data |
| WebRTC connection timeout | Network/TURN failure | Auto-fallback to REST after 15s |
| Smart Routing returns wrong model | Context size not passed | Ensure `contextSize` parameter is provided |
| Hybrid Search not working | `SEARCH_TYPE` env not set | Set via `kbSearchType` CDK context |
| Policy Engine blocks all requests | `policyEngineMode=ENFORCE` without validated policies | Start with `LOG_ONLY`, verify traces, then switch to `ENFORCE` |
| Web Search target not created | `enableWebSearch=true` without `enableAgentCoreGateway=true` | Gateway target removed (us-east-1 constraint); use mechanism A (Claude Platform) or wait for Step 4 |
| Guardrails not evaluating at Gateway | `enableGuardrails=false` | Policy Engine requires Guardrails; set `enableGuardrails=true` + `enableAgentCoreGateway=true` |
| Optimization resources not synthesized | `enableAgentOptimization=true` without `enableAgentCoreGateway=true` | Optimization requires Gateway; set both. Also run `npx tsc` before synth (stale JS) |
| AgentCore Optimization L1 construct missing | Preview feature not in CloudFormation yet | Construct uses AwsCustomResource (SDK); Recommendations/A/B tests run via agentcore CLI post-deploy |
| Jest tests hang/timeout in CI | CDK property test `numRuns: 100` × VPC stacks | Use `numRuns: 5` for CDK stack property tests |
| Snapshot test fails after unrelated change | CDK asset hash or schema drift | Run `npx jest --updateSnapshot` after reviewing diff |
| Test imports `vitest` in Jest directory | Wrong test runner dependency | Remove vitest import; use Jest globals (`describe/it/expect`) |
| E2E test fails in CI | Real AWS resources required | Prefix with `e2e-`; excluded via `jest.config.js` |
| Property test TS error on private method | Method visibility changed | Use correct public API in test |
| Missing `await` on async in fc.property | Returns Promise instead of value | Use `fc.asyncProperty` + `async` callback |
| New required prop breaks test compile | Props interface extended | Add new prop to ALL test constructor calls |
| Docker cache — source changes not reflected | Docker layer cache reuses old source | Always use `--no-cache` for source changes |
| SID filter returns empty (permission deny all) | KB returns comma-separated SIDs | Fixed in `578435b`; parseDocumentSIDs handles all formats |
| ONTAP version cannot be retrieved via AWS API | `describe-file-systems` lacks version | Use SSM + ONTAP REST API (see operations-runbook.md) |
| Agent `foundationModel` on-demand error | Inference profiles not accepted by Agent API | Use `anthropic.claude-3-haiku-20240307-v1:0` (on-demand available) |
| Agent Alias points to old model version | Manual alias deletion causes CFn state drift | Use `update_agent_alias(routingConfiguration=[])` to auto-create new version |
| Multi-Agent Collaborator uses old model | Collaborator Alias routing pinned to v1 | Clear routing with `routingConfiguration=[]` (auto-creates latest version) |
| CDK deploy fails with deleted Alias | CFn reads attributes of physically deleted aliases | Never manually delete CFn-managed aliases; use CDK for lifecycle |
| Converse API ignores cacheControl | Prompt Caching only works via Messages API | Use InvokeModel for Claude; Converse for non-Claude |
| CDK synth uses old compiled JS | `.js` files not recompiled after `.ts` change | Run `npx tsc` before `cdk synth` when modifying stack code |

## CI/Test Reliability

### Test Architecture

| Directory | Framework | Runner | Scope |
|-----------|-----------|--------|-------|
| `tests/` | Jest + fast-check | `npx jest --no-coverage` | CDK assertion + property tests |
| `docker/nextjs/src/__tests__/` | Vitest + fast-check | `npx vitest run` | Frontend property + unit tests |
| `lambda/permissions/__tests__/` | Jest | `npx jest --no-coverage` | Permission logic unit tests |
| `lambda/permissions/__tests__/e2e-*` | Jest (manual) | Excluded from CI | E2E (requires real AWS) |
| `automation/*/tests/` | pytest + hypothesis | `python3 -m pytest tests/ -v` | Python Lambda unit tests |

### Property Test numRuns Guidelines

| Test Target | Recommended numRuns | Rationale |
|-------------|-------------------|-----------|
| CDK stack synthesis | 5-10 | Each run takes 1-3s due to full synth |
| Lambda handler (with mocks) | 20-50 | Moderate I/O overhead |
| Pure functions / utils | 100 | Millisecond-order execution |
| Type validation / parsing | 100 | Lightweight, needs broad coverage |

### Bedrock Model ID Update Procedure

When updating model IDs (AWS Health notifications, EOL):

1. **Scan**: `grep -r "OLD_ID" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" | grep -v node_modules`
2. **Central config first**: `docker/nextjs/src/config/model-defaults.ts`
3. **Backend**: route.ts fallbacks, converse-client.ts, demo-ai-stack.ts
4. **Frontend**: components (select options, FOUNDATION_MODELS arrays, card-constants)
5. **Compatibility system**: model database entry, patterns, regional availability
6. **Tests**: property test `constantFrom`, discovery route entries
7. **Docs**: all language versions via `find docs/ -name "*.md" -exec ...`
8. **Verify**: `npx tsc --noEmit` → `npx cdk synth --quiet` → `npx jest --no-coverage --forceExit` → `cd docker/nextjs && npx vitest run`

### CI Execution Time Budget

| Stage | Target | Action if exceeded |
|-------|--------|-------------------|
| TypeScript compile | < 30s | Check for unnecessary includes |
| CDK synth | < 60s | Minimize context flags |
| Jest (all tests) | < 120s | Reduce numRuns, isolate E2E |
| Vitest (all tests) | < 30s | Verify parallel execution |
| Total pipeline | < 5min | Review test architecture |
