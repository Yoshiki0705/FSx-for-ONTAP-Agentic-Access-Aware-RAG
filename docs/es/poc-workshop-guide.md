# Guía de taller PoC (90 minutos)

**🌐 Language:** [日本語](../poc-workshop-guide.md) | [English](../en/poc-workshop-guide.md) | [한국어](../ko/poc-workshop-guide.md) | [简体中文](../zh-CN/poc-workshop-guide.md) | [繁體中文](../zh-TW/poc-workshop-guide.md) | [Français](../fr/poc-workshop-guide.md) | [Deutsch](../de/poc-workshop-guide.md) | **Español**

**Fecha de creación**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Arquitectos de soluciones, ingenieros de socios, equipos cloud de clientes

---

## Descripción general

En este taller, desplegaremos el sistema Permission-aware Agentic RAG en 90 minutos y experimentaremos el funcionamiento de la búsqueda con permisos.

---

## Requisitos previos

| Elemento | Requisito |
|----------|-----------|
| Cuenta AWS | Permisos equivalentes a AdministratorAccess |
| AWS CLI | v2 configurado (`aws sts get-caller-identity` debe tener éxito) |
| Node.js | 22 o superior |
| Docker | En ejecución (`docker info` debe tener éxito) |
| CDK Bootstrap | Se realizará durante el taller si no se ha hecho previamente |
| Acceso a modelos Bedrock | Claude Haiku / Sonnet, Titan Embed v2 habilitados |

---

## Agenda

| Tiempo | Sección | Contenido |
|--------|---------|-----------|
| 0:00–0:10 | 0. Introducción | Descripción general de la arquitectura, explicación de casos de uso |
| 0:10–0:40 | 1. Despliegue del entorno | Clonar, dependencias, Bootstrap, despliegue |
| 0:40–0:55 | 2. Carga de datos de demostración | Creación de usuarios, colocación de documentos de prueba |
| 0:55–1:15 | 3. Prueba de RAG con permisos | Búsqueda con diferentes usuarios, comparación de resultados |
| 1:15–1:25 | 4. Revisión de la guía empresarial | Lista de verificación para producción, plantilla de evaluación |
| 1:25–1:30 | 5. Limpieza | Eliminación de recursos, verificación de costes |

---

## 0. Introducción (10 minutos)

### El problema que resuelve este sistema

```
RAG tradicional:
  Archivos empresariales → Se pasan todos los documentos a la IA → Cualquiera puede acceder a toda la información
  → Los límites de permisos desaparecen → Riesgo de filtración de información confidencial

Permission-aware RAG:
  Archivos empresariales → Se mantienen las ACL existentes → Los documentos visibles difieren según el usuario
  → Uso de IA respetando los permisos → Compatibilidad entre seguridad y usabilidad
```

### Arquitectura (para pizarra)

```
Usuario → CloudFront → Lambda (Next.js)
                              ↓
                    Bedrock KB Retrieve API
                              ↓
                    Filtrado SID (lado de la aplicación)
                              ↓
                    Generación de respuesta solo con documentos permitidos
```

---

## 1. Despliegue del entorno (30 minutos)

### Step 1.1: Clonar el repositorio

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2: CDK Bootstrap

```bash
# Región principal
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# Para WAF (CloudFront requiere us-east-1)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3: Creación del archivo de configuración

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **Nota**: Modifique `allowedCountries` según el país de los participantes.

### Step 1.4: Preparación de imagen Docker y despliegue

```bash
# Construcción de imagen Docker
bash demo-data/scripts/pre-deploy-setup.sh

# Despliegue (aproximadamente 30 minutos)
npx cdk deploy --all --require-approval never
```

> Puede aprovechar el tiempo de despliegue para explicar la siguiente sección.

---

## 2. Carga de datos de demostración (15 minutos)

### Step 2.1: Creación de usuarios de prueba y datos

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Este script ejecuta lo siguiente:
- Creación de usuarios de prueba en Cognito (admin@example.com, user@example.com)
- Registro de datos SID en DynamoDB
- Carga de documentos de prueba + `.metadata.json` en S3
- Sincronización de la fuente de datos de Bedrock KB

### Step 2.2: Obtención de la URL de acceso

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. Prueba de RAG con permisos (20 minutos)

### Prueba 1: Iniciar sesión como usuario administrador

1. Acceder a la URL de CloudFront
2. Iniciar sesión con `admin@example.com` / contraseña (verificar la salida de post-deploy-setup.sh)
3. Preguntar "Cuéntame sobre las ventas de la empresa"
4. **Resultado esperado**: Respuesta que incluye información de ventas de 15 mil millones de yenes (referencia a documento confidencial)

### Prueba 2: Iniciar sesión como usuario general

1. Cerrar sesión
2. Iniciar sesión con `user@example.com`
3. Hacer la misma pregunta "Cuéntame sobre las ventas de la empresa"
4. **Resultado esperado**: Sin información de ventas (solo referencia a documentos públicos)

### Prueba 3: Modo Agent

1. Cambiar a "Agent" con el toggle de modo en el encabezado
2. Preguntar "Resume el contenido del catálogo de productos"
3. **Resultado esperado**: El Agent utiliza la herramienta de búsqueda KB y responde dentro del alcance de permisos

### Puntos de verificación

- [ ] La misma pregunta devuelve respuestas diferentes
- [ ] Las Citations muestran insignias de nivel de acceso
- [ ] Las Citations de documentos confidenciales no se muestran al usuario general

---

## 4. Revisión de la guía empresarial (10 minutos)

Presentar los siguientes documentos a los participantes:

| Documento | Punto de verificación |
|-----------|----------------------|
| [Lista de verificación para producción](production-readiness-checklist.md) | Niveles de madurez Demo/PoC/Production |
| [Plantilla de evaluación](evaluation.md) | Resumen de una página del informe de evaluación PoC |
| [Guía de experimentación segura](safe-experimentation-guide.md) | Lista de verificación antes de ingerir datos reales |
| [Modelo de amenazas](threat-model.md) | 10 categorías de amenazas y mapeo de contramedidas |

---

## 5. Limpieza (5 minutos)

```bash
# Eliminar todos los recursos
npx cdk destroy --all --force
```

> **Nota**: La eliminación de FSx for ONTAP tarda entre 10 y 15 minutos. Después de que el comando finalice, verifique el estado de eliminación en la consola de AWS.

### Verificación de costes

```bash
# Verificar recursos residuales
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## Criterios de éxito

| Criterio | Método de verificación |
|----------|----------------------|
| El entorno se desplegó correctamente | Se puede acceder a la URL de CloudFront |
| Diferentes usuarios obtienen diferentes respuestas | Comparación de Prueba 1 y Prueba 2 |
| El escenario de denegación de permisos funciona con Fail-Closed | No se muestra información confidencial al usuario general |
| Se generan registros de auditoría | Los logs de búsqueda se registran en CloudWatch Logs |
| La limpieza se completó | Sin recursos residuales |

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| Fallo en CDK Bootstrap | Verificar las credenciales de AWS CLI. ¿`aws sts get-caller-identity` tiene éxito? |
| Fallo en la construcción Docker | Verificar que Docker esté en ejecución. `docker info` |
| El despliegue tarda más de 40 minutos | La creación de FSx for ONTAP tarda entre 20 y 30 minutos, es normal |
| No se puede iniciar sesión | Verificar que los usuarios de Cognito se hayan creado. Revisar la salida de `post-deploy-setup.sh` |
| 0 resultados de búsqueda | Verificar que la sincronización de KB se haya completado. Esperar unos minutos y reintentar |

---

## Próximos pasos

Después de completar el taller, considere lo siguiente:

1. **PoC con datos reales**: Ingerir datos reales siguiendo la [Guía de experimentación segura](safe-experimentation-guide.md)
2. **Evaluación**: Evaluar cuantitativamente los resultados del PoC con la [Plantilla de evaluación](evaluation.md)
3. **Consideración de producción**: Verificar las contramedidas necesarias con la [Lista de verificación para producción](production-readiness-checklist.md)

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [README.md](../README.md) | Visión general del sistema, procedimiento de despliegue |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guía de experimentación segura |
| [evaluation.md](evaluation.md) | Métricas de evaluación RAG / Agent |
| [threat-model.md](threat-model.md) | Modelo de amenazas |
