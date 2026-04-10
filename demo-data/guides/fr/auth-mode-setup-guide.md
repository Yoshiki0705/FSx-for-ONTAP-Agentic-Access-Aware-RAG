# Guide de configuration de l'environnement de démonstration par mode d'authentification

**Date de création**: 2026-04-04
**Date de création**: Construire des environnements de démonstration reproductibles pour chacun des 5 modes d'authentification

---

## Aperçu

Ce système prend en charge 5 modes d'authentification. Des fichiers de configuration exemples sont fournis dans `demo-data/configs/` — copiez simplement dans `cdk.context.json` et déployez.

| Mode | Fichier de config | Méthode d'auth | Source des permissions | Infra supplémentaire |
|--------|----------|--------|--------|---------|
| A | `mode-a-email-password.json` | Email/Mot de passe | Enregistrement SID manuel | Aucune |
| B | `mode-b-saml-ad-federation.json` | SAML AD Federation | AD Sync Lambda | IAM Identity Center |
| C | `mode-c-oidc-ldap.json` | OIDC + LDAP | LDAP Connector | OpenLDAP EC2 + OIDC IdP |
| D | `mode-d-oidc-claims-only.json` | OIDC Claims uniquement | Jeton OIDC | OIDC IdP |
| E | `mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Sync + OIDC | IAM Identity Center + OIDC IdP |

---

## Étapes communes

### Prérequis

```bash
node --version   # v22.x.x
docker --version
npx cdk --version
aws sts get-caller-identity
```

### Déploiement

```bash
cp demo-data/configs/mode-X-XXXXX.json cdk.context.json
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
bash demo-data/scripts/verify-deployment.sh
```

---

## Guide de sélection du mode d'authentification

### Diagramme de décision

Sélectionnez le mode d'authentification optimal en fonction de votre infrastructure d'authentification existante.

```
What is your existing authentication infrastructure?
│
├─ None (new setup)
│   └─ → Mode A (Email/Password) to start
│       Can migrate to Mode C/D later
│
├─ Windows Active Directory (on-premises or Managed AD)
│   ├─ IAM Identity Center configured?
│   │   ├─ Yes → Mode B (SAML AD Federation)
│   │   └─ No  → Configure SAML via AD FS / Entra ID → Mode B
│   │
│   └─ Want to also use an OIDC IdP?
│       └─ Yes → Mode E (SAML + OIDC Hybrid)
│
├─ OIDC IdP (Keycloak / Okta / Entra ID / Auth0)
│   ├─ Also have LDAP/FreeIPA server?
│   │   └─ Yes → Mode C (OIDC + LDAP)
│   │       UID/GID-based permission filtering available
│   │
│   └─ No LDAP (IdP group claims only)
│       └─ → Mode D (OIDC Claims Only)
│           Group claim configuration required on IdP side
│
└─ Multiple IdPs simultaneously (Okta + Keycloak, etc.)
    └─ → oidcProviders array (Phase 2 Multi-OIDC)
        Each IdP button dynamically displayed on sign-in screen
```

### Sélection de la stratégie de mappage des permissions

Le paramètre `permissionMappingStrategy` contrôle le fonctionnement du contrôle d'accès aux documents.

| Stratégie | Valeur | Condition | Métadonnées du document | Environnement recommandé |
|----------|-------|-----------|-------------------|------------------------|
| SID uniquement | `sid-only` | Environnement Windows AD | `allowed_group_sids` | Permissions de fichiers gérées par ACL NTFS |
| UID/GID uniquement | `uid-gid` | Environnement UNIX/Linux | `allowed_uids`, `allowed_gids` | Fichiers gérés par permissions POSIX |
| Hybride | `hybrid` | Environnement mixte | SID + UID/GID les deux | Utilisateurs AD et LDAP coexistent |

### Liste de vérification pour l'intégration OIDC IdP

Lors de l'intégration d'un OIDC IdP, les paramètres suivants sont requis côté IdP.

#### Commun (tous les OIDC IdP)

- [ ] Créer une application client (Regular Web Application) pour le système RAG
- [ ] Obtenir `clientId` et `clientSecret`
- [ ] Stocker `clientSecret` dans AWS Secrets Manager
- [ ] Définir les Allowed Callback URLs sur `https://{cognito-domain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`
- [ ] Définir les Allowed Logout URLs sur `https://{cloudfront-url}/signin`
- [ ] Obtenir `issuerUrl` depuis le champ `issuer` de `/.well-known/openid-configuration` (attention au slash final)
- [ ] Vérifier que les scopes `openid`, `email`, `profile` sont activés

#### Spécifique à Auth0

- [ ] Ajouter un slash final à `issuerUrl` (ex : `https://xxx.auth0.com/`)
- [ ] Claims de groupe : configurer une Post Login Action avec des claims personnalisés à espace de noms

#### Spécifique à Keycloak

- [ ] Pas de slash final sur `issuerUrl` (ex : `https://keycloak.example.com/realms/main`)
- [ ] Client Protocol : `openid-connect`, Access Type : `confidential`
- [ ] Claims de groupe : ajouter un mapper `groups` dans Client Scopes

#### Spécifique à Okta

- [ ] Pas de slash final sur `issuerUrl` (ex : `https://company.okta.com`)
- [ ] Application Type : `Web Application`
- [ ] Claims de groupe : Authorization Server → Claims → Ajouter un claim `groups`

#### Spécifique à Entra ID (anciennement Azure AD)

- [ ] `issuerUrl` : `https://login.microsoftonline.com/{tenant-id}/v2.0`
- [ ] App Registration → Authentication → Web → Ajouter l'URI de redirection
- [ ] Token Configuration → Optional Claims → Ajouter `groups`

---

## Vérification du contrôle de santé LDAP (Mode C)

Lorsque `ldapConfig` est configuré, un Lambda de contrôle de santé LDAP est automatiquement créé. Utilisez les commandes suivantes pour vérifier son bon fonctionnement.

```bash
# Invocation manuelle du Lambda (vérifier les résultats des étapes connect/bind/search)
aws lambda invoke --function-name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 /tmp/health-check-result.json && cat /tmp/health-check-result.json

# État de l'alarme CloudWatch (OK = sain, ALARM = échec de connexion LDAP)
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-ldap-health-check-failure \
  --region ap-northeast-1 \
  --query 'MetricAlarms[0].{State:StateValue,Reason:StateReason}'

# Règle EventBridge (exécution planifiée toutes les 5 minutes)
aws events describe-rule --name perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --query '{State:State,Schedule:ScheduleExpression}'

# Journaux CloudWatch (journaux JSON structurés)
aws logs tail /aws/lambda/perm-rag-demo-demo-ldap-health-check \
  --region ap-northeast-1 --since 1h
```

> **Vérifié (2026-04-10)** : Invocation manuelle du Lambda de contrôle de santé LDAP contre OpenLDAP EC2 (10.0.2.187:389) — toutes les étapes SUCCESS (connect : 12ms, bind : 12ms, search : 16ms, total : 501ms). CloudWatch Alarm : OK, EventBridge Rule : 5min ENABLED. Accès à Secrets Manager + CloudWatch Metrics via NAT Gateway confirmé.

---

## Migration entre les modes

### Mode A → Mode C/D (Email/Mot de passe → OIDC Federation)

Le schéma de migration le plus courant. Commencez avec le Mode A pour le PoC, puis migrez vers OIDC Federation pour la production.

```bash
# Step 1: Sauvegarder le cdk.context.json actuel
cp cdk.context.json cdk.context.json.mode-a-backup

# Step 2: Ajouter la configuration OIDC à cdk.context.json
# Step 3: Redéployer (uniquement les stacks Security + WebApp)
npx cdk deploy perm-rag-demo-demo-Security perm-rag-demo-demo-WebApp \
  --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never --exclusively

# Step 4: Configurer les Callback URLs côté OIDC IdP
# Step 5: Vérifier - les utilisateurs email/mot de passe existants peuvent toujours se connecter
```

**Remarques :**
- Les utilisateurs Cognito existants (email/mot de passe) ne sont pas supprimés
- Les données SID DynamoDB existantes sont préservées
- Utilisez `permissionMappingStrategy: "hybrid"` pour la coexistence des utilisateurs SID + UID/GID
- Si `email.mutable` du Cognito User Pool est `false`, la recréation du User Pool est nécessaire

### Mode B → Mode E (SAML AD → SAML + OIDC Hybride)

Ajouter un OIDC IdP à la fédération SAML AD existante.

```bash
# Step 1: Ajouter oidcProviderConfig à cdk.context.json (garder enableAdFederation: true)
# Step 2: Redéployer les stacks Security + WebApp
# Step 3: Vérifier que les boutons "Sign in with AD" et "{providerName}" apparaissent tous les deux
```

---

## Nettoyage

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Dépannage

| | Mode | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings. `issuerUrl` must match IdP's `/.well-known/openid-configuration` `issuer` value (Auth0 requires trailing `/`) |
| OIDC `invalid_request` | C,D,E | issuerUrl trailing slash mismatch | Auth0: `https://xxx.auth0.com/` (trailing `/` required), Keycloak: no trailing `/` |
| OIDC `Attribute cannot be updated` | C,D,E | email attribute `mutable: false` | User Pool must be recreated (`mutable` cannot be changed after creation) |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## Documents associés

- [Guide d'authentification et de gestion des utilisateurs](../../docs/fr/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
