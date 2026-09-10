# PoC Result Report Template

**🌐 Language:** [日本語](../../templates/poc-result-report-template.md) | **English** | [한국어](../../ko/templates/poc-result-report-template.md) | [简体中文](../../zh-CN/templates/poc-result-report-template.md) | [繁體中文](../../zh-TW/templates/poc-result-report-template.md) | [Français](../../fr/templates/poc-result-report-template.md) | [Deutsch](../../de/templates/poc-result-report-template.md) | [Español](../../es/templates/poc-result-report-template.md)

**Purpose**: a format for a partner or SI to report PoC results to a customer.

---

## 1. Executive Summary

| Item | Content |
|------|---------|
| Customer | _____ |
| Period | YYYY/MM/DD — YYYY/MM/DD |
| Target business process | _____ |
| Documents in scope | _____ |
| Users in scope | _____ |
| Overall assessment | ☐ Recommend production / ☐ Further validation needed / ☐ Not proceeding |

---

## 2. Quantitative Results

### 2.1 RAG quality metrics

| Metric | Target | Measured | Verdict |
|--------|--------|----------|---------|
| Faithfulness | ≥ 0.85 | _____ | ☐ Pass / ☐ Fail |
| Answer relevancy | ≥ 0.80 | _____ | ☐ Pass / ☐ Fail |
| Context precision | ≥ 0.75 | _____ | ☐ Pass / ☐ Fail |
| Permission violations | 0 | _____ | ☐ Pass / ☐ Fail |

### 2.2 Performance metrics

| Metric | Target | Measured | Verdict |
|--------|--------|----------|---------|
| Response time (P50) | ≤ 3s | _____ s | ☐ Pass / ☐ Fail |
| Response time (P95) | ≤ 8s | _____ s | ☐ Pass / ☐ Fail |
| Prompt cache hit rate | ≥ 50% | _____ % | ☐ Pass / ☐ Fail |

### 2.3 Business outcome metrics

| Metric | Before PoC | After PoC | Improvement |
|--------|-----------|-----------|-------------|
| Search time (per request) | _____ min | _____ s | _____ % |
| First-response resolution rate | _____ % | _____ % | _____ pt |
| Access to out-of-permission information | _____ cases | 0 cases | 100% |

---

## 3. Permission Control Verification

| Test scenario | Result | Notes |
|---------------|--------|-------|
| Administrator → access to all documents | ☐ Pass / ☐ Fail | |
| Regular user → public documents only | ☐ Pass / ☐ Fail | |
| Group permission → own department's documents only | ☐ Pass / ☐ Fail | |
| Permission change → reflected | ☐ Pass / ☐ Fail | Maximum delay: _____ min |
| Document without permission → excluded from results | ☐ Pass / ☐ Fail | |

---

## 4. Cost Actuals

| Item | Estimated monthly | Notes |
|------|-------------------|-------|
| FSx for ONTAP | $_____ | |
| Bedrock (inference) | $_____ | after Smart Routing |
| Bedrock (embedding) | $_____ | initial + incremental |
| Vector store | $_____ | S3 Vectors / OpenSearch |
| Other (Lambda, DynamoDB, CloudFront) | $_____ | |
| **Total** | **$_____** | |

---

## 5. Issues Found and Recommendations

| # | Issue | Impact | Recommended action | Timing |
|---|-------|--------|--------------------|--------|
| 1 | | ☐ High / ☐ Medium / ☐ Low | | |
| 2 | | ☐ High / ☐ Medium / ☐ Low | | |
| 3 | | ☐ High / ☐ Medium / ☐ Low | | |

---

## 6. Next Steps Toward Production

| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | Security assessment (least-privilege IAM, encryption) | | |
| 2 | Load test (twice the expected user count) | | |
| 3 | DR design (Multi-AZ, backup) | | |
| 4 | Operations design (runbook, alerting) | | |
| 5 | Go/No-Go decision meeting | | |

---

## 7. Attachments

- [ ] CloudWatch dashboard screenshots
- [ ] RAGAS evaluation results (JSON)
- [ ] Permission matrix test results
- [ ] Cost breakdown (AWS Cost Explorer)
- [ ] User survey results (if conducted)
