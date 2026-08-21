---
title: IA Ambiental — Te Encuentra a Ti. No la Abres.
description: Cron jobs + entrega multicanal = IA ambiental. Empuja tu briefing matutino a Feishu, alerta a tu DingTalk cuando un competidor lanza algo, deja que la IA aparezca donde se necesita sin que recuerdes preguntar.
head:
  - - meta
    - name: keywords
      content: IA ambiental,IA proactiva,cron jobs,entrega multicanal,briefing Feishu,push DingTalk,bot Slack,agente programado,briefing matutino
---

# IA Ambiental

**Te encuentra a ti. No la abres.**

ChatGPT, Claude, Gemini — todo asistente de IA espera a que lo abras. Abre el navegador, inicia sesión, haz clic en la caja de entrada, escribe, espera. La IA es algo a lo que tienes que caminar.

AuraClaw no.

Puedes hacer que cualquier agente aparezca en cualquier momento, en cualquier messenger que uses, **y te encuentre**.

```
Diario 9:00 AM: Agente de briefing → sala de ingeniería en Feishu
Semanal lunes 10:00: Agente de ventas → canal de Slack
4:00 AM fallo de job → agente de operaciones → DM en DingTalk
```

Esta es la mejora de **IA conversacional** a **IA proactiva**. La llamamos **IA Ambiental** — no se sienta en una pestaña del navegador esperándote. **Vive dentro de tu flujo de trabajo.**

---

## Qué está pasando realmente

Tres cosas cableadas juntas:

1. **Cron jobs** — un scheduler que sabe correr agentes (tablas `mate_cron_job`, `mate_cron_job_run`)
2. **El agente corre** — cuando el trigger se dispara, el scheduler levanta un contexto de agente y corre la cadena completa de herramientas (buscar, raspar, leer Wiki, consultar base de datos, …)
3. **El resultado se entrega a través de un canal** — la salida del agente fluye por `CronJobCompletedEvent` → `CronDeliveryListener` → `ChannelCronResultDelivery`, aterrizando en el canal que configuraste

Nadie está mirando. Lo configuras una vez y la IA empieza a presentarse a trabajar a tiempo.

---

## Tres patrones que simplemente funcionan

### 1. Briefing diario

> Cada día a las 9:00 AM, un agente de inteligencia competitiva corre: busca los releases lanzados ayer, lee los blogs de 5 empresas objetivo, diffea las últimas 24 horas, destila las tres cosas más importantes en Markdown, empuja a la sala de ingeniería en Feishu.

`Cron 0 0 9 * * ?` · `Agente: CompIntel` · `Canal: Feishu — Ingeniería`

Vas sentado en el metro, tu teléfono vibra, lees las tres cosas. Antes de llegar a tu escritorio ya sabes de qué trata el día.

### 2. Resumen semanal

> Cada lunes a las 10:00 AM, el agente asistente de ventas consulta la base de datos de pedidos de la semana pasada, extrae métricas clave, escribe un resumen con tablas y lo empuja a un canal de Slack.

Los datos vienen a través de las [herramientas de fuentes de datos](./config); el agente escribe SQL y explica el resultado. Si resúmenes pasados viven en tu Wiki, se auto-citan como comparación.

### 3. Alertas disparadas por eventos

> Un correo nuevo aterriza con la etiqueta "Jefe" → un agente asistente ejecutivo → resume el correo y redacta una respuesta → empuja a WeChat.

Los disparadores de eventos cabalgan un cron de alta frecuencia con un chequeo de condición, o cablean un webhook externo a través de una [herramienta MCP](./mcp). El agente corre por la misma cadena de entrega a un canal.

---

## Configurándolo

`Consola → Cron Jobs → Nuevo` — tres pasos:

1. **Expresión cron** — cuándo corre (cron estándar de 6 campos, con un constructor de UI)
2. **Agente** — elige un agente ya configurado con las herramientas y el prompt de sistema correctos
3. **Canal de salida** — elige un [canal](./channels) para el resultado (Feishu / DingTalk / Slack / WeCom / Telegram / cualquier canal configurado)

Guarda. La próxima vez que el trigger se dispare, el agente va a trabajar.

::: tip No configures 100 crons
La misma regla que la gestión de modelos — no necesitas 100 tareas programadas, necesitas **una que realmente ayude**. Empieza con el briefing de las 9 AM. Córrelo dos semanas. Ve qué realmente lees y qué es ruido. Luego agrega la segunda.
:::

---

## Por qué esto importa

La gran persecución de 2025–2026 en IA fue la misma cosa — **hacer que no tengas que abrir una pantalla.**

- **Vision Pro** intentó poner la IA en tu campo de visión. No aterrizó.
- **Humane AI Pin** intentó poner la IA en tu cuerpo. Quebró.
- **Echo / Alexa** intentó poner la IA en tu casa. Se estancó en "¿qué clima hay?".

Todos intentaron hacerlo con hardware nuevo.

La respuesta de AuraClaw es la opuesta: **los messengers que tu equipo ya usa son el hardware.**

Feishu, DingTalk, WeCom, Slack, Telegram, Discord, QQ — ya están abiertos en tu teléfono y tu escritorio. La IA apareciendo donde ya estás mirando es suficiente. **Sin dispositivo nuevo. Sin hábito nuevo.**

---

## Qué es distinto de otros productos de IA

| | IA conversacional | IA Ambiental (AuraClaw) |
|---|---|---|
| Cómo se dispara | La abres | Aparece en el momento correcto |
| Dónde vive | Una pestaña del navegador | El IM que ya usas |
| Cuándo habla | Solo cuando le preguntan | Cuando la necesitas |
| Cuando estás offline | Te lo pierdes | Empuja cuando vuelves |
| Cuando algo falla | Toast de error rojo | Auto-reconexión, el próximo push aterriza limpio |

Solo AuraClaw llena la columna derecha por completo, porque solo AuraClaw tiene todo esto a la vez:

- **Runtime multi-agente** (ReAct + Plan-Execute)
- **Programación cron + reintento**
- **8 adaptadores de canal IM** con reconexión por backoff exponencial
- **Memoria persistente** ([Memoria](./memory) — Soñar hace que te conozca mejor cada día)
- **Capa de conocimiento Wiki** ([LLM Wiki](./wiki) — le da al agente algo sobre lo que basar la investigación)
- **Tool Guard** ([Seguridad](./security) — las operaciones sensibles aún te preguntan primero)

El cron es la última pieza que ata el resto — **acceso disparado por tiempo** a todo ello.

---

## Consideraciones de seguridad

Proactivo = permisos más estrictos necesarios. Un agente disparado por cron corre sin supervisión. Cualquier permiso de herramienta que tenga, lo usará — no hay un momento de "déjame verificar".

Así que:

- **Los agentes de cron no evaden Tool Guard.** Las llamadas a herramientas que necesitan aprobación siguen pausándose y esperando a que apruebes en tu IM. Ver [flujo de aprobación](./security#approval-workflow-human-in-the-loop).
- Si no quieres que te interrumpan, pon las herramientas sensibles en `deny` en lugar de `require_approval` — el agente se detendrá en seco en lugar de enviarte una solicitud de aprobación.
- **Cada corrida de cron está en el log de auditoría** (`mate_audit_event`) — qué tarea a qué hora usó qué herramienta para hacer qué.

---

## Datos subyacentes (si tienes curiosidad)

| Tabla | Propósito |
|---|---|
| `mate_cron_job` | Una fila por tarea programada — ID de agente, expresión cron, canal destino, timeout, flag habilitada |
| `mate_cron_job_run` | Una fila por ejecución — hora de inicio/fin, estado, resumen de salida, error si lo hay |

Código:

- `vip.mate.cron.service.CronJobLifecycleService` — gestión del ciclo de vida de tareas
- `vip.mate.cron.service.CronJobRunner` — ejecución individual
- `vip.mate.cron.delivery.ChannelCronResultDelivery` — enruta la salida del agente al canal
- `vip.mate.cron.delivery.CronDeliveryListener` — escucha `CronJobCompletedEvent`
- `vip.mate.cron.CronChatOriginFactory` — etiqueta las conversaciones con "esto vino del cron job X" para que las sesiones queden rastreables

### API

```bash
# Listar todos los cron jobs
curl http://localhost:18088/api/v1/cron-jobs \
  -H "Authorization: Bearer <token>"

# Correr una vez ahora (no afecta la siguiente corrida programada)
curl -X POST http://localhost:18088/api/v1/cron-jobs/{id}/run \
  -H "Authorization: Bearer <token>"

# Ver el historial de ejecución de un cron job
curl http://localhost:18088/api/v1/dashboard/cron-runs/{id} \
  -H "Authorization: Bearer <token>"

# Ver el historial de ejecución reciente en el workspace actual
curl http://localhost:18088/api/v1/dashboard/cron-runs \
  -H "Authorization: Bearer <token>"
```

---

## Siguiente

- [Canales](./channels) — dónde se entrega la salida de la IA
- [Agentes](./agents) — el cron programa el agente que hayas configurado
- [Seguridad y Aprobación](./security) — evita que el cron corra operaciones sensibles sin supervisión
- [LLM Wiki](./wiki) — dale al agente de cron una base de conocimiento para investigar
