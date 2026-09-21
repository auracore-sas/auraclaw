# 01 · Contexto y decisión

> Por qué integramos Pi en AuraClaw y por qué **no** construimos una plataforma "Pi Empresa" aparte.
> Este documento es el registro de la decisión; si el contexto cambia, se actualiza aquí primero.

---

## 1. El encargo original

Diseñar una solución de IA **open source** para una empresa de ~30 usuarios (directivos, gerentes,
personal operativo) con estas restricciones y requisitos:

| # | Requisito |
|---|---|
| 1 | Multiusuario con roles |
| 2 | Despliegue en VPS (nuestro infra) |
| 3 | Sin GPU — solo se paga API del LLM (DeepSeek / MiniMax / OpenAI) |
| 4 | Memoria y aprendizaje continuo, aislamiento por usuario |
| 5 | Análisis y redacción de documentos (docx, pdf, md, txt, xlsx, pptx) |
| 6 | Creación/edición de imágenes, análisis de datos |
| 7 | Llamadas a APIs externas, **MCP**, skills/plugins (correo, web, scraping) |
| 8 | Funciones de oficina (calendario, recordatorios) |
| 9 | ERP/CRM vía API o MCP |
| 10 | Español |
| 11 | **Solución web** (no escritorio), con agentes, workspaces, admin de miembros |
| 12 | **Telegram por usuario** (comunicación remota) |

Equipo IT: avanzado en programación agéntica (factor habilitante clave).

---

## 2. Qué se evaluó

| Proyecto | Veredicto para este encargo |
|---|---|
| **Open WebUI** | Muy completo, pero **sin Telegram nativo** y memoria básica |
| **LibreChat** | Mejor sistema de agentes+MCP, **sin Telegram nativo**, pesado de operar |
| **Dify** | Gran fábrica de agentes, pero **multi-tenant exige licencia Enterprise** |
| **AnythingLLM** | Buen RAG y documentos, pero **Telegram es single-user** (bloqueante) y su *Document Generation* no compone PDF con gráficas |
| **Octop** (Tencent) | El que mejor encaja de fábrica (multi-usuario + Telegram + MCP), pero su núcleo depende de librerías **closed-source** (`orcakit-harness-*`) |
| **Khoj / Letta / RAGFlow** | Complementos, no plataforma |
| **Pi** (earendil-works) | **No es plataforma**, es un **motor**. El más capaz para trabajo pesado (bash libre, vídeo, informes) |

Conclusión intermedia: **ningún producto cubría el 100%**, y el punto más débil común era
*Telegram multiusuario*. Esa es exactamente la pieza que AuraClaw **ya resolvió**.

---

## 3. El giro: AuraClaw ya existe y ya cubre la mayor parte

`auraclaw/` es un fork comercial de MateClaw con trabajo sustancial ya entregado:

- **~1.384 archivos Java / ~227.000 líneas** + **362 archivos Vue/TS**.
- **i18n español completo** (3.825 strings, 40 docs ~860 KB, seeds y prompts).
- **Telegram por miembro (V901)** con aislamiento de conversaciones por `owner_username`.
- **Voz entrante STT y gráficas nativas en Telegram (V902)**.
- **RBAC + audit + approval gate**, MCP verificado (PowerFin), Wiki con citas, memoria por `owner_key`.
- **Doc tools nativos**: `DocxRenderTool`, `XlsxRenderTool`, `PptxRenderTool`, `PdfRenderTool`,
  `HtmlImageRenderTool`, `OfficeCliTool`.
- Failover multi-proveedor (OmniRoute), CI/CD, y disciplina de fork (rerere, sync por tags).

Es decir: **la capa empresarial ya está construida y en producción interna.** Lo que falta no es
plataforma, es **capacidad de generación compleja**.

---

## 4. La decisión

### ❌ NO construir "Pi Empresa" como plataforma

Tres razones duras:

1. **Pi no es una plataforma.** No trae auth, RBAC, multi-tenant, audit, aprobaciones, canales,
   Wiki/RAG, consola admin ni i18n. Todo eso **ya lo tenemos** en AuraClaw. Reconstruirlo = meses/años
   y regresión.
2. **El multiusuario de Pi está a medias.** `pi-web-ui` es single-user; `pi-chat` da multiusuario
   *por canal* pero sin roles ni audit; `Gondolin`/`Chord` son experimentales. Es justo la capa que
   Pi **no** resuelve y que nosotros **sí** tenemos.
3. **Coste de oportunidad y dispersión.** Ya operamos AnythingLLM + AuraClaw. Una tercera plataforma
   es triple mantenimiento para un equipo pequeño.

### ✅ SÍ integrar Pi *dentro* de AuraClaw

**AuraClaw = el cuerpo. Pi = el motor pesado.**

Pi aporta exactamente lo que al grafo de agentes le cuesta: **bash arbitrario** para
`matplotlib` + `reportlab`/`weasyprint`, `ffmpeg`, `python-docx`/`openpyxl`/`python-pptx`,
scraping y análisis de datos — sin el techo de una skill rígida.

Y ya tenemos los ganchos probados:

- El puente **ACP** ya envuelve agentes externos (Claude Code / Codex) **como skills**
  (`AcpSkillWrapperToolFactory`, `AcpStdioClient`, `AcpDelegationService`).
- El **registro de tools** (`vip.mate.tool`, beans `@Tool`) es la vía estándar de extender (CODE_MAP, M3).
- El contrato **`AgentRuntimeProvider`** llega con upstream **v2.2.0** (rama `feature/upstream-v2.2.0`).

---

## 5. Principios de la integración

1. **Mínima superficie tocada.** Código en `com.auracore.*`; el upstream se toca lo justo y se registra.
2. **Empezar por el Camino A** (tool), no por el runtime. Menor riesgo, valor inmediato.
3. **Pi produce artefactos; AuraClaw los gobierna.** La entrega usa los mecanismos existentes
   (`SendFileTool`, `GeneratedFileCache`, `WorkspaceArtifactSurfacer`).
4. **El aislamiento no es opcional.** Pi ejecuta código: sandbox y política de red antes de producción.
5. **La aprobación manda.** Acciones sensibles pasan por el `approval gate` existente.
6. **Español de extremo a extremo**, respetando la regla de marcadores bilingüe.
7. **Todo verificable.** Cada fase cierra con prueba funcional en vivo, no solo CI verde.

---

## 6. Anti-objetivos (lo que NO haremos)

- ❌ No crearemos un portal web nuevo basado en Pi (`pi-web-ui` no entra en producción).
- ❌ No migraremos usuarios/canales/memoria a Pi.
- ❌ No expondremos Pi directamente a la red ni a los usuarios finales.
- ❌ No tocaremos el grafo de agentes para esto salvo necesidad demostrada y registrada.
- ❌ No introduciremos un motor JS dentro del runtime Java para el Camino A:
  Pi se invoca **como proceso externo** (CLI/RPC).

---

## 7. Criterio de reversión

Volver a evaluar esta decisión solo si se cumple **alguno** de estos:

- El upstream publica `harness-*`/equivalentes de forma que Pi pueda cubrir multiusuario con RBAC y
  auditoría **sin** mantener el fork.
- AuraClaw deja de ser viable (abandono del upstream o incompatibilidad de licencia).
- El volumen crece a un punto donde mantener el fork deja de compensar.

Mientras no ocurra, la ruta es **extender AuraClaw**.

→ Siguiente: [`02-ecosistema-pi.md`](./02-ecosistema-pi.md)
