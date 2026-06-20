# Transfer Family Partner-Onboarding-Leitfaden

**🌐 Language:** [日本語](../transfer-family-partner-onboarding.md) | [English](../en/transfer-family-partner-onboarding.md) | [한국어](../ko/transfer-family-partner-onboarding.md) | [简体中文](../zh-CN/transfer-family-partner-onboarding.md) | [繁體中文](../zh-TW/transfer-family-partner-onboarding.md) | [Français](../fr/transfer-family-partner-onboarding.md) | **Deutsch** | [Español](../es/transfer-family-partner-onboarding.md)

**Zuletzt aktualisiert**: 2026-05-23  
**Zielgruppe**: SFTP-Zugriffseinrichtung für externe Partner (Anwaltskanzleien, Wirtschaftsprüfungsgesellschaften, Aufsichtsbehörden usw.)

---

## Überblick

Dieser Leitfaden beschreibt die Einrichtungsschritte, mit denen externe Partner Dokumente per SFTP über AWS Transfer Family hochladen und diese automatisch in die Permission-aware RAG Knowledge Base aufgenommen werden.

### Architektur

```
Partner (SFTP) → Transfer Family → FSx for ONTAP S3 AP → Metadata Generator → Bedrock KB
```

Partner benötigen lediglich einen SFTP-Client. Ein Zugriff auf die Web-UI oder die AWS-Konsole ist nicht erforderlich.

---

## 1. Voraussetzungen

### Aufseiten des Systemadministrators

- [x] CDK mit `enableTransferFamily=true` bereitgestellt
- [x] S3 Access Point an das FSx for ONTAP-Volume angehängt
- [x] Berechtigungskonfiguration des Partners in der DynamoDB-Berechtigungszuordnungstabelle registriert

### Aufseiten des Partners

- [x] SFTP-Client (FileZilla, WinSCP, OpenSSH usw.)
- [x] SSH-Schlüsselpaar (RSA 4096 Bit oder Ed25519)

---

## 2. Vorbereitung des SSH-Schlüssels

### Wenn der Partner den Schlüssel generiert

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

Senden Sie den generierten **öffentlichen Schlüssel** (`~/.ssh/transfer-family-key.pub`) an den Systemadministrator.

> **Sicherheitshinweis**: Geben Sie den privaten Schlüssel (`~/.ssh/transfer-family-key`) niemals weiter.

### Wenn der Systemadministrator den Schlüssel registriert

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. SFTP-Verbindungsparameter

Stellen Sie dem Partner die folgenden Verbindungsinformationen bereit:

| Parameter | Wert |
|-----------|-----|
| Host | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| Port | `22` |
| Protokoll | SFTP |
| Benutzername | `partner-a` (vom Administrator zugewiesen) |
| Authentifizierungsmethode | SSH-Authentifizierung mit öffentlichem Schlüssel |
| Home-Verzeichnis | `/uploads/partner-a/` |

### Verbindungsbefehl (OpenSSH)

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### FileZilla-Einrichtung

1. **Servermanager** → Neue Site
2. Protokoll: **SFTP**
3. Host: `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. Anmeldetyp: **Schlüsseldatei**
5. Benutzer: `partner-a`
6. Schlüsseldatei: Pfad des privaten Schlüssels angeben

### WinSCP-Einrichtung

1. **Neue Sitzung**
2. Dateiprotokoll: **SFTP**
3. Hostname: Transfer Family-Endpunkt
4. Benutzername: `partner-a`
5. **Erweiterte Einstellungen** → SSH → Authentifizierung → private Schlüsseldatei angeben

---

## 4. Vorgehensweise beim Hochladen von Dateien

### Verzeichnisstruktur

Das Home-Verzeichnis des Partners ist auf `/uploads/partner-a/` beschränkt.

```
/uploads/partner-a/
├── contracts/          ← Verträge
├── reports/            ← Berichte
├── correspondence/     ← Korrespondenz
└── misc/               ← Sonstiges
```

### Upload-Vorgänge

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### Dateibenennungskonventionen

| Regel | Beschreibung |
|--------|------|
| Erweiterung | `.pdf`, `.docx`, `.txt`, `.md`, `.html` empfohlen |
| Dateiname | Alphanumerische Zeichen, Bindestriche und Unterstriche verwenden |
| Größenbeschränkung | 5 GB (Beschränkung von S3 Access Point) |
| Unzulässige Vorgänge | Umbenennen (rename) und Anhängen (append) von Dateien werden nicht unterstützt |

### Einschränkungen

- **Das Erstellen, Ändern und Löschen von `.metadata.json`-Dateien ist untersagt** (IAM Deny)
- Berechtigungsmetadaten werden vom System automatisch generiert
- rename/append-Vorgänge an Dateien werden aufgrund der Beschränkungen von S3 Access Point nicht unterstützt

---

## 5. Überprüfung der Ingestion

Nach dem Hochladen werden Dokumente gemäß folgender Zeitleiste verarbeitet:

| Schritt | Dauer | Beschreibung |
|---------|---------|------|
| Dateierkennung | Bis zu 5 Min. | Abfrage durch EventBridge Scheduler |
| Generierung der Metadaten | Sekunden | `.metadata.json` automatisch generiert |
| KB-Ingestion | 1–5 Min. | Indexierung in Bedrock Knowledge Base |
| RAG-Suche verfügbar | Sofort | Nach Abschluss der Ingestion |

### Überprüfungsmethode (für Systemadministratoren)

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. Fehlerbehebung

### Verbindung nicht möglich

| Symptom | Ursache | Maßnahme |
|------|------|------|
| `Permission denied (publickey)` | SSH-Schlüssel nicht registriert oder nicht übereinstimmend | Administrator um erneute Registrierung des öffentlichen Schlüssels bitten |
| `Connection timed out` | Netzwerkbeschränkung (IP-Zulassungsliste) | Administrator um Hinzufügen Ihrer IP-Adresse bitten |
| `no matching host key type found` | Nichtübereinstimmung von HostKeyAlgorithms | `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` hinzufügen |

### Hochladen nicht möglich

| Symptom | Ursache | Maßnahme |
|------|------|------|
| `Permission denied` bei `put` | Zugriff außerhalb des Home-Verzeichnisses | Nur unter `/uploads/partner-a/` hochladen |
| `Permission denied` bei `.metadata.json` | IAM Deny-Richtlinie | Vorgänge an Metadatendateien sind untersagt (erwartetes Verhalten) |
| `File too large` | Überschreitung der 5-GB-Grenze | Datei vor dem Hochladen aufteilen |

### Datei wird nicht im RAG übernommen

| Symptom | Ursache | Maßnahme |
|------|------|------|
| Auch nach mehr als 5 Min. keine Übernahme | Warten auf das Abfrageintervall oder Lambda-Fehler | Administrator um Prüfung von CloudWatch Logs bitten |
| Ingestion-Auftrag im Status FAILED | Dateiformat nicht unterstützt | Unterstützte Formate prüfen (PDF, DOCX, TXT, MD, HTML) |

---

## 7. Sicherheitsmodell

### Zugriffsbereich des Partners

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### Automatische Generierung der Berechtigungsmetadaten

Wenn ein Partner eine Datei hochlädt, generiert das System automatisch `.metadata.json`:

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-23T10:30:00Z"
}
```

Diese Berechtigungsinformationen werden aus der vom Administrator verwalteten Konfigurationstabelle in DynamoDB abgeleitet. Partner können Berechtigungen nicht direkt festlegen.

---

## 8. Für Administratoren: Vorgehensweise zum Hinzufügen eines Partners

### Hinzufügen eines neuen Partners

```bash
# 1. DynamoDB 権限マッピングに登録
aws dynamodb put-item \
  --table-name ${PREFIX}-transfer-permission-mapping \
  --item '{
    "userName": {"S": "partner-b"},
    "allowed_sids": {"L": [{"S": "S-1-5-21-xxx-2001"}]},
    "allowed_uids": {"L": [{"S": "2001"}]},
    "allowed_gids": {"L": [{"S": "2001"}]},
    "description": {"S": "Partner B - Audit Firm"}
  }' \
  --region ap-northeast-1

# 2. Transfer Family ユーザー作成（CDK再デプロイ or CLI）
# cdk.context.json の transferFamilyUsers に追加してデプロイ
# または CLI で直接作成:
aws transfer create-user \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --role arn:aws:iam::ACCOUNT:role/${PREFIX}-transfer-user-role \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/${S3_AP_ALIAS}/uploads/partner-b"}]' \
  --region ap-northeast-1

# 3. SSH公開鍵の登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-body "$(cat partner-b-public-key.pub)" \
  --region ap-northeast-1
```

### Deaktivieren eines Partners

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## Zugehörige Dokumentation

- [Transfer Family E2E-Verifizierungsbericht](transfer-family-e2e-verification.md)
- [Transfer Family Netzwerk-Voraussetzungen](transfer-family-networking-prerequisites.md)
- [AWS Transfer Family + FSx for ONTAP S3 AP Dokumentation](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
