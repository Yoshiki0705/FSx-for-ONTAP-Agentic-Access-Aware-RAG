# Konsistenzmodell für Berechtigungsmetadaten

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | **Deutsch** | [Español](../es/permission-consistency.md)

**Erstellt**: 2026-05-21
**Aktualisiert**: 2026-09-07 (Beschreibung des ACL-basierten automatischen Propagierungsflusses nach Prüfung der Implementierung zurückgezogen)
**Status**: Entwurf
**Zielgruppe**: Betriebsdesigner, Sicherheitsingenieure

---

## Überblick

Dieses Dokument definiert, wann eine Änderung der Daten, die zur Abfragezeit für die Berechtigungsentscheidung verwendet werden, in den Suchergebnissen sichtbar wird. Verwendet werden zwei Datenbestände: `.metadata.json` auf Dokumentseite und die DynamoDB-Tabelle `user-access` auf Benutzerseite.

**Es gibt keinen Mechanismus, der Änderungen der NTFS ACL von Dateien auf FSx for ONTAP automatisch nachführt.** Der Berechtigungsindex ist keine Projektion der ACL, sondern ein separat aufgebauter und gepflegter Index. Gründe und betriebliche Konsequenzen stehen unter „Warum ACL-Änderungen nicht ankommen".

---

## Daten für die Berechtigungsentscheidung

| Daten | Ablage | Erzeugt/aktualisiert von | Rolle zur Abfragezeit |
|-------|--------|--------------------------|-----------------------|
| `.metadata.json` (`allowed_group_sids` / `allowed_uids` / `allowed_gids`) | Benachbartes Objekt auf dem S3 AP → Metadatenattribut in der Bedrock KB | Je Pfad unterschiedlich (siehe unten) | Zulässige SID- / UID- / GID-Menge des abgerufenen Chunks |
| `user-access` (`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`) | DynamoDB | AD- / LDAP-Sync-Lambda (`lambda/agent-core-ad-sync/`) | SID- / UID- / GID-Menge des Aufrufers |
| `perm-cache` | DynamoDB (TTL 5 Minuten) | Berechtigungsfilter | Cache der Entscheidungsergebnisse |

Herkunft von `.metadata.json`:

| Pfad | Herkunft | Auslöser |
|------|----------|----------|
| Transfer Family SFTP (`enableTransferFamily=true`) | Administratorseitig gepflegte DynamoDB-Zuordnung (Schlüssel: Upload-Benutzername) | Beim Datei-Upload |
| Selbst betriebener Embedding-Server (`ENV_AUTO_METADATA=true`, optional, nicht Standard) | Echte NTFS ACL über die ONTAP REST API abgerufen | Bei Erkennung einer unverarbeiteten Datei (`mtime`-basiert) |
| Demo-Umgebung | Im Repository enthaltene Beispiele, manuell abgelegt | Manuell |

SFTP-Benutzer erhalten ein IAM-Deny auf `*.metadata.json`; wer eine Datei hochlädt, kann seine eigenen Berechtigungen nicht schreiben.

---

## Propagierungspfade

Automatisch propagieren zwei Pfade.

### Pfad A: Berechtigungsänderung auf Dokumentseite

| Schritt | Verantwortlich | Latenz |
|---------|----------------|--------|
| ① Aktualisierung von `.metadata.json` | Die Herkunft aus der Tabelle oben oder eine direkte Aktualisierung durch einen Administrator | Auslöserabhängig |
| ② Änderungserkennung | KB Auto-Sync (EventBridge Scheduler; vergleicht `size` / `lastModified` / `ETag`) | Polling-Intervall (Standard 15 Min.) |
| ③ Aktualisierung des Vektorspeichers | `StartIngestionJob` | 1–15 Min. (abhängig von der Dokumentanzahl) |
| ④ Ablauf des Entscheidungs-Caches | TTL von `perm-cache` | Bis zu 5 Min. |

### Pfad B: Berechtigungsänderung auf Benutzerseite

| Schritt | Verantwortlich | Latenz |
|---------|----------------|--------|
| ① Änderung der AD-Gruppenmitgliedschaft | AD-Replikation | Üblicherweise innerhalb von 15 Min. |
| ② Aktualisierung von `user-access` | AD- / LDAP-Sync-Lambda. **Ausgelöst durch Cognito PostAuthentication / PostConfirmation; es gibt keine geplante Ausführung** | Bis zur nächsten Anmeldung des Benutzers (unbestimmt) |
| ③ Ablauf des Entscheidungs-Caches | TTL von `perm-cache` oder explizite Invalidierung über DynamoDB Streams von `user-access` | Bis zu 5 Min. |

Schritt ② von Pfad B kommt bei einem Benutzer mit fortbestehender Sitzung nie an. Für einen verlässlichen Entzug verwenden Sie das Notfall-Entzugsverfahren.

---

## Warum ACL-Änderungen nicht ankommen

Das Ändern der NTFS ACL einer Datei regeneriert `.metadata.json` in keiner Bereitstellungskonfiguration. Gegen die Implementierung geprüft:

| Mechanismus | Läuft bei einer ACL-Änderung? | Grundlage |
|-------------|-------------------------------|-----------|
| AD- / LDAP-Sync-Lambda | Nein | Weder ACL-Abruf noch Schreiben von `.metadata.json` ist implementiert. Abgerufen werden nur Benutzer-SIDs aus AD |
| Metadatenerzeugung von Transfer Family | Nein | Auslöser ist der Datei-Upload. Herkunft ist eine administratorseitig gepflegte DynamoDB-Zuordnung, die die ACL nicht konsultiert |
| Selbst betriebener Embedding-Server (`ENV_AUTO_METADATA=true`) | Nein | Die Wiederverarbeitung richtet sich nach `mtime`. Eine reine ACL-Änderung verändert `mtime` nicht |
| KB Auto-Sync | Nein | Der Abgleich erfolgt über `size` / `lastModified` / `ETag`. Eine ACL-Änderung verändert keines davon |
| FSx-Berechtigungsdienst (`lambda/permissions/fsx-permission-service.ts`) | Außerhalb des Umfangs | Code, der ACLs liest, ist vorhanden, wird jedoch von keinem CDK-Stack bereitgestellt |

**Konsequenz**: Damit eine ACL-Änderung in den Suchergebnissen wirkt, muss ein Betreiber `.metadata.json` neu erzeugen und auf dem S3 AP ablegen. Die Korrektheit dieses Index hängt vom Betrieb ab; die Übereinstimmung mit der ACL ist nicht automatisch gewährleistet. Für dringende Zugriffssperren handeln Sie auf der Benutzerseite (Löschen in `user-access` + Cache leeren + Sitzung invalidieren) statt an der ACL.

---

## Details der Schritte

### Aktualisierung des Vektorspeichers (KB-Resynchronisierung)

| Methode | Auslöser | Latenz | Hinweise |
|---------|----------|--------|----------|
| KB Auto-Sync | EventBridge Scheduler (Polling) | Konfiguriertes Intervall (Standard: 15 Min.) | Bei `enableKbAutoSync=true`. StartIngestionJob läuft nur bei erkannter Dateiänderung |
| Manuelle KB-Synchronisierung | AWS-Konsole / CLI | Startet sofort, Abschluss in Minuten | `aws bedrock-agent start-ingestion-job` |
| CloudTrail-Ereignis | S3 PutObject | Minuten | Auf dem Transfer Family-Pfad mit `enableCloudTrailIngestion=true` |

**Richtwerte für die KB-Synchronisierungsdauer:**

| Dokumentanzahl | Synchronisierungszeit (Richtwert) |
|----------------|-----------------------------------|
| bis 100 | 1–3 Min. |
| bis 1.000 | 5–15 Min. |
| bis 10.000 | 30–60 Min. |
| bis 100.000 | Stunden (inkrementelle Synchronisierung empfohlen) |

### Invalidierung des Berechtigungs-Caches

| Cache | TTL | Invalidierung | Hinweise |
|-------|-----|---------------|----------|
| DynamoDB `perm-cache` | 5 Min. | TTL-Ablauf / explizites Löschen über Streams von `user-access` | Cache der Filterergebnisse |
| DynamoDB `user-access` | Keine (persistent) | Erfordert eine explizite Aktualisierung | Benutzer-SID / Gruppen-SIDs |
| Browser-Sitzung | Während der Sitzung | Abmeldung / Sitzungsablauf | In-Memory-Cache im Frontend |

---

## Maximale Propagierungsverzögerung

| Ursprung | Maximale Verzögerung | Aufschlüsselung |
|----------|----------------------|-----------------|
| Änderung auf Dokumentseite (Pfad A, Auto-Sync alle 15 Min.) | ca. 35 Min. | 15 Min. Polling + 15 Min. KB-Sync + 5 Min. Cache |
| Änderung auf Dokumentseite (Auto-Sync alle 5 Min.) | ca. 25 Min. | 5 Min. Polling + 15 Min. KB-Sync + 5 Min. Cache |
| Änderung auf Dokumentseite (manuelle KB-Sync) | ca. 20 Min. | 15 Min. KB-Sync + 5 Min. Cache |
| Änderung auf Benutzerseite (Pfad B) | Nicht definierbar | 15 Min. AD-Replikation + bis zur nächsten Anmeldung (unbestimmt) + 5 Min. Cache |
| Notfall-Entzug (Verfahren unten) | Bis zu 5 Min. | Erzwungenes Leeren des Caches + Fail-Closed |
| Änderung der Datei-ACL | **Nicht definierbar** | Kein Mechanismus führt sie nach. Setzt die Neuerzeugung von `.metadata.json` durch einen Betreiber voraus |

Die 15 Min. für die KB-Synchronisierung hängen von der Dokumentanzahl ab (siehe Richtwerte oben). Bei 10.000 Dokumenten werden es 30–60 Min., und die Gesamtverzögerung wächst entsprechend.

---

## Notfall-Entzug von Berechtigungen

Wenn der Zugriff eines Benutzers sofort entzogen werden muss:

### Schritt 1: Benutzer-SIDs aus DynamoDB löschen (sofortige Wirkung)

```bash
# SID-Daten des Benutzers löschen → Fail-Closed verweigert alle Dokumente
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Schritt 2: Berechtigungs-Cache erzwungen leeren

```bash
# Cache-Einträge des Benutzers löschen
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

- Nach Schritt 1: neue Suchanfragen werden sofort für alle Dokumente verweigert (Fail-Closed)
- Nach Schritt 2: veraltete gecachte Berechtigungsdaten können nicht mehr verwendet werden
- Nach Schritt 3: die Sitzung des Benutzers selbst wird invalidiert

**Beachten Sie, dass dieses Verfahren die Benutzerseite stoppt, nicht die Dokumentseite.** Ein einzelnes Dokument vor einer einzelnen Person zu verbergen, läuft über die Aktualisierung von `.metadata.json` und die KB-Resynchronisierung und unterliegt damit der Latenz von Pfad A.

---

## Verhalten je Änderungsszenario

### Szenario 1: Änderung der Berechtigungsmetadaten eines Dokuments

```
Administrator entfernt die SID von User X aus der .metadata.json von Datei A
  → KB Auto-Sync erkennt die Differenz (ETag geändert)
  → StartIngestionJob aktualisiert die Metadaten im Vektorspeicher
  → Nach Ablauf der perm-cache-TTL wird Datei A aus den Suchen von User X ausgeschlossen
```

**Verzögerung**: bis zu ca. 35 Min. (Auto-Sync alle 15 Min.)

### Szenario 2: Änderung der AD-Gruppenmitgliedschaft

```
Administrator entfernt User X aus der Gruppe Engineering
  → AD-Replikation (~15 Min.)
  → Bei der nächsten Anmeldung von User X aktualisiert die AD-Sync-Lambda groupSIDs in user-access
  → Nach Ablauf von perm-cache werden Engineering-exklusive Dokumente ausgeschlossen
```

**Verzögerung**: AD-Replikation + bis zur nächsten Anmeldung (unbestimmt) + Cache-TTL. **Solange die Sitzung fortbesteht, wird nichts wirksam.** Wenn Unmittelbarkeit erforderlich ist, verwenden Sie das Notfall-Entzugsverfahren.

### Szenario 3: Dateiverschiebung (rename / move)

```
Administrator verschiebt Datei A von /public/ nach /confidential/
  → Geerbte Berechtigungen werden auf FSx neu berechnet (nur effektive Berechtigungen auf ONTAP-Seite)
  → .metadata.json folgt den Berechtigungen des Ziels nicht automatisch
  → Ein Betreiber muss .metadata.json neu erzeugen und ablegen
```

**Hinweis**: die zulässigen SIDs des Ursprungsorts bleiben erhalten, eine Verschiebung allein ändert die Sichtbarkeit in der Suche also nicht. Wenn die Verzeichnisstruktur als Berechtigungsgrenze dient, fassen Sie Verschiebung und Aktualisierung von `.metadata.json` zu einem Verfahren zusammen.

### Szenario 4: ACL-Massenänderung an einem übergeordneten Ordner

```
Administrator ändert die ACL von /confidential/ (Vererbung aktiv)
  → Effektive Berechtigungen ändern sich auf ONTAP für alle darunterliegenden Dateien
  → .metadata.json folgt nicht (siehe „Warum ACL-Änderungen nicht ankommen")
  → Neuerzeugung von .metadata.json für diese Dateien plus KB-Resynchronisierung ist erforderlich
```

**Hinweis**: Massenänderungen über viele Dateien verlängern die Resynchronisierung. Stufenweise Änderungen werden empfohlen.

---

## Konsistenzgarantien

**Die zeitbasierte Zugriffssteuerung (`enableAdvancedPermissions`) scheitert in zwei unterschiedliche Richtungen.** Ein Konfigurationsfehler — eine ungültige Zeitzone oder eine nicht als `HH:mm` lesbare Zeit — führt zu Fail-Open: die Zeitbeschränkung entfällt und der Zugriff wird erlaubt, um Nutzer nicht auszusperren. **Eine unlesbare Uhr wird dagegen abgelehnt**, denn eine Freigabe, ohne feststellen zu können, ob man innerhalb des Zeitfensters liegt, würde die Beschränkung stillschweigend aufheben. In beiden Fällen wird der SID-Vergleich separat angewandt; dieser Zweig schwächt die Entscheidung anhand des Berechtigungsindex nie.

| Ebene | Garantie | Implementierung |
|-------|----------|-----------------|
| **Fail-Closed** | Alles verweigern, wenn SID-Informationen nicht abgerufen werden können | Bei DynamoDB-Fehler / fehlendem Datensatz |
| **Eventually Consistent** | Änderungen der Berechtigungsmetadaten (`.metadata.json` / `user-access`) erreichen die Suchergebnisse letztlich | KB Auto-Sync + Cache-TTL + Streams-Invalidierung |
| **No False Positive** | Dokumente ohne Berechtigung werden nicht angezeigt | SID-Abgleich (Schnittmenge) |
| **Metadata Required** | Dokumente ohne Metadaten werden ausgeschlossen | `.metadata.json` erforderlich |
| **Kein ACL-Nachziehen** | ACL-Änderungen an Dateien werden nicht automatisch wirksam | Setzt die Neuerzeugung von `.metadata.json` durch einen Betreiber voraus |

### Hinweis: mögliche False Negatives

In den folgenden Fällen erscheint ein Dokument, auf das der Benutzer Anspruch hat, zeitweise nicht (False Negative):

- Unmittelbar nach einer Vergabe (`.metadata.json` noch nicht aktualisiert oder vor der KB-Resynchronisierung)
- Während der KB-Synchronisierung (veraltete Metadaten noch vorhanden)
- Während einer AD-Replikationsverzögerung oder bevor sich der Benutzer erneut anmeldet

**Designhaltung**: aus Sicherheitsgründen werden False Negatives (etwas Sichtbares ist nicht sichtbar) akzeptiert, und False Positives (etwas Unsichtbares wird sichtbar) werden auf Null angestrebt.

Diese Haltung **setzt jedoch voraus, dass der Berechtigungsindex korrekt ist.** Wurde eine ACL eingeschränkt, `.metadata.json` aber nicht aktualisiert, liefert der Index weiterhin eine Erlaubnis — ein False Positive. Die Pflege des Index ist die Grenze selbst.

---

## Empfohlene Überwachung und Alarme

```yaml
# Empfohlene CloudWatch-Alarme
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # hohe Miss-Rate = häufige Aktualisierung der Berechtigungsdaten

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # Alarm nach 3 aufeinanderfolgenden Fehlern

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # sofortiger Alarm bei fehlgeschlagener SID-Auflösung

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # häufige Fail-Closed-Auslösungen erfordern eine Untersuchung
```

---

## Zugehörige Dokumente

| Dokument | Inhalt |
|----------|--------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Details zum Design der SID-Filterung |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checkliste für die Produktionsreife |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Leistungs- und Kapazitätsdesign für FSx for ONTAP |
