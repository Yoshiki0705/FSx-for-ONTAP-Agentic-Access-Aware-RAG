# PoC-Workshop-Leitfaden (90 Minuten)

**🌐 Language:** [日本語](../poc-workshop-guide.md) | [English](../en/poc-workshop-guide.md) | [한국어](../ko/poc-workshop-guide.md) | [简体中文](../zh-CN/poc-workshop-guide.md) | [繁體中文](../zh-TW/poc-workshop-guide.md) | [Français](../fr/poc-workshop-guide.md) | **Deutsch** | [Español](../es/poc-workshop-guide.md)

**Erstellungsdatum**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Lösungsarchitekten, Partner-Ingenieure, Kunden-Cloud-Teams

---

## Überblick

In diesem Workshop wird das Permission-aware Agentic RAG-System in 90 Minuten bereitgestellt und die Funktionsweise der berechtigungsbasierten Suche praktisch erfahren.

---

## Voraussetzungen

| Element | Anforderung |
|---------|-------------|
| AWS-Konto | Berechtigungen entsprechend AdministratorAccess |
| AWS CLI | v2 konfiguriert (`aws sts get-caller-identity` muss erfolgreich sein) |
| Node.js | 22 oder höher |
| Docker | Gestartet (`docker info` muss erfolgreich sein) |
| CDK Bootstrap | Falls noch nicht durchgeführt, wird es im Workshop ausgeführt |
| Bedrock-Modellzugriff | Claude Haiku / Sonnet, Titan Embed v2 aktiviert |

---

## Agenda

| Zeit | Abschnitt | Inhalt |
|------|-----------|--------|
| 0:00–0:10 | 0. Einführung | Architekturübersicht, Anwendungsfall-Erklärung |
| 0:10–0:40 | 1. Umgebungsbereitstellung | Klonen, Abhängigkeiten, Bootstrap, Bereitstellung |
| 0:40–0:55 | 2. Demo-Daten-Import | Benutzererstellung, Testdokument-Platzierung |
| 0:55–1:15 | 3. Berechtigungsbasierter RAG-Test | Suche mit verschiedenen Benutzern, Ergebnisvergleich |
| 1:15–1:25 | 4. Enterprise-Leitfaden-Überprüfung | Produktionsreife-Checkliste, Bewertungsvorlage |
| 1:25–1:30 | 5. Aufräumen | Ressourcenlöschung, Kostenüberprüfung |


---

## 0. Einführung (10 Minuten)

### Das Problem, das dieses System löst

```
Herkömmliches RAG:
  Unternehmensdateien → Alle Dokumente an KI übergeben → Jeder hat Zugriff auf alle Informationen
  → Berechtigungsgrenzen verschwinden → Risiko der Offenlegung vertraulicher Daten

Permission-aware RAG:
  Unternehmensdateien → Bestehende ACLs beibehalten → Sichtbare Dokumente unterscheiden sich je Benutzer
  → KI-Nutzung unter Wahrung der Berechtigungen → Vereinbarkeit von Sicherheit und Benutzerfreundlichkeit
```

### Architektur (für Whiteboard)

```
Benutzer → CloudFront → Lambda (Next.js)
                              ↓
                    Bedrock KB Retrieve API
                              ↓
                    SID-Filterung (Anwendungsseite)
                              ↓
                    Antwortgenerierung nur mit autorisierten Dokumenten
```

---

## 1. Umgebungsbereitstellung (30 Minuten)

### Schritt 1.1: Repository klonen

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Schritt 1.2: CDK Bootstrap

```bash
# Hauptregion
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# Für WAF (CloudFront erfordert us-east-1)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Schritt 1.3: Konfigurationsdatei erstellen

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **Hinweis**: Passen Sie `allowedCountries` an das Land der Teilnehmer an.

### Schritt 1.4: Docker-Image vorbereiten & Bereitstellen

```bash
# Docker-Image erstellen
bash demo-data/scripts/pre-deploy-setup.sh

# Bereitstellung (ca. 30 Minuten)
npx cdk deploy --all --require-approval never
```

> Während der Bereitstellung können Sie die Erklärung des nächsten Abschnitts durchführen, um die Zeit effektiv zu nutzen.

---

## 2. Demo-Daten-Import (15 Minuten)

### Schritt 2.1: Testbenutzer & Daten erstellen

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Dieses Skript führt Folgendes aus:
- Erstellung von Cognito-Testbenutzern (admin@example.com, user@example.com)
- Registrierung von SID-Daten in DynamoDB
- Upload von Testdokumenten + `.metadata.json` nach S3
- Synchronisation der Bedrock KB-Datenquelle

### Schritt 2.2: Zugriffs-URL abrufen

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. Berechtigungsbasierter RAG-Test (20 Minuten)

### Test 1: Anmeldung als Administrator

1. Auf die CloudFront-URL zugreifen
2. Anmeldung mit `admin@example.com` / Passwort (Ausgabe von post-deploy-setup.sh prüfen)
3. Frage stellen: „Erzählen Sie mir über den Umsatz des Unternehmens"
4. **Erwartetes Ergebnis**: Antwort mit Umsatzinformationen von 15 Milliarden Yen (Referenz auf vertrauliches Dokument)

### Test 2: Anmeldung als allgemeiner Benutzer

1. Abmelden
2. Anmeldung mit `user@example.com`
3. Gleiche Frage: „Erzählen Sie mir über den Umsatz des Unternehmens"
4. **Erwartetes Ergebnis**: Keine Umsatzinformationen (nur öffentliche Dokumente referenziert)

### Test 3: Agent-Modus

1. Modustoggle im Header auf „Agent" umschalten
2. Frage stellen: „Fassen Sie den Inhalt des Produktkatalogs zusammen"
3. **Erwartetes Ergebnis**: Agent verwendet KB-Suchtool und antwortet innerhalb des Berechtigungsbereichs

### Überprüfungspunkte

- [ ] Gleiche Frage liefert unterschiedliche Antworten
- [ ] Zugriffsebenen-Badges werden in den Zitaten angezeigt
- [ ] Zitate vertraulicher Dokumente werden dem allgemeinen Benutzer nicht angezeigt

---

## 4. Enterprise-Leitfaden-Überprüfung (10 Minuten)

Folgende Dokumente den Teilnehmern vorstellen:

| Dokument | Überprüfungspunkte |
|----------|-------------------|
| [Produktionsreife-Checkliste](production-readiness-checklist.md) | Reifegrade Demo/PoC/Produktion |
| [Bewertungsvorlage](evaluation.md) | Einseitige Zusammenfassung des PoC-Bewertungsberichts |
| [Leitfaden für sicheres Experimentieren](safe-experimentation-guide.md) | Checkliste vor Einspeisung realer Daten |
| [Bedrohungsmodell](threat-model.md) | 10 Bedrohungskategorien und Gegenmaßnahmen-Zuordnung |

---

## 5. Aufräumen (5 Minuten)

```bash
# Alle Ressourcen löschen
npx cdk destroy --all --force
```

> **Hinweis**: Die Löschung von FSx for ONTAP dauert 10–15 Minuten. Überprüfen Sie den Löschstatus in der AWS-Konsole auch nach Abschluss des Befehls.

### Kostenüberprüfung

```bash
# Verbleibende Ressourcen prüfen
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## Erfolgskriterien

| Kriterium | Überprüfungsmethode |
|-----------|-------------------|
| Umgebung wurde erfolgreich bereitgestellt | CloudFront-URL ist erreichbar |
| Verschiedene Benutzer erhalten unterschiedliche Antworten | Vergleich von Test 1 und Test 2 |
| Berechtigungsverweigerungsszenario funktioniert mit Fail-Closed | Vertrauliche Informationen werden dem allgemeinen Benutzer nicht angezeigt |
| Auditprotokolle werden generiert | Suchprotokolle in CloudWatch Logs aufgezeichnet |
| Aufräumen ist abgeschlossen | Keine verbleibenden Ressourcen |

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| CDK Bootstrap fehlgeschlagen | AWS CLI-Anmeldeinformationen prüfen. Ist `aws sts get-caller-identity` erfolgreich? |
| Docker-Build fehlgeschlagen | Prüfen, ob Docker gestartet ist. `docker info` |
| Bereitstellung dauert über 40 Minuten | FSx for ONTAP-Erstellung dauert 20–30 Minuten, das ist normal |
| Anmeldung nicht möglich | Prüfen, ob Cognito-Benutzer erstellt wurden. Ausgabe von `post-deploy-setup.sh` prüfen |
| Suchergebnisse sind 0 | Prüfen, ob KB-Synchronisation abgeschlossen ist. Einige Minuten warten und erneut versuchen |

---

## Nächste Schritte

Nach Abschluss des Workshops folgende Punkte in Betracht ziehen:

1. **PoC mit realen Daten**: Reale Daten gemäß [Leitfaden für sicheres Experimentieren](safe-experimentation-guide.md) einspeisen
2. **Bewertung**: PoC-Ergebnisse mit der [Bewertungsvorlage](evaluation.md) quantitativ bewerten
3. **Produktionsüberlegungen**: Erforderliche Maßnahmen mit der [Produktionsreife-Checkliste](production-readiness-checklist.md) prüfen

---

## Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [README.md](../README.md) | Systemgesamtbild, Bereitstellungsverfahren |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Leitfaden für sicheres Experimentieren |
| [evaluation.md](evaluation.md) | RAG / Agent-Bewertungsmetriken |
| [threat-model.md](threat-model.md) | Bedrohungsmodell |