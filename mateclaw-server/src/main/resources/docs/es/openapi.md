# Guía de OpenAPI / Swagger

El backend de AuraClaw integra [SpringDoc OpenAPI](https://springdoc.org/) (`springdoc-openapi-starter-webmvc-ui`), que auto-genera un documento OpenAPI 3 desde cada `@RestController` y sirve una UI de depuración interactiva. Esta página cubre cómo acceder y usarla.

> Este es el punto de entrada de documentación **legible por máquina**. Para los detalles de endpoints legibles por humanos, convenciones y el inventario completo de rutas, ver la [Referencia de API](./api). Relación: Swagger = el contrato auto-generado legible por máquina desde las anotaciones del código; `api.md` = walkthroughs de endpoints insignia + convenciones compartidas.

## URLs

Tras desplegar el backend, relativas a la dirección del servidor (puerto local por defecto `18088`):

| URL | Propósito |
|---|---|
| `/swagger-ui.html` | Swagger UI — navegar + depurar (Authorize, Try it out) |
| `/v3/api-docs` | JSON OpenAPI 3 (importar a Postman / Apifox / Insomnia) |
| `/v3/api-docs.yaml` | YAML OpenAPI 3 (descargar, commitear o importar) |

Ejemplos locales:

```bash
# Abrir en un navegador
open http://localhost:18088/swagger-ui.html

# Descargar el YAML
curl http://localhost:18088/v3/api-docs.yaml -o mateclaw-openapi.yaml
```

## Autenticación (Authorize)

Usa el botón **Authorize** arriba a la derecha. En el campo `bearerAuth`, pega un token **sin** el prefijo `Bearer ` (la UI lo agrega automáticamente):

- **JWT**: el campo `token` devuelto por `POST /api/v1/auth/login` (empieza con `eyJ...`).
- **Personal Access Token**: un token `mc_...` creado vía `POST /api/v1/auth/tokens`.

Ambos pasan por el encabezado estándar `Authorization: Bearer <token>`; el `JwtAuthFilter` del backend despacha por prefijo (JWT → verificación JWT, `mc_` → verificación PAT). Una vez autorizado, los endpoints protegidos `@RequireWorkspaceRole` / `@RequireGlobalAdmin` pueden llamarse directamente vía Try it out.

> Depurar endpoints de streaming SSE (`/chat/stream`, etc.) en Swagger UI es limitado — la UI bufferea las respuestas `text/event-stream`. Para integración SSE real, sigue la [Referencia de API](./api) y usa `curl -N` o un lector de streaming con `fetch()`.

## Cobertura de endpoints

SpringDoc auto-escanea cada `@RestController`. Alrededor del 85% de los controllers ya llevan `@Tag` (agrupación) y `@Operation(summary)` (resumen de método), así que la agrupación de la UI y las descripciones de endpoints están en gran medida completas.

**Mejoras de anotaciones aún no hechas** (fuera de alcance para esta pasada, dejadas para después):

- Sin descripciones `@Parameter`, códigos de error `@ApiResponse`, ni `@Schema` de cuerpos de solicitud — para documentación a nivel de campo, remítete a los walkthroughs legibles de `api.md`.
- Los endpoints públicos (login, SSE, etc.) no se excluyen individualmente con `@SecurityRequirements({})`, así que muestran un icono de candado en Swagger aunque `SecurityConfig` ya los permite — las llamadas reales no se ven afectadas.

## Configuración

Los metadatos globales de OpenAPI (título, descripción, versión, URL del servidor) los impulsa el bean `OpenApiConfig` y son sobrescribibles vía `mateclaw.openapi.*` en `application.yml`:

```yaml
mateclaw:
  openapi:
    title: ${MATECLAW_OPENAPI_TITLE:AuraClaw REST API}
    version: ${MATECLAW_OPENAPI_VERSION:1.0}
    server-url: ${MATECLAW_OPENAPI_SERVER_URL:}   # vacío → derivado del host de la solicitud
    description: ${MATECLAW_OPENAPI_DESCRIPTION:}  # vacío → default integrado
    expose-ui: ${MATECLAW_OPENAPI_EXPOSE_UI:true}  # si las rutas Swagger/OpenAPI son públicas, ver la sección de seguridad abajo
```

Cuando `server-url` está vacío, SpringDoc lo deriva del host de la solicitud para que "Try it out" golpee la dirección correcta; para URLs de producción fijas (p. ej. detrás de un reverse proxy), define `MATECLAW_OPENAPI_SERVER_URL=https://mate.example.com`.

## 🔒 Control de acceso: Swagger está bloqueado por defecto en producción

El acceso a las rutas de Swagger UI / documento OpenAPI (`/swagger-ui*`, `/v3/api-docs*`, `/webjars/**`) lo controla la flag `mateclaw.openapi.expose-ui` y se impone explícitamente en `SecurityConfig.filterChain` (ya no depende del fallthrough `.anyRequest().permitAll()`):

| `expose-ui` | Comportamiento | Perfil por defecto |
|---|---|---|
| `true` | Públicamente accesible — cualquiera puede navegar la superficie completa de endpoints (incl. esquemas de solicitud/respuesta) sin login | Perfil local / por defecto (H2, escritorio) |
| `false` | Requiere un admin global (`ROLE_ADMIN`); anónimo → 401, no-admin → 403 | Perfiles de producción (`mysql` / `kingbase` / `postgres`) |

- Dev local: por defecto `true`, así `http://localhost:18088/swagger-ui.html` es alcanzable directamente.
- Producción pública: por defecto `false` (bloqueado). Para abrirlo temporalmente en un host interno/staging, define `MATECLAW_OPENAPI_EXPOSE_UI=true`.
- Nota: una vez bloqueado, abrir `/swagger-ui.html` en un navegador no llevará automáticamente el JWT de la SPA (el token vive en localStorage, no en una cookie), así que ni siquiera un admin puede abrirlo directo desde el navegador. Para depurar, pon `expose-ui=true` temporalmente, o haz fetch de `/v3/api-docs` con un cliente que envíe el encabezado `Authorization`.
- La regla de acceso vive solo en `SecurityConfig`, no en `OpenApiConfig`.

## Ver también

- [Referencia de API (legible por humanos)](./api) — walkthroughs de endpoints insignia + convenciones + inventario completo de rutas
- [Guía de integración WebChat](./webchat) — integración HTTP / SSE de sitios externos (incl. el protocolo de eventos SSE)
