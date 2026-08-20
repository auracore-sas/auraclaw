# Doctor

Doctor es el panel de salud dentro de la app. Reporta el estado actual de la instancia local desde el servicio de salud del backend; no es un subsistema de diagnóstico programado separado.

Ábrelo desde el botón de estado del layout / el área de Ajustes. El panel llama al backend cada vez que se abre o cuando haces clic en actualizar.

## API actual del backend

```bash
curl http://localhost:18088/api/v1/system/health \
  -H "Authorization: Bearer <token>"
```

Forma de la respuesta:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "overall": "healthy",
    "checks": [
      {
        "name": "default-model",
        "status": "healthy",
        "message": "Default model: qwen-plus",
        "action": null
      }
    ]
  }
}
```

`overall` es uno de `healthy`, `warning` o `error`. Cada check tiene:

| Campo | Significado |
|---|---|
| `name` | Clave estable del check, p. ej. `default-model`, `database`, `browser`, `provider:<id>`, `mcp:<name>` |
| `status` | `healthy`, `warning` o `error` |
| `message` | Texto de diagnóstico corto mostrado en el panel |
| `action` | Sugerencia opcional `{ label, route }` sobre dónde arreglar el problema |

## Qué verifica hoy

El `SystemHealthService` actual verifica:

| Check | Qué comprueba | Acción típica |
|---|---|---|
| Modelo por defecto | Hay un modelo por defecto configurado y cargable | `/settings/models` |
| Proveedores | Los proveedores con clave API están configurados cuando se requiere | `/settings/models` |
| Servidores MCP habilitados | Los servidores MCP habilitados tienen un resultado de conexión exitoso | `/settings/mcp-servers` |
| Inicialización de BD | El bootstrap de primera ejecución se ha completado | `/setup` |
| Diagnóstico del navegador | Pre-vuelo del lanzamiento del navegador para las herramientas de browser | `/api/v1/system/browser-health` |

También hay un endpoint directo de diagnóstico del navegador:

```bash
curl http://localhost:18088/api/v1/system/browser-health \
  -H "Authorization: Bearer <token>"
```

## No implementado en el árbol de código actual

Documentación antigua mencionaba `/api/v1/doctor/run`, `/api/v1/doctor/checks`, `/api/v1/doctor/history`, ejecuciones programadas de Doctor en segundo plano, `mate_doctor_check` y `mate_doctor_check_history`. Esos endpoints y tablas no existen en el backend actual. Usa `/api/v1/system/health` para la superficie de salud vigente.

## Páginas relacionadas

- [Referencia de API](./api) — inventario de rutas alineado con el código
- [Modelos](./models) — configuración de modelos/proveedores
- [MCP](./mcp) — configuración de servidores MCP
- [Seguridad y Aprobaciones](./security) — Tool Guard y comportamiento de aprobaciones
