# WIKI_MODEL_SETUP.md — Plan de configuración: LLMs dedicados al Wiki

> Documento operativo (Auracore). Define cómo dejar el módulo Wiki funcionando con un
> **proveedor dedicado** (contratado, no-enrutable) para digestión + embeddings, aislado
> del chat normal gracias a la feature **V900 `usage_scope`**.
> Sesión de creación: 2026-08-21 · Rama `main` (base v2.1.0 + V900).

---

## 1. Objetivo y arquitectura

```
CHAT (OmniRoute / DeepSeek)          WIKI (proveedor dedicado — DashScope recomendado)
┌─────────────────────────────┐     ┌──────────────────────────────────────────────┐
│ modelos chat-eligibles      │     │ qwen-max        → wikiDefaultModelId (fuerte) │
│ (usage NULL / ["chat"])     │     │ qwen-turbo      → wikiLightModelId (barato)   │
│                             │     │ text-embedding-v3 → embedding.default.model   │
│ NUNCA ven los modelos wiki  │     │ (los 3 con usage=["wiki"] → el chat los ignora│
└─────────────────────────────┘     └──────────────────────────────────────────────┘
```

El wiki necesita **dos tipos** de LLM:
1. **Digestión (chat)**: genera páginas, resúmenes, extrae entidades, reconcilia `[[links]]`.
   Se asigna por KB (`wikiDefaultModelId`) o por paso (`stepModels`).
2. **Embeddings (texto)**: vectoriza chunks para la búsqueda semántica (`HybridRetriever`,
   fusión RRF keyword+semántico). Se asigna a nivel sistema o por KB (`embeddingModelId`).

> ⚠️ **Decidir el modelo de embeddings YA**: el sistema versiona el input de embeddings
> (`mate.wiki.embedding-text-version-current`); cambiarlo después exige re-embedear todo.

---

## 2. Recomendación de proveedor

| Opción | Digestión | Embeddings | Contratos nuevos | Costo |
|---|---|---|---|---|
| **★ DashScope (recomendada)** | qwen-max (+ qwen-turbo ligero) | text-embedding-v3 | 1 API key | bajo |
| **Zero-extra** | deepseek-v4-pro (ya configurado) | Ollama local bge-m3 | 0 (Ollama local) | mínimo |
| **Premium** | Gemini Flash / Claude Sonnet | Gemini embedding | 2 keys | alto (overkill) |

**Por qué DashScope:** una sola key cubre chat + embeddings; soporte nativo en el código
(`EmbeddingModelFactory` rama DashScope); los seeds ya existen en la BD (`text-embedding-v3`
habilitado); calidad multilingüe (español) buena; costos bajos.

---

## 3. Pasos de configuración

### Paso 0 — Pre-requisitos (verificados 2026-08-21)
- ✅ Stack Docker corriendo (`http://localhost:18080`, admin/admin123)
- ✅ Feature V900 desplegada (columna `usage_scope` migrada, `chatEligible` en API)
- ✅ DeepSeek + OmniRoute configurados para chat
- ⚠️ DashScope: modelos sembrados pero **sin API key** (provider `configured=False`)

### Paso 1 — Contratar y registrar el proveedor DashScope
1. Crear cuenta en Alibaba Cloud / DashScope (https://dashscope.aliyuncs.com) y generar API key.
2. En AuraClaw: **Ajustes → Modelos** → catálogo → **DashScope** → guardar API key.
   (o `POST /api/v1/models/custom-providers` con protocolo DashScope)
3. Verificar que el provider queda `configured=True` y `available=True` (tarjeta del provider
   + prueba de conexión). Los modelos sembrados (qwen-*, text-embedding-v2/v3) ya existen
   en `mate_model_config` y están habilitados — no hay que crearlos.

### Paso 2 — Aislar los modelos wiki del chat (feature V900)
En **Ajustes → Modelos → DashScope → Administrar modelos**, editar **Uso** de cada modelo:
| Modelo | Uso (`usage_scope`) | Efecto |
|---|---|---|
| qwen-max | `["wiki"]` | El chat normal (default/pin/failover/selector) **nunca** lo usa |
| qwen-turbo | `["wiki"]` | Ídem; servirá de modelo ligero del wiki |
| text-embedding-v3 | (embedding — no aplica) | Categoría `embedding`, ya excluida del chat por diseño |

> Los modelos con `usage=["wiki"]` siguen apareciendo en el **selector del wiki** (por diseño)
> y son resolubles por id (`wikiDefaultModelId`). Verificado en vivo: el pin de conversación
> a un modelo dedicado se rechaza con 400; el selector de chat no los muestra.

### Paso 3 — Definir el embedding por defecto del sistema
**UI** (si existe el selector) o **API**:
```bash
# Ver el default actual
curl -H "Authorization: Bearer $TOKEN" http://localhost:18080/api/v1/models/embedding/default

# Fijar text-embedding-v3 (id de mate_model_config, p.ej. 1000001003)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"modelId":"<id_text-embedding-v3>"}' \
  http://localhost:18080/api/v1/models/embedding/default
```
> Alternativa por KB: en la KB del wiki, campo **Embedding model** (`embeddingModelId`)
> tiene precedencia sobre el default del sistema.

### Paso 4 — Configurar las KBs del wiki
En **Wiki → [KB] → Configuración → Estrategia de modelo** (UI) o vía `configContent` (JSON):
```json
{
  "ingestMode": "eager",
  "wikiDefaultModelId":  <id_qwen-max>,
  "wikiLightModelId":    <id_qwen-turbo>,
  "stepModels": {
    "heavy_ingest.create_page":    <id_qwen-max>,
    "heavy_ingest.entity_extraction": <id_qwen-turbo>
  },
  "fallbackModelIds": [ <id_deepseek-v4-pro> ]
}
```
Cadena de routing resultante (RFC-051):
```
stepModels[paso] → wikiLightModelId → wikiDefaultModelId → default global del sistema
+ fallbackModelIds (solo si el modelo primario falla)
```

### Paso 5 — Verificación end-to-end
1. **Digestión**: Wiki → subir un documento (PDF/docx/txt) con `auto-process-on-upload` activo;
   observar el job: `create_page`/`entity_extraction` deben loguear el modelo asignado
   (log `[LlmFailover] chain[...]` NO debe incluir qwen-max para chat).
2. **Páginas**: verificar que se generaron páginas con `[[slugs]]` reconciliados.
3. **Búsqueda semántica**: preguntar al agente sobre el contenido; verificar que cita
   `Fuentes: [n]` (HybridRetriever con vectores, no solo keyword).
4. **Aislamiento**: en una conversación, el selector de chat NO debe listar qwen-max/turbo;
   intentar pinearlo → 400.
5. **Costo**: monitorear el consumo del provider DashScope los primeros días (la digestión
   es el mayor gasto; los pasos ligeros deben caer en qwen-turbo).

---

## 4. Notas operativas

- **No recargar seeds** en BD existente: los modelos dashscope ya están; solo falta la API key.
- **Cambiar el modelo de embeddings después** = re-embedear todo el wiki (versionado de input):
  limpiar `mate.wiki.embedding-text-version-current` y re-procesar, o aceptar la advertencia
  de versión y re-embeder por job.
- **Failover del chat** (AgentGraphBuilder) ignora modelos `usage` sin `"chat"`: un provider
  con solo modelos wiki dedicados queda fuera de la cadena de fallback del chat automáticamente.
- **El wiki sigue funcionando aunque el proveedor dedicado falle**: la cadena cae al
  `wikiDefaultModelId` → default global (DeepSeek) vía `fallbackModelIds`.

## 5. Estado al cierre de sesión (2026-08-21)

- [x] Feature V900 implementada, testeada y desplegada en Docker
- [x] Leaks de chat cerrados (pin, default, selector) y verificados en vivo
- [x] Nemotron (omniroute) marcado `usage=["wiki"]` como modelo de prueba
- [ ] **Paso 1**: API key DashScope (pendiente de contratar)
- [ ] **Paso 2**: marcar qwen-max/turbo `usage=["wiki"]`
- [ ] **Pasos 3-4**: embedding default + config de KBs
- [ ] **Paso 5**: verificación end-to-end
