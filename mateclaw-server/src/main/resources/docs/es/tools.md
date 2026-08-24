# Herramientas

**Una herramienta es una mano que el agente puede extender.**

Librado a sí mismo, un modelo de lenguaje es un emparejador de patrones envuelto en texto. No sabe qué hora es. No sabe qué hay en tus archivos. No puede buscar en la web, correr un comando, mirar un PDF, delegar en otro agente ni abrir un navegador. Solo puede *hablar de* hacer esas cosas.

Las herramientas son cómo AuraClaw arregla esto. Cada herramienta es una operación concreta que el agente tiene permitido invocar — leer un archivo, buscar en la web, ejecutar un comando de shell, extraer texto de un PDF, delegar en otro agente. Cuando el agente decide que necesita una, emite una **llamada a herramienta**, el runtime la ejecuta y el resultado vuelve como una **observación**.

Veintisiete herramientas vienen integradas. Se pueden agregar ilimitadas más mediante servidores MCP, scripts de skills personalizados o tus propios Spring beans anotados con `@Tool`.

---

## Cómo ocurre realmente una llamada a herramienta

```
El agente decide que necesita una herramienta
        │
        ▼
  Emite una llamada a herramienta:  {"name": "WebSearchTool", "args": {"query": "..."}}
        │
        ▼
  ┌─────────────────────┐
  │   Registry de tools │  ← busca la herramienta por nombre
  └─────────────────────┘
        │
        ▼
  ┌─────────────────────┐
  │   Tool Guard        │  ← chequeo basado en reglas: permitir / denegar / aprobación
  └─────────────────────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
 permitida  aprobación pendiente → el usuario decide → permitida / rechazada
   │
   ▼
  ┌─────────────────────┐
  │  Ejecutar (timeout) │  ← asíncrona, timeout por herramienta
  └─────────────────────┘
        │
        ▼
  Resultado → observación → siguiente paso de razonamiento del agente
```

Tool Guard es el portero. Los timeouts son por herramienta (para que una herramienta lenta no congele un turno). La ejecución puede ser concurrente dentro de una sola fase de Acción — si el agente llama tres herramientas independientes a la vez, corren en paralelo.

Nada de esto aparece en el prompt del agente. El agente solo pide una herramienta. El runtime maneja todo antes, durante y después de la llamada.

---

## Registro de herramientas — tres caminos

**1. Herramientas integradas.** Las veintisiete herramientas que vienen con AuraClaw — registradas en la tabla de herramientas al arrancar.

**2. Servidores MCP.** Procesos externos que hablan el Model Context Protocol exponen herramientas dinámicamente. AuraClaw las descubre vía `tools/list` y aparecen en el registry junto a las integradas. Ver [MCP](./mcp).

> **Alcance de herramientas MCP por agente (1.4.0+, #117)**: cuando un agente **no ha marcado ninguna fila específica de herramienta MCP**, las herramientas MCP habilitadas **se auto-unen** a su conjunto de herramientas; una vez que marca herramientas MCP específicas, queda **restringido a ese conjunto**. Los agentes ligados solo a skills / herramientas integradas mantienen acceso completo a todas las herramientas MCP.

**3. Scripts de skills.** Los paquetes de skills pueden incluir scripts ejecutables que se envuelven como herramientas en runtime. Ver [Skills](./skills).

El descubrimiento de herramientas es **estilo blacklist** — toda herramienta descubrible se registra por defecto. Excluye herramientas específicas explícitamente. Las herramientas recién agregadas no se pierden silenciosamente.

---

## Divulgación progresiva de herramientas (1.4.0+)

A medida que el conteo de herramientas crece, el prompt de sistema se infla con decenas de esquemas de herramienta completos — incluso cuando una tarea necesita solo una o dos de ellas. **La divulgación progresiva** divide las herramientas en dos niveles para que el prompt escale con la **tarea**, no con el **conteo total de herramientas**.

| Nivel | Cómo aparece en el prompt de sistema | ¿Llamable de entrada? |
|------|-------------------------------------|--------------------------|
| **CORE** | Siempre anunciada en completo, con el esquema completo | Sí |
| **EXTENSION** | Solo un directorio comprimido — nombre + fuente + descripción de una línea; el esquema completo queda oculto | No — actívala con `enable_tool` primero |

**Nivelación por defecto**: las herramientas generativas (`image_generate`, `music_generate`, `video_generate`, `model3d_generate`) y `browser_use` van por defecto a **EXTENSION**; todo lo demás es **CORE**.

- **Control por página** — la página de Herramientas tiene secciones Core y Extension con un toggle de nivel por fila para herramientas integradas y de canal; las herramientas MCP / ACP están bloqueadas.
- **Persistencia** — el nivel se almacena en `mate_tool.disclosure_tier` y `mate_mcp_server.disclosure_tier`.
- **Config** — `mateclaw.tools.disclosure.mode`, default `progressive`; ponlo en `legacy` para restaurar el viejo comportamiento de "anunciar todo".

**Por qué** — para detener la hinchazón de contexto. El prompt de sistema debe escalar con lo que la tarea actual necesita, no con cuántas herramientas instalaste.

---

## Las veintisiete herramientas integradas

| Herramienta | Qué hace | Peligrosa |
|------|--------------|-----------|
| `DateTimeTool` | Fecha/hora actual en cualquier zona horaria | — |
| `WebSearchTool` | Búsqueda vía la cadena de proveedores (Serper / Tavily / DuckDuckGo / SearXNG) | — |
| `ReadFileTool` | Leer contenido de archivos | — |
| `WriteFileTool` | Escribir contenido a un archivo | ⚠️ |
| `EditFileTool` | Edición de buscar-y-reemplazar | ⚠️ |
| `ShellExecuteTool` | Ejecutar un comando de shell | ⚠️ |
| `FileTypeDetectorTool` | Detectar tipo MIME y codificación | — |
| `DocumentExtractTool` | Extraer texto de PDF, DOCX, XLSX | — |
| `WorkspaceMemoryTool` | Leer/escribir la memoria de workspace del agente | — |
| `SkillFileTool` | Leer y gestionar archivos `SKILL.md` | — |
| `SkillScriptTool` | Ejecutar scripts de skills | ⚠️ |
| `SkillManageTool` | Crear / editar / borrar paquetes de skills | ⚠️ |
| `BrowserUseTool` | Manejar un navegador headless | ⚠️ |
| `DelegateAgentTool` | Delegar una tarea a otro agente (soporta paralelo) | — |
| `AuraClawDocTool` | Leer documentación integrada del proyecto | — |
| `ImageGenerateTool` | Texto-a-imagen / **imagen-a-imagen (1.3.0+)** | — |
| `VideoGenerateTool` | Generación de texto-a-video / imagen-a-video | — |
| `DocxRenderTool` | **1.3.0+** Markdown → .docx (documento Word) | — |
| `XlsxRenderTool` | **1.3.0+** Tablas Markdown → .xlsx (Excel) | — |
| `PptxRenderTool` | **1.3.0+** Markdown (saltos de diapositiva `---` estilo Marp) → .pptx | — |
| `PdfRenderTool` | **1.3.0+** Markdown → PDF grado publicación (fuentes CJK embebidas) | — |
| `CronJobTool` | Crear y gestionar tareas programadas | ⚠️ |
| `DatasourceTool` | Gestionar conexiones de fuentes de datos externas | ⚠️ |
| `SqlQueryTool` | Ejecutar consultas SQL en fuentes de datos conectadas | ⚠️ |
| `send_file` | **1.4.0+** Entregar un archivo existente del servidor como adjunto IM nativo (#199) | — |
| `enable_tool` | **1.4.0+** Activar una herramienta de nivel extension para esta conversación | — |
| `load_skill` | **1.4.0+** Cargar el `SKILL.md` de un skill a demanda | — |

Más la `MusicGenerateTool` de [Multimodal](./multimodal). Y las 14 herramientas Wiki de [LLM Wiki](./wiki): `wiki_read_page`, `wiki_read_many`, `wiki_list_pages`, `wiki_search_pages`, `wiki_semantic_search`, `wiki_compile_page`, `wiki_trace_source`, `wiki_create_page`, `wiki_delete_page`, `wiki_archive_page`, `wiki_unarchive_page`, `wiki_related_pages`, `wiki_explain_relation`, `wiki_enrich_page`.

### Herramientas de Content Studio (1.8.0+)

Siete herramientas integradas impulsan la escena de [Content Studio](./content-studio) (creación y publicación de imagen-texto para 公众号 / 小红书):

| Herramienta | Qué hace | Peligrosa |
|------|--------------|-----------|
| `wechat_article_extract` | Limpia un artículo de `mp.weixin.qq.com` a `{title, author, time, body, images}` (SSRF limitado a ese host) | — |
| `gzh_package` | Empaqueta un artículo de Cuenta Oficial de WeChat (HTML inline + portada); corre escaneo de cumplimiento + registra en el calendario de contenido | — |
| `gzh_publish` | Empuja el artículo a la **caja de borradores** de WeChat (`draft`); el `publish` opcional está controlado por aprobación | ⚠️ |
| `xhs_package` | Empaqueta una nota de Xiaohongshu; valida duramente ≥3 tarjetas verticales; escanea + registra | — |
| `xhs_publish` | Subida asistida por navegador de mejor esfuerzo (controlada por aprobación) | ⚠️ |
| `content_item` | Calendario de contenido: `check_recent` (dedup por huella de tema), `record`, `mark_published` | — |
| `compliance_scan` | Escaneo de léxico del lado del servidor (términos de afirmación extrema / inducción / retorno garantizado); `extraBannedWords` opcional | — |

### DateTimeTool

Devuelve la fecha y hora actual para una zona horaria dada. Cero sorpresas.

```
Input:  {"timezone": "America/New_York"}
Output: "2026-04-11T14:30:22"
```

### WebSearchTool

Búsqueda web vía una **cadena de proveedores** — DuckDuckGo y SearXNG como fallbacks sin clave, Serper y Tavily cuando tienes claves. Configurada en `Ajustes → Sistema → Servicio de Búsqueda` y surte efecto sin reiniciar.

```
Input:  {"query": "Spring AI Alibaba última versión", "freshness": "month", "count": 5}
Output: "Spring AI Alibaba 1.1 fue lanzado..."
```

Características:

- **Cadena de proveedores** — cae al siguiente ante fallo. Los proveedores sin clave dan cobertura base.
- **Parámetros avanzados** — `freshness` (day/week/month/year), `language`, `count`.
- **Cacheo de resultados** — las consultas recientes se cachean.
- **Envoltura de seguridad** — los resultados se sanean antes de devolver.
- **Coexistencia de búsqueda nativa del proveedor + herramienta** — los modelos con su propia búsqueda (ChatGPT, Gemini) pueden usarla de forma nativa mientras la búsqueda por herramienta queda como fallback.

### ShellExecuteTool

Ejecución de shell multiplataforma. Linux/macOS usa `/bin/sh -c`; Windows usa `cmd.exe /D /S /C`. **Toda llamada está controlada por Tool Guard.**

Diseño de seguridad:

- **Timeout** — 60s por defecto, tope duro de 300s
- **Topes de salida** — stdout y stderr limitados a 10,000 bytes cada uno
- **Salida respaldada en archivo** — stdout/stderr a archivo temporal, no pipe
- **Resultado estructurado** — `{exitCode, stdout, stderr, timedOut}`
- **Detección de patrones peligrosos** — `find -delete`, `rm -rf /`, descargas bash por pipe disparan aprobación elevada

```
Input:  {"command": "ls -la /tmp"}
Output: "total 48\ndrwxrwxrwt 12 root root..."
```

### ReadFileTool / WriteFileTool / EditFileTool

Leer es seguro. Escribir y Editar están ambas controladas por Tool Guard.

### DocumentExtractTool

PDF, DOCX, XLSX y amigos se vuelven texto plano. Los documentos escaneados obtienen OCR de respaldo donde está disponible.

### Generación de documentos Office (1.3.0+)

Cuatro herramientas nuevas que renderizan Markdown directamente en archivos Office descargables — **sin fork de subproceso, sin dependencia npm**. Los bytes generados se cachean en memoria y se devuelven como una URL de descarga de un solo uso:

| Herramienta | Para | Capacidades clave |
|---|---|---|
| `DocxRenderTool.renderDocx` | Reportes / memos / contratos / currículos | Encabezados (# ## ###) / negritas (**texto**) / listas / tablas / imágenes (PNG/JPG/GIF/BMP/SVG → PNG) |
| `DocxRenderTool.renderDocxFromFile` | Igual, pero el markdown está en un archivo del workspace | Evita que el LLM tenga que repetir su propio cuerpo markdown grande como argumento de herramienta |
| `XlsxRenderTool.renderXlsx` | Hojas financieras / exportación de datos / plantillas | Sintaxis de tabla Markdown → múltiples hojas (divididas por `## NombreDeHoja`) |
| `PptxRenderTool.renderPptx` | Decks / planes de proyecto / briefings | Saltos de diapositiva `---` estilo Marp; aspecto `16:9` (default) / `4:3` |
| `PptxRenderTool.renderPptxFromFile` | Igual, pero markdown en un archivo | Preferido cuando el cuerpo del deck excede 5KB |
| `PdfRenderTool.renderPdf` | Documentos grado publicación / reportes semanales / documentos con plantilla | Márgenes de 1in / paginación inteligente / números de página / portada / CJK + latino mixtos (fuentes CJK embebidas) |

::: tip Relación con el skill existente `skills/docx`
El skill `skills/docx` **se queda** — es bueno **editando .docx existentes** (cambios rastreados, operaciones XML complejas) y corre `npm install docx` en el primer uso. Las cuatro herramientas nuevas manejan el camino de "crear-desde-cero" **sin costo de calentamiento npm**. Los agentes prefieren estos RenderTools; caen al skill solo al modificar un .docx existente.
:::

### ImageGenerateTool — soporte de edición de imágenes desde 1.3.0

En v1.2.0 esta herramienta era solo texto-a-imagen. v1.3.0 agrega dos parámetros — `image` y `images` — para **edición con entrada multi-imagen**. Ver [Multimodal](./multimodal).

### WorkspaceMemoryTool

Deja que un agente lea, escriba y edite sus propios archivos de memoria del workspace — `MEMORY.md`, `PROFILE.md`, notas diarias, cualquier cosa bajo `workspace/{agentId}/`. Reglas de seguridad: solo `.md`, sin recorrido de directorios. Ver [Memoria](./memory).

### BrowserUseTool

Maneja un navegador. Navega, haz clic, escribe, extrae. Toda llamada controlada por Tool Guard.

**Interacción por ref (1.8.0+).** La herramienta lee una página como un **snapshot compacto de árbol de accesibilidad** donde cada elemento interactivo obtiene un manejador `ref` estable, y clic / escribir / seleccionar apuntan al **elemento por su `ref`** en lugar de una coordenada de screenshot — así una acción sobrevive a un reflow de página en lugar de fallar. Usar una sesión de navegador **real** agrega **barandillas de privacidad**, con una escotilla de escape CDP (Chrome DevTools Protocol) controlada para los casos que el camino seguro no puede alcanzar (opt-in, no default).

### DelegateAgentTool — agentes delegando en agentes

Un agente puede entregar una subtarea a otro:

- **`delegateToAgent(agentName, task)`** — llama a un agente específico por nombre, corre en conversación aislada, devuelve el resultado
- **`listAvailableAgents()`** — lista todos los agentes disponibles con nombre, tipo, descripción

```
Usuario: Busca noticias de Spring AI y haz que Writer las resuma
Agente A: [llama a WebSearchTool]
          [llama a delegateToAgent(agentName="Writer", task="Resume: ...")]
          [recibe la respuesta de Writer]
          Responde con el resultado combinado
```

Seguridad:

- **Tope de recursión** — máximo 3 niveles de delegación de profundidad
- **Sesiones aisladas** — el agente delegado corre en su propia conversación
- **Truncamiento de resultados** — los resultados delegados se limitan a 4000 caracteres

### AuraClawDocTool

Lee la documentación integrada del proyecto AuraClaw. Deja que un agente responda "cómo funciona X en AuraClaw" consultando documentación real en lugar de adivinar.

### enable_tool — activar una herramienta de nivel extension (1.4.0+)

`enable_tool(toolName)` activa una herramienta de nivel **EXTENSION** para que sea totalmente llamable por el **resto de la conversación**.

- **Validado** — solo las herramientas del conjunto efectivo del agente pueden activarse.
- **Surte efecto el siguiente turno** — la activación aterriza en el **siguiente turno de razonamiento** del mismo bucle ReAct (el agente ve el esquema completo, luego emite la llamada real).
- **Alcance de conversación, no persistido** — la activación dura solo la conversación actual; nada se escribe a la base de datos, y una conversación nueva vuelve a la nivelación por defecto.

### load_skill — cargar un skill a demanda (1.4.0+)

`load_skill(skillName, filePath?)` trae el `SKILL.md` de un skill solo cuando se necesita — omite `filePath` para el archivo principal, o pásalo para leer un sub-archivo dentro del paquete del skill.

- **Inyectado vía historial de mensajes** — el contenido cargado va al **historial de mensajes**, no al prompt de sistema, así la **caché del prompt se mantiene estable** (el prompt de sistema no cambia, así la caché no se invalida).
- **Fijado en turnos posteriores** — un skill cargado queda **fijado** por el resto de la conversación, así no hay que recargarlo.
- **Config** — `mateclaw.skill.disclosure.load-skill-tool.enabled`, default true.

Ver [Skills](./skills).

### send_file — entregar un archivo existente como adjunto nativo (1.4.0+, #199)

`send_file(filePath, fileName?)` lee un **archivo existente** en el servidor y lo entrega como un **adjunto IM nativo** — no un enlace de descarga de texto.

- **Almacenado en la caché de archivos generados** — el archivo se coloca en la caché de archivos generados, y los adaptadores de canal (Feishu / DingTalk / Telegram) **lo auto-detectan y entregan**.
- **Cualquier tipo de archivo común**, hasta un límite de **20 MB**.
- **Contraste con `ReadFileTool`** — `ReadFileTool` **extrae texto** de un archivo para alimentar el razonamiento del agente; `send_file` envía el archivo **tal cual** al usuario.

### ReadFileTool — paginación de líneas sobredimensionadas (1.4.0+, #190)

Para archivos con una sola línea muy larga, `ReadFileTool` agrega un `startColumn` opcional (un offset de caracteres 1-basado dentro de `startLine`) para **reanudar la cola** de esa línea desde donde te quedaste.

- Al truncar **siempre devuelve** `nextStartLine`;
- **además devuelve** `nextStartColumn` cuando queda más de esa línea.

Alimenta ambos de vuelta en la siguiente llamada para paginar un archivo gigante de una sola línea en segmentos.

---

## Tool Guard — la capa de permisos

Tool Guard es cómo AuraClaw evita que las herramientas fuertes hagan estupideces. Es **basado en reglas**, no una lista plana de herramientas peligrosas. Cada regla dice: *para esta herramienta, con estos argumentos, en este contexto, haz X* — donde X es `allow`, `deny` o `require_approval`.

Piezas centrales:

- **`mate_tool_guard_rule`** — reglas individuales con patrón de herramienta, patrón de argumentos opcional, acción
- **`mate_tool_guard_config`** — config global: habilitado/deshabilitado, política por defecto, timeout de aprobación
- **`mate_tool_guard_audit_log`** — toda llamada custodiada deja una entrada

Regla de ejemplo: *permite `ShellExecuteTool` cuando el comando empieza con `ls`, `cat`, `grep` o `find`. Requiere aprobación para todo lo demás.*

```yaml
mateclaw:
  tool:
    guard:
      enabled: true
      default-policy: require_approval
      rules:
        - tool: ShellExecuteTool
          arg-pattern: "^(ls|cat|grep|find)\\s"
          action: allow
        - tool: WriteFileTool
          action: require_approval
```

O gestiónala interactivamente en `Ajustes → Seguridad y Aprobación`. Cuando una regla requiere aprobación, el runtime persiste una fila en `mate_tool_approval` y suspende el turno del agente. Cuando el usuario decide, el agente reanuda donde se pausó. Mecanismo completo en [Seguridad y Aprobación](./security).

### Sistema de hooks declarativo

Las reglas de Tool Guard son un caso especial de un mecanismo más general — el **sistema de hooks declarativo**. Cinco hooks de ciclo de vida cubren todo momento crítico en la ejecución de herramientas y LLM:

| Hook | Se dispara cuando | Uso típico |
|------|-----------|-------------|
| `before_tool` | Antes de la ejecución de la herramienta | Redacción de argumentos, inyección de contexto, validación extra |
| `after_tool` | Después de la ejecución de la herramienta | Filtrado de resultados, logging de auditoría |
| `before_llm` | Antes de la llamada al LLM | Enriquecimiento de prompt, chequeo de cache hit |
| `after_llm` | Después de que el LLM devuelve | Filtrado de salida, contabilidad de tokens |
| `on_error` | Ante error | Alertas, estrategia de fallback |

Los hooks corren en proceso. Pueden transformar argumentos, transformar resultados, enmascarar campos sensibles y agregar entradas de log de auditoría. Puedes usar hooks para cosas más allá de Tool Guard — como inyectar una política de seguridad antes de toda llamada al LLM, o auto-redactar campos sensibles de los retornos de herramientas.

---

## Ejecución: concurrente, aislada, acotada

- **Ejecución concurrente** — dentro de un turno, las llamadas a herramientas independientes corren en paralelo. Los chequeos de guarda son secuenciales; la ejecución es concurrente donde es seguro.
- **Timeouts por herramienta** — toda herramienta tiene su propio timeout. Defaults: herramientas rápidas 30s, shell/browser 60s, herramientas de generación hasta 300s.
- **Aislamiento de segmentos** — cuando se necesitan aprobaciones a mitad de turno, el segmento se divide en el límite de la aprobación.
- **Truncamiento de observaciones** — los resultados largos de herramientas se truncan automáticamente antes de agregarse al historial de observaciones.
- **Aislamiento de errores** — el fallo de una herramienta no aborta el turno.

---

## Gestión de herramientas vía API

```bash
# Listar todas las herramientas
curl http://localhost:18088/api/v1/tools \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Habilitar / deshabilitar
curl -X PUT "http://localhost:18088/api/v1/tools/1/toggle?enabled=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Definir nivel de divulgación para una herramienta integrada o de canal
curl -X PUT http://localhost:18088/api/v1/tools/1/disclosure-tier \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"tier": "core"}'
```

La API REST actual gestiona filas de herramientas, estado habilitado y nivel de divulgación. La ejecución directa de herramientas integradas ocurre a través del runtime del agente, no de un endpoint `/tools/{name}/test`.

---

## Crear una herramienta personalizada

### Opción 1: un Spring bean anotado con `@Tool`

```java
@Component
public class FactorialTool {

    @Tool(description = "Calculate the factorial of a number")
    public String factorial(
            @ToolParam(description = "The number to compute factorial for") int n) {
        long result = 1;
        for (int i = 2; i <= n; i++) {
            result *= i;
        }
        return String.valueOf(result);
    }
}
```

- Spring `@Component`
- Todo método `@Tool` se vuelve una herramienta llamable
- Usa `@ToolParam` en cada parámetro — esa es la descripción para el LLM
- El valor de retorno es lo que el agente ve
- **Si la herramienta es peligrosa, agrega una regla de Tool Guard para ella**

Reinicia y la herramienta está viva.

### Opción 2: un script de skill

¿No quieres escribir Java? Empaqueta el comportamiento en un paquete de skill con un `SKILL.md` y un script. Ver [Skills](./skills).

### Opción 3: un servidor MCP

¿La capacidad ya existe como servidor MCP? Solo agrega la configuración del servidor. Ver [MCP](./mcp).

---

## 2.1.0: puente progresivo de herramientas y completitud de acciones

Con un catálogo de herramientas grande, AuraClaw expone primero un directorio ligero y expande los esquemas concretos solo cuando la tarea los necesita. El puente progresivo reduce la presión de contexto; los nombres de herramientas normalizados y habilitados se cachean para que los bucles largos no escaneen repetidamente el camino caliente de MCP.

Las solicitudes de acción ahora llevan una política de completitud: cuando el usuario pide explícitamente enviar, crear, borrar, consultar un sistema externo u operar un navegador, el runtime reintenta una vez si su libro mayor no tiene ninguna llamada a herramienta sustantiva exitosa. Un segundo intento solo-texto termina como `action_unverified`; un intento sustantivo que falló termina como `action_failed`, en lugar de reclamar completitud. Esto prueba que una llamada sustantiva tuvo éxito, no la equivalencia semántica entre su resultado y el objetivo del usuario. Las explicaciones de solo lectura y las respuestas que no necesitan herramienta no se ven afectadas.

`browser_use` endurece la vida de los refs, la seguridad de navegación, las compuertas de sesión, las condiciones de espera y los snapshots. Los cambios de página invalidan explícitamente los refs viejos, y los resultados de navegación/espera son diagnosticables en lugar de hacer clic silenciosamente en un elemento obsoleto o cruzar sesiones de navegador.

Las herramientas proactivas `list_channel_sessions` / `send_channel_message` empujan solo a conversaciones verificadas del workspace actual; ver [Canales](./channels).

---

## Siguiente

- [Skills](./skills) — capacidades de mayor nivel construidas sobre herramientas
- [MCP](./mcp) — proveedores externos de herramientas
- [Seguridad y Aprobación](./security) — reglas de Tool Guard, flujo de aprobación, log de auditoría
- [Multimodal](./multimodal) — herramientas de generación (imagen, video, música, TTS, STT)
