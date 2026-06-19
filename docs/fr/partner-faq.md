# FAQ Partenaire (Foire aux questions)

**🌐 Language:** [日本語](../partner-faq.md) | [English](../en/partner-faq.md) | [한국어](../ko/partner-faq.md) | [简体中文](../zh-CN/partner-faq.md) | [繁體中文](../zh-TW/partner-faq.md) | **Français** | [Deutsch](../de/partner-faq.md) | [Español](../es/partner-faq.md)

**Date de création** : 2026-05-24  
**Public cible** : Entreprises partenaires, intégrateurs de systèmes (SI) et cabinets de conseil

---

## Questions fréquentes lors des propositions client

### Q1. Est-il possible de migrer depuis un serveur de fichiers existant (Windows Server) ?

**A** : Oui. FSx for ONTAP prend en charge le même protocole SMB/CIFS que les serveurs de fichiers Windows Server et conserve les NTFS ACL telles quelles. En le joignant à votre domaine Active Directory existant, l'expérience utilisateur reste inchangée. AWS DataSync ou robocopy peuvent être utilisés pour la migration.

**Document associé** : [Conception du dimensionnement et des performances de FSx for ONTAP](fsxn-sizing-and-performance.md)

---

### Q2. Qui configure les permissions ? Une configuration supplémentaire est-elle nécessaire ?

**A** : Les NTFS ACL / permissions UNIX existantes sont directement reflétées dans la recherche RAG. Aucune configuration de permissions supplémentaire n'est nécessaire. Lorsque les administrateurs du serveur de fichiers définissent les permissions des dossiers comme d'habitude, celles-ci sont automatiquement appliquées aux résultats de la recherche RAG.

**Fonctionnement** : Les informations de permissions (SID/UID/GID) sont enregistrées dans le `.metadata.json` de chaque fichier, et au moment de la recherche, les résultats sont filtrés en les comparant aux permissions de l'utilisateur.

---

### Q3. Combien de fichiers le système peut-il gérer ?

**A** : Nous recommandons les configurations suivantes selon l'échelle :

| Échelle | Nombre de fichiers | Configuration FSx | Estimation mensuelle |
|------|-----------|---------|---------|
| Petite (PoC) | Jusqu'à 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| Moyenne | Jusqu'à 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| Grande | Jusqu'à 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**Document associé** : [Feuille de calcul d'estimation des coûts](cost-estimation-worksheet.md)

---

### Q4. Peut-il s'intégrer aux fournisseurs d'identité existants (Active Directory / Okta / Auth0) ?

**A** : Oui. Les méthodes d'authentification suivantes sont prises en charge :

| Méthode d'authentification | IdP pris en charge | Récupération SID/permissions |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | Post-Auth Trigger récupère le SID depuis AD automatiquement |
| OIDC | Auth0, Okta, Keycloak, Entra ID | Revendications de groupe OIDC + requête LDAP |
| LDAP | OpenLDAP, FreeIPA | Récupération directe UID/GID |
| E-mail/Mot de passe | Cognito | Enregistrement manuel dans DynamoDB |

**Document associé** : [Guide d'authentification et de gestion des utilisateurs](auth-and-user-management.md)

---

### Q5. Combien de temps prend un PoC et quel est son coût ?

**A** : 

| Phase | Durée | Coût AWS | Activités |
|---------|------|-----------|---------|
| Déploiement | 1 jour | — | Déploiement CDK + ingestion des données de test |
| Validation de base | 1 semaine | ~$100 | Vérification du fonctionnement avec les données de démonstration |
| PoC sur données client | 2-4 semaines | ~$430/mois | Ingestion de données réelles + évaluation |

Un **atelier pratique de 90 minutes** est également disponible → [Guide de l'atelier PoC](poc-workshop-guide.md)

---

### Q6. Peut-on proposer cette solution à des clients ayant des exigences de sécurité strictes (finance, santé, secteur public) ?

**A** : Oui. Le système comprend les fonctionnalités de sécurité suivantes :

- Défense à 6 couches (restriction Geo → WAF → OAC → IAM Auth → Cognito → filtrage SID)
- Chiffrement KMS (S3, DynamoDB, FSx)
- Points de terminaison VPC (sans passage par Internet)
- Journaux d'audit (CloudTrail + table d'audit DynamoDB)
- Conception Fail-Closed (accès refusé lorsque les permissions sont inconnues)
- Bedrock Guardrails (filtrage de contenu, détection de PII)

**Cependant** : Les fonctionnalités de sécurité techniques de ce système ne satisfont pas automatiquement aux exigences légales ou de conformité. Pour les charges de travail réglementées, des évaluations juridiques et de conformité spécifiques au client sont nécessaires.

**Documents associés** : [Liste de contrôle de mise en production](production-readiness-checklist.md), [Modèle de menace](threat-model.md)

---

### Q7. La multi-location (déploiement chez plusieurs clients) est-elle possible ?

**A** : Oui. Trois modèles de déploiement sont disponibles :

| Modèle | Niveau d'isolation | Conditions d'application |
|---------|-----------|---------|
| A : Isolation par compte | Le plus élevé | Exigences strictes d'isolation des données (finance, santé) |
| B : Isolation par SVM | Élevé | Isoler les données client au sein du même compte |
| C : Isolation par préfixe | Moyen | Axé sur les coûts, clients de petite taille |

**Document associé** : [Modèles de déploiement partenaire](partner-deployment-patterns.md)

---

### Q8. Comment les documents provenant de partenaires externes (cabinets d'avocats, cabinets d'audit) sont-ils reçus ?

**A** : L'ingestion SFTP via AWS Transfer Family est prise en charge. Les partenaires téléversent simplement des fichiers à l'aide d'un client SFTP, et les métadonnées de permissions sont automatiquement attribuées avant l'ingestion dans la RAG Knowledge Base.

- Les partenaires n'ont pas besoin d'accéder à la Web UI ni à l'AWS Console
- L'écrasement de `.metadata.json` est empêché par IAM Deny (protection de la frontière de confiance)
- Recherche RAG possible en moins de 5 minutes

**Document associé** : [Intégration des partenaires Transfer Family](transfer-family-partner-onboarding.md)

---

### Q9. Est-il possible de poser des questions par la voix ?

**A** : Oui. Deux modes de chat vocal sont disponibles :

| Mode | Technologie | Latence | Statut |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | Moyenne | GA, déployable via CDK |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | Faible | Implémenté, déploiement CLI |

Le filtrage des permissions est appliqué tout au long du flux : entrée vocale → conversion en texte → recherche Permission-aware RAG → sortie vocale.

---

### Q10. Qu'en est-il de l'intégration avec d'autres services AWS ?

**A** : Les services suivants sont déjà intégrés :

| Service | Utilisation |
|---------|------|
| Amazon Bedrock (KB + Agent) | Recherche RAG + collaboration multi-agents |
| Amazon Cognito | Authentification et gestion des utilisateurs |
| Amazon CloudFront + WAF | CDN + sécurité |
| Amazon S3 Vectors | Base de données vectorielle (faible coût) |
| Amazon EventBridge | Planification de la synchronisation automatique de la KB |
| AWS Transfer Family | Ingestion SFTP |
| Amazon CloudWatch | Surveillance, alertes, tableaux de bord |
| AWS Step Functions | Automatisation des opérations FSx for ONTAP |

---

## FAQ technique

### Q11. Quelle est la différence entre un S3 Access Point et un compartiment S3 ?

**A** : Un S3 Access Point est une interface d'accès compatible S3 pour les volumes FSx for ONTAP. Contrairement aux compartiments S3 :

- Les données restent sur FSx for ONTAP (elles ne sont pas copiées vers S3)
- Les mêmes données sont accessibles via NFS/SMB et l'API S3
- Il existe une limite de taille de téléversement de 5 Go
- Les opérations rename / append ne sont pas prises en charge

---

### Q12. Qu'en est-il du rollback en cas d'échec du déploiement ?

**A** : CDK étant basé sur CloudFormation, les déploiements échoués sont automatiquement annulés (rollback). Si un rollback manuel est nécessaire :

```bash
# Supprimer une pile spécifique
npx cdk destroy <stack-name>

# Supprimer toutes les piles
npx cdk destroy --all --force
```

**Document associé** : [Dépannage du déploiement](deployment-troubleshooting.md)

---

## Ressources pour les propositions et les ateliers

| Ressource | Utilisation | Lien |
|---------|------|--------|
| Données de démonstration spécifiques au secteur | Démos adaptées au secteur du client | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| Atelier de 90 minutes | Expérience pratique | [Guide de l'atelier PoC](poc-workshop-guide.md) |
| Estimation des coûts | Pièce jointe à la proposition | [Feuille de calcul d'estimation des coûts](cost-estimation-worksheet.md) |
| Critères de réussite du PoC | Accord client | [Modèle de critères de réussite du PoC](poc-success-criteria-template.md) |
| Liste de contrôle de mise en production | Planification de la migration | [Liste de contrôle de mise en production](production-readiness-checklist.md) |
| Schéma d'architecture | Pièce jointe à la proposition | Section Architecture du README.md |
