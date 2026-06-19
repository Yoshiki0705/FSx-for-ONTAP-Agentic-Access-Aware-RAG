# Modèle de critères de réussite de PoC

**🌐 Language:** [日本語](../poc-success-criteria-template.md) | [English](../en/poc-success-criteria-template.md) | [한국어](../ko/poc-success-criteria-template.md) | [简体中文](../zh-CN/poc-success-criteria-template.md) | [繁體中文](../zh-TW/poc-success-criteria-template.md) | **Français** | [Deutsch](../de/poc-success-criteria-template.md) | [Español](../es/poc-success-criteria-template.md)

**Date de création** : 2026-05-24  
**Objet** : Modèle de définition des critères de réussite à convenir avec les clients et partenaires avant le démarrage d'un PoC

---

## Points à convenir avant le PoC

### 1. Parties prenantes

| Rôle | Nom | Organisation | Périmètre de responsabilité |
|------|-----|--------------|------------------------------|
| **Sponsor métier** | __________ | __________ | Décision finale Go/No-Go, approbation du budget |
| **Propriétaire des données** | __________ | __________ | Classification/approbation des données injectées, vérification de la conception des permissions |
| **Responsable technique** | __________ | __________ | Déploiement, configuration, validation technique |
| **Évaluateur** | __________ | __________ | Évaluation de la qualité des réponses, mesure des KPI |
| **Responsable sécurité** | __________ | __________ | Revue de la conception des permissions, vérification des journaux d'audit |
| **Responsable des opérations** | __________ | __________ | Conception opérationnelle lors de la migration en production, définition des SLO |

---

### 2. Objectifs et périmètre du PoC

| Élément | Détails |
|---------|---------|
| **Problème métier à résoudre** | (ex. : la recherche de documents de conception prend en moyenne 15 minutes, ce qui entraîne des retards de projet) |
| **Départements concernés** | (ex. : département conception + département gestion de la qualité, 30 personnes au total) |
| **Données concernées** | (ex. : 500 PDF de plans de conception, 200 spécifications techniques, 100 rapports qualité) |
| **Durée du PoC** | (ex. : 4 semaines — du 2026/06/01 au 2026/06/28) |
| **Plafond budgétaire** | (ex. : coûts AWS dans la limite de $2,000/mois) |

---

### 3. Indicateurs de réussite (critères Go/No-Go)

#### Indicateurs obligatoires (Go si tous atteints)

| # | Indicateur | Objectif | Méthode de mesure | Atteint ? |
|---|------------|----------|-------------------|-----------|
| 1 | Nombre de violations de permissions | **0 incident** | Test de matrice de permissions + vérification manuelle | ☐ |
| 2 | Précision des réponses (score de pertinence) | **3.5/5.0 ou plus** | Évaluation qualitative d'au moins 10 questions par l'évaluateur | ☐ |
| 3 | Temps de réponse (P95) | **10 secondes maximum** | Métriques CloudWatch | ☐ |
| 4 | Disponibilité | **99% ou plus** (pendant la période du PoC) | Alarmes CloudWatch | ☐ |

#### Indicateurs souhaitables (points bonus si atteints)

| # | Indicateur | Objectif | Méthode de mesure | Atteint ? |
|---|------------|----------|-------------------|-----------|
| 5 | Taux de réduction du temps de recherche | 50% ou plus | Enquête utilisateur (Before/After) | ☐ |
| 6 | Taux de résolution dès la première réponse | 60% ou plus | Retours utilisateurs (👍/👎) | ☐ |
| 7 | Satisfaction des utilisateurs | 4.0/5.0 ou plus | Enquête de fin de PoC | ☐ |
| 8 | Taux de réponses avec Citation | 90% ou plus | Agrégation automatique | ☐ |

---

### 4. Critères de décision Go/No-Go

| Décision | Conditions |
|----------|------------|
| **Go (passer à la phase suivante)** | Tous les indicateurs obligatoires #1 à #4 atteints + au moins 2 indicateurs souhaitables atteints |
| **Conditional Go (sous conditions)** | Tous les indicateurs obligatoires #1 à #4 atteints + au plus 1 indicateur souhaitable → élaborer un plan d'amélioration et réévaluer |
| **No-Go (arrêt/réexamen)** | L'un des indicateurs obligatoires non atteint → analyse des causes racines → nouveau PoC ou changement d'orientation |

**Date de décision** : dans les 5 jours ouvrés suivant la fin de la période du PoC  
**Décideur** : sponsor métier (la personne mentionnée dans le tableau des parties prenantes ci-dessus)

---

### 5. Conditions pour la phase suivante

Après une décision Go, conditions supplémentaires pour passer en production (L2→L3) :

- [ ] Revue de sécurité terminée (section L2→L3 de la [Checklist de mise en production](production-readiness-checklist.md))
- [ ] Conception opérationnelle terminée (définition des SLO, configuration des alarmes, rédaction du runbook)
- [ ] Estimation des coûts approuvée ([Feuille d'estimation des coûts](cost-estimation-worksheet.md))
- [ ] Approbation par le propriétaire des données de l'injection des données de production
- [ ] Conception de la conservation des journaux d'audit approuvée

---

### 6. Risques et hypothèses

| Risque | Impact | Mesure d'atténuation |
|--------|--------|----------------------|
| Faible qualité des données (précision de l'OCR, métadonnées manquantes) | Baisse de la précision des réponses | Vérifier la qualité avec des données d'échantillon avant le PoC |
| Faible taux de participation des utilisateurs | Données d'évaluation insuffisantes | Partager les objectifs lors du lancement, suivis hebdomadaires |
| Conception des permissions trop complexe | Augmentation de la charge de configuration | Commencer avec un nombre minimal de groupes de permissions |
| Qualité des réponses du modèle inférieure aux attentes | Échec du PoC | Traiter par ajustement des prompts, changement de la stratégie de chunking |

| Hypothèse | Statut |
|-----------|--------|
| Compte AWS disponible | ☐ Confirmé |
| Données concernées pouvant être fournies | ☐ Confirmé |
| Évaluateur affecté | ☐ Confirmé |
| Exigences réseau (VPN, etc.) confirmées | ☐ Confirmé |

---

### 7. Modèle de rapport de fin de PoC

À la fin du PoC, créez le rapport suivant et soumettez-le au sponsor métier :

```markdown
## Rapport de fin de PoC

### Résumé
- Période du PoC : YYYY/MM/DD – YYYY/MM/DD
- Nombre d'utilisateurs participants : XX
- Nombre total de requêtes : XXX

### État d'atteinte des indicateurs de réussite
| Indicateur | Objectif | Réel | Résultat |
|------------|----------|------|----------|
| ... | ... | ... | ✅/❌ |

### Décision Go/No-Go
- Décision : Go / Conditional Go / No-Go
- Justification : ...

### Recommandations pour la phase suivante
1. ...
2. ...

### Problèmes en suspens
1. ...
```

---

## Documents associés

- [Guide d'expérimentation sûre](safe-experimentation-guide.md) — Définition de ce qui peut être testé en toute sécurité pendant le PoC
- [Framework d'évaluation RAG / Agent](evaluation.md) — Métriques d'évaluation détaillées et méthodes de mesure
- [Checklist de mise en production](production-readiness-checklist.md) — Liste complète de vérification pour la migration L2→L3
- [Feuille d'estimation des coûts](cost-estimation-worksheet.md) — Estimations mensuelles des coûts par configuration
