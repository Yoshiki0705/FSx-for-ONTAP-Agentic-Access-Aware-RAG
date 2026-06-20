# AWS Partner Central MCP Server Usage Guide

**🌐 Language:** [日本語](../partner-central-mcp-integration.md) | **English**

**Created**: 2026-05-26  
**Target Audience**: APN Partner (NetApp, etc.) Sales/SA teams  
**Purpose**: Streamline deal creation and fund application for this project using the Partner Central MCP server

---

## Overview

The [AWS Partner Central Agent MCP Server](https://docs.aws.amazon.com/partner-central/latest/APIReference/partner-central-mcp-server.html) is a service that exposes Partner Central capabilities to AI agents via the MCP protocol. It can automate opportunity management and fund utilization for this project (Permission-aware RAG with FSx for ONTAP).

**Prerequisites**:
- Migrated to the new AWS Partner Central console experience
- IAM policy granting access to Partner Central APIs
- MCP-compatible client (Kiro, Claude Desktop, Amazon Q Developer, etc.)

---

## Usage Scenarios for This Project

### 1. Automated Opportunity Creation

After a PoC meeting with a customer, you can automatically create an opportunity from meeting notes.

**Example prompt**:
```
Please create an opportunity from the following PoC meeting notes:
- Customer: [Customer Name]
- Workload: Permission-aware document search with FSx for ONTAP + Bedrock RAG
- Estimated monthly AWS spend: $3,000-5,000
- Expected close: 3 months
- Next steps: Build demo environment, load PoC data
```

### 2. Fund Eligibility Check and Application

Automatically identify available AWS fund programs for PoC execution of this project.

**Example prompt**:
```
Please tell me the available fund programs for opportunity O1234567890.
I'm specifically looking for:
- PoC/Proof of Concept support
- Migration Acceleration Program (MAP)
- ISV Workload Migration Program
```

**Fund categories relevant to this project**:
| Fund | Applicable Scenario | Notes |
|------|---------------------|-------|
| **POC Fund** | PoC execution in customer environment | Covers deployment costs (FSx for ONTAP + Bedrock) |
| **MAP** | On-premises NAS → FSx for ONTAP migration | For large-scale migration deals |
| **SCA (Strategic Collaboration Agreement)** | Annual commitment deals | NetApp-AWS joint GTM |
| **ISV Accelerate** | ISV solution expansion | When proposing as a NetApp solution |

### 3. Sales Play Generation

Automatically generate industry-specific customized sales strategies.

**Example prompt**:
```
Please generate a sales play for opportunity O1234567890.
Include the following context:
- Customer is in manufacturing; design drawings and technical documents are scattered across departments
- Currently searching shared folders manually (average 15 min/search)
- Permission management is decoupled from the search system, creating data leakage risk
- Solution: Permission-aware AI search with FSx for ONTAP + Bedrock RAG
- Expected outcome: 50%+ reduction in search time, zero permission violations
```

### 4. Pipeline Analysis

Get a bird's-eye view analysis of the FSx for ONTAP RAG-related opportunity pipeline.

**Example prompt**:
```
Please show me the current status of opportunities related to FSx for ONTAP or Bedrock RAG.
- Which deals are expected to close this month?
- Which deals are stalled?
- Which deals need a next action?
```

### 5. Customer Profiling

Automatically gather publicly available customer information before a PoC proposal to streamline preparation.

**Example prompt**:
```
Please create a customer profile for [Customer Name].
Organize the information with the following focus areas:
- Industry and business scale
- IT infrastructure trends (cloud migration status)
- Data management and compliance requirements
- Fit with this solution
```

---

## MCP Server Setup

### Configuration in Kiro

Add the following to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "partner-central": {
      "command": "npx",
      "args": ["-y", "@aws/partner-central-mcp-server"],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_PROFILE": "partner-central"
      }
    }
  }
}
```

> **Note**: The Partner Central MCP server uses SigV4 authentication. The AWS profile must have permissions to access Partner Central APIs.

### Required IAM Permissions

> **Principle of least privilege**: The following is a recommended policy scoped to only the actions needed for opportunity management in this project. Avoid wildcards like `partnercentral-selling:*` in production environments.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PartnerCentralOpportunityManagement",
      "Effect": "Allow",
      "Action": [
        "partnercentral-selling:GetOpportunity",
        "partnercentral-selling:ListOpportunities",
        "partnercentral-selling:CreateOpportunity",
        "partnercentral-selling:UpdateOpportunity",
        "partnercentral-selling:GetEngagementInvitation",
        "partnercentral-selling:ListEngagementInvitations",
        "partnercentral-selling:ListSolutions"
      ],
      "Resource": "*"
    }
  ]
}
```

> **Note**: The Partner Central API does not currently support resource-level ARN constraints, hence `Resource: "*"`. However, actions are scoped to the minimum required. Add additional actions incrementally if needed for fund applications or customer profile creation.

---

## Integration Workflow with This Project

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deal Lifecycle                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Customer Discovery                                           │
│     └─ Partner Central MCP: Create customer profile              │
│                                                                 │
│  2. PoC Proposal                                                 │
│     ├─ Partner Central MCP: Generate sales play                  │
│     └─ This repo: docs/poc-workshop-guide.md                     │
│                                                                 │
│  3. PoC Execution                                                │
│     ├─ Partner Central MCP: Create opportunity + apply for fund  │
│     ├─ This repo: npx cdk deploy --all                           │
│     └─ This repo: demo-data/industry-packs/ (industry data)      │
│                                                                 │
│  4. Evaluation & Decision                                        │
│     ├─ This repo: tests/rag-evaluation/ (RAGAS quality eval)     │
│     ├─ This repo: docs/evaluation.md (KPI framework)             │
│     └─ Partner Central MCP: Update opportunity progress          │
│                                                                 │
│  5. Production & Close                                           │
│     ├─ This repo: docs/production-readiness-checklist.md         │
│     └─ Partner Central MCP: Fund settlement + close              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Industry-Specific Proposal Templates (MCP Prompts)

### Manufacturing

```
Please create an opportunity:
- Customer: [Customer Name] (Manufacturing)
- Workload: Permission-aware AI search for design drawings and technical documents stored on FSx for ONTAP
- Challenge: Searching technical documents scattered across departments takes an average of 15 min/search
- Solution: Permission-aware RAG (automatic NTFS ACL reflection)
- Expected outcome: 60% reduction in design review preparation time
- Estimated monthly spend: $3,000-5,000
- Expected close: [Date]
```

### Financial Services

```
Please create an opportunity:
- Customer: [Customer Name] (Financial Services)
- Workload: Permission-aware AI search for regulatory documents and internal reports
- Challenge: Manual access management creates leakage risk; compliance verification is time-consuming
- Solution: Permission-aware RAG (SID/UID/GID filtering + Fail-Closed)
- Expected outcome: 50% reduction in compliance verification effort
- Estimated monthly spend: $5,000-8,000
- Expected close: [Date]
```

### Public Sector

```
Please create an opportunity:
- Customer: [Customer Name] (Public Sector)
- Workload: Cross-department AI search for policy documents and internal materials
- Challenge: Slow inter-department collaboration; information gathering is time-consuming
- Solution: Permission-aware RAG (permission control by department × position)
- Expected outcome: 70% reduction in information gathering time for policymaking
- Estimated monthly spend: $3,000-5,000
- Expected close: [Date]
- Notes: Guardrails enabled (PII detection + content filter)
```

---

## Reference Links

- [AWS Partner Central MCP Server Documentation](https://docs.aws.amazon.com/partner-central/latest/APIReference/partner-central-mcp-server.html)
- [Getting Started Guide](https://docs.aws.amazon.com/partner-central/latest/APIReference/mcp-getting-started.html)
- [AWS Partner Central Automation Solutions](https://aws.amazon.com/partners/partner-central/automations/)
- [This Project: PoC Workshop Guide](poc-workshop-guide.md)
- [This Project: Cost Estimation Worksheet](cost-estimation-worksheet.md)
- [This Project: Partner Deployment Patterns](partner-deployment-patterns.md)
