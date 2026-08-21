# Roadmap

> "La gente no sabe lo que quiere hasta que se lo muestras."
>
> Esto no es una lista de features. Es un manifiesto sobre **cómo debería existir tu asistente de IA.**

---

## En qué creemos

Todos merecen un asistente de IA que realmente los entienda.

No un juguete de chat. No una demo técnica. Una **contraparte digital** — una que sepa cómo trabajas, se conecte a todas tus herramientas, piense por ti, ejecute por ti y recuerde por ti.

**AuraClaw es esa cosa.**

---

## Qué hemos lanzado

### v1.0 — Piensa y actúa ✅ Lanzado

Hacer del asistente de IA un compañero que usa herramientas, no una caja de chat.

- Motor ReAct: razona, actúa, observa, razona de nuevo
- Orquestación Plan-and-Execute: primero el plan, luego ejecuta paso a paso
- Arquitectura StateGraph: orquestación de agentes basada en grafo de estado
- DynamicAgent: cargado desde la base de datos en runtime, ajustable sin reiniciar
- 20 herramientas integradas: búsqueda / shell / I/O de archivos / delegación / generación multimodal / cron / SQL
- Tool Guard + File Guard + Log de Auditoría: toda llamada a herramienta tiene aprobación, control y registro
- Sistema de skills SKILL.md: instala capacidades nuevas en tu IA como apps

### v1.1 — Está en todas partes ✅ Lanzado

Sacar la IA de la caja de chat en una página web y meterla en todo IM que tu equipo realmente use.

- **8 canales**: Web / DingTalk / Feishu / WeCom / Telegram / Discord / QQ / WeChat Personal / Slack
- Memoria de 4 capas: contexto de sesión + memoria de workspace + extracción post-chat + consolidación a las 2 AM
- Diario de consolidación DREAMS.md: auditoría legible de los cambios de memoria
- Aislamiento de workspace: todo agente / skill / wiki / conversación / memoria pertenece a un workspace
- ChatGPT OAuth + Anthropic Claude Code OAuth: inicia sesión con tu suscripción, sin clave API
- LLM Wiki + RAG: archivos crudos se vuelven páginas estructuradas con enlaces bidireccionales y resúmenes

### v1.2 — Es tu compañero de trabajo ✅ Lanzado (2026-05-05)

Renombró "agentes" a **empleados digitales** — no purismo de vocabulario, un cambio de cosmovisión.

- **Empleados digitales** con Rol / Objetivo / Historia de fondo — no un prompt de sistema frío
- **5 plantillas de carrera**: investigador de producto / soporte al cliente / curador de conocimiento / analista de datos / asistente ejecutivo
- **Los skills son columnas vertebrales**: cada skill tiene su propio SKILL.md + LESSONS.md + filesystem de workspace
- **Puente ACP**: Claude Code, Codex, Gemini CLI se enchufan como empleados
- **Consola de runtime Backstage**: por primera vez puedes **ver qué está haciendo cada empleado ahora mismo**
- Asistente de onboarding + Dashboard + Doctor

Historia completa: [notas de release v1.2.0](./releases/1.2.0).

### v1.3 — Orquesta flujos de negocio ✅ Lanzado (2026-05-13)

Graduarse de framework de chatbots a SO de procesos de negocio — un flujo ya no es varios empleados chateando por separado, sino un **DSL de pasos lineales** publicable, disparable y reproducible.

- **Workflow**: 7 modos de paso (sequential / fan_out / collect / conditional / await_approval / dispatch_channel / write_memory) + expresiones Pebble + autoría JSON-primero + revisiones enteras + historial de corridas
- **Lenguaje natural → borrador de workflow**: describe el flujo, un agente emite graph_json, un humano revisa antes de publicar
- **Triggers**: 6 tipos de patrón (cron / webhook / channel_message / agent_lifecycle / content_match / workflow_completion), gobernanza de eventos encendida por defecto (dedup / rate limit / guarda de recursión)
- **Pausa `await_approval` persistente**: sobrevive a reinicios del servicio
- Edición de imágenes, 4 herramientas de generación de documentos (Docx/Xlsx/Pptx/Pdf), ligadura de herramientas MCP por agente, enrutamiento de sidecar multimodal

Historia completa: [notas de release v1.3.0](./releases/1.3.0).

### v1.4 — Es más autónomo y lidera equipos ✅ Lanzado (2026-05-23)

Los flujos los escribías tú, pero el empleado en sí todavía "respondía una ronda y se detenía". Este release pone el foco de vuelta en el empleado.

- **Objetivos persistentes**: dilo una vez — el empleado fija el objetivo, se auto-chequea cada ronda y se mantiene en marcha hasta terminar o agotar el presupuesto
- **Árbol de delegación de sub-empleados**: delegación recursiva hasta 3 niveles de profundidad, con herramientas de delegación síncrona / abanico paralelo / asíncrona; el Constructor de Empleados arma un equipo completo desde una frase
- **Divulgación progresiva de herramientas/skills**: el nivel core siempre visible, el nivel extension se activa a demanda vía `enable_tool` / `load_skill` — apila herramientas sin reventar el contexto
- **RBAC de workspace**: roles Owner / Admin / Member / Viewer + compuertas de capacidad — AuraClaw es usable por un equipo por primera vez
- **Feishu como ciudadano de primera clase**: tarjetas interactivas, tarjetas de aprobación, tarjetas en streaming, transcripción de voz, I/O de archivos/audio/video, herramientas nativas del canal
- Gemini nativo, xAI / Grok, fijación de modelo por conversación, compactación estructurada de contexto, failover por rate-limit

Historia completa: [notas de release v1.4.0](./releases/1.4.0).

### v1.5 — Es verificable, el conocimiento se auto-mantiene, la memoria conoce a su dueño ✅ Lanzado (2026-06-04)

Hacer la autonomía **verificable**, el conocimiento **auto-mantenido** y la memoria **consciente del dueño**.

- **Checklists de objetivos**: los objetivos se descomponen en criterios independientemente verificables; el evaluador los marca uno por uno — **todos marcados o no está hecho**. Nada de "95% es suficientemente cerca"
- **Wiki auto-mantenido**: interenlace de páginas `[[wikilink]]` + reescrituras en cascada de renombrado/borrado + lint de enlaces rotos; capas de conocimiento hecho vs. experiencia con propagación de obsolescencia; perfiles pageType + permisos por agente; pipelines de procesamiento disparados por eventos; directorios locales montados como fuentes de conocimiento con sync incremental
- **Aislamiento de memoria por dueño**: toda memoria lleva un owner_key y un alcance de visibilidad (personal / equipo / global) — un empleado sirve a todo un grupo sin cruce de cables; las APIs pasan `endUserId`
- KB primaria por empleado, enrutamiento por proveedor preferido que realmente aplica, archivos generados persistidos a disco

Historia completa: [notas de release v1.5.0](./releases/1.5.0).

### v1.6 — Te encuentra donde estás ✅ Lanzado (2026-06-22)

Dónde puede correr, qué puede hacer con manos y ojos, y cuán directamente moldeas quién es.

- **KingbaseES + PostgreSQL como ciudadanos de primera clase**: la familia PostgreSQL comparte un árbol de migraciones; entornos regulados / de compra doméstica cubiertos; MySQL y H2 de escritorio intactos
- **Las imágenes persisten entre turnos**: el screenshot que enviaste hace tres mensajes sigue visible en el seguimiento; `image_analyze` re-lee a demanda
- **`execute_code`**: el empleado escribe código y lo corre — aritmética, conversión de archivos, verificación se vuelven acciones reales en lugar de adivinanzas
- **Moldea la identidad del empleado**: un editor real para AGENTS.md y otros archivos de contexto (modal + reorden de secciones); un bloque de identidad Sobre Ti; el empleado sabe en qué modelo corre
- **Acceso a KB acotado** + pestaña de Fuentes del Wiki (multi-ruta + glob + auto-sync por KB)
- Proxy saliente global, normalización determinista de Markdown de respuestas finales

Historia completa: [notas de release v1.6.0](./releases/1.6.0).

### v1.7 — Está listo para producción ✅ Lanzado (2026-07-04)

Una **pasada de productionización**: una vez que lo pones en colaboración real, los lugares que se vuelven invisibles, incerrables, fuera de alcance, demasiado grandes para la ventana y amurallados — todos arreglados.

- **Los tres caminos de aprobación cerrados end-to-end**: el `await_approval` del workflow realmente empuja a los canales y resuelve → reanuda la ejecución; el canal WebChat (clave API) puede aprobar/denegar y re-ejecutar; los botones de tarjeta de Feishu/WeCom resuelven directamente las aprobaciones de workflow
- **Las tareas largas son visibles**: un panel de Resumen de Ejecución siempre visible (progreso de pasos + árbol de sub-agentes delegados en vivo) + un desglose de tokens por turno (cache hit/miss/write + división de razonamiento) + costo de sub-agentes consolidado + descarga de archivos generados de un clic
- **Encaja en la ventana real del modelo**: sondeo de ventana de contexto de modelos locales, un presupuesto de tokens unificado para la inyección de prefijo, degradación para contexto pequeño y control presupuestario de esquemas de herramientas — se acabaron los rechazos pre-vuelo de "adivina 32K" o el truncamiento silencioso
- **Se abre**: una API abierta de base-de-conocimiento + Deep Research (clave API + rate limit + SSE), un SPI de proveedores de búsqueda enchufable y reenvío de identidad MCP (llevar la identidad del usuario autenticado a un MCP STDIO)
- **Llega más lejos**: modo dual desktop local-embebido / remoto-centralizado + cambio multi-servidor + el código fuente de `mateclaw-desktop` abierto; un modo de despliegue LAN abre acceso de intranet controlado
- **Exportación de datos operacionales de un clic**: Excel de 9 hojas desde el Dashboard + un CLI para exportación offline
- Visibilidad de fallos de procesamiento del Wiki, cadenas de modelos por empleado, OpenAPI / Swagger directamente depurable, botón flotante de volver-al-fondo en el chat

Historia completa: [notas de release v1.7.0](./releases/1.7.0).

### v1.8 — Hace un trabajo completo ✅ Lanzado (2026-07-12)

El empleado mira **hacia afuera y termina un trabajo completo** — de un brief de una frase a un post publicable — sobre las primitivas propias de AuraClaw.

- **Content Studio** — la primera *escena* insignia: un empleado sembrado corre elegir-tema → investigar → redactar → ilustrar → des-IA → layout → entregar. Los artículos de imagen-texto para **Cuenta Oficial de WeChat (公众号)** (HTML de estilo inline → caja de borradores) y las notas imagen-primero de **Xiaohongshu (小红书)** (≥3 tarjetas verticales 3:4 + vista previa en línea) llegan de primera clase
- **Des-IA-ificación que puedes medir** — una puntuación heurística de traza de IA impulsa un bucle detectar → reescribir → re-chequear, limitado a 3 rondas
- **Una cadena de publicación endurecida para operación real** — imágenes del cuerpo subidas a WeChat, secretos cifrados con AES-GCM, servicio reutilizado + token persistido, reintento + pistas de error en chino, portada de respaldo garantizada; caja-de-borradores-primero, publicación controlada por aprobación
- **Un calendario de contenido que deduplica y recuerda** — toda entrega se escanea por cumplimiento y se auto-registra, una huella de tema detiene las selecciones repetidas, y una página de Calendario de Contenido de solo lectura muestra borrador/empaquetado/publicado/fallido
- **El agente de navegador ve por referencia** — un snapshot de refs de árbol de accesibilidad + interactuar-por-ref, barandillas de privacidad de navegador real y una escotilla de escape CDP controlada
- Anclaje de atención y conciencia del entorno, una guarda de bucle de llamadas a herramientas, un recordatorio de verificación post-mutación; una pasada de carga rápida (~78% menos bundle inicial), un panel de ocupación de contexto, wikilinks entre KBs, notificaciones de progreso MCP, un proveedor Volcano Engine, PostgreSQL 16

Historia completa: [notas de release v1.8.0](./releases/1.8.0).

### v2.0 — Lidera un equipo ✅ Lanzado (2026-07-31)

De "una persona que hace las cosas" a "un equipo que colabora" — los **Equipos de Agentes** se vuelven un roster permanente alrededor de un task board compartido.

- **Entidad de equipo y roles**: un equipo = nombre + líder + miembros + revisores — persistido, reutilizable; el roster y el playbook de colaboración se inyectan en los prompts de los miembros
- **Task board compartido**: kanban de ocho estados, orquestación de dependencias `blockedBy`, despacho paralelo a nivel de miembro, entrega automática de prerrequisitos, resultados asentados despertando al líder
- **Despacho del líder**: el líder descompone, asigna, revisa; un líder Plan-Execute entrega su **plan completo al board** — los pasos se vuelven tareas, las dependencias se vuelven paralelismo
- **Endurecimiento de ejecución**: heartbeats de lease contra doble ejecución, cancelar-interrumpir, compuertas de aprobación humana `in_review`, reintento para fallidos/stale
- **Entregables y observabilidad completa**: los archivos de salida se registran en las tareas, líneas de tiempo de tareas, un board SSE de equipo en vivo y acceso de salto a la corrida palabra por palabra de cualquier miembro
- Más: aislamiento de workspace totalmente sellado, comandos mágicos de canal + la burbuja de progreso de WeCom, rebobinar/regenerar conversaciones, auto-aprobación explicable, recuperación de errores LLM dirigida por política, vista previa de adjuntos en el chat, SKILL.md de fuente única, el proveedor plugin Mem0

Historia completa: [notas de release v2.0.0](./releases/2.0.0); guía de usuario: [Equipos de Agentes](./teams).

### v2.1 — Convierte el trabajo en equipo en una corrida gobernable ✅ Lanzado (2026-08-15)

2.0 construyó los equipos y su task board. 2.1 une las tres cadenas expuestas por el uso continuo: **una identidad para una solicitud de equipo, una trayectoria reproducible para la ejecución, y procedencia más recuperación para cada mejora de skill**.

- **Team Runs unificados**: un `runId` enlaza la solicitud, el DAG de tareas, la ejecución de trabajadores, la síntesis final y los entregables; Chat entrega, Agentes observa y Equipos gobierna la misma proyección
- **Entrega resultado-primero**: las conversaciones de trabajadores salen de la barra lateral normal, los anuncios intermedios se pliegan, y los resúmenes, archivos, excepciones y aprobaciones lideran mientras el detalle profundiza progresivamente
- **Bucle cerrado de evolución de skills**: reflexión + minería de solicitudes recurrentes entre sesiones + promoción + auto-ligadura restringida + entrega de gobernanza al curador + snapshot/restaurar; reflexión/rutina apagadas por defecto, el curador se mantiene solo-previsualización antes de activarse, y los cambios quedan acotados al workspace y reversibles
- **Razonamiento y ejecución reproducibles**: cada ronda de pensamiento, duración de reloj real, orden de herramienta/observación, narración superada y exportación de trayectoria lineal
- **Las capacidades llegan a operaciones reales**: mensajes de canal proactivos, entrega de Cron dirigida, ventanas de contexto a nivel de modelo, puente progresivo de herramientas y política de completitud de acciones
- Endurecimiento amplio en automatización de navegador, WebChat/SSE, progreso de Feishu, Qwen3-ASR, layout de archivos y precisión de ids de 64 bits

Historia completa: [notas de release v2.1.0](./releases/2.1.0); guías: [Team Runs](./teams) y [Skills](./skills).

---

## Siguiente: Agent Loop y seguimiento de equipo

> "Las grandes cosas en los negocios nunca las hace una persona. Las hace un equipo de personas."

Mira hacia atrás en la línea: v1.2 les dio identidad a los empleados, v1.3 hizo los flujos orquestables, v1.4 hizo que los empleados sigan objetivos y levanten árboles de delegación, v1.7 hizo las tareas largas visibles, v2.0 hizo de los equipos un roster permanente, y **v2.1 hizo cada ronda entregable, aprendible y gobernable**.

Queda una "parada": **los empleados son reactivos.** El auto-followup de objetivos solo vive **dentro de una sola corrida**; el cron y los triggers pueden despertar a un empleado, pero cada despertar es una respuesta aislada. Ningún empleado está verdaderamente **de guardia** — vigilando continuamente su área de responsabilidad y decidiendo por sí mismo cuándo actuar.

### Seguimiento de Equipos de Agentes — el roster existe; ahora crece en skills

2.0 entregó la entidad de equipo, el task board, el despacho del líder y la cadena de ejecución endurecida (arriba). Sigue en la pista de equipo:

- [ ] **Revisión entre pares**: los entregables críticos pueden requerir el visto bueno de otro miembro antes de enviarse (el `in_review` de 2.0 es aprobación humana; la revisión entre pares de miembros es el siguiente paso)
- [ ] **Objetivos a nivel de equipo**: un objetivo se descompone en sub-objetivos de miembros; el checklist se agrega entre miembros — pasa el cursor sobre el avatar del líder para ver qué debe todavía el equipo completo
- [ ] **Ligadura equipo-a-canal**: liga un grupo de Feishu / DingTalk a un equipo; @menciona al equipo en el grupo, el líder decide quién lo toma
- [ ] **Retrospectivas de equipo**: el cierre de tareas auto-genera una retrospectiva al LESSONS.md del equipo — este equipo lo hace mejor la próxima vez
- [ ] **Vista de DAG de colaboración / swimlane**: dibuja dependencias de tareas y swimlanes de miembros sobre los datos de línea de tiempo
- [ ] **Mejora del Constructor de Empleados**: una frase emite un **equipo permanente con roster**

### Agent Loop — de "responde y se detiene" a "de guardia"

Un estado nuevo para los empleados: **de guardia**. No esperando a que hables, sino ciclando autónomamente sobre un heartbeat — **despertar → revisar bandeja y objetivos → decidir si actuar → actuar → registrar → dormir**:

- [ ] **Runtime de bucle residente**: un empleado puede ponerse "de guardia", despertando en un heartbeat configurable (minutos a días) para revisar su área de responsabilidad
- [ ] **Bandeja de tareas**: mensajes de canal, eventos de trigger, delegaciones de otros empleados, pendientes que le lanzas — una cola, consumida por prioridad en cada despertar
- [ ] **Continuación de objetivos entre sesiones**: el auto-followup de v1.4/v1.5 vive dentro de una sola corrida; el bucle lleva los objetivos entre sesiones y entre días hasta que todo criterio esté marcado
- [ ] **Presupuestos y cortacircuitos**: presupuestos de token / costo / turnos por bucle; los fallos consecutivos disparan el cortacircuito a dormir pendiente de tu decisión; las compuertas de aprobación de ToolGuard siguen interceptando acciones sensibles — la autonomía no es pérdida de control
- [ ] **Diario del bucle**: qué hizo en cada despertar, por qué eligió no actuar, qué gastó — legible por humanos y reproducible, lo que DREAMS.md es a la memoria
- [ ] **Pausar / reanudar / fichar salida**: controlable desde la UI y desde comandos de canal; la barra lateral de Resumen de Ejecución muestra el estado de bucle de todo empleado de guardia
- [ ] **Horas de silencio y política de interrupción**: acumulación silenciosa de noche, reporte proactivo de lo que importa — integrado con el sistema de empujones, sabe qué vale la pena despertarte

### Donde convergen: un departamento que se corre solo

Un líder en bucle, miembros convocados a demanda — eso es un **departamento digital auto-corrido**:

- Departamento de reporte matutino: el líder despierta a las 7:00, despacha recolección de datos, análisis y escritura a los miembros, revisa entre pares, publica al grupo — despiertas con resultados
- Departamento de soporte: un ticket aterriza en la bandeja, el líder clasifica, asigna al miembro correcto, te escala lo que no puede manejar
- Departamento de inteligencia: un empleado de monitoreo cicla sobre fuentes, despierta al analista solo cuando algo cambió, te notifica solo cuando vale la pena interrumpir

**Los workflows son dueños de los procesos deterministas; los equipos + bucles son dueños del día a día impredecible.** Se complementan — ninguno reemplaza a otro.

### Avanzando en paralelo

- [ ] **Modos de paso `loop` / `invoke_skill` del workflow**: iteración por ítem de arreglos / llamar un skill sin pasar por un empleado
- [ ] **Edición de canvas de workflow**: de renderizado de cadena de solo lectura a arrastrar-para-editar
- [ ] **Vista de replay de corridas**: línea de tiempo de traza + diff de entrada/salida en cualquier nodo
- [ ] **Plantillas de escenario y marketplace**: empaqueta "empleados + equipo + workflow + triggers + estructura de KB" en bundles de escenario importables con un clic

---

## Lo que deliberadamente no hacemos

> "Estoy tan orgulloso de las cosas que no hemos hecho como de las que hemos hecho."

| Corte | Por qué | Cuándo podría volver |
|-----|-----|---------------------|
| **RBAC fino más allá de cuatro roles** | Los roles Owner / Admin / Member / Viewer de v1.4 + compuertas de capacidad cubren necesidades reales de equipo. Los permisos a nivel de botón y la composición de roles personalizados pertenecen a plataformas de gestión empresarial | Cuando clientes SaaS multi-equipo reales necesiten permisos finos |
| **Multi-tenancy** | El multi-tenancy prematuro es cáncer arquitectónico. El aislamiento de workspace ya cubre múltiples equipos en una org | Cuando haya un camino claro de comercialización SaaS |
| **SSO / LDAP / SAML** | La integración empresarial es un pozo sin fondo | Cuando clientes empresariales de pago lo pidan explícitamente |
| **Editor visual de workflow de 30+ nodos** | Los 7 modos de paso ya cubren el 90% de los escenarios reales; el resto se empuja a la generación en lenguaje natural | Cuando un caso de usuario realmente necesite 30+ nodos (raro) |
| **App móvil nativa** | 8 canales IM + desktop (ahora con conexión remota) + Web ya lo cubren. En tu teléfono, usas AuraClaw vía DingTalk / Feishu / Telegram | Cuando los canales Web / IM no puedan entregar una feature móvil irremplazable |
| **Reemplazar ReAct / Plan-Execute** | Los workflows, equipos y bucles **colaboran** con esos dos motores, no los reemplazan — el razonamiento multi-turno de un solo agente sigue viviendo ahí | Nunca los reemplaza |
| **Autonomía total sin presupuesto** | Agent Loop siempre viene con presupuestos, cortacircuitos y compuertas de aprobación. "Corre hasta que se acabe el dinero" no es autonomía, es pérdida de control | Nunca |

---

## Hitos de versión

| Versión | Una línea | Objetivo de experiencia de usuario | Estado |
|---------|----------|----------------------|--------|
| **v1.0** | Piensa y actúa | Un asistente de IA que usa herramientas para resolver problemas | ✅ Lanzado |
| **v1.1** | Está en todas partes | 8 canales + memoria de 4 capas + workspaces + LLM Wiki | ✅ Lanzado |
| **v1.2** | Es tu compañero de trabajo | Empleados digitales + plantillas de carrera + skills columna vertebral + puente ACP + Backstage | ✅ Lanzado |
| **v1.3** | Orquesta flujos de negocio | Workflow + triggers + generación de documentos + ligadura de herramientas por agente | ✅ Lanzado |
| **v1.4** | Es más autónomo y lidera equipos | Objetivos persistentes + árbol de delegación + divulgación progresiva + RBAC + Feishu de primera clase | ✅ Lanzado |
| **v1.5** | Es verificable | Checklists de objetivos + Wiki auto-mantenido + memoria consciente del dueño | ✅ Lanzado |
| **v1.6** | Te encuentra donde estás | Bases de datos domésticas + visión persistente + ejecución de código + moldeado de identidad | ✅ Lanzado |
| **v1.7** | Está listo para producción | Caminos de aprobación cerrados + Resumen de Ejecución y visibilidad de costos + presupuesto de contexto/tokens + API abierta/Deep Research + desktop remoto/LAN + exportación operacional | ✅ Lanzado |
| **v1.8** | Hace un trabajo completo | Content Studio — una frase a un post publicable de 公众号 / 小红书 + interacción de navegador por ref | ✅ Lanzado |
| **v2.0** | **Lidera un equipo** | **Equipos de Agentes + un task board compartido — el líder descompone y despacha, los miembros corren en paralelo, entregables y observabilidad completa** | ✅ Lanzado |
| **v2.1** | **Convierte la colaboración en una corrida** | **Team Runs unificados + evolución cerrada de skills + trayectorias de razonamiento reproducibles + entrega proactiva por canal** | ✅ Lanzado |
| **Siguiente** | **Está de guardia** | **Ciclos residentes de Agent Loop + seguimiento de equipo (revisión entre pares / objetivos de equipo / ligadura de grupo / retrospectivas) = un departamento que se corre solo** | 📋 Planificado |

---

## Una cosa más

No estamos construyendo AuraClaw para perseguir a ChatGPT, ni para ser el próximo Dify, ni para agregar otra buzzword a un deck de financiamiento.

Lo construimos porque creemos una cosa:

**La IA no debería ser una caja de chat en una página web. Debería ser tu segundo cerebro.**

Vive en tu DingTalk, tu Feishu, tu Telegram. Ha leído cada documento que tienes. Recuerda lo que dijiste hace tres meses. Usa las herramientas internas de tu empresa. Consolida memoria mientras duermes. Corre un flujo de negocio completo en tu nombre. **Ahora puede entregar una ronda completa de trabajo en equipo y aprender de ella; lo siguiente, ese equipo se queda de guardia y vigila las cosas a las que no puedes llegar.**

Algún día, olvidarás que es un programa.

**Ese es el día en que ganamos.**

---

*Mantente hambriento. Mantente tonto.*
