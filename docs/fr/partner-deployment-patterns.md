# Modèles de déploiement multi-locataires / partenaires

**🌐 Language:** [日本語](../partner-deployment-patterns.md) | [English](../en/partner-deployment-patterns.md) | [한국어](../ko/partner-deployment-patterns.md) | [简体中文](../zh-CN/partner-deployment-patterns.md) | [繁體中文](../zh-TW/partner-deployment-patterns.md) | **Français** | [Deutsch](../de/partner-deployment-patterns.md) | [Español](../es/partner-deployment-patterns.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Entreprises partenaires, fournisseurs SaaS, architectes multi-locataires

---

## Aperçu

Ce document organise les modèles d'architecture pour les entreprises partenaires déployant le système RAG sensible aux permissions pour plusieurs clients. Il fournit des directives de conception pour l'isolation des données par client, l'isolation de l'authentification et l'isolation des coûts.

---

## Clients cibles et secteurs d'activité

| Secteur | Cas d'utilisation | Exigences de permissions |
|---------|-------------------|-------------------------|
| Industrie manufacturière | Recherche de dessins techniques et documents techniques par département | Département × Projet × Niveau de confidentialité |
| Finance | Recherche de documents réglementaires et rapports internes basée sur les permissions | Département × Rôle × Isolation des informations clients |
| Secteur public | Recherche de documents de politique et matériaux internes par bureau | Bureau × Poste × Public/Non-public |
| Santé | Recherche de manuels de procédures et matériaux de recherche par département | Département × Profession × Isolation des informations patients |
| Juridique | Recherche de contrats et jurisprudence par dossier | Dossier × Assigné × Isolation client |
| Éducation | Recherche de matériaux pédagogiques et ressources de recherche par faculté | Faculté × Personnel/Étudiant × Laboratoire |

---

## Comparaison des modèles de déploiement

### Modèle A : Isolation par compte AWS par client (Recommandé : Entreprise)

```
┌─────────────────────────────────────────────────────────┐
│ Compte de gestion partenaire                              │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ CDK Pipelines   │  │ StackSets       │               │
│ │ / CodePipeline  │  │ (dist. modèles) │               │
│ └────────┬────────┘  └────────┬────────┘               │
└──────────┼────────────────────┼─────────────────────────┘
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐      ┌──────────────┐
    │ Client A    │      │ Client B    │      │ Client C     │
    │ Compte      │      │ Compte      │      │ Compte       │
    │             │      │             │      │              │
    │ ・FSx for ONTAP │      │ ・FSx for ONTAP │      │ ・FSx for ONTAP  │
    │ ・Bedrock KB│      │ ・Bedrock KB│      │ ・Bedrock KB │
    │ ・Cognito   │      │ ・Cognito   │      │ ・Cognito    │
    │ ・DynamoDB  │      │ ・DynamoDB  │      │ ・DynamoDB   │
    │ ・CloudFront│      │ ・CloudFront│      │ ・CloudFront │
    └─────────────┘      └─────────────┘      └──────────────┘
```

**Avantages** :
- Isolation complète des données (frontière de compte AWS)
- Séparation de la facturation par client
- Rayon d'impact limité pour les incidents de sécurité
- Opérations et mise à l'échelle indépendantes par client

**Inconvénients** :
- Charge opérationnelle de gestion des comptes
- Coûts dupliqués pour les composants partagés
- Complexité du pipeline de déploiement

**Applicable lorsque** :
- Les clients ont leurs propres comptes AWS
- Des exigences strictes d'isolation des données existent (finance, santé, secteur public)
- Le nombre de clients est de 10 ou moins

### Modèle B : Isolation SVM / Volume / Préfixe dans 1 compte

```
┌─────────────────────────────────────────────────────────────────┐
│ Compte AWS partagé                                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Système de fichiers FSx for ONTAP                          │    │
│  │                                                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │ SVM-A    │  │ SVM-B    │  │ SVM-C    │               │    │
│  │  │(Client   │  │(Client   │  │(Client   │               │    │
│  │  │ A)       │  │ B)       │  │ C)       │               │    │
│  │  │ Vol-A1   │  │ Vol-B1   │  │ Vol-C1   │               │    │
│  │  │ Vol-A2   │  │ Vol-B2   │  │ Vol-C2   │               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ KB-A     │  │ KB-B     │  │ KB-C     │  ← KB par locataire  │
│  │ S3 AP-A  │  │ S3 AP-B  │  │ S3 AP-C  │  ← AP par locataire │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Ressources partagées                                       │    │
│  │ ・CloudFront + WAF (partagé, routage basé sur le chemin)  │    │
│  │ ・Cognito User Pool (isolé par attribut de locataire)     │    │
│  │ ・DynamoDB (clé de partition tenant ID)                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Avantages** :
- Opérations consolidées (gestion d'un seul compte)
- Coût partagé pour les composants communs
- Déploiement simplifié

**Inconvénients** :
- Isolation des données au niveau applicatif (risque de mauvaise configuration)
- Répartition de la facturation requise
- Problèmes potentiels de voisin bruyant

**Applicable lorsque** :
- Le nombre de clients est important (10+ entreprises)
- L'efficacité des coûts est prioritaire
- Les exigences d'isolation des données sont relativement souples

### Modèle C : Hybride (Plan de gestion partagé + Plan de données isolé)

```
┌─────────────────────────────────────────────────────────┐
│ Compte de gestion partenaire                              │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Plan de gestion (Partagé)                             │  │
│ │ ・CDK Pipelines / Automatisation du déploiement      │  │
│ │ ・API de gestion des locataires                      │  │
│ │ ・Tableau de bord de surveillance (agrégé)           │  │
│ │ ・Gestion de la facturation                          │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │ Plan de données (Isolé par client)            │
    │                                              │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │Client A  │  │Client B  │  │Client C  │  │
    │  │ VPC      │  │ VPC      │  │ VPC      │  │
    │  │ FSx+KB   │  │ FSx+KB   │  │ FSx+KB   │  │
    │  └──────────┘  └──────────┘  └──────────┘  │
    └─────────────────────────────────────────────┘
```

---

## Éléments de conception de l'isolation des locataires

### 1. Isolation du stockage

| Niveau d'isolation | Méthode | Force d'isolation des données | Coût |
|-------------------|---------|-------------------------------|------|
| Isolation du système de fichiers | Système de fichiers FSx par client | La plus élevée | Élevé |
| Isolation SVM | Isolation SVM dans 1 système de fichiers | Élevée | Moyen |
| Isolation de volume | Isolation de volume dans 1 SVM | Moyenne | Faible |
| Isolation par préfixe | Isolation de répertoire dans 1 volume | Faible | Le plus faible |

**Recommandé** : Isolation SVM (Modèle B) ou isolation du système de fichiers (Modèle A)

### 2. Isolation du magasin vectoriel

| Méthode | S3 Vectors | OpenSearch Serverless |
|---------|-----------|---------------------|
| KB par locataire | KB + Index séparés | KB + Collection séparés |
| KB partagée + filtre de métadonnées | Filtrer par métadonnée `tenant_id` | Filtrer par champ `tenant_id` |

**Recommandé** : KB par locataire (frontière de sécurité claire)

### 3. Isolation de l'authentification

| Méthode | Description | Modèle applicable |
|---------|-------------|-------------------|
| Isolation Cognito User Pool | User Pool par locataire | Modèle A |
| Isolation par groupe Cognito | User Pool partagé + groupes de locataires | Modèle B |
| Isolation par attribut personnalisé | Attribut `custom:tenant_id` | Modèle B |
| Isolation IdP externe | IdP OIDC/SAML par locataire | Modèle A/C |

### 4. Isolation des journaux et de l'audit

| Ressource | Méthode d'isolation |
|----------|---------------------|
| CloudWatch Logs | Groupe de logs ou préfixe par locataire |
| CloudTrail | Trail par locataire (Modèle A) ou Trail partagé + filtre |
| Table d'audit DynamoDB | Clé de partition `tenantId` |
| Bucket de logs S3 | Préfixe par locataire + politique de bucket |

### 5. Isolation du chiffrement KMS

| Méthode | Description | Coût |
|---------|-------------|------|
| CMK par locataire | Isolation complète du chiffrement | CMK × nombre de locataires |
| CMK partagée + politique de clé | Priorité efficacité des coûts | 1 CMK |
| CMK gérée par le locataire (BYOK) | Le client gère les clés | Coût à la charge du client |

---

## Déploiement automatisé avec CDK

### Modèle StackSets (pour le Modèle A)

```typescript
// Déployer depuis le compte de gestion partenaire vers les comptes clients
const stackSet = new CfnStackSet(this, 'TenantStackSet', {
  stackSetName: 'permission-aware-rag-tenant',
  templateBody: tenantTemplate,
  parameters: [
    { parameterKey: 'TenantId', parameterValue: tenantId },
    { parameterKey: 'TenantDomain', parameterValue: tenantDomain },
  ],
  permissionModel: 'SERVICE_MANAGED',
  autoDeployment: { enabled: true, retainStacksOnAccountRemoval: false },
});
```

### Modèle CDK Pipelines (pour le Modèle C)

```typescript
// Ajouter une étape pour chaque locataire
for (const tenant of tenants) {
  pipeline.addStage(new TenantStage(this, `Tenant-${tenant.id}`, {
    env: { account: tenant.accountId, region: tenant.region },
    tenantConfig: tenant,
  }));
}
```

---

## Modèle de proposition

### Avant / Après

| Aspect | Avant (État actuel) | Après (Avec ce système) |
|--------|---------------------|-------------------------|
| Recherche de fichiers | Exploration manuelle des dossiers partagés, faible précision de recherche | L'IA présente les documents optimaux dans le périmètre des permissions |
| Gestion des permissions | Risque de disparition des frontières de permissions lors de l'utilisation de l'IA | Les ACL NTFS existantes directement reflétées dans l'IA |
| Utilisation des connaissances | Silos de connaissances entre départements, dépendance aux personnes | Recherche de connaissances inter-organisationnelle respectant les permissions |
| Charge opérationnelle | Copie de données et reconfiguration des permissions nécessaires pour l'IA | Connecter directement les données sur FSx à l'IA |

### Critères de succès du PoC

| Métrique | Valeur cible | Méthode de mesure |
|----------|-------------|-------------------|
| Précision des réponses | 80 %+ (évaluation humaine) | Jugé avec un ensemble d'évaluation de 50 questions |
| Contrôle des permissions | 0 violation | Vérifié avec le test de matrice de permissions |
| Temps de réponse | P95 < 10 secondes | Métriques CloudWatch |
| Effort opérationnel | Réduction de 50 % vs. actuel | Entretiens avec les administrateurs |

### Considérations supplémentaires pour la production

| Catégorie | Considérations |
|-----------|---------------|
| Fédération d'identité | Intégration SSO avec l'AD / IdP existant, exigences MFA |
| Audit | Rétention des journaux de recherche, piste d'accès, revue périodique |
| Classification des données | Définitions des niveaux de confidentialité, critères d'éligibilité à l'utilisation de l'IA |
| Gestion des coûts | Budget mensuel, plan de mise à l'échelle, allocation des coûts |
| SLA | Objectifs de disponibilité, RPO/RTO, structure de support |
| Juridique | Conditions d'utilisation, accord de traitement des données, limites de responsabilité |

---

## Modèle d'estimation des coûts

### Estimation mensuelle (PoC petite échelle)

| Ressource | Configuration | Estimation mensuelle |
|----------|---------------|---------------------|
| FSx for ONTAP | 128 Mo/s, 1 Tio SSD, Single-AZ | 300 $ |
| S3 Vectors | ~10 000 vecteurs | 5 $ |
| Bedrock (Titan Embed) | Sync initiale + incrémentale | 10 $ |
| Bedrock (Claude) | 1 000 requêtes/mois | 50 $ |
| Lambda | WebApp + sync | 20 $ |
| CloudFront + WAF | Frais de base | 15 $ |
| DynamoDB | On-demand | 5 $ |
| Cognito | ~50 utilisateurs | 0 $ (offre gratuite) |
| **Total** | | **~400 $/mois** |

### Estimation mensuelle (Production : moyenne échelle)

| Ressource | Configuration | Estimation mensuelle |
|----------|---------------|---------------------|
| FSx for ONTAP | 512 Mo/s, 5 Tio SSD, Multi-AZ | 3 000 $ |
| OpenSearch Serverless | 4 OCU | 1 400 $ |
| Bedrock (Titan Embed) | Sync périodique | 50 $ |
| Bedrock (Claude Sonnet) | 10 000 requêtes/mois | 500 $ |
| Lambda | WebApp + sync + surveillance | 100 $ |
| CloudFront + WAF | Trafic de production | 100 $ |
| DynamoDB | Provisioned | 50 $ |
| Cognito | ~500 utilisateurs | 25 $ |
| CloudWatch | Logs + métriques + alarmes | 50 $ |
| **Total** | | **~5 300 $/mois** |

---

## Documents associés

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Liste de vérification pour la mise en production |
| [governance-and-audit.md](governance-and-audit.md) | Conception de la gouvernance et de l'audit |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Dimensionnement et performance FSx for ONTAP |
