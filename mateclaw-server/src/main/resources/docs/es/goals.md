---
title: Objetivos Persistente — fija entre turnos, deja que el trabajador haga seguimiento
description: El sistema de Objetivos de AuraClaw deja que un trabajador digital fije una tarea multi-turno como objetivo, auto-evalúe el progreso y opcionalmente se impulse hacia adelante hasta terminar o agotar el presupuesto.
head:
  - - meta
    - name: keywords
      content: Objetivo,Agente,multi-turno,auto-evaluación,auto-seguimiento,persistente,AuraClaw
---

# Objetivos Persistente

> **Antes repetías el contexto en cada turno. Ahora fijas un objetivo una vez, el trabajador sigue.**

Dices "despliega este blog a fly.io" en un turno, el trabajador responde y se detiene. El siguiente turno tienes que acordarte de preguntar "¿está el DNS? ¿el certificado firmado? ¿corrieron los tests?" — estás manteniendo el objetivo en tu cabeza, no el trabajador.

Los Objetivos voltean eso. **Lo dices una vez, el trabajador fija el objetivo y se auto-chequea cada turno: ¿qué falta todavía? ¿Debería dar el siguiente paso yo mismo?**

No es una pestaña nueva ni una feature nueva. Es un **estado** que el trabajador tiene. Aparece un anillo alrededor del avatar del asistente. Qué tan lleno está el anillo, es qué tan cerca estás de terminar. Cuando termina, el anillo desaparece.

---

## Cómo se ve

No un banner. No un diálogo. No una página separada.

Un **anillo alrededor del avatar del asistente**.

| Estado | Visual | Significado |
|---|---|---|
| Sin objetivo | Avatar plano | Esta conversación no tiene objetivo — igual que antes |
| Activo | Avatar + anillo naranja | Objetivo en vuelo, el anillo se llena con el progreso |
| Evaluando | Avatar + halo respirando arena | El backend está juzgando la respuesta de este turno |
| Completado | Avatar + anillo verde (brevemente) | Objetivo alcanzado; el anillo se desvanece, la conversación continúa |
| Agotado | Avatar + anillo rojo-naranja | Presupuesto usado — tu llamada: extender o soltar |

**Pasa el cursor sobre el avatar** para ver el tooltip completo — título + qué falta todavía. No pases el cursor, no te molestan. Ese es el diseño.

---

## Tres formas de fijar un objetivo

En orden creciente de cuánto tienes que explicitar:

### Forma 1 — Deja que el trabajador decida

Enuncia la naturaleza multi-turno de la tarea más una solicitud explícita de setGoal:

> Quiero hacer un proyecto completo: traducir el README al inglés, abrir un PR, atender el feedback de revisión, fusionar. Esto abarca muchos turnos. **Por favor usa setGoal para fijarlo**, auto-evalúa cada turno, turnBudget=8, autoFollowup on.

El trabajador recoge las dos señales ("tarea larga" + "setGoal solicitado") y crea el objetivo, auto-resumiendo el título desde el contexto. Ves un anillo junto a su avatar — objetivo fijado.

### Forma 2 — Comando directo de herramienta

Dile al trabajador exactamente qué herramienta llamar con qué parámetros:

> Por favor llama setGoal de inmediato, title="Desplegar blog a fly.io", turnBudget=10, autoFollowup=true. No hagas ninguna pregunta de aclaración.

La cláusula de "no hagas preguntas de aclaración" importa — si no, el instinto del trabajador es preguntar "¿dónde está el código? ¿qué dominio?" primero.

### Forma 3 — Programática vía la REST API

Para automatización y scripts externos, el endpoint es directo:

```
POST /api/v1/goals
{
  "conversationId": "conv-xxx",
  "title": "Desplegar blog a fly.io",
  "description": "...",
  "exitCriteria": "DNS + SSL + healthcheck + tests pasan",
  "turnBudget": 10,
  "llmCallBudget": 200,
  "autoFollowupEnabled": false
}
```

> `agentId` / `workspaceId` se derivan del lado del servidor desde `conversationId` — **no los envíes** (se ignoran si lo haces). Superficie completa en la [referencia de API](./api).

---

## Qué lleva un objetivo

Cuatro requeridos:

| Campo | Significado |
|---|---|
| **title** | Etiqueta corta, mostrada al pasar el cursor sobre el avatar |
| **description** | Declaración completa de lo que quieres |
| **exitCriteria** | La barra legible por LLM contra la que el evaluador puntúa (p. ej. "tests pasan + desplegado") |
| **budgets (turnBudget + llmCallBudget)** | Salvaguardas contra la iteración desbocada |

Opcionales:

- **autoFollowupEnabled** — encendido, el trabajador puede continuar solo si juzga el objetivo incompleto, sin esperar tu siguiente mensaje
- **followupCooldownSeconds** — retraso mínimo entre dos auto-followups consecutivos

---

## Cómo corre

Tras cada turno, un nodo evaluador del backend corre:

1. Lee la respuesta final del trabajador + los últimos pocos mensajes de contexto
2. Llama a un modelo evaluador ligero (apúntalo a uno barato) preguntando: ¿completitud 0–1? ¿cuál es la brecha? ¿continuar o terminar?
3. Escribe el resultado en la línea de tiempo `mate_agent_goal_event`
4. Decide el siguiente paso: completar / agotar presupuesto / continuar / auto-followup

**Invariante clave**: la evaluación corre *después* de que la respuesta final haya fluido a tu pantalla — nunca bloquea que veas la respuesta. Ves aparecer la respuesta → el anillo se actualiza un momento después.

### Auto-followup

Cuando `autoFollowupEnabled=true` y la decisión del evaluador de este turno es "continuar", el backend:

1. Escribe un evento `followup_injected` en la línea de tiempo
2. ANEXA un mensaje de usuario a la conversación. **Desde 1.5.0, si el objetivo tiene un checklist, ese mensaje lista explícitamente los criterios aún abiertos** — *"5/8 listos, restantes: ① … ② …, da el siguiente paso en estos"*; sin checklist cae al genérico *"Continue working on the goal. Still missing: {gap}."*
3. Re-entra al bucle de razonamiento — la siguiente respuesta del asistente aterriza justo después de la primera

Se siente como: el trabajador responde un segmento → pausa un latido → **sigue** — como una persona que terminó un paso, pensó un segundo y continuó.

---

## Desatascarse

::: tip Nuevo
Las tareas largas no se estancan porque sean difíciles — se estancan porque **se atascan**: golpeando el tope de iteraciones sin nada que mostrar, girando sobre una herramienta rota hasta que el presupuesto se acaba, o crasheando un plan en un paso malo y deteniéndose en seco. Este grupo de mecanismos deja que el trabajador se levante solo, rodee los fallos y siga sin esperar tu siguiente mensaje.
:::

### Continuación dura en el tope de iteraciones

Antes, si un bucle ReAct agotaba `max_iterations` (razón de fin `MAX_ITERATIONS_REACHED`), el subsistema de objetivos **saltaba** esa corrida por completo — sin evaluación, sin continuación, la tarea simplemente se detenía ahí. Ahora toma un camino de **continuación dura**: resetea el contador de iteraciones, limpia el "borrador sobre el límite" y le da al trabajador un **presupuesto de iteraciones fresco y completo** para continuar.

Esto es distinto del auto-followup descrito arriba. El auto-followup se dispara cuando el evaluador decide "aún no está". La continuación dura se dispara específicamente cuando el trabajador **golpea el tope de iteraciones** — resetea el presupuesto de iteraciones en sí. Cada continuación dura consume una cuota de iteración completa, así hay un límite: por defecto, como máximo **1** por corrida (techo duro de compilación de 3). Ponlo en `0` para deshabilitar y restaurar el comportamiento viejo (golpear el tope termina esa corrida).

### Detección de estancamiento y re-planificación

En modo Plan-Execute, un paso individual puede **lanzar una excepción** o caer en un **estancamiento** — repitiendo la misma llamada a herramienta que sigue fallando, o recibiendo resultados idénticos de "sin información nueva" cada vez, quemando el presupuesto de herramientas y luego "completando" con un resultado vacío que envenena todo paso downstream que dependía de él.

El runtime firma cada respuesta de herramienta y corre un chequeo de dos niveles:

- **WARN**: tras que la misma llamada falle varias veces seguidas, se inyecta una pista de sistema diciéndole al modelo que pruebe un enfoque distinto (cada llamada única recibe como máximo una advertencia).
- **HALT**: si la llamada sigue fallando tras la advertencia, el paso se marca como atascado y el bucle interno sale.

Cuando un paso es HALT o lanza una excepción, el runtime dispara **re-planificación**: el plan actual se limpia, y un contexto de "resumen de pasos completados + razón del fallo + saltar el paso malo" se pasa de vuelta al nodo de planificación para generar un plan nuevo. La re-planificación ocurre como máximo **1 vez por corrida**. La UI recibe un evento `plan_replan` con el índice del paso fallido y la razón.

### Los turnos de meta-herramientas no cuentan (reembolsos de iteración)

Las herramientas de divulgación progresiva como `load_skill` / `enable_tool` son **acciones de configuración**, no trabajo real. Cuando toda llamada a herramienta en un turno ReAct es una de estas meta-herramientas, el contador de iteraciones de ese turno **no se incrementa** (la iteración se reembolsa), evitando que un modelo enfocado en cargar skills queme todo su presupuesto solo en pasos de configuración. Máximo 3 reembolsos por corrida.

### Auto-derivar un objetivo desde un plan multi-paso

Cuando un plan Plan-Execute tiene **dos o más pasos** y la conversación actual no tiene objetivo activo, el nodo de planificación **crea automáticamente un objetivo**, usando los pasos del plan como criterios de salida, y transmite un evento `goal_created` para que el panel de objetivos de la UI se refresque. Esto significa que los planes largos quedan naturalmente bajo la semántica de "seguir hasta completar" del sistema de objetivos. Controlado por `mateclaw.goal.auto-goal-from-plan` (encendido por defecto).

---

## Un objetivo es un checklist (1.5.0+)

En 1.4.0 el evaluador daba una puntuación de completitud (0–1) y una línea de "qué falta" cada turno. El problema: **¿qué significa 0.8** — qué casillas están hechas, cuáles no? No podías verlo.

1.5.0 lo reemplaza con un **checklist**: un objetivo = un conjunto de criterios **independientemente verificables**.

**El evaluador tiene dos modos:**

| Modo | Cuándo | Qué hace |
|---|---|---|
| **bootstrap** | Sin criterios aún | Descompone el objetivo en un checklist; cada uno empieza "no aprobado" |
| **verdict** | Los criterios existen | Juzga cada uno: ¿satisfecho? ¿con evidencia? |

Ambos modos usan **salida estructurada** — el evaluador devuelve un objeto tipado (criterio `id` + `passed` + `evidence`), no texto libre que tengamos que parsear.

**La completitud es determinista.** Solo cuando **todo criterio pasa** el objetivo está hecho. 19 de 20 aprobados (una puntuación de 0.95) sigue siendo "continuar" — falla uno y falta uno, sin umbral difuso.

**Tres formas de agregar un checklist:**

- **Al crear** — pasa `criteria: ["DNS resolves", "SSL valid", "tests green"]` a la herramienta `setGoal`, o `criteria` a `POST /api/v1/goals`. Se salta la ronda de bootstrap.
- **Deja que el evaluador descomponga** — no pases criterios y la primera evaluación arranca el checklist.
- **Anexar en runtime** — la herramienta `addGoalCriterion` o `POST /api/v1/goals/{id}/criteria` agrega uno a un objetivo vivo sin reiniciar.

**Cómo se ve un criterio:**

```json
{ "id": "C1", "text": "DNS resolves to fly.io", "passed": false, "evidence": "" }
```

`id` lo asigna el servidor (C1, C2…), `text` es una oración que un humano lee y un LLM juzga, `passed` es el veredicto del evaluador, `evidence` es la justificación que da. El checklist vive en la columna `mate_agent_goal.criteria` (JSON) y se entrega parseado como `GoalResponse.criteria`, nunca como cadena JSON cruda.

### El anillo, al pasar el cursor, es una tarjeta de checklist

- **Sin checklist** — un tooltip de una línea: título + el texto de brecha que escribió el evaluador.
- **Con checklist** — una tarjeta: título + progreso `X/Y`, luego cada criterio prefijado por `○` (abierto) o `✓` (verde, hecho, tachado).

Mientras evalúa, un halo respirando color arena rodea el avatar; al completar un anillo verde se muestra brevemente y luego desaparece; ante agotamiento de presupuesto el anillo se vuelve óxido.

### SPI del evaluador

La lógica de evaluación implementa la interfaz `Evaluator` de Spring AI: hace veredictos de checklist específicos de objetivos (bootstrap / verdict) y puede reutilizarse como evaluador genérico (envolviendo un objetivo único como un criterio en modo verdict). Las llamadas al evaluador fallidas **igual cuentan contra el presupuesto de LLM**, así la contabilidad se mantiene honesta.

> El objetivo de 1.4.0 era "el trabajador recuerda qué está haciendo". El objetivo de 1.5.0 es "el trabajador sabe **exactamente qué casillas siguen abiertas**". De una puntuación a un checklist que puedes marcar.

---

## Cuatro herramientas integradas (llamables por el trabajador)

Estas cuatro vienen como herramientas de sistema a nivel de agente — sin configuración de ligadura necesaria:

| Herramienta | Propósito | Ejemplo de prompt |
|---|---|---|
| **setGoal** | Crear un objetivo | "Usa setGoal para fijar esta tarea, title=..." |
| **addGoalCriterion** | Anexar un sub-criterio al objetivo activo | "Agrega: debe soportar IPv6" |
| **completeGoal** | Marcar hecho explícitamente | "Todos los ítems listos — llama completeGoal" |
| **getGoalStatus** | Inspeccionar el estado actual | "¿Cómo vamos?" |

Al completar (`completeGoal`, o el evaluador juzgando **todo criterio aprobado**), el trabajador reenvía un resumen a su [memoria a largo plazo](./memory) para que conversaciones futuras puedan recordarlo.

---

## Los sub-agentes no pueden mutar el objetivo del padre

En la [colaboración multi-agente](./agents) un trabajador padre puede delegar en un trabajador hijo. Los hijos **no ven** las cuatro herramientas de objetivos — el objetivo es estado de la conversación del padre, el hijo es un ejecutor sin estado.

> Es intencional. Los hijos hacen trabajo para el padre, pero el objetivo sigue siendo propiedad del padre.

---

## Cuando el presupuesto se acaba

```
turnsUsed >= turnBudget  O  (agentLlmCallsUsed + evalLlmCallsUsed) >= llmCallBudget
```

Golpear cualquiera → el estado del objetivo cambia a **exhausted**, sin más evaluaciones, sin más follow-ups, el anillo se vuelve rojo-naranja. La respuesta del asistente del último turno igual pasa.

Tus opciones:

- **Sube el presupuesto y reanuda** — `PATCH /api/v1/goals/{id}` para ampliar presupuestos y luego reanudar (sin botón de UI en v1 — usa la API o abandona y re-crea)
- **Déjalo ir** — llama abandon; el slot de conversación se libera para un objetivo nuevo

---

## Máquina de estados

```
   crear
     ↓
   active
   ↓   ↑
 paused

 active ──todos los criterios pasan / completeGoal──→ completed (terminal)
   ↓
 active ──turns_used / llm_calls agotados ──────────→ exhausted (terminal)
   ↓
 active ──abandono del usuario ─────────────────────→ abandoned (terminal)
```

Los estados terminales (completed / exhausted / abandoned) no pueden revivir. Para seguir, crea un objetivo fresco — simplicidad intencional, evita las semánticas sucias de "resucitar con qué presupuesto".

**Un objetivo activo por conversación**: como máximo una fila activa en cualquier momento. Las filas terminales quedan en el historial, no cuentan contra el slot. Impuesto en la capa de BD con una columna generada + índice único (H2 / MySQL), más pre-chequeo y auditoría a nivel de servicio — defensa en profundidad.

---

## Lo que este sistema no hace

Unas no-features deliberadas:

- **Sin objetivos anidados / árboles de objetivos** — un objetivo por conversación, sin pila OKR
- **Sin "plantillas de objetivos"** — todo objetivo se escribe a mano
- **Sin migración de objetivos entre conversaciones** — usa un [workflow](./workflow) para eso
- **Sin puntuación de completitud en la UI** — `completionScore` es un protocolo interno de ingeniería, no vocabulario de usuario. La UI habla vía un anillo; al pasar el cursor muestra la tarjeta de checklist casilla por casilla cuando hay checklist, o el texto de brecha en lenguaje natural que escribió el evaluador cuando no lo hay. La puntuación numérica queda en los logs y la API para depurar

---

## Línea de tiempo completa de eventos (vista de cajón)

Cada objetivo tiene un log de eventos solo-anexar, los más nuevos primero:

| Evento | Disparador |
|---|---|
| `created` | herramienta setGoal o REST POST |
| `evaluated` | cada turno tras correr el evaluador |
| `followup_injected` | autoFollowup disparó e inyectó un prompt |
| `completed` | el evaluador concluyó hecho, o la herramienta completeGoal |
| `exhausted` | presupuesto alcanzado |
| `paused` / `resumed` / `abandoned` | acciones del usuario |
| `criterion_added` | herramienta addGoalCriterion |

Extrae vía `GET /api/v1/goals/{id}/events`. Ver [referencia de API](./api).

---

## Configuración

`application.yml`:

```yaml
mateclaw:
  goal:
    # Interruptor maestro; apagado, el nodo del grafo pasa de largo en toda llamada.
    enabled: true
    # Default al crear para autoFollowupEnabled cuando el llamador lo deja sin definir.
    default-auto-followup: true
    # Interruptor maestro de runtime; apagado, ningún objetivo inyecta un followup sin importar su flag por objetivo.
    allow-auto-followup: true
    # Presupuesto de turnos por defecto cuando el usuario no lo sobrescribe.
    default-turn-budget: 20
    # Presupuesto combinado por defecto (agente + evaluador) de llamadas LLM.
    default-llm-call-budget: 200
    # Segundos mínimos entre dos auto-followups consecutivos.
    auto-followup-cooldown-seconds: 0
    # Tope duro de auto-followups dentro de una sola corrida de grafo (red de seguridad por mensaje; el presupuesto general es turnBudget).
    max-followups-per-run: 8
    # Máximo de continuaciones duras al golpear el tope de iteraciones por corrida (0 = deshabilitado; el techo de compilación es 3).
    max-hard-continuations-per-run: 1
    # Deriva automáticamente un objetivo de un plan Plan-Execute multi-paso cuando no hay objetivo activo.
    auto-goal-from-plan: true
    # Modelo usado por el evaluador. Vacío = mismo modelo que el agente de chat.
    # Recomendado: un modelo barato como qwen-turbo / glm-4-flash.
    evaluator-model: ""
    # Máximo de mensajes recientes incluidos en el prompt del evaluador.
    evaluator-context-messages: 8
```

---

## Base de datos

Dos tablas, todas con prefijo `mate_`:

| Tabla | Propósito |
|---|---|
| `mate_agent_goal` | El objetivo en sí; estado / presupuestos / dobles contadores LLM / config de auto-followup |
| `mate_agent_goal_event` | Log de eventos solo-anexar; alimenta la vista de línea de tiempo |

Migración Flyway `V120__agent_goal.sql` (dialectos H2 / MySQL / KingbaseES).

---

## En una línea

**Un objetivo no es una feature nueva sobre el trabajador. Es un cambio de estado.**

Antes, el trabajador olvidaba en el momento en que respondía. Los objetivos hacen que un trabajador recuerde una cosa a través de muchos turnos — en qué está trabajando, qué falta todavía, cuándo cuenta como hecho. Lo dices una vez. El anillo junto al avatar rastrea el resto.
