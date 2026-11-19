# 分塊策略選型指南

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | [English](../en/chunking-strategy-guide.md) | [한국어](../ko/chunking-strategy-guide.md) | [简体中文](../zh-CN/chunking-strategy-guide.md) | **繁體中文** | [Français](../fr/chunking-strategy-guide.md) | [Deutsch](../de/chunking-strategy-guide.md) | [Español](../es/chunking-strategy-guide.md)

**建立日期**: 2026-06-07  
**狀態**: 第一版  
**讀者**: RAG 品質調校負責人、資料工程師

---

## 概述

Bedrock Knowledge Base 的分塊策略直接影響檢索精度、回答品質與成本。本指南協助你依 FSx for ONTAP 上文件的特性選擇合適的策略。

---

## 可用策略

透過 CDK context `kbChunkingStrategy` 設定：

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # 預設
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **變更分塊策略後必須重新同步資料來源（重新擷取）。**

**這四個以外的值會在 synth 階段拋出例外。** 若靜默回退到預設值，`KbChunkingStrategy` 輸出會顯示打錯的字串，而實際下發的設定是 `FIXED_SIZE`，導致顯示與部署設定不一致。大小寫會被正規化（`semantic` → `SEMANTIC`）。

---

## 策略比較

| 策略 | 分塊大小 | 重疊 | 檢索精度 | 成本 | 適用情境 |
|---|---|---|---|---|---|
| **FIXED_SIZE** | 300 token | 10% | ⭐⭐⭐ | 💰 低 | 通用、初次部署、結構一致的文件 |
| **HIERARCHICAL** | parent 1500 / child 300 | 60 token | ⭐⭐⭐⭐ | 💰💰 中 | 長篇報告、階層結構文件、技術文件 |
| **SEMANTIC** | ≤300 token | 自動（依語意單元） | ⭐⭐⭐⭐⭐ | 💰💰💰 高 | 文件類型多樣、FAQ、對話形式、會議紀錄 |
| **NONE** | 整份文件 | 無 | ⭐⭐ | 💰 最低 | 短文件（<300 token）、僅中繼資料 |

---

## 文件特性與建議策略

| 文件特性 | 建議 | 理由 |
|---|---|---|
| **設計文件·規格書**（階層結構、長篇） | HIERARCHICAL | 保留章 → 節 → 段的階層，兼顧寬廣脈絡與精確檢索 |
| **合約·法律文件**（依條文） | SEMANTIC | 自動辨識條文之間的語意邊界，不切分條文 |
| **FAQ**（簡短的問答配對） | SEMANTIC | 將問題與答案保留在同一個分塊 |
| **會議紀錄·郵件**（對話形式） | SEMANTIC | 在話題轉換處自然分割 |
| **手冊·操作步驟**（逐步） | HIERARCHICAL | 整體流程為 parent，各步驟為 child |
| **財務報告**（含表格與數字） | FIXED_SIZE | 表格結構複雜時固定大小較穩定 |
| **簡短公告**（不足一頁） | NONE | 整份能放入一個分塊時無需切分 |
| **混合語料**（多種文件類型） | SEMANTIC | 無論類型都能得到語意上合理的切分 |

---

## 依產業

| 產業 | 主要文件 | 建議 | 備註 |
|---|---|---|---|
| **製造** | 圖面（文字部分）、品質規格、作業指導書 | HIERARCHICAL | 圖面搭配多模態 KB 使用 |
| **金融** | 法規文件、內部報告、法遵報告 | SEMANTIC | 維持條文的語意完整性 |
| **公部門** | 政策文件、通知、會議紀錄 | SEMANTIC | 會議紀錄依話題切分很重要 |
| **醫療** | 臨床指引、作業規程、研究論文 | HIERARCHICAL | 運用章節結構 |
| **法務** | 合約、判例、法規 | SEMANTIC | 避免切分條文 |
| **教育** | 教材、課程大綱、研究資料 | FIXED_SIZE | 結構一致，重視成本 |
| **保險** | 核保標準、詐欺偵測報告 | HIERARCHICAL | 契合階層化判定標準 |

---

## 效能特性

### 擷取時間

| 策略 | 1,000 份文件（估算） | 10,000 份文件（估算） |
|---|---|---|
| FIXED_SIZE | ~5 分鐘 | ~30 分鐘 |
| HIERARCHICAL | ~8 分鐘 | ~50 分鐘 |
| SEMANTIC | ~15 分鐘 | ~90 分鐘 |
| NONE | ~3 分鐘 | ~15 分鐘 |

> SEMANTIC 會在每個候選邊界額外呼叫模型，因此擷取時間與成本都會上升。

### 檢索延遲

分塊策略不會直接影響檢索延遲（向量檢索效能取決於索引規模）。不過 HIERARCHICAL 會執行 parent/child 兩階段檢索，可能增加少量延遲（約 50ms）。

---

## 與權限感知 RAG 的關係

**重要**：無論採用哪種分塊策略，權限篩選一律**以文件為單位**生效。

```
文件 A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (繼承自文件)
  ├── Chunk 2 → SID: [Admin, Engineering] (繼承自文件)
  └── Chunk 3 → SID: [Admin, Engineering] (繼承自文件)
```

- `.metadata.json` 中的 SID 資訊以文件為單位附加。
- 無法依分塊區分權限；整份文件共用一組權限。
- 同一份文件內需要不同權限時，請拆分為獨立檔案。

---

## 變更策略的步驟

```bash
# 1. 確認目前策略
grep kbChunkingStrategy cdk.context.json

# 2. 更新 CDK context
# 編輯 cdk.context.json，或在命令列指定

# 3. 檢視 CDK 差異
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. 部署（只有輸出 KbIngestionConfig 會變，既有的資料來源不變）
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC
# 4b. 分塊在建立後無法變更，需刪除資料來源並以 setup-kb-datasource.sh 重新建立

# 5. 重新同步資料來源（必要）
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. 等待重新擷取完成
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. 品質評估（以 RAGAS 比較）
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## 評估方法

變更策略後務必測量下列項目：

1. **RAGAS 評估**：以 `tests/rag-evaluation/` 比較 Faithfulness、Answer Relevancy 與 Context Precision。
2. **權限矩陣回歸**：確認 31 個情境中的權限篩選仍然正常。
3. **回應時間**：在 CloudWatch 檢視 P50/P95/P99 延遲。
4. **成本**：以擷取成本與查詢成本之和進行比較。

---

## 以基礎模型解析 PDF（選用）
指定 `-c kbParsingStrategy=BEDROCK_FOUNDATION_MODEL` 後，Knowledge Base 資料來源會以基礎模型讀取 PDF。預設值（`DEFAULT`）是 Bedrock 的預設解析器，只讀取 PDF 的文字層，純影像的 PDF 以及表格、圖形中的文字不會被擷取。
| 設定 | 預設值 | 作用 |
|---|---|---|
| `kbParsingStrategy` | `DEFAULT` | `DEFAULT` \| `BEDROCK_FOUNDATION_MODEL`。`BEDROCK_DATA_AUTOMATION` 在 synth 時會被拒絕（文件僅列出 US West (Oregon) 的預覽） |
| `kbParsingModelId` | `jp.anthropic.claude-haiku-4-5-20251001-v1:0` | 解析所用的模型（東京的推論設定檔或模型 ID）。支援視覺的 Claude、Nova、Llama 4 模型皆可 |
| `kbParsingPrompt` | （無） | 讀取指示（1 至 10,000 個字元），例如要求將表格輸出為 Markdown |
**[documented]** 選擇基礎模型作為解析器後，資料來源中的**所有 PDF** 都會交給該模型讀取，即使是只有文字的 PDF 也會依輸入與輸出 token 計費（[解析選項](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-advanced-parsing.html)）。PDF 以外的檔案（`.md`、`.txt` 等）仍使用預設解析器。解析失敗的文件會退回預設解析器。
**權限**：`.metadata.json` 依文件附加，因此更換解析器不會改變權限。解析器擷取的文字沿用來源文件的 `allowed_group_sids`，SID 篩選仍然只對檢索結果執行一次。不設定 `parsingModality`（`MULTIMODAL`），因為設定後擷取出的圖形會存入一個沒有權限資訊的獨立儲存位置。
**KB 角色的 IAM**：只有在選擇基礎模型時，才會替 KB 角色加入以下權限：針對推論設定檔的 `bedrock:GetInferenceProfile`（建立資料來源時由 Bedrock 呼叫，缺少則建立會因 `ValidationException` 失敗），以及針對該設定檔與基礎模型的 `bedrock:InvokeModel`。使用跨區域推論設定檔時，解析輸入可能在其他區域處理。
**套用方式**：建立資料來源的指令碼（`post-deploy-setup.sh`、`setup-kb-datasource.sh`）會把 AI 堆疊的輸出 `KbIngestionConfig`（把分塊與解析合併的一段 JSON）作為 `--vector-ingestion-configuration` 傳入。資料來源由指令碼而非 CDK 建立，所以**僅執行 CDK 部署不會改變既有的資料來源**。分塊在建立後無法變更（[documented](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-ds-update.html)），要變更就重新建立資料來源並重新同步。解析設定請比照辦理：在刪除過程中，`UpdateDataSource` 省略解析設定時被拒絕，訊息為「建立後無法更新」（實際刪除時觀察到）。未嘗試變更取值的更新。
> **預設分塊的變化**：先前的指令碼沒有傳入 `KbChunkingConfig`，資料來源以 Bedrock 的預設值（300 個 token，重疊 20%）建立。現在預設的 `FIXED_SIZE` 以 300 個 token、重疊 10% 傳入。既有的資料來源不變，重新建立時才會產生差異。
---

## CDK 實作

`lib/stacks/demo/demo-ai-stack.ts` 中的 `buildChunkingConfiguration()`：

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
# NONE：不分塊（整份文件向量化為一個向量）
```

---

## 相關文件

- [FSx for ONTAP 容量與效能設計](fsxn-sizing-and-performance.md)
- [RAG / Agent 評估框架](evaluation.md)
- [成本估算工作表](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
