# Consola de Administración

La consola de administración es la SPA Vue 3 que viene con todo despliegue de AuraClaw. Corre en tu navegador (o dentro de la ventana de escritorio Electron), habla con el backend Spring Boot sobre REST + SSE, y expone toda capacidad que AuraClaw tiene — chat, agentes, conocimiento, herramientas, skills, canales, seguridad, cron jobs, analítica de uso — detrás de un solo login.

Esta página es el mapa. Recorre la barra lateral grupo por grupo, página por página, y apunta a los endpoints de API que cada página usa para que puedas automatizar cualquier cosa que la UI te deje hacer clic.

---

## Stack tecnológico

- **Framework** — Vue 3 + Composition API + TypeScript
- **Estado** — Pinia (dirigido por dominio)
- **UI** — Element Plus + TailwindCSS 4 + variables CSS `--mc-*`
- **Build** — Vite 6 (chequeo de tipos vue-tsc → salida estática al `static/` del JAR del backend)
- **Routing** — Vue Router, modo history
- **i18n** — vue-i18n (`zh-CN` / `en-US` / `es-ES`)
- **HTTP** — Axios para REST, `fetch` nativo para SSE
- **Auth** — JWT con inyección automática y renovación por ventana deslizante

---

## Layout

Barra lateral izquierda + área de contenido derecha (`MainLayout.vue`). La barra lateral se colapsa, el estado persiste a `localStorage`. El pie de la barra lateral tiene los toggles de tema (claro / oscuro / sistema) y la información del usuario actual.

### Grupos de la barra lateral

Seis grupos que coinciden con la arquitectura de información basada en intención:

| Grupo | Páginas |
|-------|-------|
| **Chat** | Consola de Chat |
| **Uso** | Agentes, Wiki, Explorador de Memoria, Estudio Multimodal, Sesiones |
| **Extender** | Herramientas, Skills, Servidores MCP |
| **Operar** | Canales, Cron Jobs, Uso de Tokens, Dashboard, Fuentes de Datos |
| **Workspace** | Resumen del workspace actual, Miembros, Actividad |
| **Sistema** | Ajustes, Seguridad y Aprobación, Doctor, Onboarding |

Las páginas que no tienes permiso de ver (según tu rol de workspace) quedan ocultas.

### Insignias de notificación en la barra lateral (nuevo en 1.4.0)

La barra lateral muestra insignias en vivo en dos lugares para marcar cosas que necesitan tu atención:

- **Aprobaciones pendientes** — una insignia roja con conteo; clic salta a [Seguridad y Aprobación](./security)
- **Empleados atascados** — un punto naranja; clic salta a la vista de runtime **En Vivo** de la página de Empleados (ver [Backstage](./backstage))

### Guarda de auth

Toda ruta excepto `/login` está protegida por una guarda de ruta `beforeEach` que verifica un JWT válido en `localStorage`. Pon `VITE_SKIP_AUTH=true` en desarrollo para evadirla.

---

## Páginas

### 1. Login

**Ruta:** `/login`

Formulario de usuario/contraseña con toggle de visibilidad de contraseña.

- Al tener éxito, almacena token + usuario + rol + workspace activo en `localStorage`
- Redirige a la consola de chat (o al asistente de onboarding en el primer login)

**API:** `POST /api/v1/auth/login`

**Credenciales por defecto:** `admin` / `admin123` — cambia inmediatamente.

---

### 2. Asistente de onboarding

**Ruta:** `/onboarding`

Se muestra automáticamente en el primer login. Asistente de cuatro pasos:

1. **Bienvenida** — breve panorama del producto
2. **Configura un modelo** — elige un proveedor y pega una clave API (o OAuth hacia ChatGPT Plus, o auto-detecta Ollama); desde 1.4.0 este paso hace **habilitación de proveedores** directamente — marca los proveedores que quieras y están vivos
3. **Elige una plantilla de agente** — siembra un agente por defecto según tu elección
4. **Envía el primer mensaje** — un prompt de prueba para que veas el streaming funcionar

Saltártelo te deja en la consola de chat.

---

### 3. Consola de Chat

**Ruta:** `/chat`

La superficie de interacción primaria. Conversaciones a la izquierda, chat activo a la derecha.

Características:

- **Selector de agente** — cada agente tiene su propio historial de conversación
- **Lista de conversaciones** — agrupada por fecha (Hoy / Ayer / Últimos 7 Días / Anterior)
- **Cambiador de modelo** — elige cualquier modelo configurado para esta conversación
- **Desplegable de modelos agrupado** — agrupa por proveedor y etiqueta, con búsqueda
- **Burbujas de mensaje** — Markdown + resaltado de código
- **Mensajes segmentados** — thinking / tool_call / tool_result / content cargados progresivamente y persistidos en tiempo real
- **Panel de pensamiento** — expandir/colapsar para ver la cadena de razonamiento
- **Visualización de llamadas a herramientas** — nombre de herramienta, argumentos, resultado en línea
- **Indicador de estado de fase** — la fase actual mostrada sobre el stream
- **Lista de tareas persistente** — planes Plan-and-Execute + estados de paso en un panel lateral que sobrevive al refresco
- **Tarjetas de aprobación de herramientas** — botones en línea de aprobar/rechazar
- **Subida de archivos** — clic / pegar / arrastrar
- **Detener generación** — interrumpe el streaming a mitad de vuelo
- **Sugerencias** — chips de prompt cuando una conversación está vacía

**API:**

- `POST /api/v1/chat/stream` — streaming SSE (fetch nativo)
- `POST /api/v1/chat/upload`
- `POST /api/v1/chat/{conversationId}/stop`
- la resolución de aprobaciones se envía como `/approve` o `/deny` a través de `POST /api/v1/chat/stream`
- `GET /api/v1/chat/{conversationId}/pending-approvals`
- `GET /api/v1/conversations` — listar
- `GET /api/v1/conversations/{id}/messages`
- `DELETE /api/v1/conversations/{id}`
- `GET /api/v1/agents`
- `GET /api/v1/models/enabled`
- `GET/PUT /api/v1/models/active`

---

### 4. Agentes

**Ruta:** `/agents`

CRUD de agentes, mostrados como tabla.

- Búsqueda y filtro por tipo (Todos / ReAct / Plan-Execute)
- Crear desde selector de plantillas
- Editar prompt de sistema, herramientas, ligaduras de conocimiento, iteraciones máximas, icono, etiquetas
- Toggle habilitar/deshabilitar, borrado suave
- **Página de contexto del agente** (`/agents/{id}/context`) — vista profunda del prompt inyectado, herramientas ligadas, KBs ligadas, archivos de memoria, actividad reciente

**API:** `/api/v1/agents`

---

### 5. LLM Wiki

**Ruta:** `/wiki`

Gestiona bases de conocimiento y páginas Wiki. Ver [LLM Wiki](./wiki).

- **Lista de KBs** — cuadrícula de tarjetas
- **Detalle de KB** — pestañas de Material Crudo, Páginas Wiki, Búsqueda
- **Gestión de material crudo** — subir, escanear directorios, pegar texto, re-digerir, borrar
- **Navegador de páginas** — búsqueda full-text, retroenlaces, bloquear/desbloquear, editar en sitio
- **Editor de páginas** — markdown con vista previa en vivo, panel de fuentes
- **Ligaduras de agente** — qué agentes pueden leer esta KB

---

### 6. Estudio Multimodal

**Ruta:** `/multimodal`

Genera medios interactivamente sin pasar por un agente.

- Generación de imágenes, video, música
- Playground de TTS, playground de STT
- Galería de resultados — descargar, compartir, soltar en una conversación

---

### 7. Sesiones

**Ruta:** `/sessions`

::: tip 1.4.0: una página de administración de Sesiones real
Desde v1.4.0 `/sessions` es una página de administración de Sesiones independiente, alcanzada desde el **menú de desbordamiento del encabezado del chat**. Tiene **paginación del lado del servidor** + búsqueda por **título / ID**, un **layout de tarjetas** con estilo de profundidad, y un **chip de modelo editable en línea** por fila — cambia el modelo por defecto de una sesión directo desde la lista.
:::

Navega conversaciones a través de todo agente y canal.

- Búsqueda por palabra clave (título / ID, paginación del lado del servidor)
- Título de sesión, ID, agente, conteo de mensajes, estado, última actividad
- **Chip de modelo editable en línea** por fila
- Icono de fuente de canal
- Salto a la consola de chat con la sesión abierta
- Borrar sesiones históricas

---

### 8. Herramientas

**Ruta:** `/tools`

Tabla de toda herramienta registrada.

- Nombre, descripción, tipo (`builtin` / `mcp` / `custom`), flag de peligrosa, habilitada
- Registrar herramienta personalizada, editar, alternar, borrar
- Botón de prueba para herramientas respaldadas por proveedor

---

### 9. Skills

**Ruta:** `/skills`

Cuadrícula de tarjetas de paquetes de skills.

- Pestañas de categoría (Todos / Builtin / Custom / MCP)
- Cada tarjeta muestra nombre, icono, insignia de tipo, versión, descripción, estado de runtime, resumen del escaneo de seguridad
- Crear / editar / alternar / borrar
- **Instalar desde ClawHub** — navega skills de la comunidad, previsualiza, instala
- Refrescar estado de runtime

---

### 10. Servidores MCP

**Ruta:** `/mcp-servers`

- Tabla: nombre, descripción, transporte, estado de conexión, conteo de herramientas, habilitado
- Agregar (stdio / streamable_http / sse)
- Probar conexión (latencia + herramientas descubiertas)
- Refrescar todos, editar, borrar, alternar

---

### 11. Canales

**Ruta:** `/channels`

Cuadrícula de tarjetas para ocho canales IM más web.

- Cada tarjeta: icono, nombre, tipo, descripción, habilitado, indicador de conexión en tiempo real
- Agregar canal (DingTalk / Feishu / WeCom / WeChat / Telegram / Discord / QQ / Slack)
- Editar, alternar, borrar
- Vista de salud — resultados del monitor de salud de canales

---

### 12. Cron Jobs (Scheduler)

**Ruta:** `/settings/scheduler` (el viejo `/cron-jobs` redirige aquí)

::: tip 1.4.0: fusionado en el Scheduler unificado
Desde v1.4.0, **Trabajos Programados** y **Triggers** se fusionan en una sola página **Scheduler** (`Ajustes → Scheduler`) con tres pestañas: **Trabajos Programados / Triggers de Eventos / Historial de Corridas**, cada una mostrando un conteo de ítems, con un botón de acción contextual arriba a la derecha. Los Trabajos Programados ganan el tipo `wiki_process` (procesamiento de KB fuera de horas pico) y un **editor visual de cron**. Ver [Triggers](./triggers).
:::

Tareas programadas que disparan conversaciones de agente.

- Nombre, agente, tipo de tarea, expresión cron (con traducción legible), próxima corrida, última corrida, habilitado
- Crear, editar, borrar
- **Correr ahora** — dispara la ejecución inmediata
- Historial de ejecución por trabajo

---

### 13. Fuentes de Datos

**Ruta:** `/datasources`

Conexiones de bases de datos externas que los agentes pueden consultar a través del skill de consultas SQL.

- Nombre, tipo (MySQL / PostgreSQL / SQLite / ...), host/puerto, habilitado
- Crear, editar, probar conexión, borrar
- Alcance de permisos por fuente de datos

---

### 14. Uso de Tokens

**Ruta:** `/token-usage`

- Selector de rango de fechas
- Tarjetas de resumen — tokens totales de prompt/completado, conteo de mensajes, costo estimado
- Desglose por modelo

---

### 15. Dashboard

**Ruta:** `/dashboard`

- Tarjetas de resumen — agentes activos, conversaciones hoy, llamadas a herramientas hoy, aprobaciones pendientes
- **Tarjeta de configuración de modelos** (nuevo en 1.4.0) — lista los proveedores LLM habilitados, cada uno con un **estado de vitalidad** y su **modelo activo**, más un enlace a los ajustes de modelos
- **Gráfico de tendencias** — mensajes / llamadas a herramientas / uso de tokens en 7 / 30 / 90 días
- **Top agentes / top herramientas** — rankeados por uso
- Actividad de aprobaciones reciente

---

### 16. Doctor

**Ruta:** `/doctor`

Chequeos de salud del sistema. Alcance del backend, base de datos, proveedores de modelos, canales, MCP, wiki, cron de memoria, uso de disco. Cada chequeo reporta `ok` / `warning` / `error` con un diagnóstico corto y un enlace "Arreglar" cuando es accionable. Ver [Doctor](./doctor).

---

### 17. Ajustes

Layout de sub-rutas con cuatro páginas hijas. Un botón flotante fijado al fondo de la sub-navegación de ajustes la **colapsa/expande** (nuevo en 1.4.0).

#### 17.1 Modelos

**Ruta:** `/settings/models` (página de Ajustes por defecto)

Gestiona proveedores de modelos y configs de modelos. Cuadrícula de tarjetas.

- Tarjetas de proveedor — nombre, icono, ID, insignia builtin/custom, estado activo, base URL, clave API enmascarada, conteo de modelos
- Agregar proveedor personalizado (OpenAI-compatible)
- Gestionar modelos bajo un proveedor
- Probar conexión
- **Descubrir modelos** — auto-extraer
- Botón de prueba por modelo
- Borrar proveedor personalizado

Ver [Modelos](./models).

#### 17.2 Sistema

**Ruta:** `/settings/system`

Parámetros globales del sistema.

- Idioma, respuesta en streaming, modo debug
- **Servicio de búsqueda** — cadena de proveedores, fallback, claves API (enmascaradas)
- **Agente por defecto**

**API:** `/api/v1/settings`

#### 17.3 Workspaces, Miembros, Actividad

**Ruta:** `/settings/workspaces`, `/settings/members`, `/settings/activity`

- Crear / renombrar / borrar workspaces
- Invitar / quitar miembros, asignar roles (owner / admin / member / viewer)
- Feed de actividad — eventos recientes del workspace

Ver [Workspaces](./workspaces).

#### 17.4 Feature Flags

**Ruta:** `/settings/feature-flags`

Feature flags alternables en runtime. Cada fila es una flag — voltea un interruptor y el backend la honra sin reiniciar.

Lo que expone una fila:

- **Clave** (monoespaciada) — p. ej. `wiki.ocr.enabled`, `wiki.hot_cache.enabled`, `wiki.compile.4stage.enabled`
- **Descripción** — copia corta de cara al humano
- **Toggle** — habilitada / deshabilitada
- **Alcance** — opcional `whitelist_kb_ids` (CSV), `whitelist_user_ids` (CSV), `rollout_percent` (0–100). Define cualquiera de estos y la flag queda acotada: solo las KBs / usuarios / un porcentaje por hash determinista listados la ven encendida.
- **Insignia de cableada** — las flags cuyo consumidor de backend aún no se ha conectado se renderizan grisadas con una insignia "Aún no implementado" para que no intentes alternar algo que no surtirá efecto.

**API:** `/api/v1/feature-flags`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Lista todas las flags |
| `PUT` | `/{flagKey}` | Parchea `enabled`, `description`, whitelists o `rollout_percent` |

Orden de evaluación en runtime: `enabled=false` → apagada; coincidencia de whitelist → encendida; `rollout_percent` → `floorMod(id, 100) < rolloutPercent` determinista; si no, encendida. El almacén cachea lecturas por 30 s; las escrituras de admin invalidan la caché de inmediato.

#### 17.5 Acerca de

**Ruta:** `/settings/about`

Info de versión, stack tecnológico, créditos.

---

### 18. Seguridad y Aprobación

Layout de sub-rutas con cuatro páginas hijas.

#### 18.1 Tool Guard

**Ruta:** `/security/tool-guard`

Configuración de Tool Guard basada en reglas.

- **Config global** — habilitado, política por defecto, timeout de aprobación, notificaciones
- **Tabla de reglas** — nombre, severidad, categoría, decisión, flag builtin, habilitada, prioridad
- Crear / editar / borrar / reordenar / alternar

Ver [Seguridad y Aprobación](./security).

#### 18.2 File Guard

**Ruta:** `/security/file-guard`

- Habilitar/deshabilitar global
- Rutas permitidas, rutas denegadas, overrides acotados por workspace

#### 18.3 Aprobaciones

**Ruta:** `/security/approvals`

Aprobaciones pendientes e históricas.

- Filtrar por estado (pending / approved / rejected / expired)
- Nombre de herramienta, agente, workspace, hora solicitada, usuario solicitante
- Resolver en línea con nota
- **Vista previa de argumentos con sustitución de placeholders** — ve exactamente qué ejecutará el agente

#### 18.4 Logs de Auditoría

**Ruta:** `/security/audit-logs`

- Tarjetas de estadísticas — total, bloqueado, requirió aprobación, permitido
- Filtros — herramienta, decisión, fecha, usuario, workspace
- Expandir fila — regla coincidente, argumentos crudos, fragmento de conversación
- Exportar a CSV

---

### 19. Backstage — consola de runtime del admin

**Ruta:** `/backstage`  ·  **Requiere:** `ROLE_ADMIN`

Una vista en vivo de todo empleado digital actualmente en el reloj — avatares con anillo de estado, detección de atascados/huérfanos basada en watchdog, stop suave, reciclaje forzado, barrer-todos, interrupción por sub-agente. La página que abres cuando alguien dice "el agente está atascado".

Guía completa: [Backstage](./backstage).

---

## Stores Pinia

AuraClaw usa stores Pinia dirigidos por dominio. Cada store posee su porción de estado exclusivamente.

| Store | Archivo | Posee |
|-------|------|-------|
| `useAgentStore` | `stores/useAgentStore.ts` | Lista de agentes + CRUD |
| `useWorkspaceStore` | `stores/useWorkspaceStore.ts` | Workspace actual + membresía |
| `useWikiStore` | `stores/useWikiStore.ts` | KBs, páginas, materiales crudos |
| `useCronJobStore` | `stores/useCronJobStore.ts` | Cron jobs |
| `useThemeStore` | `stores/useThemeStore.ts` | Modo de tema, persistencia |

El estado del chat **no** está en un store global — lo gestiona el composable `useChat` (`composables/chat/useChat.ts`), acotado al ciclo de vida del componente de chat.

### Propiedad del estado

```typescript
// Correcto — pasa por las acciones del store
agentStore.fetchAgents()
themeStore.setMode('dark')

// Incorrecto — nunca mutar directamente
agentStore.agents = []         // No
```

---

## Modo oscuro

Tres modos: **Claro**, **Oscuro**, **Sistema**. Alterna en el pie de la barra lateral.

- `useThemeStore` persiste el modo a `localStorage`
- Alternar agrega/quita la clase `dark` en `<html>`
- TailwindCSS 4 usa el prefijo `dark:`
- Los temas de Element Plus se cambian vía variables CSS `--mc-*`
- El modo Sistema usa `matchMedia('(prefers-color-scheme: dark)')`

Para estilos complejos, usa los tokens de diseño `--mc-*` para que las transiciones sean automáticas.

---

## Internacionalización

- `zh-CN` — Chino simplificado
- `en-US` — Inglés
- `es-ES` — Español

Archivos en `src/i18n/`. Cambio: `Ajustes → Sistema → Idioma`. Surte efecto de inmediato.

---

## Capa de API

### Instancia Axios

```typescript
const http = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})
```

**Interceptor de solicitudes** — lee el JWT de `localStorage`, lo inyecta al encabezado `Authorization`.

**Interceptor de respuestas** — desenvuelve `R<T>: { code, msg, data }`, recoge `X-New-Token` para la renovación por ventana deslizante, maneja 401/403 limpiando el token y redirigiendo a login.

### Streaming SSE

El streaming de chat usa `fetch` nativo, no Axios:

```typescript
fetch('/api/v1/chat/stream', {
  method: 'POST',
  headers: {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
})
```

La respuesta se lee incrementalmente vía `ReadableStream` y se parsea segmento por segmento.

---

## Tabla de rutas

```
/login                     — Login
/onboarding                — Asistente de primer login
/                          — Redirige a /chat (o /onboarding)

/chat                      — Consola de Chat
/agents                    — Agentes
/agents/:id/context        — Vista profunda de contexto de agente
/wiki                      — LLM Wiki
/multimodal                — Estudio Multimodal
/sessions                  — Sesiones

/tools                     — Herramientas
/skills                    — Skills
/mcp-servers               — Servidores MCP

/channels                  — Canales
/settings/scheduler        — Scheduler (Trabajos Programados / Triggers de Eventos / Historial de Corridas; el viejo /cron-jobs redirige aquí)
/datasources               — Fuentes de Datos
/token-usage               — Uso de Tokens
/dashboard                 — Dashboard
/doctor                    — Doctor

/settings                  — Redirige a /settings/models
/settings/models           — Ajustes de Modelos
/settings/system           — Ajustes del Sistema
/settings/workspaces       — Workspaces
/settings/members          — Miembros
/settings/activity         — Actividad
/settings/about            — Acerca de

/security                  — Redirige a /security/tool-guard
/security/tool-guard       — Tool Guard
/security/file-guard       — File Guard
/security/approvals        — Aprobaciones
/security/audit-logs       — Logs de Auditoría
```

Las rutas sin coincidencia redirigen a `/chat`.

---

## Build y desarrollo

```bash
cd mateclaw-ui
npm install
npm run dev       # Puerto 5173, proxy /api a :18088
npm run build     # vue-tsc + vite build a ../mateclaw-server/.../static
npm run lint      # ESLint
```

Los artefactos del build se embeben en el JAR de Spring Boot.

Consejos:

- **Hot reload** — HMR habilitado en dev
- **Alias de rutas** — `@` → `src/`
- **Auto-import** — los componentes de Element Plus se auto-importan
- **Prioridad de estilos** — las clases utilitarias de TailwindCSS primero
- **Saltar auth** — `VITE_SKIP_AUTH=true` evita el login

---

## Siguiente

- [Inicio Rápido](./quickstart) — poner el backend + frontend a correr
- [Contribuir](./contributing) — convenciones del frontend
- [Configuración](./config) — ajustes de runtime
