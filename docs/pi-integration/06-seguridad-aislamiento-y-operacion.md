# 06 · Seguridad, aislamiento y operación

> Pi ejecuta **código arbitrario** (bash). Esta es la parte que no se puede improvisar. Aquí se fija
> cómo lo aislamos, cómo evitamos fugas de secretos, cómo controlamos coste y cómo lo operamos.
>
> Aplica a los **dos** caminos (A y B). Referencias: `CODE_MAP.md` M2/M3/M6 y `CUSTOMIZATIONS.md`.

---

## 1. Modelo de amenaza

| Amenaza | Vector | Control |
|---|---|---|
| Ejecución maliciosa | Prompt injection que induce código destructivo | Sandbox + Tool Guard + approval |
| Exfiltración de datos | Pi con red abierta envía contenido a un host externo | Allow-list de red (06 §4) |
| Fuga de secretos | Tokens en argumentos, prompt o logs | Inyección en red, nunca en claro (06 §3) |
| Escape del workspace | `../` en `inputFiles` o en el código | Validación de rutas + sandbox |
| Consumo desmedido | Bucle de tools, job infinito | Timeout, cuotas, límite de concurrencia |
| Coste desbocado | Modelo caro usado en todas partes | Modelo dedicado por `usage_scope` |
| Contaminación de memoria | Pi escribe en la memoria del agente | Pi es efímero; memoria = AuraClaw |
| Proceso huérfano | Timeout no mata el árbol de procesos | `PiProcessManager` con watchdog |

**Premisa:** Pi no es de confianza por defecto. Se trata como un ejecutor **no confiable** que recibe
entradas acotadas y devuelve ficheros validados.

---

## 2. Aislamiento de ejecución

Opciones, de mayor a menor aislamiento:

| Opción | Aislamiento | Coste operativo | Recomendación |
|---|---|---|---|
| **Gondolin** (micro-VM) | Alto (VM, VFS y red programables) | Medio (QEMU; ARM64 es la ruta más probada) | **Producción** si el host lo permite |
| **Contenedor Docker** por job | Medio-alto | Bajo (ya usamos Docker) | **Fallback pragmático** |
| Proceso directo en el host | Ninguno | Nulo | **Solo desarrollo**, jamás en prod |

Configuración mínima en cualquiera de los dos primeros:

- **Filesystem:** solo la raíz `.pi-jobs/<jobId>/` montada; sin acceso al resto del host.
- **Usuario no-root** dentro del sandbox.
- **Recursos:** límite de CPU (`cpus`), memoria (`mem_limit`), disco (cuota de la raíz de trabajo).
- **Sin acceso a la red del contenedor anfitrión** ni al socket de Docker.

> Decisión pendiente: **Gondolin vs Docker**. Criterio: si Gondolin resulta estable en nuestro VPS
> (ARM64/x86) lo preferimos por su control de red/secretos; si no, Docker con red restringida.

---

## 3. Gestión de secretos

Regla de oro: **Pi nunca ve un secreto en claro si puede evitarse.**

1. **Nada de secretos en argumentos de línea de comandos** (visibles en `ps`).
2. **Nada de secretos en el prompt** ni en variables de entorno del proceso hijo salvo lista blanca.
3. **Inyección en la capa de red:** el proxy/sandbox sustituye un *placeholder* por el valor real
   **solo** hacia hosts permitidos (patrón de `pi-chat`); el LLM nunca ve el valor.
4. Si una skill necesita una credencial (API key de un servicio, OAuth), se entrega por fichero
   dentro de la raíz efímera con permisos `600` y se **borra** al terminar el job.
5. **Auditoría:** los logs de AuraClaw nunca contienen el valor; solo el nombre del secreto usado.

---

## 4. Política de red

Por defecto, **denegar**; permitir por lista explícita y por perfil:

```
allow-hosts:
  report:  []                      # normalmente no necesita red
  office:  []
  data:    [ "api.interna.empresa" ]
  media:   [ "cdn.proveedor-tts", "api.proveedor-tts" ]
```

- El proveedor del LLM (DeepSeek/MiniMax/OpenAI) se alcanza por el **proxy del sandbox**, no por
  red directa del job.
- Sin allow-list → `allow-network: false`.

---

## 5. Aprobaciones y Tool Guard

- `pi_worker` (Camino A) es **candidata a aprobación previa**: ejecuta código. Recomendado exigir
  aprobación para perfiles `media`/`data` o en el primer uso.
- **Tool Guard**: regla explícita de qué roles/agentes pueden invocar `pi_worker`.
- **Disclosure**: la tool no se anuncia a agentes que no deban usarla.
- En el **Camino B**, las aprobaciones de Pi se emiten como `TOOL_APPROVAL_REQUIRED` y se resuelven
  por el `approval gate` existente (M6).

---

## 6. Límites, recursos y coste

| Recurso | Valor por defecto | Configurable |
|---|---|---|
| Timeout por job | 600 s (A) / 900 s (B) | `auracore.pi.timeout-seconds` |
| Idle timeout de sesión | 120 s | `idle-timeout-seconds` |
| Concurrencia | 2 jobs | `max-jobs-concurrent` |
| Tamaño por artefacto | 50 MB | `max-artifact-mb` |
| Tipos permitidos en `out/` | pdf, docx, xlsx, pptx, md, txt, csv, png, jpg, svg, mp4, webm, json | — |

**Coste:** asignar un **modelo dedicado** mediante `usage_scope` (V900, ver `WIKI_MODEL_SETUP.md`) con
el valor `pi_worker`, de modo que el chat normal no consuma ese modelo y el gasto sea rastreable.
El consumo entra en el panel por usuario (V902) y en el contador de tokens.

---

## 7. Operación en nuestro despliegue

- **Pin de versión de Pi** (binario y `version` en config). Nada de auto-update en producción:
  `PI_SKIP_VERSION_CHECK` y `PI_OFFLINE` cuando aplique.
- **Telemetría de Pi desactivada** (`PI_TELEMETRY=0`) por política.
- **Directorio de config aislado** por job: `PI_CODING_AGENT_DIR` apuntando a la raíz efímera.
- **Empaquetado:** el binario de Pi y sus skills se incluyen en la imagen Docker (no se descargan en
  runtime). Compatible con el `docker-compose.yml` y con Dokploy.
- **Healthcheck:** `validate()` expuesto para que la consola de runtime (Camino B) o un endpoint de
  salud reporten el estado de Pi.
- **Limpieza:** job terminado → borrar `in/` y `work/`; conservar `out/` según retención configurada.

---

## 8. Observabilidad y auditoría

Registrar por job (sin datos sensibles):

```
jobId · username(owner_key) · agentId · workspaceId · profile · modelo
prompt-resumen (≤ N caracteres, sin secretos)
tools usadas · artefactos producidos (nombre, tipo, tamaño)
duración · tokens · coste estimado · resultado (ok/failed/timeout/cancelled)
```

Esto alimenta el `audit trail` existente y el panel por usuario.

---

## 9. Checklist de seguridad (pre-producción)

- [ ] Sandbox activo (Gondolin o contenedor con red restringida y usuario no-root).
- [ ] Sin secretos en argumentos, prompt, env ni logs.
- [ ] Allow-list de red por perfil; por defecto denegada.
- [ ] Validación de rutas de `inputFiles` (dentro del workspace, sin `..`).
- [ ] Límites de tiempo, concurrencia, tamaño y tipos aplicados.
- [ ] Tool Guard + disclosure + (si aplica) approval configurados.
- [ ] Modelo dedicado por `usage_scope` y coste visible en el panel.
- [ ] Timeout mata el árbol de procesos y limpia la raíz de trabajo (probado).
- [ ] `PI_TELEMETRY=0`, versión pinneada, `PI_CODING_AGENT_DIR` efímero.
- [ ] Clave JWT de producción sobrescrita (recordatorio de `CODE_MAP.md` M6).

> Esta checklist se repite en `08` como gate de la fase de endurecimiento.

→ Siguiente: [`07-casos-de-uso-y-recetas.md`](./07-casos-de-uso-y-recetas.md)
