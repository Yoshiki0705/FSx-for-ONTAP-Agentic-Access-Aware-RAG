# Konsistenzmodell für Berechtigungsänderungen

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | **Deutsch** | [Español](../es/permission-consistency.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Betriebsdesigner, Sicherheitsingenieure

---

## Überblick

Dieses Dokument erläutert, wann und wie Änderungen an Datei-ACLs auf FSx for ONTAP im Vektorspeicher und Berechtigungscache reflektiert werden, und definiert die Konsistenzgarantiestufen während Berechtigungsänderungen.

---

## Gesamter Berechtigungsdatenfluss

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Propagierungsfluss für Berechtigungsänderungen              │
│                                                                              │
│  ① ACL-Änderung     ② Metadaten-Regenerierung ③ KB-Resync         ④ Cache   │
│                                                                    Invalidierung│
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx for ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json update │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ Change   │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │expiry  │  │
│  Admin ändert       Service-Rolle         KB Auto-Sync          └────────┘  │
│  Dateiberechtigungen Lambda ruft ACL      (EventBridge           5-Min-TTL   │
│                     erneut ab             Scheduler)             Auto-       │
│                                           oder manueller         Invalidierung│
│                                           Trigger                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Schrittdetails

### Schritt ①: ACL-Änderung (FSx for ONTAP)

| Operation | Reflexionszeitpunkt | Hinweise |
|-----------|---------------------|----------|
| Datei-ACL-Änderung | Sofort (auf FSx) | NTFS ACL wird sofort auf dem FSx-Volume reflektiert |
| Gruppenmitgliedschaftsänderung | Nach AD-Propagierung (typischerweise innerhalb von 15 Min.) | Abhängig von der AD-Replikationsverzögerung |
| Dateiverschiebung (Umbenennung/Verschiebung) | Sofort (auf FSx) | Vererbte Berechtigungen werden neu berechnet |
| Änderung vererbter Berechtigungen | Sofort (auf FSx) | Übergeordnete Ordner-ACL-Änderungen propagieren zu Unterordnern |

### Schritt ②: Metadaten-Regenerierung

Methoden zur Aktualisierung von `allowed_group_sids` in `.metadata.json`:

| Methode | Auslöser | Verzögerung | Hinweise |
|---------|----------|-------------|----------|
| Upload über Transfer Family | Bei Datei-Upload | Sofort | Bei `enableTransferFamily=true`. Generiert automatisch Metadaten für hochgeladene Dateien |
| AD Sync Lambda | Manuell / Geplant | Abhängig von Konfiguration | `lambda/agent-core-ad-sync/` ruft NTFS ACL erneut ab |
| Manuelle Aktualisierung | Admin-Operation | Sofort | Für S3-Bucket-Fallback-Pfad, `.metadata.json` direkt aktualisieren |

### Schritt ③: Vektorspeicher-Aktualisierung (KB-Resync)

| Methode | Auslöser | Verzögerung | Hinweise |
|---------|----------|-------------|----------|
| KB Auto-Sync | EventBridge Scheduler (Polling) | Konfiguriertes Intervall (Standard: 15 Min.) | Bei `enableKbAutoSync=true`. Führt StartIngestionJob nur bei erkannten Dateiänderungen aus |
| Manuelle KB-Synchronisierung | AWS-Konsole / CLI | Startet sofort, abgeschlossen in Minuten | `aws bedrock-agent start-ingestion-job` |
| CloudTrail-Event | S3 PutObject | Einige Minuten | Bei `enableCloudTrailIngestion=true` auf Transfer Family-Pfad |

**Geschätzte KB-Synchronisierungsdauer:**

| Dokumentenanzahl | Synchronisierungszeit (Schätzung) |
|------------------|-----------------------------------|
| ~100 | 1–3 Min. |
| ~1.000 | 5–15 Min. |
| ~10.000 | 30–60 Min. |
| ~100.000 | Mehrere Stunden (inkrementelle Synchronisierung empfohlen) |

### Schritt ④: Berechtigungscache-Invalidierung

| Cache | TTL | Invalidierungsmethode | Hinweise |
|-------|-----|----------------------|----------|
| DynamoDB `perm-cache` | 5 Min. | Automatischer TTL-Ablauf | Filterergebnis-Cache |
| DynamoDB `user-access` | Keiner (persistent) | Explizite Aktualisierung erforderlich | Benutzer-SID / Gruppen-SID |
| Browser-Sitzung | Während der Sitzung | Abmeldung / Sitzungsablauf | Frontend-Speicher-Cache |

---

## Maximale Verzögerung der Berechtigungspropagierung

### Normalbetrieb

```
ACL-Änderung → Metadaten-Regenerierung → KB-Resync → Cache-Ablauf
  0 Min.        0–15 Min.                1–15 Min.    0–5 Min.
                                              
Max. Verzögerung: ~35 Min. (15 Min. Polling + 15 Min. KB-Sync + 5 Min. Cache)
```

### RPO-artige Darstellung

| Szenario | Max. Verzögerung | Beschreibung |
|----------|------------------|--------------|
| Normalbetrieb (KB Auto-Sync 15-Min.-Intervall) | Max. 35 Min. | Polling-Intervall + KB-Sync + Cache-TTL |
| Hochfrequenz-Sync (KB Auto-Sync 5-Min.-Intervall) | Max. 15 Min. | Reduziertes Polling-Intervall |
| Manuelle sofortige Synchronisierung | Max. 10 Min. | Manuelle KB-Synchronisierung + Cache-TTL |
| Notfall-Berechtigungsentzug | Max. 5 Min. | Erzwungene Cache-Löschung + Fail-Closed |

---

## Verfahren zum Notfall-Berechtigungsentzug

Wenn ein sofortiger Entzug der Zugriffsberechtigungen eines Benutzers erforderlich ist:

### Schritt 1: Benutzer-SID aus DynamoDB löschen (sofortige Wirkung)

```bash
# SID-Daten des Benutzers löschen → Fail-Closed verweigert alle Dokumente
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Schritt 2: Berechtigungscache erzwungen löschen

```bash
# Cache-Einträge für den Zielbenutzer löschen
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### Schritt 3: Cognito-Benutzer deaktivieren (Sitzungsinvalidierung)

```bash
# Cognito-Benutzer deaktivieren
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Wirkung

- Nach Schritt 1: Neue Suchanfragen verweigern sofort alle Dokumente (Fail-Closed)
- Nach Schritt 2: Verhindert die Nutzung zwischengespeicherter alter Berechtigungsinformationen
- Nach Schritt 3: Invalidiert die Sitzung des Benutzers selbst

---

## Verhalten nach Berechtigungsänderungsszenarien

### Szenario 1: Datei-ACL-Änderung

```
Admin entfernt Benutzer X aus der ACL von Datei A
  → SID von Benutzer X aus .metadata.json allowed_group_sids entfernen
  → KB-Resync aktualisiert Vektorspeicher-Metadaten
  → Datei A wird aus den nächsten Suchergebnissen von Benutzer X ausgeschlossen
```

**Verzögerung**: Max. 35 Min. (Normalbetrieb)

### Szenario 2: AD-Gruppenmitgliedschaftsänderung

```
Admin entfernt Benutzer X aus der Engineering-Gruppe
  → AD-Replikation (~15 Min.)
  → DynamoDB user-access groupSIDs aktualisiert (bei AD Sync Lambda-Ausführung)
  → Auf Engineering-Gruppe beschränkte Dokumente werden aus der Suche von Benutzer X ausgeschlossen
```

**Verzögerung**: AD-Replikation + AD Sync Lambda-Ausführungsintervall + Cache-TTL

### Szenario 3: Dateiverschiebung (Umbenennung / Verschiebung)

```
Admin verschiebt Datei A von /public/ nach /confidential/
  → Vererbte Berechtigungen werden auf FSx neu berechnet
  → .metadata.json-Regenerierung erforderlich
  → KB-Resync aktualisiert Vektorspeicher-Metadaten
```

**Hinweis**: Eine automatische `.metadata.json`-Regenerierung erfolgt möglicherweise nicht bei Dateiverschiebungen. Ein Design, bei dem KB Auto-Sync-Polling Dateipfadänderungen erkennt und die Metadaten-Regenerierung auslöst, wird empfohlen.

### Szenario 4: Änderung vererbter Berechtigungen

```
Admin ändert ACL des Ordners /confidential/ (Vererbung aktiviert)
  → Effektive Berechtigungen ändern sich für alle darunterliegenden Dateien
  → .metadata.json-Regenerierung für jede Datei erforderlich
  → KB-Resync
```

**Hinweis**: Massenberechtigungsänderungen für große Dateimengen benötigen Zeit für die KB-Synchronisierung. Schrittweise Änderungen werden empfohlen.

---

## Konsistenzgarantiestufen

| Stufe | Garantie | Implementierung |
|-------|----------|-----------------|
| **Fail-Closed** | Alles verweigern, wenn SID-Informationen nicht abgerufen werden können | Bei DynamoDB-Fehler / kein Datensatz |
| **Eventually Consistent** | ACL-Änderungen werden schließlich in Suchergebnissen reflektiert | KB Auto-Sync + Cache-TTL |
| **Keine False Positives** | Dokumente ohne Berechtigung werden niemals angezeigt | SID-Abgleich (Schnittmenge) |
| **Metadaten erforderlich** | Dokumente ohne Metadaten werden ausgeschlossen | `.metadata.json` erforderlich |

### Hinweis: Möglichkeit von False Negatives

In den folgenden Fällen können Dokumente, auf die zugegriffen werden sollte, vorübergehend nicht angezeigt werden (False Negative):

- Unmittelbar nach Berechtigungserteilung (Metadaten noch nicht aktualisiert)
- Während der KB-Synchronisierung (alte Metadaten verbleiben)
- Während der AD-Replikationsverzögerung

**Designprinzip**: Aus Sicherheitsgründen werden False Negatives (zugängliche Elemente nicht sichtbar) toleriert, während False Positives (eingeschränkte Elemente sichtbar) auf null Vorkommen abzielen.

---

## Empfohlene Überwachungs- und Alarmkonfiguration

```yaml
# Empfohlene CloudWatch-Alarmeinstellungen
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # Hohe Cache-Miss-Rate = hohe Aktualisierungsfrequenz der Berechtigungsdaten
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # Alarm bei 3 aufeinanderfolgenden Fehlern
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # Sofortiger Alarm bei SID-Auflösungsfehler
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Untersuchen, wenn Fail-Closed häufig ausgelöst wird
```

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID-Filterarchitektur-Details |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checkliste für die Produktionsbereitschaft |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Dimensionierung und Leistung |
