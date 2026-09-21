# 03 · Arquitectura de integración

> Cómo se enchufa Pi en AuraClaw. Define los puntos de enganche, los dos caminos (A y B) y el
> contrato de artefactos. El detalle de cada camino vive en `04` y `05`.

---

## 1. Principio rector

```
┌──────────────────────────────────────────────────────────────────────┐
│                            AuraClaw (Java)                            │
│                                                                       │
│  Usuarios · RBAC · Audit · Approvals · Canales IM · Wiki · Memoria    │
│  Workspaces · i18n español · Consola admin · Doc tools                │
│                                                                       │
│      "empleado digital" (StateGraph)                                  │
│              │                                                        │
│              │  invoca una tool / delega                              │
│              ▼                                                        │
│      ┌───────────────────┐        ┌──────────────────────────────┐    │
│      │  Camino A          │        │  Camino B (v2.2.0+)         │    │
│      │  tool `pi_worker`  │        │  AgentRuntimeProvider = Pi   │    │
│      └─────────┬─────────┘        └──────────────┬───────────────┘    │
└────────────────┼──────────────────────────────────┼───────────────────┘
                 │  proceso externo (CLI / RPC)      │
                 ▼                                    ▼
        ┌────────────────────────────────────────────────────┐
        │                     Pi (MIT)                        │
        │   bash · read · write · edit · skills · MCP         │
        │   sandbox (Gondolin o contenedor)  ·  LLM vía API   │
        └────────────────────────────────────────────────────┘
                 │
                 ▼  artefactos (PDF, DOCX, XLSX, PPTX, PNG, MP4…)
        AuraClaw los recoge y los entrega (SendFileTool)
```

**La clave:** Pi nunca ve usuarios, permisos ni la base de datos. Solo recibe una tarea, ejecuta y
devuelve ficheros. AuraClaw conserva el gobierno.

---

## 2. Puntos de enganche en AuraClaw

Referencias: `docs/CODE_MAP.md` (Módulos 1, 3, 6, 7) y `docs/CUSTOMIZATIONS.md`.

| Necesidad | Punto de enganche existente | Módulo |
|---|---|---|
| Añadir capacidad al agente | **Registro de tools** (`vip.mate.tool`, beans `@Tool`) | M3 |
| Controlar qué tools ve el modelo | Filtro de *disclosure* en build-time | M1/M3 |
| Controlar qué tools puede llamar | **Tool Guard** en call-time | M3 |
| Pausar acciones sensibles | **Approval gate** (`ApprovalService`, `PendingApproval`) | M6 |
| Entregar ficheros al usuario | `SendFileTool`, `GeneratedFileCache`, `WorkspaceArtifactSurfacer` | M3 |
| Precedente de agente externo | **Puente ACP** (`AcpStdioClient`, `AcpDelegationService`) | M7 |
| Envolver un agente externo como skill | `AcpSkillWrapperToolFactory` | M7 |
| Runtime enchufable | **`AgentRuntimeProvider`** (upstream **v2.2.0**) | M1 |
| Aislar ejecución | Sandbox de workspace / contenedor | M2 |
| Registrar el cambio | `docs/CUSTOMIZATIONS.md` | — |

> El **puente ACP** es el precedente más valioso: ya demuestra que AuraClaw sabe orquestar un proceso
> externo de agente y exponerlo. La integración de Pi sigue el mismo patrón.

---

## 3. Los dos caminos

| | **Camino A — tool `pi_worker`** | **Camino B — runtime Pi** |
|---|---|---|
| Qué es | Una tool que invoca Pi para una tarea concreta | Un `AgentRuntimeProvider` que ejecuta el turno completo en Pi |
| Complejidad | Baja | Media |
| Superficie tocada | Tool nueva en `com.auracore.*` | Contrato v2.2.0 + runtime |
| Cuándo | **Ahora** | Tras merge de v2.2.0 |
| Riesgo | Bajo | Medio (runtime externo por proceso) |
| Valor | Cierra el hueco de PDF/gráficas/vídeo/Office **ya** | Habilita "empleados" con motor Pi |
| Detalle | [`04`](./04-camino-a-tool-pi-worker.md) | [`05`](./05-camino-b-pi-agent-runtime-provider.md) |

**Decisión: hacer A primero. B solo si A demuestra que merece la pena.** No se construyen los dos a
la vez.

---

## 4. Modelo de ejecución (común a A y B)

1. AuraClaw construye una **tarea** (prompt + contexto + ficheros de entrada + política).
2. Lanza **Pi como proceso hijo** (CLI `-p` en v1; `--mode rpc` en v2).
3. Pi ejecuta dentro de un **sandbox** (ver `06`).
4. Pi escribe artefactos en una **carpeta de salida conocida**.
5. AuraClaw **valida y entrega** los artefactos por los canales existentes.
6. Se registra en **audit** y se consume **token/coste** con el mismo criterio que el resto.

**No negociable:** el proceso Pi se invoca con *allow-list* de tools, sin red abierta por defecto y
sin secretos en claro.

---

## 5. Contrato de artefactos (propuesta)

Pi trabaja con una **raíz de trabajo efímera** por invocación:

```
<workspace>/.pi-jobs/<jobId>/
├── in/           # entradas que AuraClaw copia (documentos, imágenes, CSV…)
├── work/         # cwd de Pi (scripts, intermedios)
├── out/          # SOLO aquí se recogen artefactos para el usuario
└── job.json      # metadatos: prompt, tools permitidas, límites, resultado
```

Reglas:

- **Solo `out/` se publica.** Todo lo demás se descarta al terminar.
- Tipos permitidos: `pdf, docx, xlsx, pptx, md, txt, csv, png, jpg, svg, mp4, webm, json`.
- Tamaño máximo por artefacto y por job (configurable).
- Un artefacto sin dueño claro (`owner_key`) no se entrega.

---

## 6. «Quiero… → Voy a…»

| Quiero… | Voy a… |
|---|---|
| Añadir Pi como capacidad | Camino A: bean `@Tool` en `com.auracore.tool.pi` ([`04`](./04-camino-a-tool-pi-worker.md)) |
| Que un "empleado" corra sobre Pi | Camino B: `AgentRuntimeProvider` en v2.2.0 ([`05`](./05-camino-b-pi-agent-runtime-provider.md)) |
| Aislar la ejecución de Pi | [`06`](./06-seguridad-aislamiento-y-operacion.md) (sandbox + red) |
| Que un informe salga con gráficas | [`07`](./07-casos-de-uso-y-recetas.md) §2 |
| Controlar coste de Pi | `06` §6 (límites, modelo dedicado, `usage_scope`) |
| Registrar el cambio | `docs/CUSTOMIZATIONS.md` + [`08`](./08-plan-de-ejecucion-y-roadmap.md) §F0 |

---

## 7. Gotchas

- **No tocar el grafo.** `AgentGraphBuilder` / `*Node` / `*Dispatcher` son superficie caliente de
  merge (CODE_MAP M1). La tool se registra por el mecanismo estándar, sin editar el ensamblador.
- **Dos "memorias".** Pi no debe escribir en la memoria de AuraClaw; la memoria la sigue gestionando
  `MemoryLifecycleMediator`. Pi es efímero.
- **Dos "MCP".** No confundir el MCP de AuraClaw (per-agent binding) con el MCP interno de Pi.
- **Proceso externo = gestión de errores.** Timeout, salida parcial, proceso zombi y limpieza de la
  raíz de trabajo deben estar cubiertos y probados.
- **Regla de marcadores bilingüe.** Si Pi emite texto que AuraClaw parsea, respetar
  `CUSTOMIZATIONS.md` (variantes legacy + español).

→ Siguiente: [`04-camino-a-tool-pi-worker.md`](./04-camino-a-tool-pi-worker.md)
