# Modèle de rapport de résultats de PoC

**🌐 Language:** [日本語](../../templates/poc-result-report-template.md) | [English](../../en/templates/poc-result-report-template.md) | [한국어](../../ko/templates/poc-result-report-template.md) | [简体中文](../../zh-CN/templates/poc-result-report-template.md) | [繁體中文](../../zh-TW/templates/poc-result-report-template.md) | **Français** | [Deutsch](../../de/templates/poc-result-report-template.md) | [Español](../../es/templates/poc-result-report-template.md)

**Objet**: format permettant à un partenaire ou à un intégrateur de restituer les résultats d'un PoC au client.

---

## 1. Résumé

| Élément | Contenu |
|---|---|
| Client | _____ |
| Période | YYYY/MM/DD — YYYY/MM/DD |
| Processus métier visé | _____ |
| Documents concernés | _____ |
| Utilisateurs concernés | _____ |
| Évaluation globale | ☐ Passage en production recommandé / ☐ Validation complémentaire nécessaire / ☐ Abandon |

---

## 2. Résultats quantitatifs

### 2.1 Qualité du RAG

| Indicateur | Cible | Mesuré | Verdict |
|---|---|---|---|
| Fidélité (Faithfulness) | ≥ 0.85 | _____ | ☐ Pass / ☐ Fail |
| Pertinence de la réponse | ≥ 0.80 | _____ | ☐ Pass / ☐ Fail |
| Précision du contexte | ≥ 0.75 | _____ | ☐ Pass / ☐ Fail |
| Violations de permission | 0 | _____ | ☐ Pass / ☐ Fail |

### 2.2 Performance

| Indicateur | Cible | Mesuré | Verdict |
|---|---|---|---|
| Temps de réponse (P50) | ≤ 3s | _____ s | ☐ Pass / ☐ Fail |
| Temps de réponse (P95) | ≤ 8s | _____ s | ☐ Pass / ☐ Fail |
| Taux de succès du cache de prompts | ≥ 50% | _____ % | ☐ Pass / ☐ Fail |

### 2.3 Effets métier

| Indicateur | Avant le PoC | Après le PoC | Amélioration |
|---|---|---|---|
| Temps de recherche (par requête) | _____ min | _____ s | _____ % |
| Taux de résolution au premier niveau | _____ % | _____ % | _____ pt |
| Accès à des informations hors permissions | _____ cas | 0 cas | 100% |

---

## 3. Vérification du contrôle des permissions

| Scénario de test | Résultat | Remarques |
|---|---|---|
| Administrateur → accès à tous les documents | ☐ Pass / ☐ Fail | |
| Utilisateur standard → documents publics uniquement | ☐ Pass / ☐ Fail | |
| Permission de groupe → documents de son service uniquement | ☐ Pass / ☐ Fail | |
| Changement de permission → répercuté | ☐ Pass / ☐ Fail | Délai maximal: _____ min |
| Document sans permission → exclu des résultats | ☐ Pass / ☐ Fail | |

---

## 4. Coûts constatés

| Élément | Estimation mensuelle | Remarques |
|---|---|---|
| FSx for ONTAP | $_____ | |
| Bedrock (inférence) | $_____ | après Smart Routing |
| Bedrock (embedding) | $_____ | initial + incrémental |
| Magasin de vecteurs | $_____ | S3 Vectors / OpenSearch |
| Autres (Lambda, DynamoDB, CloudFront) | $_____ | |
| **Total** | **$_____** | |

---

## 5. Problèmes relevés et recommandations

| # | Problème | Impact | Action recommandée | Échéance |
|---|---|---|---|---|
| 1 | | ☐ Élevé / ☐ Moyen / ☐ Faible | | |
| 2 | | ☐ Élevé / ☐ Moyen / ☐ Faible | | |
| 3 | | ☐ Élevé / ☐ Moyen / ☐ Faible | | |

---

## 6. Étapes vers la production

| # | Action | Responsable | Échéance |
|---|---|---|---|
| 1 | Évaluation de sécurité (IAM au moindre privilège, chiffrement) | | |
| 2 | Test de charge (deux fois le nombre d'utilisateurs prévu) | | |
| 3 | Conception de la reprise (Multi-AZ, sauvegardes) | | |
| 4 | Conception de l'exploitation (runbook, alertes) | | |
| 5 | Réunion de décision Go/No-Go | | |

---

## 7. Annexes

- [ ] Captures du tableau de bord CloudWatch
- [ ] Résultats de l'évaluation RAGAS (JSON)
- [ ] Résultats des tests de la matrice de permissions
- [ ] Détail des coûts (AWS Cost Explorer)
- [ ] Résultats de l'enquête utilisateurs (le cas échéant)
