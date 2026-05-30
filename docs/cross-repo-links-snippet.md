# Cross-Repository Link Snippets

以下のスニペットを各リポジトリの README 末尾（License セクションの直前）に追加してください。

---

## For `fsxn-lakehouse-integrations/README.md`

```markdown
---

## Related Repositories / 関連リポジトリ（FSx for ONTAP エコシステム）

| Repository | Use Case / 用途 | Description / 概要 |
|-----------|----------------|-------------------|
| [Agentic Access-Aware RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG) | AI / RAG | Permission-aware RAG + Agentic AI with FSx for ONTAP ACL enforcement |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless Automation | 17 industry-specific serverless patterns via S3 AP (FPolicy event-driven support) |
| **[This repo] fsxn-lakehouse-integrations** | Analytics / Lakehouse | Validation framework for analytics engines via FSx for ONTAP S3 AP |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability / Audit | EC2-free audit log & metrics delivery to observability platforms |
```

---

## For `fsxn-observability-integrations/README.md`

```markdown
---

## Related Repositories / 関連リポジトリ（FSx for ONTAP エコシステム）

| Repository | Use Case / 用途 | Description / 概要 |
|-----------|----------------|-------------------|
| [Agentic Access-Aware RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG) | AI / RAG | Permission-aware RAG + Agentic AI with FSx for ONTAP ACL enforcement |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless Automation | 17 industry-specific serverless patterns via S3 AP (FPolicy event-driven support) |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics / Lakehouse | Validation framework for analytics engines via FSx for ONTAP S3 AP |
| **[This repo] fsxn-observability-integrations** | Observability / Audit | EC2-free audit log & metrics delivery to observability platforms |
```

---

## For `FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns/README.md`

```markdown
---

## Related Repositories / 関連リポジトリ（FSx for ONTAP エコシステム）

| Repository | Use Case / 用途 | Description / 概要 |
|-----------|----------------|-------------------|
| [Agentic Access-Aware RAG](https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG) | AI / RAG | Permission-aware RAG + Agentic AI with FSx for ONTAP ACL enforcement |
| **[This repo] FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns** | Serverless Automation | 17 industry-specific serverless patterns via S3 AP (FPolicy event-driven support) |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics / Lakehouse | Validation framework for analytics engines via FSx for ONTAP S3 AP |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability / Audit | EC2-free audit log & metrics delivery to observability platforms |
```

---

## 共通アーキテクチャ図（任意で追加）

```
                    ┌─────────────────────────────────────────┐
                    │       FSx for NetApp ONTAP              │
                    │  (NFS/SMB + S3 Access Points)           │
                    └───┬──────────┬──────────┬──────────┬────┘
                        │          │          │          │
             ┌──────────▼──┐ ┌────▼────────┐ ┌▼─────────┐ ┌▼──────────────┐
             │ RAG         │ │ Serverless  │ │Lakehouse │ │ Observability │
             │ Permission- │ │ 17 Industry │ │Analytics │ │ Audit &       │
             │ aware AI    │ │ Patterns    │ │& ML      │ │ Monitoring    │
             └─────────────┘ └─────────────┘ └──────────┘ └───────────────┘
```
