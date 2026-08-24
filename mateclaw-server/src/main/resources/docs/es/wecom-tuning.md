# Ajuste Profundo de WeCom

**Un bot que realmente funciona para un grupo de 50 empleados internos necesita mucho más que "simplemente conectar".**

La sección [Canales → WeCom](./channels#wecom) cubre el cableado del canal; este documento cubre lo que AuraClaw hace **después** de que el canal está arriba — cada optimización no obvia, cada rincón de plataforma que el adaptador maneja, y por qué.

Audiencia:

- Operadores que ya tienen el canal WeCom corriendo y quieren entender "por qué la experiencia de grupo es así"
- Desarrolladores planeando features nuevas que necesitan las restricciones de plataforma primero
- Tech leads evaluando el bot para un equipo de negocio real

---

## La plataforma en una frase

**WeCom AI Bot es una plataforma de "parece-un-SDK-de-chat, en-realidad-es-un-callback-de-eventos".**

Te da tres primitivas:

1. **Recibir eventos** — WebSocket long-poll o webhook entrega las @menciones de los usuarios
2. **Responder** (dentro de la misma conversación) — `aibot_respond_msg` "adjunta" tu respuesta a un frame entrante específico
3. **Empujar proactivamente** (no en respuesta a nada) — `aibot_send_msg`, pero **solo chats individuales**

**La regla oculta que más importa**: las primitivas #2 y #3 se comportan distinto en grupos vs. chats individuales. Toda optimización de abajo está andamiada alrededor de esa matriz.

---

## Colaboración multi-usuario en grupos

### Comportamiento por defecto de la plataforma

Cuando los usuarios A, B, C todos @mencionan al bot en un grupo, la plataforma entrega cada uno como un frame separado, pero todos clavados al **mismo chatId**.

Si particionas ingenuamente las conversaciones por chatId (el enfoque obvio), obtienes:

- El historial persistido es solo `user: ...` sin prefijo de remitente — el modelo ve un muro sin atribución al leer turnos anteriores
- La ventana de debounce (500ms / 2.5s adaptativa) fusiona los mensajes rápidos de A y B en uno
- A pregunta "quiero X", B sigue con "quiero Y", y el modelo piensa "el usuario pidió dos cosas no relacionadas"

### El arreglo de AuraClaw

**Dos capas**:

**1. Debounce con límite de remitente.** Cuando dos mensajes aterrizan en la misma conversación espalda con espalda, revisa senderId primero:

- Mismo remitente → fusionar (caso típico: fragmentos de pegado partidos)
- Remitente distinto → descargar el pendiente existente de inmediato, empezar una ventana nueva para el remitente nuevo

La decisión vive en [`ChannelMessageRouter.isSameSender`](https://github.com/anthropics/mateclaw/blob/main/mateclaw-server/src/main/java/vip/mate/channel/ChannelMessageRouter.java). Defensivo ante nulos: si falta cualquiera de los senderId, se niega a fusionar — mejor descargar dos veces que mal-atribuir un fragmento.

**2. Prefijo `[@remitente]` en el contenido persistido + prompt.** Todo mensaje de grupo (`chatId != null`) se envuelve antes de guardar y antes de la llamada al LLM:

```
[@XuZhanFu] @AuraClawBot Quiero consultar X
[@xuzf] @AuraClawBot Quiero consultar Y
```

Así:

- El 30º mensaje histórico todavía le dice al modelo quién lo dijo
- La línea de tiempo persistida se lee como `[@A] ...; [@B] ...; [@A] ...`, el modelo puede desambiguar seguimientos, citas-respuestas, correcciones mutuas
- Los chats individuales (`chatId == null`) tienen cero overhead, comportamiento sin cambios

`senderName` tiene prioridad sobre `senderId` (visualización más amigable); ambos null → devolver null (sin etiqueta basura `[@null]`).

### Qué verás en los logs

```
[wecom] Sender boundary in conversation wecom:{chatId}: flushing pending from sender=A, accepting new sender=B
```

En la BD, `mate_message.content` literalmente tiene el prefijo `[@xxx]`.

---

## Matriz de restricciones de subida

WeCom impone **límites duros de tamaño** en el paso de finalización de chunk (después de subir todos los bytes). UX sin pre-chequeo: "subió durante tres minutos, nada salió del otro lado".

### Límites

| Tipo | Tamaño máx | Requisito de formato |
|------|---------|---------|
| Archivo | **20 MB** | cualquiera |
| Imagen | **10 MB** | cualquier formato común |
| Video | **10 MB** | cualquier formato común |
| Voz | **2 MB** | **debe ser AMR** (otros formatos rechazados por la plataforma) |
| Global | **20 MB** | techo absoluto |

### Manejo de AuraClaw

**Pre-chequeo del lado del cliente** para evitar subidas inútiles. `applyWeComUploadLimits(fileSize, mediaType, contentType)` devuelve:

- Archivo > 20 MB → rechazar, decir al usuario "excede el límite de 20MB"
- Imagen > 10 MB → degradar a subida de archivo (sigue visible como adjunto, solo sin miniatura)
- Video > 10 MB → degradar a subida de archivo
- Voz > 2 MB **o** mime ≠ `audio/amr` → degradar a subida de archivo
- Cualquier cosa > 20 MB → rechazar (techo absoluto, sin excepción)

La degradación lleva una nota amigable ("imagen > 10MB, enviada como adjunto de archivo"), así el usuario sabe qué acaba de pasar.

### Recuperación de nombre de archivo por bytes mágicos

Los archivos reenviados por WeCom a menudo llegan **sin campo de nombre de archivo**. Guardarlos como `file.bin` rompe toda herramienta downstream que despacha por extensión (lectores de PDF, parsers de DOCX, etc).

Arreglo: olfateo de bytes mágicos:

- `%PDF` → `.pdf`
- `PK\x03\x04` es un contenedor ZIP; asoma dentro de las primeras entradas para distinguir `.docx` / `.xlsx` / `.pptx` / `.odt` / `.epub` / `.jar`
- Otros formatos comunes (PNG / JPEG / MP4 / MP3 / WAV) todos reconocidos
- Verdaderamente desconocido → mantener `.bin`, no fingir que es otra cosa

Implementado en `MediaTypeSniffer.sniff()` + `MediaTypeSniffer.refineZipKind()`, llamado desde `InboundMediaDownloader.download()`.

---

## Mensajes citados

Los usuarios citando un mensaje previo (imagen, archivo, texto, voz, miniprograma) y luego haciendo una pregunta nueva es **el patrón de interacción de grupo más común**.

### Tipos de cita soportados

| Tipo de cita | Qué ve el bot | Procesamiento posterior |
|----------|------------|------------------|
| Texto | `[Quote: texto previo]\npregunta nueva del usuario` | ✅ texto pasado al modelo |
| Voz | `[Quote: [voice] transcripción ASR]\npregunta nueva del usuario` | ✅ resultado ASR como contexto |
| Imagen | `[Quote: [image]]\npregunta nueva del usuario` + parte de imagen adjunta | ✅ el sidecar de visión la lee |
| Archivo | `[Quote: [file: report.pdf]]\npregunta nueva del usuario` + parte de archivo adjunta | ✅ la herramienta de archivos puede leer |
| Mixto | Cada sub-tipo expandido por las reglas de arriba | ✅ |

### Notas de implementación

- **Los medios también se descargan**: una imagen/archivo citado no es solo una cadena marcadora — realmente se descarga, se descifra con AES-256-CBC, se persiste a `data/chat-uploads/{conversationId}/...` y se adjunta como MessageContentPart para el agente
- **Alineación de rutas**: el conversationId usado para medios debe coincidir con el conversationId en `mate_conversation`, si no `/api/v1/chat/files/{convId}/{name}` da 403 en `isConversationOwner` y el `<img>` del frontend muestra icono roto

Bug histórico: una versión temprana de `inboundConversationId()` agregaba un infijo `wecom:group:` para grupos, pero el router persistía como `wecom:{chatId}` sin el infijo — toda imagen citada en grupo estaba rota hasta que ambos lados se alinearon. Arreglado.

---

## Tipos de mensaje appmsg

`msgtype=appmsg` es el punto de extensión de WeCom para tarjetas de medios ricos. Cuatro subtipos comunes:

| Variante | Qué es | Manejo del bot |
|------|-----------|--------------|
| `appmsg.file` | Archivo reenviado (PDF / Word / Excel) | Pipeline de descarga completo, equivalente a `msgtype=file` |
| `appmsg.image` | Tarjeta de imagen | Pipeline de descarga completo, equivalente a `msgtype=image` |
| `appmsg.url` | **Artículo de cuenta pública / enlace externo** | Ver siguiente sección |
| `appmsg.miniprogram` | Mini-programa | Título mostrado al modelo; el payload no es recuperable |

Los subtipos desconocidos caen a `[appmsg: título]` para que el modelo al menos sepa "el usuario compartió algún tipo de medio rico".

### Artículos de cuenta pública

Los artículos de mp.weixin.qq.com se sirven como **SSR con compuerta de captcha** — ninguna herramienta de LLM puede traer el cuerpo. Si el bot finge que puede leerlo, el modelo **inventa contenido desde el título** (observado en producción: "el artículo hace tres puntos..." — alucinación pura).

Cuando AuraClaw detecta `mp.weixin.qq.com` en la rama de enlace, anexa una directiva al modelo:

> (Pista: este enlace es un artículo de cuenta pública. El cuerpo necesita abrirse en WeChat y pegarlo el usuario. Por favor pide al usuario que pegue el texto del artículo en lugar de adivinar desde el título.)

Efecto: el modelo deja de fabricar y pide al usuario pegar el cuerpo. Otras URLs normales (github, wikipedia, enlaces externos genéricos) **no** disparan la pista, ya que sus cuerpos son traíbles por herramientas ordinarias.

---

## Empuje proactivo en grupos (aibot_send_msg vs aibot_respond_msg)

### Reglas de la plataforma

```
Chat individual:  aibot_send_msg ✓     aibot_respond_msg ✓
Grupo:            aibot_send_msg ✗     aibot_respond_msg ✓ (debe ligarse al reqId de un frame previo)
```

En grupos, cualquier mensaje proactivo del bot (resúmenes de cron, completitudes de tareas asíncronas, resultados de generación de imágenes) debe **hacer piggyback** sobre el frameReqId de un inbound previo del usuario. Si no, la plataforma lo rechaza.

### Manejo de AuraClaw

**Caché LRU de reqIds entrantes recientes**. `lastChatReqIds: ConcurrentHashMap<chatId, latest-reqId>` se actualiza en todo inbound de grupo, limitada a 1000 chats.

**Salida unificada `sendOutboundFrame(chatId, body)`**:

- Cache hit → `aibot_respond_msg` + reqId cacheado
- Cache miss → cae a `aibot_send_msg` (chat individual o chat nuevo)

Así:

- Resúmenes de cron → el grupo tiene actividad previa → respond funciona; nunca la hubo → degrada a send_msg, igual falla pero no falla en bloque
- Tareas asíncronas (generación de imagen / música / video) completando → `AsyncTaskMediaDispatcher` llama la salida unificada
- Respuesta del LLM multi-chunk → mismo reqId reutilizado

### Qué verás en los logs

```
[wecom] Group send via aibot_respond_msg: chatId=..., reqId=...
```

---

## Reenvío de tareas asíncronas

La generación de imágenes (`image_generate`) / música (`music_generate`) / video (`video_generate`) / modelos 3D (`model3d_generate`) son todas **tareas asíncronas** — el agente devuelve un id de tarea inmediatamente; el artefacto real llega 30 segundos a varios minutos después.

Bug anterior: los artefactos solo aparecían en la vista de historial de la consola Web, **invisibles en el grupo de WeCom**.

Arreglo: `AsyncTaskMediaDispatcher.forwardToImIfBound(conversationId, parts)`:

- Tras la completitud de la tarea, busca el canal ligado de la conversación vía `ChannelSessionStore`
- Salta `web` / `webchat` (SSE ya los cubre)
- Llama el `sendContentParts(targetId, parts)` del adaptador de canal
- WeCom: imagen / audio / video / archivo todos soportados como adjuntos nativos
- Slack: vía `filesUploadV2` (ver [canal Slack](./channels#slack))
- Canales sin `sendContentParts` (QQ, etc.): atrapa UnsupportedOperationException + log; un canal no soportado no bloquea el resto

Los archivos viven en `data/chat-uploads/{conversationId}/` por defecto, pero cuando el Agente / Workspace de la conversación tiene un `basePath` configurado, los adjuntos aterrizan bajo `{basePath}/chat-uploads/{conversationId}/` (precedencia: `workspaceBasePath` del Agente → `basePath` del Workspace → directorio por defecto `mateclaw.chat.upload.base-dir`). Dentro del directorio de conversación, los archivos nuevos se agrupan además en sub-directorios por día por defecto (`{conversationId}/yyyy-MM-dd/{storedName}`, controlado por `mateclaw.chat.upload.date-folders`; deshabilítalo para mantener el layout plano). Las lecturas y la limpieza sondean tanto las ubicaciones nuevas como las legacy y ambos layouts (plano + sub-directorios por fecha), así los adjuntos pre-migración siguen accesibles. Servidos en `/api/v1/chat/files/{conversationId}/{storedName}` — la URL se mantiene plana sin segmento de fecha; el frontend y las vistas de adjuntos de canal leen todos por esta URL.

---

## La burbuja de progreso: las tareas largas ya no parecen congeladas (2.0.0+)

Antes de 2.0.0, WeCom respondía con una burbuja estática de "🤔 Pensando..." que **nunca cambiaba** hasta la respuesta final — una tarea de 30 segundos a 3 minutos se leía rutinariamente como un cuelgue. La burbuja placeholder ahora es **dirigida por eventos**:

- **Traza de herramientas en vivo**: la burbuja rueda con la corrida del agente — estado de pensamiento, la herramienta que se está llamando, llamadas completadas con tiempo transcurrido, anexadas línea por línea;
- **Rodaje por etapa**: cada etapa nueva (una ronda de razonamiento nueva, una llamada a herramienta nueva) refresca la burbuja en sitio con la narración de la etapa actual — puedes ver exactamente cuánto ha avanzado la tarea;
- **Se transforma en la respuesta**: cuando llega el primer chunk de contenido real, el keepalive se cancela y el **mismo slot de stream se reutiliza** — la burbuja de progreso se vuelve la respuesta en sitio, sin dejar burbuja huérfana;
- **Throttling de sobrescrituras**: los refrescos llevan un intervalo mínimo más una guarda de saltar-si-hay-flush-pendiente, así los rate limits de WeCom nunca se disparan.

Si el contenido de pensamiento y la traza de herramientas se muestran sigue gobernado por los interruptores de "filtrado de mensajes" del canal — y desde 2.0.0 esos interruptores genuinamente controlan "deberían enviarse los mensajes de proceso", no meramente quitar etiquetas inline de la respuesta final.

Junto a ello, **la gestión de respuestas en streaming está endurecida**: los ciclos de vida de los slots de stream se gestionan centralmente — keepalive, finalización forzada e invalidación de contexto cada uno en su lugar — así las patologías de "la respuesta aterrizó pero la burbuja sigue girando" y "un slot colgando bloquea el siguiente mensaje" desaparecen. Los archivos generados (imágenes, documentos) también se entregan realmente a través del canal de WeChat en lugar de quedar como un enlace solo-local.

---

## Comportamiento del modelo: falsificando llamadas a herramientas

Observación: **qwen3.6-plus** a veces "se relaja" en escenarios de contexto largo y muchas llamadas a herramientas — produce un bloque de código Markdown que **imita** una llamada a herramienta, pero `toolCallCount=0`:

````
🎵 ¡Tarea de generación de 《Título》 enviada!
⏳ ETA 1-2 minutos, el audio se empujará cuando esté listo...

```json
{ "prompt": "...", "lyrics": "..." }
```
````

El backend nunca ve un tool_call → la generación de música nunca arranca → el usuario nunca recibe la canción.

**Mitigación actual**: cambia a un modelo que ejecute tool_calls confiablemente (kimi-for-coding, claude-sonnet-4.5, deepseek-r1). Cambia el modelo por defecto del agente en [Modelos](./models).

Posible futuro: detección del lado del servidor de patrones "tarea enviada + toolCallCount=0", con un mensaje de sistema correctivo y reintento.

---

## Comportamiento del modelo: bucles de auto-discusión

Otro fallo esporádico: el modelo se queda atascado en un bucle de "salida-de-pensamiento", repitiendo la misma respuesta en chino decenas de veces hasta que max_tokens (16384) se agota. Patrón observado en producción:

```
"Espera, debería X." → escribe respuesta en chino → "Hecho." → escribe la misma respuesta → "Espera, Y." → igual otra vez → ...
```

Los usuarios miran "generando..." durante decenas de segundos a minutos, y finalmente reciben un muro de duplicados.

### Manejo de AuraClaw

**Guarda de dos capas**:

1. **Detección**: [`hasRepeatingSuffix`](https://github.com/anthropics/mateclaw/blob/main/mateclaw-server/src/main/java/vip/mate/agent/graph/NodeStreamingChatHelper.java) chequea si el buffer termina con la misma unidad de 24-240 caracteres repetida 4+ veces consecutivamente → descarta inmediatamente la suscripción upstream
2. **Dedup + flag**: `dedupTrailingRepeats` colapsa N copias finales a 1; ReasoningNode pone finishReason en `INCOMPLETE`; el frontend renderiza un banner de truncamiento con botón de "regenerar"

Por qué no solo emitir una advertencia: el usuario ya vio los duplicados en el stream SSE (push de una vía, no se puede des-enviar), pero el **finalAnswer persistido en BD** y el **outbound de WeCom** ambos usan `finalAnswer` — así el grupo IM solo ve una copia limpia de la respuesta + un banner INCOMPLETE.

El umbral es **deliberadamente estrecho** (4 copias consecutivas textuales) para evitar falsos positivos en salidas legítimas de tres etapas "TL;DR / cuerpo / TL;DR".

---

## Resiliencia de red

### Reintento transitorio TLS / socket

DashScope / OpenAI / varios gateways de LLM ocasionalmente producen en el internet público:

- `bad_record_mac` (TLS RFC 5246 §7.2.2 alerta fatal 20)
- `SSLHandshakeException`
- `SocketException: Connection reset by peer`
- `Premature close` / `Broken pipe`

Antes estos aparecían como texto rojo de `LLM call failed` sin reintento.

Arreglo: clasificar todos estos como `SERVER_ERROR`, enrutar por el reintento de backoff exponencial existente: 3s → 6s → 12s (con jitter) hasta 5 intentos. Ver [Motor de agentes](./agents).

### Keepalive

Las respuestas de grupo vía `aibot_respond_msg` tienen un **TTL de 60 segundos** por stream — sin datos nuevos en 60s y la plataforma suelta el slot, la eventual respuesta real se rechaza silenciosamente.

Los agentes manejando tareas complejas (multi-herramienta + razonamiento LLM) a menudo exceden 60s. `WeComKeepaliveScheduler` envía un heartbeat noop de "procesando..." cada 30 segundos; el slot nunca expira. Un tope duro de 180 segundos fuerza el fin del stream para que una tarea genuinamente atascada no siga con el keepalive tictacando para siempre.

### Reconexión con backoff exponencial

Cuando la conexión larga de WeCom se cae (timeout de NAT, blip de red), el adaptador reconecta: 2s → 4s → 8s → 16s → tope 30s. **Nunca se rinde** — mientras el proceso esté vivo, reanudará la recepción de mensajes cuando la red lo haga.

La vista de salud del panel de control muestra el conteo de reconexiones actual, ops puede leerlo directamente.

---

## Restricciones a nivel de plataforma (no bugs, solo límites)

Estas son restricciones de la **plataforma WeCom**, no se pueden workaroundear en código, solo en configuración:

### Bloqueo de permiso de datos

Un bot en modo API marcando **cualquier permiso de datos** en el admin de WeCom (p. ej. "leer mensajes", "obtener info de grupo") **auto-restringe el bot a solo el creador**. Los mensajes de otros miembros se ignoran.

**Arreglo**: en el panel de admin, **desmarca** los 7 permisos de datos. El bot queda disponible para todos los miembros autorizados. AuraClaw usa webhooks para mensajes, no necesita permisos de datos.

### Matriz de visibilidad × permiso de datos

| Visibilidad | Permiso de datos | Efectivo |
|---------|---------|---------|
| Todo el personal | Todos marcados | **Solo creador** (el bloqueo de datos sobrescribe la visibilidad) |
| Todo el personal | Todos desmarcados | Todo el personal (recomendado) |
| Depto específico | Todos desmarcados | Miembros de esos deptos |
| Personas específicas | Todos desmarcados | Usuarios listados |

### El grupo requiere @bot

El bot en un grupo de WeCom debe ser @mencionado para recibir un mensaje. Los mensajes directos (1:1) no necesitan @. Comportamiento de plataforma, sin workaround. AuraClaw no escucha en broadcast todos los mensajes del grupo (y no podría aunque lo intentara).

---

## Consejos de depuración

### Verificar atribución de grupo

```sql
SELECT content FROM mate_message
WHERE conversation_id = 'wecom:{chatId}' AND role = 'user'
ORDER BY id DESC LIMIT 5;
```

Espera: todo mensaje de usuario empieza con `[@username]`.

### Verificar la ruta de medios

```bash
ls data/chat-uploads/wecom:{chatId}/
```

**No debería** haber directorios `wecom:group:{chatId}` con el infijo `group:` (residuo del bug temprano, limpia manualmente).

### Verificar enrutamiento de empuje en grupo

En los logs del servidor:

```
[wecom] Group send via aibot_respond_msg: chatId=..., reqId=...
```

Si el grupo no ve la respuesta del bot pero los logs muestran esta línea con un reqId no nulo, el mensaje llegó a la plataforma pero fue rechazado (normalmente: reqId ya consumido, o el bot fue expulsado del grupo).

### Verificar keepalive

```bash
grep "wecom-keepalive" logs/mateclaw.log | tail
```

Espera "Heartbeat sent" + "Heartbeat ACK received" periódicos, con ocasionales finales duros "force-finished stream".

---

## Casos borde conocidos

| Escenario | Comportamiento actual | Futuro posible |
|------|---------|---------|
| El primer mensaje de grupo es un push de cron (sin actividad de chat previa) | Caché vacía, cae a `aibot_send_msg`, la plataforma rechaza | Caché ring-buffer multi-reqId (ganancia limitada, no implementando) |
| El modelo "se relaja" en sesiones largas | El usuario reintenta / cambia de modelo | Detección del lado del servidor + inyección correctiva |
| 3 remitentes distintos concurrentes en el mismo grupo | Procesamiento serial, cada usuario obtiene su propia ventana (funciona) | — |
| El usuario se niega a pegar el cuerpo de cuenta pública | El bot guía cortésmente | — |
| Clasificación errónea de bytes mágicos OOXML (muy raro) | Cae a `.zip` | El asomo de entradas ZIP cubre el 90% |

---

## De un vistazo

```
                 ┌─────────────────────┐
                 │  Usuario de grupo   │
                 │  WeCom              │
                 └──────────┬──────────┘
                            │ inbound (con chatId)
                            ▼
      ┌────────────────────────────────────────┐
      │  WeComChannelAdapter                    │
      │  ├─ pre-chequeo de subida de chunks (4 categorías)│
      │  ├─ olfateo de bytes mágicos (asomo OOXML)       │
      │  ├─ descifrado AES + chat-uploads/{convId}/ │
      │  ├─ parseo de citas (5 sub-tipos)         │
      │  ├─ parseo de appmsg (4 sub-tipos + pista) │
      │  └─ caché lastChatReqIds[chatId]        │
      └──────────────┬─────────────────────────┘
                     │ ChannelMessage(content="[@xxx] ...")
                     ▼
      ┌────────────────────────────────────────┐
      │  ChannelMessageRouter                   │
      │  ├─ debounce adaptativo (500ms / 2.5s)  │
      │  ├─ corte de límite de remitente (crítico en grupos) │
      │  ├─ applyGroupTag → BD + LLM            │
      │  └─ cola + sessionLock serializa        │
      └──────────────┬─────────────────────────┘
                     │
                     ▼
                ┌──────────┐
                │  Agente  │  ← StateGraph + ReAct
                └─────┬────┘
                     │ finalAnswer / tool_calls
                     ▼
      ┌────────────────────────────────────────┐
      │  sendOutboundFrame(chatId, body)        │
      │  ├─ cache hit → aibot_respond_msg       │
      │  ├─ cache miss → aibot_send_msg         │
      │  ├─ keepalive (extiende TTL de 60s)     │
      │  └─ backoff de reconexión (auto-cura NAT/blip)│
      └────────────────────────────────────────┘
```

---

## Lectura relacionada

- [Canales](./channels) — panorama de los 9 canales + configuración
- [Motor de agentes](./agents) — reintento TLS, clasificación de errores, detección de auto-bucles
- [Modelos](./models) — cambiar el modelo por defecto, cadena de failover
- [Seguridad y aprobación](./security) — flujo de aprobación para herramientas de alto riesgo en grupos
- [Doctor](./doctor) — comandos de diagnóstico para resolver problemas de canal
