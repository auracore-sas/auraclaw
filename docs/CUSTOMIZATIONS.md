# AuraClaw — Customization Registry & Sync Procedure

> Documento de control para el fork comercial **AuraClaw** (Auracore SAS) sobre **MateClaw** (Apache-2.0, https://github.com/mateaix/mateclaw).

## 1. Estrategia de ramas y remotes

```
origin   → git@github.com-auracore-sas:auracore-sas/auraclaw.git   (fork privado — NUESTRO repo)
upstream → https://github.com/mateaix/mateclaw.git                 (repo oficial, solo lectura)

main     → línea comercial estable (base: tag v2.1.0 del upstream)
dev      → referencia local de la rama de desarrollo del upstream (no trabajamos aquí)
```

**Reglas:**
- ⛔ NUNCA usar el botón **"Sync fork"** de GitHub en `main` (el `main` del upstream es una línea
  curada/aplanada que no contiene los tags; mezclarlo rompería nuestra historia).
- ⛔ Nunca hacer `rebase` de `main` — solo `merge` (historia compartida con deploys/tags).
- ✅ La sincronización SIEMPRE es por CLI con tags estables (ver sección 3).
- ✅ `git rerere` está habilitado (`git config rerere.enabled true`): memoriza cómo resolvimos
  conflictos de branding y los re-aplica automáticamente en merges futuros.

## 2. Registro de personalizaciones (archivos tocados)

| Archivo | Cambio | Manejo de conflicto en merge |
|---|---|---|
| `README.md` | Marca renombrada: `MateClaw` → `AuraClaw` (solo prosa); aviso de fork agregado arriba | Tomar nuestra versión y re-aplicar: `sed -i 's/MateClaw/AuraClaw/g' README.md` |
| Logo / branding visual | Binarios reemplazados **en su lugar** con nombres originales (`mateclaw_logo.png`, `mateclaw_logo_s.png`, `favicon.ico`, `build/icon.*`) — contenido AuraClaw; imagen maestra en `assets/branding/auraclaw.png`; **cero archivos fuente modificados** por el logo | Si upstream cambia el binario del logo: conflicto binario → resolver manualmente: `git checkout --ours <ruta>` + `git add` (rerere NO aplica a binarios) |
| `mateclaw-ui/index.html`, i18n `en-US.ts`/`zh-CN.ts`, vistas (Login, About, MainLayout, chat), `types/index.ts`, `WorkflowJsonEditor.vue` + **logos de dos tonos (2026-08-21)** — `Login.vue` (logo-title), `MainLayout.vue` (logo-name, mobile-topbar-title), `MessageList.vue` (welcome-title), `About/index.vue` (hero-title), `mateclaw-webchat/src/index.ts` (DEFAULT_CONFIG.title), `mateclaw-desktop/src/App.vue` (alt del logo + `AuraClaw Desktop v{{appVersion}}`) | Textos visibles: `MateClaw` → `AuraClaw` | Re-aplicar `sed 's/MateClaw/AuraClaw/g'` sobre estos archivos si upstream los toca. ⚠️ El `sed` NO cubre el patrón de dos tonos `Mate<span …>Claw</span>` (quedó como `Aura<span …>Claw</span>`) — re-aplicar manualmente en los 5 archivos listados |
| **i18n español** — `es-ES.ts` (nuevo, 3,825 strings) + `i18n/index.ts` (default `es-ES`) + `App.vue` (element-plus es) + `MainLayout`/`System` (opción ES) + `SystemSettingService.java` (default servidor `es-ES`) | Español general (latinoamericano neutro, tú informal) | `es-ES.ts` es aditivo (sin conflicto). `index.ts`/`App.vue`/`MainLayout`/`System` tienen ~3 líneas nuestras: re-aplicar si upstream los toca. `SystemSettingService.java` línea del default: conservar nuestra versión |
| **Archivos de memoria de agentes en español** — `SOUL.md`/`PROFILE.md`/`MEMORY.md` de los 3 agentes semilla (traducidos en `data-*-es.sql` y aplicados a la BD viva, ids 1000200002-24). Los `AGENTS.md` (guías de comportamiento, ~25KB) siguen en inglés/chino: pendiente de traducir | Archivos dentro de los seeds es (sin conflicto). BD viva: ya actualizada |
| **Seeds de BD en español** — `data-es.sql`, `data-kingbase-es.sql`, `data-mysql-es.sql` (nuevos, traducidos de los `-en`) + `DatabaseBootstrapRunner.java` (rama `es-ES` → `data-*-es.sql`) | Instalaciones nuevas con locale es-ES reciben agentes, tools, skills, cron y settings en español (los prompts de agentes indican responder en español) | Archivos nuevos = aditivos, sin conflicto. `DatabaseBootstrapRunner.java` tiene ~4 líneas nuestras: re-aplicar si upstream lo toca. BD existentes: traducción aplicada manualmente vía UPDATEs (ver registro de la sesión) |
| `mateclaw-desktop/branding.config.json` | Nombre/appId/equipo/copyright → AuraClaw (appId: `com.auracore.auraclaw`) | Tomar nuestra versión |
| `AGENTS.md` | Contexto para agentes de codificación (nuestro, no existe en upstream) | Sin conflicto (archivo nuevo). Si upstream crea el suyo: conservar NUESTRO |
| `docs/CUSTOMIZATIONS.md` | Este archivo (nuestro, no existe en upstream) | Sin conflicto (archivo nuevo) |
| **Documentación en español (COMPLETA)** — `mateclaw-server/src/main/resources/docs/es/*.md` (40 archivos, ~860KB): mismo slug que `en/`, traducción completa de los 34 documentos pendientes + los 6 de la fase inicial. Enlaces `./slug` con anclas solo cuando el header queda en inglés. Términos técnicos sin traducir (ReAct, Tool Guard, workspace, sidecar…); marcadores de protocolo en chino preservados. **Fallback es→en (P3, 2026-08-21):** `MateClawDocService.read()` sirve la versión `en/` si el slug no existe en `es/`; `list()` marca esos docs con `fallback=true` y la UI muestra un badge EN (`Docs/index.vue` + `DocMeta.fallback`) | Traducción neutra (latinoamérica, tú informal) | Archivos nuevos = aditivos, sin conflicto. Si upstream agrega/renombra slugs en `en/`, replicar en `es/`. `MateClawDocService.VALID_LANG` ya incluye `es` (líneas nuestras, re-aplicar si upstream lo toca); el fallback es→en y el campo `fallback` del `DocMeta` record también son nuestros (re-aplicar en merge) |
| **Marcadores de protocolo en español (P4/P5, cambio COORDINADO)** — los marcadores visibles/parseables se emiten ahora en español: `[Error]` (antes `[错误]`), `Fuentes:` (antes `来源：`), `[Pendiente de aprobación]` (antes `[等待审批]`), `[Instrucción de tarea]` (antes `[任务指令]`), `[Resumen de observaciones de herramientas]` (antes `[工具观察摘要]`). Todos los parsers (backend `ChannelErrorClassifier.hasErrorPrefix`, `ApprovalPlaceholderUtil`, `PlanGenerationNode`, `SourceEvidenceLedger`; frontend `chatError.ts`, `useMarkdownRenderer.ts`) aceptan **ambos idiomas** (chino legacy + español) para no romper BD histórica ni streams en vuelo. Templates de error LLM y los 60 prompts `.txt` de `prompts/` traducidos al español (contratos JSON/`[[slug]]`/FILE-block/placeholders preservados). Mensajes `[已中断]`/`[已停止生成]` se muestran vía status+i18n (no se cambiaron) | Bilingüe-tolerante. Re-aplicar si upstream toca: las constantes en `ChannelErrorClassifier`, `ApprovalPlaceholderUtil`, `PlanGenerationNode`, `CronJobRunner`, `SourceEvidenceLedger`, `WikiContextService`, `NodeStreamingChatHelper`, `SummarizingNode`, `DelegateAgentTool`, adaptadores Feishu/DingTalk, y los parsers del frontend (`chatError.ts`, `useMarkdownRenderer.ts`, `MessageBubble.vue`, `PlanDetailPanel.vue`, `PlanBoard.vue`). Nunca eliminar la variante legacy del parsing |
| **Verificación visual P4/P5 (completada 2026-08-21) + fixes de renderizado bilingüe** — verificación en browser real (Playwright) de los 5 marcadores con datos sintéticos en BD de dev. Se encontraron y corrigieron 3 gaps del frontend que rompían la tolerancia bilingüe: (1) `MessageBubble.vue` solo ocultaba el texto crudo `[错误]` (no `[Error]`) cuando hay tarjeta de error → texto duplicado en errores en español; (2) `isApprovalPlaceholder` no incluía `[Pendiente de aprobación]` ni el stub legacy `[本次没有输出]` → texto crudo visible en historial; (3) `cleanGoal` de `PlanDetailPanel.vue`/`PlanBoard.vue` solo limpiaba `[任务指令]`, no `[Instrucción de tarea]` → prefijo visible en títulos de planes. Verificado: tarjetas de error (ES+legacy), stub de aprobación oculto, `Fuentes:`/`来源：` y títulos de planes renderizan correctamente. Tests UI: 306 pass / 8 fail preexistentes (sin regresiones) | Bilingüe-tolerante; mismo manejo que la fila anterior |
| **Plantilla PROFILE.md del usuario (corrección de ambigüedad)** — los `PROFILE.md` de los agentes semilla tenían una sección `## Identidad` con `Nombre/Rol/Estilo` sin aclarar que es del usuario; combinado con el `ABOUT_YOU_BLOCK` del system prompt, el agente se escribía a sí mismo (`AuraClaw Assistant`) en lugar de capturar los datos del usuario. Corregido: la sección se fusionó en `## Perfil del Usuario` con una nota `> Este archivo describe al USUARIO...`. Aplicado a seeds `data-*-es.sql` (3 agentes) y a la BD viva (5 filas via UPDATE, 2026-08-21). Los seeds `en/zh` mantienen la plantilla ambigua (pendiente opcional). El agente ahora usa `remember_structured` (type=user) para guardar datos del usuario | Baja superficie. Re-aplicar en seeds `en/zh` por coherencia si se quiere. BD viva: solo UPDATEs, no recargar seeds |
| **V900 · Uso de modelos por propósito (`usage_scope`)** — feature de aislación de modelos: un modelo `chat` puede dedicarse a trabajos internos (p. ej. digestión Wiki) y quedar **excluido del chat normal** (default, failover, pin, pickers), mientras sigue siendo seleccionable por id en el wiki. Implementado: migración `V900__model_usage_scope.sql` (3 dialectos, columna `usage_scope` JSON array), `ModelConfigService.isChatUsable()` + filtros en `listEnabledModels`/`getDefaultModel`/`resolveModel`/`getDefaultModelByProvider`/`getPrimaryChatModelByProvider`/`findEnabledModel` (pin) + rechazo en `setDefaultModel` (×2 overloads); `AgentGraphBuilder` (failover `pickFallbackModel`/`findFirstAvailableChatModel`); `ConversationController.setModel` rechaza el pin de conversación a un modelo dedicado (400 con mensaje claro); DTO `ModelInfoDTO` expone `usageScope`+`chatEligible`; endpoint `PUT /models/{providerId}/models/usage-scope`; UI en `ManageModelsModal.vue` (badges + editor Chat/Wiki) + `ModelSelector.vue` (filtra `chatEligible === false` del selector de chat) + i18n 3 idiomas. La wiki **no cambió**: usa `getModel(id)` (ignora enabled/usage) y su fallback interno `isUsableChatFallback` sigue aceptando modelos dedicados. Semántica: `usage_scope` NULL/vacío = legacy chat-usable; sin `"chat"` en el array = solo tareas internas; parseo fail-open (scope inválido → chat-usable). Tests: `ModelConfigServiceUsageScopeTest` (12) | **Superficie caliente moderada**: `ModelConfigService` + `AgentGraphBuilder` (failover) + `ConversationController` + `ModelSelector.vue`. Re-aplicar en merge si upstream toca esos métodos. Migración V900 = NUESTRA numeración, no renumerar. La BD dev (docker) migrará sola al arrancar (flyway) |
| **Módulo Enterprise deshabilitado** — `mateclaw-ui/src/router/index.ts` + `mateclaw-ui/src/views/layout/MainLayout.vue` (eliminada la entrada de menú y la ruta `/enterprise`) | El "Workbench de IA Empresarial" (`views/Enterprise/*.vue`) es una demo estática de frontend: datos mock hardcodeados, botones sin `@click`, **sin backend**. Se retira del menú lateral y del router para que quede inaccesible. Se dejan en disco sin uso los componentes `views/Enterprise/*.vue` y las strings i18n (`nav.enterprise`, bloque `enterprise.*` en los 3 locales) | Re-aplicar si upstream reintroduce/toca esas entradas: eliminar el `path: 'enterprise'` del router y el ítem `path: '/enterprise'` de `MainLayout.vue`. Si upstream borra/reescribe `views/Enterprise/`, aceptar su versión (no la usamos). ⚠️ NO confundir con el grupo de canales "enterprise" de `ChannelTypePicker.vue` (categoría IM empresarial, esa SÍ se mantiene) |
| **Fix GPT-5 en chat (`max_tokens` → `max_completion_tokens`, 2026-08-26)** — bug del código base: `ReasoningNode.buildChatOptions` enviaba `max_tokens` para todos los modelos OpenAI-compatibles, pero OpenAI rechaza `max_tokens` para la familia gpt-5* con 400 (`Unsupported parameter: 'max_tokens'... Use 'max_completion_tokens' instead`). El Wiki sí lo respetaba (vía `ModelFamily.suppressMaxTokens()`), el chat del agente no. Fix centralizado: método `OpenAiRequestRewriter.translateMaxTokensForGpt5()` (safety net que convierte `max_tokens` → `max_completion_tokens` cuando `request.model()` es `gpt-5*`) aplicado en los 2 puntos de salida de `OpenAiCompatibleChatModelBuilder` (`chatCompletionEntity` y `chatCompletionStream`). Test nuevo `TranslateMaxTokensForGpt5Test` (6 casos). Se arregló además un test roto preexistente (`ConversationControllerBatchDeleteTest`: constructor sin `ModelConfigService`) que bloqueaba `mvn test` | **Baja superficie**: `OpenAiRequestRewriter` (método nuevo aditivo) + 2 líneas en `OpenAiCompatibleChatModelBuilder` + 2 tests. Re-aplicar si upstream toca el rewriter o el builder. Verificado en vivo: chat con gpt-5-mini responde con citas `[n]` + `Fuentes:` sin 400 |
| *(futuro)* `mateclaw-ui/...` | Título, i18n `es-ES`, textos visibles | Archivos aditivos (`es-ES.ts`) = sin conflicto; textos en `en-US.ts`/`zh-CN.ts` = re-aplicar |

### Sustituciones de branding (apply después de cada merge si hace falta)

```bash
# Prosa de marca en README (NO toca rutas lowercase ni nombres de módulos)
sed -i 's/MateClaw/AuraClaw/g' README.md
```

> ⚠️ **No renombrar** por ahora: paquetes Java (`vip.mate.*`), nombres de módulos Maven,
> artefactos/JARs, esquema de BD, contenedores docker, variables de entorno (`MATECLAW_*`),
> nombres de archivos de logo (`mateclaw_logo_*.png` — se reemplaza solo el CONTENIDO).
> Son identificadores internos invisibles al usuario final y cambiarlos genera conflictos
> en cada merge sin beneficio visible.

## 3. Procedimiento de actualización (cuando upstream publique una versión estable)

```bash
# 1. Traer lo nuevo del oficial (tags + ramas)
git fetch upstream --tags

# 2. Ver qué versión estable nueva existe
git tag | sort -V | tail -5          # ej: v2.2.0

# 3. Integrar en nuestra línea comercial (MERGE, nunca rebase)
git checkout main
git merge v2.2.0

# 4. Resolver conflictos (rerere re-aplica los de branding automáticamente;
#    para README.md: conservar nuestra versión y re-aplicar la sustitución)
sed -i 's/MateClaw/AuraClaw/g' README.md

# 5. Verificar build y tests
mvn -q compile -DskipTests -pl mateclaw-server -am
mvn test -pl mateclaw-server -Dtest='...'   # suite completa en CI

# 6. Publicar
git add -A && git commit -m "merge: integrate upstream v2.2.0"
git tag v2.2.0-mc.1                        # tag propio por versión integrada
git push origin main --tags
```

## 4. Checklist pre-release comercial

- [ ] Merge del tag estable más reciente (sección 3)
- [ ] Branding re-aplicado (README, UI, logos)
- [ ] `mvn test` (server) + `npm run test` (ui) verdes
- [ ] `git tag vX.Y.Z-mc.N` creado y pusheado
- [ ] Upgrade probado desde la versión anterior (migraciones Flyway `V9xx+` propias si las hay)
