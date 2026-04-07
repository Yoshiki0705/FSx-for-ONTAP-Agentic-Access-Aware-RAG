# Lokale Entwicklungsanleitung

Schritte zur Überprüfung und Entwicklung der Next.js-Anwendungs-UI ohne AWS-Umgebung (Cognito / DynamoDB / Bedrock).

Die Authentifizierungs-Middleware (JWT-Verifizierung, CSRF-Schutz, i18n-Routing) wird nicht umgangen — sie läuft mit dem gleichen Ablauf wie in der Produktion.

---

## Voraussetzungen

| Tool | Version | Prüfbefehl |
|------|---------|------------|
| Node.js | 22 oder höher | `node -v` |
| npm | 10 oder höher | `npm -v` |

Docker ist nicht erforderlich (eine Docker-basierte Methode wird ebenfalls unten beschrieben).

---

## Methode 1: npm run dev (am einfachsten)

### 1. Abhängigkeiten installieren

```bash
cd docker/nextjs
npm install
```

### 2. Umgebungsvariablen vorbereiten

```bash
cp .env.development .env.local
```

`.env.local` wird nicht von Git verfolgt. Alle Werte sind sichere Dummy-Werte.

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Öffnen Sie http://localhost:3000 im Browser.

### 4. Anmelden

Die Middleware leitet automatisch zur Anmeldeseite (`/de/signin`) weiter. Melden Sie sich mit einem der Demo-Benutzer unten an.

| Benutzername | Passwort | Rolle | Berechtigungen |
|-------------|----------|-------|----------------|
| `admin` | `admin123` | administrator | Vollzugriff |
| `developer` | `dev123` | developer | Lesen/Schreiben + Agent-Erstellung |
| `user` | `user123` | user | Nur Lesen |

### Funktionsweise

```
Browser → http://localhost:3000
  ↓ Middleware: kein JWT → Weiterleitung zu /de/signin
  ↓ Anmeldeformular absenden
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID nicht gesetzt → Authentifizierung mit Demo-Benutzer
  ↓   JWT ausstellen → session-token Cookie setzen
  ↓ Middleware: JWT gültig → Seite anzeigen
```

Es wird keine Verbindung zu Cognito oder DynamoDB hergestellt. JWT-Signierung und -Verifizierung verwenden dieselbe `jose`-Bibliothek wie in der Produktion, sodass der Authentifizierungsablauf der Middleware vollständig produktionsäquivalent ist.

### Einschränkungen

| Funktion | Status | Grund |
|----------|--------|-------|
| Anmelden / Abmelden | ✅ Funktioniert | Nur JWT-Ausstellung und Cookie-Verwaltung |
| Seitennavigation / Auth-Guard | ✅ Funktioniert | Middleware JWT-Verifizierung |
| Sprachwechsel | ✅ Funktioniert | next-intl (8 Sprachen) |
| Dunkelmodus | ✅ Funktioniert | Zustand + localStorage |
| Karten-UI / Layout | ✅ Funktioniert | Statische Komponenten |
| RAG-Suche (KB/Agent) | ❌ Nicht verfügbar | Erfordert Bedrock |
| Sitzungspersistenz | ❌ Nicht verfügbar | Erfordert DynamoDB |
| Benutzerberechtigungen (SID) | ❌ Nicht verfügbar | Erfordert DynamoDB + FSx |

> Wenn Sie Sitzungspersistenz benötigen, verwenden Sie Methode 2 (Docker Compose + DynamoDB Local).

---

## Methode 2: Docker Compose (mit DynamoDB Local)

Eine Methode mit Sitzungspersistenz über DynamoDB Local.

### Zusätzliche Voraussetzungen

- Docker / Docker Compose

### 1. Starten

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

Folgende Dienste starten automatisch:

| Dienst | Port | Beschreibung |
|--------|------|-------------|
| app | 3000 | Next.js-Entwicklungsserver (Hot Reload) |
| dynamodb-local | 8000 | DynamoDB Local (In-Memory) |
| dynamodb-setup | — | Automatische Sitzungstabellen-Erstellung (nur beim Start) |

### 2. Zugriff

Öffnen Sie http://localhost:3000 und melden Sie sich mit denselben Demo-Benutzern wie bei Methode 1 an.

### 3. Stoppen

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local läuft im In-Memory-Modus, Sitzungsdaten gehen beim Stoppen verloren.

---

## Funktionen der Anmeldeseite

Die Anmeldeseite enthält folgende Steuerelemente:

- Sprachauswahl (oben rechts): Zwischen 8 Sprachen wechseln. Die gewählte Sprache wird nach der Anmeldung beibehalten.
- Dunkelmodus-Umschalter (oben rechts): Zwischen Hell/Dunkel wechseln. Wird nach der Anmeldung beibehalten.

---

## Moduswechsel und Sprach-/Theme-Vererbung

| Übergang | Sprache | Theme |
|----------|---------|-------|
| Anmeldung → Hauptbildschirm | ✅ URL-Locale beibehalten | ✅ localStorage beibehalten |
| KB-Modus ↔ Agent-Modus | ✅ URL-Locale beibehalten | ✅ localStorage beibehalten |
| Hauptbildschirm → Agent-Verzeichnis | ✅ URL-Locale beibehalten | ✅ localStorage beibehalten |
| Agent-Verzeichnis → KB-Modus | ✅ URL-Locale beibehalten | ✅ localStorage beibehalten |

Die Sprache wird über das URL-Locale-Präfix (`/en/genai`, `/de/genai` usw.) verwaltet und bleibt bei allen Seitenübergängen erhalten. Das Theme wird über einen Zustand-Store (localStorage-Persistenz) auf allen Seiten geteilt.

---

## Fehlerbehebung

### Port 3000 ist belegt

```bash
lsof -i :3000
kill -9 <PID>
```

### Anmeldung nicht möglich

Überprüfen Sie, dass `.env.local` existiert und `COGNITO_CLIENT_ID` nicht gesetzt ist. Wenn es gesetzt ist, wird die Cognito-Authentifizierung versucht und schlägt fehl.

```bash
# Prüfen
grep COGNITO_CLIENT_ID .env.local
# → Keine Ausgabe bedeutet OK
```

### Vorherige Sitzung bleibt bestehen und Anmeldeseite ist nicht erreichbar

Löschen Sie das Browser-Cookie (`session-token`) oder öffnen Sie ein Inkognito-Fenster.

### `Module not found`-Fehler

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## Dateistruktur

```
docker/nextjs/
├── .env.development          # Entwicklungs-Umgebungsvariablen (Git-verfolgt, nur sichere Werte)
├── .env.local                # Lokale Überschreibung (nicht Git-verfolgt, Kopie von .env.development)
├── docker-compose.dev.yml    # Docker Compose (mit DynamoDB Local)
├── Dockerfile.dev            # Entwicklungs-Dockerfile
├── src/
│   ├── middleware.ts          # Authentifizierungs-Middleware (JWT, CSRF, i18n)
│   └── app/api/auth/signin/
│       └── route.ts           # Anmelde-API (mit Demo-Auth-Fallback)
└── messages/                  # Übersetzungsdateien (8 Sprachen)
```
