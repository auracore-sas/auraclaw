# NEXT_SESSION.md — Resumen de la sesión y pendientes

> Documento de contexto para retomar el trabajo en la siguiente sesión.
> Fecha de la sesión: 2026-08-21 · Rama: `main` (base v2.1.0) · Fork: `auracore-sas/auraclaw`
> **Sesión 2026-08-21 (2ª): completados P1 (docs es), P4/P5 (prompts + marcadores), pruebas de regresión, y corrección del matiz de memoria.**
> **Sesión 2026-08-21 (3ª): P2 completado (OmniRoute) + verificación visual P4/P5 con 3 fixes de renderizado bilingüe en frontend.**
> **Sesión 2026-08-21 (4ª): P7 completado (inmersión en el código) → nuevo `docs/CODE_MAP.md` (7 módulos del núcleo mapeados).**
> **Sesión 2026-08-21 (5ª): feature V900 `usage_scope` (modelos por propósito) — dedicar LLMs a trabajos internos (wiki) excluyéndolos del chat normal.**
> **Sesión 2026-08-21 (6ª): cierre de leaks V900 (pin/default/selector) + despliegue Docker + verificación en vivo + plan de configuración Wiki (`docs/WIKI_MODEL_SETUP.md`).**
> **Sesión 2026-08-24 (7ª): Postgres del HOST alcanzable desde Docker + pipeline de datos de BD funcionando end-to-end.** Datasource "powerfin_test" (schema auracore), tools `execute_sql`/`query_datasource` siempre visibles (fix disclosure), prompt del Asistente General con guía de datos, modelo default → `deepseek-v4-flash` (gpt-4o vía OmniRoute daba respuestas vacías ~12/hora), módulo Enterprise ocultado del menú. Nada pendiente de commit (todo gitignoreado / DB-side / sistema).
> **Sesión 2026-08-26 (8ª): Wiki con OpenAI end-to-end + fix de bug GPT-5 en chat COMPLETADO y desplegado.** Detalle abajo.
> **Sesión 2026-08-27 (9ª): canales individuales (V901) — canal de Telegram con owner por usuario, conversaciones ya no visibles a todos.** Detalle abajo.
> **Sesión 2026-08-27 (9ª-b): voz entrante en Telegram (V902) — descarga + transcripción STT desplegado y verificado.** Detalle abajo.
> **Sesión 2026-08-27 (9ª-c): gráficas en Telegram — el agente genera la imagen y el adapter la entrega como foto nativa.** Detalle abajo.
> **Sesión 2026-08-27 (9ª-d): tablas markdown en Telegram — convertidas a bloques monospace alineados.** Detalle abajo.
> **Sesión 2026-08-27 (9ª-e): fix gráfica que no llegaba (bug de orden scrub/unwrap) + tablas anchas → viñetas + prompt anti-loop.** Detalle abajo.
> **Sesión 2026-08-27 (9ª-f): Panel por usuario (Opción A) + secciones admin-only (modelos LLM, cron) — desplegado y verificado.** Detalle abajo.

---

## ✅ Sesión 9ª-f (2026-08-27) — Panel (dashboard) por usuario + secciones admin-only

### Problema
- El Panel (`/dashboard`) era visible para cualquier miembro (`view:dashboard` está en el rol member) pero mostraba el **consolidado de todos los usuarios** (conversaciones, mensajes, tokens, tool calls) — filtraba solo por fecha + workspace.
- Además mostraba secciones sensibles: configuración de **modelos LLM** (proveedores/estado) y **ejecuciones de cron** (del sistema).

### Implementación (Opción A acordada)
- **Backend**: `DashboardController.effectiveUsername(auth)` — admin global → null (consolidado); resto → su username. `DashboardService` overloads con `username`: filtro en el conteo de conversaciones Y en la resolución de IDs (mensajes/tokens quedan acotados por las conversaciones del usuario). `cron-runs`/`cron-runs/{id}` → `@RequireGlobalAdmin` (403 a miembros).
- **Frontend**: `Dashboard.vue` — `isAdminRole` (localStorage role, patrón MainLayout) oculta tarjeta de modelos y tabla de cron; los fetch de esos endpoints son condicionales (evita el 403 tumbando el Promise.all).
- **Tests**: `DashboardServiceUserScopedTest` (4 casos; patrón initTableInfo del repo). 10/10 del área OK. UI: solo los 4 archivos de fallos preexistentes conocidos.

### Verificación en vivo
- Usuario temporal `testdashboard` (member, ws 1): overview **0/0/0** (no ve el consolidado: 3 conv/37 msgs/3.2M tokens de admin), cron-runs **403**, trend 200. Admin: consolidado + cron 200. Usuario temporal eliminado (BD limpia).

### Pendiente anotado
- `Ajustes → Uso de Tokens` (`TokenUsageService.getSummary`) sigue global (sin filtro usuario/workspace) — acotarlo si se quiere (mismo patrón).

## ✅ Sesión 9ª-e (2026-08-27) — Fix gráficas en Telegram + tablas en celular

### Bugs detectados en pruebas reales del usuario
1. **La gráfica no llegaba**: el mensaje mostraba `!graficaidentificacionbarras.png` (resto de un link de imagen markdown) sin foto. Causa: `renderAndSend` hacía `scrub(unwrapGeneratedLinks(content))` — el unwrap eliminaba la URL generada ANTES de que el scrubber extrajera los bytes → attachments vacíos; y el `!` del link de imagen quedaba pegado al label.
2. **Tabla ilegible en pantalla pequeña**: bloque monospace de 42+ chars desbordaba el celular.
3. **Loop del agente al re-pedir la gráfica**: intentaba localizar el archivo en el workspace, matplotlib (no instalado), PIL (no), rutas físicas (bloqueadas), regenerar con Python puro… — creía que la URL no era suficiente.

### Fixes
- **Orden corregido**: scrub PRIMERO (extrae bytes de las URLs generadas, reemplaza URL → 📎 archivo), luego `cleanScrubbedLinks` (nuevo, reemplaza a `unwrapGeneratedLinks`): `[label](📎 archivo)`/`![label](📎 archivo)` → `label`; `[label](⚠️ aviso)` → aviso legible.
- **`MarkdownTableFormatter`**: celdas truncadas a 16 chars de ancho visual (code points; emojis/CJK = 2); si la tabla supera 34 chars → viñetas `• etiqueta: valor · valor` (legible en celular).
- **Anti-loop**: `CHART_DELIVERY_BLOCK` + prompt BD del Asistente General: incluir la URL es suficiente (la plataforma la entrega como imagen nativa); nunca localizar/reenviar/adjuntar/regenerar el archivo.

### Verificación
- 24/24 tests OK (`cleanScrubbedLinks` 4 casos nuevos; formatter bullets/truncado 2 casos).
- Desplegado; canal activo. Pendiente: confirmación del usuario con una gráfica nueva desde Telegram.

### Notas
- La tabla ancha del usuario (columna "Tipo" de 40 chars) ahora colapsa a viñetas; tablas angostas siguen en monospace.
- Conversaciones de prueba previas (chart-test-*) en BD.

## ✅ Sesión 9ª-d (2026-08-27) — Tablas markdown en Telegram COMPLETADO y desplegado

### Problema
- Telegram no soporta tablas markdown (ni Markdown legacy ni MarkdownV2): las respuestas con tablas (muy comunes: datos de BD, menús, comparativas) llegaban desalineadas o como texto plano con pipes.

### Fix
- **`MarkdownTableFormatter`** (nuevo, `channel/media/MarkdownTableFormatter.java` — reutilizable por otros canales IM): detecta runs de tabla markdown de forma conservadora (línea `|` + segunda línea separador `|---|---|` con `-`/`:`); convierte a bloque ```code fence``` monospace con columnas alineadas al ancho máximo, marcado inline de celdas limpiado (`**bold**` → bold, `` `code` `` → code, `[label](url)` → label, `_itálica_` → itálica), pipes escapados `\|` respetados, separador visual header/cuerpo. Prosa con pipes sueltos sin separador: intacta.
- Conectado en `TelegramChannelAdapter.sendMessage` + `sendThreadedText` (punto único de salida de texto → cubre replies, envíos proactivos y narraciones).
- Tests: `MarkdownTableFormatterTest` 9 casos (básica, padding multi-columna, inline stripping, pipe escapado, passthrough, multi-tabla, null/vacío, separador con alineación) — 21/21 del área OK.
- Desplegado + verificado: salida real con la tabla de la conversación (ej. distribución RUC/Cédula) → bloque alineado. Canal Long-Polling activo.

### Nota
- Otros canales IM sin soporte de tablas (qq/slack/discord/weixin) pueden reutilizar `MarkdownTableFormatter` — pendiente opcional.

## ✅ Sesión 9ª-c (2026-08-27) — Gráficas en Telegram COMPLETADO y desplegado

### Problema (doble)
1. El agente pedido "gráfica" respondía "la gráfica se renderiza automáticamente arriba" **sin generar nada** — el link markdown a `/api/v1/files/generated/{id}` solo lo renderiza la web; Telegram no renderiza nada automático (y la URL `127.0.0.1:18080` es inalcanzable para el usuario).
2. Aun si generaba la imagen, el adapter de Telegram solo mandaba texto: el link quedaba como texto plano.

### Fix
- **`AgentGraphBuilder.CHART_DELIVERY_BLOCK`** (system prompt, todos los agentes): si el usuario pide gráfica/visualización → GENERAR imagen (html_image_render: SVG o Chart.js) e incluir la URL; NUNCA afirmar que "se renderiza arriba".
- **Prompt del Asistente General (BD)**: misma guía en su system_prompt (DB-side).
- **`TelegramChannelAdapter.renderAndSend` override** (V902): (1) `unwrapGeneratedLinks` desenvuelve `[label](url-generada)` → `label` (el scrubber dejaría un markdown inválido), (2) `GeneratedFileScrubber` (ya usado por WeCom/Feishu/DingTalk, Telegram no lo tenía) reemplaza la URL por 📎 archivo y devuelve bytes, (3) `sendTelegramMediaBytes` sube los bytes como `sendPhoto`/`sendDocument` nativo (multipart). `GeneratedFileScrubber` inyectado desde `ChannelManager`.

### Verificación
- API stream (conversación chart-test-telegram-2): el agente llamó `render_html_image` y generó `pie_tipo_identificacion.png` (1800×1200) ✅ — con la guía nueva ya no alucina.
- Upload multipart real al chat de Telegram con los bytes de la PNG: `ok:true, message_id 37` ✅.
- Tests: `unwrapGeneratedLinks` 3 casos (en TelegramVoiceTranscriptionTest) → 23/23 del área OK.
- Desplegado: imagen + `up -d` (canal Long-Polling activo).

### Notas / pendientes
- El renderer web de la UI muestra la imagen por el link markdown; Telegram ahora recibe foto nativa + texto con 📎 archivo.
- Si se quiere, el mismo patrón de scrub aplica a otros canales IM que no lo tengan (qq/slack/discord/weixin — verificar cada adapter).
- Conversaciones de prueba en BD: chart-test-telegram-1/2 (borrables).

## ✅ Sesión 9ª-b (2026-08-27) — Voz en Telegram (V902) COMPLETADO y desplegado

### Problema
- El adapter de Telegram recibía las notas de voz pero nunca las descargaba ni transcribía: el LLM solo veía `[语音]` y respondía "no hay transcripción disponible" (inventado por el modelo, no error del sistema).

### Solución
- **`TelegramChannelAdapter`**: constructor + `SttService` (inyectado desde `ChannelManager`, que ya lo tenía para Feishu); bloque de voz ahora descarga (`getFile` → `file_path` → bytes vía `fileBaseUrl`) y transcribe (`transcribeVoiceNote`, espejo de Feishu, best-effort); el texto se inyecta como parte de texto + `textContent`. Fallo de STT → placeholder legacy `[语音]`, el mensaje nunca se bloquea.
- `ChannelManager`: 1 línea para pasar `sttService`.
- Tests: `TelegramVoiceTranscriptionTest` (6 casos: sin STT, descarga null/vacía, éxito, fallo proveedor, texto vacío) + `SingleLeaderHookTest` actualizado (5 call sites con null). 43/43 OK.

### Verificación (sin esperar al usuario)
- STT ya estaba habilitado en BD (sttEnabled=true, provider openai, whisper-1).
- Con el voice note viejo (file_id de la BD): descarga real por la API de Telegram (95 KB Ogg/Opus) + transcripción whisper-1 → **"Revisa por favor si este audio lo puedes analizar."** (el audio que el usuario mandó el 26/8).
- Desplegado: imagen Docker + `up -d`. Nota: el contenedor nuevo tardó ~30s en adquirir el lease de líder ShedLock del canal (follower → retry 30s → leader OK, Long-Polling activo).

### Pendientes
- **Probar con una nota de voz NUEVA desde Telegram** (el flujo automático completo).
- STT local gratis (whisper.cpp en Docker) cuando se quiera dejar de usar whisper-1 de pago: el transporte ya es OpenAI-compatible (solo crear provider row con baseUrl local + require_api_key=false + apuntar sttOpenAiCompatProviderId).
- Nota: la conversación de prueba tiene 2 mensajes de error del LLM sobre la voz (históricos, se quedan).

## ✅ Sesión 9ª (2026-08-27) — Canales individuales (V901) COMPLETADO y desplegado

### Problema reportado
- El chat de pruebas por Telegram (bot @auraclaw_test_bot) aparecía en el sidebar de **todos** los usuarios de AuraClaw.

### Causa raíz (código base upstream)
- `ConversationService.getOrCreateSharedConversation` crea las conversaciones de canales IM con `username='system'` y **fuerza** `system` en cada mensaje entrante (bloque de corrección de owner).
- `applyOwnerScope` (lista del sidebar) muestra a cada usuario sus conversaciones + las de `system` → los canales IM son visibles para todo el workspace por diseño upstream.
- `mate_channel` no tenía columna de dueño (no existe `created_by`).

### Fix (V901, zonas aisladas)
- **Migración V901** (h2/kingbase/mysql): `mate_channel.owner_username VARCHAR(64) NULL` — NULL = compartido/legacy, valor = canal individual.
- `ChannelController.create`: captura `Authentication` → owner autoritativo; `update`: preserva el owner existente (nunca sobrescribe).
- `ConversationService.getOrCreateSharedConversation` 6-arg con `ownerUsername`: insert con owner, y el bloque de corrección respeta el owner **sticky** (no revierte a `system`). NULL/blank → comportamiento upstream intacto.
- `ChannelMessageRouter`: los 2 call sites de canal (proceso normal + magic command `/model`) pasan `channelEntity.getOwnerUsername()`.
- Visibilidad resultante: solo el dueño ve sus conversaciones de canal (`applyOwnerScope` ya filtra por username); admins globales siguen viendo todo (`isConversationOwner`); otros miembros del workspace ni las listan.

### Tests
- Nuevo `ConversationServiceChannelOwnerTest` (6 casos: insert con owner, legacy system, blank=null, corrección system→owner, sticky sin update espurio, reversión a system si el canal deja de tener owner).
- Mocks de `ChannelMagicCommandTest` + `ChannelMessageRouterInboundDedupTest` actualizados a la firma 6-arg (filtro de invocaciones `length==6`).
- 46/46 tests del área OK.

### Backfill + verificación en vivo
- Owner del canal asignado según audit (`CREATE CHANNEL` por admin): `UPDATE mate_channel SET owner_username='admin' WHERE id=2092623667826462721` + conversación `telegram:2092623667826462721:1989192375` → `username='admin'`.
- Imagen Docker reconstruida + `docker compose up -d` (migración V901 aplicada, 1 migración, server OK).
- Verificado: admin ve la conversación de Telegram; ebermeo (usuario normal) NO (solo `tasks_*` de cron) — simulación exacta del query de `applyOwnerScope`.

### Pendientes opcionales
- Canales creados ANTES de V901 quedan sin owner (compartidos): asignar owner por SQL o recrearlos para hacerlos individuales.
- Si se quiere transferencia de canal: endpoint/UI para cambiar `owner_username` (hoy solo se preserva, no se transfiere).
- Los `tasks_*` (cron) y `webchat:*` siguen con su visibilidad previa (system / solo admins).

---

## ✅ Avances de esta sesión (todo commiteado y desplegado)

### 1. Infraestructura git
- Fork privado `auracore-sas/auraclaw` creado; llave SSH `auracore-sas-pvalarezo` configurada
- Remotes: `origin` = fork (alias SSH `github.com-auracore-sas`) · `upstream` = mateaix/mateclaw
- Rama `main` = línea comercial desde tag **v2.1.0**; `dev` = solo referencia
- Estrategia de sync documentada en `docs/CUSTOMIZATIONS.md` (merge de tags, nunca rebase, nunca "Sync fork")
- `git rerere` habilitado

### 2. Branding AuraClaw
- README renombrado + aviso de fork; `docs/CUSTOMIZATIONS.md` (registro de personalizaciones)
- Logo: binarios reemplazados **en su lugar** (nombres originales conservados, por decisión del usuario — cero conflictos de fuentes); maestra en `assets/branding/auraclaw.png`
- Desktop: `branding.config.json` → AuraClaw, appId `com.auracore.auraclaw`
- **Agentes se identifican como AuraClaw**: bloque `ABOUT_YOU_BLOCK` (AgentGraphBuilder), tarjetas DingTalk, User-Agent Discord, prompts de workflows traducidos
- Mensajes de sistema del chat en español (failover, timeouts, truncados, errores)

### 3. i18n español (es-ES)
- `mateclaw-ui/src/i18n/locales/es-ES.ts`: **3,825 strings traducidos** (español general neutro, tú informal)
- Integración: default `es-ES` (UI + servidor), Element Plus es, selector de idioma, tipos TS
- **~196 strings chinos hardcodeados traducidos** (Enterprise 110, Objetivos, Login, Wiki, configs de canales, composables)
- Quedan 68 líneas visibles intencionales: marcadores de protocolo (`[错误]`, `[任务指令]`, `来源：`, `## 自定义`), regex de clasificación de errores del servidor, ramas zh-CN

### 4. Datos semilla en español
- Seeds nuevos: `data-es.sql`, `data-kingbase-es.sql`, `data-mysql-es.sql` (agentes, tools, skills, cron, settings, MCP, archivos de memoria, AGENTS.md)
- `DatabaseBootstrapRunner` con rama `es-ES`
- BD viva actualizada con UPDATEs quirúrgicos (no recargar seeds en BD existente — regla documentada)

### 5. Documentación
- `docs/es/` creado con **6 documentos traducidos**: index (home), quickstart, intro, user-guide, doctor, operational-export
- Soporte `es` en `DocController` y `MateClawDocService` (VALID_LANG + etiquetas de grupo en español)

### 6. Entorno de desarrollo (híbrido)
- Docker = infraestructura (postgres 16 → 127.0.0.1:5435, searxng → 127.0.0.1:8088) — `docker-compose.override.yml` (gitignoreado)
- Servidor dev: `nohup /tmp/launch-mateclaw.sh > /tmp/mateclaw-server.log 2>&1 &` (JDK 21, profile postgres, filtra vars vacías del .env)
- UI dev: `nohup /tmp/launch-ui.sh > /tmp/mateclaw-ui.log 2>&1 &` → http://localhost:5174
- Stack Docker completo: `docker compose up -d --build` → http://localhost:18080 (admin/admin123, idioma es-ES)

### 7. Limpieza Docker (sesión de soporte)
- 242 contenedores → 5; ~55GB liberados (testcontainers huérfanos, imágenes colgantes, volúmenes anónimos)
- Ojo: las suites de tests de otros proyectos (Quarkus Testcontainers) regeneran huérfanos; limpiar periódicamente

---

## ✅ P1 COMPLETADO — Documentación en español (2026-08-21)

**Los 34 archivos pendientes de `docs/en/*.md` → `docs/es/` están traducidos.** Ahora `es/` tiene los mismos 40 slugs que `en/` (~860KB). Commits:
- `c27aaae9` Fase 2 (chat, agents, memory, wiki)
- `8fd171ce` Fase 3 (models, tools, skills, channels, webchat)
- `af0c1e22` Fase 4 (security, mcp, console, config, workspaces, triggers, workflow)
- `645376e9` / `8831a310` / `bf02c675` Fase 5 (api, architecture, docker-deploy, desktop, acp, multimodal, model3d, teams, goals, content-studio, wecom-tuning, ambient-ai, backstage, faq, releases, roadmap, contributing, openapi)

Notas de la traducción:
- Convención: español neutro (latinoamérica, tú informal), mismos slugs, `./slug` relativo, frontmatter conservado solo donde existía layout VitePress (index/intro/agents/…) con `title`/`description`/`keywords` traducidos
- Anclas `#slug`: solo se conservaron las que apuntan a headers que quedaron en inglés (`#llm-wiki`, `#nano-banana`, `#feishu-lark`, `#trust-error-translation`); el resto se quitó (los headers traducidos generan anclas distintas)
- Términos técnicos sin traducir: ReAct, Plan-and-Execute, Tool Guard, workspace(s), sidecar, streaming, prompts, seeds…
- Marcadores de protocolo chinos (`[错误]`, `来源：`, `## 自定义`, regex) preservados donde el sistema los parsea
- `es/doctor.md` (sesión anterior) servía de patrón de estilo

---

## ✅ P4/P5 COMPLETADO — Marcadores de protocolo + Prompts LLM en español (2026-08-21)

**Marcadores de protocolo (P5):** la emisión ahora es en español (`[Error]`, `Fuentes:`, `[Pendiente de aprobación]`, `[Instrucción de tarea]`, `[Resumen de observaciones de herramientas]`) con **parsing bilingüe** (chino legacy + español) en backend y frontend, para no romper BD histórica ni streams en vuelo. Templates de error LLM y `DelegateAgentTool` en español.

**Prompts (P4):** los **60/60 `.txt`** de `prompts/` traducidos al español (o ya neutros en inglés). Contratos preservados: schemas JSON, reglas `[[slug]]`, formato FILE-block, frontmatter YAML, placeholders, marcadores literales (los caracteres chinos restantes son ejemplos de slug o marcadores inyectados por el sistema).

**Commits:** `60ecc2a9` (marcadores + frontend + prompts graph/context/memory) · `10649a45` (prompts wiki/skill/research) · docs de registro en `c6488fbe`.

**✅ Pruebas de regresión realizadas (server dev contra postgres real con DeepSeek):**
- Chat normal (prompts `graph/`) → respuesta correcta en español
- Failover multi-proveedor (gpt-4o/ollama → deepseek) + warnings en español
- Wiki digest (prompts `wiki/`) → 6 páginas generadas, links `[[slug]]` reconciliados, 0 rotos
- Memoria del agente (prompts `memory/` + herramientas) → lee/escribe correctamente
- Cron `run now` → Success 200 (marcador `[Instrucción de tarea]` bilingüe)
- Marcador `[Error]`: cubierto por tests unitarios (`ChannelErrorClassifierTest`); flujo real emite warnings de error en español
- Tests del área verdes (SourceEvidenceLedger, ChannelErrorClassifier, ErrorClassification, aprobación) — `SourceEvidenceLedgerTest` ajustado al header `Fuentes:`

**Imagen Docker reconstruida** con el código actualizado (el contenedor Docker viejo no tenía los cambios; reconstruir con `docker compose build mateclaw-server` + `up -d`, tarda ~2-3 min con caché del mvn host).

---

## ✅ Matiz de memoria corregido — agente escribía su propio nombre en PROFILE.md (2026-08-21)

**Síntoma:** al pedirle *"recuerda que me llamo Juan…"* el agente escribía `AuraClaw Assistant` (su nombre) en `PROFILE.md` en lugar de los datos del usuario.

**Causa raíz:** la plantilla `PROFILE.md` tenía una sección `## Identidad` con `Nombre/Rol/Estilo` sin aclarar que se refiere al **usuario**; combinada con el `ABOUT_YOU_BLOCK` del system prompt ("eres AuraClaw"), el agente la interpretó como SU identidad. No era bug de los prompts memory (AGENTS.md/prompts estaban bien).

**Corrección:** fusioné la sección en `## Perfil del Usuario` con la nota `> Este archivo describe al USUARIO… No registres aquí la identidad, rol ni estilo del agente.` Aplicada a los **9 seeds** (`es/en/zh` × data/kingbase/mysql) y a la **BD viva** (5 filas via UPDATE).

**Verificado:** ahora el agente registra al usuario vía `remember_structured` (`{"type":"user","key":"identidad_juan","content":"Nombre: Juan. Trabaja en finanzas. Prefiere respuestas concisas"}`).

**Commits:** `1eb098b6` (seeds es + docs) · `e5e1c3fb` (seeds en/zh).

## ✅ P2 COMPLETADO — Concentrador de modelos OmniRoute (2026-08-21)

**Configurado por el usuario en la UI (Ajustes → Modelos):** provider `omniroute` (custom, OpenAI-compatible, discovery + connection check habilitados) apuntando a su gateway OmniRoute; modelo `openrouter/stealth/ox-alpha` habilitado como default del agente. El routing/failback por contexto (contexto agotado → siguiente modelo, combos, circuit breakers) lo gestiona **OmniRoute** (gateway self-hosted, un solo endpoint OpenAI-compatible); AuraClaw solo necesita el provider `openai-compatible` — el failover propio de AuraClaw queda como respaldo si el gateway cae.

⚠️ **Nota operativa — `chat_admission_busy` (503):** es un error PROPIO de OmniRoute (backpressure local, antes del routing): desde v3.8.49 su "structure-aware chat admission" limita a **1 petición pesada concurrente** (`OMNIROUTE_CHAT_MAX_HEAVY_IN_FLIGHT=1`); si dos agentes/contextos largos se solapan → 503 con `code=chat_admission_busy`, `Retry-After`, y el cliente (pi, AuraClaw, etc.) reintenta y puede agotar intentos. Regresión conocida 3.8.48→3.8.49 (issue #10183). Soluciones: subir `OMNIROUTE_CHAT_MAX_HEAVY_IN_FLIGHT=2` (reiniciar gateway), bajar a 3.8.48, o esperar la versión con cola acotada (#9176).

## ✅ P4/P5 residuales COMPLETADOS — Verificación visual en UI (2026-08-21)

**Verificación en browser real (Playwright + google-chrome headless, login admin, conversación de prueba `test-error-p45` con datos sintéticos en BD dev):**

| Check | Resultado |
|---|---|
| `[Error]` español persistido (status failed) | ✅ Tarjeta de error (".Falló la autenticación del modelo"), sin texto crudo duplicado |
| `[错误]` legacy persistido (status failed) | ✅ Tarjeta de error, sin texto crudo (comportamiento legacy preservado) |
| `[Pendiente de aprobación]` (status awaiting_approval) | ✅ Stub oculto, sin texto crudo (la tarjeta de aprobación solo vive en flujos en vivo) |
| `**Fuentes:**` y `来源：` con citas `[n]` | ✅ Ambos headers renderizan como markdown |
| `[Instrucción de tarea]` en goal de plan | ✅ Limpio en PlanBoard (muestra solo la instrucción) |

**3 fixes aplicados en frontend (parsing bilingüe, ver CUSTOMIZATIONS.md):**
- `MessageBubble.vue`: `displayContent` ahora oculta también `[Error]` (solo ocultaba `[错误]` legacy → texto duplicado con tarjeta de error en español); `errorDescription` limpia el prefijo `[Error]`; `isApprovalPlaceholder` incluye `[Pendiente de aprobación]` y el stub legacy `[本次没有输出]`
- `PlanDetailPanel.vue` + `PlanBoard.vue`: `cleanGoal` ahora limpia `[Instrucción de tarea]` además de `[任务指令]` (espejo del scrubber bilingüe del backend `PlanGenerationNode.displayGoal`)

**Validación:** `vue-tsc --noEmit` OK; tests UI: **306 pass / 8 fail preexistentes** (product-cards/streaming/team-run, sin regresiones). Dato de entorno: la verificación por Orca computer-use no fue posible (falta `gir1.2-atspi-2.0` en el sistema, requiere sudo); se usó Playwright con `google-chrome` como executable.

---

## ✅ P3 COMPLETADO — Fallback docs es→en (2026-08-21)

**Implementado en `MateClawDocService`:**
- `read(lang, slug)`: si el slug no existe en `es/`, sirve la versión de `en/` (robustez para docs nuevos del upstream sin traducción inmediata)
- `list(lang)`: para `es`, los slugs que solo existen en `en/` se listan al final (grupo «Más») con `fallback=true`; la UI muestra un badge **EN** junto al título (`DocMeta.fallback` en `api/index.ts` + `docs-nav__badge` en `Docs/index.vue`)
- Tests: `MateClawDocServiceTest` (6 tests, fixtures en `src/test/resources/docs/{en,es}/zz-*.md`) — verdes
- Verificado en vivo: `GET /docs?lang=es` → 39 slugs (40 archivos − index), fallback=0; slug inexistente → 404 limpio

**Hallazgo colateral:** `a2a.md` / `deepseek-harness.md` existían como artefactos stale en `target/classes/docs/{en,zh}/` (no están en git ni en `src/` — residuo de un build anterior). El fallback los listó como docs en inglés; un `mvn clean install` los purgó. Los 40 docs reales de `es/` están todos traducidos (P1).

## ✅ P7 COMPLETADO — Inmersión en el código (CODE_MAP) (2026-08-21)

**Nuevo entregable: `docs/CODE_MAP.md`** (raíz `docs/`, en español, ~310 líneas) — mapa guiado de los 7 módulos del núcleo, a nivel operativo (capa que **complementa** `architecture.md`, que es la vista de 30.000 pies). Todo verificado recorriendo el código, no copiado de docs.

**Contenido por módulo:** responsabilidad · árbol de paquetes · flujo de una petición · decisiones clave · tabla «Qué quiero → Dónde voy» · gotchas reales del fork.

| Módulo | Esencia destacable | Vía de personalización |
|---|---|---|
| 1 · Runtime de agentes | `AgentGraphBuilder` ensambla el StateGraph (ReAct vs Plan-and-Execute según `agent_type`); nodos/aristas = **superficie caliente** de conflictos | Preferir `@Tool` antes que tocar el grafo |
| 2 · Memoria + workspace | SPI `MemoryProvider` (ficheros PROFILE.md/MEMORY.md, tipada, facts) + `MemoryLifecycleMediator` (prefetch/sync por turno, non-blocking) | Implementar `MemoryProvider` en `com.auracore.*` |
| 3 · Tools | `ToolRegistry` descubre beans `@Tool` (auto-disponibles); filtro build-time (disclosure ties + recencia) vs **Tool Guard** call-time | **Un bean `@Tool` = LA vía estándar de extender** |
| 4 · Wiki | Pipeline de digestión (LLM/skill) → páginas `[[slug]]` + citas → hot cache → snippets; reconciliación de links en background | — |
| 5 · Canales IM | SPI `ChannelAdapter` (start/stop/onMessage/sendMessage, proactividad, tarjetas) | Implementar adapter = canal nuevo |
| 6 · Seguridad/aprob/audit | `AuthService` JWT/RBAC (+PAT, SSO); `approval` con marcador bilingüe; `audit` trail | ⚠️ clave JWT por defecto es de DEV (sobrescribir en prod) |
| 7 · Workflow/trigger/cron/acp/plugin | DSL Pebble (subconjunto validado + ACL), triggers→workflow, **ShedLock** (cron multi-instancia), puente ACP (Claude Code/Codex), plugins (SDK) | `StepAdapter` nuevo = paso nuevo del DSL |

**Hallazgos útiles para el fork:** `SourceEvidenceLedger` (M1) alimenta las citas `Fuentes:` del frontend ·
`RoleCapabilities` es autoritativa (**no hay copia local** de la tabla de roles) · el código «nueva tool =
auto-disponible» explica por qué importa la config de disclosure/guard · marcadores bilingües viven en
`ApprovalPlaceholderUtil` (backend) + `MessageBubble` (frontend).

**Commits:** `docs(codemap): ...` (P7) — ver log de la sesión.

## ✅ V900 COMPLETADO — Uso de modelos por propósito (`usage_scope`) (2026-08-21)

**Feature de aislamiento de modelos** (respuesta a: "¿puedo dedicar un LLM caro al wiki sin que el chat lo use, y que sirva para varias funcionalidades?").

**Semántica:** `usage_scope` = JSON array de usos (`["chat"]`, `["wiki"]`, `["chat","wiki"]`…). NULL/vacío → legacy chat-usable. Sin `"chat"` → modelo dedicado a tareas internas: el chat normal **nunca** lo usa, pero el wiki sí (por id). **Un mismo LLM puede tener varios usos** (p. ej. `["chat","wiki"]`); `modelType` sigue siendo la categoría base (chat/embedding), el multi-propósito va por `usage_scope`.

**Implementado (ver CUSTOMIZATIONS.md para el registro completo):**
- Migración `V900__model_usage_scope.sql` (3 dialectos; **primera V900 nuestra**)
- `ModelConfigService.isChatUsable()` + filtros en: `listEnabledModels`, `getDefaultModel`, `resolveModel`, `getDefaultModelByProvider`, `getPrimaryChatModelByProvider` (fail-open ante scope inválido)
- `AgentGraphBuilder`: failover (`pickFallbackModel`, `findFirstAvailableChatModel`) nunca cae en un modelo dedicado
- DTO `ModelInfoDTO` expone `usageScope` + `chatEligible`; endpoint `PUT /models/{providerId}/models/usage-scope`
- UI `ManageModelsModal.vue`: badges de uso + editor inline (checkboxes Chat/Wiki) + i18n 3 idiomas
- Wiki **sin cambios**: usa `getModel(id)` (ignora usage) y su fallback interno sigue aceptando modelos dedicados

**Validación:** compile OK · `vue-tsc --noEmit` OK · **49 tests verdes** (12 nuevos `ModelConfigServiceUsageScopeTest` + 37 existentes del área). ⚠️ `AgentGraphBuilderIdentityBlockTest` falla preexistente (branding: espera "MateClaw", emite "AuraClaw") — no es regresión de esta feature.

**Pendiente de producto (tras esto):** configurar en UI un proveedor dedicado (p. ej. oficial no-enrutable) con el LLM caro `usage=[wiki]` (u otros usos) + modelo de embeddings, y enlazarlo como `wikiDefaultModelId` de las KBs.

---

## ✅ Sesión 6ª (2026-08-21) — Cierre de leaks V900 + despliegue + plan Wiki

**Descubierto y corregido:** el modelo dedicado (nemotron `usage=["wiki"]`) seguía disponible en el chat por **3 vías residuales**:
1. **Selector de chat (UI)**: `ModelSelector` mostraba todos los models del provider (`listProviders()`), sin filtrar `chatEligible` → fix: filtra `chatEligible === false`
2. **Pin de conversación (backend)**: `ConversationController.setModel` guardaba el pin sin validar y `resolveRuntimeBaseModel`→`findEnabledModel` lo respetaba sin filtrar (el chat EJECUTABA con el modelo dedicado) → fix: rechazo 400 al pinear + `findEnabledModel` filtra `isChatUsable` (pins viejos degradan silenciosamente al default)
3. **Default**: `setDefaultModel` (ambos overloads) permitía marcar un dedicado como default → fix: rechazo

**Verificado en vivo (stack Docker reconstruido):** pin al nemotron → 400 con mensaje claro · pin a deepseek-v4-flash → 200 · nemotron ya no aparece en el selector de chat (confirmado por el usuario) · pins residuales limpiados en BD (2 conversaciones).

**Validación:** compile OK · 25 tests ModelConfigService verdes · `vue-tsc` limpio · commit `cc0c9e86`.

**Plan de configuración Wiki creado:** `docs/WIKI_MODEL_SETUP.md` — proveedor dedicado recomendado **DashScope** (qwen-max digestión + text-embedding-v3 embeddings, una sola API key, soporte nativo, seeds ya en BD), con pasos exactos (contratar key → marcar `usage=["wiki"]` → embedding default → config KBs → verificación). Alternativas: DeepSeek v4-pro + Ollama local (cero contratos) o premium (overkill).

---

## ✅ Sesión 7ª (2026-08-24) — Postgres del host desde Docker + pipeline de datos de BD

### Contexto
El usuario necesitaba que AuraClaw (Docker) consultara su **Postgres local del host** (9.6, puerto 5432). Bloqueo: Postgres solo escuchaba en `127.0.0.1` (loopback) → inalcanzable desde el contenedor.

### Cambios de infraestructura (host, NO en git — requirieron sudo del usuario)
- `/etc/postgresql/9.6/main/postgresql.conf`: `listen_addresses = '*'` (antes solo localhost) — ejecutado por el usuario con sudo
- `/etc/postgresql/9.6/main/pg_hba.conf`: añadida `host all all 172.25.0.0/16 md5` (subnet del bridge Docker) + restart
- **Detalle clave (trampa)**: desde el HOST, `psql` hacia `172.25.0.1` sale con IP origen `192.168.86.35` (LAN) que NO matchea la regla → verificar desde `127.0.0.1` (host) o desde dentro del contenedor (`172.25.0.3`)
- IP del host vista desde el contenedor: `172.25.0.1` = gateway de `mateclaw-net`. `host.docker.internal` **NO resuelve** en Linux sin `extra_hosts`

### Cambios de entorno dev (gitignoreados a propósito — NO commitear)
- `.env`: `MATECLAW_TOOL_SCHEMA_MAX_TOKENS=40000` + `MATECLAW_TOOL_SCHEMA_RATIO=0.30`
- `docker-compose.override.yml`: passthrough de ambas vars a `mateclaw-server`
  - Presupuesto de disclosure = `min(ratio × ventana, maxTokens)`. Con gpt-4o (128k) y ratio 0.25 → 32000 < 32583 (schema total) → se degradaban tools. Con ratio 0.30 + tope 40000 → 38400 → **0 degradaciones** (verificado en log)
  - Si se quiere persistir en el repo: exponer las vars en `docker-compose.yml` (commiteado)

### Cambios DB-side (BD del stack Docker — NO git)
- **Datasource creado**: "Postgres local (powerfin_test)" — id `2091706457220833281`, dbType postgresql, host `172.25.0.1`, puerto `5432`, db `powerfin_test`, schema `auracore`, user `postgres` / `1234abcd`, test OK
- **System prompt Asistente General (1000000001)** actualizado (642 chars): guía de datos — `query_datasource` SOLO para descubrir; `execute_sql` para SELECT de datos; no responder con estructura
- **Modelo default**: `deepseek/deepseek-v4-flash` (row id `1000000282`, `usage_scope=["chat","wiki"]`, chatEligible) — reemplaza a `omniroute/openai/gpt-4o`

### Problemas encontrados y resueltos
1. **Red Docker→host**: contenedor no ve loopback del host → `listen_addresses='*'` + pg_hba para subnet Docker + usar IP del gateway del bridge
2. **Progressive disclosure**: `execute_sql`/`query_datasource` degradadas al catálogo "Extension Tools" (75 tools, schema 32583 > presupuesto 12000) → el modelo no veía sus schemas y las usaba mal. Fix: subir presupuesto
3. **El agente describía tablas en vez de consultar datos**: usaba `query_datasource` con acción inexistente `query` o describía columnas. Fix: guía en el system prompt
4. **Lentitud (~2 min/consulta)**: gpt-4o vía OmniRoute devolvía respuestas vacías seguido (12 `EMPTY_RESPONSE`/hora, cada retry +30-60s, `failover_count=0`). Fix: default → `deepseek-v4-flash` (ventana 1M, 0 vacíos, pasos LLM 2-6s)

### Verificación final (2026-08-24)
- Conexión JDBC: `success: true` ✅ · `SELECT COUNT(*) FROM auracore.person` → **23** ✅
- `account_bank` (1 registro: `27059108040` / `ENT_FIN011` / `AHO`) ✅ · GROUP BY identificación: **22 RUC + 1 cédula** ✅ (verificado independientemente con psql)
- El agente auto-descubre: `list_datasources` → `list_tables` → `describe_table` → `execute_sql`; usa JOIN correcto, distingue schemas, cita `Fuentes:`

### Commits de esta sesión
- `a583b6bd` docs: rebrand MateClaw → AuraClaw across served documentation (en/zh/es) — 86 archivos servidos por `readMateClawDoc`; refs técnicas en minúscula (`MATECLAW_`, `mateclaw-`, paths) preservadas (regla 5)
- `bd836980` docs: record session 7 — Postgres host desde Docker, pipeline de datos BD, modelo default deepseek-v4-flash
- `fc4b0600` feat(ui): hide Enterprise demo workbench from nav and routes — módulo `/enterprise` era demo estática sin backend; ocultado del menú (`MainLayout.vue`) y rutas (`router/index.ts`); componentes e i18n quedan en disco sin uso. Registrado en CUSTOMIZATIONS.md

### Limpieza de branding (misma sesión, parte 2)
- **Memoria de agentes en BD** (10 archivos, agents 1000000001/1000000003): `MateClaw` → `AuraClaw` vía UPDATE + re-save por API (dispara `WorkspaceFileChangedEvent` → invalida caché de instancia del agente). **⚠️ OJO:** los UPDATEs por SQL NO invalidan la caché — hay que re-guardar el archivo por la API (`PUT /agents/{id}/workspace/files/**`) o reiniciar
- **Memoria personal** (`structured/*`, scope PERSONAL por owner `user:admin`): no es visible por `/files/**` (solo shared); se inyecta por turno sin caché — el UPDATE SQL basta
- **Docs**: 86 archivos rebrandeado (en/zh/es) + rebuild Docker (los docs viajan en el JAR)
- **Decisión (regla 5):** se conserva el nombre de la tool `readMateClawDoc` (identificador interno; 0 bindings en BD usan el nombre de función; el alias-index de AgentToolSet mapea bean/class). Si en el futuro se quiere erradicar: renombrar método + ref en `AgentBindingService.java:782` + self-ref de la descripción + rebuild
- **Re-aplicación tras merge con upstream:** `sed -i 's/MateClaw/AuraClaw/g'` sobre `mateclaw-server/src/main/resources/docs/` y UPDATEs de memoria (patrón ya en CUSTOMIZATIONS.md)

### Cambios pendientes por commit
- **Ninguno** (git status limpio). Todo lo de esta sesión es: gitignoreado (`.env`, `docker-compose.override.yml`), DB-side (prompt, modelo, datasource) o de sistema (config Postgres del host)

---

## 📌 Pendiente para la siguiente sesión (priorizado)

### De la sesión 7ª (2026-08-24) — datos/Postgres
- **Persistir ajuste de disclosure en el repo (opcional)**: exponer `MATECLAW_TOOL_SCHEMA_MAX_TOKENS` y `MATECLAW_TOOL_SCHEMA_RATIO` en `docker-compose.yml` (hoy viven solo en `.env`/override gitignoreados; un `docker compose up` limpio los pierde)
- **Reversión del modelo (si gpt-4o vuelve a ser necesario)**: `PUT /api/v1/models/active` `{"providerId":"omniroute","model":"openai/gpt-4o"}`; devolver deepseek-v4-flash a wiki-only: `PUT /api/v1/models/deepseek/models/usage-scope` `{"modelId":"deepseek-v4-flash","usageScope":"[\"wiki\"]"}`
- **Verificar wiki** con deepseek-v4-flash como default (quedó scope chat+wiki; la wiki usa `getModel(id)` que ignora scope, debería seguir OK — confirmar en la próxima digestión)
- **El primer intento del agente usó el NOMBRE del datasource como ID** ("Postgres local (powerfin_test)") y falló, auto-corrigiéndose con `list_datasources`. Si se repite, reforzar el prompt con el ID numérico o validar en el tool un lookup por nombre

### Regresiones residuales P4/P5 (opcional, fuera del bloqueo)
- **Pruebas de regresión en más áreas** si se quiere completitud: research (`draft`/`compose`), skill (`synthesize`/`reflect`/`routine`), content-studio, webchat — no se ejercitaron (requieren flujos más largos / canales configurados)
- **Nunca eliminar la variante legacy del parsing** al tocar marcadores de nuevo (ver CUSTOMIZATIONS.md); mantener la tolerancia bilingüe

### P6 — CI/CD (del plan original, ÚNICO pendiente de la Fase 1)
- Pipeline GitHub Actions: build + tests + empaquetado desktop (hoy no existe; validar con `mvn compile` JDK 21 y `vue-tsc --noEmit`)
- Conversación: se acordó dejarlo **para el final** — priorizar producto/features antes que CI

### Futuro (post-P6)
- Regresiones residuales P4/P5 (research `draft`/`compose`, skill, content-studio, webchat) — opcionales, fuera del bloqueo
- Features de producto nuevas sobre la base CODE_MAP (Módulos 1-3) — la inmersión ya deja localizados los puntos de extensión

### Wiki (cuando se contrate la API key — ver `docs/WIKI_MODEL_SETUP.md`)
- Paso 1: API key DashScope → provider configurado
- Paso 2: marcar qwen-max / qwen-turbo `usage=["wiki"]` (UI Ajustes → Modelos → editar Uso)
- Pasos 3-4: `POST /models/embedding/default` (text-embedding-v3) + config KBs (wikiDefaultModelId/wikiLightModelId/stepModels/fallbackModelIds)
- Paso 5: verificación end-to-end (digestión, `Fuentes:` con vectores, aislamiento del chat)

---

## ⚠️ Notas técnicas críticas (leer antes de trabajar)

1. **JDK 21 obligatorio** para el server (Lombok no soporta JDK 25): `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`
2. **`.env` con variables vacías rompe Spring** al correr local (ej. `MATECLAW_SKILL_UPLOAD_MAX_ENTRY_SIZE_MB=`) — filtrarlas o usar `/tmp/launch-mateclaw.sh`. **Ojo:** los scripts `/tmp/launch-mateclaw.sh` y `/tmp/launch-ui.sh` se regeneran en cada sesión (viven en `/tmp`, se borran al reiniciar). El lanzamiento del server dev usa: JDK 21, `SPRING_PROFILES_ACTIVE=postgres`, `DB_HOST=127.0.0.1`, `DB_PORT=5435` (el postgres Docker), puerto 18088, y ejecuta el JAR de `mateclaw-server/target/` (reconstruir antes con `mvn install -DskipTests -pl mateclaw-server`).
3. **Puertos ocupados en la máquina del usuario**: 5432 (PG local 9.6), 5433 (PG 13), 5434 (lucho-db-dev), 5173 (otro proyecto vite) → usar 5435 y 5174
4. **Módulo plugin-api debe instalarse** antes de correr el server local: `mvn install -DskipTests -pl mateclaw-plugin-api` (y el pom padre: `mvn -N install`)
5. **Tests UI**: 8 fallos preexistentes del upstream (product-cards/streaming/team-run) — no son regresiones
6. **Imagen Docker** se reconstruye con `docker compose up -d --build` (~5-10 min); la UI viaja dentro del JAR
7. **No recargar seeds en BD existentes** — aplicar UPDATEs puntuales (ver CUSTOMIZATIONS.md)
8. Trad. de la UI: `es-ES.ts` aditivo; comentarios de código en chino NO se traducen (evita diffs inútiles)
9. **Postgres del host (9.6, puerto 5432)**: escucha en `*` y acepta el subnet Docker `172.25.0.0/16` (md5). IP del host vista desde el contenedor = `172.25.0.1` (gateway de `mateclaw-net`); `host.docker.internal` NO resuelve en Linux sin `extra_hosts`
10. **Herramientas de BD**: `query_datasource` = SOLO metadatos (`list_datasources`/`list_tables`/`describe_table`); `execute_sql` = consultas SELECT reales. El agente necesita guía en el prompt para elegir bien; verificar contra `127.0.0.1` desde el host (el origen LAN `192.168.86.x` no matchea la regla pg_hba)
11. **Credenciales datasource de prueba** (BD local del usuario): `powerfin_test` / `postgres` / `1234abcd`, schema `auracore` — solo dev

---

## ⏸️ Sesión 2026-08-26 (8ª) — trabajo en curso, PARADO a mitad (retomar)

### Contexto de la sesión
- Usuario configuró **OpenAI** en AuraClaw (proveedor `openai` activo con key) + modelo `text-embedding-3-small` + KB de Wiki **"Wetzel's Pretzels"** (raw `wetzel_knowledge.md`, 30KB).
- Se diagnosticó que el Wiki procesaba con DeepSeek (default global) dando "Empty response". Fix aplicado **solo en BD** (no código):
  1. `mate_wiki_knowledge_base.embedding_model_id` = 2092322003645075457 (text-embedding-3-small)
  2. Frontmatter en `config_content` → `wikiDefaultModelId: 1000000116` (GPT-5 Mini)
  3. Reprocesado con `reprocess?force=true` → **completed**: 10 páginas, 3 chunks embeddados, 0 links rotos
- Se cambió el **default global del sistema a GPT-5 Mini** (`POST /api/v1/models/1000000116/default`) → verificado con `GET /api/v1/models/default`. DeepSeek V4 Flash dejó de ser default. Nota: esto también afecta al chat del agente.

### 🐛 BUG DETECTADO (código base upstream v2.1.0, sin commitear todavía)
**GPT-5.x en el chat del agente da 400 de OpenAI**: `Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.` (245 bytes, confirmado).
- Causa: `ReasoningNode.buildChatOptions()` (línea ~1487) siempre usa `.maxTokens(...)` ignorando la familia del modelo. El Wiki sí lo respetaba vía `OpenAiCompatibleChatModelBuilder.buildOpenAiOptions` + `ModelFamily.suppressMaxTokens()`, el chat no.
- Fix aplicado (2 archivos, compila OK — `mvn compile -pl mateclaw-server` BUILD SUCCESS, 2026-08-25T14:46):
  1. `OpenAiRequestRewriter.java` (+62 líneas): nuevo método `translateMaxTokensForGpt5()` — safety net que convierte `max_tokens` → `max_completion_tokens` para modelos `gpt-5*` (patrón copiado de `stripReasoningEffortIfIncompatible`)
  2. `OpenAiCompatibleChatModelBuilder.java` (+2 líneas): llamada al rewriter en `chatCompletionEntity` y `chatCompletionStream`

### ⏭️ Pendientes para la próxima sesión (en orden)
1. **Escribir test unitario** para `translateMaxTokensForGpt5` (casos: gpt-5* con maxTokens → traduce; gpt-4o con maxTokens → no toca; null → no toca). Ya verificado que `OpenAiApi.ChatCompletionRequest` es un Record con builder accesible (javap OK).
2. **`mvn test -pl mateclaw-server -Dtest=...`** para el test nuevo.
3. **Desplegar**: reconstruir imagen Docker (`docker compose build mateclaw-server` / rebuild jar → imagen) y reiniciar el contenedor (el server corre en Docker, puerto host 18080).
4. **Verificación en vivo**: consulta de Wiki con GPT-5 Mini desde la UI → debe responder sin 400 y con citas `[n]` + `Fuentes:`.
5. **Registrar el fix** en `docs/CUSTOMIZATIONS.md` (toca código base) y commit convencional: `fix(llm): translate max_tokens to max_completion_tokens for gpt-5* chat requests` + push a `origin/main`.
6. Opcional pendiente de antes: job viejo de DeepSeek (2092322480327725057) quedó `running` en BD tras cancel — artefacto cosmético, marcar `cancelled` si se quiere BD limpia.

### Datos útiles
- Server: `http://127.0.0.1:18080` (Docker, puerto interno 18088) · login `admin`/`admin123`
- KB Wetzel's Pretzels id=2092322381346344962 · raw id=2092322480180924417
- Modelo default global: 1000000116 (GPT-5 Mini, provider openai) · embedding default: 2092322003645075457
- JWT de admin se guardó en `/tmp/mateclaw_token.txt` (puede caducar)

### ✅ Continuación (misma sesión 8ª) — fix GPT-5 COMPLETADO, desplegado y verificado
- Test unitario creado: `TranslateMaxTokensForGpt5Test` (6 casos: gpt-5* traduce, gpt-4o/deepseek no toca, null no-op, preferencia max_completion_tokens) — **9/9 tests OK** (incluye fix de test roto preexistente `ConversationControllerBatchDeleteTest` que bloqueaba `mvn test`)
- **Desplegado**: `docker compose build mateclaw-server` + `up -d` (imagen nueva, volumen /app/data intacto, 3 proveedores OK al arranque)
- **Verificado en vivo** vía `POST /api/v1/chat/stream` (conversación `gpt5fix-test-1`, agentId 1000000001, modelProvider=openai, modelName=gpt-5-mini):
  - ✅ Sin 400; logs muestran `[GPT-5 compat] model gpt-5-mini carries max_tokens ... translating to max_completion_tokens`
  - ✅ Respuesta correcta con **citas**: `...bebidas frías y calientes [1]` + `Fuentes:\n[1] Productos destacados y precios` (el agente usó `wiki_read_page`)
- Commiteado y pusheado (ver log git). Registrado en `docs/CUSTOMIZATIONS.md` (fila "Fix GPT-5 en chat").
- **Pendientes menores opcionales**: (1) job viejo de DeepSeek 2092322480327725057 sigue `running` en BD tras cancel (cosmético — marcar `cancelled` si se quiere); (2) la conversación de prueba `gpt5fix-test-1` quedó en BD; (3) migrar el `config_content` de la KB Wetzel's Pretzels de frontmatter YAML a JSON puro si se edita desde la UI (los guards de la UI hacen `JSON.parse` — ver sección anterior).

### ✅ Continuación 2 (misma sesión 8ª) — citas de Wiki en system prompt COMPLETADO y desplegado
- **Diagnóstico A/B** (clave): GPT-4o directo (api.openai.com) y GPT-4o vía OmniRoute (omniroute.apx5.com) citan PERFECTAMENTE con instrucción en el system prompt — el router es transparente (mismo modelo `gpt-4o-2024-08-06`) y el modelo obedece. El problema era que la instrucción de citas solo vivía en las descripciones de tools del Wiki (enterrada entre 115 schemas) → GPT-4o la ignoraba; GPT-5.x la sigue igual.
- **Fix desplegado**: `CITATION_FORMAT_BLOCK` en `AgentGraphBuilder.buildEnhancedPrompt` (marcadores `[n]` + sección `Fuentes:` + no citar fuentes no leídas) + hints reforzados en `WikiTool` (`CITATION_FORMAT_HINT` + `citationHint` con ejemplo en español).
- **Verificado en vivo**: gpt-4o vía omniroute → respuesta con `[1]` + `Fuentes:` y SIN aviso `[证据不足]` (conversación `gpt4o-cite-test-2`).
- Commiteado y pusheado (2 commits: fix max_tokens + citas system prompt). Registrado en `CUSTOMIZATIONS.md`.

### ✅ Continuación 3 (misma sesión 8ª) — safety net de citas COMPLETADO y desplegado
- **Problema residual**: con el system prompt, gpt-4o lee la página correcta y responde perfecto, pero el formato de cita es inconsistente: `[1]`+tabla, `[[Título]]`, `[Título](slug)` markdown, o título a secas bajo `Fuentes:` → el validador seguía marcando `missing wiki citation [n]` en los formatos no canónicos.
- **Fix**: `SourceEvidenceLedger.appendWikiSourceTable` completa la tabla canónica `[1] <título>` desde el ledger (páginas REALMENTE leídas en la ronda) cuando la respuesta menciona una página verificada en cualquier formato nativo (wiki-link `[[...]]`, markdown link `[...](...)`, línea cruda bajo `Fuentes:`/`来源：`). Normalización case/accent-insensitive + guiones→espacios (slugs matchean títulos). Índices = los del ledger. El aviso solo queda para menciones NO verificables (alucinación).
- **Tests**: +5 en `SourceEvidenceLedgerTest` (20 total, 0 fallos) + suite completa del área (56 tests OK).
- **Verificado en vivo** (gpt-4o vía omniroute, consulta ubicaciones, conv `gpt4o-ubic-test-3`): respuesta completa (direcciones/horarios/contactos reales) + `Fuentes:\n[1] Ubicaciones y horarios` anexada + **sin aviso** `[证据不足]`.
- Commiteado y pusheado (3 commits: max_tokens, system prompt citas, safety net ledger).
