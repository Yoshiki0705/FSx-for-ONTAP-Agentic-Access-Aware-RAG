# Amazon Bedrock Managed Knowledge Base 升級路徑（驗證步驟）

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | [English](../en/managed-kb-upgrade-path.md) | [한국어](../ko/managed-kb-upgrade-path.md) | [简体中文](../zh-CN/managed-kb-upgrade-path.md) | **繁體中文** | [Français](../fr/managed-kb-upgrade-path.md) | [Deutsch](../de/managed-kb-upgrade-path.md) | [Español](../es/managed-kb-upgrade-path.md)

**建立日期**: 2026-06-18
**目標區域**: ap-northeast-1（東京）— Managed KB 在東京區域可用（2026-06-17 GA）
**狀態**: 驗證步驟文件（未實施遷移 / 保留現有路徑）
**相關**: [Managed KB 遷移評估](managed-kb-migration-evaluation.md)（判斷標準 / 權衡）

---

## 0. 本文件的定位

本文件將 [Managed KB 遷移評估](managed-kb-migration-evaluation.md) 中整理的驗證要點具體化為**可執行的驗證步驟**。判斷標準·權衡的討論請參閱遷移評估文件，本文件聚焦於「如何驗證」。

重要前提：

- 本文件為**驗證步驟指南**，並非建議立即遷移。
- 現有路徑（Bedrock KB + OpenSearch Serverless / S3 Vectors）**不會刪除**。這是對並行選項的額外驗證。
- Managed KB 並非比傳統型 KB「更優」。這是**按用途選擇**，能否滿足本專案主要目的 Permission-aware RAG 的要求（ACL 嚴格套用）決定遷移可行性。
- 以下內容的證據層級分類如下。

| 層級 | 定義 | 本文件中的處理 |
|------|------|--------------|
| Public evidence | 可從 AWS 官方文件·部落格驗證 | 附出處連結記述 |
| Project-context expectation | 本專案內的設計判斷·預期值（無法公開驗證） | 明確標註為「本專案的假設」 |

> ⚠️ **Validation Required**: 本文件的驗證步驟包含將 AWS 官方教學（[面向傳統型 KB](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)）**改讀為面向 Managed KB 的前提**。Managed KB 的 S3 連接器能否辨識 FSx for ONTAP S3 Access Point 官方尚未確認，驗證 V1 須首先確認此點。

---

## 1. 驗證的整體概覽

判斷遷移可行性的驗證由以下 3 個階段構成。每個階段以前一階段的成功為前提。

```
Phase A: 連接驗證 (V1, V2)
  └─ S3 AP 能否作為資料來源 / 中繼資料是否保留
       │ PASS
       ▼
Phase B: 授權驗證 (V3, V4, V5)
  └─ ACL 過濾是否生效 / 多跳中是否維持 / 反映延遲
       │ PASS
       ▼
Phase C: 稽核·維運驗證 (V6, V7)
  └─ lineage 記錄 / 對話歷史·快取的 ACL
       │ PASS
       ▼
遷移可行性判斷 (→ 遷移評估文件 §5)
```

> 任何階段都針對**FlexClone 建立的驗證用磁碟區，而非生產資料**執行（參見 §4）。

---

## 2. Phase A: S3 Access Point 資料來源連接驗證

### 2.1 驗證 V1: S3 連接器是否辨識 S3 AP URI

⚠️ **Validation Required**: 官方教學面向傳統型 KB，Managed KB 的 S3 連接器是否接受 S3 AP 的 alias 格式 URI 尚未確認。

**前提準備**：

1. 用 FlexClone 建立驗證用磁碟區（§4 的步驟）
2. 為驗證用磁碟區建立 S3 Access Point（參考現有 `setup-kb-datasource.sh` 的邏輯）
3. 確認 S3 AP alias（格式：`<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` 或 ARN）

**驗證步驟**：

```bash
# 1. 建立 Managed KB（託管向量儲存）
#    ⚠️ 以下為假設命令。Managed KB 的準確 API 參數請在 GA 文件中確認
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ managed storage 的指定方法需確認

# 2. 將 S3 連接器新增為資料來源並指定 S3 AP URI
#    驗證的核心：S3 AP 的 alias 格式 / ARN 格式哪個被接受
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ 此處是否被接受是 V1 的本質
    }
  }'
```

**判定標準**：

| 結果 | 判定 | 下一步行動 |
|------|------|----------|
| S3 AP ARN/alias 被接受，同步成功 | ✅ PASS | 進入 V2 |
| S3 AP 不可行但一般 S3 儲存桶可行 | △ 有條件 | 考慮基於 DataSync 的 S3 中繼路徑（ACL 中繼資料保留需額外驗證） |
| S3 連接器自身同步失敗 | ❌ FAIL | 遷移不成立。保留現行設定 |

> **本專案的假設**: 假設 S3 相容 API 則可連接，但 S3 AP 特有的限制（[FSx for ONTAP S3 AP 相容性矩陣](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md) 中記述的 ListObjectsV2 延遲等）可能影響 Managed KB 的爬蟲。

### 2.2 驗證 V2: 中繼資料保留

**驗證步驟**：

1. 在驗證用磁碟區上放置 `.metadata.json`（包含 `allowed_group_sids`）
2. 執行 Managed KB 的同步
3. 透過 `Retrieve` API 取得文件，確認回應中是否包含中繼資料

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "測試查詢"}' \
  --region ap-northeast-1
# 確認回應的 metadata 欄位中是否包含 allowed_group_sids
```

**判定標準**：

| 結果 | 判定 |
|------|------|
| `allowed_group_sids` 作為中繼資料保留且可取得 | ✅ PASS → 進入 Phase B |
| 中繼資料遺失或轉換為其他格式 | ❌ FAIL → 無法 ACL 過濾。保留現行設定 |

> ⚠️ Managed KB 的 Smart Parsing 如何處理中繼資料尚未確認。請確認 `.metadata.json` 的 sidecar 方式是否與傳統型 KB 同樣生效，或是否需要其他中繼資料賦予方式（連接器屬性等）。

---

## 3. Phase B: Permission-aware RAG 設計課題驗證

本專案的主要目的是 Permission-aware RAG，ACL 嚴格套用是不可讓步的要求。除非清除 Phase B 的驗證，否則保留現行設定為預設方針。

### 3.1 與現有方式的不變條件

現行採用[與向量儲存無關的方式](s3-vectors-sid-architecture-guide.md)。

```
Bedrock KB Retrieve → 檢索結果 + allowed_group_sids
→ 應用端(route.ts)比對 使用者SID ∩ 文件SID（Fail-Closed）
→ 僅比對相符的文件進入 Converse API
```

**遷移時須維持的不變條件**: 「在應用端強制最終授權，SID 取得失敗則全部拒絕（Fail-Closed）」。驗證 Managed KB 不破壞這一不變條件。

### 3.2 驗證 V3: 透過 `listContains` 的 SID 陣列比對

根據 [AgentCore Gateway connector target 文件](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)，Managed KB 的 `Retrieve` 工具在 `managedSearchConfiguration.filter` 中支援 `listContains` 運算子（概括出處主旨）。

**驗證步驟**：

```bash
# 僅取得使用者 SID 包含在 allowed_group_sids 陣列中的文件
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "機密文件測試"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**判定標準**：

| 測試案例 | 預期結果 |
|---------|---------|
| 使用者 SID 在陣列中的文件 | 被取得 |
| 使用者 SID 不在陣列中的文件 | 被排除 |
| 缺少 `allowed_group_sids` 的文件 | 被排除（Fail-Closed） |

> ⚠️ **重要**: 即使 `listContains` 在檢索層過濾，本專案的設計原則是**應用端的重新授權**。建議將 Managed KB 的 filter 用作「一級過濾」，最終授權在應用端維持的兩層防禦（不僅依賴 filter）。

### 3.3 驗證 V4: Agentic Retrieval 多跳中的過濾維持

這是 Managed KB 特有的最大風險。`AgenticRetrieveStream` 將查詢分解為子查詢，反覆執行多次檢索。**若每跳的中繼資料過濾未維持，則中間步驟會混入權限外資料。**

**驗證步驟**：

1. 準備需要跨越多個不同權限文件的複雜查詢（例如：「比較部門 A 的機密設計書與公開規範」）
2. 以無法存取權限外文件（部門 A 機密）的使用者執行 `AgenticRetrieveStream`
3. 檢查每跳的追蹤（CloudWatch / 回應的中間步驟），驗證權限外文件在**任何一跳都未被引用**

**判定標準**：

| 結果 | 判定 |
|------|------|
| 所有跳套用 `userContext` / filter，未引用權限外資料 | ✅ PASS |
| 中間跳過濾脫落，混入權限外資料 | ❌ FAIL → 停用多跳，僅使用單次 `Retrieve` |

> ⚠️ **Validation Required**: 向多跳每步的過濾傳播官方未明示。若驗證無法確認，則不使用 `AgenticRetrieveStream`，僅限於單次 `Retrieve` + 應用端比對（即使放棄多跳的優勢也優先保證 ACL）。

### 3.4 驗證 V5: 權限變更 / 刪除的反映延遲

**驗證步驟**：

1. 將使用者的 SID 從群組中刪除（或變更文件的 `allowed_group_sids`）
2. Managed KB 同步完成後，以該使用者重新檢索
3. 計測舊權限資料不再返回為止的延遲

**判定標準**: 反映延遲是否在本專案 [權限一致性模型](permission-consistency.md) 定義的可接受範圍內。若超出範圍，則緊急撤銷（emergency revocation）需透過應用端快取失效另行保障的設計。

---

## 4. 使用 FlexClone 的安全驗證模式

絕不能將生產資料直接作為 Managed KB 的爬取對象。用 FlexClone 建立與生產等同的驗證用磁碟區，在隔離環境中驗證。

### 4.1 為何使用 FlexClone

| 視角 | 直接存取生產 | FlexClone 驗證 |
|------|-------------|---------------|
| 對生產 I/O 的影響 | 爬取負載影響業務工作負載 | 無影響（複製獨立） |
| 資料一致性 | 爬取中的更新可能導致不一致 | 時間點一致 |
| 驗證的可重現性 | 因生產資料變動難以重現 | 從同一快照可任意次重現 |
| 誤操作風險 | 誤寫入生產資料的風險 | 複製可丟棄 |
| 成本 | — | 僅快照差分（初期數 MB） |

### 4.2 驗證用複製建立步驟

```bash
# 1. 建立生產磁碟區的快照（ONTAP REST API / CLI）
#    ⚠️ 從 VPC 內存取 ONTAP 管理端點
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. 從快照建立 FlexClone
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. 為複製磁碟區建立 S3 Access Point
#    （將現有 setup-kb-datasource.sh 的邏輯挪用於驗證）

# 4. 驗證完成後，丟棄複製（不影響生產）
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> 準確的 ONTAP REST API 參數請參閱 [維運 Runbook](operations-runbook.md) 的 ONTAP 操作章節。SSH 金鑰·管理端點資訊遵循生產步驟。

### 4.3 驗證環境的隔離原則

- 驗證用 Managed KB 作為與生產 KB **獨立的資源**建立，不變更生產 KB ID
- 驗證用 S3 AP 僅指向驗證用複製（不參考生產磁碟區）
- 驗證用 IAM 角色以**最小權限**限定於驗證資源（不授予對生產資料的讀取權限）
- 驗證完成後丟棄複製·KB·S3 AP·IAM 角色全部

---

## 5. 稽核·lineage 驗證 (Phase C / Optional)

⚠️ **Validation Required**: 經由 Managed KB 的存取是否記錄在連動對象（[fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)）的 Unity Catalog lineage 中尚未確認。

**驗證視角**：

- Managed KB 的 `Retrieve` / `AgenticRetrieveStream` 呼叫是否記錄在 CloudTrail 中
- 能否追蹤「誰·何時·使用了哪些文件來源資訊·在哪個回應中」
- 對話歷史·快取的 ACL 套用是否在應用端維持（由於 Managed 端快取行為不明，在應用端明確控制）

稽核要求的詳情請參閱 [治理·稽核設計](governance-and-audit.md)。

---

## 6. 驗證清單（摘要）

在遷移可行性判斷前，請清除以下所有項。

- [ ] **V1**: S3 連接器辨識 FSx for ONTAP S3 AP（Phase A）
- [ ] **V2**: `allowed_group_sids` 作為中繼資料保留（Phase A）
- [ ] **V3**: `listContains` SID 陣列比對生效（Phase B）
- [ ] **V4**: Agentic Retrieval 多跳中維持過濾（Phase B）
- [ ] **V5**: 權限變更 / 刪除的反映延遲在可接受範圍內（Phase B）
- [ ] **V6**: 記錄在 CloudTrail / lineage（Phase C）
- [ ] **V7**: 對話歷史 / 快取的 ACL 套用維持（Phase C）
- [ ] 所有驗證在 **FlexClone 驗證用磁碟區**執行（不影響生產）
- [ ] 維持應用端 Fail-Closed 重新授權的不變條件

> 任何一項 FAIL 時，除非有能夠容忍該風險的設計補充，否則**保留現行設定（OpenSearch Serverless / S3 Vectors）**為預設方針。向 CDK 堆疊的 Managed KB 整合僅在所有驗證清除後著手。

---

## 7. 相關文件

| 文件 | 內容 |
|------|------|
| [Managed KB 遷移評估](managed-kb-migration-evaluation.md) | 判斷標準 / 權衡 / 現有設定比較 |
| [CDK 堆疊架構指南](stack-architecture-comparison.md) | 向量儲存設定比較（含 Managed KB 欄） |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 過濾設計 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | 與向量儲存無關的授權方式 |
| [權限一致性模型](permission-consistency.md) | ACL 變更反映流程 / 可接受延遲 |
| [治理·稽核設計](governance-and-audit.md) | 稽核日誌 / lineage 要求 |
| [維運 Runbook](operations-runbook.md) | ONTAP 操作（FlexClone 建立步驟） |

---

## 參考連結

- [Amazon Bedrock Managed Knowledge Base GA 公告](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [AWS 官方教學（傳統型 KB）](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [AgentCore Gateway connector target（Managed KB）](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> 為遵守授權限制，已對內容進行改寫。AWS 官方資訊在保留出處主旨的前提下進行了概括·改寫。
