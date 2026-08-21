---
title: Team Runs — de una solicitud de equipo a una ejecución completa y entregable
description: Un Team Run de AuraClaw une al líder, el DAG de tareas, las ejecuciones de trabajadores, la síntesis final y los entregables bajo un solo runId y una vista compartida entre Chat, Agentes y Equipos.
head:
  - - meta
    - name: keywords
      content: equipos de agentes,task board,kanban,colaboración multi-agente,despacho,entregables,AuraClaw
---

# Team Runs y Equipos de Agentes (2.1.0+)

> **Antes: un empleado con sub-tareas. Ahora: un equipo alrededor de un task board compartido.**

La delegación a sub-agentes (`delegateToAgent`) resuelve "una persona llama temporalmente a un ayudante": síncrona, uno-a-uno, caja negra. Pero la entrega compleja real se ve como un proyecto: **descomponer tareas, declarar dependencias, correr en paralelo, controlar con aprobaciones, archivar entregables y ver quién hace qué en cualquier momento**.

Los Equipos de Agentes traen esa maquinaria de proyecto a AuraClaw: creas un **equipo**, asignas un empleado **líder** y varios **miembros**; le dices al líder un objetivo, él lo descompone en tareas sobre un **task board compartido**; el motor de despacho entrega tareas a los miembros y las corre **en paralelo**; los resultados asentados se anuncian de vuelta al líder, que revisa, re-despacha y lleva todo a completarse. Lo ves todo desde la página de Equipos — o sueltas tareas en el board tú mismo.

2.1.0 agrega el **Team Run** de primera clase por encima de las tareas individuales: una solicitud de usuario se mapea a una corrida, y un `runId` enlaza el objetivo, el DAG de tareas, las conversaciones de trabajadores, los eventos, la síntesis final y los entregables. En lugar de una barra lateral llena de conversaciones "sub-tarea", obtienes un registro de trabajo orientado al resultado con drill-down progresivo.

## La experiencia unificada de Team Run en 2.1.0

| Superficie | Responsabilidad | Vista por defecto |
|---------|----------------|--------------|
| **Chat** | Entrega | Una tarjeta de corrida estable con estado/progreso compartido, resumen final, entregables, fallos o aprobaciones; el detalle de tarea se expande a demanda |
| **Agentes · En Vivo** | Observación en vivo | Los trabajadores que comparten un `runId` se agrupan con tarea, fase, herramienta, duración y estado de excepción; las corridas ordinarias siguen independientes |
| **Equipos** | Historial y gobernanza | Historial de corridas y detalle, evidencia de tareas, aprobaciones, cancelación y registros de trabajadores en lugar de un muro plano de tareas históricas |

El servidor es dueño de la proyección del Team Run y su máquina de estados:

```text
planning → running → awaiting_review → finalizing → completed
                                      ↘ partial / failed
planning / running / awaiting_review → cancelled
```

- **Una identidad por trabajo**: eventos, rutas, logs, tareas y mensajes finales llevan `runId`.
- **Resultado primero**: el asentamiento intermedio de tareas actualiza el progreso en lugar de fabricar una respuesta final de cara al usuario por tarea.
- **Gobernanza de trabajadores**: las conversaciones `team_worker` quedan fuera de la barra lateral normal; los enlaces profundos abren un registro de ejecución de solo lectura con un camino de vuelta al Team Run.
- **Seguro al refrescar**: toda superficie consume `TeamRunView`, así título, progreso, estado, resumen y archivos no pueden derivar por inferencia del lado del cliente.
- **Compatibilidad histórica**: las tareas 2.0 sin `runId` siguen siendo legibles pero nunca se adivinan en un agregado incorrecto.

El protocolo de corrida es `start_run → create* → seal_run`: el líder crea una corrida, crea tareas explícitamente bajo ella y la sella antes del despacho. El mensaje originante participa en la idempotencia, evitando que reconexiones o envíos duplicados creen una segunda copia.

---

## Conceptos centrales

| Concepto | Descripción |
|------|------|
| **Equipo** | Un grupo de empleados más un task board. Un empleado puede pertenecer a varios equipos. |
| **Rol** | `lead` / `member` / `reviewer`. El líder descompone y resume, los miembros ejecutan, los revisores revisan. |
| **Tarea** | Un ítem de trabajo en el board: asunto, descripción, asignado, dependencias (`blockedBy`), progreso, resultado, entregables, comentarios, línea de tiempo. |
| **Board** | Un kanban agrupado por estado. La máquina de estados está custodiada por actualizaciones condicionales de base de datos — bajo concurrencia el primer escritor exitoso gana, así una tarea nunca puede tener dos estados. |

Ocho estados de tarea:

```
pending → in_progress → completed / failed / cancelled
                ↘ in_review (tareas que requieren aprobación humana)
blocked (esperando prerrequisitos)   stale (lease expirado, reintentable)
```

Las tareas `failed` y `stale` pueden reintentarse; las `completed` / `cancelled` liberan a las tareas downstream que dependen de ellas.

---

## Cómo se ve una corrida de colaboración

1. **Le das un objetivo al líder**: "Análisis competitivo: investiga a los proveedores A y B por separado, luego fusiona en un solo reporte."
2. **El líder pone tareas en el board**: tres tareas vía la herramienta `team_tasks` — "investigar A" e "investigar B" corren en paralelo, "fusionar reporte" declara `blockedBy` sobre ambas y entra en `blocked`.
3. **El motor de despacho toma el control**: un barrido residente (cada 30 s, más una pasada inmediata tras acciones de herramienta/REST) asigna tareas pendientes a sus miembros — cada tarea obtiene su propia conversación hija donde el miembro corre el grafo de agente completo. Cada miembro ejecuta una tarea a la vez; el resto hace cola.
4. **Los resultados de prerrequisitos se entregan automáticamente**: una vez que "investigar A/B" completan, "fusionar reporte" se libera y su sobre de despacho **lleva automáticamente los resultados y los enlaces de entregables de ambos prerrequisitos** — el miembro C no necesita que el líder le re-cuente lo que hizo el miembro A.
5. **Los resultados asentados despiertan al líder**: las completitudes y fallos se anuncian al líder en lotes con debounce; el líder se despierta en un turno nuevo real — revisa resultados, despacha seguimientos o declara el trabajo hecho.
6. **Ves todo**: el board de Equipos se refresca en vivo (impulsado por eventos SSE, sin polling), un banner de actividad transmite "#3 despachado a Content Studio"; abre cualquier tarea para su línea de tiempo, progreso, comentarios, entregables — y **salta a la conversación hija del miembro para ver la corrida palabra por palabra** (una máquina de escribir en vivo mientras corre).

---

## La herramienta del líder: `team_tasks`

El líder (y los miembros) operan el board a través de la herramienta `team_tasks`, con acciones controladas por rol:

| Acción | Quién | Qué |
|------|--------|--------|
| `list` | cualquier miembro | Renderiza el board actual (el líder también recibe un snapshot del board en vivo inyectado cada turno — ver abajo) |
| `get` | cualquier miembro | Detalle de tarea |
| `create` | líder | Crear una tarea: asunto, descripción, asignado, dependencias `blockedBy`, `requireApproval` para una compuerta humana |
| `complete` | asignado | Enviar el resultado (las tareas con compuerta de aprobación pasan a `in_review`) |
| `progress` | asignado | Reportar porcentaje y paso actual (también renueva el lease de ejecución y transmite al board) |
| `comment` | cualquier miembro | Dejar un comentario |
| `attach` | asignado | Registrar un **entregable** (nombre de archivo + URL de descarga) en la tarea |
| `cancel` | líder | Cancelar — esto **realmente interrumpe** una sesión de miembro en ejecución, no solo voltea un estado |
| `retry` | líder | Reintentar una tarea `failed` / `stale` |

**Inyección de contexto de equipo**: los empleados de un equipo reciben el roster del equipo y el playbook de colaboración inyectados en su prompt de sistema; el líder además recibe un **snapshot del board en vivo cada turno** — nunca tiene que llamar `list` primero para saber qué hay en el board, y las colaboraciones largas no se olvidan de las tareas en curso.

- **Creación manual de tareas.** Las tareas no tienen que venir del líder: crea una directamente en la página de Equipos, asignada a cualquier miembro; el resultado aterriza en el board para ti (sin conversación de líder que despertar, el anuncio hace no-op con elegancia).

---

## Entregables y visibilidad de corridas

La forma de salida correcta para una tarea compleja es **archivos + resumen**, no un blob truncado de texto:

- Los miembros producen archivos con las herramientas de renderizado de documentos (docx / pptx / xlsx / pdf) o skills, y luego los `attach` a la tarea; el detalle de la tarea renderiza una **lista de adjuntos descargables** y el anuncio de resultado lleva los adjuntos — los enlaces ya no se ahogan en texto truncado.
- Cada detalle de tarea tiene una entrada **"ver corrida"**: la transcripción completa de la conversación hija del miembro — sobre de despacho, pensamiento ronda por ronda, llamadas a herramientas, salida intermedia. Abierta a mitad de corrida es una máquina de escribir en vivo (las reconexiones reproducen el buffer).
- **Línea de tiempo de tarea**: quién creó / despachó / reportó / adjuntó / aprobó / canceló, y cuándo — cada evento aterriza en la tabla de auditoría `mate_team_task_event` y se renderiza como línea de tiempo en el detalle de la tarea. La colaboración tiene un historiador.

---

## Líderes Plan-Execute: el plan se vuelve el board

Los líderes no están restringidos por tipo de agente. Un **líder ReAct** crea tareas una a una vía `team_tasks`; un **líder Plan-Execute** va más allá — el plan producido por su nodo de planificación se **entrega al board al por mayor**:

- los pasos del plan se mapean a tareas del board, las dependencias de pasos se vuelven `blockedBy` — un plan antes estrictamente serial ahora **se paraleliza donde puede**;
- tras la entrega el plan se estaciona (`delegated`) y el turno del líder termina normalmente; el bucle de despacho/anuncio toma el control;
- una vez que todas las tareas se asientan, el despertar pasa por una **compuerta de reanudación de plan estacionado** que enruta deterministicamente al nodo de resumen del plan, reconstruyendo el contexto desde los resultados de tareas y entregables — la misma forma de "estacionar en BD, reanudar en un turno fresco" que ya usa el flujo de aprobación de herramientas, sin maquinaria de checkpoints.

La entrega es **todo-o-nada**: el plan va al board solo cuando todo paso resuelve a un miembro del equipo; si algún paso no puede asignarse, todo el plan cae al pipeline original de delegación serial, comportándose exactamente como antes.

En resumen: **un líder que puede planificar convierte su planificación en orquestación de equipo.**

---

## La página de Equipos

La consola de administración gana una página **Equipos** (`/teams`):

- **Gestión de equipos**: crear equipos, agregar/quitar miembros, asignar roles;
- **Board**: columnas de estado, refresco en vivo impulsado por eventos, **columnas paginadas** con **totales reales del lado de la BD** en los encabezados — un board de mil tareas no arrastra la página;
- **Banner de actividad**: eventos de despacho / completitud / fallo en streaming;
- **Detalle de tarea**: línea de tiempo, progreso, comentarios, descargas de entregables, entrada a transcripción de corrida, aprobar / rechazar;
- **Creación manual de tareas**: suelta trabajo en el board directamente.

---

## REST API

La API de administración vive bajo `/api/v1/teams`:

| Endpoint | Descripción |
|------|------|
| `GET /api/v1/team-runs/{runId}` | Lee la proyección completa de la corrida |
| `GET /api/v1/teams/{teamId}/runs` · `GET …/runs/page` | Listar / paginar con cursor el historial de corridas del equipo |
| `GET /api/v1/conversations/{conversationId}/team-runs` · `GET …/team-runs/page` | Listar / paginar con cursor las corridas de una conversación padre |
| `POST /api/v1/team-runs/{runId}/cancel` | Cancelar una corrida y sus tareas no terminales |
| `GET / POST /api/v1/teams` | Listar / crear equipos |
| `GET / PUT / DELETE /api/v1/teams/{id}` | Detalle / actualizar / borrar equipo |
| `POST /api/v1/teams/{id}/members` · `DELETE …/members/{agentId}` | Membresía |
| `GET / POST /api/v1/teams/{id}/tasks` | Lista de tareas (paginación por ventana) / crear tarea |
| `GET /api/v1/teams/{id}/tasks/stats` | Conteos por estado (calculados del lado de la BD) |
| `GET /api/v1/teams/{id}/tasks/{taskId}` | Detalle de tarea |
| `POST …/tasks/{taskId}/approve · reject · retry · cancel` | Aprobar / reintentar / cancelar |
| `POST …/tasks/{taskId}/comments` | Comentario |
| `GET …/tasks/{taskId}/events` | Línea de tiempo de tarea |
| `GET /api/v1/teams/{id}/events` | Stream de eventos SSE a nivel de equipo (lo que impulsa el board en vivo) |

Todo fallo de validación devuelve un **error legible** — nunca un 500 pelado.

Las cinco tablas originales de equipo se unen con `mate_team_run`; `mate_team_task.run_id` y los índices de conversaciones de trabajadores conectan tareas, corridas y registros de ejecución. Los ids Snowflake cruzan el límite JSON como strings.

---

## Equipos vs. delegación a sub-agentes (`delegateToAgent`)

| | `delegateToAgent` | Task board de equipo |
|---|---|---|
| Forma | Llamada de ayuda de un solo uso | Equipo permanente + board compartido |
| Paralelismo | Una sola llamada asíncrona | Paralelismo a nivel de miembro + orquestación de dependencias |
| Visibilidad | Caja negra hasta terminar | Línea de tiempo + espectación en vivo + entregables |
| Interrumpir/recuperar | Atado al turno padre | Leases, cancelar-interrumpir, reintentar |
| Encaja | Subcontratar un sub-problema | Entrega de proyecto multi-rol, multi-paso |

Coexisten: un miembro del equipo aún puede llamar `delegateToAgent` dentro de su propia tarea.

---

## Sigue leyendo

- [Agentes](./agents) — cómo funcionan los grafos ReAct y Plan-Execute
- [Objetivos Persistente](./goals) — seguimiento entre turnos para un solo empleado
- [Workflow](./workflow) — orquestación determinista de pasos (usa workflows cuando el proceso es fijo, equipos cuando debe descomponerse sobre la marcha)
- [Seguridad y Aprobación](./security) — cómo se relaciona la aprobación de herramientas con la aprobación de tareas de equipo
