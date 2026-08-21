# Generación de Modelos 3D

Texto-a-3D e imagen-a-3D en una sola llamada de herramienta. Configura las credenciales una vez y el agente puede llamar a `model3d_generate` para producir un modelo `.glb` que aterriza directo en la burbuja del chat — vista previa interactiva, arrastra para rotar.

---

## Qué hay en la caja

| Aspecto | Detalle |
|---|---|
| **Proveedor actual** | Tencent Hunyuan 3D (`ai3d.tencentcloudapi.com`, región `ap-guangzhou`) |
| **Modelos disponibles** | `HY-3D-3.1` / `HY-3D-3.0` / `HY-3D-Express` |
| **Formato de salida** | `.glb` (GLTF binario, un solo archivo con texturas embebidas, renderizado en línea por `<model-viewer>`) |
| **Latencia** | 1–3 minutos (Pro más lento, Rapid más rápido) |
| **Esquema de auth** | TC3-HMAC-SHA256 (SecretId + SecretKey) |

El enrutamiento es automático según el argumento `model`:

| Modelo | Acción del backend | Notas |
|---|---|---|
| **HY-3D-3.1** (default) | `SubmitHunyuanTo3DProJob` | Máxima calidad. Soporta materiales PBR, entrada multi-vista, modelo blanco (`GenerateType=Geometry`) |
| **HY-3D-3.0** | mismo | Variante Pro más vieja, comparte el sitio de llamada |
| **HY-3D-Express** | `SubmitHunyuanTo3DRapidJob` | El más rápido. Solo acepta `Prompt` o `ImageUrl` |

---

## 1. Obtén credenciales de Tencent Cloud

La API de Hunyuan 3D requiere credenciales CAM tradicionales (**no** las claves Bearer estilo OpenAI `sk-xxx`). Necesitas un par SecretId + SecretKey.

1. Abre **[Cloud Access Management → API Keys](https://console.cloud.tencent.com/cam/capi)**
2. Haz clic en **Create Key**. Tencent te da ambos:
   - `SecretId` (empieza con `AKID`, ~36 caracteres)
   - `SecretKey` (~32 caracteres)
3. **Guarda ambos** — el SecretKey se muestra solo una vez y no puede recuperarse después.

::: tip Sobre las claves `sk-xxx` de "API Key 管理"
La consola de Tencent tiene otra página llamada "API Key Management" que emite tokens Bearer individuales con prefijo `sk-`. **Esos están acotados a TokenHub** (`tokenhub.tencentmaas.com`) para chat completions OpenAI-compatible y **no pueden usarse para Hunyuan 3D**. El 3D requiere el par SecretId + SecretKey del CAM de arriba.
:::

## 2. Activa el servicio Hunyuan 3D

Abre la **[Consola de Hunyuan 3D](https://console.cloud.tencent.com/ai3d)**. La primera visita pide aceptar el acuerdo de servicio / activar el tier gratuito.

Saltarte este paso resulta en:

```
[Hunyuan3D] SubmitHunyuanTo3DProJob failed: ResourceInsufficient
```

Algunas variantes (notablemente `HY-3D-3.1`) pueden requerir una solicitud de cuota separada o un plan de pago — revisa el dashboard de cuotas de la consola.

## 3. Configura credenciales en AuraClaw

1. Abre la página de **Modelos y Credenciales** y localiza la tarjeta **Tencent Hunyuan 3D** (auto-registrada por la migración V71).
2. Haz clic en **Actualizar** / **Configurar**.
3. Pega la API Key como **`SecretId:SecretKey`** (un solo colon, sin espacios):
   ```
   AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:abcdefghijklmnopqrstuvwxyz123456
   ```
4. Deja **Base URL** en el default `https://ai3d.tencentcloudapi.com` (el sistema maneja el enrutamiento regional automáticamente).
5. Guarda.

::: warning Compromiso de campo único
La tarjeta del proveedor expone actualmente un solo campo de API Key. Una mejora futura lo dividirá en entradas separadas de SecretId / SecretKey que se auto-unen con `:` al guardar.
:::

## 4. Habilita la feature 3D

Ve a **Ajustes → Generación 3D**:

- **Habilitar generación de modelos 3D**: on
- **Proveedor 3D preferido**: elige `Tencent Hunyuan 3D`
- **Fallback de proveedor**: déjalo encendido (hoy solo existe un proveedor, pero el toggle mira hacia adelante)

Haz clic en **Guardar Ajustes del Sistema**.

## 5. Pruébalo en el chat

Habla naturalmente — el agente elige `model3d_generate` automáticamente:

```
Genera un modelo 3D: un dinosaurio de dibujos animados lindo, verde, con ojos redondos grandes
```

```
Genera rápido un modelo 3D de una manzana roja    ← el LLM selecciona HY-3D-Express
```

```
Genera un modelo 3D desde esta imagen: https://example.com/foo.png    ← imagen-a-3D
```

```
Genera un modelo 3D blanco (sin texturas): un engranaje mecánico    ← modo Geometry
```

Flujo esperado:

1. **La herramienta devuelve de inmediato** (milisegundos) con un `taskId=xxx`.
2. **Un worker del backend consulta a Tencent cada 8 segundos** asíncronamente.
3. **1–3 minutos después** el evento SSE `async_task_completed` aterriza en la conversación.
4. **`<model-viewer>` renderiza el `.glb`** en línea — arrastra, rota, zoom.

---

## Parámetros de la herramienta (`model3d_generate`)

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `prompt` | String | Sí\* | Descripción de texto, hasta 1024 caracteres UTF-8 |
| `imageUrl` | String | Sí\* | URL de imagen de referencia (modo imagen-a-3D) |
| `model` | String | No | `HY-3D-3.1` (default) / `HY-3D-3.0` / `HY-3D-Express` |
| `enableTexture` | Boolean | No | `true` (default) / `false` (modelo blanco, solo Pro) |
| `enablePbr` | Boolean | No | `true` habilita materiales PBR (renderizado más rico, solo Pro, default `false`) |

\* Se requiere `prompt` o `imageUrl` (XOR — Pro no acepta ambos, excepto en modo Sketch que aún no se expone).

---

## Resolución de problemas

### 1. `3D 模型生成功能未启用，请在系统设置中开启` / "la generación 3D no está habilitada"

→ El toggle de la feature está apagado. Ve a **Ajustes → Generación 3D** y habilítalo.

### 2. `Provider api_key must be "SecretId:SecretKey" (colon-joined)`

→ Formato de credencial incorrecto. Probablemente guardaste uno de:
- Un solo SecretId (sin SecretKey anexado)
- Un solo SecretKey
- Un solo token `sk-xxx` (es una clave TokenHub, no para 3D)
- Usaste un espacio en lugar de `:`

Correcto: `AKIDxxxx...:zzzz...` — exactamente un colon ASCII, sin espacios en blanco.

### 3. `ResourceInsufficient` (资源不足)

→ Error de negocio del lado de Tencent. Causas posibles:
- El servicio Hunyuan 3D aún no está activado
- La cuota gratuita está agotada
- El modelo seleccionado (especialmente `HY-3D-3.1`) requiere aprobación / un plan de pago

Revisa la [Consola de Hunyuan 3D](https://console.cloud.tencent.com/ai3d) por el estado de la cuota.

### 4. `invalid params, first_frame_image`

→ Tencent no pudo obtener tu `imageUrl`. La URL debe ser alcanzable desde el internet público — `localhost`, IPs internas y URLs firmadas que han expirado no funcionan. Confirma:
- La URL abre directamente en una ventana de navegador incógnito
- El tipo de archivo es `jpg/png/jpeg/webp`, resolución 128–5000px por lado, ≤8MB

### 5. La tarea se cuelga por 15 minutos

→ El worker expira a los 15 min por defecto. Revisa los logs del backend:

```bash
grep '\[Hunyuan3D\]\|\[Model3dGen\]' logs/mateclaw.log | tail -10
```

Si el polling está atascado en `RUN`/`WAIT`, reinicia el backend (las tareas en vuelo se marcan como fallidas al arrancar).

### 6. La generación tiene éxito pero la burbuja muestra solo un enlace de descarga, sin vista previa interactiva

→ Tencent devolvió un bundle OBJ (.zip con OBJ + texturas + MTL) en lugar de un solo GLB. Nuestro código prefiere GLB (`pickBestResultFile`), pero si Tencent solo devuelve OBJ para esa solicitud, el frontend cae a un enlace de descarga. **Usar `HY-3D-3.1` por defecto normalmente produce un GLB.**

---

## Arquitectura (una página)

```
[ usuario ] ── lenguaje natural ─▶ [ agente ] ─▶ model3d_generate
                                                │
                                  (enruta por el campo model)
                                                │
                ┌───────────────────────────────┴──────────────┐
                ▼                                              ▼
        SubmitHunyuanTo3DProJob               SubmitHunyuanTo3DRapidJob
        (HY-3D-3.1 / HY-3D-3.0)                (HY-3D-Express)
                │                                              │
                └──────────────── ai3d.tencentcloudapi.com ────┘
                                                │
                                  devuelve JobId (URL de 24 h)
                                                │
            AsyncTaskService consulta Query{Pro,Rapid}HunyuanTo3DJob cada 8 s
                                                │
                              estado → DONE? ─▶ ResultFile3Ds[]
                                                │
                                    elegir mejor: GLB > FBX > OBJ
                                                │
                                    descargar a data/chat-uploads/
                                                │
                                    escribir mate_message (type=model3d)
                                                │
                            transmitir SSE async_task_completed
                                                │
                ▼
        el useChat del frontend detecta modelUrl ─▶ MessageBubble puentea el adjunto virtual
                                                │
                                    <model-viewer> renderiza el .glb
```

---

## Marcadores de log para una corrida exitosa

```
[ToolExecutor] Executing tool: model3d_generate
[Hunyuan3D] SubmitHunyuanTo3DProJob submitted job: 1441791994... (model=HY-3D-3.1)
[AsyncTask] Created task d73723f14c7c4167 (providerTaskId=pro:1441791994...)
[AsyncTask] Started polling for task d73723f14c7c4167 (interval=8s, timeout=15min)
[ToolExecutor] Tool model3d_generate returned 80 chars
…1–3 minutos…
[Model3dDownloader] Downloading 3D model from https://hunyuan-prod-….cos.../...glb to data/chat-uploads/.../model_d73723f14c7c4167.glb
[Model3dDownloader] Downloaded NNNN bytes
[Model3dGen] Task d73723f14c7c4167 completed, model saved: /api/v1/chat/files/.../model_d73723f14c7c4167.glb
```

---

## Ver también

- [Panorama Multimodal](./multimodal)
- [Modelos y Credenciales](./models)
- [Sistema de Herramientas](./tools)
- RFC de diseño: `rfcs/202605/01-generative-async-pipeline.md`
