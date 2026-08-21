# NEXT_SESSION.md — Resumen de la sesión y pendientes

> Documento de contexto para retomar el trabajo en la siguiente sesión.
> Fecha de la sesión: 2026-08-21 · Rama: `main` (base v2.1.0) · Fork: `auracore-sas/auraclaw`
> **Sesión 2026-08-21 (2ª): completados P1 (docs es), P4/P5 (prompts + marcadores), pruebas de regresión, y corrección del matiz de memoria.**

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

---

## 📌 Pendiente para la siguiente sesión (priorizado)

### P2 — Configuración de modelos del usuario (recomendado)
- El chat solo funciona con **DeepSeek** (único proveedor con clave). Modelos Qwen/GPT habilitados sin clave → errores si se seleccionan
- Opciones: agregar claves (DashScope/OpenAI) en Ajustes → Modelos, o deshabilitar modelos sin clave

### P3 — Fallback docs es→en (opcional, AHORA VIABLE)
- Ya no hay slugs faltantes en `es/`, pero el fallback sigue siendo útil para robustez futura (nuevos docs en `en/` sin traducción inmediata)
- Opción: en `MateClawDocService.read()`, si el slug no existe en `es`, leer de `en` (y quizás listar con un marcador de idioma)

### Residuales P4/P5 (⚠️ pendiente de verificación fina)
- **Verificar en la UI** que los marcadores `Fuentes:`/`[Error]`/`[Pendiente de aprobación]` se renderizan bien (el chat real solo se probó por API/SSE; la renderización en el frontend del chat y la vista de historial de la BD con datos chinos no se validó visualmente)
- **Pruebas de regresión en más áreas** si se quiere completitud: research (`draft`/`compose`), skill (`synthesize`/`reflect`/`routine`), content-studio, webchat — no se ejercitaron (requieren flujos más largos / canales configurados)
- **Nunca eliminar la variante legacy del parsing** al tocar marcadores de nuevo (ver CUSTOMIZATIONS.md); mantener la tolerancia bilingüe

### P6 — CI/CD (del plan original)
- Pipeline GitHub Actions: build + tests + empaquetado desktop (hoy no existe; validar con `mvn compile` JDK 21 y `vue-tsc --noEmit`)

### P7 — Inmersión en el código (Fase 1 del plan original)
- Mapeo guiado de los módulos clave (runtime de agentes, tools, wiki, canales, seguridad)

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
