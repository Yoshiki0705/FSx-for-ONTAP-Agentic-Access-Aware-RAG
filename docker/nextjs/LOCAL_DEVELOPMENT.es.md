# Guía de desarrollo local

Pasos para verificar y desarrollar la interfaz de usuario de la aplicación Next.js sin un entorno AWS (Cognito / DynamoDB / Bedrock).

El middleware de autenticación (verificación JWT, protección CSRF, enrutamiento i18n) no se omite — funciona con el mismo flujo que en producción.

---

## Requisitos previos

| Herramienta | Versión | Comando de verificación |
|-------------|---------|------------------------|
| Node.js | 22 o superior | `node -v` |
| npm | 10 o superior | `npm -v` |

Docker no es obligatorio (también se describe un método con Docker más adelante).

---

## Método 1: npm run dev (el más simple)

### 1. Instalar dependencias

```bash
cd docker/nextjs
npm install
```

### 2. Preparar variables de entorno

```bash
cp .env.development .env.local
```

`.env.local` no es rastreado por Git. Todos los valores son valores ficticios seguros para publicar.

### 3. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abra http://localhost:3000 en su navegador.

### 4. Iniciar sesión

El middleware redirige automáticamente a la página de inicio de sesión (`/es/signin`). Inicie sesión con uno de los usuarios de demostración a continuación.

| Nombre de usuario | Contraseña | Rol | Permisos |
|-------------------|-----------|-----|----------|
| `admin` | `admin123` | administrator | Acceso completo |
| `developer` | `dev123` | developer | Lectura/escritura + creación de Agent |
| `user` | `user123` | user | Solo lectura |

### Cómo funciona

```
Navegador → http://localhost:3000
  ↓ Middleware: sin JWT → redirigir a /es/signin
  ↓ Enviar formulario de inicio de sesión
  ↓ POST /api/auth/signin
  ↓   COGNITO_CLIENT_ID no configurado → autenticar con usuario de demostración
  ↓   Emitir JWT → establecer cookie session-token
  ↓ Middleware: JWT válido → mostrar página
```

No se realiza ninguna conexión a Cognito o DynamoDB. La firma y verificación de JWT utilizan la misma biblioteca `jose` que en producción, por lo que el flujo de autenticación del middleware es completamente equivalente a producción.

### Limitaciones

| Funcionalidad | Estado | Razón |
|---------------|--------|-------|
| Inicio/cierre de sesión | ✅ Funciona | Solo emisión de JWT y gestión de cookies |
| Navegación / guardia de autenticación | ✅ Funciona | Verificación JWT del middleware |
| Cambio de idioma | ✅ Funciona | next-intl (8 idiomas) |
| Modo oscuro | ✅ Funciona | Zustand + localStorage |
| UI de tarjetas / diseño | ✅ Funciona | Componentes estáticos |
| Búsqueda RAG (KB/Agent) | ❌ No disponible | Requiere Bedrock |
| Persistencia de sesión | ❌ No disponible | Requiere DynamoDB |
| Permisos de usuario (SID) | ❌ No disponible | Requiere DynamoDB + FSx |

> Si necesita persistencia de sesión, use el Método 2 (Docker Compose + DynamoDB Local).

---

## Método 2: Docker Compose (con DynamoDB Local)

Un método que incluye persistencia de sesión usando DynamoDB Local.

### Requisitos previos adicionales

- Docker / Docker Compose

### 1. Iniciar

```bash
cd docker/nextjs
docker compose -f docker-compose.dev.yml up --build
```

Los siguientes servicios se inician automáticamente:

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| app | 3000 | Servidor de desarrollo Next.js (recarga en caliente) |
| dynamodb-local | 8000 | DynamoDB Local (en memoria) |
| dynamodb-setup | — | Creación automática de tabla de sesiones (solo al inicio) |

### 2. Acceder

Abra http://localhost:3000 e inicie sesión con los mismos usuarios de demostración del Método 1.

### 3. Detener

```bash
docker compose -f docker-compose.dev.yml down
```

> DynamoDB Local funciona en modo en memoria, los datos de sesión se pierden al detenerse.

---

## Funcionalidades de la página de inicio de sesión

La página de inicio de sesión incluye los siguientes controles:

- Selector de idioma (arriba a la derecha): Cambiar entre 8 idiomas. El idioma seleccionado se mantiene después del inicio de sesión.
- Alternador de modo oscuro (arriba a la derecha): Cambiar entre claro/oscuro. Se mantiene después del inicio de sesión.

---

## Cambio de modo y herencia de idioma/tema

| Transición | Idioma | Tema |
|------------|--------|------|
| Inicio de sesión → Pantalla principal | ✅ Locale URL preservado | ✅ localStorage preservado |
| Modo KB ↔ Modo Agent | ✅ Locale URL preservado | ✅ localStorage preservado |
| Pantalla principal → Directorio de Agents | ✅ Locale URL preservado | ✅ localStorage preservado |
| Directorio de Agents → Modo KB | ✅ Locale URL preservado | ✅ localStorage preservado |

El idioma se gestiona mediante el prefijo de locale en la URL (`/en/genai`, `/es/genai`, etc.), por lo que se preserva en todas las transiciones de página. El tema se comparte entre todas las páginas a través de un store Zustand (persistencia localStorage).

---

## Solución de problemas

### El puerto 3000 está en uso

```bash
lsof -i :3000
kill -9 <PID>
```

### No se puede iniciar sesión

Verifique que `.env.local` existe y que `COGNITO_CLIENT_ID` no está configurado. Si está configurado, se intentará la autenticación Cognito y fallará.

```bash
# Verificar
grep COGNITO_CLIENT_ID .env.local
# → Sin salida significa OK
```

### La sesión anterior persiste y no se puede acceder a la página de inicio de sesión

Elimine la cookie del navegador (`session-token`) o abra en una ventana de incógnito.

### Error `Module not found`

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

## Estructura de archivos

```
docker/nextjs/
├── .env.development          # Variables de entorno de desarrollo (rastreado por Git, solo valores seguros)
├── .env.local                # Sobrescritura local (no rastreado por Git, copia de .env.development)
├── docker-compose.dev.yml    # Docker Compose (con DynamoDB Local)
├── Dockerfile.dev            # Dockerfile de desarrollo
├── src/
│   ├── middleware.ts          # Middleware de autenticación (JWT, CSRF, i18n)
│   └── app/api/auth/signin/
│       └── route.ts           # API de inicio de sesión (con fallback de autenticación de demostración)
└── messages/                  # Archivos de traducción (8 idiomas)
```
