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

## Nettoyage

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Dépannage

| | Mode | | |
|---|---|---|---|
| CDK deploy fails | All | CDK CLI version mismatch | `npm install aws-cdk@latest` |
| OIDC auth failure | C,D,E | Invalid `clientId`/`issuerUrl` | Check OIDC IdP settings |
| LDAP connection failure | C | SG/VPC misconfiguration | Check Lambda CloudWatch Logs |
| OAuth callback error | B,C,D,E | `cloudFrontUrl` not set | Get URL after first deploy, redeploy |

---

## Documents associés

- [Guide d'authentification et de gestion des utilisateurs](../../docs/fr/auth-and-user-management.md)
- [FSx ONTAP Setup Guide](ontap-setup-guide.md)
