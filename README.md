# Comunidad Cobros

Plataforma web profesional y segura para administración vecinal de pagos de portones y mantenciones, construida como sistema real con backend autoritativo, base de datos PostgreSQL en Supabase, mapa GIS con Leaflet y auditoría completa.

## Qué resuelve

- Login por roles: `vecino`, `tesorero`, `admin`
- PIN inicial para vecinos derivado del teléfono, con cambio obligatorio al primer ingreso
- Autenticación segura con `JWT` en cookie `httpOnly` y `bcrypt`
- Registro de pagos por monto, sin ingresar cuotas manualmente
- Cálculo en backend de:
  - cuotas equivalentes
  - saldo pendiente
  - porcentaje de avance
  - estado financiero
- Mapa interactivo tipo GIS con `Leaflet + OpenStreetMap`
- Comparativo anónimo de comunidad
- Auditoría obligatoria de accesos, pagos, restauraciones, importaciones y exportaciones
- Importación y exportación Excel compatible con las hojas:
  - `BD`
  - `Resumen`
  - `$Portones`
  - `$Mantenciones`

## Arquitectura

### Backend

- `Node.js + Express`
- `PostgreSQL (Supabase)`
- `JWT` firmado en backend
- `bcrypt` para PINs y contraseñas
- Toda lógica crítica vive en servidor

Rutas principales:

- `POST /api/auth/login`
- `POST /api/auth/change-pin`
- `GET /api/dashboard/overview`
- `GET /api/vecino/portal`
- `POST /api/pagos`
- `PUT /api/pagos/:paymentId`
- `POST /api/admin/import-excel`
- `GET /api/admin/export-excel`
- `POST /api/admin/reset-neighbor-pin`
- `GET /api/admin/auditoria`

### Frontend

- `React + Vite`
- `React Router`
- `React Leaflet`
- Diseño `map-first`: el mapa es el centro visual y operativo

### Base de datos

Tablas principales:

- `vecinos`
- `users`
- `pagos`
- `configuracion_cobros`
- `auditoria`

## Estructura del proyecto

```text
.
├── apps
│   ├── api
│   │   ├── scripts
│   │   └── src
│   └── web
│       └── src
├── database
│   ├── schema.sql
│   └── seed.sql
├── Direcciones BD.xlsx
├── Estatus al 07052026.xlsx
└── render.yaml
```

## Variables de entorno

Usa `.env.example` como base.

Variables clave:

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_ORIGIN`
- `COOKIE_SECURE`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`
- `IMPORT_YEAR`
- `EXPORT_YEAR`
- `VITE_API_URL`

## Instalación local

```bash
npm install
```

## Preparación de base de datos en Supabase

1. Crea un proyecto PostgreSQL en Supabase.
2. Ejecuta [`database/schema.sql`](/Users/cesarmora/Library/Mobile%20Documents/com~apple~CloudDocs/Personal/Casa/Comunidad/database/schema.sql).
3. Ejecuta [`database/seed.sql`](/Users/cesarmora/Library/Mobile%20Documents/com~apple~CloudDocs/Personal/Casa/Comunidad/database/seed.sql).
4. Configura `DATABASE_URL` en `.env`.

## Crear admin inicial

```bash
npm run seed:admin
```

Esto crea o actualiza el usuario admin usando:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`

## Importar Excel inicial

CLI:

```bash
npm run import:excel -- ./Direcciones\ BD.xlsx 2026
```

Modo SOS:

```bash
npm run import:excel -- ./Direcciones\ BD.xlsx 2026 --sos
```

También se puede importar desde el panel admin vía formulario.

## Exportar Excel

CLI:

```bash
npm run export:excel -- 2026
```

También se puede exportar desde el panel admin.

## Ejecutar en desarrollo

API:

```bash
npm run dev:api
```

Frontend:

```bash
npm run dev:web
```

## Reglas de seguridad implementadas

- El navegador no decide estados financieros
- El frontend no calcula cuotas equivalentes definitivas
- Las contraseñas y PINs nunca se almacenan en texto plano
- El admin no puede ver contraseñas reales
- La restauración genera PIN temporal y obliga cambio
- Los endpoints sensibles exigen rol y sesión válida
- Se registra auditoría de:
  - login exitoso
  - login fallido
  - logout
  - creación/edición de pagos
  - restauración de PIN
  - cambios de configuración
  - importación Excel
  - exportación Excel
  - creación de tesorero

## Modelo financiero

La tabla `configuracion_cobros` define por concepto:

- `cuotas_totales`
- `valor_cuota`
- `anio`
- `mes_inicio`
- `activo`

Con eso, el backend calcula automáticamente:

- total abonado
- cuotas equivalentes pagadas
- cuotas esperadas a la fecha
- saldo pendiente
- estado: `Al día`, `Parcial`, `Atrasado`, `Sin firma`, `Adelantado`

## Supuestos importantes

- La exportación mensual se agrupa por `period_year` y `period_month`.
- Los pagos importados desde Excel usan una fecha referencial del día 5 de cada mes, porque el libro original no trae fecha exacta por pago.
- El Excel se usa como:
  - carga inicial
  - respaldo
  - exportación
  - recuperación SOS
- La lógica operativa diaria vive en PostgreSQL y en el backend.

## Deploy en Render

El archivo [`render.yaml`](/Users/cesarmora/Library/Mobile%20Documents/com~apple~CloudDocs/Personal/Casa/Comunidad/render.yaml) deja lista la base para:

- un servicio web Node para `apps/api`
- un sitio estático para `apps/web`

Antes de publicar:

1. Sube el proyecto a GitHub.
2. Conecta el repositorio en Render.
3. Configura las variables de entorno del backend y del frontend.
4. Ejecuta `schema.sql` y `seed.sql` en Supabase.
5. Ejecuta `npm run seed:admin`.

## Pendientes naturales para una segunda fase

- paginación avanzada de auditoría
- edición de datos maestros de vecinos desde UI admin
- filtros de mapa por estado/concepto
- subida de archivos con validación visual más rica
- pruebas automáticas unitarias e integración
