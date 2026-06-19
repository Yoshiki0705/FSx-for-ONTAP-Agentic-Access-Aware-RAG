# Architecture d'intégration des S3AP Serverless Patterns

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | [English](../en/s3ap-serverless-patterns-integration.md) | [한국어](../ko/s3ap-serverless-patterns-integration.md) | [简体中文](../zh-CN/s3ap-serverless-patterns-integration.md) | [繁體中文](../zh-TW/s3ap-serverless-patterns-integration.md) | **Français** | [Deutsch](../de/s3ap-serverless-patterns-integration.md) | [Español](../es/s3ap-serverless-patterns-integration.md)

**Date de création**: 2026-05-23  
**Statut**: Brouillon  
**Public**: Architectes, SA partenaires

---

## Vue d'ensemble

Ce document décrit l'architecture d'intégration entre [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) (modèles de traitement serverless pour 17 UC) et ce projet (Permission-aware Agentic RAG).

---

## Positionnement des deux projets

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (serveur de fichiers d'entreprise)                        │
│                                                                         │
│  Données NAS: plans, contrats, dossiers médicaux, rapports financiers...│
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (Traitement /                │  │ (Recherche et dialogue IA    │
│  Transformation / Analyse)   │  │  basés sur les permissions)  │
│                              │  │                              │
│ • Step Functions (lots)      │  │ • Bedrock KB + Converse API  │
│ • Intégration AI/ML          │  │ • Filtrage SID               │
│ • Réécriture vers FSx        │  │ • UI de chat (Next.js)       │
│                              │  │ • Mode Agent                 │
│ 17 UC sectoriels             │  │ 14 modèles Agent             │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## Modèles d'intégration

### Modèle A: rendre les résultats de traitement interrogeables via le RAG

Les résultats traités et analysés par les S3AP Serverless Patterns sont utilisés comme documents interrogeables dans le RAG.

```
FSx for ONTAP (données brutes: images DICOM, PDF de contrats, journaux IoT)
  ↓ S3 AP (lecture)
S3AP Serverless Patterns
  ├─ UC5: DICOM → extraction de métadonnées et anonymisation
  ├─ UC1: contrats → extraction et classification d'entités
  └─ UC3: journaux IoT → détection d'anomalies et génération de rapports
  ↓ S3 AP (réécriture) ou compartiment S3
FSx for ONTAP (données traitées + .metadata.json)
  ↓ S3 AP (lecture)
Permission-aware RAG (Bedrock KB)
  ↓ Filtrage SID
Utilisateur: « Quels produits ont présenté des anomalies lors du contrôle qualité le mois dernier ? »
```

**Avantages**:
- Les données brutes (images, binaires) sont converties en texte compréhensible par l'IA avant l'ingestion dans le RAG
- Des métadonnées de permission sont ajoutées aux résultats de traitement, préservant le contrôle d'accès par département
- Les deux systèmes partagent le même volume FSx for ONTAP (aucune copie de données requise)

### Modèle B: déclencher des pipelines de traitement depuis le RAG

Lorsque l'utilisateur demande « Lancer une analyse » en mode Agent, cela déclenche les Step Functions du modèle S3AP.

```
Utilisateur: « Analyse les dernières images de contrôle qualité et crée un rapport »
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: analyse pour l'industrie manufacturière)
  ↓ Traitement terminé
Agent: « Analyse terminée. Voici les résultats: ... »
```

### Modèle C: intégration de l'audit et de la conformité

Les résultats d'audit de S3AP UC1 (juridique/conformité) sont rendus interrogeables via le RAG, permettant de vérifier l'état de conformité de manière interactive.

```
S3AP UC1: audit du serveur de fichiers → génération du rapport d'audit
  ↓
RAG: « Existe-t-il des fichiers en violation de conformité ? »
  → Réponses tirées des rapports d'audit, dans les limites des permissions de l'utilisateur
```

---

## Cartographie d'intégration par secteur

| S3AP UC | Secteur | Utilisation dans le RAG | Modèle Agent |
|---------|------|----------------|------------------|
| UC1 | Juridique | Recherche de rapports d'audit, vérification de l'état de conformité | `legalCompliance` |
| UC2 | Finance | Recherche de factures et contrats traités par OCR | `financial` |
| UC3 | Industrie manufacturière | Recherche de rapports de contrôle qualité et de résultats de détection d'anomalies | `search` |
| UC5 | Santé | Recherche de métadonnées DICOM et de conclusions anonymisées | `medicalGuideline` |
| UC10 | Construction | Recherche de métadonnées BIM et de rapports de conformité en matière de sécurité | `project` |
| UC13 | Éducation | Recherche de résultats de classification d'articles et de réseaux de citations | `search` |
| UC14 | Assurance | Recherche de rapports d'expertise et de résultats d'évaluation des dommages | `insuranceClaim` |
| UC16 | Secteur public | Recherche de classification de documents et de documents caviardés | `publicDocument` |

---

## Exemples de configuration de déploiement

### Configuration minimale (compte unique)

```
AWS Account
├── FSx for ONTAP (volume partagé)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (déploiement sélectif)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### Configuration d'entreprise (multi-comptes)

```
Management Account
├── StackSets (distribution des modèles S3AP)
└── CDK Pipelines (distribution du RAG)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Modèles de déploiement multi-tenant |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR (magasin de vecteurs, filtre de permissions, etc.) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Détails des 17 UC |
