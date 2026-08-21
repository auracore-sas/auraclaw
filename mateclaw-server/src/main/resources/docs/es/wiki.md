---
title: LLM Wiki — Motor de Conocimiento Estructurado, No Recuperación Vectorial
description: LLM Wiki digiere documentos crudos en páginas de conocimiento estructuradas con retroenlaces, resúmenes y trazabilidad de fuentes. La ingestión lazy indexa las subidas al instante y compila páginas a demanda; la ingestión eager produce un Wiki completo por adelantado. Los agentes navegan la biblioteca — no hacen grep sobre un almacén vectorial.
head:
  - - meta
    - name: keywords
      content: LLM Wiki,base de conocimiento,motor de conocimiento,retroenlaces,conocimiento estructurado,alternativa RAG,grafo de conocimiento,ingestión lazy,compilación a demanda,búsqueda semántica
---

# LLM Wiki

Una base de conocimiento no es un lugar donde buscas. Es un lugar donde **lees**.

La mayoría de los sistemas de conocimiento de IA hacen una sola cosa: trocean tus archivos, los embeben, devuelven fragmentos al momento de consultar. Obtienes pedazos. No puedes navegarlos. No puedes saber qué "sabe" el sistema sin preguntar. Nada está nunca *terminado*.

El LLM Wiki de AuraClaw hace algo distinto. Suelta material crudo en una base de conocimiento y el sistema lo lee, lo digiere y escribe páginas Wiki estructuradas — cada una con un resumen, retroenlaces y punteros de procedencia hacia el pasaje fuente. Puedes abrir cualquier página y leerla. Puedes editarla. Los agentes leen los resúmenes automáticamente y extraen páginas completas a demanda.

**Es una biblioteca, no un almacén vectorial.**

::: tip Cómo se diferencia de los clones open-source de "LLM Wiki"
En abril de 2026, Andrej Karpathy publicó un GitHub Gist que le dio nombre a la idea: el material que le das a una IA no debería re-triturarse en fragmentos vectoriales al momento de consultar — debería leerse una vez y escribirse en un wiki legible. En un mes, al menos nueve implementaciones de un solo archivo de `llm-wiki` aparecieron en GitHub — útiles, locales, personales.

El LLM Wiki de AuraClaw **es la misma idea, elevada a producto**:

- No el cuaderno de una persona — una **base de conocimiento compartida en equipo** con acceso multiusuario, permisos, auditoría y archivo
- No un script que corre una vez — una capacidad que **los agentes usan continuamente**, cableada a memoria, recuperación y citación
- No solo eager — **el modo lazy compila páginas a demanda**, ahorrando 90%+ de llamadas al LLM a escala
- No markdown crudo tirado al disco — una capa de páginas con **procedencia, enlaces bidireccionales, protección de edición manual y archivo reversible**
- No una herramienta aislada — la **capa de conocimiento del sistema operativo de agentes de AuraClaw**, entretejida a través de memoria, agentes y entrega por canales

> Ellos construyeron un clon. Nosotros construimos un hogar.
:::

---

## El modelo de tres capas

Una base de conocimiento son tres capas apiladas una sobre otra:

1. **Material crudo** — los archivos que dejaste caer. PDF, Word, Excel, PowerPoint, HTML, markdown, texto plano (incl. CSV), o un directorio local completo escaneado de una vez. El sistema los mantiene intactos; cualquier afirmación del Wiki rastrea hasta el pasaje que la produjo.
2. **Páginas Wiki** — artículos estructurados que la IA escribe desde el material crudo. Cada página tiene un título, un resumen, un cuerpo, enlaces bidireccionales a páginas relacionadas (`[[así]]`, más la forma alias `[[destino|texto visible]]`), y punteros de procedencia de vuelta a la capa cruda.
3. **Superficie del agente** — cuando un agente llama a una herramienta wiki, el sistema auto-inyecta los resúmenes de las páginas relevantes en el prompt. Los cuerpos se extraen a demanda. Los agentes no leen archivos crudos. Leen la biblioteca.

Esto importa porque la ventana de contexto del agente deja de desperdiciarse re-leyendo material fuente en cada turno. Los tokens van a pensar, no a leer el mismo párrafo por quinta vez.

---

## Crear una base de conocimiento

`Wiki → Nueva Base de Conocimiento`. Nómbrala por lo que contiene, no por quién la posee. "Especificaciones de producto" le gana a "KB del Equipo Alpha".

Una vez que existe, agrega material:

- **Subir archivos** — arrastra archivos PDF, Word, Excel, PowerPoint, HTML, markdown o texto plano (incl. CSV) al área de subida. Cada archivo se vuelve una fila de material crudo.
- **Escanear un directorio local** — solo escritorio. Apunta a una carpeta y AuraClaw la recorre recursivamente, respetando `.gitignore`, importando todo lo que parezca texto.
- **Pegar texto** — para extractos cortos o transcripciones de conversación.

El sistema empieza a indexar apenas llega el material. Verás un indicador de estado en cada fila: `pending → processing → completed`. Si algunos chunks fallan y otros tienen éxito, la fila queda como `partial` — conservas lo que funcionó, en lugar de tirar todo el documento.

---

## Dos formas de ingerir: ¿necesitas páginas ahora mismo?

`Wiki → Config → Modo de Ingestión` alterna entre:

- **Eager (compilar páginas al subir)** — corre el pipeline completo del LLM para producir un Wiki terminado y navegable. Elígelo cuando quieras páginas listas para leer apenas termine la ingestión. El costo es real: muchas llamadas al LLM por subida, lento, caro.
- **Lazy (indexar ahora, compilar después)** — extrae, normaliza, trocea y embebe. **Cero llamadas al LLM de generación de páginas.** La búsqueda funciona de inmediato; las páginas se producen a demanda cuando un agente o usuario realmente necesita una.

Las KBs existentes quedan en eager por defecto para que nada cambie debajo de ti. Las KBs nuevas que no necesitan un Wiki instantáneo deberían elegir lazy — misma calidad de recuperación, una fracción del costo. Los dos modos coexisten: las páginas que una KB eager ya produjo se quedan; las subidas posteriores honran el modo actual.

> En lazy, "0 páginas" es **éxito**, no fallo. Esto por fin arregla la molestia de larga data donde cualquier subida que no producía páginas se ponía en rojo.

---

## Qué hace realmente la ingestión

### Eager: el pipeline completo

Para cada material crudo, en orden:

1. **Trocear** — divide la fuente en pasajes solapados, adjuntando metadatos estructurales a cada chunk: número de página (PDF / PPTX), ruta de encabezados (`Intro / Configuración / Linux`), identificador de sección y una estimación de conteo de tokens.
2. **Extraer conceptos** — pide al LLM identificar entidades, decisiones, hechos y preguntas abiertas en cada chunk.
3. **Agrupar y redactar** — agrupa extracciones relacionadas en páginas Wiki candidatas y genera borradores estructurados con resúmenes.
4. **Enlazar** — encuentra referencias bidireccionales entre páginas (`[[concepto]]` y `[[concepto|texto visible]]`) y calcula retroenlaces.
5. **Persistir** — escribe páginas en `mate_wiki_page` con citas apuntando de vuelta a los pasajes crudos de los que vinieron.

La ingestión es idempotente. Re-córrela sobre el mismo material y las páginas existentes se actualizan en lugar de duplicarse. El contenido editado a mano está protegido — `locked` le dice al digestor que deje la prosa humana en paz, y tienes que desbloquear explícitamente para dejar que la IA re-redacte.

#### Digestión en dos fases

La ingestión eager corre en dos fases para una aceleración de un orden de magnitud:

- **Fase A (ruteo)** — extrae metadatos y enrutamiento de conceptos, decidiendo a qué páginas alimenta cada chunk.
- **Fase B (fusión)** — genera páginas en paralelo entre múltiples materiales crudos simultáneamente; el grado de concurrencia es ajustable. Cada material crudo tiene su propia **barra de progreso** — se acabó mirar "procesando…" preguntándote qué pasa.

**Reanudable**: ¿interrumpido a mitad de importación? Pulsa "Reprocesar" y solo las páginas sin terminar se re-ejecutan; todo lo ya producido se queda. Los documentos más grandes que el contexto del modelo de embeddings se sub-segmentan automáticamente con mean-pool.

#### Ahorra tokens: un modelo ligero para los pasos baratos

La digestión corre varios tipos de paso de LLM: ruteo, generación de fusión, enriquecimiento, resumen, extracción de entidades. Los pasos de **ruteo / enriquecimiento / resumen / extracción de entidades** son de alto volumen pero ligeros — no hace falta correrlos en el mismo modelo premium que la fusión de páginas.

Apúntalos a un modelo más barato para recortar el gasto de tokens sin tocar la calidad de generación de páginas:

- **A nivel de sistema** — define `wiki.lightModelId` (un id de modelo) en los ajustes del sistema; aplica a los pasos baratos de toda KB.
- **Override por KB** — define `wikiLightModelId` en la config de la KB para sobrescribir el valor del sistema.

Deja ambos sin definir y nada cambia (los pasos baratos siguen usando el default de la KB / sistema). Precedencia: `stepModels.<step>` (fijar un paso) → modelo ligero (solo pasos baratos) → `wikiDefaultModelId` → default del sistema.

### Lazy: indexar ahora, compilar después

El pipeline se colapsa a cuatro pasos:

1. **Extraer** — saca el texto del binario (PDF / DOCX / …).
2. **Normalizar** — jsoup quita el ruido HTML (nav / footer / anuncios); los niveles de encabezado markdown y los marcadores `--- Página N ---` de PDF se detectan para los metadatos posteriores.
3. **Trocear + metadatos** — cada chunk lleva `page_number`, `header_breadcrumb`, `source_section`, `token_count`.
4. **Embeber** — los embeddings aterrizan asíncronamente y la fila se marca `completed`.

¿Cuándo se producen las páginas? No se producen — hasta que alguien pregunta. El sistema recupera los chunks relevantes, pide una página al LLM y liga las citas de la página a los chunks que realmente usó. Nada más.

---

## Páginas de sistema: resumen y log

Cada KB viene con dos **páginas de sistema**:

- `slug=overview` — la puerta de entrada de la base de conocimiento. Alcance, actualizaciones recientes, estadísticas de cobertura viven aquí.
- `slug=log` — un rastro de auditoría amigable con el anexado de actividad de ingestión / compilación / edición.

Ambas están marcadas `page_type=system, locked=1`:

- El borrado (individual, en lote, o la pasada de limpieza durante el reprocesamiento) **se niega a eliminarlas** — obtienes un error limpio, no una caída silenciosa.
- El listado, la búsqueda por palabra clave, la búsqueda semántica y las páginas relacionadas **las filtran por defecto** para que no contaminen los resultados de búsqueda ni la ventana de contexto del agente.
- La lectura por slug (`wiki_read_page("overview")`) sigue funcionando — los agentes pueden optar por incluirlas cuando quieran.

> La flag `locked=1` también es tuya para ponerla en cualquier página curada a mano. La superficie de herramientas de IA la honra igual que honra `lastUpdatedBy="manual"` — se apilan.

---

## Transformaciones: haciendo la KB programable

::: tip Nuevo en 1.3.0
El motor de Transformaciones llegó en v1.3.0. En v1.2.0 y antes, el Wiki era solo recuperación — trocear, embeber, recordar. v1.3.0 le enseña al Wiki a **procesar activamente**: plantillas definidas por el usuario, agregación entre materiales, extracción de citas inversas, salida JSON, transformaciones página-como-entrada, cancelar/re-ejecutar. Historia completa del release en las [notas de release v1.3.0](./releases/1.3.0).
:::

Por defecto el Wiki digiere materiales crudos en las páginas que **él** cree que importan — pero "importar" es su juicio, no el tuyo. **Las Transformaciones** lo voltean: tú escribes una plantilla de prompt que dice "extrae esta forma de cada fuente", y el motor la corre, persiste la salida y la mantiene sincronizada.

Abre `Wiki → [cualquier KB] → Transformaciones`. Cada plantilla se compone de:

- **Nombre** — slug corto en minúsculas usado por las herramientas de agente para dirigirse a la plantilla (p. ej. `contract-risk-extract`)
- **Título / descripción** — legibles por humanos
- **Plantilla de prompt** — el texto de instrucción; soporta placeholders `{input_text}` y `{title}`
- **Modelo** — por defecto el modelo de chat de la KB; puedes fijar una plantilla individual a un modelo específico
- **Aplicar por defecto** — toggle encendido → cada material crudo recién ingerido dispara esta plantilla automáticamente
- **Destino de salida** — `Ninguno` (se queda en el historial de corridas) o `Guardar como página wiki` (se auto-crea una página de síntesis)
- **Formato de salida** — `Markdown` o `JSON` (con validación de esquema opcional)

### Siete plantillas empresariales de fábrica

Disponibles en toda KB nueva; cubren trabajos empresariales comunes:

| Plantilla | Qué produce |
|---|---|
| `contract-risk-extract` | Extracción de riesgo a nivel de cláusula (alto / medio / bajo) con reescrituras sugeridas por IA |
| `meeting-action-items` | Decisiones + ítems de acción (dueño / fecha límite / criterios de aceptación) |
| `customer-profile` | Correos de clientes / registros CRM → perfil estructurado de cuenta |
| `competitor-update` | Señales públicas → resumen de competidores |
| `resume-structured-extract` | Currículum → registro estandarizado (educación / experiencia / habilidades / destacados) |
| `incident-postmortem` | Reporte de incidente → 5-porqués + lista de remediación + palabras clave de incidentes similares |
| `paper-imrad` | Paper / reporte técnico → resumen IMRaD + terminología clave |

### Cuatro formas de disparar una corrida

| Disparador | Cómo se activa | Dónde brilla |
|---|---|---|
| **Manual** | Elige una fuente en la UI, clic en Ejecutar | Iteración de prompt de un solo tiro |
| **Aplicar por defecto** | Activa el toggle en la plantilla; sube un material nuevo | "Todo contrato nuevo se le extrae riesgo al llegar" |
| **Herramienta de agente** | El agente llama `wiki_apply_transformation(name, rawId)` | El empleado digital decide qué plantilla correr |
| **Agregado** | Botón "Agregar todas las corridas" / `wiki_aggregate_transformation` | Map-reduce de N salidas por fuente en una página de síntesis a nivel de KB |

### Entrada: materiales crudos o páginas existentes

Una plantilla no tiene que leer un material crudo — también puede correr contra una página wiki existente (herramienta de agente: `wiki_apply_transformation_to_page(name, slug)`). Esto te deja encadenar plantillas: A convierte una fuente en una página de síntesis, luego B lee esa página y produce una vista distinta.

### Destino de salida: historial de corridas, o una página wiki real

- **Ninguno** — el resultado vive solo en el historial de corridas bajo la tarjeta de la plantilla. Bueno para salida de un solo uso.
- **Guardar como página wiki** — cada corrida exitosa hace **upsert** a un slug fijo `<nombre-plantilla>-<título-fuente>`. Re-correr actualiza la misma página en lugar de generar duplicados. Y:
  - El embedding a nivel de página se dispara automáticamente para que la página de síntesis entre a la búsqueda semántica
  - La salida se parsea en busca de pistas de citación como "第 N 题 / página X" y las citas a nivel de chunk se escriben enlazando de vuelta a los chunks fuente
  - Entra al grafo de relaciones, al hot cache y se vuelve directamente legible por los agentes

### Salida JSON + validación de esquema

Cuando el formato es JSON:

1. Se inyecta un prompt de sistema estricto ("devuelve un solo documento JSON, sin prosa, sin cercas")
2. Ante fallo de parseo el ejecutor reintenta una vez con un recordatorio de error específico
3. Se puede almacenar un JSON Schema en la plantilla; tras parsear, el ejecutor verifica los campos requeridos y el tipo de nivel superior
4. Sigue inválido → la corrida se falla con la razón específica en la columna de error

El JSON válido se envuelve en un bloque con cerca ```json para que el contrato de renderizado markdown y guardar-como-página siga vigente mientras las herramientas downstream pueden seguir haciendo grep / parseando el JSON crudo.

### Agregación entre materiales

¿Tienes 10 contratos procesados cada uno por `contract-risk-extract`? Clic en "Agregar todas las corridas" en la tarjeta:

- El sistema carga toda corrida completada de esta plantilla dentro de esta KB
- Deduplica por fuente (solo la corrida más reciente por material crudo contribuye)
- Los envía a un LLM con un prompt de sistema de fusión + dedupe — los mismos tipos de cláusula se fusionan, las atribuciones de fuente se preservan, los desacuerdos se muestran en lugar de suavizarse
- Hace upsert del resultado a un slug determinista `<nombre-plantilla>-aggregate`
- Dispara el embedding de página para que el agregado entre a la búsqueda semántica

Esto es lo que convierte los extractos por fuente en una síntesis a nivel de KB — se acabó diffeo a ojo entre N contratos.

### Historial de corridas + observabilidad

Cada corrida registra:

- Estado: `pending / running / completed / failed / cancelled`
- Duración, modelo, disparador (manual / apply_default / agent_tool / aggregate)
- Entrada / salida / tokens totales reportados por el proveedor (`8.2k↑ / 1.1k↓`), acumulados entre reintentos
- Página de salida enlazada (cuando output_target=page)
- Salida completa / mensaje de error

La UI te deja:

- **Cancelar** — marca una corrida en curso como cancelada. La llamada al LLM igual se completa del lado del servidor porque la mayoría de los proveedores no soportan cancelación, pero el ejecutor descarta la eventual salida en lugar de sobrescribir ese estado.
- **Re-ejecutar** — re-correr con un clic contra la misma entrada. Funciona en corridas completadas, fallidas y canceladas por igual.
- **Comparar** — marca dos corridas completadas → el botón "Comparar seleccionadas" abre un modal lado a lado (la más vieja a la izquierda, la más nueva a la derecha) para que la iteración de prompts por fin tenga un flujo de diff real.

### Recetas típicas

| Escenario | Receta |
|---|---|
| Automatización legal | `contract-risk-extract` + aplicar por defecto + guardar como página → todo contrato nuevo auto-produce una página de reporte de riesgo |
| Inteligencia de ventas | `customer-profile` + aplicar por defecto → todo material de cuenta se vuelve una página de perfil |
| Memoria de ingeniería | `meeting-action-items` + `incident-postmortem` juntos → el historial de decisiones y las lecciones de incidentes se acumulan como páginas de KB |
| Síntesis de investigación | Corre `paper-imrad` sobre un lote, luego agrega → página de encuesta temática |
| Downstream programático | Formato JSON + esquema → el wiki se vuelve una fuente de datos estructurados para dashboards / pipelines |

### Endpoints REST (ruta base `/api/v1/wiki/transformations`)

| Método | Ruta | Propósito |
|---|---|---|
| `GET` / `POST` / `PUT` / `DELETE` | `/`, `/{id}` | CRUD de plantillas |
| `POST` | `/{id}/apply?sync=true` | Correr una vez (el cuerpo lleva `rawId` o `pageId`) |
| `POST` | `/{id}/aggregate?kbId=X` | Agregación entre materiales |
| `GET` | `/runs?rawId=` o `?kbId=` o `?transformationId=` | Consultar historial de corridas |
| `POST` | `/runs/{runId}/save-as-page` | Promover una corrida manualmente a página wiki |
| `POST` | `/runs/{runId}/cancel` | Marcar una corrida cancelada |

---

## Cómo usan los agentes el Wiki

Liga un agente a una base de conocimiento desde `Agentes → [tu agente] → Conocimiento`. Desde ese momento:

- El prompt de sistema del agente incluye automáticamente un resumen comprimido de las páginas de nivel superior de la KB.
- La caja de herramientas del agente crece con estas herramientas wiki:

| Herramienta | Qué hace |
|---|---|
| `wiki_search_pages` | Recuperación híbrida a nivel de página (palabra clave + semántica). |
| `wiki_semantic_search` | Búsqueda semántica a nivel de chunk. Los hits incluyen `pageNumber` y `section` cuando se conocen, para que el agente pueda citar "página 12, Configuración / Linux" en lugar de un fragmento suelto. |
| `wiki_read_page` | Lee una sola página; recorta por encabezado de sección o tope de caracteres. |
| `wiki_read_many` | **Nuevo.** Extrae múltiples páginas en una llamada (hasta 10 slugs, con tope de caracteres por página). Reemplaza las cadenas multi-turno de `wiki_read_page`. |
| `wiki_compile_page` | **Nuevo.** Generación de página a demanda para un tema. Las citas se ligan a los chunks de evidencia que el prompt realmente usó — no a todo chunk del material crudo fuente. |
| `wiki_trace_source` | Rastrea una página Wiki de vuelta a sus materiales crudos fuente. |
| `wiki_related_pages` | Descubrimiento de páginas relacionadas entre cuatro señales (chunks compartidos, crudos compartidos, enlaces directos, vecinos semánticos). |
| `wiki_explain_relation` | Desglose de puntuación de la relación entre dos páginas. |
| `wiki_create_page` / `wiki_delete_page` | Gestión directa de páginas; el borrado respeta `locked` / `system`. |
| `wiki_update_page` | **1.5.0**: edición en sitio de una página (conserva el slug), controlada por el permiso de pageType "update". |
| `wiki_stale_pages` | **1.5.0**: lista toda página actualmente marcada para revisión (`stale`). |
| `wiki_archive_page` / `wiki_unarchive_page` | Archivo suave: oculta una página de los resultados por defecto de lista/búsqueda/relacionadas sin destruirla. Las citas y el linaje de fuente sobreviven; recuperable. Las páginas de sistema no se pueden archivar. |
| `wiki_list_transformations` | Lista las plantillas de transformación disponibles para esta KB (nombre, intención, si aplicar-por-defecto está encendido). |
| `wiki_apply_transformation` | Corre una plantilla contra un **material crudo**; devuelve la salida, el id de corrida e info de página guardada. |
| `wiki_apply_transformation_to_page` | Corre una plantilla contra una **página wiki existente** (toma un slug, no un id numérico). |
| `wiki_aggregate_transformation` | Map-reduce de toda corrida completada de una plantilla en la KB en una página wiki de síntesis. |

El parámetro `kbId` se resuelve automáticamente desde el agente ligado — los agentes nunca tienen que adivinarlo.

Un turno típico de agente:

> **Usuario:** "¿Qué decidimos sobre la política de reintentos el trimestre pasado?"
>
> **Agente:** *(lee el resumen inyectado, ve que existe una página "Política de Reintentos", abre esa página directamente, devuelve la decisión con un enlace a la fuente.)*

Eso no es una consulta vectorial. Es literalmente abrir la página — porque la página existe.

### Hot cache: un snapshot de actividad reciente en cada prompt de sistema

La KB ligada no solo aporta resúmenes — también aporta un **hot cache** pequeño, recién reconstruido, que se cose al prompt de sistema. Piensa en él como la página que el agente lee primero, en cada turno:

- **Última actualización** — la ingestión / edición de página más reciente
- **Hechos recientes clave** — viñetas que el reconstructor considera de alta señal
- **Cambios recientes** — creaciones y compilaciones de páginas desde la última reconstrucción
- **Hilos activos** — preguntas abiertas y decisiones sin resolver

El reconstructor se dispara asíncronamente cuando una conversación termina (`ConversationCompletedEvent`), con debounce dentro de una ventana configurable (default 5 min) para que una ráfaga de turnos cortos no agite las llamadas al LLM. Un administrador también puede disparar una reconstrucción manual — ese camino ignora el debounce.

La inyección está controlada por la feature flag `wiki.hot_cache.enabled` (apagada → inyección vacía) y está limitada a las **dos KBs de mayor prioridad** por agente para que el prompt de sistema se mantenga pequeño.

#### Gestiona desde el cajón de detalle de la KB

`Wiki → [tu KB] → Hot cache` muestra:

- Botón **Regenerar** — reconstrucción manual asíncrona; el panel consulta unos segundos después y refresca
- Botón **Resetear** — borrado suave de la fila; el siguiente `ConversationCompletedEvent` la reconstruye
- Cuadrícula de meta: última actualización, razón de actualización (`AUTO` / `MANUAL` / `EVENT`), conteo de reconstrucciones, última duración en ms
- Banner de error si la última reconstrucción falló
- El contenido Markdown renderizado en un panel de vista previa

#### Endpoints de operador

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/v1/wiki/hot-cache/{kbId}` | Snapshot actual + meta |
| `POST` | `/api/v1/wiki/hot-cache/{kbId}/regenerate` | Reconstrucción manual (asíncrona, ignora el debounce) |
| `DELETE` | `/api/v1/wiki/hot-cache/{kbId}` | Borrado suave; se reconstruye en el siguiente evento |

El hot cache vive en `mate_wiki_hot_cache` — ver la sección **Modelo de datos** más abajo para las columnas exactas.

### Un turno lazy típico

```
El usuario sube manual-de-producto.pdf        (modo lazy: cero llamadas al LLM de generación de páginas)
       ↓
Agente: wiki_semantic_search("error code 500 retry")
       → hit en chunk #1234, página=12, sección "Manejo de Errores / Reintentos"
       ↓
Agente: wiki_compile_page(topic="500 retry policy", maxEvidenceChunks=5)
       → produce slug=500-retry-policy, citas ligadas solo a esos 5 chunks
       ↓
Agente: wiki_read_page("500-retry-policy")
       → devuelve la página estructurada con su lista de chunks fuente
```

Todo el camino gasta una llamada al LLM, acotada a los cinco chunks que realmente importan. Los otros 200 chunks del manual no cuestan nada extra.

---

## Leer y editar páginas

Cada página generada es un documento de primera clase que puedes abrir en la vista Wiki:

- Markdown renderizado con resaltado de sintaxis.
- Retroenlaces en la barra lateral — ve qué más referencia esta página.
- Un botón "fuente" en cada afirmación que salta al pasaje crudo del que vino.
- Un modo de edición donde puedes reescribir la página directamente.
- El botón de borrar está deshabilitado en páginas de sistema / bloqueadas.

Edita cuando la IA se equivocó. Tus ediciones sobreviven a la siguiente ingestión — `locked` le dice al digestor que deje la prosa humana en paz. Desbloquea explícitamente cuando quieras que la IA re-redacte desde la fuente.

---

## Wikilinks y cuidado de enlaces rotos

Las referencias entre páginas vía `[[slug]]` son el tejido conectivo de un activo de conocimiento de larga vida. RFC 55 convierte esta capa de "escribir `[[Título]]` se veía bien hasta que hiciste clic y obtuviste un 404" en **lint al escribir, cascada al borrar, enlaces rotos visibles en todas partes**.

### Sintaxis de wikilinks

Se honra exactamente un contrato:

- `[[slug]]` — la etiqueta visible por defecto es el título de la página destino
- `[[slug|texto visible]]` — etiqueta explícita, el slug sigue siendo el destino de navegación

El slug debe referenciar una página existente. Los prompts de generación de páginas del LLM le dan al modelo un índice slug-primero (`- [[slug]] — Título — Resumen`), prohíben inventar slugs que no estén en el índice, y advierten explícitamente que la forma vieja `[[Título de Página]]` será marcada como enlace muerto por el lint.

Insensible a mayúsculas: `[[STATEGRAPH]]` y `[[stategraph]]` se resuelven ambos vía coincidencia exacta en minúsculas contra `page.slug`.

### Lint en transacción: `outgoing_links` + `broken_links`

Cada guardado de página (edición manual, generación de IA, fusión, reescritura en cascada) corre en una transacción:

1. Extrae todo `[[...]]` del cuerpo (saltando bloques de código con cerca y en línea)
2. Escribe `mate_wiki_page.outgoing_links` (arreglo de strings deduplicado, en minúsculas)
3. Diffea contra el conjunto de slugs activos de la KB (páginas archivadas excluidas) para producir `broken_links`
4. Estampa `broken_links_scanned_at`

Ves qué `[[...]]` están muertos en el momento en que la página se guarda — sin escaneo por lote requerido. Los bloques de código y los fragmentos en línea `` `[[...]]` `` se preservan textualmente y nunca entran a `outgoing_links` (así una página que enseña sintaxis de wikilinks no se lintea a sí misma por accidente).

### Escaneo de enlaces rotos de toda la KB

Cada KB muestra un banner arriba del workspace. Clic en "Escanear enlaces muertos" para iniciar un job:

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/wiki/knowledge-bases/{kbId}/lint/broken-links` | Inicia un job (asíncrono, basado en jobs). Devuelve `{jobId, status, startedAt}`. Idempotente — POSTs repetidos mientras un job está en vuelo devuelven el mismo id |
| `GET .../lint/broken-links` | Devuelve el último escaneo completado como agregado por página |
| `GET .../lint/broken-links/jobs/{jobId}` | Chequeo de estado de un job específico |

El agregado lleva `pageId / slug / title / brokenRefs` por cada página afectada. El banner distingue "se escanearon X páginas, sin enlaces rotos" de "se encontraron N enlaces rotos en M páginas". Clic en "ver" abre un panel listando cada ref rota con una acción de salto a la página fuente.

Rendimiento: KBs de 100 páginas escanean en bastante menos de un segundo; latencia de submit POST bajo 200ms.

### Borrado y renombrado en cascada

**Borra una página**: toda otra página que enlazaba a ella tiene su `[[slug-borrado]]` reescrito a texto plano (usando el título del snapshot como la palabra visible). Los alias `[[slug-borrado|algún alias]]` colapsan a solo el alias. Los `outgoing_links` y `broken_links` de los referentes se recalculan en la misma transacción.

**Renombra una página**: `POST /api/v1/wiki/knowledge-bases/{kbId}/pages/{slug}/rename` con `{"newSlug":"nuevo"}`. En una transacción:

- El slug propio de la página se actualiza
- Todo `[[slugViejo]]` de los referentes se vuelve `[[slugNuevo]]`, y `[[slugViejo|alias]]` se vuelve `[[slugNuevo|alias]]` (alias preservado byte a byte)
- El `outgoing_links` de los referentes se actualiza

Rechazado: slug vacío, slug igual al actual, slug ya poseído por otra página en la misma KB, página destino protegida (sistema / bloqueada). Los renombrados solo de mayúsculas (`foo → FOO`) están permitidos y se comportan igual en H2 y MySQL.

Cada borrado / renombrado escribe una fila de auditoría en `mate_audit_event` con `action=wiki.page.delete` o `wiki.page.rename`. `detailJson` lleva una lista `affectedPageIds` para que el impacto de cascada sea consultable después del hecho.

Interruptor de emergencia: define `mate.wiki.cascade-delete-enabled=false` para volver al borrado legacy solo de fila (la reescritura se omite, los wikilinks de los referentes cuelgan). El encendido por defecto es el estado estable previsto.

### Clic desde el chat

Cuando el chat renderiza una respuesta del agente, los tokens `[[slug]]` y `[[slug|alias]]` en el contenido se vuelven anclas `<a class="wiki-link" data-wiki-title=...>`. Al hacer clic en una:

1. El delegador global de clics a nivel de app captura el clic
2. Llama `GET /api/v1/wiki/pages/lookup?title=X&slug=X` — busca en toda KB visible para el usuario (coincidencia de slug primero, título como fallback)
3. 1 hit → `router.push` a la vista wiki, auto-selecciona la KB, auto-abre la página
4. 0 hits → toast "未找到匹配的 wiki 页面：X"
5. >1 hits → selector ofreciendo abrir la primera coincidencia

Se acabó navegar a la vista wiki, encontrar la KB, encontrar la página — hacer clic en un `[[enlace]]` en el chat te lleva directo. La búsqueda es coincidencia exacta estricta insensible a mayúsculas (sin fuzzing canónico), así que si el LLM escribió un slug que no existe ves el toast en lugar de ser redirigido silenciosamente a una página de nombre parecido.

### Los marcadores de citas `[n]` también son clicables

Cuando un agente responde usando recuperación wiki, la respuesta termina con una lista "Fuentes:" (`[1] Título — Sección — página N`). Los **marcadores de citas en línea** (`[1]`, `[2]`, etc.) ahora son ellos mismos clicables, y cada línea de la lista de fuentes también es totalmente clicable — cualquiera te lleva directo a la página wiki correspondiente. La lógica de navegación se comparte con los wikilinks de arriba: búsqueda entre KBs basada en título, con comportamiento de 0 / 1 / múltiples hits de toast / navegación directa / selector respectivamente.

El backend normaliza las líneas de fuente a un formato canónico (agregando el encabezado "Fuentes:" cuando falta, reescribiendo formatos legacy en sitio) para que el frontend pueda identificarlas confiablemente y cablear los marcadores `[n]` como enlaces. Esto requiere que la KB tenga Wiki habilitado y que el material haya sido ingerido.

### Roadmap de fases (todas las fases aterrizadas)

| Fase | Cambios clave |
|---|---|
| 1 | Postproceso DOM slug-primero en el frontend; guarda de caracteres peligrosos; índice completo `pages/refs` desacoplado del filtro de material crudo |
| 2 | Migración V129 agrega `broken_links` y `broken_links_scanned_at`; el camino de guardado los escribe en la misma transacción; job de lint asíncrono de toda la KB + banner |
| 3 | Las 9 plantillas de prompt wiki unificadas en el contrato `[[slug]]`; índice de páginas existentes reformateado slug-primero; la creación en lote separa páginas existentes de páginas planificadas del mismo lote |
| 4 | Borrado y renombrado en cascada reescriben a los referentes en transacción; log de auditoría; feature flag |
| 5 | La etapa de análisis emite una whitelist de slugs `related_pages` (validada del lado del servidor); el aplicador de enriquecimiento salta bloques de código y se controla con la whitelist |

El diseño completo y la verificación en vivo viven en el documento de diseño correspondiente y en el registro de verificación end-to-end del repositorio.

---

## La base de conocimiento se mantiene a sí misma (1.5.0)

1.5.0 empuja el Wiki de "una base de conocimiento buscable" a "un motor de conocimiento que mantiene su propia consistencia, se apila en capas, corre sus propios pipelines y puede montar un directorio local". La superficie de gestión de todo esto es el **panel avanzado de Wiki** en la consola de administración (cinco sub-páginas: perfil de tipos de página / capas y obsolescencia / permisos / observador de fuentes / pipelines).

### Capas de conocimiento: hecho vs experiencia

Cada página puede llevar una **capa de conocimiento**:

- **`fact`** — "qué es": páginas de hechos fundacionales. Sin etiqueta por defecto es fact.
- **`experience`** — "qué significa": síntesis, análisis, insight, que **depende de** un conjunto de páginas de hechos.

**La obsolescencia se propaga.** Una página de experiencia declara de qué páginas de hechos depende (aristas almacenadas por **id** de página, así los renombrados no las rompen). Cuando una página de hechos se actualiza durante la ingestión, toda página de experiencia que dependa de ella se auto-marca `stale` (necesita revisión) + una razón. La herramienta `wiki_stale_pages` lista todo lo actualmente marcado; la búsqueda puede **filtrar por capa de conocimiento** (solo hechos / solo experiencia / todo).

Por debajo: `mate_wiki_page` gana las columnas `knowledge_layer` / `depends_on_json` / `stale` / `stale_reason_json` (migración V135), con aristas de dependencia en `mate_wiki_page_dependency` y un índice inverso dedicado a la propagación de obsolescencia.

### Perfiles de tipos de página (perfil pageType)

Define qué **tipos de página** tiene una KB (p. ej. "concepto / tutorial / registro de decisión"), cada uno llevando:

- Un **esquema** de campos estructurados — los metadatos de página se validan contra él al guardar, con el estado de validación registrado (válido / inválido + detalles)
- Prompts de etapa **route / create / merge** — inyectados en la llamada al LLM correspondiente
- Una **plantilla Markdown** — el esqueleto usado al generar la página

Como máximo un perfil **habilitado** por KB; las KBs sin configurar usan un **default integrado**. Los perfiles se escriben en YAML o JSON, con acciones de "validar (sin guardar)" y "resetear al default". Almacenados en `mate_wiki_page_type_profile` (migración V134); las columnas de metadatos de página (`metadata_json` / `metadata_validation_status` / `template_key` / `profile_version`) se agregan a `mate_wiki_page` en la misma migración.

### Permisos de tipo de página (por agente)

Para "**este agente + esta KB + este tipo de página**" puedes definir flags de lectura / creación / actualización / borrado más una **política de escritura**:

| Política de escritura | Significado |
|---|---|
| `allow` | Escribe de inmediato |
| `approval_required` | La escritura queda retenida pendiente de [aprobación](./security) |
| `deny` | Bloqueada |

`page_type='*'` es el default de toda la KB; **las coincidencias exactas le ganan al comodín**.

**Lectura y escritura caen de forma distinta** — mantenlas diferenciadas:

- **Lectura** — cuando ninguna regla coincide, la lectura cae a la **política de lectura por defecto de la KB** `defaultReadPolicy` (`allow_all` salvo que la KB defina `deny_all`). Así las KBs existentes siguen totalmente legibles tras actualizar. El control de lectura filtra listas y resultados de búsqueda; un tipo no legible se trata como inexistente (sin fuga de existencia).
- **Escritura** — la escritura se endurece opt-in. Un agente **sin reglas** para una KB escribe `allow` (comportamiento viejo); agrega **cualquier** regla y esa KB entra en modo "bloqueada" — los tipos de página sin regla coincidente resuelven a `deny` (fail-safe).

Almacenado en `mate_wiki_agent_page_type_permission` (migración V133).

### Pipelines de procesamiento (Wiki Pipeline)

Define un flujo de procesamiento para una KB, disparado automáticamente por **eventos de página**:

- **Disparadores**: `page_type_count` (un conteo de tipo de página cruza un umbral), `page_created` (se crea una página de un tipo dado), `stale_marked` (páginas marcadas stale)
- **Ejecutores de paso**:
  - `llm` — corre la entrada por el modelo; la salida se vuelve el resultado del paso
  - `skill` — corre un skill de un **conjunto restringido**, como el agente dueño

Las definiciones se escriben en YAML o JSON, con endpoints de CRUD + validación. Cada corrida y cada paso se persisten y son consultables, deduplicados por `(definition, trigger, subject, bucket)` para idempotencia. Tablas: `mate_wiki_pipeline_definition` / `mate_wiki_pipeline_run` / `mate_wiki_pipeline_step_run` (migración V136).

### Monta un directorio local como fuente de conocimiento — enchufable + incremental programado

Las fuentes de conocimiento son un **SPI enchufable** (`WikiIngestSourceProvider`) con un proveedor de filesystem integrado: dale a una KB un `source_directory` y los archivos en él se ingieren.

- **Sync incremental programado** — un scheduler en segundo plano (con un lock distribuido para que solo un nodo corra por ciclo) escanea periódicamente, detecta cambios **por hash de contenido** y re-ingiere solo archivos nuevos/modificados (texto y binario).
- **Seguridad fail-closed** — las rutas se normalizan, luego se resuelven symlinks (cerrando TOCTOU) y se validan contra una allowlist de raíces permitidas; bajo el perfil de producción una allowlist vacía rechaza todo. Define la allowlist `mate.wiki.allowed-source-roots`.
- **Estado + disparo manual** — `GET .../source-watcher` muestra el estado, `POST .../source-watcher/scan` corre un escaneo inmediatamente.

Config relevante (`application.yml`):

```yaml
mate:
  wiki:
    watcher-enabled: false          # interruptor maestro del observador de fuentes
    watcher-interval-ms: 300000     # intervalo de escaneo (default 5 min)
    allowed-source-roots: []        # raíces permitidas de source-directory (allowlist)
    require-allowed-roots: false    # producción: pon true para que una allowlist vacía rechace todo
```

Todos los endpoints REST nuevos están en la [Referencia de API](./api#llm-wiki).

---

## Búsqueda, trazabilidad de fuentes y recuperación semántica

- **Búsqueda semántica** — pregunta "¿qué decidimos sobre auth?" y obtén la decisión, no páginas que contengan "auth". Embeddings a nivel de chunk con recuperación por coseno — entiende lo que quieres decir. Los hits ahora incluyen `pageNumber` y `section`, para que el agente pueda citar "página 12, Configuración / Linux" en lugar de un fragmento flotando suelto.
- **Recuperación híbrida** — coincidencia full-text y semántica corren juntas, fusionadas por RRF, con un impulso de relación de 1 salto sobre las semillas top.
- **Búsqueda full-text** — cubre títulos, resúmenes, cuerpos y extracciones de conceptos. Funciona en toda KB a la que tengas acceso.
- **Trazabilidad de fuente** — cualquier afirmación, cualquier página, tiene un enlace a la fuente. Haz clic y aterrizas en el pasaje crudo. Los agentes tienen la misma capacidad.
- **Retroenlaces** — toda página muestra qué otras páginas la enlazan. La forma alias `[[concepto|texto visible]]` ahora se parsea correctamente: solo `concepto` se vuelve slug, `texto visible` es puramente visual.
- **Páginas relacionadas** — mezcla señales de chunks compartidos, crudos compartidos, enlaces directos y vecinos semánticos. La expansión de 1 salto **nunca siembra desde páginas de sistema**, así overview/log no arrastran toda página de la KB a tu lista de "relacionadas".
- **Protección de edición** — las páginas bloqueadas o editadas a mano no se sobrescriben en la re-ingestión; desbloquea explícitamente para re-redactar.

---

## Pipeline de visión: las imágenes se vuelven texto

Un wiki que no puede leer imágenes está medio ciego. Los PDF son los peores infractores — la mitad de la información real suele vivir dentro de las figuras.

Cuando la feature flag `wiki.ocr.enabled` está encendida, AuraClaw corre toda imagen subida — y toda imagen *embebida en una página PDF* — por un pipeline de visión que extrae un **caption** más cualquier **texto visible** en la imagen. Esos se vuelven chunks de primera clase junto a la prosa circundante, así la recuperación los encuentra, los agentes los citan y los resultados de búsqueda muestran miniaturas en línea con un lightbox de clic-para-zoom.

### Cómo funciona

1. **Hashea** los bytes de la imagen con SHA-256 — la caché es direccionada por contenido, así re-subir el mismo diagrama en otra KB no cuesta nada.
2. **Consulta `mate_wiki_image_caption_cache`** — ante hit, reutiliza el caption de inmediato e incrementa `hit_count`.
3. Ante miss, recorre los **proveedores de visión configurados en orden** hasta que uno devuelva un caption no nulo.
4. **Persiste** el caption + texto visible + id de proveedor + modelo + duración en la caché (inserción tolerante a carreras — subidas concurrentes de los mismos bytes están bien).
5. El `VisionResult` fluye de vuelta al troceador como contenido adicional para la página que contenía la imagen.

### Proveedores soportados

| Id de proveedor | Modelo | Notas |
|---|---|---|
| `dashscope-vision` | `qwen-vl-max` | Endpoint OpenAI-compatible de DashScope; reutiliza el proveedor DashScope configurado en la UI |
| `zhipu-vision` | `glm-5v-turbo` | Zhipu BigModel; OpenAI-compatible |
| `doubao-vision` | configurable | ByteDance Volcano Doubao vision |

Los proveedores se auto-detectan por orden. Configura sus claves / URLs base en `Ajustes → Modelos` como cualquier otro proveedor — el pipeline de visión toma las credenciales de ahí.

### Encender/apagar el pipeline

`Ajustes → Feature Flags → wiki.ocr.enabled`. Apagado por defecto en instalaciones ligeras; encendido una vez configurado al menos un proveedor de visión.

Cuando la flag está **apagada**, el pipeline cortocircuita — las subidas igual funcionan, los chunks de imagen solo no llevan captions. La caché `extracted_text` de esas imágenes queda **diferida** en lugar de envenenada, así volver a encender la flag captura captions en la siguiente subida sin forzar una re-ingestión.

### Qué ves en la UI

- Los hits de búsqueda que contienen evidencia de imagen renderizan la miniatura en línea; clic para abrir un lightbox a resolución completa.
- El cajón de detalle del material crudo muestra captions junto a cada imagen extraída para que puedas verificar qué vio realmente el modelo.

---

## Fallback de LLM consciente de salud

La ingestión wiki es pesada en LLM, y un solo proveedor atascado antes significaba que todo un lote moría. Ahora todo paso wiki (`route`, `create_page`, `merge_page`, `enrich`, …) pasa por la cadena de enrutamiento mediante un **fallback consciente de salud**: si el modelo principal erra o expira, el siguiente modelo de la lista `fallback` de la KB se intenta una vez. La salud (éxito / error / latencia) se rastrea por proveedor, así un proveedor inestable se degrada automáticamente hasta recuperarse.

Configura la lista de fallback en `Wiki → Config → Estrategia de Modelo` junto al selector por paso.

---

## La selección de modelo por paso realmente funciona

En `Wiki → Config → Estrategia de Modelo` puedes elegir un modelo distinto por paso:

```text
heavy_ingest.route        → modelo pequeño y barato para enrutamiento
heavy_ingest.create_page  → modelo fuerte para autoría de páginas completas
heavy_ingest.merge_page   → modelo fuerte para fusión de contenido
light_enrich.enrich       → modelo pequeño y barato para anotación de wikilinks
```

Orden de resolución:

```text
stepModels[step]   →   wikiDefaultModelId   →   modelo por defecto del sistema
```

Esta UI solía ser cosmética — el lado Java tiraba la config al piso y corría cada paso en el default del sistema. Toda llamada al LLM dentro del pipeline eager ahora consulta la cadena de enrutamiento: route, create, merge, retry-create, repair, document analysis, light enrich.

---

## Grafo de conocimiento: la capa de entidades

::: tip Nuevo
La capa de páginas responde "qué página cubre este tema". La **capa de entidades** responde "quién se relaciona con quién, y cómo". Durante la ingestión, junto al troceo, el embedding y la escritura de páginas, el sistema puede correr una pasada adicional de **extracción de entidades**: sacando entidades nombradas — personas, organizaciones, ubicaciones, eventos, productos, conceptos — y las relaciones tipadas entre ellas, conectando todo en un grafo de conocimiento navegable.
:::

### Qué se extrae, y cuándo

Se producen dos tipos de objetos:

- **Entidades (nodos)** — cada entidad tiene un nombre canónico, alias, una descripción, una puntuación de prominencia, un conteo de menciones y un vector de embedding usado para fusionar casi-duplicados. Seis tipos integrados: `person` / `organization` / `location` / `event` / `product` / `concept`.
- **Relaciones (aristas)** — tripletas sujeto → predicado → objeto, donde el predicado es una frase snake\_case (`works_for`, `located_in`, `founded`, etc.). Cada relación lleva una cita de evidencia.

La extracción corre después de que los embeddings se escriben, como una **pasada asíncrona independiente** que no bloquea la generación de páginas. Es **incremental** por defecto — los chunks ya procesados se saltan. La normalización de entidades funciona en tres niveles: una caché de runtime en proceso → búsqueda exacta en base de datos → similitud coseno contra embeddings almacenados (umbral 0.92) para fusionar casi-sinónimos. "阿里巴巴" y "Alibaba" colapsan al mismo nodo.

La extracción solo corre cuando **la extracción de entidades está habilitada** en la configuración de la KB. Para forzar una re-extracción completa de inmediato: `POST /api/v1/wiki/kb/{kbId}/entities/extract?force=true` — el modo force captura un grafo nuevo antes de reemplazar el viejo, así un fallo total del LLM deja el grafo existente intacto.

### Configurando tipos de entidad

En `Wiki → Config → Extracción de Entidades`: encender el interruptor revela un editor de etiquetas (multi-selección, buscable, creación en línea). Los seis tipos integrados se sugieren por defecto; puedes escribir un tipo personalizado (p. ej. `technology`, `law`) y presionar Enter para agregarlo. Dejar la lista vacía cae a los seis integrados. La lista de tipos se almacena en el JSON `configContent` de la KB bajo la clave `entityTypes`.

### Esquema de relaciones: una whitelist cerrada de tripletas (2.0.0+)

Los tipos de entidad restringen *qué entidades* se extraen, pero la capa de relaciones solía ser abierta — el modelo podía inventar cualquier predicado entre dos entidades cualesquiera, y las entidades marginales se persistían como importantes solo por "participar en alguna relación", diluyendo las pocas relaciones definidas que realmente te importan.

Cada KB ahora puede declarar un **esquema de relaciones** opcional: una whitelist cerrada de tripletas `tipoSujeto → predicado → tipoObjeto` (p. ej. `person → works_at → organization`). Con él habilitado, la extracción **conserva solo las relaciones que coinciden con el esquema y las entidades que participan en ellas** — se acabó la invención libre; el grafo contiene solo las formas de relación que definiste. Déjalo vacío para mantener la extracción abierta original. La config vive en el `configContent` de la KB; sin migración necesaria.

### Explorando el grafo

La barra de herramientas de la vista de grafo del Wiki gana un toggle **Grafo de páginas / Grafo de entidades**. En modo grafo de entidades:

- El grafo completo se carga en una llamada (`GET /api/v1/wiki/kb/{kbId}/entity-graph`). Los nodos se colorean por tipo; las etiquetas siempre son visibles.
- Una **leyenda de tipos** arriba lista cada tipo de entidad presente en el grafo. Clic en una etiqueta de tipo alterna los nodos de ese tipo encendidos o apagados — útil cuando el grafo es grande.
- Clic en un nodo carga su **ego-grafo**: el panel derecho lista los alias de la entidad, sus relaciones y las **páginas wiki que la mencionan** (cada una es un enlace clicable).
- Los colores siguen una paleta terrosa compartida que coincide con el grafo de tipos de página. Como el grafo renderiza en canvas y no puede leer variables CSS, la paleta se resuelve desde los estilos calculados del tema actual en runtime, para que tanto el modo claro como el oscuro muestren colores de etiqueta correctos.

Las tres tablas subyacentes se describen en la sección [Modelo de datos](#data-model-if-you-re-curious) más abajo.

---

## Modelo de datos (si tienes curiosidad)

Tablas centrales (ver las secciones de features para la lista completa):

| Tabla | Propósito |
|---|---|
| `mate_wiki_knowledge_base` | Una fila por KB. Dueño, nombre, descripción, JSON de config (`ingestMode`, `wikiDefaultModelId`, `stepModels`, `entityExtractionEnabled`, `entityTypes`, cadena de fallback). |
| `mate_wiki_raw_material` | Una fila por subida. Estado, hash de bytes, ruta fuente, último hash procesado con éxito; `error_code` + `error_message` estructurados ante fallo, y `warning_code` + `warning_message` cuando completó-pero-degradado. |
| `mate_wiki_page` | Una fila por página generada. Título, resumen, cuerpo, `source_raw_ids` (procedencia), `page_type`, `locked`, versión, más `embedding` / `embedding_model` / `embedding_text_version` para que las páginas de síntesis de transformación entren directo a la búsqueda semántica. |
| `mate_wiki_chunk` | Una fila por chunk. contenido + hash + offsets + embedding, más `page_number`, `header_breadcrumb`, `source_section`, `token_count`. |
| `mate_wiki_relation` | Aristas página-a-página cacheadas (chunks compartidos, crudos compartidos, enlaces directos, vecinos semánticos) usadas para impulsar el boost de recuperación de 1 salto y la herramienta de páginas relacionadas. |
| `mate_wiki_hot_cache` | Una fila por KB. Snapshot Markdown renderizado + `last_updated`, `update_reason`, `rebuild_count`, `last_rebuild_duration_ms`, `last_rebuild_error`. |
| `mate_wiki_image_caption_cache` | Caché con clave SHA-256 de captions extraídos por visión. `caption`, `visible_text`, `mime_type`, `capture_model`, `provider_id`, `duration_ms`, `hit_count`. |
| `mate_wiki_transformation` | Una fila por plantilla de transformación. `name`, `title`, `description`, `prompt_template`, `model_id`, `apply_default`, `output_target`, `output_format`, `output_schema`. `kb_id=NULL` = de todo el workspace. |
| `mate_wiki_transformation_run` | Una fila por ejecución de plantilla. `status`, `output`, `error`, `duration_ms`, `model_id`, `triggered_by`, `input_tokens`, `output_tokens`, `total_tokens`, `output_page_id`. |
| `mate_wiki_entity` (V148) | Una fila por entidad. Nombre canónico, tipo, JSON de alias, `salience`, `mention_count`, `embedding` (usado para fusionar casi-duplicados). |
| `mate_wiki_entity_mention` (V149) | Una ocurrencia de una entidad en un chunk. `entity_id`, `chunk_id`, `page_id` (referencia de vuelta a la página wiki), `surface_form`, `evidence`. |
| `mate_wiki_entity_relation` (V150) | Tripleta de relación de entidad. `subject_entity_id`, `predicate`, `object_entity_id`, `evidence`, `evidence_chunk_id`. |

`mate_wiki_page` también lleva dos flags de protección:

- `locked` (V40) — `1` bloquea a las herramientas de IA, las operaciones en lote y la limpieza de re-ingestión de modificar o borrar la página. Las páginas de sistema integradas `overview`/`log` vienen con `locked=1`; los usuarios también pueden ponerla en cualquier página curada a mano.
- `archived` (V41) — `1` archiva suavemente la página: desaparece de los resultados por defecto de lista/búsqueda/relacionadas, pero la página en sí, sus citas y sus retroenlaces se preservan todos. Recuperable.

### Endpoints de operador

Para cuando no quieras esperar a que el cron / los hooks de eventos se pongan al día:

| Endpoint | Qué hace |
|---|---|
| `POST /api/v1/wiki/admin/kb/{kbId}/rebuild-overview` | Fuerza la reescritura de la región marcadora de overview desde las estadísticas actuales. |
| `POST /api/v1/wiki/admin/backfill-tokens` | Corre un lote del relleno de conteo de tokens ahora; devuelve `pendingBefore` / `pendingAfter` / `filledThisBatch`. |
| `GET /api/v1/wiki/admin/failures?limit=100` | Lista entre KBs de materiales que necesitan atención (fallidos / parciales / con warning); ver "Visibilidad de fallos" más abajo (admin de plataforma). |

El bloque `mate.wiki` en `application.yml` controla los controles globales (tamaño de chunk, paralelismo, auto-procesar-al-subir). Los controles por KB (modo de ingestión, modelos por paso, cadena de fallback) viven dentro del JSON `configContent` de la KB y se editan por la UI de config.

> La columna `token_count` es nullable para chunks legacy; un cron de baja frecuencia `WikiChunkTokenBackfillJob` la rellena con `ceil(charCount / 4)` con el tiempo, sin bloquear nunca la ingestión.

---

## Visibilidad de fallos

La ingestión es mayormente trabajo asíncrono en segundo plano, así que los fallos solían ser visibles solo en el log del servidor. Ahora están **estructurados sobre el material crudo y empujados en vivo a la UI**.

### Códigos de error estructurados

Cuando un material crudo falla, junto al texto crudo (`error_message`) registra un **`error_code` estructurado**:

`AUTH_ERROR` / `BILLING` / `MODEL_NOT_FOUND` / `RATE_LIMIT` / `TIMEOUT` / `SERVER_ERROR` (5xx) / `CONTENT_FILTER` / `NO_CONTENT` (sin texto extraíble) / `EMPTY_RESULT` (el modelo no produjo páginas) / `UNKNOWN`.

La UI renderiza una pista amigable localizada desde el código (p. ej. "Fallo de autenticación del modelo — revisa la clave del proveedor") y conserva la excepción cruda como detalle al pasar el cursor. Ambas columnas se limpian en un reprocesamiento exitoso.

### Warnings no bloqueantes

Algunos sub-pasos corren asíncronos **después** de que el material ya está completado — embedding y extracción de grafo de entidades. Su fallo no afecta las páginas, pero degrada el material (más notablemente: un embedding fallido significa que el material aún no es buscable semánticamente). En lugar de solo loggear, estos registran un `warning_code` no bloqueante (`EMBEDDING_FAILED` / `ENTITY_EXTRACTION_FAILED`) + `warning_message`; el material se queda "completed" pero lleva un marcador ⚠.

### Eventos SSE de progreso

El stream de progreso de la KB `GET /api/v1/wiki/knowledge-bases/{kbId}/progress` (SSE) emite:

| Evento | Cuándo | Campos clave |
|---|---|---|
| `raw.started` | un material empieza a procesarse | `rawId` |
| `route.done` / `chunk.done` | progreso de etapa | `rawId` + contadores de progreso |
| `raw.completed` | material terminado (incl. parcial) | `rawId` / `status` / `totalPages` |
| `raw.failed` | material fallido | `rawId` / `error` / `errorCode` |
| `raw.warning` | completado pero un sub-paso asíncrono falló | `rawId` / `warning` / `warningCode` |

### Centro de fallos entre KBs (admin)

En lugar de abrir cada KB por turno, un administrador ve todo lo que necesita atención (fallido / parcial / warning) en un solo lugar:

- `GET /api/v1/wiki/admin/failures?limit=100` — lista entre **todas** las bases de conocimiento con nombre de KB, estado, código de error/warning y hora (admin de plataforma `ROLE_ADMIN`, abarca todos los workspaces).
- El resumen de notificaciones `GET /api/v1/notifications/summary` gana un conteo `failedWikiJobs`, que impulsa la insignia de atención en el ítem Wiki de la barra lateral.
- La vista de biblioteca Wiki del frontend muestra un centro de fallos colapsable arriba con apertura de un clic hacia la KB dueña.

---

## Cuándo usarlo

Busca una KB Wiki cuando tengas:

- más que un puñado de documentos sobre el mismo tema
- material que quieras que humanos lean y editen, no solo recuperar
- información que debería sobrevivir a cualquier agente o conversación individual
- fuentes donde "¿de dónde salió esto?" realmente importa

Si solo quieres soltar un PDF en una conversación, adjúntalo en el chat. Los Wikis son para material que se gana su propia estantería.

Una guía rápida para elegir modo:

- Necesitas un Wiki terminado y navegable **ahora mismo** (compartir, presentar, onboarding): eager.
- Estás sembrando un corpus y quieres páginas producidas solo cuando un agente o usuario las busque: lazy + compilación a demanda.
- Corpus grande, modelo caro, sin claridad sobre si cada documento necesita una página Wiki completa: lazy es el default más barato.

---

## Siguiente

- [Agentes](./agents) — ligar un agente a una KB
- [Memoria](./memory) — en qué difieren Wiki y memoria (pista: el Wiki es deliberado, la memoria es pasiva)
- [Referencia de API](./api) — endpoints REST del wiki
