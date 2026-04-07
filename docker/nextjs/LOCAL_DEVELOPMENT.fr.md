# Guide de développement local

Procédure pour vérifier et développer l'interface utilisateur de l'application Next.js sans environnement AWS (Cognito / DynamoDB / Bedrock).

Le middleware d'authentification (vérification JWT, protection CSRF, routage i18n) n'est pas contourné — il fonctionne avec le même flux qu'en production.

---

## Prérequis

| Outil | Version | Commande de vérification |
|-------|---------|--------------------------|
| Node.js | 22 ou supérieur | `node -v` |
| npm | 10 ou supérieur | `npm -v` |

Docker n'est pas requis (une méthode avec Docker est également décrite ci-dessous).

---

## Méthode 1 : npm run dev (la plus simple)

### 1. Installation des dépendances

```bash
cd docker/nextjs
npm install
```

### 2. Préparation des variables d'environnement

```bash
cp .env.development .env.local
```

`.env.local` n'est pas suivi par Git. Toutes les valeurs sont des valeurs fictives publiables en toute sécurité.

### 3. Démarrage du serveur de développement

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans votre navigateur.

### 4. Connexion

Le middleware redirige automatiquement vers la page de connexion (`/fr/signin`). Connectez-vous avec l'un des utilisateurs de démonstration ci-dessous.

| Nom d'utilisateur | Mot de passe | Rôle | Permissions |
|-------------------|-------------|------|-------------|
| `admin` | `admin123` | administrator | Accès complet |
| `developer` | `dev123` | developer | Lecture/écriture + création d'Agent |
| `user` | `user123` | user | Lecture seule |

### Fonctionnement

```
Navigateur → http://localhost:3000
  ↓ Middleware : pas de JWT → redirection vers /fr/signin
  ↓ Soumission du formulaire de connexion
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID non défini → authentification avec utilisateur de démo
  ↓   Émission JWT → définition du cookie session-token
  ↓ Middleware : JWT valide → affichage de la page
```

Aucune connexion à Cognito ou DynamoDB n'est effectuée. La signature et la vérification JWT utilisent la même bibliothèque `jose` qu'en production, le flux d'authentification du middleware est donc entièrement équivalent à la production.

### Limitations

| Fonctionnalité | État | Raison |
|----------------|------|--------|
| Connexion / déconnexion | ✅ Fonctionne | Émission JWT et gestion des cookies uniquement |
| Navigation / garde d'authentification | ✅ Fonctionne | Vérification JWT du middleware |
| Changement de langue | ✅ Fonctionne | next-intl (8 langues) |
| Mode sombre | ✅ Fonctionne | Zustand + localStorage |
| Interface cartes / mise en page | ✅ Fonctionne | Composants statiques |
| Recherche RAG (KB/Agent) | ❌ Indisponible | Nécessite Bedrock |
| Persistance de session | ❌ Indisponible | Nécessite DynamoDB |
| Permissions utilisateur (SID) | ❌ Indisponible | Nécessite DynamoDB + FSx |

> Si vous avez besoin de la persistance de session, utilisez la méthode 2 (Docker Compose + DynamoDB Local).

---

## Méthode 2 : Docker Compose (avec DynamoDB Local)

Méthode incluant la persistance de session via DynamoDB Local.

### Prérequis supplémentaires

- Docker / Docker Compose

### 1. Démarrage

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

Les services suivants démarrent automatiquement :

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Serveur de développement Next.js (rechargement à chaud) |
| dynamodb-local | 8000 | DynamoDB Local (en mémoire) |
| dynamodb-setup | — | Création automatique de la table de sessions (au démarrage uniquement) |

### 2. Accès

Ouvrez http://localhost:3000 et connectez-vous avec les mêmes utilisateurs de démo que la méthode 1.

### 3. Arrêt

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local fonctionne en mode mémoire, les données de session sont perdues à l'arrêt.

---

## Fonctionnalités de la page de connexion

La page de connexion comprend les contrôles suivants :

- Sélecteur de langue (en haut à droite) : basculer entre 8 langues. La langue sélectionnée est conservée après la connexion.
- Bascule mode sombre (en haut à droite) : basculer entre clair/sombre. Conservé après la connexion.

---

## Changement de mode et héritage langue/thème

| Transition | Langue | Thème |
|------------|--------|-------|
| Connexion → Écran principal | ✅ Locale URL conservée | ✅ localStorage conservé |
| Mode KB ↔ Mode Agent | ✅ Locale URL conservée | ✅ localStorage conservé |
| Écran principal → Répertoire Agent | ✅ Locale URL conservée | ✅ localStorage conservé |
| Répertoire Agent → Mode KB | ✅ Locale URL conservée | ✅ localStorage conservé |

La langue est gérée via le préfixe de locale dans l'URL (`/en/genai`, `/fr/genai`, etc.), elle est donc conservée lors de toutes les transitions de page. Le thème est partagé entre toutes les pages via un store Zustand (persistance localStorage).

---

## Dépannage

### Le port 3000 est utilisé

```bash
lsof -i :3000
kill -9 <PID>
```

### Impossible de se connecter

Vérifiez que `.env.local` existe et que `COGNITO_CLIENT_ID` n'est pas défini. S'il est défini, l'authentification Cognito sera tentée et échouera.

```bash
# Vérification
grep COGNITO_CLIENT_ID .env.local
# → Aucune sortie signifie OK
```

### La session précédente persiste et la page de connexion est inaccessible

Supprimez le cookie du navigateur (`session-token`) ou ouvrez dans une fenêtre de navigation privée.

### Erreur `Module not found`

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## Structure des fichiers

```
docker/nextjs/
├── .env.development          # Variables d'environnement de dev (suivi Git, valeurs sûres uniquement)
├── .env.local                # Surcharge locale (non suivi Git, copie de .env.development)
├── docker-compose.dev.yml    # Docker Compose (avec DynamoDB Local)
├── Dockerfile.dev            # Dockerfile de développement
├── src/
│   ├── middleware.ts          # Middleware d'authentification (JWT, CSRF, i18n)
│   └── app/api/auth/signin/
│       └── route.ts           # API de connexion (avec fallback d'authentification de démo)
└── messages/                  # Fichiers de traduction (8 langues)
```
