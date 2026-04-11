# Guía de escenarios de verificación

## Descripción general

Procedimientos de verificación del sistema Permission-aware RAG. El filtrado basado en SID garantiza resultados de búsqueda diferentes para distintos usuarios que hacen la misma pregunta.

---

## Escenario 4: Verificación OIDC + LDAP Federation

> **Requisitos previos**: CDK desplegado con `oidcProviderConfig` + `ldapConfig`. Servidor OpenLDAP en ejecución en el VPC.

### 4-1. Configuración de OpenLDAP

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. Usuarios de prueba LDAP

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. Puntos de verificación

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. Scripts de verificación

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. Consideraciones para la configuración de OpenLDAP

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

Ver [Guía de configuración por modo de autenticación](es/auth-mode-setup-guide.md).


---

## 5. Demo de Colaboración Multi-Agente

### Requisitos Previos

Despliegue con `enableMultiAgent: true` en `cdk.context.json`.

### 5-1. Activar Modo Multi-Agente

1. Haga clic en el alternador **[Multi Agent]** en el encabezado del chat
2. Seleccione el Supervisor Agent del menú desplegable **[Agent Select]** en el encabezado
3. Se crea automáticamente una nueva sesión multi-agente

### 5-2. Búsqueda Multi-Agente con Filtrado de Permisos

Inicie sesión como **admin** y haga una pregunta. Verifique la UI de Agent Trace para la línea de tiempo y el desglose de costos. Luego inicie sesión como **user** y compare los resultados.

### 5-3. Comparación Single Agent vs Multi-Agent

1. Envíe una pregunta en **modo Single** → anote tiempo de respuesta y costo
2. Cambie a **modo Multi** → envíe la misma pregunta → compare

### 5-4. Notas de Despliegue

- **Valores válidos de CloudFormation `AgentCollaboration`**: `DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` solamente. `COLLABORATOR` NO es válido
- **Despliegue en 2 etapas**: Crear Supervisor Agent con `DISABLED`, luego Custom Resource Lambda: `UpdateAgent` → `SUPERVISOR_ROUTER`, `AssociateAgentCollaborator`, `PrepareAgent`
- **Permisos IAM**: El rol Supervisor necesita `bedrock:GetAgentAlias` + `bedrock:InvokeAgent` en `agent-alias/*/*`. Custom Resource Lambda necesita `iam:PassRole`
- **Alias de Collaborator**: Cada Collaborator Agent requiere `CfnAgentAlias` antes de la referencia del Supervisor
- **autoPrepare=true no permitido**: No puede usarse en el Supervisor Agent

### 5-5. Hallazgos Operativos

- **Obtención de lista de Teams**: El alternador Multi en la página de chat obtiene la lista de teams vía API al cargar y verifica `teams.length > 0`. El modo Multi se deshabilita cuando no existen teams (comportamiento diseñado)
- **Selección directa del Supervisor**: Seleccionar el Supervisor Agent del menú desplegable e invocarlo en modo Single Agent aún activa la colaboración multi-agente en el lado de Bedrock (el flujo Supervisor → Collaborator funciona)
- **Filtrado de permisos**: Las respuestas del Supervisor Agent incluyen citas filtradas por permisos (los usuarios admin pueden ver documentos confidenciales, los usuarios regulares solo ven los públicos)
- **Actualización de imagen Docker**: Después de cambios en el código, se requieren 3 pasos: `docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation` (CDK no detecta cambios en la etiqueta `latest`)
- **Integración modo Multi**: Alternador Multi → llamada a `/api/bedrock/agent-team/invoke` → respuesta con `multiAgentTrace` → renderizado condicional de MultiAgentTraceTimeline + CostSummary verificado funcionando
- **Traces de Collaborator**: `buildCollaboratorTraces` extrae información de ejecución de Collaborator de los eventos de trace de la API InvokeAgent de Bedrock Agent, pero las llamadas internas del Supervisor a Collaborators pueden no aparecer siempre en los traces (limitación del lado de Bedrock). Las respuestas se devuelven normalmente independientemente
- **routingClassifierTrace**: En modo `SUPERVISOR_ROUTER`, los traces de Collaborator aparecen en `routingClassifierTrace` (no `orchestrationTrace`) como `agentCollaboratorInvocationInput/Output`
- **Resolución automática de SID en filteredSearch**: La Lambda filteredSearch resuelve automáticamente la información SID desde la tabla DynamoDB User Access mediante `sessionAttributes.userId`. El filtrado de permisos funciona incluso sin parámetros SID explícitos
- **Problema de comillas en metadatos KB**: Los `allowed_group_sids` de Bedrock KB pueden contener comillas adicionales. La función `cleanSID` las elimina para un correcto matching de SID
- **i18n de instrucciones de Agent**: La propiedad CDK `agentLanguage` (predeterminado: `'auto'`) permite instrucciones en inglés con adaptación automática del idioma de respuesta al idioma del usuario
- **Verificación E2E exitosa**: Usuario admin en modo Multi → consulta de catálogo de productos → contenido de FSx for ONTAP devuelto con filtrado de permisos. Panel de detalle RetrievalAgent y CostSummary mostrados correctamente
