# NEXT_SESSION.md — Resumen de la sesión y pendientes

> Documento de contexto para retomar el trabajo en la siguiente sesión.
> Última sesión: 13ª (2026-09-19 → 2026-09-21) · Rama: `main` (**base v2.2.0**, tag `v2.2.0-mc.1`) · Fork: `auracore-sas/auraclaw`
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
> **Sesión 2026-09-01 (10ª): limpieza de pendientes — job DeepSeek cancelado, conversaciones de prueba borradas, config_content de KB migrado a JSON puro. BD limpia y documentación cerrada.** Detalle abajo.
> **Sesión 2026-09-01 (10ª-b): conexión MCP PowerFin operativa — proxy bridge por GET 405 + negociación de versión; fix de loop del agente (structuredContent descartado) y schemas en el caché. Desplegado y verificado en vivo.** Detalle abajo.
> **Sesión 2026-08-27 (9ª-g): Token Usage acotado por usuario (mismo patrón del Panel) — desplegado y verificado.** Detalle abajo.
> **Sesión 2026-09-15 (11ª): release `v2.1.0-mc.2` (38 commits sin tag) + presupuesto de disclosure persistido en `docker-compose.yml` + CI/CD (P6) creado — que a su vez destapó y corrigió 12 fallos de test nuestros.** Detalle abajo.
> **Sesión 2026-09-15 (12ª): adopción del upstream v2.2.0 en rama `feature/upstream-v2.2.0` — merge desde el commit de release de `dev` (4 conflictos, no 313), 5 arreglos, suite completa 5022 tests verde y despliegue en vivo con Flyway out-of-order. Pendiente: mergear a `main`.** Detalle abajo.
> **Sesión 2026-09-16 (12ª-b): fix del falso "evidencia insuficiente" del Wiki (bug del upstream #334, presente también aquí) — portado a `main` desde la rama de v2.2.0 y verificado en vivo.** Detalle abajo.
> **Sesión 2026-09-16 (12ª-c): runbook de canal de Telegram por miembro (opción A) + protocolo de pruebas en `AGENTS.md` + cierre. Queda PENDIENTE PROBAR TELEGRAM como gate para declarar v2.2.0 listo para producción.** Detalle abajo.
> **Sesión 2026-09-19 → 2026-09-21 (13ª): plan de integración de Pi (F0, 10 documentos) + cierre de la deuda de CI/desktop (checker de Snowflake, empaquetado Linux/Windows) + adopción de v2.2.0 en `main` con tag `v2.2.0-mc.1`.** Detalle abajo.

---

## ✅ Sesión 13ª (2026-09-19 → 2026-09-21) — Pi F0, deuda de CI/desktop y adopción de v2.2.0

### 1. Plan de integración de Pi — F0 (2026-09-19)

**Decisión:** Pi **no sustituye** a AuraClaw, se integra **dentro**. AuraClaw es el *cuerpo empresarial*
(usuarios, RBAC, audit, aprobaciones, canales, Wiki, memoria, documentos, i18n español); Pi es el
*motor* para lo que el grafo de agentes no debe intentar solo: informes con gráficas, vídeo, análisis
de datos y ficheros complejos vía bash arbitrario.

- **Entregable:** `docs/pi-integration/**` — 10 documentos, ~1.630 líneas. Orden de lectura recomendado: 01 → 03 → 04 → 06 → 07 → 08.
- **Reglas de la integración:** código propio en `com.auracore.*`; la base va por el **registro de tools** (Módulo 3 de `CODE_MAP.md`), **no** por el grafo (`AgentGraphBuilder`/`*Node` = superficie caliente de merges); cada cambio se registra en `CUSTOMIZATIONS.md`; nada de secretos en prompt/args/logs; verificación funcional en vivo antes de declarar algo "listo".
- **Camino A** (`pi_worker`: tool + sandbox de contenedor + skill `informe-ejecutivo`): **puede empezar ya** (fases F1/F2).
- **Camino B** (`PiAgentRuntimeProvider` sobre el contrato `AgentRuntimeProvider`): estaba bloqueado por v2.2.0 → **desbloqueado por el merge de hoy** (fase F3, después de F1/F2).
- Registrado en `CUSTOMIZATIONS.md` con su manejo de conflicto (carpeta aditiva = sin conflicto).

### 2. Deuda de CI/desktop cerrada (2026-09-21)

| Pendiente de la sesión 11ª | Resolución |
|---|---|
| `check-snowflake-precision.sh` no existía → `pnpm run build`/`lint` rotos de fábrica | **✅ Portado verbatim del upstream v2.3.0**: `mateclaw-ui/scripts/check-snowflake-precision.{mjs,sh}` + 3 líneas de `package.json`. Verificado: `✓ Snowflake ID precision check: clean`. Las líneas de script y los dos archivos son **idénticos** al tag `v2.3.0` y al release commit `a2f35f7c` de `dev` → merge limpio con cualquiera de los dos |
| Empaquetado Windows/Linux imposible (`download-jre.sh` era solo-macOS) | **✅ Reescrito**: matriz mac/linux/win × x64/arm64, autodetección de OS+arch, `tar.gz` vs `zip`, layout por plataforma (mac conserva `Contents/Home`), symlink `win32-x64` para modo dev, `--dry-run`, `JRE_DIR=`. Validado con descargas reales de Temurin 21.0.12.1 |
| `build-all-platforms.sh` no construía el frontend ni descargaba el JRE (empaquetaba `dist-electron/` obsoleto) | **✅ Reescrito**: pipeline documentada (JAR → JRE por plataforma → frontend → electron-builder) + `--local|--remote` × `--mac-only|--win-only|--linux-only|--all-platforms`; en `--remote` omite JAR y JRE |
| `package:linux` inexistente (el target AppImage ya estaba en `electron-builder.cjs`) | **✅ Añadidos** `package:linux`, `package:linux:local`, `package:linux:remote` + `scripts/README.md` actualizado |
| Job `desktop` del CI sin validar | **⚠️ Parcial**: siguen **sin validar**, pero ahora existen jobs manuales `desktop-linux` (ubuntu-latest/AppImage) y `desktop-windows` (windows-latest/NSIS) que **sí se pueden** ejecutar (antes eran imposibles con el script macOS-only). El primer `workflow_dispatch` con su flag es el que los valida |
| 8 fallos de test de UI = deuda del upstream | **⏳ Sin cambios**: las 4 exclusiones siguen vigentes. Dato nuevo: en v2.3.0 el upstream editó 2 de esos 4 archivos **y sus fuentes** (`TeamRun*.vue`, `teamRunAttentionHandlers.ts`) → revisar al adoptar v2.3.0 (anotado en `vitest.config.ci.ts`) |

**Verificaciones hechas (sin ejecutar ninguna suite de tests):** checker en verde; descargas reales de JRE
(linux-x64, linux-arm64, win-x64) con layout correcto y `bin/java` ejecutable; las 6 URLs de Adoptium
responden 200; resolución de targets de `download-jre.sh` con `--dry-run`; `ci.yml` parsea como YAML
(5 jobs, 3 inputs); `bash -n` sobre los dos scripts.

### 3. Adopción de upstream v2.2.0 en `main` — tag `v2.2.0-mc.1`

- `git merge feature/upstream-v2.2.0` (44 commits, punta `0a583d65`) → **2 conflictos, ambos en NUESTROS docs** (`CUSTOMIZATIONS.md` y `NEXT_SESSION.md`), resueltos conservando **las filas de ambos lados** (la rama traía las suyas de la sesión 12ª; `main` las de 12ª-b/12ª-c). `rerere` grabó las dos resoluciones.
- **0 archivos borrados** y **delta vs la rama verificada = 23 archivos, ninguno de Java** (docs, Pi, CI, scripts de desktop, `package.json`) → el código Java es exactamente el que ya pasó **5.025 tests** en la rama. Por eso **no se re-corrió la suite completa** (además el usuario lo pidió expresamente para esta sesión).
- Verificación pre-push: `mvn -q test-compile -pl mateclaw-server -am` con JDK 21 → **OK**.
- ⚠️ **El stack Docker ya corría v2.2.0**, así que el despliegue iba por delante de `main`; ahora `main` lo alcanza. El delta no toca Java → **no hace falta reconstruir la imagen**.
- **Upstream ya publicó v2.3.0** (tag `472d184d`, 2026-09-20): su commit de release **es un squash** de todo el trabajo de `dev` — **369 archivos / +21.330 líneas en un solo commit**. Para mergearlo hay que usar el release commit de `dev` (`a2f35f7c`), no el tag, por la misma razón que con v2.2.0 (ver `AGENTS.md` §5.1).

### 4. Panel de archivos por conversación (post-merge, 2026-09-21)

**Motivo:** en un chat donde se construyeron archivos, los enlaces de descarga solo se encuentran releyendo el historial. El upstream **ya lo pidió** (issue **#384**, abierto desde 2026-06-19) y solo resolvió la mitad: el PR **#447** añadió la sección "Archivos Generados" al rail derecho, pero mira **solo el último turno** (`RunOverviewPanel.vue:97` → `latestAssistant`). No hay ningún PR abierto que agregue el resto (verificado en GitHub).

**Implementado (frontend-only, sin tocar backend):**
- `mateclaw-ui/src/utils/conversationFiles.ts` — inventario a nivel de conversación: agrupa por turno, **fusiona versiones por nombre** (el mismo PDF regenerado aparece con URLs distintas) y clasifica **entregables vs intermedios** con reglas fail-open: citado en la respuesta final → tool de entrega → extensión de documento → intermedio, con **fallback** para que un turno nunca quede vacío.
- `mateclaw-ui/src/components/chat/ConversationFilesPanel.vue` — panel **colapsable** (arranca como riel con contador; estado en localStorage), botón "Mostrar intermedios (N)" y comportamiento de *drawer* en pantallas angostas. Las filas son `<a href="/api/v1/files/generated/…">` → las maneja el delegador global `useGlobalFileDownloadClick` (previsualización o descarga autenticada; sin lógica de descarga propia).
- Montado en `ChatConsole.vue` junto a `RunOverviewPanel`; i18n es/en/zh (`chat.filesPanel.*`); registrado en `CUSTOMIZATIONS.md`.
- Costura **`ConversationFilesSource`** para re-apuntar al catálogo de artefactos del upstream (**#514 / PR #539**, abierto) sin tocar el panel.

**Efecto con datos reales:** el turno de **19 entradas** (8 PNG + 7 `test_*` + `informe_final.md` + el PDF final **3 veces con URLs distintas**) queda en **1 entregable + 16 intermedios**; y un turno con 0 archivos citados muestra todo (fallback).

**Verificado:** `vue-tsc --noEmit` limpio · 11 + 5 tests nuevos verdes · los 2 tests que montan `ChatConsole` siguen verdes (30/30). **No se corrió la suite completa** (la corre el CI).

**TTL de los archivos generados — 7 días (medido con datos reales, 2026-09-21):** al revisar el panel apareció el aviso *"Este archivo expiró o ya no está disponible"*. **Sí expiran de verdad**: `GeneratedFileCache.TTL = Duration.ofDays(7)` y la expiración se valida **en cada lectura** (`get(id)` → `expired()` → 404), además de un barrido cada 6 h. Medición sobre las 101 referencias de `metadata.generatedFiles` en la BD, comprobando existencia en el volumen:

| Día del mensaje | Vivos / referenciados |
|---|---|
| 2026-08-21 | 0/4 |
| 2026-08-24 | 0/1 |
| 2026-08-27 | 0/4 |
| 2026-09-02 | 0/2 |
| 2026-09-16 | 3/3 |
| 2026-09-17 | 37/37 |
| 2026-09-18 | 50/50 |

**90 vivas / 11 muertas**, corte exacto a 7 días → nada se perdió por el rebuild (`/app/data` es el volumen nombrado `mateclaw_server_data`, así que los bytes sobreviven a recrear el contenedor). Consecuencia de UX: el panel **marca los caducados** (badge en el riel + fila tachada, sin ocultarlos ni romper el enlace, por si el TTL cambiara).

⚠️ **Para verlo en el navegador hay que reconstruir la imagen Docker** (`docker compose build mateclaw-server && docker compose up -d mateclaw-server`): la UI se sirve desde dentro del JAR. **Pendiente de hacer.**

### Estado al cerrar la sesión (2026-09-21)

| Elemento | Estado |
|---|---|
| `main` | merge de `v2.2.0` + tag `v2.2.0-mc.1`, sincronizado con `origin/main` |
| `feature/upstream-v2.2.0` | ya integrada en `main` (se conserva como referencia histórica) |
| Contenido de `main` | **v2.2.0** + todas nuestras personalizaciones (marcadores bilingües, i18n/docs es, V900+, branding) |
| Stack Docker | corriendo v2.2.0 (misma base que `main`); rollback: imagen `mateclaw-mateclaw-server:pre-v220` |
| Suite (Java) | 5.025 tests verdes en la rama integrada; el delta del merge no toca Java → no se re-corrió |
| `test-compile` | ✅ JDK 21 |
| Pendiente bloqueante | **probar Telegram** (ahora `main` = v2.2.0) |
| Panel de archivos por conversación | ✅ implementado y probado en tests · ⏳ pendiente reconstruir la imagen Docker para verlo en el navegador |
| Upstream nuevo | **v2.3.0** (369 archivos en un squash) — adopción aparte, no gratuita |

### Errores/lecciones de esta sesión
- **Un `git merge` sobre un archivo de documentación propio puede duplicar líneas de contexto**: al resolver
  `NEXT_SESSION.md` conservando "ambos lados", mi script recogió TODAS las líneas `> …` del bloque en
  conflicto (no solo las de la cabecera) y movió 3 citas internas a la lista de sesiones. **Lección:** en
  conflictos de docs, resolver a mano o verificar el resultado leyendo la zona afectada, no solo que no
  queden marcadores `<<<<<<<`.
- **`git diff --stat <rama> HEAD | tail -N` trunca por ARRIBA**: casi me hizo concluir que el merge había
  perdido `.github/workflows/ci.yml`. Comparar siempre el conteo total (`--name-only | wc -l`) antes de sacar conclusiones.


## ✅ Sesión 12ª (2026-09-15) — Adopción de upstream **v2.2.0** (spike verificado, en rama)

> Rama `feature/upstream-v2.2.0`. **Pendiente de decisión: mergear a `main` + tag `v2.2.0-mc.1`.**

### El hallazgo que definió la estrategia
- `upstream/main` está **aplanado** (squash `release: ...`, un solo padre) y su merge-base con nuestra base es **v1.1.0** → `git merge v2.2.0` daba **313 archivos en conflicto**. El tag de `main` además es *curado* y omite 4 archivos que `dev` sí tiene (los habría borrado).
- `upstream/dev` **sí desciende de v2.1.0** y publica un commit `release: vX.Y.Z` por versión → merge 3-way normal con ancestro real: **4 conflictos**, y **repetible en cada versión futura**.
- Objetivo usado: `08a5bf69` (`release: v2.2.0` en `dev`). Resultado: 288 archivos, +14103/-670, **0 borrados**.

### Conflictos resueltos (4, todos mecánicos)
`ConversationController` (unión import+campo) · `ConversationControllerBatchDeleteTest` (unión) · `McpServerServiceListToolsTest` (conservar ambos tests) · `mateclaw-ui/src/types/index.ts` (estructura del upstream + campo `stream_progress` traducido). `rerere` memorizó las 4 resoluciones.

### Arreglos aplicados (5 commits)
1. `fallbackLocale: 'en-US'` en `i18n/index.ts` (+ carga del diccionario de respaldo) — antes apuntaba a `es-ES` y las 37 claves nuevas de v2.2.0 se habrían visto crudas
2. **Flyway `out-of-order: true`** — en `application.yml` (base, cubre todos los perfiles). Ver §lecciones
3. Re-aplicación de branding en los archivos nuevos (`docs/en+zh/{a2a,deepseek-harness,roadmap}.md`, claves `runtimeNativeHint`)
4. `ConversationControllerTeamWorkerTranscriptTest` (test NUEVO del upstream) adaptado a nuestro constructor de 4 args
5. `TeamRunProjectorTest` — el upstream eliminó a propósito el attention item `synthesis` y dejó el test asertándolo; invertido a `assertFalse`

### Verificación
- `mvn test-compile` OK · **suite completa: 5022 tests / 0 fallos / BUILD SUCCESS** (subió de 4794 en v2.1.0)
- UI: `vue-tsc --noEmit` limpio · CI-config vitest 48 archivos/314 tests verdes · suite completa 335 verdes + los **mismos 8 fallos de siempre** (el upstream NO los arregló en v2.2.0 → las exclusiones de `vitest.config.ci.ts` siguen vigentes)
- **En vivo** (imagen Docker reconstruida y desplegada): Flyway aplicó **V186–V189 `[out of order]`** → `now at version v189`; tablas `mate_goal_continuation`/`mate_goal_attempt` y columnas `runtime_type`, `runtime_config`, `prompt_timeout_seconds`, `persistent_execution` creadas; `health=UP`, 3 proveedores OK; chat real → respuesta correcta; presupuesto de tools **33222 < 40000 con 0 degradaciones** (subió desde 32774)
- Imagen anterior resguardada como `mateclaw-mateclaw-server:pre-v220` para rollback

### Lecciones
- **El merge no marca los archivos NUEVOS que asumen firmas viejas**: `ConversationControllerTeamWorkerTranscriptTest` rompió `test-compile`. Correr siempre `mvn test-compile` antes de la suite.
- **Flyway out-of-order es transversal, no solo de Postgres**: al ponerlo únicamente en `application-postgres.yml`, el perfil de tests (H2) falló al arrancar el contexto y tumbó **10 clases** (`ApplicationContextSmokeTest`, `OpenApi*AccessTest`, `SecurityAsyncDispatchTest`, `Wiki*E2ETest`…). Va en la config base.
- **El upstream no tiene CI**: se le colaron un test obsoleto (`TeamRunProjectorTest`) y 8 fallos de UI que sobreviven a un release completo.
- **Anomalía en la BD (pendiente menor)**: `flyway_schema_history` tiene **3 filas para V186** (2026-08-20, 08-22 y ahora), todas con el **mismo checksum** (`-406583608`) — sin drift de contenido. Las dos primeras venían de un deploy anterior con código de `dev` (la BD ya tenía `runtime_type`/`runtime_config`). No rompe nada (la app arranca y migra), pero conviene limpiarlas (borrar las 2 más antiguas conservando la última).

### Pendiente de esta sesión
1. **Decidir**: mergear `feature/upstream-v2.2.0` → `main` + tag `v2.2.0-mc.1` + push
2. Limpiar las 2 filas duplicadas de V186 en `flyway_schema_history`
3. Revisar los 39 archivos de solape donde upstream reescribió y nosotros inyectamos (`ReasoningNode` +173 líneas, `ChatController` +178) — verificados los símbolos (citas, marcadores), falta prueba funcional de citas del Wiki
4. Traducir los 2 slugs nuevos de docs (`a2a`, `deepseek-harness`) — hoy caen al fallback es→en con badge EN

---

## ✅ Sesión 12ª-b (2026-09-16) — Fix del falso aviso de evidencia insuficiente del Wiki (bug del upstream)

> Portado a `main` con `cherry-pick` desde `feature/upstream-v2.2.0` (commits `ed00c36f` y `f534099b`).
> **No es una regresión de v2.2.0: el bug existe también en v2.1.0.**

### Síntoma reportado por el usuario
Una respuesta que citaba **dos páginas del Wiki** mostraba:
`[证据不足] … wiki citation [2] …` — pese a que **ambas páginas se habían leído**.

### Causa raíz (upstream, `jack`, 2026-06-16, commit `88be1f74` / #334)
`wiki_read_page` devuelve la página en un `title` de nivel superior y **sin índice**, pero `SourceEvidenceLedger.recordWikiEvidence` la registraba con un **índice 1 hardcodeado**. Como `Builder.wikiCitation` evicta por índice (`removeIf(existing.index() == citation.index())`), **la segunda página borraba la primera**. Con una sola fuente en el ledger, cualquier cita `[2]` era inverificable.

Mismo bug en el `merge()` que ejecuta `ActionNode` por ronda: una página leída sola en su ronda siempre recibe el primer índice, así que la ronda 2 **reemplazaba** la página de la ronda 1 (observado en vivo: la respuesta citaba `[1]` y `[2]` la **misma** página).

### Arreglo
1. `Builder.nextFreeWikiIndex()` en vez de la constante 1 → ninguna página se pierde; la tabla canónica del safety net ya no repite `[1]`.
2. `validateWikiCitations` deja de tratar el índice como identidad: si no resuelve, comprueba que la página apuntada esté entre las **realmente leídas**. **Citar una página nunca leída sigue rechazándose.**
3. `merge()` porta las citas nuevas con índices frescos y dedupe por **título/chunkId** (no por índice).

### Verificación
- Tests del área: **20 → 25**, todos verdes. Se actualizó `rejectsWikiAnswerWithoutRealCitations`, que **asertaba el comportamiento con bug** (exigía que citar una página real con otro número fuera error).
- **En vivo** (imagen reconstruida y desplegada): la misma pregunta que rompía → `finishReason=normal`, **0 avisos**, y tabla correcta `[1] Menú completo` / `[2] Productos destacados y precios`. Verificados los dos caminos (dos `wiki_read_page` en la misma ronda y en rondas separadas).
- Conversaciones de prueba purgadas.

### Lección
Este bug lo encontró el usuario en minutos de uso real; **ninguno de los ~5.000 tests lo detectaba**. Refuerza que el CI verde no sustituye la verificación funcional antes de declarar algo "listo para producción".

---

## ✅ Sesión 12ª-c (2026-09-16) — Protocolo de pruebas, runbook de Telegram y cierre

### Entregables
- **`docs/TELEGRAM_PER_MEMBER.md`** (nuevo): runbook para dar a cada miembro su propio canal de Telegram con la **opción A** elegida (el admin crea el canal por la UI y reasigna el dueño con un `UPDATE`). Incluye requisitos (bot propio por @BotFather + su user ID), pasos con comandos copiables, verificación end-to-end, troubleshooting de 6 síntomas y las dos advertencias de seguridad (no dejar `Usuarios Permitidos` vacío; no conceder `manage:channels` a miembros porque `GET /channels` expone `config_json` con el bot token).
- **`AGENTS.md` §4bis y §4ter**: protocolo de testing (cuándo correr la suite completa vs tests dirigidos) y el gotcha de la BD H2 compartida.

### Descubrimientos relevantes
- **El canal de Telegram por miembro es viable sin tocar código**: `mate_channel` no tiene índice único por tipo, `ChannelManager` arranca todos los canales habilitados, cada canal usa su propio `bot_token`, el liderazgo es por canal y **V901 propaga `owner_username` a las conversaciones**. El router relee el canal en cada mensaje → cambiar el dueño por SQL aplica **sin reiniciar**.
- **Los 3 bloqueos son de UI/código**: los 11 endpoints de canales son `admin`; `POST /channels` fuerza el dueño al llamante (V901: *"never trust a client-supplied ownerUsername"*) → un admin no puede crear a nombre de otro; la UI nunca maneja `ownerUsername`. Por eso el último paso es SQL.
- **La UI sí expone el control de acceso** del canal (sección en español: política de DM/grupo, **Usuarios Permitidos**, mensaje de rechazo) — el punto de seguridad clave del runbook.
- Usuarios existentes en la BD: `admin` (admin), `pvalarezo` y `ebermeo` (user) → sirven para probar el flujo por miembro.

### Errores operativos propios (documentados para no repetirlos)
Al portar el fix del Wiki cometí dos fallos que invalidaron dos corridas completas:
1. **Dos `mvn test` concurrentes** sobre el mismo `target/` → el segundo reescribió `target/classes` bajo la JVM del primero → **838 fallos por `NoClassDefFoundError`**.
2. **Acceso concurrente al mismo H2** (`data/mateclaw.mv.db`) → **corrupción** del archivo (`MVStoreException: Double mark`) → 87 fallos más.

Se resolvió borrando el H2 corrupto (respaldo en `/tmp/auraclaw-h2-backup/`) y relanzando limpio. Ambos quedaron documentados en `AGENTS.md` §4ter. **Coste: ~50-60 min de máquina evitables** en el día.

### Estado al cerrar la sesión (2026-09-16)
| Elemento | Estado |
|---|---|
| `main` | `f6cdebf9` + este commit, sincronizado con `origin/main` |
| `feature/upstream-v2.2.0` | `0a583d65`, **pusheada** a origin (44 commits) |
| Suite de `main` | 4799 tests / 0 fallos |
| Suite de la rama v2.2.0 | 5025 tests / 0 fallos (corrida previa al 2º fix; pendiente re-correr limpio) |
| Stack Docker | corriendo **v2.2.0** con el fix del Wiki, `health=UP` |
| BD H2 de dev | regenerada limpia (la corrupta respaldada en `/tmp`) |
| Pendiente bloqueante | **probar Telegram** |

---

## 🏷️ Release `v2.1.0-mc.3` (2026-09-15) — CI/CD + arreglos de tests

Motivo: `v2.1.0-mc.2` se cortó **antes** de crear el CI y de arreglar los 13 fallos de test
que ese CI destapó. Como los tags son inmutables (§5bis), este release versiona esos cambios;
`v2.1.0-mc.2` permanece intacto apuntando a `d04c4210`.

**Contenido (sobre `v2.1.0-mc.2`)**
- `bb64fcaf` — presupuesto de esquemas de tools persistido en `docker-compose.yml`
  (antes solo en `.env`/override gitignoreados)
- `8550bfe6` — 13 tests alineados con el branding `AuraClaw` y los marcadores en español
  + cierre del gap de traducción del mensaje spawn-paused en `DelegateAgentTool`
- `d3359125` — `.github/workflows/ci.yml` (jobs `server`, `ui`, `desktop` manual)
  + `mateclaw-ui/vitest.config.ci.ts`
- `6dc64370`, `d4ff34bf` — documentación de la sesión 11

**Verificación previa al tag**
- Suite completa del server: **4794 tests / 0 fallos / 0 errores / 2 skipped / BUILD SUCCESS** (~15 min)
- UI: **285 tests / 42 archivos verdes** con el config de CI · `vue-tsc --noEmit` exit 0 · `vite build` OK (58s)
- `docker compose config` → 40000 / 0.30 (también en caso clon limpio)
- En vivo: `toolSchemas=32774` con budget 40000 y **0 degradaciones** (`[ToolDisclosure]` ausente en logs)
- Workflow validado localmente (YAML con 3 jobs); el job `desktop` queda **sin validar end-to-end**

---

## 🏷️ Release `v2.1.0-mc.2` (2026-09-15) — corte de release

Cierre de la deuda de versionado: había **38 commits sin tag** desde `v2.1.0-mc.1` (2026-08-20).
El tag se corta sobre `main` (`9b2ee31e`) siguiendo la regla 5bis del `AGENTS.md`
(`vX.Y.Z-mc.N` sobre la misma base upstream `v2.1.0`; sin nuevo tag de upstream).

**Contenido acumulado en este release**
- **V900** — `usage_scope`: modelos por propósito (chat / wiki) + cierre de los 3 leaks (selector UI, pin de conversación, default)
- **V901** — canales individuales: canal con owner por usuario; conversaciones visibles solo al dueño
- **V902** — Telegram: voz entrante (descarga + STT), gráficas como foto nativa, tablas markdown → monospace, tablas anchas → viñetas, scrub antes de unwrap
- **V902** — Panel (dashboard) por usuario + secciones admin-only (modelos LLM, cron); Token Usage acotado por usuario
- **Wiki** — citas canónicas `[n]` + `Fuentes:` vía `SourceEvidenceLedger`, safety net de formatos no canónicos, `CITATION_FORMAT_BLOCK` en el system prompt
- **LLM** — `max_tokens` → `max_completion_tokens` para `gpt-5*`
- **MCP** — `structuredContent` en resultados de tools (fin del loop de 100 iteraciones) + schemas completos en el caché (Jackson en vez de hutool con records)

**Verificación previa al tag**
- Árbol limpio y `HEAD == origin/main`; `mvn compile` (JDK 21) OK
- 87/87 tests verdes en las áreas del release: MCP (17+5), token usage (3), dashboard (4), ledger de citas (20), GPT-5 max_tokens (6), model config (12+5+4), formato de tablas (11)
- Todo el código de este release ya estaba desplegado en Docker y verificado en vivo en las sesiones 6ª–10ª-b

**Pendiente del release**: ninguno funcional. Lo no incluido queda en la lista priorizada de abajo (P6 CI/CD, persistir vars de disclosure, Wiki/DashScope).

---

## ✅ Sesión 11ª (2026-09-15) — release v2.1.0-mc.2 + config de disclosure + CI/CD (P6)

### 1. Release `v2.1.0-mc.2` (deuda de versionado)
- Había **38 commits sin tag** desde `v2.1.0-mc.1` (2026-08-20). Verificación previa: `mvn compile` JDK 21 + 87 tests de las áreas del release verdes.
- Commit `d04c4210` (`docs: record release v2.1.0-mc.2`) → tag anotado `v2.1.0-mc.2` → `git push origin main --tags`.
- Verificado: el tag apunta a `HEAD == origin/main`; sin tags colaterales creados (los del upstream ya existían en `origin`).

### 2. Presupuesto de esquemas de tools persistido en el repo
- **Problema**: `MATECLAW_TOOL_SCHEMA_MAX_TOKENS` y el ratio vivían solo en `.env` + `docker-compose.override.yml` (ambos gitignoreados) → un `docker compose up` limpio partía de los defaults de Spring (12000 / 0.25) y volvía a degradar `execute_sql` / `query_datasource` al catálogo de extensión.
- **Fix**: ambas vars declaradas en `docker-compose.yml` (commiteado) con los valores de producción (40000 / 0.30). El ratio usa el **nombre canónico** de Spring (`mateclaw.context.prefix-budget.tool-schema-ratio` → `MATECLAW_CONTEXT_PREFIX_BUDGET_TOOL_SCHEMA_RATIO`); el alias viejo `MATECLAW_TOOL_SCHEMA_RATIO` se retiró de `.env`. El override conserva solo los puertos de dev.
- **Verificación**: `docker compose config` → 40000 / 0.30 (también con `--env-file` casi vacío = caso clon limpio); `docker exec … printenv` confirma las vars dentro del contenedor; chat real → log `[ReasoningNode] Prefix accounting: window=272000, toolSchemas=32774` y **0 mensajes `[ToolDisclosure]`** (sin degradaciones). Con las 5 tools de PowerFin conectadas el estimado sube ~1.7k tokens (cache 6599 chars) → ~34.5k < 40000, margen suficiente.

### 3. P6 — CI/CD creado (y 12 fallos de test nuestros descubiertos)
- **`.github/workflows/ci.yml`** (el upstream no trae ningún workflow, aunque su Dockerfile asume uno): jobs `server` (JDK 21 + `mvn -N install` + `plugin-api` + compile + suite completa + artefacto de surefire-reports si falla), `ui` (pnpm 10 `--frozen-lockfile` + `vue-tsc --noEmit` + vitest + `vite build`) y `desktop` (solo manual vía input, macOS sin firma, **no validado todavía**). Dispara en push/PR a `main`, nightly (L-V) y manual.
- **`mateclaw-ui/vitest.config.ci.ts`** (aditivo): excluye 4 archivos de test que ya fallan en upstream limpio — verificado con `git worktree add … v2.1.0` + symlink de `node_modules`: **los mismos 8 asserts fallan allí**. Sin la exclusión el CI nacería rojo.
- **12 fallos reales del server, todos NUESTROS** (la suite completa los destapó — justifica el CI): `AgentGraphBuilderIdentityBlockTest` (aseraba `MateClaw`), `ChatControllerPersistStatusTest` (`[等待审批]`), `FeishuProcessStreamTest` (`startsWith("[错误]")`), `DelegateAgentToolDenyListTest` + `DelegateAgentToolTest` (8 asserts con literales chinos). Las aserciones de prefijo de error ahora usan `ChannelErrorClassifier.hasErrorPrefix()` (contrato real y bilingüe) y las de contenido el texto español emitido. Además se cerró un **gap de traducción** en `DelegateAgentTool`: el mensaje de spawn-paused estaba en inglés en 2 de 3 sitios.
- **Validación local del CI**: YAML válido (3 jobs) · 285 tests UI verdes con el config de CI (42 archivos) · `vue-tsc --noEmit` exit 0 · `vite build` OK (58s) · suite completa del server **4794 tests / 0 fallos / 2 skipped / BUILD SUCCESS** (~15 min).
  - Nota del proceso: la primera corrida destapó 12 fallos; la segunda (tras corregirlos) destapó **1 más** — `DelegateAsyncToolTest.delegateAsyncSpawnPause`, que asertaba `contains("paused")` y se rompió al traducir el mensaje de spawn-paused (`DelegateAgentTool`). Corregido y confirmado en la tercera corrida (verde).
  - **Lección**: los tests de este repo asertan literales de idioma; cualquier cambio de marcador/branding exige barrer los tests (`grep` de `错误`/`等待审批`/`MateClaw`/`Spawning paused`) y re-correr la suite completa. El CI ahora lo hace automáticamente.

### Estado del entorno al cerrar
- Stack Docker `mateclaw` **levantado** (server `UP`, 3 proveedores OK) y `powerfin-mcp-proxy` activo en 8090.
- **PowerFin (localhost:8080) estaba caído** → el MCP queda en `error` al arrancar. No es regresión: el proxy responde 502 correctamente y la config en BD apunta al bridge (`http://172.25.0.1:8090/powerfin/ws/mcp`, transport `streamable_http`).
- Conversación de prueba del presupuesto (`disclosure-budget-test`) purgada vía API: 0 conversaciones, 0 mensajes.

---

## ✅ Sesión 10ª-b (2026-09-01) — MCP PowerFin conectado + fix del loop del agente

### Contexto
- El usuario tiene un servidor MCP local PowerFin (`http://localhost:8080/powerfin/ws/mcp`, `X-API-Key`, JSON-RPC 2.0 streamable HTTP, 5 tools: balance_query, customer_statement, overdue_portfolio, inventory_balance, find_invoices_by_status).
- La conexión en AuraClaw daba `Client failed to initialize by explicit API call` y el chat se demoraba muchísimo.

### Causas raíz (3 bugs encadenados) y fixes
1. **Config MCP incorrecta en BD** (`mate_mcp_server` id 2094882114698027010): transport `sse` → debía ser `streamable_http`; url `http://localhost:8080` no alcanzable desde el contenedor Docker → IP del gateway (`172.25.0.1`). Headers `X-API-Key` ya estaban bien.
2. **Servidor MCP stateless incompatible con el SDK** (mcp-core 0.14.0 pinzado por spring-ai-alibaba-graph-core):
   - El SDK hace un GET inicial al endpoint (stream SSE notificaciones) → PowerFin responde 405 + HTML → `SseLineSubscriber` lanza `Invalid SSE response` fatal.
   - Negociación: el SDK pide protocolVersion 2025-06-18 y PowerFin responde 2025-11-25 (más nueva) → rechazada.
   - **Fix sin tocar el proyecto**: proxy Python local (`/home/pvalarezo/auracore-apps/scripts/powerfin_mcp_proxy.py`, systemd user service `powerfin-mcp-proxy.service`, puerto 8090) que (a) responde el GET con 200 text/event-stream vacío, (b) reescribe protocolVersion del initialize a la pedida, (c) reenvía POSTs con X-API-Key.
3. **Loop del agente (lentitud) — bug de código AuraClaw**:
   - `ProgressAwareMcpToolCallback.serializeResult` solo concatenaba `result.content()` (resumen) y descartaba `structuredContent` (donde PowerFin pone los detalles en su campo no estándar `data`). El LLM veía solo "6 factura(s)..." y reintentaba la misma tool hasta 100 iteraciones (~20s/vuelta, `Max iterations reached`).
   - **Fix 1 (código)**: `serializeResult` ahora añade `[Detalle estructurado] <JSON>` con `structuredContent` cuando existe (dedupe semántico si el texto ya lo contiene). Tests: +5 en `ProgressAwareMcpToolCallbackTest` (17 total).
   - **Fix 2 (proxy)**: reescribe el campo no estándar `data` → `structuredContent` en respuestas de `tools/call` (el SDK Jackson solo puebla `structuredContent`).
   - **Fix 3 (código)**: `McpServerService.serializeToolsCache` usaba hutool `JSONUtil.toJsonStr` (no soporta records de Java → `inputSchema` quedaba `{}` en el caché y en la UI). Ahora usa Jackson (`ObjectMapper` inyectado) para el record y para la lista final. Tests: +1 en `McpServerServiceListToolsTest` (5 total).

### Verificación en vivo
- MCP: `connected`, 5 tools con **schemas completos** en `tools_cache_json` (antes `{}`).
- Chat real (conv `mcp-fix-test-2`): "facturas activas con detalle" → respuesta en **31s** con las 6 facturas detalladas (código, persona, fechas, montos) vs 181s/loop antes. Sin `Max iterations`.
- **Confirmado por el usuario desde la interfaz (2026-09-01)**: "Sí, funciona muy muy bien".
- Deploy: rebuild imagen Docker + retag a `mateclaw-mateclaw-server` + recreate (`docker compose -p mateclaw up -d --force-recreate mateclaw-server`).
- Nota: el server se reconecta al MCP automáticamente al arrancar (initEnabledServers) — el proxy debe estar corriendo antes.

### Purga posterior
- Conversaciones de prueba `mcp-fix-test-1` y `mcp-fix-test-2` (más sus mensajes y audit logs de tool guard) borradas — 0 conversaciones de prueba, 0 mensajes huérfanos. Backup en `/tmp/auraclaw-cleanup/backup_mcpfix_*`.


---

## ✅ Sesión 10ª (2026-09-01) — Cierre de los 3 pendientes opcionales (BD limpia)

### 1. Job viejo de DeepSeek marcado como `cancelled`
- `mate_wiki_processing_job` id `2092322480327725057` (heavy_ingest de la KB Wetzel's Pretzels) tenía `stage='cancelled'` pero `status='running'` (inconsistente tras el cancel en la sesión 8ª).
- Fix: `UPDATE ... SET status='cancelled', finished_at=COALESCE(finished_at, update_time)` → ahora `stage=cancelled, status=cancelled, finished_at=2026-08-26 02:51:03` (consistente con los otros jobs completed/partial).

### 2. Conversaciones de prueba borradas
- 10 conversaciones de prueba con sus datos dependientes:
  - `gpt5fix-test-1` (verificación fix GPT-5)
  - `gpt4o-cite-test-1/2`, `gpt4o-ubic-test-1/2/3` (verificaciones de citas/ubicaciones)
  - `chart-test-telegram-1/2` (pruebas de gráficas en Telegram)
  - `test-error-p45` (verificación P4/P5 de marcadores), `test-alertas-1`
- Borrados en cascada: `mate_tool_guard_audit_log` (8 filas, ALLOW de wiki_read_page/render_html_image) → `mate_message` (24) → `mate_conversation` (10).
- Extra: 6 mensajes huérfanos con `conversation_id='default'` (pruebas de la sesión 7ª del pipeline de datos BD, sin conversación) también eliminados → **0 mensajes huérfanos** en toda la BD.
- Backup completo de todo lo borrado en `/tmp/auraclaw-cleanup/` (CSVs: conversaciones, mensajes, guard_audit, job, kb).

### 3. `config_content` de la KB Wetzel's Pretzels migrado a JSON puro
- **Problema**: el config era frontmatter YAML (`---\nwikiDefaultModelId: ...\nwikiLightModelId: ...\n---\n# Wiki Processing Rules...`). Los guards de la UI (`WikiConfig.vue` — `loadStepModels`, `saveIngestMode`, `saveEntityExtraction`, `saveStepModelsAndClose`) hacen `JSON.parse(configContent)`; al fallar quedaban `existingConfig = {}` y la siguiente edición (modelos, ingest mode, entidades) **pisaba todo el config** perdiendo modelos + reglas.
- **Fix (solo BD, vía API `PUT /wiki/knowledge-bases/{id}/config`)**: config ahora es JSON puro `{"wikiDefaultModelId": "1000000116", "wikiLightModelId": "1000000116", "processingRules": "# Wiki Processing Rules..."}` — IDs como **strings** (patrón de la UI, ver comentario en `saveStepModelsAndClose`: *"Backend parses configContent leniently — string-typed IDs are fine"*); Jackson los convierte a Long en `WikiKbConfig`. El campo `processingRules` (no estándar, ignorado por `WikiKbConfigParser`) preserva las reglas de calidad/formato que el backend inyecta vía `{config}` en los prompts de digestión (route-user/digest-user).
- **Verificado**: `JSON.parse` del contenido OK; `getConfig` vía API devuelve el JSON; los 4 guards de la UI ya no fallan al editar.
- **Nota de convención**: para configs de KB, el formato canónico es JSON puro (no frontmatter YAML) — la UI solo entiende JSON.

### Estado final
- BD limpia: 0 conversaciones de prueba, 0 mensajes huérfanos, job cancelado consistente, config KB en JSON parseable.
- Sin cambios de código (solo BD + docs) → no requiere rebuild de imagen Docker.
- Commit: `chore(db): close V9xx leftovers — cancel stale job, purge test conversations, KB config to JSON` (ver log git).


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

### 🔴 BLOQUEANTE — Probar Telegram (única cosa que falta para declarar v2.2.0 listo para producción)

**Estado**: v2.2.0 es ya la base de `main` (tag `v2.2.0-mc.1`, sesión 13ª), **desplegado y corriendo en el stack Docker**, con la suite completa verde (5.025 tests) y el fix del Wiki verificado en vivo. Lo único sin ejercitar es **Telegram**, que es justo donde más personalizamos.

**Por qué es el gate**: upstream reescribió archivos donde inyectamos lógica (`ReasoningNode` +173 líneas, `ChatController` +178) y tocó código de canales. Los tests cubren piezas unitarias, **no el flujo real de un mensaje**.

**Qué probar** (el usuario se encarga; el stack ya está arriba):
1. Mensaje de texto → respuesta correcta
2. **Nota de voz** → transcribe y responde como texto (V902)
3. Pedir una **gráfica** → llega como **foto nativa** (V902)
4. Una **tabla ancha** → se convierte en viñetas / monospace legible en el móvil (V902)
5. Interruptor de **trazado de ejecución** del canal (`stream_progress`) → no rompe nada

**Si algo falla**: revisar `docs/CUSTOMIZATIONS.md` (los marcadores y adaptadores que tocamos) y los commits de V901/V902 en `git log`.

**Sinergia**: hacer estas pruebas configurando el canal de un miembro (`pvalarezo` o `ebermeo`) valida **dos cosas a la vez**: el canal de Telegram y el runbook de `docs/TELEGRAM_PER_MEMBER.md`.

### ✅ RESUELTO (13ª, 2026-09-21) — v2.2.0 adoptado en `main`
- `feature/upstream-v2.2.0` está **mergeada en `main`** con el tag **`v2.2.0-mc.1`**. Detalle del merge (2 conflictos de docs, 0 archivos borrados, delta de 23 archivos sin Java) en la **sesión 13ª** de este documento.
- El stack Docker ya corría v2.2.0, así que el despliegue dejó de ir por delante de `main`. Rollback disponible: imagen `mateclaw-mateclaw-server:pre-v220`.

### 🔜 SIGUIENTE ADOPCIÓN — upstream v2.3.0 (ya publicado)
- Tag `v2.3.0` = `472d184d` (2026-09-20) y su commit de release **es un squash de todo `dev`**: 369 archivos / +21.330 líneas. El release commit equivalente en `dev` es **`a2f35f7c`**.
- Procedimiento: `AGENTS.md` §5.1, **usando el release commit de `dev`** (`git log --grep='^release: v2.3.0$' upstream/dev`), nunca el tag ni `upstream/main`. No es un merge gratuito: son ~21k líneas y toca nodos del grafo donde inyectamos lógica.
- Antes de empezar: revisar si arregla los 8 fallos de test de UI excluidos en `vitest.config.ci.ts` (v2.3.0 edita 2 de esos 4 archivos) y si trae algún cambio en `mateclaw-desktop/scripts/` (nuestros dos scripts de empaquetado están reescritos).
- Recordatorio: los tags propios se reinician → al integrar v2.3.0 el tag será **`v2.3.0-mc.1`**.

### De la sesión 7ª (2026-08-24) — datos/Postgres
- ~~**Persistir ajuste de disclosure en el repo**~~ → **✅ RESUELTO en la sesión 11ª (2026-09-15)**: las dos vars viven ahora en `docker-compose.yml` (commiteado) con defaults 40000 / 0.30, verificado con `docker compose config` y en vivo (`toolSchemas=32774` < 40000, **0 degradaciones**). El ratio pasó al nombre canónico `MATECLAW_CONTEXT_PREFIX_BUDGET_TOOL_SCHEMA_RATIO` (el alias `MATECLAW_TOOL_SCHEMA_RATIO` se retiró de `.env`)
- **Reversión del modelo (si gpt-4o vuelve a ser necesario)**: `PUT /api/v1/models/active` `{"providerId":"omniroute","model":"openai/gpt-4o"}`; devolver deepseek-v4-flash a wiki-only: `PUT /api/v1/models/deepseek/models/usage-scope` `{"modelId":"deepseek-v4-flash","usageScope":"[\"wiki\"]"}`
- **Verificar wiki** con deepseek-v4-flash como default (quedó scope chat+wiki; la wiki usa `getModel(id)` que ignora scope, debería seguir OK — confirmar en la próxima digestión)
- **El primer intento del agente usó el NOMBRE del datasource como ID** ("Postgres local (powerfin_test)") y falló, auto-corrigiéndose con `list_datasources`. Si se repite, reforzar el prompt con el ID numérico o validar en el tool un lookup por nombre
- **PowerFin estaba caído** (2026-09-15): el MCP queda `error` al arrancar (`Connection refused` a `localhost:8080`) — **no es regresión**, el proxy (8090) responde 502 correctamente. Para probar MCP hay que levantar primero PowerFin y luego reiniciar el server (o esperar al reconnect)

### Nuevos pendientes detectados en la sesión 11ª (2026-09-15)
- ~~**El job `desktop` del CI no está validado end-to-end**~~ → **⚠️ sigue sin validar** (13ª): `download-jre.sh` ya soporta Linux y Windows, así que los jobs manuales `desktop-linux`/`desktop-windows` existen y son ejecutables; falta el primer `workflow_dispatch`. Detalle original: — `pnpm run package:mac` + JRE embebido solo se ha escrito, nunca ejecutado en un runner. Además `mateclaw-desktop/scripts/download-jre.sh` es **solo macOS** (URL de Adoptium con `/mac` hardcodeado) → empaquetar para Windows/Linux necesitaría extender ese script
- ~~**`scripts/check-snowflake-precision.sh` NO existe**~~ → **✅ RESUELTO (13ª)**: portado el checker del upstream v2.3.0 a `mateclaw-ui/scripts/check-snowflake-precision.mjs` (+ `.sh`), con las 3 líneas de `package.json`; `✓ clean` sobre el árbol actual. Detalle original: (ni en upstream v2.1.0), pero `mateclaw-ui/package.json` lo invoca en `build` y `lint` → `pnpm run build` y `pnpm run lint` están rotos de fábrica. El invariante de Snowflake 64-bit sí está cubierto por vitest (`messageMetadata`, `useTeamRunHistory`, `agentPickerLogic`). Opciones: (a) recrear el script (grep de patrones de truncado) y hacer que `build`/`lint` funcionen, o (b) quitar la referencia muerta del `package.json` (customización del upstream, registrar). **Decidir con el usuario**
- **8 fallos de test de UI son deuda del upstream** (4 archivos excluidos en `vitest.config.ci.ts`): `product-cards`, `streaming-render`, `teamRunComponents`, `teamRunProjectionPrimitives`. Verificado que fallan igual en `v2.1.0` limpio. Revisar si upstream los arregla en la próxima versión estable y quitar las exclusiones
- **La suite del server son 4794 tests / ~15 min** en 8 cores → en runners de GitHub será bastante más. Si el consumo de minutos se vuelve un problema: sharding por paquetes o mover el suite completo a nightly dejando un subconjunto rápido en push

### Regresiones residuales P4/P5 (opcional, fuera del bloqueo)
- **Pruebas de regresión en más áreas** si se quiere completitud: research (`draft`/`compose`), skill (`synthesize`/`reflect`/`routine`), content-studio, webchat — no se ejercitaron (requieren flujos más largos / canales configurados)
- **Nunca eliminar la variante legacy del parsing** al tocar marcadores de nuevo (ver CUSTOMIZATIONS.md); mantener la tolerancia bilingüe

### P6 — CI/CD
- ~~Pipeline GitHub Actions~~ → **✅ CREADO en la sesión 11ª (2026-09-15)**: `.github/workflows/ci.yml` con jobs `server` (JDK 21 + suite completa), `ui` (pnpm frozen + vue-tsc + vitest + vite build) y `desktop` (manual, no validado). Dispara en push/PR a `main`, nightly y manual. **Pendiente**: validar el primer run real en GitHub (el workflow se validó localmente: YAML OK, 285 tests UI verdes, `vue-tsc` limpio, `vite build` OK, suite server verde tras los fixes) y decidir si se añade gate obligatorio de rama

### Futuro (post-P6)
- Regresiones residuales P4/P5 (research `draft`/`compose`, skill, content-studio, webchat) — opcionales, fuera del bloqueo
- Features de producto nuevas sobre la base CODE_MAP (Módulos 1-3) — la inmersión ya deja localizados los puntos de extensión

### Wiki (cuando se contrate la API key — ver `docs/WIKI_MODEL_SETUP.md`)
- Paso 1: API key DashScope → provider configurado
- Paso 2: marcar qwen-max / qwen-turbo `usage=["wiki"]` (UI Ajustes → Modelos → editar Uso)
- Pasos 3-4: `POST /models/embedding/default` (text-embedding-v3) + config KBs (wikiDefaultModelId/wikiLightModelId/stepModels/fallbackModelIds)
- Paso 5: verificación end-to-end (digestión, `Fuentes:` con vectores, aislamiento del chat)


## ✅ Sesión 9ª-g (2026-08-27) — Token Usage por usuario (V902)

### Problema
- `Ajustes → Uso de Tokens` (`/api/v1/token-usage`) mostraba el consumo GLOBAL de todos los usuarios (filtraba solo por fecha/modelo/proveedor — ni siquiera por workspace).

### Implementación
- `TokenUsageController`: + `Authentication` + `effectiveUsername` (admin global → null; resto → su username) — mismo criterio que el Panel.
- `TokenUsageService`: + `ConversationMapper` + overload 5-arg con `username` — resuelve las conversaciones del usuario y filtra mensajes por `IN conversationId`; sin conversaciones → resumen vacío. Overload legacy 4-arg intacto (lo usa `OperationalDataExportService`, admin-only).
- Tests: `TokenUsageServiceUserScopedTest` 3 casos (IN por conversaciones, vacío sin conversaciones, global con null). 17/17 del área OK.
- ⚠️ Bug de edición cazado en la verificación en vivo: el primer deploy del controller llamaba al overload legacy (return sin username) → el usuario veía el global. Corregido, re-desplegado.

### Verificación en vivo
- Usuario temporal `testusage` (member): token-usage **0/0/0**; admin: 105 msgs / 10.5M tokens (global intacto). Usuario eliminado.

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
6. Opcional pendiente de antes: job viejo de DeepSeek (2092322480327725057) quedó `running` en BD tras cancel — ~~cosmético, marcar `cancelled` si se quiere BD limpia~~ **✅ RESUELTO en sesión 10ª (status=cancelled)**

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
- **Pendientes menores opcionales**: (1) job viejo de DeepSeek 2092322480327725057 sigue `running` en BD tras cancel (cosmético — marcar `cancelled` si se quiere); (2) la conversación de prueba `gpt5fix-test-1` quedó en BD; (3) migrar el `config_content` de la KB Wetzel's Pretzels de frontmatter YAML a JSON puro si se edita desde la UI (los guards de la UI hacen `JSON.parse` — ver sección anterior). ~~→ **RESUELTOS en la sesión 10ª (2026-09-01): job → cancelled; conversaciones de prueba + mensajes huérfanos borrados; config_content → JSON puro. Ver sección de la sesión 10ª.**~~

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
