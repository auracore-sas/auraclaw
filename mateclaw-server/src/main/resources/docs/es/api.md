# Referencia de API

Esta página está alineada con el código fuente de los controllers Spring MVC bajo `mateclaw-server/src/main/java`. El inventario de rutas de abajo se reconstruyó desde las anotaciones de los controllers; cuando entra en conflicto con una página de feature más vieja, esta página y el código fuente son el contrato.

> ¿Quieres un documento OpenAPI legible por máquina (importar a Postman / Apifox, depuración en línea)? Ver la [guía de OpenAPI / Swagger](./openapi) — visita `/swagger-ui.html` en tu despliegue.

## Contrato

Todos los endpoints REST de la aplicación usan el prefijo `/api/v1` salvo que se indique explícitamente. La mayoría de las respuestas JSON usan el envoltorio del proyecto:

```json
{
  "code": 200,
  "msg": "success",
  "data": {}
}
```

Excepciones importantes:

- Los endpoints de streaming (`text/event-stream`) envían frames SSE en lugar del envoltorio JSON.
- Los endpoints de descarga como `/api/v1/files/generated/{id}`, las subidas de chat y las descargas de raw del wiki devuelven bytes o cuerpos `ResponseEntity`.
- Algunos flujos de conflicto/error pueden devolver un objeto estructurado pequeño fuera de `R<T>` cuando el cliente debe ramificar según el estado HTTP.

Los IDs son valores Snowflake `Long` serializados como cadenas JSON por el backend. Los frontends y clientes de terceros deben mantener los IDs como cadenas.

## Autenticación

`POST /api/v1/auth/login` devuelve el JWT. Envía solicitudes protegidas con:

```text
Authorization: Bearer <token>
```

Las rutas públicas de `SecurityConfig` incluyen login, setup de primera ejecución, callbacks de webhook/webchat, rutas de chat stream/stop, ruta de stream de agente, WebSocket de talk, `GET /api/v1/settings/language` y las descargas de un solo uso de `/api/v1/files/generated/**`. Las anotaciones de rol como `@RequireWorkspaceRole` y `@RequireGlobalAdmin` siguen aplicando tras la autenticación.

Las APIs acotadas a workspace normalmente aceptan `X-Workspace-Id`. Si se omite, muchos handlers caen al workspace `1` para compatibilidad de escritorio/local.

## Convenciones

Contratos estructurales compartidos por todo endpoint. Lee esta sección primero, luego los ejemplos de endpoints insignia y el inventario completo de rutas de abajo encajarán.

### Envoltorio de respuesta `R<T>`

Fuente: `vip.mate.common.result.R` (`R.java`). Tres campos:

| Campo | Tipo | Significado |
|---|---|---|
| `code` | `int` | Código de estado. `200` = éxito; ver "Códigos de estado" abajo |
| `msg` | `string` | Mensaje. **Nota: `msg`, no `message`** |
| `data` | `T` | Payload; `null` ante fallo |

Ejemplo de éxito:

```json
{ "code": 200, "msg": "success", "data": { "id": "1", "name": "Agent A" } }
```

Ejemplo de fallo:

```json
{ "code": 401, "msg": "Token expired or invalid", "data": null }
```

**El estado HTTP refleja `code`**: `RHttpStatusAdvice` (`ResponseBodyAdvice`) define el estado HTTP en `HttpStatus.resolve(code)` siempre que `code != 200`. Así el código de negocio `401` → HTTP 401, `404` → HTTP 404. Los códigos de negocio que no son estados HTTP válidos (p. ej. `1001`, `2001`) caen a HTTP `500`.

### Códigos de estado

Fuente: `vip.mate.common.result.ResultCode`. Dos categorías:

| Código | Significado | ¿Mapea a estado HTTP directamente? |
|---|---|---|
| `200` | Éxito | Sí |
| `400` | Error de parámetro | Sí |
| `401` | No autorizado | Sí |
| `403` | Prohibido | Sí |
| `404` | No encontrado | Sí |
| `500` | Error de sistema | Sí |
| `1001` | Agente no encontrado | No (HTTP 500) |
| `1002` | Agente ocupado | No (HTTP 500) |
| `2001` | Error de LLM | No (HTTP 500) |
| `3001` | Herramienta no encontrada | No (HTTP 500) |
| `4001` | Error de canal | No (HTTP 500) |

### Modelo de error

Los errores los maneja centralmente `GlobalExceptionHandler` (`@RestControllerAdvice`):

| HTTP | Disparador | Cuerpo |
|---|---|---|
| 400 | Fallo de validación `@Valid` / `BindException` | `{code:400, msg:"campo: mensajePorDefecto"}` — solo se devuelve el **primer** error de campo |
| 400 | `MethodArgumentTypeMismatchException` (p. ej. `/{id}` no numérico) | `{code:400, msg:"Invalid value for parameter 'X': expected Long"}` |
| 401 | No autenticado / token inválido (`authenticationEntryPoint` de `SecurityConfig`) | `{code:401, msg:"Token expired or invalid"}` |
| 403 | Rol de workspace insuficiente (`WorkspaceAccessInterceptor` escribe la respuesta directamente) | `{code:403, msg:"...", data:null}` |
| 404 | Sin coincidencia de ruta (`NoResourceFoundException`) | `{code:404, msg:"Resource not found"}` |
| 405 | Método no soportado (`HttpRequestMethodNotSupportedException`) | `{code:405, msg:"Method not allowed"}` |
| 409 | Confirmación requerida (`ConfirmRequiredException`) | **Rompe el envoltorio**: `{code, message, boundAgents}` (el campo es `message`, **no** `msg`) — la única respuesta no-`R` de la API |
| 500 | Catch-all (`Exception`) | `{code:500, msg:"Internal server error"}` — la traza de stack no se filtra |
| 503 | Timeout asíncrono (no-SSE) | `{code:503, msg:"Request timeout, please try again"}` |

> Los endpoints SSE (`/chat/stream`, etc.) **no** emiten envoltorio JSON ante error; envían un evento SSE `error` en su lugar: `event: error` / `data: {"message":"..."}`. Ver la [guía de WebChat](./webchat#sse-event-protocol).

### Paginación

Los endpoints paginados devuelven `R<IPage<T>>` directamente — la serialización de `Page` de MyBatis Plus:

```json
{
  "code": 200,
  "data": {
    "records": [ /* filas de la página actual */ ],
    "total": 128,
    "size": 20,
    "current": 1,
    "pages": 7
  }
}
```

| Campo | Significado |
|---|---|
| `records` | Filas de la página actual (**el nombre del campo es `records`**, no `list`/`items`) |
| `total` | Conteo total de registros |
| `size` | Tamaño de página |
| `current` | Número de página actual, 1-basado |
| `pages` | Conteo total de páginas |

Parámetros de consulta comunes: `page` (default 1), `size` (default 20). Ejemplos: `GET /api/v1/audit/events`, `GET /api/v1/conversations/page`.

### Convenciones de ID y tipo

- **Snowflake `Long` serializado como cadena JSON**: todos los PK del backend son `Long`, pero Jackson los serializa como cadenas. Los clientes (especialmente JS) deben **tratar los IDs como cadenas de punta a punta** para evitar pérdida de precisión de `Number.MAX_SAFE_INTEGER`.
- **La contraseña es solo-escritura**: `UserEntity.password` está anotado `@JsonProperty(access = WRITE_ONLY)` — se acepta en login/creación, nunca está presente en ninguna respuesta.

### Modelo de auth

`JwtAuthFilter` soporta tres formas de token, todas vía el encabezado `Authorization`:

1. **JWT**: `Authorization: Bearer <jwt>`. Empieza con `eyJ` (header base64). El campo `token` devuelto por login es exactamente esto.
2. **Personal Access Token (PAT)**: `Authorization: Bearer <pat>`. Prefijado con `mc_`, para uso headless / CI / SDK. El texto plano se devuelve **solo una vez** en la creación de `POST /api/v1/auth/tokens`; después solo se almacena el hash. El filtro despacha por el prefijo `mc_` al camino de verificación PAT.
3. **Parámetro de consulta SSE `?token=`**: el `EventSource` nativo del navegador no puede definir encabezados personalizados, así que los endpoints de streaming SSE aceptan además `?token=<token>` (JWT o PAT).

**Renovación deslizante**: cuando un JWT está cerca de expirar (default < 2h restantes), el encabezado de respuesta devuelve un token fresco — `X-New-Token: <nuevoJwt>` (con `Access-Control-Expose-Headers: X-New-Token`). Los clientes deben vigilar y reemplazar el token almacenado localmente. El TTL del JWT es de 24h por defecto (`mateclaw.jwt.expiration=86400000`).

### Cómo funciona `X-Workspace-Id`

- **Sin ThreadLocal / holder de contexto de solicitud.** El id de workspace se consume de dos formas:
  1. **Aplicación de RBAC**: `WorkspaceAccessInterceptor` lee `X-Workspace-Id` para los métodos anotados `@RequireWorkspaceRole` (roles owner > admin > member > viewer) o `@RequireGlobalAdmin`, cayendo al workspace `1` cuando falta/es ilegible. El permiso insuficiente escribe una respuesta JSON 403 directamente.
  2. **Lecturas de negocio**: muchos controllers lo toman vía `@RequestHeader(value="X-Workspace-Id", required=false) Long workspaceId` para el alcance de consultas, también cayendo al `1`.
- Así el aislamiento de workspace se aplica por "auth de interceptor + auto-lectura del controller" juntos; los clientes deben pasar `X-Workspace-Id` explícitamente para llamadas acotadas a workspace.

## APIs de uso frecuente

### Login

```bash
curl -X POST http://localhost:18088/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Chat

```bash
curl -N -X POST http://localhost:18088/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"agentId":"1","message":"Hello","conversationId":"conv-abc123"}'
```

Usa `fetch()` con un lector de streaming para `/chat/stream`; el `EventSource` del navegador no puede enviar cuerpos POST.

### Aprobación de herramientas

No hay endpoint REST `POST /api/v1/approvals/{id}/resolve`. La aprobación y denegación web pasan por el stream de chat enviando `/approve` o `/deny` en la conversación en espera. La hidratación de solo lectura sigue siendo `GET /api/v1/chat/{conversationId}/pending-approvals`. Las políticas de auto-aprobación se gestionan bajo `/api/v1/approval/grants`.

### Doctor / Salud

La superficie de salud actual del backend es `GET /api/v1/system/health`. Los viejos endpoints `/api/v1/doctor/*` no están implementados en el árbol de código actual.

### Generación multimodal

La generación de imagen, video, música y 3D son herramientas de agente (`image_generate`, `video_generate`, `music_generate`, `model3d_generate`), no controllers REST independientes `/api/v1/image`, `/api/v1/video` o `/api/v1/music`. Las superficies REST que sí existen aquí son TTS/STT y la descarga de archivos generados.

### Endpoint no-REST

`/api/v1/talk/ws` lo registra `WebSocketConfig` para Talk Mode. Está intencionalmente listado en `SecurityConfig` como ruta WebSocket pública, pero no cuenta en el inventario de rutas de controllers de abajo.

## Referencia de Endpoints Insignia

Referencia completa de solicitud/respuesta de los endpoints más usados. Cada campo mapea 1:1 al DTO fuente. El inventario de rutas de 406 filas más abajo es el índice completo; esta sección es el walkthrough legible por humanos de los endpoints de alto tráfico.

### Login: `POST /api/v1/auth/login`

Endpoint público (sin auth requerida). Intercambia credenciales por un JWT.

**Cuerpo de solicitud** `LoginRequest` (`AuthController.java`):

| Campo | Tipo | Descripción |
|---|---|---|
| `username` | string | Nombre de usuario |
| `password` | string | Contraseña |

**Respuesta** `R<LoginResponse>`:

```json
{
  "code": 200,
  "data": {
    "id": "1",
    "token": "eyJhbGciOi...",
    "username": "admin",
    "nickname": "Admin",
    "role": "admin"
  }
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID de usuario (Snowflake, como cadena) |
| `token` | string | **JWT** — envía como `Authorization: Bearer <token>` en solicitudes posteriores. No hay campo de expiración separado; la expiración vive en el claim `exp` del JWT |
| `username` | string | Nombre de usuario |
| `nickname` | string | Nombre visible |
| `role` | string | `admin` o `user` |

**Errores**: usuario/contraseña incorrectos → HTTP 401, `{code:401, msg:"..."}`.

```bash
curl -X POST http://localhost:18088/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Chat en streaming: `POST /api/v1/chat/stream`

> Endpoint público (`SecurityConfig` permite `/api/v1/chat/stream`), pero en la práctica aún necesitas un token para resolver el usuario y los permisos — pasa `?token=` o el encabezado `Authorization`.

Devuelve `text/event-stream`; **no** el envoltorio JSON. El protocolo de eventos SSE (`meta` / `content_delta` / `done` / `error`, etc.) está documentado en la [guía de WebChat](./webchat#sse-event-protocol).

**Cuerpo de solicitud** `ChatController.ChatStreamRequest` (`ChatController.java:1211`):

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `agentId` | string | — | Requerido, ID del agente destino |
| `message` | string | — | Mensaje del usuario de este turno (mutuamente excluyente con `contentParts`) |
| `contentParts` | array | — | Partes de mensaje multimodal (texto + imagen); mutuamente excluyente con `message` |
| `conversationId` | string | `"default"` | ID de conversación; para una conversación nueva usa una cadena única generada por el cliente |
| `reconnect` | boolean | — | `true` = reconectar a un stream en vuelo, no enviar mensaje nuevo |
| `lastEventId` | string | — | Solo tiene sentido con `reconnect=true`: saltar eventos con id ≤ este valor para evitar replay duplicado |
| `thinkingLevel` | string | null | Profundidad de razonamiento: `off` / `low` / `medium` / `high` / `max`; null sigue el default del Agente |
| `modelProvider` | string | null | Override de proveedor por conversación (emparejado con `modelName`) |
| `modelName` | string | null | Override de nombre de modelo por conversación |
| `endUserId` | string | null | ID de usuario final de terceros, aísla memoria cuando una cuenta de AuraClaw es frontend de muchos usuarios finales |

El `EventSource` nativo del navegador no puede enviar un cuerpo POST — usa `fetch()` con un lector de streaming.

```bash
curl -N -X POST "http://localhost:18088/api/v1/chat/stream?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"agentId":"1","message":"Hello","conversationId":"conv-abc123"}'
```

Endpoints relacionados: `POST /api/v1/chat/{conversationId}/stop` (detener generación), `POST /api/v1/chat/{conversationId}/interrupt` (encolar un seguimiento sin interrumpir el stream actual).

### Gestión de agentes

Montada en `/api/v1/agents`, `@Tag("Agent管理")`. Todo método requiere `@RequireWorkspaceRole` (al menos `viewer`; las escrituras necesitan `member`).

**Listar** `GET /api/v1/agents?enabled=true` — encabezado de solicitud `X-Workspace-Id`; devuelve `R<List<AgentEntity>>`.

**Crear** `POST /api/v1/agents` — el cuerpo de solicitud es un `AgentEntity` (campos clave abajo); el backend fuerza-inyecta `workspaceId` y `creatorUserId`. Devuelve la entidad completa creada.

Campos clave de `AgentEntity` (`AgentEntity.java`):

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID de agente (ignorado al crear, asignado por el backend) |
| `name` | string | Nombre |
| `description` | string | Descripción |
| `agentType` | string | `react` o `plan_execute` |
| `systemPrompt` | string | Prompt de sistema |
| `modelName` | string | Override de modelo por agente (nombre de modelo); vacío = default global |
| `maxIterations` | int | Iteraciones máximas |
| `enabled` | boolean | Flag habilitado |
| `icon` | string | Icono (emoji o URL) |
| `tags` | string | Etiquetas (separadas por comas) |
| `defaultThinkingLevel` | string | Profundidad de razonamiento por defecto |
| `primaryKbId` | string | ID de base de conocimiento primaria |
| `skillsDisabled` | boolean | Deshabilitar explícitamente todos los skills |
| `toolsDisabled` | boolean | Deshabilitar explícitamente todas las herramientas no-sistema |

**Borrar** `DELETE /api/v1/agents/{id}` — auth de tres vías: admin de sistema / admin de workspace+ / el creador. Si no, 403.

```bash
# Listar
curl http://localhost:18088/api/v1/agents?enabled=true \
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: 1"

# Crear
curl -X POST http://localhost:18088/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"name":"Support Agent","agentType":"react","systemPrompt":"You are a support agent","enabled":true}'
```

> El mismo árbol también tiene `GET /api/v1/agents/{id}/chat/stream` (una forma GET de SSE, coexistente con el `POST /chat/stream` de arriba), `POST /api/v1/agents/{id}/chat` (chat síncrono) y `POST /api/v1/agents/{id}/execute` (Plan-Execute).

### Gestión de conversaciones

Montada en `/api/v1/conversations`, `@Tag("会话管理")`. Aislada por usuario logueado (principal del JWT).

**Listar** `GET /api/v1/conversations` — devuelve `R<List<ConversationVO>>`. `ConversationVO` agrega campos de visualización sobre la entidad de conversación:

| Campo | Descripción |
|---|---|
| `conversationId` | ID de conversación (una cadena, no un Snowflake) |
| `title` | Título |
| `agentId` / `agentName` / `agentIcon` | Agente asociado |
| `username` | Usuario propietario |
| `messageCount` | Conteo de mensajes |
| `lastMessage` / `lastActiveTime` | Último mensaje y hora |
| `pinned` / `archived` | Fijada / archivada (0/1) |
| `modelProvider` / `modelName` | Override de modelo por conversación |
| `status` | `active` (activa dentro de 24h) / `closed` |
| `streamStatus` | `idle` / `running` |
| `source` | Canal de origen: `web` / `feishu` / `dingtalk` / `telegram` / `discord` / `wecom` / `qq` / `weixin` / `cron` |

**Paginado** `GET /api/v1/conversations/page?page=1&size=20&keyword=xxx` — devuelve `R<IPage<ConversationVO>>` (forma de paginación en "Convenciones").

**Historial de mensajes** `GET /api/v1/conversations/{conversationId}/messages` — soporta tres modos:
- Sin `limit`: devuelve todos los mensajes (`R<List<MessageVO>>`, retrocompatible).
- Con `limit`: devuelve los últimos `limit` mensajes + una flag `hasMore`: `R<{messages: MessageVO[], hasMore: boolean}>`.
- Con `beforeId` + `limit`: trae hacia atrás para cargar mensajes anteriores.

Campos clave de `MessageVO`: `id`, `role`, `content`, `toolName`, `status`, `metadata` (objeto, contiene toolCalls etc.), `promptTokens` / `completionTokens`, `runtimeModel` / `runtimeProvider`, `contentParts`, `createTime`.

**Ops por conversación**: `PUT .../title` (renombrar), `PUT .../pin` (`{pinned:bool}`), `PUT .../model` (cambiar modelo `{modelProvider, modelName}`), `DELETE .../messages` (limpiar mensajes, conservar la conversación), `DELETE .../{conversationId}` (borrar conversación), `POST /batch-delete` (`{conversationIds: [...]}`, como máximo 200 ids únicos), `GET .../status` (estado de stream `{streamStatus}`) y `GET .../trajectory` (exportación en texto plano en orden de emisión de segmentos).

> Toda op primero chequea `isConversationOwner(conversationId, username)`; los no-dueños obtienen 403.

### Configuración de modelos

Montada en `/api/v1/models`, `@Tag("模型配置管理")`. `GET /` y `GET /catalog` requieren `@RequireGlobalAdmin` (incluyen info sensible como claves API); `/enabled`, `/default`, `/active` solo necesitan `viewer`.

- `GET /api/v1/models` — lista de proveedores habilitados (`R<List<ProviderInfoDTO>>`, incluye claves, solo admin).
- `GET /api/v1/models/enabled` — lista de modelos habilitados (`R<List<ModelConfigEntity>>`, sin claves).
- `GET /api/v1/models/default` — modelo por defecto global (`R<ModelConfigEntity>`).
- `GET /api/v1/models/active` — modelo activo actual `{activeLlm: {provider, modelName}}`.
- `PUT /api/v1/models/active` — define el modelo activo.
- `PUT /api/v1/models/{providerId}/models/context-window` — un admin global define el `maxInputTokens` de un `modelId`; null o no-positivo limpia el override.

### Eventos de auditoría (ejemplo de paginación)

`GET /api/v1/audit/events` — `@RequireWorkspaceRole("admin")`, devuelve `R<IPage<AuditEventEntity>>`. El ejemplo canónico de "paginación + encabezado de workspace".

| Parámetro de consulta | Default | Descripción |
|---|---|---|
| `action` | — | Filtro de acción (p. ej. `CREATE` / `UPDATE` / `DELETE`) |
| `resourceType` | — | Filtro de tipo de recurso (p. ej. `AGENT`) |
| `startTime` | — | Hora de inicio ISO 8601 |
| `endTime` | — | Hora de fin ISO 8601 |
| `page` | 1 | Número de página |
| `size` | 20 | Tamaño de página |

```bash
curl "http://localhost:18088/api/v1/audit/events?page=1&size=20&resourceType=AGENT" \
  -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: 1"
```

### Cambio de contraseña: `PUT /api/v1/auth/users/{id}/password`

Tres cosas a notar (difieren de la intuición):

1. Los parámetros van vía **`@RequestParam`, no un cuerpo de solicitud**: tanto `oldPassword` como `newPassword` son parámetros de consulta.
2. El `{id}` en la ruta es **solo informativo**: el usuario realmente operado se resuelve del principal del JWT (`auth.getName()`); un usuario solo puede cambiar su propia contraseña.
3. Requiere login (no `@RequireGlobalAdmin`).

```bash
curl -X PUT "http://localhost:18088/api/v1/auth/users/1/password?oldPassword=admin123&newPassword=newPass456" \
  -H "Authorization: Bearer $TOKEN"
```

### Personal Access Token

Montada en `/api/v1/auth/tokens`, `@Tag("Personal Access Tokens")`. Para uso headless / CI / SDK.

- `GET /api/v1/auth/tokens` — lista mis PATs (solo metadatos; **el texto plano nunca se devuelve**).
- `POST /api/v1/auth/tokens` — crea un PAT: **el texto plano aparece solo en esta respuesta**, después solo se almacena el hash SHA-256 y no puede recuperarse. Guárdalo de inmediato.
- `DELETE /api/v1/auth/tokens/{id}` — revocación por borrado suave; la auth posterior con este token falla.

Un PAT creado (prefijo `mc_`) va directo a `Authorization: Bearer mc_...`; `JwtAuthFilter` despacha por prefijo al camino de verificación PAT, comportándose idéntico a un JWT.

### Aprobación de herramientas (aclaración importante)

**No hay** endpoint REST independiente de aprobación como `POST /api/v1/approvals/{id}/resolve`. El aprobar / denegar del lado web ocurre enviando `/approve` o `/deny` en la conversación en espera, pasando por el flujo de replay del chat-stream. El endpoint de "hidratación" de solo lectura tras un refresco de página es `GET /api/v1/chat/{conversationId}/pending-approvals`. Las políticas de auto-aprobación se gestionan bajo `/api/v1/approval/grants`.

> Las operaciones peligrosas que requieren una segunda confirmación lanzan `ConfirmRequiredException` — devolviendo **HTTP 409** y **rompiendo el envoltorio `R`**: `{code, message, boundAgents}` (el campo es `message`, no `msg`). Los clientes deben ramificar en el estado 409 y renderizar un diálogo de confirmación.

## Inventario de Rutas Alineado con el Código

Total de rutas extraídas: 406.

### Autenticación

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/auth/login` | `Login` |
| `GET` | `/api/v1/auth/tokens` | `Listar mis PATs (solo metadatos — el texto plano nunca se devuelve tras la creación)` |
| `POST` | `/api/v1/auth/tokens` | `Acuñar un PAT nuevo — el texto plano devuelto se muestra una vez y no puede recuperarse` |
| `DELETE` | `/api/v1/auth/tokens/{id}` | `Revocar un PAT — borrado suave; los intentos de auth posteriores con este token fallarán` |
| `GET` | `/api/v1/auth/users` | `Listar Usuarios` |
| `POST` | `/api/v1/auth/users` | `Crear Usuario` |
| `PUT` | `/api/v1/auth/users/{id}/password` | `Cambiar Contraseña` |

### Chat

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/chat` | `Chat` |
| `GET` | `/api/v1/chat/files/{conversationId}/{storedName:.+}` | `Leer Archivo Subido` |
| `POST` | `/api/v1/chat/stream` | `Chat Stream` |
| `POST` | `/api/v1/chat/upload` | `Subir` |
| `POST` | `/api/v1/chat/{conversationId}/interrupt` | `Interrumpir Stream` |
| `GET` | `/api/v1/chat/{conversationId}/pending-approvals` | `Obtener Aprobaciones Pendientes` |
| `POST` | `/api/v1/chat/{conversationId}/stop` | `Detener Stream` |

### Conversaciones

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/conversations` | `Listar` |
| `POST` | `/api/v1/conversations/batch-delete` | `Borrado Masivo` |
| `GET` | `/api/v1/conversations/page` | `Página` |
| `DELETE` | `/api/v1/conversations/{conversationId}` | `Borrar` |
| `DELETE` | `/api/v1/conversations/{conversationId}/messages` | `Limpiar Mensajes` |
| `GET` | `/api/v1/conversations/{conversationId}/messages` | `Listar Mensajes` |
| `PUT` | `/api/v1/conversations/{conversationId}/model` | `Definir Modelo` |
| `PUT` | `/api/v1/conversations/{conversationId}/pin` | `Definir Fijada` |
| `GET` | `/api/v1/conversations/{conversationId}/status` | `Obtener Estado de Stream` |
| `PUT` | `/api/v1/conversations/{conversationId}/title` | `Renombrar` |
| `GET` | `/api/v1/conversations/{conversationId}/trajectory` | `Exportar trayectoria en texto plano (dueño de conversación)` |

### Team Runs (2.1.0+)

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/team-runs/{runId}` | `Obtener un Team Run (viewer+)` |
| `POST` | `/api/v1/team-runs/{runId}/cancel` | `Cancelar la corrida, {reason} opcional (admin)` |
| `GET` | `/api/v1/teams/{teamId}/runs` | `Listar corridas del equipo, activeOnly opcional (viewer+)` |
| `GET` | `/api/v1/teams/{teamId}/runs/page` | `Página de cursor/límite de corridas del equipo, activeOnly opcional (viewer+)` |
| `GET` | `/api/v1/conversations/{conversationId}/team-runs` | `Listar corridas ligadas a una conversación líder (viewer+)` |
| `GET` | `/api/v1/conversations/{conversationId}/team-runs/page` | `Página de cursor/límite de corridas de conversación (viewer+)` |

Todo endpoint acota lecturas/escrituras al workspace actual (`X-Workspace-Id`, default workspace 1 cuando se omite); los consumidores deben mantener los ids Snowflake como cadenas.

### Agentes

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/agents` | `Listar` |
| `POST` | `/api/v1/agents` | `Crear` |
| `GET` | `/api/v1/agents/{agentId}/provider-preferences` | `Listar Preferencias de Proveedor` |
| `PUT` | `/api/v1/agents/{agentId}/provider-preferences` | `Definir Preferencias de Proveedor` |
| `GET` | `/api/v1/agents/{agentId}/skills` | `Listar Skills` |
| `PUT` | `/api/v1/agents/{agentId}/skills` | `Definir Skills` |
| `DELETE` | `/api/v1/agents/{agentId}/skills/{skillId}` | `Desligar Skill` |
| `POST` | `/api/v1/agents/{agentId}/skills/{skillId}` | `Ligar Skill` |
| `GET` | `/api/v1/agents/{agentId}/tools` | `Listar Herramientas` |
| `PUT` | `/api/v1/agents/{agentId}/tools` | `Definir Herramientas` |
| `GET` | `/api/v1/agents/{agentId}/workspace/files` | `Listar Archivos` |
| `DELETE` | `/api/v1/agents/{agentId}/workspace/files/**` | `Borrar Archivo` |
| `GET` | `/api/v1/agents/{agentId}/workspace/files/**` | `Obtener Archivo` |
| `PUT` | `/api/v1/agents/{agentId}/workspace/files/**` | `Guardar Archivo` |
| `GET` | `/api/v1/agents/{agentId}/workspace/memory/export` | `Exportar Memoria` |
| `POST` | `/api/v1/agents/{agentId}/workspace/memory/import` | `Importar Memoria` |
| `POST` | `/api/v1/agents/{agentId}/workspace/memory/import/preview` | `Previsualizar Importación de Memoria` |
| `GET` | `/api/v1/agents/{agentId}/workspace/prompt-files` | `Obtener Archivos de Prompt` |
| `PUT` | `/api/v1/agents/{agentId}/workspace/prompt-files` | `Definir Archivos de Prompt` |
| `DELETE` | `/api/v1/agents/{id}` | `Borrar` |
| `GET` | `/api/v1/agents/{id}` | `Obtener` |
| `PUT` | `/api/v1/agents/{id}` | `Actualizar` |
| `GET` | `/api/v1/agents/{id}/capabilities` | `Capacidades` |
| `POST` | `/api/v1/agents/{id}/chat` | `Chat` |
| `GET` | `/api/v1/agents/{id}/chat/stream` | `Chat Stream` |
| `POST` | `/api/v1/agents/{id}/execute` | `Ejecutar` |
| `GET` | `/api/v1/agents/{id}/state` | `Obtener Estado` |

### Plantillas de Agente

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/templates` | `Listar` |
| `POST` | `/api/v1/templates/{id}/apply` | `Aplicar` |

### Sub-agentes

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/subagents/active` | `Listar sub-agentes activos en el árbol de delegación de una conversación` |
| `POST` | `/api/v1/subagents/spawn-pause` | `Definir pausa-de-spawn de sub-agentes para una conversación` |
| `POST` | `/api/v1/subagents/{subagentId}/interrupt` | `Interrumpir un sub-agente en ejecución` |

### Runtime de Admin

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/admin/agent-runtime/runs/{conversationId}/recycle` | `Reciclaje forzado — descarta flux + suelta RunState; úsalo tras ignorar el stop amigable` |
| `POST` | `/api/v1/admin/agent-runtime/runs/{conversationId}/stop` | `Stop amigable — pide a la corrida que se apague en su siguiente checkpoint` |
| `GET` | `/api/v1/admin/agent-runtime/snapshot` | `Snapshot de todo turno de agente en vuelo` |
| `POST` | `/api/v1/admin/agent-runtime/subagents/{subagentId}/interrupt` | `Interrumpir un sub-agente (override admin del chequeo de propiedad)` |
| `POST` | `/api/v1/admin/agent-runtime/sweep` | `Reciclar toda corrida actualmente marcada como atascada` |

### Concesiones de Aprobación

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/approval/grants` | `Listar` |
| `POST` | `/api/v1/approval/grants` | `Crear` |
| `GET` | `/api/v1/approval/grants/active` | `Resumen Activo` |
| `DELETE` | `/api/v1/approval/grants/{id}` | `Revocar` |
| `GET` | `/api/v1/approval/resolutions` | `Listar Resoluciones` |

### Seguridad y Tool Guard

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/security/approvals` | `Listar Aprobaciones` |
| `GET` | `/api/v1/security/audit/logs` | `Listar Logs de Auditoría` |
| `GET` | `/api/v1/security/audit/stats` | `Obtener Stats de Auditoría` |
| `GET` | `/api/v1/security/guard/config` | `Obtener Config de Guarda` |
| `PUT` | `/api/v1/security/guard/config` | `Actualizar Config de Guarda` |
| `GET` | `/api/v1/security/guard/config/file-guard` | `Obtener Config de File Guard` |
| `PUT` | `/api/v1/security/guard/config/file-guard` | `Actualizar Config de File Guard` |
| `GET` | `/api/v1/security/guard/rules` | `Listar Reglas` |
| `POST` | `/api/v1/security/guard/rules` | `Crear Regla` |
| `GET` | `/api/v1/security/guard/rules/builtin` | `Listar Reglas Integradas` |
| `DELETE` | `/api/v1/security/guard/rules/by-id/{id}` | `Borrar Regla Por PK` |
| `GET` | `/api/v1/security/guard/rules/export` | `Exportar Reglas` |
| `POST` | `/api/v1/security/guard/rules/import` | `Importar Reglas` |
| `DELETE` | `/api/v1/security/guard/rules/{ruleId}` | `Borrar Regla` |
| `PUT` | `/api/v1/security/guard/rules/{ruleId}` | `Actualizar Regla` |
| `PUT` | `/api/v1/security/guard/rules/{ruleId}/toggle` | `Alternar Regla` |

### Auditoría

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/audit/events` | `Listar Eventos` |

### Actividad

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/activity/feed` | `Feed de actividad unificado (auditoría + aprobación + llamadas a herramientas)` |

### Notificaciones

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/notifications/summary` | `Conteos agregados para las insignias de atención de la barra lateral` |

### Workspaces

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/workspaces` | `Listar` |
| `POST` | `/api/v1/workspaces` | `Crear` |
| `DELETE` | `/api/v1/workspaces/{id}` | `Borrar` |
| `GET` | `/api/v1/workspaces/{id}` | `Obtener` |
| `PUT` | `/api/v1/workspaces/{id}` | `Actualizar` |
| `GET` | `/api/v1/workspaces/{id}/access` | `Obtener Acceso` |
| `GET` | `/api/v1/workspaces/{id}/members` | `Listar Miembros` |
| `POST` | `/api/v1/workspaces/{id}/members` | `Agregar Miembro` |
| `DELETE` | `/api/v1/workspaces/{id}/members/{targetUserId}` | `Quitar Miembro` |
| `PUT` | `/api/v1/workspaces/{id}/members/{targetUserId}` | `Actualizar Rol de Miembro` |

### Ajustes

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/settings` | `Obtener Ajustes` |
| `PUT` | `/api/v1/settings` | `Guardar Ajustes` |
| `GET` | `/api/v1/settings/language` | `Obtener Idioma` |
| `PUT` | `/api/v1/settings/language` | `Guardar Idioma` |
| `PUT` | `/api/v1/settings/sidecar` | `Guardar Sidecar` |

### Setup de primera ejecución

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/setup/init` | `Init` |
| `GET` | `/api/v1/setup/onboarding-status` | `Obtener Estado de Onboarding` |
| `GET` | `/api/v1/setup/status` | `Obtener Estado` |

### Salud del sistema

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/system/browser-health` | `Diagnósticos de lanzamiento del navegador` |
| `GET` | `/api/v1/system/health` | `Chequeo de salud del sistema` |

### Dashboard

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/dashboard/cron-runs` | `Corridas Recientes` |
| `GET` | `/api/v1/dashboard/cron-runs/{cronJobId}` | `Corridas del Cron Job` |
| `GET` | `/api/v1/dashboard/overview` | `Resumen` |
| `GET` | `/api/v1/dashboard/trend` | `Tendencia` |

### Uso de Tokens

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/token-usage` | `Obtener Resumen` |

### Modelos

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/models` | `Listar` |
| `POST` | `/api/v1/models` | `Crear` |
| `GET` | `/api/v1/models/active` | `Obtener Modelo Activo` |
| `PUT` | `/api/v1/models/active` | `Definir Modelo Activo` |
| `GET` | `/api/v1/models/by-type` | `Listar Por Tipo` |
| `GET` | `/api/v1/models/catalog` | `Catálogo` |
| `DELETE` | `/api/v1/models/custom-providers` | `Borrar Proveedor Personalizado Por Consulta` |
| `POST` | `/api/v1/models/custom-providers` | `Crear Proveedor Personalizado` |
| `DELETE` | `/api/v1/models/custom-providers/{providerId}` | `Borrar Proveedor Personalizado` |
| `GET` | `/api/v1/models/default` | `Obtener Modelo Por Defecto` |
| `GET` | `/api/v1/models/embedding/default` | `Obtener Embedding Por Defecto` |
| `POST` | `/api/v1/models/embedding/default` | `Definir Embedding Por Defecto` |
| `POST` | `/api/v1/models/embedding/{modelId}/test` | `Probar Embedding` |
| `GET` | `/api/v1/models/enabled` | `Listar Habilitados` |
| `DELETE` | `/api/v1/models/{id}` | `Borrar` |
| `GET` | `/api/v1/models/{id}` | `Obtener` |
| `PUT` | `/api/v1/models/{id}` | `Actualizar` |
| `POST` | `/api/v1/models/{id}/default` | `Definir Default` |
| `PUT` | `/api/v1/models/{providerId}/config` | `Actualizar Config de Proveedor` |
| `POST` | `/api/v1/models/{providerId}/disable` | `Deshabilitar Proveedor` |
| `POST` | `/api/v1/models/{providerId}/discover` | `Descubrir Modelos` |
| `POST` | `/api/v1/models/{providerId}/discover/apply` | `Aplicar Modelos Descubiertos` |
| `PUT` | `/api/v1/models/{providerId}/models/context-window` | `Definir/limpiar los tokens máximos de entrada de un modelo (admin global)` |
| `POST` | `/api/v1/models/{providerId}/enable` | `Habilitar Proveedor` |
| `DELETE` | `/api/v1/models/{providerId}/models` | `Quitar Modelo de Proveedor` |
| `POST` | `/api/v1/models/{providerId}/models` | `Agregar Modelo de Proveedor` |
| `POST` | `/api/v1/models/{providerId}/models/test` | `Probar Modelo` |
| `POST` | `/api/v1/models/{providerId}/test-connection` | `Probar Conexión` |

### OAuth

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/oauth/anthropic/reload` | `Forzar re-detección de credenciales y refrescar si está cerca de expirar` |
| `GET` | `/api/v1/oauth/anthropic/status` | `Leer el estado actual de credenciales OAuth de Claude Code desde el disco local` |
| `GET` | `/api/v1/oauth/openai/authorize` | `Autorizar` |
| `POST` | `/api/v1/oauth/openai/callback-paste` | `Pegar Callback` |
| `POST` | `/api/v1/oauth/openai/device/cancel` | `Flujo de dispositivo: cancelar una sesión pendiente` |
| `POST` | `/api/v1/oauth/openai/device/poll` | `Flujo de dispositivo: consultar completitud` |
| `POST` | `/api/v1/oauth/openai/device/start` | `Flujo de dispositivo: iniciar — pedir user_code` |
| `POST` | `/api/v1/oauth/openai/refresh` | `Refrescar` |
| `DELETE` | `/api/v1/oauth/openai/revoke` | `Revocar` |
| `GET` | `/api/v1/oauth/openai/status` | `Estado` |

### Runtime LLM

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/llm/provider-pool` | `Snapshot` |
| `POST` | `/api/v1/llm/provider-pool/{providerId}/reprobe` | `Re-sondear` |

### Herramientas

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/tools` | `Listar` |
| `POST` | `/api/v1/tools` | `Crear` |
| `GET` | `/api/v1/tools/available` | `Listar Disponibles` |
| `GET` | `/api/v1/tools/enabled` | `Listar Habilitadas` |
| `DELETE` | `/api/v1/tools/{id}` | `Borrar` |
| `GET` | `/api/v1/tools/{id}` | `Obtener` |
| `PUT` | `/api/v1/tools/{id}` | `Actualizar` |
| `PUT` | `/api/v1/tools/{id}/disclosure-tier` | `Definir Nivel de Divulgación` |
| `PUT` | `/api/v1/tools/{id}/toggle` | `Alternar` |

### Servidores MCP

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/mcp/servers` | `Listar` |
| `POST` | `/api/v1/mcp/servers` | `Crear` |
| `POST` | `/api/v1/mcp/servers/refresh` | `Refrescar` |
| `DELETE` | `/api/v1/mcp/servers/{id}` | `Borrar` |
| `GET` | `/api/v1/mcp/servers/{id}` | `Obtener` |
| `PUT` | `/api/v1/mcp/servers/{id}` | `Actualizar` |
| `PUT` | `/api/v1/mcp/servers/{id}/disclosure-tier` | `Definir Nivel de Divulgación` |
| `POST` | `/api/v1/mcp/servers/{id}/test` | `Probar` |
| `PUT` | `/api/v1/mcp/servers/{id}/toggle` | `Alternar` |
| `GET` | `/api/v1/mcp/servers/{id}/tools` | `Listar Herramientas` |

### Endpoints ACP

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/acp/endpoints` | `Listar endpoints ACP` |
| `POST` | `/api/v1/acp/endpoints` | `Crear un endpoint ACP personalizado` |
| `DELETE` | `/api/v1/acp/endpoints/{id}` | `Borrar un endpoint ACP (los integrados están protegidos)` |
| `GET` | `/api/v1/acp/endpoints/{id}` | `Obtener endpoint ACP por id` |
| `PUT` | `/api/v1/acp/endpoints/{id}` | `Actualizar un endpoint ACP` |
| `POST` | `/api/v1/acp/endpoints/{id}/test` | `Probar conexión de endpoint ACP (handshake initialize)` |
| `PUT` | `/api/v1/acp/endpoints/{id}/toggle` | `Habilitar / deshabilitar un endpoint ACP` |

### Skills

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/skills` | `Listar` |
| `POST` | `/api/v1/skills` | `Crear` |
| `GET` | `/api/v1/skills/counts` | `Conteos` |
| `POST` | `/api/v1/skills/curator/activate` | `Activar Curador` |
| `POST` | `/api/v1/skills/curator/dry-run` | `Dry Run del Curador` |
| `POST` | `/api/v1/skills/curator/pause` | `Pausar Curador` |
| `GET` | `/api/v1/skills/curator/reports` | `Reportes del Curador` |
| `GET` | `/api/v1/skills/curator/reports/{runId}` | `Reporte del Curador` |
| `POST` | `/api/v1/skills/curator/resume` | `Reanudar Curador` |
| `GET` | `/api/v1/skills/curator/status` | `Estado del Curador` |
| `POST` | `/api/v1/skills/curator/consolidate` | `Habilitar/deshabilitar la pasada de consolidación del curador` |
| `GET` | `/api/v1/skills/curator/managed` | `Listar skills bajo curaduría autónoma` |
| `GET` | `/api/v1/skills/curator/unmanaged` | `Listar skills fuera de la curaduría autónoma` |
| `POST` | `/api/v1/skills/curator/adopt` | `Entrega en lote a la curaduría; el cuerpo es un arreglo de ids string` |
| `POST` | `/api/v1/skills/curator/release` | `Devolución en lote a propiedad del usuario; el cuerpo es un arreglo de ids string` |
| `GET` | `/api/v1/skills/curator/snapshots` | `Listar puntos de restauración recientes del workspace` |
| `POST` | `/api/v1/skills/curator/snapshots` | `Capturar un punto de restauración; razón opcional` |
| `POST` | `/api/v1/skills/curator/snapshots/{snapshotId}/restore` | `Restaurar la librería de skills a un punto de restauración` |
| `GET` | `/api/v1/skills/routines` | `Listar candidatos de solicitudes recurrentes` |
| `POST` | `/api/v1/skills/routines/mine` | `Correr la minería de solicitudes recurrentes ahora` |
| `POST` | `/api/v1/skills/routines/{id}/dismiss` | `Descartar un candidato` |
| `POST` | `/api/v1/skills/routines/{id}/reopen` | `Reabrir un candidato` |
| `POST` | `/api/v1/skills/routines/{id}/promote` | `Promover ahora, evadiendo las compuertas de frecuencia` |
| `GET` | `/api/v1/skills/enabled` | `Listar Habilitados` |
| `POST` | `/api/v1/skills/install/cancel/{taskId}` | `Cancelar` |
| `GET` | `/api/v1/skills/install/hub/search` | `Buscar Hub` |
| `POST` | `/api/v1/skills/install/start` | `Iniciar Instalación` |
| `GET` | `/api/v1/skills/install/status/{taskId}` | `Obtener Estado` |
| `POST` | `/api/v1/skills/install/upload` | `Subir Zip` |
| `DELETE` | `/api/v1/skills/install/{skillName}` | `Desinstalar` |
| `GET` | `/api/v1/skills/prompt-preview` | `Vista Previa de Prompt` |
| `GET` | `/api/v1/skills/runtime/active` | `Obtener Skills Activos` |
| `POST` | `/api/v1/skills/runtime/refresh` | `Refrescar Runtime` |
| `GET` | `/api/v1/skills/runtime/status` | `Obtener Estado del Runtime` |
| `GET` | `/api/v1/skills/summary` | `Resumen` |
| `POST` | `/api/v1/skills/sync-files` | `Re-sincronizar los archivos de bundle de todo skill (admin)` |
| `POST` | `/api/v1/skills/synthesize-from-conversation` | `Sintetizar Desde Conversación` |
| `GET` | `/api/v1/skills/type/{skillType}` | `Listar Por Tipo` |
| `DELETE` | `/api/v1/skills/{id}` | `Borrar` |
| `GET` | `/api/v1/skills/{id}` | `Obtener` |
| `PUT` | `/api/v1/skills/{id}` | `Actualizar` |
| `POST` | `/api/v1/skills/{id}/archive` | `Archivar` |
| `GET` | `/api/v1/skills/{id}/employees` | `Listar agentes que pueden usar este skill` |
| `POST` | `/api/v1/skills/{id}/export-workspace` | `Exportar Al Workspace` |
| `GET` | `/api/v1/skills/{id}/lessons` | `Leer LESSONS.md por skill` |
| `POST` | `/api/v1/skills/{id}/lessons/clear` | `Limpiar todas las lecciones de un skill` |
| `POST` | `/api/v1/skills/{id}/pin` | `Fijar` |
| `GET` | `/api/v1/skills/{id}/requirements` | `Estados de prerrequisito pre-vuelo de un skill` |
| `POST` | `/api/v1/skills/{id}/rescan` | `Re-escanear` |
| `POST` | `/api/v1/skills/{id}/restore` | `Restaurar` |
| `POST` | `/api/v1/skills/{id}/sync-files` | `Re-sincronizar los archivos de bundle de este skill de BD → caché de workspace local` |
| `PUT` | `/api/v1/skills/{id}/toggle` | `Alternar` |
| `GET` | `/api/v1/skills/{id}/workspace` | `Obtener Info del Workspace` |
| `GET` | `/api/v1/skills/{skillId}/secrets` | `Listar claves secretas + vistas previas enmascaradas de un skill` |
| `POST` | `/api/v1/skills/{skillId}/secrets` | `Upsert de un valor secreto (valor vacío lo borra)` |
| `DELETE` | `/api/v1/skills/{skillId}/secrets/{key}` | `Borrar un solo secreto por clave` |

### Plantillas de Skill

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/skill-templates` | `Listar plantillas de skill` |
| `GET` | `/api/v1/skill-templates/{id}` | `Obtener una plantilla de skill` |
| `POST` | `/api/v1/skill-templates/{id}/instantiate` | `Instanciar una plantilla en un skill` |

### Plugins

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/plugins` | `Listar todos los plugins` |
| `GET` | `/api/v1/plugins/{name}` | `Obtener detalle de plugin` |
| `PUT` | `/api/v1/plugins/{name}/config` | `Actualizar configuración de plugin` |
| `POST` | `/api/v1/plugins/{name}/disable` | `Deshabilitar un plugin` |
| `POST` | `/api/v1/plugins/{name}/enable` | `Habilitar un plugin` |

### LLM Wiki

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/wiki/admin/backfill-tokens` | `Forzar la corrida del lote de relleno de conteo de tokens ahora` |
| `GET` | `/api/v1/wiki/admin/failures` | `Lista entre KBs de materiales que necesitan atención (fallidos/parciales/degradados) — admin` |
| `POST` | `/api/v1/wiki/admin/kb/{kbId}/rebuild-overview` | `Asegurar el andamio overview/log + reconstruir las stats de overview ahora` |
| `GET` | `/api/v1/wiki/chunks/{chunkId}/pages` | `Páginas Por Chunk Id` |
| `DELETE` | `/api/v1/wiki/hot-cache/{kbId}` | `Borrado suave de la fila de hot cache` |
| `GET` | `/api/v1/wiki/hot-cache/{kbId}` | `Obtener el snapshot actual del hot cache de una KB` |
| `POST` | `/api/v1/wiki/hot-cache/{kbId}/regenerate` | `Programar una reconstrucción manual del hot cache` |
| `GET` | `/api/v1/wiki/kb/{kbId}/jobs` | `Obtener Jobs` |
| `GET` | `/api/v1/wiki/kb/{kbId}/pages/{pageId}/citations` | `Citas de Página` |
| `GET` | `/api/v1/wiki/kb/{kbId}/pages/{slugA}/relation/{slugB}` | `Explicar Relación` |
| `POST` | `/api/v1/wiki/kb/{kbId}/pages/{slug}/enrich` | `Enriquecer Página` |
| `GET` | `/api/v1/wiki/kb/{kbId}/pages/{slug}/related` | `Páginas Relacionadas` |
| `POST` | `/api/v1/wiki/kb/{kbId}/pages/{slug}/repair` | `Reparar Página` |
| `POST` | `/api/v1/wiki/kb/{kbId}/search-preview` | `Vista Previa de Búsqueda` |
| `GET` | `/api/v1/wiki/kb/{kbId}/stats` | `Stats de KB` |
| `GET` | `/api/v1/wiki/knowledge-bases` | `Listar KBs` |
| `POST` | `/api/v1/wiki/knowledge-bases` | `Crear KB` |
| `GET` | `/api/v1/wiki/knowledge-bases/agent/{agentId}` | `Listar KBs Por Agente` |
| `GET` | `/api/v1/wiki/knowledge-bases/bindable` | `Listar KBs Ligables` |
| `DELETE` | `/api/v1/wiki/knowledge-bases/{id}` | `Borrar KB` |
| `GET` | `/api/v1/wiki/knowledge-bases/{id}` | `Obtener KB` |
| `PUT` | `/api/v1/wiki/knowledge-bases/{id}` | `Actualizar KB` |
| `GET` | `/api/v1/wiki/knowledge-bases/{id}/config` | `Obtener Config` |
| `PUT` | `/api/v1/wiki/knowledge-bases/{id}/config` | `Actualizar Config` |
| `GET` | `/api/v1/wiki/knowledge-bases/{id}/page-type-profile` | `Obtener Perfil de Tipo de Página` |
| `PUT` | `/api/v1/wiki/knowledge-bases/{id}/page-type-profile` | `Guardar Perfil de Tipo de Página` |
| `POST` | `/api/v1/wiki/knowledge-bases/{id}/page-type-profile/reset-default` | `Resetear Perfil de Tipo de Página` |
| `POST` | `/api/v1/wiki/knowledge-bases/{id}/page-type-profile/validate` | `Validar Perfil de Tipo de Página` |
| `POST` | `/api/v1/wiki/knowledge-bases/{id}/scan` | `Escanear Directorio` |
| `PUT` | `/api/v1/wiki/knowledge-bases/{id}/source-directory` | `Definir Directorio Fuente` |
| `GET` | `/api/v1/wiki/knowledge-bases/{id}/source-watcher` | `Obtener Observador de Fuentes` |
| `POST` | `/api/v1/wiki/knowledge-bases/{id}/source-watcher/scan` | `Disparar Observador de Fuentes` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/agents/{agentId}/page-type-permissions` | `Listar Permisos de Tipo de Página` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/agents/{agentId}/page-type-permissions` | `Guardar Permiso de Tipo de Página` |
| `DELETE` | `/api/v1/wiki/knowledge-bases/{kbId}/agents/{agentId}/page-type-permissions/{id}` | `Borrar Permiso de Tipo de Página` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/lint/broken-links` | `Obtener Reporte de Enlaces Rotos` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/lint/broken-links` | `Iniciar Escaneo de Enlaces Rotos` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/lint/broken-links/jobs/{jobId}` | `Obtener Job de Enlaces Rotos` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pages` | `Listar Páginas` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/archived` | `Listar Páginas Archivadas` |
| `DELETE` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/batch` | `Borrar Páginas en Lote` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/refs` | `Listar Refs de Páginas` |
| `DELETE` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}` | `Borrar Página` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}` | `Obtener Página` |
| `PUT` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}` | `Actualizar Página` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}/archive` | `Archivar Página` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}/backlinks` | `Obtener Retroenlaces` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}/rename` | `Renombrar Página` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}/unarchive` | `Desarchivar Página` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pipeline-runs/{runId}` | `Obtener Corrida de Pipeline` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pipelines` | `Listar Pipelines` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/pipelines` | `Guardar Pipeline` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/pipelines/validate` | `Validar Pipeline` |
| `DELETE` | `/api/v1/wiki/knowledge-bases/{kbId}/pipelines/{id}` | `Borrar Pipeline` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/pipelines/{id}/runs` | `Listar Corridas de Pipeline` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/process` | `Procesar KB` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/processing-status` | `Obtener Estado de Procesamiento` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/progress` | `Suscribirse a Progreso` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/raw` | `Listar Raw` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/raw/text` | `Agregar Raw de Texto` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/raw/upload` | `Subir Raw` |
| `DELETE` | `/api/v1/wiki/knowledge-bases/{kbId}/raw/{rawId}` | `Borrar Raw` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/raw/{rawId}/cancel` | `Cancelar Raw` |
| `GET` | `/api/v1/wiki/knowledge-bases/{kbId}/raw/{rawId}/download` | `Descargar Raw` |
| `POST` | `/api/v1/wiki/knowledge-bases/{kbId}/raw/{rawId}/reprocess` | `Reprocesar Raw` |
| `GET` | `/api/v1/wiki/pages/lookup` | `Buscar Páginas` |
| `GET` | `/api/v1/wiki/raw/{rawId}/pages` | `Páginas Por Raw Id` |
| `POST` | `/api/v1/wiki/research/start` | `Iniciar Research` |
| `GET` | `/api/v1/wiki/research/stream/{sessionId}` | `Stream` |
| `GET` | `/api/v1/wiki/transformations` | `Listar transformaciones disponibles para una KB` |
| `POST` | `/api/v1/wiki/transformations` | `Crear` |
| `GET` | `/api/v1/wiki/transformations/runs` | `Listar Corridas` |
| `DELETE` | `/api/v1/wiki/transformations/runs/{runId}` | `Borrar Corrida` |
| `GET` | `/api/v1/wiki/transformations/runs/{runId}` | `Obtener Corrida` |
| `POST` | `/api/v1/wiki/transformations/runs/{runId}/cancel` | `Cancelar una corrida de transformación aún en ejecución` |
| `POST` | `/api/v1/wiki/transformations/runs/{runId}/save-as-page` | `Guardar la salida de una corrida completada como página wiki de síntesis` |
| `DELETE` | `/api/v1/wiki/transformations/{id}` | `Borrar` |
| `GET` | `/api/v1/wiki/transformations/{id}` | `Obtener` |
| `PUT` | `/api/v1/wiki/transformations/{id}` | `Actualizar` |
| `POST` | `/api/v1/wiki/transformations/{id}/aggregate` | `Agregar todas las corridas completadas de una plantilla en una página de síntesis a nivel de KB` |
| `POST` | `/api/v1/wiki/transformations/{id}/apply` | `Correr una transformación contra un material crudo o página wiki` |

### Memoria

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/memory/{agentId}/dream/events` | `Suscribirse a eventos de sueño (SSE)` |
| `GET` | `/api/v1/memory/{agentId}/dream/morning-card` | `Obtener tarjeta matutina para usuario + agente actual` |
| `POST` | `/api/v1/memory/{agentId}/dream/morning-card/seen` | `Marcar tarjeta matutina como vista` |
| `GET` | `/api/v1/memory/{agentId}/dream/reports` | `Listar reportes de sueño (paginados, más nuevos primero)` |
| `GET` | `/api/v1/memory/{agentId}/dream/reports/{reportId}` | `Obtener un reporte de sueño por ID` |
| `POST` | `/api/v1/memory/{agentId}/dream/reports/{reportId}/entries/{key}/confirm` | `Confirmar una entrada de memoria (acknowledgment no-op)` |
| `POST` | `/api/v1/memory/{agentId}/dream/reports/{reportId}/entries/{key}/edit` | `Editar una entrada de memoria — escribe de vuelta al archivo de memoria destino con metadatos editados por el usuario` |
| `GET` | `/api/v1/memory/{agentId}/dreaming/candidates` | `Obtener Candidatos de Dreaming` |
| `GET` | `/api/v1/memory/{agentId}/dreaming/dreams` | `Obtener Sueños` |
| `POST` | `/api/v1/memory/{agentId}/dreaming/focused` | `Disparar Sueño Enfocado` |
| `GET` | `/api/v1/memory/{agentId}/dreaming/status` | `Obtener Estado de Dreaming` |
| `POST` | `/api/v1/memory/{agentId}/emergence` | `Disparar Emergencia` |
| `GET` | `/api/v1/memory/{agentId}/facts` | `Listar hechos de un agente` |
| `GET` | `/api/v1/memory/{agentId}/facts/contradictions` | `Listar contradicciones sin resolver` |
| `POST` | `/api/v1/memory/{agentId}/facts/contradictions/{contradictionId}/resolve` | `Resolver una contradicción (KEEP_A / KEEP_B / MERGE / IGNORE)` |
| `POST` | `/api/v1/memory/{agentId}/facts/{factId}/feedback` | `Enviar feedback sobre un hecho (HELPFUL/UNHELPFUL)` |
| `POST` | `/api/v1/memory/{agentId}/facts/{factId}/forget` | `Olvidar un hecho — escribe metadatos canónicos, reconstruye la proyección` |
| `POST` | `/api/v1/memory/{agentId}/summarize/{conversationId}` | `Disparar Resumen` |

### Objetivos

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/goals` | `Listar objetivos (opcionalmente filtrados por estado)` |
| `POST` | `/api/v1/goals` | `Crear un objetivo persistente para una conversación` |
| `GET` | `/api/v1/goals/by-conversation/{conversationId}` | `Obtener el objetivo activo ligado a una conversación (o null)` |
| `GET` | `/api/v1/goals/{id}` | `Obtener detalle de objetivo por id` |
| `PATCH` | `/api/v1/goals/{id}` | `Actualización dispersa de un objetivo no terminal` |
| `POST` | `/api/v1/goals/{id}/abandon` | `Abandonar un objetivo (terminal)` |
| `POST` | `/api/v1/goals/{id}/criteria` | `Anexar un sub-criterio a un objetivo activo` |
| `GET` | `/api/v1/goals/{id}/events` | `Obtener la línea de tiempo de eventos de un objetivo` |
| `POST` | `/api/v1/goals/{id}/pause` | `Pausar un objetivo activo` |
| `POST` | `/api/v1/goals/{id}/resume` | `Reanudar un objetivo pausado` |

### Cron Jobs

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/cron-jobs` | `Listar` |
| `POST` | `/api/v1/cron-jobs` | `Crear` |
| `GET` | `/api/v1/cron-jobs/active-runs` | `Corridas Activas` |
| `DELETE` | `/api/v1/cron-jobs/{id}` | `Borrar` |
| `GET` | `/api/v1/cron-jobs/{id}` | `Obtener` |
| `PUT` | `/api/v1/cron-jobs/{id}` | `Actualizar` |
| `POST` | `/api/v1/cron-jobs/{id}/run` | `Correr Ahora` |
| `PUT` | `/api/v1/cron-jobs/{id}/toggle` | `Alternar` |

### Triggers

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/triggers` | `Listar triggers en el workspace del llamador.` |
| `POST` | `/api/v1/triggers` | `Crear un trigger; si está habilitado, lo registra con el scheduler.` |
| `POST` | `/api/v1/triggers/events` | `Ingerir un sobre de evento; devuelve resumen de disparos / descartes por trigger.` |
| `DELETE` | `/api/v1/triggers/{id}` | `Borrar un trigger y des-registrar su horario.` |
| `GET` | `/api/v1/triggers/{id}` | `Obtener un trigger por id, acotado al workspace del llamador.` |
| `PUT` | `/api/v1/triggers/{id}` | `Actualizar un trigger; pattern_version se incrementa cuando cambia la expresión cron.` |

### Workflows

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/workflows` | `Listar workflows en el workspace` |
| `POST` | `/api/v1/workflows` | `Crear una fila de workflow (el borrador empieza vacío).` |
| `POST` | `/api/v1/workflows/draft/generate` | `Generar un borrador de workflow desde una descripción en lenguaje natural.` |
| `POST` | `/api/v1/workflows/draft/preview-compile` | `Compilar JSON de borrador arbitrario sin persistir — usado por el selector de plantillas / vista previa del generador para mostrar diagnósticos reales de ACL + esquema antes de que exista una fila de workflow.` |
| `GET` | `/api/v1/workflows/draft/templates` | `Listar las plantillas de workflow canónicas que el generador puede aplicar directamente.` |
| `GET` | `/api/v1/workflows/runs/paused` | `Listar corridas pausadas del workspace para que los operadores puedan reanudarlas.` |
| `GET` | `/api/v1/workflows/runs/{runId}` | `Inspeccionar una sola corrida con sus filas de paso para replay / depuración.` |
| `POST` | `/api/v1/workflows/runs/{runId}/resume` | `Reanudar una corrida de workflow pausada con el resultado dado.` |
| `DELETE` | `/api/v1/workflows/{id}` | `Borrado suave de una fila de workflow.` |
| `GET` | `/api/v1/workflows/{id}` | `Obtener un workflow por id (incluye borrador en línea + último grafo publicado).` |
| `PUT` | `/api/v1/workflows/{id}` | `Actualizar metadatos de workflow (nombre / descripción / habilitado).` |
| `POST` | `/api/v1/workflows/{id}/compile` | `Compilar el borrador y mostrar diagnósticos sin persistir una revisión.` |
| `PUT` | `/api/v1/workflows/{id}/draft` | `Guardar el graph_json del borrador en línea sin compilar.` |
| `POST` | `/api/v1/workflows/{id}/publish` | `Compilar el borrador y persistir una revisión nueva apuntada por latest_revision_id.` |
| `GET` | `/api/v1/workflows/{id}/runs` | `Listar las corridas más recientes de un workflow.` |

### Canales

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/channels` | `Listar` |
| `POST` | `/api/v1/channels` | `Crear` |
| `GET` | `/api/v1/channels/health` | `Salud de Todos` |
| `POST` | `/api/v1/channels/preflight` | `Pre-vuelo: validar config de canal de borrador sin persistir` |
| `POST` | `/api/v1/channels/qrcode/{channelType}/begin` | `Iniciar` |
| `GET` | `/api/v1/channels/qrcode/{channelType}/status` | `Estado` |
| `GET` | `/api/v1/channels/status` | `Estado` |
| `GET` | `/api/v1/channels/type/{channelType}` | `Listar Por Tipo` |
| `GET` | `/api/v1/channels/webchat/config` | `Obtener Config` |
| `POST` | `/api/v1/channels/webchat/stream` | `Chat Stream` |
| `POST` | `/api/v1/channels/webhook/dingtalk` | `Webhook de Dingtalk` |
| `POST` | `/api/v1/channels/webhook/dingtalk/register/begin` | `Iniciar Registro de Dingtalk` |
| `GET` | `/api/v1/channels/webhook/dingtalk/register/status` | `Estado de Registro de Dingtalk` |
| `POST` | `/api/v1/channels/webhook/discord` | `Webhook de Discord` |
| `POST` | `/api/v1/channels/webhook/feishu` | `Webhook de Feishu` |
| `POST` | `/api/v1/channels/webhook/feishu/register/begin` | `Iniciar Registro de Feishu` |
| `GET` | `/api/v1/channels/webhook/feishu/register/status` | `Estado de Registro de Feishu` |
| `POST` | `/api/v1/channels/webhook/slack` | `Webhook de Slack` |
| `GET` | `/api/v1/channels/webhook/status` | `Estado` |
| `POST` | `/api/v1/channels/webhook/telegram` | `Webhook de Telegram` |
| `POST` | `/api/v1/channels/webhook/wecom` | `Webhook de Wecom` |
| `GET` | `/api/v1/channels/webhook/weixin/qrcode` | `Qrcode de Weixin` |
| `GET` | `/api/v1/channels/webhook/weixin/qrcode/status` | `Estado del Qrcode de Weixin` |
| `DELETE` | `/api/v1/channels/{id}` | `Borrar` |
| `GET` | `/api/v1/channels/{id}` | `Obtener` |
| `PUT` | `/api/v1/channels/{id}` | `Actualizar` |
| `GET` | `/api/v1/channels/{id}/health` | `Salud` |
| `PUT` | `/api/v1/channels/{id}/toggle` | `Alternar` |

### Fuentes de Datos

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/datasources` | `Listar` |
| `POST` | `/api/v1/datasources` | `Crear` |
| `DELETE` | `/api/v1/datasources/{id}` | `Borrar` |
| `GET` | `/api/v1/datasources/{id}` | `Obtener` |
| `PUT` | `/api/v1/datasources/{id}` | `Actualizar` |
| `POST` | `/api/v1/datasources/{id}/test` | `Probar Conexión` |
| `PUT` | `/api/v1/datasources/{id}/toggle` | `Alternar` |

### Voz a Texto

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/stt/transcribe` | `Transcribir` |

### Texto a Voz

| Método | Ruta | Propósito / handler |
|---|---|---|
| `POST` | `/api/v1/tts/synthesize` | `Sintetizar` |
| `GET` | `/api/v1/tts/voices` | `Listar Voces` |

### Archivos Generados

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/files/generated/{id}` | `Descargar un archivo generado por herramienta por su id de un solo uso` |

### Planes

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/plans` | `Listar Por Agente` |
| `GET` | `/api/v1/plans/{id}` | `Obtener Plan` |

### Feature Flags

| Método | Ruta | Propósito / handler |
|---|---|---|
| `GET` | `/api/v1/feature-flags` | `Listar` |
| `PUT` | `/api/v1/feature-flags/{flagKey}` | `Actualizar` |
