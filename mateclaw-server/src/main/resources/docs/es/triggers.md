# Triggers

::: tip Nuevo en 1.3.0
El sistema de triggers está disponible desde v1.3.0. En v1.2.0 y antes, los workflows y las conversaciones de agentes solo podían invocarse manualmente.
:::

**Qué son los triggers**: un conector entre "eventos que ocurren en el sistema" y "acciones a realizar". Los eventos pueden ser un horario cron, un webhook llegando, un mensaje de canal, un empleado terminando una conversación, u otro workflow completándose. Las acciones son iniciar un workflow o enviar un mensaje a un empleado para procesamiento.

**Qué no son los triggers**:
- No un reemplazo del gestor de cron jobs — `mate_cron_job` sigue existiendo y corre independientemente; los triggers **comparten** su base de ShedLock + scheduler pero **no escriben** en `mate_cron_job`
- No un constructor de automatización de arrastrar-y-editar estilo IFTTT / n8n — los triggers solo hacen enrutamiento "evento → acción"; la lógica compleja pertenece a [Workflow](./workflow)
- No un despachador de webhooks con todas las funciones — manejan dedup / rate-limit / filtrado de bot-self / coincidencia de patrones, no parsing de payloads de negocio arbitrarios

::: warning Alcance de v1.3.0
v0 = 6 tipos de patrón + 2 destinos de despacho (agente / workflow). La gobernanza de eventos (dedup, rate limit por trigger, guarda de recursión, filtrado de bot-self) está encendida por defecto.
:::

---

## Panorama en un minuto

```jsonc
// Un trigger que corre un workflow de "reporte matutino" diario a las 9 AM
{
  "name": "daily-morning-report",
  "patternType": "cron",
  "patternJson": {
    "cronExpression": "0 0 9 * * *",
    "timezone": "Asia/Shanghai"
  },
  "targetType": "workflow",
  "targetId": 12345,
  "payloadTemplate": "{ \"date\": \"{{ now | date('yyyy-MM-dd') }}\" }",
  "rateLimitPerMin": 10,
  "dedupWindowSecs": 60,
  "botSelfFilter": true,
  "enabled": true
}
```

A las 9 AM → el backend toma el ShedLock vía `CronDelegationPort` → renderiza el payload → encola una corrida asíncrona del workflow `12345`. Otras instancias en el mismo momento están bloqueadas por el lock; sin doble disparo.

---

## Seis tipos de patrón

Implementados en `TriggerPatternMatcher.java`. Cada patrón coincide con su bloque `pattern_json` en la fila del trigger. **Los campos no listados aquí se ignoran** por el matcher de v0.

| Patrón | Cuándo se dispara | Campos de `pattern_json` | Restricción de reutilización |
|---|---|---|---|
| `cron` | Ante una expresión cron (**no fluye por ingest**; corre desde el scheduler) | `cronExpression`, `timezone` | Reutiliza el ShedLock + Spring TaskScheduler del módulo `cron/`; **NO escribe en mate_cron_job, NO llama a CronJobService** |
| `webhook` | Paso genérico de eventos (**v0 no hace filtrado adicional** — el chequeo de secreto ocurre en la capa de canal; el trigger solo coincide con `patternType=webhook`) | (ninguno en v0) | Vía la entrada unificada `POST /api/v1/triggers/events` + envoltura de sobre |
| `channel_message` | El canal recibe un mensaje | `channelType` (opcional, comparado contra el `data.channelType` del sobre), `senderEquals` (opcional, coincidencia exacta de id de remitente) | Canal lateral a través de `ChannelWebhookController`; el enrutamiento original no se ve afectado |
| `agent_lifecycle` | Eventos de ciclo de vida del agente | `agentId` (opcional), `phase` (opcional: `spawned` / `enabled` / `disabled` / `terminated`; `crashed` reservado para un release futuro) | Cuelga de `AgentLifecycleEventBridge` |
| `content_match` | Un substring debe aparecer en el contenido del sobre | `substring` (**requerido**, coincidencia de contains insensible a mayúsculas contra el `data.content` del sobre) | Filtro de contenido genérico; la fuente del evento es lo que sea que alimentó el sobre |
| `workflow_completion` | Una corrida de workflow alcanza un estado terminal | `sourceWorkflowId` (opcional), `stateFilter` (opcional: `completed` / `failed` / `any`) | Escucha los eventos terminales de `WorkflowEngine`; guarda de recursión abajo |

> **Los tipos de patrón desconocidos fallan cerrados por defecto** — los tipos con typo o futuros no pueden disparar silenciosamente todo trigger del workspace.
>
> **No en v1.3.0**: `schedule` (de un solo disparo no-cron como "30 minutos desde ahora"), listeners MQ externos (Kafka / Pulsar / RocketMQ), triggers de alertas por métricas / umbrales.

---

## Gobernanza de eventos (encendida por defecto)

### Filtrado de mensajes bot-self (el binding por defecto es no-op)

Algunos canales (Feishu / DingTalk / WeCom) devuelven los mensajes emitidos por el bot como eventos `channel_message`. El framework lo cablea a través del SPI `BotSelfFilter` + el campo `bot_self_filter` de cada trigger (default `true`).

::: warning La implementación por defecto de v0 es no-op
El `NoopBotSelfFilter` ligado por defecto devuelve `false` de `isBotSelf(...)` para todo remitente. Eso significa que `bot_self_filter=true` en un trigger **en realidad no filtra nada en v0** hasta que un adaptador de canal registre un Spring Bean `BotSelfFilter` real (que reemplace al default). Es intencional — un default incorrecto se tragaría silenciosamente todos los mensajes legítimos bot-a-bot.
:::

Para eximir a un solo trigger del filtro del framework (raro — p. ej. un bot emitiendo un comando especial para disparar limpieza), pon el `bot_self_filter` de ese trigger en `false`.

### Dedup de eventos

Cuando `TriggerEventIngestService` despacha un evento, el motor consulta `mate_trigger_event` por el `dedup_key` dentro de la ventana `dedupWindowSecs` (default 60s). Ya presente → **descartado**, `fire_count` no se incrementa.

Default `dedupWindowSecs = 60`. Súbelo para absorber re-entregas más largas del gateway; ponlo en `0` para deshabilitar (**no recomendado**).

### Rate limit por trigger

Cada trigger tiene rate limit individual: como máximo `rateLimitPerMin` por minuto (default 10). Los eventos pasados el tope se descartan — **sin reintento**, **sin fila en `mate_trigger_event`**; en su lugar `mate_trigger.last_error` se actualiza a `"rate-limited"` para que ops lo vea.

Los triggers `channel_message` normalmente quieren esto subido (ráfagas de grupo); los triggers `workflow_completion` normalmente lo quieren bajado (para frenar cadenas A→B→A).

### Guarda de recursión

Un trigger `workflow_completion` dispara un workflow que dispara otro `workflow_completion`… longitud de cadena de despacho > 5 → el motor corta + alerta. Pretende romper bucles de "A escribe un mensaje que dispara B, B escribe un mensaje que dispara A".

### Timing del ACK de webhook

La entrada HTTP (`POST /api/v1/triggers/events`) → envoltura de sobre → chequeo de dedup → chequeo de bot-self → chequeo de rate-limit → **ACK 200 inmediato** → despacho asíncrono. Implicaciones:

- Los gateways upstream (Feishu / DingTalk etc.) reciben 200 y dejan de re-entregar
- Los fallos de despacho → `mate_trigger.last_error` se actualiza; el mismo `dedup_key` al reintentar sigue deduplicado (**sin reintento automático**)

Semántica de "ACK solo tras despacho exitoso" — **no en v0** — fire-and-forget es intencional para el manejo de oleadas.

---

## Gestionando triggers desde la UI

::: tip Cambio 1.4.0: fusionado en el Scheduler
Desde v1.4.0, **Trabajos Programados** y **Triggers** se fusionan en una sola página **Scheduler** (`Ajustes → Scheduler`, ruta `/settings/scheduler`) con tres pestañas: **Trabajos Programados** / **Triggers de Eventos** / **Historial de Corridas**. Cada pestaña muestra un conteo de ítems junto a su título; el botón de acción arriba a la derecha es contextual (es "Nuevo" en las pestañas de Trabajos Programados / Triggers de Eventos, "Refrescar" en la de Historial); el Historial de Corridas **abarca ambos** — los registros de ejecución tanto de trabajos programados como de triggers viven aquí.

Las rutas viejas redirigen automáticamente: `/cron-jobs` y `/settings/triggers` aterrizan cada una en la pestaña correspondiente del Scheduler.
:::

### Punto de entrada

`Ajustes → Scheduler` — pestaña **Triggers de Eventos**.

Todo trabajo en la pestaña **Trabajos Programados** del Scheduler tiene un `task_type` que decide qué hace cuando corre. Esta es la lista autoritativa de tipos de tarea cron (los seis tipos de patrón de triggers de eventos están cubiertos arriba):

| task type | Comportamiento | ¿Liga un empleado? | Notas |
|---|---|---|---|
| `text` / `agent` / `reminder` | Inicia una conversación de empleado en el horario cron | **Sí** (agente requerido) | Conversación programada clásica; el resultado se enruta a la conversación |
| `wiki_process` | Procesa una base de conocimiento offline en el horario cron | **No** | Nuevo en 1.4.0 — ver abajo |

### `wiki_process`: procesamiento de KB fuera de horas pico (nuevo en 1.4.0)

`wiki_process` te deja programar el **procesamiento de bases de conocimiento** para correr offline durante ventanas de bajo tráfico en lugar de saturar la cola de procesamiento en el momento en que una subida termina. **No liga ningún empleado** — es una tarea de sistema: sin conversación, sin chat.

Al crear una solo llenas:

- **expresión cron** (usa el editor visual de arriba, de 5 campos)
- **Selector de KB** — qué KB procesa este job
- un toggle opcional **"forzar reprocesamiento"** — encendido, los materiales crudos ya procesados también se re-corren (`force`)

En cada tick, el job **encola asíncronamente** los materiales crudos de esa KB para procesamiento y registra una fila en el Historial de Corridas, de la forma `queued N raw material(s)` (se anexa un sufijo `(force)` cuando force está encendido). **Nota que no se enruta a ninguna conversación** — solo entrega trabajo a la cola de procesamiento; revisa el progreso en la página [LLM Wiki](./wiki).

### Plantilla de payload

El campo `payload_template` es una cadena de plantilla Pebble; la salida renderizada se vuelve la entrada al destino de despacho (conversación de agente o corrida de workflow).

```jsonc
"payload_template": "{
  \"date\": \"{{ now | date('yyyy-MM-dd') }}\",
  \"trigger\": \"{{ trigger.name }}\",
  \"sourceEvent\": {{ event | toJson }}
}"
```

Variables en la plantilla:
- `now` — hora actual
- `trigger.{name,id,workspaceId}` — el trigger que dispara
- `event` — el sobre de evento actual (`workspaceId` / `senderId` / `data` JSON, etc.)

### Inspeccionando el historial de disparos

`mate_trigger_event` es **solo metadatos de dedup** — una fila por evento aceptado con `trigger_id` / `dedup_key` / `received_at` / `expires_at`, y **sin copia del sobre mismo**. Para auditar el contenido real de un evento particular, mira los logs de la capa de canal + los registros de corrida del agente / workflow.

`mate_trigger.fire_count` registra honestamente el conteo de despachos (excluyendo eventos deduplicados / rate-limiteados); `mate_trigger.last_error` lleva la razón de fallo más reciente.

---

## Referencia de API

Todos los endpoints bajo `/api/v1/triggers/`. **Lo que v1.3.0 realmente expone** — las entradas `/webhook/{slug}` / `/test-fire` / `/{id}/events` del RFC aún no están implementadas.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/triggers` | Lista todos los triggers del workspace actual |
| `GET` | `/api/v1/triggers/{id}` | Obtener detalles |
| `POST` | `/api/v1/triggers` | Crear un trigger nuevo; con `enabled=true`, se registra con el scheduler / router de inmediato |
| `PUT` | `/api/v1/triggers/{id}` | Actualizar (incluyendo habilitar / deshabilitar — voltea el campo `enabled`); ante cambio de `pattern_json`, `pattern_version++` y los futures obsoletos se auto-cancelan entre instancias |
| `DELETE` | `/api/v1/triggers/{id}` | Borrado suave (equivalente a deshabilitar) |
| `POST` | `/api/v1/triggers/events` | **Entrada de eventos unificada** — cualquier webhook / adaptador de canal / módulo interno entrega un sobre al motor; el motor corre dedup / bot-self / rate limit / coincidencia de patrón / despacho y devuelve un resumen de disparos / descartes por trigger |

---

## Relación con el módulo cron existente

::: tip Reutilizar, no reemplazar
Antes de v1.3.0 AuraClaw ya tenía un subsistema cron independiente (tabla `mate_cron_job` + `CronJobService`). El sistema de triggers **no lo reemplaza** —
- Los cron jobs legacy (`task_type = text / agent / reminder`) siguen en la página de Cron Jobs
- Los cron de triggers nuevos viven en la página de Triggers
- Ambos **comparten** la tabla de lock ShedLock subyacente + el pool de hilos Spring TaskScheduler
- La lista `mate_cron_job` **no muestra** los cron de triggers, y viceversa
:::

¿Por qué no fusionarlos? Porque el esquema legacy de `mate_cron_job` (`task_type` / `agentId` requeridos, etc.) no encaja con un destino de workflow. Forzar columnas extra rompería invariantes de producto existentes. `CronDelegationPort` es la solución mínima de v0 — compartir la base del scheduler, dividir la capa de persistencia. Plegar `mate_cron_job` completamente en trigger es una iteración futura.

---

## Consistencia entre instancias (despliegue multi-replica)

Los métodos de `CronDelegationPort` son **locales al proceso** — el `ScheduledFuture` local vive solo en esta JVM, sin handle persistido. La consistencia entre instancias se apoya en:

1. Toda instancia, al arrancar, llama `syncFromDatabase()` para escanear todos los cron triggers habilitados y registrarlos localmente
2. Cuando un trigger se actualiza, `pattern_version++` + cancelar el future local
3. Cada disparo re-lee la fila del trigger antes de ejecutar; `patternVersion` desajustado → **cortocircuito local + auto-cancelación** (significa que otra instancia lo modificó)
4. Clave ShedLock = `"mate-trigger-{triggerId}"`, mutuamente exclusiva entre instancias
5. `@Scheduled(fixedDelay=60s) syncFromDatabase()` periódico como reconciliador de respaldo

Implicación práctica: desplegar múltiples réplicas en rolling no necesita pasos extra — las instancias nuevas lo recogen automáticamente; las viejas terminan su último ciclo y se detienen.

---

## Modelo de datos

### `mate_trigger` — configuración del trigger

Campos clave:

| Campo | Tipo | Propósito |
|---|---|---|
| `pattern_type` | varchar | Uno de los seis patrones |
| `pattern_json` | TEXT | Los parámetros de filtro del patrón como JSON |
| `target_type` | varchar | `agent` o `workflow` |
| `target_id` | bigint | Clave foránea al agente / workflow |
| `payload_template` | TEXT | Plantilla de renderizado Pebble |
| `dedup_window_secs` | int | Ventana de dedup en segundos |
| `rate_limit_per_min` | int | Máximo de disparos por minuto |
| `bot_self_filter` | bool | Habilita el filtro de bot-self (default `true`, pero la impl por defecto es no-op) |
| `pattern_version` | bigint | Contador Lamport de concurrencia optimista; se auto-incrementa en todo cambio de `pattern_json`; los disparos entre instancias comparan antes de ejecutar y se auto-cancelan ante desajuste |
| `fire_count` | bigint | Conteo de despachos efectivos (excluyendo descartes por dedup / rate-limit) |
| `last_error` | varchar | Razón de fallo más reciente (`"rate-limited"` / mensajes de excepción) |
| `enabled` | bool | Encendido/apagado suave |
| `deleted` | int | Borrado suave |

### `mate_trigger_event` — metadatos de dedup

Usada solo para decisiones de dedup. **No almacena copias del sobre**:

| Campo | Tipo | Propósito |
|---|---|---|
| `id` | bigint | Clave primaria |
| `trigger_id` | bigint | Trigger contra el que esta fila deduplica |
| `dedup_key` | varchar | **Índice único**; el motor lo consulta dentro de `dedup_window_secs` |
| `received_at` | timestamp | Hora de inserción |
| `expires_at` | timestamp | Expiración de la ventana; la misma clave puede re-entrar después de este punto |

::: tip Compensación de diseño
v0 deliberadamente **no persiste sobres dentro de `mate_trigger_event`** — los eventos de canal a volumen completo aplastarían la BD. La auditoría de payloads de eventos se apoya en los logs de la capa de canal + los registros de corrida del lado del agente / workflow. Si "replay de eventos" se vuelve una necesidad real, se agrega una columna de sobre después.
:::

---

## Limitaciones conocidas (v1.3.0)

- **Sin visualización de cadenas trigger → workflow** — múltiples triggers despachando al mismo workflow aparecen como dos listas independientes en la UI
- **Sin prioridad / dependencia entre triggers** — cuando un evento golpea múltiples triggers, los despachos se serializan por id de BD ascendente
- **Sin entrada de webhook dedicada / allowlist de IP** — no hay ruta `/webhook/{slug}` en v0; `/events` es la entrada unificada. El control de IP más estricto pertenece al nginx / gateway de entrada
- **La fase de `agent_lifecycle` solo cubre operaciones CRUD** — las fases realmente emitidas son `spawned` / `enabled` / `disabled` / `terminated`; `crashed` (hook de error de runtime) está reservado para un release futuro y nunca se dispara hoy
- **Sin replay de eventos** — `mate_trigger_event` solo persiste metadatos de dedup, no sobres; "re-despachar este evento" requiere que la fuente upstream re-emita

---

## Resolución de problemas

| Síntoma | Investiga |
|---|---|
| El trigger cron no se dispara | 1) ¿`enabled=true`? 2) ¿La expresión cron + zona horaria parsea a un próximo disparo? El editor lo previsualiza. 3) ¿El ShedLock lo tiene otra instancia? Revisa la tabla `shedlock`. |
| `POST /events` devuelve 200 pero no hay despacho | El cuerpo de la respuesta contiene un resumen de disparos / descartes por trigger — busca `BOT_SELF` / `RATE_LIMITED` / `DEDUPED` / `PATTERN_MISMATCH` |
| `channel_message` no se dispara | 1) ¿El `data.channelType` del sobre coincide con el `pattern_json.channelType` de este trigger? 2) ¿`bot_self_filter=true` y un `BotSelfFilter` no-default lo está filtrando? 3) Para `content_match`, el campo `substring` debe aparecer realmente en `data.content` |
| `agent_lifecycle` no se dispara | Confirma que `pattern_json.phase` sea uno de `spawned` / `enabled` / `disabled` / `terminated` (no `started` / `completed` / `failed`); `crashed` está reservado para un release futuro y nunca se emite hoy |
| El trigger cron deja de dispararse tras reiniciar | Mira el log de arranque por errores de `syncFromDatabase()`; causa común es un `pattern_json` corrupto que falla la deserialización |
| `mate_trigger.last_error` dice `"rate-limited"` | Sube `rate_limit_per_min`, o divide el trigger en múltiples particionados por grupo |
| `bot_self_filter=true` parece no filtrar | Confirma que un Spring Bean `BotSelfFilter` no-noop esté registrado — el `NoopBotSelfFilter` por defecto siempre devuelve `false` |

---

## Relacionado

- [Workflow](./workflow) — a dónde van los despachos cuando `target_type=workflow`
- [Agentes](./agents) — a dónde van los despachos cuando `target_type=agent`
- [Canales](./channels) — la fuente de los eventos `channel_message`
- [Seguridad y Aprobación](./security) — secreto de webhook + respaldo de ACL
