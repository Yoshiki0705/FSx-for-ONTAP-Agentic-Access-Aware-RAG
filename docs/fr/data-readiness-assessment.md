# Modèle d'évaluation de la préparation des données

**🌐 Language:** [日本語](../data-readiness-assessment.md) | [English](../en/data-readiness-assessment.md) | [한국어](../ko/data-readiness-assessment.md) | [简体中文](../zh-CN/data-readiness-assessment.md) | [繁體中文](../zh-TW/data-readiness-assessment.md) | **Français** | [Deutsch](../de/data-readiness-assessment.md) | [Español](../es/data-readiness-assessment.md)

**Date de création** : 2026-05-24  
**Objet** : Un modèle pour évaluer la préparation des données avant de démarrer un PoC

---

## Vue d'ensemble

Ce modèle aide à évaluer la préparation des données à ingérer dans le système Permission-aware RAG, en soutenant une exécution de PoC sûre et efficace. Il doit être rempli conjointement par le propriétaire des données et le responsable technique.

---

## 1. Vérification de l'emplacement des données

| # | Élément | Réponse |
|---|---------|---------|
| 1.1 | Où les données sont-elles physiquement stockées ? | ☐ Serveur de fichiers sur site ☐ Sur AWS (S3/EFS/FSx) ☐ SaaS ☐ Autre : ________ |
| 1.2 | Volume de données (nombre de fichiers / taille totale) | Nombre de fichiers : ________, Taille totale : ________ Go |
| 1.3 | Répartition des formats de fichiers | PDF : ___% / DOCX : ___% / TXT : ___% / Autre : ___% |
| 1.4 | Fréquence de mise à jour des données | ☐ Quotidienne ☐ Hebdomadaire ☐ Mensuelle ☐ Ponctuelle ☐ Statique (aucune mise à jour) |
| 1.5 | Langue des données | ☐ Japonais ☐ Anglais ☐ Mixte ☐ Autre : ________ |

---

## 2. Classification des données

| Niveau de confidentialité | Définition | Nombre de fichiers | Exemples |
|---------------------------|------------|--------------------|----------|
| **Public** | Peut être partagé en externe | ________ fichiers | Catalogues de produits, communiqués de presse |
| **Interne** | Accessible à tous les employés | ________ fichiers | Politiques internes, informations sur les avantages sociaux |
| **Restreint au département** | Départements spécifiques uniquement | ________ fichiers | Plans de projet, spécifications techniques |
| **Confidentiel** | Rôles spécifiques uniquement | ________ fichiers | Rapports financiers, informations RH |
| **Top secret** | Personnes nommées uniquement | ________ fichiers | Documents de fusion-acquisition, documents de litige juridique |

---

## 3. Vérification de la structure des autorisations

| # | Élément | Réponse |
|---|---------|---------|
| 3.1 | Méthode actuelle de gestion des autorisations ? | ☐ NTFS ACL (Active Directory) ☐ Permissions UNIX ☐ Spécifique à l'application ☐ Aucune (tout le monde a accès) |
| 3.2 | Nombre de groupes d'autorisations | ________ groupes |
| 3.3 | Structure hiérarchique des autorisations | ☐ Plate ☐ 2 niveaux ☐ 3 niveaux ou plus ☐ Inconnue |
| 3.4 | Fréquence de modification des autorisations | ☐ Quotidienne ☐ Hebdomadaire ☐ Mensuelle ☐ Trimestrielle ☐ Rarement |
| 3.5 | Confiance dans l'exactitude des autorisations | ☐ Élevée ☐ Moyenne ☐ Faible (audit nécessaire) |

---

## 4. Vérification de la qualité des données

| # | Élément | Réponse | Impact |
|---|---------|---------|--------|
| 4.1 | Existe-t-il des PDF numérisés nécessitant l'OCR ? | ☐ Aucun ☐ Quelques-uns ☐ La plupart | Affecte la précision du RAG |
| 4.2 | Les noms de fichiers reflètent-ils le contenu ? | ☐ Oui ☐ Partiellement ☐ Non | Affecte la précision de la recherche |
| 4.3 | La structure des dossiers est-elle organisée de façon logique ? | ☐ Oui ☐ Partiellement ☐ Non | Affecte la conception des autorisations |
| 4.4 | Existe-t-il des fichiers en double ? | ☐ Aucun ☐ Quelques-uns ☐ Nombreux | Affecte les coûts de stockage |
| 4.5 | Des fichiers obsolètes/invalides sont-ils mélangés ? | ☐ Aucun ☐ Quelques-uns ☐ Nombreux | Affecte la précision des réponses |

---

## 5. Vérification de la conformité et de la confidentialité

| # | Élément | Réponse | Action |
|---|---------|---------|--------|
| 5.1 | Contient-il des PII ? | ☐ Non ☐ Oui → Type : ________ | Masquage ou détection PII par Guardrails |
| 5.2 | S'agit-il de données réglementées ? | ☐ Non ☐ Oui → Réglementation : ________ | Examen juridique requis |
| 5.3 | Existe-t-il des restrictions d'exportation des données ? | ☐ Non ☐ Oui | Affecte le choix de la région |
| 5.4 | Existe-t-il des exigences de conservation des données ? | ☐ Non ☐ Oui → Durée : ________ | Affecte la conception des sauvegardes |
| 5.5 | Existe-t-il des exigences de conservation des pistes d'audit ? | ☐ Non ☐ Oui | `enableMonitoring=true` requis |

---

## 6. Approbation du propriétaire des données

| Élément d'approbation | Approbateur | Date | Signature |
|-----------------------|-------------|------|-----------|
| Approuver l'ingestion des données pour le PoC | __________ | ____/____/____ | ________ |
| Confirmer l'exactitude de la classification des données | __________ | ____/____/____ | ________ |
| Confirmer la validité de la conception des autorisations | __________ | ____/____/____ | ________ |
| Accepter la suppression des données après le PoC | __________ | ____/____/____ | ________ |

---

## 7. Évaluation de la préparation

Sur la base des réponses de toutes les sections, prenez la décision suivante :

| Évaluation | Conditions |
|------------|------------|
| **Ready** | Toutes les sections 1-6 complétées, PII traitées, approbation du propriétaire des données obtenue |
| **Conditional** | Certains éléments incomplets, mais démarrage possible avec des données de démonstration → Préparer les données en parallèle |
| **Not Ready** | Emplacement des données inconnu, structure des autorisations inconnue, PII non confirmées → Phase de préparation des données nécessaire d'abord |

**Résultat de l'évaluation** : ☐ Ready ☐ Conditional ☐ Not Ready

**Date de l'évaluation** : ____/____/____  
**Évaluateur** : __________

---

## Documents associés

- [Guide d'expérimentation sûre](safe-experimentation-guide.md) — Ce qui peut être testé en toute sécurité et ce qui est interdit
- [Modèle de critères de réussite du PoC](poc-success-criteria-template.md) — Critères de décision Go/No-Go
- [Liste de contrôle de préparation à la production](production-readiness-checklist.md) — Liste de contrôle de migration L2→L3
- [Conception de la gouvernance et de l'audit](governance-and-audit.md) — Schéma des journaux d'audit et exigences de conservation
