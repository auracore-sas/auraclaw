# Skills

**Un skill es una herramienta que piensa en oraciones.**

Las herramientas son atómicas — leer un archivo, enviar una solicitud HTTP, correr un comando. Los skills son composiciones — "investiga este tema y escribe un informe", "revisa este código y coméntalo", "convierte mi git log en una actualización de standup". Un skill es un archivo `SKILL.md` que combina instrucciones, parámetros, plantillas de prompt, scripts opcionales y una lista de herramientas que el skill necesita. El runtime lo carga, lo renderiza con tus entradas y entrega el resultado al agente.

Si las herramientas son manos, los skills son recetas.

---

## Cinco tipos de skills

| Tipo | De dónde viene | Quién lo mantiene |
|------|--------------------|------------------|
| **`builtin`** | Viene con AuraClaw bajo `skills/` en el classpath | El equipo central |
| **`custom`** | Creado por ti vía UI, API, o soltando un archivo en el workspace | Tú |
| **`dynamic`** | Auto-sintetizado por agentes durante el trabajo | El agente + tu aprobación |
| **`mcp`** | Respaldado por una herramienta expuesta desde un servidor MCP (un skill `custom` del mismo nombre lo eclipsa) | El autor del servidor MCP |
| **`acp`** | Puenteado desde un endpoint externo de Agent Client Protocol (Claude Code, Codex, etc.) | El servicio de agente upstream |

Los cinco fluyen por el mismo pipeline de runtime. Solo la fuente difiere.

---

## El protocolo SKILL.md

Todo skill es un archivo Markdown con frontmatter YAML. El frontmatter es el contrato. El cuerpo es el prompt.

```markdown
---
name: web-researcher
title: Web Researcher
description: Search the web and summarize findings on a given topic
version: 1.0.0
type: custom
author: tu-nombre
tools:
  - WebSearchTool
  - ReadFileTool
tags:
  - research
  - search
parameters:
  - name: topic
    type: string
    required: true
    description: The topic to research
  - name: depth
    type: string
    required: false
    default: brief
    description: Level of detail (brief, detailed, comprehensive)
---

# Web Researcher

Eres un asistente de investigación web. Dado un tema, debes:

1. Usar WebSearchTool para encontrar información relevante sobre {{topic}}
2. Evaluar la credibilidad de las fuentes
3. Compilar los hallazgos en un resumen {{depth}}
4. Incluir las URLs de las fuentes en tu respuesta

## Formato de Salida

Presenta tus hallazgos como:
- **Resumen**: panorama de 2-3 oraciones
- **Hechos Clave**: lista de viñetas
- **Fuentes**: lista numerada de URLs
```

Dos cosas que notar. Primero, el cuerpo es un prompt — no una descripción de uno. Es lo que el skill le dirá al agente en runtime, con `{{topic}}` y `{{depth}}` ya rellenados. Segundo, la lista `tools:` es un contrato: el runtime garantiza que esas herramientas están disponibles cuando el skill corre. Si el agente no las tiene, la llamada al skill falla temprano con un error claro.

### Campos del frontmatter

| Campo | Requerido | Propósito |
|-------|----------|---------|
| `name` | ✅ | Identificador único (kebab-case) |
| `title` | ✅ | Nombre visible legible por humanos |
| `description` | ✅ | Resumen de una línea |
| `version` | ✅ | Versión semántica |
| `type` | ✅ | `builtin`, `custom`, `mcp` |
| `author` | — | Autor del skill |
| `tools` | — | Lista de nombres de herramientas que el skill requiere |
| `tags` | — | Categorización |
| `parameters` | — | Parámetros de entrada tipados |

### Esquema de parámetros

| Campo | Requerido | Propósito |
|-------|----------|---------|
| `name` | ✅ | Nombre del parámetro (usado en la interpolación `{{name}}`) |
| `type` | ✅ | `string`, `number`, `boolean`, `array` |
| `required` | — | Si debe proveerse (default: false) |
| `default` | — | Valor de respaldo si el llamador lo omite |
| `description` | ✅ | Qué controla el parámetro |

### Herramientas envoltorio tipadas para scripts (nuevo en v1.4)

Un SKILL.md puede declarar un bloque `scripts:` que convierte cada entrypoint de script en **su propia herramienta nombrada** con un JSON Schema tipado. En lugar de un `runSkillScript` genérico, el modelo ve herramientas `skill_<skill>_<entrypoint>` y llena los parámetros descritos por el esquema directamente.

```yaml
scripts:
  - id: summarize
    path: scripts/dispatch.py
    fixedArgs: ["summarize"]        # antepuestos textualmente a cada llamada
    parameters:
      - name: url
        type: string
        required: true
  - id: translate
    path: scripts/dispatch.py
    fixedArgs: ["translate"]
    parameters:
      - name: lang
        type: string
        required: true
```

- **Una herramienta tipada por entrypoint** — el modelo recibe parámetros tipados, no una cadena de argumentos libre.
- **`fixedArgs` deja que un script dispatcher respalde varios entrypoints** — ambas entradas de arriba llaman a `dispatch.py`, distinguidas por el argumento fijo inicial, así no necesitas un archivo separado por comando.
- **Los envoltorios se registran/desregistran con el ciclo de vida del skill** — aparecen cuando el skill entra en vivo y desaparecen cuando se deshabilita o archiva. El recorrido de rutas está bloqueado: solo los scripts bajo el directorio `scripts/` del propio skill son alcanzables. Un skill solo-de-base-de-datos (sin directorio) no expone envoltorios.

---

## El pipeline del runtime

```
1. RESOLVER     Buscar el skill por nombre en mate_skill
       │
       ▼
2. VALIDAR      Chequear que los parámetros requeridos estén provistos
       │
       ▼
3. RENDERIZAR   Reemplazar los placeholders {{parameter}} en el cuerpo del SKILL.md
       │
       ▼
4. INYECTAR     Anexar las instrucciones renderizadas al prompt de sistema del agente
       │
       ▼
5. LIGAR TOOLS  Verificar que las herramientas requeridas estén disponibles; fallar rápido si faltan
       │
       ▼
6. EJECUTAR     El agente procesa el prompt enriquecido con las herramientas ligadas
```

Los skills no corren scripts por defecto — **moldean el comportamiento del agente** durante la llamada. El siguiente paso de razonamiento del agente ve las instrucciones renderizadas del skill como parte de su prompt de sistema. La excepción son los skills que vienen con un script — `SkillScriptTool` puede ejecutar el archivo de script empaquetado del skill, controlado por Tool Guard.

### Renderizado de plantillas

Los cuerpos de skill soportan placeholders `{{nombreDelParametro}}`. Con `{topic: "computación cuántica", depth: "detailed"}`:

```markdown
Investiga el tema "{{topic}}" con un nivel de detalle {{depth}}.
```

…se renderiza a:

```markdown
Investiga el tema "computación cuántica" con un nivel de detalle detailed.
```

Los parámetros faltantes caen a sus defaults. Los placeholders desconocidos se dejan intactos.

---

## Almacenamiento de skills

La base de datos es la fuente de verdad, el filesystem es una caché materializada. Esa siempre fue la regla para **SKILL.md**, y **desde v1.3 aplica también a scripts/ y references/**.

### Base de datos: `mate_skill` + `mate_skill_file`

`mate_skill` — identidad y cuerpo del skill:

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `name` | Nombre único |
| `title` | Título visible |
| `description` | Resumen de una línea |
| `type` | `builtin` / `custom` / `mcp` |
| `content` | Contenido completo del `SKILL.md` |
| `version` | Versión semántica |
| `enabled` | Encendido/apagado |
| `tags` | Arreglo JSON |
| `create_time` / `update_time` | Marcas de tiempo |

`mate_skill_file` (nuevo en v1.3, migración `V112`) — la **copia canónica** de cada archivo del bundle:

| Columna | Propósito |
|--------|---------|
| `id` | Clave primaria |
| `skill_id` | FK a `mate_skill` |
| `file_path` | Ruta relativa como `scripts/run.py` o `references/cfg.md` |
| `content` | Texto UTF-8 (defaults: ≤1 MB por archivo, ≤50 MB por bundle — configurable vía `mateclaw.skill.upload.max-entry-size-mb` / `max-total-size-mb`) |
| `content_size` | Conteo de bytes (para que los listados no tengan que cargar el blob) |
| `sha256` | Huella de contenido, impulsa el diff idempotente del sincronizador |

### Filesystem: workspace de skills

```
~/.mateclaw/skills/
├── translate/
│   ├── SKILL.md               # Definición del skill
│   ├── references/            # Materiales de referencia
│   └── scripts/               # Scripts ejecutables opcionales
├── code-review/
│   ├── SKILL.md
│   └── ...
└── .archived/                 # Versiones viejas archivadas
    └── translate-20260401-143000/
```

Piénsalo como "Maven Local Repository, pero para skills" — excepto que el repo local ahora puede hidratarse a sí mismo desde la base de datos.

### Auto-sync al arrancar

Dos pasadas de sync corren al boot, para que todo nodo tenga el bundle más reciente:

1. `SkillWorkspaceBootstrapRunner` → `BundledSkillSyncer` escanea el directorio `skills/` del classpath, sincroniza los **skills empaquetados** a la raíz del workspace y persiste sus `scripts/` y `references/` en `mate_skill_file`. Las modificaciones locales normalmente se dejan en paz; pero si el directorio `scripts/` en disco ha desaparecido por completo (endurecimiento 2.0.0), se fuerza su restauración desde el classpath — los scripts de un skill integrado no pueden quedar permanentemente mutilados por un borrado accidental.
2. `SkillFileSyncer` diffea `mate_skill_file` (BD) contra el workspace local (FS) por `sha256` y materializa lo que falte o esté obsoleto; para skills integrados con archivos de script ni en BD ni en disco, rellena desde el classpath (camino de auto-sanación 2.0.0).

**Por qué esto importa para despliegues multi-instancia**: un nodo acepta la subida, la fila de BD + las filas de archivos se escriben, todo otro nodo o reinicia o golpea `POST /api/v1/skills/{id}/sync-files` para recibir el bundle completo. Sin NFS, sin bucle de scp, incluso los clientes de escritorio pueden pasar un skill entre máquinas.

> Camino de actualización: las instalaciones pre-v1.3 tienen archivos en disco pero sin filas `mate_skill_file`. La primera vez que `SkillFileSyncer` corre en un nodo recién actualizado, **rellena desde disco** al almacén canónico; desde entonces los dos quedan en sincronía.

### Instalación robusta de zips

Los empaquetadores de terceros empaquetan raro — algunos ponen `setup.sh` en la raíz del zip, otros emiten entradas `scripts/` antes que `SKILL.md`. Desde v1.3, `ZipSkillFetcher`:

- **Extracción en dos pasadas** — el archivo completo se bufferea en memoria primero (protegido por tope, 50 MB por defecto vía `mateclaw.skill.upload.max-total-size-mb`), se localiza `SKILL.md` y se calcula el prefijo del directorio envoltorio, luego se clasifican las entradas. **El orden de las entradas del zip ya no afecta el resultado.**
- **Fallback de extensión a nivel raíz** — los archivos que están junto a `SKILL.md` y no están ya bajo un bucket conocido se clasifican por extensión: `.sh / .py / .js / .rb / ...` → `scripts/`, `.md / .json / .yaml / .csv / ...` → `references/`. Las extensiones desconocidas se descartan con una línea `WARN` para que los errores de empaquetado salgan a la luz en lugar de desaparecer.
- **Escribir-luego-podar + guarda de bundle vacío** — las reinstalaciones **escriben los archivos nuevos primero, luego podan cualquier cosa en el bucket que no esté en el bundle nuevo**. Si el bundle nuevo tiene cero entradas para un bucket (`scripts/` o `references/`), las copias en disco de ese bucket se **dejan en paz** — una re-extracción malformada ya no puede borrar tus scripts. Pasa `forcePrune=true` si realmente quieres limpiar un bucket con un bundle intencionalmente vacío.
- **Se acabó el mojibake en nombres de archivo CJK** (2.0.0) — los nombres de entrada del zip y el contenido de archivo tienen sus codificaciones **detectadas de forma independiente**: un archivo construido por un empaquetador de Windows con nombres de entrada GBK y contenido UTF-8 decodifica cada lado correctamente, así ya no obtienes "nombres garabateados pero contenido legible" (o lo inverso) tras instalar.

> Fallo real que esto atrapa: el zip oficial de tencent-meeting-mcp pone `setup.sh` en la raíz del paquete (no bajo `scripts/`). El extractor viejo lo descartaba silenciosamente; el nuevo lo auto-clasifica como `scripts/setup.sh` y el skill se instala listo para correr.

### Configuración

```yaml
mateclaw:
  skill:
    workspace:
      root: ${user.home}/.mateclaw/skills
      auto-init: true
      delete-policy: archive                 # `archive` o `ignore`
      bundled-skills-path: skills
```

---

## SKILL.md de fuente única (2.0.0+)

Antes de 2.0.0 había un fork oculto: el runtime leía SKILL.md del directorio del workspace mientras la consola de administración leía la columna de la base de datos. Un empleado editando el archivo con herramientas de shell en una sesión de chat cambiaba el comportamiento del runtime de forma invisible para la consola; a la inversa, una exportación fallida dejaba a los agentes ejecutando contenido obsoleto que la consola afirmaba que era el actual.

Ahora los dos lados corren una **reconciliación a tres bandas**, anclada en un sidecar que registra el hash del último sync: las ediciones del lado archivo se ingieren a la BD, las ediciones del lado BD se materializan al archivo, y un conflicto de dos lados se resuelve **BD-gana** con el lado archivo conservado como respaldo `SKILL.md.bak`. Un archivo en blanco nunca sobrescribe contenido no-blanco de BD; una BD en blanco se rellena desde el archivo. La reconciliación corre en cada resolución de camino por convención, y abrir el detalle de un skill en la consola también realiza una reconciliación al leer — **lo que ves en la consola es lo que el empleado ejecuta.**

(Los skills con un `skillDir` explícito se quedan con autoridad de archivo, espejando su contenido a la columna de BD para visualización.)

---

## Gestión de archivos del bundle: scripts, references y templates editables desde la consola (2.0.0+)

El cajón de detalle antes solo mostraba y editaba SKILL.md; `scripts/` y `references/` no tenían superficie de consola en absoluto, y `templates/` ni siquiera estaba en el conjunto de buckets del almacén canónico. Ahora:

- **Endpoints admin `/api/v1/skills/{id}/files`**: listar / leer / upsert / borrar los archivos del bundle de un skill. Las escrituras caen en la fila canónica `mate_skill_file`, materializan la caché del workspace y re-resuelven el skill de inmediato — **la siguiente llamada del empleado corre el script nuevo**.
- **`templates/` se vuelve un bucket de primera clase**: persistido en BD como `scripts/` y `references/`, incluido en sync y relleno, protegido por la guarda de poda de bundle vacío.
- **Envoltura de rutas**: solo se permiten los tres buckets por convención y el recorrido está bloqueado; los archivos de skills integrados se quedan de solo lectura (restaurados del bundle enviado al actualizar); los skills virtuales MCP / ACP no poseen archivos.
- **Las escrituras del lado agente también persisten**: cuando un skill edita sus propios archivos de bundle vía `write_file` en una sesión, el cambio se espeja al almacén canónico — la consola y el runtime nunca vuelven a estar en desacuerdo.

---

## Mercado de Skills (y ClawHub)

La página **Mercado de Skills** (`/skills`) es donde navegas, instalas, editas y gestionas skills. Tres fuentes:

- **Integrados** — skills que vienen con AuraClaw
- **Tus skills personalizados** — los que creaste
- **ClawHub** — un repositorio comunitario de skills. Navega miles de skills de la comunidad, previsualízalos, instala con un clic. Los skills instalados aterrizan como tipo `custom`.

ClawHub es opcional — si estás offline o no quieres skills externos, simplemente no toques esa pestaña.

---

## API del Mercado de Skills

```bash
# Listar todos los skills
curl http://localhost:18088/api/v1/skills \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Crear un skill personalizado
curl -X POST http://localhost:18088/api/v1/skills \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "code-reviewer",
    "title": "Code Reviewer",
    "description": "Review code for bugs, style issues, and improvements",
    "type": "custom",
    "content": "---\nname: code-reviewer\n...",
    "tags": ["development", "review"]
  }'

# Habilitar / deshabilitar
curl -X PUT "http://localhost:18088/api/v1/skills/1/toggle?enabled=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Borrar
curl -X DELETE http://localhost:18088/api/v1/skills/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

La política de borrado es configurable — por defecto, el borrado mueve el workspace del skill a `.archived/` en lugar de borrarlo.

---

## Escribir un skill personalizado — paso a paso

1. **Decide qué hace el skill.** Una oración.
2. **Lista las herramientas que necesita.** Tres o menos es un buen objetivo.
3. **Escribe los parámetros.** Requeridos primero, opcionales con defaults.
4. **Escribe el cuerpo.** Dirígete al agente directamente: *"Eres X. Cuando te den Y, haz Z."*
5. **Sube** vía la UI del Mercado de Skills o la API.
6. **Liga** el skill a uno o más agentes.
7. **Prueba** enviando un mensaje que debería disparar el skill.

Ejemplo — skill "Daily Standup":

```markdown
---
name: daily-standup
title: Daily Standup Generator
description: Genera una actualización diaria de standup basada en actividad git reciente
version: 1.0.0
type: custom
tools:
  - ShellExecuteTool
parameters:
  - name: repo_path
    type: string
    required: true
    description: Ruta al repositorio git
---

# Daily Standup Generator

Genera una actualización de standup analizando la actividad git reciente.

## Pasos

1. Corre `git log --oneline --since="yesterday" --author=$(git config user.name)`
   en el directorio {{repo_path}}
2. Resume el trabajo completado
3. Identifica cualquier rama de trabajo en progreso
4. Formatea como actualización de standup:
   - **Ayer**: Qué se completó
   - **Hoy**: Qué está planificado según las ramas abiertas
   - **Bloqueantes**: Cualquier conflicto de merge o test fallando
```

---

## Aislamiento de workspace (sellado por completo en 2.0.0)

Cada workspace obtiene su propia copia de los skills. Cuando habilitas un skill para un workspace, sus archivos se escenifican bajo el directorio de ese workspace, las herramientas del skill se acotan a ese workspace, y cualquier archivo que el skill escriba se queda dentro del límite del workspace.

2.0.0 sella el aislamiento a través de **cada capa de almacenamiento y ejecución**:

- **Los skills con el mismo nombre coexisten entre workspaces.** La dedup de instalación, la unicidad de nombre y las búsquedas de reinstalar/desinstalar filtran todas por workspace — el skill "book-meeting" del workspace A ya no bloquea al workspace B de instalar el suyo.
- **Las rutas del filesystem codifican el workspace.** El esquema de directorios del skill incluye el workspaceId, así dos skills del mismo nombre poseen directorios separados — se acabó compartir un directorio, sobrescribirse entre sí o que los scripts aterricen en la casa del vecino.
- **La resolución en runtime está acotada al workspace de la conversación.** `load_skill`, las lecturas de archivos de skill, las corridas de scripts y el auto-redirect resuelven todos solo dentro de "el workspace de esta conversación + builtin + virtual global" — un empleado de un workspace no puede leer ni ejecutar el skill del mismo nombre de otro workspace.

Ver [Workspaces](./workspaces).

---

## Auto-síntesis de skills

Los agentes que trabajan contigo el tiempo suficiente empiezan a notar patrones — una consulta recurrente de base de datos, un layout de reporte particular, los comandos exactos para hacer SSH a tu caja. Los agentes pueden **convertir esos patrones en skills por sí solos**.

El flujo:

1. El agente reconoce un flujo de trabajo reutilizable durante la ejecución de una tarea
2. El agente propone un skill nuevo (crear / editar / parchear / borrar)
3. Tú revisas en la ChatConsole — revisa el contenido, renómbralo si quieres, aprueba o rechaza
4. Al aprobar, el skill se guarda como tipo `dynamic`, listo para reutilizar

**El escaneo de seguridad corre automáticamente antes de guardar** — los patrones peligrosos (inyección de prompt, inyección de script) se bloquean. Los skills pueden migrar entre agentes y exportarse como ZIP.

La memoria del agente crece contigo. Se acabó repetir "recuerda que me gustan las tablas ordenadas así".

---

## Asistente de plantillas: empieza desde un starter

¿No sabes escribir un SKILL.md? Abre el asistente.

`Skills → Asistente de Creación`:

1. Elige una **plantilla starter** (8 de ellas: investigador, revisor de código, asistente de escritura, script de soporte al cliente, análisis de datos, helper de Claude Code, helper de Codex, en blanco)
2. Llena las variables — nombre, parámetros, unas pocas oraciones de descripción
3. Sube cualquier archivo de soporte (scripts, references, fragmentos de prompt)
4. Define secretos (claves API, etc.) — **los secretos van a una bóveda, no al SKILL.md**
5. Guarda

No obtienes solo un SKILL.md. Obtienes un **bundle multi-archivo** — SKILL.md, references/, scripts/, referencias a secretos — empaquetados juntos.

### El meta-skill `skill-authoring` (nuevo en v1.4)

Ahora hay un skill integrado `skill-authoring`, auto-sembrado al arrancar, que le enseña a un agente (o a ti) cómo escribir un SKILL.md correctamente. Cubre:

- **Frontmatter requerido** y qué significa cada campo
- **Límites del validador** — el nombre debe coincidir con `^[a-z0-9][a-z0-9._-]{0,63}$`, contenido ≤ 100k caracteres
- **Flujos de autoría integrado vs personalizado**
- **Colocación de directorios** para scripts/ y references/
- **Errores comunes** que fallan la validación o se comportan mal en silencio

Lígalo a un agente y "escríbeme un skill que…" produce un bundle válido al primer intento, no tras tres idas y vueltas de validación.

---

## Chequeo pre-vuelo antes de instalar

Un skill instalado no es necesariamente un skill que corre — puede necesitar una clave API, una herramienta CLI, una feature flag de AuraClaw encendida.

Antes era: instalar, correr, fallar, depurar. Ahora:

**Diálogo de instalación pre-vuelo** — corre el chequeo de prerrequisitos automáticamente antes de que el skill entre en vivo:

- ¿Están presentes las herramientas requeridas?
- ¿Están configuradas las claves API requeridas?
- ¿Están encendidas las feature flags requeridas?
- ¿Son alcanzables los endpoints MCP / ACP dependientes?

Lo que falte se reporta por adelantado, con un botón **`[Configurar]`** de un clic que salta a la página de config correcta. **Se acabó instalar-luego-depurar.**

---

## LESSONS.md: skills que aprenden de la experiencia

Cada skill puede llevar un `LESSONS.md` — lo que el skill aprendió durante sus corridas.

- Tras una corrida, el skill puede **escribir proactivamente una lección**: "La última vez al usuario no le gustó ese formato, no lo hagas de nuevo"
- La próxima vez que se invoque el mismo skill, las LESSONS se auto-inyectan al contexto del prompt
- Cuanto más se usa, mejor sabe **cuándo intervenir y cuándo mantenerse fuera**

Este es el primer corte de la auto-evolución de skills. Los skills pasan de una lista de instrucciones a algo con playbooks, experiencia y capacidad de crecer.

Las LESSONS se ven y editan en la pestaña **Memoria** del cajón de detalle del skill.

---

## Secretos: pon el token en el lugar correcto

Muchos skills necesitan credenciales de API para funcionar — tencent-meeting necesita `TENCENT_MEETING_TOKEN`, Slack necesita un bot token, Linear necesita una clave API personal. Esos valores **no pertenecen al SKILL.md** (va al prompt y se filtra al LLM), no pertenecen a scripts (un git push y te arrepientes), y editar `~/.zshrc` requiere reiniciar el servidor y no seguirá al skill entre máquinas.

Desde v1.3, todo skill tiene su propio **almacén de secretos por skill**.

### Gestiona en la UI

Cajón de detalle del skill → pestaña **Secretos**. Una tabla más un formulario:

```
Clave                      Valor         Última actualización     Acciones
TENCENT_MEETING_TOKEN     sk••••ef      2026-05-12               [Editar] [Borrar]

[+ Agregar secreto]
```

- **El texto plano nunca sale del servidor** — el listado devuelve solo `preview` (máscara estilo `sk••••ef`); el campo de valor del diálogo de agregar/editar empieza en blanco, guardar sobrescribe lo que hubiera.
- **Validación del lado del cliente** — las claves deben coincidir con `^[A-Za-z_][A-Za-z0-9_]{0,127}$`; las claves malas se rechazan en el navegador antes de enviar.
- **El campo de valor es `<input type="password" autocomplete="off">`** — los miradores de hombro, los screenshots y los gestores de contraseñas se quedan fuera.

### Cómo se almacena / cómo se inyecta

| Etapa | Qué pasa |
|---|---|
| Escritura | `POST /api/v1/skills/{id}/secrets` `{key, value}` → cifrado AES → `mate_skill_secret` |
| Lectura | Antes del lanzamiento del subproceso, `SkillSecretService.getDecrypted(skillId)` descifra con AES |
| Inyección | `ProcessBuilder.environment().putAll(...)` — **sobrescribe las variables de entorno del proceso padre con el mismo nombre** |

La regla de inyección es **el almacén de secretos gana, `.zshrc` es el fallback**. Para despliegues multiusuario / multimáquina, clientes de escritorio y cuentas corporativas que no comparten bases de datos, el almacén de secretos es la fuente de verdad más confiable.

### Endpoints REST

```bash
# Listar (enmascarado)
GET    /api/v1/skills/{id}/secrets
# Upsert (valor vacío borra)
POST   /api/v1/skills/{id}/secrets   {"key":"...", "value":"..."}
# Borrar
DELETE /api/v1/skills/{id}/secrets/{key}
```

### Un ejemplo completo: tencent-meeting

```
MercadoDeSkills → tarjeta tencent-meeting-mcp → cajón de detalle → pestaña Secretos
  → + Agregar secreto → key=TENCENT_MEETING_TOKEN, value=<pega tu token>
  → Guardar

Luego, cuando el agente corre setup.sh o scripts/tencent_meeting.py:
  El env de ProcessBuilder lleva $TENCENT_MEETING_TOKEN
  → el script mcporter / Python llama a la API de Tencent → ID de reunión devuelto
```

Sin editar `~/.zshrc`, sin reiniciar AuraClaw.

---

## Descubribilidad: un skill instalado debería ser un skill encontrado

Instalar un skill nuevo antes solía significar que el agente a menudo no podía encontrarlo. Tres causas, tres arreglos, todos en v1.3.

### 1) Los skills nuevos son **impulsados** en el catálogo del prompt

El prompt de sistema del agente lleva una tabla compacta de Skills. Cada modelo obtiene un tope de filas según sus tokens máximos de entrada — qwen-turbo con 8192 tokens obtiene solo **8 entradas**. Un skill recién salido tiene cero historial de uso, así que el orden existente reciente / frecuente / RECOMENDADO lo entierra detrás de ~40 skills más viejos, muy por debajo del corte.

v1.3 inserta una clave de orden "**instalado en los últimos 7 días**" al frente del ranker. Instala el viernes, el skill sigue en el primer marco el lunes — suficiente para atravesar un fin de semana, no tanto como para ocupar un slot indefinidamente. Los builtins y las filas virtuales MCP/ACP se excluyen (no los "acabas de instalar").

### 2) `listAvailableSkills()` le enseña al LLM a buscar más amplio

La descripción de la herramienta ahora dice explícitamente:

- La página por defecto es de 20 entradas; si ves `Showing: 20 of 47`, **reintenta con `keyword=<parte del nombre>` o `limit=50`**
- Si el usuario menciona un nombre de skill específico, **sáltate el catálogo** — ve directo a `readSkillFile(skillName="<nombre-exacto>", filePath="SKILL.md")` para verificar

Los resultados truncados llevan una pista de una línea al final para que incluso los modelos pequeños vean cómo seguir.

### 3) Llamar a un nombre de skill como herramienta **auto-redirige**

Los LLMs ocasionalmente llaman a un nombre de skill como si fuera una herramienta (`tencent-meeting-mcp({...})`). El comportamiento anterior era una pista textual diciéndoles que llamaran a `readSkillFile` en su lugar — algo sobre lo que los modelos clase qwen-turbo a menudo no pueden actuar. Responden "déjame conseguirte eso" y terminan el turno sin ninguna llamada a herramienta adicional, produciendo un bucle muerto.

Desde v1.3, cuando `ToolExecutionExecutor` ve este caso Y `readSkillFile` está ligada al agente, **invoca transparentemente readSkillFile en nombre del LLM** y devuelve el contenido del SKILL.md (prefijado con `[auto-redirect]` y los argumentos originales devueltos en eco) como el resultado de la herramienta. El modelo tiene instrucciones ejecutables frente a sí en su primer intento y va directo a `runSkillScript`, sin bucle.

> Este arreglo ayuda mucho a los modelos pequeños y no lastima a los grandes (ellos habrían seguido la pista textual de todos modos).

---

## Divulgación progresiva de skills (nuevo en v1.4)

Volcar el SKILL.md completo de cada skill al prompt de sistema no escala — revienta el presupuesto de tokens y agita la caché del prompt en cada turno. v1.4 voltea el modelo: el prompt lleva solo un catálogo compacto, y el agente **extrae las instrucciones de un skill a demanda**.

**`load_skill(skillName, filePath?)`** carga el SKILL.md de un skill (o cualquier archivo del bundle vía el `filePath` opcional) justo cuando el agente decide usarlo:

- **Inyectado vía historial de mensajes, no el prompt de sistema** — el contenido cargado llega como un turno de conversación, así el prompt de sistema (y su caché) se mantiene byte-estable durante la sesión.
- **Los skills cargados se fijan** al tope del catálogo del runtime en turnos posteriores, así el agente sigue viendo lo que acaba de traer.
- La guía del catálogo le dice al modelo que llame `load_skill(skillName=<nombre>)` antes de usar un skill, y que lo llame directamente cuando el usuario nombra un skill específico.

```yaml
mateclaw:
  skill:
    disclosure:
      load-skill-tool:
        enabled: true     # default; pon false para caer al flujo viejo de readSkillFile
```

Deshabilitado, la guía del catálogo apunta a `readSkillFile` en su lugar y `load_skill` no se registra.

---

## El menú slash `/skill` en el chat (nuevo en 1.5.0)

¿No quieres darle instrucciones al empleado en lenguaje natural sobre qué skill usar? Escribe `/` en el compositor de chat para abrir un **selector de skills con búsqueda**:

- ↑↓ para moverse, Enter/Tab para seleccionar, Esc para cerrar; escribir filtra los skills habilitados en vivo (hasta 8 mostrados).
- La lista viene de `GET /api/v1/skills/enabled` — skills reales más skills virtuales derivados de MCP/ACP (un skill real eclipsa a uno virtual del mismo nombre). Cacheada por workspace por 30 segundos para que reabrir no re-consulte.
- Seleccionar un skill inserta una directiva en la caja: `Use the "nombre del skill" skill: `, cursor al final, listo para que agregues contexto y envíes. El empleado ve la directiva en el historial de mensajes y corre `load_skill` para traerlo.

El menú aparece cuando **hay un empleado seleccionado y ese empleado no ha deshabilitado skills** (el frontend chequea `currentAgent && !skillsDisabled`) — no está relacionado con el interruptor global de divulgación progresiva. Poner `mateclaw.skill.disclosure.load-skill-tool.enabled` en `false` globalmente solo detiene el registro de la herramienta `load_skill` en el backend; el menú igual se abre (el empleado solo cae a traer skills vía `readSkillFile` y similares).

---

## Curador del ciclo de vida de skills (nuevo en v1.4)

Los agentes que sintetizan skills acumulan basura — un skill de una sola vez de hace tres semanas sigue en el catálogo, comiéndose un slot. El **curador** es un barrido diario que envejece los skills **creados por agentes** inactivos a través de `active → stale → archived` y los saca del camino sin borrar nada.

- Inactivo más allá de `staleAfterDays` (default 30) → **stale**; inactivo más allá de `archiveAfterDays` (default 90) → **archived** (workspace movido a un subdirectorio `.archived/`). `restore` trae de vuelta un skill archivado.
- **Nunca se tocan**: builtins, skills fijados, skills MCP/ACP/virtuales, y cualquier nombre que empiece con un prefijo protegido (default `sys-`, `ops-`).

### Ajustes → Panel del Curador de Skills

- **Previsualizar (dry-run)** — ve exactamente qué skills movería el próximo barrido, antes de que corra.
- **Pausar / reanudar** todo el barrido; **activar / desactivar** un skill individual.
- Marcas de tiempo de **última corrida / próxima corrida** y **conteos por estado** (active / stale / archived).

### Configuración

```yaml
mateclaw:
  skill:
    curator:
      enabled: true
      cron: "0 0 2 * * *"        # diario a las 02:00
      staleAfterDays: 30
      archiveAfterDays: 90
      scope: AGENT_CREATED       # AGENT_CREATED | ALL_DYNAMIC | OFF
      protectPrefixes: ["sys-", "ops-"]
```

`scope: AGENT_CREATED` toca solo skills con una conversación fuente; `ALL_DYNAMIC` también barre skills dinámicos creados manualmente; `OFF` deshabilita el barrido sin importar `enabled`.

### Ciclo de vida en el Mercado de Skills

La página de Skills adopta el ciclo de vida:

- **Pestañas de ciclo de vida** — Habilitados / Stale / Archivados.
- Las tarjetas muestran una insignia de **"último uso"**.
- El cajón de detalle agrega **archivar / restaurar / fijar** manual.
- Archivar manualmente un skill aún ligado dispara un **apretón de manos de confirmación** — no sacas silenciosamente un skill de debajo de un empleado digital que todavía lo usa.

---

## Puente ACP: enchufa agentes de codificación externos

ACP (Agent Client Protocol) es un protocolo que deja que clientes de agente externos (Claude Code, Codex, otros clientes compatibles) se enchufen en AuraClaw como skills.

Una vez instalado:

- Los endpoints ACP **se auto-puentean a tarjetas de skill** — aparecen en la página de Skills con un conjunto de herramientas envoltorio
- **Editor visual de env** — la clave requerida, URL, CWD de cada endpoint, configurables en la UI
- **cwd por sesión** — cada sesión ACP tiene su propio directorio de trabajo
- **Errores traducidos** — los mensajes upstream como "Request not allowed" se traducen a algo accionable
- **Detección de secuestro del keychain OAuth** — si tu token OAuth ha sido secuestrado por otra app, se te pide re-autenticarte

Plantillas: `claude-code-helper`, `codex-helper` — instala y listo.

Un empleado digital llama a un skill ACP de la misma forma que llama a una herramienta integrada.

### SKILL.md virtual para skills MCP/ACP (nuevo en v1.4)

Los skills derivados de MCP y ACP solían ser bundles de herramientas opacos sin instrucciones legibles. v1.4 **sintetiza un SKILL.md virtual de solo lectura** desde los metadatos de cada servidor MCP/ACP (transporte, comando, args, env, herramientas expuestas), así esas integraciones aparecen como **catálogos de skill navegables** en la página de Skills. Por ser sintetizados, los SKILL.md virtuales se reconstruyen en cada llamada de listado — sin copia persistida obsoleta que mantener — y `load_skill` puede leerlos igual que un skill real, dándole al agente una descripción de lo que la integración puede hacer antes de que llame a una sola herramienta.

---

## Cajón de detalle: todo en un solo lugar

Cada tarjeta de skill abre un cajón con ocho pestañas:

- **Resumen** — campos de identidad, proyección del manifiesto, fuente, versión
- **Cuerpo** — editor de `SKILL.md` (toma todo el ancho del cajón)
- **Herramientas** — qué herramientas usa este skill (con expansión efectiva de herramientas)
- **Características** — matriz de capacidades
- **Seguridad** — resultados del escaneo de contenido, reglas de Tool Guard relacionadas
- **Lecciones** — contenido de `LESSONS.md`
- **Secretos** — credenciales estilo variable de entorno (nuevo en v1.3; ver la sección "Secretos" abajo)
- **Memoria** — empleados digitales ligados a este skill

La tarjeta en sí es delgada — seis campos y una píldora de estado. **Claro le gana a exhaustivo.**

---

## Seguridad

Los skills personalizados pasan por varios chequeos antes de entrar en vivo:

- **Escaneo de contenido** — el `SKILL.md` se escanea por inyección de prompt e inyección de script al subir
- **Chequeo de requerimiento de herramientas** — la lista `tools:` solo debe referenciar herramientas que existen
- **Cumplimiento de Tool Guard** — los skills con herramientas peligrosas heredan reglas de Tool Guard
- **Restricciones de skills MCP** — los skills respaldados por MCP heredan las restricciones de seguridad de su servidor MCP

Revisión completa en [Seguridad y Aprobación](./security).

---

## Skills de Content Studio (1.8.0+)

Tres skills integrados componen la escena de [Content Studio](./content-studio) — una frase a un post publicable de 公众号 / 小红书:

- **`gzh_article`** — creación de imagen-texto para Cuenta Oficial de WeChat, end-to-end: elige tema → investiga → redacta → ilustra → des-IA → layout HTML de estilo inline → entrega / caja de borradores. Honra tu memoria de persona y estilo.
- **`xhs_note`** — notas de Xiaohongshu imagen-primero: título de cuatro partes + cuerpo de frases cortas + etiquetas de tema, renderizado como ≥3 tarjetas verticales 3:4 con vista previa en línea.
- **`deai_humanize`** — des-IA-ificación medible: una puntuación heurística de traza de IA impulsa un bucle detectar → reescribir → re-chequear (dos tonos: 公众号 medido, 小红书 vivaz), limitado a 3 rondas.

Ver [Content Studio](./content-studio) para el pipeline completo, la cadena de publicación y el calendario de contenido.

---

## Bucle cerrado de evolución de skills (2.1.0+)

2.1.0 expande el aprendizaje de LESSONS.md a una cadena de mejora inspeccionable y reversible:

1. **Reflexión** propone un parche preciso o un candidato a skill nuevo desde una conversación completada.
2. **Minería de rutinas** agrupa las solicitudes de apertura de conversaciones recientes por empleado; no mina una traza de ejecución completa. La ventana por defecto es de 30 días, con al menos tres ocurrencias en tres días distintos. Una vez habilitada, el job nocturno promueve automáticamente a los candidatos calificados (dos por barrido por defecto); los administradores pueden promover antes, descartar o reabrir.
3. **La ligadura automática** solo maneja un skill nuevo con un empleado fuente, y agrega una fila solo cuando ese empleado ya usa una allowlist de skills explícita y no vacía. Heredar-todo no necesita ligadura, mientras que una elección explícita de sin-skills nunca se sobrescribe.
4. **El Curador** organiza skills stale, archivados y solapados por workspace. Empieza solo-previsualización y muta solo tras la activación del administrador; la consolidación se habilita por separado, con la creación de paraguas y el archivado de fuentes transaccionales.
5. **Adoptar / liberar** transfiere la gobernanza: adoptar entrega un skill de usuario a la curaduría autónoma, mientras liberar lo devuelve a la propiedad del usuario. No es un registro de qué empleado usa el skill.
6. **Snapshots** crean un punto de restauración antes de cada barrido mutador activado y de nuevo antes de restaurar; se retienen cinco por workspace por defecto.
7. **Origen** distingue built-in, usuario, agente y rutina, mientras también sirve como política del curador. La entrega manual cambia intencionalmente el estado usuario / agente.

El default seguro es **observar antes de permitir escrituras automáticas**: la reflexión y la minería de rutinas están deshabilitadas hasta que se habiliten explícitamente. El interruptor `enabled` de Reflexión controla si los datos de transcripción/catálogo llegan al modelo revisor, mientras `auto-apply` controla por separado las mutaciones; con auto-apply apagado no se escribe nada, pero no hay una cola persistida de aprobación humana. Las transcripciones y los cuerpos de skills se tratan como datos no confiables; las escrituras automáticas solo permiten crear o un parche de contexto único. El reemplazo completo, la exfiltración de secretos, los bypass de aprobación y las lecturas/escrituras entre workspaces fallan cerradas.

`Ajustes → Curador de Skills` muestra el estado del workspace, los candidatos de rutina, los reportes recientes, el origen, los skills gestionados/no gestionados y los puntos de restauración. Las operaciones de curador, rutina, snapshot, adoptar y liberar requieren todas el contexto del workspace actual.

---

## Siguiente

- [Herramientas](./tools) — herramientas que los skills pueden usar
- [Agentes](./agents) — cómo invocan skills los agentes durante un turno
- [MCP](./mcp) — skills respaldados por MCP
- [Seguridad y Aprobación](./security) — detalles del escaneo de skills
