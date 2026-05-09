# RETOMAR_ANALISIS

## Propósito
Este archivo mantiene el historial operativo y técnico del proyecto `portal-vecinal` para poder retomar trabajo sin perder contexto entre sesiones, deploys o correcciones en producción.

Regla de continuidad:
- Actualizar este archivo cada vez que se haga un cambio relevante de código.
- Actualizar este archivo cada vez que se publique en GitHub o Render.
- Registrar errores observados, causa real o sospechada, solución aplicada y estado posterior.
- No guardar secretos reales en este archivo.

## Proyecto
- Repo GitHub: `cesarmoraa/portal-vecinal`
- Monorepo:
  - `apps/api`
  - `apps/web`
- Producción:
  - Backend Render: `https://portal-vecinal-api.onrender.com`
  - Frontend Render: `https://portal-vecinal-web.onrender.com`
- Base de datos: Supabase PostgreSQL

## Arquitectura vigente
- Frontend: React + Vite + Leaflet + OpenStreetMap
- Backend: Node.js + Express
- Auth: JWT por cookie `httpOnly` + bcrypt
- DB: PostgreSQL en Supabase
- Hosting: Render

## Historial resumido

### 2026-05-07
- Se dejó montado el MVP inicial del portal vecinal.
- Se creó el monorepo con frontend y backend.
- Se agregaron scripts de importación/exportación Excel.
- Se dejó `render.yaml` y estructura base para deploy en Render.
- Se publicó el repo en GitHub.

### 2026-05-07
- Error en Render Static Site:
  - Mensaje: `Could not resolve entry module "index.html"`
- Causa:
  - `apps/web/index.html` no estaba llegando al repo remoto por una regla demasiado amplia en `.gitignore` (`*.html`).
- Solución:
  - Se ajustó `.gitignore` para permitir `apps/web/index.html`.
- Resultado:
  - El frontend quedó desplegado correctamente en Render.

### 2026-05-08
- Error en login productivo:
  - En UI aparecía un error técnico de backend/DB.
- Causa real:
  - En Render backend había variables placeholder todavía activas.
  - `DATABASE_URL` no apuntaba a Supabase real.
  - `ADMIN_PASSWORD` también estaba con valor de ejemplo.
- Hallazgo adicional importante:
  - El esquema real en Supabase no coincidía completamente con el backend actual.
  - Había diferencias en `users`, `vecinos`, `pagos`, `configuracion_cobros` y `auditoria`.
- Solución aplicada:
  - Se actualizó la contraseña de la base en Supabase.
  - Se configuró Render backend para usar la conexión del `Session pooler` de Supabase.
  - Se aplicó una migración de compatibilidad sobre la base productiva para soportar el backend vigente.
  - Se dejaron operativos usuarios `admin` y `tesorero`.
- Resultado:
  - `GET /api/health` respondió `200 OK`.
  - Login `admin` operativo.
  - Login `tesorero` operativo.

## Estado actual en producción
- Backend Render responde correctamente.
- Frontend Render carga correctamente.
- Login `admin` y `tesorero` ya fueron validados vía API.
- La app no está completamente estabilizada después del login.

## Problema activo actual
- Síntoma:
  - Después del login admin, la UI queda en `Cargando panel admin...`.
- Evidencia visible:
  - Capturas de pantalla muestran la pantalla de carga infinita del panel admin.
- Componente involucrado:
  - `apps/web/src/pages/AdminDashboardPage.jsx`
- Flujo involucrado:
  - `loadAdminData()` llama:
    - `GET /dashboard/overview`
    - `GET /admin/auditoria?limit=120`
- Sospecha técnica principal:
  - `dashboardService` aún asume columnas del esquema nuevo, por ejemplo:
    - `vecinos.representante_nombre`
    - `pagos.concepto`
    - `pagos.deleted_at`
  - La base productiva venía de un esquema previo y puede seguir teniendo compatibilidades incompletas para el dashboard.
- Posible efecto en frontend:
  - Si `loadAdminData()` falla, el estado `overview` nunca se llena.
  - El componente queda en:
    - `if (!overview) return <div className="centered-screen">Cargando panel admin...</div>;`
  - Además el `catch(console.error)` no muestra error visible en pantalla.

### Diagnóstico refinado 2026-05-08
- Los endpoints probados manualmente con sesión admin sí responden:
  - `GET /api/dashboard/overview` -> `200`
  - `GET /api/admin/auditoria?limit=120` -> `200`
- Esto indica que el backend base no está caído.
- Hipótesis más fuerte:
  - la sesión entre frontend Render y backend Render depende de cookie cross-origin/cross-site
  - la cookie estaba configurada con `SameSite=Lax`
  - en producción eso puede impedir que el browser mande la cookie desde `portal-vecinal-web` hacia `portal-vecinal-api`
  - el login parece exitoso porque el endpoint `/auth/login` devuelve el usuario y el frontend navega con ese payload
  - luego el panel intenta cargar datos y falla silenciosamente
- Problema adicional detectado:
  - `dashboardService.fetchConfigs()` devolvía claves según el valor real de DB, que en producción aparecían en minúscula (`portones`, `mantencion`)
  - el frontend y el resto del backend esperan `PORTONES` y `MANTENCION`

### Corrección en curso 2026-05-08
- Backend:
  - se agregó soporte de `COOKIE_SAME_SITE`
  - default automático:
    - `none` cuando `COOKIE_SECURE=true`
    - `lax` en local/desarrollo
  - `setSessionCookie` y `clearSessionCookie` usan el valor configurable
  - `fetchConfigs()` normaliza claves a `PORTONES` y `MANTENCION`
- Frontend:
  - `AdminDashboardPage` ya no queda en loading infinito silencioso
  - `TreasurerDashboardPage` también recibe manejo visible de error
  - ambos paneles muestran mensaje y botón de reintento si falla la carga inicial

## Cambios locales aún no publicados
Estado observado en `git status --short`:
- `M apps/api/src/app.js`
- `M apps/api/src/config/env.js`
- `M apps/api/src/middleware/errorHandler.js`
- `?? apps/api/scripts/_tmp_inspect_users.mjs`
- `?? apps/api/scripts/_tmp_migrate_live_schema.mjs`
- `?? apps/api/scripts/_tmp_seed_admin_treasurer.mjs`
- `?? apps/api/scripts/_tmp_verify_seeded_users.mjs`

### Qué hacen esos cambios locales
- `apps/api/src/app.js`
  - Endurecimiento del endpoint de health para reflejar mejor problemas de DB.
- `apps/api/src/config/env.js`
  - Detección de placeholders o configuración inválida de `DATABASE_URL`.
- `apps/api/src/middleware/errorHandler.js`
  - Sanitización de errores técnicos para no exponer mensajes crudos al frontend.

### Scripts temporales
Los archivos `_tmp_*` fueron usados para inspección, compatibilidad de esquema y seed manual en producción.

No deberían quedar como solución final.

Acción recomendada:
- Revisarlos.
- Convertir lo útil en migraciones o utilidades permanentes.
- Eliminar lo temporal antes de cerrar una versión estable.

## Archivos clave a revisar al retomar
- Backend:
  - `apps/api/src/services/dashboardService.js`
  - `apps/api/src/services/adminService.js`
  - `apps/api/src/services/authService.js`
  - `apps/api/src/app.js`
  - `apps/api/src/config/env.js`
  - `apps/api/src/middleware/errorHandler.js`
- Frontend:
  - `apps/web/src/context/AuthContext.jsx`
  - `apps/web/src/components/ProtectedRoute.jsx`
  - `apps/web/src/pages/AdminDashboardPage.jsx`
  - `apps/web/src/lib/api.js`
- Infra:
  - `render.yaml`
  - `database/schema.sql`
  - `database/seed.sql`

## Secretos y credenciales
No guardar aquí:
- contraseñas reales
- `DATABASE_URL`
- `JWT_SECRET`
- credenciales de admin o tesorero

Dónde viven:
- Render Environment Variables
- Supabase project settings

Si se rotan credenciales:
- registrar que se rotaron
- registrar qué servicio quedó actualizado
- no registrar el valor secreto

## Próximos pasos recomendados
1. Reproducir el bloqueo del panel admin con sesión real y confirmar qué endpoint falla.
2. Verificar `GET /dashboard/overview` con la sesión admin.
3. Corregir incompatibilidades restantes entre esquema productivo y consultas del dashboard.
4. Mostrar errores visibles en frontend para no quedar en loading infinito.
5. Limpiar y formalizar scripts `_tmp_*`.
6. Versionar y publicar los cambios locales de hardening del backend.

## Checklist mínima antes de publicar
- `npm run build --workspace apps/api`
- `npm run build --workspace apps/web`
- probar login admin
- probar login tesorero
- probar carga de `/admin`
- probar carga de `/tesorero`
- verificar `GET /api/health`
- actualizar este archivo

## Última actualización
- Fecha: 2026-05-08
- Estado: producción operativa en login, dashboard admin todavía con problema de carga infinita
