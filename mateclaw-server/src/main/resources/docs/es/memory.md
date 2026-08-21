---
title: Sistema de Memoria de IA — Ciclo de Vida de Memoria de 4 Capas (Extraer, Consolidar, Soñar, Recordar)
description: El ciclo de vida de memoria de 4 capas de AuraClaw — contexto en conversación, extracción post-chat, persistencia de workspace (PROFILE.md/MEMORY.md) y consolidación programada llamada Soñar. Tu IA se vuelve más lista cada día.
head:
  - - meta
    - name: keywords
      content: memoria de IA,sistema de memoria,Soñar,PROFILE.md,MEMORY.md,ciclo de vida de memoria,memoria a largo plazo,extracción de memoria,consolidación de memoria
---

# Sistema de Memoria de IA

**La memoria es cómo el sistema mejora en conocerte.**

Todo lo demás en AuraClaw es estático desde el momento en que lo configuras. Agentes, herramientas, bases de conocimiento — cambian cuando tú los cambias. La memoria es la única parte que cambia sola, como subproducto del uso real. Ese es todo el punto.

::: tip Tu IA sueña contigo mientras duermes
Eso no es una frase de marketing. Es código literal en el paquete `memory/dreaming/`.

Cada noche a las 3 AM (por defecto; configurable) corre un job programado — su nombre es **Soñar (Dreaming)**. Recorre el rastro de conversaciones del día de cada agente, consolida señales dispersas en una comprensión coherente de ti, filtra anécdotas únicas, contradicciones y hechos obsoletos, promueve patrones recurrentes a `MEMORY.md`, y anexa "qué vio, qué concluyó, qué reescribió" a `DREAMS.md` — un rastro de auditoría legible de cómo la memoria llegó a donde está hoy.

Cuando abres AuraClaw a la mañana siguiente, **retoma donde terminó ayer** — no desde cero.

> Todas las demás IA empiezan cada día desde cero. AuraClaw continúa desde donde terminó ayer.
:::

Esta página cubre las cuatro capas que componen la memoria, los archivos que el sistema escribe para cada agente, y cómo los propios agentes leen y escriben esos archivos durante una conversación.

---

## Las cuatro capas

```
  ┌────────────────────────────────────────────────────────────┐
  │  1. Este turno                                              │
  │     Lo que dices, lo que se acaba de decir, auto-recortado  │
  │     al presupuesto de tokens del modelo                     │
  │     Se actualiza: cada turno                                │
  └────────────────────────────────────────────────────────────┘
                            │
                            ▼ (tras completarse la conversación)
  ┌────────────────────────────────────────────────────────────┐
  │  2. Extracción post-chat                                    │
  │     Saca de la conversación los fragmentos que vale         │
  │     conservar, los escribe en PROFILE.md / MEMORY.md /      │
  │     la nota de hoy                                          │
  │     Se actualiza: asíncronamente, tras cada chat relevante  │
  └────────────────────────────────────────────────────────────┘
                            │
                            ▼ (diario a las 3:00 AM, configurable)
  ┌────────────────────────────────────────────────────────────┐
  │  3. Consolidación nocturna (Soñar)                          │
  │     Escanea las notas diarias recientes, encuentra patrones │
  │     recurrentes, los fusiona en MEMORY.md, registra la      │
  │     corrida en DREAMS.md                                    │
  │     Se actualiza: programada; disparo manual disponible     │
  └────────────────────────────────────────────────────────────┘
                            │
                            ▼ (la siguiente conversación toma lo último)
  ┌────────────────────────────────────────────────────────────┐
  │  4. Archivos del workspace como prompt de sistema           │
  │     Los cuatro archivos markdown se inyectan en cada turno  │
  │     Se actualiza: los cambios de archivo surten efecto en   │
  │     el siguiente turno                                      │
  └────────────────────────────────────────────────────────────┘
```

Cada capa opera en una escala de tiempo distinta. El corto plazo es *este turno*. La extracción es *después de cada conversación*. La consolidación es *nocturna*. La inyección de archivos del workspace es *cada turno usa lo que esté actual*. Juntas forman un bucle — lo que dices se vuelve contexto, el contexto se vuelve archivos, los archivos se vuelven prompt de sistema, el prompt de sistema se vuelve lo que el agente sabe mañana.

---

## La memoria sabe quién es quién: aislamiento por dueño (1.5.0)

Antes, la memoria de un empleado era **compartida**: ya fueras tú entrando por la web, un colega en un grupo de Feishu, o un usuario final llegando por una API de terceros, la memoria se apilaba en el mismo `MEMORY.md`. Un empleado sirviendo a varias personas cruzaba cables.

1.5.0 le da a cada memoria un **dueño** y un **alcance de visibilidad**.

### Un owner_key unificado

Sea cual sea la fuente de identidad, se normaliza a una cadena prefijada:

| Fuente | owner_key |
|---|---|
| Consola web | `user:<id de usuario>` |
| Canal IM (Feishu / DingTalk / WeCom…) | `<canal>:<id del remitente>` |
| API de terceros (con endUserId) | `api:<endUserId>` |
| Sistema / cron | `system` |

### Tres alcances de visibilidad

| alcance | Quién lo lee | Contenido típico |
|---|---|---|
| **PERSONAL** | Solo el dueño coincidente | La memoria extraída de conversaciones cae aquí por defecto |
| **TEAM** | Todos los que usan este empleado | Archivos de config del agente (AGENTS.md / SOUL.md / PROFILE.md), datos legacy rellenados |
| **GLOBAL** | Siempre visible entre empleados / workspaces | Hechos predefinidos, material de referencia del sistema |

### El recuerdo prefiere la memoria personal

El prompt de sistema hornea solo la memoria compartida TEAM/GLOBAL (cacheable); cada turno luego **pre-extrae** la memoria personal de ese dueño por owner_key. Así, cuando alguien pregunta "qué stack usa mi proyecto", el empleado recuerda primero los archivos de memoria privados de *esa persona*, no material genérico de KB.

> Sobre la capa estructurada de "hechos": la **consulta de recuerdo de hechos en sí soporta filtrado por visibilidad de dueño** (PERSONAL es solo del dueño, TEAM/GLOBAL compartidos). Pero la **proyección automática de hechos** actual se construye principalmente desde archivos de memoria compartidos y no define `ownerKey/scope` al insertar — así que la personalización se nota más en la pre-extracción de archivos de memoria personal; los hechos por dueño todavía se están completando.

### Las APIs de terceros pasan una identidad de usuario final

Los cuerpos de solicitud de `/api/v1/chat` y `/api/v1/chat/stream` ganan un campo opcional **`endUserId`** (una cadena, para preservar precisión de enteros grandes). Una integración autenticada por PAT representa a un usuario de AuraClaw pero puede pasar un `endUserId` distinto por usuario final, y la memoria aísla por usuario final automáticamente.

### Es una feature flag

El interruptor maestro es `mate.memory.lifecycle-mediator-enabled`.

::: warning Ojo con el default
El default pelado de la propiedad Java es `false`, pero el `application.yml` **que se envía con el release lo pone en `true`** — así que el aislamiento por dueño está **encendido por defecto en una instalación por defecto**. Para volver al viejo comportamiento compartido (todas las escrituras a TEAM), ponlo en `false` explícitamente en tu config.
:::

Encendido: la extracción de conversación escribe en la memoria PERSONAL del dueño y el recuerdo filtra por owner_key; apagado, todas las escrituras caen al TEAM compartido. Las instancias multi-tenant se quedan encendidas; los despliegues de un solo usuario pueden apagarlo.

Por debajo: la migración `V137` agrega las columnas `owner_key` + `scope` a `mate_workspace_file` / `mate_memory_recall` / `mate_fact`, rellenando las filas legacy como `TEAM` (para que ninguna memoria quede oculta al actualizar). Las herramientas de memoria como `remember` resuelven el owner_key desde el contexto de solicitud actual — con la flag encendida escriben a la memoria PERSONAL de ese dueño, apagada caen a escrituras compartidas.

---

## Memoria multicapa con proveedores enchufables

La capa de memoria no es una implementación hardcodeada. Es una **interfaz** — la arquitectura multicapa te deja apilar proveedores:

- El **proveedor por defecto** es la memoria basada en archivos de workspace descrita en el resto de esta página. Viene con AuraClaw, y para la mayoría es todo lo que necesitarán.
- **Proveedores personalizados** se pueden conectar para recuperación especializada — memoria a largo plazo basada en vectores, memoria de grafos, servicios externos de memoria.
- **Apilar** significa que un solo agente puede hablar con múltiples proveedores a la vez. Un proveedor de corto plazo devuelve contexto reciente; uno semántico devuelve memorias relacionadas; un proveedor Wiki devuelve referencias autoritativas. Se componen al momento de leer.

Para la mayoría de los agentes, **el default es suficiente** y deberías ignorar esta sección. Si construyes algo especializado — un agente que necesita recordar miles de hechos con búsqueda vectorial, un agente que necesita memoria estructurada en grafos — aquí es donde te conectas. Ver [Arquitectura](./architecture).

---

## Los cuatro archivos que todo agente tiene

Cada agente tiene su propio workspace. Cuatro archivos markdown forman la columna vertebral de la memoria a largo plazo:

```
workspace/{agentId}/
├── AGENTS.md          # Cómo usa la memoria el agente — guía de comportamiento
├── SOUL.md            # Quién es el agente — identidad central, personalidad, límites
├── PROFILE.md         # Quién eres tú — perfil de usuario, preferencias, trasfondo
├── MEMORY.md          # Qué importa — decisiones clave, contexto de proyecto, pendientes
└── memory/
    ├── 2026-04-09.md  # Notas diarias — qué pasó hoy, solo anexar
    ├── 2026-04-10.md
    └── 2026-04-11.md
```

Los primeros cuatro se **inyectan en el prompt de sistema en cada turno** (si `enabled=true`). Las notas diarias no — alimentan la consolidación en su lugar.

### Para qué sirve cada archivo

- **AGENTS.md** — el manual de usuario del agente para sí mismo. Cuándo escribir memoria, qué va a dónde, qué herramientas hay disponibles. Seed: `enabled=true`, `sort_order=0`.
- **SOUL.md** — quién es el agente fundamentalmente. Autoconciencia, guía de evolución, principios de privacidad y límites. Edítalo cuando quieras cambiar el carácter del agente a un nivel profundo. Seed: `enabled=true`, `sort_order=1`.
- **PROFILE.md** — lo que el agente ha aprendido sobre ti. Nombre, ocupación, stack tecnológico, preferencias de comunicación. Actualizado por el extractor cuando las conversaciones revelan algo duradero. Escrituras de reemplazo completo. Seed: `enabled=true`, `sort_order=2`.
- **MEMORY.md** — lo que el agente decidió que importa lo suficiente como para conservar. Proyectos activos, decisiones sin resolver, hilos abiertos, cosas que le pediste recordar. Actualizado tanto por el extractor como por el consolidator. Seed: `enabled=true`, `sort_order=3`.

::: tip Nuevo en 1.3.0: los workflows pueden escribir memoria
Desde v1.3.0, el paso `write_memory` del [workflow](./workflow) puede escribir la salida de la corrida directamente en el `MEMORY.md` de un empleado (o cualquier archivo de memoria habilitado) cuando el flujo termina. Cuatro estrategias de fusión: `append` / `replace_section` / `upsert_kv` / `overwrite`. La memoria ya no se escribe exclusivamente por el extractor de conversaciones o el consolidator Soñar — el resultado de un proceso de negocio también puede persistirse.
:::

### Notas diarias

Destacados de conversación archivados por fecha, en modo anexar — varias conversaciones en un día se concatenan en el mismo archivo. No se inyectan en el prompt de sistema (`enabled=false`). Existen para que el consolidator tenga algo que escanear a las 3 AM.

---

## Corto plazo: la ventana de contexto

Antes de cada llamada al LLM, AuraClaw arma el prompt que realmente se envía:

```
[Prompt de Sistema]                    ← Siempre primero
[Inyección de archivos del workspace]  ← AGENTS / SOUL / PROFILE / MEMORY
[Resumen de contexto de conversación]  ← Solo si turnos anteriores se comprimieron
[Mensaje 1: usuario]
[Mensaje 2: asistente]
...
[Mensaje actual del usuario]           ← Siempre al final
```

Los archivos del workspace se inyectan ordenados por `sort_order`, formateados como:

```
--- AGENTS.md ---
(contenido)

--- SOUL.md ---
(contenido)

--- PROFILE.md ---
(contenido)

--- MEMORY.md ---
(contenido)
```

Solo se incluyen archivos con `enabled=true`.

### Cuando el contexto se hace demasiado grande

Defensa en tres etapas:

**Etapa 1 — compresión proactiva.** Cuando el total estimado excede el 75% del presupuesto (ventana por defecto de 128k tokens), el sistema llama al LLM para resumir los turnos anteriores. La cola se retiene dinámicamente según un presupuesto de tokens, con un piso controlado por `preserve-recent-pairs` y `protect-last-min-messages` (el que sea mayor; por defecto al menos 10 mensajes). El resumen se cachea por 30 minutos.

**Etapa 2 — recuperación de emergencia.** Si el LLM todavía devuelve contexto-demasiado-grande, el sistema deja de llamar al LLM. Descarta los mensajes más viejos, conserva los últimos 2 turnos y reintenta una vez.

**Etapa 3 — recorte duro.** Si los tokens *todavía* están sobre el presupuesto, se descartan mensajes desde el frente hasta que el prompt quepa. Los últimos 2 mensajes siempre se preservan.

> **Diseño de seguridad** — el resumen se inyecta como **mensaje de usuario**, no de sistema. Deliberado: evitar que la entrada histórica comprimida del usuario sea elevada a instrucciones de nivel de sistema elimina un vector de inyección.

### Configuración

```yaml
mate:
  agent:
    conversation:
      window:
        default-max-input-tokens: 128000   # Máximo global
        compact-trigger-ratio: 0.75        # Disparador de compresión
        preserve-recent-pairs: 2           # Turnos preservados textualmente
        summary-max-tokens: 300            # Presupuesto de compresión
```

---

## Extracción post-chat

Después de que una conversación termina, el sistema extrae asíncronamente lo memorable y lo escribe en PROFILE.md, MEMORY.md y la nota diaria del día. Esto ocurre fuera del camino de respuesta al usuario — nunca bloquea el siguiente turno.

### Qué la dispara

Tras completarse un turno, el sistema maneja la extracción en un hilo de fondo. Algunas precondiciones deben pasar antes de que realmente corra:

- El auto-resumen está encendido
- La conversación no fue disparada por el job de consolidación cron (evita recursión)
- La cantidad de mensajes alcanza el mínimo (por defecto 4)
- El último mensaje del usuario es suficientemente largo (por defecto al menos 10 caracteres)

Todo pasa — empieza la extracción.

### Control de concurrencia

- **Enfriamiento** — el mismo agente no extrae dos veces en 5 minutos (por defecto)
- **Lock por agente** — si una extracción ya está corriendo para este agente, la nueva solicitud se salta

### Qué hace realmente el LLM

1. Carga los mensajes de la conversación
2. Lee el PROFILE.md actual, MEMORY.md, la nota diaria de hoy
3. Arma una transcripción: hasta 30 mensajes, cada uno truncado a 2000 caracteres
4. Llama al LLM con las plantillas de prompt de resumen de memoria
5. Parsea la respuesta JSON
6. Aplica las escrituras

### Esquema de respuesta del LLM

| Campo | Tipo | Qué hace |
|-------|------|--------------|
| `should_update` | boolean | Si la memoria necesita actualizarse |
| `reason` | string | Por qué (para auditoría) |
| `daily_entry` | string | Contenido a anexar a la nota diaria de hoy |
| `memory_update` | string | Contenido nuevo completo para MEMORY.md |
| `profile_update` | string | Contenido nuevo completo para PROFILE.md |

### Reglas de escritura de archivos

- **PROFILE.md** — reemplazo completo, solo si `profile_update` no está vacío
- **MEMORY.md** — reemplazo completo, solo si `memory_update` no está vacío
- **memory/YYYY-MM-DD.md** — anexar, creado con encabezado de fecha si falta

---

## Consolidación y soñar

La tercera capa corre en un horario. Su trabajo es ver las notas diarias acumularse y preguntar periódicamente: *¿cuál es el patrón aquí, qué debería promoverse a la memoria central, qué está obsoleto y debería olvidarse?*

### Qué hace

1. Lista los archivos `memory/*.md` del agente, toma los 7 días más recientes
2. Lee esos + el MEMORY.md actual
3. Llama al LLM con las plantillas de prompt de consolidación
4. El LLM devuelve `{should_update, reason, memory_content}`
5. Si `should_update` es true, MEMORY.md se reemplaza por completo

### Métodos de disparo

- **Automático** — cada agente tiene una fila en los jobs programados del sistema, configurada para correr cada noche a las 3 AM
- **Manual** — `POST /api/v1/memory/{agentId}/emergence`

### Por qué no es recursivo

La consolidación dispara una "conversación" a través del agente. Sin protección, esa conversación re-dispararía el listener de extracción post-chat, que dispararía otra conversación, ad infinitum.

El evento lleva una flag de fuente de disparo. El listener de extracción ve que la conversación la inició el job de consolidación y la salta.

### DREAMS.md — el diario de consolidación

Cada corrida de consolidación anexa una entrada corta a `workspace/{agentId}/DREAMS.md`:

- qué miró
- qué patrones encontró
- qué cambió en MEMORY.md
- la fecha

Rastro de auditoría legible por humanos — abre DREAMS.md y ve *cómo* llegó la memoria a su estado actual. Limita su propio crecimiento; las entradas viejas se resumen cuando el archivo excede un umbral.

### Emergencia con puntuación y seguimiento de recuerdos

La consolidación rastrea:

- **Qué entradas de memoria fueron activamente recordadas** en conversaciones recientes — los patrones de lectura se retroalimentan a la importancia
- **Emergencia puntuada** — patrones candidatos rankeados por frecuencia + recencia + recuerdo explícito, solo los de alta puntuación llegan a MEMORY.md
- **Filtrado multi-compuerta** — las extracciones de baja señal (menciones únicas, contradicciones, cosas que el usuario corrigió después) se filtran antes de volverse memoria
- **API de estado de Soñar** — `GET /api/v1/memory/{agentId}/dreaming/status`

### Ciclo de vida completo (opt-in vía flag)

La memoria crece de "soñar cada noche" a un ciclo de vida completo turno por turno. Este comportamiento aterriza detrás de feature flags — apagado por defecto en el build open-source, encendido en builds de producción.

Qué hace:

- **Cada turno se contabiliza** — el sistema toma notas al inicio y al final de cada turno, no solo en la consolidación nocturna
- **Proyección de hechos** — las conversaciones se proyectan a filas estructuradas de "hechos" que el agente puede consultar. Puntuación de confianza + decaimiento integrados.
- **Reporte nocturno estructurado** — la consolidación produce un reporte completo; puedes re-consolidar por tema a demanda
- **Tarjeta de mañana** — la primera conversación del día muestra el reporte de ayer; Confirmas / Editas / Olvidas cada hecho
- **Bandeja de contradicciones** — cuando hechos nuevos entran en conflicto con los viejos, obtienes una cola en lugar de sobrescrituras silenciosas
- **Olvido explícito** — di "olvida eso", y realmente lo olvida, en todas partes
- **Puntuación de retroalimentación** — pulgares arriba/abajo sobre hechos recuperados se retroalimenta a la confianza
- **Auto-evolución de SOUL** — el archivo de persona del agente se reescribe a sí mismo desde los hechos acumulados
- **Archivo mensual** — los reportes viejos ruedan a un archivo mensual comprimido, navegable en la línea de tiempo
- **Navegador de Memoria** — línea de tiempo, hechos, contradicciones, visor de diffs y una barra de confianza arriba

Habilita en `application.yml` (estas flags viven todas bajo `mate.memory`, agrupadas por fase):

```yaml
mate:
  memory:
    # Fase 1: bus de ciclo de vida turno por turno
    lifecycle-mediator-enabled: true
    dream:
      focused-enabled: true        # endpoint de sueño enfocado
      archive-enabled: true        # rotación de archivo mensual
      archive-keep-days: 30
      max-candidates-per-dream: 100
    # Fase 2: auto-evolución de SOUL
    soul-update-interval: 20       # una reescritura de SOUL.md cada 20 escrituras (0 = apagado)
    # Fase 3: proyección de hechos
    fact:
      projection-enabled: true
      projection-rebuild-cron: "0 */30 * * * ?"
      contradiction-check-enabled: false   # detección de contradicciones (experimental, apagado por defecto)
      trust-half-life-days: 60
      forget-enabled: true         # el botón "Olvidar" en la UI
```

> La tarjeta de mañana es un endpoint (`GET /api/v1/memory/{agentId}/dream/morning-card`), no una flag independiente — tiene datos siempre que el ciclo de vida de proyección de hechos + sueño esté encendido.

---

## Acotando el tamaño de la memoria siempre encendida

::: tip Nuevo
La memoria que se inyecta en el prompt de sistema en cada turno — entradas estructuradas `user` / `feedback`, `PROFILE.md`, `MEMORY.md` — tiene un problema silencioso: **solo crece**. A medida que las entradas se acumulan, el costo de tokens de cada ronda sube sin parar. Este grupo de mecanismos pone límites de tamaño deterministas a la memoria siempre encendida.
:::

Tres capas, cada una cubriendo una etapa distinta:

### Presupuesto de inyección (truncar al inyectar, disco intacto)

Cuando las entradas estructuradas `user` / `feedback` se inyectan en el prompt de sistema, se ordenan por su fecha `Updated:` (LRU) y solo se conservan las N más recientes. Las entradas más allá del límite se **descartan al momento de inyectar** — el archivo en disco no se modifica — y el pie del bloque revela cuántas se omitieron.

- `mate.memory.system-block-max-chars` (default `4000`): tope de caracteres para el bloque estructurado siempre encendido; al excederse, las entradas se descartan de las más viejas hacia adelante. `0` = ilimitado.
- `mate.memory.system-block-max-entries-per-type` (default `40`): máximo de entradas inyectadas por tipo (`user` / `feedback`). `0` = ilimitado.

### Consolidación nocturna (encoge archivos en la capa de almacenamiento)

El presupuesto de inyección trunca al inyectar, pero los archivos en disco siguen creciendo. **La consolidación** los compacta en la capa de almacenamiento: un job nocturno (default 03:30, con su propio horario independiente de [Soñar](#consolidation-and-dreaming)) recorre el bucket compartido de cada agente y todos los buckets por dueño, y cuando el conteo de entradas excede el umbral llama al LLM para fusionar entradas casi-duplicadas u obsoletas y escribe el resultado de vuelta.

Un **invariante de seguridad**: el conteo de entradas tras la consolidación solo puede disminuir — si el modelo alucina entradas adicionales, esa escritura se salta por completo.

- `mate.memory.structured-consolidation-enabled` (default `true`): apagado, solo aplica el presupuesto de inyección — sin fusión del lado del almacenamiento.
- `mate.memory.structured-consolidation-min-entries` (default `8`): los buckets con menos entradas que esto se saltan la llamada al LLM para ahorrar costo.
- `mate.memory.structured-consolidation-cron` (default `"0 30 3 * * ?"`): horario independiente; no afecta a Soñar.
- `mate.memory.structured-consolidation-max-owners-per-run` (default `50`): máximo de buckets de dueños procesados por agente por corrida; el resto se difiere a la siguiente corrida. `0` = ilimitado.

Disparo manual: `POST /api/v1/memory/{agentId}/structured-consolidation` — devuelve estadísticas incluyendo `ownersConsolidated`, `updated`, `entriesBefore` y `entriesAfter`.

> No confundas esto con [Soñar](#consolidation-and-dreaming): Soñar fusiona notas diarias en `MEMORY.md` (promoviendo lo que importa); la consolidación deduplica y recorta las entradas estructuradas `user` / `feedback`. Dos jobs distintos, dos horarios distintos.

### Tope de archivo (tope duro determinista al reescribir)

`PROFILE.md` y `MEMORY.md` se reescriben por completo mediante el LLM. El prompt pide concisión, pero no hay restricción dura, así que los archivos aún pueden crecer sin límite. El tope de archivo es el **fallback determinista al momento de escribir**: si el contenido excede el presupuesto, se trunca en el último límite de sección `##` que aún quepa (preservando la cabeza del archivo), y se anexa un marcador de truncamiento.

- `mate.memory.profile-max-chars` (default `4000`): tope duro de caracteres para PROFILE.md. `0` = ilimitado.
- `mate.memory.memory-md-max-chars` (default `8000`): tope duro de caracteres para MEMORY.md. `0` = ilimitado.

---

## Agentes leyendo y escribiendo su propia memoria

La memoria no es solo algo que *le pasa* a un agente. El agente mismo puede leer y escribir activamente sus propios archivos durante una conversación, mediante un conjunto de herramientas de memoria del workspace:

| Método | Qué hace |
|--------|--------------|
| `list_workspace_memory_files` | Lista archivos, filtro opcional por prefijo de nombre, ordenados por `sort_order` |
| `read_workspace_memory_file` | Lee el contenido de un archivo específico |
| `write_workspace_memory_file` | Crea o sobrescribe un archivo (reemplazo completo) |
| `edit_workspace_memory_file` | Edición de buscar-y-reemplazar (incremental, soporta `replaceAll`) |

### Búsqueda por palabra clave sobre su propia memoria

::: tip Nuevo en 1.4.0
Un empleado puede hacer más que leer archivos completos — durante una conversación puede **buscar en todos sus archivos de memoria del workspace por palabra clave** y saltar directo a la línea.
:::

Esta es una capacidad del runtime del agente: el empleado provee una palabra clave y el sistema busca en sus propios archivos de memoria del workspace:

- **Tokenización** — CJK se divide en ventanas deslizantes de 2 caracteres, texto latino por espacios, para que ambos idiomas coincidan
- **Puntuación ponderada por archivo** — los hits en archivos centrales como `AGENTS.md` / `MEMORY.md` / `PROFILE.md` rankean por encima de los hits en el registro diario
- **Qué vuelve** — cada hit da nombre de archivo + número de línea + un fragmento de contexto de 80 caracteres (término coincidente resaltado) + una puntuación de relevancia
- **Alcance del escaneo** — hasta ~50 archivos candidatos, ordenados por puntuación, los más altos primero

Úsalo cuando el empleado quiera confirmar "¿anoté esto antes?" o recuperar una decisión específica repartida entre muchos días de notas — sin meter archivos completos al contexto.

### Ejemplos

**Listar:**

```json
// entrada
{"agentId": 1, "filenamePrefix": "memory/"}
// salida
{"agentId": 1, "count": 3, "files": [
  {"filename": "memory/2026-04-09.md", "enabled": false, "fileSize": 512},
  ...
]}
```

**Leer:**

```json
// entrada
{"agentId": 1, "filename": "MEMORY.md"}
// salida
{"agentId": 1, "filename": "MEMORY.md", "enabled": true, "content": "..."}
```

**Editar:**

```json
// entrada
{"agentId": 1, "filename": "MEMORY.md", "oldText": "old", "newText": "new"}
// salida
{"agentId": 1, "filename": "MEMORY.md", "replacements": 1}
```

### Reglas de seguridad

- Solo archivos `.md`
- Sin rutas absolutas, sin recorrido de directorios con `..`
- `write` es una sobrescritura completa — lee primero si te importa el contenido existente
- Los archivos recién creados tienen `enabled=false` por defecto

---

## Exportación / importación de snapshot de memoria

::: tip Nuevo en 1.4.0
Toda la memoria acumulada de un empleado puede empaquetarse en un ZIP y llevársela contigo — para backup, migración a otro despliegue, o clonar a un compañero que "ya te conoce".
:::

Un snapshot empaqueta la memoria central de un empleado en un único ZIP:

- `AGENTS.md` / `MEMORY.md` / `PROFILE.md` / `SOUL.md` / `KNOWLEDGE.md`
- archivos de registro diario (`memory/YYYY-MM-DD.md`)
- un `manifest.json` (qué hay en el paquete, y de qué empleado vino)

### Tres endpoints

| Método | Ruta | Rol | Qué hace |
|--------|------|------|--------------|
| GET | `/api/v1/agents/{agentId}/workspace/memory/export` | Viewer | Exporta el ZIP — incluso el acceso de solo lectura puede tomar un backup |
| POST | `.../workspace/memory/import/preview` | Member | **Dry run**: parsea el ZIP, clasifica cada archivo como crear / actualizar / saltar, no escribe nada |
| POST | `.../workspace/memory/import` | Member | Aplica la importación, escrita **atómicamente** |

Previsualiza para ver el diff, confirma y luego importa — siempre sabes qué cambiará antes de que cambie.

### Guardas de seguridad

- **Whitelist** — solo se aceptan los tipos de archivo listados arriba; todo lo demás se ignora
- **Guardas anti zip-bomb** — ≤ 500 entradas, ≤ 1 MB cada una (descomprimida), ≤ 16 MB en total; lo que exceda se rechaza
- **El estado de los toggles de UI no se serializa** — `enabled` / `sortOrder` quedan fuera del snapshot; al importar en un empleado nuevo, el destino los decide por reglas de seed, en lugar de forzar el estado de toggles del origen

### UI

- El **panel derecho de la página de Contexto del Agente** tiene botones **Exportar / Importar**
- La importación muestra un **diff** primero (qué se crea, sobrescribe, salta) y solo escribe después de que confirmes

---

## Referencia de configuración

### Extracción y consolidación de memoria

```yaml
mate:
  memory:
    # --- Extracción automática ---
    auto-summarize-enabled: true
    min-messages-for-summarize: 4
    min-user-message-length: 10
    skip-cron-conversations: true
    summary-max-tokens: 1000
    max-transcript-messages: 30

    # --- Concurrencia ---
    cooldown-minutes: 5

    # --- Consolidación / soñar ---
    emergence-enabled: true
    emergence-day-range: 7

    # --- aislamiento de memoria por dueño (1.5.0) ---
    # El valor que se envía con el release es true (encendido): la extracción de conversación
    # escribe a la memoria PERSONAL del dueño y el recuerdo filtra por owner_key. Pon false
    # para el viejo comportamiento compartido (todas las escrituras a TEAM). El default pelado
    # de la propiedad Java es false.
    lifecycle-mediator-enabled: true

    # --- límites de tamaño de la memoria siempre encendida ---
    # Presupuesto de inyección: bloque estructurado siempre encendido user/feedback (truncado LRU al inyectar, 0 = ilimitado)
    system-block-max-chars: 4000
    system-block-max-entries-per-type: 40
    # Consolidación nocturna: fusiona/deduplica entradas user/feedback en la capa de almacenamiento (independiente de soñar)
    structured-consolidation-enabled: true
    structured-consolidation-min-entries: 8
    structured-consolidation-cron: "0 30 3 * * ?"
    structured-consolidation-max-owners-per-run: 50
    # Tope de archivo: tope duro aplicado cuando PROFILE.md / MEMORY.md se reescriben (límite de sección, 0 = ilimitado)
    profile-max-chars: 4000
    memory-md-max-chars: 8000
```

Prefijo: `mate.memory`.

### Ventana de contexto

```yaml
mate:
  agent:
    conversation:
      window:
        default-max-input-tokens: 128000
        compact-trigger-ratio: 0.75
        preserve-recent-pairs: 2
        summary-max-tokens: 300
```

---

## Endpoints de API

| Método | Ruta | Propósito |
|--------|------|---------|
| POST | `/api/v1/memory/{agentId}/emergence` | Disparar consolidación manualmente |
| POST | `/api/v1/memory/{agentId}/summarize/{conversationId}` | Disparar extracción manualmente |
| POST | `/api/v1/memory/{agentId}/structured-consolidation` | Disparar manualmente la consolidación de entradas estructuradas user/feedback |
| GET | `/api/v1/memory/{agentId}/dreaming/status` | Última corrida, próxima corrida, última entrada de DREAMS.md |

---

Para desarrolladores que extienden la capa de memoria, ver [Arquitectura](./architecture).

---

## Integración Mem0 (Opcional)

::: warning No está en el stack por defecto
La integración Mem0 es una **contribución comunitaria opcional** — NO forma parte de una instalación por defecto de AuraClaw. Requiere **auto-alojar un servicio Mem0** (FastAPI + pgvector + Neo4j opcional). La postura "local-first, cero dependencias externas" de AuraClaw no cambia — este plugin solo agrega un **canal aditivo de recuerdo semántico** para quien esté dispuesto a correr ese servicio extra.
:::

[Mem0](https://github.com/mem0ai/mem0) es un servicio de memoria independiente que maneja la extracción de memoria del LLM, la deduplicación y el recuerdo basado en vectores. El módulo `mateclaw-plugin-mem0` de AuraClaw lo conecta como un **proveedor de memoria estilo plugin** — ninguno de los 4 proveedores integrados (Builtin / Structured / Session / Fact) se toca. Mem0 se apila encima como un 5º proveedor externo. **No se reemplazan entre sí.**

### Qué hace

| Hook | Comportamiento |
|------|----------|
| `systemPromptBlock` | Devuelve vacío — deja el prompt de sistema residente intacto, evita la hinchazón de tokens por turno |
| `prefetch(agentId, query, ownerKey)` | Cuando `searchEnabled=true` y `ownerKey` no está en blanco, llama `POST {baseUrl}/memories/search/` y devuelve un bloque `[Mem0 Recall]` concatenado al contexto del turno actual |
| `syncTurn(agentId, conversationId, userMessage, assistantReply, ownerKey)` | Cuando `syncEnabled=true` y `ownerKey` no está en blanco, empuja **asíncronamente** los mensajes de usuario/asistente de este turno a `POST {baseUrl}/memories/` bajo `user_id = ownerKey` — el mismo identificador por el que consulta el recuerdo. Los fallos solo se registran, nunca bloquean la respuesta |
| `getToolBeans` | Lista vacía — v1 no expone herramientas llamables por el agente |

**Aislamiento de fallos**: cualquier excepción en recuerdo o sincronización es tragada y registrada por el propio plugin; la plataforma sigue con los otros proveedores. Que Mem0 esté caído no afecta la memoria local de AuraClaw.

### Mapeo de aislamiento por dueño

Mem0 aísla por `user_id` + `agent_id`. AuraClaw los mapea así:

| Campo AuraClaw | Campo Mem0 | Notas |
|---|---|---|
| `ownerKey` (p. ej. `user:42` / `feishu:sender_abc`) | `user_id` | Pasado textualmente |
| `agentId` | `agent_id` | El ID del empleado digital |

Tanto `prefetch` como `syncTurn` reciben `ownerKey` desde la plataforma, así que las escrituras y los recuerdos se clavan por el mismo `user_id`. Las variantes sin `ownerKey` se saltan (recuerdo vacío / escritura descartada) — Mem0 requiere `user_id`, sin él el aislamiento es imposible.

### Instalación

1. **Despliega Mem0**: siguiendo la documentación oficial de Mem0, auto-aloja una instancia (FastAPI + pgvector + Neo4j opcional). Anota su URL base, p. ej. `http://localhost:8080`.
2. **Construye el JAR del plugin**: desde la raíz del repo de AuraClaw, corre `mvn -pl mateclaw-plugin-mem0 -am package` — el JAR aterriza en `mateclaw-plugin-mem0/target/mateclaw-plugin-mem0-*.jar`.
3. **Suelta el JAR**: colócalo en el directorio `plugins/` de AuraClaw.
4. **Configura**: en la UI de administración de plugins, define `baseUrl` (requerido) y opcionalmente `apiKey` y otros ajustables. Reinicia o recarga el plugin.

### Configuración

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|----------|---------|-------------|
| `baseUrl` | string | sí | — | URL base del REST API de Mem0, p. ej. `http://localhost:8080` |
| `apiKey` | string | no | — | Token Bearer enviado como encabezado `Authorization` a Mem0 |
| `searchEnabled` | boolean | no | `true` | Si el prefetch debe llamar `/memories/search/` para recuerdo semántico |
| `syncEnabled` | boolean | no | `true` | Si syncTurn debe empujar cada turno a `/memories/` |
| `maxResults` | integer | no | `5` | Tope de memorias devueltas por recuerdo |
| `timeoutMs` | integer | no | `3000` | Timeout HTTP en milisegundos, compartido por recuerdo y sincronización |

La config se lee una vez al cargar el plugin — los cambios requieren recargar el plugin para surtir efecto.

### Limitaciones conocidas (v1)

- **Los turnos sin dueño resuelto no se sincronizan**: `syncTurn` requiere `ownerKey`; los turnos donde la plataforma no puede resolver uno (p. ej. corridas disparadas por el sistema) se saltan en lugar de escribirse bajo un identificador de fallback que el recuerdo nunca podría mostrar.
- **Sin control de presupuesto de tokens**: el bloque `[Mem0 Recall]` devuelto por prefetch se concatena al contexto directamente — NO está sujeto al presupuesto de inyección `system-block-max-chars` (ese presupuesto solo gobierna las entradas estructuradas `user`/`feedback`). `maxResults` es el único control de tamaño.
- **Sin herramientas para el agente**: v1 no expone herramientas estilo `mem0_search` / `mem0_add` para que el agente las llame proactivamente. El agente solo recibe pasivamente los resultados del prefetch.

---

## Siguiente

- [Agentes](./agents) — cómo usan la memoria los agentes durante un turno
- [LLM Wiki](./wiki) — la capa de conocimiento *deliberada*, en contraste con la memoria pasiva
- [Herramientas](./tools) — la herramienta de memoria del workspace es una de muchas
- [Configuración](./config) — referencia completa de configuración
- [Arquitectura](./architecture) — organización del código del backend, puntos de extensión SPI
