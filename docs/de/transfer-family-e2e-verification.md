# Transfer Family FSx for ONTAP E2E-Verifizierungsbericht

**🌐 Language:** [日本語](../transfer-family-e2e-verification.md) | [English](../en/transfer-family-e2e-verification.md) | [한국어](../ko/transfer-family-e2e-verification.md) | [简体中文](../zh-CN/transfer-family-e2e-verification.md) | [繁體中文](../zh-TW/transfer-family-e2e-verification.md) | [Français](../fr/transfer-family-e2e-verification.md) | **Deutsch** | [Español](../es/transfer-family-e2e-verification.md)

**Verifizierungsdatum**: 2026-05-13
**Region**: ap-northeast-1
**Server-ID**: s-fb47244ef5ac43a28
**Endpunkt**: s-fb47244ef5ac43a28.server.transfer.ap-northeast-1.amazonaws.com

---

## Ergebnisse der E2E-Flow-Verifizierung

| Schritt | Ergebnis | Details |
|---------|------|------|
| 1. SSH-Schlüsselgenerierung | ✅ | RSA 4096bit |
| 2. Registrierung des Transfer Family-Benutzerschlüssels | ✅ | `import-ssh-public-key` API |
| 3. SFTP-Verbindung | ✅ | Authentifizierung erfolgreich (publickey) |
| 4. Dateiauflistung (ls) | ✅ | 2 Dateien angezeigt |
| 5. Datei-Upload (put) | ✅ | `sftp-uploaded.txt` |
| 6. Ingestion Trigger Lambda | ✅ | 1 Dateiänderung erkannt |
| 7. KB StartIngestionJob | ✅ | Job-ID `JIGLRZMPEU` |
| 8. Ingestion abgeschlossen | ✅ | `COMPLETE`, 1 Dokument neu indiziert |

---

## Erforderliche Konfiguration für den Betrieb

### 1. CDK-Kontextparameter

```json
{
  "enableTransferFamily": true,
  "transferFamilyTriggerMode": "polling",
  "transferFamilyPollingIntervalMinutes": 5,
  "s3AccessPointArn": "arn:aws:s3:ap-northeast-1:ACCOUNT_ID:accesspoint/AP_NAME",
  "transferFamilyS3ApAlias": "AP_NAME-xxxxxxxxxx-ext-s3alias"
}
```

> **Wichtig**: `transferFamilyS3ApAlias` muss nach der Erstellung des S3 Access Point abgerufen werden (zum Zeitpunkt des CDK synth unbekannt).

### 2. So rufen Sie den S3 Access Point Alias ab

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='AP_NAME'].S3AccessPoint.Alias" \
  --output text
```

### 3. HomeDirectoryMappings Target-Format

```
✅ Richtig: /{s3-access-point-alias}/uploads/demo-user
❌ Falsch: /{ap-name}/uploads/demo-user
❌ Falsch: /{ap-arn}/uploads/demo-user
❌ Falsch: /{alias}/uploads/demo-user/  (abschließender Schrägstrich)
```

### 4. IAM-Richtlinien-Resource-Format

```
✅ IAM Resource: arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME/object/uploads/user/*
✅ IAM Resource (ListBucket): arn:aws:s3:REGION:ACCOUNT:accesspoint/AP_NAME
❌ Den Alias nicht in IAM Resource verwenden
```

### 5. s3:prefix-Bedingung

```
✅ Richtig: "s3:prefix": ["uploads/demo-user/*", "uploads/demo-user"]
❌ Falsch: "s3:prefix": ["/uploads/demo-user/*", "/uploads/demo-user"]
```
Kein führender Schrägstrich erforderlich.

### 6. Erforderliche IAM-Aktionen

```json
{
  "ListBucket": ["s3:ListBucket", "s3:GetBucketLocation"],
  "ObjectOps": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject"]
}
```

### 7. SFTP-Verbindungsbefehl

```bash
# Verbindung von macOS/Linux (Angabe von HostKeyAlgorithms erforderlich)
sftp -i /path/to/private-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  USERNAME@SERVER_ID.server.transfer.REGION.amazonaws.com
```

> **⚠️ Hinweis für die Produktionsumgebung**: Das obige `StrictHostKeyChecking=no` dient der erstmaligen Überprüfung. Registrieren Sie in der Produktionsumgebung den HostKey des Transfer Family-Servers in `~/.ssh/known_hosts` und betreiben Sie ihn mit `StrictHostKeyChecking=yes` (Standardwert). Der HostKey kann mit `aws transfer describe-server --server-id <ID> --query 'Server.HostKeyFingerprint'` abgerufen werden.

### 8. FSx for ONTAP-Dateisystemberechtigungen

Damit Transfer Family-Benutzer Dateien lesen und schreiben können, muss der Dateisystembenutzer des S3 Access Point (z. B. `root`) auf dem FSx for ONTAP-Volume über Lese-/Schreibberechtigungen für das Upload-Zielverzeichnis verfügen.

---

## Entdeckte Probleme und Lösungen

### Problem 1: StructuredLogDestinations EarlyValidation

**Symptom**: `AWS::EarlyValidation::PropertyValidation`-Fehler bei der ChangeSet-Erstellung
**Lösung**: Entfernen Sie die Eigenschaft `structuredLogDestinations`. Standard-Protokollausgabe nur über `loggingRole`.

### Problem 2: HomeDirectoryMappings abschließender Schrägstrich

**Symptom**: `Target in mapping has a trailing '/'`
**Lösung**: Ändern Sie den Standardwert von `homeDirectoryPrefix` in `/uploads/${userName}` (ohne abschließenden Schrägstrich)

### Problem 3: Verwendung des AP-Namens in HomeDirectoryMappings Target

**Symptom**: `No such file or directory` bei `ls`
**Lösung**: Verwenden Sie den S3 AP-**Alias** anstelle des AP-Namens. Format: `/{alias}/path`.

### Problem 4: Führender Schrägstrich in IAM s3:prefix

**Symptom**: `Permission denied` bei `ls`
**Lösung**: Entfernen Sie den führenden Schrägstrich aus der `s3:prefix`-Bedingung. `uploads/user/*` ist richtig.

### Problem 5: SSH HostKeyAlgorithms-Inkompatibilität

**Symptom**: `no matching host key type found. Their offer: rsa-sha2-512,rsa-sha2-256`
**Lösung**: Fügen Sie `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` zum SFTP-Befehl hinzu.

### Problem 6: Platzhalter-SSH-Schlüssel

**Symptom**: `Permission denied (publickey)` — alter Platzhalterschlüssel ist noch vorhanden
**Lösung**: Löschen Sie alte Schlüssel mit `aws transfer delete-ssh-public-key` und behalten Sie nur den tatsächlichen Schlüssel.

---

## Manuelle Einrichtungsschritte nach der Bereitstellung

1. **S3 Access Point erstellen** (außerhalb von CDK)
2. **S3 AP Alias abrufen** → in `cdk.context.json` festlegen
3. **CDK-Bereitstellung** (`npx cdk deploy v4-test-demo-TransferFamily`)
4. **SSH-Schlüssel generieren** (`ssh-keygen -t rsa -b 4096`)
5. **Öffentlichen SSH-Schlüssel registrieren** (`aws transfer import-ssh-public-key`)
6. **Platzhalterschlüssel löschen** (`aws transfer delete-ssh-public-key`)
7. **SFTP-Verbindungstest**
8. **Manuelle Ausführung der Ingestion Trigger Lambda** zur Bestätigung der Erkennung

---

## AWS-Konsolen-Screenshots

### Details des Transfer Family-Servers

![Transfer Family Server Detail](screenshots/transfer-family-server-detail.png)

- Status: **Online**
- Protocol: **SFTP**
- Endpoint Type: **Public**
- Security Policy: **TransferSecurityPolicy-2024-01**
- Users: **1** (demo-user)
- CloudWatch Monitoring: BytesIn/BytesOut/FilesIn/FilesOut

### Überwachung der Ingestion Trigger Lambda

![Ingestion Trigger Lambda](screenshots/transfer-family-ingestion-trigger-lambda.png)

- Name der Lambda-Funktion: `v4-test-demo-ingestion-trigger`
- Erfolgreiche Ausführung bestätigt

### Bedrock KB Ingestion abgeschlossen

![KB Ingestion Complete](screenshots/transfer-family-kb-ingestion-complete.png)

- Knowledge Base ID: `OBKM84FBQK`
- Data Source ID: `XPJGH2MCBN`
- Ingestion Job: **COMPLETE**
