# PoC Workshop Slide Template

**Audience**: Slide structure for a 90-minute workshop delivered by partners to customers

---

## Slide Structure (Recommended: 20 slides)

### Part 1: Problem and Solution (10 min / 5 slides)

| # | Title | Content | Speaker Notes |
|---|-------|---------|---------------|
| 1 | Cover | "Permission-Aware AI Document Search — 90-Minute Hands-On Workshop" | Confirm participants' industries and roles |
| 2 | Today's Challenge | "Can't find the documents you need" "Permission management and search are disconnected" "Partner collaboration is manual" | Ask participants about their pain points |
| 3 | Before / After | Challenges before adoption → Changes after adoption (use the Before/After table from README) | Emphasize quantitative benefits |
| 4 | Architecture Overview | Architecture diagram from README | Emphasize "leverages your existing file server as-is" |
| 5 | Today's Goals | "In 90 minutes: ① Experience permission differences ② Envision the impact with your own data ③ Decide next steps" | — |

### Part 2: Hands-On (60 min / 8 slides)

| # | Title | Content | Speaker Notes |
|---|-------|---------|---------------|
| 6 | Demo Environment Access | CloudFront URL, test user credentials | Confirm everyone can sign in |
| 7 | Scenario 1: Admin Search | Sign in as admin → "What are the sales figures?" → Confidential documents appear | Draw attention to file paths in Citations |
| 8 | Scenario 2: Regular User Search | Sign in as user → Same question → Only public documents appear | Experience "same question, different results" |
| 9 | Scenario 3: Agent Mode | Switch to Agent mode → Multi-step reasoning demo | "Not just search, but analysis too" |
| 10 | Scenario 4: Smart Routing | Compare response speed and cost with ON/OFF | "90% of queries work fine with a low-cost model" |
| 11 | Scenario 5: Industry-Specific Data | Search with demo data matching participants' industry | Use industry-specific demo data packs |
| 12 | Discussion | "What data from your company would you like to try?" "Who should have access?" | Write ideas on the whiteboard |
| 13 | Q&A | Answers to technical questions | Refer to partner-faq.md |

### Part 3: Next Steps (20 min / 7 slides)

| # | Title | Content | Speaker Notes |
|---|-------|---------|---------------|
| 14 | PoC Journey | PoC Journey Map from README | "Today was Step 1. Next is Step 2" |
| 15 | PoC Success Criteria | Overview of poc-success-criteria-template.md | "Agree on Go/No-Go criteria upfront" |
| 16 | Data Readiness | Overview of data-readiness-assessment.md | "Assess the readiness of data to be ingested" |
| 17 | Cost Estimation | PoC configuration from cost-estimation-worksheet.md | "PoC starts at $430/month" |
| 18 | Security | 6-layer defense + Responsible AI Statement | "Technical measures are comprehensive. Legal review is the customer's responsibility" |
| 19 | Proposed Timeline | "2 weeks: Data ingestion → 4 weeks: Evaluation complete → Go/No-Go decision" | Propose specific dates |
| 20 | Summary & Contacts | Next actions, contact information | "We'll send the data readiness assessment within the week" |

---

## Facilitation Guide

### Preparation (By the day before the workshop)

- [ ] Confirm demo environment deployment (CloudFront URL is accessible)
- [ ] Confirm sign-in with test users
- [ ] Select demo data pack matching participants' industry
- [ ] Confirm projector / screen sharing setup
- [ ] Participant list (roles: Business / Technical / Security)

### Day-of Facilitation Tips

| Time | Key Point |
|------|-----------|
| First 5 min | Confirm participant expectations ("What do you want to take away today?") |
| 10 min | Build empathy around the problem ("Does this happen to you?" — ask for a show of hands) |
| 30 min | Confirm everyone is participating in the hands-on (support anyone who is stuck) |
| 60 min | Draw out "our company's data" discussion |
| 80 min | Agree on concrete next steps (dates, owners, deliverables) |

### Preparing for Common Questions

→ Review [Partner FAQ](partner-faq.md) beforehand

### Post-Workshop Follow-Up

1. **Same day**: Thank-you email to participants + share materials
2. **Next business day**: Send data readiness assessment template
3. **1 week later**: Schedule PoC success criteria agreement meeting
4. **2 weeks later**: PoC begins

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PoC Workshop Guide](poc-workshop-guide.md) | Technical hands-on procedures |
| [Partner FAQ](partner-faq.md) | Q&A reference |
| [PoC Success Criteria Template](poc-success-criteria-template.md) | Next-step agreement |
| [Data Readiness Assessment](data-readiness-assessment.md) | Follow-up delivery |
| [Cost Estimation Worksheet](cost-estimation-worksheet.md) | Cost explanation |
| [demo-data/guides/demo-scenario.md](../demo-data/guides/demo-scenario.md) | Detailed demo scenarios |
