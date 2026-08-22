# NEXT_SESSION.md — Resumen de la sesión y pendientes

> Documento de contexto para retomar el trabajo en la siguiente sesión.
> Fecha de la sesión: 2026-08-21 · Rama: `main` (base v2.1.0) · Fork: `auracore-sas/auraclaw`
> **Sesión 2026-08-21 (2ª): completados P1 (docs es), P4/P5 (prompts + marcadores), pruebas de regresión, y corrección del matiz de memoria.**
> **Sesión 2026-08-21 (3ª): P2 completado (OmniRoute) + verificación visual P4/P5 con 3 fixes de renderizado bilingüe en frontend.**
> **Sesión 2026-08-21 (4ª): P7 completado (inmersión en el código) → nuevo `docs/CODE_MAP.md` (7 módulos del núcleo mapeados).**
> **Sesión 2026-08-21 (5ª): feature V900 `usage_scope` (modelos por propósito) — dedicar LLMs a trabajos internos (wiki) excluyéndolos del chat normal.**
> **Sesión 2026-08-21 (6ª): cierre de leaks V900 (pin/default/selector) + despliegue Docker + verificación en vivo + plan de configuración Wiki (`docs/WIKI_MODEL_SETUP.md`).**

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

## 📌 Pendiente para la siguiente sesión (priorizado)

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
