---
title: Motor Multiagente — ReAct + Plan-and-Execute
description: El sistema multiagente de AuraClaw corre en dos modos — ReAct para razonamiento en tiempo real y Plan-and-Execute para descomposición de tareas complejas. Los agentes pueden delegarse entre sí para una verdadera colaboración multiagente.
head:
  - - meta
    - name: keywords
      content: multiagente,ReAct,Plan-and-Execute,delegación de agentes,Spring AI Alibaba,agente de IA
---

# Motor Multiagente

> **Ahora se llaman "empleados digitales".** El back office usa ese término en todas partes. El runtime sigue siendo un Agente por debajo, pero la UI, el modelo mental y las plantillas tratan a cada uno como un compañero de tu equipo.
> El renombrado trae consigo un cambio de cosmovisión: le das a un empleado un **Rol**, un **Objetivo** y una **Historia de fondo** — saben quiénes son y por qué existen. No tienes que escribir un prompt de sistema frío pidiéndole a un "agente" que por favor entienda la tarea.

Un empleado es una personalidad con herramientas. Varios empleados forman un equipo.

Esa es la versión corta. La larga: un empleado es un nombre, un prompt de sistema que define cómo piensa (construido desde rol / objetivo / historia de fondo), un modelo que realmente piensa, un conjunto de herramientas que tiene permitido usar, bases de conocimiento opcionales que puede leer, skills opcionales que extienden lo que puede hacer, su propia porción de memoria, y una elección de cómo abordar los problemas difíciles — incrementalmente (ReAct) o con un plan (Plan-and-Execute).

Puedes tener muchos empleados. Cada uno especializado. Les das trabajos diferentes.

---

## Qué tiene un empleado digital

| Pieza | Qué es |
|-------|-----------|
| **Nombre** | Cómo lo encuentran tú y tu equipo |
| **Icono** | Estilo pixel-art, codificado por color según el rol |
| **Rol** | Una frase — "Soy el investigador de producto" / "Soy soporte al cliente" |
| **Objetivo** | Una frase — "Te ayudo a ver cómo se mueve el mercado" |
| **Historia de fondo** | De dónde vino, por qué existe, qué le importa; se empalma automáticamente en el prompt de sistema final |
| **Eslogan de la tarjeta del empleado** | La "autopresentación" mostrada en la tarjeta |
| **Prompt de sistema** | Su personalidad, reglas, estilo, prioridades (rol/objetivo/historia se inyectan automáticamente) |
| **Tipo** | `react` o `plan_execute` |
| **Herramientas** | Qué herramientas tiene permitido llamar (integradas, MCP, skills, puenteadas por ACP) |
| **Bases de conocimiento** | LLM Wikis desde los que puede leer (la caché caliente de KB se auto-inyecta en el prompt de sistema) |
| **Memoria del workspace** | Sus propios `PROFILE.md`, `MEMORY.md`, `SOUL.md`, `AGENTS.md` y notas diarias |
| **Iteraciones máximas** | Cuántos bucles de razonamiento se permiten antes de la convergencia forzada |
| **Bandera habilitada** | Interruptor de apagado |

Los modelos se resuelven en este orden: **pin de conversación → override de modelo del agente → default global**. Una conversación puede fijar temporalmente un proveedor/modelo habilitado, y un agente puede elegir su propio modelo principal; una elección de agente en blanco hereda el default global. Si un pin luego se deshabilita o se elimina, el runtime cae al override del agente o al default global en lugar de fallar la conversación. Cada agente también puede mantener una cadena ordenada de preferencias de failover de proveedores/modelos.

---

## Plantillas: contrata a un compañero que ya sabe el trabajo

No tienes que empezar de cero. `Empleados Digitales → Nuevo` abre un selector poblado desde `classpath:templates/*.json` del servidor; también puedes saltarte las plantillas e ir directo al formulario en blanco.

### 6 plantillas integradas (recomendadas)

Cada una viene con un rol, objetivo, historia de fondo, el conjunto de herramientas adecuado, un avatar pixel-art y un color que pertenece al rol. **Abre una, funciona:**

- **Asistente General** — búsqueda, escritura, análisis y trabajo diario
- **Asistente de Producto** — clarifica usuarios, escenarios y requerimientos antes de dar forma a decisiones de producto
- **Analista de Investigación** — descompone investigación compleja con búsqueda web y contexto del Wiki
- **Soporte al Cliente** — empatiza, busca en el conocimiento disponible, resuelve o escala
- **Analista de Datos** — consulta fuentes de datos, corre SQL, construye gráficos, escribe conclusiones
- **Revisor de Código** — inspecciona código, identifica problemas y recomienda mejoras

Seleccionar una plantilla crea el agente correspondiente de inmediato; saltártela abre el formulario personalizado totalmente editable. Nombre, rol, objetivo, modelo, skills, herramientas y alcance de base de conocimiento siguen siendo editables tras la creación.

---

## Dos formas de pensar

### ReAct — piensa, actúa, observa, continúa

El modo por defecto. Un agente en modo ReAct corre un bucle: **razona** sobre qué hacer a continuación, **actúa** (quizás llamando a una herramienta), **observa** el resultado, decide si iterar de nuevo o responder.

Úsalo para:
- Q&A simple que quizás necesite una o dos llamadas a herramienta
- interacción conversacional donde cada turno del usuario es pequeño
- tareas donde el agente necesita reaccionar a lo que aprende en el camino

Ejemplo: *"¿Qué clima hace hoy en Pekín?"* → razona (necesita datos actuales), actúa (llama a búsqueda web), observa (15–26°C, soleado), responde.

### Plan-and-Execute — primero el plan, después la ejecución

Para tareas más grandes. El agente empieza generando un **plan** — una lista ordenada de 2 a 6 pasos. Luego ejecuta cada paso, uno a la vez. Al terminar, resume todo lo que hizo.

Úsalo para:
- investigación multi-paso ("investiga X, compara Y, escribe un informe")
- cualquier cosa donde los pasos se conozcan por adelantado
- cualquier cosa donde quieras **ver el progreso** — el plan y el estado de cada paso aparecen en una lista de tareas persistente junto a la conversación

Ejemplo: *"Investiga frameworks de Spring AI, compara los tres mejores, escríbeme un informe."* → plan (4 pasos) → ejecuta en orden → resume.

### Cómo elegir

| Situación | Usa | Por qué |
|-----------|-----|-----|
| Q&A simple, llamadas a una sola herramienta | ReAct | Sin overhead de planificación |
| Recuperación de información | ReAct | Normalmente se resuelve en 2–3 ciclos |
| Trabajo ordenado multi-paso | Plan-and-Execute | Un plan explícito es más fácil de ver y depurar |
| Investigación + comparación + escritura | Plan-and-Execute | Cada paso alimenta al siguiente |
| "Lee este archivo y dime X" | ReAct | Una herramienta, una respuesta |
| "Constrúyeme un reporte estructurado sobre X" | Plan-and-Execute | Múltiples pasos de recopilación + síntesis |

Cambia el tipo de un agente en cualquier momento. El mismo prompt de sistema funciona razonablemente en ambos modos.

---

## Delegación paralela multiagente

Un agente no trabaja solo. Un agente puede delegar en otro — o en **múltiples agentes a la vez** (hasta 8).

- **Delegación simple** — entrega una sub-tarea a un agente específico; corre en una sesión aislada, los resultados fluyen de vuelta
- **Delegación paralela** — abre en abanico a múltiples agentes a la vez, cada uno en su propia sesión
- **Visibilidad en vivo de los hijos** — ves el razonamiento, las llamadas a herramientas y el progreso de cada hijo en la ChatConsole mientras sucede
- **Pistas de enrutamiento** — integradas en el prompt de sistema, para que los agentes sepan cuándo manejarlo ellos mismos vs. cuándo delegar

Ejemplo: el agente de código toma el ticket de Jira, el agente de investigación saca datos de competidores, el agente de redacción escribe la respuesta de Slack. Tres en paralelo, los resultados fluyen de vuelta al orquestador.

### Árbol de delegación de subagentes multinivel

::: tip Nuevo en 1.4.0
La delegación ya no es plana. Un empleado padre puede delegar en hijos, y esos hijos pueden delegar más — **recursivamente, hasta 3 niveles de profundidad**. Un equipo temporal puede hacer crecer su propia jerarquía para una tarea específica.
:::

Tres herramientas de delegación, una por cadencia:

- **`delegateToAgent`** — síncrona. Pasa el texto de la tarea al hijo, para que no tengas que re-explicar el contexto.
- **`delegateParallel`** — en abanico. Delega en varios hijos a la vez; cada uno corre en su propia sesión aislada y los resultados se recogen juntos.
- **`delegateAsync`** — en segundo plano. Devuelve un `task_id` inmediatamente mientras el hijo corre en segundo plano; recoge el resultado más tarde con **`taskOutput`**. `taskOutput` tiene una **compuerta de atribución** — solo la **misma conversación + el mismo usuario** que originó la tarea puede leer su resultado, previniendo fugas entre conversaciones / usuarios.

Los hijos tienen denegado un conjunto por defecto de herramientas para que el árbol no se desboque:

- `delegateToAgent` / `delegateParallel` / `listAvailableAgents` (guarda de recursión — los hijos no pueden lanzar sus propias delegaciones síncronas/paralelas ni enumerar agentes hermanos)
- `setGoal` / `addGoalCriterion` / `completeGoal` / `getGoalStatus` (la propiedad del objetivo se queda con el padre)
- `remember` / `remember_structured` / `forget_structured` (los hijos no pueden escribir en la memoria a largo plazo del padre)
- `create_employee` (los hijos no pueden conjurar empleados nuevos)

Esta lista de denegación por defecto es ajustable vía `mateclaw.delegation.child-denied-tools`.

La delegación se empareja con el sistema de [Objetivos](./goals) — el padre define objetivos, descompone el trabajo y delega sub-tareas; los hijos se enfocan en la ejecución.

### UI — línea de tiempo anidada de subagentes + panel de plan siempre visible

La ChatConsole dibuja el árbol de delegación completo, no un log plano:

- **El inicio de la delegación** se marca claramente
- Cada hijo muestra su **nombre / profundidad / extracto de tarea**
- **Insignias de completitud**: éxito / timeout / error, más duración y longitud del contenido
- Cada subagente tiene un **id + parentId + depth** estable, para que el anidamiento sea legible en la línea de tiempo — puedes ver exactamente quién delegó en quién
- **El panel de plan está siempre visible** — ya no solo en Plan-and-Execute; el progreso del árbol de delegación se pliega en el mismo panel

---

## Kanban de Planes

::: tip Nuevo
La página `Empleados Digitales` ahora tiene un interruptor triple arriba: **Plantilla / En Vivo / Kanban de Planes**. El Kanban muestra cada plan producido por cada empleado del workspace, ordenado por estado en un solo tablero para que veas de un vistazo quién hace qué y dónde están las cosas atascadas. (Visible solo para administradores.)
:::

El tablero es una vista global de los planes de **Plan-and-Execute**, con cuatro columnas en las que los planes caen automáticamente:

| Columna | Significado |
|--------|---------|
| **Pendiente** | Plan generado, el primer paso aún no ha empezado |
| **En ejecución** | El primer paso ha empezado |
| **Hecho** | Todos los pasos completados |
| **Fallido** | Un paso falló y no se reintentará |

El diseño es **estilo swimlane**: cada empleado que tiene planes tiene su propia fila, ordenada por actividad más reciente, con un desplegable arriba de la página para filtrar a un solo empleado. Múltiples re-planificaciones para el mismo objetivo se colapsan en **una tarjeta + insignia ×N** — sin apilamiento. Cada tarjeta muestra el texto del objetivo, una barra de progreso (pasos completados / total) y chips de distribución de pasos (N pendientes / M en ejecución / K hechos).

El tablero es **de solo lectura** — el estado lo impulsa la ejecución, no el arrastrar y soltar. Haz clic en una tarjeta y un **panel de detalle del plan** se desliza desde la derecha: empleado asignado, estado, KPIs (cantidad de pasos / progreso / fecha de creación), salida de ejecución (Markdown renderizado) y una línea de tiempo de pasos expandible. Un botón "Objetivos" arriba enlaza directo a la lista activa de [Objetivos](./goals).

REST: `GET /api/v1/plans?limit=N` (los N planes más recientes de todos los empleados), `GET /api/v1/plans?agentId=...` (por empleado), `GET /api/v1/plans/{id}` (con detalle de pasos).

### Delegación por paso hacia empleados especialistas

::: tip Nuevo
Un plan multi-paso no tiene que ser corrido por un solo empleado de principio a fin. Al generar un plan, el planificador puede asignar **pasos individuales** a empleados más especializados del workspace.
:::

El mecanismo es **automático** — sin cableado manual. Durante la planificación, el sistema muestra al planificador a todos los demás empleados habilitados del workspace (nombre y descripción incluidos); el planificador marca un paso para un empleado especialista cuando ese paso cae claramente dentro del dominio del especialista, dejando los pasos restantes para sí mismo. La mayoría de los pasos normalmente no necesitan delegación.

- La delegación se registra en `mate_sub_plan.assigned_agent_id`; una insignia azul — **"Delegado a &lt;nombre del empleado&gt;"** — aparece debajo del paso en el panel de detalle del plan
- Los pasos delegados se ejecutan en una **sub-conversación** acotada a la conversación del plan padre — **no** se filtran a la lista de conversaciones de nivel superior como sesiones independientes
- La delegación por paso comparte la misma semántica que el sistema de [Objetivos](./goals) y el **árbol de delegación multinivel** de arriba: el padre descompone el trabajo, los especialistas hacen su parte

---

## Construye un equipo desde una frase: el skill constructor de empleados digitales

::: tip Nuevo en 1.4.0
¿No quieres crear empleados uno a la vez? Dale una frase y deja que el skill "constructor de empleados digitales" arme todo el equipo por ti.
:::

El skill parte de tu frase y corre la cadena completa:

1. **Clarifica el requerimiento** — primero fija la frase vaga, confirmando el problema que realmente intentas resolver
2. **Diseña los roles** — lo descompone en **2 a 6** roles complementarios
3. **Crea cada uno** — llama `create_employee` por rol para producir empleados reales y utilizables
4. **Los encadena en un borrador de workflow** — enlaza los empleados en un borrador de [workflow](./workflow) que puedes ajustar de inmediato

La herramienta compañera **`list_capability_catalog`** deja que el skill examine qué herramientas / skills / bases de conocimiento tiene disponibles el despliegue antes de asignar capacidades a los roles. Los empleados creados quedan **habilitados al crearse** — sin interruptor extra que activar.

---

## Asistente de creación de un solo empleado

::: tip Nuevo
El skill constructor de equipos de arriba crea un equipo completo de una sola vez. Si solo necesitas **un** empleado y no quieres llenar cada campo a mano, usa el botón **Asistente de Creación** en la esquina superior derecha de la lista de empleados — describe lo que quieres en una frase, y la IA redacta el empleado para que lo ajustes antes de guardar.
:::

Es un asistente de UI de tres pasos separado (`Empleados Digitales → Asistente de Creación`), distinto del skill constructor de equipos: el skill produce un equipo a través de una interfaz de chat; el asistente produce un solo empleado a través de una página dedicada.

1. **Describe** — escribe una frase en lenguaje natural en la caja de entrada ("un asistente de operaciones que rastrea noticias de competidores y escribe un informe diario"). Chips de ejemplo debajo de la caja te dejan llenar uno con un solo clic
2. **Revisa** — la IA devuelve un borrador: nombre, emoji de avatar, rol, objetivo, prompt de sistema, tipo (`react` / `plan_execute`), pregunta inicial sugerida, etiquetas y **ligaduras recomendadas de herramientas / skills / bases de conocimiento**. Cada campo es editable; la lista de capacidades usa un selector con búsqueda
3. **Publica** — confirma y el empleado se crea junto con todas las ligaduras de herramientas / skills / KB de una vez; se te ofrece "Empezar a chatear / Crear otro / Volver a la lista"

**La prevención de alucinaciones** es la decisión de diseño clave aquí: la IA solo puede sugerir herramientas, skills y KBs que **realmente existen** en tu despliegue — cualquier cosa que el modelo invente y que no coincida con una capacidad real se verifica y descarta del lado del servidor durante la generación, antes de que el borrador llegue al asistente. Cada ligadura mostrada en el borrador es inmediatamente utilizable.

Endpoint del backend: `POST /api/v1/agents/generate`, cuerpo de solicitud `{ "requirement": "tu descripción en una frase" }`, la respuesta es un borrador validado.

---

## Pensamiento profundo

No toda pregunta merece razonamiento profundo, pero algunas sí. AuraClaw te deja activar el pensamiento profundo por agente, por conversación:

- **`thinkingLevel`**: `off` / `low` / `medium` / `high` / `max`
- Soporta el pensamiento extendido de Anthropic, el razonamiento qwq de DashScope, `reasoning_effort=high` de OpenAI o1
- El bloque de pensamiento fluye a la UI como un panel colapsable — ves razonar al modelo, los tokens no se desperdician en tareas que no lo necesitan

---

## Contratar a un empleado digital

`Empleados Digitales → Nuevo`:

1. Elige una plantilla integrada, o empieza desde una configuración personalizada
2. Nómbralo, elige un avatar (librería pixel-art, o sube el tuyo)
3. Escribe un **Rol** de una frase, un **Objetivo** de una frase, una **Historia de fondo** de pocas frases
4. Escribe un **eslogan de tarjeta de empleado** de una línea — la autopresentación mostrada en la tarjeta
5. Elige el tipo (`react` o `plan_execute`)
6. Escribe (o edita) el prompt de sistema (rol / objetivo / historia se auto-anexan — no los repitas)
7. Elige qué herramientas puede usar, liga las bases de conocimiento que deba leer
8. Define `max_iterations` (por defecto 100)
9. Guarda

Vivo de inmediato. Llámalo desde el chat o vía API.

### Ligadura de herramientas (selector de herramientas por agente)

::: tip Nuevo en 1.3.0
En v1.2.0 la ligadura de herramientas del empleado era una lista plana de "marca lo que quieras". v1.3.0 la rehace como un selector **agrupado + consciente del estado + consciente del namespace**, específicamente para manejar la suciedad de las herramientas MCP.
:::

Abre la pestaña Herramientas del editor de empleados digitales y obtienes:

- **Agrupado por fuente**: herramientas integradas / herramientas inyectadas por skills / herramientas MCP (a su vez agrupadas por servidor) / herramientas ACP
- **Insignias de estado**: cada herramienta lleva una etiqueta —
  - `connected` — utilizable actualmente
  - `stale` — este servidor MCP está inalcanzable ahora mismo, pero la ligadura se preserva (funcionará apenas el servidor vuelva)
  - `unavailable` — el servidor / skill ha sido deshabilitado; la ligadura se preserva pero el runtime no se la mostrará al empleado
  - `orphan` — referencia una herramienta que **ya no existe** (servidor eliminado, herramienta renombrada); la acción de guardar **rechaza** las referencias huérfanas y fuerza la limpieza
- **Colisiones de namespace**: cuando dos servidores MCP distintos exponen el mismo nombre de herramienta (p. ej. ambos tienen `read_file`), el selector muestra los nombres totalmente prefijados (`server-a__read_file` / `server-b__read_file`); el prompt de sistema del empleado los mapea de vuelta a los originales para que el LLM no se confunda
- **Validación al guardar**: cada herramienta marcada pasa por `AgentBindingService.validate(...)` — cualquier referencia huérfana falla el guardado y debe limpiarse
- **Renombrado de servidor MCP**: las ligaduras atadas a un servidor renombrado **lo siguen automáticamente** (emparejadas vía caché de herramientas persistida) — sin necesidad de re-marcar

UI: `Agentes → elige empleado → Herramientas`.

Detalles de implementación: ver [MCP](./mcp).

### Ligadura de base de conocimiento (KB principal por agente)

::: tip Nuevo en 1.5.0
El editor de empleados tiene una pestaña nueva "Base de Conocimiento" donde puedes elegir una **KB principal** para cada empleado. Las bases de conocimiento siguen siendo compartidas por el workspace — la ligadura solo declara "esta es a la que recurro por defecto", no restringe el acceso de otros empleados.
:::

**Versión corta: cada empleado puede elegir una base de conocimiento como su "KB principal" — la que consulta por defecto. O no elegir ninguna.**

El modelo (vale la pena leerlo una vez para que no te sorprenda después):

- **Las bases de conocimiento son compartidas por el workspace.** Una KB pertenece al workspace en el que se creó; todo empleado de ese workspace puede verla. Ligar una KB a un empleado **no** la hace exclusiva — otros empleados pueden seguir usándola
- **La "KB principal" es solo un default.** Le dice a las herramientas wiki (`wiki_search` / `wiki_read` / `wiki_backlinks` / ...): "cuando el llamador no especifique `kbName` / `kbId`, usa esta"
- **Varios empleados pueden elegir la misma KB como principal.** No interfieren — la ligadura de cada uno es propia, la KB en sí no se muta
- **No ligar está bien.** Sin principal configurada, el runtime cae a la KB más recientemente actualizada del workspace

UI: `Empleados → elige empleado → Editar → Base de Conocimiento`.

| Opción | Comportamiento |
|--------|----------|
| **🚫 Sin KB principal** | Limpia la ligadura; la próxima vez que las herramientas wiki del empleado omitan `kbName`, el runtime cae a la KB más recientemente activa del workspace |
| **📚 &lt;nombre de KB&gt;** | Fija esta KB como principal; las herramientas wiki la usan por defecto. La fila también muestra la cantidad de páginas de la KB |

Cada fila muestra: icono, nombre, descripción, cantidad de páginas. La lista es el **conjunto completo** de KBs del workspace actual — incluyendo las que otros empleados ya eligieron como principal.

#### Cómo decide el runtime "qué KB leer"

Cuando un empleado invoca una herramienta wiki, el orden de resolución es:

1. La llamada a herramienta llevó explícitamente `kbName` / `kbId` — usa ese
2. Sin destino explícito → revisa el `primaryKbId` del empleado; si apunta a una KB visible del workspace, usa esa
3. Sin `primaryKbId` tampoco → elige la KB más recientemente actualizada del conjunto visible del workspace
4. El workspace tiene cero KBs → la herramienta devuelve vacío, el LLM decide qué hacer a continuación

Nota de migración: las versiones tempranas persistían la ligadura en `mate_wiki_knowledge_base.agent_id` (uno a uno, semántica exclusiva). A partir de la migración V130, cada `kb.agent_id` legacy se rellena hacia el `agent.primary_kb_id` correspondiente; la columna vieja se queda como fallback de solo lectura, pero las escrituras nuevas solo tocan `agent.primary_kb_id`. Si dependías de `kb.agent_id` para aislar una KB a un agente específico, revisa esas ligaduras en el editor — las KBs ahora son visibles para todo empleado del workspace.

#### Deshabilita las bases de conocimiento por completo para un empleado

::: tip Nuevo
La parte superior de la pestaña "Base de Conocimiento" ahora tiene un interruptor: **Este empleado no usa ninguna base de conocimiento**. Es el contraparte simétrico de los interruptores de exclusión de herramientas y skills.
:::

Hay dos significados distintos de "ninguna KB seleccionada":

- **Selector dejado vacío** = "no he especificado ninguna" → en runtime, el empleado **hereda todas las KBs del workspace** (el comportamiento por defecto)
- **Interruptor activado** = "explícitamente quiero cero KBs" → en runtime, el conjunto visible de KBs del empleado se trata como **vacío**

Tras guardar con el interruptor activado, la ligadura de KB del empleado se limpia y se marca como "explícitamente libre de KB"; aparece una insignia **Deshabilitado** en la pestaña. El efecto:

- `wiki_read_page` / `wiki_search_pages` / `wiki_semantic_search` y todas las demás herramientas wiki devuelven `"no knowledge base"` — las herramientas siguen en el conjunto, solo que no producen resultados
- El endpoint `/wiki/pages` del webchat devuelve una lista vacía para este empleado
- Toda inyección y anclaje de KB queda apagado

**Apagado por defecto** — todos los empleados existentes no se ven afectados. El interruptor se puede quitar en cualquier momento: seleccionar al menos una KB en el selector y guardar limpia automáticamente la bandera (una ligadura no vacía tiene precedencia sobre la exclusión, previniendo estados contradictorios).

La bandera vive en `mate_agent.wiki_disabled` (migración V154, cubriendo H2 / MySQL / KingbaseES).

### Buenas prácticas del prompt de sistema

El prompt de sistema es la voz, las prioridades y las restricciones del empleado. **Rol / Objetivo / Historia de fondo**, las instrucciones de skills y la memoria del workspace se anexan automáticamente al prompt final — no los escribes tú mismo.

Tu parte debería cubrir:

1. **Cómo debe hablar** — tono, estilo, preferencias de redacción ("profesional pero no tieso" / "mantente cauto en respuestas de cara al cliente")
2. **Qué tiene permitido y qué se espera que haga** — el límite de la tarea
3. **Cómo comportarse ante la incertidumbre** — "busca primero, no inventes" / "pregunta antes de correr un comando peligroso"
4. **Formato de salida** — si necesitas estructura, dilo

Deja fuera:

- Descripciones de herramientas — auto-inyectadas
- Instrucciones de memoria del workspace — vienen de `AGENTS.md`
- Comportamiento específico del framework (formato de llamadas a herramientas, estructura ReAct) — no pelees con el runtime

Ejemplo:

> Eres un asistente profesional de documentación técnica. Tus responsabilidades:
>
> 1. Buscar y organizar materiales técnicos según las necesidades del usuario
> 2. Responder preguntas con formato claro y estructurado
> 3. Asegurar que los ejemplos de código sean sintácticamente correctos
> 4. Ante la duda, buscar primero en lugar de fabricar información
>
> Pautas:
> - Cita fuentes al referenciar información externa
> - Para preguntas sensibles al tiempo, obtén la fecha actual antes de buscar

---

## Para desarrolladores: cómo corre realmente el agente

Si solo usas agentes, sáltate esta sección. Si construyes sobre ellos — agregando nodos, personalizando el enrutamiento, conectando extensiones — ve directo a [Arquitectura](./architecture). Las topologías del grafo, las listas de nodos, las claves de estado compartido y los puntos de extensión viven todos ahí.

---

## Estados del ciclo de vida

| Estado | Significado |
|-------|---------|
| `IDLE` | Listo para entrada |
| `PLANNING` | Generando un plan (modo Plan-and-Execute) |
| `EXECUTING` | Corriendo llamadas a herramientas o sub-tareas |
| `RUNNING` | Bucle ReAct activo o ejecución de grafo Plan-Execute |
| `WAITING_USER_INPUT` | Pausado esperando respuesta del usuario |
| `DONE` | Completado |
| `FAILED` | La ejecución falló |
| `ERROR` | Estado de error |

Por qué terminó el turno:

| Valor | Significado |
|-------|---------|
| `NORMAL` | El LLM dio una respuesta final directa |
| `SUMMARIZED` | Completado tras una pasada de compresión de contexto |
| `MAX_ITERATIONS_REACHED` | Convergencia forzada en el límite de iteraciones |
| `ERROR_FALLBACK` | Respuesta degradada tras un error |
| `INCOMPLETE` | La respuesta no terminó; necesita reintento o continuación |
| `EVIDENCE_INSUFFICIENT` | La respuesta final citó hechos no verificados por ningún resultado de herramienta |
| `STOPPED` | El usuario detuvo activamente el turno |
| `RETURN_DIRECT` | Una herramienta con `returnDirect=true` cortocircuitó el bucle; el resultado se entregó sin volver a entrar al LLM |

---

## Características de confiabilidad

Estas son cosas que el runtime hace para que los agentes no fallen de formas que tendrías que depurar:

- **Poda de contexto** — cuando la ventana de contexto se llena demasiado, el LLM resume los turnos anteriores y el resumen los reemplaza. Cacheado por 30 minutos. Inyectado como mensaje de usuario, no de sistema, para prevenir inyección de prompt desde contenido histórico.
- **Compactación estructurada (ante prompt demasiado largo)** — cuando el modelo devuelve "prompt too long", el runtime recorre una escalada de cuatro etapas: **recorte suave → limpieza dura → pre-poda → resumen estructurado del LLM**. En cada etapa **siempre preserva el prefijo** — el prompt de sistema + el ancla del objetivo quedan intactos — e inyecta el resumen final como UserMessage. Los resultados de las herramientas de delegación **nunca se compactan** (son la salida ganada con esfuerzo de un hijo; si los pierdes, desaparecieron). Tras una compactación disparada por PTL hay un **enfriamiento de 1 minuto**, para que el runtime no siga martillando al LLM dentro del mismo turno sobre-presupuestado.
- **Recuperación de pensamiento** — si un stream se rompe a mitad de respuesta, el pensamiento y contenido parciales persisten y aparecen cuando la conversación recarga.
- **Manejador del límite de iteraciones** — en lugar de crashear cuando se alcanza `max_iterations`, el runtime fuerza una respuesta-resumen de mejor esfuerzo.
- **Limpieza de streams obsoletos** — todo stream SSE abierto se rastrea, los abandonados se cosechan automáticamente.
- **Reintento 429** — los errores de límite de tasa del LLM disparan reintentos automáticos con backoff.
- **Detección de repetición** — los agentes que buclean sobre la misma llamada a herramienta son forzados a salir.
- **Detección de estancamiento + re-planificación** — en modo Plan-and-Execute, cuando un paso lanza una excepción o falla repetidamente dentro de un bucle de herramientas, el runtime descarta el plan actual, lleva la razón del fallo de vuelta al nodo de planificación y **re-planifica** para rodear el paso roto — en lugar de empujar un resultado basura hacia adelante. Ver [Objetivos · Detección de estancamiento y re-planificación](./goals).
- **Continuación dura en el tope de iteraciones** — un empleado con un objetivo activo que llega a su límite de iteraciones puede **reanudar con un presupuesto de iteraciones fresco y completo** en lugar de detenerse y esperar a que envíes otro mensaje. Ver [Objetivos · Continuación dura](./goals).
- **Timeouts de herramientas configurables** — una herramienta lenta no puede congelar un turno.
- **Monitor de salud de canales** — los adaptadores de canal que fallan reinician con backoff exponencial.

Ninguna de estas son botones de cara al usuario. Simplemente suceden.

---

## API de gestión de agentes

### Crear

```bash
curl -X POST http://localhost:18088/api/v1/agents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Assistant",
    "description": "A professional technical documentation assistant",
    "agentType": "react",
    "systemPrompt": "You are a professional technical documentation assistant...",
    "maxIterations": 10
  }'
```

### Listar / Obtener / Actualizar / Borrar

```bash
curl http://localhost:18088/api/v1/agents -H "Authorization: Bearer YOUR_JWT_TOKEN"
curl http://localhost:18088/api/v1/agents/1 -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl -X PUT http://localhost:18088/api/v1/agents/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"Tech Assistant v2","maxIterations":15}'

curl -X DELETE http://localhost:18088/api/v1/agents/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Chat en streaming

```bash
curl -N "http://localhost:18088/api/v1/agents/1/chat/stream?message=hello&conversationId=default" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Depuración

Logging DEBUG en `application.yml`:

```yaml
logging:
  level:
    vip.mate.agent: DEBUG
    vip.mate.agent.graph: DEBUG
```

Verás la ejecución nodo por nodo: transiciones de estado, enrutamiento del dispatcher, conteos de iteraciones, argumentos y resultados de llamadas a herramientas, resultados de chequeos de Tool Guard.

### Problemas comunes

| Síntoma | Causa probable |
|---------|--------------|
| El agente no responde o expira | Config de modelo incorrecta, clave de API inválida, cuota agotada |
| El agente se queda en bucle | `max_iterations` demasiado bajo, o una herramienta devolviendo errores repetidamente |
| `MAX_ITERATIONS_REACHED` ocurre seguido | Refina el prompt de sistema o sube el límite |
| Las llamadas a herramientas fallan en silencio | Tool Guard está bloqueando — revisa `mate_tool_guard_audit_log` |
| El grafo en espera de aprobación no reanuda | Desajuste de formato de `toolCallPayload` en `chatWithReplay` |

---

## Siguiente

- [Herramientas](./tools) — qué pueden llamar los agentes
- [Skills](./skills) — cómo extender lo que los agentes pueden hacer
- [LLM Wiki](./wiki) — cómo leen conocimiento los agentes
- [Memoria](./memory) — cómo recuerdan los agentes entre conversaciones
- [Workflow](./workflow) (1.3.0+) — orquesta múltiples empleados digitales y acciones de sistema en un proceso de negocio
- [Triggers](./triggers) (1.3.0+) — deja que los eventos inicien workflows o conversaciones de agente automáticamente
- [Arquitectura](./architecture) — el runtime StateGraph a fondo
