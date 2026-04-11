# Verification Scenario Guide

## Overview

Verification procedures for the Permission-aware RAG system. SID-based permission filtering ensures different search results for different users asking the same question.

---

## Scenario 4: OIDC + LDAP Federation Verification

> **Prerequisites**: CDK deployed with `oidcProviderConfig` + `ldapConfig`. OpenLDAP server running in VPC.

### 4-1. OpenLDAP Setup

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. LDAP Test Users

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Verification Points

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Verification Scripts

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. OpenLDAP Setup Considerations

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

See [Authentication Mode Setup Guide](en/auth-mode-setup-guide.md) for full setup instructions.


---

## 5. Multi-Agent Collaboration Demo

### Prerequisites

Deploy with `enableMultiAgent: true` in `cdk.context.json`.

### 5-1. Enable Multi-Agent Mode

1. Click the **[Multi Agent]** toggle in the chat header
2. Select the Supervisor Agent (`perm-rag-demo-demo-supervisor`) from the **[Agent Select]** dropdown in the header
3. A new multi-agent session is automatically created

### 5-2. Permission-Filtered Multi-Agent Search

**Sign in as admin:**

```
Question: Give me a summary of the financial report
```

- Permission Resolver → SID resolution → Retrieval Agent → KB search (filtered) → Analysis Agent → Response
- Check the Agent Trace UI for timeline and cost breakdown

**Sign in as user:**

Send the same question and verify different results due to permission filtering.

### 5-3. Single Agent vs Multi-Agent Comparison

1. Send a question in **Single mode** → note response time and cost
2. Switch to **Multi mode** → send the same question → compare
3. Check per-collaborator execution time and token usage in Agent Trace UI

### 5-4. Deployment Notes

Multi-agent deployment has the following technical constraints:

- **CloudFormation `AgentCollaboration` valid values**: `DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` only. `COLLABORATOR` is NOT valid
- **2-stage deploy**: Create Supervisor Agent with `DISABLED` first, then use Custom Resource Lambda to: `UpdateAgent` → `SUPERVISOR_ROUTER`, `AssociateAgentCollaborator`, `PrepareAgent`
- **IAM permissions**: Supervisor role needs `bedrock:GetAgentAlias` + `bedrock:InvokeAgent` on `agent-alias/*/*`. Custom Resource Lambda needs `iam:PassRole`
- **Collaborator Aliases**: Each Collaborator Agent requires a `CfnAgentAlias` before Supervisor can reference it
- **autoPrepare=true not allowed**: Cannot be used on Supervisor Agent (fails without collaborators)

### 5-5. Operational Findings

- **Team list fetch**: The Multi mode toggle on the chat page fetches the team list via API on mount and checks `teams.length > 0`. Multi mode is disabled when no teams exist (by design)
- **Direct Supervisor selection**: Selecting the Supervisor Agent from the dropdown and invoking it in Single Agent mode still triggers multi-agent collaboration on the Bedrock side (Supervisor → Collaborator execution flow works)
- **Permission filtering**: Supervisor Agent responses include permission-filtered citations (admin users can see confidential documents, regular users see public only)
- **Docker image update**: After code changes, 3 steps are required: `docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation` (CDK doesn't detect `latest` tag changes)
- **Multi mode integration**: Multi mode toggle → `/api/bedrock/agent-team/invoke` call → response with `multiAgentTrace` → conditional rendering of MultiAgentTraceTimeline + CostSummary verified working
- **Collaborator traces**: `buildCollaboratorTraces` extracts collaborator execution info from Bedrock Agent InvokeAgent API trace events, but Supervisor's internal collaborator calls may not always appear in traces (Bedrock-side limitation). Responses are returned normally regardless
- **Supervisor instruction improvement**: Explicitly instructing the Supervisor Agent to "always call Collaborators" stabilizes collaborator invocation. Alias updates automatically create new versions (`update-agent-alias` → auto-creates new version)
- **Collaborator trace estimation**: In Bedrock Agent `SUPERVISOR_ROUTER` mode, collaborator invocation traces may not appear as `collaboratorInvocationInput/Output`. `buildCollaboratorTraces` implements a fallback strategy that constructs estimated traces from rationale + modelInvocationOutput
- **routingClassifierTrace**: In `SUPERVISOR_ROUTER` mode, collaborator invocation traces appear in `routingClassifierTrace` (not `orchestrationTrace`) as `agentCollaboratorInvocationInput/Output`. `buildCollaboratorTraces` searches both trace formats
- **filteredSearch Lambda SID auto-resolve**: In the Supervisor → RetrievalAgent → filteredSearch Lambda chain, `sessionAttributes` propagate to Collaborators. The filteredSearch Lambda resolves SID info from DynamoDB User Access Table via `sessionAttributes.userId` as a fallback. Permission filtering works even without explicit SID parameters
- **KB metadata quote issue**: Bedrock KB `allowed_group_sids` metadata may contain extra double quotes like `['"S-1-1-0"']`. The `cleanSID` function strips these for correct SID matching
- **Retrieval Agent instruction**: Explicitly stating "always call filteredSearch" and "do not decide SID is required on your own" ensures reliable Action Group Lambda invocation
- **Agent instruction i18n**: CDK `agentLanguage` property (default: `'auto'`) enables English-based instructions with automatic response language matching to user input. Fixed language can be set via `"agentLanguage": "Japanese"` in `cdk.context.json`
- **E2E verification success**: Admin user in Multi mode → "Tell me about the product catalog" → FSx for ONTAP `product-catalog.md` content returned with permission filtering. RetrievalAgent detail panel (8.1s execution), CostSummary ($0.049, 11.6K input tokens) displayed correctly
