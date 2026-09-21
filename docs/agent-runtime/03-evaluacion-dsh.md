# 03 · Evaluación de DSH (DeepSeek Harness)

> Spike ejecutado el 2026-09-21. Resultado: **DSH es viable hoy en AuraClaw por una vía no
> documentada**, y es 4–6× más rápido que el grafo nativo con el mismo modelo.
>
> Los tres desajustes entre la documentación del upstream y la realidad del proyecto DSH están
> verificados y se listan aquí — son la parte más valiosa de este documento.

---

## 1. Qué es DSH (datos verificados contra GitHub)

| Dato | Valor |
|---|---|
| Repositorio | `github.com/deepseek-ai/deepseek-harness` (público) |
| Descripción | *"DeepSeek Harness: Everything is a Plugin."* |
| Licencia | **MIT** |
| Estrellas / forks | **232.285** / 27.867 |
| Lenguaje / base | TypeScript sobre [Cordis](https://github.com/cordiverse/cordis) |
| Última release | `dsh-v0.1.6-alpha.2` (2026-09-17) — **18 releases, 0 assets, todas prerelease** |
| Paquete npm | `@deepseek-ai/dsh` (bin `dsh`) — `latest` = `0.1.5-rc.2`, `alpha` = `0.1.6-alpha.2` |
| Paquetes del monorepo | **60** |

**Advertencia del propio README** (textual): *"DeepSeek Harness is in developer preview and iterating
rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**"*

Paquetes relevantes para nuestra operativa: `shell`, `terminal`, `subprocess`, `fs`, `sandbox`,
`skill`, `subagent`, `mcp`, `acp`, `browser-use`, `computer-use`, `workflow`, `schedule`, `webhook`,
`jobs`, `goal`, `plan`, `todo`, `guard`, `compaction`, `lsp`, `document`, `deliverables`, `session`.

### 1.1 DSH no es solo DeepSeek

`packages/llm/llm-pi-ai` (`@deepseek-ai/dsh-llm-pi-ai`) depende de **`@earendil-works/pi-ai`** — la
misma capa de modelos que usa **Pi**. Su README: *"routes model requests to multiple pi-ai providers,
OpenAI-compatible gateways, or self-hosted servers"*.

Es decir: **DSH y Pi comparten la capa de modelos**. Lo que es DeepSeek-específico es el *puente* de
MateClaw (inyecta `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` y usa la ruta `deepseek-official`), no DSH.

---

## 2. El spike: el build, medido

Entorno: 8 cores, Node v26.2.0, pnpm 11.7.0, 50 GB libres.

```bash
git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git /tmp/dsh-spike
cd /tmp/dsh-spike
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile     # 1,4 GB de node_modules
pnpm run build                     # ~5,5 min
```

Resultado: **compila**. Pero:

```
$ ls dist-exe/
ls: cannot access 'dist-exe/': No such file or directory
```

**`pnpm run build` no produce el artefacto que AuraClaw espera.**

---

## 3. Los tres desajustes doc ↔ realidad

### 3.1 El artefacto tiene otro nombre y otro pipeline

`docs/pi-integration/05` y el doc del upstream dicen que el build entrega:

```
<dsh-root>/dist-exe/dsh-jsonrpc-agent-pkg-<platform>
```

La realidad, verificada:

| | Valor |
|---|---|
| Nombre real del ejecutable | **`dist-exe/deepseek-harness-sdk-runtime-<platform>-<arch>`** |
| Script real que lo produce | **`scripts/build-exe-for-python-sdk.ts`** (no `pnpm run build`) |
| Qué hace | verificar clausura → `pnpm --filter dsh-python-runtime-closure deploy --legacy --prod` → materializar symlinks → `node-pty` por target → **`pkg --sea`** por target |
| Dónde se usa | `.github/workflows/build-exe-for-python-sdk.yml` (`--targets=…`) |

`pnpm run build` solo hace `build:lib:host` + `build:lib:client` + `build:native-system` + web.

Y `DshArtifactInstaller.java:171` exige un fichero llamado **exactamente** `dsh-jsonrpc-agent`:

```java
.filter(path -> path.getFileName().toString().equals("dsh-jsonrpc-agent"))
.orElseThrow(() -> new IllegalStateException("DSH artifact has no dsh-jsonrpc-agent executable"));
```

### 3.2 `DSH_CORDIS_CONFIG` no lo lee DSH

```bash
grep -rn 'DSH_CORDIS_CONFIG' --include='*.ts' --include='*.mjs' /tmp/dsh-spike   # → 0 resultados
```

Cero referencias en los 60 paquetes. **DSH ignora esa variable.** Es un contrato del wrapper
`dsh-jsonrpc-agent` que el upstream construye (o construyó) por su cuenta. En nuestro runtime,
`DshRuntimeService` la **valida y la inyecta** en el hijo, pero el DSH real no la usa → es config
muerta para la vía pública.

### 3.3 El auto-instalador no puede funcionar

`DshArtifactInstaller` descarga desde `api.github.com/repos/deepseek-ai/deepseek-harness/releases/latest`
y busca un asset `*macos*arm64*` con digest `sha256:`. Comprobado:

| | Resultado |
|---|---|
| Releases | **18** |
| Assets totales en todas | **0** |
| Prerelease | todas |

Por eso el código tiene una segunda vía, `privateManifestConfigured()`. Es decir: **el artefacto lo
distribuye el upstream por un canal privado**, no desde el repo público.

> **Consecuencia práctica:** el camino "botón Instalar" de la consola de DSH **no puede funcionar**
> contra las fuentes públicas. Hay que instalar a mano. La buena noticia es que hay una vía mucho
> más simple.

---

## 4. La vía corta que **sí** funciona

DSH se puede ejecutar directamente desde el árbol compilado, sin `pkg --sea` ni `dist-exe`:

```bash
node /tmp/dsh-spike/apps/cli/lib/bin.js --help
```

```
Usage: dsh [--profile] <name> [options] [app-args...]
…
Examples:
  dsh web       boot the web profile (same as: dsh --profile web)
```

Y el perfil que necesitamos:

```bash
node /tmp/dsh-spike/apps/cli/lib/bin.js --profile sdk --help
```

```
Usage: dsh --profile sdk [options]
Serve DeepSeek Harness SDK clients over stdio JSON-RPC.
```

**El servidor JSON-RPC que AuraClaw necesita es un perfil del CLI.** No hace falta el ejecutable
empaquetado.

### 4.1 Por qué AuraClaw puede apuntarse a esto sin tocar Java

`DshRuntimeService.commandLine()` (`:420`) es un tokenizador **tipo shell** (comillas y escapes), y
`validate()` (`:111`) solo exige que `argv[0]` sea **absoluto y ejecutable**. Por tanto:

```bash
DSH_JSONRPC_AGENT="/usr/bin/node /ruta/al/dsh/apps/cli/lib/bin.js --profile sdk --patch /ruta/llm-deepseek.patch.yml"
```

cumple la validación. **No hay que escribir código Java.**

### 4.2 La composición: hay que montar el adaptador de LLM

El perfil `dsh-base` monta `@deepseek-ai/dsh-deepseek-llm-api-extensions` y `@deepseek-ai/dsh-llm`
pero **no el adaptador**. Sin él, la respuesta es:

```json
{"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"no adapter registered for provider \"deepseek\""}}
```

El patch que lo resuelve (`/tmp/dsh-llm.patch.yml`):

```yaml
- insert:
    - id: llm-deepseek
      name: '@deepseek-ai/dsh-llm-deepseek'
```

### 4.3 El puente de AuraClaw ya apunta al nombre de ruta correcto

`DshRuntimeService.java:286` envía `"provider": "deepseek-official"` **hardcodeado**. Y en DSH:

```
packages/llm/llm-deepseek/src/index.ts:57:  const PROVIDER = 'deepseek-official'
```

**Coinciden exactamente.** El puente de AuraClaw fue escrito contra una composición que monta
`dsh-llm-deepseek`. Es decir: **el puente está bien**; lo que faltaba era el `cordis.yml`/patch y el
binario con el nombre que MateClaw inventó.

---

## 5. Handshake verificado

```
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"cwd":"…","provider":"deepseek-official","model":"deepseek-v4-flash","maxTokens":4096}}
← {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"deepseek-harness-sdk-runtime","version":"0.0.1"}}}
```

El nombre `deepseek-harness-sdk-runtime` es el **wire-stable** documentado en
`packages/sdk/protocol/src/types.ts`. Es la identidad que AuraClaw espera.

---

## 6. Test end-to-end con el mismo prompt

Ejecutado con `deepseek-v4-flash` real, la **misma pregunta** del caso reportado.

### 6.1 Resultado

| Métrica | **DSH** | Nativo (DeepSeek Flash) | Nativo (GPT-5-mini) |
|---|---|---|---|
| **Turno completo** | **37–58 s** | 241,5 s | 329,5 s |
| **Iteraciones** | **9** (`step/start`) | 62 | 29 |
| **Tool calls** | **15** | 70 | 29 |
| Fuentes citadas | 4 (UN WPP 2024, Worldometer, StatisticsTimes) | ok | sin gráfica |

Con el **mismo modelo**, DSH fue **4–6× más rápido con 7× menos iteraciones** y una respuesta mejor
documentada (4,17 MM hombres / 4,13 MM mujeres / 8,3 MM total, con la matización de personas
intersexuales y oferta de seguimiento).

### 6.2 Herramientas que usó DSH

`web_search`, `web_fetch` y —dato relevante— **`web/deepseek-search-llm-request`** (búsqueda
integrada de DeepSeek), 9 veces. **Usa sus propias herramientas**, no las de AuraClaw.

### 6.3 Gobernanza que trae de fábrica

En UNA sola corrida aparecieron estos tipos de evento, ya normalizados por el protocolo:

```
permission/preset · sandbox/mode · approval/policy · turn/start · step/start · step/end
assistant/message · tool/call · tool/result · request/context · session/title · turn/end
```

Es decir: **permisos, sandbox y política de aprobación son primitivas del runtime**, no algo que
haya que inventar. Eso encaja con `DshToolPolicyEvaluator` del lado de AuraClaw (ver `04`).

---

## 7. ⚠️ El defecto que bloquea usarlo como "empleado"

En **nuestro `main`**, `DshRuntimeService.java`:

```java
// :245
String dshSessionId = conversationId + "-" + UUID.randomUUID();

// :296-298
send(writer, request("session/prompt", promptId, Map.of(
        "sessionId", dshSessionId,
        "contentBlocks", List.of(Map.of("type", "text", "text", message)))));
```

Dos problemas:

1. **`sessionId` es nuevo y aleatorio en cada turno** → DSH nunca ve la misma sesión dos veces.
2. **Solo se envía el mensaje actual** → cero historial.

**Resultado: un empleado DSH no tiene memoria entre turnos.** Tal cual está hoy, no puede sostener una
conversación de oficina.

> El doc del upstream describe *"up to 40 recent completed user/assistant text messages … within a
> 4096 estimated-token history budget"*. Esa funcionalidad **viene de un commit más nuevo** y **no
> está en nuestro `main`**. Se re-verificó el código: no hay ninguna constante ni consulta de
> historial en el paquete `runtime/dsh/`.

Arreglo: enviar el historial reciente en `contentBlocks` + `sessionId` estable por conversación.
Cambio pequeño, **pero vive en código del upstream** → se registra en `CUSTOMIZATIONS.md` con su
manejo de conflicto (ver [`05`](./05-plan-de-mejoras.md) §M3).

---

## 8. Veredicto

| Pregunta | Respuesta |
|---|---|
| ¿DSH es una tecnología seria? | Sí: MIT, 232 K ★, 60 paquetes, activa, con gobernanza integrada. |
| ¿El provider de AuraClaw sirve? | Sí, completo y coherente (incluido el nombre de ruta). |
| ¿Funciona la instalación documentada? | **No.** Tres desajustes verificados (§3). |
| ¿Hay vía alternativa? | **Sí**, verificada end-to-end: `--profile sdk` + patch (§4). |
| ¿Es más rápido? | **Sí:** 37–58 s y 9 iteraciones frente a 241 s y 62. |
| ¿Listo para producción tal cual? | **No:** falta el historial (§7) y el puente de tools (`04`). |
| ¿Riesgo principal? | Es **v0.1.x** con cambios rompientes anunciados por el propio proyecto. |

**Coste de adopción real:** un patch YAML + un arreglo de historial + el puente de tools. **Cero
clases Java nuevas** (a diferencia del camino Pi, que necesita ~6).

---

→ Siguiente: [`04-comparativa-runtimes.md`](./04-comparativa-runtimes.md).
