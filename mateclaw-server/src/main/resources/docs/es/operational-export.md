# Exportación de Datos Operacionales

Exporta un informe operacional transversal como Excel (`.xlsx` empaquetado en `.zip`) de una sola vez, para operaciones, auditoría y conciliación offline. Dos puntos de entrada: una exportación de **un clic en el Dashboard** (GUI) y una exportación por **línea de comandos** (sin UI, funciona vía `docker exec`).

> **Solo administrador global.** El informe contiene datos sensibles entre workspaces: contenidos de conversaciones, uso de tokens, registros de auditoría, etc.

## Las 9 hojas

| # | Hoja | Contenido |
|---|---|---|
| 1 | Resumen | KPIs del intervalo, instantánea del sistema, tendencia de 7 días, comparación de periodos, detalles de modelos, actividad top-10 de agentes |
| 2 | Uso de Tokens | Desglose diario × `runtime_provider` con promedio de tokens/conversación |
| 3 | Estadísticas de Skills | Lista de skills + conteo de uso, hora de última llamada, agentes vinculados |
| 4 | Estadísticas de Usuarios | Tokens agregados por (workspace, usuario), duración, última actividad |
| 5 | Conversaciones de Usuarios | Filas de detalle emparejando mensajes usuario–asistente |
| 6 | Seguridad y Auditoría | Vista unificada de 6 fuentes (reglas de guardia, logs de auditoría, aprobaciones, concesiones, config, eventos de auditoría de negocio) |
| 7 | Estadísticas de Canales | Conteo de conversaciones, tokens y usuarios únicos por canal |
| 8 | Configuración de Modelos | Modelos habilitados + con clave API configurada y sus parámetros |
| 9 | Trabajos Cron | Registros de ejecución con duración y uso de tokens |

## Entrada 1: Un clic en el Dashboard

1. Abre el **Dashboard** y haz clic en **"Exportar datos operacionales"** arriba a la derecha (junto al chip de la base de datos) — visible solo para administradores globales.
2. En el diálogo elige un **rango de fechas** — usa los presets rápidos "Últimos 7 / 30 / 90 días" o un rango personalizado; **máximo 90 días**, sin fechas futuras.
3. Haz clic en **"Generar informe"** — un anillo de progreso circular muestra los 9 pasos (Resumen → … → Trabajos Cron).
4. Al terminar aparece "El informe está listo"; haz clic en **"Descargar"** para obtener `ops_data_<inicio>_<fin>.zip`.

**Seguridad y ciclo de vida:**

- Los endpoints de generar / progreso / descargar están todos protegidos con `@RequireGlobalAdmin` — una llamada no-admin devuelve 403.
- Solo se ejecuta una generación a la vez (llamadas concurrentes reciben 409 busy), con un plazo de 5 minutos en el frontend.
- El token de descarga es **atómicamente de un solo uso** — una segunda descarga con el mismo token devuelve 410.
- El archivo generado se auto-limpia **después de 24 h o al descargarse**.

## Entrada 2: Línea de comandos

Para escenarios grandes, sin timeout, scripteados o vía `docker exec`. Se añadió un framework CLI a nivel de proyecto; el comando de exportación es `--cli.command=export`:

```bash
# jar local
java -jar app.jar --cli.command=export \
  --cli.start=2026-01-01 --cli.end=2026-06-30 > report.zip

# dentro de un contenedor
docker exec <contenedor> java -jar /app/app.jar --cli.command=export \
  --cli.start=2026-01-01 --cli.end=2026-06-30 > report.zip

# dry run (sin generación real)
java -jar app.jar --cli.command=export --cli.start=... --cli.end=... --cli.dry-run

# listar todos los comandos
java -jar app.jar --cli.command=help
```

| Opción | Requerida | Significado |
|---|---|---|
| `--cli.command=export` | sí | ejecuta el comando de exportación |
| `--cli.start=YYYY-MM-DD` | sí | fecha de inicio (inclusive) |
| `--cli.end=YYYY-MM-DD` | sí | fecha de fin (inclusive) |
| `--cli.dry-run` | no | solo simulación, sin generación real |
