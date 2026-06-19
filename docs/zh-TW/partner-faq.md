# 合作夥伴 FAQ（常見問題）

**🌐 Language:** [日本語](../partner-faq.md) | [English](../en/partner-faq.md) | [한국어](../ko/partner-faq.md) | [简体中文](../zh-CN/partner-faq.md) | **繁體中文** | [Français](../fr/partner-faq.md) | [Deutsch](../de/partner-faq.md) | [Español](../es/partner-faq.md)

**建立日期**: 2026-05-24  
**對象**: 面向合作夥伴企業、系統整合商（SI）、顧問公司

---

## 客戶提案時的常見問題

### Q1. 是否可以從既有的檔案伺服器（Windows Server）遷移？

**A**: 可以。FSx for ONTAP 支援與 Windows Server 檔案伺服器相同的 SMB/CIFS 通訊協定，並可原樣保留 NTFS ACL。透過將其加入既有的 Active Directory 網域，使用者的操作體驗不會發生變化。遷移可以使用 AWS DataSync 或 robocopy。

**相關文件**: [FSx for ONTAP 規模與效能設計](fsxn-sizing-and-performance.md)

---

### Q2. 權限設定由誰來做？是否需要額外的設定工作？

**A**: 既有的 NTFS ACL / UNIX 權限會直接反映到 RAG 檢索中。無需額外的權限設定。檔案伺服器管理員只需像往常一樣設定資料夾權限，即可自動反映到 RAG 檢索結果中。

**運作原理**: 檔案的 `.metadata.json` 中記錄了權限資訊（SID/UID/GID），檢索時會與使用者的權限進行比對並過濾。

---

### Q3. 系統可以處理多少檔案？

**A**: 我們建議以下依規模劃分的配置:

| 規模 | 檔案數 | FSx 配置 | 每月概算 |
|------|-----------|---------|---------|
| 小規模（PoC） | 最多 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| 中等規模 | 最多 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| 大規模 | 最多 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**相關文件**: [成本估算工作表](cost-estimation-worksheet.md)

---

### Q4. 是否可以與既有的身分認證基礎設施（Active Directory / Okta / Auth0）整合？

**A**: 可以。支援以下認證方式:

| 認證方式 | 支援的 IdP | SID/權限取得方法 |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | 透過 Post-Auth Trigger 從 AD 自動取得 SID |
| OIDC | Auth0, Okta, Keycloak, Entra ID | OIDC 群組宣告 + LDAP 查詢 |
| LDAP | OpenLDAP, FreeIPA | 直接取得 UID/GID |
| 電子郵件/密碼 | Cognito | 在 DynamoDB 中手動註冊 |

**相關文件**: [認證與使用者管理指南](auth-and-user-management.md)

---

### Q5. PoC 需要多長時間，成本是多少？

**A**: 

| 階段 | 期間 | AWS 成本 | 作業內容 |
|---------|------|-----------|---------|
| 部署 | 1天 | — | CDK 部署 + 測試資料匯入 |
| 基礎驗證 | 1週 | ~$100 | 使用示範資料進行功能確認 |
| 客戶資料 PoC | 2-4週 | ~$430/月 | 真實資料匯入 + 評估 |

我們也提供 **90 分鐘實作工作坊** → [PoC 工作坊指南](poc-workshop-guide.md)

---

### Q6. 能否向安全要求嚴格的客戶（金融、醫療、公共部門）提案？

**A**: 可以。系統具備以下安全功能:

- 6 層防禦（Geo 限制 → WAF → OAC → IAM Auth → Cognito → SID 過濾）
- KMS 加密（S3、DynamoDB、FSx）
- VPC 端點（不經過網際網路）
- 稽核日誌（CloudTrail + DynamoDB 稽核表）
- Fail-Closed 設計（權限不明時拒絕存取）
- Bedrock Guardrails（內容過濾、PII 偵測）

**但是**: 本系統的技術性安全功能並不會自動滿足法律或合規要求。對於受監管的工作負載，需要進行客戶特定的法務與合規評估。

**相關文件**: [生產就緒檢查清單](production-readiness-checklist.md)、[威脅模型](threat-model.md)

---

### Q7. 是否支援多租戶（向多個客戶部署）？

**A**: 支援。我們提供 3 種部署模式:

| 模式 | 隔離級別 | 適用條件 |
|---------|-----------|---------|
| A: 帳戶隔離 | 最高 | 嚴格的資料隔離要求（金融、醫療） |
| B: SVM 隔離 | 高 | 在同一帳戶內隔離客戶資料 |
| C: 前綴隔離 | 中 | 注重成本、小規模客戶 |

**相關文件**: [合作夥伴部署模式](partner-deployment-patterns.md)

---

### Q8. 如何接收來自外部合作夥伴（律師事務所、審計公司）的文件？

**A**: 支援透過 AWS Transfer Family 進行 SFTP 匯入。合作夥伴只需使用 SFTP 用戶端上傳檔案，系統便會自動附加權限中繼資料並匯入到 RAG Knowledge Base。

- 合作夥伴無需存取 Web UI 或 AWS Console
- 透過 IAM Deny 防止覆寫 `.metadata.json`（保護信任邊界）
- 5 分鐘內即可進行 RAG 檢索

**相關文件**: [Transfer Family 合作夥伴上線導入](transfer-family-partner-onboarding.md)

---

### Q9. 是否可以透過語音提問？

**A**: 可以。我們提供兩種語音聊天模式:

| 模式 | 技術 | 延遲 | 狀態 |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | 中 | GA，可透過 CDK 部署 |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | 低 | 已實作，CLI 部署 |

在 語音輸入 → 文字轉換 → Permission-aware RAG 檢索 → 語音輸出 的整個流程中都會套用權限過濾。

---

### Q10. 與其他 AWS 服務的整合如何？

**A**: 已與以下服務整合:

| 服務 | 用途 |
|---------|------|
| Amazon Bedrock (KB + Agent) | RAG 檢索 + 多代理協作 |
| Amazon Cognito | 認證·使用者管理 |
| Amazon CloudFront + WAF | CDN + 安全 |
| Amazon S3 Vectors | 向量資料庫（低成本） |
| Amazon EventBridge | KB 自動同步排程 |
| AWS Transfer Family | SFTP 匯入 |
| Amazon CloudWatch | 監控·警報·儀表板 |
| AWS Step Functions | FSx for ONTAP 維運自動化 |

---

## 技術常見問題

### Q11. S3 Access Point 與 S3 儲存貯體有什麼差異？

**A**: S3 Access Point 是針對 FSx for ONTAP 磁碟區的 S3 相容存取介面。與 S3 儲存貯體不同:

- 資料始終保留在 FSx for ONTAP 上（不會複製到 S3）
- 可透過 NFS/SMB 和 S3 API 兩種方式存取相同的資料
- 有 5GB 的上傳大小限制
- 不支援 rename / append 操作

---

### Q12. 部署失敗時如何回滾？

**A**: CDK 基於 CloudFormation，因此部署失敗時會自動回滾。如果需要手動回滾:

```bash
# 刪除特定堆疊
npx cdk destroy <stack-name>

# 刪除所有堆疊
npx cdk destroy --all --force
```

**相關文件**: [部署疑難排解](deployment-troubleshooting.md)

---

## 可用於提案與工作坊的資源

| 資源 | 用途 | 連結 |
|---------|------|--------|
| 產業專屬示範資料 | 針對客戶產業客製化的示範 | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| 90 分鐘工作坊 | 實作體驗 | [PoC 工作坊指南](poc-workshop-guide.md) |
| 成本估算 | 用於提案附件 | [成本估算工作表](cost-estimation-worksheet.md) |
| PoC 成功標準 | 用於客戶共識 | [PoC 成功標準範本](poc-success-criteria-template.md) |
| 生產就緒檢查清單 | 用於遷移規劃 | [生產就緒檢查清單](production-readiness-checklist.md) |
| 架構圖 | 用於提案附件 | README.md 的 Architecture 區段 |
