# Canales

**El mismo cerebro, la misma memoria, en todos lados donde trabaja tu equipo.**

Un canal en AuraClaw es una puerta distinta hacia el mismo agente. ¿Tu equipo chatea en Feishu? Pon un agente en Feishu. ¿Alguien prefiere Telegram? Mismo agente, misma memoria, en Telegram. Consola web para los operadores, DingTalk para el campo, Slack para ingeniería — un despliegue, nueve puertas.

Cada canal es un adaptador. Debajo del adaptador, el agente no sabe (ni le importa) por qué puerta llegó el mensaje.

::: tip Endurecimiento de la capa de canales 1.3.0
v1.3.0 aterriza una ola de trabajo de estabilidad de largo plazo y colaboración grupal en la capa de canales:

- **Cola de respuestas + compuerta de ciclo de vida** — separa "conexión de canal lista" de "mensajes despachables"; los eventos recibidos durante una ventana de reconexión ya no se descartan
- **Los canales WS / long-polling corren sobre un lease de líder** — en despliegues multi-instancia, solo el poseedor del lease responde; **el mismo mensaje entrante ya no se responde dos veces por nodos distintos**
- **Atribución por remitente en chats grupales + límite de debounce** — dos personas hablando en el mismo grupo ya no mezclan sus mensajes
- **Ventana de debounce adaptativa para mensajes largos partidos por pegado** — un pegado largo roto en cinco mensajes se auto-fusiona de vuelta en uno
- **Tarjetas de aprobación WeCom + keepalive + dedup de chunks** — las tarjetas de tareas largas sobreviven a los timeouts de sesión upstream
- **Los resultados de herramientas asíncronos se reenvían al canal de origen** — el empleado corre una tarea larga, el resultado aterriza en Feishu / DingTalk / WeCom / Slack con los archivos subidos por canal
- **URLs falsas de archivos generados depuradas** — los empleados ya no devuelven enlaces ficticios estilo `https://example.com/file.docx`

El ajuste específico de WeCom vive en [Ajuste profundo de WeCom](./wecom-tuning).
:::

::: tip Endurecimiento de la capa de canales 1.4.0
v1.4.0 hace de Feishu un canal de primera clase — tarjetas interactivas, tarjetas en streaming, tarjetas de aprobación, herramientas nativas, medios de entrada/salida — más ligadura por QR para QQ:

- **Tarjetas interactivas de Feishu (Schema 2.0)** — las respuestas estructuradas se auto-renderizan como tarjetas interactivas de Feishu; el texto plano corto sigue siendo texto
- **Tarjetas de aprobación de Feishu** — los flujos de aprobación de tool-guard llegan como una tarjeta con botones Aprobar / Denegar; un toque corre la herramienta hasta completar
- **Tarjetas en streaming de Feishu (CardKit)** — las respuestas fluyen carácter por carácter en una sola tarjeta
- **Transcripción de voz entrante en Feishu** — los mensajes de voz pasan por STT y llegan al agente como texto
- **Descarga de archivos / audio / video entrantes en Feishu** — ya no solo imágenes; `media_download_enabled` **ahora por defecto es true en 1.4.0**
- **Herramientas nativas del canal Feishu** — consulta de calendario y lectura / escritura de documentos, sin servidor MCP requerido
- **Ligadura por QR de QQ** — QQ obtiene el mismo onboarding de escanear-para-ligar que DingTalk / Feishu
- **Selección de modelo por conversación en todos los canales IM** — las conversaciones IM recuerdan un modelo por conversación, igual que la web

Los detalles específicos de Feishu están en la sección [Feishu](#feishu-lark) abajo.
:::

::: tip Mejoras de canales 1.5.0
- **Pipeline compartido de medios entrantes** — **WeChat y WeCom** están actualmente cableados sobre un descargador de medios entrantes compartido + detección de tipo por bytes mágicos + reintento con backoff exponencial (los demás canales IM vendrán después). Los tipos de archivo se deciden desde los bytes del contenido (se acabó el `image/*` hardcodeado); HEIC / WEBP / DOCX / XLSX y amigos se detectan correctamente, con reintento automático ante fallo de descarga.
- **Feishu: el texto de seguimiento auto-lleva archivos recientes (#201)** — envía un archivo en un chat de Feishu primero (incluso sin @mencionar al empleado), luego un mensaje de texto, y los archivos cacheados se auto-adjuntan como partes de contenido para el empleado — 5 archivos por chat, TTL de 60 minutos.
:::

---

## Los nueve canales

| Canal | Transporte | Streaming | Notas |
|---------|-----------|-----------|-------|
| **Web** | SSE | ✅ | Integrado, sin configuración |
| **DingTalk** | Stream (WebSocket) / Webhook | ✅ AI Card | Sin IP pública en modo stream |
| **Feishu (Lark)** | WebSocket / Webhook | — | WebSocket no necesita IP pública |
| **WeCom (WeChat Work)** | Conexión larga / Webhook | — | Conexión larga preferida |
| **WeChat Personal** | HTTP long polling (iLink) | — | Experimental / beta |
| **Telegram** | Long-Polling / Webhook | Escribiendo | Long-Polling no necesita IP pública |
| **Discord** | Gateway WebSocket (JDA) | Escribiendo | Auto-reconexión |
| **QQ** | WebSocket / Callback | — | Plataforma oficial de bots |
| **Slack** | Events API / Socket mode | — | Socket mode no necesita IP pública |

---

## Cómo funciona realmente un canal

```
┌──────┐ ┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ ┌────┐ ┌──────┐ ┌──────┐
│ Web  │ │DingTalk │ │Feishu│ │WeCom │ │ TG   │ │Discord│ │ QQ │ │WeChat│ │Slack │
└──┬───┘ └────┬────┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬────┘ └─┬──┘ └──┬───┘ └──┬───┘
   │          │         │        │        │        │        │        │       │
   └──────────┴─────────┴────┬───┴────────┴────────┴────────┴────────┴───────┘
                             │
                    ┌────────┴─────────┐
                    │  Adaptador de    │  ← unifica múltiples protocolos
                    │  canal (+ salud) │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │  Motor de        │
                    │  agentes         │
                    └──────────────────┘
```

Todo canal implementa una forma de adaptador unificada — traduciendo eventos específicos de plataforma a mensajes que el agente puede consumir. **Agregar un canal nuevo** es tarea de desarrollador; ver [Arquitectura](./architecture).

### Monitor de salud de canales

Todo adaptador de canal IM activo es vigilado por un monitor de salud. Cuando un adaptador falla al conectar o pierde su conexión larga, el monitor inicia **reconexión con backoff exponencial** (2s → 4s → 8s → … limitado a 30s). Los blips transitorios se auto-curan; los fallos persistentes aparecen en la vista de salud de la consola de administración.

Por esto los canales de AuraClaw no se quedan en silencio tras un hipo: vuelven solos.

---

## Básicos de configuración de canales

Los canales se gestionan a través de **Gestión de Canales** en la UI de administración. La fila subyacente en `mate_channel`:

| Columna | Qué es |
|--------|-----------|
| `name` | Nombre visible |
| `type` | Tipo de canal (`dingtalk`, `feishu`, `telegram`, …) |
| `agent_id` | Qué agente maneja los mensajes |
| `config` | Objeto JSON con credenciales específicas del canal |
| `enabled` | Interruptor encendido/apagado |

Todas las credenciales cifradas en reposo. Un agente puede tener muchos canales; canales distintos pueden hablar con agentes distintos.

---

## Canal Web (SSE)

Integrado. Sin configuración, sin credenciales. Usa Server-Sent Events para streaming en tiempo real.

```
POST /api/v1/chat/stream
Content-Type: application/json
Accept: text/event-stream

{"agentId": 1, "message": "...", "conversationId": "..."}
```

El formato de eventos está documentado en [Chat y Mensajería](./chat).

---

## DingTalk

Dos modos de conexión (Stream / Webhook) y dos formatos de mensaje (markdown / tarjeta).

### Ligadura por QR de un clic (recomendada, v1.1.0+)

**Sin login a la consola de desarrollador. Sin "agregar capacidad de Robot". Sin "crear versión". Abre el formulario del canal, escanea un QR, listo.**

1. `Canales → Nuevo → elige tipo: DingTalk`
2. En el formulario, clic en **Ligar App de DingTalk vía QR** — se despliega un QR azul de DingTalk
3. Escanéalo con la app de DingTalk y **confirma la autorización**
4. De vuelta en el formulario, **Client ID y Client Secret se auto-llenan**

Las sesiones son válidas por 7 minutos; las sesiones expiradas se auto-invalidan y regeneran. Llena el resto (modo de conexión, agente, formato de mensaje) como quieras.

::: tip Qué pasa por debajo
El Device Flow de OAuth de DingTalk. AuraClaw pide un código de dispositivo a `oapi.dingtalk.com`, lo codifica como QR; una vez que confirmas, las credenciales aterrizan en el formulario vía el endpoint de polling. **Sin webhook, sin IP pública requerida.**
:::

### Creación manual de app (fallback)

Si el flujo QR no puede alcanzar DingTalk en tu red, o necesitas control más fino sobre la config de la app, el camino de plataforma abierta sigue funcionando:

1. Abre la [Consola de Desarrolladores de DingTalk](https://open-dev.dingtalk.com/), **Desarrollo de Apps > Apps Internas > Crear App**
   ![Create App](/images/channels/dingtalk/01-create-app.png)

2. **Capacidades de la App > Agregar Capacidad** → agrega **Robot**
   ![Add Robot](/images/channels/dingtalk/02-add-bot.png)

3. Pon el modo de recepción de mensajes en **modo Stream**, publica
   ![Robot Config](/images/channels/dingtalk/03-bot-config.png) ![Stream Mode](/images/channels/dingtalk/04-stream-publish.png)

4. **Release de la App > Gestión de Versiones** → crea una versión nueva y guarda
   ![Create Version](/images/channels/dingtalk/05-create-version.png)

5. **Info Básica > Credenciales** → obtén **Client ID** (AppKey) y **Client Secret** (AppSecret)
   ![Credentials](/images/channels/dingtalk/06-credentials.png)

### Configurar en AuraClaw

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "DingTalk Bot",
    "type": "dingtalk",
    "agentId": 1,
    "config": {
      "connection_mode": "stream",
      "client_id": "your-client-id",
      "client_secret": "your-client-secret",
      "message_type": "markdown"
    },
    "enabled": true
  }'
```

::: tip
El modo stream usa el SDK oficial de DingTalk para establecer una conexión larga WebSocket. **Sin IP pública requerida.** Para streaming con AI Card, pon `message_type: card` y provee un ID de plantilla.
:::

### Encontrar y usar el bot

Busca el nombre del bot en DingTalk, encuéntralo bajo **Funciones**, empieza a chatear.

![Search Bot](/images/channels/dingtalk/07-search-bot.png) ![Find Bot](/images/channels/dingtalk/08-find-bot.png) ![Chat](/images/channels/dingtalk/09-chat.png)

URL de Webhook (modo webhook): `https://tu-dominio/api/v1/channels/webhook/dingtalk`

---

## Feishu (Lark)

Conexión larga WebSocket o Webhook. WebSocket es preferido — sin IP pública requerida.

### Ligadura por QR de un clic (recomendada, v1.1.0+)

**Antes: "ve a la plataforma abierta → crea una app personalizada de empresa → copia App ID y App Secret". Después: clic en un botón, escanea el QR, las credenciales llegan.**

1. `Canales → Nuevo → elige tipo: Feishu`
2. En el formulario, clic en **Ligar App de Feishu vía QR** — se despliega un código QR
3. Escanéalo con **la app de Feishu** y **confirma la autorización** (para Lark internacional, cambia el dominio a `lark`)
4. De vuelta en el formulario, **App ID y App Secret se auto-llenan**

Llena el resto (agente, más verification token / encrypt key si usas modo webhook) según necesites. **Las sesiones son válidas por 5 minutos.**

::: tip Qué pasa por debajo
El SDK de Feishu 2.6+ trae un Device Flow de `scene/registration`. Tras subir `com.larksuite.oapi:oapi-sdk` a 2.6.1, todo el desvío de "crear app → copiar credenciales" colapsa en un solo escaneo de QR.
:::

### Creación manual de app (fallback)

Si el flujo QR no puede alcanzar Feishu en tu red, o necesitas modo webhook / scopes de permisos personalizados:

1. Abre la [Plataforma Abierta de Feishu](https://open.feishu.cn/app), crea una app personalizada de empresa
   ![Create App](/images/channels/feishu/01-create-app.png) ![App Info](/images/channels/feishu/02-build.png)

2. **Credenciales e Info Básica** → toma **App ID** y **App Secret**
   ![Credentials](/images/channels/feishu/03-credentials.png)

3. **Capacidades** → habilita **Bot**
   ![Enable Bot](/images/channels/feishu/04-enable-bot.png)

4. **Permisos** → importa en lote:
   ![Permissions](/images/channels/feishu/05-permissions.png)

   ```json
   {
     "scopes": {
       "tenant": [
         "im:chat", "im:message", "im:message.group_msg",
         "im:message.p2p_msg:readonly", "im:resource",
         "contact:user.base:readonly"
       ]
     }
   }
   ```

5. **Eventos y Callbacks** → selecciona el modo **Conexión Larga WebSocket**
   ![WebSocket Config](/images/channels/feishu/06-websocket.png)

6. Suscríbete a **Receive Messages v2.0**
   ![Subscribe Event](/images/channels/feishu/07-subscribe-event.png)

7. **Release de la App** → crea versión y publica
   ![Create Version](/images/channels/feishu/08-create-version.png)

### Configurar

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Feishu Bot",
    "type": "feishu",
    "agentId": 1,
    "config": {
      "app_id": "cli_your_app_id",
      "app_secret": "your-app-secret",
      "verification_token": "your-verification-token",
      "encrypt_key": "your-encrypt-key"
    },
    "enabled": true
  }'
```

![Add to Favorites](/images/channels/feishu/09-add-favorite.png) ![Chat](/images/channels/feishu/10-chat.png)

URL de Webhook: `https://tu-dominio/api/v1/channels/webhook/feishu`

### Mejoras de Feishu 1.4.0

v1.4.0 sube a Feishu de "puede enviar y recibir texto" a un canal de interacción rica completo. La mayoría de esto funciona con cero config — están listadas aquí para que sepas dónde viven los interruptores y cuáles son los defaults.

#### Tarjetas interactivas (Schema 2.0)

Las respuestas estructuradas — JSON, Markdown con encabezados / tablas / listas, texto largo — se auto-renderizan como **tarjetas interactivas** de Feishu; el texto plano corto sigue saliendo como un mensaje de texto normal.

| Config | Default | Qué hace |
|--------|---------|--------------|
| `card_format` | `auto` | `auto` decide por contenido; `always` fuerza tarjetas (para depurar); `never` fuerza texto plano |
| `card_header` | `AI 助手` | Texto del título de la tarjeta; ponlo en cadena vacía para suprimir el encabezado |

El payload JSON de la tarjeta está limitado a ~32 KB; cualquier cosa más grande se degrada a texto plano.

#### Tarjetas de aprobación

Los flujos de aprobación de tool-guard llegan como una tarjeta con botones **Aprobar / Denegar**. Tocar **Aprobar** inyecta un `/approve` sintético, tocar **Denegar** inyecta `/deny`, y el agente entonces corre la herramienta aprobada de punta a punta — aprobación y ejecución cierran el bucle en la misma conversación, sin desvío de vuelta a la consola web.

#### Tarjetas en streaming (CardKit)

Las respuestas fluyen carácter por carácter en una **sola tarjeta** en lugar de esperar la respuesta completa antes de enviar.

- `card_streaming_enabled` (default `true`)
- El primer token aparece de inmediato; las actualizaciones de texto regulares se coalescen a 500ms, mientras las transiciones de fase se refrescan preferencialmente tras un límite de seguridad de plataforma de 120ms
- `stream_progress` (default `true`) mantiene el estado de pensamiento, los pasos del plan, el progreso de herramientas y la narración de etapa en la misma tarjeta; la completitud retiene una traza de ejecución acotada sobre la respuesta final
- Pon `filter_thinking=false` para mostrar el pensamiento crudo del modelo; por defecto solo se muestra el estado y el progreso de etapa
- Pon `filter_tool_messages=false` para mostrar nombres de herramientas y resultados por herramienta; por defecto solo se muestra el conteo de herramientas
- Ante fallo de CardKit cae a acumular-y-luego-enviar
- La actualización final y las operaciones de cierre reintentan una vez; si aún fallan, un mensaje regular de Feishu lleva la respuesta

#### Transcripción de voz entrante

Los mensajes de voz de Feishu pasan por speech-to-text (STT) y se le dan al agente como texto — el agente ve palabras reales, no un placeholder `[audio]`. **Auto-habilitado una vez que STT está configurado**, sin interruptor extra.

#### Descarga de archivos / audio / video entrantes

Antes de 1.4.0 solo se descargaban imágenes; ahora también se descargan archivos, audio y video, se cachean localmente y se le muestran al agente vía `/api/v1/files/generated/{id}`.

::: warning Cambio de default
`media_download_enabled` **ahora por defecto es `true`** en 1.4.0. Si el uso de disco o la privacidad te importan, ponlo explícitamente en `false` para excluirte.
:::

Límites de tamaño y formato: las imágenes se limitan a 10 MB (auto-comprimidas más allá de eso); archivos / audio / video se limitan a 30 MB; el audio es solo opus y el video solo mp4, con todo lo demás degradando a manejo plano de archivos.

#### Archivos generados salientes → adjuntos nativos

Las URLs de archivos que el agente genera se convierten de vuelta en **adjuntos** nativos de Feishu enviados directamente. Ante un cache miss, la respuesta lleva una pista de reintento en lugar de un enlace muerto.

#### Herramientas nativas del canal (sin servidor MCP)

Liga un canal Feishu y el agente gana de inmediato tres herramientas Feishu nativas, **sin servidor MCP separado requerido**:

| Herramienta | Tipo | Default |
|------|------|---------|
| `feishu_calendar_list_events` | lectura | encendida |
| `feishu_doc_read` | lectura | encendida |
| `feishu_doc_create` | escritura | apagada, controlada por aprobación |

Las reglas de guarda sembradas en BD aplican automáticamente `NEEDS_APPROVAL` a las herramientas mutadoras (p. ej. `feishu_doc_create`), disparando el flujo de tarjeta de aprobación de arriba.

#### Inyección de contexto del remitente

En chats grupales el agente necesita saber quién habla. Cuando llega un mensaje de Feishu, el prompt del agente lleva automáticamente líneas de contexto de Canal / Remitente / (en grupos) Chat. **Sin config.**

#### Reacción DONE

Tras una respuesta exitosa, el bot agrega una reacción ✅ al mensaje entrante como un recibo ligero de "manejado". `enable_done_reaction` (default `true`).

#### Filtrado por mención

Por defecto el bot responde a cualquiera en un chat grupal. Pon `require_mention` en `true` (default `false`) y solo una @mención lo dispara — el chequeo usa el campo mentions del SDK de Feishu. El open_id propio del bot se pre-extrae al arrancar con una caché negativa de 60s (si no se puede resolver, la compuerta cae abierta en lugar de bloquear todo el grupo por un solo fallo).

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Feishu Bot",
    "type": "feishu",
    "agentId": 1,
    "config": {
      "app_id": "cli_your_app_id",
      "app_secret": "your-app-secret",
      "card_format": "auto",
      "card_header": "AI 助手",
      "card_streaming_enabled": true,
      "stream_progress": true,
      "media_download_enabled": true,
      "enable_done_reaction": true,
      "require_mention": false
    },
    "enabled": true
  }'
```

---

## WeCom (WeChat Work)

1. [WeChat Work](https://work.weixin.qq.com) — regístrate o inicia sesión
   ![Create Enterprise](/images/channels/wecom/01-create-enterprise.png) ![Register](/images/channels/wecom/02-register.png)

2. Workbench → **Robot Inteligente > Crear Robot** → **Modo API > Conexión Larga**
   ![Create Bot](/images/channels/wecom/03-create-bot.png) ![API Mode](/images/channels/wecom/04-api-mode.png) ![Long Connection](/images/channels/wecom/05-long-connection.png)

3. Toma **Bot ID** y **Secret**
   ![Credentials](/images/channels/wecom/06-credentials.png)

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "WeCom Bot",
    "type": "wecom",
    "agentId": 1,
    "config": {
      "bot_id": "your-bot-id",
      "secret": "your-secret"
    },
    "enabled": true
  }'
```

![Start Chat](/images/channels/wecom/07-chat.png)

::: tip ¿Quieres que WeCom realmente corra fluido?
Colaboración multi-usuario en grupos, mensajes citados, parsing de appmsg, restricciones de subida, enrutamiento de aibot_respond_msg, detección de auto-bucle, reintento TLS, bloqueos de permisos a nivel de plataforma — toda optimización no obvia y caso borde está recopilada en [Ajuste Profundo de WeCom](./wecom-tuning).
:::

---

## Telegram

Long-Polling (default) o Webhook. Long-Polling no necesita IP pública.

### Crear bot

1. Busca **@BotFather** en Telegram (busca la insignia azul de verificado)
2. Envía `/newbot`, sigue las indicaciones
   ![Create Bot](/images/channels/telegram/01-botfather.jpg)
3. Copia el **Bot Token**
   ![Get Token](/images/channels/telegram/02-token.jpg)

### Configurar

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Telegram Bot",
    "type": "telegram",
    "agentId": 1,
    "config": {
      "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      "show_typing": true,
      "polling_timeout": 20
    },
    "enabled": true
  }'
```

::: tip
- Long-Polling trae reconexión con backoff exponencial (2s → 30s) integrada
- El indicador de escribiendo se refresca cada 4 segundos
- Los usuarios en China pueden necesitar `http_proxy` configurado
:::

---

## Discord

Construido sobre **JDA** — se conecta vía Gateway WebSocket con reconexión automática.

### Crear bot

1. [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)
   ![Developer Portal](/images/channels/discord/01-developer-portal.png)

2. Crea la Aplicación
   ![Create App](/images/channels/discord/02-create-app.png)

3. **Bot** → crea un Bot, copia el **Token**
   ![Bot Token](/images/channels/discord/03-bot-token.png)

4. Habilita **Message Content Intent**, otorga **Send Messages** + **Attach Files**
   ![Permissions](/images/channels/discord/04-permissions.png)

5. **OAuth2 > URL Generator** → selecciona el scope `bot` → invita a tu servidor
   ![OAuth2](/images/channels/discord/05-oauth2.png) ![Invite](/images/channels/discord/06-invite.png)

### Configurar

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Discord Bot",
    "type": "discord",
    "agentId": 1,
    "config": {
      "bot_token": "your-bot-token",
      "accept_bot_messages": false
    },
    "enabled": true
  }'
```

::: tip
- Sin URL de Webhook ni Interactions Endpoint necesarios — el Gateway WebSocket maneja todo
- Las respuestas largas (más de 2000 caracteres) se auto-dividen preservando la integridad de los bloques de código
- La deduplicación de mensajes (caché LRU de 500) previene procesamiento duplicado durante reconexiones
:::

---

## QQ

Modos WebSocket / callback, en la plataforma oficial de bots.

### Ligadura por QR de un clic (recomendada, v1.4.0+)

Como DingTalk / Feishu, QQ ahora soporta escanear-para-ligar — sin copia manual de AppID / AppSecret desde la plataforma abierta.

1. `Canales → Nuevo → elige tipo: QQ`
2. En el formulario, clic en **Ligar App de QQ vía QR** — se despliega un código QR
3. Escanéalo con QQ y **confirma la autorización**
4. De vuelta en el formulario, **AppID y AppSecret se auto-llenan**

::: tip Qué pasa por debajo
Esto pasa por el portal Lite de la Plataforma Abierta de QQ: AuraClaw acuña una sesión temporal y las credenciales aterrizan en el formulario vía un intercambio cifrado con AES-256-GCM. La sesión es válida por 12 minutos y se auto-invalida al expirar. **Sin credenciales copiadas a mano en ningún punto del flujo.**
:::

### Creación manual de app (fallback)

Si el flujo QR no puede alcanzar QQ en tu red:

1. [Plataforma Abierta de QQ](https://q.qq.com/) → crea una aplicación de bot
   ![QQ Open Platform](/images/channels/qq/01-open-platform.png) ![Create Bot](/images/channels/qq/02-create-bot.png)

2. **Configuración de Callback** → habilita **Evento de Mensaje C2C** y **Evento AT de Mensaje de Grupo**
   ![Event Config](/images/channels/qq/03-c2c-event.png)

3. **Gestión de Desarrollo** → toma **AppID** y **AppSecret**
   ![Credentials](/images/channels/qq/04-credentials.png)

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "QQ Bot",
    "type": "qq",
    "agentId": 1,
    "config": {
      "app_id": "your-app-id",
      "client_secret": "your-app-secret"
    },
    "enabled": true
  }'
```

---

## Slack

Events API (modo webhook) o Socket Mode (sin IP pública necesaria).

### Crear app

1. Visita [Slack API — Your Apps](https://api.slack.com/apps) y crea una app nueva
2. Bajo **OAuth & Permissions**, otorga los scopes de bot: `chat:write`, `app_mentions:read`, `im:history`, `im:read`, `im:write`, `files:write`
3. Instala la app en tu workspace
4. Copia el **Bot User OAuth Token** (`xoxb-...`)
5. Para Socket Mode: bajo **Socket Mode**, habilítalo y genera un **App-Level Token** con `connections:write` (`xapp-...`)
6. Suscríbete a los eventos de bot: `app_mention`, `message.im`

### Configurar

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Slack Bot",
    "type": "slack",
    "agentId": 1,
    "config": {
      "bot_token": "xoxb-...",
      "app_token": "xapp-..."
    },
    "enabled": true
  }'
```

URL de Webhook (modo webhook): `https://tu-dominio/api/v1/channels/webhook/slack`

---

## WeChat Personal (iLink)

::: warning
El Bot Personal de WeChat (protocolo iLink) está en beta. El acceso debe solicitarse antes de usarse.
:::

- **Login** — escaneo de QR en el primer uso; el token persiste automáticamente (entre reinicios)
- **Recepción** — HTTP long polling
- **Envío** — respuesta vía la API `sendmessage` (texto + voz)

Agrega un canal WeChat Personal en Gestión de Canales, haz clic en **Obtener QR de Login**, escanea con tu teléfono. El token se auto-llena al autorizar.

### Qué sobrevive ahora

WeChat Personal solía ser el canal más frágil. Lo reconstruimos:

- **Bucle watchdog** — sin pollers silenciosos que dejan de reconectarse
- **Backoff exponencial con jitter** — auto-recuperación ante expiración de token y blips de red, sin crashear-y-quedarse-muerto
- **Detección de obsolescencia por cuenta** — identifica con precisión qué conexión de cuenta quedó obsoleta
- **Transcripción de voz con 3 caminos de fallback** — cubre los múltiples esquemas de cifrado del CDN de WeChat

```bash
curl -X POST http://localhost:18088/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "WeChat Personal",
    "type": "weixin",
    "agentId": 1,
    "config": {"bot_token": "your-bot-token"},
    "enabled": true
  }'
```

---

## Cuenta Oficial de WeChat (destino de publicación, 1.8.0+)

A diferencia de los nueve canales conversacionales de arriba, la integración de **Cuenta Oficial de WeChat (公众号)** es un **transporte de publicación de una vía**, no un canal de mensajes entrantes. La usa [Content Studio](./content-studio) para empujar artículos de imagen-texto a la **caja de borradores** de tu Cuenta Oficial.

- Configura el `app_id` / `app_secret` de la Cuenta Oficial en **Ajustes** — el secreto está **cifrado con AES-GCM en reposo** (define `MATECLAW_SETTING_KEY` y respáldala).
- La instancia del servicio de WeChat se cachea por appId con un **access token persistido** (WeChat permite un token válido por appId), y la cadena de publicación **reintenta** errores transitorios y traduce códigos de error conocidos a pistas accionables (p. ej. *agrega la IP del servidor a la whitelist de la Cuenta Oficial*).
- La publicación es **caja-de-borradores-primero**; la acción opcional `publish` está controlada por aprobación. Ver [Content Studio](./content-studio).

---

## API de gestión de canales

```bash
# Listar
curl http://localhost:18088/api/v1/channels \
  -H "Authorization: Bearer <token>"

# Alternar
curl -X PUT "http://localhost:18088/api/v1/channels/1/toggle?enabled=true" \
  -H "Authorization: Bearer <token>"

# Borrar
curl -X DELETE http://localhost:18088/api/v1/channels/1 \
  -H "Authorization: Bearer <token>"

# Estado de salud (todos los canales)
curl http://localhost:18088/api/v1/channels/health \
  -H "Authorization: Bearer <token>"
```

---

## Seguimiento de la fuente de sesión

Cada conversación de canal registra de dónde vino. En la vista de gestión de sesiones y la consola de chat, cada sesión muestra el icono del canal correspondiente. Las sesiones de canales IM pertenecen al usuario `system`.

---

## Voz para cada canal

Los canales IM (WeCom, WeChat, DingTalk) soportan entrada de voz. Transcripción vía DashScope o OpenAI Whisper, con fallback multi-camino para el CDN de voz cifrado de WeChat. Las respuestas de voz se sintetizan vía text-to-speech y se envían de vuelta como mensajes de audio.

---

## Selección de modelo por conversación (todos los canales IM)

Desde 1.4.0, las conversaciones de canales IM **recuerdan un modelo por conversación**, igual que la web. Cada conversación IM siembra un modelo a nivel de conversación cuando se crea, y las respuestas posteriores respetan esa elección en lugar de caer siempre al modelo por defecto del agente. Ver [Chat y Mensajería](./chat) para el detalle del cambio del lado web. Desde 2.0.0 también puedes cambiar directo dentro del IM con el comando mágico `/model` (siguiente sección).

---

## Comandos mágicos de canal (2.0.0+)

En cualquier canal IM, un mensaje que es enteramente un comando con prefijo `/` es interceptado por un dispatcher unificado **antes de que llegue al LLM** — los comandos se registran una vez y funcionan en todo canal, no queman tokens y responden al instante:

| Comando | Qué hace |
|------|--------|
| `/new` | Inicia una conversación fresca (el contexto actual se archiva) |
| `/clear` | Limpia el contexto de la conversación actual (la conversación en sí sobrevive; el comando clear de la era 1.8 se pliega a este framework) |
| `/status` | Muestra el estado de la conversación — empleado ligado, modelo, si hay una tarea corriendo |
| `/stop` | Detiene la tarea en curso — interceptado en la compuerta de encolado, así adelanta a una tarea larga en pleno vuelo |
| `/model` | Sin argumento, lista los modelos disponibles (el pin actual marcado); `/model <nombre>` o `/model <proveedor>:<nombre>` cambia el modelo de **esta conversación**, efectivo desde el siguiente mensaje; `/model reset` restaura el default. Los nombres difusos reciben listas de sugerencias |
| `/help` | Lista todos los comandos con descripciones |

Cada comando lleva alias en chino e inglés (p. ej. `清空` / `新会话` / `状态`) y es insensible a mayúsculas. El emparejamiento es de dos capas: **los alias pelados solo emparejan como el mensaje completo** ("ayúdame a escribir un reporte" es un prompt normal, no `/help`); **la forma con slash empareja en el primer token con los argumentos pasados** (así es como `/model qwen-max` lleva su argumento). Un mensaje normal que meramente contiene `/stop` a mitad de frase nunca se dispara por error. Las confirmaciones de comando pasan por el camino normal de renderizar-y-enviar del canal, así una burbuja placeholder "pensando…" ya publicada se consume correctamente en lugar de girar para siempre.

---

## Narración de progreso por etapa en canales IM síncronos (2.0.0+)

La peor parte de las tareas largas en IM es la sensación de "mensaje lanzado al vacío". Desde 2.0.0, los canales IM en el camino síncrono (WeCom, WeChat, …) ya no responden solo con la respuesta final:

- cada **narración de etapa** de la corrida del agente (qué está haciendo, qué herramienta llamó) llega como un mensaje independiente — ves las huellas de la tarea en tu teléfono;
- WeCom va más allá con una **burbuja de progreso dirigida por eventos** que se actualiza en sitio — estado de pensamiento, traza de herramientas en vivo y tiempo transcurrido ruedan en tiempo real, y la burbuja se transforma en la respuesta final cuando llega (detalles y ajuste en [Ajuste Profundo de WeCom](./wecom-tuning));
- el SSE web y los caminos IM síncronos comparten un **acumulador de stream por turno**, así ambos lados ven metadatos de ejecución idénticos (llamadas a herramientas, uso de tokens).

---

## Cosas que vale la pena saber

- **El modo webhook necesita HTTPS.** Los despliegues de producción deberían poner AuraClaw detrás de Nginx + SSL.
- **Los modos de conexión larga no necesitan IP pública.** Telegram Long-Polling, DingTalk Stream, Feishu WebSocket, Discord Gateway, Slack Socket mode, WeCom conexión larga — todos corren detrás de NAT.
- **Un canal, un agente.** Canales distintos pueden apuntar a agentes distintos.
- **Los ids de conversación están acotados por canal (2.0.0).** La generación de ids de conversación ahora codifica la identidad del canal — dos canales del mismo tipo creados en workspaces distintos mantienen conversaciones separadas incluso para el mismo usuario externo, así los chats de dos workspaces nunca pueden sangrar en una sola fila de conversación.
- **Las credenciales están cifradas en reposo** en `mate_channel`.
- **Las redes en China** a menudo necesitan `http_proxy` configurado para Telegram y Discord.

---

## Empuje proactivo y entrega de Cron dirigida (2.1.0+)

Un empleado puede notificar proactivamente a una conversación IM cuando la tarea lo pide explícitamente:

1. llama `list_channel_sessions` para listar las conversaciones empujables recientes del workspace actual;
2. selecciona el `conversation_id` devuelto exacto;
3. llama `send_channel_message` para una notificación de una vía en texto/Markdown.

Los adaptadores que actualmente implementan el envío proactivo son QQ, Telegram, WeChat, Slack, Discord, Feishu, DingTalk y WeCom. El bot debe haber recibido primero al menos un mensaje en esa conversación para que exista un manejador de entrega de plataforma verificado, y el canal debe estar corriendo. Los ids adivinados y los destinos de otro workspace se rechazan; los mensajes se limitan a 4096 caracteres. Las respuestas ordinarias siguen usando la conversación actual.

Las ediciones de Cron ahora retienen tanto el canal de entrega como el destino, así cambiar un horario o un prompt no puede perder silenciosamente el destino. Esto encaja con reportes programados, alertas y notificaciones de completitud asíncrona.

---

## Siguiente

- [Chat y Mensajería](./chat) — flujo de mensajes, segmentos, eventos de streaming
- [Agentes](./agents) — qué está respondiendo realmente a través de cada canal
- [Configuración](./config) — ajuste global de canales
