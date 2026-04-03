# Sistema RAG con gestión de permisos y Amazon FSx for NetApp ONTAP

**🌐 Language / Idioma:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | **Español**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Este repositorio es un ejemplo que despliega un RAG Agéntico con control de acceso impulsado por Amazon Bedrock usando AWS CDK, aprovechando los datos empresariales y los permisos de acceso en Amazon FSx for NetApp ONTAP. Utilizando FSx for ONTAP como fuente de datos, implementa búsqueda y generación de respuestas considerando la información de ACL / permisos. Para el almacén de vectores, puede elegir entre Amazon S3 Vectors (predeterminado, bajo costo) o Amazon OpenSearch Serverless (alto rendimiento). Cuenta con una interfaz de usuario orientada a tareas basada en tarjetas, construida con Next.js 15 en AWS Lambda (Lambda Web Adapter), permitiéndole validar una configuración segura de RAG / asistente de IA para uso empresarial.

---

## Arquitectura

```
+----------+     +----------+     +------------+     +---------------------+
| Browser  |---->| AWS WAF  |---->| CloudFront |---->| Lambda Web Adapter  |
+----------+     +----------+     | (OAC+Geo)  |     | (Next.js, IAM Auth) |
                                  +------------+     +------+--------------+
                                                            |
                      +---------------------+---------------+--------------------+
                      v                     v               v                    v
             +-------------+    +------------------+ +--------------+   +--------------+
             | Cognito     |    | Bedrock KB       | | DynamoDB     |   | DynamoDB     |
             | User Pool   |    | + S3 Vectors /   | | user-access  |   | perm-cache   |
             +-------------+    |   OpenSearch SL  | | (SID Data)   |   | (Perm Cache) |
                                +--------+---------+ +--------------+   +--------------+
                                         |
                                         v
                                +------------------+
                                | FSx for ONTAP    |
                                | (SVM + Volume)   |
                                | + S3 Access Point|
                                +--------+---------+
                                         | CIFS/SMB (optional)
                                         v
                                +------------------+
                                | Embedding EC2    |
                                | (Titan Embed v2) |
                                | (optional)       |
                                +------------------+
```

## Descripción general de la implementación (13 perspectivas)

La implementación de este sistema está organizada en 13 perspectivas. Para detalles de cada elemento, consulte [docs/implementation-overview.md](docs/implementation-overview.md).

| # | Perspectiva | Descripción general | Stack CDK relacionado |
|---|-------------|---------------------|----------------------|
| 1 | Aplicación Chatbot | Next.js 15 (App Router) ejecutándose de forma serverless con Lambda Web Adapter. Soporte de cambio de modo KB/Agent. Interfaz de usuario orientada a tareas basada en tarjetas | WebAppStack |
| 2 | AWS WAF | Configuración de 6 reglas: limitación de velocidad, reputación IP, reglas compatibles con OWASP, protección SQLi, lista blanca de IP | WafStack |
| 3 | Autenticación IAM | Seguridad multicapa con Lambda Function URL + CloudFront OAC | WebAppStack |
| 4 | Base de datos vectorial | S3 Vectors (predeterminado, bajo costo) / OpenSearch Serverless (alto rendimiento). Seleccionado mediante `vectorStoreType` | AIStack |
| 5 | Servidor de embedding | Vectoriza documentos en EC2 con el volumen FSx ONTAP montado vía CIFS/SMB y escribe en AOSS (solo configuración AOSS) | EmbeddingStack |
| 6 | Titan Text Embeddings | Utiliza `amazon.titan-embed-text-v2:0` (1024 dimensiones) tanto para la ingesta de KB como para el servidor de embedding | AIStack |
| 7 | Metadatos SID + Filtrado de permisos | Gestiona la información SID de ACL NTFS mediante `.metadata.json` y filtra por coincidencia de SID de usuario durante la búsqueda | StorageStack |
| 8 | Cambio de modo KB/Agent | Alternar entre modo KB (búsqueda de documentos) y modo Agent (razonamiento multi-paso). Directorio de Agents (`/genai/agents`) para gestión de Agents estilo catálogo, creación de plantillas, edición y eliminación. Creación dinámica de Agents y vinculación de tarjetas. Flujos de trabajo orientados a resultados (presentaciones, documentos de aprobación, actas de reuniones, informes, contratos, incorporación). Soporte i18n de 8 idiomas. Gestión de permisos en ambos modos | WebAppStack |
| 9 | RAG con análisis de imágenes | Se agregó carga de imágenes (arrastrar y soltar / selector de archivos) a la entrada del chat. Analiza imágenes con la API Bedrock Vision (Claude Haiku 4.5) e integra los resultados en el contexto de búsqueda KB. Soporta JPEG/PNG/GIF/WebP, límite de 3MB | WebAppStack |
| 10 | Interfaz de conexión KB | Interfaz para seleccionar, conectar y desconectar Bedrock Knowledge Bases durante la creación/edición de Agents. Muestra la lista de KB conectadas en el panel de detalle del Agent | WebAppStack |
| 11 | Enrutamiento inteligente | Selección automática de modelo basada en la complejidad de la consulta. Las consultas factuales cortas se enrutan al modelo ligero (Haiku), las consultas analíticas largas al modelo de alto rendimiento (Sonnet). Interruptor ON/OFF en la barra lateral | WebAppStack |
| 12 | Monitoreo y alertas | Panel de CloudWatch (Lambda/CloudFront/DynamoDB/Bedrock/WAF/integración RAG avanzada), alertas SNS (notificaciones de umbral de tasa de error y latencia), notificaciones de fallo de EventBridge KB Ingestion Job, métricas personalizadas EMF. Activar con `enableMonitoring=true` | WebAppStack (MonitoringConstruct) |
| 13 | AgentCore Memory | Mantenimiento del contexto de conversación mediante AgentCore Memory (memoria a corto y largo plazo). Historial de conversación en sesión (corto plazo) + preferencias de usuario y resúmenes entre sesiones (largo plazo). Activar con `enableAgentCoreMemory=true` | AIStack |

## Capturas de pantalla de la interfaz

### Modo KB — Cuadrícula de tarjetas (Estado inicial)

El estado inicial del área de chat muestra 14 tarjetas de propósito específico (8 de investigación + 6 de producción) en un diseño de cuadrícula. Incluye filtros de categoría, funcionalidad de favoritos e InfoBanner (información de permisos).

![KB Mode Card Grid](docs/screenshots/kb-mode-cards-full.png)

### Modo Agent — Cuadrícula de tarjetas + Barra lateral

El modo Agent muestra 14 tarjetas de flujo de trabajo (8 de investigación + 6 de producción). Al hacer clic en una tarjeta se busca automáticamente un Bedrock Agent, y si no se ha creado, navega al formulario de creación del directorio de Agents. La barra lateral incluye un menú desplegable de selección de Agent, configuración del historial de chat y una sección de administración del sistema plegable.

![Agent Mode Card Grid](docs/screenshots/agent-mode-card-grid.png)

### Directorio de Agents — Lista de Agents y pantalla de gestión

Una pantalla de gestión dedicada a Agents accesible en `/[locale]/genai/agents`. Proporciona visualización de catálogo de Bedrock Agents creados, filtros de búsqueda y categoría, panel de detalle, creación basada en plantillas y edición/eliminación en línea. La barra de navegación permite cambiar entre modo Agent / lista de Agents / modo KB. Cuando las funciones empresariales están habilitadas, se agregan las pestañas "Agents compartidos" y "Tareas programadas".

![Agent Directory](docs/screenshots/agent-directory-enterprise.png)

#### Directorio de Agents — Pestaña de Agents compartidos

Habilitado con `enableAgentSharing=true`. Lista, previsualiza e importa configuraciones de Agent desde el bucket S3 compartido.

![Shared Agents Tab](docs/screenshots/agent-directory-shared-tab.png)

### Directorio de Agents — Formulario de creación de Agent

Al hacer clic en "Crear desde plantilla" en una tarjeta de plantilla se muestra un formulario de creación donde puede editar el nombre del Agent, la descripción, el prompt del sistema y el modelo de IA. El mismo formulario aparece al hacer clic en una tarjeta en modo Agent si el Agent aún no se ha creado.

![Agent Creation Form](docs/screenshots/agent-creator-form.png)

### Directorio de Agents — Detalle y edición del Agent

Al hacer clic en una tarjeta de Agent se muestra un panel de detalle que muestra el ID del Agent, estado, modelo, versión, fecha de creación, prompt del sistema (plegable) y grupos de acciones. Las acciones disponibles incluyen "Editar" para edición en línea, "Usar en chat" para navegar al modo Agent, "Exportar" para descarga de configuración JSON, "Subir al bucket compartido" para compartir en S3, "Crear programación" para configuración de ejecución periódica, y "Eliminar" con un diálogo de confirmación.

![Agent Detail Panel](docs/screenshots/agent-detail-panel.png)

### Respuesta del chat — Visualización de citas + Insignia de nivel de acceso

Los resultados de búsqueda RAG muestran las rutas de archivos FSx e insignias de nivel de acceso (accesible para todos / solo administradores / grupos específicos). Durante el chat, un botón "🔄 Volver a la selección de flujo de trabajo" regresa a la cuadrícula de tarjetas. Un botón "➕" en el lado izquierdo del campo de entrada de mensajes inicia un nuevo chat.

![Chat Response + Citation](docs/screenshots/kb-mode-chat-citation.png)

### Carga de imágenes — Arrastrar y soltar + Selector de archivos (v3.1.0)

Se agregó funcionalidad de carga de imágenes al área de entrada del chat. Adjunte imágenes a través de la zona de arrastrar y soltar y el botón 📎 selector de archivos, analice con la API Bedrock Vision (Claude Haiku 4.5) e integre en el contexto de búsqueda KB. Soporta JPEG/PNG/GIF/WebP, límite de 3MB.

![Image Upload Zone](docs/screenshots/kb-mode-image-upload-zone.png)

### Enrutamiento inteligente — Selección automática de modelo optimizada en costos (v3.1.0)

Cuando el interruptor de enrutamiento inteligente en la barra lateral está activado, selecciona automáticamente un modelo ligero (Haiku) o un modelo de alto rendimiento (Sonnet) según la complejidad de la consulta. Se agrega una opción "⚡ Auto" al ModelSelector, y las respuestas muestran el nombre del modelo utilizado junto con una insignia "Auto".

![Smart Routing ON + ResponseMetadata](docs/screenshots/kb-mode-response-metadata-auto.png)

### AgentCore Memory — Lista de sesiones + Sección de memoria (v3.3.0)

Habilitado con `enableAgentCoreMemory=true`. Agrega una lista de sesiones (SessionList) y una visualización de memoria a largo plazo (MemorySection) a la barra lateral del modo Agent. La configuración del historial de chat se reemplaza con una insignia "AgentCore Memory: Enabled".

![AgentCore Memory Sidebar](docs/screenshots/agent-mode-agentcore-memory-sidebar.png)

## Estructura de stacks CDK

| # | Stack | Región | Recursos | Descripción |
|---|-------|--------|----------|-------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set | WAF para CloudFront (limitación de velocidad, reglas administradas) |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints (opcional) | Infraestructura de red |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + OIDC IdP + Cognito Domain (cuando Federation está habilitado), Identity Sync Lambda (opcional) | Autenticación y autorización (SAML/OIDC/Email) |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, (AD), cifrado KMS (opcional), CloudTrail (opcional) | Almacenamiento, datos SID, caché de permisos |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (seleccionado mediante `vectorStoreType`), Bedrock Guardrails (opcional) | Infraestructura de búsqueda RAG (Titan Embed v2) |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker, IAM Auth + OAC), CloudFront, Permission Filter Lambda (opcional), MonitoringConstruct (opcional) | Aplicación web, gestión de Agents, monitoreo y alertas |
| 7 | EmbeddingStack (opcional) | ap-northeast-1 | EC2 (m5.large), ECR, recuperación automática de ACL ONTAP (opcional) | Montaje FlexCache CIFS + servidor de embedding |

### Características de seguridad (Defensa de 6 capas)

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| L1: Red | CloudFront Geo Restriction | Restricción de acceso geográfico (predeterminado: solo Japón) |
| L2: WAF | AWS WAF (6 reglas) | Detección y bloqueo de patrones de ataque |
| L3: Autenticación de origen | CloudFront OAC (SigV4) | Prevenir acceso directo eludiendo CloudFront |
| L4: Autenticación API | Lambda Function URL IAM Auth | Control de acceso mediante autenticación IAM |
| L5: Autenticación de usuario | Cognito JWT / SAML / OIDC Federation | Autenticación y autorización a nivel de usuario |
| L6: Autorización de datos | SID / UID+GID Filtering | Control de acceso a nivel de documento |

## Requisitos previos

- Cuenta AWS (con permisos equivalentes a AdministratorAccess)
- Node.js 22+, npm
- Docker (Colima, Docker Desktop o docker.io en EC2)
- CDK inicializado (`cdk bootstrap aws://ACCOUNT_ID/REGION`)

> **Nota**: Las compilaciones se pueden ejecutar localmente (macOS / Linux) o en EC2. Para Apple Silicon (M1/M2/M3), `pre-deploy-setup.sh` utiliza automáticamente el modo de pre-compilación (compilación local de Next.js + empaquetado Docker) para generar imágenes compatibles con Lambda x86_64. En EC2 (x86_64), se realiza una compilación Docker completa.

## Pasos de despliegue

### Paso 1: Configuración del entorno

Se puede ejecutar localmente (macOS / Linux) o en EC2.

#### Local (macOS)

```bash
# Node.js 22+ (Homebrew)
brew install node@22

# Docker (cualquiera de los dos)
brew install --cask docker          # Docker Desktop (requiere sudo)
brew install docker colima          # Colima (no requiere sudo, recomendado)
colima start --cpu 4 --memory 8     # Iniciar Colima

# AWS CDK
npm install -g aws-cdk typescript ts-node
```

#### EC2 (Ubuntu 22.04)

```bash
# Lanzar un t3.large en una subred pública (con rol IAM habilitado para SSM)
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

El grupo de seguridad solo necesita el puerto de salida 443 (HTTPS) abierto para que SSM Session Manager funcione. No se requieren reglas de entrada.

### Paso 2: Instalación de herramientas (para EC2)

Después de conectarse a través de SSM Session Manager, ejecute lo siguiente.

```bash
# Actualización del sistema + herramientas básicas
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Habilitar Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# AWS CDK (global)
sudo npm install -g aws-cdk typescript ts-node
```

#### ⚠️ Notas sobre la versión del CLI de CDK

La versión del CLI de CDK instalada mediante `npm install -g aws-cdk` puede no ser compatible con el `aws-cdk-lib` del proyecto.

```bash
# Cómo verificar
cdk --version          # Versión CLI global
npx cdk --version      # Versión CLI local del proyecto
```

Este proyecto utiliza `aws-cdk-lib@2.244.0`. Si la versión del CLI está desactualizada, verá el siguiente error:

```
Cloud assembly schema version mismatch: Maximum schema version supported is 48.x.x, but found 52.0.0
```

**Solución**: Actualice el CLI de CDK local del proyecto a la última versión.

```bash
cd Permission-aware-RAG-FSxN-CDK
npm install aws-cdk@latest
npx cdk --version  # Verificar la versión actualizada
```

> **Importante**: Use `npx cdk` en lugar de `cdk` para asegurarse de que se utilice el CLI local más reciente del proyecto.

### Paso 3: Clonar el repositorio e instalar dependencias

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Paso 4: CDK Bootstrap (solo la primera vez)

Ejecute esto si CDK Bootstrap no se ha ejecutado en las regiones objetivo. Como el stack WAF se despliega en us-east-1, se requiere Bootstrap en ambas regiones.

```bash
# ap-northeast-1 (región principal)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1 (para el stack WAF)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> **Al desplegar en una cuenta AWS diferente**: Elimine la caché de AZ (`availability-zones:account=...`) de `cdk.context.json`. CDK recuperará automáticamente la información de AZ para la nueva cuenta.

### Paso 5: Configuración del contexto CDK

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

#### Integración con Active Directory (opcional)

Para unir el SVM de FSx ONTAP a un dominio de Active Directory y usar ACL NTFS (basado en SID) con recursos compartidos CIFS, agregue lo siguiente a `cdk.context.json`.

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

| Parámetro | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| `adPassword` | string | No establecido (no se crea AD) | Contraseña de administrador de AWS Managed Microsoft AD. Cuando se establece, crea AD y une el SVM al dominio |
| `adDomainName` | string | `demo.local` | Nombre de dominio AD (FQDN) |

> **Nota**: La creación de AD toma 20-30 minutos adicionales. Las demostraciones de filtrado SID son posibles sin AD (verificado usando datos SID de DynamoDB).

#### Federación SAML de AD (opcional)

Puede habilitar la federación SAML para que los usuarios de AD inicien sesión directamente desde la interfaz de CloudFront, con creación automática de usuario Cognito + registro automático de datos SID en DynamoDB.

**Descripción general de la arquitectura:**

```
AD User → CloudFront UI → "Sign in with AD" button
  → Cognito Hosted UI → SAML IdP (AD) → AD Authentication
  → Automatic Cognito User Creation
  → Post-Auth Trigger → AD Sync Lambda → DynamoDB SID Data Registration
  → OAuth Callback → Session Cookie → Chat Screen
```

**Parámetros CDK:**

| Parámetro | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| `enableAdFederation` | boolean | `false` | Indicador de habilitación de federación SAML |
| `cloudFrontUrl` | string | No establecido | URL de CloudFront para la URL de callback OAuth (ej. `https://d3xxxxx.cloudfront.net`) |
| `samlMetadataUrl` | string | No establecido | Para AD autogestionado: URL de metadatos de federación de Entra ID |
| `adEc2InstanceId` | string | No establecido | Para AD autogestionado: ID de instancia EC2 |

> **Configuración automática de variables de entorno**: Al desplegar CDK con `enableAdFederation=true` o `oidcProviderConfig`, las variables de entorno de Federation (`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`, `IDP_NAME`) se configuran automáticamente en la función Lambda de WebAppStack. No se requiere configuración manual de variables de entorno Lambda.

**Patrón de AD administrado:**

Al usar AWS Managed Microsoft AD.

> **⚠️ Se requiere la configuración de IAM Identity Center (anteriormente AWS SSO):**
> Para usar la URL de metadatos SAML del AD administrado (`portal.sso.{region}.amazonaws.com/saml/metadata/{directoryId}`), necesita habilitar AWS IAM Identity Center, configurar el AD administrado como fuente de identidad y crear una aplicación SAML. Simplemente crear un AD administrado no proporciona un punto de conexión de metadatos SAML.
>
> Si configurar IAM Identity Center es difícil, también puede especificar directamente una URL de metadatos de IdP externo (AD FS, etc.) a través del parámetro `samlMetadataUrl`.

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net",
  // Opcional: Al usar una URL de metadatos SAML diferente a IAM Identity Center
  // "samlMetadataUrl": "https://your-adfs-server/federationmetadata/2007-06/federationmetadata.xml"
}
```

Pasos de configuración:
1. Establecer `adPassword` y desplegar CDK (crea AD administrado + SAML IdP + Cognito Domain)
2. Habilitar AWS IAM Identity Center y cambiar la fuente de identidad a AD administrado
3. Configurar direcciones de correo electrónico para usuarios AD (PowerShell: `Set-ADUser -Identity Admin -EmailAddress "admin@demo.local"`)
4. En IAM Identity Center, ir a "Administrar sincronización" → "Configuración guiada" para sincronizar usuarios AD
5. Crear una aplicación SAML "Permission-aware RAG Cognito" en IAM Identity Center:
   - URL ACS: `https://{cognito-domain}.auth.{region}.amazoncognito.com/saml2/idpresponse`
   - Audiencia SAML: `urn:amazon:cognito:sp:{user-pool-id}`
   - Mapeos de atributos: Subject → `${user:email}` (emailAddress), emailaddress → `${user:email}`
6. Asignar usuarios AD a la aplicación SAML
7. Después del despliegue, establecer la URL de CloudFront en `cloudFrontUrl` y redesplegar
8. Ejecutar la autenticación AD desde el botón "Iniciar sesión con AD" en la interfaz de CloudFront

**Patrón de AD autogestionado (en EC2, con integración Entra Connect):**

Integra AD en EC2 con Entra ID (anteriormente Azure AD) y usa la URL de metadatos de federación de Entra ID.

```json
{
  "enableAdFederation": true,
  "adEc2InstanceId": "i-0123456789abcdef0",
  "samlMetadataUrl": "https://login.microsoftonline.com/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net"
}
```

Pasos de configuración:
1. Instalar AD DS en EC2 y configurar la sincronización con Entra Connect
2. Obtener la URL de metadatos de federación de Entra ID
3. Establecer los parámetros anteriores y desplegar CDK
4. Ejecutar la autenticación AD desde el botón "Sign in with AD" en la interfaz de CloudFront

**Comparación de patrones:**

| Elemento | AD administrado | AD autogestionado |
|----------|----------------|-------------------|
| Metadatos SAML | A través de IAM Identity Center o especificación de `samlMetadataUrl` | URL de metadatos de Entra ID (especificación de `samlMetadataUrl`) |
| Método de recuperación de SID | LDAP o a través de SSM | SSM → EC2 → PowerShell |
| Parámetros requeridos | `adPassword`, `cloudFrontUrl` + configuración de IAM Identity Center (o `samlMetadataUrl`) | `adEc2InstanceId`, `samlMetadataUrl`, `cloudFrontUrl` |
| Gestión de AD | Administrado por AWS | Administrado por el usuario |
| Costo | Precios de AD administrado | Precios de instancia EC2 |

**Solución de problemas:**

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Fallo de autenticación SAML | URL de metadatos SAML IdP inválida | AD administrado: Verificar la configuración de IAM Identity Center, o especificar directamente a través de `samlMetadataUrl`. Autogestionado: Verificar la URL de metadatos de Entra ID |
| Error de callback OAuth | `cloudFrontUrl` no establecido o no coincide | Verificar que `cloudFrontUrl` en el contexto CDK coincida con la URL de distribución de CloudFront |
| Fallo del Post-Auth Trigger | Permisos insuficientes del Lambda AD Sync | Verificar los detalles del error en CloudWatch Logs. El inicio de sesión en sí no se bloquea |
| Error de acceso S3 en búsqueda KB | El rol IAM de KB carece de permisos de acceso directo al bucket S3 | El rol IAM de KB solo tiene permisos a través de S3 Access Point. Al usar el bucket S3 directamente como fuente de datos, se necesitan agregar permisos `s3:GetObject` y `s3:ListBucket` (no específico de AD Federation) |
| S3 AP data plane API AccessDenied | WindowsUser incluye prefijo de dominio | El WindowsUser del S3 AP NO debe incluir prefijo de dominio (ej: `DEMO\Admin`). Especifique solo el nombre de usuario (ej: `Admin`). CLI acepta el prefijo pero las API del plano de datos fallan |
| Fallo en la creación del dominio Cognito | Conflicto de prefijo de dominio | Verificar si el prefijo `{projectName}-{environment}-auth` está en conflicto con otras cuentas |
| Error USER_PASSWORD_AUTH 401 | SECRET_HASH no enviado cuando Client Secret está habilitado | Con `enableAdFederation=true`, el Client del User Pool tiene Client Secret. La API de inicio de sesión necesita calcular SECRET_HASH desde la variable de entorno `COGNITO_CLIENT_SECRET` |
| Post-Auth Trigger `Cannot find module 'index'` | Lambda TypeScript no compilado | CDK `Code.fromAsset` tiene opción de empaquetado esbuild. `npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=index.js --external:@aws-sdk/*` |
| Redirección OAuth Callback `0.0.0.0` | Lambda Web Adapter `request.url` es `http://0.0.0.0:3000/...` | Usar la variable de entorno `CALLBACK_URL` para construir la URL base de redirección |

#### OIDC/LDAP Federation (opcional) — Aprovisionamiento de usuarios sin intervención

Además de SAML AD Federation, puede habilitar OIDC IdP (Keycloak, Okta, Entra ID, etc.) y consultas LDAP directas para el aprovisionamiento de usuarios sin intervención. Los permisos de usuario existentes del servidor de archivos se mapean automáticamente a los usuarios de la interfaz RAG — no se requiere registro manual por parte de administradores o usuarios.

Cada método de autenticación utiliza la "activación automática basada en configuración". Simplemente agregue los valores de configuración en `cdk.context.json` para habilitarlo, con un costo de recursos AWS adicional prácticamente nulo. La activación simultánea de SAML + OIDC también es compatible.

**Ejemplo de configuración OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak):**

```json
{
  "oidcProviderConfig": {
    "providerName": "Keycloak",
    "clientId": "rag-system",
    "clientSecret": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oidc-client-secret",
    "issuerUrl": "https://keycloak.example.com/realms/main",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldaps://ldap.example.com:636",
    "baseDn": "dc=example,dc=com",
    "bindDn": "cn=readonly,dc=example,dc=com",
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

**Parámetros CDK:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `oidcProviderConfig` | object | Configuración de OIDC IdP (`providerName`, `clientId`, `clientSecret`, `issuerUrl`, `groupClaimName`) |
| `ldapConfig` | object | Configuración de conexión LDAP (`ldapUrl`, `baseDn`, `bindDn`, `bindPasswordSecretArn`, `userSearchFilter`, `groupSearchFilter`) |
| `permissionMappingStrategy` | string | Estrategia de mapeo de permisos: `sid-only` (predeterminado), `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | Integración ONTAP name-mapping (mapeo de usuario UNIX→Windows) |

Página de inicio de sesión híbrida SAML + OIDC (Iniciar sesión con AD + Iniciar sesión con Auth0 + Correo/Contraseña):

![Página de inicio de sesión (SAML + OIDC Híbrido)](docs/screenshots/signin-page-saml-oidc-hybrid.png)

#### Funciones empresariales (opcional)

Los siguientes parámetros de contexto CDK habilitan funciones de mejora de seguridad y unificación de arquitectura.

```json
{
  "useS3AccessPoint": "true",
  "usePermissionFilterLambda": "true",
  "enableGuardrails": "true",
  "enableKmsEncryption": "true",
  "enableCloudTrail": "true",
  "enableVpcEndpoints": "true"
}
```

| Parámetro | Predeterminado | Descripción |
|-----------|----------------|-------------|
| `ontapMgmtIp` | (ninguno) | IP de gestión ONTAP. Cuando se establece, el servidor de embedding genera automáticamente `.metadata.json` desde la API REST de ONTAP |
| `ontapSvmUuid` | (ninguno) | UUID de SVM (usado con `ontapMgmtIp`) |
| `ontapAdminSecretArn` | (ninguno) | ARN de Secrets Manager para la contraseña de administrador de ONTAP |
| `useS3AccessPoint` | `false` | Usar S3 Access Point como fuente de datos de Bedrock KB |
| `volumeSecurityStyle` | `NTFS` | Estilo de seguridad del volumen FSx ONTAP (`NTFS` or `UNIX`) |
| `s3apUserType` | (auto) | Tipo de usuario S3 AP (`WINDOWS` or `UNIX`). Predeterminado: AD configurado→WINDOWS, sin AD→UNIX |
| `s3apUserName` | (auto) | Nombre de usuario S3 AP. Predeterminado: WINDOWS→`Admin`, UNIX→`root` |
| `usePermissionFilterLambda` | `false` | Ejecutar filtrado SID a través de Lambda dedicado (con respaldo de filtrado en línea) |
| `enableGuardrails` | `false` | Bedrock Guardrails (filtro de contenido dañino + protección PII) |
| `enableAgent` | `false` | Bedrock Agent + Action Group con gestión de permisos (búsqueda KB + filtrado SID). Creación dinámica de Agent (crea y vincula automáticamente Agents específicos de categoría al hacer clic en la tarjeta) |
| `enableAgentSharing` | `false` | Bucket S3 de compartición de configuración de Agent. Exportación/importación JSON de configuraciones de Agent, compartición a nivel organizacional a través de S3 |
| `enableAgentSchedules` | `false` | Infraestructura de ejecución programada de Agents (EventBridge Scheduler + Lambda + tabla de historial de ejecución DynamoDB) |
| `enableKmsEncryption` | `false` | Cifrado KMS CMK para S3 y DynamoDB (rotación de claves habilitada) |
| `enableCloudTrail` | `false` | Registros de auditoría CloudTrail (acceso a datos S3 + invocaciones Lambda, retención de 90 días) |
| `enableVpcEndpoints` | `false` | VPC Endpoints (S3, DynamoDB, Bedrock, SSM, Secrets Manager, CloudWatch Logs) |
| `enableMonitoring` | `false` | Panel de CloudWatch + alertas SNS + monitoreo de EventBridge KB Ingestion. Costo: Panel $3/mes + Alarmas $0.10/alarma/mes |
| `monitoringEmail` | *(ninguno)* | Dirección de correo electrónico para notificaciones de alerta (efectivo cuando `enableMonitoring=true`) |
| `enableAgentCoreMemory` | `false` | Habilitar AgentCore Memory (memoria a corto y largo plazo). Requiere `enableAgent=true` |
| `enableAgentCoreObservability` | `false` | Integrar métricas de AgentCore Runtime en el panel (efectivo cuando `enableMonitoring=true`) |
| `enableAdvancedPermissions` | `false` | Control de acceso basado en tiempo + registro de auditoría de decisiones de permisos. Crea la tabla DynamoDB `permission-audit` |
| `alarmEvaluationPeriods` | `1` | Número de períodos de evaluación de alarma (la alarma se activa después de N violaciones consecutivas del umbral) |
| `dashboardRefreshInterval` | `300` | Intervalo de actualización automática del panel (segundos) |

#### Selección de configuración del almacén de vectores

Cambie el almacén de vectores usando el parámetro `vectorStoreType`. El predeterminado es S3 Vectors (bajo costo).

| Configuración | Costo | Latencia | Uso recomendado |
|--------------|-------|---------|-----------------|
| `s3vectors` (predeterminado) | Unos pocos dólares/mes | Sub-segundo a 100ms | Demo, desarrollo, optimización de costos |

#### Uso de un FSx for ONTAP existente

Si ya existe un sistema de archivos FSx for ONTAP, puede referenciar recursos existentes en lugar de crear nuevos. Esto reduce significativamente el tiempo de despliegue (elimina la espera de 30-40 minutos para la creación de FSx ONTAP).

```bash
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c existingFileSystemId=fs-0123456789abcdef0 \
  -c existingSvmId=svm-0123456789abcdef0 \
  -c existingVolumeId=fsvol-0123456789abcdef0 \
  -c vectorStoreType=s3vectors \
  -c enableAgent=true
```

| Parámetro | Descripción |
|-----------|-------------|
| `existingFileSystemId` | ID del sistema de archivos FSx ONTAP existente (ej. `fs-0123456789abcdef0`) |
| `existingSvmId` | ID de SVM existente (ej. `svm-0123456789abcdef0`) |
| `existingVolumeId` | ID de Volume existente (ej. `fsvol-0123456789abcdef0`) |

> **Nota**: En el modo de referencia FSx existente, FSx/SVM/Volume están fuera de la gestión de CDK. No serán eliminados por `cdk destroy`. El AD administrado tampoco se crea (usa la configuración AD del entorno existente).

| Configuración | Costo | Latencia | Uso recomendado | Restricciones de metadatos |
|--------------|-------|---------|-----------------|---------------------------|
| `s3vectors` (predeterminado) | Unos pocos dólares/mes | Sub-segundo a 100ms | Demo, desarrollo, optimización de costos | Límite filterable de 2KB (ver abajo) |
| `opensearch-serverless` | ~$700/mes | ~10ms | Entornos de producción de alto rendimiento | Sin restricciones |

```bash
# Configuración S3 Vectors (predeterminado)
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=s3vectors

# Configuración OpenSearch Serverless
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=opensearch-serverless
```

Si se necesita alto rendimiento mientras se ejecuta con la configuración S3 Vectors, puede exportar bajo demanda a OpenSearch Serverless usando `demo-data/scripts/export-to-opensearch.sh`. Para más detalles, consulte [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md).

### Paso 6: Configuración previa al despliegue (Preparación de imagen ECR)

El stack WebApp referencia una imagen Docker de un repositorio ECR, por lo que la imagen debe prepararse antes del despliegue CDK.

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

Este script realiza automáticamente lo siguiente:
1. Crea el repositorio ECR (`permission-aware-rag-webapp`)
2. Construye y sube la imagen Docker

El modo de construcción se selecciona automáticamente según la arquitectura del host:

| Host | Modo de construcción | Descripción |
|------|---------------------|-------------|
| x86_64 (EC2, etc.) | Construcción Docker completa | npm install + next build dentro del Dockerfile |
| arm64 (Apple Silicon) | Modo pre-construcción | Construcción next local → Empaquetado Docker |

> **Tiempo requerido**: EC2 (x86_64): 3-5 min, Local (Apple Silicon): 5-8 min, CodeBuild: 5-10 min

> **Nota para Apple Silicon**: Se requiere `docker buildx` (`brew install docker-buildx`). Al subir a ECR, especifique `--provenance=false` (porque Lambda no soporta el formato manifest list).

### Paso 7: Despliegue CDK

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

Para habilitar funciones empresariales:

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableAgentSharing=true \
  -c enableAgentSchedules=true \
  --require-approval never
```

Para habilitar monitoreo y alertas:

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  --require-approval never
```

> **Estimación de costo de monitoreo**: CloudWatch Dashboard $3/mes + Alarmas $0.10/alarma/mes (7 alarmas = $0.70/mes) + notificaciones SNS dentro del nivel gratuito. Total aproximadamente $4/mes.

> **Tiempo requerido**: La creación de FSx for ONTAP toma 20-30 minutos, por lo que el total es aproximadamente 30-40 minutos.

### Paso 8: Configuración posterior al despliegue (Comando único)

Una vez completado el despliegue CDK, toda la configuración se finaliza con este único comando:

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Este script realiza automáticamente lo siguiente:
1. Crea S3 Access Point + configura la política
2. Sube datos de demostración a FSx ONTAP (vía S3 AP)
3. Agrega fuente de datos Bedrock KB + sincroniza
4. Registra datos SID de usuario en DynamoDB
5. Crea usuarios de demostración en Cognito (admin / user)

> **Tiempo requerido**: 2-5 minutos (incluyendo espera de sincronización KB)

### Paso 9: Verificación del despliegue (Pruebas automatizadas)

Ejecute scripts de prueba automatizados para verificar toda la funcionalidad.

```bash
bash demo-data/scripts/verify-deployment.sh
```

Los resultados de las pruebas se generan automáticamente en `docs/test-results.md`. Elementos de verificación:
- Estado de los stacks (todos los 6 stacks CREATE/UPDATE_COMPLETE)
- Existencia de recursos (Lambda URL, KB, Agent)
- Respuesta de la aplicación (página de inicio de sesión HTTP 200)
- Modo KB con gestión de permisos (admin: todos los documentos permitidos, user: solo públicos)
- Modo Agent con gestión de permisos (filtrado SID de Action Group)
- S3 Access Point (AVAILABLE)
- Funciones empresariales de Agent (bucket S3 compartido, tabla de historial de ejecución DynamoDB, Lambda programador, respuestas API Sharing/Schedules) *solo cuando `enableAgentSharing`/`enableAgentSchedules` están habilitados

### Paso 10: Acceso por navegador

Recupere la URL de las salidas de CloudFormation y acceda en su navegador.

```bash
aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### Limpieza de recursos

Use el script que elimina todos los recursos (stacks CDK + recursos creados manualmente) de una vez:

```bash
bash demo-data/scripts/cleanup-all.sh
```

Este script realiza automáticamente lo siguiente:
1. Elimina recursos creados manualmente (S3 AP, ECR, CodeBuild)
2. Elimina fuentes de datos Bedrock KB (requerido antes de cdk destroy)
3. Elimina Bedrock Agents creados dinámicamente (Agents fuera de la gestión CDK)
4. Elimina recursos de funciones empresariales de Agent (programaciones y grupos de EventBridge Scheduler, bucket S3 compartido)
5. Elimina el stack Embedding (si existe)
6. CDK destroy (todos los stacks)
7. Eliminación individual de stacks restantes + eliminación de SG AD huérfanos
8. Eliminación de instancias EC2 y SG no gestionados por CDK en VPC + re-eliminación del stack Networking
9. Eliminación de CDKToolkit + bucket S3 staging CDK (ambas regiones, compatible con versionado)

> **Nota**: La eliminación de FSx ONTAP toma 20-30 minutos, por lo que el total es aproximadamente 30-40 minutos.

## Solución de problemas

### Fallo en la creación del stack WebApp (Imagen ECR no encontrada)

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `Source image ... does not exist` | No hay imagen Docker en el repositorio ECR | Ejecute primero `bash demo-data/scripts/pre-deploy-setup.sh` |

> **Importante**: Para cuentas nuevas, siempre ejecute `pre-deploy-setup.sh` antes del despliegue CDK. El stack WebApp referencia la imagen `permission-aware-rag-webapp:latest` en ECR.

### Incompatibilidad de versión del CLI de CDK

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `Cloud assembly schema version mismatch` | El CLI CDK global está desactualizado | Actualice localmente con `npm install aws-cdk@latest` y use `npx cdk` |

### Fallo de despliegue por Hook de CloudFormation

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]` | Hook de CloudFormation a nivel de organización bloqueando ChangeSet | Agregue la opción `--method=direct` para omitir ChangeSet |

```bash
# Despliegue en entornos con Hook de CloudFormation habilitado
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never

# Bootstrap también usa create-stack para creación directa
aws cloudformation create-stack --stack-name CDKToolkit \
  --template-body file://cdk-bootstrap-template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

### Error de permisos de Docker

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `permission denied while trying to connect to the Docker daemon` | El usuario no está en el grupo docker | `sudo usermod -aG docker ubuntu && newgrp docker` |

### Fallo de despliegue de AgentCore Memory

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `EarlyValidation::PropertyValidation` | Las propiedades de CfnMemory no cumplen con el esquema | No se permiten guiones en Name (reemplazar con `_`), EventExpiryDuration es en días (min:3, max:365) |
| `Please provide a role with a valid trust policy` | Principal de servicio inválido para el rol IAM de Memory | Use `bedrock-agentcore.amazonaws.com` (no `bedrock.amazonaws.com`) |
| `actorId failed to satisfy constraint` | actorId contiene `@` `.` de la dirección de correo electrónico | Ya manejado en `lib/agentcore/auth.ts`: `@` → `_at_`, `.` → `_dot_` |
| `AccessDeniedException: bedrock-agentcore:CreateEvent` | El rol de ejecución Lambda carece de permisos AgentCore | Se agrega automáticamente al desplegar CDK con `enableAgentCoreMemory=true` |
| `exec format error` (fallo de inicio de Lambda) | Arquitectura de imagen Docker no coincide con Lambda | Lambda es x86_64. En Apple Silicon, use `docker buildx` + `--platform linux/amd64` |

## Configuración de WAF y restricción geográfica

### Configuración de reglas WAF

El WAF de CloudFront se despliega en `us-east-1` y consta de 6 reglas (evaluadas en orden de prioridad).

| Prioridad | Nombre de regla | Tipo | Descripción |
|-----------|----------------|------|-------------|
| 100 | RateLimit | Personalizado | Bloquea cuando una sola dirección IP excede 3000 solicitudes en 5 minutos |
| 200 | AWSIPReputationList | AWS administrado | Bloquea direcciones IP maliciosas como botnets y fuentes DDoS |
| 300 | AWSCommonRuleSet | AWS administrado | Reglas generales compatibles con OWASP Top 10 (XSS, LFI, RFI, etc.). `GenericRFI_BODY`, `SizeRestrictions_BODY`, `CrossSiteScripting_BODY` excluidos para compatibilidad con solicitudes RAG |
| 400 | AWSKnownBadInputs | AWS administrado | Bloquea solicitudes que explotan vulnerabilidades conocidas como Log4j (CVE-2021-44228) |
| 500 | AWSSQLiRuleSet | AWS administrado | Detecta y bloquea patrones de ataque de inyección SQL |
| 600 | IPAllowList | Personalizado (opcional) | Solo activo cuando `allowedIps` está configurado. Bloquea IPs que no están en la lista |

### Configuración de documentos objetivo de embedding

Los documentos integrados en Bedrock KB están determinados por la estructura de archivos en el volumen FSx ONTAP.

#### Estructura de directorios y metadatos SID

```
FSx ONTAP Volume (/data)
  ├── public/                          ← Accesible para todos los usuarios
  │   ├── product-catalog.md           ← Cuerpo del documento
  │   └── product-catalog.md.metadata.json  ← Metadatos SID
  ├── confidential/                    ← Solo administradores
  │   ├── financial-report.md
  │   └── financial-report.md.metadata.json
  └── restricted/                      ← Solo grupos específicos
      ├── project-plan.md
      └── project-plan.md.metadata.json
```

#### Formato .metadata.json

Configure el control de acceso basado en SID en el archivo `.metadata.json` correspondiente a cada documento.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-1-0\"]",
    "access_level": "public",
    "doc_type": "catalog"
  }
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `allowed_group_sids` | ✅ | Cadena de array JSON de SIDs con acceso permitido. `S-1-1-0` es Everyone |
| `access_level` | Opcional | Nivel de acceso para visualización en UI (`public`, `confidential`, `restricted`) |
| `doc_type` | Opcional | Tipo de documento (para filtrado futuro) |

#### Valores SID clave

| SID | Nombre | Uso |
|-----|--------|-----|
| `S-1-1-0` | Everyone | Documentos publicados para todos los usuarios |
| `S-1-5-21-...-512` | Domain Admins | Documentos accesibles solo para administradores |
| `S-1-5-21-...-1100` | Engineering | Documentos para el grupo de ingeniería |

> **Detalles**: Consulte [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) para el mecanismo de filtrado SID.

#### Restricciones y consideraciones de metadatos de S3 Vectors

Al usar la configuración S3 Vectors (`vectorStoreType=s3vectors`), tenga en cuenta las siguientes restricciones de metadatos.

| Restricción | Valor | Impacto |
|------------|-------|---------|
| Metadatos filtrables | 2KB/vector | Incluyendo metadatos internos de Bedrock KB (~1KB), los metadatos personalizados son efectivamente **1KB o menos** |
| Claves de metadatos no filtrables | Máx 10 claves/índice | Alcanza el límite con claves auto de Bedrock KB (5) + claves personalizadas (5) |
| Metadatos totales | 40KB/vector | Generalmente no es un problema |

### Selección de ruta de ingesta de datos

| Ruta | Método | Activación CDK | Estado |
|------|--------|---------------|--------|
| Principal | FSx ONTAP → S3 Access Point → Bedrock KB → Vector Store | Ejecutar `post-deploy-setup.sh` después del despliegue CDK | ✅ |
| Respaldo | Carga directa a bucket S3 → Bedrock KB → Vector Store | Manual (`upload-demo-data.sh`) | ✅ |
| Alternativa (opcional) | Servidor de embedding (montaje CIFS) → Escritura directa AOSS | `-c enableEmbeddingServer=true` | ✅ (solo configuración AOSS) |

> **Ruta de respaldo**: Si FSx ONTAP S3 AP no está disponible (ej. restricciones SCP de Organization), puede cargar directamente documentos + `.metadata.json` a un bucket S3 y configurarlo como fuente de datos KB. El filtrado SID no depende del tipo de fuente de datos.

### Gestión manual de documentos objetivo de embedding

Puede agregar, modificar y eliminar documentos objetivo de embedding sin despliegue CDK.

#### Agregar documentos

Vía FSx ONTAP S3 Access Point (ruta principal):

```bash
# Colocar archivos en FSx ONTAP vía SMB desde EC2 o WorkSpaces dentro del VPC
SVM_IP=<SVM_SMB_IP>
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put new-document.md; put new-document.md.metadata.json"

# Ejecutar sincronización KB (requerido después de agregar documentos)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

Carga directa a bucket S3 (ruta de respaldo):

```bash
# Cargar documentos + metadatos al bucket S3
aws s3 cp new-document.md s3://<DATA_BUCKET>/public/new-document.md
aws s3 cp new-document.md.metadata.json s3://<DATA_BUCKET>/public/new-document.md.metadata.json

# Sincronización KB
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Actualizar documentos

Después de sobrescribir un documento, vuelva a ejecutar la sincronización KB. Bedrock KB detecta automáticamente los documentos modificados y los re-integra.

```bash
# Sobrescribir documento vía SMB
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put updated-document.md product-catalog.md"

# Sincronización KB (detección de cambios + re-embedding)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Eliminar documentos

```bash
# Eliminar documento vía SMB
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; del old-document.md; del old-document.md.metadata.json"

# Sincronización KB (detección de eliminación + eliminación del almacén de vectores)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Cambiar metadatos SID (Cambios de permisos de acceso)

Para cambiar los permisos de acceso de un documento, actualice el `.metadata.json` y ejecute la sincronización KB.

```bash
# Ejemplo: Cambiar un documento público a confidencial
cat > financial-report.md.metadata.json << 'EOF'
{"metadataAttributes":{"allowed_group_sids":"[\"S-1-5-21-...-512\"]","access_level":"confidential","doc_type":"financial"}}
EOF

smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd confidential; put financial-report.md.metadata.json"

# Sincronización KB
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

> **Nota**: Siempre ejecute la sincronización KB después de agregar, actualizar o eliminar documentos. Los cambios no se reflejan en el almacén de vectores sin sincronización. La sincronización generalmente se completa en 30 segundos a 2 minutos.

## Cómo funciona el RAG con gestión de permisos

### Flujo de procesamiento (Método de 2 etapas: Retrieve + Converse)

```
User              Next.js API             DynamoDB            Bedrock KB         Converse API
  |                    |                      |                    |                  |
  | 1. Send query      |                      |                    |                  |
  |------------------->|                      |                    |                  |
  |                    | 2. Get user SIDs     |                    |                  |
  |                    |--------------------->|                    |                  |
  |                    |<---------------------|                    |                  |
  |                    | userSID + groupSIDs  |                    |                  |
  |                    |                      |                    |                  |
  |                    | 3. Retrieve API      |                    |                  |
  |                    |  (vector search)     |                    |                  |
  |                    |--------------------->|------------------->|                  |
  |                    |<---------------------|                    |                  |
  |                    | Results + metadata   |                    |                  |
  |                    |  (allowed_group_sids)|                    |                  |
  |                    |                      |                    |                  |
  |                    | 4. SID matching      |                    |                  |
  |                    | userSIDs n docSIDs   |                    |                  |
  |                    | -> Match: ALLOW      |                    |                  |
  |                    | -> No match: DENY    |                    |                  |
  |                    |                      |                    |                  |
  |                    | 5. Generate answer   |                    |                  |
  |                    |  (allowed docs only) |                    |                  |
  |                    |--------------------->|------------------->|----------------->|
  |                    |<---------------------|                    |                  |
  |                    |                      |                    |                  |
  | 6. Filtered result |                      |                    |                  |
  |<-------------------|                      |                    |                  |
```

1. El usuario envía una pregunta a través del chat
2. Recupera la lista de SID del usuario (SID personal + SIDs de grupo) de la tabla DynamoDB `user-access`
3. La API Bedrock KB Retrieve realiza una búsqueda vectorial para recuperar documentos relevantes (los metadatos incluyen información SID)
4. Compara los `allowed_group_sids` de cada documento con la lista de SID del usuario, permitiendo solo los documentos coincidentes
5. Genera una respuesta a través de la API Converse usando solo los documentos a los que el usuario tiene acceso como contexto
6. Muestra la respuesta filtrada y la información de citas

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| IaC | AWS CDK v2 (TypeScript) |
| Frontend | Next.js 15 + React 18 + Tailwind CSS |
| Auth | Amazon Cognito |
| AI/RAG | Amazon Bedrock Knowledge Base + S3 Vectors / OpenSearch Serverless |
| Embedding | Amazon Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`, 1024 dimensions) |
| Almacenamiento | Amazon FSx for NetApp ONTAP + S3 |
| Cómputo | Lambda Web Adapter + CloudFront |
| Permisos | DynamoDB (user-access: SID data, perm-cache: permission cache) |
| Seguridad | AWS WAF + IAM Auth + OAC + Geo Restriction |

## Escenarios de verificación

Consulte [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) para los procedimientos de verificación del filtrado de permisos.

Cuando dos tipos de usuarios (administrador y usuario regular) hacen la misma pregunta, puede confirmar que se devuelven diferentes resultados de búsqueda según los permisos de acceso.

## Lista de documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/implementation-overview.md](docs/implementation-overview.md) | Descripción detallada de la implementación (13 perspectivas) |
| [docs/ui-specification.md](docs/ui-specification.md) | Especificación de UI (cambio de modo KB/Agent, directorio de Agents, diseño de barra lateral, visualización de citas) |
| [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) | Detalles de la arquitectura de filtrado basado en SID |
| [docs/embedding-server-design.md](docs/embedding-server-design.md) | Diseño del servidor de embedding (incluyendo recuperación automática de ACL ONTAP) |
| [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md) | Guía de arquitectura de stacks CDK (comparación de almacenes de vectores, perspectivas de implementación) |
| [docs/verification-report.md](docs/verification-report.md) | Procedimientos de verificación post-despliegue y casos de prueba |
| [docs/demo-recording-guide.md](docs/demo-recording-guide.md) | Guía de grabación de video de demostración de verificación (6 elementos de evidencia) |
| [docs/demo-environment-guide.md](docs/demo-environment-guide.md) | Guía de configuración del entorno de verificación |
| [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) | Índice de documentación (orden de lectura recomendado) |
| [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) | Escenarios de verificación (confirmación de diferencia de permisos admin vs. usuario regular) |
| [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + integración AD, recurso compartido CIFS, configuración ACL NTFS |

## Configuración de FSx ONTAP + Active Directory

Consulte [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) para los procedimientos de integración AD de FSx ONTAP, recurso compartido CIFS y configuración ACL NTFS.

El despliegue CDK crea AWS Managed Microsoft AD y FSx ONTAP (SVM + Volume). La unión del SVM al dominio AD se ejecuta vía CLI después del despliegue (para control de temporización).

```bash
# Obtener IPs DNS de AD
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# Unir SVM a AD
# Nota: Para AWS Managed AD, se debe especificar OrganizationalUnitDistinguishedName
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id <SVM_ID> \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": <AD_DNS_IPS>,
      "FileSystemAdministratorsGroup": "Domain Admins",
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1
```

> **Importante**: Para AWS Managed AD, si no se especifica `OrganizationalUnitDistinguishedName`, la unión del SVM a AD quedará como `MISCONFIGURED`. El formato de la ruta OU es `OU=Computers,OU=<AD ShortName>,DC=<domain>,DC=<tld>`.

Las decisiones de diseño para S3 Access Point (tipo de usuario WINDOWS, acceso a Internet) también están documentadas en la guía.

### Guía de diseño de usuarios de S3 Access Point

La combinación de tipo de usuario y nombre de usuario especificados al crear un S3 Access Point varía según el estilo de seguridad del volumen y el estado de unión a AD. Existen 4 patrones.

#### Matriz de decisión de 4 patrones

| Patrón | Tipo de usuario | Fuente de usuario | Condición | Ejemplo de parámetro CDK |
|--------|----------------|-------------------|-----------|-------------------------|
| A | WINDOWS | Usuario AD existente | SVM unido a AD + volumen NTFS/UNIX | `s3apUserType=WINDOWS` (predeterminado) |
| B | WINDOWS | Nuevo usuario dedicado | SVM unido a AD + cuenta de servicio dedicada | `s3apUserType=WINDOWS s3apUserName=s3ap-service` |
| C | UNIX | Usuario UNIX existente | Sin unión a AD o volumen UNIX | `s3apUserType=UNIX` (predeterminado) |
| D | UNIX | Nuevo usuario dedicado | Sin unión a AD + usuario dedicado | `s3apUserType=UNIX s3apUserName=s3ap-user` |

#### Diagrama de flujo de selección de patrón

```
¿El SVM está unido a AD?
  ├── Sí → ¿Volumen NTFS?
  │           ├── Sí → Patrón A (WINDOWS + usuario AD existente) recomendado
  │           └── No → Patrón A o C (ambos funcionan)
  └── No → Patrón C (UNIX + root) recomendado
```

#### Detalles de cada patrón

**Patrón A: WINDOWS + Usuario AD existente (Recomendado: entorno NTFS)**

```bash
# Despliegue CDK
npx cdk deploy --all -c adPassword=<PASSWORD> -c volumeSecurityStyle=NTFS
# → S3 AP: WINDOWS, Admin (configurado automáticamente)
```

- El control de acceso a nivel de archivo basado en ACL NTFS está habilitado
- El acceso a archivos a través de S3 AP se realiza con el usuario AD `Admin`
- Importante: No incluir el prefijo de dominio (`DEMO\Admin`). Especificar solo `Admin`

**Patrón B: WINDOWS + Nuevo usuario dedicado**

```bash
# 1. Crear una cuenta de servicio dedicada en AD (PowerShell)
New-ADUser -Name "s3ap-service" -AccountPassword (ConvertTo-SecureString "P@ssw0rd" -AsPlainText -Force) -Enabled $true

# 2. Despliegue CDK
npx cdk deploy --all -c adPassword=<PASSWORD> -c s3apUserName=s3ap-service
```

- Cuenta dedicada basada en el principio de mínimo privilegio
- El acceso S3 AP puede identificarse claramente en los registros de auditoría

**Patrón C: UNIX + Usuario UNIX existente (Recomendado: entorno UNIX)**

```bash
# Despliegue CDK (sin configuración AD)
npx cdk deploy --all -c volumeSecurityStyle=UNIX
# → S3 AP: UNIX, root (configurado automáticamente)
```

- Control de acceso basado en permisos POSIX (uid/gid)
- Todos los archivos accesibles con el usuario `root`
- El filtrado SID opera basándose en los metadatos de `.metadata.json` (no depende de las ACL del sistema de archivos)

**Patrón D: UNIX + Nuevo usuario dedicado**

```bash
# 1. Crear un usuario UNIX dedicado a través de ONTAP CLI
vserver services unix-user create -vserver <SVM_NAME> -user s3ap-user -id 1100 -primary-gid 0

# 2. Despliegue CDK
npx cdk deploy --all -c volumeSecurityStyle=UNIX -c s3apUserType=UNIX -c s3apUserName=s3ap-user
```

- Cuenta dedicada basada en el principio de mínimo privilegio
- Al acceder con un usuario distinto de `root`, es necesario configurar los permisos POSIX del volumen

#### Relación con el filtrado SID

El filtrado SID no depende del tipo de usuario S3 AP. La misma lógica funciona en todos los patrones:

```
allowed_group_sids en .metadata.json
  ↓
Devuelto como metadatos a través de Bedrock KB Retrieve API
  ↓
Comparado con los SID de usuario (DynamoDB user-access) en route.ts
  ↓
Coincidencia → ALLOW, Sin coincidencia → DENY
```

Ya sea un volumen NTFS o UNIX, se aplica el mismo filtrado SID siempre que la información SID esté incluida en `.metadata.json`.

## Licencia

[Apache License 2.0](LICENSE)
