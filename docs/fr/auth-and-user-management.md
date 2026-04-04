# Guide d'authentification et de gestion des utilisateurs

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | **Français** | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**Date de création** : 2026-04-02
**Version** : 3.4.0

---

## Présentation

Ce système propose deux modes d'authentification. Vous pouvez basculer entre eux à l'aide des paramètres de contexte CDK lors du déploiement.

| Mode | Paramètre CDK | Création d'utilisateur | Enregistrement SID | Utilisation recommandée |
|------|---------------|----------------------|--------------------|-----------------------|
| E-mail/Mot de passe | `enableAdFederation=false` (par défaut) | Création manuelle par l'administrateur | Enregistrement manuel par l'administrateur | PoC / Démo |
| AD Federation | `enableAdFederation=true` | Création automatique lors de la première connexion | Enregistrement automatique lors de la connexion | Production / Entreprise |
| OIDC/LDAP Federation | `oidcProviderConfig` spécifié | Création automatique lors de la première connexion | Enregistrement automatique lors de la connexion | Multi-IdP / Environnements LDAP |

### Provisionnement utilisateur sans intervention

Les modes AD Federation et OIDC/LDAP Federation réalisent un « provisionnement utilisateur sans intervention ». Ce mécanisme mappe automatiquement les permissions utilisateur existantes du serveur de fichiers (FSx for NetApp ONTAP) aux utilisateurs de l'interface RAG.

- Les administrateurs n'ont pas besoin de créer manuellement des utilisateurs dans le système RAG
- Les utilisateurs n'ont pas besoin de s'auto-enregistrer
- Lorsqu'un utilisateur géré par un IdP (AD/Keycloak/Okta/Entra ID, etc.) se connecte pour la première fois, la création de l'utilisateur Cognito → la récupération des permissions → l'enregistrement DynamoDB sont tous effectués automatiquement
- Les modifications de permissions côté serveur de fichiers sont automatiquement reflétées lors de la prochaine connexion après l'expiration du TTL du cache (24 heures)

---

## Mode 1 : Authentification par e-mail/mot de passe (par défaut)

### Fonctionnement

```
User -> CloudFront -> Next.js Sign-in Page
  -> Cognito USER_PASSWORD_AUTH (email + password)
  -> JWT issued -> Session Cookie -> Chat UI
```

Les utilisateurs sont créés directement dans le Cognito User Pool et se connectent avec leur adresse e-mail et leur mot de passe.

### Tâches de l'administrateur

**Étape 1 : Créer des utilisateurs Cognito**

```bash
# post-deploy-setup.sh s'exécute automatiquement, ou manuellement :
bash demo-data/scripts/create-demo-users.sh
```

**Étape 2 : Enregistrer les données SID dans DynamoDB**

```bash
# Enregistrer manuellement les données SID
bash demo-data/scripts/setup-user-access.sh
```

Ce script enregistre les éléments suivants dans la table DynamoDB `user-access` :

| userId | userSID | groupSIDs | Portée d'accès |
|--------|---------|-----------|---------------|
| admin@example.com | S-1-5-21-...-500 | [...-512, S-1-1-0] | Tous les documents |
| user@example.com | S-1-5-21-...-1001 | [S-1-1-0] | Public uniquement |

### Limitations

- Chaque ajout d'utilisateur nécessite une mise à jour manuelle de Cognito et DynamoDB par l'administrateur
- Les modifications d'appartenance aux groupes AD ne sont pas automatiquement reflétées
- Non adapté aux opérations à grande échelle

---

## Mode 2 : AD Federation (recommandé : entreprise)

### Fonctionnement

```
AD User -> CloudFront UI -> "AD Sign-in" button
  -> Cognito Hosted UI -> SAML IdP (AD)
  -> AD authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> AD Sync Lambda
  -> DynamoDB SID auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

Lorsqu'un utilisateur AD se connecte via SAML, les opérations suivantes sont toutes effectuées automatiquement :

1. **Création automatique de l'utilisateur Cognito** — Un utilisateur Cognito est automatiquement généré à partir de l'attribut e-mail de l'assertion SAML
2. **Récupération automatique du SID** — AD Sync Lambda récupère le SID utilisateur + les SID de groupe depuis AD
3. **Enregistrement automatique dans DynamoDB** — Les données SID récupérées sont enregistrées dans la table `user-access` (cache de 24 heures)

Aucune intervention manuelle de l'administrateur n'est requise.

### Comportement d'AD Sync Lambda

| Type AD | Méthode de récupération SID | Infrastructure requise |
|---------|---------------------------|----------------------|
| Managed AD | LDAP ou PowerShell via SSM | AWS Managed AD + (optionnel) Windows EC2 |
| Self-managed AD | PowerShell via SSM | Windows EC2 (joint à AD) |

**Comportement du cache :**
- Première connexion : interroge AD pour récupérer les SID, enregistre dans DynamoDB
- Connexions suivantes (dans les 24 heures) : utilise le cache DynamoDB, ignore la requête AD
- Après 24 heures : récupère à nouveau depuis AD lors de la prochaine connexion

**Comportement en cas d'erreur :**
- La connexion n'est pas bloquée même si AD Sync Lambda échoue (journal d'erreurs uniquement)
- En l'absence de données SID, le filtrage SID est en mode Fail-Closed (tous les documents refusés)

### Modèle A : AWS Managed AD

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=managed \
  -c adPassword="YourStrongP@ssw0rd123" \
  -c adDirectoryId=d-0123456789 \
  -c samlMetadataUrl="https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/..." \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Étapes de configuration :**
1. Déploiement CDK (création de Managed AD + SAML IdP + Cognito Domain)
2. Jonction SVM à AD (`post-deploy-setup.sh` s'exécute automatiquement)
3. Créer une application SAML pour Cognito dans IAM Identity Center (ou spécifier un IdP externe avec `samlMetadataUrl`)
4. Exécuter l'authentification AD depuis le bouton « Connexion AD » dans l'interface Cognito Hosted UI

### Modèle B : Self-managed AD + Entra ID

```bash
npx cdk deploy --all \
  -c enableAdFederation=true \
  -c adType=self-managed \
  -c adEc2InstanceId=i-0123456789 \
  -c samlMetadataUrl="https://login.microsoftonline.com/.../federationmetadata.xml" \
  -c cloudFrontUrl="https://dxxxxxxxx.cloudfront.net"
```

**Étapes de configuration :**
1. Joindre une instance Windows EC2 à AD et activer SSM Agent
2. Créer une application SAML dans Entra ID et obtenir l'URL des métadonnées
3. Déploiement CDK
4. Exécuter l'authentification AD depuis le bouton « Connexion AD » dans l'interface CloudFront

### Liste des paramètres CDK

| Paramètre | Type | Valeur par défaut | Description |
|-----------|------|-------------------|-------------|
| `enableAdFederation` | boolean | `false` | Activer la fédération SAML |
| `adType` | string | `none` | `managed` / `self-managed` / `none` |
| `adPassword` | string | - | Mot de passe administrateur Managed AD |
| `adDirectoryId` | string | - | AWS Managed AD Directory ID |
| `adEc2InstanceId` | string | - | ID d'instance Windows EC2 jointe à AD |
| `samlMetadataUrl` | string | - | URL des métadonnées SAML IdP |
| `adDomainName` | string | - | Nom de domaine AD (ex. : demo.local) |
| `adDnsIps` | string | - | IP DNS AD (séparées par des virgules) |
| `cloudFrontUrl` | string | - | URL de rappel OAuth |

---

## Mode 3 : OIDC/LDAP Federation (Multi-IdP / Environnements LDAP)

### Fonctionnement

```
OIDC User -> CloudFront UI -> "Sign in with OIDC" button
  -> Cognito Hosted UI -> OIDC IdP (Keycloak/Okta/Entra ID)
  -> OIDC authentication
  -> Cognito auto user creation
  -> Post-Auth Trigger -> Identity Sync Lambda
  -> LDAP Query or OIDC Claims -> DynamoDB auto-registration (24h cache)
  -> OAuth Callback -> Session Cookie -> Chat UI
```

Lorsqu'un utilisateur OIDC se connecte, les opérations suivantes sont toutes effectuées automatiquement :

1. **Création automatique de l'utilisateur Cognito** — Un utilisateur Cognito est automatiquement généré à partir de l'attribut email de l'assertion OIDC
2. **Récupération automatique des permissions** — Identity Sync Lambda récupère les informations SID/UID/GID/groupes depuis le serveur LDAP ou les claims OIDC
3. **Enregistrement automatique dans DynamoDB** — Les données de permissions récupérées sont enregistrées dans la table `user-access` (cache de 24 heures)

### Activation automatique basée sur la configuration

Chaque méthode d'authentification est automatiquement activée lorsque sa configuration est fournie. Coût supplémentaire en ressources AWS quasi nul.

| Fonctionnalité | Condition d'activation | Coût supplémentaire |
|---------------|----------------------|-------------------|
| OIDC Federation | `oidcProviderConfig` spécifié | Aucun (enregistrement IdP Cognito gratuit) |
| Récupération des permissions LDAP | `ldapConfig` spécifié | Aucun (Lambda facturé à l'utilisation uniquement) |
| Permissions par claims OIDC | `oidcProviderConfig` spécifié + pas de `ldapConfig` | Aucun |
| Filtrage des permissions UID/GID | `permissionMappingStrategy` est `uid-gid` ou `hybrid` | Aucun |
| ONTAP Name-Mapping | `ontapNameMappingEnabled=true` | Aucun |

> **Configuration automatique CDK** : Lors du déploiement CDK avec `oidcProviderConfig` spécifié, les éléments suivants sont automatiquement configurés :
> - L'IdP OIDC est enregistré dans le Cognito User Pool
> - Le Cognito Domain est créé (s'il n'a pas déjà été créé par `enableAdFederation=true`)
> - L'IdP OIDC est ajouté comme fournisseur supporté au User Pool Client
> - L'Identity Sync Lambda est créé et enregistré comme Post-Authentication Trigger
> - Les variables d'environnement OAuth (`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`) sont automatiquement configurées sur le Lambda WebAppStack
>
> Lorsque `enableAdFederation=true` et `oidcProviderConfig` sont spécifiés simultanément, SAML + OIDC sont tous deux supportés et les deux boutons de connexion sont affichés.

### Modèle C : OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak)

```json
{
  "oidcProviderConfig": {
    "providerName": "Keycloak",
    "clientId": "rag-system",
    "clientSecret": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oidc-client-secret",
    "issuerUrl": "https://keycloak.example.com/realms/main",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldaps://ldap.example.com:636",
    "baseDn": "dc=example,dc=com",
    "bindDn": "cn=readonly,dc=example,dc=com",
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password",
    "userSearchFilter": "(mail={email})",
    "groupSearchFilter": "(member={dn})"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

### Modèle D : OIDC Claims Only (sans LDAP)

```json
{
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com",
    "groupClaimName": "groups"
  }
}
```

> **Note importante pour les utilisateurs Auth0** : Les applications conformes OIDC d'Auth0 exigent que les claims personnalisés dans les ID tokens utilisent un espace de noms (préfixe URL). Les claims `groups` sans espace de noms sont silencieusement supprimés des ID tokens. Configurez votre Auth0 Post Login Action avec des claims à espace de noms :
>
> ```javascript
> // Auth0 Post Login Action
> exports.onExecutePostLogin = async (event, api) => {
>   const groups = ['developers', 'rag-users']; // Groupes de l'utilisateur
>   api.idToken.setCustomClaim('https://rag-system/groups', groups);
>   api.accessToken.setCustomClaim('https://rag-system/groups', groups);
> };
> ```
>
> Le `groupClaimName` CDK peut rester `groups`. CDK configure automatiquement le mappage d'attributs `https://rag-system/groups` → `custom:oidc_groups`.

### Modèle E : Hybride SAML + OIDC

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "oidcProviderConfig": {
    "providerName": "Okta",
    "clientId": "0oa1234567890",
    "clientSecret": "arn:aws:secretsmanager:...",
    "issuerUrl": "https://company.okta.com"
  },
  "permissionMappingStrategy": "hybrid",
  "cloudFrontUrl": "https://dxxxxxxxx.cloudfront.net"
}
```

### Liste des paramètres CDK (OIDC/LDAP)

| Paramètre | Type | Valeur par défaut | Description |
|-----------|------|-------------------|-------------|
| `oidcProviderConfig.providerName` | string | `OIDCProvider` | Nom d'affichage de l'IdP (affiché sur le bouton de connexion) |
| `oidcProviderConfig.clientId` | string | **Requis** | ID client OIDC |
| `oidcProviderConfig.clientSecret` | string | **Requis** | Secret client OIDC (ARN Secrets Manager pris en charge, CDK résout automatiquement la valeur au moment du déploiement) |
| `oidcProviderConfig.issuerUrl` | string | **Requis** | URL de l'émetteur OIDC |
| `oidcProviderConfig.groupClaimName` | string | `groups` | Nom du claim d'information de groupe |
| `ldapConfig.ldapUrl` | string | - | URL LDAP/LDAPS (ex. : `ldaps://ldap.example.com:636`) |
| `ldapConfig.baseDn` | string | - | DN de base de recherche (ex. : `dc=example,dc=com`) |
| `ldapConfig.bindDn` | string | - | DN de liaison (ex. : `cn=readonly,dc=example,dc=com`) |
| `ldapConfig.bindPasswordSecretArn` | string | - | ARN Secrets Manager du mot de passe de liaison |
| `ldapConfig.userSearchFilter` | string | `(mail={email})` | Filtre de recherche utilisateur |
| `ldapConfig.groupSearchFilter` | string | `(member={dn})` | Filtre de recherche de groupe |
| `permissionMappingStrategy` | string | `sid-only` | Stratégie de mappage des permissions : `sid-only`, `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | `false` | Intégration ONTAP name-mapping |

> **Considérations pour le déploiement CDK** :
> - Lorsqu'un ARN Secrets Manager est spécifié pour `clientSecret`, CDK résout automatiquement la valeur du secret au moment du déploiement.
> - Les attributs personnalisés Cognito ne peuvent pas être modifiés ou supprimés après leur création (limitation CloudFormation). Pour cette raison, `oidc_groups` est exclu de la définition du User Pool CDK.
> - Après un déploiement CDK, la connexion OIDC peut échouer temporairement pendant que Cognito re-résout les endpoints OIDC (1 à 2 minutes).
> - La permission `AdminGetUser` utilise un ARN générique (wildcard) pour éviter les dépendances circulaires.

---

## Intégration avec le filtrage des permissions

Quel que soit le mode d'authentification, le mécanisme de filtrage des permissions fonctionne de la même manière. Le Permission Resolver sélectionne automatiquement la stratégie de filtrage appropriée en fonction de la source d'authentification.

### Stratégies de filtrage

| Stratégie | Condition | Comportement |
|-----------|-----------|-------------|
| SID Matching | `userSID` uniquement | Correspondance entre `allowed_group_sids` du document et les SID de l'utilisateur |
| UID/GID Matching | `uid` + `gid` uniquement | Correspondance entre `allowed_uids` / `allowed_gids` du document et l'UID/GID de l'utilisateur |
| Hybrid Matching | `userSID` et `uid` présents | Priorité au SID, repli sur UID/GID |
| Deny All (Fail-Closed) | Aucune donnée de permission | Refus de tout accès aux documents |

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs + uid + gid + unixGroups
  v
Permission Resolver (sélection automatique de stratégie)
  |
  ├─ SID Matching: userSIDs ∩ documentSIDs
  ├─ UID/GID Matching: uid ∈ allowed_uids OR gid ∈ allowed_gids
  └─ Hybrid: SID prioritaire → repli UID/GID
  v
Match -> ALLOW, No match -> DENY
```

**Différences de source d'enregistrement des données SID :**

| Mode d'authentification | Source des données SID | Champ `source` |
|------------------------|----------------------|----------------|
| E-mail/Mot de passe | `setup-user-access.sh` (manuel) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automatique) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automatique) | `AD-Sync-self-managed` |
| OIDC + LDAP | Identity Sync Lambda (automatique) | `OIDC-LDAP` |
| OIDC + Claims | Identity Sync Lambda (automatique) | `OIDC-Claims` |

### Schéma de la table DynamoDB user-access

```json
{
  "userId": "admin@example.com",
  "userSID": "S-1-5-21-...-500",
  "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
  "displayName": "Admin User",
  "email": "admin@example.com",
  "source": "AD-Sync-managed",
  "retrievedAt": 1705750800000,
  "ttl": 1705837200
}
```

---

## Dépannage

| Symptôme | Cause | Solution |
|----------|-------|----------|
| Tous les documents refusés après la connexion | Pas de données SID/UID/GID dans DynamoDB | AD Federation : vérifier les journaux AD Sync Lambda. OIDC : vérifier les journaux Identity Sync Lambda. Manuel : exécuter `setup-user-access.sh` |
| Le bouton « Connexion AD » n'est pas affiché | `enableAdFederation=false` | Vérifier les paramètres CDK et redéployer |
| Le bouton « Connexion OIDC » n'est pas affiché | `oidcProviderConfig` non configuré | Ajouter `oidcProviderConfig` aux paramètres CDK et redéployer |
| Échec de l'authentification SAML | URL des métadonnées SAML incorrecte | Managed AD : vérifier la configuration IAM Identity Center. Self-managed : vérifier l'URL des métadonnées Entra ID |
| Échec de l'authentification OIDC | `clientId` / `issuerUrl` incorrect | Vérifier que les paramètres client de l'IdP OIDC correspondent aux paramètres CDK |
| Échec de la récupération des permissions LDAP | Erreur de connexion LDAP | Vérifier les erreurs d'Identity Sync Lambda dans CloudWatch Logs. La connexion n'est pas bloquée (Fail-Open) |
| Les modifications de groupe AD ne sont pas reflétées | Cache SID (24 heures) | Attendre 24 heures ou supprimer l'enregistrement concerné dans DynamoDB et se reconnecter |
| Délai d'expiration AD Sync Lambda | L'exécution PowerShell via SSM est lente | Augmenter la variable d'environnement `SSM_TIMEOUT` (par défaut : 60 secondes) |
| Groupes OIDC non récupérés | Claim de groupe non configuré dans l'IdP, ou claims sans espace de noms | Les IdP conformes OIDC comme Auth0 exigent des claims personnalisés avec espace de noms dans les ID tokens. Pour Auth0, utilisez `api.idToken.setCustomClaim('https://rag-system/groups', groups)` dans un Post Login Action, et assurez-vous que le mappage d'attributs Cognito correspond à `https://rag-system/groups` → `custom:oidc_groups` |
| Données de permissions non enregistrées dans DynamoDB après connexion OIDC | Post-Auth Trigger ou Identity Sync Lambda non créé | Le déploiement CDK avec `oidcProviderConfig` crée automatiquement l'Identity Sync Lambda et le Post-Auth Trigger. Vérifier les logs d'exécution Lambda dans CloudWatch Logs |
| Attributs personnalisés vides dans le trigger PostConfirmation | Cognito peut ne pas inclure les attributs personnalisés dans l'événement PostConfirmation | L'Identity Sync Lambda inclut un mécanisme de repli via l'API Cognito AdminGetUser. Vérifier que le rôle d'exécution Lambda dispose de la permission `cognito-idp:AdminGetUser` |
| Erreur de callback OAuth (configuration OIDC) | `cloudFrontUrl` non défini | `cloudFrontUrl` est également requis pour la configuration OIDC. Définir dans `cdk.context.json` et redéployer |

---

## Résultats de vérification

### Vérification CDK Synth + Déploiement (v3.4.0)

- CDK synth/deploy : ✅ Succès
- Enregistrement Cognito OIDC IdP : ✅ Auth0
- Page de connexion : ✅ Hybride SAML + OIDC
- Flux d'authentification OIDC : ✅ Succès de bout en bout
- Post-Auth Trigger : ✅ PostConfirmation
- Sauvegarde automatique DynamoDB : ✅ OIDC-Claims
- Pipeline de claims de groupes OIDC : ✅ Auth0 Post Login Action → claim avec espace de noms (`https://rag-system/groups`) → Cognito `custom:oidc_groups` → Identity Sync Lambda → DynamoDB `oidcGroups: ["developers","rag-users"]`
- Repli API Cognito AdminGetUser : ✅ Lorsque l'événement du trigger PostConfirmation ne contient pas les attributs personnalisés, Lambda les récupère via l'API Cognito
- Tests unitaires : ✅ 130 réussis
- Tests de propriétés : ✅ 52 réussis

![Page de connexion (Hybride SAML + OIDC)](../docs/screenshots/signin-page-saml-oidc-hybrid.png)

![Page de connexion Auth0 OIDC](../docs/screenshots/oidc-auth0-login-page.png)

![Page de chat après connexion OIDC réussie](../docs/screenshots/oidc-auth0-signin-success.png)

---

## Documents associés

- [README.md — Fédération AD SAML](../../README.fr.md#fédération-ad-saml-option) — Instructions de déploiement CDK
- [docs/implementation-overview.md — Section 3 : Authentification IAM](../fr/implementation-overview.md#3-authentification-iam--lambda-function-url-iam-auth--cloudfront-oac) — Conception de l'authentification au niveau infrastructure
- [docs/SID-Filtering-Architecture.md](../fr/SID-Filtering-Architecture.md) — Conception détaillée du filtrage SID
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — Configuration de l'intégration AD FSx ONTAP
