# Guide de dimensionnement et de performance FSx for ONTAP

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | [English](../en/fsxn-sizing-and-performance.md) | [한국어](../ko/fsxn-sizing-and-performance.md) | [简体中文](../zh-CN/fsxn-sizing-and-performance.md) | [繁體中文](../zh-TW/fsxn-sizing-and-performance.md) | **Français** | [Deutsch](../de/fsxn-sizing-and-performance.md) | [Español](../es/fsxn-sizing-and-performance.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Architectes d'infrastructure, administrateurs de stockage

---

## Aperçu

Ce document fournit des directives de dimensionnement et de conception de performance pour FSx for ONTAP dans le système RAG sensible aux permissions. Il organise les recommandations de configuration en fonction du nombre de fichiers, de la taille des fichiers, de la fréquence d'accès et de la fréquence de re-synchronisation.

---

## Configurations recommandées par échelle

### Petite (~10 000 fichiers) — PoC / Utilisation départementale

| Élément | Valeur recommandée | Notes |
|---------|-------------------|-------|
| Capacité de débit FSx | 128 Mo/s | Configuration minimale |
| Capacité de stockage SSD | 1 024 Gio | Configuration minimale |
| Tiering du pool de capacité | Activé | Optimisation des coûts |
| Magasin vectoriel | S3 Vectors | Faible coût (quelques dollars/mois) |
| Intervalle KB Auto-Sync | 15 min | Par défaut |
| Temps d'indexation initiale | 5–15 min | Dépend de la taille des documents |
| Estimation mensuelle (FSx uniquement) | ~300–500 $ | débit + SSD |

### Moyenne (10 000–100 000 fichiers) — Unité métier / Utilisation à l'échelle de l'entreprise

| Élément | Valeur recommandée | Notes |
|---------|-------------------|-------|
| Capacité de débit FSx | 256–512 Mo/s | Basé sur le nombre d'accès simultanés |
| Capacité de stockage SSD | 2 048–10 240 Gio | Basé sur le volume de données chaudes |
| Tiering du pool de capacité | Activé | Tiering automatique des données froides |
| Magasin vectoriel | S3 Vectors ou OpenSearch Serverless | Choisir selon les exigences QPS |
| Intervalle KB Auto-Sync | 5–15 min | Basé sur la fréquence de mise à jour |
| Temps d'indexation initiale | 30–120 min | Peut être raccourci avec le traitement parallèle |
| Estimation mensuelle (FSx uniquement) | ~1 000–5 000 $ | débit + SSD + pool de capacité |

### Grande (100 000–1 000 000 fichiers) — Entreprise

| Élément | Valeur recommandée | Notes |
|---------|-------------------|-------|
| Capacité de débit FSx | 1 024–4 096 Mo/s | Multi-AZ + haut débit |
| Capacité de stockage SSD | 10 240+ Gio | Basé sur le volume de données chaudes |
| Tiering du pool de capacité | Activé | La plupart des données dans le pool de capacité |
| Magasin vectoriel | OpenSearch Serverless | QPS élevé, faible latence |
| Intervalle KB Auto-Sync | Conception de synchronisation incrémentale requise | L'analyse complète est impraticable |
| Temps d'indexation initiale | Plusieurs heures à 1 jour | Découpage en lots recommandé |
| Estimation mensuelle (FSx uniquement) | ~5 000–30 000+ $ | Fortement dépendant de la configuration |

---

## Caractéristiques de performance de FSx for ONTAP

### Capacité de débit

La capacité de débit de FSx for ONTAP est configurée au niveau du système de fichiers.

| Débit | IOPS lecture (SSD) | IOPS écriture | Bande passante réseau | Cas d'utilisation |
|-------|-------------------|--------------|----------------------|-------------------|
| 128 Mo/s | 6 000 | 1 500 | Jusqu'à 600 Mo/s | PoC, petite échelle |
| 256 Mo/s | 12 000 | 3 000 | Jusqu'à 1,2 Go/s | Utilisation départementale |
| 512 Mo/s | 40 000 | 10 000 | Jusqu'à 2,4 Go/s | Échelle entreprise |
| 1 024 Mo/s | 80 000 | 20 000 | Jusqu'à 4,8 Go/s | Grande échelle |
| 2 048 Mo/s | 160 000 | 40 000 | Jusqu'à 9,6 Go/s | Mission critique |

> **Référence** : Amazon FSx for ONTAP prend en charge jusqu'à 72 Go/s de débit (configuration 12 paires HA).

### Tiering de stockage (Capacity Pool Tiering)

| Tier | Caractéristiques | Coût | Cas d'utilisation |
|------|-----------------|------|-------------------|
| SSD | Latence inférieure à la milliseconde | Élevé | Fichiers fréquemment accédés |
| Capacity Pool | Latence de dizaines de millisecondes | Faible (~1/10 du SSD) | Archive, accès peu fréquent |

**Recommandations pour les systèmes RAG** :
- `.metadata.json` et documents fréquemment recherchés → Tier SSD
- Documents d'archive, anciennes versions → Capacity Pool

**Politiques de tiering** :
- `auto` : Déplace automatiquement les données vers le Capacity Pool après une période sans accès (recommandé)
- `snapshot-only` : Déplace uniquement les données de snapshot vers le Capacity Pool
- `all` : Déplace toutes les données vers le Capacity Pool (priorité coût)
- `none` : Conserve toutes les données sur SSD (priorité performance)

---

## Considérations sur le S3 Access Point

### Caractéristiques de performance

Le S3 Access Point de FSx for ONTAP expose les fichiers sur les volumes FSx via une interface compatible S3.

| Opération | Latence | Débit | Notes |
|-----------|---------|-------|-------|
| ListObjectsV2 | Centaines de millisecondes | — | Proportionnel au nombre de fichiers |
| GetObject (petits fichiers) | Dizaines à centaines de millisecondes | — | Pour le tier SSD |
| GetObject (gros fichiers) | Proportionnel à la taille du fichier | Dépend du débit FSx | Streaming |
| HeadObject | Dizaines de millisecondes | — | Métadonnées uniquement |

### Charge pendant la synchronisation Bedrock KB

Pendant la synchronisation KB (StartIngestionJob), Bedrock lit tous les documents via le S3 Access Point.

| Nombre de documents | Charge de lecture pendant la sync | Débit recommandé |
|---------------------|----------------------------------|-------------------|
| ~1 000 | Faible (quelques Go) | 128 Mo/s est suffisant |
| ~10 000 | Moyenne (dizaines de Go) | 256 Mo/s recommandé |
| ~100 000 | Élevée (centaines de Go) | 512 Mo/s ou supérieur recommandé |

### Autorisation à double couche

L'accès via le S3 Access Point nécessite 2 couches d'authentification :

1. **Authentification IAM** : Politique S3 Access Point + politique basée sur l'identité IAM
2. **Authentification système de fichiers** : ACL NTFS (mappage utilisateur Windows)

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## Critères de sélection du magasin vectoriel

### S3 Vectors vs OpenSearch Serverless

| Aspect | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| Coût (petite échelle) | Quelques dollars/mois | 700+ $/mois (minimum 2 OCU) |
| Coût (grande échelle) | Proportionnel au nombre de vecteurs | Proportionnel au nombre d'OCU |
| Latence de requête | Froid : inférieur à la seconde, Chaud : ~100 ms | Toujours ~50 ms |
| Nombre max de vecteurs | 10 000 index/bucket | Pratiquement illimité |
| Filtre de métadonnées | 2 Ko/vecteur (filtrable) | Limites assouplies |
| Évolutivité | Automatique | Mise à l'échelle OCU manuelle/auto |
| Charge opérationnelle | Quasi nulle | Surveillance OCU requise |
| Export | → OpenSearch Serverless (un clic) | — |

### Organigramme de sélection

```
Utilisateurs simultanés < 10 ET nombre de documents < 10 000 ?
  → Oui : S3 Vectors (priorité coût)
  → Non :
    Exigence de latence < 100 ms ?
      → Oui : OpenSearch Serverless
      → Non :
        Budget mensuel < 1 000 $ ?
          → Oui : S3 Vectors (latence acceptable)
          → Non : OpenSearch Serverless
```

### Chemin de migration

La migration de S3 Vectors → OpenSearch Serverless peut être effectuée avec un export en un clic depuis la console (prend ~15 min). La migration inverse est réalisée via une re-sync KB.

---

## Conception de l'indexation initiale

### Approche recommandée

| Nombre de documents | Méthode | Notes |
|---------------------|---------|-------|
| ~1 000 | Sync KB par lot | Se termine avec un seul `StartIngestionJob` |
| ~10 000 | Sync KB par lot | Attendre la fin de la synchronisation (30–60 min) |
| ~100 000 | Découpage en lots | Diviser les sources de données et synchroniser de manière incrémentale |
| 100 000+ | Ingestion progressive | Ingérer par dossier → répéter la synchronisation |

### Considérations pour l'indexation initiale

1. **Augmentation temporaire du débit FSx** : La charge de lecture est élevée pendant l'indexation initiale, envisagez d'augmenter temporairement la capacité de débit
2. **Connexions simultanées S3 Access Point** : Bedrock KB lit les fichiers en parallèle, soyez conscient des limites de connexions simultanées FSx
3. **Préparer les `.metadata.json` à l'avance** : Confirmez que tous les documents ont un `.metadata.json` avant de démarrer la synchronisation
4. **Modifications de fichiers pendant la sync** : Des incohérences peuvent survenir si des fichiers sont modifiés pendant la synchronisation. Un gel des modifications pendant la synchronisation initiale est recommandé

---

## Conception de la synchronisation incrémentale

### Comportement de KB Auto-Sync

Mécanisme de synchronisation incrémentale activé avec `enableKbAutoSync=true` :

```
EventBridge Scheduler (intervalle 5–15 min)
  → Lambda : Obtenir la liste des fichiers depuis S3 AP via ListObjectsV2
  → DynamoDB : Comparer avec l'inventaire précédent
  → Uniquement en cas de détection de changement : Exécuter StartIngestionJob
  → Si un job IN_PROGRESS existe : Ignorer (déduplication)
```

### Mécanisme de détection des changements

| Cible de détection | Méthode | Notes |
|-------------------|---------|-------|
| Nouveaux fichiers | Comparaison LastModified | Clés non présentes dans l'inventaire DynamoDB |
| Fichiers mis à jour | Comparaison ETag / LastModified | Clés avec des valeurs modifiées |
| Fichiers supprimés | Diff d'inventaire | Clés présentes dans DynamoDB mais pas dans S3 AP |

### Défis de la synchronisation incrémentale à grande échelle

| Nombre de fichiers | Durée ListObjectsV2 | Contre-mesure |
|-------------------|---------------------|---------------|
| ~10 000 | Quelques secondes | Aucun problème |
| ~100 000 | Dizaines de secondes | Étendre le timeout Lambda (15 min) |
| 100 000+ | Plusieurs minutes ou plus | Découpage par préfixe, Step Functions |

---

## Conception QoS (Quality of Service)

Lorsque plusieurs locataires ou charges de travail partagent FSx, les politiques QoS peuvent contrôler la performance.

### Paramètres QoS recommandés

| Charge de travail | Priorité | Limite IOPS | Limite de débit |
|-------------------|----------|-------------|-----------------|
| Recherche RAG (via S3 AP) | Élevée | Illimité | Illimité |
| Sync KB (lot) | Moyenne | 5 000 IOPS | 100 Mo/s |
| Accès utilisateur CIFS/SMB | Élevée | Illimité | Illimité |
| Sauvegarde / SnapMirror | Faible | 2 000 IOPS | 50 Mo/s |

### Application des politiques QoS

```bash
# Créer un groupe de politique QoS via ONTAP CLI
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# Appliquer la politique QoS au volume
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## Surveillance de la capacité et expansion automatique

### Métriques de surveillance

| Métrique | Seuil | Action |
|----------|-------|--------|
| Utilisation SSD | > 80 % | Étendre la capacité ou revoir la politique de tiering |
| Utilisation du Capacity Pool | > 90 % | Étendre la capacité |
| Utilisation IOPS | > 80 % | Augmenter la capacité de débit |
| Utilisation de la bande passante réseau | > 70 % | Augmenter la capacité de débit |

### Expansion automatique (FSx ONTAP Ops)

Le Lambda de surveillance de capacité inclus dans `automation/fsxn-ops/` effectue l'expansion automatique :

- Surveille l'utilisation des volumes toutes les 5 minutes via EventBridge
- Étend automatiquement la taille du volume lorsque le seuil est dépassé
- Les Capacity Guardrails (limite quotidienne, période de refroidissement) empêchent la sur-expansion
- Le tableau de bord CloudWatch visualise l'historique d'expansion

---

## Conseils d'optimisation des coûts

### 1. Exploiter le Capacity Pool Tiering

La plupart des documents ciblés pour la recherche RAG sont rarement accédés une fois intégrés. Définissez la politique de tiering sur `auto` pour déplacer automatiquement les données peu fréquemment accédées vers le tier à faible coût.

### 2. Dimensionner correctement la capacité de débit

La charge de lecture diminue significativement après l'indexation initiale. Synchronisez avec un débit élevé initialement, puis réduisez le débit pendant la phase opérationnelle pour réduire les coûts.

```bash
# Changer la capacité de débit (sans interruption)
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. Exploiter S3 Vectors

Pour les environnements de petite à moyenne taille, utilisez S3 Vectors (quelques dollars/mois) pour éviter les coûts d'OpenSearch Serverless (700+ $/mois). L'export en un clic est disponible lorsque les exigences de performance augmentent.

---

## Documents associés

| Document | Description |
|----------|-------------|
| [permission-consistency.md](permission-consistency.md) | Modèle de cohérence des changements de permissions |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | Architecture S3 Vectors + SID |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | Comparaison des 3 configurations |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | Automatisation des opérations FSx ONTAP |
