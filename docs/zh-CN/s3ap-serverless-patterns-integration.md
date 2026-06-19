# S3AP Serverless Patterns 集成架构

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | [English](../en/s3ap-serverless-patterns-integration.md) | [한국어](../ko/s3ap-serverless-patterns-integration.md) | **简体中文** | [繁體中文](../zh-TW/s3ap-serverless-patterns-integration.md) | [Français](../fr/s3ap-serverless-patterns-integration.md) | [Deutsch](../de/s3ap-serverless-patterns-integration.md) | [Español](../es/s3ap-serverless-patterns-integration.md)

**创建日期**: 2026-05-23  
**状态**: 草稿  
**目标读者**: 架构师、合作伙伴 SA

---

## 概述

本文档介绍 [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns)(17 UC 无服务器处理模式)与本项目(Permission-aware Agentic RAG)的集成架构。

---

## 两个项目的定位

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (企业文件服务器)                                            │
│                                                                         │
│  NAS 数据: 设计图纸、合同、诊疗记录、财务报告、研究论文...                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (处理·转换·分析)              │  │ (基于权限的 AI 检索·对话)     │
│                              │  │                              │
│ • Step Functions 批处理       │  │ • Bedrock KB + Converse API  │
│ • AI/ML 服务集成              │  │ • SID 过滤                    │
│ • 将处理结果写回 FSx          │  │ • 聊天 UI (Next.js)          │
│                              │  │ • Agent 模式                 │
│ 17 个行业 UC                 │  │ 14 个 Agent 模板             │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## 集成模式

### 模式 A: 将处理结果作为 RAG 检索对象

将 S3AP Serverless Patterns 处理·分析后的结果作为 RAG 的检索对象文档加以利用。

```
FSx for ONTAP (原始数据: DICOM 图像、合同 PDF、IoT 日志)
  ↓ S3 AP (读取)
S3AP Serverless Patterns
  ├─ UC5: DICOM → 元数据提取·匿名化
  ├─ UC1: 合同 → 实体提取·分类
  └─ UC3: IoT 日志 → 异常检测·报告生成
  ↓ S3 AP (写回) or S3 存储桶
FSx for ONTAP (已处理数据 + .metadata.json)
  ↓ S3 AP (读取)
Permission-aware RAG (Bedrock KB)
  ↓ SID 过滤
用户: "上个月质量检查中出现异常的产品有哪些?"
```

**优势**:
- 将原始数据(图像、二进制)转换为 AI 可理解的文本后再导入 RAG
- 为处理结果附加权限元数据，维持部门级访问控制
- 两个系统共享同一 FSx for ONTAP 卷(无需复制数据)

### 模式 B: 从 RAG 触发处理流水线

在 Agent 模式下指示"执行分析"时，将触发 S3AP 模式的 Step Functions。

```
用户: "分析最新的质量检查图像并生成报告"
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: 制造业分析)
  ↓ 处理完成
Agent: "分析已完成。结果如下: ..."
```

### 模式 C: 审计·合规的统一

将 S3AP UC1(法务·合规)的审计结果通过 RAG 实现可检索，以对话方式确认合规状况。

```
S3AP UC1: 文件服务器审计 → 审计报告生成
  ↓
RAG: "是否存在违反合规的文件?"
  → 从审计报告中回答权限范围内的信息
```

---

## 行业集成映射

| S3AP UC | 行业 | RAG 使用方式 | Agent 模板 |
|---------|------|----------------|------------------|
| UC1 | 法务 | 审计报告检索、合规状况确认 | `legalCompliance` |
| UC2 | 金融 | 检索 OCR 处理后的发票·合同 | `financial` |
| UC3 | 制造 | 检索质量检查报告·异常检测结果 | `search` |
| UC5 | 医疗 | 检索 DICOM 元数据·匿名化后的所见 | `medicalGuideline` |
| UC10 | 建筑 | 检索 BIM 元数据·安全合规报告 | `project` |
| UC13 | 教育 | 检索论文分类结果·引用网络 | `search` |
| UC14 | 保险 | 检索定损报告·损害评估结果 | `insuranceClaim` |
| UC16 | 政府 | 检索公文分类·脱敏文档 | `publicDocument` |

---

## 部署配置示例

### 最小配置(单账户)

```
AWS Account
├── FSx for ONTAP (共享卷)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (选择性部署)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### 企业配置(多账户)

```
Management Account
├── StackSets (S3AP 模式分发)
└── CDK Pipelines (RAG 分发)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## 相关文档

| 文档 | 内容 |
|-------------|------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 多租户部署模式 |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR(向量存储、权限过滤器等) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | 17 UC 详情 |
