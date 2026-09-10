# PoC 結果報告範本

**🌐 Language:** [日本語](../../templates/poc-result-report-template.md) | [English](../../en/templates/poc-result-report-template.md) | [한국어](../../ko/templates/poc-result-report-template.md) | [简体中文](../../zh-CN/templates/poc-result-report-template.md) | **繁體中文** | [Français](../../fr/templates/poc-result-report-template.md) | [Deutsch](../../de/templates/poc-result-report-template.md) | [Español](../../es/templates/poc-result-report-template.md)

**目的**: 供合作夥伴／SI 向客戶回報 PoC 執行結果的格式

---

## 1. 執行摘要

| 項目 | 內容 |
|---|---|
| 客戶名稱 | _____ |
| 執行期間 | YYYY/MM/DD — YYYY/MM/DD |
| 目標業務 | _____ |
| 目標文件數 | _____ |
| 目標使用者數 | _____ |
| 整體評估 | ☐ 建議轉入生產 / ☐ 需要追加驗證 / ☐ 暫不推進 |

---

## 2. 量化評估結果

### 2.1 RAG 品質指標

| 指標 | 目標值 | 實測值 | 判定 |
|---|---|---|---|
| Faithfulness（事實一致性） | ≥ 0.85 | _____ | ☐ Pass / ☐ Fail |
| Answer Relevancy（回答相關性） | ≥ 0.80 | _____ | ☐ Pass / ☐ Fail |
| Context Precision（脈絡精度） | ≥ 0.75 | _____ | ☐ Pass / ☐ Fail |
| 權限違規次數 | 0 | _____ | ☐ Pass / ☐ Fail |

### 2.2 效能指標

| 指標 | 目標值 | 實測值 | 判定 |
|---|---|---|---|
| 回應時間 (P50) | ≤ 3s | _____ s | ☐ Pass / ☐ Fail |
| 回應時間 (P95) | ≤ 8s | _____ s | ☐ Pass / ☐ Fail |
| Prompt Cache 命中率 | ≥ 50% | _____ % | ☐ Pass / ☐ Fail |

### 2.3 業務成效指標

| 指標 | PoC 前 | PoC 後 | 改善率 |
|---|---|---|---|
| 檢索時間（每次） | _____ 分鐘 | _____ 秒 | _____ % |
| 一次回答解決率 | _____ % | _____ % | _____ pt |
| 存取權限外資訊 | _____ 件 | 0 件 | 100% |

---

## 3. 權限控制驗證結果

| 測試情境 | 結果 | 備註 |
|---|---|---|
| 管理員 → 存取全部文件 | ☐ Pass / ☐ Fail | |
| 一般使用者 → 僅公開文件 | ☐ Pass / ☐ Fail | |
| 群組權限 → 僅所屬部門文件 | ☐ Pass / ☐ Fail | |
| 權限變更 → 已反映 | ☐ Pass / ☐ Fail | 最大延遲: _____ 分鐘 |
| 無權限文件 → 自檢索結果中排除 | ☐ Pass / ☐ Fail | |

---

## 4. 成本實際情況

| 項目 | 預估月費用 | 備註 |
|---|---|---|
| FSx for ONTAP | $_____ | |
| Bedrock（推論） | $_____ | 套用 Smart Routing 後 |
| Bedrock（Embedding） | $_____ | 首次 + 增量 |
| 向量儲存 | $_____ | S3 Vectors / OpenSearch |
| 其他（Lambda、DynamoDB、CloudFront） | $_____ | |
| **合計** | **$_____** | |

---

## 5. 發現的問題與建議

| # | 問題 | 影響程度 | 建議應對 | 應對時機 |
|---|---|---|---|---|
| 1 | | ☐ 高 / ☐ 中 / ☐ 低 | | |
| 2 | | ☐ 高 / ☐ 中 / ☐ 低 | | |
| 3 | | ☐ 高 / ☐ 中 / ☐ 低 | | |

---

## 6. 面向生產的後續步驟

| # | 行動 | 負責人 | 期限 |
|---|---|---|---|
| 1 | 安全評估（IAM 最小權限、加密） | | |
| 2 | 負載測試（預估使用者數的 2 倍） | | |
| 3 | DR 設計（Multi-AZ、備份） | | |
| 4 | 維運設計（Runbook、告警） | | |
| 5 | Go/No-Go 決策會議 | | |

---

## 7. 附件

- [ ] CloudWatch 面板截圖
- [ ] RAGAS 評估結果（JSON）
- [ ] 權限矩陣測試結果
- [ ] 成本明細（AWS Cost Explorer）
- [ ] 使用者問卷結果（若已執行）
