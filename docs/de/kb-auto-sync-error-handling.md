# Fehlerbehandlung von KB Auto-Sync

**🌐 Language:** [日本語](../kb-auto-sync-error-handling.md) | [English](../en/kb-auto-sync-error-handling.md) | [한국어](../ko/kb-auto-sync-error-handling.md) | [简体中文](../zh-CN/kb-auto-sync-error-handling.md) | [繁體中文](../zh-TW/kb-auto-sync-error-handling.md) | [Français](../fr/kb-auto-sync-error-handling.md) | **Deutsch** | [Español](../es/kb-auto-sync-error-handling.md)

## Überblick

Dieses Dokument beschreibt den Ablauf im Fehlerfall, die Wiederholungsstrategie, die Alarme und die manuellen Wiederherstellungsschritte für KB Auto-Sync (`enableKbAutoSync=true`).

## Mechanismen der Fehlererkennung

### CloudWatch Alarm (automatische Erkennung)

```
EventBridge Scheduler (alle 5 Minuten)
  → Ausführung der Lambda
    → Erfolg: Metriken normal
    → Fehler: Lambda-Errors-Metrik +1
      → 3 aufeinanderfolgende Fehler: CloudWatch-Alarm wird ausgelöst
        → SNS-Benachrichtigung (wenn enableMonitoring=true)
```

**Alarmkonfiguration:**
- Name: `${prefix}-kb-auto-sync-errors`
- Schwellwert: 1 Fehler × 3 aufeinanderfolgende Perioden
- Periode: entspricht dem Abfrageintervall (Standard 5 Minuten)
- Fehlende Daten: NOT_BREACHING (kein Alarm, solange die Lambda nicht läuft)

### EMF-Metriken (detaillierte Überwachung)

Die KB-Auto-Sync-Lambda gibt folgende benutzerdefinierte Metriken aus:

| Metrik | Namespace | Bedeutung |
|---|---|---|
| `FilesScanned` | `KbAutoSync` | Anzahl der geprüften Dateien |
| `FilesChanged` | `KbAutoSync` | Anzahl der als geändert erkannten Dateien |
| `IngestionJobTriggered` | `KbAutoSync` | Anzahl gestarteter Ingestion-Jobs |
| `IngestionJobFailed` | `KbAutoSync` | Anzahl fehlgeschlagener Ingestion-Jobs |
| `InventoryDiffErrors` | `KbAutoSync` | Anzahl der Fehler bei der Inventardifferenz |

## Fehlermuster und Reaktionen

### Muster 1: ListObjectsV2-Fehler am S3 Access Point

**Ursache**: Verbindungsfehler zu FSx for ONTAP S3 AP, unzureichende IAM-Berechtigungen oder gelöschter Access Point

**Verhalten**:
- die Lambda protokolliert den Fehler und wirft eine Exception
- der CloudWatch-Alarm löst nach drei aufeinanderfolgenden Fehlern aus
- das DynamoDB-Inventar bleibt unverändert, wodurch die Atomarität erhalten bleibt

**Manuelle Wiederherstellung**:
```bash
# 1. Prüfen, ob der S3 Access Point existiert
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. Den Access-Point-ARN in der Lambda-Umgebung prüfen
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. Mit einem manuellen Aufruf testen
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### Muster 2: fehlgeschlagener Bedrock-KB-Ingestion-Job

**Ursache**: falsch konfigurierte KB-Datenquelle, Berechtigungsfehler am S3 Access Point oder Fehler beim Chunking bzw. Parsing

**Verhalten**:
- die Lambda verfolgt den Status mit `StartIngestionJob` und anschließend `GetIngestionJob`
- bei Status `FAILED`:
  - die Datei wird im DynamoDB-Inventar auf `status: "failed"` gesetzt
  - sie wird im nächsten Zyklus nicht erneut eingelesen, was eine Endlosschleife verhindert
  - die Metrik `IngestionJobFailed` wird ausgegeben
- bei Status `IN_PROGRESS`:
  - es wird kein doppelter Job gestartet (IN_PROGRESS wirkt als gegenseitiger Ausschluss)

**Manuelle Wiederherstellung**:
```bash
# 1. Den fehlgeschlagenen Job untersuchen
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. Die fehlgeschlagenen Dateien im Inventar finden
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. Den Inventareintrag zurücksetzen, damit erneut eingelesen werden kann
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. Ingestion manuell starten
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### Muster 3: Fehler an der DynamoDB-Inventartabelle

**Ursache**: erschöpfte DynamoDB-Kapazität, Berechtigungsfehler oder gelöschte Tabelle

**Verhalten**:
- die Lambda wirft eine Exception und endet sofort
- Fail-safe: kein Inventar-Update, daher prüft der nächste Zyklus alles erneut
- der CloudWatch-Alarm löst nach drei aufeinanderfolgenden Fehlern aus

**Manuelle Wiederherstellung**:
```bash
# Prüfen, ob die Inventartabelle existiert
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# Fehlt die Tabelle, mit CDK neu deployen
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### Muster 4: Timeout der Lambda (über 5 Minuten)

**Ursache**: Prüfung sehr vieler Dateien (>10.000) oder hohe Latenz von ListObjectsV2

**Verhalten**:
- die Lambda läuft nach 5 Minuten ab und die Errors-Metrik erhöht sich
- teilweise geprüfte Dateien werden nicht im Inventar vermerkt, wodurch die Atomarität erhalten bleibt

**Gegenmaßnahmen**:
- `kbAutoSyncIntervalMinutes` verlängern (zum Beispiel 15 Minuten)
- bei sehr vielen Dateien den S3 Access Point nach Präfix aufteilen

## Wiederholungsstrategie

| Fehlermuster | Automatische Wiederholung | Intervall | Maximale Anzahl |
|---|---|---|---|
| Verbindungsfehler zum S3 Access Point | ✅ (nächster Zyklus) | Abfrageintervall (5 Min.) | unbegrenzt (durch den Alarm erkannt) |
| Fehlgeschlagene KB-Ingestion | ❌ (manuelles Zurücksetzen nötig) | — | — |
| DynamoDB-Fehler | ✅ (nächster Zyklus) | Abfrageintervall (5 Min.) | unbegrenzt (durch den Alarm erkannt) |
| Lambda-Timeout | ✅ (nächster Zyklus) | Abfrageintervall (5 Min.) | unbegrenzt (durch den Alarm erkannt) |

**Entwurfsentscheidung**: Es gibt keine Dead Letter Queue. In einem von EventBridge Scheduler getriebenen Abfragemuster wird ein fehlgeschlagener Lauf im nächsten Zyklus automatisch wiederholt, eine DLQ bringt also nichts. Die Ausnahme ist der fehlgeschlagene KB-Ingestion-Job: er wird *nicht* automatisch wiederholt, weil er auf ein Datenqualitätsproblem hindeuten kann, das ein Mensch ansehen sollte.

## Fail-closed-Verhalten bei fehlgeschlagener Ingestion

Ein Fehler in KB Auto-Sync schwächt die Berechtigungsgrenze der RAG-Pipeline nicht:

1. **Ein nicht aktualisiertes Inventar lässt den bestehenden Index unverändert.** Neue Dateien werden lediglich nicht durchsuchbar; die Berechtigungskontrolle bestehender Dateien bleibt unberührt.
2. **Fehlgeschlagene Dateien werden mit `status: "failed"` markiert.** Sie werden nicht automatisch erneut eingelesen; der Eintrag wird nach menschlicher Prüfung zurückgesetzt.
3. **IN_PROGRESS-Jobs schließen sich gegenseitig aus** und verhindern damit die Inkonsistenz, die eine doppelte Ingestion verursachen würde.
4. **Dateien ohne Berechtigungsmetadaten (`.metadata.json`)** werden zum Abfragezeitpunkt vom Fail-closed-Filter ausgeschlossen, auch wenn sie in den KB gelangen. Die Fail-closed-Regel gilt immer.

## Überwachungs-Dashboard

Bei `enableMonitoring=true` erhält das CloudWatch-Dashboard diese Widgets:

- **KB Auto-Sync Errors**: die Lambda-Errors-Metrik (5-Minuten-Perioden)
- **Ingestion Job Status**: Anzahl erfolgreicher, fehlgeschlagener und laufender Jobs
- **Files Changed**: pro Zyklus als geändert erkannte Dateien
- **Scan Duration**: Ausführungszeit der Lambda (P50/P90/P99)

## Zugehörige Dokumente

- [Konsistenzmodell der Berechtigungsmetadaten](permission-consistency.md) — wie Berechtigungsaktualisierungen mit KB-Index-Aktualisierungen zusammenhängen und warum ACL-Änderungen nicht automatisch ankommen
- [CloudWatch-Dashboard-Leitfaden](cloudwatch-dashboard-guide.md) — wie die Überwachungsmetriken zu lesen sind
- [Checkliste für den Produktionsbetrieb](production-readiness-checklist.md) — Voraussetzungen, bevor KB Auto-Sync in Produktion läuft
