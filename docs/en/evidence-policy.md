# Evidence Policy

**🌐 Language:** [日本語](../evidence-policy.md) | **English**

---

## Conclusion

Every **claim about how a product or service behaves** in this repository carries one of four evidence tiers. Readers — human and AI — should use the tier to decide how far to trust a statement before applying it to their own environment.

The vocabulary is shared with the [FSx for ONTAP Adoption Playbook](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook), so that **a reader moving between the two repositories reads the same word with the same meaning.**

| Tier | Meaning | Required detail |
|------|---------|-----------------|
| `verified` | Actually reproduced in the stated environment | Date and environment (e.g. `verified 2026-07-19 / ap-northeast-1`). **For a claim about the development environment, use `local`** (e.g. `verified 2026-09-10 / local`) and state the OS and runtime versions in the body |
| `documented` | Stated in AWS / NetApp official documentation, or in the records of another project that measured it | Source URL or document name |
| `field-observation` | Observed once, reproduction not confirmed | An explicit "reproduction not confirmed" |
| `hypothesis` | Reasoned but unverified | An explicit "unverified" |

---

## Mapping to the Playbook's tiers

The four words are the same, but **because this repository holds an implementation, `verified` points at something different.**

| | Playbook | This repository |
|---|---|---|
| What `verified` covers | ONTAP / FSx behaviour reproduced in a test environment | AWS API response shapes, deployment outcomes, and implementation behaviour confirmed in a real environment or in the code |
| Unit of a claim | One file = one point (tier lives in frontmatter) | **A single file carries many claims, so the tier is an inline label on each claim** |
| Numbers | All measurement conditions stated | Same, plus an explicit split between "sample run" and "production estimate" |

**When the Playbook cites a measurement from this repository, it is `documented` on their side.** `verified` asserts that the author of that repository reproduced it in that environment, which a citation does not satisfy.

---

## How to write it

Use an inline label immediately before or after the claim.

```markdown
**[verified 2026-07-19 / ap-northeast-1]** AgentCore Gateway is available in ap-northeast-1;
the Gateway → Lambda → S3 AP call path worked.

**[documented]** Requests through an S3 Access Point are authorized as the single file system
identity configured on it. Source: https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/...

**[field-observation]** The S3 AP Lifecycle went to FAILED. AD DC reachability is the suspected
cause, but **reproduction not confirmed**.

**[hypothesis]** The `createConfigurationBundle` parameter shape was inferred from the SDK type
definitions. **Unverified**.
```

`scripts/check-evidence.py` checks that:

- `verified` carries a date (`YYYY-MM-DD`) and a Region, and the date is not in the future
- `documented` carries a URL or document name (same line or within the next two lines)
- `field-observation` has "reproduction not confirmed" nearby
- `hypothesis` has "unverified" nearby
- No other spellings remain (for example the older `VERIFIED` / `UNVERIFIED` markers)

A line that discusses the legacy markers themselves (like this policy) carries a trailing `<!-- allow:legacy-marker -->`. **Only a per-line opt-out is accepted, so the escape hatch cannot widen quietly.**

**The legacy-marker scan covers `AGENTS.md` plus `docs/` and `benchmarks/`, and prints the number of files it looked at.** A detector can be silent because of its scope as much as its pattern, so the scope is reported with the result. `CHANGELOG.md` is out of scope: its entries record the state at each release.

---

## What the tiers do not answer

**"I looked and could not find it in public documentation" is not a tier.** It is a statement about the state of the documentation, not about the product's behaviour. In particular, do not use `hypothesis` for it: `hypothesis` means a line of reasoning exists, so using it without one makes it look like there is a basis where there is none.

Write it in the body with the date and the scope of the search: "as of 2026-07 we could not find this in the AWS documentation" — so the reader knows when and where you looked.

**Budget or time constraints do not set the tier either. The origin of the claim does.**

---

## Conditions for publishing numbers

A `verified` number carries its measurement conditions. A number without conditions cannot be reproduced, and a number that cannot be reproduced cannot support a decision.

| State | Example |
|-------|---------|
| Date | `2026-07-19` |
| Region | `ap-northeast-1` |
| Configuration | model ID, vector store, chunking strategy, feature-flag combination |
| Method | tool, concurrency, document count, number of runs |

Then keep these distinctions. Collapsing them makes readers design on a false premise.

| Distinction | What happens when it collapses |
|-------------|-------------------------------|
| Sample run / production estimate | A one-off measurement becomes the basis for capacity or cost planning |
| This test environment / general service limit | An environment-specific value is quoted as a service specification |
| Code exists / it is deployed | The presence of code is read as "it runs" |
| AI assistive signal / final decision | An automated result is treated as settled without human review |

**The third row actually happened here.** `lambda/permissions/fsx-permission-service.ts` contains code that reads ACLs, but no CDK stack deploys it. It was described as "implemented", which read as though the mechanism was running.

---

## Before taking anything to production

A tier says how far a statement can be trusted; it does not guarantee that it holds in your environment.

| Tier | Do this first |
|------|---------------|
| `verified` | List the differences from the stated environment (Region, model ID, flag combination, ONTAP version) and re-confirm if any differ |
| `documented` | Open the source and check that the current revision still says the same thing |
| `field-observation` | Check whether it reproduces in your environment. If it does not, you cannot rely on it |
| `hypothesis` | Verify before use. Do not base a design on an unverified inference |

**Irreversible operations cannot skip verification in a test environment.** Data deletion, retention settings, and changes to existing volumes fall in this class.

---

## Promotion and demotion

| Transition | Work required |
|------------|---------------|
| → `verified` | Add date and Region, and write the reproduction steps in the body |
| → `documented` | Add the source URL. Keep verbatim quotes under 30 words; summarize by default |
| `verified` → `field-observation` | Record why it stopped reproducing. Keep the value as history rather than deleting it |
| → `hypothesis` | State why the basis was lost |

**Demotion is not a quality regression.** Showing that the evidence was lost is safer for the reader than leaving a stale `verified` in place.

---

## Related documents

| Document | Content |
|----------|---------|
| [Permission Metadata Consistency Model](permission-consistency.md) | How permission data propagates, and what it never reaches |
| [Threat Model](threat-model.md) | Threats and mitigations; read the mitigation preconditions together with the tiers |
| [AGENTS.md](../../AGENTS.md) | Conventions and verification procedures for AI agents |
