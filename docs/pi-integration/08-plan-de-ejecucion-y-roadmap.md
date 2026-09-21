# 08 · Plan de ejecución y roadmap

> Fases, ficheros a tocar, registros y criterios de aceptación. Se ejecuta **en orden**: no se abre
> una fase sin cerrar la anterior y actualizar `CUSTOMIZATIONS.md` y `NEXT_SESSION.md`.

---

## Resumen de fases

| Fase | Qué | Camino | Riesgo | Bloqueada por |
|---|---|---|---|---|
| **F0** | Documentación + registro | — | Bajo | — |
| **F1** | `pi_worker` v1 (CLI `-p` + sandbox contenedor + skill `informe-ejecutivo`) | A | Bajo | F0 |
| **F2** | Endurecimiento (red/secretos) + RPC + cancelación | A | Medio | F1 |
| **F3** | `PiAgentRuntimeProvider` | B | Medio | Merge v2.2.0 |
| **F4** | Catálogo de skills + consola/UI | A/B | Bajo | F2 (o F3) |

---

## F0 · Documentación y registro

**Entregables**

- Esta carpeta `docs/pi-integration/` (hecha).
- Entrada en `docs/CUSTOMIZATIONS.md` (registro de la integración y su manejo en merges).
- Entrada en `docs/NEXT_SESSION.md` (cierre de sesión).

**Fila propuesta para `CUSTOMIZATIONS.md`:**

| Archivo | Cambio | Manejo de conflicto en merge |
|---|---|---|
| `mateclaw-server/.../com/auracore/tool/pi/*` (nuevo) | Tool `pi_worker` y soporte | Archivo nuevo = aditivo, sin conflicto |
| `application.yml` / `application-*.yml` | Bloque `auracore.pi` | Re-aplicar si upstream reescribe la config |
| `pi-skills/` (nuevo, raíz del repo) | Skills de Pi versionadas | Aditivo |
| `Dockerfile` / `docker-compose.yml` | Instalar binario Pi + copiar `pi-skills/` | Conservar nuestras líneas |
| `com/auracore/runtime/pi/*` (nuevo, F3) | `PiRuntimeProvider` | Aditivo; imitar `vip.mate.agent.runtime.dsh/` |
| `docs/pi-integration/**` | Esta documentación | Aditivo |

**Criterio de cierre:** la documentación es coherente con `CODE_MAP.md` y `CUSTOMIZATIONS.md`.

---

## F1 · `pi_worker` v1 (MVP)

**Alcance**

- Tool `PiWorkerTool` en `com.auracore.tool.pi`.
- Invocación `pi -p` (print/JSON) como proceso hijo.
- Sandbox: **contenedor Docker** por job (fallback pragmático; Gondolin en F2).
- Perfil `report` + skill `informe-ejecutivo`.
- Recolección y validación de `out/`; entrega por `SendFileTool`.
- Registro en audit + coste con `usage_scope`.

**Ficheros a tocar**

| Ruta | Acción |
|---|---|
| `com/auracore/tool/pi/PiWorkerTool.java` | Nuevo |
| `com/auracore/tool/pi/PiWorkerRunner.java` | Nuevo (proceso, timeout, limpieza) |
| `com/auracore/tool/pi/PiWorkerProperties.java` | Nuevo (config) |
| `mateclaw-server/src/main/resources/application.yml` | Bloque `auracore.pi` |
| `pi-skills/informe-ejecutivo/SKILL.md` + scripts | Nuevo |
| `Dockerfile` | Instalar Pi + copiar skills |

**Criterio de cierre (aceptación F1)**

- [ ] PDF con **al menos una gráfica embebida** a partir de un XLSX.
- [ ] Artefacto entregado en el chat y visible solo para su dueño.
- [ ] Timeout/fallo dejan el sistema limpio.
- [ ] Audit + coste por usuario registrados.
- [ ] Registrado en `CUSTOMIZATIONS.md`.

---

## F2 · Endurecimiento + RPC

**Alcance**

- Migrar a `pi --mode rpc` (streaming, cancelación, progreso).
- Sandbox **Gondolin** si el host lo admite; si no, contenedor con red restringida + allow-list.
- Inyección de secretos en red (nunca en claro).
- Tool Guard + disclosure + política de approval.
- Cuotas de recursos y concurrencia.

**Criterio de cierre**

- [ ] Checklist completa de [`06`](./06-seguridad-aislamiento-y-operacion.md) §9.
- [ ] Cancelación desde la UI (o desde el turno) funciona.
- [ ] Sin procesos ni ficheros huérfanos tras 24 h.
- [ ] Pruebas de seguridad (rutas, red, secretos) en verde.

---

## F3 · `PiAgentRuntimeProvider` (Camino B)

**Prerrequisito:** merge de upstream **v2.2.0** a `main` (ver `CUSTOMIZATIONS.md` §3).

**Alcance**

- `com.auracore.runtime.pi.PiRuntimeProvider` implementando `AgentRuntimeProvider`.
- `PiProcessManager`, `PiRpcClient`, `PiRpcEventMapper`, `PiRuntimeConnection`.
- Registro Spring (auto por `RuntimeProviderRegistry`) + selección de runtime por agente.
- Validación (`validate`) y capacidades honestas.

**Ficheros a tocar**

| Ruta | Acción |
|---|---|
| `com/auracore/runtime/pi/PiRuntimeProvider.java` | Nuevo |
| `com/auracore/runtime/pi/PiRpcClient.java` | Nuevo |
| `com/auracore/runtime/pi/PiRpcEventMapper.java` | Nuevo |
| `com/auracore/runtime/pi/PiRuntimeConnection.java` | Nuevo |
| `com/auracore/runtime/pi/PiProcessManager.java` | Nuevo |
| Config `auracore.pi.runtime` | Bloque nuevo |

**Criterio de cierre**

- [ ] Un empleado con runtime Pi completa un turno con streaming y tools.
- [ ] Cancelación y `contextUsage` funcionan.
- [ ] Aprobaciones pasan por `TOOL_APPROVAL_REQUIRED`.
- [ ] Aparece en la consola de runtime.

---

## F4 · Catálogo de skills + experiencia

**Alcance**

- Skills: `office-docs`, `analisis-datos`, `video-educativo`, `investigacion-web`, `ocr-docs`.
- Documentar cada skill y su perfil.
- (Opcional) UI para elegir perfil/plantilla y ver el progreso del job.

**Criterio de cierre**

- [ ] Cada skill produce su artefacto esperado, con caso de prueba.
- [ ] Documentado en [`07`](./07-casos-de-uso-y-recetas.md).

---

## Secuencia recomendada

```
F0 ──▶ F1 ──▶ F2 ──▶ F4
              │
              └──▶ (si se decide) F3 ──▶ F4+
```

**Regla:** F3 no arranca hasta que F1 y F2 estén en producción y hayan demostrado valor. No se
construye el runtime "por completitud".

---

## Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Deriva del upstream | Código en `com.auracore.*`; mínima edición; registro en CUSTOMIZATIONS |
| Gondolin inestable en nuestro host | Fallback a contenedor; la decisión no bloquea F1 |
| v2.2.0 rompe nuestras personalizaciones | Merge por tags con rerere + CI; probar en `feature/upstream-v2.2.0` antes |
| Coste de Pi no previsto | `usage_scope` + límites + panel por usuario |
| Sobre-ingeniería | Empezar por F1 y medir antes de F3 |

---

## Qué NO hacer

- ❌ No tocar `AgentGraphBuilder` / `*Node` / `*Dispatcher` (superficie caliente).
- ❌ No exponer Pi directamente a usuarios o a la red.
- ❌ No meter secretos en prompt, args ni logs.
- ❌ No usar Git "Sync fork" (regla de `CUSTOMIZATIONS.md`).
- ❌ No crear un portal web nuevo.

---

## Registro de avance

| Fecha | Fase | Nota | Commit |
|---|---|---|---|
| 2026-09-19 | F0 | Documentación creada + registro en `CUSTOMIZATIONS.md` y `NEXT_SESSION.md` | `docs: add the Pi integration plan (F0)` |
| — | F1 | — | — |
| — | F2 | — | — |
| — | F3 | — | — |

> Al cerrar cada fase: actualizar esta tabla, `docs/CUSTOMIZATIONS.md` y `docs/NEXT_SESSION.md`.

→ Siguiente: [`09-referencias.md`](./09-referencias.md)
