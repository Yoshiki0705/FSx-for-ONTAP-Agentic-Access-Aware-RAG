# Spécification formelle du schéma .metadata.json

**🌐 Language:** [日本語](../metadata-json-schema.md) | [English](../en/metadata-json-schema.md) | **Français**

**Date de création** : 2026-06-08  
**Statut** : Spécification formelle  
**Public cible** : Développeurs, Ingénieurs de données, Partenaires

---

## Présentation

Spécification formelle du fichier de métadonnées (`.metadata.json`) qui attache les informations de permission aux documents sur FSx for ONTAP. Fonctionne avec le filtrage de métadonnées de Bedrock Knowledge Base pour activer le RAG sensible aux permissions (Permission-Aware RAG).

---

## Convention de nommage des fichiers

```
Document cible :        {path}/{filename}.{ext}
Fichier de métadonnées : {path}/{filename}.{ext}.metadata.json
```

**Exemple :**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← métadonnées
```

---

## Définition du schéma

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"],
    "category": "esg",
    "owner": "sustainability-team",
    "classification": "internal"
  }
}
```

### Liste des champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `metadataAttributes` | Object | ✅ | Conteneur d'attributs de métadonnées |
| `metadataAttributes.allowed_group_sids` | `string[]` (formel) ou `string` (rétrocompatible) | ✅ | Liste des SID autorisés |
| `metadataAttributes.category` | `string` | ❌ | Catégorie du document |
| `metadataAttributes.owner` | `string` | ❌ | Propriétaire (équipe/département) |
| `metadataAttributes.classification` | `string` enum | ❌ | Niveau de confidentialité |

### Formats de `allowed_group_sids`

| Format | Exemple | Statut |
|--------|---------|--------|
| **Tableau (formel)** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ Recommandé |
| Séparé par virgules | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ Rétrocompatible (obsolète) |
| Chaîne JSON | `"[\"S-1-1-0\"]"` | ⚠️ Rétrocompatible (obsolète) |
| Valeur unique | `"S-1-1-0"` | ⚠️ Rétrocompatible |

> **Important** : Utilisez toujours le **format tableau** lors de la création de nouveaux fichiers.

### Valeurs valides de `classification`

| Valeur | Description |
|--------|-------------|
| `public` | Information publique (accessible à tous) |
| `internal` | Usage interne uniquement |
| `confidential` | Confidentiel (groupes spécifiques uniquement) |
| `restricted` | Top secret (approbation individuelle requise) |

---

## Format SID

Format standard de Windows Security Identifier (SID) :

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | Signification |
|-----|---------------|
| `S-1-1-0` | Everyone (tout le monde) |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Principe Fail-Closed

| État | Comportement |
|------|--------------|
| `.metadata.json` n'existe pas | **Accès refusé** (Fail-Closed) |
| `allowed_group_sids` est un tableau vide | **Accès refusé** |
| `allowed_group_sids` ne contient aucune correspondance avec les SID de l'utilisateur | **Accès refusé** |
| `allowed_group_sids` contient une correspondance avec les SID de l'utilisateur | **Accès accordé** |

---

## Règles de validation

1. `metadataAttributes` est obligatoire
2. `allowed_group_sids` est obligatoire et ne doit pas être vide
3. Chaque SID doit commencer par `S-` dans un format valide (avertissement uniquement, non bloquant)
4. Le format séparé par virgules émet un avertissement recommandant la migration vers le format tableau

---

## Outil de création

```bash
# Créer des métadonnées au format formel via script
python3 -c "
import json
metadata = {
    'metadataAttributes': {
        'allowed_group_sids': ['S-1-1-0', 'S-1-5-21-xxx-512'],
        'category': 'esg',
        'classification': 'internal'
    }
}
print(json.dumps(metadata, indent=2))
" > document.json.metadata.json
```

---

## Documents connexes

- [Tests Permission Matrix](../../tests/permission-matrix/) — 31 scénarios de vérification des permissions
- [Gestion des erreurs KB Auto-Sync](../kb-auto-sync-error-handling.md) — Ingestion de documents avec métadonnées
- [Liste de contrôle de mise en production](../production-readiness-checklist.md) — Exigences opérationnelles de gestion des métadonnées
