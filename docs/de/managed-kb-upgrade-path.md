# Amazon Bedrock Managed Knowledge Base Upgrade-Pfad (Validierungsverfahren)

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | [English](../en/managed-kb-upgrade-path.md) | [한국어](../ko/managed-kb-upgrade-path.md) | [简体中文](../zh-CN/managed-kb-upgrade-path.md) | [繁體中文](../zh-TW/managed-kb-upgrade-path.md) | [Français](../fr/managed-kb-upgrade-path.md) | **Deutsch** | [Español](../es/managed-kb-upgrade-path.md)

**Erstellungsdatum**: 2026-06-18
**Zielregion**: ap-northeast-1 (Tokio) — Managed KB ist in der Region Tokio verfügbar (GA 2026-06-17)
**Status**: Validierungsverfahrensdokument (Migration nicht implementiert / bestehender Pfad beibehalten)
**Verwandt**: [Managed KB Migrationsbewertung](managed-kb-migration-evaluation.md) (Entscheidungskriterien / Kompromisse)

---

## 0. Zweck dieses Dokuments

Dieses Dokument übersetzt die in der [Managed KB Migrationsbewertung](managed-kb-migration-evaluation.md) organisierten Verifizierungspunkte in **umsetzbare Validierungsverfahren**. Beziehen Sie sich für die Diskussion der Entscheidungskriterien und Kompromisse auf das Migrationsbewertungsdokument; dieses Dokument konzentriert sich auf das „Wie validieren".

Wichtige Annahmen:

- Dieses Dokument ist ein **Leitfaden für Validierungsverfahren** und empfiehlt keine sofortige Migration.
- Der bestehende Pfad (Bedrock KB + OpenSearch Serverless / S3 Vectors) wird **nicht entfernt**. Dies ist eine zusätzliche Validierung einer parallelen Option.
- Managed KB ist nicht „überlegen" gegenüber dem konventionellen KB. Es ist eine Wahl des **richtigen Werkzeugs für die Aufgabe**; ob es die Hauptanforderung dieses Projekts, das Permission-aware RAG (strikte ACL-Durchsetzung), erfüllen kann, bestimmt die Migrationsfähigkeit.
- Die Evidenzstufen des untenstehenden Inhalts sind wie folgt klassifiziert.

| Stufe | Definition | Behandlung in diesem Dokument |
|-------|-----------|-------------------------------|
| Public evidence | Aus offizieller AWS-Dokumentation / Blogs verifizierbar | Mit Quellenlinks zitiert |
| Project-context expectation | Designentscheidungen / Erwartungen innerhalb dieses Projekts (nicht öffentlich verifizierbar) | Explizit als „Projektannahme" gekennzeichnet |

> ⚠️ **Validation Required**: Die Verfahren in diesem Dokument enthalten die **Annahme**, dass das offizielle AWS-Tutorial ([für konventionelles KB](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)) für Managed KB neu interpretiert wird. Ob der S3-Konnektor von Managed KB den FSx for ONTAP S3 Access Point erkennt, ist offiziell nicht bestätigt, und die Validierung V1 muss dies zuerst verifizieren.

---

## 1. Validierungsüberblick

Die Validierung für die Migrationsfähigkeitsentscheidung besteht aus den folgenden 3 Phasen. Jede Phase setzt den Erfolg der vorherigen voraus.

```
Phase A: Verbindungsvalidierung (V1, V2)
  └─ Kann S3 AP als Datenquelle verwendet werden / werden Metadaten beibehalten
       │ PASS
       ▼
Phase B: Autorisierungsvalidierung (V3, V4, V5)
  └─ Funktioniert der ACL-Filter / wird er über Multi-Hop beibehalten / Propagierungslatenz
       │ PASS
       ▼
Phase C: Audit- und Betriebsvalidierung (V6, V7)
  └─ Lineage-Aufzeichnung / ACL auf Konversationsverlauf und Cache
       │ PASS
       ▼
Migrationsfähigkeitsentscheidung (→ Migrationsbewertungsdokument §5)
```

> Jede Phase wird gegen ein **mit FlexClone erstelltes Validierungsvolume, nicht gegen Produktionsdaten** durchgeführt (siehe §4).

---

## 2. Phase A: Validierung der S3 Access Point-Datenquellenverbindung

### 2.1 Validierung V1: Erkennt der S3-Konnektor die S3 AP-URI?

⚠️ **Validation Required**: Das offizielle Tutorial bezieht sich auf das konventionelle KB, und ob der S3-Konnektor von Managed KB die URI im Alias-Format von S3 AP akzeptiert, ist nicht bestätigt.

**Voraussetzungen**:

1. Ein Validierungsvolume mit FlexClone erstellen (Verfahren in §4)
2. Einen S3 Access Point für das Validierungsvolume erstellen (auf die Logik im bestehenden `setup-kb-datasource.sh` beziehen)
3. Den S3 AP-Alias bestätigen (Format: `<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` oder ARN)

**Validierungsverfahren**:

```bash
# 1. Ein Managed KB erstellen (verwalteter Vektorspeicher)
#    ⚠️ Das Folgende ist ein angenommener Befehl. Überprüfen Sie die genauen Managed-KB-API-Parameter in der GA-Dokumentation
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ Die Art der Spezifikation des verwalteten Speichers muss bestätigt werden

# 2. Den S3-Konnektor als Datenquelle hinzufügen und die S3 AP-URI angeben
#    Kern der Validierung: ob das Alias- / ARN-Format von S3 AP akzeptiert wird
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ Ob dies akzeptiert wird, ist die Essenz von V1
    }
  }'
```

**Beurteilungskriterien**:

| Ergebnis | Beurteilung | Nächste Aktion |
|----------|-------------|----------------|
| S3 AP ARN/Alias akzeptiert, Synchronisierung erfolgreich | ✅ PASS | Weiter zu V2 |
| S3 AP nicht möglich, aber ein normaler S3-Bucket funktioniert | △ Bedingt | Einen DataSync-basierten S3-Relay-Pfad erwägen (zusätzliche Validierung für ACL-Metadaten-Erhaltung erforderlich) |
| Die Synchronisierung des S3-Konnektors selbst schlägt fehl | ❌ FAIL | Migration nicht machbar. Aktuelle Konfiguration beibehalten |

> **Projektannahme**: Wir gehen davon aus, dass die Verbindung möglich ist, wenn die S3-kompatible API funktioniert, aber S3 AP-spezifische Einschränkungen (wie die in der [FSx ONTAP S3 AP-Kompatibilitätsmatrix](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md) erwähnte ListObjectsV2-Latenz) den Crawler von Managed KB beeinträchtigen können.

### 2.2 Validierung V2: Metadaten-Erhaltung

**Validierungsverfahren**:

1. `.metadata.json` (mit `allowed_group_sids`) auf dem Validierungsvolume platzieren
2. Die Managed-KB-Synchronisierung ausführen
3. Ein Dokument über die `Retrieve`-API abrufen und prüfen, ob die Metadaten in der Antwort enthalten sind

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "Testabfrage"}' \
  --region ap-northeast-1
# Prüfen, ob das metadata-Feld der Antwort allowed_group_sids enthält
```

**Beurteilungskriterien**:

| Ergebnis | Beurteilung |
|----------|-------------|
| `allowed_group_sids` wird als Metadaten beibehalten und ist abrufbar | ✅ PASS → Weiter zu Phase B |
| Metadaten fehlen oder werden in ein anderes Format konvertiert | ❌ FAIL → ACL-Filter unmöglich. Aktuelle Konfiguration beibehalten |

> ⚠️ Wie das Smart Parsing von Managed KB Metadaten behandelt, ist nicht bestätigt. Überprüfen Sie, ob der `.metadata.json`-Sidecar-Ansatz genauso funktioniert wie beim konventionellen KB, oder ob eine andere Metadaten-Zuweisungsmethode (Konnektorattribute usw.) erforderlich ist.

---

## 3. Phase B: Validierung der Permission-aware-RAG-Designherausforderung

Der Hauptzweck dieses Projekts ist Permission-aware RAG, und die strikte ACL-Durchsetzung ist eine nicht verhandelbare Anforderung. Sofern die Validierung der Phase B nicht erfüllt wird, bleibt die Beibehaltung der aktuellen Konfiguration die Standardrichtlinie.

### 3.1 Invariante mit dem bestehenden Ansatz

Die aktuelle Implementierung verwendet einen [vektorspeicher-unabhängigen Ansatz](s3-vectors-sid-architecture-guide.md).

```
Bedrock KB Retrieve → Suchergebnisse + allowed_group_sids
→ Anwendungsseite (route.ts) gleicht Benutzer-SID ∩ Dokument-SID ab (Fail-Closed)
→ Nur übereinstimmende Dokumente gehen an die Converse API
```

**Bei der Migration beizubehaltende Invariante**: „Finale Autorisierung auf Anwendungsseite erzwingen und alles ablehnen, wenn der SID-Abruf unmöglich ist (Fail-Closed)." Verifizieren Sie, dass Managed KB diese Invariante nicht bricht.

### 3.2 Validierung V3: SID-Array-Abgleich über `listContains`

Gemäß der [AgentCore Gateway Connector-Target-Dokumentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html) unterstützt das `Retrieve`-Tool von Managed KB den Operator `listContains` in `managedSearchConfiguration.filter` (aus der Quelle zusammengefasst).

**Validierungsverfahren**:

```bash
# Nur Dokumente abrufen, bei denen die SID des Benutzers im allowed_group_sids-Array ist
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "Test für vertrauliches Dokument"}' \
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

**Beurteilungskriterien**:

| Testfall | Erwartetes Ergebnis |
|----------|---------------------|
| Dokument, bei dem die Benutzer-SID im Array ist | Abgerufen |
| Dokument, bei dem die Benutzer-SID nicht im Array ist | Ausgeschlossen |
| Dokument ohne `allowed_group_sids` | Ausgeschlossen (Fail-Closed) |

> ⚠️ **Wichtig**: Auch wenn `listContains` auf der Retrieval-Schicht filtert, ist das Designprinzip dieses Projekts die **Re-Autorisierung auf Anwendungsseite**. Wir empfehlen eine zweischichtige Verteidigung, die den Managed-KB-Filter als „Primärfilter" verwendet und gleichzeitig die finale Autorisierung auf Anwendungsseite beibehält (nicht allein vom Filter abhängen).

### 3.3 Validierung V4: Filter-Beibehaltung während des Agentic-Retrieval-Multi-Hop

Dies ist das größte Managed-KB-spezifische Risiko. `AgenticRetrieveStream` zerlegt eine Abfrage in Unterabfragen und iteriert mehrere Suchen. **Wenn der Metadatenfilter nicht bei jedem Hop beibehalten wird, können nicht autorisierte Daten an einem Zwischenschritt eindringen.**

**Validierungsverfahren**:

1. Eine komplexe Abfrage vorbereiten, die das Überspannen mehrerer Dokumente mit unterschiedlichen Berechtigungen erfordert (z. B. „Vergleiche das vertrauliche Designdokument der Abteilung A mit der öffentlichen Spezifikation")
2. `AgenticRetrieveStream` als Benutzer ausführen, der nicht auf das nicht autorisierte Dokument (vertraulich der Abteilung A) zugreifen kann
3. Die Trace jedes Hops (CloudWatch / Zwischenschritte in der Antwort) inspizieren und verifizieren, dass das nicht autorisierte Dokument **bei keinem Hop referenziert wird**

**Beurteilungskriterien**:

| Ergebnis | Beurteilung |
|----------|-------------|
| `userContext` / Filter bei allen Hops angewendet, keine nicht autorisierten Daten referenziert | ✅ PASS |
| Filter fällt bei einem Zwischenhop weg und nicht autorisierte Daten mischen sich | ❌ FAIL → Multi-Hop deaktivieren, nur einzelnes `Retrieve` verwenden |

> ⚠️ **Validation Required**: Die Filter-Propagierung zu jedem Multi-Hop-Schritt ist nicht offiziell dokumentiert. Wenn sie bei der Validierung nicht bestätigt werden kann, beschränken Sie sich auf einzelnes `Retrieve` + Abgleich auf Anwendungsseite ohne `AgenticRetrieveStream` (ACL-Garantien priorisieren, auch auf Kosten des Verzichts auf den Multi-Hop-Vorteil).

### 3.4 Validierung V5: Propagierungslatenz von Berechtigungsänderungen / -löschungen

**Validierungsverfahren**:

1. Die SID eines Benutzers aus einer Gruppe entfernen (oder das `allowed_group_sids` eines Dokuments ändern)
2. Nach Abschluss der Managed-KB-Synchronisierung als dieser Benutzer erneut suchen
3. Die Latenz messen, bis die Daten mit der alten Berechtigung nicht mehr zurückgegeben werden

**Beurteilungskriterien**: Ob die Propagierungslatenz innerhalb des im [Berechtigungskonsistenzmodell](permission-consistency.md) dieses Projekts definierten akzeptablen Bereichs liegt. Bei Überschreitung muss das Design den Notfallwiderruf separat über die Cache-Invalidierung auf Anwendungsseite garantieren.

---

## 4. Sicheres Validierungsmuster mit FlexClone

Produktionsdaten dürfen niemals zu einem direkten Crawl-Ziel von Managed KB gemacht werden. Erstellen Sie ein produktionsäquivalentes Validierungsvolume mit FlexClone und validieren Sie in einer isolierten Umgebung.

### 4.1 Warum FlexClone

| Aspekt | Direkter Produktionszugriff | FlexClone-Validierung |
|--------|------------------------------|------------------------|
| Auswirkung auf Produktions-E/A | Crawl-Last beeinträchtigt Geschäftsworkloads | Keine Auswirkung (Klon ist unabhängig) |
| Datenkonsistenz | Mögliche Inkonsistenz durch Aktualisierungen während des Crawls | Konsistent zu einem Zeitpunkt |
| Reproduzierbarkeit der Validierung | Schwer zu reproduzieren aufgrund von Produktionsdatenänderungen | Beliebig oft aus demselben Snapshot reproduzierbar |
| Unfallrisiko | Risiko fehlerhafter Schreibvorgänge auf Produktionsdaten | Klon ist verwerfbar |
| Kosten | — | Nur Snapshot-Delta (anfangs wenige MB) |

### 4.2 Verfahren zur Erstellung des Validierungsklons

```bash
# 1. Einen Snapshot des Produktionsvolumes erstellen (ONTAP REST API / CLI)
#    ⚠️ Auf den ONTAP-Management-Endpunkt von innerhalb des VPC zugreifen
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. Einen FlexClone aus dem Snapshot erstellen
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

# 3. Einen S3 Access Point für das Klonvolume erstellen
#    (Die Logik des bestehenden setup-kb-datasource.sh für die Validierung wiederverwenden)

# 4. Nach Abschluss der Validierung den Klon zerstören (keine Auswirkung auf die Produktion)
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> Für die genauen ONTAP-REST-API-Parameter beziehen Sie sich auf den Abschnitt ONTAP-Operationen des [Betriebs-Runbooks](operations-runbook.md). Folgen Sie den Produktionsverfahren für SSH-Schlüssel- / Management-Endpunkt-Informationen.

### 4.3 Isolationsprinzipien der Validierungsumgebung

- Das Validierungs-Managed-KB als **separate Ressource** vom Produktions-KB erstellen; die Produktions-KB-ID nicht ändern
- Der Validierungs-S3-AP zeigt nur auf den Validierungsklon (referenziert nicht das Produktionsvolume)
- Die Validierungs-IAM-Rolle mit **geringsten Rechten** auf die Validierungsressourcen beschränken (keinen Lesezugriff auf Produktionsdaten gewähren)
- Nach Abschluss der Validierung den gesamten Klon / KB / S3 AP / die IAM-Rolle zerstören

---

## 5. Audit- und Lineage-Validierung (Phase C / Optional)

⚠️ **Validation Required**: Ob der Zugriff über Managed KB im Unity-Catalog-Lineage des Integrationsziels ([fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)) aufgezeichnet wird, ist nicht bestätigt.

**Validierungsaspekte**:

- Ob `Retrieve` / `AgenticRetrieveStream`-Aufrufe von Managed KB in CloudTrail aufgezeichnet werden
- Ob „wer, wann, Information aus welchem Dokument, in welcher Antwort verwendet hat" nachverfolgbar ist
- Ob die ACL-Anwendung auf Konversationsverlauf / Cache auf Anwendungsseite beibehalten wird (da das Cache-Verhalten auf verwalteter Seite unbekannt ist, es explizit auf Anwendungsseite steuern)

Für Details der Audit-Anforderungen siehe [Governance- und Audit-Design](governance-and-audit.md).

---

## 6. Validierungs-Checkliste (Zusammenfassung)

Erfüllen Sie alle folgenden Punkte vor der Migrationsfähigkeitsentscheidung.

- [ ] **V1**: S3-Konnektor erkennt FSx ONTAP S3 AP (Phase A)
- [ ] **V2**: `allowed_group_sids` wird als Metadaten beibehalten (Phase A)
- [ ] **V3**: `listContains`-SID-Array-Abgleich funktioniert (Phase B)
- [ ] **V4**: Filter wird während des Agentic-Retrieval-Multi-Hop beibehalten (Phase B)
- [ ] **V5**: Propagierungslatenz von Berechtigungsänderungen / -löschungen im akzeptablen Bereich (Phase B)
- [ ] **V6**: In CloudTrail / Lineage aufgezeichnet (Phase C)
- [ ] **V7**: ACL-Anwendung auf Konversationsverlauf / Cache beibehalten (Phase C)
- [ ] Gesamte Validierung auf einem **FlexClone-Validierungsvolume** durchgeführt (keine Produktionsauswirkung)
- [ ] Fail-Closed-Re-Autorisierungs-Invariante auf Anwendungsseite beibehalten

> Wenn ein Punkt FEHLSCHLÄGT, bleibt **die Beibehaltung der aktuellen Konfiguration (OpenSearch Serverless / S3 Vectors)** die Standardrichtlinie, sofern es keine Designergänzung gibt, die dieses Risiko tolerieren kann. Die Integration von Managed KB in den CDK-Stack beginnt erst, nachdem die gesamte Validierung erfüllt ist.

---

## 7. Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [Managed KB Migrationsbewertung](managed-kb-migration-evaluation.md) | Entscheidungskriterien / Kompromisse / Vergleich der bestehenden Konfiguration |
| [CDK-Stack-Architekturleitfaden](stack-architecture-comparison.md) | Vergleich der Vektorspeicher-Konfigurationen (inkl. Managed-KB-Spalte) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID-Filterungsdesign |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | Vektorspeicher-unabhängiger Autorisierungsansatz |
| [Berechtigungskonsistenzmodell](permission-consistency.md) | ACL-Änderungspropagierungsfluss / akzeptable Latenz |
| [Governance- und Audit-Design](governance-and-audit.md) | Audit-Log- / Lineage-Anforderungen |
| [Betriebs-Runbook](operations-runbook.md) | ONTAP-Operationen (FlexClone-Erstellungsverfahren) |

---

## Referenzlinks

- [Ankündigung der GA von Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [Offizielles AWS-Tutorial (konventionelles KB)](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [AgentCore Gateway Connector-Target (Managed KB)](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> Der Inhalt wurde zur Einhaltung von Lizenzbeschränkungen umformuliert. Offizielle AWS-Informationen werden zusammengefasst und umschrieben, wobei die Absicht der Quellen erhalten bleibt.
