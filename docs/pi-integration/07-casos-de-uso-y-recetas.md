# 07 · Casos de uso y recetas

> Recetas concretas para el `pi_worker`. Cada una indica objetivo, entradas, skill de Pi, salida,
> prompt de ejemplo y cómo verificar el resultado.
>
> Regla transversal: **no duplicar lo que AuraClaw ya hace bien.** Pi entra donde hay generación
> compleja o composición de artefactos, no para sustituir RAG, Wiki o memoria.

---

## 0. Qué NO delegar a Pi

| No delegar | Por qué |
|---|---|
| Búsqueda en la Wiki / RAG | Ya lo hace AuraClaw con citas y trazabilidad |
| Conversación general | Runtime nativo; Pi añade latencia y coste |
| Memoria del usuario | Es de AuraClaw (`MemoryLifecycleMediator`) |
| Permisos, aprobaciones, auditoría | Gobierno de AuraClaw |

---

## 1. (Recomendada primero) Informe PDF con gráficas

**El caso motor.** Hoy `PdfRenderTool` no embebe imágenes (verificado).

| | |
|---|---|
| **Objetivo** | Informe ejecutivo en PDF con portada, secciones, tablas y **gráficas embebidas** |
| **Entradas** | `ventas.xlsx`, CSV, o datos de un datasource |
| **Skill de Pi** | `informe-ejecutivo` |
| **Salida** | `informe.pdf` (+ opcional `informe.docx`) |
| **Herramientas** | `read`, `write`, `edit`, `bash` (matplotlib + reportlab/weasyprint) |
| **Perfil** | `report` |

**Prompt al worker (ejemplo):**
```
Tarea: a partir de in/ventas.xlsx, genera out/informe.pdf con:
  - Portada con título y fecha
  - Sección de evolución mensual con gráfica de líneas
  - Sección de comparativa por región con gráfica de barras
  - Tabla resumen y 5 conclusiones
Todos los textos en español neutro. Formato profesional.
```

**Verificación:** abrir el PDF y **confirmar que las gráficas están embebidas** (no un hueco vacío).

---

## 2. Documentos Office (DOCX / XLSX / PPTX)

| | |
|---|---|
| **Objetivo** | Generar documentos Office con formato y datos |
| **Entradas** | Markdown, datos, plantillas corporativas (opcional) |
| **Skill de Pi** | `office-docs` |
| **Salida** | `.docx`, `.xlsx`, `.pptx` |
| **Perfil** | `office` |

**Prompt (ejemplo):**
```
Genera out/propuesta.docx a partir de in/propuesta.md usando la plantilla in/plantilla.docx
(estilos corporativos). Añade además out/resumen.xlsx con una hoja por área y una gráfica de barras.
```

> **Solape a revisar:** AuraClaw ya tiene `DocxRenderTool` / `XlsxRenderTool` / `PptxRenderTool`.
> Pi aporta valor cuando hay **gráficas nativas**, **plantillas corporativas** o **lógica de datos**
> que el render de Markdown no cubre. Documentar cuándo usar cada uno.

---

## 3. Vídeo educativo

| | |
|---|---|
| **Objetivo** | Vídeo corto (slides + narración + subtítulos) |
| **Entradas** | Guion/tema; imágenes o capturas opcionales |
| **Skill de Pi** | `video-educativo` |
| **Salida** | `.mp4` (+ `.srt`) |
| **Herramientas** | `read`, `write`, `bash` (ffmpeg; TTS por API si se configura) |
| **Perfil** | `media` |

**Prompt (ejemplo):**
```
Crea out/leccion.mp4 (máx. 3 min) explicando "ciclo del agua" para secundaria:
guion en español, 6 diapositivas, narración TTS, subtítulos incrustados y música de fondo libre.
```

**Verificación:** reproducir y comprobar audio + subtítulos + duración.

---

## 4. Análisis de datos

| | |
|---|---|
| **Objetivo** | Explorar datos, detectar patrones y entregar informe + gráficas |
| **Entradas** | CSV/XLSX o resultado de un datasource de AuraClaw |
| **Skill de Pi** | `analisis-datos` |
| **Salida** | `.xlsx` con análisis + `.png` de gráficas + resumen |
| **Perfil** | `data` |

**Prompt (ejemplo):**
```
Analiza in/transacciones.csv: limpia nulos, calcula KPIs por mes y categoría, detecta outliers,
genera 3 gráficas y un resumen con hallazgos y recomendaciones. Salida: out/analisis.xlsx + out/*.png
```

> **Solape a revisar:** AuraClaw ya tiene tools de SQL/datasource (`execute_sql`, `query_datasource`).
> Pi entra en la parte de **limpieza y visualización**, no en la consulta.

---

## 5. Investigación y scraping web

| | |
|---|---|
| **Objetivo** | Recopilar información pública y sintetizarla en un documento |
| **Entradas** | Tema; URLs opcionales |
| **Skill de Pi** | `investigacion-web` |
| **Salida** | `.md` o `.pdf` con fuentes |
| **Perfil** | `report` con `allow-network` y allow-list de dominios |

**Prompt (ejemplo):**
```
Investiga el mercado de X en 2026 usando solo los dominios permitidos. Entrega out/informe.md
con resumen, 5 hallazgos clave y lista de fuentes con URL y fecha de consulta.
```

> **Solape a revisar:** AuraClaw ya tiene búsqueda web y SearXNG. Preferir el buscador propio; usar
> Pi cuando haya que **navegar y componer** un documento a partir de múltiples fuentes.

---

## 6. Conversión y extracción de documentos

| | |
|---|---|
| **Objetivo** | Convertir entre formatos (p. ej. escaneado → DOCX estructurado) |
| **Entradas** | PDF/imagen |
| **Skill de Pi** | `office-docs` / `ocr-docs` |
| **Salida** | `.docx` / `.md` / `.xlsx` |
| **Perfil** | `office` |

**Prompt (ejemplo):**
```
Convierte in/contrato.pdf en out/contrato.docx preservando secciones y tablas.
Extrae además las cláusulas de plazos a out/plazos.xlsx.
```

> **Solape a revisar:** existe `DocumentExtractTool` y OCR en AuraClaw. Usar Pi solo si la
> estructuración es compleja.

---

## 7. Plantilla de invocación (referencia interna)

```
Tarea:        <objetivo en lenguaje natural, con formato y criterios de aceptación>
Entradas:     in/<archivos>
Salida:       out/<archivos esperados>
Restricciones: español neutro · sin acceso a red salvo allow-list · sin secretos
```

---

## 8. Matriz de decisión: AuraClaw nativo vs Pi

| Necesidad | Herramienta |
|---|---|
| Responder desde la Wiki/conocimiento | **AuraClaw** |
| Consultar SQL/datasource | **AuraClaw** (`execute_sql`, `query_datasource`) |
| Markdown → PDF simple | **AuraClaw** (`PdfRenderTool`) |
| **PDF/DOCX/PPTX con gráficas o plantilla** | **Pi** (`pi_worker`) |
| **Vídeo, TTS, composición multimedia** | **Pi** |
| **Limpieza y análisis de datos + visualización** | **Pi** |
| OCR/extracción simple | **AuraClaw** |
| **Navegación y composición desde varias fuentes** | **Pi** |

→ Siguiente: [`08-plan-de-ejecucion-y-roadmap.md`](./08-plan-de-ejecucion-y-roadmap.md)
