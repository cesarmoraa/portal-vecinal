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
- El panel admin quedó operativo y el sistema ya está precargado con el Excel base.

## Ajustes UI y compatibilidad 2026-05-09
- Objetivo:
  - separar el flujo de tesorería del mapa
  - hacer el panel vecino más simple de entender
  - corregir compatibilidades heredadas que seguían afectando login vecino y creación manual de pagos
- Cambios aplicados en código:
  - `TreasurerDashboardPage` ahora usa 2 pestañas:
    - `Resumen y pagos`
    - `Mapa comunitario`
  - el mapa deja de compartir pantalla con el formulario del tesorero
  - `NeighborDashboardPage` ahora muestra cuotas pagadas como:
    - `X de Y`
    - para `Portones 2026`
    - para `Mantención 2026`
  - `Contexto anónimo` dejó de usar porcentajes y ahora muestra:
    - vecinos al día en toda la comunidad
    - vecinos al día en el pasaje del vecino
  - `MapView` se acercó visualmente al HTML de referencia:
    - fondo más neutro
    - tiles OSM atenuados
    - marcadores más legibles para etiquetas como `12/12`
    - refresco de tamaño al activarse una pestaña para evitar render malo al hacer zoom
- Compatibilidad backend agregada:
  - `paymentService` ahora llena `tipo_pago` legacy cuando la tabla productiva lo exige
  - `authService` ahora tolera registros heredados con `pin_hash` o `password_hash`
  - `authService` y `middleware/auth` ahora aceptan `active` o `activo`
  - la importación Excel vuelve a sembrar credenciales iniciales para vecinos que todavía siguen con `must_change_password = true`
- Resultado esperado después de publicar:
  - el tesorero puede registrar pagos sin error por `tipo_pago`
  - el login vecino queda más robusto frente a registros heredados
  - el mapa dentro de tabs se debería renderizar correctamente
  - la lectura del panel vecino queda más clara para usuarios no técnicos

### Segunda iteración UX tesorero 2026-05-09
- Ajustes solicitados después de revisar pantallas reales:
  - cambiar `Formulario tesorero` por `Registro de pagos`
  - reducir sensación de bloque demasiado ancho
  - `Resumen de pagos` debe leer estado por concepto y no solo global
  - agregar una tercera pestaña con vista ejecutiva por dirección
- Cambios aplicados:
  - `TreasurerDashboardPage` ahora tiene 3 pestañas:
    - `Resumen y pagos`
    - `Mapa comunitario`
    - `Vista general`
  - `Resumen de pagos` ahora muestra por filas:
    - `Portones`: vecinos al día / vecinos atrasados
    - `Mantención`: vecinos al día / vecinos atrasados
  - se agregó `StreetExecutiveSummary` con una fila por pasaje:
    - vecinos al día
    - vecinos atrasados
    - sin firma
  - se agregó `OverviewTable`:
    - dirección
    - representante
    - firma
    - estado general
    - portones `X de Y`
    - mantención `X de Y`
    - total abonado
    - saldo
  - el login vecino ahora intenta autorreparar el hash inicial cuando:
    - el usuario es `vecino`
    - sigue con `must_change_password = true`
    - el PIN ingresado coincide con los últimos 4 dígitos del teléfono
- Resultado esperado:
  - mejor lectura ejecutiva para tesorería
  - menos confusión con el ancho del formulario
  - más tolerancia para vecinos con credenciales iniciales heredadas

### Ajuste fino vista general 2026-05-09
- Cambios adicionales solicitados:
  - cabecera fija en la tabla de `Vista general`
  - exportador Excel accesible también para `tesorero`
  - separación más clara entre nombre del pasaje y cantidad de direcciones
- Solución aplicada:
  - se agregó `GET /api/dashboard/export-excel` para roles `admin` y `tesorero`
  - `OverviewTable` ahora tiene botón `Exportar Excel`
  - la tabla ejecutiva usa `thead` sticky dentro del contenedor con scroll
  - el bloque por pasaje ahora usa un layout vertical en el título para evitar textos pegados como `EL HUERTO3 direcciones`
- Resultado esperado:
  - el tesorero puede exportar desde su propia vista general
  - el encabezado se mantiene visible mientras baja por la tabla
  - el resumen por pasaje queda más legible

### Ajuste de alcance del Excel ejecutivo 2026-05-09
- Requerimiento adicional:
  - el Excel descargable desde `Vista general` no debe usar el workbook completo
  - debe exportar solo columnas ejecutivas
- Solución aplicada:
  - se creó un workbook específico para tesorería con estas columnas:
    - `Direccion`
    - `Nombre`
    - `Pasaje`
    - `Firma VºBº`
    - `Cuota Portones`
    - `Cuota Mantención`
  - `Direccion` se exporta como `PASAJE + numeración`
  - las cuotas se exportan en formato `X de Y`
  - `dashboard/export-excel` ya no reutiliza el export completo del admin
- Resultado esperado:
  - el archivo descargado desde tesorería queda breve, ejecutivo y coherente con la tabla de `Vista general`

### Ajuste de zoom del mapa 2026-05-11
- Problema reportado:
  - el mapa se veía muy mal al hacer zoom
  - los marcadores se sentían demasiado grandes y pesados
  - el fondo base casi desaparecía por exceso de gris y baja opacidad
- Solución aplicada:
  - `MapView` ahora adapta el tamaño del marcador según nivel de zoom
  - se limitó mejor el rango de zoom útil
  - se desactivaron animaciones de zoom/fade para evitar sensación rara en labels
  - `fitBounds` quedó con un tope más conservador
  - se devolvió más visibilidad al tile base para que el usuario entienda mejor el contexto del mapa
- Resultado esperado:
  - mejor lectura visual al acercarse o alejarse
  - menos solapamiento aparente de etiquetas
  - mapa más estable dentro de la pestaña

### Limpieza de datos falsos en panel vecino 2026-05-11
- Problema reportado:
  - en `Detalle histórico` del vecino seguían apareciendo datos confusos o falsos
  - se veía la columna técnica `Origen` con valores como `excel_resumen` y `manual`
  - algunas fechas aparecían corridas, por ejemplo al cierre del año anterior
- Causa real:
  - durante la importación anterior se habían creado pagos sintéticos `source = excel_resumen` para complementar diferencias entre `Resumen` y hojas mensuales
  - esos movimientos eran útiles como precarga técnica, pero no debían mostrarse al vecino ni entrar en totales ejecutivos
  - el frontend estaba formateando fechas `YYYY-MM-DD` con `new Date(...)`, lo que en Chile podía restar un día por zona horaria
- Solución aplicada:
  - `neighborService.getVecinoLedger()` ahora excluye `source = excel_resumen`
  - `dashboardService.fetchPaymentTotals()` ahora excluye `source = excel_resumen`
  - `adminService.exportDatabaseToWorkbook()` ahora excluye `source = excel_resumen`
  - `importWorkbookToDatabase()` ya no vuelve a crear esos pagos sintéticos desde `Resumen`
  - `NeighborDashboardPage` dejó de mostrar la columna `Origen`
  - `formatDate()` ahora interpreta `YYYY-MM-DD` como fecha local para evitar el corrimiento
- Resultado esperado:
  - el vecino verá solo pagos reales importados desde hojas mensuales o pagos manuales reales
  - desaparecen valores técnicos como `excel_resumen`
  - las fechas quedan alineadas con el día correcto en Chile

### Corrección de lectura real desde Excel para `LAS MALVAS 854` 2026-05-11
- Validación directa sobre `Direcciones BD.xlsx`:
  - en `$Portones`, `LAS MALVAS 854` sí tiene pagos importables
  - el parser leyó 5 movimientos `PORTONES` para 2026:
    - agosto: `$40.000`
    - septiembre: `$40.000`
    - octubre: `$40.000`
    - noviembre: `$40.000`
    - diciembre: `$40.000`
- Problema detectado:
  - si la base ya tenía esos pagos guardados como `portones`/`mantencion` en minúscula por una importación anterior, el resumen financiero podía ignorarlos al buscar solo `PORTONES` / `MANTENCION`
- Solución aplicada:
  - `fetchPaymentTotals()` ahora agrupa usando `upper(concepto)` y normaliza la clave resultante
  - `getVecinoLedger()` normaliza `concepto` antes de calcular cuotas equivalentes y antes de enviarlo al frontend
  - `groupPaymentsByVecino()` también normaliza conceptos para no romper exportaciones
  - en la UI se reemplazó el texto ambiguo `Saldo` por `Saldo pendiente`
- Resultado esperado:
  - si en producción existían pagos válidos con concepto en minúscula, vuelven a sumarse correctamente
  - el panel vecino deja de mostrar `0 de 12` por un problema de normalización

### Pestaña `Mando de cobros` en tesorería 2026-05-11
- Requerimiento:
  - preparar la plataforma para operación en régimen desde la propia plataforma y no desde Excel
  - exponer en el portal tesorero una vista tipo mando que muestre:
    - concepto
    - cantidad de cuotas
    - valor cuota
    - total esperado por casa
    - total esperado comunidad
- Solución aplicada:
  - `TreasurerDashboardPage` ahora tiene una pestaña adicional `Mando de cobros`
  - la vista se alimenta desde `CONFIGURACION_COBROS` real (`overview.configs`)
  - calcula:
    - total por casa = `cuotas_totales * valor_cuota`
    - total comunidad = `total por casa * totalDirecciones`
- Limitación actual declarada:
  - la pestaña ya quedó lista como base operativa y puede leer múltiples filas de configuración
  - pero el backend y el esquema completo todavía siguen muy orientados a `PORTONES` y `MANTENCION`
  - para soportar más de 2 conceptos de recaudación en todo el sistema se requerirá una segunda fase:
    - migrar `payment_concept` / `configuracion_cobros`
    - volver dinámicos los resúmenes financieros, mapa y panel vecino
    - permitir registrar pagos para conceptos nuevos sin lógica hardcodeada

## Importación Excel 2026-05-08
- Objetivo:
  - usar `Direcciones BD.xlsx` para precargar la base real del sistema
  - no solo validar archivo, sino dejar vecinos, pagos y mapa poblados
- Resultado final:
  - importación productiva exitosa
  - `92` vecinos precargados
  - `120` pagos importados o sintetizados
- Fuentes usadas del Excel:
  - hoja `BD` para vecinos y ubicación
  - hoja `Resumen` para cuotas equivalentes iniciales
  - hojas `$Portones` y `$Mantenciones` para pagos mensuales explícitos
- Criterio aplicado:
  - los pagos mensuales explícitos se importan como movimientos `source = excel`
  - si `Resumen` trae cuotas equivalentes mayores que lo visto mes a mes, se crea una precarga complementaria `source = excel_resumen`
  - esa precarga usa la configuración real de `CONFIGURACION_COBROS` para convertir cuotas equivalentes a monto

### Por qué fallaba la importación
- No era un problema del archivo en sí.
- La causa real fue deriva de esquema entre la base productiva y el backend actual.
- Errores encontrados durante el diagnóstico:
  - `there is no unique or exclusion constraint matching the ON CONFLICT specification`
  - `null value in column "username" of relation "users" violates not-null constraint`
  - `null value in column "password_hash" of relation "users" violates not-null constraint`
  - `new row for relation "pagos" violates check constraint "pagos_tipo_pago_check"`

### Solución aplicada a la importación
- Se rehízo la importación para que sea tolerante a esquema heredado:
  - inserción y actualización manual de `vecinos`
  - inserción y actualización manual de `pagos` importados
  - detección dinámica de columnas reales en `users` y `pagos`
  - compatibilidad con `username` y `password_hash` obligatorios en `users`
  - compatibilidad con `tipo_pago` legacy en minúscula (`portones`, `mantencion`)
- Se robusteció el parser del Excel:
  - lectura correcta de celdas con fórmulas y resultados cacheados
  - celdas con error Excel como `#N/A` ya no terminan en texto basura como `[object Object]`
  - cuando falta representante o teléfono, el sistema usa valores vacíos o `Sin representante`

### Validación posterior
- El endpoint `GET /api/dashboard/overview` ya devolvió datos poblados después de importar.
- El mapa y los resúmenes pueden construirse con datos reales.
- Casos antes sucios, como nombres o teléfonos en fórmulas fallidas, quedaron limpiados.

## Problema activo actual
- No hay un bloqueo funcional abierto en el flujo de importación inicial.
- El sistema ya quedó con precarga productiva desde Excel.
- Tema técnico pendiente no bloqueante:
  - `express-rate-limit` avisa en Render sobre `X-Forwarded-For` y conviene formalizar `trust proxy` en Express para el entorno productivo.

### Correcciones aplicadas 2026-05-08
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

### Hallazgo adicional 2026-05-08
- El frontend público en Render sí quedó desplegado, pero las rutas SPA no estaban configuradas.
- Evidencia:
  - `https://portal-vecinal-web.onrender.com/login` devolvía `Not Found`
  - eso explica por qué entrar directo a rutas como `/login`, `/admin`, `/tesorero` o `/vecino` fallaba aunque el bundle estuviera publicado
- Causa:
  - faltaba rewrite de Render para redirigir `/*` hacia `/index.html`
- Solución aplicada:
  - se agregó rewrite persistente en `render.yaml`
  - se agregó `apps/web/public/_redirects` con `/* /index.html 200`
- Hallazgo operativo importante:
  - el cambio en repo no bastó por sí solo para el Static Site ya existente en Render
  - fue necesario agregar manualmente en Render `Redirects/Rewrites` la regla:
    - source: `/*`
    - destination: `/index.html`
    - action: `Rewrite`
- Resultado:
  - React Router ya resuelve correctamente `/login`, `/admin`, `/tesorero` y `/vecino`

### Resolución del panel admin 2026-05-08
- Se validó login admin real en producción desde navegador.
- Flujo confirmado:
  - `POST /api/auth/login` responde correctamente
  - el browser navega a `/admin`
  - el panel admin carga completo sin quedar en loading infinito
- Evidencia funcional observada:
  - se visualiza `Panel admin`
  - aparece usuario autenticado `admin`
  - carga mapa Leaflet
  - carga configuración global de `PORTONES` y `MANTENCION`
  - carga formulario de creación de tesorero
  - carga auditoría con eventos `auth.login_success` y `auth.login_failed`
- Conclusión:
  - el bloqueo principal de producción quedó resuelto
  - los fixes de sesión cross-site y normalización de conceptos quedaron efectivos en producción
  - la app ya está operativa a nivel de acceso admin
  - la importación inicial desde Excel ya fue ejecutada con éxito

## Cambios locales aún no publicados
Estado observado en `git status --short`:
- `?? apps/api/scripts/_tmp_inspect_users.mjs`
- `?? apps/api/scripts/_tmp_migrate_live_schema.mjs`
- `?? apps/api/scripts/_tmp_seed_admin_treasurer.mjs`
- `?? apps/api/scripts/_tmp_verify_seeded_users.mjs`

### Qué hacen esos cambios locales
- Los cambios productivos relevantes de frontend/backend ya fueron publicados.
- Lo único que sigue local y sin versionar son scripts temporales `_tmp_*`.
- Los endurecimientos de backend ya quedaron versionados y desplegados.

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
1. Probar flujo tesorero end-to-end con registro de pago real.
2. Probar flujo vecino con cambio obligatorio de PIN y panel propio.
3. Validar exportación Excel recalculada desde producción.
4. Limpiar y formalizar scripts `_tmp_*`.
5. Consolidar migración formal para capturar la compatibilidad productiva actual en `schema.sql` o una migración dedicada.
6. Ajustar `trust proxy` en Express para Render y eliminar la advertencia de rate-limit.

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
- Fecha: 2026-05-11
- Estado: código listo con mejora de zoom en mapa y legibilidad de tiles; pendiente publicación de este ajuste visual
