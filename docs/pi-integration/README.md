# Integración de Pi en AuraClaw — Índice

> Documentación de la integración **nativa** de [Pi](https://pi.dev) (harness de agentes, MIT)
> dentro de **AuraClaw** (fork comercial de MateClaw, Apache-2.0).
>
> Ámbito: `auracore-apps/auraclaw` · Zona de código propia: `com.auracore.*`
> Estado: 📐 **Diseño / plan aprobado pendiente de implementar**
> Autor: equipo Auracore SAS · Idioma: español neutro

---

## Decisión en una línea

> **Pi no sustituye a AuraClaw. Pi se integra *dentro* de AuraClaw como motor de trabajo pesado.**
>
> AuraClaw es el **cuerpo empresarial** (usuarios, RBAC, audit, aprobaciones, canales, Wiki,
> memoria, documentos, i18n español). Pi es el **motor** para lo que el grafo de agentes no debe
> intentar hacer solo: informes con gráficas, vídeo, análisis de datos y generación de ficheros
> complejos vía *bash* arbitrario.

La decisión completa y por qué **no** construimos una plataforma "Pi Empresa" aparte están en
[`01-contexto-y-decision.md`](./01-contexto-y-decision.md).

---

## Mapa de lectura

| # | Documento | Para qué sirve |
|---|---|---|
| 01 | [`01-contexto-y-decision.md`](./01-contexto-y-decision.md) | El encargo, lo evaluado, la decisión y sus principios |
| 02 | [`02-ecosistema-pi.md`](./02-ecosistema-pi.md) | Qué es Pi hoy: modos, SDK, RPC, skills, MCP, hermanos, licencia |
| 03 | [`03-arquitectura-de-integracion.md`](./03-arquitectura-de-integracion.md) | Puntos de enganche en AuraClaw y los dos caminos (A y B) |
| 04 | [`04-camino-a-tool-pi-worker.md`](./04-camino-a-tool-pi-worker.md) | **Camino A**: la tool `pi_worker` (especificación) |
| 05 | [`05-camino-b-pi-agent-runtime-provider.md`](./05-camino-b-pi-agent-runtime-provider.md) | **Camino B**: un `AgentRuntimeProvider` respaldado por Pi (v2.2.0+) |
| 06 | [`06-seguridad-aislamiento-y-operacion.md`](./06-seguridad-aislamiento-y-operacion.md) | Sandbox, secretos, Tool Guard, aprobaciones, red, coste |
| 07 | [`07-casos-de-uso-y-recetas.md`](./07-casos-de-uso-y-recetas.md) | Recetas concretas (PDF con gráficas, vídeo, Office, datos…) |
| 08 | [`08-plan-de-ejecucion-y-roadmap.md`](./08-plan-de-ejecucion-y-roadmap.md) | Fases, ficheros a tocar, criterios de aceptación, riesgos |
| 09 | [`09-referencias.md`](./09-referencias.md) | Enlaces, rutas locales y glosario |

Orden recomendado de lectura: **01 → 03 → 04 → 06 → 07 → 08**. Los demás son consulta.

---

## Convenciones de esta integración

Estas reglas son **obligatorias** y coherentes con `docs/CUSTOMIZATIONS.md` y `docs/CODE_MAP.md`:

1. **Código propio en `com.auracore.*`** — no ensuciar `vip.mate.*` (núcleo del upstream) más de lo
   imprescindible. Menos superficie tocada = menos conflictos en cada merge.
2. **Preferir un `@Tool` antes que tocar el grafo.** `AgentGraphBuilder` y los `*Node`/`*Dispatcher`
   son la *superficie caliente* de merges (ver `CODE_MAP.md`, Módulo 1). La integración base va por
   el registro de tools (Módulo 3), no por el grafo.
3. **Registrar cada cambio en `docs/CUSTOMIZATIONS.md`** con su "manejo de conflicto en merge".
4. **La IA habla español.** Prompts, mensajes de error y artefactos que produce Pi deben respetar la
   regla de marcadores (bilingüe-tolerante) de `CUSTOMIZATIONS.md`.
5. **Nada de secretos en claro.** Ni en el prompt, ni en argumentos de línea de comandos, ni en logs.
6. **Verificación funcional en vivo** antes de declarar algo "listo" (lección de la sesión 12ª-b:
   el bug #334 pasó ~5.000 tests y lo encontró el uso real).

---

## Glosario rápido

| Término | Significado en este contexto |
|---|---|
| **Pi** | Harness de agentes de terminal y toolkit (`@earendil-works/pi-coding-agent`, MIT) |
| **Camino A** | Pi invocado como **tool/skill** desde un agente de AuraClaw (bajo riesgo) |
| **Camino B** | Pi como **runtime** de un "empleado digital" (contrato v2.2.0, patrón DSH) |
| **Artefacto** | Fichero producido por Pi (PDF, DOCX, XLSX, PPTX, PNG, MP4…) |
| **`pi_worker`** | Nombre de la tool del Camino A (propuesta) |
| **DSH** | *DeepSeek Harness* — runtime externo por JSON-RPC que ya trae el upstream v2.2.0 |
| **Gondolin** | Sandbox micro-VM de Pi (aislamiento de ejecución, red y secretos) |
| **`AgentRuntimeProvider`** | Contrato de runtime enchufable introducido en upstream v2.2.0 |
| **Zona caliente** | Ficheros del upstream con alto conflicto de merge (nodes/dispatchers/grafo) |

---

## Estado de implementación

| Camino | Estado | Fase |
|---|---|---|
| A — tool `pi_worker` | 📐 Diseñado, no implementado | [08](./08-plan-de-ejecucion-y-roadmap.md) §F1 |
| B — runtime Pi | 📐 Diseñado, bloqueado por merge de v2.2.0 | [08](./08-plan-de-ejecucion-y-roadmap.md) §F3 |
| Documentación | ✅ Esta carpeta | — |
| Registro en `CUSTOMIZATIONS.md` | ✅ Hecho (2026-09-19) | [08](./08-plan-de-ejecucion-y-roadmap.md) §F0 |

> Al cerrar cada fase, actualizar esta tabla y `docs/NEXT_SESSION.md`.
