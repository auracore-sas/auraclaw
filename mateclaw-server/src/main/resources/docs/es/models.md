# Modelos

**Elige un modelo. Solo uno. Agrega más después.**

A AuraClaw no le importa qué LLM uses. Habla con todo proveedor mainstream a través de cinco adaptadores de protocolo, soporta 15+ proveedores cloud y 4 runtimes locales, y te deja cambiar modelos en runtime sin tocar la configuración del agente. La única opinión que AuraClaw tiene es que deberías **empezar con uno y agregar más cuando los necesites** — no configurar todo el primer día.

---

## Qué está soportado

### Proveedores cloud

| Proveedor | Modelos de ejemplo | Protocolo | Notas |
|----------|---------------|----------|-------|
| **DashScope** (Alibaba) | Qwen-Max, Qwen-Plus, Qwen-Turbo, Qwen-VL, Qwen-Long | dashscope | Default de fábrica |
| **DashScope (OpenAI-compatible)** | Qwen3.5-Plus, Qwen3.6-Plus, Qwen3 VL Plus, etc. (familias con versión en punto) | openai | Ver "Dos variantes de DashScope" abajo |
| **Plan de Tokens Bailian** | Plan de paquete de tokens Bailian | dashscope | 7 modelos sembrados; tokens largos soportados |
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-5.5, o1, o3, o4-mini | openai | API estándar de OpenAI |
| **OpenAI OAuth (ChatGPT Plus/Pro)** | GPT-4o, o3, o4-mini vía suscripción | openai | OAuth basado en navegador — sin clave API |
| **Anthropic** | **Claude Opus 4.8 / 4.8 Fast** (1.5.0+), Claude 4.7, Claude 4.6 Sonnet, Claude 4.5 Haiku | anthropic | API nativa Messages; ambas variantes 4.8 soportan el nivel de pensamiento `xhigh` |
| **Anthropic Claude Code OAuth** | Claude Opus 4.8 / 4.7 / 4.6 vía suscripción Claude Pro/Max/Team | anthropic | OAuth de navegador + flujo de pegado manual — sin clave API |
| **Google Gemini** _(nativo)_ | gemini-2.5-flash, gemini-3-pro-image-preview, gemini-2.5-flash-image | gemini | API nativa `generateContent` (no OpenAI-compatible) — ver "Gemini nativo" abajo |
| **xAI / Grok** | Grok 3, Grok 4 | openai | OpenAI-compatible (base URL + clave API); icono de marca xAI en la UI |
| **DeepSeek** | deepseek-chat, deepseek-coder, **DeepSeek V4 flash + pro** (modo pensamiento) | openai | OpenAI-compatible |
| **Kimi (Moonshot)** | moonshot-v1-8k/32k/128k | openai | OpenAI-compatible |
| **Zhipu AI** | GLM-5-Turbo, GLM-5V-Turbo, GLM-5, GLM-5.1, **GLM-5.2** | openai | OpenAI-compatible; endpoints estándar CN + internacionales más dos endpoints de suscripción Coding Plan |
| **Volcano Engine Agent Plan** _(1.8.0+)_ | GLM-5.2 (principal) y más | openai | OpenAI-compatible; endpoint de plan de agente (`/api/plan/v3`) |
| **MiniMax** | abab6.5, abab5.5; catálogo de video ampliado + endpoint CN | anthropic | Compatible con la API Anthropic Messages (endpoint `/anthropic`) |
| **SiliconFlow CN/INTL** | Inferencia enrutada entre modelos alojados | openai | Dos endpoints, OpenAI-compatible |
| **OpenCode** | Enrutamiento afinado para código | openai | OpenAI-compatible |
| **OpenRouter** | 200+ modelos con tier gratuito | openai | Enruta a cualquier upstream con una clave |
| **Cualquier OpenAI-compatible** | Tu propio vLLM, etc. | openai | Base URL personalizada |

### Runtimes locales

| Runtime | Modelos de ejemplo | Protocolo | Notas |
|---------|---------------|----------|-------|
| **Ollama** | Gemma 3/4, Qwen 3, Llama 3.1, DeepSeek R1, Mistral | ollama | **Auto-detectado al arrancar** en `localhost:11434` |
| **LM Studio** | Cualquier modelo GGUF | openai | Servidor OpenAI-compatible |
| **llama.cpp** | Cualquier modelo GGUF | openai | Vía llama-server |
| **MLX** | Apple Silicon vía mlx-lm | openai | Servidor OpenAI-compatible de mlx-lm |

### Adaptadores de protocolo

Cinco protocolos lo cubren todo:

| Protocolo | Usado por |
|----------|---------|
| **OpenAI** | OpenAI, Kimi, DeepSeek, Zhipu, OpenRouter, LM Studio, llama.cpp, MLX |
| **Anthropic** | Familia Claude, MiniMax |
| **DashScope** | Familia Qwen |
| **Gemini** | Familia Google Gemini |
| **Ollama** | Modelos alojados localmente vía Ollama |

Cualquier servicio OpenAI-compatible funciona — solo apunta `base-url` hacia él.

---

## Dos variantes de DashScope

Misma clave API `sk-`, **dos endpoints** que sirven familias de modelos distintas:

| Ítem | DashScope | DashScope (OpenAI-compatible) |
|---|---|---|
| Endpoint | `dashscope.aliyuncs.com/api/v1` (nativo) | `dashscope.aliyuncs.com/compatible-mode/v1` (OpenAI-compatible) |
| Protocolo | Nativo DashScope | Estándar OpenAI (misma forma que GPT-4 / DeepSeek / Kimi) |
| Búsqueda web integrada (`enable_search`) | ✅ Soportada | ❌ No soportada |
| Modelos | Qwen-Max / Plus / Turbo / Long, Qwen-VL, Qwen3-Max, DeepSeek-V3.2, etc. | Familias nuevas **con versión en punto**: Qwen3.5-Plus, Qwen3.6-Plus, Qwen3 VL-Plus, etc. |

**Por qué dos proveedores**: Alibaba publica las familias con versión en punto (`qwen3.5-*` / `qwen3.6-*` / `qwen3-vl-*`) solo en el endpoint OpenAI-compatible; el protocolo nativo devuelve `400 InvalidParameter` para ellas. Los dos proveedores **comparten la misma clave sk-** — pégala una vez, funciona para ambos.

**Cuál elegir**:
- Quieres Qwen-Max / Plus / Turbo + búsqueda integrada / DeepSeek-V3.2 → **DashScope**
- Quieres Qwen3.5-Plus / Qwen3.6-Plus / Qwen3 visión-lenguaje → **DashScope (OpenAI-compatible)**
- **Habilita ambos** si quieres — misma clave, los modelos solo aparecen bajo tarjetas distintas

---

## Gemini nativo

::: tip Nuevo en 1.4.0
Gemini ya no viaja sobre un shim de compatibilidad OpenAI — AuraClaw habla directamente con la **API nativa `generateContent`** de Google.
:::

Muchos productos atornillan Gemini como "solo otro endpoint OpenAI-compatible" y luego chocan con paredes alrededor de instrucciones de sistema, function calling e imágenes en línea. AuraClaw habla el protocolo propio de Gemini en su lugar:

- **Constructor de chat nativo** — mapea correctamente `systemInstruction`, `functionCall` / `functionResponse` (turnos de llamada a herramientas) y partes de imagen en línea (entrada multimodal)
- **Parseo de streaming SSE** — parsea el formato de respuesta en streaming de Gemini chunk por chunk
- **Saneamiento de JSON Schema** — quita automáticamente las palabras clave de JSON Schema que Gemini rechaza, para que las definiciones de herramientas no sean rechazadas
- **Sonda de vitalidad al arrancar** — envía una solicitud ligera al inicio para confirmar que las credenciales y el modelo son alcanzables

Configúralo en `Ajustes → Modelos → Agregar Proveedor`, elige el proveedor **Gemini**, pega tu clave API. Modelos de ejemplo: `gemini-2.5-flash`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`. La generación de imágenes corre por la misma ruta nativa — ver [Multimodal → Generación de imágenes](./multimodal).

---

## Agregar un proveedor

**Una instalación fresca de AuraClaw tiene una lista de proveedores vacía. Es deliberado.**

No necesitas ver 16 proveedores. Necesitas **uno que funcione.**

`Ajustes → Modelos → Agregar Proveedor` abre un cajón con el catálogo completo. Los runtimes locales (Ollama, LM Studio, llama.cpp, MLX — sin clave API requerida) aparecen primero; los proveedores cloud (DashScope, OpenAI, Anthropic, DeepSeek, etc.) siguen.

Tres pasos:

1. **Encuentra la fila que quieres y haz clic en Habilitar** — el proveedor se une a tu lista principal
2. **Llena la base URL** (pre-llenada para proveedores conocidos) **y pega tu clave API** — cifrada en reposo, enmascarada en la UI
3. **Guardar → Probar Conexión** — el sistema envía una solicitud ligera y reporta éxito o error

Cierra el cajón y la lista principal muestra solo los proveedores que habilitaste. **Selector de modelo, página de chat, editor de agente — todo lugar que muestra modelos, muestra solo los que elegiste.**

::: tip Instalaciones existentes (migración V55)
Los proveedores ya en uso **no** se apagan. V55 auto-marca un proveedor como habilitado si cualquiera de esto es cierto:
- Tiene una clave API real configurada
- Tiene un token OAuth
- Ha sido usado por una sesión de chat en los últimos 30 días
- Posee el modelo por defecto actual

Los proveedores placeholder nunca tocados vuelven al cajón — actívalos la próxima vez que los necesites.
:::

---

## Habilitar / deshabilitar un proveedor

Cada tarjeta de proveedor en la lista principal tiene un toggle **Habilitar / Deshabilitar**. **Debes habilitar un proveedor antes de poder usarlo** — ese es el contrato central del producto desde v1.1.0 en adelante.

- **Deshabilitar** — el proveedor desaparece del selector de modelos, la página de chat y el editor de agente de inmediato. **La configuración se preserva**; vuelve a encenderlo y todo está exactamente donde lo dejaste.
- **Si deshabilitas el proveedor que posee el modelo por defecto actual**, el sistema promueve automáticamente un modelo de un proveedor aún habilitado como nuevo default — sin próximo mensaje roto.
- **Habilitar** — el proveedor reaparece en todas partes. Si nunca tuvo una clave API configurada, se te pedirá configurarla.

Esto separa "tengo una clave para este proveedor pero no la uso hoy" de "no tengo este proveedor". Cambiar de proveedor temporalmente ya no significa borrar configuración.

### ChatGPT OAuth — sin clave API necesaria

¿Tienes una cuenta ChatGPT Plus o Pro? AuraClaw puede hablar con el endpoint de chat de OpenAI mediante **OAuth basado en navegador** — inicia sesión como lo harías normalmente, tu suscripción se usa directamente. GPT-4o, o3 y o4-mini quedan disponibles de inmediato.

`Ajustes → Modelos → Agregar Proveedor → OpenAI OAuth`. Se abre una ventana del navegador. El intercambio de token ocurre en el backend; **las credenciales nunca salen de tu máquina**.

### Device Authorization Grant — para despliegues remotos / headless

El OAuth de callback de navegador necesita que la redirección del IDP aterrice de vuelta en un puerto `localhost` que *tu* navegador pueda alcanzar. Eso está bien cuando AuraClaw corre en tu laptop y se rompe en el momento en que lo pones en un servidor, en un contenedor o en un host que no expone un socket loopback a tu cliente.

Para esos casos, OpenAI OAuth cambia automáticamente a **Device Authorization Grant (RFC 8628)** — el mismo flujo que usan ChatGPT desktop y `gh auth login`. Sin callback, sin mapeo de puertos.

`Ajustes → Modelos → Agregar Proveedor → OpenAI OAuth` en un host no-localhost muestra un diálogo con:

- Un **código de usuario** corto (monoespaciado, copiable)
- Una **URL de verificación** en `auth.openai.com/codex/device` — ábrela en cualquier navegador de cualquier dispositivo
- Una **cuenta regresiva** en vivo hasta que el código de dispositivo expire (default 15 min)

Ingresa el código de usuario en tu navegador, autoriza, y el diálogo se cierra solo en el momento en que el bucle de polling del backend ve `COMPLETED`.

**Cómo decide AuraClaw qué flujo usar:**

| `mateclaw.oauth.openai.deployment-mode` | Comportamiento |
|---|---|
| `auto` *(default)* | `localhost` / `127.0.0.1` / `::1` → callback de navegador; todo lo demás → código de dispositivo |
| `local` | Forzar callback de navegador (servidor loopback) |
| `device_code` | Forzar código de dispositivo |
| `manual_paste` | Forzar el flujo legacy de pegar-la-URL-de-callback |

Si el modo `local` no puede ligar un puerto loopback (puerto en uso, sandbox rechazado), cae automáticamente a `manual_paste`.

**Endpoints del backend:**

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/api/v1/oauth/openai/device/start` | Comienza una sesión — devuelve `deviceAuthId`, `userCode`, `verificationUrl`, `intervalSeconds`, `expiresInSeconds` |
| `POST` | `/api/v1/oauth/openai/device/poll` | Consulta una sesión por `deviceAuthId` — devuelve `PENDING` / `COMPLETED` / `EXPIRED` |
| `POST` | `/api/v1/oauth/openai/device/cancel` | Descarta la sesión (p. ej. el usuario cerró el diálogo) |

El frontend respeta el `intervalSeconds` que devuelve OpenAI (típicamente 5 s); el servidor impone un intervalo mínimo de polling (default 3 s) para mantener la carga acotada. Las sesiones expiradas se barren cada 5 minutos.

La persistencia y el refresco de tokens usan el **mismo camino de código** que el flujo de callback de navegador, así que una vez que el diálogo se cierra no hay diferencia de comportamiento.

### Anthropic Claude Code OAuth

Mismo patrón, mismo resultado: ¿tienes una suscripción Claude Pro / Max / Team? Inicia sesión con el **mismo flujo OAuth que usa Claude Code en sí** — sin clave API `sk-ant-…` requerida. Claude 4.7 / 4.6 / 4.5 Haiku entran en línea a través de tu suscripción.

`Ajustes → Modelos → Agregar Proveedor → Anthropic Claude Code OAuth`. Se soportan dos flujos:

- **Callback de navegador** — instalación local, el navegador se abre, haces clic a través, el token aterriza en AuraClaw
- **MANUAL_PASTE** — para despliegues en servidor remoto donde el navegador no puede alcanzar el backend, completas la autenticación en tu navegador local y pegas el token

Cumple con la compuerta anti-abuso: la identidad de Claude Code se inyecta en el prompt de sistema, la forma de la solicitud (encabezados UA / accept / forma del arreglo `system` / prefijos de nombre de herramientas `mcp_`) coincide exactamente con el formato de cable de Claude Code para que las solicitudes no sean rechazadas.

---

## Descubrimiento de modelos

Los proveedores que exponen una lista de modelos (OpenAI, Ollama, LM Studio, OpenRouter, etc.) soportan **Descubrimiento de Modelos** — un clic y AuraClaw trae todo modelo que el proveedor ofrece.

- `Ajustes → Modelos → [tarjeta del proveedor] → Descubrir Modelos`
- El sistema consulta el endpoint `/v1/models` del proveedor
- Los modelos descubiertos aparecen con nombre, ventana de contexto, precios
- Agrégalos uno a uno o todos de una vez

Para OpenRouter específicamente, el Descubrimiento de Modelos muestra los **200+ modelos del tier gratuito** — elige un modelo gratis y tienes una configuración funcionando con costo cero.

### Proveedores personalizados (auto-agregados)

Los endpoints compatibles que creas vía "Agregar proveedor" (vLLM / Xinference / LocalAI / gateways) habilitan el descubrimiento por protocolo: `openai-compatible`, `dashscope-native`, `gemini-native` y `anthropic-messages` obtienen el botón **Descubrir modelos** por defecto; los protocolos OAuth (ChatGPT OAuth, Claude Code OAuth) no — su descubrimiento corre por un callback de inicio de sesión dedicado, no relacionado con `baseUrl`.

Si la ruta de listado de modelos del endpoint no es el `/v1/models` estándar (p. ej. un reverse proxy agrega un prefijo `/openai/v1/models`), sobrescríbela con una entrada `modelsPath` en los Generate Kwargs (JSON) del proveedor:

```json
{ "modelsPath": "/openai/v1/models" }
```

La clave hermana `completionsPath` sobrescribe la ruta de chat-completions (default `/v1/chat/completions`); las dos son independientes. Si el endpoint no expone ningún listado estilo OpenAI, simplemente usa "Agregar modelo" para ingresar ids de modelo manualmente.

### Auto-detección de Ollama al arrancar

Sin configuración manual necesaria. Al arrancar:

1. **Ping** `http://127.0.0.1:11434`
2. **Descubre** — trae los modelos descargados vía `/v1/models`
3. **Registra** — agrega a `mate_model_config`
4. **Habilita** — auto-habilita modelos pre-configurados coincidentes
5. **Reescritura de tags** — reescribe los tags seed `:latest` a las versiones reales instaladas (`deepseek-r1:latest` → `deepseek-r1:7b`), se acabaron los 404 de `model not found`

Si Ollama no está corriendo, se salta en silencio.

::: tip Comportamiento por defecto
- Los modelos sin soporte de herramientas (`deepseek-r1`, `gemma*`, `phi3/4`, etc.) no se activarán accidentalmente como default — están en blocklist
- Los modelos que no son llamables en el protocolo nativo de DashScope se auto-purgán al arrancar; las familias Qwen con versión en punto ahora viven en el proveedor DashScope (OpenAI-compatible)
- El descubrimiento de modelos de DashScope usa sondeo consciente del protocolo, saltando modalidades que no son de chat
:::

**Modelos Ollama pre-configurados** (deshabilitados hasta ser descubiertos, luego auto-habilitados):

| Modelo | `model_name` |
|-------|-------------|
| Gemma 3 | `gemma3:latest` |
| Gemma 4 | `gemma4:latest` |
| Qwen 3 | `qwen3:latest` |
| Llama 3.1 | `llama3.1:latest` |
| DeepSeek R1 | `deepseek-r1:latest` |
| Mistral | `mistral:latest` |

Configuración:

```bash
# Instala Ollama desde ollama.com, luego:
ollama pull gemma3
ollama pull qwen3
```

Reinicia AuraClaw. Auto-descubiertos, agregados, habilitados.

---

## Esquema de base de datos

### `mate_model_provider`

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `name` | Identificador del proveedor |
| `display_name` | Nombre legible por humanos |
| `protocol` | `dashscope` / `openai` / `ollama` / `anthropic` / `gemini` |
| `base_url` | URL base de la API |
| `api_key` | Clave API cifrada |
| `oauth_tokens` | Tokens OAuth (ChatGPT Plus/Pro) |
| `is_local` | True para runtimes locales |
| `enabled` | Interruptor maestro del proveedor — apagado, oculto de todo selector de modelos; la configuración se preserva (v1.1.0+) |

### `mate_model_config`

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `provider_id` | FK a `mate_model_provider` |
| `model_name` | Identificador real del modelo |
| `display_name` | Nombre legible por humanos |
| `temperature` | Temperatura por defecto (0.0 – 2.0) |
| `max_tokens` | Tokens máximos de salida |
| `top_p` | Muestreo top-p |
| `group_name` | Agrupación en UI (p. ej., "Razonamiento", "Rápido", "Visión") |
| `enabled` | Si el modelo está disponible |

### Modelos de embedding

Sin variables de entorno `EMBEDDING_API_KEY`. Los modelos de embedding son filas regulares en `mate_model_config` con `model_type='embedding'`. Aparecen junto a los modelos de chat en `Ajustes → Modelos`. Las bases de conocimiento eligen su modelo de embedding desde un desplegable.

::: tip Nuevo en 1.4.0 ([issue #79](https://github.com/mateaix/mateclaw/issues/79))
**Modelos de embedding de cualquier proveedor.** En la sección de embedding de `Ajustes → Modelos`, configura un modelo de embedding de cualquier proveedor — **reutiliza la clave API de ese proveedor**, así no hay un `EMBEDDING_API_KEY` separado. Cada base de conocimiento elige su modelo de embedding desde un desplegable. Los proxies locales sin clave usan una clave placeholder no-op; el protocolo se resuelve desde la configuración de modelo de chat / protocolo del proveedor, así nunca lo ingresas a mano.
:::

### Prompt caching de Anthropic

Prompts de sistema, personas de agentes, definiciones de herramientas — marcados automáticamente con `cache_control: ephemeral` en endpoints compatibles con Anthropic. La primera solicitud calienta la caché, cada seguimiento obtiene un cache hit. El Dashboard rastrea `cache_read_tokens` / `cache_write_tokens` diariamente.

### Profundidad de pensamiento / `reasoning_effort`

**Qué modelos honran este parámetro**: `reasoning_effort` solo es válido para la familia de razonamiento de OpenAI (`gpt-5*` / `o1*` / `o3*` / `o4*`), y solo cuando se entrega a través de los proveedores OpenAI o Azure-OpenAI. Todo otro proveedor (DeepSeek, Kimi, DashScope, Ollama, gateways OpenAI-compatibles self-hosted, etc.) errará o se comportará raro si este parámetro les llega.

**Tres contratos de producto**:

1. **Los modelos de chat que no soportan cadena de pensamiento** ignoran por completo el selector de "pensamiento profundo = alto" del front-end — esta es una propiedad de capacidad, no un ajuste de UI. El selector de profundidad de pensamiento se apaga automáticamente cuando el modelo actual no es capaz de razonar.
2. **`generateKwargs.reasoningEffort` a nivel de proveedor** solo surte efecto en proveedores whitelisteados. Ponerlo en DeepSeek / Kimi / otros proveedores OpenAI-compatibles se descarta silenciosamente con un log WARN; el parámetro nunca se envía.
3. **El failover** re-chequea al momento de egreso: si el primario es GPT-5 y el fallback es DeepSeek, `reasoning_effort` se quita antes de golpear a DeepSeek, para que opciones filtradas del primario no puedan causar un 400 en el fallback.

**Cómo habilitar el pensamiento de DeepSeek**: el modo pensamiento de DeepSeek **no** usa `reasoning_effort`.

- `deepseek-reasoner`: el pensamiento está encendido por defecto; sin config necesaria.
- `deepseek-chat` con pensamiento: sigue la documentación oficial de DeepSeek y define `{"thinking": {...}}` bajo el `generateKwargs.extra_body` del proveedor. **No** definas `reasoningEffort`.

**Pensamiento de Kimi K2.5**: el modelo activa el pensamiento de forma nativa; no definas `reasoning_effort`.

**Llamadas a herramientas multi-ronda + pensamiento**: los modelos capaces de pensar (DeepSeek-Reasoner / GPT-5 / Kimi K2.5 / Xiaomi MiMo) redondean correctamente el `reasoning_content` histórico durante llamadas a herramientas ReAct multi-ronda. El historial entre turnos de usuario se limpia en el límite, el historial dentro del turno se preserva — coincidiendo con el contrato de DeepSeek de "pásalo de vuelta dentro de un turno, resetea entre turnos".

**Fix de modo pensamiento multi-turno de Xiaomi MiMo** ([issue #189](https://github.com/mateaix/mateclaw/issues/189)): el `reasoning_content` de MiMo ahora se conserva correctamente entre turnos en modo pensamiento, en lugar de perderse en turnos posteriores.

---

## Selector de modelos agrupado

Cuando tu despliegue tiene muchos modelos configurados, el selector de modelos del chat los agrupa por proveedor y etiqueta. Un desplegable con búsqueda te deja filtrar por nombre, proveedor o grupo — "todo Qwen", "todos los modelos de razonamiento", "todo bajo 7B". Los grupos se definen en la columna `group_name`.

Se volvió algo real cuando los agentes pudieron ligarse a modelos distintos por tarea — un modelo de razonamiento para Plan-Execute, un modelo rápido y barato para Chat, un modelo de visión para comprensión de imágenes.

---

## Cambio de modelo activo en runtime

AuraClaw usa un único **modelo activo** como default global. Los agentes que no especifican el suyo lo usan.

- **UI:** `Ajustes → Modelos → [tarjeta de modelo] → Establecer como Activo`
- **API:** `PUT /api/v1/models/active`

Surte efecto **de inmediato** — sin reinicio. El siguiente mensaje usa el modelo nuevo. Las conversaciones en vuelo no se ven afectadas.

Soporta override por agente: liga un agente específico a una config de modelo específica.

::: tip Nuevo en 1.4.0
- **Selección de modelo por conversación** ([issue #150](https://github.com/mateaix/mateclaw/issues/150)): en la UI de chat puedes cambiar el modelo de **solo la conversación actual**, sin tocar el modelo activo global ni ninguna otra conversación. Ver [Chat y Mensajería](./chat).
- **Un solo id de modelo malo ya no desaloja a todo el proveedor**: cuando el descubrimiento / sondeo choca con un identificador de modelo inválido, solo ese modelo se salta — el resto de los modelos del proveedor siguen disponibles.
:::

---

## Prueba por modelo

Cada tarjeta de modelo tiene un botón **Probar**. Haz clic, el sistema envía un prompt simple, muestra:

- Texto de respuesta real
- Latencia
- Uso de tokens
- Cualquier error

Úsalo cada vez que agregues un proveedor nuevo o sospeches de una clave obsoleta.

---

## Sidecar multimodal (a nivel de sistema)

::: tip Añadido en 1.3.0
Deja que un modelo principal solo-texto responda igualmente preguntas sobre imágenes subidas. Ver [issue #87](https://github.com/mateaix/mateclaw/issues/87).
:::

Punto de entrada: **Ajustes → Modelos → Sidecar multimodal**. Dos tarjetas independientes:

| Tarjeta | Propósito | Estado |
|------|---------|--------|
| **Modelo sidecar de visión** | Describe una imagen subida una vez, luego entrega la descripción estructurada al modelo de chat principal | En vivo |
| **Modelo sidecar de video** | Misma idea para video | Reservado (config persistida pero aún no cableada en v1) |

El ajuste almacena `mate_model_config.id` en lugar de `model_name` — el mismo `model_name` puede existir bajo múltiples proveedores (p. ej. `qwen-vl-max` vive tanto en DashScope como en una fila personalizada OpenAI-compatible), así un ajuste clavad por nombre colisionaría. Dos claves de ajuste:

- `default.vision_model`
- `default.video_model`

El desplegable solo lista modelos que **realmente soportan la modalidad relevante** — filtrado por `ModelCapabilityService.supports(...)` en el backend; los proveedores deshabilitados o los modelos sin una capacidad de visión declarada nunca aparecen. Cada tarjeta tiene su propio botón Guardar, independiente de la otra.

¿Cuándo se dispara? `MultimodalRouter` ([fuente](https://github.com/mateaix/mateclaw/blob/main/mateclaw-server/src/main/java/vip/mate/llm/routing/MultimodalRouter.java)) decide por turno:

- El primario ya soporta visión → sin enrutamiento (camino multimodal nativo)
- El primario no tiene visión + sidecar de visión configurado → estrategia SIDECAR, captions a texto
- El primario no tiene visión + sin sidecar → salta el adjunto + dile al usuario que configure uno

Para el flujo de usuario final (insignia, pista sobre la caja de entrada) ver [Chat → ¿El modelo principal no ve imágenes? Enrutamiento con "sidecar multimodal"](./chat).

---

## Failover multi-modelo

::: tip OpenAI estuvo caído 30 minutos. Mi IA no se detuvo ni un segundo.
Durante el último hipo de 30 minutos de rate-limit de DashScope, nuestro uptime de servicio fue 100%.

Los usuarios vieron sus respuestas llegar limpias — sin toast de error rojo, sin "servicio no disponible, intenta de nuevo". **A mitad de respuesta, a mitad de token**, el runtime rodó silenciosamente al siguiente proveedor sano. El siguiente token después del corte aterrizó normal.

Esto no es "reintento automático" en el sentido de ingeniería. Es **failover que el usuario no puede percibir**.
:::

Todo proveedor que agregas se une a un `AvailableProviderPool` que se sondea al arrancar y se re-sondea ante cambios de config.

- **Fallback automático** — si el proveedor primario devuelve `AUTH_ERROR`, `BILLING`, `MODEL_NOT_FOUND`, `NETWORK` o `5xx`, el runtime rueda hacia adelante al siguiente proveedor de la cadena en lugar de burbujear el error
- **Prioridad por agente** — liga un agente a "OpenAI primero, luego Anthropic, luego DashScope" vía el editor de arrastrar-para-reordenar en `Ajustes → Modelos`
- **Estado del pool en vivo** — insignias verde / ámbar / rojo muestran la salud de cada proveedor
- **Sonda de 5 protocolos** — DashScope, OpenAI-compatible, Anthropic, Gemini, estilo-Ollama
- **Re-sondeo manual + auto-re-sondeo ante cambios de config** — sin reinicio tras rotar una clave
- **Sanitizador de egreso** — las opciones específicas de proveedor (p. ej., `reasoning_effort` para modelos de razonamiento OpenAI) se quitan al egreso cuando se hace failover a un proveedor que no las soporta, para que opciones filtradas no puedan causar un 400 en el fallback
- **La UI distingue 401 de expiración de sesión** — los errores de auth del proveedor y la expiración de sesión del usuario ahora muestran mensajes distintos con remediación distinta

### Recuperación de errores dirigida por política y backoff consciente de rate-limit (2.0.0+)

El failover decide *a quién cambiar*; 2.0.0 también hace que *cómo se recupera cada error* sea un asunto de **clasificación-como-política** — cada tipo de error lleva sus atributos de recuperación (reintentable, comprimir contexto, rotar, fallar de vuelta), y el bucle de reintentos consume la política en lugar de dispersar cadenas de ifs. Las semánticas clave:

- **"Servidor sobrecargado" y "mi clave está rate-limiteada" se tratan distinto.** Una clase OVERLOADED nueva: la **sobrecarga de servidor** 503/529 significa que todos están en cola — cambiar de proveedor solo quema toda la cadena para nada (y los usuarios de una sola clave no tienen a dónde cambiar) — así que el movimiento correcto es **hacer backoff en el mismo proveedor**; un 429 en **tu propia clave** es lo que merece una rotación rápida. Antes se confundían con políticas opuestas.
- **Cuando el proveedor dice cuándo se recupera, le creemos.** Los encabezados de respuesta `Retry-After` / ratelimit-reset antes solo iban a logs; ahora **alimentan directamente la duración del backoff y el enfriamiento de salud** — se acabó el backoff ciego contra una ventana de rate-limit conocida.
- **La expulsión es un enfriamiento TTL, no una sentencia de muerte.** Los proveedores expulsados duramente por fallos de auth o billing ahora obtienen readmisión basada en TTL (cambia una clave nueva o recarga la cuenta y el sistema se cura solo, sin reinicio requerido); un tiempo de recuperación declarado por el proveedor sobrescribe el default.
- **Jitter aleatorizado previene tormentas de reintentos.** Conversaciones concurrentes que golpean al mismo proveedor rate-limiteado hacen backoff con jitter aleatorizado (±30% en los niveles de backoff por sobrecarga, backoff exponencial más un componente aleatorio en el camino genérico) — se acabaron los reintentos masivos en compás que siguen re-disparando el límite.

### El proveedor preferido decide el modelo primario (1.5.0)

Antes de 1.5.0, la "prioridad por agente" solo afectaba el **orden de failover** — el modelo primario seguía siendo el default global. 1.5.0 hace que esa preferencia **realmente decida la selección del modelo primario**. La precedencia completa es:

1. **Gana un modelo fijado por conversación** — el ModelSelector del encabezado del chat ligó un modelo a esta conversación, así se usa (ver [selección de modelo por conversación](./chat))
2. **luego el override de modelo por agente (`modelName`)** — el empleado tiene un modelo fijado
3. **luego el modelo por defecto global**
4. **solo cuando ninguno de esos está definido entra el enrutamiento por proveedor preferido** — eligiendo el modelo primario del proveedor preferido

El enrutamiento por proveedor preferido tiene una **compuerta de capacidad**: si los skills ligados del empleado declaran una necesidad como `requires-model: vision`, el enrutamiento primero elige un proveedor que pueda satisfacer esas modalidades; solo si ninguno puede cae sin restricciones. Las preferencias se almacenan en `mate_agent_provider_preference` (`sortOrder` ascendente = mayor prioridad).

---

## Configuración vía API

```bash
# Listar proveedores habilitados (lo que muestra la lista principal)
curl http://localhost:18088/api/v1/models \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Listar el catálogo completo (incluyendo deshabilitados) — lo que usa el cajón Agregar Proveedor
curl http://localhost:18088/api/v1/models/catalog \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Habilitar un proveedor
curl -X POST http://localhost:18088/api/v1/models/{providerId}/enable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Deshabilitar un proveedor (auto-cambia el modelo default si es necesario)
curl -X POST http://localhost:18088/api/v1/models/{providerId}/disable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Agregar una configuración de modelo
curl -X POST http://localhost:18088/api/v1/models \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": 1,
    "modelName": "qwen-plus",
    "displayName": "Qwen Plus",
    "temperature": 0.7,
    "maxTokens": 4096,
    "groupName": "Fast",
    "enabled": true
  }'

# Establecer modelo activo
curl -X PUT http://localhost:18088/api/v1/models/active \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"providerId": "openai", "model": "gpt-4o"}'

# Descubrir modelos
curl -X POST http://localhost:18088/api/v1/models/{providerId}/discover \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Probar conexión
curl -X POST http://localhost:18088/api/v1/models/{providerId}/test-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Todo pasa por la UI

::: tip
**La configuración de modelos es 100% dirigida por la UI.** No hay YAML `spring.ai.*` que tocar. Todos los proveedores, todas las claves API, todas las configs de modelo, todo el cambio — todo vive en `Ajustes → Modelos`, respaldado por las tablas de base de datos `mate_model_provider` y `mate_model_config`.
:::

La UI maneja todo lo que de otro modo harías en YAML, más varias cosas que YAML no puede hacer:

- **Agregar un proveedor** — elige un tipo, pega una clave, guarda. Cifrada en reposo, enmascarada en la UI.
- **Probar conexión** — verifica un proveedor antes de confiarlo en producción.
- **Descubrir modelos** — para proveedores que soportan `/v1/models`, un clic trae la lista completa.
- **Prueba por modelo** — envía un prompt de prueba y ve la respuesta exacta, latencia y uso de tokens.
- **Cambiar el modelo activo en runtime** — sin reinicio, sin recarga de config, surte efecto en el siguiente mensaje.
- **Override por agente** — liga un agente específico a una config de modelo específica.

Las claves API de LLM **ya no se leen de variables de entorno** — definir `DASHSCOPE_API_KEY` / `OPENAI_API_KEY` y similares no tiene efecto. Todo proveedor, clave y modelo vive en la UI. Una instalación fresca arranca sin proveedores configurados; agrega tu primero en `Ajustes → Modelos → Agregar Proveedor`.

### Referencia: qué modelo Qwen elegir

Si estás en DashScope, esta es la forma aproximada de la alineación:

| Modelo | Contexto | Mejor para |
|-------|---------|----------|
| `qwen-max` | 32K | Razonamiento complejo, análisis |
| `qwen-plus` | 32K | Propósito general |
| `qwen-turbo` | 8K | Respuestas rápidas |
| `qwen-vl-max` | 32K | Visión + lenguaje |
| `qwen-long` | 1M | Documentos muy largos |

---

## Ventanas de contexto por modelo (2.1.0+)

AuraClaw ya no trata a todo modelo como una ventana global de 128K. La resolución en runtime sigue **override de operador → sonda de modelo local en vivo o caché de error de límite del proveedor → catálogo de modelos integrado → el fallback global existente**. Para evitar I/O, el renderizado de listas de modelos muestra solo valores de override o catálogo; los modelos desconocidos siguen usando el default global del llamador. El resultado presupuesta prompts de sistema, memoria, contexto Wiki, historial y esquemas de herramientas.

- los modelos conocidos, incluyendo GLM-5V-Turbo y alias de codificación de Kimi, usan ventanas catalogadas;
- los modelos personalizados/privados pueden declarar un conteo máximo preciso de tokens de entrada en la gestión de modelos;
- la API es `PUT /api/v1/models/{providerId}/models/context-window` con `modelId` y `maxInputTokens`; null o no-positivo limpia el override;
- los miembros del workspace que leen opciones de ligadura de proveedores reciben solo id/nombre visible, nunca claves ni ajustes de conexión.

El camino OpenAI-compatible también preserva `integer` / `number` en los JSON Schemas de herramientas. Solo las entradas no reservadas de nivel superior de `generateKwargs` pasan al cuerpo de la solicitud; temperatura, límites de tokens, `topP`, `reasoningEffort`, búsqueda, encabezados y claves de ruta usan un lector de claves reservadas consistente. Las claves anidadas `chatOptions` desconocidas no se reenvían, y `reasoningEffort` se envía solo a familias de modelos explícitamente soportadas.

---

## Siguiente

- [Configuración](./config) — referencia completa de configuración
- [Agentes](./agents) — cómo usan modelos los agentes
- [Consola de Administración](./console) — UI para la gestión de modelos
