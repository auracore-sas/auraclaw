# Guía de Acceso Web / API (WebChat)

El canal WebChat de AuraClaw deja que sitios web externos lleguen al motor de conversación sobre HTTP / SSE plano, sin JWT. La identidad del visitante se aísla bajo una clave API compartida mediante `visitorId + visitorToken` (firmado con HMAC).

Hay dos caminos de integración:

- **Widget embebible** — suelta un archivo JS, llama `init(...)` una vez, y aparece una burbuja de chat en la esquina. Lo más rápido de enviar; ideal para sitios de marketing / soporte en landing pages.
- **Integración HTTP / SSE personalizada** — llama a los endpoints REST + SSE de abajo y renderiza tu propia UI. Para experiencias profundamente personalizadas.

## Widget embebible (mateclaw-webchat)

El widget es una librería de navegador sin dependencias publicada en formato UMD (`<script>` tag) y ESM (npm).

**Opción 1: script tag (UMD)**

```html
<script src="https://<tu-despliegue>/mateclaw-webchat.umd.js"></script>
<script>
  MateClawWebChat.init({
    apiKey: 'tu-api-key-del-canal',   // de la página de edición del canal
    server: 'https://<tu-despliegue>',
    title: 'Soporte',
    placeholder: 'Escribe un mensaje...'
  })
</script>
```

**Opción 2: npm (ESM)**

```bash
npm install @mateclaw/webchat
```

```ts
import { init } from '@mateclaw/webchat'

init({ apiKey: 'tu-api-key-del-canal', server: 'https://<tu-despliegue>' })
```

**Opciones de configuración**

| Campo | Requerido | Default | Notas |
|---|---|---|---|
| `apiKey` | sí | — | Clave API del canal |
| `server` | sí | — | URL del servidor de AuraClaw (sin barra final) |
| `position` | no | `bottom-right` | Posición de la burbuja: `bottom-right` / `bottom-left` |
| `primaryColor` | no | `#D97757` | Color primario (cualquier color CSS) |
| `title` | no | `MateClaw` | Título del panel |
| `placeholder` | no | `Type a message...` | Placeholder del input |

**Comportamiento**

- El ID de visitante se genera al primer abrir y se persiste en `localStorage` (clave `mc-webchat-visitor`), luego se reutiliza — no lo gestionas tú mismo.
- El panel se tematiza enteramente mediante variables CSS (`--mc-primary` / `--mc-bg-elevated` / ...); la página anfitriona puede sobrescribirlas bajo `:root`.
- El widget consume el protocolo SSE `/stream` descrito abajo. Para interacciones más ricas (lista de sesiones, adjuntos, revocación), llama directamente a los endpoints HTTP y construye tu propia UI.

## Integración personalizada: lo básico

- **URL base**: `https://<tu-despliegue-AuraClaw>/api/v1/channels/webchat`
- **Auth**: todo endpoint requiere el encabezado `X-MC-Key: <API Key>` (de la página de edición del canal).
- **Los endpoints de gestión de sesiones** requieren además `X-MC-Visitor-Token: <HMAC>` (emitido por el servidor y devuelto en la primera llamada a `/stream`).
- **Envoltorio de respuesta**: `R<T>` → `{"code": 200, "msg": "...", "data": T}`; cualquier cosa distinta de 200 es un error.
- **Charset**: UTF-8. El stream SSE usa `text/event-stream; charset=UTF-8`.

## Lista de endpoints

| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| POST | `/stream` | API Key | Chat por streaming SSE (emite visitorToken) |
| GET | `/config` | API Key | Obtener config del canal (título/placeholder/...) |
| POST | `/sessions` | API Key | Crear explícitamente un hilo de sesión vacío |
| GET | `/sessions` | + visitorToken | Listar sesiones (excluye archivadas por defecto) |
| GET | `/sessions/page` | + visitorToken | Paginado + búsqueda por palabra clave |
| PUT | `/sessions/title` | + visitorToken | Renombrar |
| PUT | `/sessions/pinned` | + visitorToken | Fijar / desfijar |
| PUT | `/sessions/archive` | + visitorToken | Archivar / desarchivar |
| DELETE | `/sessions` | + visitorToken | Borrar |
| POST | `/sessions/stop` | + visitorToken | Detener un stream en vuelo |
| POST | `/sessions/regenerate` | + visitorToken | Regenerar la última respuesta del asistente |
| POST | `/sessions/approve` | + visitorToken | Aprobar una aprobación de herramienta pendiente y re-ejecutar (SSE) |
| POST | `/sessions/deny` | + visitorToken | Denegar una aprobación de herramienta pendiente (JSON síncrono) |
| GET | `/sessions/messages` | + visitorToken | Lista de mensajes (paginada) |
| POST | `/upload` | + visitorToken | Subir un adjunto (devuelve fileId) |
| GET | `/files` | + visitorToken | Descargar un archivo (subido o generado por el agente) |

Nivel admin (requieren un JWT de AuraClaw, fuera del conjunto permitAll de arriba):

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/v1/admin/webchat/revoked-visitor` | Revocar el token de gestión de un visitante |
| DELETE | `/api/v1/admin/webchat/revoked-visitor` | Des-revocar |

> En la consola de administración, la lista de "Conversaciones" oculta las sesiones de visitantes WebChat de los administradores regulares por defecto — solo un administrador global las ve. Es una guarda de aislamiento entre workspaces y de privacidad del visitante.

## Flujo de auth

```text
┌──────────┐  POST /stream {visitorId:"v1", message:"hola"}
│ Cliente  │ ─────────────────────────────────────────────► ┌──────────┐
└──────────┘                                                  │ AuraClaw │
   ▲                                                          └──────────┘
   │  Evento SSE meta: {sessionId, conversationId, visitorToken}
   │  Eventos SSE content_delta: {text}
   │  Evento SSE done
   └─────────────────────────────────────────────────────────
                                                              │
┌──────────┐  GET /sessions X-MC-Visitor-Token: <visitorToken>│
│ Cliente  │ ─────────────────────────────────────────────► │
└──────────┘ ◄──── 200 {code:200, data:[...]}                │
```

El `visitorToken` es válido por 7 días por defecto; re-emítelo a través de cualquier llamada a `/stream` una vez que expire. Toda llamada a `/stream` (incluso con un token aún válido) devuelve un token fresco en el evento meta — el cliente debe seguir actualizando su copia almacenada.

## Códigos de error

| HTTP | Cuándo |
|---|---|
| 400 | Parámetro inválido (charset de visitorId / sessionId, longitud del título, etc.) |
| 401 | API Key inválida / visitorToken faltante, expirado o revocado |
| 404 | El sessionId dado no existe o no pertenece al visitante |
| 409 | Más de 5 sesiones vacías inactivas |

El mensaje de error está en `R.msg` y puede mostrarse directamente al usuario.

## Protocolo de eventos SSE

`/stream` y `/sessions/regenerate` devuelven `text/event-stream`:

```
event: meta
data: {"sessionId":"s1","conversationId":"webchat:abc123:v1:s1","visitorToken":"xxx.yyy"}

event: phase
data: {"phase":"planning","timestamp":1716700000000}

event: tool_start
data: {"tool":"web_search"}

event: tool_end
data: {"tool":"web_search","success":true}

event: plan
data: {"steps":["search the web","summarize"]}

event: content_delta
data: {"text":"Ho"}

event: content_delta
data: {"text":"la"}

event: thinking_delta
data: {"text":"..."}    (opcional, traza de razonamiento)

event: done
data: {"status":"completed"}

event: error
data: {"message":"..."}  (ante fallo)
```

> La especificación SSE exige que los clientes ignoren tipos de evento desconocidos. El servidor puede emitir eventos internos prefijados con un guion bajo (p. ej. `_usage_final`); estos no llevan contrato para los visitantes y pueden ignorarse sin problema.

### Eventos de progreso opcionales en tiempo real

`phase` / `tool_start` / `tool_end` / `plan` son eventos **opcionales** — usados para mostrar una burbuja de "la IA está escribiendo…", insignias de ejecución de herramientas ("Buscando…") o un checklist de pasos de Plan-and-Execute en tu SDK. El SDK puede ignorarlos todos y aún renderizar la respuesta completa solo con `content_delta`.

| Evento | Se dispara cuando | Campos de datos |
|---|---|---|
| `phase` | el agente entra en una nueva fase de ejecución (planificando / generando / resumiendo / ...) | `phase`, `timestamp` |
| `tool_start` | el agente llama a una herramienta | `tool` (nombre de herramienta) |
| `tool_end` | una llamada a herramienta termina | `tool`, `success` |
| `plan` | un agente Plan-and-Execute divide el trabajo en pasos | `steps` (arreglo de strings) |

**Nota**: `tool_start` / `tool_end` llevan **solo el nombre de la herramienta**, nunca los argumentos ni resultados de la llamada — las llamadas a herramientas del agente pueden involucrar PII (rutas de archivos, consultas de usuario, credenciales), que se filtrarían si se reenvían al frontend de un sitio web de terceros. El SDK debe mapear los nombres de herramientas a etiquetas localizadas (`web_search` → "Buscando…").

## Subida / descarga de archivos

1. `POST /upload` (multipart): devuelve `{fileId, fileName, contentType, size}`.
2. Agrega el fileId al arreglo `attachmentIds` en el cuerpo de la siguiente llamada a `/stream`. Los fileIds desconocidos / expirados / ajenos se descartan silenciosamente (solo se envía la parte de texto, sin error).
3. El agente lee los archivos del lado del servidor directamente; el `fileUrl` en un mensaje es una ruta de descarga relativa (`/api/v1/channels/webchat/files?storedName=...`) — el cliente agrega encabezados de auth para descargar.
4. Los archivos generados por el agente (PDF/DOCX/...) aparecen en las respuestas del asistente como URLs `/api/v1/files/generated/<uuid>`, descargables **sin auth**, con un TTL de 7 días.

## Ciclo de vida de sesión: fijar / archivar / borrar

- **Fijar** (`PUT /sessions/pinned`): se ordena primero en la lista de `/sessions`.
- **Archivar** (`PUT /sessions/archive`): un cierre suave — el hilo se queda en la BD (historial consultable, direccionable por sessionId, archivos descargables) pero queda oculto de `/sessions` por defecto (pasa `includeArchived=true` para devolverlo), y ya no cuenta contra la cuota de "≤ 5 sesiones vacías inactivas".
- **Borrar** (`DELETE /sessions`): permanente, irrecuperable.

Cada sesión devuelta por `/sessions` incluye: `sessionId`, `title`, `lastActiveTime`, `messageCount`, `pinned`, `archived`, `streamStatus` (`running` / `idle`).

## Resolución de aprobación de herramientas (canal API-Key)

Cuando un agente ligado a WebChat llama a una herramienta protegida por [Tool Guard](./security), ese turno **se suspende esperando aprobación**. El visitante puede aprobarla o denegarla en sesión en lugar de dejarla expirar.

- **Aprobar** `POST /sessions/approve` — con `sessionId` + `pendingId`. La auth reutiliza visitorToken + propiedad de la conversación; el `pendingId` se **valida estrictamente como perteneciente a esta sesión** (si no, 404), cerrando un IDOR entre visitantes. Aprobar **re-ejecuta** la llamada a herramienta suspendida y reanuda como SSE.
- **Denegar** `POST /sessions/deny` — con `sessionId` + `pendingId`, devuelve JSON síncrono, sin re-ejecución.

Ambos transmiten un evento SSE `tool_approval_resolved` (ver [Eventos de progreso opcionales](#optional-realtime-progress-events) arriba) para que el SDK / frontend limpie el banner de aprobación en tiempo real.

> Si aparece una aprobación depende de si las reglas de Tool Guard ligadas del agente definen `require_approval` para alguna herramienta. Obtén `pendingId` del evento `tool_approval_requested`.

```bash
# Aprobar (reanuda como SSE)
curl -N -X POST "https://mate.example.com/api/v1/channels/webchat/sessions/approve" \
  -H "X-MC-Key: <API Key>" -H "X-Visitor-Token: <visitorToken>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s1","pendingId":"<pendingId>"}'

# Denegar (JSON síncrono)
curl -X POST "https://mate.example.com/api/v1/channels/webchat/sessions/deny" \
  -H "X-MC-Key: <API Key>" -H "X-Visitor-Token: <visitorToken>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s1","pendingId":"<pendingId>"}'
```

## Revocación de visitorToken (admin)

¿Un visitante abusando del canal? Un admin llama:

```bash
curl -X POST https://mate.example.com/api/v1/admin/webchat/revoked-visitor \
  -H "Authorization: Bearer <admin JWT>" \
  -H "Content-Type: application/json" \
  -d '{"channelId":123, "visitorId":"v1", "reason":"abuse"}'
```

Tras la revocación, todos los endpoints de gestión de ese visitante devuelven 401 (`/stream` no se ve afectado y puede re-emitir un token fresco). El estado de revocación se cachea brevemente, así que bajo un despliegue multi-instancia tarda hasta ~10 minutos en propagarse por completo. Des-revoca vía `DELETE` en el mismo endpoint.

## Ejemplos con curl

**Paso 1: enviar el primer mensaje**

```bash
curl -N -X POST https://mate.example.com/api/v1/channels/webchat/stream \
  -H "X-MC-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"v1","message":"hola"}'
```

Guarda el `visitorToken` y el `sessionId` del evento meta.

**Paso 2: listar sesiones**

```bash
curl https://mate.example.com/api/v1/channels/webchat/sessions?visitorId=v1 \
  -H "X-MC-Key: your-api-key" \
  -H "X-MC-Visitor-Token: <del paso 1>"
```

**Paso 3: subir un adjunto y enviar**

```bash
# subir
curl -X POST https://mate.example.com/api/v1/channels/webchat/upload \
  -H "X-MC-Key: your-api-key" \
  -H "X-MC-Visitor-Token: <token>" \
  -F "visitorId=v1" \
  -F "file=@report.pdf"
# devuelve {"fileId":"abc-uuid", ...}

# enviar un mensaje con el adjunto
curl -N -X POST https://mate.example.com/api/v1/channels/webchat/stream \
  -H "X-MC-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"v1","sessionId":"<sid>","message":"échale un vistazo a este reporte","attachmentIds":["abc-uuid"]}'
```

## Límites

- Sesiones vacías inactivas por visitante ≤ 5 (la creación se rechaza pasadas 5 — envía un mensaje o borra una sesión vieja primero)
- Subida: un solo archivo ≤ tope configurado, doble whitelist de extensión + MIME; ≤ 50 archivos / 200 MB por sesión (configurable)
- El visitorToken expira en 7 días; las URLs de archivos generados por el agente tienen un TTL de 7 días
- Actualmente es un despliegue de una sola instancia (el registry de staging y el streamTracker están ambos en memoria). El soporte multi-instancia está en el roadmap.

## Relacionado

- Epic issue upstream: https://github.com/mateaix/mateclaw/issues/355
