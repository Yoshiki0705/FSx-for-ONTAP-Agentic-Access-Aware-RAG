# Guide d'authentification et de gestion des utilisateurs

**🌐 Language:** [日本語](../auth-and-user-management.md) | [English](../en/auth-and-user-management.md) | [한국어](../ko/auth-and-user-management.md) | [简体中文](../zh-CN/auth-and-user-management.md) | [繁體中文](../zh-TW/auth-and-user-management.md) | **Français** | [Deutsch](../de/auth-and-user-management.md) | [Español](../es/auth-and-user-management.md)

**Date de création** : 2026-04-02
**Version** : 3.3.0

---

## Présentation

Ce système propose deux modes d'authentification. Vous pouvez basculer entre eux à l'aide des paramètres de contexte CDK lors du déploiement.

| Mode | Paramètre CDK | Création d'utilisateur | Enregistrement SID | Utilisation recommandée |
|------|---------------|----------------------|--------------------|-----------------------|
| E-mail/Mot de passe | `enableAdFederation=false` (par défaut) | Création manuelle par l'administrateur | Enregistrement manuel par l'administrateur | PoC / Démo |
| AD Federation | `enableAdFederation=true` | Création automatique lors de la première connexion | Enregistrement automatique lors de la connexion | Production / Entreprise |

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

## Intégration avec le filtrage SID

Quel que soit le mode d'authentification, le mécanisme de filtrage SID fonctionne de la même manière.

```
DynamoDB user-access Table
  |
  | userId -> userSID + groupSIDs
  v
Bedrock KB Retrieve API -> Results + metadata (allowed_group_sids)
  |
  | userSIDs n documentSIDs
  v
Match -> ALLOW, No match -> DENY
```

**Différences de source d'enregistrement des données SID :**

| Mode d'authentification | Source des données SID | Champ `source` |
|------------------------|----------------------|----------------|
| E-mail/Mot de passe | `setup-user-access.sh` (manuel) | `Demo` |
| AD Federation (Managed) | AD Sync Lambda (automatique) | `AD-Sync-managed` |
| AD Federation (Self-managed) | AD Sync Lambda (automatique) | `AD-Sync-self-managed` |

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
| Tous les documents refusés après la connexion | Pas de données SID dans DynamoDB | AD Federation : vérifier les journaux AD Sync Lambda. Manuel : exécuter `setup-user-access.sh` |
| Le bouton « Connexion AD » n'est pas affiché | `enableAdFederation=false` | Vérifier les paramètres CDK et redéployer |
| Échec de l'authentification SAML | URL des métadonnées SAML incorrecte | Managed AD : vérifier la configuration IAM Identity Center. Self-managed : vérifier l'URL des métadonnées Entra ID |
| Les modifications de groupe AD ne sont pas reflétées | Cache SID (24 heures) | Attendre 24 heures ou supprimer l'enregistrement concerné dans DynamoDB et se reconnecter |
| Délai d'expiration AD Sync Lambda | L'exécution PowerShell via SSM est lente | Augmenter la variable d'environnement `SSM_TIMEOUT` (par défaut : 60 secondes) |

---

## Documents associés

- [README.md — Fédération AD SAML](../../README.fr.md#fédération-ad-saml-option) — Instructions de déploiement CDK
- [docs/implementation-overview.md — Section 3 : Authentification IAM](../fr/implementation-overview.md#3-authentification-iam--lambda-function-url-iam-auth--cloudfront-oac) — Conception de l'authentification au niveau infrastructure
- [docs/SID-Filtering-Architecture.md](../fr/SID-Filtering-Architecture.md) — Conception détaillée du filtrage SID
- [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) — Configuration de l'intégration AD FSx ONTAP
