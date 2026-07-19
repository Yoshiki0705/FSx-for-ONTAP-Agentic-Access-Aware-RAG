# AI Usage Policy — Organization Template

**🌐 Language:** [日本語](../ai-usage-policy-template.md) | **English**

**Created**: 2026-05-24  
**Audience**: Template for defining organization-specific AI usage rules

---

## Purpose

This template defines a code of conduct for using the Permission-aware RAG system within your organization. It clarifies "how far AI responses can be trusted" and "when human judgment is required," promoting safe and effective AI adoption.

---

## 1. Classification of AI Output

| Category | Definition | How to Treat AI Responses |
|----------|-----------|--------------------------|
| **Reference Information** | Supplementary material for decision-making | May be used as-is for reference |
| **Requires Verification** | Accuracy must be validated | Use only after confirming the original source |
| **Prohibited Use** | Situations where AI responses must not be used | A human expert must make the judgment |

---

## 2. Scenario-Based Rules

### ✅ Scenarios Where AI Responses May Be Used Directly

- [ ] Locating internal documents ("Where can I find materials about XX?")
- [ ] Summarizing past meeting minutes or reports
- [ ] General inquiries about internal policies ("What are the travel expense rules?")
- [ ] Checking product specification overviews
- [ ] Answering FAQ-type questions

### ⚠️ Scenarios Requiring Source Verification Before Using AI Responses

- [ ] Interpreting contract clauses
- [ ] Determining compliance with regulatory requirements
- [ ] Citing numerical data (revenue, budgets, KPIs)
- [ ] Transferring content to customer-facing materials
- [ ] Precise technical specification values (dimensions, tolerances, materials)

### ❌ Scenarios Where AI Responses Must Not Be Used for Final Decisions

- [ ] Legal decisions (contract execution, litigation, compliance determinations)
- [ ] Medical decisions (diagnosis, prescriptions, treatment plans)
- [ ] HR decisions (hiring, performance reviews, disciplinary actions)
- [ ] Financial decisions (investment decisions, credit assessments)
- [ ] Safety-related decisions (product safety, workplace safety)
- [ ] Decisions regarding handling of personal information

---

## 3. Roles and Responsibilities

| Role | Responsibility | Assigned To |
|------|---------------|-------------|
| **AI Usage Policy Owner** | Develop, update, and communicate the policy | __________ |
| **Data Owner** | Classify and approve input data | __________ |
| **Audit Manager** | Review AI usage logs | __________ |
| **Incident Responder** | First response to AI-related issues | __________ |

---

## 4. Incident Response

### When a Problematic AI Response Is Identified

1. **Discoverer**: Record the problematic response (screenshot + query text)
2. **Report**: Notify the AI Usage Policy Owner (within 24 hours)
3. **Impact Assessment**: Determine whether the problematic response was used in business decisions
4. **Remediation**: Review business decisions as needed
5. **Prevention**: Adjust Guardrails policies, correct documentation

### Escalation Criteria

| Level | Condition | Response |
|-------|-----------|----------|
| Low | Inaccurate response with no business impact | Record only |
| Medium | Inaccurate response that may have affected business decisions | Report to owner + review decisions |
| High | Display of unauthorized information, PII leakage | Immediate report + consider system shutdown |

---

## 5. Periodic Reviews

| Item | Frequency | Owner |
|------|-----------|-------|
| AI usage log review | Monthly | Audit Manager |
| Policy review | Quarterly | AI Usage Policy Owner |
| User training | Semi-annually | HR + IT |
| Guardrails configuration review | Quarterly | IT |

---

## 6. User Consent

All users of this system are deemed to have agreed to the following:

- [ ] AI responses are reference information; final decisions are my own responsibility
- [ ] I will not use AI responses as the basis for decisions in "Prohibited Use" scenarios
- [ ] I will promptly report any problematic responses I discover
- [ ] I will confirm that Guardrails are active when asking questions that include personal information
- [ ] I will verify original sources before sharing AI responses externally

---

## Customization Guide

Customize this template to fit your organization's characteristics:

- **Manufacturing**: Consider upgrading "precise technical specification values" to "Prohibited Use"
- **Finance**: Consider upgrading "citing numerical data" to "Prohibited Use"
- **Healthcare**: Expand the "Medical decisions" section (department-specific rules)
- **Public Sector**: Add scenario-specific rules for "citizen interactions" and "legislative responses"
- **Legal**: Expand the "Legal decisions" section (case-type-specific rules)

---

## Related Documents

- [Governance & Audit Design](governance-and-audit.md)
- [Safe Experimentation Guide](safe-experimentation-guide.md)
- [Responsible AI Statement](governance-and-audit.md)
