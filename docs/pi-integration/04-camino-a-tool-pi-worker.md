# 04 · Camino A — Tool `pi_worker`

> Especificación de la primera integración: una **tool** que invoca a Pi como proceso externo para
> producir uno o varios **artefactos** (PDF con gráficas, DOCX/XLSX/PPTX, imágenes, vídeo…).
>
> Estado: 📐 Diseño · Riesgo: **bajo** · Es la vía recomendada para empezar.

---

## 1. Objetivo

Dar a cualquier "empleado digital" de AuraClaw la capacidad de **delegar trabajo pesado de
generación** a Pi, sin tocar el grafo de agentes ni el modelo de usuarios.

**Caso motor:** hoy `PdfRenderTool` convierte Markdown→PDF y **no embebe gráficas** (verificado:
cero referencias a imagen/chart/png). Pi sí lo hace con `matplotlib` + `reportlab`/`weasyprint`.

---

## 2. Ubicación y nombre

| Elemento | Valor |
|---|---|
| Paquete | `com.auracore.tool.pi` (zona propia — no ensucia `vip.mate.*`) |
| Clase | `PiWorkerTool` |
| Registro | Bean `@Tool` descubierto por `ToolRegistry` (CODE_MAP, M3) |
| Documentación | `docs/pi-integration/04-camino-a-tool-pi-worker.md` (este fichero) |

> Verificar que el *component-scan* de Spring cubre `com.auracore` (ya existe la zona propia del fork).
> Si no lo cubriera, añadir el paquete al escaneo es un cambio mínimo y **registrable**.

---

## 3. Contrato de la tool

Propuesta de firma (a ajustar al estilo de las tools existentes en `vip.mate.tool.builtin`):

```java
@Tool(name = "pi_worker",
      description = "Delega a Pi una tarea de generación compleja (informes con gráficas, "
                  + "documentos Office, imágenes, vídeo, análisis de datos). Devuelve los "
                  + "artefactos generados.")
public ToolResult piWorker(
        @ToolParam(description = "Objetivo en lenguaje natural, detallado") String task,
        @ToolParam(description = "Tipo(s) de artefacto esperado: pdf, docx, xlsx, pptx, png, mp4…",
                   required = false) List<String> expectedArtifacts,
        @ToolParam(description = "Rutas de entrada dentro del workspace para usar como material",
                   required = false) List<String> inputFiles,
        @ToolParam(description = "Perfil de ejecución: 'report', 'office', 'media', 'data'",
                   required = false) String profile
) { … }
```

**Salida:** lista de artefactos (nombre, mime, ruta en `out/`, tamaño) + resumen textual + `jobId`.
La entrega al usuario la hace la infraestructura existente (`SendFileTool` /
`WorkspaceArtifactSurfacer`), no la tool.

---

## 4. Modos de invocación

| Versión | Mecanismo | Ventajas | Cuándo |
|---|---|---|---|
| **v1** | `pi -p "<task>"` (print/JSON) | Trivial de implementar | F1 |
| **v2** | `pi --mode rpc` (JSONL stdio) | Streaming, cancelación, progreso | F2 |

Empezar por **v1** y migrar a **v2** cuando haga falta cancelar/progresar en vivo.

---

## 5. Configuración (propuesta)

```yaml
auracore:
  pi:
    enabled: true
    binary: /usr/local/bin/pi         # pin de ruta absoluta (nunca del PATH del usuario)
    version: "0.85.1"                 # versión fijada y verificada
    provider: deepseek                # o minimax / openai (ver 06 §6)
    model: deepseek-v4-flash
    mode: print                       # print | rpc
    timeout-seconds: 600
    max-artifact-mb: 50
    max-jobs-concurrent: 2
    sandbox: gondolin                 # gondolin | container | none(dev)
    allow-network: true               # requiere allow-list de hosts (ver 06)
    profiles:                         # presets de tools/skills por caso de uso
      report: { tools: [read, write, edit, bash], skills: [informe-ejecutivo] }
      office: { tools: [read, write, edit, bash], skills: [office-docs] }
      media:  { tools: [read, write, bash],         skills: [video-educativo] }
      data:   { tools: [read, write, edit, bash],   skills: [analisis-datos] }
```

---

## 6. Flujo de ejecución

```
agnóstico del modo:
1. Tool Guard evalúa la llamada (¿puede este agente invocar pi_worker?)   [M3]
2. (si aplica) Approval gate pausa y pide autorización                    [M6]
3. Crear raíz  <workspace>/.pi-jobs/<jobId>/{in,work,out}
4. Copiar inputFiles a in/  (validando ruta dentro del workspace)         [M2]
5. Construir el prompt + --append-system-prompt con la política de empresa
6. Lanzar Pi como proceso hijo, cwd = work/, sandbox activo               [06]
7. Recolectar salida (stdout/JSON o eventos RPC)
8. Validar out/ (tipos permitidos, tamaño, owner_key)
9. Registrar en audit + contabilizar tokens/coste
10. Devolver manifold: artefactos + resumen
11. Limpiar in/ y work/ (conservar out/ el tiempo de retención)
12. En caso de timeout/fallo: matar el árbol de procesos y limpiar        [06 §5]
```

---

## 7. Skills que shipearíamos

Pi aprende procedimientos por **Skills** (`SKILL.md` + scripts). Propuesta inicial:

| Skill | Produce | Baseline |
|---|---|---|
| `informe-ejecutivo` | PDF con portada, secciones, **gráficas embebidas**, tablas | matplotlib + reportlab/weasyprint |
| `office-docs` | DOCX / XLSX / PPTX con formato y datos | python-docx / openpyxl / python-pptx |
| `video-educativo` | MP4 (narración + slides + subtítulos) | ffmpeg (+ TTS opcional) |
| `analisis-datos` | CSV/XLSX + gráficas + informe | pandas + matplotlib |
| `officecli` (referencia) | Ya existe `OfficeCliTool` en AuraClaw; evaluar solape | — |

> Las skills **no** van al paquete Java: se despliegan como ficheros versionados en una carpeta
> `pi-skills/` del repo y se montan en el sandbox. Se registran en `CUSTOMIZATIONS.md`.

---

## 8. Integración con las piezas existentes

| Pieza | Cómo la usamos |
|---|---|
| **Disclosure** (build-time) | La tool solo se expone a agentes/perfiles donde tenga sentido |
| **Tool Guard** (call-time) | Regla explícita para `pi_worker`; capacidades por rol |
| **Approval gate** | `pi_worker` es candidata natural a aprobación previa (ejecuta código) |
| **Artefactos** | `out/` → `SendFileTool` / `GeneratedFileCache` / `WorkspaceArtifactSurfacer` |
| **Audit** | Un registro por job: quién, agente, prompt-resumen, artefactos, coste |
| **RBAC** | `@RequireWorkspaceRole` si se expone algún endpoint de gestión del worker |
| **Memoria** | **Pi no escribe memoria.** AuraClaw sigue mandando (`MemoryLifecycleMediator`) |

---

## 9. Ejemplo de uso (desde el chat)

> **Usuario:** *"Genera el informe trimestral de ventas con gráficas de evolución y comparativa por
> región, y entrégamelo en PDF y PPTX."*
>
> El agente llama a `pi_worker(task=…, expectedArtifacts=["pdf","pptx"], inputFiles=["datos/ventas.xlsx"], profile="report")`
> → Pi instala/usa matplotlib, genera las gráficas, compone el PDF y el PPTX → AuraClaw los entrega
> como ficheros adjuntos en el chat y guarda el `jobId` en audit.

---

## 10. Tests

| Nivel | Qué cubre |
|---|---|
| Unit | Construcción de la tarea, validación de rutas, perfiles, parseo de salida |
| Integración (mock de Pi) | Flujo completo con un binario `pi` falso que escribe un PDF en `out/` |
| Integración (real, opcional) | Job real con red restringida y proveedor de prueba |
| Seguridad | Rechazo de rutas fuera del workspace; bloqueo de host no permitido |
| Robustez | Timeout, proceso zombi, salida corrupta, `out/` vacío |

Siguiendo `AGENTS.md` §4bis: **tests dirigidos** durante el desarrollo; **suite completa** antes de release.

---

## 11. Criterios de aceptación (F1)

- [ ] `pi_worker` aparece en el catálogo de tools y es filtrable/ocultable por disclosure.
- [ ] Genera un **PDF con al menos una gráfica embebida** a partir de un XLSX de entrada (caso motor).
- [ ] Genera DOCX **y** PPTX desde el mismo job.
- [ ] Los artefactos se entregan por el chat y quedan visibles para el dueño correcto.
- [ ] Timeout y cancelación dejan el sistema limpio (sin procesos ni ficheros huérfanos).
- [ ] Audit registra el job; el coste entra en el panel por usuario.
- [ ] Todo el código nuevo vive en `com.auracore.*` y está en `CUSTOMIZATIONS.md`.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pi no instalado / versión distinta | `binary` + `version` fijos; `validate` al arrancar; fallo explícito |
| Ejecución de código arbitrario | Sandbox + Tool Guard + approval (ver [`06`](./06-seguridad-aislamiento-y-operacion.md)) |
| Coste descontrolado | Modelo dedicado por `usage_scope` (`["pi_worker"]`), límites por job |
| Artefactos gigantes | Cuota por artefacto y por job |
| Deriva del upstream | Zona `com.auracore.*`; sin tocar nodos/grafo |
| Fuga de secretos | Sin secretos en argumentos ni prompt; inyección controlada en red (06 §3) |

→ Siguiente: [`05-camino-b-pi-agent-runtime-provider.md`](./05-camino-b-pi-agent-runtime-provider.md)
